'use strict'

/**
 * 斗地主牌组工具
 * cardId 编码：`<suit><rank>`
 *   suit ∈ { S 黑桃, H 红桃, D 方块, C 梅花, J 王 }
 *   rank ∈ 3..15（J=11 Q=12 K=13 A=14 2=15），小王=16、大王=17（suit 固定为 J）
 * 只传 cardId 字符串，客户端本地查表渲染，避免服务端下发对象数组。
 */

const SUITS = ['S', 'H', 'D', 'C']
const SUIT_JOKER = 'J'
const RANK_MIN = 3
const RANK_MAX = 15
const RANK_SMALL_JOKER = 16
const RANK_BIG_JOKER = 17
const CARDS_PER_PLAYER = 17
const BOTTOM_CARD_COUNT = 3
const DECK_SIZE = 54

const SUIT_ORDER = {
	J: 0,
	S: 1,
	H: 2,
	D: 3,
	C: 4
}

function buildCardId(suit, rank) {
	return `${suit}${rank}`
}

function buildDeck() {
	const deck = []
	SUITS.forEach((suit) => {
		for (let rank = RANK_MIN; rank <= RANK_MAX; rank += 1) {
			deck.push(buildCardId(suit, rank))
		}
	})
	deck.push(buildCardId(SUIT_JOKER, RANK_SMALL_JOKER))
	deck.push(buildCardId(SUIT_JOKER, RANK_BIG_JOKER))
	return deck
}

function rankOf(cardId = '') {
	const value = parseInt(String(cardId).slice(1), 10)
	return Number.isInteger(value) ? value : 0
}

function suitOf(cardId = '') {
	return String(cardId).charAt(0)
}

function isJoker(cardId = '') {
	return suitOf(cardId) === SUIT_JOKER
}

function isSmallJoker(cardId = '') {
	return isJoker(cardId) && rankOf(cardId) === RANK_SMALL_JOKER
}

function isBigJoker(cardId = '') {
	return isJoker(cardId) && rankOf(cardId) === RANK_BIG_JOKER
}

function isValidCard(cardId = '') {
	const suit = suitOf(cardId)
	const rank = rankOf(cardId)
	if (suit === SUIT_JOKER) {
		return rank === RANK_SMALL_JOKER || rank === RANK_BIG_JOKER
	}
	if (!SUITS.includes(suit)) {
		return false
	}
	return rank >= RANK_MIN && rank <= RANK_MAX
}

/** 升序：先比点数，再比花色（王排最后） */
function compareCard(left, right) {
	const leftRank = rankOf(left)
	const rightRank = rankOf(right)
	if (leftRank !== rightRank) {
		return leftRank - rightRank
	}
	return (SUIT_ORDER[suitOf(left)] || 0) - (SUIT_ORDER[suitOf(right)] || 0)
}

function sortCards(cardIds = []) {
	return cardIds.slice().sort(compareCard)
}

function shuffle(deck = []) {
	const list = deck.slice()
	for (let index = list.length - 1; index > 0; index -= 1) {
		const target = Math.floor(Math.random() * (index + 1))
		const temp = list[index]
		list[index] = list[target]
		list[target] = temp
	}
	return list
}

/** 发牌：3 家各 17 张 + 3 张底牌 */
function deal() {
	const deck = shuffle(buildDeck())
	const hands = [
		sortCards(deck.slice(0, CARDS_PER_PLAYER)),
		sortCards(deck.slice(CARDS_PER_PLAYER, CARDS_PER_PLAYER * 2)),
		sortCards(deck.slice(CARDS_PER_PLAYER * 2, CARDS_PER_PLAYER * 3))
	]
	const bottom = sortCards(deck.slice(CARDS_PER_PLAYER * 3))
	return { hands, bottom }
}

function countByRank(cardIds = []) {
	const map = new Map()
	cardIds.forEach((cardId) => {
		const rank = rankOf(cardId)
		map.set(rank, (map.get(rank) || 0) + 1)
	})
	return map
}

/** 按点数分组：{ rank: [cardId...] } */
function groupByRank(cardIds = []) {
	const groups = {}
	cardIds.forEach((cardId) => {
		const rank = rankOf(cardId)
		if (!groups[rank]) {
			groups[rank] = []
		}
		groups[rank].push(cardId)
	})
	Object.keys(groups).forEach((rank) => {
		groups[rank] = sortCards(groups[rank])
	})
	return groups
}

function hasAllCards(hand = [], cardIds = []) {
	const pool = hand.slice()
	for (let index = 0; index < cardIds.length; index += 1) {
		const position = pool.indexOf(cardIds[index])
		if (position < 0) {
			return false
		}
		pool.splice(position, 1)
	}
	return true
}

/** 从手牌移除指定牌，返回剩余手牌；不合法时 ok=false */
function removeCards(hand = [], cardIds = []) {
	const pool = hand.slice()
	for (let index = 0; index < cardIds.length; index += 1) {
		const position = pool.indexOf(cardIds[index])
		if (position < 0) {
			return {
				ok: false,
				rest: hand.slice()
			}
		}
		pool.splice(position, 1)
	}
	return {
		ok: true,
		rest: pool
	}
}

function sumCards(cardIdLists = []) {
	return cardIdLists.reduce((total, list) => total + (Array.isArray(list) ? list.length : 0), 0)
}

/** 剩余手牌的最小单张（先手兜底出牌用） */
function pickSmallestSingle(hand = []) {
	const sorted = sortCards(hand)
	return sorted.length ? [sorted[0]] : []
}

module.exports = {
	SUITS,
	SUIT_JOKER,
	RANK_MIN,
	RANK_MAX,
	RANK_SMALL_JOKER,
	RANK_BIG_JOKER,
	CARDS_PER_PLAYER,
	BOTTOM_CARD_COUNT,
	DECK_SIZE,
	buildCardId,
	buildDeck,
	rankOf,
	suitOf,
	isJoker,
	isSmallJoker,
	isBigJoker,
	isValidCard,
	compareCard,
	sortCards,
	shuffle,
	deal,
	countByRank,
	groupByRank,
	hasAllCards,
	removeCards,
	sumCards,
	pickSmallestSingle
}
