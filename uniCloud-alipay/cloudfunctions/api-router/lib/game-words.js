'use strict'

const { gameWordCollection, dbCmd, db } = require('./db')
const { ERROR_CODES } = require('./game-constants')

/**
 * 卧底词库：预置词与用户自定义词存同一张表，用 is_preset 区分。
 * 本模块只负责「查库 + 随机取样 + 自定义词增删改」，**不硬编码任何词表**。
 */

const PRESET_CATEGORY_ORDER = ['动物', '美食', '影视', '明星', '地点', '运动', '日用品', '职业']
const CUSTOM_CATEGORY = '自定义'
const MAX_WORD_LENGTH = 12
const MAX_CATEGORY_LENGTH = 8
const MAX_QUERY_LIMIT = 500
const PICK_POOL_LIMIT = 200

function normalizeWordText(value = '') {
	return String(value || '').trim().slice(0, MAX_WORD_LENGTH)
}

function normalizeCategoryText(value = '') {
	const text = String(value || '').trim().slice(0, MAX_CATEGORY_LENGTH)
	return text || CUSTOM_CATEGORY
}

function buildWordRegExp(keyword = '') {
	const text = String(keyword || '').trim()
	if (!text) {
		return null
	}
	// 转义正则元字符，避免用户输入把查询打崩
	const safe = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	return new db.RegExp({
		regexp: safe,
		options: 'i'
	})
}

/** 把多字段对象拆成单键条件数组，便于安全地组合 dbCmd.and */
function buildWhereCondition(condition = {}, extraConditions = []) {
	const conditions = Object.keys(condition)
		.map((key) => ({ [key]: condition[key] }))
	extraConditions.forEach((item) => {
		if (item) {
			conditions.push(item)
		}
	})

	if (!conditions.length) {
		return {}
	}
	return conditions.length === 1 ? conditions[0] : dbCmd.and(conditions)
}

function normalizeWordRecord(doc = {}) {
	return {
		wordId: doc._id || '',
		ownerUid: doc.owner_uid || '',
		isPreset: Boolean(doc.is_preset),
		category: doc.category || CUSTOM_CATEGORY,
		civilianWord: doc.civilian_word || '',
		undercoverWord: doc.undercover_word || '',
		useCount: Number(doc.use_count || 0),
		sortOrder: Number(doc.sort_order || 0),
		createTime: Number(doc.create_time || 0)
	}
}

function sortWordList(list = []) {
	return list.slice().sort((left, right) => {
		const leftOrder = Number(left.sort_order || 0)
		const rightOrder = Number(right.sort_order || 0)
		if (leftOrder !== rightOrder) {
			return leftOrder - rightOrder
		}
		return Number(left.create_time || 0) - Number(right.create_time || 0)
	})
}

async function fetchWords(condition = {}, { limit = MAX_QUERY_LIMIT } = {}) {
	const res = await gameWordCollection
		.where(condition)
		.limit(limit)
		.get()
	return res && Array.isArray(res.data) ? res.data : []
}

function buildSourceCondition({ source = 'preset', uid = '' } = {}) {
	if (source === 'mine') {
		return {
			owner_uid: String(uid || ''),
			is_deleted: false
		}
	}
	return {
		is_preset: true,
		is_deleted: false
	}
}

/** 分类列表 + 各类数量（预置与自建分开统计） */
async function listCategories(uid = '') {
	const [presetDocs, mineDocs] = await Promise.all([
		fetchWords({ is_preset: true, is_deleted: false }, { limit: MAX_QUERY_LIMIT }),
		uid
			? fetchWords({ owner_uid: uid, is_deleted: false }, { limit: MAX_QUERY_LIMIT })
			: Promise.resolve([])
	])

	const presetCountMap = {}
	presetDocs.forEach((doc) => {
		const category = doc.category || ''
		presetCountMap[category] = (presetCountMap[category] || 0) + 1
	})

	const mineCountMap = {}
	mineDocs.forEach((doc) => {
		const category = doc.category || CUSTOM_CATEGORY
		mineCountMap[category] = (mineCountMap[category] || 0) + 1
	})

	const orderedCategories = PRESET_CATEGORY_ORDER
		.filter((category) => presetCountMap[category])

	Object.keys(presetCountMap).forEach((category) => {
		if (!orderedCategories.includes(category)) {
			orderedCategories.push(category)
		}
	})
	Object.keys(mineCountMap).forEach((category) => {
		if (!orderedCategories.includes(category)) {
			orderedCategories.push(category)
		}
	})

	const categories = orderedCategories.map((category) => ({
		category,
		count: presetCountMap[category] || 0,
		mineCount: mineCountMap[category] || 0
	}))

	return {
		categories,
		presetTotal: presetDocs.length,
		mineTotal: mineDocs.length
	}
}

/** 分页列表（预置 / 我的） */
async function listWords({
	source = 'preset',
	uid = '',
	category = '',
	keyword = '',
	page = 1,
	pageSize = 20
} = {}) {
	const currentPage = Math.max(1, parseInt(page, 10) || 1)
	const size = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 20))
	const condition = buildSourceCondition({ source, uid })

	const categoryText = String(category || '').trim()
	if (categoryText && categoryText !== '全部') {
		condition.category = categoryText
	}

	const regExp = buildWordRegExp(keyword)
	const keywordCondition = regExp
		? dbCmd.or([
			{ civilian_word: regExp },
			{ undercover_word: regExp }
		])
		: null

	const where = buildWhereCondition(condition, [keywordCondition])

	// 多取 1 条用于判断 hasMore，避免额外一次 count 查询
	const res = await gameWordCollection
		.where(where)
		.skip((currentPage - 1) * size)
		.limit(size + 1)
		.get()

	const rawList = res && Array.isArray(res.data) ? res.data : []
	const hasMore = rawList.length > size
	const pageList = sortWordList(hasMore ? rawList.slice(0, size) : rawList)

	return {
		list: pageList.map(normalizeWordRecord),
		pagination: {
			page: currentPage,
			pageSize: size,
			hasMore
		}
	}
}

/** 供随机取样使用的候选池（单分类 ~15 条、全表 120 条量级，直接读全量后在内存随机） */
async function pickWordPair({
	source = 'preset',
	uid = '',
	category = '',
	excludeIds = []
} = {}) {
	const excludeSet = new Set(
		(Array.isArray(excludeIds) ? excludeIds : []).map((item) => String(item || '')).filter(Boolean)
	)

	const buildCondition = (targetSource) => {
		const condition = buildSourceCondition({ source: targetSource, uid })
		const categoryText = String(category || '').trim()
		if (categoryText && categoryText !== '全部') {
			condition.category = categoryText
		}
		return condition
	}

	let fallbackToPreset = false
	let pool = await fetchWords(buildCondition(source), { limit: PICK_POOL_LIMIT })

	if (!pool.length && source === 'mine') {
		fallbackToPreset = true
		pool = await fetchWords(buildCondition('preset'), { limit: PICK_POOL_LIMIT })
	}

	if (!pool.length) {
		return null
	}

	const filtered = pool.filter((doc) => !excludeSet.has(String(doc._id || '')))
	const candidates = filtered.length ? filtered : pool
	const picked = candidates[Math.floor(Math.random() * candidates.length)]

	// 使用次数打点，失败不影响主流程
	bumpUseCount(picked._id)

	return {
		wordPairId: picked._id || '',
		category: picked.category || CUSTOM_CATEGORY,
		civilianWord: picked.civilian_word || '',
		undercoverWord: picked.undercover_word || '',
		fallbackToPreset
	}
}

function bumpUseCount(wordId = '') {
	if (!wordId) {
		return
	}
	gameWordCollection.doc(wordId).update({
		use_count: dbCmd.inc(1)
	}).catch((error) => {
		console.warn('api-router bumpUseCount failed', error)
	})
}

async function getWordById(wordId = '') {
	const id = String(wordId || '').trim()
	if (!id) {
		return null
	}
	const res = await gameWordCollection
		.where({
			_id: id,
			is_deleted: false
		})
		.limit(1)
		.get()
	return res && res.data && res.data[0] ? res.data[0] : null
}

async function findDuplicateWord({
	uid = '',
	civilianWord = '',
	undercoverWord = '',
	excludeId = ''
} = {}) {
	const res = await gameWordCollection
		.where({
			owner_uid: uid,
			is_deleted: false,
			civilian_word: civilianWord,
			undercover_word: undercoverWord
		})
		.limit(5)
		.get()
	const list = res && Array.isArray(res.data) ? res.data : []
	return list.find((doc) => String(doc._id) !== String(excludeId || '')) || null
}

/** 新增 / 编辑自定义词条（预置词不可编辑） */
async function saveWord({
	uid = '',
	wordId = '',
	civilianWord = '',
	undercoverWord = '',
	category = ''
} = {}) {
	const civilian = normalizeWordText(civilianWord)
	const undercover = normalizeWordText(undercoverWord)

	if (!civilian || !undercover) {
		throw {
			errCode: ERROR_CODES.paramInvalid,
			errMsg: '平民词和卧底词都不能为空'
		}
	}
	if (civilian === undercover) {
		throw {
			errCode: ERROR_CODES.paramInvalid,
			errMsg: '平民词和卧底词不能相同'
		}
	}

	const now = Date.now()
	const categoryText = normalizeCategoryText(category)
	const targetId = String(wordId || '').trim()

	if (targetId) {
		const exist = await getWordById(targetId)
		if (!exist) {
			throw {
				errCode: ERROR_CODES.wordNotFound,
				errMsg: '词条不存在或已删除'
			}
		}
		if (exist.is_preset || String(exist.owner_uid || '') !== String(uid || '')) {
			throw {
				errCode: ERROR_CODES.presetNotEditable,
				errMsg: '系统预置词条不可修改'
			}
		}

		const duplicate = await findDuplicateWord({
			uid,
			civilianWord: civilian,
			undercoverWord: undercover,
			excludeId: targetId
		})
		if (duplicate) {
			throw {
				errCode: ERROR_CODES.wordDuplicated,
				errMsg: '你已经有一条相同的词条了'
			}
		}

		await gameWordCollection.doc(targetId).update({
			civilian_word: civilian,
			undercover_word: undercover,
			category: categoryText,
			update_time: now
		})

		return { wordId: targetId, created: false }
	}

	const duplicate = await findDuplicateWord({
		uid,
		civilianWord: civilian,
		undercoverWord: undercover
	})
	if (duplicate) {
		throw {
			errCode: ERROR_CODES.wordDuplicated,
			errMsg: '你已经有一条相同的词条了'
		}
	}

	const result = await gameWordCollection.add({
		owner_uid: String(uid || ''),
		is_preset: false,
		category: categoryText,
		civilian_word: civilian,
		undercover_word: undercover,
		use_count: 0,
		sort_order: 0,
		is_deleted: false,
		create_time: now,
		update_time: now
	})

	return { wordId: result.id, created: true }
}

/** 软删除自定义词条（预置词不可删） */
async function deleteWord({ uid = '', wordId = '' } = {}) {
	const targetId = String(wordId || '').trim()
	if (!targetId) {
		throw {
			errCode: ERROR_CODES.paramInvalid,
			errMsg: '词条ID不能为空'
		}
	}

	const exist = await getWordById(targetId)
	if (!exist) {
		throw {
			errCode: ERROR_CODES.wordNotFound,
			errMsg: '词条不存在或已删除'
		}
	}
	if (exist.is_preset || String(exist.owner_uid || '') !== String(uid || '')) {
		throw {
			errCode: ERROR_CODES.presetNotEditable,
			errMsg: '系统预置词条不可删除'
		}
	}

	await gameWordCollection.doc(targetId).update({
		is_deleted: true,
		update_time: Date.now()
	})

	return { wordId: targetId }
}

module.exports = {
	PRESET_CATEGORY_ORDER,
	CUSTOM_CATEGORY,
	MAX_WORD_LENGTH,
	normalizeWordText,
	normalizeCategoryText,
	normalizeWordRecord,
	listCategories,
	listWords,
	pickWordPair,
	getWordById,
	saveWord,
	deleteWord
}
