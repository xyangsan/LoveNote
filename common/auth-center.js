import { clearUniIdTokenStorage } from './api/router.js'
import {
	getFileExtname,
	normalizeHttpsUrl,
	resolveHttpsFileUrl,
	uploadFileWithModule
} from './utils/file-upload.js'

export const DEFAULT_AVATAR = '/static/user-empty.png'
export const AUTH_CHANGE_EVENT = 'love-note-auth-change'
export const USER_PROFILE_CACHE_KEY = 'love_note_user_profile_cache'

export { clearUniIdTokenStorage }
export { getFileExtname }

export function getCachedUserProfile() {
	const cachedValue = uni.getStorageSync(USER_PROFILE_CACHE_KEY)
	if (!cachedValue || typeof cachedValue !== 'object') {
		return null
	}

	const nickname = cachedValue.nickname ? `${cachedValue.nickname}`.trim() : ''
	const avatarUrl = cachedValue.avatarUrl ? `${cachedValue.avatarUrl}` : ''
	const avatarFileId = cachedValue.avatarFileId ? `${cachedValue.avatarFileId}` : ''

	if (!nickname && !avatarUrl && !avatarFileId) {
		return null
	}

	return {
		nickname,
		avatarUrl,
		avatarFileId,
		updatedAt: Number(cachedValue.updatedAt || Date.now())
	}
}

export function saveCachedUserProfile(profile = {}) {
	if (!profile || typeof profile !== 'object') {
		return null
	}

	const nickname = profile.nickname ? `${profile.nickname}`.trim() : ''
	const avatarUrl = profile.avatarUrl ? `${profile.avatarUrl}` : ''
	const avatarFileId = profile.avatarFileId ? `${profile.avatarFileId}` : ''

	if (!nickname && !avatarUrl && !avatarFileId) {
		return null
	}

	const cachedProfile = {
		nickname,
		avatarUrl,
		avatarFileId,
		updatedAt: Date.now()
	}

	uni.setStorageSync(USER_PROFILE_CACHE_KEY, cachedProfile)
	return cachedProfile
}

export function getCurrentUniIdUser() {
	return uniCloud.getCurrentUserInfo ? uniCloud.getCurrentUserInfo() : null
}

export function hasValidLogin(userInfo = getCurrentUniIdUser()) {
	return Boolean(userInfo && userInfo.uid && (!userInfo.tokenExpired || userInfo.tokenExpired > Date.now()))
}

export function emitAuthChanged(detail = {}) {
	uni.$emit(AUTH_CHANGE_EVENT, detail)
}

export function subscribeAuthChanged(handler) {
	if (typeof handler !== 'function') {
		return () => {}
	}

	uni.$on(AUTH_CHANGE_EVENT, handler)
	return () => {
		uni.$off(AUTH_CHANGE_EVENT, handler)
	}
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
		const avatarUrl = await resolveHttpsFileUrl(currentAvatar)
		return {
			avatarUrl,
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
			avatarUrl: normalizeHttpsUrl(currentAvatar),
			avatarFileId: '',
			avatarFile: null
		}
	}

	const uploadRes = await uploadFileWithModule({
		filePath: currentAvatar,
		module: 'avatar',
		prefix: 'avatar',
		fileType: 'image'
	})
	const extname = getFileExtname(currentAvatar)
	const fileName = uploadRes.cloudPath.split('/').pop()

	return {
		avatarUrl: uploadRes.fileURL,
		avatarFileId: uploadRes.fileID,
		avatarFile: {
			name: fileName,
			extname,
			url: uploadRes.fileID
		}
	}
}
