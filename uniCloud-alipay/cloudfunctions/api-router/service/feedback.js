'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { feedbackCollection } = require('../lib/db')
const { getUserById, resolveAvatar } = require('../lib/user-base')
const {
	ensureHttpsUrl,
	isCloudFileId,
	getMediaTypeByMimeType,
	getMediaTypeByPath,
	getTempFileUrlMap
} = require('../lib/media')
const { DEFAULT_NICKNAME } = require('../lib/constants')
const { formatError } = require('../lib/response')

const ADMIN_ROLE = 'admin'
const FEEDBACK_STATUS_PENDING = 0
const FEEDBACK_STATUS_REPLIED = 1
const FEEDBACK_STATUS_RESOLVED = 2
const ALLOWED_STATUS_SET = new Set([
	FEEDBACK_STATUS_PENDING,
	FEEDBACK_STATUS_REPLIED,
	FEEDBACK_STATUS_RESOLVED
])
const ALLOWED_CATEGORY_SET = new Set(['bug', 'feature', 'experience', 'other'])
const MAX_IMAGE_COUNT = 9
const MAX_CONTENT_LENGTH = 2000
const MAX_REPLY_LENGTH = 2000

const FEEDBACK_STATUS_TEXT_MAP = {
	[FEEDBACK_STATUS_PENDING]: '待处理',
	[FEEDBACK_STATUS_REPLIED]: '已回复',
	[FEEDBACK_STATUS_RESOLVED]: '已解决'
}

function parseStatusInput(value, { allowEmpty = false } = {}) {
	if (value === '' || value === undefined || value === null) {
		return allowEmpty ? null : Number.NaN
	}

	const status = Number(value)
	if (!Number.isInteger(status) || !ALLOWED_STATUS_SET.has(status)) {
		return Number.NaN
	}
	return status
}

function normalizeCategoryInput(value = '') {
	const category = String(value || '').trim().toLowerCase()
	return ALLOWED_CATEGORY_SET.has(category) ? category : ''
}

function normalizeMimeTypeInput(value = '') {
	return String(value || '').trim().toLowerCase()
}

function getStatusText(status) {
	return FEEDBACK_STATUS_TEXT_MAP[Number(status)] || FEEDBACK_STATUS_TEXT_MAP[FEEDBACK_STATUS_PENDING]
}

function isAdminRoleList(roleList = []) {
	return Array.isArray(roleList) && roleList.some((item) => String(item || '').trim().toLowerCase() === ADMIN_ROLE)
}

async function assertAdminByUid(uid = '') {
	const userRecord = await getUserById(uid)
	if (!userRecord) {
		throw {
			errCode: 'uni-id-account-not-exists',
			errMsg: '当前用户不存在'
		}
	}

	if (!isAdminRoleList(userRecord.role)) {
		throw {
			errCode: 'love-note-no-permission',
			errMsg: '仅管理员可执行该操作'
		}
	}

	return userRecord
}

function collectCloudFileIdsFromImageInput(imageList = []) {
	const fileIds = []
	imageList.forEach((item) => {
		if (!item || typeof item !== 'object') {
			return
		}

		const fileId = String(item.fileId || item.file_id || '').trim()
		const url = String(item.url || '').trim()
		if (fileId && isCloudFileId(fileId)) {
			fileIds.push(fileId)
		}
		if (isCloudFileId(url)) {
			fileIds.push(url)
		}
	})
	return fileIds
}

function collectCloudFileIdsFromFeedbackList(list = []) {
	const fileIds = []
	list.forEach((item) => {
		if (!item || typeof item !== 'object') {
			return
		}

		const userSnapshot = item.user_snapshot && typeof item.user_snapshot === 'object' ? item.user_snapshot : {}
		const avatarFileId = String(userSnapshot.avatar_file_id || '').trim()
		if (avatarFileId && isCloudFileId(avatarFileId)) {
			fileIds.push(avatarFileId)
		}

		const images = Array.isArray(item.image_list) ? item.image_list : []
		images.forEach((imageItem) => {
			if (!imageItem || typeof imageItem !== 'object') {
				return
			}
			const fileId = String(imageItem.file_id || '').trim()
			const url = String(imageItem.url || '').trim()
			if (fileId && isCloudFileId(fileId)) {
				fileIds.push(fileId)
			}
			if (isCloudFileId(url)) {
				fileIds.push(url)
			}
		})
	})
	return fileIds
}

function normalizeImageList(rawImageList = [], fileUrlMap = {}) {
	return rawImageList.map((item, index) => {
		const imageItem = item && typeof item === 'object' ? item : {}
		const rawFileId = String(imageItem.fileId || imageItem.file_id || '').trim()
		const rawUrl = String(imageItem.url || '').trim()
		const fileId = rawFileId || (isCloudFileId(rawUrl) ? rawUrl : '')

		let url = ensureHttpsUrl(rawUrl)
		if (!url && fileId && fileUrlMap[fileId]) {
			url = fileUrlMap[fileId]
		}
		if (!url && isCloudFileId(rawUrl)) {
			url = fileUrlMap[rawUrl] || ''
		}
		if (!url) {
			throw {
				errCode: 'love-note-feedback-image-invalid',
				errMsg: `第 ${index + 1} 张图片地址无效，请重新上传`
			}
		}

		const mimeType = normalizeMimeTypeInput(imageItem.mimeType || imageItem.mime_type)
		const mediaType = getMediaTypeByMimeType(mimeType) || getMediaTypeByPath(url) || getMediaTypeByPath(fileId)
		if (mediaType && mediaType !== 'image') {
			throw {
				errCode: 'love-note-feedback-image-invalid',
				errMsg: `第 ${index + 1} 个文件不是图片，请重新选择`
			}
		}

		return {
			url,
			file_id: fileId,
			mime_type: mimeType || 'image/jpeg',
			file_size: Number(imageItem.fileSize || imageItem.file_size || 0),
			width: Number(imageItem.width || 0),
			height: Number(imageItem.height || 0)
		}
	})
}

function normalizeFeedbackRecord(record = {}, fileUrlMap = {}) {
	const userSnapshot = record.user_snapshot && typeof record.user_snapshot === 'object' ? record.user_snapshot : {}
	const avatarFileId = String(userSnapshot.avatar_file_id || '').trim()
	let avatarUrl = ensureHttpsUrl(userSnapshot.avatar_url || '')
	if (!avatarUrl && avatarFileId) {
		avatarUrl = fileUrlMap[avatarFileId] || ''
	}

	const rawImageList = Array.isArray(record.image_list) ? record.image_list : []
	const imageList = rawImageList.map((item) => {
		const imageItem = item && typeof item === 'object' ? item : {}
		const fileId = String(imageItem.file_id || '').trim()
		const rawUrl = String(imageItem.url || '').trim()
		let url = ensureHttpsUrl(rawUrl)
		if (!url && fileId) {
			url = fileUrlMap[fileId] || ''
		}
		if (!url && isCloudFileId(rawUrl)) {
			url = fileUrlMap[rawUrl] || ''
		}
		return {
			url,
			file_id: fileId,
			mime_type: normalizeMimeTypeInput(imageItem.mime_type) || 'image/jpeg',
			file_size: Number(imageItem.file_size || 0),
			width: Number(imageItem.width || 0),
			height: Number(imageItem.height || 0)
		}
	})

	return Object.assign({}, record, {
		status: Number(record.status || FEEDBACK_STATUS_PENDING),
		status_text: getStatusText(record.status),
		user_snapshot: {
			uid: String(userSnapshot.uid || '').trim(),
			nickname: String(userSnapshot.nickname || '').trim() || DEFAULT_NICKNAME,
			avatar_url: avatarUrl,
			avatar_file_id: avatarFileId
		},
		image_list: imageList
	})
}

async function buildFeedbackUserSnapshot(uid = '', userRecord = null) {
	const currentUserRecord = userRecord || await getUserById(uid)
	const avatar = currentUserRecord ? await resolveAvatar(currentUserRecord) : {
		avatarUrl: '',
		avatarFileId: ''
	}

	return {
		uid,
		nickname: (currentUserRecord && (currentUserRecord.nickname || currentUserRecord.username)) || DEFAULT_NICKNAME,
		avatar_url: ensureHttpsUrl(avatar.avatarUrl || ''),
		avatar_file_id: String(avatar.avatarFileId || '').trim()
	}
}

async function getFeedbackById(feedbackId = '') {
	if (!feedbackId) {
		return null
	}
	const result = await feedbackCollection.where({
		_id: feedbackId,
		is_deleted: false
	}).limit(1).get()
	return result && Array.isArray(result.data) && result.data[0] ? result.data[0] : null
}

module.exports = class FeedbackService extends Service {
	async create(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const userRecord = await getUserById(uid)
			if (!userRecord) {
				return {
					errCode: 'uni-id-account-not-exists',
					errMsg: '当前用户不存在'
				}
			}

			const category = normalizeCategoryInput(params.category)
			if (!category) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '请选择反馈分类'
				}
			}

			const content = String(params.content || '').trim()
			if (!content) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '请填写反馈内容'
				}
			}
			if (content.length > MAX_CONTENT_LENGTH) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `反馈内容不能超过 ${MAX_CONTENT_LENGTH} 个字符`
				}
			}

			const rawImageInput = params.imageList !== undefined ? params.imageList : params.image_list
			const rawImageList = Array.isArray(rawImageInput) ? rawImageInput : []
			if (rawImageList.length > MAX_IMAGE_COUNT) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `反馈图片最多上传 ${MAX_IMAGE_COUNT} 张`
				}
			}

			const fileIds = collectCloudFileIdsFromImageInput(rawImageList)
			const fileUrlMap = await getTempFileUrlMap(fileIds)
			const imageList = normalizeImageList(rawImageList, fileUrlMap)
			const now = Date.now()

			const feedbackData = {
				user_uid: uid,
				user_snapshot: await buildFeedbackUserSnapshot(uid, userRecord),
				category,
				content,
				image_count: imageList.length,
				image_list: imageList,
				status: FEEDBACK_STATUS_PENDING,
				admin_reply: '',
				reply_uid: '',
				reply_time: 0,
				resolved_time: 0,
				is_deleted: false,
				create_time: now,
				update_time: now
			}

			const result = await feedbackCollection.add(feedbackData)
			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '反馈已提交',
				data: {
					feedbackId: result.id
				}
			})
		} catch (error) {
			return formatError(error, '提交反馈失败')
		}
	}

	async getList(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			await assertAdminByUid(uid)

			const page = Math.max(1, parseInt(params.page, 10) || 1)
			const pageSize = Math.min(30, Math.max(1, parseInt(params.pageSize, 10) || 10))
			const status = parseStatusInput(params.status, {
				allowEmpty: true
			})
			if (Number.isNaN(status)) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '反馈状态参数不合法'
				}
			}

			const whereCondition = {
				is_deleted: false
			}
			if (status !== null) {
				whereCondition.status = status
			}

			const totalRes = await feedbackCollection.where(whereCondition).count()
			const total = Number(totalRes.total || 0)

			const listRes = await feedbackCollection
				.where(whereCondition)
				.orderBy('create_time', 'desc')
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get()
			const rawList = Array.isArray(listRes.data) ? listRes.data : []
			const fileUrlMap = await getTempFileUrlMap(collectCloudFileIdsFromFeedbackList(rawList))
			const list = rawList.map((item) => normalizeFeedbackRecord(item, fileUrlMap))

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: {
					list,
					pagination: {
						page,
						pageSize,
						total,
						hasMore: page * pageSize < total
					}
				}
			})
		} catch (error) {
			return formatError(error, '获取反馈列表失败')
		}
	}

	async getDetail(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			await assertAdminByUid(uid)

			const feedbackId = String(params.feedbackId || '').trim()
			if (!feedbackId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '反馈ID不能为空'
				}
			}

			const feedbackRecord = await getFeedbackById(feedbackId)
			if (!feedbackRecord) {
				return {
					errCode: 'love-note-feedback-not-found',
					errMsg: '反馈不存在或已删除'
				}
			}

			const fileUrlMap = await getTempFileUrlMap(collectCloudFileIdsFromFeedbackList([feedbackRecord]))
			const detail = normalizeFeedbackRecord(feedbackRecord, fileUrlMap)

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: {
					detail
				}
			})
		} catch (error) {
			return formatError(error, '获取反馈详情失败')
		}
	}

	async reply(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			await assertAdminByUid(uid)

			const feedbackId = String(params.feedbackId || '').trim()
			if (!feedbackId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '反馈ID不能为空'
				}
			}

			const replyContent = String(params.replyContent || params.reply_content || '').trim()
			if (!replyContent) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '请填写回复内容'
				}
			}
			if (replyContent.length > MAX_REPLY_LENGTH) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `回复内容不能超过 ${MAX_REPLY_LENGTH} 个字符`
				}
			}

			const status = params.status === undefined || params.status === null || params.status === ''
				? FEEDBACK_STATUS_REPLIED
				: parseStatusInput(params.status)
			if (Number.isNaN(status)) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '反馈状态参数不合法'
				}
			}

			const feedbackRecord = await getFeedbackById(feedbackId)
			if (!feedbackRecord) {
				return {
					errCode: 'love-note-feedback-not-found',
					errMsg: '反馈不存在或已删除'
				}
			}

			const now = Date.now()
			const updateData = {
				admin_reply: replyContent,
				reply_uid: uid,
				reply_time: now,
				status,
				update_time: now
			}
			if (status === FEEDBACK_STATUS_RESOLVED) {
				updateData.resolved_time = now
			}

			await feedbackCollection.doc(feedbackId).update(updateData)
			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '回复已提交',
				data: {
					feedbackId,
					status
				}
			})
		} catch (error) {
			return formatError(error, '回复反馈失败')
		}
	}

	async updateStatus(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			await assertAdminByUid(uid)

			const feedbackId = String(params.feedbackId || '').trim()
			if (!feedbackId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '反馈ID不能为空'
				}
			}

			const status = parseStatusInput(params.status)
			if (Number.isNaN(status)) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '反馈状态参数不合法'
				}
			}

			const feedbackRecord = await getFeedbackById(feedbackId)
			if (!feedbackRecord) {
				return {
					errCode: 'love-note-feedback-not-found',
					errMsg: '反馈不存在或已删除'
				}
			}

			const now = Date.now()
			const updateData = {
				status,
				update_time: now
			}
			if (status === FEEDBACK_STATUS_RESOLVED) {
				updateData.resolved_time = now
			}

			await feedbackCollection.doc(feedbackId).update(updateData)
			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '状态已更新',
				data: {
					feedbackId,
					status
				}
			})
		} catch (error) {
			return formatError(error, '更新反馈状态失败')
		}
	}
}
