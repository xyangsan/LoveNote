'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { getActiveCoupleByUid } = require('../lib/couple')
const pointsLib = require('../lib/points')
const { formatError } = require('../lib/response')

module.exports = class PointsService extends Service {
	/** 心动点摘要：余额、今日、任务进度、挑战档位（顺带结算每日相伴与挑战奖励） */
	async getSummary() {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			const summary = await pointsLib.getSummary(uid, activeCouple)

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: Object.assign({}, summary, {
					partnerNickname: activeCouple ? (activeCouple.partner_nickname || '') : '',
					bindDate: activeCouple ? Number(activeCouple.bind_date || 0) : 0,
					bindDays: activeCouple && activeCouple.bind_date
						? Math.max(1, Math.floor((Date.now() - Number(activeCouple.bind_date)) / 86400000) + 1)
						: 0
				})
			})
		} catch (error) {
			return formatError(error, '获取心动点失败')
		}
	}

	/** 心动点明细：最近流水 + 今日/本周/累计 */
	async getLogs(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const data = await pointsLib.getLogs(uid, {
				limit: params.limit,
				before: params.before
			})

			return Object.assign({}, authState.response, {
				errCode: 0,
				data
			})
		} catch (error) {
			return formatError(error, '获取心动点记录失败')
		}
	}

	/** 每日签到：基础 10 点 + 连续签到附加，每天一次 */
	async signIn() {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			const result = await pointsLib.signIn(uid, activeCouple)

			if (!result.ok) {
				const messages = {
					unbound: '绑定情侣后才能签到',
					already: '今天已经签过了',
					failed: '签到失败，请稍后重试'
				}
				return Object.assign({}, authState.response, {
					errCode: 'love-note-sign-in-failed',
					errMsg: messages[result.reason] || '签到失败',
					data: result
				})
			}

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: result
			})
		} catch (error) {
			return formatError(error, '签到失败')
		}
	}

	/** 手动领取每日挑战奖励：达标且当天未领取才发放 */
	async claimChallenge(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			// 绑定关系由服务端查，不信任前端传的 coupleId
			const activeCouple = await getActiveCoupleByUid(uid)
			const result = await pointsLib.claimChallenge(uid, activeCouple, params.tierTaskCount)

			if (!result.ok) {
				const messages = {
					invalid: '挑战档位不存在',
					unbound: '绑定情侣后才能领取',
					'not-reached': '还没完成这个档位',
					claimed: '这个档位今天已经领过了',
					failed: '领取失败，请稍后重试'
				}
				return Object.assign({}, authState.response, {
					errCode: 'love-note-claim-challenge-failed',
					errMsg: messages[result.reason] || '领取失败',
					data: result
				})
			}

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: result
			})
		} catch (error) {
			return formatError(error, '领取挑战奖励失败')
		}
	}
}
