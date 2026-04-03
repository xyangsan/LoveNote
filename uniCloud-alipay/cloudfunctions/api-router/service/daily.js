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
const MAX_LOCATION_NAME_LENGTH = 80
const MAX_LOCATION_ADDRESS_LENGTH = 200
const MAX_COMMENT_LENGTH = 500
const MAX_COMMENT_COUNT = 300

function parseMediaTypeInput(value = '') {
	const mediaType = String(value || '').trim().toLowerCase()
	return ALLOWED_MEDIA_TYPES.has(mediaType) ? mediaType : ''
}

function normalizeMimeTypeInput(value = '') {
	return String(value || '').trim().toLowerCase()
}

function normalizeCommentText(value = '', maxLength = MAX_COMMENT_LENGTH) {
	const text = String(value || '').trim()
	if (!text) {
		return ''
	}
	return text.length > maxLength ? text.slice(0, maxLength) : text
}

function createRecordId(prefix = 'id') {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeUidList(uidList = []) {
	if (!Array.isArray(uidList)) {
		return []
	}
	return Array.from(
		new Set(
			uidList
				.map((item) => String(item || '').trim())
				.filter(Boolean)
		)
	)
}

function normalizeLocationText(value = '', maxLength = 80) {
	const text = String(value || '').trim()
	if (!text) {
		return ''
	}
	return text.length > maxLength ? text.slice(0, maxLength) : text
}

function hasInputValue(value) {
	if (value === undefined || value === null) {
		return false
	}
	if (typeof value === 'number') {
		return !Number.isNaN(value)
	}
	return String(value).trim() !== ''
}

function parseCoordinate(value, min, max) {
	const num = Number(value)
	if (Number.isNaN(num) || num < min || num > max) {
		return null
	}
	return num
}

function normalizeLocationInput(params = {}) {
	const rawLocation = params.location && typeof params.location === 'object' ? params.location : {}
	const name = normalizeLocationText(
		rawLocation.name !== undefined ? rawLocation.name : (params.locationName !== undefined ? params.locationName : params.location_name),
		MAX_LOCATION_NAME_LENGTH
	)
	const address = normalizeLocationText(
		rawLocation.address !== undefined ? rawLocation.address : (params.locationAddress !== undefined ? params.locationAddress : params.location_address),
		MAX_LOCATION_ADDRESS_LENGTH
	)

	const rawLatitude = rawLocation.latitude !== undefined ? rawLocation.latitude : params.latitude
	const rawLongitude = rawLocation.longitude !== undefined ? rawLocation.longitude : params.longitude
	const hasLatitudeInput = hasInputValue(rawLatitude)
	const hasLongitudeInput = hasInputValue(rawLongitude)
	const latitude = hasLatitudeInput ? parseCoordinate(rawLatitude, -90, 90) : null
	const longitude = hasLongitudeInput ? parseCoordinate(rawLongitude, -180, 180) : null

	if (hasLatitudeInput || hasLongitudeInput) {
		if (latitude === null || longitude === null) {
			throw {
				errCode: 'love-note-location-invalid',
				errMsg: '位置信息格式不正确，请重新选择位置'
			}
		}
	}

	if (!name && !address && latitude === null && longitude === null) {
		return null
	}

	return {
		name,
		address,
		latitude,
		longitude
	}
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

		const commentList = Array.isArray(post.comment_list) ? post.comment_list : []
		commentList.forEach((comment) => {
			const avatarFileId = String(comment && comment.avatar_file_id || '').trim()
			const avatarUrl = String(comment && comment.avatar_url || '').trim()
			if (avatarFileId && isCloudFileId(avatarFileId)) {
				fileIds.push(avatarFileId)
			}
			if (avatarUrl && isCloudFileId(avatarUrl)) {
				fileIds.push(avatarUrl)
			}
		})
	})
	return fileIds
}

function normalizeCommentRecord(comment = {}, fileUrlMap = {}) {
	const avatarFileId = String(comment.avatar_file_id || '').trim()
	const rawAvatarUrl = String(comment.avatar_url || '').trim()
	let avatarUrl = ensureHttpsUrl(rawAvatarUrl)
	if (!avatarUrl && avatarFileId && fileUrlMap[avatarFileId]) {
		avatarUrl = fileUrlMap[avatarFileId]
	}
	if (!avatarUrl && rawAvatarUrl && isCloudFileId(rawAvatarUrl)) {
		avatarUrl = fileUrlMap[rawAvatarUrl] || ''
	}

	return {
		comment_id: String(comment.comment_id || '').trim(),
		uid: String(comment.uid || '').trim(),
		nickname: String(comment.nickname || '').trim() || DEFAULT_NICKNAME,
		avatar_url: avatarUrl,
		avatar_file_id: avatarFileId,
		content: normalizeCommentText(comment.content || ''),
		create_time: Number(comment.create_time || 0),
		reply_to_comment_id: String(comment.reply_to_comment_id || '').trim(),
		reply_to_uid: String(comment.reply_to_uid || '').trim(),
		reply_to_nickname: String(comment.reply_to_nickname || '').trim()
	}
}

function normalizeCommentList(commentList = [], fileUrlMap = {}) {
	if (!Array.isArray(commentList)) {
		return []
	}
	return commentList
		.map((item) => normalizeCommentRecord(item, fileUrlMap))
		.filter((item) => item.comment_id && item.content)
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
	const likeUidList = normalizeUidList(post.like_uid_list)
	const commentList = normalizeCommentList(post.comment_list, fileUrlMap)
	const rawLocation = post.location && typeof post.location === 'object' ? post.location : {}
	const locationName = normalizeLocationText(rawLocation.name || '', MAX_LOCATION_NAME_LENGTH)
	const locationAddress = normalizeLocationText(rawLocation.address || '', MAX_LOCATION_ADDRESS_LENGTH)
	const latitude = parseCoordinate(rawLocation.latitude, -90, 90)
	const longitude = parseCoordinate(rawLocation.longitude, -180, 180)

	return Object.assign({}, post, {
		author_snapshot: {
			nickname: String(authorSnapshot.nickname || '').trim() || DEFAULT_NICKNAME,
			avatar_url: avatarUrl,
			avatar_file_id: avatarFileId
		},
		media_list: mediaList.map((item) => normalizeMediaItem(item, fileUrlMap)),
		like_count: Number(post.like_count || likeUidList.length || 0),
		comment_count: Number(post.comment_count || commentList.length || 0),
		comment_list: commentList,
		location: {
			name: locationName,
			address: locationAddress,
			latitude,
			longitude
		},
		is_liked: uid ? likeUidList.includes(String(uid)) : false,
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

async function getPostRecord(postId = '', coupleId = '') {
	if (!postId || !coupleId) {
		return null
	}
	const postRes = await dailyPostCollection
		.where({
			_id: postId,
			couple_id: coupleId,
			is_deleted: false
		})
		.limit(1)
		.get()
	return postRes && Array.isArray(postRes.data) && postRes.data[0]
		? postRes.data[0]
		: null
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
			const location = normalizeLocationInput(params) || {
				name: '',
				address: '',
				latitude: null,
				longitude: null
			}
			const postData = {
				couple_id: activeCouple._id,
				author_uid: uid,
				author_snapshot: authorSnapshot,
				content,
				media_type: postMediaType,
				media_count: mediaList.length,
				media_list: mediaList,
				location,
				like_uid_list: [],
				like_count: 0,
				comment_list: [],
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

	async toggleLike(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = String(authState.authResult.uid || '').trim()
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

			const post = await getPostRecord(postId, activeCouple._id)
			if (!post) {
				return {
					errCode: 'love-note-post-not-found',
					errMsg: '动态不存在或无权访问'
				}
			}

			const action = String(params.action || '').trim().toLowerCase()
			let likeUidList = normalizeUidList(post.like_uid_list)
			const likedBefore = likeUidList.includes(uid)

			if (action === 'like') {
				if (!likedBefore) {
					likeUidList.push(uid)
				}
			} else if (action === 'unlike') {
				likeUidList = likeUidList.filter((item) => item !== uid)
			} else if (likedBefore) {
				likeUidList = likeUidList.filter((item) => item !== uid)
			} else {
				likeUidList.push(uid)
			}

			likeUidList = normalizeUidList(likeUidList)
			const now = Date.now()
			const likeCount = likeUidList.length
			const isLiked = likeUidList.includes(uid)

			await dailyPostCollection.doc(postId).update({
				like_uid_list: likeUidList,
				like_count: likeCount,
				update_time: now
			})

			return {
				errCode: 0,
				data: {
					postId,
					like_count: likeCount,
					is_liked: isLiked
				}
			}
		} catch (error) {
			return formatError(error, '更新点赞状态失败')
		}
	}

	async addComment(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = String(authState.authResult.uid || '').trim()
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

			const content = normalizeCommentText(params.content || '')
			if (!content) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '评论内容不能为空'
				}
			}
			if (String(params.content || '').trim().length > MAX_COMMENT_LENGTH) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: `评论内容不能超过 ${MAX_COMMENT_LENGTH} 个字符`
				}
			}

			const post = await getPostRecord(postId, activeCouple._id)
			if (!post) {
				return {
					errCode: 'love-note-post-not-found',
					errMsg: '动态不存在或无权访问'
				}
			}

			const commentList = normalizeCommentList(post.comment_list || [])
			if (commentList.length >= MAX_COMMENT_COUNT) {
				return {
					errCode: 'love-note-comment-limit',
					errMsg: `单条动态最多支持 ${MAX_COMMENT_COUNT} 条评论`
				}
			}

			const replyToCommentId = String(params.replyToCommentId || params.reply_to_comment_id || '').trim()
			let replyToUid = ''
			let replyToNickname = ''
			if (replyToCommentId) {
				const target = commentList.find((item) => item.comment_id === replyToCommentId)
				if (!target) {
					return {
						errCode: 'love-note-comment-reply-target-not-found',
						errMsg: '回复目标不存在，请刷新后重试'
					}
				}
				replyToUid = String(target.uid || '').trim()
				replyToNickname = String(target.nickname || '').trim() || DEFAULT_NICKNAME
			}

			const authorSnapshot = await buildAuthorSnapshot(uid)
			const now = Date.now()
			const commentRecord = {
				comment_id: createRecordId('comment'),
				uid,
				nickname: String(authorSnapshot.nickname || '').trim() || DEFAULT_NICKNAME,
				avatar_url: String(authorSnapshot.avatar_url || '').trim(),
				avatar_file_id: String(authorSnapshot.avatar_file_id || '').trim(),
				content,
				create_time: now,
				reply_to_comment_id: replyToCommentId,
				reply_to_uid: replyToUid,
				reply_to_nickname: replyToNickname
			}

			commentList.push(commentRecord)
			const nextCommentCount = commentList.length
			await dailyPostCollection.doc(postId).update({
				comment_list: commentList,
				comment_count: nextCommentCount,
				update_time: now
			})

			return {
				errCode: 0,
				data: {
					postId,
					comment_count: nextCommentCount,
					comment: normalizeCommentRecord(commentRecord)
				}
			}
		} catch (error) {
			return formatError(error, '发表评论失败')
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
