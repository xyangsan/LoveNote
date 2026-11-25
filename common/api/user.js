import { createRouterModule } from './router.js'
import { takePendingGuestTheme } from '../theme.js'

let userApi = null

export function getUserApi() {
	if (!userApi) {
		userApi = createRouterModule({
			getMine: 'user/getMine',
			updateProfile: 'user/updateProfile'
		})
	}

	return userApi
}

/**
 * 把「未登录期间切的主题」补写到账号资料里（`user/updateProfile` 的 `themeKey`）。
 *
 * `takePendingGuestTheme()` 是一次性取走（取完即清标记），所以 App.vue 的登录事件
 * 与 `store.updateUserInfo()` 两处都可以放心调用，不会重复提交。
 * 云端已经是同一个值时跳过，省一次写请求。
 *
 * @param {object} [userInfo] 刚拿到的用户资料，用来比对云端现值
 * @returns {Promise<string>} 实际提交的主题 key（没提交则空串）
 */
export async function flushPendingGuestTheme(userInfo) {
	const pendingKey = takePendingGuestTheme()
	if (!pendingKey) return ''
	if (userInfo && userInfo.themeKey === pendingKey) return ''
	try {
		await getUserApi().updateProfile({ themeKey: pendingKey })
		return pendingKey
	} catch (e) {
		// 同步失败不影响本地：下次在主题页切一次会重新提交
		return ''
	}
}
