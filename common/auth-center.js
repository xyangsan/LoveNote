export const DEFAULT_AVATAR = '/static/logo.png'

let authCenterObject = null

export function getAuthCenterObject() {
	if (!authCenterObject) {
		authCenterObject = uniCloud.importObject('auth-center', {
			customUI: true
		})
	}

	return authCenterObject
}

export function clearUniIdTokenStorage() {
	;['uni_id_token', 'uni_id_token_expired', 'uniIdToken'].forEach((key) => {
		uni.removeStorageSync(key)
	})
}

export function getCurrentUniIdUser() {
	return uniCloud.getCurrentUserInfo ? uniCloud.getCurrentUserInfo() : null
}

export function getFileExtname(filePath = '') {
	const normalizedPath = `${filePath}`.split('?')[0]
	const dotIndex = normalizedPath.lastIndexOf('.')
	if (dotIndex === -1 || dotIndex === normalizedPath.length - 1) {
		return 'png'
	}

	return normalizedPath.slice(dotIndex + 1).toLowerCase()
}

export async function uploadAvatarIfNeeded(currentAvatar = '') {
	if (!currentAvatar) {
		return {
			avatarUrl: '',
			avatarFileId: '',
			avatarFile: null
		}
	}

	if (currentAvatar.startsWith('cloud://')) {
		return {
			avatarUrl: '',
			avatarFileId: currentAvatar,
			avatarFile: {
				name: currentAvatar.split('/').pop() || `avatar.${getFileExtname(currentAvatar)}`,
				extname: getFileExtname(currentAvatar),
				url: currentAvatar
			}
		}
	}

	if (currentAvatar.startsWith('http://') || currentAvatar.startsWith('https://')) {
		return {
			avatarUrl: currentAvatar,
			avatarFileId: '',
			avatarFile: null
		}
	}

	const extname = getFileExtname(currentAvatar)
	const cloudPath = `love-note/avatar/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extname}`
	const uploadRes = await uniCloud.uploadFile({
		cloudPath,
		filePath: currentAvatar
	})

	return {
		avatarUrl: '',
		avatarFileId: uploadRes.fileID,
		avatarFile: {
			name: cloudPath.split('/').pop(),
			extname,
			url: uploadRes.fileID
		}
	}
}

