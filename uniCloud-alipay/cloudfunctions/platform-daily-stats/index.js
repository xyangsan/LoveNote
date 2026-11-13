'use strict'

/**
 * 运营管理：每日数据快照
 *
 * 为什么需要：
 *   - last_login_date 是覆盖式的，跨天就查不回「昨天多少人登录」；
 *   - 每次打开运营后台都实时聚合 7/30 天会把云函数压满。
 * 所以每天 00:10 把「昨天」的结果固化到 love-daily-stats，页面读快照 + 今天实时算。
 *
 * 触发：
 *   默认（event 为空）→ 只算昨天，用于定时任务。
 *   回填历史：{ "days": 30 } → 从 30 天前算到昨天，一次跑完。
 *   指定单日：{ "date": "2026-11-12" }
 */

const db = uniCloud.database()
const dbCmd = db.command
const $ = dbCmd.aggregate

const userCollection = db.collection('uni-id-users')
const coupleCollection = db.collection('love-couples')
const visitCollection = db.collection('love-visits')
const dailyStatCollection = db.collection('love-daily-stats')
const uniIdLogCollection = db.collection('uni-id-log')

const COUPLE_STATUS_BOUND = 1
const LOG_TYPE_LOGIN = 'login'

const TZ_OFFSET = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const VISIT_RETENTION_DAYS = 30
const MAX_BACKFILL_DAYS = 90

function toDateKey(timestamp) {
	const ts = Number(timestamp)
	if (!Number.isFinite(ts) || ts <= 0) {
		return ''
	}
	return new Date(ts + TZ_OFFSET).toISOString().slice(0, 10)
}

function dayStartTs(dateKey) {
	const ts = Date.parse(`${dateKey}T00:00:00+08:00`)
	return Number.isFinite(ts) ? ts : 0
}

function dayEndTs(dateKey) {
	return dayStartTs(dateKey) + DAY_MS
}

function addDays(dateKey, delta = 0) {
	return toDateKey(dayStartTs(dateKey) + Number(delta || 0) * DAY_MS)
}

function normalizeCount(value) {
	const next = Number(value)
	if (!Number.isFinite(next)) {
		return 0
	}
	return Math.max(0, Math.floor(next))
}

async function countWhere(collection, where) {
	const query = where ? collection.where(where) : collection
	const result = await query.count()
	return normalizeCount(result && result.total)
}

async function distinctCount(collection, match = {}, field) {
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

	return {
		total: fallback,
		source: fallback > 0 ? 'last_login_date' : 'empty'
	}
}

async function buildSnapshot(dateKey) {
	const start = dayStartTs(dateKey)
	const end = dayEndTs(dateKey)

	const [newUsers, visitsUv, visitsPv, logins, newBindings, totalUsers, boundTotal] = await Promise.all([
		countWhere(userCollection, {
			register_date: dbCmd.gte(start).and(dbCmd.lt(end))
		}),
		distinctCount(visitCollection, { date_key: dateKey }, 'visitor_key'),
		countWhere(visitCollection, { date_key: dateKey }),
		countLoginsInDay(dateKey),
		countWhere(coupleCollection, {
			status: COUPLE_STATUS_BOUND,
			bind_date: dbCmd.gte(start).and(dbCmd.lt(end))
		}),
		countWhere(userCollection, {
			register_date: dbCmd.lt(end)
		}),
		countWhere(coupleCollection, {
			status: COUPLE_STATUS_BOUND,
			bind_date: dbCmd.lt(end)
		})
	])

	return {
		date_key: dateKey,
		new_users: newUsers,
		visits_uv: visitsUv,
		visits_pv: visitsPv,
		logins_uv: logins.total,
		login_source: logins.source,
		new_bindings: newBindings,
		total_users: totalUsers,
		bound_total: boundTotal
	}
}

async function saveSnapshot(snapshot) {
	const now = Date.now()
	const existed = await dailyStatCollection
		.where({ date_key: snapshot.date_key })
		.limit(1)
		.get()

	const current = existed && Array.isArray(existed.data) ? existed.data[0] : null

	if (current && current._id) {
		await dailyStatCollection.doc(current._id).update(Object.assign({}, snapshot, {
			update_time: now
		}))
		return 'updated'
	}

	await dailyStatCollection.add(Object.assign({}, snapshot, {
		create_time: now,
		update_time: now
	}))
	return 'created'
}

/** 访问流水只留 30 天：快照已经固化，原始流水不需要长期保存 */
async function cleanExpiredVisits() {
	const deadline = addDays(toDateKey(Date.now()), -VISIT_RETENTION_DAYS)
	const result = await visitCollection
		.where({ date_key: dbCmd.lt(deadline) })
		.remove()
	const removed = Number((result && result.deleted) || 0)
	return { deadline, removed }
}

exports.main = async (event = {}) => {
	const today = toDateKey(Date.now())
	const targets = []

	if (event && event.date && /^\d{4}-\d{2}-\d{2}$/.test(String(event.date))) {
		targets.push(String(event.date))
	} else {
		const days = Math.min(
			MAX_BACKFILL_DAYS,
			Math.max(1, Number(event && event.days) || 1)
		)
		for (let index = days; index >= 1; index -= 1) {
			targets.push(addDays(today, -index))
		}
	}

	const result = {
		ok: true,
		today,
		targets,
		snapshots: []
	}

	for (const dateKey of targets) {
		try {
			const snapshot = await buildSnapshot(dateKey)
			const action = await saveSnapshot(snapshot)
			result.snapshots.push({
				date: dateKey,
				action,
				newUsers: snapshot.new_users,
				visitsUv: snapshot.visits_uv,
				logins: snapshot.logins_uv,
				bindings: snapshot.new_bindings
			})
		} catch (error) {
			console.error('platform-daily-stats buildSnapshot failed', dateKey, error)
			result.snapshots.push({
				date: dateKey,
				error: error && (error.message || error.errMsg || String(error))
			})
		}
	}

	try {
		result.cleanup = await cleanExpiredVisits()
	} catch (error) {
		console.error('platform-daily-stats cleanExpiredVisits failed', error)
		result.cleanupError = error && (error.message || String(error))
	}

	console.log('platform-daily-stats done', JSON.stringify(result))
	return result
}
