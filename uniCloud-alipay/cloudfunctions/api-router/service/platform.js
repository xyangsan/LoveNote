'use strict'

/**
 * 运营管理（平台级统计）服务。
 *
 * 与 service/stats.js 的区别：
 *   stats.getOverview        —— 当前登录用户视角（我自己有多少纪念日/相册…）
 *   platform.getOverview     —— 全平台视角，仅 admin 角色可访问
 *
 * 统计口径（与页面文案一致）：
 *   进入小程序 = 当日 love-visits 去重访客数（登录用户取 uid，游客取本地 device_id）
 *   登录       = 当日 uni-id-log(type=login) 条数；流水没积累时回退到 last_login_date 近似
 *   绑定       = 当日 love-couples.bind_date 且 status=1
 *   渗透率     = 该模块参与用户数（去重） ÷ 注册用户数
 */

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { formatError } = require('../lib/response')
const {
	dbCmd,
	userCollection,
	coupleCollection,
	feedbackCollection,
	albumCollection,
	photoCollection,
	dailyPostCollection,
	anniversaryCollection,
	wishPlanCollection,
	gameRecordCollection,
	visitCollection,
	dailyStatCollection,
	uniIdLogCollection,
	adpRevenueCollection,
	appRevenueCollection,
	adPositionCollection,
	adSyncLogCollection
} = require('../lib/db')
const {
	toDateKey,
	todayKey,
	dayStartTs,
	dayEndTs,
	addDays,
	diffDays,
	buildDateKeys,
	formatRangeLabel
} = require('../lib/date-key')
const { LOG_TYPE_LOGIN } = require('../lib/login-log')

const COUPLE_STATUS_BOUND = 1

const PLAN_STATUS_COMPLETED = 'completed'

const RANGE_PRESETS = {
	today: 1,
	'7d': 7,
	'30d': 30
}
const DEFAULT_RANGE_KEY = '7d'
const MAX_RANGE_DAYS = 90

// uni-ad 广告数据维度：本小程序只看「国内广告 + 小程序」这一格
const AD_REGION_CHINA = 1
const AD_PLATFORM_MP = 4
// 本应用在 uni-ad 侧的记账 appid：DCloud appid / 微信小程序 appid 两种写法都认
// （uni-ad 账户下可能有多个应用，必须按 appid 收敛，否则收益是几个应用的合计）
const AD_APPID_CANDIDATES = ['__UNI__19A522B', 'wxd18ed19b94e50036']

// 收益日报是 T+1，最新只到昨天；endKey 一律收敛到这一天
const AD_LATEST_DAY_OFFSET = -1
// 广告查询支持的预设区间（custom 走 startDate + endDate）
const AD_RANGE_PRESETS = ['yesterday', '7d', '30d', 'month', 'lastMonth']
const AD_QUICK_KEYS = ['yesterday', 'last7', 'month', 'lastMonth']
// 单日聚合最多覆盖「所选区间 + 环比区间 + 四个快捷窗口」，按上限留足余量
const AD_TREND_ROW_LIMIT = MAX_RANGE_DAYS * 3

const AD_SYNC_STATUS_TEXT = {
	0: '待同步',
	1: '已同步',
	2: '同步中',
	3: '同步失败'
}

// ad_platform 字典（对账用）
const AD_PLATFORM_TEXT = {
	1: 'APP-DCloud 快捷广告',
	2: 'APP-渠道 SDK 广告',
	3: 'Web 广告',
	4: '小程序广告'
}

const AD_TYPE_TEXT = {
	1: '开屏',
	4: '信息流',
	7: '全屏视频',
	9: '激励视频',
	10: 'Draw 视频',
	13: '互动游戏',
	14: '内容联盟',
	15: '插屏广告',
	17: '小程序格子广告',
	18: '互动红包',
	19: '小程序视频',
	91: '开屏',
	92: 'PUSH',
	93: '红包',
	94: 'uniMP'
}

/** 'YYYY-MM-DD' → 20261113（uni-ad 的 revenue_date 是 yyyymmdd 整数） */
function toIntDate(dateKey) {
	return Number(String(dateKey || '').replace(/-/g, ''))
}

/** 20261113 → '2026-11-13' */
function formatIntDate(intDate) {
	const value = String(intDate || '')
	if (value.length !== 8) {
		return ''
	}
	return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

/** 厘 → 元，保留两位小数 */
function liToYuan(li) {
	const value = Number(li) || 0
	return Math.round(value / 10) / 100
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeCount(value) {
	const next = Number(value)
	if (!Number.isFinite(next)) {
		return 0
	}
	return Math.max(0, Math.floor(next))
}

function normalizeRate(numerator, denominator) {
	const top = Number(numerator) || 0
	const bottom = Number(denominator) || 0
	if (bottom <= 0) {
		return 0
	}
	return Math.round((top / bottom) * 1000) / 10
}

/** 'YYYY-MM-DD' → 当月 1 号 */
function monthStartOf(dateKey) {
	return `${String(dateKey || '').slice(0, 7)}-01`
}

/**
 * 广告查询区间。
 *
 * 预设：yesterday（昨日）/ 7d / 30d / month（本月至今）/ lastMonth（上月整月）
 * 自定义：startDate + endDate（'YYYY-MM-DD'，顺序反了自动纠正）
 *
 * 收益数据 T+1，endKey 一律收敛到昨天；跨度超过 90 天按 90 天截断。
 */
function resolveAdRange(data = {}) {
	const today = todayKey()
	const yesterday = addDays(today, AD_LATEST_DAY_OFFSET)
	const startDate = String(data.startDate || '').trim()
	const endDate = String(data.endDate || '').trim()

	let key = '7d'
	let startKey = yesterday
	let endKey = yesterday

	if (DATE_KEY_PATTERN.test(startDate) && DATE_KEY_PATTERN.test(endDate)) {
		key = 'custom'
		startKey = startDate <= endDate ? startDate : endDate
		endKey = startDate <= endDate ? endDate : startDate
	} else {
		const requested = String(data.range || '').trim()
		key = AD_RANGE_PRESETS.includes(requested) ? requested : key

		if (key === 'month') {
			startKey = monthStartOf(today)
			endKey = yesterday
		} else if (key === 'lastMonth') {
			const lastMonthEnd = addDays(monthStartOf(today), -1)
			startKey = monthStartOf(lastMonthEnd)
			endKey = lastMonthEnd
		} else {
			// 按天数回溯时以「昨天」为基准：今天的数据还没推过来，从今天回溯会少一天
			const days = key === 'yesterday' ? 1 : key === '30d' ? 30 : 7
			endKey = yesterday
			startKey = addDays(yesterday, -(days - 1))
		}
	}

	let clamped = false
	if (endKey > yesterday) {
		endKey = yesterday
		clamped = true
	}
	if (startKey > endKey) {
		// 每月 1 号查「本月」时上月 1 号之后还没有 T+1 数据，退化成昨日单日，避免区间倒挂
		startKey = endKey
		clamped = true
	}
	if (diffDays(startKey, endKey) + 1 > MAX_RANGE_DAYS) {
		startKey = addDays(endKey, -(MAX_RANGE_DAYS - 1))
		clamped = true
	}

	return {
		key,
		startKey,
		endKey,
		days: diffDays(startKey, endKey) + 1,
		label: formatRangeLabel(startKey, endKey),
		clamped
	}
}

/** 「昨日 / 近 7 日 / 本月 / 上月」四个快捷窗口，跟随当前筛选条件，和所选区间互相独立 */
function buildAdQuickWindows(today = todayKey()) {
	const yesterday = addDays(today, AD_LATEST_DAY_OFFSET)
	const monthStart = monthStartOf(today)
	const lastMonthEnd = addDays(monthStart, -1)

	return {
		yesterday: { label: '昨日', startKey: yesterday, endKey: yesterday },
		last7: { label: '近 7 日', startKey: addDays(yesterday, -6), endKey: yesterday },
		month: { label: '本月', startKey: monthStart, endKey: yesterday },
		lastMonth: { label: '上月', startKey: monthStartOf(lastMonthEnd), endKey: lastMonthEnd }
	}
}

/**
 * 确定本应用在 uni-ad 报表里的 appid。
 *
 * uni-ad 账户下可能挂了多个应用，不按 appid 收敛会把别的应用的收益算进来。
 * 规则：只有 1 个 appid 直接用；多个时优先匹配本项目的 DCloud / 微信 appid；
 * 都匹配不上就不加过滤，但把 appidCount 带回前端提示「未按应用过滤」。
 */
async function resolveAdAppid() {
	try {
		const result = await adpRevenueCollection
			.aggregate()
			.match({ ad_region: AD_REGION_CHINA, ad_platform: AD_PLATFORM_MP })
			.group({ _id: '$appid' })
			.limit(20)
			.end()

		const rows = result && Array.isArray(result.data) ? result.data : []
		const ids = rows.map((row) => String((row && row._id) || '')).filter(Boolean)

		if (ids.length === 1) {
			return { appid: ids[0], appidCount: 1, scoped: true }
		}
		const hit = AD_APPID_CANDIDATES.find((candidate) => ids.includes(candidate))
		if (hit) {
			return { appid: hit, appidCount: ids.length, scoped: true }
		}
		return { appid: '', appidCount: ids.length, scoped: false }
	} catch (error) {
		console.error('resolve ad appid failed', error)
		return { appid: '', appidCount: 0, scoped: false }
	}
}

/** 计数；where 传 null 表示全表 */
async function countWhere(collection, where) {
	const query = where ? collection.where(where) : collection
	const result = await query.count()
	return normalizeCount(result && result.total)
}

/**
 * 去重计数：按 field 分组后再数分组个数。
 * 用 .group({_id:null,total:sum(1)}) 收敛成一行，避开 aggregate 默认 20 条返回上限。
 */
async function distinctCount(collection, match = {}, field) {
	const $ = dbCmd.aggregate
	const baseMatch = Object.assign({}, match)
	if (field) {
		baseMatch[field] = dbCmd.neq(null)
	}

	const result = await collection
		.aggregate()
		.match(baseMatch)
		.group({ _id: field ? `$${field}` : null })
		.group({ _id: null, total: $.sum(1) })
		.end()

	const row = result && Array.isArray(result.data) ? result.data[0] : null
	return normalizeCount(row && row.total)
}

async function readUserRecord(uid) {
	if (!uid) {
		return null
	}
	const result = await userCollection.doc(uid).get()
	const list = result && Array.isArray(result.data) ? result.data : []
	return list[0] || null
}

function hasAdminRole(userRecord) {
	const roleList = Array.isArray(userRecord && userRecord.role) ? userRecord.role : []
	return roleList.some((item) => String(item || '').trim().toLowerCase() === 'admin')
}

/** 时间范围：优先自定义区间，其次预设（today / 7d / 30d） */
function resolveRange(data = {}) {
	const today = todayKey()
	const startDate = String(data.startDate || '').trim()
	const endDate = String(data.endDate || '').trim()

	if (DATE_KEY_PATTERN.test(startDate) && DATE_KEY_PATTERN.test(endDate)) {
		const startKey = startDate <= endDate ? startDate : endDate
		const endKey = startDate <= endDate ? endDate : startDate
		const clampedStart = diffDays(startKey, endKey) + 1 > MAX_RANGE_DAYS
			? addDays(endKey, -(MAX_RANGE_DAYS - 1))
			: startKey
		return {
			key: 'custom',
			startKey: clampedStart,
			endKey,
			days: diffDays(clampedStart, endKey) + 1,
			label: formatRangeLabel(clampedStart, endKey)
		}
	}

	const requestedKey = String(data.range || '').trim()
	const rangeKey = RANGE_PRESETS[requestedKey] ? requestedKey : DEFAULT_RANGE_KEY
	const days = RANGE_PRESETS[rangeKey]
	const startKey = addDays(today, -(days - 1))

	return {
		key: rangeKey,
		startKey,
		endKey: today,
		days,
		label: formatRangeLabel(startKey, today)
	}
}

/** 某天的登录人数：优先登录流水，流水为空时回退 last_login_date */
async function countLoginsInDay(dateKey) {
	const start = dayStartTs(dateKey)
	const end = dayEndTs(dateKey)

	const fromLog = await countWhere(uniIdLogCollection, {
		type: LOG_TYPE_LOGIN,
		create_date: dbCmd.gte(start).and(dbCmd.lt(end))
	})

	if (fromLog > 0) {
		return { total: fromLog, source: 'log' }
	}

	const fallback = await countWhere(userCollection, {
		last_login_date: dbCmd.gte(start).and(dbCmd.lt(end))
	})
	return { total: fallback, source: fallback > 0 ? 'last_login_date' : 'empty' }
}

/** 读某天的历史快照（platform-daily-stats 每天 00:10 写入）；没有就返回 null */
async function readDailySnapshot(dateKey) {
	try {
		const result = await dailyStatCollection.where({ date_key: dateKey }).limit(1).get()
		const rows = result && Array.isArray(result.data) ? result.data : []
		return rows[0] || null
	} catch (error) {
		console.error('read daily snapshot failed', error)
		return null
	}
}

async function getFeedbackSummary() {
	const $ = dbCmd.aggregate
	const result = await feedbackCollection
		.aggregate()
		.match({ is_deleted: dbCmd.neq(true) })
		.group({ _id: '$status', total: $.sum(1) })
		.end()

	const rows = result && Array.isArray(result.data) ? result.data : []
	const summary = {
		total: 0,
		pending: 0,
		replied: 0,
		resolved: 0
	}

	rows.forEach((row) => {
		const status = Number(row && row._id)
		const total = normalizeCount(row && row.total)
		summary.total += total
		if (status === 0) {
			summary.pending = total
		} else if (status === 1) {
			summary.replied = total
		} else if (status === 2) {
			summary.resolved = total
		}
	})

	return summary
}

module.exports = class PlatformService extends Service {
	/**
	 * 总览：核心指标 + 今日转化漏斗 + 时间范围内的每日趋势 + 反馈概况
	 * 仅 admin
	 */
	async getOverview(data = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState && authState.authResult ? authState.authResult.uid : ''
			const userRecord = await readUserRecord(uid)

			if (!hasAdminRole(userRecord)) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '该接口仅管理员可访问'
				}
			}

			const range = resolveRange(data)
			const nowKey = todayKey()
			const todayStart = dayStartTs(nowKey)
			const todayEnd = dayEndTs(nowKey)

			const [
				totalUsers,
				boundCouples,
				newUsersToday,
				visitsUvToday,
				visitsPvToday,
				loginsToday,
				bindingsToday,
				feedback
			] = await Promise.all([
				countWhere(userCollection, null),
				countWhere(coupleCollection, { status: COUPLE_STATUS_BOUND }),
				countWhere(userCollection, {
					register_date: dbCmd.gte(todayStart).and(dbCmd.lt(todayEnd))
				}),
				distinctCount(visitCollection, { date_key: nowKey }, 'visitor_key'),
				countWhere(visitCollection, { date_key: nowKey }),
				countLoginsInDay(nowKey),
				countWhere(coupleCollection, {
					status: COUPLE_STATUS_BOUND,
					bind_date: dbCmd.gte(todayStart).and(dbCmd.lt(todayEnd))
				}),
				getFeedbackSummary()
			])

			const trend = await this.buildTrend(range, {
				date: nowKey,
				newUsers: newUsersToday,
				visits: visitsUvToday,
				logins: loginsToday.total,
				bindings: bindingsToday
			})

			// 今日关键指标 vs 昨日：昨天读快照（没有快照就按 0 处理，前端显示“—”）
			const snapshot = await readDailySnapshot(addDays(nowKey, -1))
			const todayStats = {
				newUsers: newUsersToday,
				visits: visitsUvToday,
				logins: loginsToday.total,
				bindings: bindingsToday
			}
			const yesterdayStats = {
				newUsers: normalizeCount(snapshot && snapshot.new_users),
				visits: normalizeCount(snapshot && snapshot.visits_uv),
				logins: normalizeCount(snapshot && snapshot.logins_uv),
				bindings: normalizeCount(snapshot && snapshot.new_bindings)
			}
			const rangeTotals = trend.reduce((totals, item) => {
				totals.newUsers += normalizeCount(item.newUsers)
				totals.visits += normalizeCount(item.visits)
				totals.logins += normalizeCount(item.logins)
				totals.bindings += normalizeCount(item.bindings)
				return totals
			}, { newUsers: 0, visits: 0, logins: 0, bindings: 0 })

			return {
				errCode: 0,
				data: {
					range,
					updatedAt: Date.now(),
					summary: {
						totalUsers,
						boundCouples,
						bindRate: normalizeRate(boundCouples * 2, totalUsers),
						newUsersToday,
						activeToday: loginsToday.total,
						activeSource: loginsToday.source
					},
					funnel: {
						visits: {
							label: '进入小程序',
							total: visitsUvToday,
							pv: visitsPvToday
						},
						logins: {
							label: '完成登录',
							total: loginsToday.total,
							rate: normalizeRate(loginsToday.total, visitsUvToday)
						},
						bindings: {
							label: '新增绑定',
							total: bindingsToday,
							rate: normalizeRate(bindingsToday, loginsToday.total)
						}
					},
					trend,
					today: todayStats,
					yesterday: yesterdayStats,
					rangeTotals,
					feedback
				}
			}
		} catch (error) {
			return formatError(error, '获取平台总览失败')
		}
	}

	/**
	 * 模块统计：6 个模块的内容量与去重参与用户数
	 * 累计值，不随时间范围变化；仅 admin
	 */
	async getModuleStats() {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState && authState.authResult ? authState.authResult.uid : ''
			const userRecord = await readUserRecord(uid)

			if (!hasAdminRole(userRecord)) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '该接口仅管理员可访问'
				}
			}

			const notDeleted = { is_deleted: dbCmd.neq(true) }

			const [
				totalUsers,
				boundCouples,
				anniversaryTotal,
				anniversaryUsers,
				albumTotal,
				photoTotal,
				albumUsers,
				dailyTotal,
				dailyUsers,
				wishPlanTotal,
				wishPlanCompleted,
				wishPlanUsers,
				gameTotal,
				gameUsers
			] = await Promise.all([
				countWhere(userCollection, null),
				countWhere(coupleCollection, { status: COUPLE_STATUS_BOUND }),
				countWhere(anniversaryCollection, notDeleted),
				distinctCount(anniversaryCollection, notDeleted, 'creator_uid'),
				countWhere(albumCollection, null),
				countWhere(photoCollection, null),
				distinctCount(albumCollection, {}, 'create_uid'),
				countWhere(dailyPostCollection, notDeleted),
				distinctCount(dailyPostCollection, notDeleted, 'author_uid'),
				countWhere(wishPlanCollection, notDeleted),
				countWhere(wishPlanCollection, Object.assign({}, notDeleted, {
					status: PLAN_STATUS_COMPLETED
				})),
				distinctCount(wishPlanCollection, notDeleted, 'create_uid'),
				countWhere(gameRecordCollection, notDeleted),
				this.countGameUsers(notDeleted)
			])

			const boundUsers = boundCouples * 2

			const modules = [
				{
					key: 'couple',
					name: '情侣空间',
					total: boundCouples,
					unit: '对',
					users: boundUsers,
					penetration: normalizeRate(boundUsers, totalUsers),
					extra: { label: '绑定率', value: normalizeRate(boundUsers, totalUsers), suffix: '%' }
				},
				{
					key: 'anniversary',
					name: '纪念日',
					total: anniversaryTotal,
					unit: '条',
					users: anniversaryUsers,
					penetration: normalizeRate(anniversaryUsers, totalUsers)
				},
				{
					key: 'album',
					name: '相册',
					total: photoTotal,
					unit: '张',
					users: albumUsers,
					penetration: normalizeRate(albumUsers, totalUsers),
					extra: { label: '相册数', value: albumTotal, suffix: ' 个' }
				},
				{
					key: 'daily',
					name: '双人日常',
					total: dailyTotal,
					unit: '条',
					users: dailyUsers,
					penetration: normalizeRate(dailyUsers, totalUsers)
				},
				{
					key: 'wish',
					name: '愿望清单',
					total: wishPlanTotal,
					unit: '条',
					users: wishPlanUsers,
					penetration: normalizeRate(wishPlanUsers, totalUsers),
					extra: {
						label: '完成率',
						value: normalizeRate(wishPlanCompleted, wishPlanTotal),
						suffix: '%'
					}
				},
				{
					key: 'game',
					name: '聚会游戏',
					total: gameTotal,
					unit: '局',
					users: gameUsers,
					penetration: normalizeRate(gameUsers, totalUsers)
				}
			]

			return {
				errCode: 0,
				data: {
					updatedAt: Date.now(),
					totalUsers,
					contentTotal: anniversaryTotal + albumTotal + photoTotal + dailyTotal + wishPlanTotal + gameTotal,
					modules: modules.sort((prev, next) => next.penetration - prev.penetration)
				}
			}
		} catch (error) {
			return formatError(error, '获取模块统计失败')
		}
	}

	/**
	 * 广告收益报表（「运营管理 → 广告」唯一数据源）
	 *
	 * 数据：uni-ad 广告位日报 uni-ad-adp-revenues，由 uni-ad-admin-receiver 云对象每日推送
	 * 口径：ad_region=1 国内、ad_platform=4 小程序；revenue 单位「厘」，统一换算成元
	 * 查询：区间预设（昨日 / 近 7 日 / 近 30 日 / 本月 / 上月 / 自定义）+ 广告位 + 广告类型
	 * 注意：广告数据 T+1，endKey 超过昨天会自动收敛
	 */
	async getAdStats(data = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState && authState.authResult ? authState.authResult.uid : ''
			const userRecord = await readUserRecord(uid)

			if (!hasAdminRole(userRecord)) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '该接口仅管理员可访问'
				}
			}

			const $ = dbCmd.aggregate
			const today = todayKey()
			const yesterday = addDays(today, AD_LATEST_DAY_OFFSET)
			const range = resolveAdRange(data)
			const quickWindows = buildAdQuickWindows(today)

			// 筛选条件：0 / 空串 = 不筛
			const adType = normalizeCount(data.adType)
			const adpId = String(data.adpId || '').trim().slice(0, 64)

			// 按应用收敛，避免把账户下其他应用的收益算进本小程序
			const adScope = await resolveAdAppid()
			const filterWhere = {
				ad_region: AD_REGION_CHINA,
				ad_platform: AD_PLATFORM_MP
			}
			if (adScope.appid) {
				filterWhere.appid = adScope.appid
			}
			if (adType > 0) {
				filterWhere.ad_type = adType
			}
			if (adpId) {
				filterWhere.adp_id = adpId
			}

			// 环比区间：紧邻所选区间、等长
			const prevEndKey = addDays(range.startKey, -1)
			const prevStartKey = addDays(prevEndKey, -(range.days - 1))

			// 一次按天聚合覆盖「所选区间 + 环比区间 + 四个快捷窗口」，后续在内存里按窗口累加，
			// 避免同一份数据反复 aggregate。
			const windowStartKey = [range.startKey, prevStartKey]
				.concat(AD_QUICK_KEYS.map((key) => quickWindows[key].startKey))
				.filter((key) => DATE_KEY_PATTERN.test(key || ''))
				.reduce((min, key) => (!min || key < min ? key : min), '')

			// 收益口径：控制台的「预估收益」= 应用日报（uni-ad-app-revenues）；
			// 展示/点击/广告位明细只有广告位日报（uni-ad-adp-revenues）。
			// 但应用日报没有类型/广告位维度 —— 一旦加了 adType / adpId 筛选，只能回到广告位日报口径。
			const useAppRevenue = adType <= 0 && !adpId
			const revenueDateRange = dbCmd.gte(toIntDate(windowStartKey)).and(dbCmd.lte(toIntDate(yesterday)))

			const [dailyRes, appDailyRes] = await Promise.all([
				adpRevenueCollection
					.aggregate()
					.match(Object.assign({}, filterWhere, { revenue_date: revenueDateRange }))
					.group({
						_id: '$revenue_date',
						revenue: $.sum('$revenue'),
						show: $.sum('$show_count'),
						click: $.sum('$click_count')
					})
					.limit(AD_TREND_ROW_LIMIT)
					.end(),
				useAppRevenue
					? appRevenueCollection
						.aggregate()
						.match(Object.assign(
							{ ad_region: AD_REGION_CHINA },
							adScope.appid ? { appid: adScope.appid } : {},
							{ revenue_date: revenueDateRange }
						))
						.group({ _id: '$revenue_date', revenue: $.sum('$revenue') })
						.limit(AD_TREND_ROW_LIMIT)
						.end()
					: Promise.resolve(null)
			])

			// 广告位日报：展示 / 点击 + 明细维度（历史日期可能没有行）
			const adpMap = {}
			;(dailyRes && Array.isArray(dailyRes.data) ? dailyRes.data : []).forEach((row) => {
				const intDate = Number(row && row._id)
				if (!intDate) {
					return
				}
				adpMap[intDate] = {
					revenue: Number(row.revenue) || 0,
					show: normalizeCount(row.show),
					click: normalizeCount(row.click)
				}
			})

			// 应用日报：收益（与控制台一致）
			const revenueMap = {}
			;(appDailyRes && Array.isArray(appDailyRes.data) ? appDailyRes.data : []).forEach((row) => {
				const intDate = Number(row && row._id)
				if (!intDate) {
					return
				}
				revenueMap[intDate] = Number(row.revenue) || 0
			})

			// 某天的收益（厘）：优先应用日报，其次广告位日报，都没有算 0
			const revenueLiOf = (intDate) => {
				if (useAppRevenue && revenueMap[intDate] !== undefined) {
					return revenueMap[intDate]
				}
				return adpMap[intDate] ? adpMap[intDate].revenue : 0
			}

			// 窗口求和：revenue 全程按「厘」累加，最后只换算一次，避免逐日四舍五入
			const sumWindow = (startKey, endKey) => {
				const result = { revenue: 0, show: 0, click: 0, days: 0 }
				if (!startKey || !endKey || startKey > endKey) {
					return result
				}
				buildDateKeys(startKey, endKey).forEach((dateKey) => {
					const intDate = toIntDate(dateKey)
					result.revenue += revenueLiOf(intDate)
					const row = adpMap[intDate]
					if (row) {
						result.show += row.show
						result.click += row.click
					}
				})
				result.days = diffDays(startKey, endKey) + 1
				result.revenue = liToYuan(result.revenue)
				return result
			}

			// 覆盖度：应用日报有收益、但广告位日报拆不全的部分（历史回填后常见）
			const rangeDays = buildDateKeys(range.startKey, range.endKey)
			const daysWithRevenue = rangeDays.filter((dateKey) => revenueLiOf(toIntDate(dateKey)) > 0).length
			const adpDays = rangeDays.filter((dateKey) => {
				const row = adpMap[toIntDate(dateKey)]
				return !!(row && (row.show > 0 || row.click > 0))
			})
			const adpRevenueLi = rangeDays.reduce((sum, dateKey) => {
				const row = adpMap[toIntDate(dateKey)]
				return sum + (row ? row.revenue : 0)
			}, 0)
			const appRevenueLi = rangeDays.reduce((sum, dateKey) => sum + revenueLiOf(toIntDate(dateKey)), 0)
			const revenueGapLi = Math.max(0, appRevenueLi - adpRevenueLi)
			const firstAdpInt = Object.keys(adpMap).map(Number).filter(Boolean).sort((prev, next) => prev - next)[0]
			const coverage = {
				// 收益拆不到广告位维度：CTR / eCPM / CPC 与占比图都会失真
				partial: useAppRevenue && revenueGapLi > 1,
				daysWithRevenue,
				daysWithAdp: adpDays.length,
				revenueGap: liToYuan(revenueGapLi),
				firstAdpDate: firstAdpInt ? formatIntDate(firstAdpInt) : ''
			}

			const current = sumWindow(range.startKey, range.endKey)
			const previous = sumWindow(prevStartKey, prevEndKey)
			const yesterdaySum = sumWindow(quickWindows.yesterday.startKey, quickWindows.yesterday.endKey)

			const quick = {}
			AD_QUICK_KEYS.forEach((key) => {
				const window = quickWindows[key]
				const sum = sumWindow(window.startKey, window.endKey)
				quick[key] = {
					label: window.label,
					startKey: window.startKey,
					endKey: window.endKey,
					days: sum.days,
					show: sum.show,
					click: sum.click,
					revenue: sum.revenue
				}
			})

			const trend = buildDateKeys(range.startKey, range.endKey).map((dateKey) => {
				const intDate = toIntDate(dateKey)
				const row = adpMap[intDate]
				return {
					date: dateKey,
					// 收益走应用日报；展示/点击走广告位日报，没有明细的天标记出来
					revenue: liToYuan(revenueLiOf(intDate)),
					show: row ? row.show : 0,
					click: row ? row.click : 0,
					hasBreakdown: !!(row && (row.show > 0 || row.click > 0))
				}
			})

			// 明细只留有数据的天，全 0 日期在趋势图里已经能看出来
			const daily = trend
				.filter((item) => item.show > 0 || item.click > 0 || item.revenue > 0)
				.slice()
				.reverse()

			// 广告位 / 广告类型聚合（都跟随当前筛选条件）
			const rangeMatch = Object.assign({}, filterWhere, {
				revenue_date: dbCmd.gte(toIntDate(range.startKey)).and(dbCmd.lte(toIntDate(range.endKey)))
			})
			const [positionRes, typeRes] = await Promise.all([
				adpRevenueCollection
					.aggregate()
					.match(rangeMatch)
					.group({
						_id: '$adp_id',
						revenue: $.sum('$revenue'),
						show: $.sum('$show_count'),
						click: $.sum('$click_count')
					})
					.limit(50)
					.end(),
				adpRevenueCollection
					.aggregate()
					.match(rangeMatch)
					.group({
						_id: '$ad_type',
						revenue: $.sum('$revenue'),
						show: $.sum('$show_count'),
						click: $.sum('$click_count')
					})
					.limit(30)
					.end()
			])

			// 广告位字典：既是明细里的名称来源，也是筛选下拉的选项；读不到就降级成 adp_id
			const positionMap = {}
			const positionOptions = []
			const queryPositions = async (where) => {
				const res = await adPositionCollection
					.where(where)
					.field({ adp_id: true, adp_name: true, adp_type: true })
					.limit(100)
					.get()
				return res && Array.isArray(res.data) ? res.data : []
			}
			try {
				let posRows = await queryPositions(adScope.appid
					? { ad_region: AD_REGION_CHINA, appid: adScope.appid }
					: { ad_region: AD_REGION_CHINA })
				// 老数据的 appid 可能没写全：按 appid 查不到时退回按区域查，名称/adp_id 不会串应用
				if (!posRows.length && adScope.appid) {
					posRows = await queryPositions({ ad_region: AD_REGION_CHINA })
				}
				posRows.forEach((item) => {
					const key = String((item && item.adp_id) || '')
					if (!key) {
						return
					}
					const type = Number(item.adp_type) || 0
					positionMap[key] = item
					positionOptions.push({
						adpId: key,
						name: item.adp_name || key,
						adType: type,
						adTypeText: AD_TYPE_TEXT[type] || '其他'
					})
				})
			} catch (error) {
				console.error('load ad positions failed', error)
			}

			const positions = (positionRes && Array.isArray(positionRes.data) ? positionRes.data : [])
				.map((row) => {
					const key = String((row && row._id) || '')
					const meta = positionMap[key] || {}
					const itemShow = normalizeCount(row && row.show)
					const itemClick = normalizeCount(row && row.click)
					const itemRevenue = liToYuan(row && row.revenue)
					const itemType = Number(meta.adp_type) || 0

					return {
						adpId: key,
						name: meta.adp_name || key || '未知广告位',
						adType: itemType,
						adTypeText: AD_TYPE_TEXT[itemType] || '其他',
						show: itemShow,
						click: itemClick,
						revenue: itemRevenue,
						clickRate: normalizeRate(itemClick, itemShow),
						cpm: itemShow > 0 ? Math.round((itemRevenue / itemShow) * 1000 * 100) / 100 : 0
					}
				})
				.sort((prev, next) => next.revenue - prev.revenue)

			// 广告类型分布：和广告位同源，只是换个维度聚合
			const types = (typeRes && Array.isArray(typeRes.data) ? typeRes.data : [])
				.map((row) => {
					const type = Number(row && row._id) || 0
					const itemShow = normalizeCount(row && row.show)
					const itemClick = normalizeCount(row && row.click)
					const itemRevenue = liToYuan(row && row.revenue)
					return {
						adType: type,
						name: AD_TYPE_TEXT[type] || '其他',
						show: itemShow,
						click: itemClick,
						revenue: itemRevenue,
						clickRate: normalizeRate(itemClick, itemShow),
						cpm: itemShow > 0 ? Math.round((itemRevenue / itemShow) * 1000 * 100) / 100 : 0
					}
				})
				.sort((prev, next) => next.revenue - prev.revenue)

			// 收益最高的一天：趋势图右侧的「最高单日」直接用，别让前端重复算
			const bestDay = trend.reduce((best, item) => {
				if (!best || item.revenue > best.revenue) {
					return { date: item.date, revenue: item.revenue }
				}
				return best
			}, null)

			// 昨日同步状态：优先读推送日志；没日志时用「昨天有没有收益行」兜底
			let sync = null
			try {
				const syncRes = await adSyncLogCollection
					.where({ sync_date: toIntDate(yesterday), ad_region: AD_REGION_CHINA })
					.limit(1)
					.get()
				const syncRow = syncRes && Array.isArray(syncRes.data) ? syncRes.data[0] : null
				if (syncRow) {
					const status = Number(syncRow.status) || 0
					sync = {
						date: yesterday,
						status,
						statusText: AD_SYNC_STATUS_TEXT[status] || '未知'
					}
				}
			} catch (error) {
				console.error('load ad sync log failed', error)
			}

			if (!sync) {
				// 没有同步日志时不能直接写「已同步」：只能说收益行已入库、状态未确认
				const yesterdayInt = toIntDate(yesterday)
				const hasYesterday = adpMap[yesterdayInt] !== undefined || revenueMap[yesterdayInt] !== undefined
				sync = {
					date: yesterday,
					status: hasYesterday ? 4 : -1,
					statusText: hasYesterday ? '未确认（无同步日志）' : '暂无记录'
				}
			}

			return {
				errCode: 0,
				data: {
					range,
					updatedAt: Date.now(),
					scope: adScope,
					coverage,
					filters: { adType, adpId },
					summary: {
						revenue: current.revenue,
						show: current.show,
						click: current.click,
						// 收益有、明细缺的历史区间：CTR / eCPM / CPC 不可信，返回 null 让前端显示「—」
						clickRate: coverage.partial ? null : normalizeRate(current.click, current.show),
						cpm: coverage.partial || current.show <= 0
							? (coverage.partial ? null : 0)
							: Math.round((current.revenue / current.show) * 1000 * 100) / 100,
						cpc: coverage.partial || current.click <= 0
							? (coverage.partial ? null : 0)
							: Math.round((current.revenue / current.click) * 100) / 100
					},
					compare: {
						yesterday: yesterdaySum.revenue,
						prevRange: previous.revenue,
						// 上期没有收益时不编造 0%，交给前端显示「—」
						delta: previous.revenue > 0
							? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 1000) / 10
							: null
					},
					quick,
					trend,
					daily,
					positions,
					types,
					bestDay,
					positionOptions,
					sync
				}
			}
		} catch (error) {
			return formatError(error, '获取广告收益失败')
		}
	}

	/**
	 * 广告数据核对（仅 admin）：排查「页面数字和 uni-ad 控制台对不上」用
	 *
	 * 不做任何 appid / 平台收敛，把昨日 + 近 7 日的原始汇总按 appid、广告平台、
	 * 数据区域、广告类型四个维度摊开，页面侧「数据核对」面板直接展示。
	 */
	async getAdDiag() {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState && authState.authResult ? authState.authResult.uid : ''
			const userRecord = await readUserRecord(uid)

			if (!hasAdminRole(userRecord)) {
				return {
					errCode: 'love-note-no-permission',
					errMsg: '该接口仅管理员可访问'
				}
			}

			const $ = dbCmd.aggregate
			const today = todayKey()
			const yesterday = addDays(today, AD_LATEST_DAY_OFFSET)
			const weekStart = addDays(yesterday, -6)
			const yesterdayInt = toIntDate(yesterday)
			const weekMatch = {
				revenue_date: dbCmd.gte(toIntDate(weekStart)).and(dbCmd.lte(yesterdayInt))
			}
			const mpMatch = Object.assign({
				ad_region: AD_REGION_CHINA,
				ad_platform: AD_PLATFORM_MP
			}, weekMatch)

			const [appidYestRes, appidWeekRes, platformRes, regionRes, typeRes, yesterdayRows, weekRows, scope, appYestRes, appWeekRes] = await Promise.all([
				adpRevenueCollection
					.aggregate()
					.match({ revenue_date: yesterdayInt })
					.group({
						_id: '$appid',
						revenue: $.sum('$revenue'),
						show: $.sum('$show_count'),
						click: $.sum('$click_count')
					})
					.limit(20)
					.end(),
				adpRevenueCollection
					.aggregate()
					.match(mpMatch)
					.group({ _id: '$appid', revenue: $.sum('$revenue') })
					.limit(20)
					.end(),
				adpRevenueCollection
					.aggregate()
					.match({ revenue_date: yesterdayInt })
					.group({ _id: '$ad_platform', revenue: $.sum('$revenue') })
					.limit(10)
					.end(),
				adpRevenueCollection
					.aggregate()
					.match({ revenue_date: yesterdayInt })
					.group({ _id: '$ad_region', revenue: $.sum('$revenue') })
					.limit(10)
					.end(),
				adpRevenueCollection
					.aggregate()
					.match(Object.assign({ ad_region: AD_REGION_CHINA, ad_platform: AD_PLATFORM_MP }, { revenue_date: yesterdayInt }))
					.group({ _id: '$ad_type', revenue: $.sum('$revenue') })
					.limit(30)
					.end(),
				countWhere(adpRevenueCollection, { revenue_date: yesterdayInt }),
				countWhere(adpRevenueCollection, weekMatch),
				resolveAdAppid(),
				appRevenueCollection
					.aggregate()
					.match({ ad_region: AD_REGION_CHINA, revenue_date: yesterdayInt })
					.group({ _id: null, revenue: $.sum('$revenue') })
					.end(),
				appRevenueCollection
					.aggregate()
					.match(Object.assign({ ad_region: AD_REGION_CHINA }, weekMatch))
					.group({ _id: null, revenue: $.sum('$revenue') })
					.end()
			])

			const mapRows = (res, mapper) => {
				const rows = res && Array.isArray(res.data) ? res.data : []
				return rows.map(mapper).sort((prev, next) => next.revenue - prev.revenue)
			}

			const appidYest = mapRows(appidYestRes, (row) => ({
				appid: String((row && row._id) || '(空)'),
				revenue: liToYuan(row && row.revenue),
				show: normalizeCount(row && row.show),
				click: normalizeCount(row && row.click)
			}))
			const appidWeek = mapRows(appidWeekRes, (row) => ({
				appid: String((row && row._id) || '(空)'),
				revenue: liToYuan(row && row.revenue)
			}))
			const platformYest = mapRows(platformRes, (row) => ({
				platform: Number(row && row._id) || 0,
				label: AD_PLATFORM_TEXT[Number(row && row._id)] || '未知',
				revenue: liToYuan(row && row.revenue)
			}))
			const regionYest = mapRows(regionRes, (row) => ({
				region: Number(row && row._id) || 0,
				label: Number(row && row._id) === AD_REGION_CHINA ? '国内' : '国际',
				revenue: liToYuan(row && row.revenue)
			}))
			const typeYest = mapRows(typeRes, (row) => ({
				adType: Number(row && row._id) || 0,
				name: AD_TYPE_TEXT[Number(row && row._id)] || '其他',
				revenue: liToYuan(row && row.revenue)
			}))

			const readSum = (res) => liToYuan(res && Array.isArray(res.data) && res.data[0] ? res.data[0].revenue : 0)

			return {
				errCode: 0,
				data: {
					yesterday,
					weekStart,
					scope,
					rows: { yesterday: yesterdayRows, week: weekRows },
					appTotals: {
						yesterday: readSum(appYestRes),
						week: readSum(appWeekRes)
					},
					appidYest,
					appidWeek,
					platformYest,
					regionYest,
					typeYest
				}
			}
		} catch (error) {
			return formatError(error, '获取广告诊断数据失败')
		}
	}

	/**
	 * 进入小程序上报（游客也可上报，config.js 里已加入免登录白名单）
	 */
	async reportVisit(data = {}) {
		try {
			let uid = ''
			try {
				const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
				uid = String((authState && authState.authResult && authState.authResult.uid) || '')
			} catch (error) {
				uid = ''
			}

			const deviceId = String(data.deviceId || '').trim().slice(0, 64)
			if (!uid && !deviceId) {
				return { errCode: 0, data: { recorded: false } }
			}

			const now = Date.now()
			const visitorKey = uid || `guest:${deviceId}`
			let openid = ''

			if (uid) {
				try {
					const result = await userCollection.doc(uid).field({ wx_openid: true }).get()
					const record = result && Array.isArray(result.data) ? result.data[0] : null
					const openidMap = record && record.wx_openid && typeof record.wx_openid === 'object'
						? record.wx_openid
						: {}
					openid = String(openidMap.mp || openidMap.mp_weixin || '')
				} catch (error) {
					openid = ''
				}
			}

			await visitCollection.add({
				visitor_key: visitorKey,
				uid,
				openid,
				device_id: deviceId,
				date_key: toDateKey(now),
				scene: String(data.scene || '').slice(0, 32),
				enter_path: String(data.path || '').slice(0, 200),
				uni_platform: String(data.platform || '').slice(0, 32),
				app_version: String(data.version || '').slice(0, 32),
				create_time: now
			})

			return { errCode: 0, data: { recorded: true } }
		} catch (error) {
			return formatError(error, '上报访问失败')
		}
	}

	/**
	 * 游戏参与用户：players 是数组且含机器人，必须先 unwind 再过滤 is_robot
	 */
	async countGameUsers(baseMatch = {}) {
		const $ = dbCmd.aggregate
		const result = await gameRecordCollection
			.aggregate()
			.match(baseMatch)
			.unwind('$players')
			.match({
				'players.uid': dbCmd.neq(null),
				'players.is_robot': dbCmd.neq(true)
			})
			.group({ _id: '$players.uid' })
			.group({ _id: null, total: $.sum(1) })
			.end()

		const row = result && Array.isArray(result.data) ? result.data[0] : null
		return normalizeCount(row && row.total)
	}

	/**
	 * 每日趋势：历史读快照表，今天用实时值覆盖
	 * 快照表由定时云函数 platform-daily-stats 每天 00:10 写入
	 */
	async buildTrend(range, todayLive) {
		const dateKeys = buildDateKeys(range.startKey, range.endKey)
		if (!dateKeys.length) {
			return []
		}

		const result = await dailyStatCollection
			.where({ date_key: dbCmd.in(dateKeys) })
			.limit(dateKeys.length + 1)
			.get()

		const rows = result && Array.isArray(result.data) ? result.data : []
		const snapshotMap = {}
		rows.forEach((row) => {
			if (row && row.date_key) {
				snapshotMap[row.date_key] = row
			}
		})

		const nowKey = todayKey()

		return dateKeys.map((dateKey) => {
			if (dateKey === nowKey && todayLive) {
				return {
					date: dateKey,
					newUsers: normalizeCount(todayLive.newUsers),
					visits: normalizeCount(todayLive.visits),
					logins: normalizeCount(todayLive.logins),
					bindings: normalizeCount(todayLive.bindings),
					live: true
				}
			}

			const snapshot = snapshotMap[dateKey] || {}
			return {
				date: dateKey,
				newUsers: normalizeCount(snapshot.new_users),
				visits: normalizeCount(snapshot.visits_uv),
				logins: normalizeCount(snapshot.logins_uv),
				bindings: normalizeCount(snapshot.new_bindings),
				live: false
			}
		})
	}
}
