/**
 * 首页「时光胶片」宫格方案库（22 项 = 原 20 项 + 1 块 / 2 块的两个 5×2 补位方案）
 *
 * 来源：对 5×3 / 5×2+底行 / 5×2 三族做穷举铺排，按「左上大块优先、右下允许小块」排序后筛出 20 项。
 * 坐标：placements 里 w=宽(列数)、h=高(行数)、row=起始行(1 起)、col=起始列(1 起)。
 * 权重：weight = blocks^basePower × familyFactor，选型时由 photo-grid-selector 计算。
 */

/** 栅格几何：5 列、间距 12rpx、可用宽度 694rpx（750 版面去掉左右各 28rpx） */
export const PHOTO_GRID_LAYOUT = {
	cols: 5,
	gap: 12,
	width: 694
}

/** 权重与选型配置 */
export const PHOTO_GRID_WEIGHT = {
	basePower: 2,
	familyFactor: {
		'5x3': 1.25,
		'5x3d': 1.0,
		'5x2': 0.9
	},
	// 1~7 张：按块数精确匹配（1 张 = 5×2 单块，2 张 = 3×2+2×2）
	exactRange: [1, 7],
	// ≥8 张：在这些族里按权重随机
	multiThreshold: 8,
	multiFamilies: ['5x3', '5x3d']
}

export const PHOTO_GRID_FAMILY_LABEL = {
	'5x3': '5×3',
	'5x3d': '5×2+底行',
	'5x2': '5×2'
}

export const PHOTO_GRID_SCHEMES = [
	{ id: '5x3-01', family: '5x3', no: 1, rows: 3, blocks: 4, compo: '3×3+2×2+1×1+1×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 2, h: 2, row: 1, col: 4 },
			{ w: 1, h: 1, row: 3, col: 4 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3-02', family: '5x3', no: 2, rows: 3, blocks: 5, compo: '3×3+1×2+2×1+1×1+1×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 2, h: 1, row: 1, col: 4 },
			{ w: 1, h: 2, row: 2, col: 4 },
			{ w: 1, h: 1, row: 2, col: 5 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3-03', family: '5x3', no: 3, rows: 3, blocks: 5, compo: '3×3+2×1+2×1+1×1+1×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 2, h: 1, row: 1, col: 4 },
			{ w: 2, h: 1, row: 2, col: 4 },
			{ w: 1, h: 1, row: 3, col: 4 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3-04', family: '5x3', no: 4, rows: 3, blocks: 6, compo: '3×3+1×2+1×1+1×1+1×1+1×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 1, h: 2, row: 1, col: 4 },
			{ w: 1, h: 1, row: 1, col: 5 },
			{ w: 1, h: 1, row: 2, col: 5 },
			{ w: 1, h: 1, row: 3, col: 4 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3-05', family: '5x3', no: 5, rows: 3, blocks: 6, compo: '3×3+2×1+1×1+1×1+1×1+1×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 1, h: 1, row: 1, col: 4 },
			{ w: 1, h: 1, row: 1, col: 5 },
			{ w: 2, h: 1, row: 2, col: 4 },
			{ w: 1, h: 1, row: 3, col: 4 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3-06', family: '5x3', no: 6, rows: 3, blocks: 3, compo: '3×3+2×2+2×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 2, h: 2, row: 1, col: 4 },
			{ w: 2, h: 1, row: 3, col: 4 }
		] },

	{ id: '5x3-07', family: '5x3', no: 7, rows: 3, blocks: 4, compo: '3×3+1×2+1×2+2×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 1, h: 2, row: 1, col: 4 },
			{ w: 1, h: 2, row: 1, col: 5 },
			{ w: 2, h: 1, row: 3, col: 4 }
		] },

	{ id: '5x3-08', family: '5x3', no: 8, rows: 3, blocks: 4, compo: '3×3+2×1+2×1+2×1', bottom: '',
		placements: [
			{ w: 3, h: 3, row: 1, col: 1 },
			{ w: 2, h: 1, row: 1, col: 4 },
			{ w: 2, h: 1, row: 2, col: 4 },
			{ w: 2, h: 1, row: 3, col: 4 }
		] },

	{ id: '5x3-09', family: '5x3', no: 9, rows: 3, blocks: 5, compo: '4×2+1×2+2×1+2×1+1×1', bottom: '',
		placements: [
			{ w: 4, h: 2, row: 1, col: 1 },
			{ w: 1, h: 2, row: 1, col: 5 },
			{ w: 2, h: 1, row: 3, col: 1 },
			{ w: 2, h: 1, row: 3, col: 3 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3-10', family: '5x3', no: 10, rows: 3, blocks: 5, compo: '4×2+3×1+1×2+1×1+1×1', bottom: '',
		placements: [
			{ w: 4, h: 2, row: 1, col: 1 },
			{ w: 1, h: 2, row: 1, col: 5 },
			{ w: 3, h: 1, row: 3, col: 1 },
			{ w: 1, h: 1, row: 3, col: 4 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3d-02', family: '5x3d', no: 2, rows: 3, blocks: 5, compo: '3×2+2×2+2×1+2×1+1×1', bottom: '2×1+2×1+1×1',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 2, h: 2, row: 1, col: 4 },
			{ w: 2, h: 1, row: 3, col: 1 },
			{ w: 2, h: 1, row: 3, col: 3 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3d-03', family: '5x3d', no: 3, rows: 3, blocks: 6, compo: '3×2+1×2+1×2+2×1+2×1+1×1', bottom: '2×1+2×1+1×1',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 1, h: 2, row: 1, col: 4 },
			{ w: 1, h: 2, row: 1, col: 5 },
			{ w: 2, h: 1, row: 3, col: 1 },
			{ w: 2, h: 1, row: 3, col: 3 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3d-04', family: '5x3d', no: 4, rows: 3, blocks: 6, compo: '3×2+2×1+2×1+2×1+2×1+1×1', bottom: '2×1+2×1+1×1',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 2, h: 1, row: 1, col: 4 },
			{ w: 2, h: 1, row: 2, col: 4 },
			{ w: 2, h: 1, row: 3, col: 1 },
			{ w: 2, h: 1, row: 3, col: 3 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3d-05', family: '5x3d', no: 5, rows: 3, blocks: 6, compo: '3×2+2×2+2×1+1×1+1×1+1×1', bottom: '2×1+1×1+1×1+1×1',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 2, h: 2, row: 1, col: 4 },
			{ w: 2, h: 1, row: 3, col: 1 },
			{ w: 1, h: 1, row: 3, col: 3 },
			{ w: 1, h: 1, row: 3, col: 4 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3d-07', family: '5x3d', no: 7, rows: 3, blocks: 7, compo: '3×2+1×2+2×1+2×1+1×1+1×1+1×1', bottom: '2×1+2×1+1×1',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 1, h: 2, row: 1, col: 4 },
			{ w: 1, h: 1, row: 1, col: 5 },
			{ w: 1, h: 1, row: 2, col: 5 },
			{ w: 2, h: 1, row: 3, col: 1 },
			{ w: 2, h: 1, row: 3, col: 3 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x3d-08', family: '5x3d', no: 8, rows: 3, blocks: 7, compo: '3×2+2×1+2×1+2×1+1×1+1×1+1×1', bottom: '2×1+2×1+1×1',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 1, h: 1, row: 1, col: 4 },
			{ w: 1, h: 1, row: 1, col: 5 },
			{ w: 2, h: 1, row: 2, col: 4 },
			{ w: 2, h: 1, row: 3, col: 1 },
			{ w: 2, h: 1, row: 3, col: 3 },
			{ w: 1, h: 1, row: 3, col: 5 }
		] },

	{ id: '5x2-02', family: '5x2', no: 2, rows: 2, blocks: 4, compo: '3×2+2×1+1×1+1×1', bottom: '',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 2, h: 1, row: 1, col: 4 },
			{ w: 1, h: 1, row: 2, col: 4 },
			{ w: 1, h: 1, row: 2, col: 5 }
		] },

	{ id: '5x2-04', family: '5x2', no: 4, rows: 2, blocks: 3, compo: '3×2+2×1+2×1', bottom: '',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 2, h: 1, row: 1, col: 4 },
			{ w: 2, h: 1, row: 2, col: 4 }
		] },

	{ id: '5x2-05', family: '5x2', no: 5, rows: 2, blocks: 4, compo: '2×2+3×1+2×1+1×1', bottom: '',
		placements: [
			{ w: 2, h: 2, row: 1, col: 1 },
			{ w: 3, h: 1, row: 1, col: 3 },
			{ w: 2, h: 1, row: 2, col: 3 },
			{ w: 1, h: 1, row: 2, col: 5 }
		] },

	{ id: '5x2-07', family: '5x2', no: 7, rows: 2, blocks: 5, compo: '2×2+1×2+2×1+1×1+1×1', bottom: '',
		placements: [
			{ w: 2, h: 2, row: 1, col: 1 },
			{ w: 1, h: 2, row: 1, col: 3 },
			{ w: 2, h: 1, row: 1, col: 4 },
			{ w: 1, h: 1, row: 2, col: 4 },
			{ w: 1, h: 1, row: 2, col: 5 }
		] },

	// ↓ 后期补的两块「1 张 / 2 张」方案：照片极少时也走宫格，不再用单图卡
	{ id: '5x2-b1', family: '5x2', no: 11, rows: 2, blocks: 1, compo: '5×2', bottom: '',
		placements: [
			{ w: 5, h: 2, row: 1, col: 1 }
		] },

	{ id: '5x2-b2', family: '5x2', no: 12, rows: 2, blocks: 2, compo: '3×2+2×2', bottom: '',
		placements: [
			{ w: 3, h: 2, row: 1, col: 1 },
			{ w: 2, h: 2, row: 1, col: 4 }
		] }
]

/** 方案 id 查表 */
export const PHOTO_GRID_SCHEME_MAP = PHOTO_GRID_SCHEMES.reduce((acc, item) => {
	acc[item.id] = item
	return acc
}, {})
