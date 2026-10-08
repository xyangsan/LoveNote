'use strict'

const {
	groupByRank,
	rankOf,
	isJoker
} = require('./landlord-cards')
const {
	COMBO,
	analyze,
	canBeat,
	canFinishInOneMove,
	findHints,
	findLeadHints
} = require('./landlord-combo')

/**
 * 斗地主 AI：机器人与「挂机托管」共用同一套决策。
 * 目标不是最强，而是「像人一样合理」：不拆炸弹、队友不压、对手快走完才动炸弹。
 */

const BID_THRESHOLD_3 = 30
const BID_THRESHOLD_2 = 22
const BID_THRESHOLD_1 = 15
const DANGER_CARDS_LEFT = 2

function isJokerPairLeader(groups = {}) {
	return Boolean(groups[16] && groups[17])
}

/** 最长单张连号长度（用于评估顺子潜力，不含 2 与王） */
function getLongestRun(hand = []) {
	const groups = groupByRank(hand)
	const ranks = Object.keys(groups)
		.map(Number)
		.filter((rank) => rank >= 3 && rank <= 14)
		.sort((left, right) => left - right)

	let longest = 0
	let current = 0
	let previous = 0
	ranks.forEach((rank) => {
		if (rank === previous + 1) {
			current += 1
		} else {
			current = 1
		}
		previous = rank
		longest = Math.max(longest, current)
	})
	return longest
}

/** 手牌强度评分：大小王、2、A、炸弹、顺子潜力 */
function evaluateHand(hand = []) {
	let score = 0
	const groups = groupByRank(hand)

	Object.keys(groups).map(Number).forEach((rank) => {
		const count = groups[rank].length
		if (rank === 17) {
			score += 9
		} else if (rank === 16) {
			score += 7
		} else if (rank === 15) {
			score += count * 4
		} else if (rank === 14) {
			score += count * 2
		}
		if (count === 4) {
			score += 11
		}
	})

	if (getLongestRun(hand) >= 5) {
		score += 6
	}
	// 手牌越少越强（残局加分）
	if (hand.length <= 8) {
		score += 8
	}

	return score
}

function chooseBid(hand = []) {
	const score = evaluateHand(hand)
	if (score >= BID_THRESHOLD_3) {
		return 3
	}
	if (score >= BID_THRESHOLD_2) {
		return 2
	}
	if (score >= BID_THRESHOLD_1) {
		return 1
	}
	return 0
}

/** 双农民互为队友（地主没有队友） */
function isTeammate(mySeat = -1, otherSeat = -1, landlordSeat = -1) {
	if (mySeat < 0 || otherSeat < 0 || otherSeat === mySeat) {
		return false
	}
	if (mySeat === Number(landlordSeat)) {
		return false
	}
	return Number(otherSeat) !== Number(landlordSeat)
}

function getOpponentSeats(mySeat = -1, landlordSeat = -1) {
	return [0, 1, 2].filter((seat) => seat !== Number(mySeat) && !isTeammate(mySeat, seat, landlordSeat))
}

function getMinOpponentCards(cardsLeft = {}, mySeat = -1, landlordSeat = -1) {
	const opponents = getOpponentSeats(mySeat, landlordSeat)
	if (!opponents.length) {
		return 99
	}
	return Math.min(...opponents.map((seat) => {
		const value = cardsLeft[seat]
		return value === undefined || value === null ? 99 : Number(value)
	}))
}

function isBombLike(comboInfo = null) {
	return Boolean(comboInfo && (comboInfo.type === COMBO.BOMB || comboInfo.type === COMBO.ROCKET))
}

/**
 * 兼容 last_play 的两种座位字段写法：
 *  - 标准：{ seatIndex }
 *  - 房间 state.last_play：{ seat_index }
 * 返回 -1 表示当前没有需要压的牌（即先手）。
 */
function getLastSeat(lastPlay = null) {
	if (!lastPlay) {
		return -1
	}
	const value = lastPlay.seatIndex !== undefined && lastPlay.seatIndex !== null
		? lastPlay.seatIndex
		: lastPlay.seat_index
	if (value === undefined || value === null) {
		return -1
	}
	return Number(value)
}

/** 炸弹是否值得动用 */
function shouldBomb({ cardsLeft = {}, mySeat = -1, landlordSeat = -1, remainingAfter = 0 }) {
	if (remainingAfter <= 0) {
		// 炸弹就是最后一手，直接打赢
		return true
	}
	return getMinOpponentCards(cardsLeft, mySeat, landlordSeat) <= DANGER_CARDS_LEFT
}

/** 先手选牌：避免先手丢炸弹，遇到对手只剩 1 张时优先出多张牌 */
function chooseLead(hand = [], { cardsLeft = {}, mySeat = -1, landlordSeat = -1 } = {}) {
	const hints = findLeadHints(hand)
	if (!hints.length) {
		return null
	}

	const safeHints = hints.filter((cards) => !isBombLike(analyze(cards)))
	const pool = safeHints.length ? safeHints : hints

	const opponentAtOne = getOpponentSeats(mySeat, landlordSeat)
		.filter((seat) => Number(cardsLeft[seat]) === 1)

	if (opponentAtOne.length) {
		// 对手只剩一张：优先出对子/多张，不给对手单张溜走的机会
		const multi = pool.find((cards) => analyze(cards).count >= 2)
		if (multi) {
			return multi
		}
	}

	return pool[0]
}

/**
 * 跟牌 / 先手的总决策入口
 * @returns {{ type:'play', cardIds:string[] } | { type:'pass' }}
 */
function choosePlay({
	hand = [],
	lastPlay = null,
	mySeat = -1,
	landlordSeat = -1,
	cardsLeft = {}
} = {}) {
	if (!hand.length) {
		return { type: 'pass' }
	}

	// 能一次性走完就直接走完
	const finish = canFinishInOneMove(hand)
	if (finish) {
		const finishCombo = analyze(finish)
		if (!lastPlay || canBeat(finishCombo, lastPlay)) {
			return { type: 'play', cardIds: finish }
		}
	}

	// 先手
	const lastSeat = getLastSeat(lastPlay)
	if (lastSeat < 0 || lastSeat === Number(mySeat)) {
		const lead = chooseLead(hand, { cardsLeft, mySeat, landlordSeat })
		return lead ? { type: 'play', cardIds: lead } : { type: 'pass' }
	}

	// 队友出的牌默认不压
	if (isTeammate(mySeat, lastSeat, landlordSeat)) {
		return { type: 'pass' }
	}

	const hints = findHints(hand, lastPlay)
	if (!hints.length) {
		return { type: 'pass' }
	}

	for (let index = 0; index < hints.length; index += 1) {
		const cards = hints[index]
		const comboInfo = analyze(cards)
		if (isBombLike(comboInfo)) {
			const remaining = hand.length - cards.length
			if (!shouldBomb({ cardsLeft, mySeat, landlordSeat, remainingAfter: remaining })) {
				continue
			}
		}
		return { type: 'play', cardIds: cards }
	}

	return { type: 'pass' }
}

module.exports = {
	BID_THRESHOLD_1,
	BID_THRESHOLD_2,
	BID_THRESHOLD_3,
	DANGER_CARDS_LEFT,
	evaluateHand,
	getLongestRun,
	chooseBid,
	getLastSeat,
	isTeammate,
	getOpponentSeats,
	getMinOpponentCards,
	isBombLike,
	shouldBomb,
	chooseLead,
	choosePlay
}
