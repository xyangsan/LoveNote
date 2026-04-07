'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { getActiveCoupleByUid } = require('../lib/couple')
const {
	andWhereConditions,
	buildCreatorVisibilityCondition
} = require('../lib/content-scope')
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

			const albumWhereCondition = buildCreatorVisibilityCondition({
				uid,
				activeCouple,
				creatorField: 'create_uid'
			})
			const dailyWhereCondition = andWhereConditions(
				buildCreatorVisibilityCondition({
					uid,
					activeCouple,
					creatorField: 'author_uid'
				}),
				{ is_deleted: false }
			)
			const anniversaryWhereCondition = andWhereConditions(
				buildCreatorVisibilityCondition({
					uid,
					activeCouple,
					creatorField: 'creator_uid'
				}),
				{ is_deleted: false }
			)
			const wishPlanBaseWhereCondition = andWhereConditions(
				buildCreatorVisibilityCondition({
					uid,
					activeCouple,
					creatorField: 'create_uid'
				}),
				{ is_deleted: false }
			)

			const [albumRes, dailyRes, anniversaryRes, wishRes, planRes, wishPlanRes, completedRes] = await Promise.all([
				albumCollection.where(albumWhereCondition).count(),
				dailyPostCollection.where(dailyWhereCondition).count(),
				anniversaryCollection.where(anniversaryWhereCondition).count(),
				wishPlanCollection.where(andWhereConditions(wishPlanBaseWhereCondition, {
					type: PLAN_TYPE_WISH
				})).count(),
				wishPlanCollection.where(andWhereConditions(wishPlanBaseWhereCondition, {
					type: PLAN_TYPE_PLAN
				})).count(),
				wishPlanCollection.where(wishPlanBaseWhereCondition).count(),
				wishPlanCollection.where(andWhereConditions(wishPlanBaseWhereCondition, {
					status: PLAN_STATUS_COMPLETED
				})).count()
			])

			const dailyTotal = normalizeCount(dailyRes && dailyRes.total)
			const overview = buildEmptyOverview()
			overview.isBound = Boolean(activeCouple && activeCouple._id)
			overview.album_total = normalizeCount(albumRes && albumRes.total)
			overview.daily_total = dailyTotal
			overview.anniversary_total = normalizeCount(anniversaryRes && anniversaryRes.total)
			overview.plan_total = normalizeCount(planRes && planRes.total)
			overview.wish_total = normalizeCount(wishRes && wishRes.total)
			overview.wish_plan_total = normalizeCount(wishPlanRes && wishPlanRes.total)
			overview.completed_total = normalizeCount(completedRes && completedRes.total)
			overview.moment_total = dailyTotal

			return {
				errCode: 0,
				data: overview
			}
		} catch (error) {
			return formatError(error, '获取统计数据失败')
		}
	}
}
