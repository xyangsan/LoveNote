'use strict'

/**
 * 心动点核心逻辑（账户 + 流水 + 日切 + 幂等 + 每日挑战）
 *
 * 设计要点：
 *   1. 一人一条账户（_id 就是 uid），余额用 dbCmd.inc 累加，永不为负；
 *   2. 一切「是否已经计过分」都靠 love-point-logs 的 dedupe_key 唯一索引判定，
 *      重复写入被数据库拦截 → 静默视为已计分，天然幂等；
 *   3. 所有函数内部 try/catch，积分失败绝不影响发布 / 上传 / 结算主流程。
 */

const {
	dbCmd,
	pointAccountCollection,
	pointLogCollection,
	coupleCollection,
	userCollection
} = require('./db')
const { todayKey, addDays, dayStartTs } = require('./date-key')

/** 已绑定：与 lib/couple.js 的 COUPLE_STATUS_BOUND 同值，这里只读不回写，避免跨模块耦合 */
const COUPLE_STATUS_BOUND = 1

/** 运营回补覆盖的一次性奖励（后加规则，老账号可能整笔缺失） */
const BACKFILL_TASK_KEYS = ['register_bonus', 'bind_couple', 'profile_complete']

/** 任务规则：once 为一次性，dailyLimit 为每天最多计分几次，unit 是展示单位 */
const TASK_RULES = {
	daily_bonus: { points: 10, dailyLimit: 1, title: '每日签到', unit: '天' },
	daily_post: { points: 5, dailyLimit: 5, title: '发布双人日常', unit: '条', dailyTask: true },
	photo_upload: { points: 5, dailyLimit: 10, title: '上传相册', unit: '张', dailyTask: true },
	anniversary: { points: 5, dailyLimit: 5, title: '新增纪念日', unit: '个', dailyTask: true },
	plan_create: { points: 5, dailyLimit: 5, title: '新增愿望 / 计划', unit: '条', dailyTask: true },
	game_settle: { points: 5, dailyLimit: 5, title: '完成一局游戏', unit: '局', dailyTask: true },
	plan_finish: { points: 10, dailyLimit: 3, title: '完成愿望 / 计划', unit: '个', dailyTask: true },
	bind_couple: { points: 1000, once: true, allowUnbound: true, title: '绑定情侣', unit: '次' },
	register_bonus: { points: 100, once: true, allowUnbound: true, title: '新人见面礼', unit: '次' },
	profile_complete: { points: 50, once: true, title: '完善个人资料', unit: '次' }
}

/** 每日挑战阶梯：当日完成的任务种类数达标即发放 */
const CHALLENGE_TIERS = [
	{ taskCount: 2, points: 15 },
	{ taskCount: 4, points: 50 },
	{ taskCount: 6, points: 100 }
]

/**
 * 奖励类型统一定义：类型 → 基础点数 / 点数上限 / 来源。
 * 业务侧只传 type，点数由服务端按配置 + 业务上下文算，前端不可控。
 * maxPoints 是单次发放上限（防越权传大数）。
 */
const REWARD_TYPES = {
	// 每日签到：基础 10，连续签到附加另算（最高 100）
	sign: { basePoints: 10, maxPoints: 100, title: '每日签到', source: 'sign' },
	// 每日挑战三档
	challenge_2: { basePoints: 15, maxPoints: 15, title: '每日挑战 · 完成 2 个任务', source: 'challenge' },
	challenge_4: { basePoints: 50, maxPoints: 50, title: '每日挑战 · 完成 4 个任务', source: 'challenge' },
	challenge_6: { basePoints: 100, maxPoints: 100, title: '每日挑战 · 完成 6 个任务', source: 'challenge' },
	// 每日任务（maxPoints = 单次 × 日上限）
	daily_post: { basePoints: 5, maxPoints: 25, title: '发布双人日常', source: 'task' },
	photo_upload: { basePoints: 5, maxPoints: 50, title: '上传相册', source: 'task' },
	game_settle: { basePoints: 5, maxPoints: 25, title: '完成一局游戏', source: 'task' },
	anniversary: { basePoints: 5, maxPoints: 25, title: '新增纪念日', source: 'task' },
	plan_create: { basePoints: 5, maxPoints: 25, title: '新增愿望 / 计划', source: 'task' },
	plan_finish: { basePoints: 10, maxPoints: 30, title: '完成愿望 / 计划', source: 'task' },
	// 里程碑
	bind_couple: { basePoints: 1000, maxPoints: 1000, title: '绑定情侣', source: 'milestone' },
	profile_complete: { basePoints: 50, maxPoints: 50, title: '完善个人资料', source: 'milestone' },
	register_bonus: { basePoints: 100, maxPoints: 100, title: '注册奖励', source: 'register' }
}

/**
 * 每日签到：七天一循环，第 7 天断崖大奖，签满重新回到第 1 天。
 * 连续天数（sign_streak）一直累加用于展示，只影响落在周期里的第几格。
 */
const SIGN_TIERS = [10, 15, 20, 25, 30, 40, 100]
const SIGN_CYCLE_DAYS = SIGN_TIERS.length

/** 连续第 streak 天落在周期里的第几格（1-7） */
function getSignCycleDay(streak) {
	const day = Math.max(1, Math.floor(Number(streak) || 1))
	return ((day - 1) % SIGN_CYCLE_DAYS) + 1
}

/** 连续第 streak 天能拿多少分 */
function calcSignPoints(streak) {
	return SIGN_TIERS[getSignCycleDay(streak) - 1]
}

/** 一次性里程碑（详情页分组展示） */
const MILESTONE_DEFS = [
	{ key: 'bind_couple', title: '绑定情侣', desc: '每个账号仅一次', points: 1000, path: '/pages/couple/index', actionText: '去绑定' },
	{ key: 'profile_complete', title: '完善个人资料', desc: '头像 + 昵称 + 生日', points: 50, path: '/pages/profile/edit', actionText: '去完善' },
	// 注册奖励：注册时由 ensureRegisterBonus 发放，这里只做展示与完成态判断（流水 key 与 TASK_RULES 一致）
	{ key: 'register_bonus', title: '注册奖励', desc: '新账号注册时自动发放', points: 100, path: '', actionText: '' }
]

/** 计入每日挑战的每日任务（6 个） */
const DAILY_TASK_KEYS = Object.keys(TASK_RULES).filter((key) => TASK_RULES[key].dailyTask)

/** 详情页任务列表展示顺序 */
const TASK_DISPLAY_ORDER = [
	'daily_post',
	'photo_upload',
	'game_settle',
	'anniversary',
	'plan_create',
	'plan_finish'
]

/** 任务跳转目标，前端直接用 */
const TASK_ACTIONS = {
	daily_post: { actionText: '去发布', path: '/pages/feed/publish' },
	photo_upload: { actionText: '去上传', path: '/pages/album/upload' },
	game_settle: { actionText: '去开一局', path: '/pages/game/index' },
	anniversary: { actionText: '去添加', path: '/pages/anniversary/edit' },
	plan_create: { actionText: '去添加', path: '/pages/plan/list' },
	plan_finish: { actionText: '去完成', path: '/pages/plan/list' }
}

function toCount(value = 0) {
	const next = Number(value)
	if (Number.isNaN(next) || next < 0) {
		return 0
	}
	return Math.floor(next)
}

function buildEmptyAccount(uid, now = Date.now()) {
	return {
		_id: uid,
		uid,
		couple_id: '',
		balance: 0,
		total_earned: 0,
		today_key: todayKey(now),
		today_earned: 0,
		today_counts: {},
		today_tasks: [],
		today_challenge: [],
		last_daily_key: '',
		sign_streak: 0,
		created_at: now,
		updated_at: now
	}
}

async function readAccount(uid) {
	if (!uid) {
		return null
	}
	try {
		const res = await pointAccountCollection.doc(uid).get()
		return res && res.data && res.data[0] ? res.data[0] : null
	} catch (error) {
		console.warn('points readAccount failed', error)
		return null
	}
}

/**
 * 读账户，不存在则建；跨天则清空当日计数。
 * 返回的 account 一定是「今天」的视图，但跨天只在数据库里写一次。
 */
async function ensureAccount(uid, now = Date.now()) {
	const dateKey = todayKey(now)
	let account = await readAccount(uid)

	if (!account) {
		const doc = buildEmptyAccount(uid, now)
		try {
			await pointAccountCollection.add(doc)
		} catch (error) {
			// 并发下另一个请求已经建好了，读回来即可
			console.warn('points ensureAccount add failed', error)
		}
		const created = await readAccount(uid)
		return created || doc
	}

	const resetPatch = {}
	const resetValues = {}
	if (account.today_key !== dateKey) {
		// ⚠️ 空对象 / 空数组在 uniCloud 展平写时没有叶子，会被静默跳过 → 必须 dbCmd.set 整体替换
		resetPatch.today_key = dateKey
		resetPatch.today_earned = 0
		resetPatch.today_counts = dbCmd.set({})
		resetPatch.today_tasks = dbCmd.set([])
		resetPatch.today_challenge = dbCmd.set([])
		resetPatch.updated_at = now
		resetValues.today_key = dateKey
		resetValues.today_earned = 0
		resetValues.today_counts = {}
		resetValues.today_tasks = []
		resetValues.today_challenge = []
		resetValues.updated_at = now
	}
	// 历史脏数据兜底：today_counts / today_tasks 必须是容器类型
	if (!account.today_counts || typeof account.today_counts !== 'object' || Array.isArray(account.today_counts)) {
		resetPatch.today_counts = dbCmd.set({})
		resetValues.today_counts = {}
	}
	if (!Array.isArray(account.today_tasks)) {
		resetPatch.today_tasks = dbCmd.set([])
		resetValues.today_tasks = []
	}
	if (!Array.isArray(account.today_challenge)) {
		resetPatch.today_challenge = dbCmd.set([])
		resetValues.today_challenge = []
	}

	if (Object.keys(resetPatch).length) {
		try {
			await pointAccountCollection.doc(uid).update(resetPatch)
		} catch (error) {
			console.warn('points ensureAccount reset failed', error)
		}
		return Object.assign({}, account, resetValues)
	}

	return account
}

/**
 * 底层发分：先写流水（唯一索引幂等），成功后再累加余额。
 * dedupe_key 规则：`uid:taskKey:dateKey:refId`，重复写入被数据库拦截即视为已计分。
 * @returns {Promise<boolean>} 是否真的发了分
 */
async function submitAward({
	uid,
	taskKey,
	points,
	title = '',
	dateKey = '',
	refId = 'x',
	coupleId = '',
	now = Date.now(),
	source = '',
	extra = ''
}) {
	const dedupeKey = `${uid}:${taskKey}:${dateKey}:${refId}`
	try {
		await pointLogCollection.add({
			dedupe_key: dedupeKey,
			uid,
			couple_id: coupleId || '',
			task_key: taskKey,
			title: title || '',
			points,
			date_key: dateKey,
			ref_id: refId === 'x' ? '' : refId,
			source: source || taskKey,
			extra: extra || '',
			create_time: now
		})
	} catch (error) {
		// 唯一索引冲突 = 已计过分；其余异常也不阻断主流程
		console.warn('points submitAward skip', dedupeKey, error && error.message)
		return false
	}

	try {
		await pointAccountCollection.doc(uid).update({
			balance: dbCmd.inc(points),
			total_earned: dbCmd.inc(points > 0 ? points : 0),
			today_earned: dbCmd.inc(points),
			updated_at: now
		})
	} catch (error) {
		console.warn('points submitAward balance failed', error)
	}

	return true
}

/**
 * 统一发点通道：所有发点都必须走这里。
 *
 * 流程：类型校验 → 点数上限校验 → 写流水（dedupe_key 唯一）→ 累加余额。
 *
 * @param {Object} options
 * @param {string} options.uid 用户 id
 * @param {string} options.type REWARD_TYPES 的 key
 * @param {number} options.points 点数（服务端计算，前端不可控）
 * @param {string} options.coupleId 情侣 id
 * @param {string} options.refId 业务引用 id
 * @param {string} options.dateKey 日期 key
 * @param {string} options.extra 自定义数据
 * @param {number} options.now
 * @returns {Promise<{ok:boolean, reason:string, points:number, duplicate?:boolean}>}
 */
async function grantReward(options = {}) {
	const {
		uid,
		type,
		points,
		title = '',
		coupleId = '',
		refId = 'x',
		dateKey = '',
		extra = '',
		now = Date.now()
	} = options

	if (!uid || !type) {
		return { ok: false, reason: 'invalid-param', points: 0 }
	}

	// 1. 类型必须是已登记的
	const config = REWARD_TYPES[type]
	if (!config) {
		return { ok: false, reason: 'invalid-type', points: 0 }
	}

	// 2. 点数上限：不能超过该类型的单次发放上限
	const maxPoints = Number(config.maxPoints || config.basePoints || 0)
	if (Number(points) > maxPoints) {
		return { ok: false, reason: 'points-exceeded', points: 0 }
	}

	// 3. 写流水 + 累加余额
	const ok = await submitAward({
		uid,
		taskKey: type,
		points,
		title: title || config.title,
		dateKey,
		refId,
		coupleId,
		source: config.source,
		extra,
		now
	})

	if (!ok) {
		return { ok: false, reason: 'failed', points: 0 }
	}

	return { ok: true, reason: '', points, duplicate: false }
}

/**
 * 业务写入点调用：按规则判定日上限，通过则发分并记录当日任务种类。
 *
 * @param {string} uid
 * @param {string} taskKey TASK_RULES 的 key
 * @param {Object} options { count, refId, coupleId, title, now }
 */
async function awardPoints(uid, taskKey, options = {}) {
	try {
		if (!uid) {
			return { awarded: 0, points: 0, reason: 'no-uid' }
		}
		const rule = TASK_RULES[taskKey]
		if (!rule) {
			return { awarded: 0, points: 0, reason: 'unknown-task' }
		}

		const now = Number(options.now) || Date.now()
		const dateKey = todayKey(now)
		const count = Math.max(1, Math.floor(Number(options.count) || 1))
		const account = await ensureAccount(uid, now)

		// 心动点依附情侣关系：未绑定（且不是「绑定」这条本身）不计分
		const coupleId = String(options.coupleId || account.couple_id || '')
		if (!rule.allowUnbound && !coupleId) {
			return { awarded: 0, points: 0, reason: 'not-bound' }
		}

		let limited = count
		if (!rule.once && rule.dailyLimit) {
			const used = toCount((account.today_counts || {})[taskKey])
			limited = Math.min(count, Math.max(0, rule.dailyLimit - used))
		}

		if (limited <= 0) {
			return { awarded: 0, points: 0, reason: 'daily-limit', balance: toCount(account.balance) }
		}

		const points = rule.points * limited
		const dedupeDate = rule.once ? 'once' : dateKey
		const refId = rule.once ? 'static' : String(options.refId || dateKey)

		// 统一发点通道：任务类不支持视频倍率，走 grantReward 的类型校验 + 点数上限 + 幂等
		const result = await grantReward({
			uid,
			type: taskKey,
			points,
			title: options.title || rule.title,
			coupleId: options.coupleId || account.couple_id || '',
			dateKey: dedupeDate,
			refId,
			now
		})

		if (!result.ok) {
			const reason = result.reason === 'failed' ? 'duplicated' : result.reason
			return { awarded: 0, points: 0, reason, balance: toCount(account.balance) }
		}

		const patch = { updated_at: now }
		if (coupleId && account.couple_id !== coupleId) {
			patch.couple_id = coupleId
		}
		if (!rule.once && rule.dailyLimit) {
			patch[`today_counts.${taskKey}`] = dbCmd.inc(limited)
		}
		if (rule.dailyTask) {
			patch.today_tasks = dbCmd.addToSet(taskKey)
		}

		try {
			await pointAccountCollection.doc(uid).update(patch)
		} catch (error) {
			console.warn('points awardPoints counter failed', error)
		}

		// 挑战奖励改成手动领取（claimChallenge），这里不再顺带结算
		return {
			awarded: limited,
			points,
			reason: 'ok',
			balance: toCount(account.balance) + points,
			challengeGranted: []
		}
	} catch (error) {
		console.warn('points awardPoints failed', taskKey, error)
		return { awarded: 0, points: 0, reason: 'error' }
	}
}

/**
 * 手动领取每日挑战奖励：达标且未领取才发放。
 * 所有校验都基于服务端数据（today_tasks / today_challenge），前端只传档位，传别的值一律拒绝。
 * 返回 { ok, reason, points }，reason: invalid / unbound / not-reached / claimed / failed。
 */
async function claimChallenge(uid, activeCouple, tierTaskCount, now = Date.now()) {
	// 档位必须是服务端定义的三个之一
	const tier = CHALLENGE_TIERS.find((item) => item.taskCount === Number(tierTaskCount))
	if (!tier) {
		return { ok: false, reason: 'invalid', points: 0 }
	}

	// 心动点依附情侣关系：未绑定不发
	if (!activeCouple || !activeCouple._id) {
		return { ok: false, reason: 'unbound', points: 0 }
	}

	// ensureAccount 会按天重置 today_tasks / today_challenge，避免跨天拿昨天的进度领奖
	const account = await ensureAccount(uid, now)

	const taskCount = Array.isArray(account.today_tasks) ? account.today_tasks.length : 0
	if (taskCount < tier.taskCount) {
		return { ok: false, reason: 'not-reached', points: 0 }
	}

	const claimed = Array.isArray(account.today_challenge) ? account.today_challenge : []
	if (claimed.includes(tier.taskCount)) {
		return { ok: false, reason: 'claimed', points: 0 }
	}

	// 统一发点通道：点数由服务端档位配置决定
	const result = await grantReward({
		uid,
		type: `challenge_${tier.taskCount}`,
		points: tier.points,
		coupleId: activeCouple._id,
		dateKey: todayKey(now),
		refId: 'x',
		now
	})

	if (!result.ok) {
		return { ok: false, reason: result.reason, points: 0 }
	}

	try {
		await pointAccountCollection.doc(uid).update({
			today_challenge: dbCmd.addToSet(tier.taskCount),
			updated_at: now
		})
	} catch (error) {
		console.warn('points claimChallenge mark failed', error)
	}

	return { ok: true, reason: '', points: result.points }
}

/**
 * 每日签到：基础 10 点 + 连续签到附加（第 4 天起每天 +1，封顶 30）。
 * 昨天签过 → 连续天数 +1；断签则从 1 重新开始。
 * 返回 { ok, reason, streak, cycleDay, points }，reason: unbound / already / failed。
 */
async function signIn(uid, activeCouple, now = Date.now()) {
	if (!activeCouple || !activeCouple._id) {
		return { ok: false, reason: 'unbound', streak: 0, cycleDay: 1, points: 0 }
	}

	const dateKey = todayKey(now)
	const account = await ensureAccount(uid, now)
	if (account.last_daily_key === dateKey) {
		return { ok: false, reason: 'already', streak: Number(account.sign_streak || 0), cycleDay: getSignCycleDay(account.sign_streak || 0), points: 0 }
	}

	const yesterdayKey = todayKey(now - 86400000)
	const prevStreak = Number(account.sign_streak || 0)
	const streak = account.last_daily_key === yesterdayKey ? prevStreak + 1 : 1
	const cycleDay = getSignCycleDay(streak)
	const basePoints = calcSignPoints(streak)

	// 统一发点通道：点数由服务端连续天数决定
	const result = await grantReward({
		uid,
		type: 'sign',
		points: basePoints,
		coupleId: activeCouple._id,
		dateKey,
		refId: 'x',
		now
	})

	if (!result.ok) {
		return { ok: false, reason: result.reason, streak, cycleDay, points: 0 }
	}

	try {
		await pointAccountCollection.doc(uid).update({
			last_daily_key: dateKey,
			sign_streak: streak,
			couple_id: activeCouple._id,
			updated_at: now
		})
	} catch (error) {
		console.warn('points signIn mark failed', error)
	}

	return { ok: true, reason: '', streak, cycleDay, points: result.points }
}

/**
 * 新人见面礼：每个账号一生一次 +100，登录 / 注册成功后调用。
 * 两层幂等：先查流水短路（老用户每次登录不再打库），真发放时靠 dedupe_key 唯一索引兜住并发。
 * 内部吞异常，发放失败绝不影响登录。
 */
async function ensureRegisterBonus(uid, now = Date.now()) {
	try {
		if (!uid) {
			return 0
		}

		const existing = await pointLogCollection
			.where({ uid, task_key: 'register_bonus' })
			.limit(1)
			.get()
		if (existing && existing.data && existing.data.length) {
			return 0
		}

		const result = await awardPoints(uid, 'register_bonus', { now })
		return result && result.awarded > 0 ? Number(result.points || 0) : 0
	} catch (error) {
		console.warn('points ensureRegisterBonus failed', error)
		return 0
	}
}

/**
 * 运营侧批量回补「一次性奖励」：接口层负责翻页，这里只处理传进来的一页 uid。
 *
 * 补三类后加规则，缺哪笔补哪笔（已有流水的跳过，重复执行安全）：
 *   register_bonus    100  —— 所有账号
 *   bind_couple      1000  —— 当前 relationships 里处于已绑定状态的账号
 *   profile_complete   50  —— 已绑定 + 头像 / 昵称 / 生日齐全
 *                             （与 service/user.js updateProfile 里的实时口径完全一致，
 *                              那边也是「有情侣关系才发」，别自己加宽）
 *
 * 一页只打三次批量查询（流水 / 情侣关系 / 用户资料），而不是逐个查。
 *
 * @param {string[]} uids
 * @returns {Promise<Object>} { scanned, accountsGranted, records, points, skipped, failed }
 */
async function backfillAccountAwards(uids = [], now = Date.now()) {
	const uidList = (Array.isArray(uids) ? uids : [])
		.map((item) => String(item || '').trim())
		.filter(Boolean)
	const result = {
		scanned: uidList.length,
		accountsGranted: 0,
		records: { register: 0, bind: 0, profile: 0 },
		points: 0,
		skipped: 0,
		failed: 0
	}
	if (!uidList.length) {
		return result
	}

	// ① 这一页里谁已经领过哪些笔
	const ownedMap = new Map()
	try {
		const res = await pointLogCollection
			.where({ uid: dbCmd.in(uidList), task_key: dbCmd.in(BACKFILL_TASK_KEYS) })
			.limit(uidList.length * BACKFILL_TASK_KEYS.length)
			.get()
		;((res && res.data) || []).forEach((item) => {
			if (!ownedMap.has(item.uid)) {
				ownedMap.set(item.uid, new Set())
			}
			ownedMap.get(item.uid).add(item.task_key)
		})
	} catch (error) {
		// 查不到就退化成逐个判断：awardPoints 的 dedupe_key 唯一索引仍然兜得住重复
		console.warn('points backfillAccountAwards logs failed', error)
	}

	// ② 谁还处在已绑定关系里（uid → coupleId，绑定时要带上）
	const coupleIdByUid = new Map()
	try {
		const res = await coupleCollection
			.where(dbCmd.and([
				{ status: COUPLE_STATUS_BOUND },
				dbCmd.or([
					{ user_a_uid: dbCmd.in(uidList) },
					{ user_b_uid: dbCmd.in(uidList) }
				])
			]))
			.limit(uidList.length)
			.get()
		;((res && res.data) || []).forEach((item) => {
			if (uidList.includes(item.user_a_uid)) {
				coupleIdByUid.set(item.user_a_uid, item._id)
			}
			if (uidList.includes(item.user_b_uid)) {
				coupleIdByUid.set(item.user_b_uid, item._id)
			}
		})
	} catch (error) {
		console.warn('points backfillAccountAwards couples failed', error)
	}

	// ③ 谁的资料已经齐全（口径同 updateProfile：头像 + 昵称 + 生日）
	const completedUids = new Set()
	try {
		const res = await userCollection
			.where({ _id: dbCmd.in(uidList) })
			.field({ _id: true, nickname: true, birthday: true, avatar: true, avatar_file_id: true })
			.limit(uidList.length)
			.get()
		;((res && res.data) || []).forEach((item) => {
			const hasAvatar = Boolean(item.avatar || item.avatar_file_id)
			if (hasAvatar && item.nickname && item.birthday) {
				completedUids.add(item._id)
			}
		})
	} catch (error) {
		console.warn('points backfillAccountAwards users failed', error)
	}

	for (let index = 0; index < uidList.length; index += 1) {
		const uid = uidList[index]
		const owned = ownedMap.get(uid) || new Set()
		const coupleId = coupleIdByUid.get(uid) || ''
		let grantedCount = 0

		const grantOnce = async (taskKey) => {
			if (owned.has(taskKey)) {
				return false
			}
			const awarded = await awardPoints(uid, taskKey, { now, coupleId })
			if (awarded && awarded.awarded > 0) {
				result.points += Number(awarded.points || 0)
				return true
			}
			return false
		}

		try {
			if (await grantOnce('register_bonus')) {
				result.records.register += 1
				grantedCount += 1
			}
			if (coupleId) {
				if (await grantOnce('bind_couple')) {
					result.records.bind += 1
					grantedCount += 1
				}
				if (completedUids.has(uid) && await grantOnce('profile_complete')) {
					result.records.profile += 1
					grantedCount += 1
				}
			}
		} catch (error) {
			result.failed += 1
			console.warn('points backfillAccountAwards failed', uid, error)
			continue
		}

		if (grantedCount > 0) {
			result.accountsGranted += 1
		} else {
			result.skipped += 1
		}
	}

	return result
}

/** 绑定成功：记录 couple_id（+1000 由 awardPoints 单独发） */
async function bindAccountCouple(uid, coupleId, now = Date.now()) {
	try {
		await ensureAccount(uid, now)
		await pointAccountCollection.doc(uid).update({
			couple_id: coupleId || '',
			updated_at: now
		})
	} catch (error) {
		console.warn('points bindAccountCouple failed', error)
	}
}

/**
 * 解绑清零：余额归零、累计归零、当日计数清空，并留一条负数流水备查。
 * @returns {Promise<Object>} { cleared, balanceBefore }
 */
async function resetForUnbind(uid, relationId = '', now = Date.now()) {
	try {
		const account = await readAccount(uid)
		if (!account) {
			return { cleared: false, balanceBefore: 0 }
		}

		const balanceBefore = toCount(account.balance)
		if (balanceBefore > 0) {
			await submitAward({
				uid,
				taskKey: 'couple_unbind',
				points: -balanceBefore,
				title: '解绑情侣 · 心动点清零',
				dateKey: todayKey(now),
				refId: String(relationId || 'x'),
				coupleId: '',
				source: 'unbind',
				now
			})
		}

		await pointAccountCollection.doc(uid).update({
			balance: 0,
			total_earned: 0,
			couple_id: '',
			today_earned: 0,
			// ⚠️ 同 ensureAccount：空容器必须 dbCmd.set，否则展平写没有叶子、旧计数永远清不掉
			today_counts: dbCmd.set({}),
			today_tasks: dbCmd.set([]),
			today_challenge: dbCmd.set([]),
			last_daily_key: '',
			sign_streak: 0,
			updated_at: now
		})

		return { cleared: true, balanceBefore }
	} catch (error) {
		console.warn('points resetForUnbind failed', error)
		return { cleared: false, balanceBefore: 0 }
	}
}

/** 详情页摘要 */
async function getSummary(uid, activeCouple, now = Date.now()) {
	const isBound = Boolean(activeCouple && activeCouple._id)
	await ensureAccount(uid, now)

	const account = (await readAccount(uid)) || buildEmptyAccount(uid, now)
	const dateKey = todayKey(now)
	const signedToday = account.last_daily_key === dateKey
	const yesterdayKey = todayKey(now - 86400000)
	const prevStreak = Number(account.sign_streak || 0)
	// 当前连续天数：今天签过就是 streak；没签但昨天签过，streak 仍然有效
	const currentStreak = signedToday ? prevStreak : (account.last_daily_key === yesterdayKey ? prevStreak : 0)
	// 今天签到后会是第几天（断签从 1 重新开始）
	const nextStreak = signedToday ? prevStreak : (account.last_daily_key === yesterdayKey ? prevStreak + 1 : 1)
	// 落点在七天周期里的第几格：已签看今天那格，未签看今天要签的那格
	const effectiveStreak = signedToday ? prevStreak : nextStreak
	const signCycleDay = getSignCycleDay(effectiveStreak)
	const counts = account.today_counts && typeof account.today_counts === 'object' ? account.today_counts : {}
	const taskKeys = Array.isArray(account.today_tasks) ? account.today_tasks : []
	const claimed = Array.isArray(account.today_challenge) ? account.today_challenge : []

	const tasks = TASK_DISPLAY_ORDER.map((key) => {
		const rule = TASK_RULES[key]
		const action = TASK_ACTIONS[key] || {}
		const used = toCount(counts[key])
		const limit = Number(rule.dailyLimit || 0)
		return {
			key,
			title: rule.title,
			points: rule.points,
			unit: rule.unit || '次',
			limit,
			used,
			remain: Math.max(0, limit - used),
			reached: limit > 0 && used >= limit,
			actionText: action.actionText || '',
			path: action.path || ''
		}
	})

	const tiers = CHALLENGE_TIERS.map((tier, index) => {
		const done = taskKeys.length >= tier.taskCount
		const isCurrent = !done && taskKeys.length >= (CHALLENGE_TIERS[index - 1] ? CHALLENGE_TIERS[index - 1].taskCount : 0)
		const tierClaimed = claimed.includes(tier.taskCount)
		return {
			taskCount: tier.taskCount,
			points: tier.points,
			done,
			current: isCurrent,
			gap: Math.max(0, tier.taskCount - taskKeys.length),
			// 达标且今天还没领 → 前端显示「领取」按钮
			claimed: tierClaimed,
			claimable: done && !tierClaimed
		}
	})

	const nextTier = tiers.find((item) => !item.done) || null

	// 里程碑完成状态：查一次流水就够（三个 key 都是 once）
	let doneKeys = new Set()
	try {
		const milestoneRes = await pointLogCollection
			.where({ uid, task_key: dbCmd.in(MILESTONE_DEFS.map((item) => item.key)) })
			.limit(20)
			.get()
		doneKeys = new Set(((milestoneRes && milestoneRes.data) || []).map((item) => item.task_key))
	} catch (error) {
		console.warn('points getSummary milestones failed', error)
	}

	const milestones = MILESTONE_DEFS.map((item) => ({
		key: item.key,
		title: item.title,
		desc: item.desc,
		points: item.points,
		path: item.path,
		actionText: item.actionText,
		done: doneKeys.has(item.key)
	}))

	// 每日任务满额分（进度条分母）：各任务 分值 × 日上限 之和
	const dailyLimitPoints = TASK_DISPLAY_ORDER.reduce((sum, key) => {
		const rule = TASK_RULES[key]
		return sum + rule.points * Number(rule.dailyLimit || 1)
	}, 0)
	// 今日「任务」得分：不含每日相伴与挑战奖励，和 dailyLimitPoints 同一个口径
	const todayTaskPoints = TASK_DISPLAY_ORDER.reduce((sum, key) => {
		const rule = TASK_RULES[key]
		return sum + rule.points * toCount(counts[key])
	}, 0)

	return {
		isBound,
		balance: toCount(account.balance),
		totalEarned: toCount(account.total_earned),
		todayEarned: toCount(account.today_earned),
		todayTaskPoints,
		registerBonusPoints: TASK_RULES.register_bonus.points,
		todayKey: account.today_key || todayKey(now),
		dailyBonusPoints: SIGN_TIERS[0],
		dailyBonusClaimed: signedToday,
		signStreak: currentStreak,
		signNextStreak: nextStreak,
		// 今天落在七天周期里的第几格 + 这一格的分值，前端弹框直接照着画
		signCycleDay,
		signPoints: calcSignPoints(effectiveStreak),
		signTiers: SIGN_TIERS.map((points, index) => ({ day: index + 1, points })),
		taskCount: taskKeys.length,
		totalTaskCount: DAILY_TASK_KEYS.length,
		nextTierGap: nextTier ? nextTier.gap : 0,
		nextTierPoints: nextTier ? nextTier.points : 0,
		tiers,
		tasks,
		milestones,
		dailyLimitPoints,
		// 挑战奖励改成手动领取，这里不再自动结算
		challengeGranted: []
	}
}

/** 明细记录：最近若干条 + 今日/本周汇总 */
async function getLogs(uid, options = {}) {
	const now = Number(options.now) || Date.now()
	const limit = Math.min(60, Math.max(1, Math.floor(Number(options.limit) || 30)))
	const before = Number(options.before) || 0
	const dateKey = todayKey(now)

	// ⚠️ 必须先 ensureAccount：跨天后 today_earned 还停在昨天，直接读会让「今日」显示前一天的分
	await ensureAccount(uid, now)

	const where = { uid }
	if (before > 0) {
		where.create_time = dbCmd.lt(before)
	}

	const res = await pointLogCollection
		.where(where)
		.orderBy('create_time', 'desc')
		.limit(limit)
		.get()

	const logs = (res && res.data ? res.data : []).map((item) => ({
		id: item._id,
		taskKey: item.task_key || '',
		title: item.title || '',
		points: Number(item.points || 0),
		dateKey: item.date_key || '',
		createTime: Number(item.create_time || 0)
	}))

	const account = (await readAccount(uid)) || buildEmptyAccount(uid, now)
	// 「本周」按真实时间戳筛，不能按 date_key：一次性任务（绑定 +1000 等）的 date_key 是 'once'，
	// 字符串比较下恒大于任何日期，会把几个月前的一次性奖励算进本周。
	const weekStartTs = dayStartTs(addDays(dateKey, -6))
	const weekRes = await pointLogCollection
		.where({ uid, create_time: dbCmd.gte(weekStartTs) })
		.limit(500)
		.get()
	const weekLogs = weekRes && weekRes.data ? weekRes.data : []
	const weekTotal = weekLogs.reduce((sum, item) => {
		const value = Number(item.points || 0)
		return value > 0 ? sum + value : sum
	}, 0)

	return {
		logs,
		hasMore: logs.length >= limit,
		nextBefore: logs.length ? logs[logs.length - 1].createTime : 0,
		summary: {
			today: toCount(account.today_earned),
			week: weekTotal,
			total: toCount(account.balance)
		}
	}
}

module.exports = {
	TASK_RULES,
	CHALLENGE_TIERS,
	DAILY_TASK_KEYS,
	TASK_DISPLAY_ORDER,
	TASK_ACTIONS,
	ensureAccount,
	readAccount,
	awardPoints,
	claimChallenge,
	signIn,
	ensureRegisterBonus,
	backfillAccountAwards,
	bindAccountCouple,
	resetForUnbind,
	getSummary,
	getLogs
}
