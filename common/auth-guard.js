import { hasValidLogin } from './auth-center.js'
import { consumePendingRoute, openLoginModal } from './auth-modal.js'

export const AUTH_ROUTE_WHITELIST = [
	'/pages/index/index',
	'/pages/profile/index',
	'/pages/login/index'
]

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

function shouldInterceptRoute(options = {}) {
	if (skipNextRouteAuthCheck) {
		skipNextRouteAuthCheck = false
		return false
	}

	const targetPath = normalizePath(options.url)
	if (!targetPath) {
		return false
	}

	if (AUTH_ROUTE_WHITELIST.includes(targetPath)) {
		return false
	}

	return !hasValidLogin()
}

function buildInterceptor(method) {
	return {
		invoke(options) {
			if (!shouldInterceptRoute(options)) {
				return options
			}

			openLoginModal({
				reason: '当前页面需要先登录，登录后将自动继续前往目标页面。',
				pendingRoute: {
					type: method,
					options: Object.assign({}, options)
				}
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

export function continuePendingRoute() {
	const pendingRoute = consumePendingRoute()
	if (!pendingRoute || !pendingRoute.type || typeof uni[pendingRoute.type] !== 'function') {
		return false
	}

	skipNextRouteAuthCheck = true
	uni[pendingRoute.type](pendingRoute.options)
	return true
}
