'use strict'

const { resolveUidByToken } = require('./lib/auth')
const {
	upsertConnection,
	removeConnection,
	touchPing,
	isRoomMember
} = require('./lib/connection')

/**
 * 游戏房间 WebSocket 通道（仅支付宝云支持）
 *
 * 职责非常单一：维护「连接 ↔ 用户 ↔ 房间」映射 + 心跳。
 * 业务状态一律走 HTTP api-router，本函数不写任何房间数据。
 */

let webSocketServer = null

function getServer() {
	if (webSocketServer) {
		return webSocketServer
	}
	try {
		if (typeof uniCloud !== 'undefined' && typeof uniCloud.webSocketServer === 'function') {
			webSocketServer = uniCloud.webSocketServer()
		}
	} catch (error) {
		console.warn('game-ws getServer failed', error)
	}
	return webSocketServer
}

async function reply(connectionId = '', payload = null) {
	const server = getServer()
	if (!server || typeof server.send !== 'function' || !payload) {
		return
	}
	try {
		await server.send(connectionId, payload)
	} catch (error) {
		console.warn('game-ws reply failed', error)
	}
}

function parsePayload(payload) {
	if (payload === undefined || payload === null || payload === '') {
		return null
	}
	if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
		return payload
	}
	try {
		const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload)
		return JSON.parse(text)
	} catch (error) {
		console.warn('game-ws parsePayload failed', error)
		return null
	}
}

/* ------------------------------------------------------------------ *
 * WebSocket 事件
 * ------------------------------------------------------------------ */

/** 建立连接：先落一条未鉴权的连接记录 */
exports.onWebsocketConnection = async (event = {}) => {
	const connectionId = event.connectionId
	if (!connectionId) {
		return
	}
	await upsertConnection(connectionId, {
		uid: '',
		room_id: ''
	})
	await reply(connectionId, {
		type: 'connected',
		connectionId
	})
}

/** 收到消息：auth / enter / leave / ping */
exports.onWebsocketMessage = async (event = {}, context = {}) => {
	const connectionId = event.connectionId
	const message = parsePayload(event.payload)
	if (!connectionId) {
		return
	}
	if (!message || !message.type) {
		await reply(connectionId, {
			type: 'error',
			code: 'invalid-message',
			message: '消息格式不正确'
		})
		return
	}

	switch (message.type) {
	case 'auth': {
		const uid = await resolveUidByToken(message.token, context)
		if (!uid) {
			await reply(connectionId, {
				type: 'auth:failed',
				code: 'auth-failed',
				message: '登录状态已失效，请重新登录'
			})
			return
		}
		await upsertConnection(connectionId, {
			uid,
			room_id: ''
		})
		await reply(connectionId, {
			type: 'auth:ok',
			uid
		})
		return
	}
	case 'enter': {
		const current = await upsertConnection(connectionId, {}, Date.now())
		const uid = current && current.uid ? String(current.uid) : ''
		if (!uid) {
			await reply(connectionId, {
				type: 'error',
				code: 'auth-required',
				message: '请先完成鉴权'
			})
			return
		}

		const roomId = String(message.roomId || '').trim()
		if (!roomId) {
			await reply(connectionId, {
				type: 'error',
				code: 'room-required',
				message: '缺少房间ID'
			})
			return
		}

		// 必须确实是该房间成员，避免订阅他人房间
		const room = await isRoomMember(roomId, uid)
		if (!room) {
			await reply(connectionId, {
				type: 'error',
				code: 'not-in-room',
				message: '你不在这个房间里'
			})
			return
		}

		await upsertConnection(connectionId, {
			uid,
			room_id: roomId
		})
		await reply(connectionId, {
			type: 'room:joined',
			roomId,
			version: Number(room.version || 0),
			gameType: room.game_type || '',
			status: room.status || ''
		})
		return
	}
	case 'leave': {
		const current = await upsertConnection(connectionId, {}, Date.now())
		if (!current || !current.uid) {
			return
		}
		await upsertConnection(connectionId, {
			uid: String(current.uid),
			room_id: ''
		})
		return
	}
	case 'ping': {
		await touchPing(connectionId, Date.now())
		await reply(connectionId, {
			type: 'pong',
			serverTime: Date.now()
		})
		return
	}
	default:
		await reply(connectionId, {
			type: 'error',
			code: 'unknown-type',
			message: `不支持的消息类型：${message.type}`
		})
	}
}

/** 断开连接：清理映射 */
exports.onWebsocketDisConnection = async (event = {}) => {
	const connectionId = event.connectionId
	if (!connectionId) {
		return
	}
	await removeConnection(connectionId)
}

/** 事件失败：同样清理，避免僵尸连接占用广播配额 */
exports.onWebsocketError = async (event = {}) => {
	const connectionId = event.connectionId
	console.warn('game-ws onWebsocketError', connectionId, event.errorMessage)
	if (!connectionId) {
		return
	}
	await removeConnection(connectionId)
}
