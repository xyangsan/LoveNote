'use strict'

const { gameRoomCollection, gameConnectionCollection } = require('./db')

/**
 * connectionId ↔ uid ↔ roomId 映射维护。
 * 云函数实例无状态，映射必须落库：既是广播寻址依据，也是在线状态依据。
 */

async function upsertConnection(connectionId = '', patch = {}, now = Date.now()) {
	const id = String(connectionId || '').trim()
	if (!id) {
		return null
	}

	try {
		const existRes = await gameConnectionCollection
			.where({ connection_id: id })
			.limit(1)
			.get()
		const exist = existRes && existRes.data && existRes.data[0] ? existRes.data[0] : null

		if (exist) {
			const updateData = Object.assign({}, patch)
			if (patch.last_ping === undefined) {
				updateData.last_ping = now
			}
			await gameConnectionCollection.doc(exist._id).update(updateData)
			return Object.assign({}, exist, updateData)
		}

		const data = Object.assign({
			connection_id: id,
			uid: '',
			room_id: '',
			last_ping: now,
			create_time: now
		}, patch)

		await gameConnectionCollection.add(data)
		return data
	} catch (error) {
		// 唯一索引冲突（同 connectionId 并发写入）直接忽略：在线状态非强一致需求
		console.warn('game-ws upsertConnection failed', error)
		return null
	}
}

async function getConnection(connectionId = '') {
	const id = String(connectionId || '').trim()
	if (!id) {
		return null
	}
	const res = await gameConnectionCollection
		.where({ connection_id: id })
		.limit(1)
		.get()
	return res && res.data && res.data[0] ? res.data[0] : null
}

async function removeConnection(connectionId = '') {
	const id = String(connectionId || '').trim()
	if (!id) {
		return
	}
	try {
		await gameConnectionCollection.where({ connection_id: id }).remove()
	} catch (error) {
		console.warn('game-ws removeConnection failed', error)
	}
}

async function touchPing(connectionId = '', now = Date.now()) {
	const id = String(connectionId || '').trim()
	if (!id) {
		return
	}
	try {
		await gameConnectionCollection.where({ connection_id: id }).update({
			last_ping: now
		})
	} catch (error) {
		console.warn('game-ws touchPing failed', error)
	}
}

/** 校验该 uid 是否确实在该房间的座位里（防止订阅别人的房间） */
async function isRoomMember(roomId = '', uid = '') {
	const id = String(roomId || '').trim()
	const targetUid = String(uid || '').trim()
	if (!id || !targetUid) {
		return false
	}
	try {
		const res = await gameRoomCollection
			.where({
				_id: id,
				'seats.uid': targetUid,
				is_deleted: false
			})
			.field({ version: true, room_code: true, game_type: true, status: true })
			.limit(1)
			.get()
		return res && res.data && res.data[0] ? res.data[0] : null
	} catch (error) {
		console.warn('game-ws isRoomMember failed', error)
		return null
	}
}

module.exports = {
	upsertConnection,
	getConnection,
	removeConnection,
	touchPing,
	isRoomMember
}
