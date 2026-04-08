'use strict'

const { dbCmd, userCollection } = require('./db')
const { DEFAULT_NICKNAME } = require('./constants')
const { getFileExtname, getFileName, getUserById, resolveAvatar } = require('./user-base')

function padDateUnit(value) {
	return `${value}`.padStart(2, '0')
}

function getTodayDateString() {
	const today = new Date()
	return `${today.getFullYear()}-${padDateUnit(today.getMonth() + 1)}-${padDateUnit(today.getDate())}`
}

function isValidBirthday(value = '') {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false
	}

	const date = new Date(`${value}T00:00:00`)
	if (Number.isNaN(date.getTime())) {
		return false
	}

	return `${date.getFullYear()}-${padDateUnit(date.getMonth() + 1)}-${padDateUnit(date.getDate())}` === value
}

async function resolveMomentsCover(record = {}) {
	const momentsCoverFileId = String(record.moments_cover_file_id || '').trim()
	const momentsCoverUrl = String(record.moments_cover_url || '').trim()

	if (momentsCoverFileId) {
		if (/^https?:\/\//i.test(momentsCoverFileId)) {
			return {
				momentsCoverFileId: '',
				momentsCoverUrl: momentsCoverFileId
			}
		}

		try {
			const tempFileRes = await uniCloud.getTempFileURL({
				fileList: [momentsCoverFileId]
			})
			const fileItem = tempFileRes && Array.isArray(tempFileRes.fileList) ? tempFileRes.fileList[0] : null
			const tempFileUrl = String((fileItem && (fileItem.tempFileURL || fileItem.tempFileUrl || fileItem.url || fileItem.download_url)) || '').trim()
			if (tempFileUrl) {
				return {
					momentsCoverFileId,
					momentsCoverUrl: tempFileUrl
				}
			}
		} catch (error) {
			console.warn('resolveMomentsCover failed', error)
		}

		return {
			momentsCoverFileId,
			momentsCoverUrl: momentsCoverUrl || momentsCoverFileId
		}
	}

	return {
		momentsCoverFileId: '',
		momentsCoverUrl
	}
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
	const momentsCoverFileId = typeof params.momentsCoverFileId === 'string' ? params.momentsCoverFileId.trim() : ''
	const momentsCoverUrl = typeof params.momentsCoverUrl === 'string' ? params.momentsCoverUrl.trim() : ''

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

	if (params.momentsCoverFileId !== undefined || params.momentsCoverUrl !== undefined) {
		if (momentsCoverFileId) {
			updateData.moments_cover_file_id = momentsCoverFileId
			updateData.moments_cover_url = momentsCoverUrl || momentsCoverFileId
		} else if (momentsCoverUrl) {
			updateData.moments_cover_url = momentsCoverUrl
			updateData.moments_cover_file_id = dbCmd.remove()
		} else {
			updateData.moments_cover_url = dbCmd.remove()
			updateData.moments_cover_file_id = dbCmd.remove()
		}
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

async function formatUserInfo(record = {}) {
	const { buildCoupleSummary } = require('./couple')
	const { avatarFileId, avatarUrl } = await resolveAvatar(record)
	const { momentsCoverFileId, momentsCoverUrl } = await resolveMomentsCover(record)
	const coupleInfo = record._id ? await buildCoupleSummary(record._id) : null

	return {
		_id: record._id || '',
		nickname: record.nickname || record.username || DEFAULT_NICKNAME,
		avatarUrl,
		avatarFileId,
		momentsCoverUrl,
		momentsCoverFileId,
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

module.exports = {
	isValidBirthday,
	getTodayDateString,
	buildProfileUpdateData,
	updateUserProfile,
	formatUserInfo
}
