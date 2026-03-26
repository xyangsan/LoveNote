const ROUTER_FUNCTION_NAME = 'api-router'
const AUTH_ERROR_CODES = [
	'uni-id-token-expired',
	'uni-id-check-token-failed',
	'uni-id-token-not-exist',
	'uni-id-invalid-token',
	'uni-id-token-required',
	'uni-id-token-beyond-validity'
]

export function clearUniIdTokenStorage() {
	;['uni_id_token', 'uni_id_token_expired', 'uniIdToken'].forEach((key) => {
		uni.removeStorageSync(key)
	})
}

export function getStoredUniIdToken() {
	return uni.getStorageSync('uni_id_token') || uni.getStorageSync('uniIdToken') || ''
}

export function syncUniIdTokenStorage(result = {}) {
	const loginToken = result && result.token
		? {
			token: result.token,
			tokenExpired: result.tokenExpired
		}
		: null
	const refreshToken = result && result.newToken && result.newToken.token
		? result.newToken
		: null
	const nextTokenState = refreshToken || loginToken

	if (!nextTokenState || !nextTokenState.token) {
		return
	}

	uni.setStorageSync('uni_id_token', nextTokenState.token)
	uni.setStorageSync('uniIdToken', nextTokenState.token)
	uni.setStorageSync('uni_id_token_expired', Number(nextTokenState.tokenExpired || 0))
}

export function isAuthErrorResult(result = {}) {
	return Boolean(result && AUTH_ERROR_CODES.includes(result.errCode))
}

export function normalizeRouterResult(response) {
	const result = response && response.result ? response.result : (response || {})
	syncUniIdTokenStorage(result || {})

	if (isAuthErrorResult(result)) {
		clearUniIdTokenStorage()
	}

	return result || {}
}

export async function callApiRouter(action, data = {}) {
	const response = await uniCloud.callFunction({
		name: ROUTER_FUNCTION_NAME,
		data: {
			action,
			data,
			uniIdToken: getStoredUniIdToken()
		}
	})

	return normalizeRouterResult(response)
}

export function createRouterModule(actionMap = {}) {
	const moduleObject = {}
	Object.keys(actionMap).forEach((methodName) => {
		moduleObject[methodName] = (payload = {}) => callApiRouter(actionMap[methodName], payload)
	})
	return moduleObject
}
