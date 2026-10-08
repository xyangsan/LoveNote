import { getStoredUniIdToken } from '../api/router.js'
import { publish } from './push-bus.js'

/**
 * 游戏房间 WebSocket 客户端（单例，全局只有一条连接）
 *
 * 设计要点：
 * - 只负责「连接 + 鉴权 + 房间订阅 + 心跳 + 重连」，业务数据一律走 HTTP。
 * - 服务端推送只含 { roomId, version }，收到后交给 push-bus，由房间页自行 syncRoom。
 * - 连不上 / 老基座 / socket 白名单未配 时状态转为 unavailable，由 room-sync 自动降级轮询。
 * - 重连退避带随机抖动，避免同一房间客户端同时打库。
 */

const WS_FUNCTION_NAME = 'game-ws'

const STATUS = {
	IDLE: 'idle',
	CONNECTING: 'connecting',
	CONNECTED: 'connected',
	RECONNECTING: 'reconnecting',
	UNAVAILABLE: 'unavailable',
	CLOSED: 'closed'
}

const HEARTBEAT_INTERVAL = 25 * 1000
const PONG_TIMEOUT = 60 * 1000
const CONNECT_TIMEOUT = 12 * 1000
const BASE_RETRY_DELAY = 1000
const MAX_RETRY_DELAY = 8000
const IDLE_CLOSE_DELAY = 30 * 1000
const UNAVAILABLE_AFTER_ATTEMPTS = 3

const state = {
	supported: true,
	task: null,
	status: STATUS.IDLE,
	uid: '',
	roomId: '',
	attempts: 0,
	everConnected: false,
	joined: false,
	retryTimer: null,
	heartbeatTimer: null,
	connectTimer: null,
	closeTimer: null,
	lastPongAt: 0,
	manualClose: false,
	statusHandlers: new Set()
}

function log(...args) {
	console.log('[game-ws]', ...args)
}

function setStatus(next = STATUS.IDLE) {
	if (state.status === next) {
		return
	}
	const previous = state.status
	state.status = next
	Array.from(state.statusHandlers).forEach((handler) => {
		try {
			handler(next, previous)
		} catch (error) {
			console.warn('game-ws status handler failed', error)
		}
	})
}

export function getStatus() {
	return state.status
}

export function isPushReady() {
	return state.status === STATUS.CONNECTED && state.joined
}

export function onStatusChange(handler) {
	if (typeof handler !== 'function') {
		return () => {}
	}
	state.statusHandlers.add(handler)
	return () => {
		state.statusHandlers.delete(handler)
	}
}

export function isSupported() {
	return state.supported
}

function clearTimer(key) {
	if (state[key]) {
		clearTimeout(state[key])
		state[key] = null
	}
}

function stopHeartbeat() {
	clearTimer('heartbeatTimer')
}

function startHeartbeat() {
	stopHeartbeat()
	state.heartbeatTimer = setTimeout(() => {
		if (state.status !== STATUS.CONNECTED) {
			return
		}
		// 长时间没收到 pong 说明连接已死（弱网下 onClose 可能不触发）
		if (state.lastPongAt && Date.now() - state.lastPongAt > PONG_TIMEOUT) {
			log('pong timeout, force reconnect')
			scheduleReconnect('pong-timeout')
			return
		}
		sendRaw({ type: 'ping' })
		startHeartbeat()
	}, HEARTBEAT_INTERVAL)
}

function nextRetryDelay() {
	const base = Math.min(MAX_RETRY_DELAY, BASE_RETRY_DELAY * Math.pow(2, state.attempts))
	// 0~500ms 抖动，避免同房间客户端同时重连造成瞬时压力
	return base + Math.floor(Math.random() * 500)
}

function scheduleReconnect(reason = '') {
	resetSocket()
	stopHeartbeat()
	if (state.manualClose || !state.roomId) {
		setStatus(state.roomId ? STATUS.RECONNECTING : STATUS.CLOSED)
		return
	}

	const delay = nextRetryDelay()
	state.attempts += 1
	clearTimer('retryTimer')
	state.retryTimer = setTimeout(() => {
		openSocket(reason)
	}, delay)

	if (state.everConnected) {
		setStatus(STATUS.RECONNECTING)
	} else if (state.attempts >= UNAVAILABLE_AFTER_ATTEMPTS) {
		// 从未成功过（socket 白名单未配 / 老基座）→ 交给轮询兜底，但仍保持重试
		setStatus(STATUS.UNAVAILABLE)
	} else {
		setStatus(STATUS.RECONNECTING)
	}
}

function resetSocket() {
	if (state.task) {
		try {
			state.task.close({ code: 1000, reason: 'client-reset' })
		} catch (error) {
			// 忽略关闭异常
		}
	}
	state.task = null
	state.joined = false
	clearTimer('connectTimer')
}

function sendRaw(payload = {}) {
	if (!state.task) {
		return false
	}
	try {
		state.task.send({
			data: JSON.stringify(payload)
		})
		return true
	} catch (error) {
		console.warn('game-ws send failed', error)
		return false
	}
}

function parseMessage(raw) {
	if (!raw) {
		return null
	}
	if (typeof raw === 'object' && !(raw instanceof ArrayBuffer)) {
		return raw
	}
	try {
		const text = typeof raw === 'string' ? raw : String(raw)
		return JSON.parse(text)
	} catch (error) {
		console.warn('game-ws parse message failed', error)
		return null
	}
}

function handleMessage(message = {}) {
	switch (message.type) {
	case 'connected':
		sendRaw({
			type: 'auth',
			token: getStoredUniIdToken()
		})
		return
	case 'auth:ok':
		state.uid = message.uid || state.uid
		state.lastPongAt = Date.now()
		if (state.roomId) {
			sendRaw({
				type: 'enter',
				roomId: state.roomId
			})
		} else {
			state.everConnected = true
			state.attempts = 0
			setStatus(STATUS.CONNECTED)
			startHeartbeat()
		}
		return
	case 'auth:failed':
		log('auth failed', message.message)
		state.manualClose = true
		setStatus(STATUS.UNAVAILABLE)
		return
	case 'room:joined': {
		state.joined = true
		state.everConnected = true
		state.attempts = 0
		state.lastPongAt = Date.now()
		setStatus(STATUS.CONNECTED)
		startHeartbeat()
		// 重连成功后立即让房间页拉一次增量，补齐断线期间的变化
		publish(state.roomId, {
			type: 'resync',
			source: 'ws',
			version: Number(message.version || 0)
		})
		return
	}
	case 'room:update':
		publish(String(message.roomId || state.roomId), {
			type: 'update',
			source: 'ws',
			version: Number(message.version || 0)
		})
		return
	case 'room:closed':
		publish(String(message.roomId || state.roomId), {
			type: 'closed',
			source: 'ws',
			reason: message.reason || ''
		})
		return
	case 'room:kicked':
		publish(String(message.roomId || state.roomId), {
			type: 'kicked',
			source: 'ws',
			reason: message.reason || ''
		})
		return
	case 'pong':
		state.lastPongAt = Date.now()
		return
	case 'error':
		log('server error', message.code, message.message)
		return
	default:
		log('unknown message', message.type)
	}
}

async function openSocket(reason = '') {
	if (!state.supported) {
		return
	}
	if (state.task) {
		return
	}

	clearTimer('connectTimer')
	setStatus(state.everConnected ? STATUS.RECONNECTING : STATUS.CONNECTING)

	let task = null
	try {
		task = await uniCloud.connectWebSocket({
			name: WS_FUNCTION_NAME,
			query: {}
		})
	} catch (error) {
		console.warn('game-ws connectWebSocket failed', reason, error)
		scheduleReconnect('connect-error')
		return
	}

	if (!task) {
		scheduleReconnect('connect-empty')
		return
	}

	state.task = task

	task.onMessage((event = {}) => {
		const message = parseMessage(event.data !== undefined ? event.data : event)
		if (message) {
			handleMessage(message)
		}
	})

	task.onOpen(() => {
		log('socket open')
		state.lastPongAt = Date.now()
	})

	task.onClose((event = {}) => {
		log('socket close', event.code, event.reason)
		if (state.manualClose) {
			setStatus(STATUS.CLOSED)
			return
		}
		scheduleReconnect('closed')
	})

	task.onError((event = {}) => {
		console.warn('game-ws socket error', event.errMsg || event)
		if (state.manualClose) {
			return
		}
		scheduleReconnect('socket-error')
	})

	// 连接超时保护：网关静默失败时不会触发任何事件
	state.connectTimer = setTimeout(() => {
		if (state.status === STATUS.CONNECTING && !state.everConnected) {
			log('connect timeout, retry')
			scheduleReconnect('timeout')
		}
	}, CONNECT_TIMEOUT)
}

/** 进入房间：建立连接并订阅该房间的推送 */
export async function enter(roomId = '') {
	const target = String(roomId || '').trim()
	if (!target) {
		return
	}

	if (typeof uniCloud === 'undefined' || typeof uniCloud.connectWebSocket !== 'function') {
		state.supported = false
		setStatus(STATUS.UNAVAILABLE)
		return
	}

	clearTimer('closeTimer')
	state.manualClose = false
	state.attempts = 0

	if (state.roomId && state.roomId !== target) {
		// 换房先退订旧房间，服务端 room_id 是单值
		sendRaw({ type: 'leave' })
		state.joined = false
	}
	state.roomId = target

	if (state.task && state.status === STATUS.CONNECTED) {
		sendRaw({ type: 'enter', roomId: target })
		return
	}

	await openSocket('enter')
	if (state.task && !state.joined) {
		// 已连上但鉴权还没回来时，鉴权成功后会自动 enter（见 auth:ok 分支）
		sendRaw({
			type: 'auth',
			token: getStoredUniIdToken()
		})
	}
}

/** 退出房间订阅（页面卸载时调用），延迟关闭连接避免来回切页反复重连 */
export function leave(roomId = '') {
	const target = String(roomId || '').trim()
	if (target && state.roomId && state.roomId !== target) {
		return
	}
	sendRaw({ type: 'leave' })
	state.joined = false
	state.roomId = ''

	clearTimer('closeTimer')
	state.closeTimer = setTimeout(() => {
		close()
	}, IDLE_CLOSE_DELAY)
}

export function close() {
	state.manualClose = true
	state.roomId = ''
	state.joined = false
	stopHeartbeat()
	clearTimer('retryTimer')
	clearTimer('closeTimer')
	resetSocket()
	setStatus(STATUS.CLOSED)
}

/** 页面 onShow 时调用：连接已断则立刻重建 */
export function ensureConnected() {
	if (state.supported && state.roomId && !state.task && !state.manualClose) {
		state.attempts = 0
		openSocket('ensure')
	}
}

export { STATUS as WS_STATUS }
