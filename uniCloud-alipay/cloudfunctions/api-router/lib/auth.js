'use strict'

const uniIdCommon = require('uni-id-common')
const { dbCmd, userCollection } = require('./db')
const { buildAuthResponse } = require('./response')
const { DEFAULT_ROLE } = require('./constants')

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

function getUniIdToken(event = {}, context = {}) {
	return event.uniIdToken || (event.data && event.data.uniIdToken) || context.uniIdToken || ''
}

function getUniIdInstance(context = {}) {
	return uniIdCommon.createInstance({
		clientInfo: buildClientInfo(context)
	})
}

async function checkAuth(event = {}, context = {}) {
	const uniId = getUniIdInstance(context)
	const authResult = await uniId.checkToken(getUniIdToken(event, context))
	if (authResult.errCode) {
		throw authResult
	}

	return {
		authResult,
		response: buildAuthResponse(authResult)
	}
}

async function ensureDefaultRole(uid) {
	if (!uid) {
		return null
	}

	const getUserRes = await userCollection.doc(uid).get()
	const userRecord = getUserRes && getUserRes.data && getUserRes.data[0] ? getUserRes.data[0] : null
	if (!userRecord) {
		return null
	}

	const currentRole = Array.isArray(userRecord.role) ? userRecord.role : []
	const nextRole = currentRole.includes(DEFAULT_ROLE)
		? currentRole
		: currentRole.concat(DEFAULT_ROLE)

	const updateData = {
		updated_at: Date.now()
	}

	if (!currentRole.includes(DEFAULT_ROLE)) {
		updateData.role = nextRole
	}

	if (!userRecord.created_at) {
		updateData.created_at = userRecord.register_date || Date.now()
	}

	if (Object.keys(updateData).length > 1 || !userRecord.created_at) {
		await userCollection.doc(uid).update(updateData)
		const refreshedRes = await userCollection.doc(uid).get()
		return refreshedRes && refreshedRes.data && refreshedRes.data[0] ? refreshedRes.data[0] : null
	}

	return userRecord
}

module.exports = {
	buildClientInfo,
	getUniIdToken,
	getUniIdInstance,
	checkAuth,
	ensureDefaultRole
}
