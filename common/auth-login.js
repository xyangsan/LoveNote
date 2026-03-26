import { getAuthApi } from './api/auth.js'
import { saveCachedUserProfile, uploadAvatarIfNeeded } from './auth-center.js'

export async function loginByWeixinProfile(loginForm = {}) {
	const loginRes = await uni.login()
	const code = loginRes.code
	if (!code) {
		throw new Error('未获取到微信登录 code')
	}

	const loginPayload = {
		code
	}
	const nickname = (loginForm.nickname || '').trim()
	if (nickname) {
		loginPayload.nickname = nickname
	}
	if (loginForm.avatarUrl) {
		const avatarResult = await uploadAvatarIfNeeded(loginForm.avatarUrl)
		if (avatarResult.avatarFileId) {
			loginPayload.avatarFileId = avatarResult.avatarFileId
			loginPayload.avatarFile = avatarResult.avatarFile
		} else if (avatarResult.avatarUrl) {
			loginPayload.avatarUrl = avatarResult.avatarUrl
		}
	}

	const result = await getAuthApi().loginByWeixin(loginPayload)
	if (result.errCode && result.errCode !== 0) {
		throw new Error(result.errMsg || '登录失败')
	}

	if (result.userInfo) {
		saveCachedUserProfile(result.userInfo)
	}

	return result
}
