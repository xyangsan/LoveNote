'use strict'

/**
 * 首页聚合面板：把「首屏要的 8 个接口」收成一次云函数调用。
 *
 * 设计约束：
 *   1. 只做搬运，不重写查询 —— 全部复用既有 service，返回结构与单接口逐字段一致，
 *      前端原有的格式化代码不用改；
 *   2. 任何一块失败都不拖垮整页：失败的块置 null 并写进 data.partial，前端按块回退；
 *   3. 鉴权由 middleware 统一完成，这里只取 ctx.authState，不再重复校验 token；
 *   4. 情侣关系在本次调用内只查一次（runWithCoupleCache），7 个 service 共享同一个结果。
 */

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { runWithCoupleCache } = require('../lib/couple')
const { formatError } = require('../lib/response')

const DEFAULT_LIMITS = {
	anniversary: 2,
	photo: 8,
	plan: 3
}
const MAX_LIMITS = {
	anniversary: 5,
	photo: 20,
	plan: 10
}

function normalizeLimit(value, key) {
	const fallback = DEFAULT_LIMITS[key]
	const num = parseInt(value, 10)
	if (!Number.isFinite(num) || num <= 0) {
		return fallback
	}
	return Math.min(MAX_LIMITS[key], num)
}

function normalizeOptions(params = {}) {
	const source = params && typeof params === 'object' ? params : {}
	return {
		// 双人日常 / 聚会游戏在运营端被关掉时，前端不会渲染对应卡片，这里直接不查
		feed: source.feed !== false,
		game: source.game !== false,
		anniversaryLimit: normalizeLimit(source.anniversaryLimit, 'anniversary'),
		photoLimit: normalizeLimit(source.photoLimit, 'photo'),
		planLimit: normalizeLimit(source.planLimit, 'plan')
	}
}

function isOk(result) {
	return Boolean(result) && (!result.errCode || Number(result.errCode) === 0)
}

function pickData(result) {
	return result && result.data ? result.data : null
}

/** 去掉单接口的响应信封，只留业务字段（couple 是平铺结构，没有 data 层） */
function stripEnvelope(result) {
	if (!result || typeof result !== 'object') {
		return null
	}
	const payload = Object.assign({}, result)
	delete payload.errCode
	delete payload.errMsg
	delete payload.newToken
	return payload
}

async function settle(name, factory, partial) {
	try {
		const result = await factory()
		if (!isOk(result)) {
			partial.push(name)
			return null
		}
		return result
	} catch (error) {
		partial.push(name)
		console.warn(`home/getDashboard ${name} failed`, error)
		return null
	}
}

module.exports = class HomeService extends Service {
	async getDashboard(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const options = normalizeOptions(params)
			const partial = []

			const data = await runWithCoupleCache(async () => {
				const tasks = [
					settle('user', () => this.service.user.getMine(), partial),
					settle('couple', () => this.service.couple.getCenter(), partial),
					settle('overview', () => this.service.stats.getOverview(), partial),
					settle('points', () => this.service.points.getSummary(), partial),
					settle('anniversary', () => this.service.anniversary.getList({
						page: 1,
						pageSize: options.anniversaryLimit
					}), partial),
					settle('photo', () => this.service.photo.getList({
						page: 1,
						pageSize: options.photoLimit
					}), partial),
					settle('plan', () => this.service.plan.getList({
						page: 1,
						pageSize: options.planLimit
					}), partial)
				]

				if (options.feed) {
					tasks.push(settle('daily', () => this.service.daily.getList({
						page: 1,
						pageSize: 1
					}), partial))
				}
				if (options.game) {
					tasks.push(settle('game', () => this.service.game.getActiveRoom(), partial))
				}

				const [
					userRes,
					coupleRes,
					overviewRes,
					pointsRes,
					anniversaryRes,
					photoRes,
					planRes,
					dailyRes,
					roomRes
				] = await Promise.all(tasks)

				const roomData = pickData(roomRes)

				return {
					userInfo: userRes ? (userRes.userInfo || null) : null,
					couple: stripEnvelope(coupleRes),
					overview: pickData(overviewRes),
					points: pickData(pointsRes),
					anniversary: pickData(anniversaryRes),
					photo: pickData(photoRes),
					plan: pickData(planRes),
					daily: dailyRes ? pickData(dailyRes) : null,
					room: roomData ? (roomData.room || null) : null,
					partial
				}
			})

			// newToken 必须留在顶层，前端 router.js 靠它续期
			return Object.assign({}, authState.response, {
				errCode: 0,
				data
			})
		} catch (error) {
			return formatError(error, '获取首页数据失败')
		}
	}
}
