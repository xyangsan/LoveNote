'use strict'

const uniIdCommon = require('uni-id-common')

function buildClientInfo(context = {}) {
	const clientInfo = {}
	Object.keys(context || {}).forEach((key) => {
		if (typeof context[key] !== 'object' && typeof context[key] !== 'function') {
			clientInfo[key] = context[key]
		}
	})
	clientInfo.clientIP = context.CLIENTIP
	clientInfo.userAgent = context.CLIENTUA
	clientInfo.source = context.SOURCE
	clientInfo.os = context.OS
	clientInfo.platform = context.PLATFORM
	return clientInfo
}

/**
 * 校验 uni-id token 换取 uid
 * 返回 null 表示鉴权失败（不抛异常，WebSocket 场景用消息回执更友好）
 */
async function resolveUidByToken(token = '', context = {}) {
	const value = String(token || '').trim()
	if (!value) {
		return null
	}
	try {
		const uniId = uniIdCommon.createInstance({
			clientInfo: buildClientInfo(context)
		})
		const result = await uniId.checkToken(value)
		if (result && result.errCode) {
			console.warn('game-ws checkToken failed', result.errCode)
			return null
		}
		return (result && result.uid) || null
	} catch (error) {
		console.warn('game-ws resolveUidByToken failed', error)
		return null
	}
}

module.exports = {
	buildClientInfo,
	resolveUidByToken
}
