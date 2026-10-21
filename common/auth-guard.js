import { hasValidLogin } from './auth-center.js'
import { consumePendingRoute } from './auth-modal.js'
import { PUBLIC_PAGE_PATHS, PUBLIC_PAGE_PREFIXES, buildPageLoginUrl, isEntryRedirecting, beginEntryRedirect } from './auth-entry.js'

/**
 * 白名单与「哪些页面需要登录」统一由 `common/auth-entry.js` 决定，
 * 这里只保留导出以兼容旧引用（值就是那份清单）。
 */
export const AUTH_ROUTE_WHITELIST = PUBLIC_PAGE_PATHS.concat(
	PUBLIC_PAGE_PREFIXES.map((prefix) => `${prefix}*`)
)

const INTERCEPT_ROUTE_METHODS = ['navigateTo', 'redirectTo', 'reLaunch', 'switchTab']

let hasInstalledAuthGuard = false
let skipNextRouteAuthCheck = false

function normalizePath(url = '') {
	const path = `${url}`.split('?')[0].split('#')[0]
	if (!path) {
		return ''
	}

	return path.startsWith('/') ? path : `/${path}`
}

function isWhiteListedPath(targetPath) {
	if (PUBLIC_PAGE_PATHS.indexOf(targetPath) !== -1) {
		return true
	}
	return PUBLIC_PAGE_PREFIXES.some((prefix) => targetPath.indexOf(prefix) === 0)
}

function shouldInterceptRoute(options = {}) {
	if (skipNextRouteAuthCheck) {
		skipNextRouteAuthCheck = false
		return false
	}

	const targetPath = normalizePath(options.url)
	if (!targetPath) {
		return false
	}

	if (isWhiteListedPath(targetPath)) {
		return false
	}

	return !hasValidLogin()
}

/**
 * 页面级 API 跳转的兜底守卫。
 *
 * ⚠️ 它和 main.js 的 hh-router-guard 是同一类东西（都基于 uni.addInterceptor），
 * **拦不到微信冷启动入口页**（分享卡片 / 扫码 / 场景值链接）——
 * 入口页的登录判断由页面自己在 onLoad 里调 `requirePageLogin()`（common/auth-entry.js）。
 *
 * 行为与 hh-router-guard 对齐：未登录 → 跳登录页（带 redirect 回跳），不再弹就地登录框。
 * 用 navigateTo 而不是 redirectTo：这时目标页还没创建，登录页压栈、登录成功后
 * redirectTo 回来正好把登录页替换掉，栈里不留空页面。
 */
function buildInterceptor() {
	return {
		invoke(options) {
			if (!shouldInterceptRoute(options)) {
				return options
			}

			const loginUrl = buildPageLoginUrl(options.url)
			if (!loginUrl) {
				return options
			}

			// 已经有一层在跳了（hh-router-guard / 页面自己的闸门）→ 直接放弃这次跳转
			if (isEntryRedirecting()) {
				return false
			}
			beginEntryRedirect()

			skipNextRouteAuthCheck = true
			uni.navigateTo({
				url: loginUrl
			})
			return false
		}
	}
}

export function installRouteAuthGuard() {
	if (hasInstalledAuthGuard || !uni.addInterceptor) {
		return
	}

	hasInstalledAuthGuard = true
	INTERCEPT_ROUTE_METHODS.forEach((method) => {
		uni.addInterceptor(method, buildInterceptor(method))
	})
}

/**
 * 兼容旧接口：登录弹窗里带了 pendingRoute 时继续跳转。
 * 现在拦截器不再写 pendingRoute（改成直接跳登录页），弹窗只服务页面内主动调用的场景，
 * 所以这里一般是 false。
 */
export function continuePendingRoute() {
	const pendingRoute = consumePendingRoute()
	if (!pendingRoute || !pendingRoute.type || typeof uni[pendingRoute.type] !== 'function') {
		return false
	}

	skipNextRouteAuthCheck = true
	uni[pendingRoute.type](pendingRoute.options)
	return true
}
