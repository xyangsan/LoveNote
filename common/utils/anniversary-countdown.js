import calendar from '../../uni_modules/uni-calendar/components/uni-calendar/calendar.js'

const DAY_MS = 24 * 60 * 60 * 1000

const LUNAR_MONTH_TEXT_MAP = {
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
	'冬月': 11,
	'十一月': 11,
	'腊月': 12,
	'十二月': 12
}

const LUNAR_DAY_TEXT_MAP = {
	'初一': 1,
	'初二': 2,
	'初三': 3,
	'初四': 4,
	'初五': 5,
	'初六': 6,
	'初七': 7,
	'初八': 8,
	'初九': 9,
	'初十': 10,
	'十一': 11,
	'十二': 12,
	'十三': 13,
	'十四': 14,
	'十五': 15,
	'十六': 16,
	'十七': 17,
	'十八': 18,
	'十九': 19,
	'二十': 20,
	'廿一': 21,
	'廿二': 22,
	'廿三': 23,
	'廿四': 24,
	'廿五': 25,
	'廿六': 26,
	'廿七': 27,
	'廿八': 28,
	'廿九': 29,
	'三十': 30
}

function padDateUnit(value) {
	return `${value}`.padStart(2, '0')
}

export function formatDateValue(date = null) {
	if (!date || Number.isNaN(date.getTime())) {
		return ''
	}
	return `${date.getFullYear()}-${padDateUnit(date.getMonth() + 1)}-${padDateUnit(date.getDate())}`
}

export function parseDateValue(value = '') {
	const dateValue = String(value || '').trim()
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
		return null
	}
	const date = new Date(`${dateValue}T00:00:00`)
	if (Number.isNaN(date.getTime())) {
		return null
	}
	return formatDateValue(date) === dateValue ? date : null
}

function getTodayStartDate() {
	const now = new Date()
	return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function getDateStart(date = null) {
	if (!date || Number.isNaN(date.getTime())) {
		return null
	}
	return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getDayDiff(fromDate = null, toDate = null) {
	const from = getDateStart(fromDate)
	const to = getDateStart(toDate)
	if (!from || !to) {
		return null
	}
	return Math.floor((to.getTime() - from.getTime()) / DAY_MS)
}

function getDaysInMonth(year, monthIndex) {
	return new Date(year, monthIndex + 1, 0).getDate()
}

function createDateSafe(year, monthIndex, day) {
	const safeDay = Math.max(1, Math.min(day, getDaysInMonth(year, monthIndex)))
	return new Date(year, monthIndex, safeDay)
}

function buildDateFromSolarParts(year, month, day) {
	return parseDateValue(`${year}-${padDateUnit(month)}-${padDateUnit(day)}`)
}

function normalizeDateTimestamp(value, fallbackDateValue = '') {
	const raw = Number(value)
	if (Number.isFinite(raw) && raw > 0) {
		return Math.floor(raw)
	}
	const date = parseDateValue(fallbackDateValue)
	return date ? date.getTime() : 0
}

function getBaseDate({
	solarDateValue = '',
	dateValue = '',
	dateTimestamp = 0,
	selectedTimestamp = 0
} = {}) {
	const timestamp = normalizeDateTimestamp(dateTimestamp || selectedTimestamp, solarDateValue || dateValue)
	if (timestamp) {
		return getDateStart(new Date(timestamp))
	}
	return parseDateValue(solarDateValue || dateValue)
}

function parseLunarValue(value = '') {
	const raw = String(value || '').replace(/\s+/g, '')
	const yearMatch = raw.match(/(\d{4})年/)
	const year = yearMatch ? Number(yearMatch[1]) : 0
	const monthMatch = raw.match(/(闰)?(正月|一月|二月|三月|四月|五月|六月|七月|八月|九月|十月|冬月|十一月|腊月|十二月)/)
	const dayMatch = raw.match(/(初一|初二|初三|初四|初五|初六|初七|初八|初九|初十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|廿一|廿二|廿三|廿四|廿五|廿六|廿七|廿八|廿九|三十)/)
	return {
		year,
		month: monthMatch ? LUNAR_MONTH_TEXT_MAP[monthMatch[2]] || 0 : 0,
		day: dayMatch ? LUNAR_DAY_TEXT_MAP[dayMatch[1]] || 0 : 0,
		isLeap: Boolean(monthMatch && monthMatch[1])
	}
}

function getLunarInfoFromBaseDate(baseDate = null, lunarDateValue = '') {
	const parsed = parseLunarValue(lunarDateValue)
	if (parsed.month && parsed.day) {
		return parsed
	}
	if (!baseDate) {
		return null
	}
	const lunar = calendar.solar2lunar(baseDate.getFullYear(), baseDate.getMonth() + 1, baseDate.getDate())
	if (!lunar || lunar === -1) {
		return null
	}
	return {
		year: Number(lunar.lYear || 0),
		month: Number(lunar.lMonth || 0),
		day: Number(lunar.lDay || 0),
		isLeap: Boolean(lunar.isLeap)
	}
}

function lunarResultToDate(result) {
	if (!result || result === -1) {
		return null
	}
	return buildDateFromSolarParts(Number(result.cYear), Number(result.cMonth), Number(result.cDay))
}

function getNextSolarDate(baseDate, today, repeatType) {
	if (!baseDate) {
		return null
	}

	if (repeatType === 'weekly') {
		const diff = (baseDate.getDay() - today.getDay() + 7) % 7
		return new Date(today.getTime() + diff * DAY_MS)
	}

	if (repeatType === 'monthly') {
		const targetDay = baseDate.getDate()
		let nextDate = createDateSafe(today.getFullYear(), today.getMonth(), targetDay)
		if (nextDate.getTime() < today.getTime()) {
			const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
			nextDate = createDateSafe(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), targetDay)
		}
		return nextDate
	}

	if (repeatType === 'yearly') {
		const targetMonth = baseDate.getMonth()
		const targetDay = baseDate.getDate()
		let nextDate = createDateSafe(today.getFullYear(), targetMonth, targetDay)
		if (nextDate.getTime() < today.getTime()) {
			nextDate = createDateSafe(today.getFullYear() + 1, targetMonth, targetDay)
		}
		return nextDate
	}

	return baseDate
}

function getNextLunarYearDate(lunarInfo = {}, today = null) {
	if (!lunarInfo || !lunarInfo.month || !lunarInfo.day || !today) {
		return null
	}
	const todayLunar = calendar.solar2lunar(today.getFullYear(), today.getMonth() + 1, today.getDate())
	const startYear = todayLunar && todayLunar !== -1 ? Number(todayLunar.lYear || today.getFullYear()) : today.getFullYear()
	for (let offset = 0; offset <= 3; offset += 1) {
		const result = calendar.lunar2solar(startYear + offset, lunarInfo.month, lunarInfo.day, lunarInfo.isLeap)
		const candidate = lunarResultToDate(result)
		if (candidate && candidate.getTime() >= today.getTime()) {
			return candidate
		}
	}
	return null
}

function findNextLunarDayDate(lunarInfo = {}, today = null, maxScanDays = 80) {
	if (!lunarInfo || !lunarInfo.day || !today) {
		return null
	}
	for (let i = 0; i <= maxScanDays; i += 1) {
		const candidate = new Date(today.getTime() + i * DAY_MS)
		const lunar = calendar.solar2lunar(candidate.getFullYear(), candidate.getMonth() + 1, candidate.getDate())
		if (lunar && lunar !== -1 && Number(lunar.lDay) === Number(lunarInfo.day)) {
			return candidate
		}
	}
	return null
}

function getNextLunarDate(baseDate, today, repeatType, lunarDateValue = '') {
	const lunarInfo = getLunarInfoFromBaseDate(baseDate, lunarDateValue)
	if (!lunarInfo) {
		return getNextSolarDate(baseDate, today, repeatType)
	}
	if (repeatType === 'monthly') {
		return findNextLunarDayDate(lunarInfo, today) || getNextSolarDate(baseDate, today, repeatType)
	}
	if (repeatType === 'yearly') {
		return getNextLunarYearDate(lunarInfo, today) || getNextSolarDate(baseDate, today, repeatType)
	}
	if (repeatType === 'weekly') {
		return getNextSolarDate(baseDate, today, repeatType)
	}
	return baseDate
}

function buildCountdownText(countdownDays, isPassed = false) {
	if (countdownDays === null || countdownDays === undefined || Number.isNaN(Number(countdownDays))) {
		return '--'
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

function buildElapsedText(elapsedDays) {
	if (elapsedDays === null || elapsedDays === undefined || Number.isNaN(Number(elapsedDays))) {
		return ''
	}
	const days = Number(elapsedDays)
	if (days >= 0) {
		return ` ${days} 天`
	}
	return `还有 ${Math.abs(days)} 天开始`
}

export function computeAnniversaryCountdown(params = {}) {
	const repeatType = String(params.repeatType || params.repeat_type || 'yearly').trim() || 'yearly'
	const dateType = String(params.dateType || params.date_type || 'solar').trim() === 'lunar' ? 'lunar' : 'solar'
	const solarDateValue = String(params.solarDateValue || params.solar_date_value || params.dateValue || params.date_value || '').trim()
	const lunarDateValue = String(params.lunarDateValue || params.lunar_date_value || '').trim()
	const baseDate = getBaseDate({
		solarDateValue,
		dateValue: solarDateValue,
		dateTimestamp: params.dateTimestamp || params.date_timestamp,
		selectedTimestamp: params.selectedTimestamp || params.selected_timestamp
	})

	if (!baseDate) {
		return {
			countdownDays: null,
			countdownText: '--',
			nextDate: '',
			elapsedDays: null,
			elapsedText: ''
		}
	}

	const today = getTodayStartDate()
	let nextDate = baseDate
	if (repeatType !== 'none') {
		nextDate = dateType === 'lunar'
			? getNextLunarDate(baseDate, today, repeatType, lunarDateValue)
			: getNextSolarDate(baseDate, today, repeatType)
	}

	const countdownDays = getDayDiff(today, nextDate)
	const elapsedDays = getDayDiff(baseDate, today)
	const isPassed = repeatType === 'none' && Number(countdownDays) < 0

	return {
		countdownDays,
		countdownText: buildCountdownText(countdownDays, isPassed),
		nextDate: formatDateValue(nextDate),
		elapsedDays,
		elapsedText: buildElapsedText(elapsedDays)
	}
}

export function normalizeAnniversaryCountdownItem(item = {}) {
	const countdown = computeAnniversaryCountdown(item)
	return {
		...item,
		countdown_days: countdown.countdownDays,
		countdown_text: countdown.countdownText,
		next_date: countdown.nextDate,
		elapsed_days: countdown.elapsedDays,
		elapsed_text: countdown.elapsedText
	}
}
