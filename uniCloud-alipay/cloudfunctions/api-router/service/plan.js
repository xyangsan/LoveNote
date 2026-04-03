'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { getActiveCoupleByUid } = require('../lib/couple')
const { getUserById } = require('../lib/user-base')
const { wishPlanCollection } = require('../lib/db')
const { DEFAULT_NICKNAME } = require('../lib/constants')
const { formatError } = require('../lib/response')

const ITEM_TYPE_WISH = 'wish'
const ITEM_TYPE_PLAN = 'plan'
const ITEM_TYPES = new Set([ITEM_TYPE_WISH, ITEM_TYPE_PLAN])

const ITEM_STATUS_PENDING = 'pending'
const ITEM_STATUS_IN_PROGRESS = 'in_progress'
const ITEM_STATUS_COMPLETED = 'completed'
const ITEM_STATUS_SKIPPED = 'skipped'
const ITEM_STATUSES = new Set([
	ITEM_STATUS_PENDING,
	ITEM_STATUS_IN_PROGRESS,
	ITEM_STATUS_COMPLETED,
	ITEM_STATUS_SKIPPED
])

const STEP_STATUS_PENDING = 'pending'
const STEP_STATUS_COMPLETED = 'completed'
const STEP_STATUS_SKIPPED = 'skipped'

const STEP_ACTION_COMPLETE = 'complete'
const STEP_ACTION_SKIP = 'skip'
const STEP_ACTION_DIRECT_COMPLETE = 'direct_complete'

const MAX_TITLE_LENGTH = 80
const MAX_CATEGORY_LENGTH = 40
const MAX_DESCRIPTION_LENGTH = 500
const MAX_STEP_TITLE_LENGTH = 80
const MAX_STEP_DESCRIPTION_LENGTH = 300
const MAX_STEP_COUNT = 40
const MAX_COMMENT_LENGTH = 300
const MAX_LIST_PAGE_SIZE = 60

const STATUS_TEXT_MAP = {
	[ITEM_STATUS_PENDING]: '待开始',
	[ITEM_STATUS_IN_PROGRESS]: '进行中',
	[ITEM_STATUS_COMPLETED]: '已完成',
	[ITEM_STATUS_SKIPPED]: '已跳过'
}

const TYPE_TEXT_MAP = {
	[ITEM_TYPE_WISH]: '愿望',
	[ITEM_TYPE_PLAN]: '计划'
}

const ACTION_TEXT_MAP = {
	[STEP_ACTION_COMPLETE]: '完成步骤',
	[STEP_ACTION_SKIP]: '跳过步骤',
	[STEP_ACTION_DIRECT_COMPLETE]: '直接完成'
}

const RECOMMEND_LIBRARY = [
	{
		key: 'wish_sunrise',
		type: ITEM_TYPE_WISH,
		category: '旅行',
		title: '一起看一次日出',
		description: '找一个周末，出发看日出并拍一张合照。'
	},
	{
		key: 'wish_album',
		type: ITEM_TYPE_WISH,
		category: '回忆',
		title: '一起做一本纸质相册',
		description: '把最喜欢的照片做成一本相册，记录每个故事。'
	},
	{
		key: 'wish_food',
		type: ITEM_TYPE_WISH,
		category: '美食',
		title: '打卡一家想吃已久的餐厅',
		description: '提前预约，记录口味评分，下次继续探索。'
	},
	{
		key: 'plan_trip',
		type: ITEM_TYPE_PLAN,
		category: '旅行',
		title: '周末短途旅行计划',
		description: '两天一夜轻旅行，放松一下。',
		steps: ['确定目的地', '预订交通和住宿', '准备行李清单', '出发并记录行程']
	},
	{
		key: 'plan_birthday',
		type: ITEM_TYPE_PLAN,
		category: '纪念',
		title: '生日惊喜筹备',
		description: '提前准备生日礼物和当天安排。',
		steps: ['确定预算与礼物方向', '购买礼物并包装', '预订晚餐地点', '准备祝福与小惊喜']
	},
	{
		key: 'plan_fitness',
		type: ITEM_TYPE_PLAN,
		category: '成长',
		title: '双人运动打卡计划',
		description: '一周三次，一起变健康。',
		steps: ['设定每周目标', '安排固定训练时间', '每周复盘完成情况']
	}
]

function normalizeText(value = '', maxLength = 100) {
	const text = String(value || '').trim()
	return text.length > maxLength ? text.slice(0, maxLength) : text
}

function normalizeItemType(value = ITEM_TYPE_WISH) {
	const nextValue = String(value || '').trim().toLowerCase()
	return ITEM_TYPES.has(nextValue) ? nextValue : ITEM_TYPE_WISH
}

function normalizeStatus(value = ITEM_STATUS_PENDING) {
	const nextValue = String(value || '').trim().toLowerCase()
	return ITEM_STATUSES.has(nextValue) ? nextValue : ITEM_STATUS_PENDING
}

function normalizeTypeFilter(value = '') {
	const nextValue = String(value || '').trim().toLowerCase()
	return ITEM_TYPES.has(nextValue) ? nextValue : ''
}

function normalizeStatusFilter(value = '') {
	const nextValue = String(value || '').trim().toLowerCase()
	return ITEM_STATUSES.has(nextValue) ? nextValue : ''
}

function createId(prefix = 'id') {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getRecommendationByKey(recommendationKey = '') {
	const key = String(recommendationKey || '').trim()
	if (!key) {
		return null
	}
	return RECOMMEND_LIBRARY.find((item) => item.key === key) || null
}

function normalizeStepInputs(rawSteps = []) {
	if (!Array.isArray(rawSteps)) {
		return []
	}

	return rawSteps
		.map((item) => {
			if (typeof item === 'string') {
				return {
					title: normalizeText(item, MAX_STEP_TITLE_LENGTH),
					description: ''
				}
			}

			if (!item || typeof item !== 'object') {
				return null
			}

			const title = normalizeText(item.title, MAX_STEP_TITLE_LENGTH)
			const description = normalizeText(item.description, MAX_STEP_DESCRIPTION_LENGTH)
			if (!title) {
				return null
			}

			return {
				title,
				description
			}
		})
		.filter(Boolean)
		.slice(0, MAX_STEP_COUNT)
}

function createStepRecords(stepInputs = [], now = Date.now()) {
	return stepInputs.map((item, index) => ({
		step_id: createId('step'),
		title: item.title,
		description: item.description || '',
		sort_order: index + 1,
		status: STEP_STATUS_PENDING,
		action_mode: '',
		action_note: '',
		action_uid: '',
		action_time: 0,
		create_time: now,
		update_time: now,
		comments: []
	}))
}

function buildStepSummary(stepList = []) {
	const steps = Array.isArray(stepList) ? stepList : []
	if (!steps.length) {
		return {
			start_title: '',
			current_title: '',
			pending_count: 0
		}
	}

	const pendingStep = steps.find((item) => item && item.status === STEP_STATUS_PENDING)
	const lastHandledStep = [...steps].reverse().find((item) => item && item.status !== STEP_STATUS_PENDING)

	return {
		start_title: steps[0] && steps[0].title ? steps[0].title : '',
		current_title: pendingStep
			? pendingStep.title
			: (lastHandledStep && lastHandledStep.title ? lastHandledStep.title : ''),
		pending_count: steps.filter((item) => item && item.status === STEP_STATUS_PENDING).length
	}
}

function derivePlanState({
	type = ITEM_TYPE_WISH,
	status = ITEM_STATUS_PENDING,
	steps = []
} = {}) {
	const normalizedType = normalizeItemType(type)
	const normalizedStatus = normalizeStatus(status)
	const stepList = Array.isArray(steps) ? steps : []

	if (normalizedType === ITEM_TYPE_WISH) {
		const completed = normalizedStatus === ITEM_STATUS_COMPLETED ? 1 : 0
		const skipped = normalizedStatus === ITEM_STATUS_SKIPPED ? 1 : 0
		const progress = completed || skipped ? 100 : 0
		return {
			status: normalizedStatus,
			progress,
			total_steps: 1,
			completed_steps: completed,
			skipped_steps: skipped,
			step_summary: {
				start_title: '完成愿望',
				current_title: normalizedStatus === ITEM_STATUS_PENDING ? '等待完成' : '愿望已处理',
				pending_count: normalizedStatus === ITEM_STATUS_PENDING ? 1 : 0
			}
		}
	}

	const totalSteps = stepList.length
	const completedSteps = stepList.filter((item) => item && item.status === STEP_STATUS_COMPLETED).length
	const skippedSteps = stepList.filter((item) => item && item.status === STEP_STATUS_SKIPPED).length
	const processedSteps = completedSteps + skippedSteps

	let nextStatus = normalizedStatus
	if (![ITEM_STATUS_COMPLETED, ITEM_STATUS_SKIPPED].includes(nextStatus)) {
		if (totalSteps > 0 && processedSteps >= totalSteps) {
			nextStatus = ITEM_STATUS_COMPLETED
		} else if (processedSteps > 0) {
			nextStatus = ITEM_STATUS_IN_PROGRESS
		} else {
			nextStatus = ITEM_STATUS_PENDING
		}
	}

	const progress = totalSteps > 0
		? Math.min(100, Math.max(0, Math.floor((processedSteps / totalSteps) * 100)))
		: (nextStatus === ITEM_STATUS_COMPLETED || nextStatus === ITEM_STATUS_SKIPPED ? 100 : 0)

	return {
		status: nextStatus,
		progress,
		total_steps: totalSteps,
		completed_steps: completedSteps,
		skipped_steps: skippedSteps,
		step_summary: buildStepSummary(stepList)
	}
}

async function buildUserSnapshot(uid = '') {
	const userRecord = uid ? await getUserById(uid) : null
	return {
		uid: String(uid || ''),
		nickname: userRecord && (userRecord.nickname || userRecord.username)
			? (userRecord.nickname || userRecord.username)
			: DEFAULT_NICKNAME
	}
}

function normalizeCommentRecord(comment = {}) {
	return {
		comment_id: String(comment.comment_id || ''),
		uid: String(comment.uid || ''),
		nickname: String(comment.nickname || '').trim() || DEFAULT_NICKNAME,
		content: String(comment.content || '').trim(),
		create_time: Number(comment.create_time || 0)
	}
}

function normalizeStepRecord(step = {}) {
	const comments = Array.isArray(step.comments) ? step.comments.map(normalizeCommentRecord) : []
	return {
		step_id: String(step.step_id || ''),
		title: String(step.title || '').trim(),
		description: String(step.description || '').trim(),
		sort_order: Number(step.sort_order || 0),
		status: String(step.status || STEP_STATUS_PENDING),
		action_mode: String(step.action_mode || ''),
		action_mode_text: ACTION_TEXT_MAP[String(step.action_mode || '')] || '',
		action_note: String(step.action_note || '').trim(),
		action_uid: String(step.action_uid || ''),
		action_time: Number(step.action_time || 0),
		create_time: Number(step.create_time || 0),
		update_time: Number(step.update_time || 0),
		comments
	}
}

function normalizeWishPlanRecord(record = {}) {
	const steps = Array.isArray(record.steps) ? record.steps.map(normalizeStepRecord) : []
	const derivedState = derivePlanState({
		type: record.type,
		status: record.status,
		steps
	})

	return {
		_id: String(record._id || ''),
		type: normalizeItemType(record.type),
		type_text: TYPE_TEXT_MAP[normalizeItemType(record.type)] || TYPE_TEXT_MAP[ITEM_TYPE_WISH],
		category: String(record.category || '').trim(),
		title: String(record.title || '').trim(),
		description: String(record.description || '').trim(),
		owner_uid: String(record.owner_uid || ''),
		owner_snapshot: record.owner_snapshot && typeof record.owner_snapshot === 'object'
			? {
				uid: String(record.owner_snapshot.uid || ''),
				nickname: String(record.owner_snapshot.nickname || '').trim() || DEFAULT_NICKNAME
			}
			: {
				uid: '',
				nickname: DEFAULT_NICKNAME
			},
		status: derivedState.status,
		status_text: STATUS_TEXT_MAP[derivedState.status] || STATUS_TEXT_MAP[ITEM_STATUS_PENDING],
		progress: derivedState.progress,
		total_steps: derivedState.total_steps,
		completed_steps: derivedState.completed_steps,
		skipped_steps: derivedState.skipped_steps,
		step_summary: derivedState.step_summary,
		steps,
		source: String(record.source || 'manual'),
		recommendation_key: String(record.recommendation_key || ''),
		final_action_mode: String(record.final_action_mode || ''),
		final_action_mode_text: ACTION_TEXT_MAP[String(record.final_action_mode || '')] || '',
		final_action_note: String(record.final_action_note || '').trim(),
		final_action_uid: String(record.final_action_uid || ''),
		final_action_time: Number(record.final_action_time || 0),
		create_uid: String(record.create_uid || ''),
		create_time: Number(record.create_time || 0),
		update_time: Number(record.update_time || 0),
		completed_time: Number(record.completed_time || 0)
	}
}

function ensureCoupleMember(ownerUid = '', coupleRecord = {}, currentUid = '') {
	const validUids = new Set([
		String(coupleRecord.user_a_uid || '').trim(),
		String(coupleRecord.user_b_uid || '').trim()
	].filter(Boolean))

	if (!validUids.size) {
		return String(currentUid || '')
	}

	const normalizedOwnerUid = String(ownerUid || '').trim()
	if (normalizedOwnerUid && validUids.has(normalizedOwnerUid)) {
		return normalizedOwnerUid
	}

	return validUids.has(String(currentUid || '').trim())
		? String(currentUid || '').trim()
		: Array.from(validUids)[0]
}

async function getWishPlanById(itemId = '', coupleId = '') {
	if (!itemId || !coupleId) {
		return null
	}

	const res = await wishPlanCollection
		.where({
			_id: itemId,
			couple_id: coupleId,
			is_deleted: false
		})
		.limit(1)
		.get()

	return res && Array.isArray(res.data) && res.data[0] ? res.data[0] : null
}

async function buildStats(coupleId = '') {
	if (!coupleId) {
		return {
			total: 0,
			wish_total: 0,
			plan_total: 0,
			completed_total: 0
		}
	}

	const baseCondition = {
		couple_id: coupleId,
		is_deleted: false
	}

	const [totalRes, wishRes, planRes, completedRes] = await Promise.all([
		wishPlanCollection.where(baseCondition).count(),
		wishPlanCollection.where(Object.assign({}, baseCondition, { type: ITEM_TYPE_WISH })).count(),
		wishPlanCollection.where(Object.assign({}, baseCondition, { type: ITEM_TYPE_PLAN })).count(),
		wishPlanCollection.where(Object.assign({}, baseCondition, { status: ITEM_STATUS_COMPLETED })).count()
	])

	return {
		total: Number(totalRes.total || 0),
		wish_total: Number(wishRes.total || 0),
		plan_total: Number(planRes.total || 0),
		completed_total: Number(completedRes.total || 0)
	}
}

async function buildRecommendations(coupleId = '', typeFilter = '') {
	if (!coupleId) {
		return []
	}

	const allRes = await wishPlanCollection.where({
		couple_id: coupleId,
		is_deleted: false
	}).limit(500).get()

	const existingList = Array.isArray(allRes.data) ? allRes.data : []
	const existingRecommendKeys = new Set(
		existingList
			.map((item) => String(item.recommendation_key || '').trim())
			.filter(Boolean)
	)
	const existingTitleKeys = new Set(
		existingList
			.map((item) => `${normalizeItemType(item.type)}::${normalizeText(item.title, MAX_TITLE_LENGTH)}`)
	)

	return RECOMMEND_LIBRARY
		.filter((item) => !typeFilter || item.type === typeFilter)
		.filter((item) => !existingRecommendKeys.has(item.key))
		.filter((item) => !existingTitleKeys.has(`${item.type}::${normalizeText(item.title, MAX_TITLE_LENGTH)}`))
		.map((item) => ({
			key: item.key,
			type: item.type,
			type_text: TYPE_TEXT_MAP[item.type] || TYPE_TEXT_MAP[ITEM_TYPE_WISH],
			category: item.category,
			title: item.title,
			description: item.description || '',
			steps: Array.isArray(item.steps) ? item.steps : []
		}))
}

module.exports = class PlanService extends Service {
	async getList(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const page = Math.max(1, parseInt(params.page, 10) || 1)
			const pageSize = Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, parseInt(params.pageSize, 10) || 20))
			const type = normalizeTypeFilter(params.type)
			const status = normalizeStatusFilter(params.status)
			const shouldQueryRecommendations = String(params.recommend || '').trim() === '1'

			const whereCondition = {
				couple_id: activeCouple._id,
				is_deleted: false
			}
			if (type) {
				whereCondition.type = type
			}
			if (status) {
				whereCondition.status = status
			}

			const [totalRes, listRes, stats, recommendations] = await Promise.all([
				wishPlanCollection.where(whereCondition).count(),
				wishPlanCollection.where(whereCondition)
					.orderBy('update_time', 'desc')
					.skip((page - 1) * pageSize)
					.limit(pageSize)
					.get(),
				buildStats(activeCouple._id),
				shouldQueryRecommendations
					? buildRecommendations(activeCouple._id, type)
					: Promise.resolve([])
			])

			const total = Number(totalRes.total || 0)
			const list = Array.isArray(listRes.data) ? listRes.data.map((item) => normalizeWishPlanRecord(item)) : []

			return {
				errCode: 0,
				data: {
					list,
					stats,
					recommendations,
					pagination: {
						page,
						pageSize,
						total,
						hasMore: page * pageSize < total
					}
				}
			}
		} catch (error) {
			return formatError(error, '获取愿望清单失败')
		}
	}

	async create(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const recommendation = getRecommendationByKey(params.recommendationKey || params.recommendation_key)
			const type = normalizeItemType(params.type || (recommendation && recommendation.type) || ITEM_TYPE_WISH)
			const title = normalizeText(params.title || (recommendation && recommendation.title), MAX_TITLE_LENGTH)
			const category = normalizeText(params.category || (recommendation && recommendation.category), MAX_CATEGORY_LENGTH)
			const description = normalizeText(params.description || (recommendation && recommendation.description), MAX_DESCRIPTION_LENGTH)
			if (!title) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '请填写愿望/计划标题'
				}
			}

			const rawStepInputs = params.steps !== undefined
				? params.steps
				: (recommendation && Array.isArray(recommendation.steps) ? recommendation.steps : [])
			const stepInputs = type === ITEM_TYPE_PLAN ? normalizeStepInputs(rawStepInputs) : []
			if (type === ITEM_TYPE_PLAN && Array.isArray(rawStepInputs) && rawStepInputs.length && !stepInputs.length) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '计划步骤不能为空'
				}
			}

			const ownerUid = ensureCoupleMember(params.ownerUid || params.owner_uid, activeCouple, uid)
			const ownerSnapshot = await buildUserSnapshot(ownerUid)

			const now = Date.now()
			const steps = createStepRecords(stepInputs, now)
			const derivedState = derivePlanState({
				type,
				status: ITEM_STATUS_PENDING,
				steps
			})

			const record = {
				couple_id: activeCouple._id,
				type,
				category,
				title,
				description,
				owner_uid: ownerUid,
				owner_snapshot: ownerSnapshot,
				status: derivedState.status,
				progress: derivedState.progress,
				total_steps: derivedState.total_steps,
				completed_steps: derivedState.completed_steps,
				skipped_steps: derivedState.skipped_steps,
				step_summary: derivedState.step_summary,
				steps,
				source: recommendation ? 'recommendation' : 'manual',
				recommendation_key: recommendation ? recommendation.key : '',
				final_action_mode: '',
				final_action_note: '',
				final_action_uid: '',
				final_action_time: 0,
				create_uid: uid,
				create_time: now,
				update_time: now,
				completed_time: 0,
				is_deleted: false
			}

			const createRes = await wishPlanCollection.add(record)
			const created = Object.assign({}, record, {
				_id: createRes.id
			})

			return {
				errCode: 0,
				data: {
					item: normalizeWishPlanRecord(created)
				}
			}
		} catch (error) {
			return formatError(error, '创建愿望/计划失败')
		}
	}

	async addStep(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const itemId = String(params.itemId || '').trim()
			if (!itemId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少清单ID'
				}
			}

			const title = normalizeText(params.title, MAX_STEP_TITLE_LENGTH)
			const description = normalizeText(params.description, MAX_STEP_DESCRIPTION_LENGTH)
			if (!title) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '请填写步骤标题'
				}
			}

			const record = await getWishPlanById(itemId, activeCouple._id)
			if (!record) {
				return {
					errCode: 'love-note-plan-not-found',
					errMsg: '清单不存在或无权限访问'
				}
			}
			if (normalizeItemType(record.type) !== ITEM_TYPE_PLAN) {
				return {
					errCode: 'love-note-step-not-supported',
					errMsg: '愿望类型不支持添加步骤'
				}
			}

			const steps = Array.isArray(record.steps) ? record.steps : []
			if (steps.length >= MAX_STEP_COUNT) {
				return {
					errCode: 'love-note-step-limit',
					errMsg: `最多支持 ${MAX_STEP_COUNT} 个步骤`
				}
			}

			const now = Date.now()
			steps.push({
				step_id: createId('step'),
				title,
				description,
				sort_order: steps.length + 1,
				status: STEP_STATUS_PENDING,
				action_mode: '',
				action_note: '',
				action_uid: '',
				action_time: 0,
				create_time: now,
				update_time: now,
				comments: []
			})

			const derivedState = derivePlanState({
				type: record.type,
				status: record.status,
				steps
			})

			const updateData = {
				steps,
				status: derivedState.status,
				progress: derivedState.progress,
				total_steps: derivedState.total_steps,
				completed_steps: derivedState.completed_steps,
				skipped_steps: derivedState.skipped_steps,
				step_summary: derivedState.step_summary,
				update_time: now
			}
			if (![ITEM_STATUS_COMPLETED, ITEM_STATUS_SKIPPED].includes(derivedState.status)) {
				updateData.completed_time = 0
				updateData.final_action_mode = ''
				updateData.final_action_note = ''
				updateData.final_action_uid = ''
				updateData.final_action_time = 0
			}

			await wishPlanCollection.doc(itemId).update(updateData)
			return {
				errCode: 0,
				data: {
					item: normalizeWishPlanRecord(Object.assign({}, record, updateData, {
						_id: itemId
					}))
				}
			}
		} catch (error) {
			return formatError(error, '新增步骤失败')
		}
	}

	async actionStep(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const itemId = String(params.itemId || '').trim()
			const stepId = String(params.stepId || '').trim()
			const action = String(params.action || '').trim().toLowerCase()
			if (!itemId || !stepId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少参数'
				}
			}
			if (![STEP_ACTION_COMPLETE, STEP_ACTION_SKIP, STEP_ACTION_DIRECT_COMPLETE].includes(action)) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '步骤操作类型不支持'
				}
			}

			const record = await getWishPlanById(itemId, activeCouple._id)
			if (!record) {
				return {
					errCode: 'love-note-plan-not-found',
					errMsg: '清单不存在或无权限访问'
				}
			}
			if (normalizeItemType(record.type) !== ITEM_TYPE_PLAN) {
				return {
					errCode: 'love-note-step-not-supported',
					errMsg: '愿望类型不支持步骤操作'
				}
			}
			if ([ITEM_STATUS_COMPLETED, ITEM_STATUS_SKIPPED].includes(normalizeStatus(record.status))) {
				return {
					errCode: 'love-note-plan-finished',
					errMsg: '该清单已完成，无法继续操作步骤'
				}
			}

			const steps = Array.isArray(record.steps) ? record.steps : []
			const targetIndex = steps.findIndex((item) => String(item.step_id || '') === stepId)
			if (targetIndex < 0) {
				return {
					errCode: 'love-note-step-not-found',
					errMsg: '步骤不存在'
				}
			}

			const now = Date.now()
			const actionNote = normalizeText(params.note || params.actionNote || '', MAX_DESCRIPTION_LENGTH)
			const nextStatus = action === STEP_ACTION_SKIP ? STEP_STATUS_SKIPPED : STEP_STATUS_COMPLETED
			steps[targetIndex] = Object.assign({}, steps[targetIndex], {
				status: nextStatus,
				action_mode: action,
				action_note: actionNote,
				action_uid: uid,
				action_time: now,
				update_time: now
			})

			const derivedState = derivePlanState({
				type: record.type,
				status: record.status,
				steps
			})

			const updateData = {
				steps,
				status: derivedState.status,
				progress: derivedState.progress,
				total_steps: derivedState.total_steps,
				completed_steps: derivedState.completed_steps,
				skipped_steps: derivedState.skipped_steps,
				step_summary: derivedState.step_summary,
				update_time: now
			}
			if ([ITEM_STATUS_COMPLETED, ITEM_STATUS_SKIPPED].includes(derivedState.status)) {
				updateData.completed_time = now
				updateData.final_action_mode = action
				updateData.final_action_note = actionNote
				updateData.final_action_uid = uid
				updateData.final_action_time = now
			} else {
				updateData.final_action_mode = ''
				updateData.final_action_note = ''
				updateData.final_action_uid = ''
				updateData.final_action_time = 0
			}

			await wishPlanCollection.doc(itemId).update(updateData)
			return {
				errCode: 0,
				data: {
					item: normalizeWishPlanRecord(Object.assign({}, record, updateData, {
						_id: itemId
					}))
				}
			}
		} catch (error) {
			return formatError(error, '步骤操作失败')
		}
	}

	async addStepComment(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const itemId = String(params.itemId || '').trim()
			const stepId = String(params.stepId || '').trim()
			const content = normalizeText(params.content, MAX_COMMENT_LENGTH)
			if (!itemId || !stepId || !content) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '评论内容不能为空'
				}
			}

			const record = await getWishPlanById(itemId, activeCouple._id)
			if (!record) {
				return {
					errCode: 'love-note-plan-not-found',
					errMsg: '清单不存在或无权限访问'
				}
			}

			const steps = Array.isArray(record.steps) ? record.steps : []
			const targetIndex = steps.findIndex((item) => String(item.step_id || '') === stepId)
			if (targetIndex < 0) {
				return {
					errCode: 'love-note-step-not-found',
					errMsg: '步骤不存在'
				}
			}

			const userSnapshot = await buildUserSnapshot(uid)
			const now = Date.now()
			const comments = Array.isArray(steps[targetIndex].comments) ? steps[targetIndex].comments : []
			const commentRecord = {
				comment_id: createId('comment'),
				uid: uid,
				nickname: userSnapshot.nickname,
				content,
				create_time: now
			}
			comments.push(commentRecord)

			steps[targetIndex] = Object.assign({}, steps[targetIndex], {
				comments,
				update_time: now
			})

			await wishPlanCollection.doc(itemId).update({
				steps,
				update_time: now
			})

			return {
				errCode: 0,
				data: {
					comment: normalizeCommentRecord(commentRecord),
					item: normalizeWishPlanRecord(Object.assign({}, record, {
						_id: itemId,
						steps,
						update_time: now
					}))
				}
			}
		} catch (error) {
			return formatError(error, '添加步骤评论失败')
		}
	}

	async finish(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const itemId = String(params.itemId || '').trim()
			const action = String(params.action || STEP_ACTION_DIRECT_COMPLETE).trim().toLowerCase()
			if (!itemId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少清单ID'
				}
			}
			if (![STEP_ACTION_DIRECT_COMPLETE, STEP_ACTION_SKIP].includes(action)) {
				return {
					errCode: 'love-note-param-invalid',
					errMsg: '完成动作不支持'
				}
			}

			const record = await getWishPlanById(itemId, activeCouple._id)
			if (!record) {
				return {
					errCode: 'love-note-plan-not-found',
					errMsg: '清单不存在或无权限访问'
				}
			}

			const note = normalizeText(params.note || params.actionNote || '', MAX_DESCRIPTION_LENGTH)
			const now = Date.now()
			const type = normalizeItemType(record.type)

			let steps = Array.isArray(record.steps) ? record.steps : []
			if (type === ITEM_TYPE_PLAN && steps.length) {
				steps = steps.map((step) => {
					if (!step || step.status !== STEP_STATUS_PENDING) {
						return step
					}

					return Object.assign({}, step, {
						status: action === STEP_ACTION_SKIP ? STEP_STATUS_SKIPPED : STEP_STATUS_COMPLETED,
						action_mode: action,
						action_note: note,
						action_uid: uid,
						action_time: now,
						update_time: now
					})
				})
			}

			const finalStatus = action === STEP_ACTION_SKIP ? ITEM_STATUS_SKIPPED : ITEM_STATUS_COMPLETED
			const derivedState = derivePlanState({
				type,
				status: finalStatus,
				steps
			})

			const updateData = {
				steps,
				status: derivedState.status,
				progress: derivedState.progress,
				total_steps: derivedState.total_steps,
				completed_steps: derivedState.completed_steps,
				skipped_steps: derivedState.skipped_steps,
				step_summary: derivedState.step_summary,
				update_time: now,
				completed_time: now,
				final_action_mode: action,
				final_action_note: note,
				final_action_uid: uid,
				final_action_time: now
			}

			await wishPlanCollection.doc(itemId).update(updateData)
			return {
				errCode: 0,
				data: {
					item: normalizeWishPlanRecord(Object.assign({}, record, updateData, {
						_id: itemId
					}))
				}
			}
		} catch (error) {
			return formatError(error, '更新清单状态失败')
		}
	}

	async delete(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)
			if (!activeCouple) {
				return {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				}
			}

			const itemId = String(params.itemId || '').trim()
			if (!itemId) {
				return {
					errCode: 'love-note-param-required',
					errMsg: '缺少清单ID'
				}
			}

			const record = await getWishPlanById(itemId, activeCouple._id)
			if (!record) {
				return {
					errCode: 'love-note-plan-not-found',
					errMsg: '清单不存在或无权限访问'
				}
			}

			await wishPlanCollection.doc(itemId).update({
				is_deleted: true,
				update_time: Date.now(),
				delete_uid: uid
			})

			return {
				errCode: 0,
				data: {
					itemId
				}
			}
		} catch (error) {
			return formatError(error, '删除清单失败')
		}
	}
}
