function getSafePathSegment(value = '') {
	return String(value || '')
		.trim()
		.replace(/\\/g, '/')
		.split('/')
		.map((item) => item.trim().replace(/[^a-zA-Z0-9_-]/g, ''))
		.filter(Boolean)
		.join('/')
}

export function getFileExtname(filePath = '') {
	const normalizedPath = `${filePath}`.split('?')[0]
	const dotIndex = normalizedPath.lastIndexOf('.')
	if (dotIndex === -1 || dotIndex === normalizedPath.length - 1) {
		return 'png'
	}

	return normalizedPath.slice(dotIndex + 1).toLowerCase()
}

export function normalizeHttpsUrl(value = '') {
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

export function buildCloudPath({
	module = 'common',
	prefix = 'file',
	filePath = '',
	extname = ''
} = {}) {
	const modulePath = getSafePathSegment(module) || 'common'
	const safePrefix = getSafePathSegment(prefix) || 'file'
	const fileExtname = String(extname || getFileExtname(filePath)).toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
	const randomCode = Math.random().toString(36).slice(2, 10)
	return `love-note/${modulePath}/${Date.now()}-${safePrefix}-${randomCode}.${fileExtname}`
}

export async function resolveHttpsFileUrl(fileId = '', fallbackUrl = '') {
	const directUrl = normalizeHttpsUrl(fallbackUrl || fileId)
	if (directUrl) {
		return directUrl
	}

	const normalizedFileId = String(fileId || '').trim()
	if (!normalizedFileId) {
		return ''
	}

	if (!normalizedFileId.startsWith('cloud://')) {
		return ''
	}

	try {
		const tempRes = await uniCloud.getTempFileURL({
			fileList: [normalizedFileId]
		})
		const fileItem = tempRes && Array.isArray(tempRes.fileList) ? tempRes.fileList[0] : null
		return normalizeHttpsUrl(
			(fileItem && (fileItem.tempFileURL || fileItem.tempFileUrl || fileItem.download_url || fileItem.url)) || ''
		)
	} catch (error) {
		console.warn('resolveHttpsFileUrl failed', error)
		return ''
	}
}

export async function uploadFileWithModule({
	filePath = '',
	module = 'common',
	prefix = 'file',
	extname = '',
	fileType = 'image'
} = {}) {
	if (!filePath) {
		throw new Error('filePath 不能为空')
	}

	const cloudPath = buildCloudPath({
		module,
		prefix,
		filePath,
		extname
	})

	const uploadRes = await uniCloud.uploadFile({
		filePath,
		cloudPath,
		fileType
	})
	const fileID = uploadRes.fileID || uploadRes.fileId || ''
	const fileURL = await resolveHttpsFileUrl(
		fileID,
		uploadRes.fileURL || uploadRes.tempFileURL || uploadRes.url || ''
	)

	return {
		cloudPath,
		fileID,
		fileURL,
		raw: uploadRes
	}
}
