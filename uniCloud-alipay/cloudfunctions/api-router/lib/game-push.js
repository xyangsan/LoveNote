'use strict'

const { gameConnectionCollection } = require('./db')
const { MAX_CONNECTIONS_PER_ROOM } = require('./game-constants')

/**
 * WebSocket 广播（仅支付宝云支持 uniCloud.webSocketServer）
 * 约定：推送载荷只放 { roomId, version }，绝不携带业务数据与敏感字段；
 *      客户端收到后自行调用 syncRoom 拉取增量。
 * 所有推送失败都必须被吞掉，不能影响主流程。
 */

const POLL_CONNECTION_PREFIX = 'poll:'

function getWebSocketServer() {
	try {
		if (typeof uniCloud !== 'undefined' && typeof uniCloud.webSocketServer === 'function') {
			return uniCloud.webSocketServer()
		}
	} catch (error) {
		console.warn('api-router getWebSocketServer failed', error)
	}
	return null
}

/** 记住当前请求对应的连接，用于广播时排除「操作发起者自己」 */
let currentConnectionId = ''

function setCurrentConnectionId(connectionId = '') {
	currentConnectionId = String(connectionId || '')
}

async function listRealConnectionIds(roomId = '') {
	if (!roomId) {
		return []
	}
	try {
		const res = await gameConnectionCollection
			.where({ room_id: roomId })
			.field({ connection_id: true })
			.limit(MAX_CONNECTIONS_PER_ROOM)
			.get()
		const list = res && Array.isArray(res.data) ? res.data : []
		return list
			.map((item) => String(item.connection_id || ''))
			// 轮询降级用的 `poll:<uid>` 是虚拟信标，不是真实网关连接，不能 send
			.filter((id) => id && !id.startsWith(POLL_CONNECTION_PREFIX))
	} catch (error) {
		console.warn('api-router listRealConnectionIds failed', error)
		return []
	}
}

async function listConnectionIdsByUid(uid = '') {
	if (!uid) {
		return []
	}
	try {
		const res = await gameConnectionCollection
			.where({ uid })
			.field({ connection_id: true })
			.limit(50)
			.get()
		const list = res && Array.isArray(res.data) ? res.data : []
		return list
			.map((item) => String(item.connection_id || ''))
			.filter((id) => id && !id.startsWith(POLL_CONNECTION_PREFIX))
	} catch (error) {
		console.warn('api-router listConnectionIdsByUid failed', error)
		return []
	}
}

async function sendToConnectionIds(connectionIds = [], payload = null) {
	const ids = (Array.isArray(connectionIds) ? connectionIds : [connectionIds])
		.filter(Boolean)

	if (!ids.length || !payload) {
		return { sent: 0 }
	}

	const ws = getWebSocketServer()
	if (!ws || typeof ws.send !== 'function') {
		return { sent: 0, skipped: true }
	}

	try {
		// 批量发送：一次调用完成整个房间的广播，不要放进循环逐条发
		await ws.send(ids, payload)
		return { sent: ids.length }
	} catch (error) {
		console.warn('api-router sendToConnectionIds failed', error)
		return { sent: 0, error: true }
	}
}

/**
 * 房间状态已变更 → 广播给房间内所有其它连接
 * @param {String} roomId
 * @param {Number} version 变更后的版本号
 */
async function pushRoomUpdate(roomId = '', version = 0, { excludeConnectionId = '' } = {}) {
	const ids = await listRealConnectionIds(roomId)
	const exclude = String(excludeConnectionId || currentConnectionId || '')
	const targets = exclude ? ids.filter((id) => id !== exclude) : ids
	return sendToConnectionIds(targets, {
		type: 'room:update',
		roomId,
		version: Number(version || 0)
	})
}

/** 定向通知某个用户（多设备全覆盖），用于「你被踢出房间」等系统消息 */
async function pushToUid(uid = '', payload = null) {
	const ids = await listConnectionIdsByUid(uid)
	return sendToConnectionIds(ids, payload)
}

/** 房间已关闭/被清理 */
async function pushRoomClosed(roomId = '', reason = '') {
	const ids = await listRealConnectionIds(roomId)
	return sendToConnectionIds(ids, {
		type: 'room:closed',
		roomId,
		reason
	})
}

/** 批量探活，剔除已死连接（返回存活 id 列表） */
async function pruneDeadConnections(connectionIds = []) {
	const ids = (Array.isArray(connectionIds) ? connectionIds : []).filter(Boolean)
	if (!ids.length) {
		return []
	}
	const ws = getWebSocketServer()
	if (!ws || typeof ws.isAlive !== 'function') {
		return ids
	}
	try {
		const result = await ws.isAlive(ids)
		if (result && Array.isArray(result.aliveConnIds)) {
			return result.aliveConnIds
		}
	} catch (error) {
		console.warn('api-router pruneDeadConnections failed', error)
	}
	return ids
}

module.exports = {
	POLL_CONNECTION_PREFIX,
	getWebSocketServer,
	setCurrentConnectionId,
	listRealConnectionIds,
	listConnectionIdsByUid,
	sendToConnectionIds,
	pushRoomUpdate,
	pushToUid,
	pushRoomClosed,
	pruneDeadConnections
}
