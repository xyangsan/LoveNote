'use strict'

const {
	deal,
	sortCards,
	hasAllCards,
	removeCards,
	pickSmallestSingle,
	rankOf
} = require('./landlord-cards')
const {
	COMBO,
	analyze,
	canBeat,
	normalizeCombo,
	findHints,
	findMinBeat
} = require('./landlord-combo')
const ai = require('./landlord-ai')
const {
	LANDLORD_PLAYER_COUNT,
	LANDLORD_BID_MS,
	LANDLORD_TURN_MS,
	ROOM_STATUS_PLAYING,
	ROOM_STATUS_SETTLED,
	SEAT_STATUS_PLAYING,
	SEAT_STATUS_FINISHED,
	MAX_PLAYED_HISTORY,
	MAX_AUTO_ACTIONS,
	OFFLINE_TRUSTEE_WINDOW,
	MAX_AUTO_ACTION_BEFORE_TRUSTEE,
	ERROR_CODES
} = require('./game-constants')

const BID_PHASE = 'bidding'
const PLAY_PHASE = 'playing'
const SETTLED_PHASE = 'settled'
const AUTO_STEP_LIMIT = 12

function buildError(errCode, errMsg) {
	const error = new Error(errMsg)
	error.errCode = errCode
	error.errMsg = errMsg
	return error
}

/* ------------------------------------------------------------------ *
 * 房间读取小工具（引擎自带，避免与 game-room 互相依赖）
 * ------------------------------------------------------------------ */

function sortedSeats(room = {}) {
	const seats = Array.isArray(room.seats) ? room.seats.slice() : []
	return seats
		.filter((seat) => String(seat.uid || '').trim())
		.sort((left, right) => Number(left.seat_index) - Number(right.seat_index))
}

function getSeatRing(room = {}) {
	return sortedSeats(room).map((seat) => Number(seat.seat_index))
}

function getSeatByIndex(room = {}, seatIndex = -1) {
	const seats = Array.isArray(room.seats) ? room.seats : []
	return seats.find((seat) => Number(seat.seat_index) === Number(seatIndex)) || null
}

function getSeatIndexByUid(room = {}, uid = '') {
	const target = String(uid || '')
	const seats = Array.isArray(room.seats) ? room.seats : []
	const seat = seats.find((item) => String(item.uid || '') === target)
	return seat ? Number(seat.seat_index) : -1
}

function requireSeatIndex(room = {}, uid = '') {
	const seatIndex = getSeatIndexByUid(room, uid)
	if (seatIndex < 0) {
		throw buildError(ERROR_CODES.notInRoom, '你不在这个房间里')
	}
	return seatIndex
}

function nextSeatInRing(room = {}, seatIndex = -1) {
	const ring = getSeatRing(room)
	if (!ring.length) {
		return -1
	}
	const position = ring.indexOf(Number(seatIndex))
	return position < 0 ? ring[0] : ring[(position + 1) % ring.length]
}

function getHands(room = {}) {
	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	const hands = answer.hands && typeof answer.hands === 'object' ? answer.hands : {}
	return hands
}

function getHand(room = {}, seatIndex = -1) {
	const hands = getHands(room)
	const list = hands[String(seatIndex)]
	return Array.isArray(list) ? list : []
}

function getBottomCards(room = {}) {
	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	return Array.isArray(answer.bottom) ? answer.bottom : []
}

function requirePhase(room = {}, allowed = []) {
	const phase = (room.state && room.state.phase) || ''
	if (!allowed.includes(phase)) {
		throw buildError(ERROR_CODES.roomNotWaiting, '当前阶段无法执行该操作')
	}
}

function requireTurn(room = {}, seatIndex = -1) {
	const state = room.state || {}
	if (Number(state.current_seat) !== Number(seatIndex)) {
		throw buildError(ERROR_CODES.notYourTurn, '还没轮到你')
	}
}

function isAutoSeat(room = {}, seatIndex = -1) {
	const seat = getSeatByIndex(room, seatIndex)
	if (!seat) {
		return false
	}
	if (seat.is_robot) {
		return true
	}
	const trusteeSeats = Array.isArray(room.state && room.state.trustee_seats)
		? room.state.trustee_seats.map(Number)
		: []
	return trusteeSeats.includes(Number(seatIndex))
}

/* ------------------------------------------------------------------ *
 * patch 组合
 * ------------------------------------------------------------------ */

function mergePatch(room = {}, patch = {}) {
	const next = Object.assign({}, room)
	if (patch.state !== undefined) {
		next.state = patch.state
	}
	if (patch.answer !== undefined) {
		next.answer = patch.answer
	}
	if (patch.seats !== undefined) {
		next.seats = patch.seats
	}
	if (patch.status !== undefined) {
		next.status = patch.status
	}
	return next
}

function composePatch(room = {}, patchList = []) {
	const acc = {}
	patchList.filter(Boolean).forEach((patch) => {
		if (patch.state !== undefined) {
			acc.state = patch.state
		}
		if (patch.answer !== undefined) {
			acc.answer = patch.answer
		}
		if (patch.seats !== undefined) {
			acc.seats = patch.seats
		}
		if (patch.status !== undefined) {
			acc.status = patch.status
		}
	})
	return Object.keys(acc).length ? acc : null
}

function appendAutoAction(state = {}, entry = {}, now = Date.now()) {
	const actions = Array.isArray(state.auto_actions) ? state.auto_actions.slice() : []
	const lastSeq = actions.length ? Number(actions[actions.length - 1].seq || 0) : 0
	actions.push(Object.assign({
		seq: lastSeq + 1,
		seat_index: -1,
		action: '',
		detail: '',
		create_time: now
	}, entry))
	while (actions.length > MAX_AUTO_ACTIONS) {
		actions.shift()
	}
	return actions
}

function bumpTimerSeq(state = {}) {
	return Object.assign({}, state, {
		timer_seq: Number(state.timer_seq || 0) + 1
	})
}

/* ------------------------------------------------------------------ *
 * 发牌 / 叫分 / 出牌 / 结算
 * ------------------------------------------------------------------ */

function markSeatsPlaying(room = {}) {
	return sortedSeats(room).map((seat) => Object.assign({}, seat, {
		status: SEAT_STATUS_PLAYING,
		ready: false
	}))
}

/** 重新发牌（开局 / 三家都不叫） */
function buildDealPatch(room = {}, now = Date.now()) {
	const { hands, bottom } = deal()
	const seats = sortedSeats(room)
	const nextHands = {}
	const cardsLeft = {}
	const playedCounts = {}

	seats.forEach((seat, index) => {
		const key = String(seat.seat_index)
		const hand = hands[index] || []
		nextHands[key] = hand
		cardsLeft[key] = hand.length
		playedCounts[key] = 0
	})

	const previousState = room.state || {}
	const firstSeat = seats.length
		? Number(seats[Math.floor(Math.random() * seats.length)].seat_index)
		: -1

	const nextState = Object.assign({}, previousState, {
		phase: BID_PHASE,
		base_score: 1,
		multiplier: 1,
		landlord_seat: -1,
		current_seat: firstSeat,
		bid_first_seat: firstSeat,
		bids: {},
		last_play: null,
		pass_count: 0,
		bomb_count: 0,
		cards_left: cardsLeft,
		played_counts: playedCounts,
		winner_seat: -1,
		winner_camp: '',
		score_delta: {},
		history: [],
		trustee_seats: Array.isArray(previousState.trustee_seats) ? previousState.trustee_seats : [],
		trustee_meta: previousState.trustee_meta || {},
		auto_actions: Array.isArray(previousState.auto_actions) ? previousState.auto_actions : [],
		started_at: now,
		settled_at: 0,
		turn_deadline: now + LANDLORD_BID_MS,
		timer_seq: Number(previousState.timer_seq || 0) + 1
	})

	return {
		state: nextState,
		answer: {
			hands: nextHands,
			bottom
		},
		seats: markSeatsPlaying(room),
		status: ROOM_STATUS_PLAYING
	}
}

function buildLandlordPatch(room = {}, landlordSeat = -1, baseScore = 1, bids = {}, now = Date.now()) {
	const state = room.state || {}
	const hands = Object.assign({}, getHands(room))
	const bottom = getBottomCards(room)
	const landlordKey = String(landlordSeat)
	const landlordHand = sortCards((hands[landlordKey] || []).concat(bottom))
	hands[landlordKey] = landlordHand

	const cardsLeft = Object.assign({}, state.cards_left)
	cardsLeft[landlordKey] = landlordHand.length

	return {
		state: Object.assign({}, bumpTimerSeq(state), {
			phase: PLAY_PHASE,
			landlord_seat: Number(landlordSeat),
			base_score: Number(baseScore) || 1,
			bids,
			current_seat: Number(landlordSeat),
			last_play: null,
			pass_count: 0,
			cards_left: cardsLeft,
			turn_deadline: now + LANDLORD_TURN_MS
		}),
		answer: Object.assign({}, room.answer, {
			hands
		})
	}
}

function applyBid(room = {}, seatIndex = -1, score = 0, now = Date.now()) {
	requirePhase(room, [BID_PHASE])
	const state = room.state || {}
	const bids = Object.assign({}, state.bids || {})
	bids[String(seatIndex)] = Number(score) || 0

	const ring = getSeatRing(room)
	const bidCount = Object.keys(bids).length

	// 直接叫到 3 分，或所有人都已叫过 → 定地主
	if (Number(score) === 3 || bidCount >= ring.length) {
		let bestSeat = -1
		let bestScore = 0
		Object.keys(bids).forEach((key) => {
			const value = Number(bids[key]) || 0
			if (value > bestScore) {
				bestScore = value
				bestSeat = Number(key)
			}
		})

		if (bestScore <= 0) {
			// 三家都不叫 → 重新发牌
			return buildDealPatch(room, now)
		}

		return buildLandlordPatch(room, bestSeat, bestScore, bids, now)
	}

	const nextSeat = nextSeatInRing(room, seatIndex)
	return {
		state: Object.assign({}, bumpTimerSeq(state), {
			bids,
			current_seat: nextSeat,
			turn_deadline: now + LANDLORD_BID_MS
		})
	}
}

function settleGame(room = {}, winnerSeat = -1, now = Date.now()) {
	const state = room.state || {}
	const landlordSeat = Number(state.landlord_seat)
	const landlordWins = Number(winnerSeat) === landlordSeat
	const playedCounts = state.played_counts || {}
	const bombCount = Number(state.bomb_count || 0)

	let multiplier = Math.pow(2, bombCount)
	if (landlordWins) {
		const farmerCounts = Object.keys(playedCounts)
			.filter((key) => Number(key) !== landlordSeat)
			.map((key) => Number(playedCounts[key]) || 0)
		if (farmerCounts.length && farmerCounts.every((value) => value === 0)) {
			// 春天
			multiplier *= 2
		}
	} else if (Number(playedCounts[String(landlordSeat)] || 0) <= 1) {
		// 反春天
		multiplier *= 2
	}

	const baseScore = Number(state.base_score || 1)
	const single = baseScore * multiplier
	const scoreDelta = {}
	Object.keys(playedCounts).forEach((key) => {
		const isLandlord = Number(key) === landlordSeat
		if (isLandlord) {
			scoreDelta[key] = landlordWins ? single * 2 : -single * 2
		} else {
			scoreDelta[key] = landlordWins ? -single : single
		}
	})

	const nextSeats = sortedSeats(room).map((seat) => {
		const key = String(seat.seat_index)
		return Object.assign({}, seat, {
			status: SEAT_STATUS_FINISHED,
			score: Number(seat.score || 0) + Number(scoreDelta[key] || 0)
		})
	})

	return {
		state: Object.assign({}, bumpTimerSeq(state), {
			phase: SETTLED_PHASE,
			winner_seat: Number(winnerSeat),
			winner_camp: landlordWins ? 'landlord' : 'farmer',
			multiplier,
			score_delta: scoreDelta,
			turn_deadline: 0,
			trustee_seats: [],
			settled_at: now
		}),
		seats: nextSeats,
		status: ROOM_STATUS_SETTLED
	}
}

function applyPlay(room = {}, seatIndex = -1, cardIds = [], now = Date.now()) {
	requirePhase(room, [PLAY_PHASE])
	const state = room.state || {}
	const hand = getHand(room, seatIndex)

	if (!Array.isArray(cardIds) || !cardIds.length) {
		throw buildError(ERROR_CODES.paramInvalid, '请选择要出的牌')
	}
	if (!hasAllCards(hand, cardIds)) {
		throw buildError(ERROR_CODES.invalidCards, '你手里没有这些牌')
	}

	const comboInfo = analyze(cardIds)
	if (!comboInfo) {
		throw buildError(ERROR_CODES.invalidCards, '牌型不合法')
	}

	const last = state.last_play
	if (last && Number(last.seat_index) !== Number(seatIndex)) {
		if (!canBeat(comboInfo, normalizeCombo(last))) {
			throw buildError(ERROR_CODES.cannotBeat, '这手牌管不上，换一手吧')
		}
	}

	const removed = removeCards(hand, cardIds)
	const hands = Object.assign({}, getHands(room))
	hands[String(seatIndex)] = removed.rest

	const cardsLeft = Object.assign({}, state.cards_left)
	cardsLeft[String(seatIndex)] = removed.rest.length

	const playedCounts = Object.assign({}, state.played_counts)
	playedCounts[String(seatIndex)] = Number(playedCounts[String(seatIndex)] || 0) + 1

	const isBomb = comboInfo.type === COMBO.BOMB || comboInfo.type === COMBO.ROCKET
	const history = [{
		seat_index: Number(seatIndex),
		cards: cardIds.slice(),
		combo_type: comboInfo.type,
		card_count: cardIds.length
	}].concat(Array.isArray(state.history) ? state.history : []).slice(0, MAX_PLAYED_HISTORY)

	const nextState = Object.assign({}, state, {
		last_play: {
			seat_index: Number(seatIndex),
			cards: cardIds.slice(),
			combo_type: comboInfo.type,
			main_rank: comboInfo.mainRank,
			card_count: cardIds.length
		},
		pass_count: 0,
		bomb_count: Number(state.bomb_count || 0) + (isBomb ? 1 : 0),
		cards_left: cardsLeft,
		played_counts: playedCounts,
		history
	})

	const answer = Object.assign({}, room.answer, {
		hands
	})

	// 出完手牌 → 结算
	if (!removed.rest.length) {
		const settled = settleGame(Object.assign({}, room, { state: nextState }), seatIndex, now)
		return Object.assign({}, settled, { answer })
	}

	return {
		state: Object.assign({}, bumpTimerSeq(nextState), {
			current_seat: nextSeatInRing(room, seatIndex),
			turn_deadline: now + LANDLORD_TURN_MS
		}),
		answer
	}
}

function applyPass(room = {}, seatIndex = -1, now = Date.now()) {
	requirePhase(room, [PLAY_PHASE])
	const state = room.state || {}

	if (!state.last_play) {
		throw buildError(ERROR_CODES.cannotBeat, '你是先手，必须出牌')
	}

	const ring = getSeatRing(room)
	const passCount = Number(state.pass_count || 0) + 1
	let lastPlay = state.last_play
	let nextPassCount = passCount
	let nextSeat = nextSeatInRing(room, seatIndex)

	// 其余所有还在场的玩家都过牌 → 上一手的出牌者重新先手
	if (passCount >= ring.length - 1) {
		lastPlay = null
		nextPassCount = 0
		nextSeat = Number(state.last_play.seat_index)
	}

	return {
		state: Object.assign({}, bumpTimerSeq(state), {
			last_play: lastPlay,
			pass_count: nextPassCount,
			current_seat: nextSeat,
			turn_deadline: now + LANDLORD_TURN_MS
		})
	}
}

/* ------------------------------------------------------------------ *
 * 自动座位（机器人 / 托管）与超时推进
 * ------------------------------------------------------------------ */

/** 记录一条自动操作流水：只对真人（被托管）记录，机器人出牌属于正常对局 */
function withAutoAction(room = {}, patch = null, seatIndex = -1, action = '', detail = '', now = Date.now()) {
	if (!patch || !patch.state) {
		return patch
	}
	const seat = getSeatByIndex(room, seatIndex)
	if (!seat || seat.is_robot) {
		return patch
	}
	return Object.assign({}, patch, {
		state: Object.assign({}, patch.state, {
			auto_actions: appendAutoAction(patch.state, {
				seat_index: Number(seatIndex),
				action,
				detail,
				create_time: now
			}, now)
		})
	})
}

/** 掉线自动托管：连续 N 次自动操作后接管；离线超过窗口也直接接管 */
function applyAutoTrustee(room = {}, patch = null, seatIndex = -1, {
	offline = false,
	autoCount = 0
} = {}, now = Date.now()) {
	const state = patch && patch.state ? patch.state : (room.state || {})
	const trusteeSeats = Array.isArray(state.trustee_seats) ? state.trustee_seats.map(Number) : []
	if (trusteeSeats.includes(Number(seatIndex))) {
		return patch
	}
	if (!offline && autoCount < MAX_AUTO_ACTION_BEFORE_TRUSTEE) {
		return patch
	}

	const nextTrusteeSeats = trusteeSeats.concat(Number(seatIndex))
	const trusteeMeta = Object.assign({}, state.trustee_meta || {}, {
		[String(seatIndex)]: {
			auto: true,
			since: now
		}
	})

	return Object.assign({}, patch || {}, {
		state: Object.assign({}, state, {
			trustee_seats: nextTrusteeSeats,
			trustee_meta: trusteeMeta,
			auto_actions: appendAutoAction(state, {
				seat_index: Number(seatIndex),
				action: 'auto_trustee',
				detail: offline ? '掉线超过 30 秒，已自动托管' : '连续超时，已自动托管',
				create_time: now
			}, now)
		})
	})
}

/** 机器人 / 托管座位连续推进，直到轮到真人或分出胜负 */
function advanceAutoSeats(room = {}, now = Date.now(), limit = AUTO_STEP_LIMIT) {
	const patchList = []
	let virtualRoom = room

	for (let step = 0; step < limit; step += 1) {
		const state = virtualRoom.state || {}
		if (state.phase !== BID_PHASE && state.phase !== PLAY_PHASE) {
			break
		}
		const seatIndex = Number(state.current_seat)
		if (seatIndex < 0 || !isAutoSeat(virtualRoom, seatIndex)) {
			break
		}

		let patch = null
		try {
			if (state.phase === BID_PHASE) {
				const hand = getHand(virtualRoom, seatIndex)
				patch = applyBid(virtualRoom, seatIndex, ai.chooseBid(hand), now)
			} else {
				const hand = getHand(virtualRoom, seatIndex)
				const decision = ai.choosePlay({
					hand,
					lastPlay: state.last_play,
					mySeat: seatIndex,
					landlordSeat: Number(state.landlord_seat),
					cardsLeft: state.cards_left || {}
				})
				patch = decision.type === 'play'
					? applyPlay(virtualRoom, seatIndex, decision.cardIds, now)
					: applyPass(virtualRoom, seatIndex, now)
			}
		} catch (error) {
			console.warn('landlord-engine advanceAutoSeats step failed', error)
			break
		}

		if (!patch) {
			break
		}

		patch = withAutoAction(virtualRoom, patch, seatIndex, state.phase === BID_PHASE ? 'bid' : 'play', '', now)
		patchList.push(patch)
		virtualRoom = mergePatch(virtualRoom, patch)

		if (patch.status === ROOM_STATUS_SETTLED) {
			break
		}
	}

	return composePatch(room, patchList)
}

/** 超时自动操作：叫分→不叫；出牌→跟牌则过、先手出最小单张 */
function applyTimeout(room = {}, seatIndex = -1, now = Date.now()) {
	const state = room.state || {}
	if (state.phase === BID_PHASE) {
		const patch = applyBid(room, seatIndex, 0, now)
		return withAutoAction(room, patch, seatIndex, 'bid', '超时未叫分，自动不叫', now)
	}
	if (state.phase === PLAY_PHASE) {
		const canPass = Boolean(state.last_play && Number(state.last_play.seat_index) !== Number(seatIndex))
		if (canPass) {
			const patch = applyPass(room, seatIndex, now)
			return withAutoAction(room, patch, seatIndex, 'pass', '超时未出牌，自动不出', now)
		}
		const hand = getHand(room, seatIndex)
		const cards = pickSmallestSingle(hand)
		if (!cards.length) {
			return null
		}
		const patch = applyPlay(room, seatIndex, cards, now)
		return withAutoAction(room, patch, seatIndex, 'play', '超时未出牌，自动出最小单张', now)
	}
	return null
}

/* ------------------------------------------------------------------ *
 * 引擎对外接口
 * ------------------------------------------------------------------ */

function assertHost(room = {}, uid = '') {
	if (String(room.host_uid || '') !== String(uid || '')) {
		throw buildError(ERROR_CODES.notHost, '只有房主可以开始游戏')
	}
}

async function handleAction({ room, uid, action, params = {} }) {
	const now = Date.now()
	const seatIndex = requireSeatIndex(room, uid)

	switch (action) {
	case 'start': {
		assertHost(room, uid)
		if (room.status !== 'waiting') {
			throw buildError(ERROR_CODES.roomNotWaiting, '游戏已经开始了')
		}
		if (sortedSeats(room).length < LANDLORD_PLAYER_COUNT) {
			throw buildError(ERROR_CODES.notEnoughPlayers, `斗地主需要 ${LANDLORD_PLAYER_COUNT} 名玩家`)
		}

		const dealPatch = buildDealPatch(room, now)
		const base = mergePatch(room, dealPatch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [dealPatch, autoPatch])
	}
	case 'bid': {
		requireTurn(room, seatIndex)
		const score = Number(params.score)
		if (![0, 1, 2, 3].includes(score)) {
			throw buildError(ERROR_CODES.paramInvalid, '叫分只能是 0/1/2/3')
		}
		const patch = applyBid(room, seatIndex, score, now)
		const base = mergePatch(room, patch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [patch, autoPatch])
	}
	case 'play': {
		requireTurn(room, seatIndex)
		const patch = applyPlay(room, seatIndex, params.cardIds || params.cards || [], now)
		const base = mergePatch(room, patch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [patch, autoPatch])
	}
	case 'pass': {
		requireTurn(room, seatIndex)
		const patch = applyPass(room, seatIndex, now)
		const base = mergePatch(room, patch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [patch, autoPatch])
	}
	case 'trustee': {
		const state = room.state || {}
		const trusteeSeats = Array.isArray(state.trustee_seats) ? state.trustee_seats.map(Number) : []
		const trusteeMeta = Object.assign({}, state.trustee_meta || {})
		const enabled = params.enabled === undefined
			? !trusteeSeats.includes(seatIndex)
			: Boolean(params.enabled)

		let nextTrusteeSeats = trusteeSeats
		if (enabled && !trusteeSeats.includes(seatIndex)) {
			nextTrusteeSeats = trusteeSeats.concat(seatIndex)
			trusteeMeta[String(seatIndex)] = { auto: false, since: now }
		}
		if (!enabled && trusteeSeats.includes(seatIndex)) {
			nextTrusteeSeats = trusteeSeats.filter((item) => item !== seatIndex)
			delete trusteeMeta[String(seatIndex)]
		}

		const patch = {
			state: Object.assign({}, state, {
				trustee_seats: nextTrusteeSeats,
				trustee_meta: trusteeMeta
			})
		}
		if (!enabled) {
			return patch
		}
		// 开启托管后如果正好轮到自己，立即代打
		const base = mergePatch(room, patch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [patch, autoPatch])
	}
	default:
		throw buildError(ERROR_CODES.paramInvalid, '不支持的操作')
	}
}

/**
 * 定时器推进：超时自动操作 + 掉线自动托管 + 机器人连续代打
 * @param {Object} options.onlineUidSet 由房间层传入的在线用户集合
 */
async function computeTimerPatch(room = {}, now = Date.now(), { onlineUidSet = null } = {}) {
	if (!room || room.status !== ROOM_STATUS_PLAYING) {
		return null
	}
	const state = room.state || {}
	if (state.phase !== BID_PHASE && state.phase !== PLAY_PHASE) {
		return null
	}

	const patches = []
	const seatIndex = Number(state.current_seat)
	const deadline = Number(state.turn_deadline || 0)

	if (seatIndex >= 0 && deadline > 0 && now > deadline && !isAutoSeat(room, seatIndex)) {
		const timeoutPatch = applyTimeout(room, seatIndex, now)
		if (timeoutPatch) {
			// 掉线判定：无活跃连接
			const seat = getSeatByIndex(room, seatIndex)
			const offline = Boolean(
				seat
				&& !seat.is_robot
				&& onlineUidSet
				&& typeof onlineUidSet.has === 'function'
				&& !onlineUidSet.has(String(seat.uid || ''))
			)
			// 连续超时次数：从 auto_actions 里统计该座位的自动操作条数
			const autoCount = (Array.isArray(state.auto_actions) ? state.auto_actions : [])
				.filter((item) => Number(item.seat_index) === seatIndex && item.action !== 'auto_trustee')
				.length

			patches.push(applyAutoTrustee(room, timeoutPatch, seatIndex, { offline, autoCount }, now))
		}
	}

	const base = patches.length ? mergePatch(room, patches[patches.length - 1]) : room
	const autoPatch = advanceAutoSeats(base, now)
	if (autoPatch) {
		patches.push(autoPatch)
	}

	return composePatch(room, patches)
}

/** 私有字段下发：只给本人手牌；底牌在叫分结束前不下发 */
function cropAnswerForUid(room = {}, uid = '') {
	const seatIndex = getSeatIndexByUid(room, uid)
	const state = room.state || {}
	const answer = {}

	if (seatIndex >= 0) {
		answer.myHand = getHand(room, seatIndex)
	}

	const phase = state.phase || ''
	if (phase === PLAY_PHASE || phase === SETTLED_PHASE) {
		answer.bottomCards = getBottomCards(room)
	} else {
		answer.bottomCards = []
		answer.bottomHidden = true
	}

	return answer
}

function buildResult(room = {}, uid = '') {
	const state = room.state || {}
	if (state.phase !== SETTLED_PHASE) {
		return null
	}
	const mySeat = getSeatIndexByUid(room, uid)
	const landlordSeat = Number(state.landlord_seat)

	return {
		winnerSeat: Number(state.winner_seat),
		winnerCamp: state.winner_camp || '',
		landlordSeat,
		baseScore: Number(state.base_score || 1),
		multiplier: Number(state.multiplier || 1),
		bombCount: Number(state.bomb_count || 0),
		scoreDelta: state.score_delta || {},
		cardsLeft: state.cards_left || {},
		mySeat,
		myScoreDelta: Number((state.score_delta || {})[String(mySeat)] || 0),
		iWin: mySeat >= 0 && (
			landlordSeat === mySeat
				? state.winner_camp === 'landlord'
				: state.winner_camp === 'farmer'
		)
	}
}

async function buildRecord(room = {}, { createUid = '', now = Date.now() } = {}) {
	const state = room.state || {}
	if (state.phase !== SETTLED_PHASE) {
		return null
	}

	const landlordSeat = Number(state.landlord_seat)
	const seats = sortedSeats(room)
	const scoreDelta = state.score_delta || {}

	const players = seats.map((seat) => {
		const key = String(seat.seat_index)
		const isLandlord = Number(seat.seat_index) === landlordSeat
		const camp = isLandlord ? 'landlord' : 'farmer'
		return {
			uid: String(seat.uid || ''),
			nickname: seat.nickname || '',
			avatar_url: seat.avatar_url || '',
			seat_index: Number(seat.seat_index),
			is_robot: Boolean(seat.is_robot),
			role: camp,
			score_delta: Number(scoreDelta[key] || 0),
			result: camp === state.winner_camp ? 'win' : 'lose'
		}
	})

	const winnerSeat = Number(state.winner_seat)
	const winnerPlayer = players.find((item) => item.seat_index === winnerSeat)
	const campText = state.winner_camp === 'landlord' ? '地主' : '农民'
	const summary = `${winnerPlayer ? winnerPlayer.nickname : '玩家'} 所在的${campText}方获胜 · ${Number(state.multiplier || 1)} 倍`

	return {
		game_type: 'landlord',
		room_id: room._id || '',
		room_code: room.room_code || '',
		players,
		winner_uids: players.filter((item) => item.result === 'win').map((item) => item.uid).filter(Boolean),
		loser_uids: players.filter((item) => item.result === 'lose').map((item) => item.uid).filter(Boolean),
		winner_camp: state.winner_camp || '',
		summary,
		detail: {
			landlordSeat,
			winnerSeat,
			baseScore: Number(state.base_score || 1),
			multiplier: Number(state.multiplier || 1),
			bombCount: Number(state.bomb_count || 0),
			cardsLeft: state.cards_left || {}
		},
		round_count: 1,
		duration: Math.max(0, now - Number(state.started_at || now)),
		create_uid: createUid || '',
		create_time: now,
		is_deleted: false
	}
}

function buildHint(room = {}, uid = '') {
	const seatIndex = getSeatIndexByUid(room, uid)
	if (seatIndex < 0) {
		return null
	}
	const state = room.state || {}
	const hand = getHand(room, seatIndex)
	if (!hand.length) {
		return null
	}

	const hint = findMinBeat(hand, state.last_play)
	if (!hint) {
		return { cardIds: [], comboType: '', canPass: Boolean(state.last_play) }
	}
	const comboInfo = analyze(hint)
	return {
		cardIds: hint,
		comboType: comboInfo ? comboInfo.type : '',
		comboText: comboInfo ? comboInfo.text : '',
		canPass: Boolean(state.last_play)
	}
}

module.exports = {
	BID_PHASE,
	PLAY_PHASE,
	SETTLED_PHASE,
	handleAction,
	computeTimerPatch,
	cropAnswerForUid,
	buildResult,
	buildRecord,
	buildHint,
	// 导出内部工具便于调试与复用
	getSeatIndexByUid,
	getHand,
	applyBid,
	applyPlay,
	applyPass,
	settleGame,
	advanceAutoSeats
}
