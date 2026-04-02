'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { dailyPostCollection } = require('../lib/db')
const { getActiveCoupleByUid } = require('../lib/couple')
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

const ALLOWED_MEDIA_TYPES = new Set(['image', 'video'])
const MAX_CONTENT_LENGTH = 2000
const MAX_IMAGE_COUNT = 9
const MAX_VIDEO_COUNT = 1
const MAX_MEDIA_COUNT = 9

function parseMediaTypeInput(value = '') {
	const mediaType = String(value || '').trim().toLowerCase()
	return ALLOWED_MEDIA_TYPES.has(mediaType) ? mediaType : ''
}

function normalizeMimeTypeInput(value = '') {
	return String(value || '').trim().toLowerCase()
}

function buildMimeType(mediaType = '') {
	if (mediaType === 'image') {
		return 'image/jpeg'
	}
	if (mediaType === 'video') {
		return 'video/mp4'
	}
	return ''
}

function resolveMediaType({
	mediaType = '',
	mimeType = '',
	url = '',
	fileId = ''
} = {}) {
	return (
		parseMediaTypeInput(mediaType) ||
		getMediaTypeByMimeType(mimeType) ||
		getMediaTypeByPath(url) ||
		getMediaTypeByPath(fileId)
	)
}

function collectCloudFileIdsFromMediaList(mediaList = []) {
	const fileIds = []
	mediaList.forEach((item) => {
		if (!item || typeof item !== 'object') {
			return
		}

		const fileId = String(item.fileId || item.file_id || '').trim()
		const url = String(item.url || '').trim()
		const thumbnailUrl = String(item.thumbnailUrl || item.thumbnail_url || item.poster || '').trim()

		if (fileId && isCloudFileId(fileId)) {
			fileIds.push(fileId)
		}
		if (isCloudFileId(url)) {
			fileIds.push(url)
		}
		if (thumbnailUrl && isCloudFileId(thumbnailUrl)) {
			fileIds.push(thumbnailUrl)
		}
	})
	return fileIds
}

function collectCloudFileIdsFromPosts(postList = []) {
	const fileIds = []
	postList.forEach((post) => {
		if (!post || typeof post !== 'object') {
			return
		}

		const mediaList = Array.isArray(post.media_list) ? post.media_list : []
		mediaList.forEach((item) => {
			const fileId = String(item.file_id || '').trim()
			const mediaUrl = String(item.url || '').trim()
			const thumbnailUrl = String(item.thumbnail_url || '').trim()
			if (fileId && isCloudFileId(fileId)) {
				fileIds.push(fileId)
			}
			if (isCloudFileId(mediaUrl)) {
				fileIds.push(mediaUrl)
			}
			if (thumbnailUrl && isCloudFileId(thumbnailUrl)) {
				fileIds.push(thumbnailUrl)
			}
		})

		const authorSnapshot = post.author_snapshot && typeof post.author_snapshot === 'object' ? post.author_snapshot : {}
		const authorAvatarFileId = String(authorSnapshot.avatar_file_id || '').trim()
		if (authorAvatarFileId && isCloudFileId(authorAvatarFileId)) {
			fileIds.push(authorAvatarFileId)
		}
	})
	return fileIds
}

function normalizeMediaItem(item = {}, fileUrlMap = {}) {
	const fileId = String(item.file_id || '').trim()
	const rawMediaUrl = String(item.url || '').trim()
	let mediaUrl = ensureHttpsUrl(rawMediaUrl)

	if (!mediaUrl && fileId && fileUrlMap[fileId]) {
		mediaUrl = fileUrlMap[fileId]
	}
	if (!mediaUrl && isCloudFileId(rawMediaUrl)) {
		mediaUrl = fileUrlMap[rawMediaUrl] || ''
	}

	const rawThumbnailUrl = String(item.thumbnail_url || '').trim()
	let thumbnailUrl = ensureHttpsUrl(rawThumbnailUrl)
	if (!thumbnailUrl && rawThumbnailUrl && isCloudFileId(rawThumbnailUrl)) {
		thumbnailUrl = fileUrlMap[rawThumbnailUrl] || ''
	}

	const mediaType = resolveMediaType({
		mediaType: item.media_type,
		mimeType: item.mime_type,
		url: mediaUrl,
		fileId
	}) || 'image'

	if (!thumbnailUrl && mediaType === 'image') {
		thumbnailUrl = mediaUrl
	}

	return {
		url: mediaUrl,
		file_id: fileId,
		thumbnail_url: thumbnailUrl,
		media_type: mediaType,
		mime_type: normalizeMimeTypeInput(item.mime_type) || buildMimeType(mediaType),
		duration: Number(item.duration || 0),
		width: Number(item.width || 0),
		height: Number(item.height || 0),
		file_size: Number(item.file_size || 0)
	}
}

function normalizePostRecord(post = {}, fileUrlMap = {}, uid = '') {
	const authorSnapshot = post.author_snapshot && typeof post.author_snapshot === 'object'
		? post.author_snapshot
		: {}

	const avatarFileId = String(authorSnapshot.avatar_file_id || '').trim()
	let avatarUrl = ensureHttpsUrl(authorSnapshot.avatar_url || '')
	if (!avatarUrl && avatarFileId && fileUrlMap[avatarFileId]) {
		avatarUrl = fileUrlMap[avatarFileId]
	}

	const mediaList = Array.isArray(post.media_list) ? post.media_list : []

	return Object.assign({}, post, {
		author_snapshot: {
			nickname: String(authorSnapshot.nickname || '').trim() || DEFAULT_NICKNAME,
			avatar_url: avatarUrl,
			avatar_file_id: avatarFileId
		},
		media_list: mediaList.map((item) => normalizeMediaItem(item, fileUrlMap)),
		is_self: uid && String(post.author_uid || '') === uid
	})
}

async function buildAuthorSnapshot(uid = '') {
	const userRecord = uid ? await getUserById(uid) : null
	const avatar = userRecord ? await resolveAvatar(userRecord) : {
		avatarUrl: '',
		avatarFileId: ''
	}

	return {
		nickname: (userRecord && (userRecord.nickname || userRecord.username)) || DEFAULT_NICKNAME,
		avatar_url: ensureHttpsUrl(avatar.avatarUrl || ''),
		avatar_file_id: String(avatar.avatarFileId || '').trim()
	}
}

module.exports = class DailyService extends Service {
	async getList(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const page = Math.max(1, parseInt(params.page) || 1)
			const pageSize = Math.min(20, Math.max(1, parseInt(params.pageSize) || 10))

			const whereCondition = {
				couple_id: activeCouple._id,
				is_deleted: false
			}

			const totalRes = await dailyPostCollection.where(whereCondition).count()
			const total = Number(totalRes.total || 0)
			const listRes = await dailyPostCollection
				.where(whereCondition)
				.orderBy('create_time', 'desc')
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get()

			const rawList = Array.isArray(listRes.data) ? listRes.data : []
			const fileUrlMap = await getTempFileUrlMap(collectCloudFileIdsFromPosts(rawList))
			const list = rawList.map((item) => normalizePostRecord(item, fileUrlMap, uid))

			return {
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
			}
		} catch (error) {
			return formatError(error, '获取双人日常失败')
		}
	}

	async create(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const content = String(params.content || '').trim()
			if (content.length > MAX_CONTENT_LENGTH) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `文字内容不能超过 ${MAX_CONTENT_LENGTH} 个字符`
				}
			}

			const rawMediaInput = params.mediaList !== undefined ? params.mediaList : params.media_list
			const rawMediaList = Array.isArray(rawMediaInput) ? rawMediaInput : []
			if (!content && !rawMediaList.length) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '请填写内容或上传媒体后再发布'
				}
			}

			if (rawMediaList.length > MAX_MEDIA_COUNT) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `图片最多 ${MAX_IMAGE_COUNT} 张，视频最多 ${MAX_VIDEO_COUNT} 个`
				}
			}

			const uploadFileIds = collectCloudFileIdsFromMediaList(rawMediaList)
			const fileUrlMap = await getTempFileUrlMap(uploadFileIds)

			const mediaList = rawMediaList.map((item, index) => {
				const rawItem = item && typeof item === 'object' ? item : {}
				const rawFileId = String(rawItem.fileId || rawItem.file_id || '').trim()
				const rawMediaUrl = String(rawItem.url || '').trim()
				const fileId = rawFileId || (isCloudFileId(rawMediaUrl) ? rawMediaUrl : '')

				let mediaUrl = ensureHttpsUrl(rawMediaUrl)
				if (!mediaUrl && fileId && fileUrlMap[fileId]) {
					mediaUrl = fileUrlMap[fileId]
				}
				if (!mediaUrl && isCloudFileId(rawMediaUrl)) {
					mediaUrl = fileUrlMap[rawMediaUrl] || ''
				}
				if (!mediaUrl) {
					throw {
						errCode: 'love-note-media-url-invalid',
						errMsg: `第 ${index + 1} 个媒体链接无效，请重新上传`
					}
				}

				const mimeTypeInput = normalizeMimeTypeInput(rawItem.mimeType || rawItem.mime_type)
				const mediaType = resolveMediaType({
					mediaType: rawItem.mediaType || rawItem.media_type,
					mimeType: mimeTypeInput,
					url: mediaUrl,
					fileId
				})
				if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
					throw {
						errCode: 'love-note-media-type-invalid',
						errMsg: `第 ${index + 1} 个媒体格式不支持，仅允许图片或视频`
					}
				}

				const rawThumbnailUrl = String(rawItem.thumbnailUrl || rawItem.thumbnail_url || rawItem.poster || '').trim()
				let thumbnailUrl = ensureHttpsUrl(rawThumbnailUrl)
				if (!thumbnailUrl && rawThumbnailUrl && isCloudFileId(rawThumbnailUrl)) {
					thumbnailUrl = fileUrlMap[rawThumbnailUrl] || ''
				}
				if (!thumbnailUrl && mediaType === 'image') {
					thumbnailUrl = mediaUrl
				}

				return {
					url: mediaUrl,
					file_id: fileId,
					thumbnail_url: thumbnailUrl,
					media_type: mediaType,
					mime_type: mimeTypeInput || buildMimeType(mediaType),
					duration: Number(rawItem.duration || 0),
					width: Number(rawItem.width || 0),
					height: Number(rawItem.height || 0),
					file_size: Number(rawItem.fileSize || rawItem.file_size || 0)
				}
			})

			const imageCount = mediaList.filter((item) => item.media_type === 'image').length
			const videoCount = mediaList.filter((item) => item.media_type === 'video').length

			if (imageCount > MAX_IMAGE_COUNT) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `图片最多上传 ${MAX_IMAGE_COUNT} 张`
				}
			}

			if (videoCount > MAX_VIDEO_COUNT) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `视频最多上传 ${MAX_VIDEO_COUNT} 个`
				}
			}

			if (imageCount > 0 && videoCount > 0) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '一次发布不能同时上传图片和视频'
				}
			}

			const now = Date.now()
			const authorSnapshot = await buildAuthorSnapshot(uid)
			const postMediaType = videoCount > 0 ? 'video' : (imageCount > 0 ? 'image' : 'text')
			const postData = {
				couple_id: activeCouple._id,
				author_uid: uid,
				author_snapshot: authorSnapshot,
				content,
				media_type: postMediaType,
				media_count: mediaList.length,
				media_list: mediaList,
				like_count: 0,
				comment_count: 0,
				is_deleted: false,
				create_time: now,
				update_time: now
			}

			const result = await dailyPostCollection.add(postData)
			return {
				errCode: 0,
				data: {
					postId: result.id
				}
			}
		} catch (error) {
			return formatError(error, '发布双人日常失败')
		}
	}

	async delete(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const postId = String(params.postId || '').trim()
			if (!postId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '动态ID不能为空'
				}
			}

			const postRes = await dailyPostCollection
				.where({
					_id: postId,
					couple_id: activeCouple._id,
					is_deleted: false
				})
				.limit(1)
				.get()

			if (!postRes.data || postRes.data.length === 0) {
				return {
					errCode: 'love-note-post-not-found',
					errMsg: '动态不存在或无权访问'
				}
			}

			const post = postRes.data[0]
			if (String(post.author_uid || '') !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '仅发布者可以删除该动态'
				}
			}

			await dailyPostCollection.doc(postId).update({
				is_deleted: true,
				update_time: Date.now()
			})

			return {
				errCode: 0,
				data: {
					postId
				}
			}
		} catch (error) {
			return formatError(error, '删除双人日常失败')
		}
	}
}
