'use strict'

const { dbCmd, userCollection, coupleCollection } = require('./db')
const {
	DEFAULT_NICKNAME,
	COUPLE_STATUS_PENDING,
	COUPLE_STATUS_BOUND,
	COUPLE_STATUS_UNBOUND,
	COUPLE_STATUS_CLOSED,
	COUPLE_STATUS_CANCELLED,
	COUPLE_LOCK_TTL,
	COUPLE_LOCK_RETRY_COUNT,
	COUPLE_LOCK_RETRY_DELAY,
	COUPLE_STATUS_TEXT
} = require('./constants')
const { getUserById, resolveAvatar } = require('./user-base')

function getCoupleStatusText(status) {
	return COUPLE_STATUS_TEXT[Number(status)] || '未知状态'
}

function maskNickname(value = '') {
	const nickname = String(value || '').trim()
	if (!nickname) {
		return '未设置'
	}

	if (nickname.length === 1) {
		return `${nickname}*`
	}

	if (nickname.length === 2) {
		return `${nickname.slice(0, 1)}*`
	}

	return `${nickname.slice(0, 1)}**${nickname.slice(-1)}`
}

function maskUid(value = '') {
	const uid = String(value || '').trim()
	if (!uid) {
		return '未设置'
	}

	if (uid.length <= 8) {
		return `${uid.slice(0, 2)}***${uid.slice(-2)}`
	}

	return `${uid.slice(0, 4)}****${uid.slice(-4)}`
}

function buildCoupleParticipantCondition(uid) {
	return dbCmd.or([
		{ user_a_uid: uid },
		{ user_b_uid: uid }
	])
}

function getRelationPartnerUid(uid, relation = {}) {
	if (!uid || !relation) {
		return ''
	}

	return relation.user_a_uid === uid ? relation.user_b_uid || '' : relation.user_a_uid || ''
}

function getRequesterUid(relation = {}) {
	return relation.created_by || relation.user_a_uid || ''
}

function sleep(duration = 0) {
	return new Promise((resolve) => {
		setTimeout(resolve, duration)
	})
}

function getUpdatedCount(result = {}) {
	const candidates = [
		result.updated,
		result.updatedCount,
		result.modifiedCount,
		result.matchedCount
	].filter((item) => typeof item === 'number')

	return candidates.length ? Math.max(...candidates) : 0
}

function getUniqueSortedUidList(uidList = []) {
	return Array.from(new Set(
		uidList
			.map((item) => String(item || '').trim())
			.filter(Boolean)
	)).sort((left, right) => left.localeCompare(right))
}

function buildCoupleLockToken(uidList = []) {
	return `couple:${uidList.join(':')}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

function createCoupleBusyError() {
	return {
		errCode: 'love-note-couple-busy',
		errMsg: '情侣关系正在更新，请稍后再试'
	}
}

function getCoupleParticipantUids(relation = {}) {
	return getUniqueSortedUidList([relation.user_a_uid, relation.user_b_uid])
}

async function getCoupleById(coupleId = '') {
	const id = String(coupleId || '').trim()
	if (!id) {
		return null
	}

	const result = await coupleCollection.doc(id).get()
	return result && result.data && result.data[0] ? result.data[0] : null
}

async function getSingleCoupleByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc' } = {}) {
	const result = await coupleCollection.where(condition).orderBy(orderField, orderDirection).limit(1).get()
	return result && result.data && result.data[0] ? result.data[0] : null
}

async function listCouplesByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc', limit = 100 } = {}) {
	const result = await coupleCollection.where(condition).orderBy(orderField, orderDirection).limit(limit).get()
	return result && Array.isArray(result.data) ? result.data : []
}

async function getActiveCoupleByUid(uid) {
	if (!uid) {
		return null
	}

	try {
		return await getSingleCoupleByCondition(
			dbCmd.and([
				buildCoupleParticipantCondition(uid),
				{ status: COUPLE_STATUS_BOUND }
			]),
			{
				orderField: 'bind_date'
			}
		)
	} catch (error) {
		console.warn('api-router getActiveCoupleByUid failed', error)
		return null
	}
}

async function getIncomingPendingCouples(uid) {
	if (!uid) {
		return []
	}

	try {
		return await listCouplesByCondition(
			dbCmd.and([
				{ user_b_uid: uid },
				{ status: COUPLE_STATUS_PENDING }
			]),
			{
				orderField: 'created_at',
				limit: 50
			}
		)
	} catch (error) {
		console.warn('api-router getIncomingPendingCouples failed', error)
		return []
	}
}

async function getOutgoingPendingCouples(uid) {
	if (!uid) {
		return []
	}

	try {
		return await listCouplesByCondition(
			dbCmd.and([
				{ created_by: uid },
				{ status: COUPLE_STATUS_PENDING }
			]),
			{
				orderField: 'created_at',
				limit: 20
			}
		)
	} catch (error) {
		console.warn('api-router getOutgoingPendingCouples failed', error)
		return []
	}
}

async function getCoupleHistoryByUid(uid) {
	if (!uid) {
		return []
	}

	try {
		return await listCouplesByCondition(
			dbCmd.and([
				buildCoupleParticipantCondition(uid),
				{
					status: dbCmd.in([COUPLE_STATUS_BOUND, COUPLE_STATUS_UNBOUND])
				}
			]),
			{
				orderField: 'bind_date',
				limit: 100
			}
		)
	} catch (error) {
		console.warn('api-router getCoupleHistoryByUid failed', error)
		return []
	}
}

async function getExistingPendingRelationBetween(uid, targetUid) {
	if (!uid || !targetUid) {
		return null
	}

	try {
		return await getSingleCoupleByCondition(
			dbCmd.and([
				{ status: COUPLE_STATUS_PENDING },
				dbCmd.or([
					{
						user_a_uid: uid,
						user_b_uid: targetUid
					},
					{
						user_a_uid: targetUid,
						user_b_uid: uid
					}
				])
			]),
			{
				orderField: 'created_at'
			}
		)
	} catch (error) {
		console.warn('api-router getExistingPendingRelationBetween failed', error)
		return null
	}
}

async function tryAcquireCoupleUserLock(uid, token, now = Date.now()) {
	if (!uid || !token) {
		return false
	}

	const result = await userCollection.where(dbCmd.and([
		{ _id: uid },
		dbCmd.or([
			{ couple_lock_token: token },
			{ couple_lock_token: null },
			{ couple_lock_expired_at: null },
			{ couple_lock_expired_at: dbCmd.lte(now) }
		])
	])).update({
		couple_lock_token: token,
		couple_lock_expired_at: now + COUPLE_LOCK_TTL
	})

	return getUpdatedCount(result) > 0
}

async function releaseCoupleUserLock(uid, token) {
	if (!uid || !token) {
		return
	}

	await userCollection.where({
		_id: uid,
		couple_lock_token: token
	}).update({
		couple_lock_token: dbCmd.remove(),
		couple_lock_expired_at: dbCmd.remove()
	})
}

async function acquireCoupleLocks(uidList = []) {
	const uniqueUidList = getUniqueSortedUidList(uidList)
	if (!uniqueUidList.length) {
		return {
			token: '',
			uidList: []
		}
	}

	const token = buildCoupleLockToken(uniqueUidList)
	for (let attempt = 0; attempt < COUPLE_LOCK_RETRY_COUNT; attempt += 1) {
		const lockedUidList = []
		try {
			for (let index = 0; index < uniqueUidList.length; index += 1) {
				const currentUid = uniqueUidList[index]
				const acquired = await tryAcquireCoupleUserLock(currentUid, token)
				if (!acquired) {
					const error = new Error('COUPLE_LOCK_BUSY')
					error.code = 'COUPLE_LOCK_BUSY'
					throw error
				}

				lockedUidList.push(currentUid)
			}

			return {
				token,
				uidList: uniqueUidList
			}
		} catch (error) {
			if (lockedUidList.length) {
				await Promise.all(lockedUidList.map((item) => releaseCoupleUserLock(item, token)))
			}

			if (!error || error.code !== 'COUPLE_LOCK_BUSY') {
				throw error
			}

			if (attempt >= COUPLE_LOCK_RETRY_COUNT - 1) {
				throw createCoupleBusyError()
			}

			await sleep(COUPLE_LOCK_RETRY_DELAY * (attempt + 1))
		}
	}

	throw createCoupleBusyError()
}

async function runWithCoupleLocks(uidList = [], handler = async () => ({})) {
	const lockState = await acquireCoupleLocks(uidList)
	try {
		return await handler(lockState)
	} finally {
		if (lockState && lockState.token && Array.isArray(lockState.uidList) && lockState.uidList.length) {
			try {
				await Promise.all(lockState.uidList.map((item) => releaseCoupleUserLock(item, lockState.token)))
			} catch (error) {
				console.warn('api-router releaseCoupleUserLock failed', error)
			}
		}
	}
}

async function closePendingCouplesForUsers(uidList = [], { excludeId = '', status = COUPLE_STATUS_CLOSED, actionUid = '' } = {}) {
	const uniqueUidList = Array.from(new Set(uidList.filter(Boolean)))
	if (!uniqueUidList.length) {
		return
	}

	const participantConditions = []
	uniqueUidList.forEach((uid) => {
		participantConditions.push({ user_a_uid: uid })
		participantConditions.push({ user_b_uid: uid })
	})

	const conditions = [
		{ status: COUPLE_STATUS_PENDING },
		dbCmd.or(participantConditions)
	]

	if (excludeId) {
		conditions.push({
			_id: dbCmd.neq(excludeId)
		})
	}

	await coupleCollection.where(dbCmd.and(conditions)).update({
		status,
		last_action_uid: actionUid || '',
		updated_at: Date.now()
	})
}

async function getRelationPartnerMeta(uid, relation = {}) {
	const partnerUid = getRelationPartnerUid(uid, relation)
	const partnerRecord = partnerUid ? await getUserById(partnerUid) : null
	const partnerAvatar = partnerRecord ? await resolveAvatar(partnerRecord) : {
		avatarFileId: '',
		avatarUrl: ''
	}
	const partnerNickname = partnerRecord
		? partnerRecord.nickname || partnerRecord.username || DEFAULT_NICKNAME
		: relation.partner_nickname || ''

	return {
		partnerUid,
		partnerAvatar,
		partnerNickname
	}
}

async function formatCoupleInfo(uid, relation = null) {
	if (!relation) {
		return null
	}

	const { partnerUid, partnerAvatar, partnerNickname } = await getRelationPartnerMeta(uid, relation)
	const status = Number(relation.status || 0)
	const requesterUid = getRequesterUid(relation)

	return {
		coupleId: relation._id || '',
		status,
		statusText: getCoupleStatusText(status),
		isBound: status === COUPLE_STATUS_BOUND,
		isPending: status === COUPLE_STATUS_PENDING,
		direction: status === COUPLE_STATUS_PENDING
			? (requesterUid === uid ? 'outgoing' : 'incoming')
			: 'bound',
		partnerUid,
		partnerUidMasked: maskUid(partnerUid),
		partnerNickname,
		partnerNicknameMasked: maskNickname(partnerNickname),
		partnerAvatarUrl: partnerAvatar.avatarUrl || '',
		partnerAvatarFileId: partnerAvatar.avatarFileId || '',
		bindDate: relation.bind_date || relation.created_at || 0,
		anniversaryDate: relation.anniversary_date || 0,
		requestDate: relation.created_at || 0
	}
}

async function formatSelfInfo(record = {}) {
	const { avatarFileId, avatarUrl } = await resolveAvatar(record)

	return {
		uid: record._id || '',
		uidMasked: maskUid(record._id || ''),
		nickname: record.nickname || record.username || DEFAULT_NICKNAME,
		avatarUrl,
		avatarFileId,
		gender: Number(record.gender || 0),
		mobile: record.mobile || '',
		birthday: record.birthday || '',
		registerDate: record.register_date || 0
	}
}

async function formatCoupleRequestItem(uid, relation = {}, { type = 'incoming' } = {}) {
	const { partnerUid, partnerAvatar, partnerNickname } = await getRelationPartnerMeta(uid, relation)

	return {
		requestId: relation._id || '',
		type,
		status: Number(relation.status || 0),
		statusText: getCoupleStatusText(relation.status),
		partnerUid,
		partnerUidMasked: maskUid(partnerUid),
		partnerNicknameMasked: maskNickname(partnerNickname),
		partnerAvatarUrl: partnerAvatar.avatarUrl || '',
		partnerAvatarFileId: partnerAvatar.avatarFileId || '',
		createdAt: relation.created_at || 0,
		updatedAt: relation.updated_at || 0
	}
}

async function formatCoupleHistoryItem(uid, relation = {}) {
	const { partnerUid, partnerAvatar, partnerNickname } = await getRelationPartnerMeta(uid, relation)
	const status = Number(relation.status || 0)

	return {
		relationId: relation._id || '',
		status,
		statusText: getCoupleStatusText(status),
		partnerUidMasked: maskUid(partnerUid),
		partnerNicknameMasked: maskNickname(partnerNickname),
		partnerAvatarUrl: partnerAvatar.avatarUrl || '',
		partnerAvatarFileId: partnerAvatar.avatarFileId || '',
		bindDate: relation.bind_date || relation.created_at || 0,
		unbindDate: relation.unbind_date || 0,
		isCurrent: status === COUPLE_STATUS_BOUND
	}
}

async function buildCoupleSummary(uid) {
	if (!uid) {
		return null
	}

	const [activeCouple, incomingRequests, outgoingRequests] = await Promise.all([
		getActiveCoupleByUid(uid),
		getIncomingPendingCouples(uid),
		getOutgoingPendingCouples(uid)
	])

	const pendingIncomingCount = incomingRequests.length
	const pendingOutgoingCount = outgoingRequests.length
	const pendingCount = pendingIncomingCount + pendingOutgoingCount

	if (activeCouple) {
		return Object.assign(await formatCoupleInfo(uid, activeCouple), {
			pendingIncomingCount,
			pendingOutgoingCount,
			pendingCount
		})
	}

	const latestPendingRelation = pendingIncomingCount ? incomingRequests[0] : outgoingRequests[0]
	if (!latestPendingRelation) {
		return null
	}

	return Object.assign(await formatCoupleInfo(uid, latestPendingRelation), {
		pendingIncomingCount,
		pendingOutgoingCount,
		pendingCount,
		latestPendingDirection: pendingIncomingCount ? 'incoming' : 'outgoing'
	})
}

async function buildCoupleCenterPayload(uid) {
	const userRecord = await getUserById(uid)
	if (!userRecord) {
		throw {
			errCode: 'uni-id-account-not-exists',
			errMsg: '当前用户不存在'
		}
	}

	const [activeCouple, incomingRequests, outgoingRequests, historyRelations] = await Promise.all([
		getActiveCoupleByUid(uid),
		getIncomingPendingCouples(uid),
		getOutgoingPendingCouples(uid),
		getCoupleHistoryByUid(uid)
	])

	const historyList = await Promise.all(
		historyRelations
			.filter((item) => item && item._id && (!activeCouple || item._id !== activeCouple._id))
			.map((item) => formatCoupleHistoryItem(uid, item))
	)

	return {
		selfInfo: await formatSelfInfo(userRecord),
		activeCouple: activeCouple ? await formatCoupleInfo(uid, activeCouple) : null,
		incomingRequests: await Promise.all(incomingRequests.map((item) => formatCoupleRequestItem(uid, item, {
			type: 'incoming'
		}))),
		outgoingRequests: await Promise.all(outgoingRequests.map((item) => formatCoupleRequestItem(uid, item, {
			type: 'outgoing'
		}))),
		historyList,
		canSendRequest: !activeCouple && !outgoingRequests.length
	}
}

module.exports = {
	COUPLE_STATUS_PENDING,
	COUPLE_STATUS_BOUND,
	COUPLE_STATUS_UNBOUND,
	COUPLE_STATUS_CLOSED,
	COUPLE_STATUS_CANCELLED,
	getRequesterUid,
	getCoupleById,
	getActiveCoupleByUid,
	getOutgoingPendingCouples,
	getExistingPendingRelationBetween,
	getCoupleParticipantUids,
	runWithCoupleLocks,
	closePendingCouplesForUsers,
	buildCoupleSummary,
	buildCoupleCenterPayload,
	maskUid,
	getUniqueSortedUidList,
	createCoupleBusyError
}
