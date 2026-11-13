'use strict'

/**
 * 运营统计用的日期工具。
 *
 * 云函数运行环境的时区不保证是东八区，所以这里不用 new Date(ts).getDate()，
 * 统一「时间戳 + 8 小时」再取 ISO 日期，保证 date_key 永远是自然日（东八区）。
 */

const TZ_OFFSET = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function pad2(value = 0) {
	return String(value).padStart(2, '0')
}

/** 时间戳 → 'YYYY-MM-DD'（东八区自然日） */
function toDateKey(timestamp) {
	const ts = Number(timestamp)
	if (!Number.isFinite(ts) || ts <= 0) {
		return ''
	}
	return new Date(ts + TZ_OFFSET).toISOString().slice(0, 10)
}

/** 今天（东八区） */
function todayKey(now = Date.now()) {
	return toDateKey(now)
}

/** 'YYYY-MM-DD' → 当天 00:00:00.000 的时间戳（东八区） */
function dayStartTs(dateKey) {
	const ts = Date.parse(`${dateKey}T00:00:00+08:00`)
	return Number.isFinite(ts) ? ts : 0
}

/** 'YYYY-MM-DD' → 次日 00:00:00.000 的时间戳（东八区），配合 gte/lt 做左闭右开 */
function dayEndTs(dateKey) {
	return dayStartTs(dateKey) + DAY_MS
}

function addDays(dateKey, delta = 0) {
	return toDateKey(dayStartTs(dateKey) + Number(delta || 0) * DAY_MS)
}

/** 两个日期相差的天数（endKey - startKey） */
function diffDays(startKey, endKey) {
	return Math.round((dayStartTs(endKey) - dayStartTs(startKey)) / DAY_MS)
}

/** 闭区间展开成日期数组 */
function buildDateKeys(startKey, endKey) {
	const total = diffDays(startKey, endKey)
	if (total < 0) {
		return []
	}
	const list = []
	for (let index = 0; index <= total; index += 1) {
		list.push(addDays(startKey, index))
	}
	return list
}

/** '2026-11-07' + '2026-11-13' → '11/07 - 11/13' */
function formatRangeLabel(startKey, endKey) {
	const short = (key) => `${Number(key.slice(5, 7))}/${pad2(Number(key.slice(8, 10)))}`
	if (!startKey || !endKey) {
		return ''
	}
	return startKey === endKey ? short(startKey) : `${short(startKey)} - ${short(endKey)}`
}

module.exports = {
	DAY_MS,
	toDateKey,
	todayKey,
	dayStartTs,
	dayEndTs,
	addDays,
	diffDays,
	buildDateKeys,
	formatRangeLabel
}
