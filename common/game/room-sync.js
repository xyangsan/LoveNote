import { getGameApi } from '../api/game.js'
import { subscribe } from './push-bus.js'
import {
	enter,
	leave,
	ensureConnected,
	onStatusChange,
	WS_STATUS
} from './ws-client.js'

/**
 * 房间同步层：WebSocket 推送为主，HTTP 低频轮询为兜底
 *
 * 一致性保证不依赖推送本身（推送可能丢），而是：
 *   1. 每次 syncRoom 带 version 游标 —— 未变则零成本，变了则返回完整裁剪快照；
 *   2. 推送到达 / 重连成功 / 页面 onShow 都会触发一次 syncNow；
 *   3. WS 未就绪时自动降级为 5s 轮询，恢复后自动停掉。
 *
 * 传输层可插拔：若将来换成别的通道，只需替换 ws-client 与这里的订阅逻辑，
 * 业务 action 与页面代码零改动。
 */

// 「房间没了」或「自己已经不在房里」都属于不可恢复：终止同步，由页面提示并退回大厅。
// not-in-room 覆盖「主动退出」「被房主移出」「换房间时自动退出旧房」等情况。
// 注意：房间玩法属性（room.props）字段不一致**不算**致命错误 —— 服务端会用默认值填充（见 resolveRoomProps）。
const FATAL_ERROR_CODES = [
	'love-note-game-room-not-found',
	'love-note-game-room-expired',
	'love-note-game-not-in-room'
]

export function createRoomSync({
	roomId = '',
	onUpdate = () => {},
	onError = () => {},
	onStatusChange = () => {},
	pollInterval = 5000,
	minRetryDelay = 1500,
	maxRetryDelay = 8000
} = {}) {
	let version = 0
	let running = false
	let paused = false
	let stopped = true
	let inFlight = false
	let queued = false
	let queuedForce = false
	let errorCount = 0
	let pollTimer = null
	let polling = false
	let mode = 'push'
	let unsubscribeBus = null
	let unsubscribeWs = null

	function notifyStatus() {
		onStatusChange({
			mode,
			pushReady: mode === 'push',
			paused
		})
	}

	function setMode(next = 'push') {
		if (mode === next) {
			return
		}
		mode = next
		notifyStatus()
	}

	function getRetryDelay() {
		const delay = minRetryDelay * Math.pow(2, Math.max(0, errorCount - 1))
		return Math.min(maxRetryDelay, delay)
	}

	function handleError(error = {}) {
		const errCode = error.errCode || error.code || ''
		const fatal = FATAL_ERROR_CODES.includes(errCode)

		if (fatal) {
			stopPolling()
			onError(error, {
				fatal: true,
				retryDelay: 0
			})
			return
		}

		errorCount += 1
		onError(error, {
			fatal: false,
			retryDelay: getRetryDelay()
		})
	}

	async function runSync(source = 'manual', options = {}) {
		if (stopped || paused || !roomId) {
			return null
		}
		if (inFlight) {
			queued = true
			// 一次排队的请求里只要有一次是 force，合并后就按 force 跑（力度只升不降）
			queuedForce = queuedForce || options.force === true
			return null
		}

		// force：version 没变也要求服务端跑一遍推进（用于「还有机器人没投票」的兜底，
		// 见 service/game.js 的 syncRoom）。只在页面明确要求时传，避免每次轮询都白烧一次推进。
		const force = options.force === true

		inFlight = true
		let result = null
		try {
			const response = await getGameApi().syncRoom({
				roomId,
				sinceVersion: version,
				force
			})
			const data = response || {}
			if (data.errCode && data.errCode !== 0) {
				const error = new Error(data.errMsg || '同步房间失败')
				error.errCode = data.errCode
				throw error
			}

			const payload = data.data || {}
			if (payload.version !== undefined) {
				version = Number(payload.version) || 0
			}
			errorCount = 0
			result = payload
			onUpdate(payload, {
				source,
				changed: Boolean(payload.changed),
				reset: Boolean(payload.reset)
			})
		} catch (error) {
			handleError(error)
		} finally {
			inFlight = false
			if (queued) {
				queued = false
				const nextForce = queuedForce
				queuedForce = false
				runSync('queued', { force: nextForce })
			}
		}
		return result
	}

	function schedulePoll(delay = pollInterval) {
		if (stopped || paused || !polling) {
			return
		}
		if (pollTimer) {
			clearTimeout(pollTimer)
		}
		pollTimer = setTimeout(async () => {
			pollTimer = null
			await runSync('poll')
			if (stopped || paused || !polling) {
				return
			}
			schedulePoll(errorCount ? getRetryDelay() : pollInterval)
		}, delay)
	}

	function startPolling() {
		if (stopped || paused) {
			return
		}
		if (polling) {
			return
		}
		polling = true
		setMode('poll')
		// 立即拉一次，随后按间隔轮询
		runSync('poll')
		schedulePoll(pollInterval)
	}

	function stopPolling() {
		polling = false
		if (pollTimer) {
			clearTimeout(pollTimer)
			pollTimer = null
		}
	}

	function bindPushBus() {
		unsubscribeBus = subscribe(roomId, (event = {}) => {
			if (stopped || paused) {
				return
			}
			if (event.type === 'closed' || event.type === 'kicked') {
				const error = new Error(event.reason || '房间已关闭')
				error.errCode = event.type === 'kicked'
					? 'love-note-game-kicked'
					: 'love-note-game-room-not-found'
				handleError(error)
				return
			}
			// update（有变更）与 resync（重连后补齐）都直接拉一次增量
			runSync(event.source === 'ws' ? 'push' : 'push')
		})
	}

	function bindWsStatus() {
		unsubscribeWs = onStatusChange((status) => {
			if (stopped) {
				return
			}
			if (status === WS_STATUS.CONNECTED) {
				stopPolling()
				setMode('push')
				return
			}
			// 连接中 / 重连中 / 不可用 → 一律用轮询兜底，保证状态不落后
			startPolling()
		})
	}

	async function start() {
		if (running || !roomId) {
			return
		}
		stopped = false
		paused = false
		running = true

		bindPushBus()
		bindWsStatus()

		try {
			await enter(roomId)
		} catch (error) {
			console.warn('room-sync enter failed', error)
		}

		// WS 未就绪前先用轮询兜底；连上后 bindWsStatus 会自动停掉
		if (mode !== 'push') {
			startPolling()
		}
	}

	function stop({ leaveRoom = true } = {}) {
		stopped = true
		running = false
		paused = false
		stopPolling()
		if (unsubscribeBus) {
			unsubscribeBus()
			unsubscribeBus = null
		}
		if (unsubscribeWs) {
			unsubscribeWs()
			unsubscribeWs = null
		}
		if (leaveRoom && roomId) {
			leave(roomId)
		}
	}

	function pause() {
		if (stopped) {
			return
		}
		paused = true
		stopPolling()
		notifyStatus()
	}

	function resume() {
		if (stopped) {
			return
		}
		paused = false
		ensureConnected()
		runSync('resume')
		if (mode !== 'push') {
			startPolling()
		}
		notifyStatus()
	}

	return {
		roomId,
		start,
		stop,
		pause,
		resume,
		syncNow: (options) => runSync('manual', options),
		setVersion(next) {
			version = Number(next) || 0
		},
		getVersion() {
			return version
		},
		isRunning() {
			return running && !stopped
		},
		getMode() {
			return mode
		},
		isPaused() {
			return paused
		}
	}
}
