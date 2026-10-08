/**
 * 自定义导航栏的安全区计算（竖屏 + 横屏）
 *
 * 背景：小程序把页面设成 `navigationStyle: "custom"` 后，页面从屏幕 y=0 开始绘制，
 * 于是同时踩两个坑：
 *   1. 顶部被状态栏（时间/电量）压住；
 *   2. 右上角被微信胶囊按钮盖住 —— 不仅看不见，而且是**点不到**（胶囊层级在页面之上）。
 *
 * 竖屏（getNavBarMetrics）：用胶囊的 top/height 反推内容区高度，让内容与胶囊垂直居中：
 *     contentHeight = (capsule.top - statusBarHeight) * 2 + capsule.height
 *     barHeight     = statusBarHeight + contentHeight
 *
 * 横屏（getLandscapeTopSafeArea）：**不要**再用 statusBarHeight —— iOS 横屏会隐藏状态栏，
 * 而 `systemInfo.statusBarHeight` 仍是竖屏时的值（如 44），硬套会凭空多出一条死区。
 * 横屏只需要避开右上角胶囊：横屏下胶囊仍在右上角、宽高与竖屏一致
 * （实测 iOS 87px / Android 95px，右边距 7~10px），只是 top 会被重算成 ≈22~24px。
 *
 * 平台差异：胶囊取自 `uni.getMenuButtonBoundingClientRect()`，**仅小程序可用**，其它端回退到常量。
 * 该接口在横屏 / iPad 分屏下可能返回竖屏口径的估算值，因此这里做了可信度校验，
 * 不可信时改用「宁可多让一点」的保底常量，避免算出几百 px 的荒谬留白或漏掉胶囊。
 */

const DEFAULT_CONTENT_HEIGHT = 44 // px，拿不到胶囊信息时的兜底内容区高度
const DEFAULT_GUTTER = 12 // px，非胶囊侧的常规内边距（≈24rpx）
const DEFAULT_LANDSCAPE_GUTTER = 16 // px，横屏顶栏的常规内边距（对齐各横屏页的 16px 设计值）
const CAPSULE_GAP = 8 // px，内容与胶囊之间的安全间距

// 实测胶囊最宽 Android 95px / iOS 87px，右边界距屏幕右边缘 7~10px
const CAPSULE_MAX_WIDTH = 95
const CAPSULE_MAX_RIGHT_MARGIN = 10
// 坐标不可信时的保底让位宽度：95 + 10 + 8
const CAPSULE_SAFE_INSET = CAPSULE_MAX_WIDTH + CAPSULE_MAX_RIGHT_MARGIN + CAPSULE_GAP
// 判定「窗口右边缘 - 胶囊右边界」是否合理的上限（正常 ≤10px；横屏拿到竖屏口径时会达到几百 px）
const CAPSULE_RIGHT_MARGIN_TOLERANCE = 40

function readSystemInfo() {
	try {
		return typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function'
			? (uni.getSystemInfoSync() || {})
			: {}
	} catch (error) {
		return {}
	}
}

function hasCapsuleApi() {
	return typeof uni !== 'undefined' && typeof uni.getMenuButtonBoundingClientRect === 'function'
}

/** 读取胶囊矩形；坐标不可信（或接口缺失）时返回 null */
function readCapsuleRect(windowWidth) {
	if (!hasCapsuleApi()) {
		return null
	}
	let raw = null
	try {
		raw = uni.getMenuButtonBoundingClientRect() || null
	} catch (error) {
		raw = null
	}
	if (!raw) {
		return null
	}
	const top = Number(raw.top) || 0
	const height = Number(raw.height) || 0
	const left = Number(raw.left) || 0
	const right = Number(raw.right) || 0
	if (!(height > 0) || !(right > left) || !(left > 0)) {
		return null
	}
	if (windowWidth > 0) {
		const rightMargin = windowWidth - right
		if (rightMargin < 0 || rightMargin > CAPSULE_RIGHT_MARGIN_TOLERANCE) {
			return null
		}
	}
	return { top, height, left, right }
}

/** 从屏幕右边缘到「胶囊左侧 + 安全间距」的距离 */
function measureCapsuleInset(windowWidth, rect) {
	if (!rect || !(windowWidth > 0)) {
		return 0
	}
	return Math.max(0, windowWidth - rect.left + CAPSULE_GAP)
}

/** 统一解析「右侧需要为胶囊让出多少」 */
function resolveCapsule(windowWidth) {
	const rect = readCapsuleRect(windowWidth)
	if (rect) {
		return { rect, inset: measureCapsuleInset(windowWidth, rect), trusted: true }
	}
	// 有胶囊接口却拿不到可信坐标 → 说明确实在小程序里，用保底常量，宁可多让一点也不能被盖住
	if (hasCapsuleApi()) {
		return { rect: null, inset: CAPSULE_SAFE_INSET, trusted: false }
	}
	return { rect: null, inset: 0, trusted: false }
}

/** 横向 safe-area（刘海在右侧时 > 0），用于避免与页面已有的 env(safe-area-inset-right) 重复留白 */
function readSafeAreaRight(systemInfo, windowWidth) {
	const area = systemInfo ? systemInfo.safeArea : null
	if (!area || !(windowWidth > 0)) {
		return 0
	}
	const right = Number(area.right)
	if (!(right > 0)) {
		return 0
	}
	return Math.max(0, windowWidth - right)
}

/**
 * 竖屏自定义导航栏的尺寸信息
 * @param {{ gutter?: number }} options gutter 非胶囊侧内边距（px），默认 12（≈24rpx）
 * @returns {{
 *   statusBarHeight: number, contentHeight: number, barHeight: number,
 *   leftInset: number, rightInset: number, capsuleRightInset: number,
 *   capsuleHeight: number, capsuleTrusted: boolean, windowWidth: number, hasCapsule: boolean
 * }}
 */
export function getNavBarMetrics(options = {}) {
	const gutter = Number(options.gutter) > 0 ? Number(options.gutter) : DEFAULT_GUTTER
	const systemInfo = readSystemInfo()
	const statusBarHeight = Math.max(0, Number(systemInfo.statusBarHeight) || 0)
	const windowWidth = Math.max(0, Number(systemInfo.windowWidth) || 0)

	let contentHeight = DEFAULT_CONTENT_HEIGHT
	let capsule = { inset: 0, rect: null, trusted: false }

	// #ifdef MP-WEIXIN
	capsule = resolveCapsule(windowWidth)
	// statusBarHeight 取不到（如系统信息接口异常）时不反推内容区高度，直接用兜底值，
	// 否则会拿胶囊的绝对 top 当间距算出偏大的结果
	if (capsule.rect && statusBarHeight > 0 && capsule.rect.top > statusBarHeight) {
		contentHeight = (capsule.rect.top - statusBarHeight) * 2 + capsule.rect.height
	}
	// #endif

	return {
		statusBarHeight,
		contentHeight,
		barHeight: statusBarHeight + contentHeight,
		leftInset: gutter,
		rightInset: Math.max(gutter, capsule.inset),
		capsuleRightInset: capsule.inset,
		capsuleHeight: capsule.rect ? capsule.rect.height : 0,
		capsuleTrusted: capsule.trusted,
		windowWidth,
		hasCapsule: capsule.inset > 0
	}
}

/**
 * 横屏页（`pageOrientation: landscape`）顶部安全区
 *
 * 只解决「右上角胶囊挡住」的问题；纵向不做处理（横屏 iOS 隐藏状态栏，
 * 各横屏页的顶部留白由自身 CSS 控制）。
 *
 * @param {{ min?: number }} options min 顶栏常规内边距（px），默认 16
 * @returns {{
 *   rightInset: number,        // 从屏幕右边缘算起需要让出的总宽度
 *   pageRightInset: number,    // 页面本身已让出的横向 safe-area
 *   extraRightPadding: number, // 顶栏元素还需要额外补的 padding-right
 *   capsuleInset: number, capsuleTrusted: boolean, hasCapsule: boolean
 * }}
 */
export function getLandscapeTopSafeArea(options = {}) {
	const min = Number(options.min) > 0 ? Number(options.min) : DEFAULT_LANDSCAPE_GUTTER
	const systemInfo = readSystemInfo()
	const windowWidth = Math.max(0, Number(systemInfo.windowWidth) || 0)

	const capsule = resolveCapsule(windowWidth)
	const pageRightInset = readSafeAreaRight(systemInfo, windowWidth)
	const rightInset = Math.max(min, capsule.inset)

	return {
		rightInset,
		pageRightInset,
		// 页面已经通过 env(safe-area-inset-right) 让出的部分不重复计算
		extraRightPadding: Math.max(min, rightInset - pageRightInset),
		capsuleInset: capsule.inset,
		capsuleTrusted: capsule.trusted,
		hasCapsule: capsule.inset > 0
	}
}

/**
 * 把 metrics 转成可直接绑到顶栏容器上的 style（**只给纵向尺寸**，单位 px）
 *
 * 刻意不输出左右内边距：左右是**不对称**的（右侧要给胶囊让位），
 * 如果把它做成容器 padding，容器内容区中心就会偏离屏幕中心，标题会明显偏左。
 * 正确做法是让顶栏容器通屏（页面有左右 padding 时用负 margin 抵消），
 * 再把 `leftInset` / `rightInset` 施加到两侧元素各自的 margin 上，
 * 标题层则用**左右对称**的定位撑满屏宽 → 标题始终相对屏幕居中。
 *
 * 容器需要 `box-sizing: border-box`，这样 height 才能包住 padding。
 * @param {object} metrics getNavBarMetrics() 的返回值
 * @param {{ topExtra?: number, bottomExtra?: number }} options
 */
export function buildNavBarStyle(metrics = {}, options = {}) {
	const topExtra = Number(options.topExtra) || 0
	const bottomExtra = Number(options.bottomExtra) || 0
	const statusBarHeight = Math.max(0, Number(metrics.statusBarHeight) || 0)
	const barHeight = Math.max(0, Number(metrics.barHeight) || 0) + topExtra + bottomExtra

	return {
		paddingTop: statusBarHeight + topExtra + 'px',
		paddingBottom: bottomExtra + 'px',
		height: barHeight + 'px'
	}
}

/** 左右两侧需要让出的宽度（px），给顶栏两端的按钮当 margin 用 */
export function buildNavBarEdgeInsets(metrics = {}) {
	return {
		left: Math.max(0, Number(metrics.leftInset) || 0),
		right: Math.max(0, Number(metrics.rightInset) || 0)
	}
}

/** 仅取高度（用于给下方内容留出等高的占位/内边距） */
export function getNavBarHeight(metrics = {}) {
	return Math.max(0, Number(metrics.barHeight) || 0)
}

/** 保底让位宽度（px），方便页面按需对齐或自测 */
export const CAPSULE_FALLBACK_INSET = CAPSULE_SAFE_INSET
