'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { getUserById } = require('../lib/user-base')
const {
	COUPLE_STATUS_PENDING,
	COUPLE_STATUS_BOUND,
	COUPLE_STATUS_UNBOUND,
	COUPLE_STATUS_CLOSED,
	COUPLE_STATUS_CANCELLED,
	getRequesterUid,
	getCoupleById,
	getActiveCoupleByUid,
	getOutgoingPendingCouples,
	getExistingPendingRelationBetween,
	getCoupleParticipantUids,
	runWithCoupleLocks,
	closePendingCouplesForUsers,
	buildCoupleCenterPayload
} = require('../lib/couple')
const { coupleCollection } = require('../lib/db')
const { DEFAULT_NICKNAME } = require('../lib/constants')
const { formatError } = require('../lib/response')

module.exports = class CoupleService extends Service {
	async getCenter() {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			return Object.assign({}, authState.response, {
				errCode: 0,
				...(await buildCoupleCenterPayload(authState.authResult.uid))
			})
		} catch (error) {
			return formatError(error, '获取情侣信息失败')
		}
	}

	async sendRequest(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const targetUid = String(params.targetUid || '').trim()

			if (!targetUid) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '请输入要绑定的用户 ID'
				}
			}

			if (targetUid === uid) {
				return {
					errCode: 'love-note-invalid-target',
					errMsg: '不能向自己发起绑定请求'
				}
			}

			const targetUserPreview = await getUserById(targetUid)
			if (!targetUserPreview) {
				return {
					errCode: 'love-note-target-not-found',
					errMsg: '未找到该用户，请确认 ID 是否正确'
				}
			}

			return await runWithCoupleLocks([uid, targetUid], async () => {
				const [currentUser, targetUser, selfActiveCouple, targetActiveCouple, existingOutgoing, existingPendingRelation] = await Promise.all([
					getUserById(uid),
					getUserById(targetUid),
					getActiveCoupleByUid(uid),
					getActiveCoupleByUid(targetUid),
					getOutgoingPendingCouples(uid),
					getExistingPendingRelationBetween(uid, targetUid)
				])

				if (!currentUser) {
					return {
						errCode: 'uni-id-account-not-exists',
						errMsg: '当前用户不存在'
					}
				}

				if (!targetUser) {
					return {
						errCode: 'love-note-target-not-found',
						errMsg: '未找到该用户，请确认 ID 是否正确'
					}
				}

				if (selfActiveCouple) {
					return {
						errCode: 'love-note-couple-already-bound',
						errMsg: '你已绑定情侣，解绑后才能重新绑定'
					}
				}

				if (targetActiveCouple) {
					return {
						errCode: 'love-note-target-bound',
						errMsg: '对方当前已绑定情侣'
					}
				}

				if (existingOutgoing.length) {
					return {
						errCode: 'love-note-request-exists',
						errMsg: '你已有待处理的绑定请求，请先撤回后再发起新的请求'
					}
				}

				if (existingPendingRelation) {
					return {
						errCode: 'love-note-request-exists',
						errMsg: getRequesterUid(existingPendingRelation) === uid
							? '绑定请求已发送，请等待对方处理'
							: '对方已向你发起绑定请求，请在待处理请求中确认'
					}
				}

				const now = Date.now()
				await coupleCollection.add({
					user_a_uid: uid,
					user_b_uid: targetUid,
					partner_nickname: targetUser.nickname || targetUser.username || DEFAULT_NICKNAME,
					status: COUPLE_STATUS_PENDING,
					created_by: uid,
					created_at: now,
					updated_at: now
				})

				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '绑定请求已发送',
					...(await buildCoupleCenterPayload(uid))
				})
			})
		} catch (error) {
			return formatError(error, '发送绑定请求失败')
		}
	}

	async reviewRequest(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const requestId = String(params.requestId || '').trim()
			const action = String(params.action || 'accept').trim()

			if (!requestId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少请求 ID'
				}
			}

			const relation = await getCoupleById(requestId)
			if (!relation || Number(relation.status) !== COUPLE_STATUS_PENDING) {
				return {
					errCode: 'love-note-request-not-found',
					errMsg: '该绑定请求不存在或已处理'
				}
			}

			if (relation.user_b_uid !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你无权处理这条绑定请求'
				}
			}

			const partnerUid = getRequesterUid(relation)
			return await runWithCoupleLocks([uid, partnerUid], async () => {
				const currentRelation = await getCoupleById(requestId)
				if (!currentRelation || Number(currentRelation.status) !== COUPLE_STATUS_PENDING) {
					return {
						errCode: 'love-note-request-not-found',
						errMsg: '该绑定请求不存在或已处理'
					}
				}

				if (currentRelation.user_b_uid !== uid) {
					return {
						errCode: 'love-note-no-permission',
						errMsg: '你无权处理这条绑定请求'
					}
				}

				const now = Date.now()
				if (action === 'reject') {
					await coupleCollection.doc(requestId).update({
						status: COUPLE_STATUS_CLOSED,
						last_action_uid: uid,
						updated_at: now
					})

					return Object.assign({}, authState.response, {
						errCode: 0,
						errMsg: '已拒绝绑定请求',
						...(await buildCoupleCenterPayload(uid))
					})
				}

				if (action !== 'accept') {
					return {
						errCode: 'love-note-invalid-action',
						errMsg: '不支持的处理动作'
					}
				}

				const [selfActiveCouple, partnerActiveCouple] = await Promise.all([
					getActiveCoupleByUid(uid),
					getActiveCoupleByUid(partnerUid)
				])

				if (selfActiveCouple) {
					return {
						errCode: 'love-note-couple-already-bound',
						errMsg: '你已绑定情侣，解绑后才能处理新的请求'
					}
				}

				if (partnerActiveCouple) {
					return {
						errCode: 'love-note-target-bound',
						errMsg: '对方已与其他人完成绑定'
					}
				}

				await coupleCollection.doc(requestId).update({
					status: COUPLE_STATUS_BOUND,
					bind_date: now,
					last_action_uid: uid,
					updated_at: now
				})
				await closePendingCouplesForUsers([uid, partnerUid], {
					excludeId: requestId,
					status: COUPLE_STATUS_CLOSED,
					actionUid: uid
				})

				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '绑定成功',
					...(await buildCoupleCenterPayload(uid))
				})
			})
		} catch (error) {
			return formatError(error, '处理绑定请求失败')
		}
	}

	async cancelRequest(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const requestId = String(params.requestId || '').trim()

			if (!requestId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少请求 ID'
				}
			}

			const relation = await getCoupleById(requestId)
			if (!relation || Number(relation.status) !== COUPLE_STATUS_PENDING) {
				return {
					errCode: 'love-note-request-not-found',
					errMsg: '该绑定请求不存在或已处理'
				}
			}

			if (getRequesterUid(relation) !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你只能撤回自己发起的绑定请求'
				}
			}

			return await runWithCoupleLocks(getCoupleParticipantUids(relation), async () => {
				const currentRelation = await getCoupleById(requestId)
				if (!currentRelation || Number(currentRelation.status) !== COUPLE_STATUS_PENDING) {
					return {
						errCode: 'love-note-request-not-found',
						errMsg: '该绑定请求不存在或已处理'
					}
				}

				if (getRequesterUid(currentRelation) !== uid) {
					return {
						errCode: 'love-note-no-permission',
						errMsg: '你只能撤回自己发起的绑定请求'
					}
				}

				await coupleCollection.doc(requestId).update({
					status: COUPLE_STATUS_CANCELLED,
					last_action_uid: uid,
					updated_at: Date.now()
				})

				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '已撤回绑定请求',
					...(await buildCoupleCenterPayload(uid))
				})
			})
		} catch (error) {
			return formatError(error, '撤回绑定请求失败')
		}
	}

	async unbind(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const relationId = String(params.relationId || '').trim()
			const activeRelation = relationId ? await getCoupleById(relationId) : await getActiveCoupleByUid(uid)

			if (!activeRelation || Number(activeRelation.status) !== COUPLE_STATUS_BOUND) {
				return {
					errCode: 'love-note-couple-not-found',
					errMsg: '当前没有可解绑的情侣关系'
				}
			}

			if (activeRelation.user_a_uid !== uid && activeRelation.user_b_uid !== uid) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '你无权解绑这条关系'
				}
			}

			return await runWithCoupleLocks(getCoupleParticipantUids(activeRelation), async () => {
				const currentRelation = activeRelation._id
					? await getCoupleById(activeRelation._id)
					: await getActiveCoupleByUid(uid)

				if (!currentRelation || Number(currentRelation.status) !== COUPLE_STATUS_BOUND) {
					return {
						errCode: 'love-note-couple-not-found',
						errMsg: '当前没有可解绑的情侣关系'
					}
				}

				if (currentRelation.user_a_uid !== uid && currentRelation.user_b_uid !== uid) {
					return {
						errCode: 'love-note-no-permission',
						errMsg: '你无权解绑这条关系'
					}
				}

				const now = Date.now()
				await coupleCollection.doc(currentRelation._id).update({
					status: COUPLE_STATUS_UNBOUND,
					unbind_date: now,
					last_action_uid: uid,
					updated_at: now
				})

				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '已解绑当前情侣关系',
					...(await buildCoupleCenterPayload(uid))
				})
			})
		} catch (error) {
			return formatError(error, '解绑情侣关系失败')
		}
	}
}
