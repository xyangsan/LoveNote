'use strict'

const { dbCmd } = require('./db')

function isPlainObject(value) {
	return Object.prototype.toString.call(value) === '[object Object]'
}

function isEmptyCondition(condition) {
	if (!condition) {
		return true
	}
	if (!isPlainObject(condition)) {
		return false
	}
	return Object.keys(condition).length === 0
}

function andWhereConditions(...conditions) {
	const validConditions = conditions.filter((item) => !isEmptyCondition(item))
	if (!validConditions.length) {
		return {}
	}
	if (validConditions.length === 1) {
		return validConditions[0]
	}
	return dbCmd.and(validConditions)
}

function getCouplePartnerUid(uid = '', activeCouple = null) {
	const currentUid = String(uid || '').trim()
	if (!currentUid || !activeCouple || typeof activeCouple !== 'object') {
		return ''
	}

	const userAUid = String(activeCouple.user_a_uid || '').trim()
	const userBUid = String(activeCouple.user_b_uid || '').trim()

	if (currentUid === userAUid) {
		return userBUid
	}
	if (currentUid === userBUid) {
		return userAUid
	}
	return ''
}

function getCoupleBindTimestamp(activeCouple = null) {
	const bindTime = Number(
		activeCouple && (activeCouple.bind_date || activeCouple.created_at || 0)
	)
	if (!Number.isFinite(bindTime) || bindTime < 0) {
		return 0
	}
	return bindTime
}

function buildCreatorVisibilityCondition({
	uid = '',
	activeCouple = null,
	creatorField = '',
	partnerCoupleField = 'couple_id'
} = {}) {
	const currentUid = String(uid || '').trim()
	const safeCreatorField = String(creatorField || '').trim()
	if (!currentUid || !safeCreatorField) {
		return {}
	}

	const ownCondition = {
		[safeCreatorField]: currentUid
	}

	const partnerUid = getCouplePartnerUid(currentUid, activeCouple)
	if (!partnerUid) {
		return ownCondition
	}

	const partnerCondition = {
		[safeCreatorField]: partnerUid,
		create_time: dbCmd.gte(getCoupleBindTimestamp(activeCouple))
	}

	const coupleId = String((activeCouple && activeCouple._id) || '').trim()
	const safePartnerCoupleField = String(partnerCoupleField || '').trim()
	if (coupleId && safePartnerCoupleField) {
		partnerCondition[safePartnerCoupleField] = coupleId
	}

	return dbCmd.or([ownCondition, partnerCondition])
}

module.exports = {
	andWhereConditions,
	buildCreatorVisibilityCondition,
	getCoupleBindTimestamp,
	getCouplePartnerUid
}

