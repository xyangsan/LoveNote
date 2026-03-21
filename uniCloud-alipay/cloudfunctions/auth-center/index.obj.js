'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const userCollection = db.collection('uni-id-users')
const uniIdCommon = require('uni-id-common')
const { callAdapter } = require('x-uni-id-co')

const DEFAULT_NICKNAME = '微信用户'
const DEFAULT_ROLE = 'member'

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

async function getUserById(uid) {
	const getUserRes = await userCollection.doc(uid).get()
	return getUserRes && getUserRes.data && getUserRes.data[0] ? getUserRes.data[0] : null
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

async function formatUserInfo(record = {}) {
	const { avatarFileId, avatarUrl } = await resolveAvatar(record)

	return {
		_id: record._id || '',
		nickname: record.nickname || record.username || DEFAULT_NICKNAME,
		avatarUrl,
		avatarFileId,
		gender: Number(record.gender || 0),
		role: Array.isArray(record.role) ? record.role : [],
		status: typeof record.status === 'number' ? record.status : 0,
		wxUnionid: record.wx_unionid || '',
		registerDate: record.register_date || 0,
		lastLoginDate: record.last_login_date || 0
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

			if (params.nickname !== undefined || params.gender !== undefined || params.avatarFileId || params.avatarUrl) {
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
	async logout() {
		try {
			const uniIdCo = callAdapter.cloudobject(this)
			return await uniIdCo.logout()
		} catch (error) {
			return formatError(error, '退出登录失败')
		}
	}
}
