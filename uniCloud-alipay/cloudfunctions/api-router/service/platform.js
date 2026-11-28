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
const pointsLib = require('../lib/points')
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
	appSettingCollection,
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
const { collectFileIdsFromPhotos } = require('../lib/media')

// 云存储清理：单次处理的动态条数上限（每条要走一次 deleteFile + 一次 update，别把云函数跑超时）
const MEDIA_CLEANUP_BATCH_LIMIT = 20
const MEDIA_CLEANUP_BATCH_MAX = 50
// 统计待清理文件数时最多翻多少条记录（只是给运营看个量级，不做精确全表遍历）
const MEDIA_CLEANUP_STATS_SAMPLE = 50

/**
 * 把 media 里的云文件引用摘掉，url / 宽高等字段原样保留。
 *
 * 清理后记录仍然可读（已软删，列表不展示），只是文件链接指向已删除的对象；
 * 下划线字段一并置空，避免下次清理再次收到同一个 fileID。
 */
function stripMediaFileIds(mediaList = []) {
	const list = Array.isArray(mediaList) ? mediaList : []
	return list.map((item) => {
		if (!item || typeof item !== 'object') {
			return item
		}
		return Object.assign({}, item, {
			file_id: '',
			thumbnail_file_id: ''
		})
	})
}

/** 待清理条件：已软删 + 还没清理过（老数据没有 media_cleaned_at 字段，也会被扫到） */
function buildPendingCleanupCondition() {
	return {
		is_deleted: true,
		media_cleaned_at: dbCmd.exists(false)
	}
}

const COUPLE_STATUS_BOUND = 1

const PLAN_STATUS_COMPLETED = 'completed'

const RANGE_PRESETS = {
	today: 1,
	'7d': 7,
	'30d': 30
}
const DEFAULT_RANGE_KEY = '7d'
const MAX_RANGE_DAYS = 90
// 单用户访问上报去重窗口：30 分钟内只记一次
const VISIT_DEDUPE_WINDOW_MS = 30 * 60 * 1000
const OVERVIEW_USER_TYPES = ['newUsers', 'visits', 'logins', 'bindings']
const MODULE_DETAIL_META = {
	couple: { name: '情侣空间', unit: '对' },
	anniversary: { name: '纪念日', unit: '条' },
	album: { name: '相册', unit: '张' },
	daily: { name: '双人日常', unit: '条' },
	wish: { name: '愿望清单', unit: '条' },
	game: { name: '聚会游戏', unit: '局' }
}

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

// 全局配置键（love-app-settings）—— 首页 / 游戏大厅的模块显示开关
//   feed_visible：双人日常。权限类开关**默认关闭**（内容型模块要运营显式放开）
//   game_visible：聚会游戏入口。功能类开关**默认开启**（关掉只是隐藏入口，不影响已开的房间）
//   game_<type>_visible：每个小游戏单独一个子开关，同样默认开启
// 记录不存在 / 表还没建 / 读取异常一律按这里的默认值走，
// 两种默认值方向相反，所以不能共用一个 fallback 常量
const SETTING_KEY_FEED_VISIBLE = 'feed_visible'
const SETTING_KEY_GAME_VISIBLE = 'game_visible'
// 子开关的键必须和客户端 GAME_TYPE_*（common/game/rules.js）一一对应
const SETTING_KEY_GAME_ITEMS = {
	undercover: 'game_undercover_visible',
	landlord: 'game_landlord_visible',
	bomb: 'game_bomb_visible'
}
const DEFAULT_FEED_VISIBLE = false
const DEFAULT_GAME_VISIBLE = true
const DEFAULT_GAME_ITEM_VISIBLE = true

// 心动点每日任务开关：键必须和 lib/points.js 的 TASK_DISPLAY_ORDER 一一对应。
// 默认全部开启；关掉只是心动点页不展示该任务，已经发出去的分不受影响。
const SETTING_KEY_POINTS_TASKS = {
	daily_post: 'points_task_daily_post',
	photo_upload: 'points_task_photo_upload',
	game_settle: 'points_task_game_settle',
	anniversary: 'points_task_anniversary',
	plan_create: 'points_task_plan_create',
	plan_finish: 'points_task_plan_finish'
}
const DEFAULT_POINTS_TASK_VISIBLE = true

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

function normalizePagination(data = {}, defaultSize = 20, maxSize = 50) {
	const page = Math.max(1, Math.floor(Number(data.page) || 1))
	const pageSize = Math.min(maxSize, Math.max(1, Math.floor(Number(data.pageSize) || defaultSize)))
	return {
		page,
		pageSize,
		skip: (page - 1) * pageSize
	}
}

function isTempLikeAvatarUrl(value = '') {
	const raw = String(value || '').trim()
	if (!raw) return false
	if (/^cloud:\/\//i.test(raw) || /^data:/i.test(raw)) return false
	if (/^(wxfile|blob|file|filesystem|content|absolute|ms-appx):/i.test(raw)) return true
	const match = raw.match(/^https?:\/\/([^/?#:]+)/i)
	if (match) return !match[1].includes('.')
	return true
}

/**
 * 批量读取用户基础资料，并把 cloud:// 头像 file_id 合并成一次 getTempFileURL 调用
 */
async function loadUsersMap(uids = []) {
	const uniqueUids = Array.from(new Set(
		(Array.isArray(uids) ? uids : [])
			.map((id) => String(id || '').trim())
			.filter(Boolean)
	))
	if (!uniqueUids.length) {
		return {}
	}

	const result = await userCollection
		.where({ _id: dbCmd.in(uniqueUids) })
		.field({
			nickname: true,
			avatar: true,
			avatar_file_id: true,
			avatar_file: true,
			gender: true,
			register_date: true,
			last_login_date: true,
			theme_key: true
		})
		.limit(uniqueUids.length)
		.get()
	const rows = result && Array.isArray(result.data) ? result.data : []

	const cloudFileIds = []
	rows.forEach((row) => {
		const fid = String(row.avatar_file_id || (row.avatar_file && row.avatar_file.url) || '').trim()
		if (fid && /^cloud:\/\//i.test(fid) && !cloudFileIds.includes(fid)) {
			cloudFileIds.push(fid)
		}
	})

	const tempUrlMap = {}
	if (cloudFileIds.length) {
		try {
			const tempRes = await uniCloud.getTempFileURL({ fileList: cloudFileIds })
			const fileList = tempRes && Array.isArray(tempRes.fileList) ? tempRes.fileList : []
			fileList.forEach((item) => {
				const fid = String((item && item.fileID) || '').trim()
				const url = String((item && (item.tempFileURL || item.tempFileUrl || item.url || item.download_url)) || '').trim()
				if (fid && url) {
					tempUrlMap[fid] = url
				}
			})
		} catch (error) {
			console.warn('loadUsersMap getTempFileURL failed', error)
		}
	}

	const map = {}
	rows.forEach((row) => {
		const id = String(row._id || '').trim()
		if (!id) return
		const fid = String(row.avatar_file_id || (row.avatar_file && row.avatar_file.url) || '').trim()
		let avatarUrl = ''
		if (fid) {
			if (/^https?:\/\//i.test(fid)) {
				avatarUrl = isTempLikeAvatarUrl(fid) ? '' : fid
			} else if (tempUrlMap[fid]) {
				avatarUrl = tempUrlMap[fid]
			}
		}
		if (!avatarUrl && row.avatar) {
			const rawAvatar = String(row.avatar).trim()
			if (/^https?:\/\//i.test(rawAvatar) && !isTempLikeAvatarUrl(rawAvatar)) {
				avatarUrl = rawAvatar
			}
		}
		map[id] = {
			uid: id,
			nickname: String(row.nickname || '').trim() || '微信用户',
			avatarUrl,
			gender: Number(row.gender) || 0,
			registerDate: Number(row.register_date) || 0,
			lastLoginDate: Number(row.last_login_date) || 0,
			themeKey: String(row.theme_key || '').trim()
		}
	})

	return map
}

/** 批量查指定 uid 的已绑定情侣关系（用于新增用户列表展示绑定状态） */
async function loadBoundCouplesByUids(uids = []) {
	const uniqueUids = Array.from(new Set(
		(Array.isArray(uids) ? uids : [])
			.map((id) => String(id || '').trim())
			.filter(Boolean)
	))
	if (!uniqueUids.length) {
		return {}
	}

	const result = await coupleCollection
		.where(dbCmd.and([
			{ status: COUPLE_STATUS_BOUND },
			dbCmd.or([
				{ user_a_uid: dbCmd.in(uniqueUids) },
				{ user_b_uid: dbCmd.in(uniqueUids) }
			])
		]))
		.field({
			_id: true,
			relation_no: true,
			user_a_uid: true,
			user_b_uid: true,
			user_a_snapshot: true,
			user_b_snapshot: true,
			bind_date: true
		})
		.limit(uniqueUids.length * 2)
		.get()
	const rows = result && Array.isArray(result.data) ? result.data : []

	const map = {}
	rows.forEach((row) => {
		const uidA = String(row.user_a_uid || '').trim()
		const uidB = String(row.user_b_uid || '').trim()
		const nickA = String((row.user_a_snapshot && row.user_a_snapshot.nickname) || '').trim()
		const nickB = String((row.user_b_snapshot && row.user_b_snapshot.nickname) || '').trim()
		if (uidA && uniqueUids.includes(uidA)) {
			map[uidA] = {
				coupleId: row._id || '',
				partnerUid: uidB,
				partnerNickname: nickB || '另一半',
				bindDate: Number(row.bind_date) || 0
			}
		}
		if (uidB && uniqueUids.includes(uidB)) {
			map[uidB] = {
				coupleId: row._id || '',
				partnerUid: uidA,
				partnerNickname: nickA || '另一半',
				bindDate: Number(row.bind_date) || 0
			}
		}
	})
	return map
}

function buildCoupleMember(uid, userMap, snapshot = {}) {
	const id = String(uid || '').trim()
	const user = (id && userMap[id]) || null
	const snapAvatar = String((snapshot && snapshot.avatar_url) || '').trim()
	return {
		uid: id,
		nickname: (user && user.nickname) || String((snapshot && snapshot.nickname) || '').trim() || '微信用户',
		avatarUrl: (user && user.avatarUrl) || (snapAvatar && !isTempLikeAvatarUrl(snapAvatar) ? snapAvatar : '')
	}
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

/* ---------------- 全局配置（love-app-settings） ---------------- */

/**
 * 读一个布尔开关：value 为 undefined（记录不存在）时用 fallback；
 * 记录存在时只认严格 true —— 库里存了 'false' / 'true' 字符串一律按 false 处理。
 */
function pickSwitchValue(value, fallback) {
	if (value === undefined) {
		return fallback
	}
	return value === true
}

/** 写全局配置：有记录就 update，没有就 add（首次写入需要表已存在） */
async function writeAppSetting(key, value, uid) {
	const now = Date.now()
	const result = await appSettingCollection.where({ key }).limit(1).get()
	const rows = result && Array.isArray(result.data) ? result.data : []

	if (rows.length) {
		await appSettingCollection.doc(rows[0]._id).update({
			value,
			update_uid: uid || '',
			update_time: now
		})
		return
	}

	await appSettingCollection.add({
		key,
		value,
		update_uid: uid || '',
		create_time: now,
		update_time: now
	})
}

/**
 * 一次查出首页 / 游戏大厅所有模块开关，运营页与客户端共用同一口径。
 *
 * 表没建 / Query 抛错 → 全部按默认值返回（feed 关、game 与小游戏都开），
 * 绝不把异常抛给页面：页面只想要几个布尔值，不该因为配置缺失白屏或弹 toast。
 */
async function readModuleVisibility() {
	const gameItemTypes = Object.keys(SETTING_KEY_GAME_ITEMS)
	const pointsTaskTypes = Object.keys(SETTING_KEY_POINTS_TASKS)
	const keys = [SETTING_KEY_FEED_VISIBLE, SETTING_KEY_GAME_VISIBLE].concat(
		gameItemTypes.map((type) => SETTING_KEY_GAME_ITEMS[type]),
		pointsTaskTypes.map((type) => SETTING_KEY_POINTS_TASKS[type])
	)
	let rows = []
	try {
		const result = await appSettingCollection
			.where({ key: dbCmd.in(keys) })
			.limit(keys.length + 2)
			.get()
		rows = result && Array.isArray(result.data) ? result.data : []
	} catch (error) {
		console.error('readModuleVisibility failed', error)
		rows = []
	}

	const found = {}
	rows.forEach((row) => {
		const key = String((row && row.key) || '')
		if (key) {
			found[key] = row.value
		}
	})

	const gameItems = {}
	gameItemTypes.forEach((type) => {
		gameItems[type] = pickSwitchValue(found[SETTING_KEY_GAME_ITEMS[type]], DEFAULT_GAME_ITEM_VISIBLE)
	})

	const pointsTasks = {}
	pointsTaskTypes.forEach((type) => {
		pointsTasks[type] = pickSwitchValue(found[SETTING_KEY_POINTS_TASKS[type]], DEFAULT_POINTS_TASK_VISIBLE)
	})

	return {
		feedVisible: pickSwitchValue(found[SETTING_KEY_FEED_VISIBLE], DEFAULT_FEED_VISIBLE),
		gameVisible: pickSwitchValue(found[SETTING_KEY_GAME_VISIBLE], DEFAULT_GAME_VISIBLE),
		gameItems,
		pointsTasks
	}
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
	 * 平台总览明细：新增用户 / 访问 UV / 登录人数 / 新增绑定分页列表（仅 admin）
	 */
	async getOverviewUsers(data = {}) {
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

			const type = String(data.type || '').trim()
			if (!OVERVIEW_USER_TYPES.includes(type)) {
				return {
					errCode: 'love-note-invalid-param',
					errMsg: '不支持的统计类型'
				}
			}

			// 未传时间参数时默认查「今日」，与总览卡片口径一致
			const rangeInput = (data.range || (data.startDate && data.endDate))
				? data
				: Object.assign({}, data, { range: 'today' })
			const range = resolveRange(rangeInput)
			const startTs = dayStartTs(range.startKey)
			const endTs = dayEndTs(range.endKey)
			const { page, pageSize, skip } = normalizePagination(data)
			const $ = dbCmd.aggregate

			let total = 0
			let list = []
			let source = ''

			if (type === 'newUsers') {
				const where = {
					register_date: dbCmd.gte(startTs).and(dbCmd.lt(endTs))
				}
				const [countTotal, listRes] = await Promise.all([
					countWhere(userCollection, where),
					userCollection
						.where(where)
						.orderBy('register_date', 'desc')
						.skip(skip)
						.limit(pageSize)
						.field({
							_id: true,
							nickname: true,
							avatar: true,
							avatar_file_id: true,
							avatar_file: true,
							gender: true,
							register_date: true,
							last_login_date: true,
							theme_key: true
						})
						.get()
				])
				total = countTotal
				const rows = listRes && Array.isArray(listRes.data) ? listRes.data : []
				const uids = rows.map((row) => row._id).filter(Boolean)
				const [userMap, coupleMap] = await Promise.all([
					loadUsersMap(uids),
					loadBoundCouplesByUids(uids)
				])
				list = rows.map((row) => {
					const u = userMap[row._id] || {
						uid: row._id,
						nickname: String(row.nickname || '').trim() || '微信用户',
						avatarUrl: '',
						gender: Number(row.gender) || 0,
						registerDate: Number(row.register_date) || 0,
						lastLoginDate: Number(row.last_login_date) || 0
					}
					const couple = coupleMap[row._id] || null
					return {
						id: row._id,
						uid: row._id,
						nickname: u.nickname,
						avatarUrl: u.avatarUrl,
						gender: u.gender,
						registerDate: u.registerDate,
						lastLoginDate: u.lastLoginDate,
						actionTime: u.registerDate,
						isBound: Boolean(couple),
						partnerNickname: couple ? couple.partnerNickname : ''
					}
				})
			} else if (type === 'visits') {
				const match = {
					date_key: dbCmd.gte(range.startKey).and(dbCmd.lte(range.endKey))
				}
				const [countRes, pageRes] = await Promise.all([
					visitCollection
						.aggregate()
						.match(match)
						.group({ _id: '$visitor_key' })
						.group({ _id: null, total: $.sum(1) })
						.end(),
					visitCollection
						.aggregate()
						.match(match)
						.sort({ create_time: 1 })
						.group({
							_id: '$visitor_key',
							uid: $.last('$uid'),
							device_id: $.last('$device_id'),
							visitCount: $.sum(1),
							firstVisitTime: $.min('$create_time'),
							lastVisitTime: $.max('$create_time'),
							scene: $.last('$scene'),
							platform: $.last('$uni_platform'),
							enterPath: $.last('$enter_path')
						})
						.sort({ lastVisitTime: -1 })
						.skip(skip)
						.limit(pageSize)
						.end()
				])
				const countRow = countRes && Array.isArray(countRes.data) ? countRes.data[0] : null
				total = normalizeCount(countRow && countRow.total)
				const rows = pageRes && Array.isArray(pageRes.data) ? pageRes.data : []
				const uids = rows.map((row) => String((row && row.uid) || '').trim()).filter(Boolean)
				const userMap = await loadUsersMap(uids)

				list = rows.map((row) => {
					const rowUid = String((row && row.uid) || '').trim()
					const deviceId = String((row && row.device_id) || '').trim()
					const u = rowUid ? userMap[rowUid] : null
					const guestSuffix = deviceId ? deviceId.slice(-6) : String(row._id || '').slice(-6)
					return {
						id: String(row._id || ''),
						visitorKey: String(row._id || ''),
						uid: rowUid,
						isGuest: !rowUid,
						nickname: u ? u.nickname : `游客 ${guestSuffix || '未知'}`,
						avatarUrl: u ? u.avatarUrl : '',
						gender: u ? u.gender : 0,
						visitCount: normalizeCount(row.visitCount),
						firstVisitTime: Number(row.firstVisitTime) || 0,
						lastVisitTime: Number(row.lastVisitTime) || 0,
						actionTime: Number(row.lastVisitTime) || 0,
						scene: String(row.scene || ''),
						platform: String(row.platform || ''),
						enterPath: String(row.enterPath || ''),
						registerDate: u ? u.registerDate : 0
					}
				})
			} else if (type === 'logins') {
				const logMatch = {
					type: LOG_TYPE_LOGIN,
					create_date: dbCmd.gte(startTs).and(dbCmd.lt(endTs))
				}
				const countRes = await uniIdLogCollection
					.aggregate()
					.match(logMatch)
					.group({ _id: '$user_id' })
					.group({ _id: null, total: $.sum(1) })
					.end()
				const countRow = countRes && Array.isArray(countRes.data) ? countRes.data[0] : null
				const logTotal = normalizeCount(countRow && countRow.total)

				if (logTotal > 0) {
					source = 'log'
					total = logTotal
					const pageRes = await uniIdLogCollection
						.aggregate()
						.match(logMatch)
						.sort({ create_date: 1 })
						.group({
							_id: '$user_id',
							loginCount: $.sum(1),
							firstLoginTime: $.min('$create_date'),
							lastLoginTime: $.max('$create_date'),
							ip: $.last('$ip')
						})
						.sort({ lastLoginTime: -1 })
						.skip(skip)
						.limit(pageSize)
						.end()
					const rows = pageRes && Array.isArray(pageRes.data) ? pageRes.data : []
					const uids = rows.map((row) => String((row && row._id) || '').trim()).filter(Boolean)
					const userMap = await loadUsersMap(uids)

					list = rows.map((row) => {
						const rowUid = String((row && row._id) || '').trim()
						const u = userMap[rowUid] || null
						return {
							id: rowUid,
							uid: rowUid,
							nickname: u ? u.nickname : '微信用户',
							avatarUrl: u ? u.avatarUrl : '',
							gender: u ? u.gender : 0,
							loginCount: normalizeCount(row.loginCount),
							firstLoginTime: Number(row.firstLoginTime) || 0,
							lastLoginTime: Number(row.lastLoginTime) || 0,
							actionTime: Number(row.lastLoginTime) || 0,
							registerDate: u ? u.registerDate : 0,
							ip: String(row.ip || '')
						}
					})
				} else {
					source = 'last_login_date'
					const fallbackWhere = {
						last_login_date: dbCmd.gte(startTs).and(dbCmd.lt(endTs))
					}
					const [fbCount, fbRes] = await Promise.all([
						countWhere(userCollection, fallbackWhere),
						userCollection
							.where(fallbackWhere)
							.orderBy('last_login_date', 'desc')
							.skip(skip)
							.limit(pageSize)
							.field({ _id: true, last_login_date: true })
							.get()
					])
					total = fbCount
					const rows = fbRes && Array.isArray(fbRes.data) ? fbRes.data : []
					const uids = rows.map((row) => row._id).filter(Boolean)
					const userMap = await loadUsersMap(uids)
					list = rows.map((row) => {
						const u = userMap[row._id] || null
						const loginTs = Number(row.last_login_date) || 0
						return {
							id: row._id,
							uid: row._id,
							nickname: u ? u.nickname : '微信用户',
							avatarUrl: u ? u.avatarUrl : '',
							gender: u ? u.gender : 0,
							loginCount: 1,
							firstLoginTime: loginTs,
							lastLoginTime: loginTs,
							actionTime: loginTs,
							registerDate: u ? u.registerDate : 0,
							ip: ''
						}
					})
				}
			} else if (type === 'bindings') {
				const where = {
					status: COUPLE_STATUS_BOUND,
					bind_date: dbCmd.gte(startTs).and(dbCmd.lt(endTs))
				}
				const [countTotal, listRes] = await Promise.all([
					countWhere(coupleCollection, where),
					coupleCollection
						.where(where)
						.orderBy('bind_date', 'desc')
						.skip(skip)
						.limit(pageSize)
						.field({
							_id: true,
							relation_no: true,
							user_a_uid: true,
							user_b_uid: true,
							user_a_snapshot: true,
							user_b_snapshot: true,
							bind_date: true,
							anniversary_date: true
						})
						.get()
				])
				total = countTotal
				const rows = listRes && Array.isArray(listRes.data) ? listRes.data : []
				const uids = []
				rows.forEach((row) => {
					if (row.user_a_uid) uids.push(row.user_a_uid)
					if (row.user_b_uid) uids.push(row.user_b_uid)
				})
				const userMap = await loadUsersMap(uids)
				list = rows.map((row) => ({
					id: row._id,
					coupleId: row._id,
					relationNo: String(row.relation_no || ''),
					bindDate: Number(row.bind_date) || 0,
					actionTime: Number(row.bind_date) || 0,
					anniversaryDate: Number(row.anniversary_date) || 0,
					userA: buildCoupleMember(row.user_a_uid, userMap, row.user_a_snapshot),
					userB: buildCoupleMember(row.user_b_uid, userMap, row.user_b_snapshot)
				}))
			}

			return {
				errCode: 0,
				data: {
					type,
					range,
					source,
					list,
					pagination: {
						page,
						pageSize,
						total,
						hasMore: skip + list.length < total
					}
				}
			}
		} catch (error) {
			return formatError(error, '获取总览明细失败')
		}
	}

	/**
	 * 模块明细：按模块分页展示具体用户（或情侣）的模块数据（仅 admin）
	 */
	async getModuleDetail(data = {}) {
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

			const moduleKey = String(data.module || '').trim()
			const meta = MODULE_DETAIL_META[moduleKey]
			if (!meta) {
				return {
					errCode: 'love-note-invalid-param',
					errMsg: '不支持的模块类型'
				}
			}

			const { page, pageSize, skip } = normalizePagination(data)
			const $ = dbCmd.aggregate
			const notDeleted = { is_deleted: dbCmd.neq(true) }

			let total = 0
			let totalRecords = 0
			let list = []

			if (moduleKey === 'couple') {
				const where = { status: COUPLE_STATUS_BOUND }
				const [countTotal, listRes] = await Promise.all([
					countWhere(coupleCollection, where),
					coupleCollection
						.where(where)
						.orderBy('bind_date', 'desc')
						.skip(skip)
						.limit(pageSize)
						.field({
							_id: true,
							relation_no: true,
							user_a_uid: true,
							user_b_uid: true,
							user_a_snapshot: true,
							user_b_snapshot: true,
							bind_date: true,
							anniversary_date: true
						})
						.get()
				])
				total = countTotal
				totalRecords = countTotal
				const rows = listRes && Array.isArray(listRes.data) ? listRes.data : []
				const uids = []
				rows.forEach((row) => {
					if (row.user_a_uid) uids.push(row.user_a_uid)
					if (row.user_b_uid) uids.push(row.user_b_uid)
				})
				const userMap = await loadUsersMap(uids)
				list = rows.map((row) => ({
					id: row._id,
					coupleId: row._id,
					relationNo: String(row.relation_no || ''),
					bindDate: Number(row.bind_date) || 0,
					lastTime: Number(row.bind_date) || 0,
					anniversaryDate: Number(row.anniversary_date) || 0,
					userA: buildCoupleMember(row.user_a_uid, userMap, row.user_a_snapshot),
					userB: buildCoupleMember(row.user_b_uid, userMap, row.user_b_snapshot)
				}))
			} else if (moduleKey === 'anniversary') {
				const match = Object.assign({}, notDeleted, { creator_uid: dbCmd.neq(null) })
				const [recordTotal, countRes, pageRes] = await Promise.all([
					countWhere(anniversaryCollection, notDeleted),
					anniversaryCollection
						.aggregate()
						.match(match)
						.group({ _id: '$creator_uid' })
						.group({ _id: null, total: $.sum(1) })
						.end(),
					anniversaryCollection
						.aggregate()
						.match(match)
						.sort({ create_time: 1 })
						.group({
							_id: '$creator_uid',
							count: $.sum(1),
							lastTime: $.max('$create_time'),
							latestTitle: $.last('$title')
						})
						.sort({ count: -1, lastTime: -1 })
						.skip(skip)
						.limit(pageSize)
						.end()
				])
				totalRecords = recordTotal
				total = normalizeCount(countRes && Array.isArray(countRes.data) && countRes.data[0] && countRes.data[0].total)
				const rows = pageRes && Array.isArray(pageRes.data) ? pageRes.data : []
				const uids = rows.map((row) => String(row._id || '').trim()).filter(Boolean)
				const userMap = await loadUsersMap(uids)
				list = rows.map((row) => {
					const rowUid = String(row._id || '').trim()
					const u = userMap[rowUid] || null
					const latestTitle = String(row.latestTitle || '').trim()
					return {
						id: rowUid,
						uid: rowUid,
						nickname: u ? u.nickname : '微信用户',
						avatarUrl: u ? u.avatarUrl : '',
						count: normalizeCount(row.count),
						unit: meta.unit,
						lastTime: Number(row.lastTime) || 0,
						detailText: latestTitle ? `最近：${latestTitle}` : `累计创建 ${normalizeCount(row.count)} 条`
					}
				})
			} else if (moduleKey === 'album') {
				const match = { uploader_uid: dbCmd.neq(null) }
				const [recordTotal, countRes, pageRes] = await Promise.all([
					countWhere(photoCollection, null),
					photoCollection
						.aggregate()
						.match(match)
						.group({ _id: '$uploader_uid' })
						.group({ _id: null, total: $.sum(1) })
						.end(),
					photoCollection
						.aggregate()
						.match(match)
						.group({
							_id: '$uploader_uid',
							count: $.sum(1),
							lastTime: $.max('$create_time')
						})
						.sort({ count: -1, lastTime: -1 })
						.skip(skip)
						.limit(pageSize)
						.end()
				])
				totalRecords = recordTotal
				total = normalizeCount(countRes && Array.isArray(countRes.data) && countRes.data[0] && countRes.data[0].total)
				const rows = pageRes && Array.isArray(pageRes.data) ? pageRes.data : []
				const uids = rows.map((row) => String(row._id || '').trim()).filter(Boolean)
				const [userMap, albumCountRes] = await Promise.all([
					loadUsersMap(uids),
					uids.length
						? albumCollection
							.aggregate()
							.match({ create_uid: dbCmd.in(uids) })
							.group({ _id: '$create_uid', albumCount: $.sum(1) })
							.limit(uids.length)
							.end()
						: Promise.resolve({ data: [] })
				])
				const albumCountMap = {}
				;(albumCountRes && Array.isArray(albumCountRes.data) ? albumCountRes.data : []).forEach((item) => {
					if (item && item._id) {
						albumCountMap[String(item._id)] = normalizeCount(item.albumCount)
					}
				})
				list = rows.map((row) => {
					const rowUid = String(row._id || '').trim()
					const u = userMap[rowUid] || null
					const albumCount = albumCountMap[rowUid] || 0
					return {
						id: rowUid,
						uid: rowUid,
						nickname: u ? u.nickname : '微信用户',
						avatarUrl: u ? u.avatarUrl : '',
						count: normalizeCount(row.count),
						unit: meta.unit,
						albumCount,
						lastTime: Number(row.lastTime) || 0,
						detailText: `创建相册 ${albumCount} 个`
					}
				})
			} else if (moduleKey === 'daily') {
				const match = Object.assign({}, notDeleted, { author_uid: dbCmd.neq(null) })
				const [recordTotal, countRes, pageRes] = await Promise.all([
					countWhere(dailyPostCollection, notDeleted),
					dailyPostCollection
						.aggregate()
						.match(match)
						.group({ _id: '$author_uid' })
						.group({ _id: null, total: $.sum(1) })
						.end(),
					dailyPostCollection
						.aggregate()
						.match(match)
						.group({
							_id: '$author_uid',
							count: $.sum(1),
							mediaTotal: $.sum('$media_count'),
							lastTime: $.max('$create_time')
						})
						.sort({ count: -1, lastTime: -1 })
						.skip(skip)
						.limit(pageSize)
						.end()
				])
				totalRecords = recordTotal
				total = normalizeCount(countRes && Array.isArray(countRes.data) && countRes.data[0] && countRes.data[0].total)
				const rows = pageRes && Array.isArray(pageRes.data) ? pageRes.data : []
				const uids = rows.map((row) => String(row._id || '').trim()).filter(Boolean)
				const userMap = await loadUsersMap(uids)
				list = rows.map((row) => {
					const rowUid = String(row._id || '').trim()
					const u = userMap[rowUid] || null
					const mediaTotal = normalizeCount(row.mediaTotal)
					return {
						id: rowUid,
						uid: rowUid,
						nickname: u ? u.nickname : '微信用户',
						avatarUrl: u ? u.avatarUrl : '',
						count: normalizeCount(row.count),
						unit: meta.unit,
						mediaTotal,
						lastTime: Number(row.lastTime) || 0,
						detailText: `累计附带媒体 ${mediaTotal} 个`
					}
				})
			} else if (moduleKey === 'wish') {
				const match = Object.assign({}, notDeleted, { create_uid: dbCmd.neq(null) })
				const [recordTotal, countRes, pageRes] = await Promise.all([
					countWhere(wishPlanCollection, notDeleted),
					wishPlanCollection
						.aggregate()
						.match(match)
						.group({ _id: '$create_uid' })
						.group({ _id: null, total: $.sum(1) })
						.end(),
					wishPlanCollection
						.aggregate()
						.match(match)
						.group({
							_id: '$create_uid',
							count: $.sum(1),
							lastTime: $.max('$create_time')
						})
						.sort({ count: -1, lastTime: -1 })
						.skip(skip)
						.limit(pageSize)
						.end()
				])
				totalRecords = recordTotal
				total = normalizeCount(countRes && Array.isArray(countRes.data) && countRes.data[0] && countRes.data[0].total)
				const rows = pageRes && Array.isArray(pageRes.data) ? pageRes.data : []
				const uids = rows.map((row) => String(row._id || '').trim()).filter(Boolean)
				const [userMap, doneRes] = await Promise.all([
					loadUsersMap(uids),
					uids.length
						? wishPlanCollection
							.aggregate()
							.match(Object.assign({}, notDeleted, {
								create_uid: dbCmd.in(uids),
								status: PLAN_STATUS_COMPLETED
							}))
							.group({ _id: '$create_uid', completedCount: $.sum(1) })
							.limit(uids.length)
							.end()
						: Promise.resolve({ data: [] })
				])
				const doneMap = {}
				;(doneRes && Array.isArray(doneRes.data) ? doneRes.data : []).forEach((item) => {
					if (item && item._id) {
						doneMap[String(item._id)] = normalizeCount(item.completedCount)
					}
				})
				list = rows.map((row) => {
					const rowUid = String(row._id || '').trim()
					const u = userMap[rowUid] || null
					const count = normalizeCount(row.count)
					const completedCount = doneMap[rowUid] || 0
					return {
						id: rowUid,
						uid: rowUid,
						nickname: u ? u.nickname : '微信用户',
						avatarUrl: u ? u.avatarUrl : '',
						count,
						completedCount,
						unit: meta.unit,
						lastTime: Number(row.lastTime) || 0,
						detailText: `已完成 ${completedCount} / ${count} 条`
					}
				})
			} else if (moduleKey === 'game') {
				const [recordTotal, countRes, pageRes] = await Promise.all([
					countWhere(gameRecordCollection, notDeleted),
					gameRecordCollection
						.aggregate()
						.match(notDeleted)
						.unwind('$players')
						.match({
							'players.uid': dbCmd.neq(null),
							'players.is_robot': dbCmd.neq(true)
						})
						.group({ _id: '$players.uid' })
						.group({ _id: null, total: $.sum(1) })
						.end(),
					gameRecordCollection
						.aggregate()
						.match(notDeleted)
						.unwind('$players')
						.match({
							'players.uid': dbCmd.neq(null),
							'players.is_robot': dbCmd.neq(true)
						})
						.group({
							_id: '$players.uid',
							count: $.sum(1),
							lastTime: $.max('$create_time')
						})
						.sort({ count: -1, lastTime: -1 })
						.skip(skip)
						.limit(pageSize)
						.end()
				])
				totalRecords = recordTotal
				total = normalizeCount(countRes && Array.isArray(countRes.data) && countRes.data[0] && countRes.data[0].total)
				const rows = pageRes && Array.isArray(pageRes.data) ? pageRes.data : []
				const uids = rows.map((row) => String(row._id || '').trim()).filter(Boolean)
				const userMap = await loadUsersMap(uids)
				list = rows.map((row) => {
					const rowUid = String(row._id || '').trim()
					const u = userMap[rowUid] || null
					const count = normalizeCount(row.count)
					return {
						id: rowUid,
						uid: rowUid,
						nickname: u ? u.nickname : '微信用户',
						avatarUrl: u ? u.avatarUrl : '',
						count,
						unit: meta.unit,
						lastTime: Number(row.lastTime) || 0,
						detailText: `累计参与 ${count} 局对局`
					}
				})
			}

			return {
				errCode: 0,
				data: {
					module: moduleKey,
					name: meta.name,
					unit: meta.unit,
					summary: {
						totalUsers: total,
						totalRecords
					},
					list,
					pagination: {
						page,
						pageSize,
						total,
						hasMore: skip + list.length < total
					}
				}
			}
		} catch (error) {
			return formatError(error, '获取模块明细失败')
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
	 * 权限设置（仅 admin）：首页模块的显示开关。
	 * feed 默认关、game 默认开，口径统一由 readModuleVisibility 决定。
	 */
	async getPermissionSettings() {
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

			return {
				errCode: 0,
				data: Object.assign(await readModuleVisibility(), {
					updatedAt: Date.now()
				})
			}
		} catch (error) {
			return formatError(error, '获取权限设置失败')
		}
	}

	/**
	 * 云存储清理：统计「已删除动态」还有多少文件没回收（仅 admin）。
	 *
	 * 删除动态只做软删、不动文件（删了就找不回，误删 / 排查都没兜底），
	 * 所以原图和缩略图由运营在这里手动回收。
	 */
	async getMediaCleanupStats() {
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

			const [deletedRes, pendingRes, sampleRes] = await Promise.all([
				dailyPostCollection.where({ is_deleted: true }).count(),
				dailyPostCollection.where(buildPendingCleanupCondition()).count(),
				dailyPostCollection
					.where(buildPendingCleanupCondition())
					.orderBy('update_time', 'asc')
					.limit(MEDIA_CLEANUP_STATS_SAMPLE)
					.get()
			])

			const samples = sampleRes && Array.isArray(sampleRes.data) ? sampleRes.data : []
			const pendingFiles = samples.reduce(
				(sum, post) => sum + collectFileIdsFromPhotos(post.media_list).length,
				0
			)
			const deletedPosts = Number((deletedRes && deletedRes.total) || 0)
			const pendingPosts = Number((pendingRes && pendingRes.total) || 0)

			return {
				errCode: 0,
				data: {
					deletedPosts,
					pendingPosts,
					cleanedPosts: Math.max(0, deletedPosts - pendingPosts),
					// 文件数只按前 N 条抽样累加，sampled=true 时页面上要说明「约」
					pendingFiles,
					sampleCount: samples.length,
					sampled: pendingPosts > samples.length
				}
			}
		} catch (error) {
			return formatError(error, '获取云存储清理统计失败')
		}
	}

	/**
	 * 云存储清理：回收已删除动态的原图与缩略图（仅 admin）。
	 *
	 * 幂等靠 media_cleaned_at：清过的记录不会再被扫到，媒体里的 file_id 也一并摘掉。
	 * 单次只处理 limit 条（默认 20，最多 50）—— 每条要走一次 deleteFile + 一次 update，
	 * 一次跑太多会把云函数拖超时；运营连点几次即可清完存量。
	 */
	async cleanupDailyMedia(data = {}) {
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

			const rawLimit = Number(data.limit)
			const limit = Number.isFinite(rawLimit) && rawLimit > 0
				? Math.min(Math.round(rawLimit), MEDIA_CLEANUP_BATCH_MAX)
				: MEDIA_CLEANUP_BATCH_LIMIT

			const pendingRes = await dailyPostCollection
				.where(buildPendingCleanupCondition())
				.orderBy('update_time', 'asc')
				.limit(limit)
				.get()
			const posts = pendingRes && Array.isArray(pendingRes.data) ? pendingRes.data : []

			if (!posts.length) {
				return {
					errCode: 0,
					data: {
						posts: 0,
						files: 0,
						failed: 0,
						remaining: 0
					}
				}
			}

			let cleanedPosts = 0
			let deletedFiles = 0
			let failedPosts = 0

			for (const post of posts) {
				const fileIds = collectFileIdsFromPhotos(post.media_list)
				if (fileIds.length) {
					try {
						await uniCloud.deleteFile({
							fileList: fileIds
						})
						deletedFiles += fileIds.length
					} catch (error) {
						// 删文件失败就不打标记：下次还能重试。打了标记这些文件就永远漏在桶里
						console.warn('清理日常媒体文件失败:', post._id, error)
						failedPosts += 1
						continue
					}
				}

				const now = Date.now()
				await dailyPostCollection.doc(post._id).update({
					media_list: stripMediaFileIds(post.media_list),
					media_cleaned_at: now,
					update_time: now
				})
				cleanedPosts += 1
			}

			const remainingRes = await dailyPostCollection.where(buildPendingCleanupCondition()).count()

			return {
				errCode: 0,
				data: {
					posts: cleanedPosts,
					files: deletedFiles,
					failed: failedPosts,
					remaining: Number((remainingRes && remainingRes.total) || 0)
				}
			}
		} catch (error) {
			return formatError(error, '清理云存储失败')
		}
	}

	/**
	 * 更新权限设置（仅 admin）：支持只传要改的那几个开关。
	 * 每个值只认布尔，不做字符串兜底 —— 前端万一传 'false'，兜底反而会把它打开；
	 * 一个开关都没传也当参数错误，避免「以为改了其实没改」。
	 */
	async updatePermissionSettings(data = {}) {
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

			const nextSettings = {}
			if (data.feedVisible !== undefined) {
				if (typeof data.feedVisible !== 'boolean') {
					return {
						errCode: 'love-note-invalid-param',
						errMsg: 'feedVisible 必须是布尔值'
					}
				}
				nextSettings[SETTING_KEY_FEED_VISIBLE] = data.feedVisible
			}
			if (data.gameVisible !== undefined) {
				if (typeof data.gameVisible !== 'boolean') {
					return {
						errCode: 'love-note-invalid-param',
						errMsg: 'gameVisible 必须是布尔值'
					}
				}
				nextSettings[SETTING_KEY_GAME_VISIBLE] = data.gameVisible
			}
			if (data.gameItems !== undefined) {
				if (!data.gameItems || typeof data.gameItems !== 'object' || Array.isArray(data.gameItems)) {
					return {
						errCode: 'love-note-invalid-param',
						errMsg: 'gameItems 必须是对象'
					}
				}
				const gameItemTypes = Object.keys(data.gameItems)
				if (!gameItemTypes.length) {
					return {
						errCode: 'love-note-invalid-param',
						errMsg: 'gameItems 里没有要更新的游戏'
					}
				}
				for (let index = 0; index < gameItemTypes.length; index += 1) {
					const type = gameItemTypes[index]
					const settingKey = SETTING_KEY_GAME_ITEMS[type]
					// 未知类型直接报错，别静默丢弃 —— 前端拼错 key 会表现为「点了没反应」
					if (!settingKey) {
						return {
							errCode: 'love-note-invalid-param',
							errMsg: `未知的游戏类型 ${type}`
						}
					}
					if (typeof data.gameItems[type] !== 'boolean') {
						return {
							errCode: 'love-note-invalid-param',
							errMsg: `gameItems.${type} 必须是布尔值`
						}
					}
					nextSettings[settingKey] = data.gameItems[type]
				}
			}
			if (data.pointsTasks !== undefined) {
				if (!data.pointsTasks || typeof data.pointsTasks !== 'object' || Array.isArray(data.pointsTasks)) {
					return {
						errCode: 'love-note-invalid-param',
						errMsg: 'pointsTasks 必须是对象'
					}
				}
				const pointsTaskTypes = Object.keys(data.pointsTasks)
				if (!pointsTaskTypes.length) {
					return {
						errCode: 'love-note-invalid-param',
						errMsg: 'pointsTasks 里没有要更新的任务'
					}
				}
				for (let index = 0; index < pointsTaskTypes.length; index += 1) {
					const type = pointsTaskTypes[index]
					const settingKey = SETTING_KEY_POINTS_TASKS[type]
					if (!settingKey) {
						return {
							errCode: 'love-note-invalid-param',
							errMsg: `未知的任务类型 ${type}`
						}
					}
					if (typeof data.pointsTasks[type] !== 'boolean') {
						return {
							errCode: 'love-note-invalid-param',
							errMsg: `pointsTasks.${type} 必须是布尔值`
						}
					}
					nextSettings[settingKey] = data.pointsTasks[type]
				}
			}

			const settingKeys = Object.keys(nextSettings)
			if (!settingKeys.length) {
				return {
					errCode: 'love-note-invalid-param',
					errMsg: '没有需要更新的开关'
				}
			}

			// 先读当前值，写入后直接合并返回：比「写完再查一次」少依赖一次读一致性，
			// 返回的也一定是这次请求算出来的完整状态
			const current = await readModuleVisibility()
			const nextGameItems = Object.assign({}, current.gameItems)
			Object.keys(SETTING_KEY_GAME_ITEMS).forEach((type) => {
				const settingKey = SETTING_KEY_GAME_ITEMS[type]
				if (nextSettings[settingKey] !== undefined) {
					nextGameItems[type] = nextSettings[settingKey]
				}
			})
			const nextPointsTasks = Object.assign({}, current.pointsTasks)
			Object.keys(SETTING_KEY_POINTS_TASKS).forEach((type) => {
				const settingKey = SETTING_KEY_POINTS_TASKS[type]
				if (nextSettings[settingKey] !== undefined) {
					nextPointsTasks[type] = nextSettings[settingKey]
				}
			})
			const nextVisibility = {
				feedVisible: nextSettings[SETTING_KEY_FEED_VISIBLE] !== undefined
					? nextSettings[SETTING_KEY_FEED_VISIBLE]
					: current.feedVisible,
				gameVisible: nextSettings[SETTING_KEY_GAME_VISIBLE] !== undefined
					? nextSettings[SETTING_KEY_GAME_VISIBLE]
					: current.gameVisible,
				gameItems: nextGameItems,
				pointsTasks: nextPointsTasks
			}

			for (let index = 0; index < settingKeys.length; index += 1) {
				const key = settingKeys[index]
				await writeAppSetting(key, nextSettings[key], uid)
			}

			return {
				errCode: 0,
				data: Object.assign(nextVisibility, {
					updatedAt: Date.now()
				})
			}
		} catch (error) {
			return formatError(error, '保存权限设置失败')
		}
	}

	/**
	 * 心动点回补（仅 admin）：给历史账号补上「注册 100 / 绑定 1000 / 完善资料 50」。
	 *
	 * 按页遍历 uni-id-users（offset / limit），单次最多 200 个，翻页由调用方驱动 ——
	 * 用户量一大，一次性遍历必然撞云函数超时，只能这样切。
	 * 已经发过的账号靠流水短路，重复执行安全。
	 */
	async backfillPoints(data = {}) {
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

			const offset = Math.max(0, Math.floor(Number(data.offset) || 0))
			const limit = Math.min(200, Math.max(1, Math.floor(Number(data.limit) || 100)))

			const totalResult = await userCollection.where({}).count()
			const total = normalizeCount(totalResult && totalResult.total)

			// 预览模式：只报总数，不动任何数据（权限 tab 首屏显示「共多少个注册账号」）
			if (data.preview === true) {
				return {
					errCode: 0,
					data: {
						total,
						scanned: 0,
						accountsGranted: 0,
						records: { register: 0, bind: 0, profile: 0 },
						points: 0,
						skipped: 0,
						failed: 0,
						offset: 0,
						limit,
						nextOffset: 0,
						hasMore: total > 0,
						preview: true
					}
				}
			}

			// 按 _id 排序翻页，否则 skip/limit 在多页之间会漂
			const listResult = await userCollection
				.orderBy('_id', 'asc')
				.skip(offset)
				.limit(limit)
				.field({ _id: true })
				.get()
			const list = listResult && Array.isArray(listResult.data) ? listResult.data : []
			const uids = list.map((item) => item._id).filter(Boolean)

			const backfill = await pointsLib.backfillAccountAwards(uids)
			const nextOffset = offset + uids.length

			return {
				errCode: 0,
				data: Object.assign({}, backfill, {
					offset,
					limit,
					nextOffset,
					total,
					hasMore: uids.length > 0 && nextOffset < total
				})
			}
		} catch (error) {
			return formatError(error, '回补心动点失败')
		}
	}

	/**
	 * 客户端读取各模块可见性（首页 / 游戏大厅用）：游客也要按同一口径渲染，所以进免登录白名单。
	 * 读不到一律按默认值返回（feed 关、game 与小游戏都开），不抛错误码 —— 页面不该因为配置问题弹 toast。
	 */
	async getModuleVisibility() {
		return {
			errCode: 0,
			data: await readModuleVisibility()
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

			const now = Number(data.now) || Date.now()
			const visitorKey = uid || `guest:${deviceId}`

			// 单用户（或游客设备）30 分钟内只记一次访问
			const cutoff = now - VISIT_DEDUPE_WINDOW_MS
			const recentRes = await visitCollection
				.where({
					visitor_key: visitorKey,
					create_time: dbCmd.gte(cutoff)
				})
				.orderBy('create_time', 'desc')
				.limit(1)
				.field({ _id: true, create_time: true })
				.get()
			const recentRow = recentRes && Array.isArray(recentRes.data) ? recentRes.data[0] : null
			if (recentRow) {
				return {
					errCode: 0,
					data: {
						recorded: false,
						throttled: true
					}
				}
			}

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
