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
	normalizeCombo,
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
/**
 * 队友出牌时「接管牌权」的门槛：自己手牌 ≤ 这个张数才考虑压队友。
 * ⚠️ 别调太松 —— 中局频繁压队友会把队友的牌拆掉，两个农民互相消耗。
 */
const TAKEOVER_HAND_LIMIT = 4
/** 队友只剩这么多张时绝不压（让他走完） */
const TAKEOVER_TEAMMATE_MIN_CARDS = 3

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
	return Math.min(...opponents.map((seat) => getSeatCardsLeft(cardsLeft, seat)))
}

/** 读某座位剩余手牌数；未知（老数据 / 字段缺失）当作「还有很多牌」 */
function getSeatCardsLeft(cardsLeft = {}, seatIndex = -1) {
	const value = cardsLeft[seatIndex]
	return value === undefined || value === null ? 99 : Number(value)
}

/**
 * 队友刚出牌时，我到底该不该压？
 *
 * 默认**不压** —— 让队友用较小的牌拿住牌权，把出牌压力丢给地主，这是斗地主的标准配合。
 * 但一味不压会走到另一个极端：两个机器人当农民时，坐在**队友下家**的那台
 * 整局一张牌都出不去（实测 96 局人类当地主的对局：有 25 局它 0 张、平均只出 5.5 张，
 * 而紧邻地主的那台平均 15 张），观感就是「只有一个机器人在出牌」。
 * 所以补了下面几条规则：
 *   1) 队友快走完了（≤ 2 张）→ **仍然不压**，让他收尾（别去抢队友的胜利）；
 *   2) 压上去这把就赢（一手走完全部手牌）→ 必须压；
 *   3) 我也快走完了（≤ TAKEOVER_HAND_LIMIT 张）且牌比队友少 → 抢牌权自己收尾。
 */
function shouldTakeOverFromTeammate({
	hand = [],
	lastPlay = null,
	cardsLeft = {},
	lastSeat = -1
} = {}) {
	if (!hand.length || !lastPlay) {
		return false
	}
	const teammateCards = getSeatCardsLeft(cardsLeft, lastSeat)
	if (teammateCards <= TAKEOVER_TEAMMATE_MIN_CARDS - 1) {
		return false
	}
	const finish = canFinishInOneMove(hand)
	if (finish && canBeat(analyze(finish), normalizeCombo(lastPlay))) {
		return true
	}
	const myCards = hand.length
	if (myCards <= TAKEOVER_HAND_LIMIT && myCards < teammateCards) {
		return true
	}
	return false
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
		// ⚠️ 必须先把 last_play 归一化：房间里的 `state.last_play` 是
		//    { combo_type, main_rank, card_count }，而 canBeat 读的是 { type, mainRank, count }。
		//    直接传原始对象 → target.type 为 undefined → 牌型恒不相等 → canBeat 永远 false，
		//    结果「能一把走完」这个分支从来没生效过（机器人手里只剩一手牌也继续过牌）。
		if (!lastPlay || canBeat(finishCombo, normalizeCombo(lastPlay))) {
			return { type: 'play', cardIds: finish }
		}
	}

	// 先手
	const lastSeat = getLastSeat(lastPlay)
	if (lastSeat < 0 || lastSeat === Number(mySeat)) {
		const lead = chooseLead(hand, { cardsLeft, mySeat, landlordSeat })
		return lead ? { type: 'play', cardIds: lead } : { type: 'pass' }
	}

	// 队友出的牌默认不压（少数「必须接管」的例外见 shouldTakeOverFromTeammate）
	if (isTeammate(mySeat, lastSeat, landlordSeat)) {
		if (!shouldTakeOverFromTeammate({ hand, lastPlay, cardsLeft, lastSeat })) {
			return { type: 'pass' }
		}
		const takeOver = findHints(hand, lastPlay)
		return takeOver.length ? { type: 'play', cardIds: takeOver[0] } : { type: 'pass' }
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
	TAKEOVER_HAND_LIMIT,
	TAKEOVER_TEAMMATE_MIN_CARDS,
	evaluateHand,
	getLongestRun,
	chooseBid,
	getLastSeat,
	getSeatCardsLeft,
	isTeammate,
	getOpponentSeats,
	getMinOpponentCards,
	isBombLike,
	shouldBomb,
	shouldTakeOverFromTeammate,
	chooseLead,
	choosePlay
}
