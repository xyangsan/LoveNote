'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { anniversaryCollection } = require('../lib/db')
const { getActiveCoupleByUid } = require('../lib/couple')
const {
	andWhereConditions,
	buildCreatorVisibilityCondition
} = require('../lib/content-scope')
const {
	ensureHttpsUrl,
	isCloudFileId,
	getTempFileUrlMap
} = require('../lib/media')
const { formatError } = require('../lib/response')

const DATE_TYPE_SET = new Set(['solar', 'lunar'])
const REPEAT_TYPE_SET = new Set(['none', 'weekly', 'monthly', 'yearly'])
const BACKGROUND_TYPE_SET = new Set(['image', 'color'])

const DEFAULT_BACKGROUND_COLOR = '#EC7558'
const DEFAULT_FONT_COLOR = '#FFFFFF'
const DEFAULT_MASK_COLOR = '#000000'
const DEFAULT_MASK_OPACITY = 0.35
const MAX_TITLE_LENGTH = 50
const DAY_MS = 24 * 60 * 60 * 1000

const LUNAR_MONTH_MAP = {
	'正月': 1,
	'一月': 1,
	'二月': 2,
	'三月': 3,
	'四月': 4,
	'五月': 5,
	'六月': 6,
	'七月': 7,
	'八月': 8,
	'九月': 9,
	'十月': 10,
	'十一月': 11,
	'冬月': 11,
	'十二月': 12,
	'腊月': 12
}

const CHINESE_LUNAR_DAY_TEXT = {
	1: '初一',
	2: '初二',
	3: '初三',
	4: '初四',
	5: '初五',
	6: '初六',
	7: '初七',
	8: '初八',
	9: '初九',
	10: '初十',
	11: '十一',
	12: '十二',
	13: '十三',
	14: '十四',
	15: '十五',
	16: '十六',
	17: '十七',
	18: '十八',
	19: '十九',
	20: '二十',
	21: '廿一',
	22: '廿二',
	23: '廿三',
	24: '廿四',
	25: '廿五',
	26: '廿六',
	27: '廿七',
	28: '廿八',
	29: '廿九',
	30: '三十'
}

function createLunarFormatter() {
	try {
		return new Intl.DateTimeFormat('zh-Hans-CN-u-ca-chinese', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	} catch (error) {
		console.warn('lunar formatter unavailable, fallback to solar countdown', error)
		return null
	}
}

const LUNAR_FORMATTER = createLunarFormatter()

function withAuthResponse(authState = null, payload = {}) {
	const authResponse = authState && authState.response ? authState.response : {}
	return Object.assign({}, authResponse, payload)
}

function parseBooleanInput(value, fallback = false) {
	if (typeof value === 'boolean') {
		return value
	}
	if (typeof value === 'number') {
		if (value === 1) {
			return true
		}
		if (value === 0) {
			return false
		}
	}
	if (typeof value === 'string') {
		const normalizedValue = value.trim().toLowerCase()
		if (normalizedValue === 'true' || normalizedValue === '1') {
			return true
		}
		if (normalizedValue === 'false' || normalizedValue === '0') {
			return false
		}
	}
	return fallback
}

function normalizeDateType(value = 'solar') {
	const dateType = String(value || '').trim().toLowerCase()
	return DATE_TYPE_SET.has(dateType) ? dateType : 'solar'
}

function normalizeRepeatType(value = 'yearly') {
	const repeatType = String(value || '').trim().toLowerCase()
	return REPEAT_TYPE_SET.has(repeatType) ? repeatType : 'yearly'
}

function normalizeBackgroundType(value = 'color') {
	const backgroundType = String(value || '').trim().toLowerCase()
	return BACKGROUND_TYPE_SET.has(backgroundType) ? backgroundType : 'color'
}

function normalizeColor(value = '', fallback = '#FFFFFF') {
	const color = String(value || '').trim()
	if (/^#([\da-fA-F]{6}|[\da-fA-F]{8})$/.test(color)) {
		return color
	}
	if (/^#([\da-fA-F]{3})$/.test(color)) {
		const r = color[1]
		const g = color[2]
		const b = color[3]
		return `#${r}${r}${g}${g}${b}${b}`
	}
	return fallback
}

function clampOpacity(value, fallback = DEFAULT_MASK_OPACITY) {
	const raw = Number(value)
	if (Number.isNaN(raw)) {
		return fallback
	}
	return Math.max(0, Math.min(1, raw))
}

function parseDateValue(value = '') {
	const dateValue = String(value || '').trim()
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
		return null
	}

	const date = new Date(`${dateValue}T00:00:00`)
	if (Number.isNaN(date.getTime())) {
		return null
	}

	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}` === dateValue ? date : null
}

function formatDateValue(date = null) {
	if (!date || Number.isNaN(date.getTime())) {
		return ''
	}
	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	return `${year}-${month}-${day}`
}

function normalizeDateTimestamp(value, fallbackDateValue = '') {
	const raw = Number(value)
	if (Number.isFinite(raw) && raw > 0) {
		return Math.floor(raw)
	}

	const fallbackDate = parseDateValue(fallbackDateValue)
	return fallbackDate ? fallbackDate.getTime() : 0
}

function getTodayStartDate() {
	const now = new Date()
	return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function getDaysInMonth(year, monthIndex) {
	return new Date(year, monthIndex + 1, 0).getDate()
}

function createDateSafe(year, monthIndex, day) {
	const safeDay = Math.max(1, Math.min(day, getDaysInMonth(year, monthIndex)))
	return new Date(year, monthIndex, safeDay)
}

function getDayDiff(fromDate, toDate) {
	return Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS)
}

function parseLunarMonth(value = '') {
	const raw = String(value || '').trim().replace(/\s+/g, '')
	if (!raw) {
		return {
			month: 0,
			isLeap: false
		}
	}

	const isLeap = raw.includes('闰')
	const normalizedMonthText = raw.replace('闰', '')
	const mappedMonth = LUNAR_MONTH_MAP[normalizedMonthText]
	if (mappedMonth) {
		return {
			month: mappedMonth,
			isLeap
		}
	}

	const digitMonth = parseInt(normalizedMonthText.replace(/[^\d]/g, ''), 10)
	if (!Number.isNaN(digitMonth) && digitMonth >= 1 && digitMonth <= 12) {
		return {
			month: digitMonth,
			isLeap
		}
	}

	return {
		month: 0,
		isLeap
	}
}

function getChineseLunarDayText(day = 0) {
	return CHINESE_LUNAR_DAY_TEXT[Number(day)] || ''
}

function getLunarDateInfo(date = null) {
	if (!LUNAR_FORMATTER || !date || Number.isNaN(date.getTime())) {
		return null
	}

	try {
		const parts = LUNAR_FORMATTER.formatToParts(date)
		const relatedYearText = String((parts.find((part) => part.type === 'relatedYear') || {}).value || '')
		const monthText = String((parts.find((part) => part.type === 'month') || {}).value || '')
		const dayText = String((parts.find((part) => part.type === 'day') || {}).value || '')
		const monthInfo = parseLunarMonth(monthText)
		const day = parseInt(dayText.replace(/[^\d]/g, ''), 10)

		if (!monthInfo.month || Number.isNaN(day) || day < 1 || day > 30) {
			return null
		}

		return {
			year: parseInt(relatedYearText.replace(/[^\d]/g, ''), 10) || 0,
			month: monthInfo.month,
			day,
			isLeap: monthInfo.isLeap,
			monthText,
			dayText: getChineseLunarDayText(day)
		}
	} catch (error) {
		console.warn('getLunarDateInfo failed', error)
		return null
	}
}

function formatLunarDateValueFromInfo(info = null) {
	if (!info) {
		return ''
	}

	const yearText = info.year ? `${info.year}年` : ''
	const monthText = String(info.monthText || '').trim()
	const dayText = String(info.dayText || '').trim()
	return `${yearText}${monthText}${dayText}`.trim()
}

function findNextLunarDate(target = {}, fromDate = null, maxScanDays = 800) {
	if (!fromDate || Number.isNaN(fromDate.getTime()) || !target.month || !target.day) {
		return null
	}

	const expectLeap = Boolean(target.isLeap)
	for (let i = 0; i <= maxScanDays; i += 1) {
		const candidate = new Date(fromDate.getTime() + i * DAY_MS)
		const lunarInfo = getLunarDateInfo(candidate)
		if (!lunarInfo) {
			continue
		}

		if (lunarInfo.month !== target.month || lunarInfo.day !== target.day) {
			continue
		}

		if (Boolean(lunarInfo.isLeap) !== expectLeap) {
			continue
		}

		return candidate
	}

	return null
}

function getNextSolarDate(baseDate, today, repeatType) {
	let nextDate = new Date(baseDate.getTime())
	if (repeatType === 'weekly') {
		const targetWeekDay = baseDate.getDay()
		const diff = (targetWeekDay - today.getDay() + 7) % 7
		nextDate = new Date(today.getTime() + diff * DAY_MS)
		return nextDate
	}

	if (repeatType === 'monthly') {
		const targetDay = baseDate.getDate()
		nextDate = createDateSafe(today.getFullYear(), today.getMonth(), targetDay)
		if (nextDate.getTime() < today.getTime()) {
			const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
			nextDate = createDateSafe(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), targetDay)
		}
		return nextDate
	}

	if (repeatType === 'yearly') {
		const targetMonth = baseDate.getMonth()
		const targetDay = baseDate.getDate()
		nextDate = createDateSafe(today.getFullYear(), targetMonth, targetDay)
		if (nextDate.getTime() < today.getTime()) {
			nextDate = createDateSafe(today.getFullYear() + 1, targetMonth, targetDay)
		}
	}

	return nextDate
}

function computeCountdown(dateValue = '', repeatType = 'yearly', dateType = 'solar') {
	const baseDate = parseDateValue(dateValue)
	if (!baseDate) {
		return {
			countdownDays: null,
			nextDate: '',
			isPassed: false
		}
	}

	const today = getTodayStartDate()
	const safeRepeatType = normalizeRepeatType(repeatType)
	const safeDateType = normalizeDateType(dateType)
	let nextDate = new Date(baseDate.getTime())

	if (safeRepeatType !== 'none') {
		if (safeRepeatType === 'yearly' && safeDateType === 'lunar') {
			const lunarInfo = getLunarDateInfo(baseDate)
			const nextLunarDate = lunarInfo ? findNextLunarDate(lunarInfo, today, 800) : null
			nextDate = nextLunarDate || getNextSolarDate(baseDate, today, safeRepeatType)
		} else {
			nextDate = getNextSolarDate(baseDate, today, safeRepeatType)
		}
	}

	const countdownDays = getDayDiff(today, nextDate)
	const isPassed = safeRepeatType === 'none' && countdownDays < 0

	return {
		countdownDays,
		nextDate: formatDateValue(nextDate),
		isPassed
	}
}

function buildCountdownText(countdownDays, isPassed = false) {
	if (countdownDays === null || countdownDays === undefined || Number.isNaN(Number(countdownDays))) {
		return ''
	}

	const days = Number(countdownDays)
	if (days === 0) {
		return '今天'
	}
	if (days > 0) {
		return `还有 ${days} 天`
	}
	return isPassed ? `已过 ${Math.abs(days)} 天` : `还有 ${Math.abs(days)} 天`
}

function getValueByAlias(source = {}, aliases = []) {
	for (let i = 0; i < aliases.length; i += 1) {
		const key = aliases[i]
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			return source[key]
		}
	}
	return undefined
}

function normalizeLunarDateValue(value = '', fallback = '') {
	const lunarDateValue = String(value || '').trim()
	return lunarDateValue || fallback
}

function buildNormalizedDateFields(params = {}, fallbackRecord = null) {
	const rawSolarInput = getValueByAlias(params, ['solarDateValue', 'solar_date_value', 'dateValue', 'date_value'])
	const rawLunarInput = getValueByAlias(params, ['lunarDateValue', 'lunar_date_value'])
	const rawTimestampInput = getValueByAlias(params, ['selectedTimestamp', 'selected_timestamp', 'dateTimestamp', 'date_timestamp'])
	const safeFallbackRecord = fallbackRecord && typeof fallbackRecord === 'object' ? fallbackRecord : {}

	const fallbackSolarDateValue = getValueByAlias(safeFallbackRecord, ['solar_date_value', 'date_value'])
	const solarCandidate = rawSolarInput !== undefined ? rawSolarInput : fallbackSolarDateValue
	const solarDate = parseDateValue(String(solarCandidate || '').trim())
	if (!solarDate) {
		return null
	}

	const solarDateValue = formatDateValue(solarDate)
	const derivedLunarDateValue = formatLunarDateValueFromInfo(getLunarDateInfo(solarDate))
	const fallbackLunarDateValue = getValueByAlias(safeFallbackRecord, ['lunar_date_value'])
	const lunarCandidate = rawLunarInput !== undefined
		? rawLunarInput
		: rawSolarInput !== undefined
			? derivedLunarDateValue
			: fallbackLunarDateValue
	const fallbackTimestamp = getValueByAlias(safeFallbackRecord, ['date_timestamp'])
	const timestampCandidate = rawTimestampInput !== undefined
		? rawTimestampInput
		: rawSolarInput !== undefined
			? solarDate.getTime()
			: fallbackTimestamp

	return {
		dateValue: solarDateValue,
		solarDateValue,
		lunarDateValue: normalizeLunarDateValue(lunarCandidate, derivedLunarDateValue),
		dateTimestamp: normalizeDateTimestamp(timestampCandidate, solarDateValue)
	}
}

function hasDateFieldInput(params = {}) {
	const aliases = [
		'dateValue',
		'date_value',
		'solarDateValue',
		'solar_date_value',
		'lunarDateValue',
		'lunar_date_value',
		'selectedTimestamp',
		'selected_timestamp',
		'dateTimestamp',
		'date_timestamp'
	]
	return aliases.some((key) => Object.prototype.hasOwnProperty.call(params, key))
}

function extractStyleInput(params = {}) {
	const rawStyle = params.style && typeof params.style === 'object' ? params.style : {}
	const fields = [
		['backgroundType', ['backgroundType', 'background_type']],
		['backgroundImage', ['backgroundImage', 'background_image']],
		['backgroundColor', ['backgroundColor', 'background_color']],
		['fontColor', ['fontColor', 'font_color']],
		['maskEnabled', ['maskEnabled', 'mask_enabled']],
		['maskColor', ['maskColor', 'mask_color']],
		['maskOpacity', ['maskOpacity', 'mask_opacity']]
	]

	const styleInput = {}
	fields.forEach(([targetKey, aliases]) => {
		let value = getValueByAlias(rawStyle, aliases)
		if (value === undefined) {
			value = getValueByAlias(params, aliases)
		}
		if (value !== undefined) {
			styleInput[targetKey] = value
		}
	})

	return styleInput
}

function collectFileIdsFromAnniversaryList(list = []) {
	const fileIds = []
	list.forEach((item) => {
		if (!item || typeof item !== 'object') {
			return
		}

		const bgImage = item.background_image && typeof item.background_image === 'object'
			? item.background_image
			: {}
		const fileId = String(bgImage.file_id || '').trim()
		const url = String(bgImage.url || '').trim()

		if (fileId && isCloudFileId(fileId)) {
			fileIds.push(fileId)
		} else if (isCloudFileId(url)) {
			fileIds.push(url)
		}
	})
	return fileIds
}

async function normalizeBackgroundImageInput(rawBackgroundImage = {}) {
	const imageData = rawBackgroundImage && typeof rawBackgroundImage === 'object' ? rawBackgroundImage : {}
	const rawFileId = String(imageData.fileId || imageData.file_id || '').trim()
	const rawUrl = String(imageData.url || '').trim()

	const fileId = rawFileId || (isCloudFileId(rawUrl) ? rawUrl : '')
	let imageUrl = ensureHttpsUrl(rawUrl)

	if (!imageUrl && fileId) {
		const fileUrlMap = await getTempFileUrlMap([fileId])
		imageUrl = fileUrlMap[fileId] || ''
	}

	if (!imageUrl && !fileId) {
		return null
	}

	return {
		url: imageUrl,
		file_id: fileId
	}
}

function readStyleFromRecord(record = {}) {
	const bgImage = record.background_image && typeof record.background_image === 'object'
		? record.background_image
		: {}
	const hasImage = Boolean(String(bgImage.url || '').trim() || String(bgImage.file_id || '').trim())

	return {
		backgroundType: normalizeBackgroundType(record.background_type || (hasImage ? 'image' : 'color')),
		backgroundImage: {
			url: String(bgImage.url || '').trim(),
			file_id: String(bgImage.file_id || '').trim()
		},
		backgroundColor: normalizeColor(record.background_color, DEFAULT_BACKGROUND_COLOR),
		fontColor: normalizeColor(record.font_color, DEFAULT_FONT_COLOR),
		maskEnabled: parseBooleanInput(record.mask_enabled, true),
		maskColor: normalizeColor(record.mask_color, DEFAULT_MASK_COLOR),
		maskOpacity: clampOpacity(record.mask_opacity, DEFAULT_MASK_OPACITY)
	}
}

function normalizeAnniversaryRecord(record = {}, fileUrlMap = {}) {
	const bgImage = record.background_image && typeof record.background_image === 'object'
		? record.background_image
		: {}
	const fileId = String(bgImage.file_id || '').trim()
	const rawUrl = String(bgImage.url || '').trim()
	let backgroundImageUrl = ensureHttpsUrl(rawUrl)

	if (!backgroundImageUrl && fileId && fileUrlMap[fileId]) {
		backgroundImageUrl = fileUrlMap[fileId]
	}
	if (!backgroundImageUrl && isCloudFileId(rawUrl)) {
		backgroundImageUrl = fileUrlMap[rawUrl] || ''
	}

	const dateFields = buildNormalizedDateFields(record, record)
	const solarDateValue = dateFields ? dateFields.solarDateValue : String(record.date_value || '').trim()
	const lunarDateValue = dateFields ? dateFields.lunarDateValue : ''
	const dateTimestamp = dateFields
		? dateFields.dateTimestamp
		: normalizeDateTimestamp(record.date_timestamp, solarDateValue)
	const dateType = normalizeDateType(record.date_type)
	const repeatType = normalizeRepeatType(record.repeat_type)
	const countdown = computeCountdown(solarDateValue, repeatType, dateType)
	const displayDateValue = dateType === 'lunar'
		? lunarDateValue || solarDateValue
		: solarDateValue || lunarDateValue

	return Object.assign({}, record, {
		background_image: {
			url: backgroundImageUrl,
			file_id: fileId
		},
		background_type: normalizeBackgroundType(record.background_type),
		date_type: dateType,
		date_value: solarDateValue,
		solar_date_value: solarDateValue,
		lunar_date_value: lunarDateValue,
		date_timestamp: dateTimestamp,
		display_date_value: displayDateValue,
		repeat_type: repeatType,
		background_color: normalizeColor(record.background_color, DEFAULT_BACKGROUND_COLOR),
		font_color: normalizeColor(record.font_color, DEFAULT_FONT_COLOR),
		mask_color: normalizeColor(record.mask_color, DEFAULT_MASK_COLOR),
		mask_enabled: parseBooleanInput(record.mask_enabled, true),
		mask_opacity: clampOpacity(record.mask_opacity, DEFAULT_MASK_OPACITY),
		countdown_days: countdown.countdownDays,
		next_date: countdown.nextDate,
		countdown_text: buildCountdownText(countdown.countdownDays, countdown.isPassed)
	})
}

module.exports = class AnniversaryService extends Service {
	async getList(params = {}) {
		let authState = null
		try {
			authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)


			const page = Math.max(1, parseInt(params.page, 10) || 1)
			const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize, 10) || 20))

			const visibilityCondition = buildCreatorVisibilityCondition({
				uid,
				activeCouple,
				creatorField: 'creator_uid'
			})
			const whereCondition = andWhereConditions(visibilityCondition, {
				is_deleted: false
			})

			const totalRes = await anniversaryCollection.where(whereCondition).count()
			const total = Number(totalRes.total || 0)

			const listRes = await anniversaryCollection
				.where(whereCondition)
				.orderBy('date_value', 'asc')
				.orderBy('create_time', 'desc')
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get()

			const rawList = Array.isArray(listRes.data) ? listRes.data : []
			const fileUrlMap = await getTempFileUrlMap(collectFileIdsFromAnniversaryList(rawList))
			const list = rawList.map((item) => normalizeAnniversaryRecord(item, fileUrlMap))

			return withAuthResponse(authState, {
				errCode: 0,
				data: {
					list,
					pagination: {
						page,
						pageSize,
						total,
						hasMore: page * pageSize < total
					}
				}
			})
		} catch (error) {
			return withAuthResponse(authState, formatError(error, '获取纪念日列表失败'))
		}
	}

	async getDetail(params = {}) {
		let authState = null
		try {
			authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)


			const anniversaryId = String(params.anniversaryId || params.id || '').trim()
			if (!anniversaryId) {
				return withAuthResponse(authState, {
					errCode: 'love-note-param-required',
					errMsg: '纪念日 ID 不能为空'
				})
			}

			const visibilityCondition = buildCreatorVisibilityCondition({
				uid,
				activeCouple,
				creatorField: 'creator_uid'
			})
			const detailRes = await anniversaryCollection
				.where(andWhereConditions(visibilityCondition, {
					_id: anniversaryId,
					is_deleted: false
				}))
				.limit(1)
				.get()

			if (!detailRes.data || detailRes.data.length === 0) {
				return withAuthResponse(authState, {
					errCode: 'love-note-anniversary-not-found',
					errMsg: '纪念日不存在或无权访问'
				})
			}

			const rawRecord = detailRes.data[0]
			const fileUrlMap = await getTempFileUrlMap(collectFileIdsFromAnniversaryList([rawRecord]))
			const anniversary = normalizeAnniversaryRecord(rawRecord, fileUrlMap)

			return withAuthResponse(authState, {
				errCode: 0,
				data: {
					anniversary
				}
			})
		} catch (error) {
			return withAuthResponse(authState, formatError(error, '获取纪念日详情失败'))
		}
	}

	async create(params = {}) {
		let authState = null
		try {
			authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return withAuthResponse(authState, {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				})
			}

			const title = String(params.title || '').trim()
			if (!title) {
				return withAuthResponse(authState, {
					errCode: 'love-note-param-required',
					errMsg: '请输入纪念日标题'
				})
			}
			if (title.length > MAX_TITLE_LENGTH) {
				return withAuthResponse(authState, {
					errCode: 'love-note-param-invalid',
					errMsg: `标题不能超过 ${MAX_TITLE_LENGTH} 个字符`
				})
			}

			const dateFields = buildNormalizedDateFields(params)
			if (!dateFields) {
				return withAuthResponse(authState, {
					errCode: 'love-note-param-invalid',
					errMsg: '日期格式不正确，请使用 YYYY-MM-DD'
				})
			}

			const dateType = normalizeDateType(params.dateType || params.date_type || 'solar')
			const repeatType = normalizeRepeatType(params.repeatType || params.repeat_type || 'yearly')
			const styleInput = extractStyleInput(params)

			const backgroundType = normalizeBackgroundType(styleInput.backgroundType || 'color')
			let backgroundImage = null
			if (backgroundType === 'image') {
				backgroundImage = await normalizeBackgroundImageInput(styleInput.backgroundImage || {})
				const hasImage = Boolean(backgroundImage && (backgroundImage.url || backgroundImage.file_id))
				if (!hasImage) {
					return withAuthResponse(authState, {
						errCode: 'love-note-param-invalid',
						errMsg: '请上传背景图片后再保存'
					})
				}
			}

			const now = Date.now()
			const record = {
				couple_id: activeCouple._id,
				title,
				date_type: dateType,
				date_value: dateFields.dateValue,
				solar_date_value: dateFields.solarDateValue,
				lunar_date_value: dateFields.lunarDateValue,
				date_timestamp: dateFields.dateTimestamp,
				repeat_type: repeatType,
				background_type: backgroundType,
				background_image: backgroundType === 'image'
					? backgroundImage
					: {
						url: '',
						file_id: ''
					},
				background_color: normalizeColor(styleInput.backgroundColor, DEFAULT_BACKGROUND_COLOR),
				font_color: normalizeColor(styleInput.fontColor, DEFAULT_FONT_COLOR),
				mask_enabled: parseBooleanInput(styleInput.maskEnabled, true),
				mask_color: normalizeColor(styleInput.maskColor, DEFAULT_MASK_COLOR),
				mask_opacity: clampOpacity(styleInput.maskOpacity, DEFAULT_MASK_OPACITY),
				creator_uid: uid,
				is_deleted: false,
				create_time: now,
				update_time: now
			}

			const result = await anniversaryCollection.add(record)
			return withAuthResponse(authState, {
				errCode: 0,
				data: {
					anniversaryId: result.id
				}
			})
		} catch (error) {
			return withAuthResponse(authState, formatError(error, '创建纪念日失败'))
		}
	}

	async update(params = {}) {
		let authState = null
		try {
			authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return withAuthResponse(authState, {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				})
			}

			const anniversaryId = String(params.anniversaryId || params.id || '').trim()
			if (!anniversaryId) {
				return withAuthResponse(authState, {
					errCode: 'love-note-param-required',
					errMsg: '纪念日 ID 不能为空'
				})
			}

			const detailRes = await anniversaryCollection
				.where({
					_id: anniversaryId,
					couple_id: activeCouple._id,
					is_deleted: false
				})
				.limit(1)
				.get()

			if (!detailRes.data || detailRes.data.length === 0) {
				return withAuthResponse(authState, {
					errCode: 'love-note-anniversary-not-found',
					errMsg: '纪念日不存在或无权访问'
				})
			}

			const record = detailRes.data[0]
			const updateData = {
				update_time: Date.now()
			}

			if (params.title !== undefined) {
				const title = String(params.title || '').trim()
				if (!title) {
					return withAuthResponse(authState, {
						errCode: 'love-note-param-required',
						errMsg: '请输入纪念日标题'
					})
				}
				if (title.length > MAX_TITLE_LENGTH) {
					return withAuthResponse(authState, {
						errCode: 'love-note-param-invalid',
						errMsg: `标题不能超过 ${MAX_TITLE_LENGTH} 个字符`
					})
				}
				updateData.title = title
			}

			if (hasDateFieldInput(params)) {
				const dateFields = buildNormalizedDateFields(params, record)
				if (!dateFields) {
					return withAuthResponse(authState, {
						errCode: 'love-note-param-invalid',
						errMsg: '日期格式不正确，请使用 YYYY-MM-DD'
					})
				}
				updateData.date_value = dateFields.dateValue
				updateData.solar_date_value = dateFields.solarDateValue
				updateData.lunar_date_value = dateFields.lunarDateValue
				updateData.date_timestamp = dateFields.dateTimestamp
			}

			if (params.dateType !== undefined || params.date_type !== undefined) {
				updateData.date_type = normalizeDateType(params.dateType !== undefined ? params.dateType : params.date_type)
			}

			if (params.repeatType !== undefined || params.repeat_type !== undefined) {
				updateData.repeat_type = normalizeRepeatType(params.repeatType !== undefined ? params.repeatType : params.repeat_type)
			}

			const styleInput = extractStyleInput(params)
			if (Object.keys(styleInput).length) {
				const style = readStyleFromRecord(record)

				if (styleInput.backgroundType !== undefined) {
					style.backgroundType = normalizeBackgroundType(styleInput.backgroundType)
				}
				if (styleInput.backgroundColor !== undefined) {
					style.backgroundColor = normalizeColor(styleInput.backgroundColor, DEFAULT_BACKGROUND_COLOR)
				}
				if (styleInput.fontColor !== undefined) {
					style.fontColor = normalizeColor(styleInput.fontColor, DEFAULT_FONT_COLOR)
				}
				if (styleInput.maskEnabled !== undefined) {
					style.maskEnabled = parseBooleanInput(styleInput.maskEnabled, style.maskEnabled)
				}
				if (styleInput.maskColor !== undefined) {
					style.maskColor = normalizeColor(styleInput.maskColor, DEFAULT_MASK_COLOR)
				}
				if (styleInput.maskOpacity !== undefined) {
					style.maskOpacity = clampOpacity(styleInput.maskOpacity, style.maskOpacity)
				}

				if (styleInput.backgroundImage !== undefined) {
					const normalizedImage = await normalizeBackgroundImageInput(styleInput.backgroundImage)
					style.backgroundImage = normalizedImage || {
						url: '',
						file_id: ''
					}
				}

				if (style.backgroundType === 'image') {
					const hasBackgroundImage = Boolean(
						style.backgroundImage && (style.backgroundImage.url || style.backgroundImage.file_id)
					)
					if (!hasBackgroundImage) {
						return withAuthResponse(authState, {
							errCode: 'love-note-param-invalid',
							errMsg: '请上传背景图片后再保存'
						})
					}
				} else {
					style.backgroundImage = {
						url: '',
						file_id: ''
					}
				}

				updateData.background_type = style.backgroundType
				updateData.background_image = style.backgroundImage
				updateData.background_color = style.backgroundColor
				updateData.font_color = style.fontColor
				updateData.mask_enabled = style.maskEnabled
				updateData.mask_color = style.maskColor
				updateData.mask_opacity = style.maskOpacity
			}

			await anniversaryCollection.doc(anniversaryId).update(updateData)

			return withAuthResponse(authState, {
				errCode: 0,
				data: {
					anniversaryId
				}
			})
		} catch (error) {
			return withAuthResponse(authState, formatError(error, '更新纪念日失败'))
		}
	}

	async delete(params = {}) {
		let authState = null
		try {
			authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const uid = authState.authResult.uid
			const activeCouple = await getActiveCoupleByUid(uid)

			if (!activeCouple) {
				return withAuthResponse(authState, {
					errCode: 'love-note-no-couple',
					errMsg: '请先绑定情侣关系'
				})
			}

			const anniversaryId = String(params.anniversaryId || params.id || '').trim()
			if (!anniversaryId) {
				return withAuthResponse(authState, {
					errCode: 'love-note-param-required',
					errMsg: '纪念日 ID 不能为空'
				})
			}

			const detailRes = await anniversaryCollection
				.where({
					_id: anniversaryId,
					couple_id: activeCouple._id,
					is_deleted: false
				})
				.limit(1)
				.get()

			if (!detailRes.data || detailRes.data.length === 0) {
				return withAuthResponse(authState, {
					errCode: 'love-note-anniversary-not-found',
					errMsg: '纪念日不存在或无权访问'
				})
			}

			await anniversaryCollection.doc(anniversaryId).update({
				is_deleted: true,
				update_time: Date.now()
			})

			return withAuthResponse(authState, {
				errCode: 0,
				data: {
					anniversaryId
				}
			})
		} catch (error) {
			return withAuthResponse(authState, formatError(error, '删除纪念日失败'))
		}
	}
}
