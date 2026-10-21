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

/**
 * 是否为「本地临时文件」——chooseAvatar / chooseImage 回传的那种路径。
 * ⚠️ 微信开发者工具给的是 `http://tmp/xxx.jpeg`（HBuilderX 预览里会显示成 https://tmp/…），
 * 真机是 `wxfile://tmp_xxx`，支付宝是 `https://resource/xxx`，H5 是 `blob:`。
 * 这些**都不是可长期访问的网络地址**，必须上传到云存储。
 * 判据：协议是 http(s) 但 host 没有域名后缀（tmp / usr / resource / localhost）。
 */
export function isTempFilePath(value = '') {
	const raw = String(value || '').trim()
	if (!raw) {
		return false
	}

	// 云存储 fileID 与内联 data URL 不需要再上传
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

	// 非 http(s) 的（相对路径 / 绝对路径 / _doc/ 等）一律当本地文件
	return true
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
