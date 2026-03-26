'use strict'

function buildAuthResponse(authResult = {}) {
	return authResult.token && authResult.tokenExpired
		? {
			newToken: {
				token: authResult.token,
				tokenExpired: authResult.tokenExpired
			}
		}
		: {}
}

function formatError(error, fallbackMessage = '请求失败') {
	if (error && typeof error === 'object') {
		return {
			errCode: error.errCode || error.code || 'love-note-request-failed',
			errMsg: error.errMsg || error.message || fallbackMessage
		}
	}

	return {
		errCode: 'love-note-request-failed',
		errMsg: fallbackMessage
	}
}

module.exports = {
	buildAuthResponse,
	formatError
}
