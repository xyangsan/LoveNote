'use strict'

/**
 * 聚会游戏房间定时清理
 * 每 10 分钟执行一次：
 *  1. 关闭过期 / 长时间无操作（进程被杀导致的中断对局）的房间
 *  2. 清理僵尸 WebSocket 连接记录（onWebsocketDisConnection 不保证 100% 触发）
 *  3. 顺手清理已关闭房间残留的连接记录
 * 全部按条件批量操作，天然幂等，重复执行无副作用。
 */

const db = uniCloud.database()
const dbCmd = db.command

const gameRoomCollection = db.collection('love-game-rooms')
const gameConnectionCollection = db.collection('love-game-connections')

const ROOM_IDLE_TTL = 30 * 60 * 1000
const CONNECTION_IDLE_TTL = 5 * 60 * 1000
const ROOM_STATUS_CLOSED = 'closed'

function getUpdatedCount(result = {}) {
	const candidates = [
		result.updated,
		result.updatedCount,
		result.modifiedCount,
		result.matchedCount
	].filter((item) => typeof item === 'number')
	return candidates.length ? Math.max(...candidates) : 0
}

async function closeExpiredRooms(now) {
	// 1) 已过期的房间
	const expiredRes = await gameRoomCollection
		.where(dbCmd.and([
			{ is_deleted: false },
			{ expire_at: dbCmd.gt(0) },
			{ expire_at: dbCmd.lte(now) }
		]))
		.update({
			status: ROOM_STATUS_CLOSED,
			is_deleted: true,
			update_time: now
		})

	// 2) 超过 30 分钟没有任何操作的房间（进程被杀导致的中断对局）
	const idleRes = await gameRoomCollection
		.where(dbCmd.and([
			{ is_deleted: false },
			{ update_time: dbCmd.lt(now - ROOM_IDLE_TTL) }
		]))
		.update({
			status: ROOM_STATUS_CLOSED,
			is_deleted: true,
			update_time: now
		})

	return {
		expired: getUpdatedCount(expiredRes),
		idle: getUpdatedCount(idleRes)
	}
}

async function cleanZombieConnections(now) {
	const zombieRes = await gameConnectionCollection
		.where({
			last_ping: dbCmd.lt(now - CONNECTION_IDLE_TTL)
		})
		.remove()

	return {
		zombieConnections: getUpdatedCount(zombieRes) || Number(zombieRes.deleted || 0)
	}
}

async function cleanConnectionsOfClosedRooms() {
	const closedRes = await gameRoomCollection
		.where({
			is_deleted: true
		})
		.field({ _id: true })
		.limit(200)
		.get()

	const closedRoomIds = (closedRes && Array.isArray(closedRes.data) ? closedRes.data : [])
		.map((item) => String(item._id || ''))
		.filter(Boolean)

	if (!closedRoomIds.length) {
		return { closedRoomConnections: 0 }
	}

	const connRes = await gameConnectionCollection
		.where({
			room_id: dbCmd.in(closedRoomIds)
		})
		.remove()

	return {
		closedRoomConnections: getUpdatedCount(connRes) || Number(connRes.deleted || 0)
	}
}

exports.main = async () => {
	const now = Date.now()
	const result = {
		ok: true,
		now
	}

	try {
		result.rooms = await closeExpiredRooms(now)
	} catch (error) {
		console.error('game-room-cleanup closeExpiredRooms failed', error)
		result.roomsError = error && error.message
	}

	try {
		result.connections = await cleanZombieConnections(now)
	} catch (error) {
		console.error('game-room-cleanup cleanZombieConnections failed', error)
		result.connectionsError = error && error.message
	}

	try {
		result.closedRooms = await cleanConnectionsOfClosedRooms()
	} catch (error) {
		console.error('game-room-cleanup cleanConnectionsOfClosedRooms failed', error)
		result.closedRoomsError = error && error.message
	}

	console.log('game-room-cleanup done', JSON.stringify(result))
	return result
}
