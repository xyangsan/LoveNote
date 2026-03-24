'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const userCollection = db.collection('uni-id-users')
const coupleCollection = db.collection('love-couples')
const uniIdCommon = require('uni-id-common')
const { callAdapter } = require('x-uni-id-co')

const DEFAULT_NICKNAME = '微信用户'
const DEFAULT_ROLE = 'member'
const COUPLE_STATUS_PENDING = 0
const COUPLE_STATUS_BOUND = 1
const COUPLE_STATUS_UNBOUND = 2
const COUPLE_STATUS_CLOSED = 3
const COUPLE_STATUS_CANCELLED = 4

const COUPLE_STATUS_TEXT = {
	[COUPLE_STATUS_PENDING]: '待确认',
	[COUPLE_STATUS_BOUND]: '已绑定',
	[COUPLE_STATUS_UNBOUND]: '已解绑',
	[COUPLE_STATUS_CLOSED]: '已关闭',
	[COUPLE_STATUS_CANCELLED]: '已取消'
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

function getRelationPartnerUid(uid, relation = {}) {
	if (!uid || !relation) {
		return ''
	}

	return relation.user_a_uid === uid ? relation.user_b_uid || '' : relation.user_a_uid || ''
}

function getRequesterUid(relation = {}) {
	return relation.created_by || relation.user_a_uid || ''
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

async function getSingleCoupleByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc' } = {}) {
	const coupleRes = await coupleCollection.where(condition).orderBy(orderField, orderDirection).limit(1).get()
	return coupleRes && coupleRes.data && coupleRes.data[0] ? coupleRes.data[0] : null
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

async function getLatestPendingCoupleByUid(uid) {
	if (!uid) {
		return null
	}

	try {
		return await getSingleCoupleByCondition(
			dbCmd.and([
				buildCoupleParticipantCondition(uid),
				{
					status: COUPLE_STATUS_PENDING
				}
			]),
			{
				orderField: 'created_at'
			}
		)
	} catch (error) {
		console.warn('getLatestPendingCoupleByUid failed', error)
		return null
	}
}

async function getCoupleByUid(uid) {
	const activeRelation = await getActiveCoupleByUid(uid)
	if (activeRelation) {
		return activeRelation
	}

	return getLatestPendingCoupleByUid(uid)
}

async function listCouplesByCondition(condition, { orderField = 'updated_at', orderDirection = 'desc', limit = 100 } = {}) {
	const coupleRes = await coupleCollection.where(condition).orderBy(orderField, orderDirection).limit(limit).get()
	return coupleRes && Array.isArray(coupleRes.data) ? coupleRes.data : []
}

async function getIncomingPendingCouples(uid) {
	if (!uid) {
		return []
	}

	try {
		return await listCouplesByCondition(
			dbCmd.and([
				{
					user_b_uid: uid
				},
				{
					status: COUPLE_STATUS_PENDING
				}
			]),
			{
				orderField: 'created_at',
				limit: 50
			}
		)
	} catch (error) {
		console.warn('getIncomingPendingCouples failed', error)
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
				{
					created_by: uid
				},
				{
					status: COUPLE_STATUS_PENDING
				}
			]),
			{
				orderField: 'created_at',
				limit: 20
			}
		)
	} catch (error) {
		console.warn('getOutgoingPendingCouples failed', error)
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
		console.warn('getCoupleHistoryByUid failed', error)
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
				{
					status: COUPLE_STATUS_PENDING
				},
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
		console.warn('getExistingPendingRelationBetween failed', error)
		return null
	}
}

async function closePendingCouplesForUsers(uidList = [], { excludeId = '', status = COUPLE_STATUS_CLOSED, actionUid = '' } = {}) {
	const uniqueUidList = Array.from(new Set(uidList.filter(Boolean)))
	if (!uniqueUidList.length) {
		return
	}

	const participantConditions = []
	uniqueUidList.forEach((uid) => {
		participantConditions.push({
			user_a_uid: uid
		})
		participantConditions.push({
			user_b_uid: uid
		})
	})

	const conditions = [
		{
			status: COUPLE_STATUS_PENDING
		},
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
		partnerRecord,
		partnerAvatar,
		partnerNickname
	}
}

async function formatCoupleInfo(uid, coupleRecord = null) {
	const relationRecord = coupleRecord || await getCoupleByUid(uid)
	if (!relationRecord) {
		return null
	}

	const { partnerUid, partnerAvatar, partnerNickname } = await getRelationPartnerMeta(uid, relationRecord)
	const status = Number(relationRecord.status || 0)
	const requesterUid = getRequesterUid(relationRecord)

	return {
		coupleId: relationRecord._id || '',
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
		bindDate: relationRecord.bind_date || relationRecord.created_at || 0,
		anniversaryDate: relationRecord.anniversary_date || 0,
		requestDate: relationRecord.created_at || 0
	}
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
				getOutgoingPendingCouples(uid),
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
			await coupleCollection.add({
				user_a_uid: uid,
				user_b_uid: targetUid,
				partner_nickname: targetUser.nickname || targetUser.username || DEFAULT_NICKNAME,
				status: COUPLE_STATUS_PENDING,
				created_by: uid,
				created_at: now,
				updated_at: now
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

			const relation = await getCoupleById(requestId)
			if (!relation || Number(relation.status) !== COUPLE_STATUS_PENDING) {
				return {
					errCode: 'love-note-request-not-found',
					errMsg: '该绑定请求不存在或已处理'
				}
			}

			if (relation.user_b_uid !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你无权处理这条绑定请求'
				}
			}

			const now = Date.now()
			if (action === 'reject') {
				await coupleCollection.doc(requestId).update({
					status: COUPLE_STATUS_CLOSED,
					last_action_uid: uid,
					updated_at: now
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

			const requesterUid = getRequesterUid(relation)
			const [selfActiveCouple, requesterActiveCouple] = await Promise.all([
				getActiveCoupleByUid(uid),
				getActiveCoupleByUid(requesterUid)
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

			await coupleCollection.doc(requestId).update({
				status: COUPLE_STATUS_BOUND,
				bind_date: now,
				last_action_uid: uid,
				updated_at: now
			})
			await closePendingCouplesForUsers([uid, requesterUid], {
				excludeId: requestId,
				status: COUPLE_STATUS_CLOSED,
				actionUid: uid
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

			const relation = await getCoupleById(requestId)
			if (!relation || Number(relation.status) !== COUPLE_STATUS_PENDING) {
				return {
					errCode: 'love-note-request-not-found',
					errMsg: '该绑定请求不存在或已处理'
				}
			}

			if (getRequesterUid(relation) !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你只能撤回自己发起的绑定请求'
				}
			}

			await coupleCollection.doc(requestId).update({
				status: COUPLE_STATUS_CANCELLED,
				last_action_uid: uid,
				updated_at: Date.now()
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

			await coupleCollection.doc(activeRelation._id).update({
				status: COUPLE_STATUS_UNBOUND,
				unbind_date: Date.now(),
				last_action_uid: uid,
				updated_at: Date.now()
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
