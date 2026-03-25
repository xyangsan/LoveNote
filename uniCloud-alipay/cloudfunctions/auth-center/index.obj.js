'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const userCollection = db.collection('uni-id-users')
const coupleCollection = db.collection('love-couples')
const coupleRequestCollection = db.collection('love-couple-requests')
const coupleHistoryCollection = db.collection('love-couple-history')
const uniIdCommon = require('uni-id-common')
const { callAdapter } = require('x-uni-id-co')

const DEFAULT_NICKNAME = '微信用户'
const DEFAULT_ROLE = 'member'
const COUPLE_STATUS_PENDING = 0
const COUPLE_STATUS_BOUND = 1
const COUPLE_STATUS_UNBOUND = 2
const COUPLE_STATUS_CLOSED = 3
const COUPLE_STATUS_CANCELLED = 4
const REQUEST_STATUS_PENDING = 0
const REQUEST_STATUS_ACCEPTED = 1
const REQUEST_STATUS_REJECTED = 2
const REQUEST_STATUS_CANCELLED = 3
const REQUEST_STATUS_CLOSED = 4
const REQUEST_STATUS_EXPIRED = 5
const REQUEST_SOURCE_MANUAL = 'manual'
const COUPLE_HISTORY_EVENT_REQUEST_CREATED = 'request_created'
const COUPLE_HISTORY_EVENT_REQUEST_ACCEPTED = 'request_accepted'
const COUPLE_HISTORY_EVENT_REQUEST_REJECTED = 'request_rejected'
const COUPLE_HISTORY_EVENT_REQUEST_CANCELLED = 'request_cancelled'
const COUPLE_HISTORY_EVENT_RELATION_BOUND = 'relation_bound'
const COUPLE_HISTORY_EVENT_RELATION_UNBOUND = 'relation_unbound'
const COUPLE_HISTORY_EVENT_RELATION_CLOSED = 'relation_closed'

const COUPLE_STATUS_TEXT = {
	[COUPLE_STATUS_PENDING]: '待确认',
	[COUPLE_STATUS_BOUND]: '已绑定',
	[COUPLE_STATUS_UNBOUND]: '已解绑',
	[COUPLE_STATUS_CLOSED]: '已关闭',
	[COUPLE_STATUS_CANCELLED]: '已取消'
}

const REQUEST_STATUS_TEXT = {
	[REQUEST_STATUS_PENDING]: '待处理',
	[REQUEST_STATUS_ACCEPTED]: '已同意',
	[REQUEST_STATUS_REJECTED]: '已拒绝',
	[REQUEST_STATUS_CANCELLED]: '已撤回',
	[REQUEST_STATUS_CLOSED]: '已关闭',
	[REQUEST_STATUS_EXPIRED]: '已过期'
}

function getFileExtname(value = '') {
	const cleanValue = String(value).split('?')[0]
	const lastDotIndex = cleanValue.lastIndexOf('.')
	if (lastDotIndex === -1 || lastDotIndex === cleanValue.length - 1) {
		return 'png'
	}
	return cleanValue.slice(lastDotIndex + 1).toLowerCase()
}

function getFileName(value = '') {
	const cleanValue = String(value).split('?')[0]
	const segments = cleanValue.split('/')
	return segments[segments.length - 1] || `avatar.${getFileExtname(cleanValue)}`
}

function isValidBirthday(value = '') {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false
	}

	const date = new Date(`${value}T00:00:00`)
	if (Number.isNaN(date.getTime())) {
		return false
	}

	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}` === value
}

function getTodayDateString() {
	const today = new Date()
	const year = today.getFullYear()
	const month = `${today.getMonth() + 1}`.padStart(2, '0')
	const day = `${today.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}`
}

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
		{
			user_a_uid: uid
		},
		{
			user_b_uid: uid
		}
	])
}

function getRequestStatusText(status) {
	return REQUEST_STATUS_TEXT[Number(status)] || '未知状态'
}

function buildRequestParticipantCondition(uid) {
	return dbCmd.or([
		{
			requester_uid: uid
		},
		{
			receiver_uid: uid
		}
	])
}

function buildRequestPairCondition(uid, targetUid) {
	return dbCmd.or([
		{
			requester_uid: uid,
			receiver_uid: targetUid
		},
		{
			requester_uid: targetUid,
			receiver_uid: uid
		}
	])
}

function getRelationPartnerUid(uid, relation = {}) {
	if (!uid || !relation) {
		return ''
	}

	return relation.user_a_uid === uid ? relation.user_b_uid || '' : relation.user_a_uid || ''
}

function getRequesterUid(record = {}) {
	return record.requester_uid || record.created_by || record.user_a_uid || ''
}

function isRelationRecord(record = {}) {
	return Boolean(record && (record.user_a_uid || record.user_b_uid))
}

function isRequestRecord(record = {}) {
	return Boolean(record && (record.requester_uid || record.receiver_uid))
}

function getSafeNumber(value, fallback = 0) {
	const numericValue = Number(value)
	return Number.isFinite(numericValue) ? numericValue : fallback
}

function normalizeRelationMetrics(metrics = {}, anniversaryDate = 0) {
	const anniversaryCount = Math.max(
		getSafeNumber(metrics.anniversary_count, 0),
		anniversaryDate ? 1 : 0
	)

	return {
		anniversaryCount,
		momentCount: getSafeNumber(metrics.moment_count, 0),
		wishCount: getSafeNumber(metrics.wish_count, 0),
		albumCount: getSafeNumber(metrics.album_count, 0)
	}
}

function getRelationSnapshot(relation = {}) {
	return {
		user_a_uid: relation.user_a_uid || '',
		user_b_uid: relation.user_b_uid || '',
		status: Number(relation.status || 0),
		bind_date: relation.bind_date || 0,
		unbind_date: relation.unbind_date || 0,
		anniversary_date: relation.anniversary_date || 0
	}
}

function createSerialNo(prefix = 'REL') {
	return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function sanitizeRequestSnapshot(snapshot = {}) {
	return {
		uid: snapshot.uid || '',
		nickname: snapshot.nickname || '',
		avatar_url: snapshot.avatar_url || snapshot.avatarUrl || '',
		gender: Number(snapshot.gender || 0)
	}
}

function sanitizeHistorySnapshot(snapshot = {}) {
	return {
		uid: snapshot.uid || '',
		nickname: snapshot.nickname || '',
		avatar_url: snapshot.avatar_url || snapshot.avatarUrl || '',
		gender: Number(snapshot.gender || 0)
	}
}

function getSnapshotNickname(snapshot = {}, fallback = '') {
	return snapshot.nickname || fallback || DEFAULT_NICKNAME
}

function getSnapshotAvatarUrl(snapshot = {}, fallback = '') {
	return snapshot.avatar_url || snapshot.avatarUrl || fallback || ''
}

function getSnapshotAvatarFileId(snapshot = {}, fallback = '') {
	return snapshot.avatar_file_id || snapshot.avatarFileId || fallback || ''
}

function getSnapshotGender(snapshot = {}) {
	return Number(snapshot.gender || 0)
}

async function getUserById(uid) {
	const getUserRes = await userCollection.doc(uid).get()
	return getUserRes && getUserRes.data && getUserRes.data[0] ? getUserRes.data[0] : null
}

async function getCoupleById(coupleId = '') {
	const id = String(coupleId || '').trim()
	if (!id) {
		return null
	}

	const coupleRes = await coupleCollection.doc(id).get()
	return coupleRes && coupleRes.data && coupleRes.data[0] ? coupleRes.data[0] : null
}

async function getCoupleRequestById(requestId = '') {
	const id = String(requestId || '').trim()
	if (!id) {
		return null
	}

	const requestRes = await coupleRequestCollection.doc(id).get()
	return requestRes && requestRes.data && requestRes.data[0] ? requestRes.data[0] : null
}

async function getSingleCoupleByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc' } = {}) {
	const coupleRes = await coupleCollection.where(condition).orderBy(orderField, orderDirection).limit(1).get()
	return coupleRes && coupleRes.data && coupleRes.data[0] ? coupleRes.data[0] : null
}

async function getSingleRequestByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc' } = {}) {
	const requestRes = await coupleRequestCollection.where(condition).orderBy(orderField, orderDirection).limit(1).get()
	return requestRes && requestRes.data && requestRes.data[0] ? requestRes.data[0] : null
}

async function listCouplesByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc', limit = 100 } = {}) {
	const coupleRes = await coupleCollection.where(condition).orderBy(orderField, orderDirection).limit(limit).get()
	return coupleRes && Array.isArray(coupleRes.data) ? coupleRes.data : []
}

async function listRequestsByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc', limit = 100 } = {}) {
	const requestRes = await coupleRequestCollection.where(condition).orderBy(orderField, orderDirection).limit(limit).get()
	return requestRes && Array.isArray(requestRes.data) ? requestRes.data : []
}

async function listHistoriesByCondition(condition, { orderField = 'created_at', orderDirection = 'desc', limit = 100 } = {}) {
	const historyRes = await coupleHistoryCollection.where(condition).orderBy(orderField, orderDirection).limit(limit).get()
	return historyRes && Array.isArray(historyRes.data) ? historyRes.data : []
}

async function getActiveCoupleByUid(uid) {
	if (!uid) {
		return null
	}

	try {
		return await getSingleCoupleByCondition(
			dbCmd.and([
				buildCoupleParticipantCondition(uid),
				{
					status: COUPLE_STATUS_BOUND
				}
			]),
			{
				orderField: 'bind_date'
			}
		)
	} catch (error) {
		console.warn('getActiveCoupleByUid failed', error)
		return null
	}
}

async function getLatestPendingRequestByUid(uid) {
	if (!uid) {
		return null
	}

	try {
		return await getSingleRequestByCondition(
			dbCmd.and([
				buildRequestParticipantCondition(uid),
				{
					status: REQUEST_STATUS_PENDING
				}
			]),
			{
				orderField: 'created_at'
			}
		)
	} catch (error) {
		console.warn('getLatestPendingRequestByUid failed', error)
		return null
	}
}

async function getRelationHistoryRecordsByUid(uid) {
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
		console.warn('getRelationHistoryRecordsByUid failed', error)
		return []
	}
}

async function getCoupleHistoryByUid(uid) {
	if (!uid) {
		return []
	}

	try {
		return await listHistoriesByCondition(
			dbCmd.or([
				{
					operator_uid: uid
				},
				{
					partner_uid: uid
				}
			]),
			{
				orderField: 'created_at',
				limit: 200
			}
		)
	} catch (error) {
		console.warn('getCoupleHistoryByUid failed', error)
		return []
	}
}

async function getIncomingPendingRequests(uid) {
	if (!uid) {
		return []
	}

	try {
		return await listRequestsByCondition(
			dbCmd.and([
				{
					receiver_uid: uid
				},
				{
					status: REQUEST_STATUS_PENDING
				}
			]),
			{
				orderField: 'created_at',
				limit: 50
			}
		)
	} catch (error) {
		console.warn('getIncomingPendingRequests failed', error)
		return []
	}
}

async function getOutgoingPendingRequests(uid) {
	if (!uid) {
		return []
	}

	try {
		return await listRequestsByCondition(
			dbCmd.and([
				{
					requester_uid: uid
				},
				{
					status: REQUEST_STATUS_PENDING
				}
			]),
			{
				orderField: 'created_at',
				limit: 20
			}
		)
	} catch (error) {
		console.warn('getOutgoingPendingRequests failed', error)
		return []
	}
}

async function getExistingPendingRelationBetween(uid, targetUid) {
	if (!uid || !targetUid) {
		return null
	}

	try {
		return await getSingleRequestByCondition(
			dbCmd.and([
				{
					status: REQUEST_STATUS_PENDING
				},
				buildRequestPairCondition(uid, targetUid)
			]),
			{
				orderField: 'created_at'
			}
		)
	} catch (error) {
		console.warn('getExistingPendingRelationBetween failed', error)
		return null
	}
}

async function getCoupleByUid(uid) {
	const activeRelation = await getActiveCoupleByUid(uid)
	if (activeRelation) {
		return activeRelation
	}

	return getLatestPendingRequestByUid(uid)
}

async function resolveAvatar(record = {}) {
	const avatarFileId = record.avatar_file_id || (record.avatar_file && record.avatar_file.url) || ''

	if (avatarFileId) {
		if (/^https?:\/\//.test(avatarFileId)) {
			return {
				avatarFileId: '',
				avatarUrl: avatarFileId
			}
		}

		try {
			const tempFileRes = await uniCloud.getTempFileURL({
				fileList: [avatarFileId]
			})
			const fileItem = tempFileRes.fileList && tempFileRes.fileList.length ? tempFileRes.fileList[0] : null
			if (fileItem && fileItem.tempFileURL) {
				return {
					avatarFileId,
					avatarUrl: fileItem.tempFileURL
				}
			}
		} catch (error) {
			console.warn('resolveAvatar failed', error)
		}

		return {
			avatarFileId,
			avatarUrl: record.avatar || avatarFileId
		}
	}

	if (record.avatar && /^https?:\/\//.test(record.avatar)) {
		return {
			avatarFileId: '',
			avatarUrl: record.avatar
		}
	}

	return {
		avatarFileId: '',
		avatarUrl: record.avatar || ''
	}
}

async function buildUserSnapshot(record = {}) {
	const { avatarFileId, avatarUrl } = await resolveAvatar(record)
	return {
		uid: record._id || '',
		nickname: record.nickname || record.username || DEFAULT_NICKNAME,
		avatar_url: avatarUrl,
		avatar_file_id: avatarFileId,
		gender: Number(record.gender || 0),
		birthday: record.birthday || '',
		mobile: record.mobile || ''
	}
}

async function getRelationPartnerMeta(uid, relation = {}) {
	const partnerUid = getRelationPartnerUid(uid, relation)
	const partnerSnapshot = relation.user_a_uid === uid
		? relation.user_b_snapshot || {}
		: relation.user_a_snapshot || {}
	const partnerRecord = partnerUid ? await getUserById(partnerUid) : null
	const partnerAvatar = partnerRecord ? await resolveAvatar(partnerRecord) : {
		avatarFileId: getSnapshotAvatarFileId(partnerSnapshot),
		avatarUrl: getSnapshotAvatarUrl(partnerSnapshot)
	}
	const partnerNickname = partnerRecord
		? partnerRecord.nickname || partnerRecord.username || DEFAULT_NICKNAME
		: getSnapshotNickname(partnerSnapshot, relation.partner_nickname || '')

	return {
		partnerUid,
		partnerRecord,
		partnerSnapshot,
		partnerAvatar,
		partnerNickname,
		partnerGender: partnerRecord ? Number(partnerRecord.gender || 0) : getSnapshotGender(partnerSnapshot)
	}
}

async function getRequestPartnerMeta(uid, request = {}) {
	const isRequester = request.requester_uid === uid
	const partnerUid = isRequester ? request.receiver_uid || '' : request.requester_uid || ''
	const partnerSnapshot = isRequester
		? request.receiver_snapshot || {}
		: request.requester_snapshot || {}
	const partnerRecord = partnerUid ? await getUserById(partnerUid) : null
	const partnerAvatar = partnerRecord ? await resolveAvatar(partnerRecord) : {
		avatarFileId: getSnapshotAvatarFileId(partnerSnapshot),
		avatarUrl: getSnapshotAvatarUrl(partnerSnapshot)
	}
	const partnerNickname = partnerRecord
		? partnerRecord.nickname || partnerRecord.username || DEFAULT_NICKNAME
		: getSnapshotNickname(partnerSnapshot)

	return {
		direction: isRequester ? 'outgoing' : 'incoming',
		partnerUid,
		partnerRecord,
		partnerSnapshot,
		partnerAvatar,
		partnerNickname,
		partnerGender: partnerRecord ? Number(partnerRecord.gender || 0) : getSnapshotGender(partnerSnapshot)
	}
}

async function createCoupleHistoryRecord({
	relation = {},
	request = {},
	relationId = '',
	requestId = '',
	eventType = '',
	eventStatus = 0,
	operatorUid = '',
	partnerUid = '',
	operatorSnapshot = {},
	partnerSnapshot = {},
	content = '',
	remark = '',
	createdAt = Date.now()
} = {}) {
	if (!eventType) {
		return
	}

	await coupleHistoryCollection.add({
		history_no: createSerialNo('HIS'),
		relation_id: relationId || relation._id || request.relation_id || '',
		request_id: requestId || request._id || relation.current_request_id || '',
		event_type: eventType,
		event_status: Number(eventStatus || 0),
		operator_uid: operatorUid || '',
		partner_uid: partnerUid || '',
		operator_snapshot: sanitizeHistorySnapshot(operatorSnapshot),
		partner_snapshot: sanitizeHistorySnapshot(partnerSnapshot),
		relation_snapshot: getRelationSnapshot(relation),
		content,
		remark,
		created_at: createdAt
	})
}

function buildRequestStatusUpdate(status, { uid = '', reviewedBy = '', now = Date.now() } = {}) {
	const updateData = {
		status,
		last_action_uid: uid || '',
		updated_at: now
	}

	if (status === REQUEST_STATUS_ACCEPTED) {
		updateData.reviewed_by = reviewedBy || uid || ''
		updateData.accepted_at = now
	}

	if (status === REQUEST_STATUS_REJECTED) {
		updateData.reviewed_by = reviewedBy || uid || ''
		updateData.rejected_at = now
	}

	if (status === REQUEST_STATUS_CANCELLED) {
		updateData.cancelled_at = now
	}

	if (status === REQUEST_STATUS_CLOSED || status === REQUEST_STATUS_EXPIRED) {
		updateData.closed_at = now
	}

	return updateData
}

async function closePendingRequestsForUsers(uidList = [], { excludeId = '', status = REQUEST_STATUS_CLOSED, actionUid = '', now = Date.now() } = {}) {
	const uniqueUidList = Array.from(new Set(uidList.filter(Boolean)))
	if (!uniqueUidList.length) {
		return
	}

	const participantConditions = []
	uniqueUidList.forEach((uid) => {
		participantConditions.push({
			requester_uid: uid
		})
		participantConditions.push({
			receiver_uid: uid
		})
	})

	const conditions = [
		{
			status: REQUEST_STATUS_PENDING
		},
		dbCmd.or(participantConditions)
	]

	if (excludeId) {
		conditions.push({
			_id: dbCmd.neq(excludeId)
		})
	}

	const pendingRequests = await listRequestsByCondition(dbCmd.and(conditions), {
		orderField: 'created_at',
		limit: 100
	})

	for (const request of pendingRequests) {
		const relation = request.relation_id ? await getCoupleById(request.relation_id) : null
		await coupleRequestCollection.doc(request._id).update(buildRequestStatusUpdate(status, {
			uid: actionUid,
			reviewedBy: actionUid,
			now
		}))

		if (relation && relation._id) {
			await coupleCollection.doc(relation._id).update({
				status: COUPLE_STATUS_CLOSED,
				last_action_uid: actionUid || '',
				updated_at: now
			})
		}

		await createCoupleHistoryRecord({
			relation: Object.assign({}, relation || {}, {
				status: COUPLE_STATUS_CLOSED
			}),
			request: Object.assign({}, request, {
				status
			}),
			eventType: COUPLE_HISTORY_EVENT_RELATION_CLOSED,
			eventStatus: COUPLE_STATUS_CLOSED,
			operatorUid: actionUid,
			partnerUid: request.requester_uid === actionUid ? request.receiver_uid || '' : request.requester_uid || '',
			operatorSnapshot: request.requester_uid === actionUid
				? request.requester_snapshot || {}
				: request.receiver_snapshot || {},
			partnerSnapshot: request.requester_uid === actionUid
				? request.receiver_snapshot || {}
				: request.requester_snapshot || {},
			createdAt: now,
			content: '系统已关闭其他待处理绑定请求'
		})
	}
}

async function formatCoupleInfo(uid, coupleRecord = null) {
	const relationRecord = coupleRecord || await getCoupleByUid(uid)
	if (!relationRecord) {
		return null
	}

	const isUserA = relationRecord.user_a_uid === uid
	const partnerUid = isUserA ? relationRecord.user_b_uid || '' : relationRecord.user_a_uid || ''
	const partnerRecord = partnerUid ? await getUserById(partnerUid) : null
	const partnerAvatar = partnerRecord ? await resolveAvatar(partnerRecord) : {
		avatarFileId: '',
		avatarUrl: ''
	}
	const status = Number(relationRecord.status || 0)

	return {
		coupleId: relationRecord._id || '',
		status,
		statusText: status === 1 ? '已绑定' : '待确认',
		isBound: status === 1,
		partnerUid,
		partnerNickname: partnerRecord
			? partnerRecord.nickname || partnerRecord.username || DEFAULT_NICKNAME
			: relationRecord.partner_nickname || '',
		partnerAvatarUrl: partnerAvatar.avatarUrl || '',
		partnerAvatarFileId: partnerAvatar.avatarFileId || '',
		bindDate: relationRecord.bind_date || relationRecord.created_at || 0,
		anniversaryDate: relationRecord.anniversary_date || 0
	}
}

async function formatUserInfo(record = {}) {
	const { avatarFileId, avatarUrl } = await resolveAvatar(record)
	const coupleInfo = record._id ? await formatCoupleInfo(record._id) : null

	return {
		_id: record._id || '',
		nickname: record.nickname || record.username || DEFAULT_NICKNAME,
		avatarUrl,
		avatarFileId,
		gender: Number(record.gender || 0),
		mobile: record.mobile || '',
		birthday: record.birthday || '',
		age: Number(record.age || 0),
		role: Array.isArray(record.role) ? record.role : [],
		status: typeof record.status === 'number' ? record.status : 0,
		wxUnionid: record.wx_unionid || '',
		registerDate: record.register_date || 0,
		lastLoginDate: record.last_login_date || 0,
		coupleInfo
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

async function formatCoupleInfo(uid, coupleRecord = null) {
	const record = coupleRecord || await getCoupleByUid(uid)
	if (!record) {
		return null
	}

	if (isRequestRecord(record)) {
		const { partnerUid, partnerAvatar, partnerNickname, partnerGender, direction } = await getRequestPartnerMeta(uid, record)
		const metrics = normalizeRelationMetrics()

		return {
			coupleId: record.relation_id || '',
			requestId: record._id || '',
			status: COUPLE_STATUS_PENDING,
			statusText: getCoupleStatusText(COUPLE_STATUS_PENDING),
			isBound: false,
			isPending: Number(record.status || 0) === REQUEST_STATUS_PENDING,
			direction,
			partnerUid,
			partnerUidMasked: maskUid(partnerUid),
			partnerNickname,
			partnerNicknameMasked: maskNickname(partnerNickname),
			partnerAvatarUrl: partnerAvatar.avatarUrl || '',
			partnerAvatarFileId: partnerAvatar.avatarFileId || '',
			partnerGender,
			bindDate: 0,
			anniversaryDate: 0,
			anniversaryLabel: '',
			requestDate: record.created_at || 0,
			metrics,
			anniversaryCount: metrics.anniversaryCount,
			momentCount: metrics.momentCount,
			wishCount: metrics.wishCount
		}
	}

	const { partnerUid, partnerAvatar, partnerNickname, partnerGender } = await getRelationPartnerMeta(uid, record)
	const status = Number(record.status || 0)
	const requesterUid = getRequesterUid(record)
	const metrics = normalizeRelationMetrics(record.metrics || {}, record.anniversary_date || 0)

	return {
		coupleId: record._id || '',
		requestId: record.current_request_id || '',
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
		partnerGender,
		bindDate: record.bind_date || record.created_at || 0,
		anniversaryDate: record.anniversary_date || 0,
		anniversaryLabel: record.anniversary_label || '',
		requestDate: record.created_at || 0,
		metrics,
		anniversaryCount: metrics.anniversaryCount,
		momentCount: metrics.momentCount,
		wishCount: metrics.wishCount
	}
}

async function formatCoupleRequestItem(uid, relation = {}, { type = 'incoming' } = {}) {
	const { partnerUid, partnerAvatar, partnerNickname, partnerGender, direction } = await getRequestPartnerMeta(uid, relation)
	return {
		requestId: relation._id || '',
		relationId: relation.relation_id || '',
		type: type || direction,
		status: Number(relation.status || 0),
		statusText: getRequestStatusText(relation.status),
		partnerUid,
		partnerUidMasked: maskUid(partnerUid),
		partnerNickname,
		partnerNicknameMasked: maskNickname(partnerNickname),
		partnerAvatarUrl: partnerAvatar.avatarUrl || '',
		partnerAvatarFileId: partnerAvatar.avatarFileId || '',
		partnerGender,
		createdAt: relation.created_at || 0,
		updatedAt: relation.updated_at || 0
	}
}

async function formatCoupleHistoryItem(uid, relation = {}) {
	if (isRelationRecord(relation)) {
		const { partnerUid, partnerAvatar, partnerNickname } = await getRelationPartnerMeta(uid, relation)
		const status = Number(relation.status || 0)
		return {
			relationId: relation._id || '',
			status,
			statusText: getCoupleStatusText(status),
			partnerUid,
			partnerUidMasked: maskUid(partnerUid),
			partnerNickname,
			partnerNicknameMasked: maskNickname(partnerNickname),
			partnerAvatarUrl: partnerAvatar.avatarUrl || '',
			partnerAvatarFileId: partnerAvatar.avatarFileId || '',
			bindDate: relation.bind_date || relation.created_at || 0,
			unbindDate: relation.unbind_date || 0,
			isCurrent: status === COUPLE_STATUS_BOUND
		}
	}

	const relationSnapshot = relation.relation_snapshot || {}
	const isOperator = relation.operator_uid === uid
	const partnerUid = isOperator ? relation.partner_uid || '' : relation.operator_uid || ''
	const partnerSnapshot = isOperator
		? relation.partner_snapshot || {}
		: relation.operator_snapshot || {}
	const partnerRecord = partnerUid ? await getUserById(partnerUid) : null
	const partnerAvatar = partnerRecord ? await resolveAvatar(partnerRecord) : {
		avatarFileId: getSnapshotAvatarFileId(partnerSnapshot),
		avatarUrl: getSnapshotAvatarUrl(partnerSnapshot)
	}
	const partnerNickname = partnerRecord
		? partnerRecord.nickname || partnerRecord.username || DEFAULT_NICKNAME
		: getSnapshotNickname(partnerSnapshot)
	const status = Number(
		relationSnapshot.status
		|| (relation.event_type === COUPLE_HISTORY_EVENT_RELATION_UNBOUND ? COUPLE_STATUS_UNBOUND : COUPLE_STATUS_BOUND)
	)

	return {
		relationId: relation.relation_id || '',
		status,
		statusText: getCoupleStatusText(status),
		partnerUid,
		partnerUidMasked: maskUid(partnerUid),
		partnerNickname,
		partnerNicknameMasked: maskNickname(partnerNickname),
		partnerAvatarUrl: partnerAvatar.avatarUrl || '',
		partnerAvatarFileId: partnerAvatar.avatarFileId || '',
		bindDate: relationSnapshot.bind_date || relation.created_at || 0,
		unbindDate: relationSnapshot.unbind_date || 0,
		isCurrent: status === COUPLE_STATUS_BOUND
	}
}

async function buildCoupleHistoryList(uid, { excludeRelationId = '' } = {}) {
	const historyRecords = await getCoupleHistoryByUid(uid)
	const relationRecords = await getRelationHistoryRecordsByUid(uid)
	const seenRelationIds = new Set()
	const historyList = []

	for (const item of historyRecords) {
		if (!item || !item.relation_id || seenRelationIds.has(item.relation_id) || item.relation_id === excludeRelationId) {
			continue
		}

		if (![COUPLE_HISTORY_EVENT_RELATION_BOUND, COUPLE_HISTORY_EVENT_RELATION_UNBOUND].includes(item.event_type)) {
			continue
		}

		seenRelationIds.add(item.relation_id)
		historyList.push(await formatCoupleHistoryItem(uid, item))
	}

	for (const item of relationRecords) {
		if (!item || !item._id || seenRelationIds.has(item._id) || item._id === excludeRelationId) {
			continue
		}

		seenRelationIds.add(item._id)
		historyList.push(await formatCoupleHistoryItem(uid, item))
	}

	return historyList.sort((a, b) => {
		const aTimestamp = Math.max(Number(a.unbindDate || 0), Number(a.bindDate || 0))
		const bTimestamp = Math.max(Number(b.unbindDate || 0), Number(b.bindDate || 0))
		return bTimestamp - aTimestamp
	})
}

function getUniIdInstance(context) {
	return uniIdCommon.createInstance({
		clientInfo: context.getClientInfo()
	})
}

async function checkAuth(context) {
	const uniId = getUniIdInstance(context)
	const authResult = await uniId.checkToken(context.getUniIdToken())
	if (authResult.errCode) {
		throw authResult
	}

	return {
		authResult,
		response: authResult.token && authResult.tokenExpired
			? {
				newToken: {
					token: authResult.token,
					tokenExpired: authResult.tokenExpired
				}
			}
			: {}
	}
}

async function ensureDefaultRole(uid) {
	const userRecord = await getUserById(uid)
	if (!userRecord) {
		return null
	}

	const currentRole = Array.isArray(userRecord.role) ? userRecord.role : []
	const nextRole = currentRole.includes(DEFAULT_ROLE)
		? currentRole
		: currentRole.concat(DEFAULT_ROLE)

	const updateData = {
		updated_at: Date.now()
	}

	if (!currentRole.includes(DEFAULT_ROLE)) {
		updateData.role = nextRole
	}

	if (!userRecord.created_at) {
		updateData.created_at = userRecord.register_date || Date.now()
	}

	if (Object.keys(updateData).length > 1 || !userRecord.created_at) {
		await userCollection.doc(uid).update(updateData)
		return getUserById(uid)
	}

	return userRecord
}

function buildProfileUpdateData(params = {}) {
	const updateData = {
		updated_at: Date.now()
	}

	if (params.nickname !== undefined) {
		const nickname = String(params.nickname || '').trim()
		if (nickname.length > 100) {
			throw {
				errCode: 'love-note-invalid-nickname',
				errMsg: '昵称长度不能超过 100 个字符'
			}
		}
		if (nickname) {
			updateData.nickname = nickname
		}
	}

	if (params.gender !== undefined) {
		const gender = Number(params.gender)
		if (![0, 1, 2].includes(gender)) {
			throw {
				errCode: 'love-note-invalid-gender',
				errMsg: '性别参数不合法'
			}
		}
		updateData.gender = gender
	}

	if (params.mobile !== undefined) {
		const mobile = String(params.mobile || '').replace(/[^\d]/g, '').slice(0, 11)
		if (!mobile) {
			updateData.mobile = dbCmd.remove()
			updateData.mobile_confirmed = dbCmd.remove()
		} else {
			if (!/^1[3-9]\d{9}$/.test(mobile)) {
				throw {
					errCode: 'love-note-invalid-mobile',
					errMsg: '手机号格式不正确'
				}
			}

			updateData.mobile = mobile
			updateData.mobile_confirmed = 0
		}
	}

	if (params.birthday !== undefined) {
		const birthday = String(params.birthday || '').trim()
		if (!birthday) {
			updateData.birthday = dbCmd.remove()
		} else {
			if (!isValidBirthday(birthday)) {
				throw {
					errCode: 'love-note-invalid-birthday',
					errMsg: '生日格式不正确'
				}
			}

			if (birthday < '1900-01-01' || birthday > getTodayDateString()) {
				throw {
					errCode: 'love-note-invalid-birthday',
					errMsg: '生日日期超出可选范围'
				}
			}

			updateData.birthday = birthday
		}
	}

	if (params.age !== undefined) {
		if (params.age === '' || params.age === null) {
			updateData.age = dbCmd.remove()
		} else {
			const age = Number(params.age)
			if (!Number.isInteger(age) || age < 1 || age > 120) {
				throw {
					errCode: 'love-note-invalid-age',
					errMsg: '年龄范围需在 1 到 120 岁之间'
				}
			}
			updateData.age = age
		}
	}

	const avatarFileId = typeof params.avatarFileId === 'string' ? params.avatarFileId.trim() : ''
	const avatarUrl = typeof params.avatarUrl === 'string' ? params.avatarUrl.trim() : ''
	const avatarFile = params.avatarFile && typeof params.avatarFile === 'object' ? params.avatarFile : null

	if (avatarFileId) {
		updateData.avatar = avatarFileId
		updateData.avatar_file_id = avatarFileId
		updateData.avatar_file = {
			name: avatarFile && avatarFile.name ? avatarFile.name : getFileName(avatarFileId),
			extname: avatarFile && avatarFile.extname ? avatarFile.extname : getFileExtname(avatarFileId),
			url: avatarFileId
		}
	} else if (avatarUrl) {
		updateData.avatar = avatarUrl
		updateData.avatar_file_id = dbCmd.remove()
		updateData.avatar_file = dbCmd.remove()
	}

	return updateData
}

async function updateUserProfile(uid, params = {}) {
	const updateData = buildProfileUpdateData(params)
	if (Object.keys(updateData).length > 1) {
		await userCollection.doc(uid).update(updateData)
	}
	return getUserById(uid)
}

function formatError(error, fallbackMessage = '请求失败') {
	if (error && typeof error === 'object') {
		return {
			errCode: error.errCode || 'love-note-request-failed',
			errMsg: error.errMsg || error.message || fallbackMessage
		}
	}

	return {
		errCode: 'love-note-request-failed',
		errMsg: fallbackMessage
	}
}

async function buildCoupleCenterPayload(uid) {
	const userRecord = await getUserById(uid)
	if (!userRecord) {
		throw {
			errCode: 'uni-id-account-not-exists',
			errMsg: '当前用户不存在'
		}
	}

	const [activeCouple, incomingRequests, outgoingRequests] = await Promise.all([
		getActiveCoupleByUid(uid),
		getIncomingPendingRequests(uid),
		getOutgoingPendingRequests(uid)
	])

	const historyList = await buildCoupleHistoryList(uid, {
		excludeRelationId: activeCouple ? activeCouple._id : ''
	})

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
	async loginByWeixin(params = {}) {
		try {
			const code = params && params.code ? String(params.code).trim() : ''
			if (!code) {
				return {
					errCode: 'uni-id-param-required',
					errMsg: '缺少参数: code'
				}
			}

			const uniIdCo = callAdapter.cloudobject(this)
			const loginResult = await uniIdCo.loginByWeixin({
				code
			})

			if (loginResult.errCode) {
				return loginResult
			}

			let userRecord = await ensureDefaultRole(loginResult.uid)

			if (
				params.nickname !== undefined ||
				params.gender !== undefined ||
				params.mobile !== undefined ||
				params.birthday !== undefined ||
				params.age !== undefined ||
				params.avatarFileId ||
				params.avatarUrl
			) {
				userRecord = await updateUserProfile(loginResult.uid, params)
			}

			return Object.assign({}, loginResult, {
				errCode: 0,
				userInfo: await formatUserInfo(userRecord || {})
			})
		} catch (error) {
			return formatError(error, '微信登录失败')
		}
	},
	async getMine() {
		try {
			const { authResult, response } = await checkAuth(this)
			const userRecord = await getUserById(authResult.uid)

			if (!userRecord) {
				return {
					errCode: 'uni-id-account-not-exists',
					errMsg: '当前用户不存在'
				}
			}

			return Object.assign({}, response, {
				errCode: 0,
				userInfo: await formatUserInfo(userRecord)
			})
		} catch (error) {
			return formatError(error, '获取用户信息失败')
		}
	},
	async updateProfile(params = {}) {
		try {
			const { authResult, response } = await checkAuth(this)
			const userRecord = await updateUserProfile(authResult.uid, params)

			return Object.assign({}, response, {
				errCode: 0,
				userInfo: await formatUserInfo(userRecord || {})
			})
		} catch (error) {
			return formatError(error, '更新用户资料失败')
		}
	},
	async getCoupleCenter() {
		try {
			const { authResult, response } = await checkAuth(this)
			return Object.assign({}, response, {
				errCode: 0,
				...(await buildCoupleCenterPayload(authResult.uid))
			})
		} catch (error) {
			return formatError(error, '获取情侣信息失败')
		}
	},
	async sendCoupleRequest(params = {}) {
		try {
			const { authResult, response } = await checkAuth(this)
			const uid = authResult.uid
			const targetUid = String(params.targetUid || '').trim()

			if (!targetUid) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '请输入要绑定的用户ID'
				}
			}

			if (targetUid === uid) {
				return {
					errCode: 'love-note-invalid-target',
					errMsg: '不能向自己发起绑定请求'
				}
			}

			const [currentUser, targetUser, selfActiveCouple, targetActiveCouple, existingOutgoing, existingPendingRelation] = await Promise.all([
				getUserById(uid),
				getUserById(targetUid),
				getActiveCoupleByUid(uid),
				getActiveCoupleByUid(targetUid),
				getOutgoingPendingRequests(uid),
				getExistingPendingRelationBetween(uid, targetUid)
			])

			if (!currentUser) {
				return {
					errCode: 'uni-id-account-not-exists',
					errMsg: '当前用户不存在'
				}
			}

			if (!targetUser) {
				return {
					errCode: 'love-note-target-not-found',
					errMsg: '未找到该用户，请确认ID是否正确'
				}
			}

			if (selfActiveCouple) {
				return {
					errCode: 'love-note-couple-already-bound',
					errMsg: '你已绑定情侣，解绑后才能重新绑定'
				}
			}

			if (targetActiveCouple) {
				return {
					errCode: 'love-note-target-bound',
					errMsg: '对方当前已绑定情侣'
				}
			}

			if (existingOutgoing.length) {
				return {
					errCode: 'love-note-request-exists',
					errMsg: '你已有待处理的绑定请求，请先撤回后再发起新的请求'
				}
			}

			if (existingPendingRelation) {
				return {
					errCode: 'love-note-request-exists',
					errMsg: getRequesterUid(existingPendingRelation) === uid
						? '绑定请求已发送，请等待对方处理'
						: '对方已向你发起绑定请求，请在待处理请求中确认'
				}
			}

			const now = Date.now()
			const requesterSnapshot = await buildUserSnapshot(currentUser)
			const receiverSnapshot = await buildUserSnapshot(targetUser)
			const relationData = {
				relation_no: createSerialNo('REL'),
				user_a_uid: uid,
				user_b_uid: targetUid,
				partner_nickname: targetUser.nickname || targetUser.username || DEFAULT_NICKNAME,
				user_a_snapshot: requesterSnapshot,
				user_b_snapshot: receiverSnapshot,
				status: COUPLE_STATUS_PENDING,
				current_request_id: '',
				request_source: REQUEST_SOURCE_MANUAL,
				created_by: uid,
				last_action_uid: uid,
				last_interaction_at: now,
				metrics: {
					anniversary_count: 0,
					moment_count: 0,
					wish_count: 0,
					album_count: 0
				},
				created_at: now,
				updated_at: now
			}
			const relationCreateRes = await coupleCollection.add(relationData)
			const relationId = relationCreateRes && relationCreateRes.id ? relationCreateRes.id : ''
			const requestData = {
				request_no: createSerialNo('REQ'),
				relation_id: relationId,
				requester_uid: uid,
				receiver_uid: targetUid,
				requester_snapshot: sanitizeRequestSnapshot(requesterSnapshot),
				receiver_snapshot: sanitizeRequestSnapshot(receiverSnapshot),
				status: REQUEST_STATUS_PENDING,
				source: REQUEST_SOURCE_MANUAL,
				last_action_uid: uid,
				created_at: now,
				updated_at: now
			}
			const requestCreateRes = await coupleRequestCollection.add(requestData)
			const requestId = requestCreateRes && requestCreateRes.id ? requestCreateRes.id : ''

			if (relationId && requestId) {
				await coupleCollection.doc(relationId).update({
					current_request_id: requestId,
					updated_at: now
				})
			}

			await createCoupleHistoryRecord({
				relation: Object.assign({}, relationData, {
					_id: relationId,
					current_request_id: requestId
				}),
				request: Object.assign({}, requestData, {
					_id: requestId
				}),
				relationId,
				requestId,
				eventType: COUPLE_HISTORY_EVENT_REQUEST_CREATED,
				eventStatus: REQUEST_STATUS_PENDING,
				operatorUid: uid,
				partnerUid: targetUid,
				operatorSnapshot: requesterSnapshot,
				partnerSnapshot: receiverSnapshot,
				createdAt: now,
				content: '发起情侣绑定请求'
			})

			return Object.assign({}, response, {
				errCode: 0,
				errMsg: '绑定请求已发送',
				...(await buildCoupleCenterPayload(uid))
			})
		} catch (error) {
			return formatError(error, '发送绑定请求失败')
		}
	},
	async reviewCoupleRequest(params = {}) {
		try {
			const { authResult, response } = await checkAuth(this)
			const uid = authResult.uid
			const requestId = String(params.requestId || '').trim()
			const action = String(params.action || 'accept').trim()

			if (!requestId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少请求ID'
				}
			}

			const requestRecord = await getCoupleRequestById(requestId)
			if (!requestRecord || Number(requestRecord.status) !== REQUEST_STATUS_PENDING) {
				return {
					errCode: 'love-note-request-not-found',
					errMsg: '该绑定请求不存在或已处理'
				}
			}

			if (requestRecord.receiver_uid !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你无权处理这条绑定请求'
				}
			}

			const now = Date.now()
			const relation = requestRecord.relation_id ? await getCoupleById(requestRecord.relation_id) : null
			if (!relation) {
				return {
					errCode: 'love-note-couple-not-found',
					errMsg: '绑定关系不存在，无法处理该请求'
				}
			}

			if (action === 'reject') {
				await coupleRequestCollection.doc(requestId).update(buildRequestStatusUpdate(REQUEST_STATUS_REJECTED, {
					uid,
					reviewedBy: uid,
					now
				}))
				await coupleCollection.doc(relation._id).update({
					status: COUPLE_STATUS_CLOSED,
					current_request_id: requestId,
					last_action_uid: uid,
					updated_at: now
				})
				await createCoupleHistoryRecord({
					relation: Object.assign({}, relation, {
						status: COUPLE_STATUS_CLOSED,
						current_request_id: requestId
					}),
					request: Object.assign({}, requestRecord, {
						status: REQUEST_STATUS_REJECTED
					}),
					eventType: COUPLE_HISTORY_EVENT_REQUEST_REJECTED,
					eventStatus: REQUEST_STATUS_REJECTED,
					operatorUid: uid,
					partnerUid: requestRecord.requester_uid || '',
					operatorSnapshot: requestRecord.receiver_snapshot || {},
					partnerSnapshot: requestRecord.requester_snapshot || {},
					createdAt: now,
					content: '已拒绝情侣绑定请求'
				})

				return Object.assign({}, response, {
					errCode: 0,
					errMsg: '已拒绝绑定请求',
					...(await buildCoupleCenterPayload(uid))
				})
			}

			if (action !== 'accept') {
				return {
					errCode: 'love-note-invalid-action',
					errMsg: '不支持的处理动作'
				}
			}

			const requesterUid = requestRecord.requester_uid || ''
			const [selfActiveCouple, requesterActiveCouple, requesterUser, receiverUser] = await Promise.all([
				getActiveCoupleByUid(uid),
				getActiveCoupleByUid(requesterUid),
				getUserById(requesterUid),
				getUserById(uid)
			])

			if (selfActiveCouple) {
				return {
					errCode: 'love-note-couple-already-bound',
					errMsg: '你已绑定情侣，解绑后才能处理新的请求'
				}
			}

			if (requesterActiveCouple) {
				return {
					errCode: 'love-note-target-bound',
					errMsg: '对方已与其他人完成绑定'
				}
			}

			const requesterSnapshot = requesterUser ? await buildUserSnapshot(requesterUser) : requestRecord.requester_snapshot || {}
			const receiverSnapshot = receiverUser ? await buildUserSnapshot(receiverUser) : requestRecord.receiver_snapshot || {}
			await coupleRequestCollection.doc(requestId).update(buildRequestStatusUpdate(REQUEST_STATUS_ACCEPTED, {
				uid,
				reviewedBy: uid,
				now
			}))
			await coupleCollection.doc(relation._id).update({
				status: COUPLE_STATUS_BOUND,
				bind_date: now,
				current_request_id: requestId,
				user_a_snapshot: requesterSnapshot,
				user_b_snapshot: receiverSnapshot,
				last_action_uid: uid,
				updated_at: now
			})
			await closePendingRequestsForUsers([uid, requesterUid], {
				excludeId: requestId,
				status: REQUEST_STATUS_CLOSED,
				actionUid: uid,
				now
			})
			const boundRelation = Object.assign({}, relation, {
				status: COUPLE_STATUS_BOUND,
				bind_date: now,
				current_request_id: requestId,
				user_a_snapshot: requesterSnapshot,
				user_b_snapshot: receiverSnapshot
			})
			await createCoupleHistoryRecord({
				relation: boundRelation,
				request: Object.assign({}, requestRecord, {
					status: REQUEST_STATUS_ACCEPTED,
					accepted_at: now
				}),
				eventType: COUPLE_HISTORY_EVENT_REQUEST_ACCEPTED,
				eventStatus: REQUEST_STATUS_ACCEPTED,
				operatorUid: uid,
				partnerUid: requesterUid,
				operatorSnapshot: receiverSnapshot,
				partnerSnapshot: requesterSnapshot,
				createdAt: now,
				content: '已同意情侣绑定请求'
			})
			await createCoupleHistoryRecord({
				relation: boundRelation,
				request: Object.assign({}, requestRecord, {
					status: REQUEST_STATUS_ACCEPTED,
					accepted_at: now
				}),
				eventType: COUPLE_HISTORY_EVENT_RELATION_BOUND,
				eventStatus: COUPLE_STATUS_BOUND,
				operatorUid: uid,
				partnerUid: requesterUid,
				operatorSnapshot: receiverSnapshot,
				partnerSnapshot: requesterSnapshot,
				createdAt: now,
				content: '情侣关系已完成绑定'
			})

			return Object.assign({}, response, {
				errCode: 0,
				errMsg: '绑定成功',
				...(await buildCoupleCenterPayload(uid))
			})
		} catch (error) {
			return formatError(error, '处理绑定请求失败')
		}
	},
	async cancelCoupleRequest(params = {}) {
		try {
			const { authResult, response } = await checkAuth(this)
			const uid = authResult.uid
			const requestId = String(params.requestId || '').trim()

			if (!requestId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少请求ID'
				}
			}

			const requestRecord = await getCoupleRequestById(requestId)
			if (!requestRecord || Number(requestRecord.status) !== REQUEST_STATUS_PENDING) {
				return {
					errCode: 'love-note-request-not-found',
					errMsg: '该绑定请求不存在或已处理'
				}
			}

			if (requestRecord.requester_uid !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你只能撤回自己发起的绑定请求'
				}
			}

			const now = Date.now()
			const relation = requestRecord.relation_id ? await getCoupleById(requestRecord.relation_id) : null
			await coupleRequestCollection.doc(requestId).update(buildRequestStatusUpdate(REQUEST_STATUS_CANCELLED, {
				uid,
				now
			}))
			if (relation && relation._id) {
				await coupleCollection.doc(relation._id).update({
					status: COUPLE_STATUS_CANCELLED,
					current_request_id: requestId,
					last_action_uid: uid,
					updated_at: now
				})
			}
			await createCoupleHistoryRecord({
				relation: Object.assign({}, relation || {}, {
					status: COUPLE_STATUS_CANCELLED,
					current_request_id: requestId
				}),
				request: Object.assign({}, requestRecord, {
					status: REQUEST_STATUS_CANCELLED,
					cancelled_at: now
				}),
				eventType: COUPLE_HISTORY_EVENT_REQUEST_CANCELLED,
				eventStatus: REQUEST_STATUS_CANCELLED,
				operatorUid: uid,
				partnerUid: requestRecord.receiver_uid || '',
				operatorSnapshot: requestRecord.requester_snapshot || {},
				partnerSnapshot: requestRecord.receiver_snapshot || {},
				createdAt: now,
				content: '已撤回情侣绑定请求'
			})

			return Object.assign({}, response, {
				errCode: 0,
				errMsg: '已撤回绑定请求',
				...(await buildCoupleCenterPayload(uid))
			})
		} catch (error) {
			return formatError(error, '撤回绑定请求失败')
		}
	},
	async unbindCouple(params = {}) {
		try {
			const { authResult, response } = await checkAuth(this)
			const uid = authResult.uid
			const relationId = String(params.relationId || '').trim()
			const activeRelation = relationId ? await getCoupleById(relationId) : await getActiveCoupleByUid(uid)

			if (!activeRelation || Number(activeRelation.status) !== COUPLE_STATUS_BOUND) {
				return {
					errCode: 'love-note-couple-not-found',
					errMsg: '当前没有可解绑的情侣关系'
				}
			}

			if (activeRelation.user_a_uid !== uid && activeRelation.user_b_uid !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你无权解绑这条关系'
				}
			}

			const now = Date.now()
			const [userARecord, userBRecord] = await Promise.all([
				getUserById(activeRelation.user_a_uid),
				getUserById(activeRelation.user_b_uid)
			])
			const userASnapshot = userARecord ? await buildUserSnapshot(userARecord) : activeRelation.user_a_snapshot || {}
			const userBSnapshot = userBRecord ? await buildUserSnapshot(userBRecord) : activeRelation.user_b_snapshot || {}
			await coupleCollection.doc(activeRelation._id).update({
				status: COUPLE_STATUS_UNBOUND,
				unbind_date: now,
				user_a_snapshot: userASnapshot,
				user_b_snapshot: userBSnapshot,
				last_action_uid: uid,
				updated_at: now
			})
			await createCoupleHistoryRecord({
				relation: Object.assign({}, activeRelation, {
					status: COUPLE_STATUS_UNBOUND,
					unbind_date: now,
					user_a_snapshot: userASnapshot,
					user_b_snapshot: userBSnapshot
				}),
				requestId: activeRelation.current_request_id || '',
				eventType: COUPLE_HISTORY_EVENT_RELATION_UNBOUND,
				eventStatus: COUPLE_STATUS_UNBOUND,
				operatorUid: uid,
				partnerUid: getRelationPartnerUid(uid, activeRelation),
				operatorSnapshot: activeRelation.user_a_uid === uid ? userASnapshot : userBSnapshot,
				partnerSnapshot: activeRelation.user_a_uid === uid ? userBSnapshot : userASnapshot,
				createdAt: now,
				content: '已解绑当前情侣关系'
			})

			return Object.assign({}, response, {
				errCode: 0,
				errMsg: '已解绑当前情侣关系',
				...(await buildCoupleCenterPayload(uid))
			})
		} catch (error) {
			return formatError(error, '解绑情侣关系失败')
		}
	},
	async logout() {
		try {
			const uniIdCo = callAdapter.cloudobject(this)
			return await uniIdCo.logout()
		} catch (error) {
			return formatError(error, '退出登录失败')
		}
	}
}
