/**
 * 扑克牌展示工具（纯前端）
 * 服务端只下发 cardId 字符串（形如 'H13'），这里负责转成牌面所需的一切信息。
 *
 * cardId 编码：<suit><rank>
 *   suit ∈ { S 黑桃, H 红桃, D 方块, C 梅花, J 王 }
 *   rank ∈ 3..15（J=11 Q=12 K=13 A=14 2=15），小王=16、大王=17
 *
 * 花色用 Unicode 文本符号而非 emoji，保证各端渲染一致且可随主题变色；
 * 项目无任何游戏图片资源，全部矢量绘制，避免小程序包体膨胀。
 */

const SUIT_SYMBOL = {
	S: '♠',
	H: '♥',
	D: '♦',
	C: '♣',
	J: '★'
}

const SUIT_NAME = {
	S: '黑桃',
	H: '红桃',
	D: '方块',
	C: '梅花',
	J: '王'
}

const RANK_LABEL = {
	11: 'J',
	12: 'Q',
	13: 'K',
	14: 'A',
	15: '2',
	16: '小',
	17: '大'
}

const RED_SUITS = new Set(['H', 'D'])

/** 主题色：红桃/方块偏暖红，黑桃/梅花用深棕黑呼应 #5a3427 */
export const CARD_COLORS = {
	red: '#d9534f',
	black: '#3a2c27'
}

export function parseCard(cardId = '') {
	const id = String(cardId || '')
	const suit = id.charAt(0)
	const rank = parseInt(id.slice(1), 10) || 0
	const isJoker = suit === 'J'
	const isBigJoker = isJoker && rank === 17
	const isSmallJoker = isJoker && rank === 16
	const label = isJoker
		? (isBigJoker ? '大' : '小')
		: (RANK_LABEL[rank] || String(rank))
	const symbol = SUIT_SYMBOL[suit] || ''
	const isRed = RED_SUITS.has(suit) || isBigJoker

	return {
		cardId: id,
		suit,
		rank,
		isJoker,
		isBigJoker,
		isSmallJoker,
		label,
		symbol,
		suitName: SUIT_NAME[suit] || '',
		colorKey: isRed ? 'red' : 'black',
		color: isRed ? CARD_COLORS.red : CARD_COLORS.black,
		fullName: isJoker ? `${label}王` : `${SUIT_NAME[suit] || ''}${label}`,
		faceText: isJoker ? '王' : label
	}
}

export function rankLabelOf(rank = 0) {
	const value = Number(rank)
	if (value === 16) {
		return '小王'
	}
	if (value === 17) {
		return '大王'
	}
	return RANK_LABEL[value] || String(value)
}

export function isRedCard(cardId = '') {
	return parseCard(cardId).colorKey === 'red'
}

/** 升序（默认）或降序排列，便于手牌展示 */
export function sortCardIds(cardIds = [], direction = 'asc') {
	const list = Array.isArray(cardIds) ? cardIds.slice() : []
	list.sort((left, right) => {
		const leftCard = parseCard(left)
		const rightCard = parseCard(right)
		if (leftCard.rank !== rightCard.rank) {
			return leftCard.rank - rightCard.rank
		}
		return leftCard.suit.localeCompare(rightCard.suit)
	})
	return direction === 'desc' ? list.reverse() : list
}

/** 按点数分组，用于手牌分行展示 */
export function groupCardsByRank(cardIds = []) {
	const map = new Map()
	sortCardIds(cardIds, 'asc').forEach((cardId) => {
		const card = parseCard(cardId)
		if (!map.has(card.rank)) {
			map.set(card.rank, [])
		}
		map.get(card.rank).push(cardId)
	})

	return Array.from(map.keys())
		.sort((left, right) => left - right)
		.map((rank) => ({
			rank,
			label: rankLabelOf(rank),
			cardIds: map.get(rank)
		}))
}

export function countByRank(cardIds = []) {
	const counts = {}
	;(Array.isArray(cardIds) ? cardIds : []).forEach((cardId) => {
		const rank = parseCard(cardId).rank
		counts[String(rank)] = (counts[String(rank)] || 0) + 1
	})
	return counts
}

/** 是否同一组牌（用于选中态比较与去重） */
export function isSameCardSet(left = [], right = []) {
	const a = sortCardIds(left, 'asc')
	const b = sortCardIds(right, 'asc')
	if (a.length !== b.length) {
		return false
	}
	return a.every((cardId, index) => cardId === b[index])
}

export function removeCardsFromHand(hand = [], cardIds = []) {
	const pool = Array.isArray(hand) ? hand.slice() : []
	const removing = Array.isArray(cardIds) ? cardIds : []
	removing.forEach((cardId) => {
		const position = pool.indexOf(cardId)
		if (position >= 0) {
			pool.splice(position, 1)
		}
	})
	return pool
}

export function formatCardsText(cardIds = []) {
	return sortCardIds(cardIds, 'desc')
		.map((cardId) => parseCard(cardId).fullName)
		.join(' ')
}

/** 手牌叠牌时的视觉参数：张数越多压得越紧，保证不超出屏宽 */
export function buildHandLayout(cardCount = 0, { cardWidth = 56, maxWidth = 0 } = {}) {
	const count = Math.max(0, Number(cardCount) || 0)
	if (!count) {
		return {
			overlap: 0,
			step: cardWidth
		}
	}
	const available = maxWidth > 0 ? maxWidth : cardWidth * 1.6
	const desiredStep = cardWidth * 0.42
	const step = count > 1
		? Math.max(cardWidth * 0.16, Math.min(desiredStep, (available - cardWidth) / (count - 1)))
		: 0
	return {
		overlap: cardWidth - step,
		step
	}
}

export const CARD_SUIT_SYMBOL = SUIT_SYMBOL
export const CARD_SUIT_NAME = SUIT_NAME
export const CARD_RANK_LABEL = RANK_LABEL

/** 牌型中文名（与服务端 landlord-combo.js 的 COMBO 保持一致，仅用于展示） */
export const COMBO_TEXT_FALLBACK = {
	single: '单张',
	pair: '对子',
	triple: '三张',
	triple_one: '三带一',
	triple_two: '三带二',
	straight: '顺子',
	double_straight: '连对',
	plane: '飞机',
	plane_one: '飞机带单',
	plane_two: '飞机带对',
	four_two_single: '四带二',
	four_two_pair: '四带两对',
	bomb: '炸弹',
	rocket: '王炸'
}
