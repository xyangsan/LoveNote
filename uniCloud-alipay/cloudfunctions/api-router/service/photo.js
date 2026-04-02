'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { albumCollection, photoCollection, dbCmd, database } = require('../lib/db')
const { getActiveCoupleByUid } = require('../lib/couple')
const { getUserById } = require('../lib/user-base')
const {
	ensureHttpsUrl,
	isCloudFileId,
	getMediaTypeByMimeType,
	getMediaTypeByPath,
	collectFileIdsFromPhotos,
	getTempFileUrlMap,
	normalizePhotoList,
	normalizePhotoRecord
} = require('../lib/media')
const { formatError } = require('../lib/response')

const ALLOWED_MEDIA_TYPES = new Set(['image', 'video'])

function getAlbumCoverUrl(album = {}) {
	return ensureHttpsUrl((album.cover_image && album.cover_image.url) || album.cover_url || '')
}

function parseBooleanInput(value) {
	if (typeof value === 'boolean') {
		return value
	}

	if (typeof value === 'string') {
		const normalizedValue = value.trim().toLowerCase()
		if (normalizedValue === 'true' || normalizedValue === '1') {
			return true
		}
		if (normalizedValue === 'false' || normalizedValue === '0') {
			return false
		}
	}

	if (typeof value === 'number') {
		if (value === 1) {
			return true
		}
		if (value === 0) {
			return false
		}
	}

	return undefined
}

function parseMediaTypeInput(value = '') {
	const mediaType = String(value || '').trim().toLowerCase()
	return ALLOWED_MEDIA_TYPES.has(mediaType) ? mediaType : ''
}

function normalizeMimeTypeInput(value = '') {
	return String(value || '').trim().toLowerCase()
}

function buildMimeType(mediaType = '', fallbackUrl = '') {
	const currentType = parseMediaTypeInput(mediaType)
	if (!currentType) {
		return ''
	}

	if (currentType === 'image') {
		const extType = getMediaTypeByPath(fallbackUrl)
		if (extType === 'image') {
			const ext = String(fallbackUrl || '').split('?')[0].split('.').pop().toLowerCase()
			if (ext === 'jpg' || ext === 'jpeg') {
				return 'image/jpeg'
			}
			return `image/${ext}`
		}
		return 'image/jpeg'
	}

	if (currentType === 'video') {
		const extType = getMediaTypeByPath(fallbackUrl)
		if (extType === 'video') {
			const ext = String(fallbackUrl || '').split('?')[0].split('.').pop().toLowerCase()
			if (ext) {
				return `video/${ext}`
			}
		}
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

function buildAlbumCoverByPhoto(photo = {}) {
	const mediaType = parseMediaTypeInput(photo.media_type) || getMediaTypeByMimeType(photo.mime_type) || getMediaTypeByPath(photo.url)
	if (mediaType !== 'image') {
		return null
	}

	const coverUrl = ensureHttpsUrl(photo.url || '')
	if (!coverUrl) {
		return null
	}

	return {
		cover_url: coverUrl,
		cover_image: {
			url: coverUrl,
			file_id: photo.file_id || ''
		}
	}
}

async function findLatestImageInAlbum(transaction, albumId = '') {
	const result = await transaction.collection('love-photos')
		.where({ album_id: albumId })
		.orderBy('create_time', 'desc')
		.limit(50)
		.get()

	const list = Array.isArray(result && result.data) ? result.data : []
	return list.find((item) => {
		const mediaType = parseMediaTypeInput(item.media_type) || getMediaTypeByMimeType(item.mime_type) || getMediaTypeByPath(item.url)
		return mediaType === 'image'
	}) || null
}

module.exports = class PhotoService extends Service {
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
			const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize) || 20))

			const whereCondition = {
				couple_id: activeCouple._id
			}

			if (params.albumId) {
				whereCondition.album_id = params.albumId
			}

			const isFavorite = parseBooleanInput(params.isFavorite)
			if (isFavorite !== undefined) {
				whereCondition.is_favorite = isFavorite
			}

			const mediaType = parseMediaTypeInput(params.mediaType || params.media_type)
			if (mediaType) {
				whereCondition.media_type = mediaType
			}

			const totalRes = await photoCollection.where(whereCondition).count()
			const total = totalRes.total || 0

			const listRes = await photoCollection
				.where(whereCondition)
				.orderBy('create_time', 'desc')
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get()
			const rawList = listRes.data || []
			const fileUrlMap = await getTempFileUrlMap(collectFileIdsFromPhotos(rawList))
			const list = normalizePhotoList(rawList, fileUrlMap)

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
			return formatError(error, '获取照片列表失败')
		}
	}

	async getDetail(params = {}) {
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

			const photoId = String(params.photoId || '').trim()
			if (!photoId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '照片ID不能为空'
				}
			}

			const photoRes = await photoCollection
				.where({
					_id: photoId,
					couple_id: activeCouple._id
				})
				.limit(1)
				.get()

			if (!photoRes.data || photoRes.data.length === 0) {
				return {
					errCode: 'love-note-photo-not-found',
					errMsg: '照片不存在或无权访问'
				}
			}
			const rawPhoto = photoRes.data[0]
			const fileUrlMap = await getTempFileUrlMap(collectFileIdsFromPhotos([rawPhoto]))
			const photo = normalizePhotoRecord(rawPhoto, fileUrlMap)

			return {
				errCode: 0,
				data: {
					photo
				}
			}
		} catch (error) {
			return formatError(error, '获取照片详情失败')
		}
	}

	async upload(params = {}) {
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

			const albumId = String(params.albumId || '').trim()
			if (!albumId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '相册ID不能为空'
				}
			}

			const albumRes = await albumCollection
				.where({
					_id: albumId,
					couple_id: activeCouple._id
				})
				.limit(1)
				.get()

			if (!albumRes.data || albumRes.data.length === 0) {
				return {
					errCode: 'love-note-album-not-found',
					errMsg: '相册不存在或无权访问'
				}
			}

			const photos = params.photos || []
			if (!Array.isArray(photos) || photos.length === 0) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '媒体数据不能为空'
				}
			}

			if (photos.length > 20) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '单次上传媒体数量不能超过20个'
				}
			}

			const uploader = await getUserById(uid)
			const uploaderSnapshot = uploader ? {
				nickname: uploader.nickname || '',
				avatar_url: ensureHttpsUrl(uploader.avatar || uploader.avatar_url || '')
			} : {}
			const uploadFileIds = photos
				.map((item) => String(item.fileId || item.file_id || '').trim())
				.filter(Boolean)
				.filter((item) => isCloudFileId(item))
			const uploadFileUrlMap = await getTempFileUrlMap(uploadFileIds)

			const photoDocs = photos.map((photo, index) => {
				const fileId = String(photo.fileId || photo.file_id || '').trim()
				const rawUrl = String(photo.url || '').trim()

				let mediaUrl = ensureHttpsUrl(rawUrl)
				if (!mediaUrl && isCloudFileId(fileId)) {
					mediaUrl = uploadFileUrlMap[fileId] || ''
				}
				if (!mediaUrl && isCloudFileId(rawUrl)) {
					mediaUrl = uploadFileUrlMap[rawUrl] || ''
				}
				if (!mediaUrl) {
					throw {
						errCode: 'love-note-photo-url-invalid',
						errMsg: `第 ${index + 1} 个文件链接无效，请重新上传`
					}
				}

				const mimeTypeInput = normalizeMimeTypeInput(photo.mimeType || photo.mime_type)
				const mediaType = resolveMediaType({
					mediaType: photo.mediaType || photo.media_type,
					mimeType: mimeTypeInput,
					url: mediaUrl,
					fileId
				})
				if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
					throw {
						errCode: 'love-note-media-type-invalid',
						errMsg: `第 ${index + 1} 个文件格式不支持，仅允许上传图片或视频`
					}
				}

				const mimeType = getMediaTypeByMimeType(mimeTypeInput) ? mimeTypeInput : buildMimeType(mediaType, mediaUrl)

				const rawThumbnailUrl = String(photo.thumbnailUrl || photo.thumbnail_url || '').trim()
				let thumbnailUrl = ensureHttpsUrl(rawThumbnailUrl)
				if (!thumbnailUrl && isCloudFileId(rawThumbnailUrl)) {
					thumbnailUrl = uploadFileUrlMap[rawThumbnailUrl] || ''
				}
				if (!thumbnailUrl) {
					thumbnailUrl = mediaUrl
				}

				const doc = {
					couple_id: activeCouple._id,
					album_id: albumId,
					url: mediaUrl,
					file_id: fileId,
					thumbnail_url: thumbnailUrl,
					media_type: mediaType,
					description: String(photo.description || '').trim().substring(0, 500),
					uploader_uid: uid,
					uploader_snapshot: uploaderSnapshot,
					like_count: 0,
					comment_count: 0,
					is_favorite: false,
					create_time: Date.now(),
					update_time: Date.now()
				}

				if (photo.location) {
					doc.location = {
						name: photo.location.name || '',
						address: photo.location.address || '',
						latitude: photo.location.latitude || null,
						longitude: photo.location.longitude || null
					}
				}

				if (photo.shootTime) {
					doc.shoot_time = new Date(photo.shootTime).getTime() || Date.now()
				}

				if (photo.width) doc.width = parseInt(photo.width) || 0
				if (photo.height) doc.height = parseInt(photo.height) || 0
				if (photo.fileSize) doc.file_size = parseInt(photo.fileSize) || 0
				if (mimeType) doc.mime_type = mimeType
				if (mediaType === 'video' && photo.duration) {
					doc.duration = Number(photo.duration) || 0
				}

				if (photo.tags && Array.isArray(photo.tags)) {
					doc.tags = photo.tags.slice(0, 10).map(tag => String(tag).trim()).filter(Boolean)
				}

				return doc
			})

			const transaction = await database().startTransaction()
			try {
				const photoIds = []
				for (const doc of photoDocs) {
					const result = await transaction.collection('love-photos').add(doc)
					photoIds.push(result.id)
				}

				const albumUpdateData = {
					photo_count: dbCmd.inc(photoDocs.length),
					update_time: Date.now()
				}

				const albumRes = await transaction.collection('love-albums').doc(albumId).get()
				const album = albumRes.data && albumRes.data[0]
				const currentCoverUrl = getAlbumCoverUrl(album)
				if (album && !currentCoverUrl) {
					const firstImage = photoDocs.find((item) => item.media_type === 'image') || null
					const nextCover = buildAlbumCoverByPhoto(firstImage)
					if (nextCover) {
						albumUpdateData.cover_url = nextCover.cover_url
						albumUpdateData.cover_image = nextCover.cover_image
					}
				}

				await transaction.collection('love-albums').doc(albumId).update(albumUpdateData)

				await transaction.commit()

				return {
					errCode: 0,
					data: {
						photoIds,
						count: photoDocs.length
					}
				}
			} catch (error) {
				await transaction.rollback()
				throw error
			}
		} catch (error) {
			return formatError(error, '上传媒体失败')
		}
	}

	async update(params = {}) {
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

			const photoId = String(params.photoId || '').trim()
			if (!photoId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '照片ID不能为空'
				}
			}

			const photoRes = await photoCollection
				.where({
					_id: photoId,
					couple_id: activeCouple._id
				})
				.limit(1)
				.get()

			if (!photoRes.data || photoRes.data.length === 0) {
				return {
					errCode: 'love-note-photo-not-found',
					errMsg: '照片不存在或无权访问'
				}
			}

			const updateData = {
				update_time: Date.now()
			}

			if (params.description !== undefined) {
				const description = String(params.description || '').trim()
				if (description.length > 500) {
					return {
						errCode: 'love-note-param-invalid',
						errMsg: '描述不能超过500个字符'
					}
				}
				updateData.description = description
			}

			const isFavorite = parseBooleanInput(params.isFavorite)
			if (isFavorite !== undefined) {
				updateData.is_favorite = isFavorite
			}

			if (params.location) {
				updateData.location = {
					name: params.location.name || '',
					address: params.location.address || '',
					latitude: params.location.latitude || null,
					longitude: params.location.longitude || null
				}
			}

			if (params.shootTime) {
				updateData.shoot_time = new Date(params.shootTime).getTime() || Date.now()
			}

			if (params.tags && Array.isArray(params.tags)) {
				updateData.tags = params.tags.slice(0, 10).map(tag => String(tag).trim()).filter(Boolean)
			}

			await photoCollection.doc(photoId).update(updateData)

			return {
				errCode: 0,
				data: {
					photoId
				}
			}
		} catch (error) {
			return formatError(error, '更新媒体失败')
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

			const photoId = String(params.photoId || '').trim()
			if (!photoId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '媒体ID不能为空'
				}
			}

			const photoRes = await photoCollection
				.where({
					_id: photoId,
					couple_id: activeCouple._id
				})
				.limit(1)
				.get()

			if (!photoRes.data || photoRes.data.length === 0) {
				return {
					errCode: 'love-note-photo-not-found',
					errMsg: '媒体不存在或无权访问'
				}
			}

			const photo = photoRes.data[0]
			const albumId = photo.album_id

			const transaction = await database().startTransaction()
			try {
				await transaction.collection('love-photos').doc(photoId).remove()

				const albumUpdateData = {
					photo_count: dbCmd.inc(-1),
					update_time: Date.now()
				}

				const albumRes = await transaction.collection('love-albums').doc(albumId).get()
				const album = albumRes.data && albumRes.data[0]
				const currentCoverUrl = getAlbumCoverUrl(album)
				if (album && currentCoverUrl && currentCoverUrl === ensureHttpsUrl(photo.url || '')) {
					const nextImage = await findLatestImageInAlbum(transaction, albumId)
					const nextCover = buildAlbumCoverByPhoto(nextImage)
					if (nextCover) {
						albumUpdateData.cover_url = nextCover.cover_url
						albumUpdateData.cover_image = nextCover.cover_image
					} else {
						albumUpdateData.cover_url = ''
						albumUpdateData.cover_image = {
							url: '',
							file_id: ''
						}
					}
				}

				await transaction.collection('love-albums').doc(albumId).update(albumUpdateData)

				await transaction.commit()

				if (photo.file_id) {
					try {
						await uniCloud.deleteFile({
							fileList: [photo.file_id]
						})
					} catch (e) {
						console.warn('删除云存储文件失败:', e)
					}
				}

				return {
					errCode: 0,
					data: {
						photoId
					}
				}
			} catch (error) {
				await transaction.rollback()
				throw error
			}
		} catch (error) {
			return formatError(error, '删除媒体失败')
		}
	}

	async toggleFavorite(params = {}) {
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

			const photoId = String(params.photoId || '').trim()
			if (!photoId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '媒体ID不能为空'
				}
			}

			const photoRes = await photoCollection
				.where({
					_id: photoId,
					couple_id: activeCouple._id
				})
				.limit(1)
				.get()

			if (!photoRes.data || photoRes.data.length === 0) {
				return {
					errCode: 'love-note-photo-not-found',
					errMsg: '媒体不存在或无权访问'
				}
			}

			const photo = photoRes.data[0]
			const newFavoriteState = !photo.is_favorite

			await photoCollection.doc(photoId).update({
				is_favorite: newFavoriteState,
				update_time: Date.now()
			})

			return {
				errCode: 0,
				data: {
					photoId,
					isFavorite: newFavoriteState
				}
			}
		} catch (error) {
			return formatError(error, '操作失败')
		}
	}

	async moveToAlbum(params = {}) {
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

			const photoId = String(params.photoId || '').trim()
			const targetAlbumId = String(params.targetAlbumId || '').trim()

			if (!photoId || !targetAlbumId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '媒体ID和目标相册ID不能为空'
				}
			}

			const [photoRes, targetAlbumRes] = await Promise.all([
				photoCollection.where({
					_id: photoId,
					couple_id: activeCouple._id
				}).limit(1).get(),
				albumCollection.where({
					_id: targetAlbumId,
					couple_id: activeCouple._id
				}).limit(1).get()
			])

			if (!photoRes.data || photoRes.data.length === 0) {
				return {
					errCode: 'love-note-photo-not-found',
					errMsg: '媒体不存在或无权访问'
				}
			}

			if (!targetAlbumRes.data || targetAlbumRes.data.length === 0) {
				return {
					errCode: 'love-note-album-not-found',
					errMsg: '目标相册不存在或无权访问'
				}
			}

			const photo = photoRes.data[0]
			const sourceAlbumId = photo.album_id

			if (sourceAlbumId === targetAlbumId) {
				return {
					errCode: 'love-note-same-album',
					errMsg: '媒体已在目标相册中'
				}
			}

			const transaction = await database().startTransaction()
			try {
				await transaction.collection('love-photos').doc(photoId).update({
					album_id: targetAlbumId,
					update_time: Date.now()
				})

				const sourceAlbumUpdateData = {
					photo_count: dbCmd.inc(-1),
					update_time: Date.now()
				}

				const sourceAlbumRes = await transaction.collection('love-albums').doc(sourceAlbumId).get()
				const sourceAlbum = sourceAlbumRes.data && sourceAlbumRes.data[0]
				const sourceCoverUrl = getAlbumCoverUrl(sourceAlbum)
				if (sourceAlbum && sourceCoverUrl && sourceCoverUrl === ensureHttpsUrl(photo.url || '')) {
					const nextSourceImage = await findLatestImageInAlbum(transaction, sourceAlbumId)
					const nextSourceCover = buildAlbumCoverByPhoto(nextSourceImage)
					if (nextSourceCover) {
						sourceAlbumUpdateData.cover_url = nextSourceCover.cover_url
						sourceAlbumUpdateData.cover_image = nextSourceCover.cover_image
					} else {
						sourceAlbumUpdateData.cover_url = ''
						sourceAlbumUpdateData.cover_image = {
							url: '',
							file_id: ''
						}
					}
				}

				await transaction.collection('love-albums').doc(sourceAlbumId).update(sourceAlbumUpdateData)

				const targetAlbumUpdateData = {
					photo_count: dbCmd.inc(1),
					update_time: Date.now()
				}

				const targetAlbumRes = await transaction.collection('love-albums').doc(targetAlbumId).get()
				const targetAlbum = targetAlbumRes.data && targetAlbumRes.data[0]
				const targetCoverUrl = getAlbumCoverUrl(targetAlbum)
				if (targetAlbum && !targetCoverUrl) {
					const targetCover = buildAlbumCoverByPhoto(photo)
					if (targetCover) {
						targetAlbumUpdateData.cover_url = targetCover.cover_url
						targetAlbumUpdateData.cover_image = targetCover.cover_image
					}
				}

				await transaction.collection('love-albums').doc(targetAlbumId).update(targetAlbumUpdateData)

				await transaction.commit()

				return {
					errCode: 0,
					data: {
						photoId,
						sourceAlbumId,
						targetAlbumId
					}
				}
			} catch (error) {
				await transaction.rollback()
				throw error
			}
		} catch (error) {
			return formatError(error, '移动媒体失败')
		}
	}
}
