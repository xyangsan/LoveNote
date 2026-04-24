'use strict'

const {
	buildNextDateFields,
	getChinaTodayDateValue
} = require('../common/anniversary-next-date')

const db = uniCloud.database()
const dbCmd = db.command
const anniversaryCollection = db.collection('love-anniversaries')

const DEFAULT_BATCH_SIZE = 100
const DEFAULT_CONCURRENCY = 10
const DEFAULT_MAX_BATCHES = 500
const MAX_ERROR_SAMPLES = 20

function clampNumber(value, fallback, min, max) {
	const raw = Number(value)
	if (!Number.isFinite(raw)) {
		return fallback
	}
	return Math.max(min, Math.min(max, Math.floor(raw)))
}

function isSameNextDateFields(record = {}, fields = {}) {
	return Number(record.next_date_timestamp || 0) === Number(fields.next_date_timestamp || 0) &&
		String(record.next_date_value || '') === String(fields.next_date_value || '') &&
		String(record.next_date_refresh_date || '') === String(fields.next_date_refresh_date || '')
}

async function runWithConcurrency(items = [], concurrency = DEFAULT_CONCURRENCY, handler) {
	let cursor = 0
	const workerCount = Math.min(concurrency, items.length)
	const workers = Array.from({ length: workerCount }, async () => {
		while (cursor < items.length) {
			const item = items[cursor]
			cursor += 1
			await handler(item)
		}
	})
	await Promise.all(workers)
}

exports.main = async (event = {}) => {
	const batchSize = clampNumber(event.batchSize, DEFAULT_BATCH_SIZE, 20, 500)
	const concurrency = clampNumber(event.concurrency, DEFAULT_CONCURRENCY, 1, 30)
	const maxBatches = clampNumber(event.maxBatches, DEFAULT_MAX_BATCHES, 1, 2000)
	const todayDateValue = String(event.todayDateValue || getChinaTodayDateValue()).trim()
	const force = Boolean(event.force)
	const startedAt = Date.now()

	let lastId = ''
	let batchCount = 0
	let scanned = 0
	let updated = 0
	let unchanged = 0
	const errors = []

	while (batchCount < maxBatches) {
		const whereCondition = {
			is_deleted: false
		}
		if (!force) {
			whereCondition.next_date_refresh_date = dbCmd.neq(todayDateValue)
		}
		if (lastId) {
			whereCondition._id = dbCmd.gt(lastId)
		}

		const res = await anniversaryCollection
			.where(whereCondition)
			.field({
				_id: true,
				date_type: true,
				date_value: true,
				solar_date_value: true,
				lunar_date_value: true,
				date_timestamp: true,
				repeat_type: true,
				next_date_timestamp: true,
				next_date_value: true,
				next_date_refresh_date: true
			})
			.orderBy('_id', 'asc')
			.limit(batchSize)
			.get()

		const list = Array.isArray(res.data) ? res.data : []
		if (!list.length) {
			break
		}

		batchCount += 1
		scanned += list.length
		lastId = String(list[list.length - 1]._id || '')

		await runWithConcurrency(list, concurrency, async (record) => {
			try {
				const nextDateFields = buildNextDateFields(record, {
					todayDateValue
				})
				if (isSameNextDateFields(record, nextDateFields)) {
					unchanged += 1
					return
				}
				await anniversaryCollection.doc(record._id).update(nextDateFields)
				updated += 1
			} catch (error) {
				if (errors.length < MAX_ERROR_SAMPLES) {
					errors.push({
						id: String(record && record._id || ''),
						message: error && error.message ? error.message : String(error)
					})
				}
				console.warn('refresh anniversary next date failed', record && record._id, error)
			}
		})

		if (list.length < batchSize) {
			break
		}
	}

	return {
		errCode: errors.length ? 'love-note-refresh-partial' : 0,
		errMsg: errors.length ? '部分纪念日下一次日期刷新失败' : 'ok',
		data: {
			todayDateValue,
			force,
			batchSize,
			concurrency,
			maxBatches,
			batchCount,
			scanned,
			updated,
			unchanged,
			hasMore: batchCount >= maxBatches,
			cost: Date.now() - startedAt,
			errors
		}
	}
}
