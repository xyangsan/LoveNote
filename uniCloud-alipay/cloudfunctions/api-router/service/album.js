'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { albumCollection, photoCollection } = require('../lib/db')
const { getActiveCoupleByUid } = require('../lib/couple')
const {
	andWhereConditions,
	buildCreatorVisibilityCondition
} = require('../lib/content-scope')
const {
	collectFileIdsFromAlbums,
	collectFileIdsFromPhotos,
	getTempFileUrlMap,
	normalizeAlbumList,
	normalizeAlbumRecord,
	normalizePhotoList,
	ensureHttpsUrl,
	isCloudFileId
} = require('../lib/media')
const { formatError } = require('../lib/response')

async function normalizeCoverImageInput(rawCoverImage = {}) {
	const coverImage = rawCoverImage && typeof rawCoverImage === 'object' ? rawCoverImage : {}
	const rawFileId = String(coverImage.fileId || coverImage.file_id || '').trim()
	const rawUrl = String(coverImage.url || '').trim()
	const fileId = rawFileId || (isCloudFileId(rawUrl) ? rawUrl : '')
	let coverUrl = ensureHttpsUrl(rawUrl)

	if (!coverUrl && fileId) {
		const fileUrlMap = await getTempFileUrlMap([fileId])
		coverUrl = fileUrlMap[fileId] || ''
	}

	if (!coverUrl && !fileId) {
		return null
	}

	return {
		url: coverUrl,
		file_id: fileId
	}
}

module.exports = class AlbumService extends Service {
	async getList(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)


			const page = Math.max(1, parseInt(params.page) || 1)
			const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize) || 20))

			const whereCondition = buildCreatorVisibilityCondition({
				uid,
				activeCouple,
				creatorField: 'create_uid'
			})

			const totalRes = await albumCollection.where(whereCondition).count()
			const total = totalRes.total || 0

			const listRes = await albumCollection
				.where(whereCondition)
				.orderBy('sort_order', 'asc')
				.orderBy('create_time', 'desc')
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get()
			const rawList = listRes.data || []
			const fileUrlMap = await getTempFileUrlMap(collectFileIdsFromAlbums(rawList))
			const list = normalizeAlbumList(rawList, fileUrlMap)

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
			return formatError(error, '获取相册列表失败')
		}
	}

	async getDetail(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)


			const albumId = String(params.albumId || '').trim()
			if (!albumId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '相册ID不能为空'
				}
			}

			const albumVisibilityCondition = buildCreatorVisibilityCondition({
				uid,
				activeCouple,
				creatorField: 'create_uid'
			})
			const albumRes = await albumCollection
				.where(andWhereConditions(albumVisibilityCondition, {
					_id: albumId
				}))
				.limit(1)
				.get()

			if (!albumRes.data || albumRes.data.length === 0) {
				return {
					errCode: 'love-note-album-not-found',
					errMsg: '相册不存在或无权访问'
				}
			}

			const album = albumRes.data[0]

			const photoPage = Math.max(1, parseInt(params.photoPage) || 1)
			const photoPageSize = Math.min(50, Math.max(1, parseInt(params.photoPageSize) || 20))
			
			const photoVisibilityCondition = buildCreatorVisibilityCondition({
				uid,
				activeCouple,
				creatorField: 'uploader_uid'
			})
			const photoWhereCondition = andWhereConditions(photoVisibilityCondition, {
				album_id: albumId
			})

			const photoRes = await photoCollection
				.where(photoWhereCondition)
				.orderBy('create_time', 'desc')
				.skip((photoPage - 1) * photoPageSize)
				.limit(photoPageSize)
				.get()

			const photoTotalRes = await photoCollection
				.where(photoWhereCondition)
				.count()
			const rawPhotos = photoRes.data || []
			const fileIds = [
				...collectFileIdsFromAlbums([album]),
				...collectFileIdsFromPhotos(rawPhotos)
			]
			const fileUrlMap = await getTempFileUrlMap(fileIds)
			const normalizedAlbum = normalizeAlbumRecord(album, fileUrlMap)
			const normalizedPhotos = normalizePhotoList(rawPhotos, fileUrlMap)

			return {
				errCode: 0,
				data: {
					album: normalizedAlbum,
					photos: normalizedPhotos,
					pagination: {
						page: photoPage,
						pageSize: photoPageSize,
						total: photoTotalRes.total || 0,
						hasMore: photoPage * photoPageSize < (photoTotalRes.total || 0)
					}
				}
			}
		} catch (error) {
			return formatError(error, '获取相册详情失败')
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

			const title = String(params.title || '').trim()
			if (!title) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '相册标题不能为空'
				}
			}

			if (title.length > 50) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '相册标题不能超过50个字符'
				}
			}

			const description = String(params.description || '').trim()
			if (description.length > 500) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '相册描述不能超过500个字符'
				}
			}

			const albumData = {
				couple_id: activeCouple._id,
				title,
				description,
				photo_count: 0,
				sort_order: parseInt(params.sortOrder) || 0,
				create_uid: uid,
				create_time: Date.now(),
				update_time: Date.now()
			}

			if (params.coverImage !== undefined) {
				const coverImage = await normalizeCoverImageInput(params.coverImage)
				if (coverImage) {
					albumData.cover_image = coverImage
					albumData.cover_url = coverImage.url
				}
			}

			const result = await albumCollection.add(albumData)
			const normalizedAlbum = normalizeAlbumRecord({
				_id: result.id,
				...albumData
			})

			return {
				errCode: 0,
				data: {
					albumId: result.id,
					album: normalizedAlbum
				}
			}
		} catch (error) {
			return formatError(error, '创建相册失败')
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

			const updateData = {
				update_time: Date.now()
			}

			if (params.title !== undefined) {
				const title = String(params.title || '').trim()
				if (!title) {
					return {
						errCode: 'love-note-param-required',
						errMsg: '相册标题不能为空'
					}
				}
				if (title.length > 50) {
					return {
						errCode: 'love-note-param-invalid',
						errMsg: '相册标题不能超过50个字符'
					}
				}
				updateData.title = title
			}

			if (params.description !== undefined) {
				const description = String(params.description || '').trim()
				if (description.length > 500) {
					return {
						errCode: 'love-note-param-invalid',
						errMsg: '相册描述不能超过500个字符'
					}
				}
				updateData.description = description
			}

			if (params.sortOrder !== undefined) {
				updateData.sort_order = parseInt(params.sortOrder) || 0
			}

			if (params.coverImage !== undefined) {
				const coverImage = await normalizeCoverImageInput(params.coverImage)
				if (coverImage) {
					updateData.cover_image = coverImage
					updateData.cover_url = coverImage.url
				} else {
					updateData.cover_image = {
						url: '',
						file_id: ''
					}
					updateData.cover_url = ''
				}
			}

			await albumCollection.doc(albumId).update(updateData)

			return {
				errCode: 0,
				data: {
					albumId
				}
			}
		} catch (error) {
			return formatError(error, '更新相册失败')
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

			const album = albumRes.data[0]
			if (album.is_default) {
				return {
					errCode: 'love-note-album-protected',
					errMsg: '默认相册不能删除'
				}
			}

			await photoCollection
				.where({
					album_id: albumId,
					couple_id: activeCouple._id
				})
				.remove()

			await albumCollection.doc(albumId).remove()

			return {
				errCode: 0,
				data: {
					albumId
				}
			}
		} catch (error) {
			return formatError(error, '删除相册失败')
		}
	}
}
