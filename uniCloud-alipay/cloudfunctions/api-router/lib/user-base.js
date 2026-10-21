'use strict'

const { userCollection } = require('./db')

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
	const result = await userCollection.doc(uid).get()
	return result && result.data && result.data[0] ? result.data[0] : null
}

// 历史脏数据兜底：老逻辑可能把 `http(s)://tmp/xxx.jpeg`（小程序 chooseAvatar 临时路径）
// 直接存进了 avatar。这种地址是某台设备的临时文件，读出来只会是破图 → 当成没有头像。
function isTempLikeUrl(value = '') {
	const raw = String(value || '').trim()
	if (!raw) {
		return false
	}
	if (/^cloud:\/\//i.test(raw) || /^data:/i.test(raw)) {
		return false
	}
	if (/^(wxfile|blob|file|filesystem|content|absolute|ms-appx):/i.test(raw)) {
		return true
	}
	const httpMatch = raw.match(/^https?:\/\/([^/?#:]+)/i)
	if (httpMatch) {
		return !httpMatch[1].includes('.')
	}
	return true
}

async function resolveAvatar(record = {}) {
	const avatarFileId = record.avatar_file_id || (record.avatar_file && record.avatar_file.url) || ''

	if (avatarFileId) {
		if (/^https?:\/\//.test(avatarFileId)) {
			return {
				avatarFileId: '',
				avatarUrl: isTempLikeUrl(avatarFileId) ? '' : avatarFileId
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
			console.warn('api-router resolveAvatar failed', error)
		}

		return {
			avatarFileId,
			avatarUrl: record.avatar || avatarFileId
		}
	}

	if (record.avatar && /^https?:\/\//.test(record.avatar)) {
		return {
			avatarFileId: '',
			avatarUrl: isTempLikeUrl(record.avatar) ? '' : record.avatar
		}
	}

	return {
		avatarFileId: '',
		avatarUrl: isTempLikeUrl(record.avatar) ? '' : (record.avatar || '')
	}
}

module.exports = {
	getFileExtname,
	getFileName,
	getUserById,
	resolveAvatar
}
