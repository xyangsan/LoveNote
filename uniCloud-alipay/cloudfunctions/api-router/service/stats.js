'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { getActiveCoupleByUid } = require('../lib/couple')
const {
	albumCollection,
	anniversaryCollection,
	dailyPostCollection,
	wishPlanCollection
} = require('../lib/db')
const { formatError } = require('../lib/response')

const PLAN_TYPE_WISH = 'wish'
const PLAN_TYPE_PLAN = 'plan'
const PLAN_STATUS_COMPLETED = 'completed'

function normalizeCount(value = 0) {
	const nextValue = Number(value)
	if (Number.isNaN(nextValue)) {
		return 0
	}
	return Math.max(0, Math.floor(nextValue))
}

function buildEmptyOverview() {
	return {
		isBound: false,
		album_total: 0,
		daily_total: 0,
		anniversary_total: 0,
		plan_total: 0,
		wish_total: 0,
		wish_plan_total: 0,
		completed_total: 0,
		moment_total: 0
	}
}

module.exports = class StatsService extends Service {
	async getOverview() {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			if (!activeCouple || !activeCouple._id) {
				return {
					errCode: 0,
					data: buildEmptyOverview()
				}
			}

			const coupleId = activeCouple._id
			const [albumRes, dailyRes, anniversaryRes, wishRes, planRes, wishPlanRes, completedRes] = await Promise.all([
				albumCollection.where({
					couple_id: coupleId
				}).count(),
				dailyPostCollection.where({
					couple_id: coupleId,
					is_deleted: false
				}).count(),
				anniversaryCollection.where({
					couple_id: coupleId,
					is_deleted: false
				}).count(),
				wishPlanCollection.where({
					couple_id: coupleId,
					type: PLAN_TYPE_WISH,
					is_deleted: false
				}).count(),
				wishPlanCollection.where({
					couple_id: coupleId,
					type: PLAN_TYPE_PLAN,
					is_deleted: false
				}).count(),
				wishPlanCollection.where({
					couple_id: coupleId,
					is_deleted: false
				}).count(),
				wishPlanCollection.where({
					couple_id: coupleId,
					status: PLAN_STATUS_COMPLETED,
					is_deleted: false
				}).count()
			])

			const dailyTotal = normalizeCount(dailyRes && dailyRes.total)

			return {
				errCode: 0,
				data: {
					isBound: true,
					album_total: normalizeCount(albumRes && albumRes.total),
					daily_total: dailyTotal,
					anniversary_total: normalizeCount(anniversaryRes && anniversaryRes.total),
					plan_total: normalizeCount(planRes && planRes.total),
					wish_total: normalizeCount(wishRes && wishRes.total),
					wish_plan_total: normalizeCount(wishPlanRes && wishPlanRes.total),
					completed_total: normalizeCount(completedRes && completedRes.total),
					moment_total: dailyTotal
				}
			}
		} catch (error) {
			return formatError(error, '获取统计数据失败')
		}
	}
}
