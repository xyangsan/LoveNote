/**
 * 首页宫格（bento）方案选型器
 *
 * 选型规则：
 * 1. 0 张 → empty
 * 2. 1~7 张 → 在「块数 == 照片数」的方案里按权重随机（1 张 = 5×2 单块，2 张 = 3×2+2×2）
 * 3. ≥8 张 → 在 5×3 / 5×2+底行 两族里按权重随机（块数越多权重越大）
 *
 * 缓存：方案只在进入首页时分配一次，存在模块内存里（小程序冷启动自动清空，
 * App.vue onLaunch 也会显式 reset）。同一 photoTotal 反复进首页不会重抽；
 * 照片总数变化（新增/删除）才重新分配。
 */
import {
	PHOTO_GRID_LAYOUT,
	PHOTO_GRID_SCHEMES,
	PHOTO_GRID_WEIGHT,
	PHOTO_GRID_SCHEME_MAP
} from '@/common/constants/photo-grid-schemes.js'

/**
 * ≥8 张时参与随机的方案最少块数：8~11 张允许 4 块起，≥12 张要求 5 块起，
 * 避免几十张照片只铺三四格
 * @param {number} total
 * @return {number}
 */
function multiMinBlocks(total) {
	return total >= 12 ? 5 : 4
}

let session = null

/**
 * 清空本次运行的方案缓存（再次进入小程序时重新分配）
 */
export function resetPhotoGridSession() {
	session = null
}

/**
 * 单方案权重：块数越多权重越大，再用族系数微调
 * @param {Object} scheme
 * @return {number}
 */
export function computeSchemeWeight(scheme) {
	if (!scheme) return 0
	const factor = PHOTO_GRID_WEIGHT.familyFactor[scheme.family] || 1
	return Math.pow(scheme.blocks, PHOTO_GRID_WEIGHT.basePower) * factor
}

/**
 * 按权重随机取一个方案
 * @param {Array} list
 * @return {Object|null}
 */
function pickByWeight(list) {
	if (!list || !list.length) return null
	const weights = list.map(computeSchemeWeight)
	const sum = weights.reduce((acc, w) => acc + w, 0)
	if (sum <= 0) return list[Math.floor(Math.random() * list.length)]
	let rest = Math.random() * sum
	for (let i = 0; i < list.length; i++) {
		rest -= weights[i]
		if (rest <= 0) return list[i]
	}
	return list[list.length - 1]
}

/**
 * 按照片总数挑方案（纯函数，不读写缓存）
 * @param {number} photoTotal
 * @return {Object|null}
 */
export function pickPhotoGridScheme(photoTotal) {
	const total = Math.max(0, Math.floor(Number(photoTotal) || 0))
	const [exactMin, exactMax] = PHOTO_GRID_WEIGHT.exactRange

	// 1~7 张：精确匹配块数
	if (total >= exactMin && total <= exactMax) {
		const exact = PHOTO_GRID_SCHEMES.filter((item) => item.blocks === total)
		if (exact.length) return pickByWeight(exact)
	}

	// ≥8 张：大族里按权重随机（5×3 族系数更高，块数越多权重越大）
	if (total >= PHOTO_GRID_WEIGHT.multiThreshold) {
		const minBlocks = multiMinBlocks(total)
		const pool = PHOTO_GRID_SCHEMES.filter((item) =>
			PHOTO_GRID_WEIGHT.multiFamilies.indexOf(item.family) > -1 &&
			item.blocks >= minBlocks
		)
		if (pool.length) return pickByWeight(pool)
	}

	// 兜底：取块数最接近的方案（正常走不到）
	const fallback = PHOTO_GRID_SCHEMES.slice().sort((a, b) =>
		Math.abs(a.blocks - total) - Math.abs(b.blocks - total)
	)[0]
	return fallback || null
}

/**
 * 取本次运行的宫格会话（进入首页时调用，命中缓存直接返回）
 * @param {number} photoTotal 用户照片总数
 * @return {Object} 渲染所需的全部信息
 */
export function getPhotoGridSession(photoTotal) {
	const total = Math.max(0, Math.floor(Number(photoTotal) || 0))

	if (session && session.photoTotal === total) {
		return session
	}

	if (total <= 0) {
		session = { photoTotal: 0, mode: 'empty', scheme: null, schemeId: '', slots: 0, photoSlots: 0, overflow: false, extraCount: 0 }
		return session
	}

	const scheme = pickPhotoGridScheme(total)
	const slots = scheme ? scheme.blocks : 0
	// 最后一块在照片超量时改成「+N 全部」入口，所以可放照片的块数要减一
	const overflow = total > slots
	const photoSlots = overflow ? slots - 1 : slots

	session = {
		photoTotal: total,
		mode: 'grid',
		scheme,
		schemeId: scheme ? scheme.id : '',
		slots,
		photoSlots,
		overflow,
		extraCount: overflow ? total - photoSlots : 0
	}
	return session
}

/**
 * 当前缓存的会话（只读，用于调试）
 */
export function peekPhotoGridSession() {
	return session
}

/**
 * 把方案坐标换算成 rpx 绝对定位几何
 * @param {Object} scheme
 * @param {Object} layout 默认 PHOTO_GRID_LAYOUT
 * @return {Object} { width, height, cellSize, gap, cells }
 */
export function buildPhotoGridLayout(scheme, layout) {
	const geo = layout || PHOTO_GRID_LAYOUT
	if (!scheme || !scheme.placements) {
		return { width: geo.width, height: 0, cellSize: 0, gap: geo.gap, cells: [] }
	}
	const cell = (geo.width - (geo.cols - 1) * geo.gap) / geo.cols
	const cells = scheme.placements.map((p, index) => ({
		key: `${scheme.id}-${p.row}-${p.col}`,
		row: p.row,
		col: p.col,
		area: p.w * p.h,
		index,
		left: (p.col - 1) * (cell + geo.gap),
		top: (p.row - 1) * (cell + geo.gap),
		width: p.w * cell + (p.w - 1) * geo.gap,
		height: p.h * cell + (p.h - 1) * geo.gap
	}))

	// 照片按「块面积降序、行升序、列升序」依次落格：最大块给最新照片（左上角）
	const photoOrder = cells.slice().sort((a, b) =>
		b.area - a.area || a.row - b.row || a.col - b.col
	)

	return {
		width: geo.width,
		height: scheme.rows * cell + (scheme.rows - 1) * geo.gap,
		cellSize: cell,
		gap: geo.gap,
		cells,
		photoOrder
	}
}

/**
 * 方案 id → 方案对象
 */
export function getPhotoGridSchemeById(id) {
	return PHOTO_GRID_SCHEME_MAP[id] || null
}
