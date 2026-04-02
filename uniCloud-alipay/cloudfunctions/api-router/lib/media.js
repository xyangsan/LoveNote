'use strict'

const IMAGE_EXT_SET = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'heif'])
const VIDEO_EXT_SET = new Set(['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', '3gp'])

function ensureHttpsUrl(value = '') {
	const raw = String(value || '').trim()
	if (!raw) {
		return ''
	}

	if (/^https:\/\//i.test(raw)) {
		return raw
	}

	if (/^http:\/\//i.test(raw)) {
		return `https://${raw.slice(7)}`
	}

	return ''
}

function isCloudFileId(value = '') {
	return /^cloud:\/\//i.test(String(value || '').trim())
}

function getFileExtname(value = '') {
	const cleanValue = String(value || '').trim().split('?')[0]
	const dotIndex = cleanValue.lastIndexOf('.')
	if (dotIndex === -1 || dotIndex === cleanValue.length - 1) {
		return ''
	}

	return cleanValue.slice(dotIndex + 1).toLowerCase()
}

function getMediaTypeByMimeType(value = '') {
	const mimeType = String(value || '').trim().toLowerCase()
	if (!mimeType) {
		return ''
	}

	if (mimeType.startsWith('image/')) {
		return 'image'
	}
	if (mimeType.startsWith('video/')) {
		return 'video'
	}
	return ''
}

function getMediaTypeByPath(value = '') {
	const extname = getFileExtname(value)
	if (!extname) {
		return ''
	}
	if (IMAGE_EXT_SET.has(extname)) {
		return 'image'
	}
	if (VIDEO_EXT_SET.has(extname)) {
		return 'video'
	}
	return ''
}

function collectFileIdsFromPhotos(list = []) {
	const fileIds = []
	list.forEach((item) => {
		if (!item || typeof item !== 'object') {
			return
		}

		const fileId = String(item.file_id || '').trim()
		const url = String(item.url || '').trim()
		const thumbnailFileId = String(item.thumbnail_file_id || '').trim()
		const thumbnailUrl = String(item.thumbnail_url || '').trim()

		if (fileId && isCloudFileId(fileId)) {
			fileIds.push(fileId)
		} else if (isCloudFileId(url)) {
			fileIds.push(url)
		}

		if (thumbnailFileId && isCloudFileId(thumbnailFileId)) {
			fileIds.push(thumbnailFileId)
		} else if (isCloudFileId(thumbnailUrl)) {
			fileIds.push(thumbnailUrl)
		}
	})
	return fileIds
}

function collectFileIdsFromAlbums(list = []) {
	const fileIds = []
	list.forEach((item) => {
		if (!item || typeof item !== 'object') {
			return
		}

		const coverImage = item.cover_image && typeof item.cover_image === 'object' ? item.cover_image : {}
		const coverFileId = String(coverImage.file_id || item.cover_file_id || '').trim()
		const coverUrl = String(coverImage.url || item.cover_url || '').trim()

		if (coverFileId && isCloudFileId(coverFileId)) {
			fileIds.push(coverFileId)
		} else if (isCloudFileId(coverUrl)) {
			fileIds.push(coverUrl)
		}
	})
	return fileIds
}

async function getTempFileUrlMap(fileIds = []) {
	const uniqueFileIds = [...new Set(fileIds.map((item) => String(item || '').trim()).filter(Boolean))]
	if (!uniqueFileIds.length) {
		return {}
	}

	const fileUrlMap = {}
	try {
		const tempResult = await uniCloud.getTempFileURL({
			fileList: uniqueFileIds
		})
		const fileList = Array.isArray(tempResult && tempResult.fileList) ? tempResult.fileList : []

		fileList.forEach((item) => {
			const fileId = String(item.fileID || item.fileId || item.file_id || '').trim()
			const tempUrl = ensureHttpsUrl(item.tempFileURL || item.tempFileUrl || item.download_url || item.url || '')
			if (fileId && tempUrl) {
				fileUrlMap[fileId] = tempUrl
			}
		})
	} catch (error) {
		console.warn('api-router getTempFileUrlMap failed', error)
	}

	return fileUrlMap
}

function normalizePhotoRecord(record = {}, fileUrlMap = {}) {
	const rawFileId = String(record.file_id || '').trim()
	const rawThumbnailFileId = String(record.thumbnail_file_id || '').trim()
	const fileId = rawFileId || (isCloudFileId(record.url) ? String(record.url || '').trim() : '')
	const thumbnailFileId = rawThumbnailFileId || (isCloudFileId(record.thumbnail_url) ? String(record.thumbnail_url || '').trim() : '')

	let url = ensureHttpsUrl(record.url || '')
	if (!url && fileId) {
		url = fileUrlMap[fileId] || ''
	}

	let thumbnailUrl = ensureHttpsUrl(record.thumbnail_url || '')
	if (!thumbnailUrl && thumbnailFileId) {
		thumbnailUrl = fileUrlMap[thumbnailFileId] || ''
	}
	if (!thumbnailUrl) {
		thumbnailUrl = url
	}
	const mediaType = record.media_type || getMediaTypeByMimeType(record.mime_type) || getMediaTypeByPath(url || fileId) || 'image'

	return Object.assign({}, record, {
		file_id: fileId,
		url,
		thumbnail_url: thumbnailUrl,
		media_type: mediaType
	})
}

function normalizePhotoList(list = [], fileUrlMap = {}) {
	return list.map((item) => normalizePhotoRecord(item, fileUrlMap))
}

function normalizeAlbumRecord(record = {}, fileUrlMap = {}) {
	const coverImage = record.cover_image && typeof record.cover_image === 'object' ? record.cover_image : {}
	const rawCoverFileId = String(coverImage.file_id || record.cover_file_id || '').trim()
	const coverFileId = rawCoverFileId || (isCloudFileId(coverImage.url || record.cover_url) ? String(coverImage.url || record.cover_url || '').trim() : '')

	let coverUrl = ensureHttpsUrl(coverImage.url || record.cover_url || '')
	if (!coverUrl && coverFileId) {
		coverUrl = fileUrlMap[coverFileId] || ''
	}

	return Object.assign({}, record, {
		cover_url: coverUrl,
		cover_image: {
			url: coverUrl,
			file_id: coverFileId
		}
	})
}

function normalizeAlbumList(list = [], fileUrlMap = {}) {
	return list.map((item) => normalizeAlbumRecord(item, fileUrlMap))
}

module.exports = {
	ensureHttpsUrl,
	isCloudFileId,
	getFileExtname,
	getMediaTypeByMimeType,
	getMediaTypeByPath,
	collectFileIdsFromPhotos,
	collectFileIdsFromAlbums,
	getTempFileUrlMap,
	normalizePhotoRecord,
	normalizePhotoList,
	normalizeAlbumRecord,
	normalizeAlbumList
}
