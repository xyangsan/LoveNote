/**
 * 运营管理页的图表配置（xtf-charts，ECharts 风格 option）。
 *
 * 全部是纯函数：页面只把接口数据丢进来，颜色 / 网格 / 轴标签抽稀都在这里统一，
 * 既避免每个模板里重复写几百行配置，也方便用 Node 直接跑单测。
 *
 * 配色沿用 love-theme：主珊瑚 #ec7558，文字 #a07b70 / #5d372b。
 */

export const CHART_PALETTE = ['#E88A63', '#E3BE9A', '#8FC0BB', '#A9DCBC', '#C08BB8', '#8FA4D6']

const CHART_BG = '#2A211B'
const TEXT_COLOR = 'rgba(247, 241, 233, 0.58)'
const TITLE_COLOR = '#FCF7F0'
const GRID_COLOR = 'rgba(255, 255, 255, 0.10)'
const PRIMARY = '#E88A63'
const PRIMARY_LIGHT = '#E3BE9A'
const SECONDARY = '#8FC0BB'

/**
 * Canvas 图表**不继承 CSS 变量**，所以主题色板只能由调用方在构建 option 时传进来：
 * 页面用 `getChartPalette(themeKey)`（common/theme.js）取当前主题的一组颜色。
 * 这里的默认值是「暗夜」，保证纯函数在 Node 里单测时也能跑。
 */
const DEFAULT_PALETTE = {
	bg: CHART_BG,
	text: TEXT_COLOR,
	title: TITLE_COLOR,
	grid: GRID_COLOR,
	tooltipBg: 'rgba(46, 37, 30, 0.96)',
	tooltipText: '#FCF7F0',
	label: '#F2E0C9'
}

function resolvePalette(palette) {
	return Object.assign({}, DEFAULT_PALETTE, palette || {})
}

/** 'YYYY-MM-DD' → 'MM/DD'；其他字符串原样返回 */
function shortDay(dateKey) {
	const value = String(dateKey || '')
	if (value.length < 10) {
		return value
	}
	return `${Number(value.slice(5, 7))}/${value.slice(8, 10)}`
}

/** 轴标签抽稀：最多显示 maxLabels 个 */
function labelInterval(total, maxLabels = 6) {
	if (!total || total <= maxLabels) {
		return 0
	}
	return Math.max(1, Math.ceil(total / maxLabels) - 1)
}

function toNumber(value) {
	const next = Number(value)
	return Number.isFinite(next) ? next : 0
}

function roundMoney(value) {
	return Math.round(toNumber(value) * 100) / 100
}

/**
 * 轴上限取「整齐刻度」：组件固定画 5 条刻度线（4 等分），
 * 直接把数据最大值当上限会出现 0.54 / 0.405 / 0.27 这种刻度。
 */
export function niceAxisMax(value, divisions = 4) {
	const safe = toNumber(value)
	if (safe <= 0) {
		return 1
	}
	const rawStep = safe / divisions
	const magnitude = Math.pow(10, Math.floor(Math.log(rawStep) / Math.LN10))
	const normalized = rawStep / magnitude
	const ladder = [1, 2, 2.5, 5, 10]
	const step = ladder.find((item) => item * magnitude >= rawStep - 1e-9) || 10
	return Math.round(step * magnitude * divisions * 1000) / 1000
}

/** 人数类（整数）轴上限：保证刻度是整数，别出现 0.3 人 / 0.8 人 */
export function niceCountAxisMax(value, divisions = 4) {
	const peak = Math.ceil(toNumber(value))
	const step = Math.max(1, Math.ceil(peak / divisions))
	return step * divisions
}

/** 笛卡尔坐标系骨架（折线 / 柱图共用） */
function cartesianBase(categories, palette) {
	const p = resolvePalette(palette)
	return {
		backgroundColor: p.bg,
		textColor: p.text,
		animation: true,
		animationDuration: 520,
		legend: { show: false },
		grid: { left: 42, right: 18, top: 16, bottom: 26, showHorizontal: true, showVertical: false, color: p.grid },
		tooltip: { show: true, trigger: 'axis', duration: 1600, backgroundColor: p.tooltipBg, textColor: p.tooltipText },
		xAxis: {
			data: categories,
			axisLabel: { interval: labelInterval(categories.length), color: p.text, fontSize: 10 },
			axisLine: { show: false },
			splitLine: { show: false }
		},
		yAxis: {
			min: 0,
			axisLabel: { color: p.text, fontSize: 10 },
			axisLine: { show: false },
			splitLine: { show: true, color: p.grid }
		}
	}
}

/** 折线系列：平滑曲线（组件内用单调三次插值，不会冲过数据点），默认不画数据点 */
function lineSeries(name, values, color, options = {}) {
	return {
		name,
		type: 'line',
		data: values,
		color,
		smooth: true,
		areaStyle: options.area === true,
		showSymbol: false,
		lineStyle: { width: 2 }
	}
}

/** 总览：每日新增用户 */
export function buildUserTrendOption(trend = [], palette) {
	const list = Array.isArray(trend) ? trend : []
	const values = list.map((item) => toNumber(item.newUsers))
	const option = cartesianBase(list.map((item) => shortDay(item.date)), palette)
	option.yAxis.max = niceCountAxisMax(Math.max.apply(null, values.concat([0])))
	option.series = [lineSeries('新增用户', values, PRIMARY, { area: true })]
	return option
}

/** 总览：访问 / 登录双线（访问带面积、登录只画线，避免两条面积互相盖住） */
export function buildVisitTrendOption(trend = [], palette) {
	const list = Array.isArray(trend) ? trend : []
	const visits = list.map((item) => toNumber(item.visits))
	const logins = list.map((item) => toNumber(item.logins))
	const option = cartesianBase(list.map((item) => shortDay(item.date)), palette)
	option.grid.top = 26
	option.yAxis.max = niceCountAxisMax(Math.max.apply(null, visits.concat(logins, [0])))
	option.legend = { show: true, textColor: resolvePalette(palette).text, fontSize: 10, itemGap: 14, iconSize: 8 }
	option.series = [
		lineSeries('访问', visits, PRIMARY, { area: true }),
		lineSeries('登录', logins, SECONDARY)
	]
	return option
}

/** 模块：各模块渗透率（横向柱图，单位 %） */
export function buildModulePenetrationOption(modules = [], palette) {
	const p = resolvePalette(palette)
	const list = Array.isArray(modules) ? modules : []
	const values = list.map((item) => Math.round(toNumber(item.penetration)))
	const peak = values.length ? Math.max.apply(null, values) : 0
	const max = Math.max(20, Math.ceil(peak / 10) * 10)

	return {
		backgroundColor: p.bg,
		textColor: p.text,
		animation: true,
		animationDuration: 520,
		legend: { show: false },
		tooltip: { show: true, trigger: 'axis', duration: 1600, backgroundColor: p.tooltipBg, textColor: p.tooltipText },
		grid: { left: 74, right: 34, top: 10, bottom: 22, showHorizontal: false, showVertical: true, color: p.grid },
		xAxis: {
			min: 0,
			max,
			valueSuffix: '%',
			axisLabel: { color: p.text, fontSize: 10 },
			axisLine: { show: false },
			splitLine: { show: true, color: p.grid }
		},
		yAxis: {
			data: list.map((item) => item.name),
			axisLabel: { interval: 0, color: p.title, fontSize: 10 },
			axisLine: { show: false },
			splitLine: { show: false }
		},
		series: [{
			name: '渗透率',
			type: 'bar',
			orient: 'horizontal',
			data: values,
			color: PRIMARY,
			colors: [PRIMARY_LIGHT, PRIMARY],
			barWidth: '54%',
			itemStyle: { borderRadius: 6 },
			label: { show: true, position: 'right', color: p.label, fontSize: 10 }
		}]
	}
}

/** 广告：区间收益趋势 */
export function buildAdTrendOption(trend = [], palette) {
	const list = Array.isArray(trend) ? trend : []
	const values = list.map((item) => toNumber(item.revenue))
	const option = cartesianBase(list.map((item) => shortDay(item.date)), palette)
	option.yAxis.max = niceAxisMax(Math.max.apply(null, values.concat([0])))
	option.series = [lineSeries('预估收益', values, PRIMARY, { area: true })]
	return option
}

/** 广告：广告位收益占比（环形图，中心显示合计） */
export function buildAdPositionRingOption(positions = [], palette) {
	const p = resolvePalette(palette)
	const list = (Array.isArray(positions) ? positions : []).filter((item) => toNumber(item.revenue) > 0)
	const total = list.reduce((sum, item) => sum + toNumber(item.revenue), 0)
	return {
		backgroundColor: p.bg,
		textColor: p.text,
		animation: true,
		animationDuration: 520,
		legend: { show: false },
		tooltip: { show: true, backgroundColor: p.tooltipBg, textColor: p.tooltipText },
		xAxis: { data: list.map((item) => String(item.name || '未知广告位')) },
		series: [{
			name: '广告位收益',
			type: 'pie',
			data: list.map((item) => roundMoney(item.revenue)),
			colors: CHART_PALETTE,
			pieStyle: 'ring',
			radius: '88%',
			innerRadius: '58%',
			borderColor: p.bg,
			borderWidth: 2,
			showLabel: false,
			centerText: '收益合计',
			centerValue: `¥${total.toFixed(2)}`,
			centerTextColor: p.text,
			centerValueColor: p.title,
			centerValueFontSize: 16
		}]
	}
}
