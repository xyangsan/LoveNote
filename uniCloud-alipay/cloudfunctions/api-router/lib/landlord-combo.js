'use strict'

const {
	rankOf,
	sortCards,
	countByRank,
	groupByRank,
	removeCards,
	isJoker,
	RANK_SMALL_JOKER,
	RANK_BIG_JOKER
} = require('./landlord-cards')

/** 牌型枚举 */
const COMBO = {
	SINGLE: 'single',
	PAIR: 'pair',
	TRIPLE: 'triple',
	TRIPLE_ONE: 'triple_one',
	TRIPLE_TWO: 'triple_two',
	STRAIGHT: 'straight',
	DOUBLE_STRAIGHT: 'double_straight',
	PLANE: 'plane',
	PLANE_ONE: 'plane_one',
	PLANE_TWO: 'plane_two',
	FOUR_TWO_SINGLE: 'four_two_single',
	FOUR_TWO_PAIR: 'four_two_pair',
	BOMB: 'bomb',
	ROCKET: 'rocket'
}

const COMBO_TEXT = {
	[COMBO.SINGLE]: '单张',
	[COMBO.PAIR]: '对子',
	[COMBO.TRIPLE]: '三张',
	[COMBO.TRIPLE_ONE]: '三带一',
	[COMBO.TRIPLE_TWO]: '三带二',
	[COMBO.STRAIGHT]: '顺子',
	[COMBO.DOUBLE_STRAIGHT]: '连对',
	[COMBO.PLANE]: '飞机',
	[COMBO.PLANE_ONE]: '飞机带单',
	[COMBO.PLANE_TWO]: '飞机带对',
	[COMBO.FOUR_TWO_SINGLE]: '四带二',
	[COMBO.FOUR_TWO_PAIR]: '四带两对',
	[COMBO.BOMB]: '炸弹',
	[COMBO.ROCKET]: '王炸'
}

/** 顺子/连对/飞机主体的最大允许点数（A=14，不含 2 与王） */
const MAX_SEQUENCE_RANK = 14
const MIN_SEQUENCE_RANK = 3
const STRAIGHT_MIN_LENGTH = 5
const DOUBLE_STRAIGHT_MIN_PAIRS = 3
const PLANE_MIN_LENGTH = 2

function isConsecutive(sortedRanks = []) {
	if (!sortedRanks.length) {
		return false
	}
	for (let index = 1; index < sortedRanks.length; index += 1) {
		if (sortedRanks[index] !== sortedRanks[index - 1] + 1) {
			return false
		}
	}
	return true
}

function buildCombo(type, mainRank, count, wings) {
	return {
		type,
		mainRank: Number(mainRank) || 0,
		count: Number(count) || 0,
		wings: Number(wings) || 0,
		text: COMBO_TEXT[type] || type
	}
}

function findConsecutiveRun(ranks = [], length = 0) {
	if (length <= 0) {
		return null
	}
	const sorted = ranks.slice().sort((left, right) => left - right)
	for (let index = 0; index + length <= sorted.length; index += 1) {
		const window = sorted.slice(index, index + length)
		if (isConsecutive(window)) {
			return window
		}
	}
	return null
}

/* ------------------------------------------------------------------ *
 * 牌型识别
 * ------------------------------------------------------------------ */

function analyze(cardIds = []) {
	if (!Array.isArray(cardIds) || !cardIds.length) {
		return null
	}
	const cards = sortCards(cardIds)
	const total = cards.length
	const counts = countByRank(cards)
	const ranks = Array.from(counts.keys()).sort((left, right) => left - right)
	const groups = ranks.map((rank) => ({ rank, count: counts.get(rank) }))

	// 王炸
	if (total === 2 && cards.every(isJoker) && rankOf(cards[0]) !== rankOf(cards[1])) {
		return buildCombo(COMBO.ROCKET, RANK_BIG_JOKER, 2, 0)
	}
	// 炸弹
	if (total === 4 && groups.length === 1 && groups[0].count === 4) {
		return buildCombo(COMBO.BOMB, groups[0].rank, 4, 0)
	}
	// 单 / 对 / 三张
	if (total === 1) {
		return buildCombo(COMBO.SINGLE, rankOf(cards[0]), 1, 0)
	}
	if (total === 2 && groups.length === 1) {
		return buildCombo(COMBO.PAIR, groups[0].rank, 2, 0)
	}
	if (total === 3 && groups.length === 1) {
		return buildCombo(COMBO.TRIPLE, groups[0].rank, 3, 0)
	}

	const countMap = {}
	groups.forEach((group) => {
		if (!countMap[group.count]) {
			countMap[group.count] = []
		}
		countMap[group.count].push(group.rank)
	})

	// 三带一 / 三带二
	if (total === 4 && countMap[3] && countMap[3].length === 1 && countMap[1] && countMap[1].length === 1) {
		return buildCombo(COMBO.TRIPLE_ONE, countMap[3][0], 4, 1)
	}
	if (total === 5 && countMap[3] && countMap[3].length === 1 && countMap[2] && countMap[2].length === 1) {
		return buildCombo(COMBO.TRIPLE_TWO, countMap[3][0], 5, 1)
	}

	// 顺子：全部单张、连续、≥5 张、不含 2 与王
	if (
		total >= STRAIGHT_MIN_LENGTH
		&& groups.every((group) => group.count === 1)
		&& isConsecutive(ranks)
		&& ranks[ranks.length - 1] <= MAX_SEQUENCE_RANK
		&& ranks[0] >= MIN_SEQUENCE_RANK
	) {
		return buildCombo(COMBO.STRAIGHT, ranks[ranks.length - 1], total, 0)
	}

	// 连对：全部对子、连续、≥3 对
	if (
		total >= DOUBLE_STRAIGHT_MIN_PAIRS * 2
		&& total % 2 === 0
		&& groups.every((group) => group.count === 2)
		&& isConsecutive(ranks)
		&& ranks[ranks.length - 1] <= MAX_SEQUENCE_RANK
		&& ranks[0] >= MIN_SEQUENCE_RANK
	) {
		return buildCombo(COMBO.DOUBLE_STRAIGHT, ranks[ranks.length - 1], total, 0)
	}

	// 飞机（纯三张、连续）
	if (
		total >= PLANE_MIN_LENGTH * 3
		&& total % 3 === 0
		&& groups.every((group) => group.count === 3)
		&& isConsecutive(ranks)
		&& ranks[ranks.length - 1] <= MAX_SEQUENCE_RANK
		&& ranks[0] >= MIN_SEQUENCE_RANK
	) {
		return buildCombo(COMBO.PLANE, ranks[ranks.length - 1], total, 0)
	}

	// 飞机带翅膀：主体为连续三张（不含 2 与王）
	const tripleRanks = (countMap[3] || [])
		.filter((rank) => rank <= MAX_SEQUENCE_RANK && rank >= MIN_SEQUENCE_RANK)

	if (tripleRanks.length >= PLANE_MIN_LENGTH) {
		// 飞机带单：3k + k = 4k（翅膀 k 张单牌）
		if (total % 4 === 0) {
			const bodyLength = total / 4
			if (bodyLength >= PLANE_MIN_LENGTH) {
				const body = findConsecutiveRun(tripleRanks, bodyLength)
				if (body) {
					const bodyCards = body.flatMap((rank) => groupCardsByRank(cards, rank).slice(0, 3))
					const rest = removeCards(cards, bodyCards).rest
					const restRanks = Array.from(countByRank(rest).keys())
					const isRocketWing = rest.length === 2
						&& restRanks.includes(RANK_SMALL_JOKER)
						&& restRanks.includes(RANK_BIG_JOKER)
					if (rest.length === bodyLength && !isRocketWing) {
						return buildCombo(COMBO.PLANE_ONE, body[body.length - 1], total, bodyLength)
					}
				}
			}
		}
		// 飞机带对：3k + 2k = 5k（翅膀 k 个对子）
		if (total % 5 === 0) {
			const bodyLength = total / 5
			if (bodyLength >= PLANE_MIN_LENGTH) {
				const body = findConsecutiveRun(tripleRanks, bodyLength)
				if (body) {
					const bodyCards = body.flatMap((rank) => groupCardsByRank(cards, rank).slice(0, 3))
					const rest = removeCards(cards, bodyCards).rest
					const restGroups = groupByRank(rest)
					const restRanks = Object.keys(restGroups).map(Number)
					if (
						rest.length === bodyLength * 2
						&& restRanks.length === bodyLength
						&& restRanks.every((rank) => restGroups[rank].length === 2)
					) {
						return buildCombo(COMBO.PLANE_TWO, body[body.length - 1], total, bodyLength * 2)
					}
				}
			}
		}
	}

	// 四带二 / 四带两对
	const quadRanks = countMap[4] || []
	if (quadRanks.length === 1) {
		const quadRank = quadRanks[0]
		const restGroupsList = groups.filter((group) => group.rank !== quadRank)
		const restTotal = restGroupsList.reduce((sum, group) => sum + group.count, 0)
		if (total === 6 && restTotal === 2) {
			return buildCombo(COMBO.FOUR_TWO_SINGLE, quadRank, 6, 2)
		}
		if (total === 8 && restGroupsList.length === 2 && restGroupsList.every((group) => group.count === 2)) {
			return buildCombo(COMBO.FOUR_TWO_PAIR, quadRank, 8, 2)
		}
	}

	return null
}

function groupCardsByRank(cards = [], targetRank = 0) {
	return cards.filter((cardId) => rankOf(cardId) === Number(targetRank))
}

/* ------------------------------------------------------------------ *
 * 大小比较
 * ------------------------------------------------------------------ */

const SEQUENCE_TYPES = new Set([
	COMBO.STRAIGHT,
	COMBO.DOUBLE_STRAIGHT,
	COMBO.PLANE,
	COMBO.PLANE_ONE,
	COMBO.PLANE_TWO
])

/**
 * 兼容两种形状的目标牌型：
 *  - 标准 combo：{ type, mainRank, count }
 *  - 房间 state.last_play：{ combo_type, main_rank, card_count }
 * 统一成标准形态，避免调用方漏转换导致「跟牌被当成先手」。
 */
function normalizeCombo(target = null) {
	if (!target) {
		return null
	}
	if (target.type) {
		return {
			type: target.type,
			mainRank: Number(target.mainRank || 0),
			count: Number(target.count || 0)
		}
	}
	if (target.combo_type) {
		return {
			type: target.combo_type,
			mainRank: Number(target.main_rank || 0),
			count: Number(target.card_count || 0)
		}
	}
	return null
}

function canBeat(candidate = null, target = null) {
	if (!candidate) {
		return false
	}
	if (!target) {
		return true
	}
	if (candidate.type === COMBO.ROCKET) {
		return true
	}
	if (target.type === COMBO.ROCKET) {
		return false
	}
	if (candidate.type === COMBO.BOMB) {
		if (target.type === COMBO.BOMB) {
			return candidate.mainRank > target.mainRank
		}
		return true
	}
	if (target.type === COMBO.BOMB) {
		return false
	}
	if (candidate.type !== target.type) {
		return false
	}
	// 顺子/连对/飞机必须长度一致
	if (SEQUENCE_TYPES.has(candidate.type) && candidate.count !== target.count) {
		return false
	}
	return candidate.mainRank > target.mainRank
}

/** 排序用：>0 表示 left 更大 */
function compare(left = null, right = null) {
	if (!left && !right) {
		return 0
	}
	if (!left) {
		return -1
	}
	if (!right) {
		return 1
	}
	if (left.type === right.type && left.count === right.count) {
		return left.mainRank === right.mainRank ? 0 : (left.mainRank > right.mainRank ? 1 : -1)
	}
	if (canBeat(left, right)) {
		return 1
	}
	if (canBeat(right, left)) {
		return -1
	}
	return 0
}

/* ------------------------------------------------------------------ *
 * 候选出牌生成
 * ------------------------------------------------------------------ */

const LEAD_PLANS = [
	{ type: COMBO.SINGLE, counts: [1] },
	{ type: COMBO.PAIR, counts: [2] },
	{ type: COMBO.TRIPLE, counts: [3] },
	{ type: COMBO.TRIPLE_ONE, counts: [4] },
	{ type: COMBO.TRIPLE_TWO, counts: [5] },
	{ type: COMBO.STRAIGHT, counts: [5, 6, 7, 8, 9, 10, 11, 12] },
	{ type: COMBO.DOUBLE_STRAIGHT, counts: [6, 8, 10, 12] },
	{ type: COMBO.PLANE, counts: [6, 9, 12] },
	{ type: COMBO.PLANE_ONE, counts: [8, 12] },
	{ type: COMBO.PLANE_TWO, counts: [10, 15] },
	{ type: COMBO.FOUR_TWO_SINGLE, counts: [6] },
	{ type: COMBO.FOUR_TWO_PAIR, counts: [8] },
	{ type: COMBO.BOMB, counts: [4] },
	{ type: COMBO.ROCKET, counts: [2] }
]

/** 从剩余牌里挑最小的单张翅膀：优先孤张，不拆炸弹 */
function pickWingSingles(remaining = [], count = 0) {
	if (count <= 0) {
		return []
	}
	const groups = groupByRank(remaining)
	const pool = []
	Object.keys(groups).map(Number).forEach((rank) => {
		const cards = groups[rank]
		if (cards.length === 4) {
			return
		}
		cards.forEach((cardId) => {
			pool.push({
				cardId,
				rank,
				count: cards.length
			})
		})
	})
	pool.sort((left, right) => {
		const priority = (item) => (item.count === 1 ? 0 : (item.count === 3 ? 2 : 1))
		return priority(left) - priority(right) || left.rank - right.rank
	})
	if (pool.length < count) {
		return null
	}
	return pool.slice(0, count).map((item) => item.cardId)
}

/** 从剩余牌里挑最小的对子翅膀：优先完整对子，不拆炸弹 */
function pickWingPairs(remaining = [], pairCount = 0) {
	if (pairCount <= 0) {
		return []
	}
	const groups = groupByRank(remaining)
	const candidates = Object.keys(groups)
		.map(Number)
		.filter((rank) => groups[rank].length >= 2 && groups[rank].length !== 4)
		.sort((left, right) => {
			const priority = (rank) => (groups[rank].length === 2 ? 0 : 1)
			return priority(left) - priority(right) || left - right
		})

	if (candidates.length < pairCount) {
		return null
	}
	return candidates.slice(0, pairCount).flatMap((rank) => groups[rank].slice(0, 2))
}

/** 生成指定牌型的全部候选（mainRank 必须大于 minMainRank） */
function generatePlaysOfType(hand = [], type = '', totalCount = 0, minMainRank = -1) {
	const groups = groupByRank(hand)
	const ranks = Object.keys(groups).map(Number).sort((left, right) => left - right)
	const results = []

	const ranksWith = (minCount) => ranks.filter((rank) => groups[rank].length >= minCount)

	const pushIf = (cards) => {
		if (!cards || !cards.length) {
			return
		}
		const analysis = analyze(cards)
		if (!analysis) {
			return
		}
		if (analysis.type !== type) {
			return
		}
		if (analysis.count !== totalCount) {
			return
		}
		if (analysis.mainRank <= minMainRank) {
			return
		}
		results.push(cards)
	}

	switch (type) {
	case COMBO.SINGLE:
		ranksWith(1).forEach((rank) => pushIf([groups[rank][0]]))
		break
	case COMBO.PAIR:
		ranksWith(2).forEach((rank) => pushIf(groups[rank].slice(0, 2)))
		break
	case COMBO.TRIPLE:
		ranksWith(3).forEach((rank) => pushIf(groups[rank].slice(0, 3)))
		break
	case COMBO.TRIPLE_ONE:
		ranksWith(3).forEach((rank) => {
			const body = groups[rank].slice(0, 3)
			const wings = pickWingSingles(removeCards(hand, body).rest, 1)
			if (wings) {
				pushIf(body.concat(wings))
			}
		})
		break
	case COMBO.TRIPLE_TWO:
		ranksWith(3).forEach((rank) => {
			const body = groups[rank].slice(0, 3)
			const wings = pickWingPairs(removeCards(hand, body).rest, 1)
			if (wings) {
				pushIf(body.concat(wings))
			}
		})
		break
	case COMBO.STRAIGHT: {
		const usable = ranks.filter((rank) => rank <= MAX_SEQUENCE_RANK && rank >= MIN_SEQUENCE_RANK)
		for (let index = 0; index + totalCount <= usable.length; index += 1) {
			const window = usable.slice(index, index + totalCount)
			if (isConsecutive(window)) {
				pushIf(window.map((rank) => groups[rank][0]))
			}
		}
		break
	}
	case COMBO.DOUBLE_STRAIGHT: {
		if (totalCount % 2 !== 0) {
			break
		}
		const pairCount = totalCount / 2
		const usable = ranks.filter(
			(rank) => rank <= MAX_SEQUENCE_RANK && rank >= MIN_SEQUENCE_RANK && groups[rank].length >= 2
		)
		for (let index = 0; index + pairCount <= usable.length; index += 1) {
			const window = usable.slice(index, index + pairCount)
			if (isConsecutive(window)) {
				pushIf(window.flatMap((rank) => groups[rank].slice(0, 2)))
			}
		}
		break
	}
	case COMBO.PLANE:
	case COMBO.PLANE_ONE:
	case COMBO.PLANE_TWO: {
		const divisor = type === COMBO.PLANE ? 3 : (type === COMBO.PLANE_ONE ? 4 : 5)
		if (totalCount % divisor !== 0) {
			break
		}
		const bodyLength = totalCount / divisor
		if (bodyLength < PLANE_MIN_LENGTH) {
			break
		}
		const usable = ranks.filter(
			(rank) => rank <= MAX_SEQUENCE_RANK && rank >= MIN_SEQUENCE_RANK && groups[rank].length >= 3
		)
		for (let index = 0; index + bodyLength <= usable.length; index += 1) {
			const window = usable.slice(index, index + bodyLength)
			if (!isConsecutive(window)) {
				continue
			}
			const body = window.flatMap((rank) => groups[rank].slice(0, 3))
			if (type === COMBO.PLANE) {
				pushIf(body)
				continue
			}
			const rest = removeCards(hand, body).rest
			if (type === COMBO.PLANE_ONE) {
				const wings = pickWingSingles(rest, bodyLength)
				if (wings) {
					pushIf(body.concat(wings))
				}
			} else {
				const wings = pickWingPairs(rest, bodyLength)
				if (wings) {
					pushIf(body.concat(wings))
				}
			}
		}
		break
	}
	case COMBO.FOUR_TWO_SINGLE:
		ranks.filter((rank) => groups[rank].length === 4).forEach((rank) => {
			const quad = groups[rank].slice(0, 4)
			const wings = pickWingSingles(removeCards(hand, quad).rest, 2)
			if (wings) {
				pushIf(quad.concat(wings))
			}
		})
		break
	case COMBO.FOUR_TWO_PAIR:
		ranks.filter((rank) => groups[rank].length === 4).forEach((rank) => {
			const quad = groups[rank].slice(0, 4)
			const wings = pickWingPairs(removeCards(hand, quad).rest, 2)
			if (wings) {
				pushIf(quad.concat(wings))
			}
		})
		break
	case COMBO.BOMB:
		ranks.filter((rank) => groups[rank].length === 4).forEach((rank) => {
			pushIf(groups[rank].slice(0, 4))
		})
		break
	case COMBO.ROCKET:
		if (groups[RANK_SMALL_JOKER] && groups[RANK_BIG_JOKER]) {
			pushIf([groups[RANK_SMALL_JOKER][0], groups[RANK_BIG_JOKER][0]])
		}
		break
	default:
		break
	}

	return results
}

/** 出牌代价：拆炸弹 / 拆对子 / 牌点 / 是否动用炸弹 */
function computeCost(hand = [], cards = []) {
	const analysis = analyze(cards)
	if (!analysis) {
		return Number.MAX_SAFE_INTEGER
	}
	const removed = removeCards(hand, cards)
	if (!removed.ok) {
		return Number.MAX_SAFE_INTEGER
	}

	const beforeGroups = groupByRank(hand)
	const afterGroups = groupByRank(removed.rest)
	let bombBreak = 0
	let pairBreak = 0

	Object.keys(beforeGroups).map(Number).forEach((rank) => {
		const before = beforeGroups[rank].length
		const after = afterGroups[rank] ? afterGroups[rank].length : 0
		if (before === 4 && after > 0 && after < 4) {
			bombBreak += 1
		}
		if (before === 2 && after === 1) {
			pairBreak += 1
		}
	})

	const isBombLike = analysis.type === COMBO.BOMB || analysis.type === COMBO.ROCKET
	return (isBombLike ? 1000 : 0) + bombBreak * 100 + pairBreak * 10 + analysis.mainRank
}

function dedupeComboList(list = []) {
	const seen = new Set()
	const result = []
	list.forEach((cards) => {
		const key = sortCards(cards).join(',')
		if (seen.has(key)) {
			return
		}
		seen.add(key)
		result.push(cards)
	})
	return result
}

function sortByCost(hand = [], list = []) {
	return dedupeComboList(list)
		.map((cards) => ({
			cards,
			cost: computeCost(hand, cards)
		}))
		.sort((left, right) => left.cost - right.cost)
		.map((item) => item.cards)
}

/** 跟牌提示：按「代价最小」升序返回所有可压候选 */
function findHints(hand = [], target = null) {
	const targetCombo = normalizeCombo(target)
	if (!targetCombo) {
		return findLeadHints(hand)
	}

	const candidates = [
		...generatePlaysOfType(hand, targetCombo.type, targetCombo.count, targetCombo.mainRank)
	]

	// 炸弹与王炸永远是候选（目标本身就是更大的王炸时除外）
	if (targetCombo.type !== COMBO.ROCKET) {
		const bombMin = targetCombo.type === COMBO.BOMB ? targetCombo.mainRank : -1
		candidates.push(...generatePlaysOfType(hand, COMBO.BOMB, 4, bombMin))
		candidates.push(...generatePlaysOfType(hand, COMBO.ROCKET, 2, -1))
	}

	return sortByCost(hand, candidates).filter((cards) => canBeat(analyze(cards), targetCombo))
}

/** 先手提示：给出一批合理出牌，按代价升序 */
function findLeadHints(hand = []) {
	const candidates = []
	LEAD_PLANS.forEach((plan) => {
		plan.counts.forEach((count) => {
			candidates.push(...generatePlaysOfType(hand, plan.type, count, -1))
		})
	})
	return sortByCost(hand, candidates)
}

function findMinBeat(hand = [], target = null) {
	const hints = findHints(hand, target)
	return hints.length ? hints[0] : null
}

/** 一手能否一次性走完 */
function canFinishInOneMove(hand = []) {
	if (!hand.length) {
		return null
	}
	return analyze(hand) ? sortCards(hand) : null
}

module.exports = {
	COMBO,
	COMBO_TEXT,
	MAX_SEQUENCE_RANK,
	MIN_SEQUENCE_RANK,
	isConsecutive,
	analyze,
	normalizeCombo,
	canBeat,
	compare,
	findConsecutiveRun,
	findHints,
	findLeadHints,
	findMinBeat,
	generatePlaysOfType,
	computeCost,
	pickWingSingles,
	pickWingPairs,
	canFinishInOneMove,
	dedupeComboList,
	sortByCost
}
