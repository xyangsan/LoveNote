'use strict'

const {
	ROOM_STATUS_PLAYING,
	ROOM_STATUS_SETTLED,
	SEAT_STATUS_PLAYING,
	SEAT_STATUS_OUT,
	SEAT_STATUS_FINISHED,
	UNDERCOVER_MIN_PLAYERS,
	MAX_SPEECHES,
	MAX_VOTE_HISTORY,
	resolveUndercoverCount,
	resolveRoomProps,
	ERROR_CODES
} = require('./game-constants')
const { pickWordPair } = require('./game-words')

const PHASE_ASSIGN = 'assign'
const PHASE_SPEAK = 'speak'
const PHASE_VOTE = 'vote'
const PHASE_SETTLED = 'settled'
const AUTO_STEP_LIMIT = 20
/**
 * 「场上只剩机器人」时允许的最大自动步数。
 *
 * `AUTO_STEP_LIMIT`(20) 只够推完一轮投票（存活人数 ≤ 10），一旦这一轮结算后进入下一轮，
 * 循环就会因为步数用尽而中断 —— 表现为「房间里全是机器人，但房间停在某一轮不动」。
 * 这里按「存活人数 × 可玩轮数」放大，让**全机器人房间能一次跑到游戏结束**。
 * 上限 200 是防跑飞用的（真正需要的步数 = 每人每轮 1 票 × 轮数）。
 */
const AUTO_STEP_LIMIT_ALL_ROBOT = 200
const MAX_ROUNDS_SAFETY = 12
const MAX_SPEECH_LENGTH = 60

/** 机器人发言模板：只说模糊描述，不泄露词本身 */
const ROBOT_SPEECH_POOL = [
	'我这个还挺常见的',
	'我见过，但不太熟',
	'感觉和我生活挺近的',
	'说不上来，挺有意思的',
	'我身边好像有类似的',
	'这个东西我一般不太关注',
	'挺经典的，大家都认识吧',
	'我第一反应是想到另一个东西'
]

/**
 * 机器人投票的「跟票率」：已经有人被投过票时，机器人有这么大比例会跟着投给当前票数最多的人。
 *
 * 这模拟的是「人云亦云地认为他是卧底」——既让票型收敛（不至于 4 人各投一个永远是平票），
 * 又保留随机性，不至于每局都是同一个剧本。
 */
const ROBOT_BANDWAGON_RATE = 0.7

function buildError(errCode, errMsg) {
	const error = new Error(errMsg)
	error.errCode = errCode
	error.errMsg = errMsg
	return error
}

/* ------------------------------------------------------------------ *
 * 小工具
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

/**
 * 是否机器人（自动座位）。
 *
 * 以 `is_robot` 标记为准，**并用 uid 的 `robot_` 前缀兜底** —— 与
 * `lib/game-room.js` 的 `isRobotSeat()` 保持同一口径。
 * 只认 `is_robot` 太脆：老数据或任何一次丢字段的座位写入，都会让机器人被判成真人，
 * 表现为「真人投完票机器人一动不动」，排查成本极高。
 */
function isAutoSeat(room = {}, seatIndex = -1) {
	const seat = getSeatByIndex(room, seatIndex)
	if (!seat) {
		return false
	}
	return Boolean(seat.is_robot) || /^robot_/.test(String(seat.uid || ''))
}

/** 本轮还有哪些存活机器人没投票（用于服务层判断「是否需要继续驱动」） */
function listPendingRobotVotes(room = {}) {
	const state = room.state || {}
	if (state.phase !== PHASE_VOTE) {
		return []
	}
	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	const votes = Array.isArray(state.votes) ? state.votes : []
	const robotSeats = aliveSeats.filter((seat) => isAutoSeat(room, seat))
	if (!robotSeats.length) {
		return []
	}

	// 与 advanceAutoSeats 的守卫一致：一票未投、且场上还有活着的真人时，
	// 机器人按兵不动（等第一票出现）—— 这种状态下不算「待推进」。
	const hasAliveHuman = aliveSeats.some((seat) => !isAutoSeat(room, seat))
	if (!votes.length && hasAliveHuman) {
		return []
	}

	return robotSeats.filter(
		(seat) => !votes.some((vote) => Number(vote.voter_seat) === seat)
	)
}

function shuffle(list = []) {
	const result = list.slice()
	for (let index = result.length - 1; index > 0; index -= 1) {
		const target = Math.floor(Math.random() * (index + 1))
		const temp = result[index]
		result[index] = result[target]
		result[target] = temp
	}
	return result
}

/**
 * 聚会模式：来自房间属性 `room.props.partyMode`（缺省为开启）。
 * 开启时整局都跳过「轮流发言」——开局即为投票阶段，每轮结算后没定局就再来一轮投票；
 * 关闭时走经典流程：轮流发言 → 投票。
 *
 * 属性读取一律走 `resolveRoomProps`（按 game_type 的规格取值），**不要直接读房间根上的字段**。
 */
function isPartyMode(room = {}) {
	return resolveRoomProps(room.game_type, room.props).props.partyMode !== false
}

function mergePatch(room = {}, patch = {}) {
	const next = Object.assign({}, room)
	// null = 「本次不改这个字段」。resolveAfterVote 里用 `let seats = null` 表示平票不淘汰，
	// 若把 null 当成「设为空」，虚拟房间和真房间的座位都会被清掉。
	if (patch.state !== undefined && patch.state !== null) {
		next.state = patch.state
	}
	if (patch.answer !== undefined && patch.answer !== null) {
		next.answer = patch.answer
	}
	if (patch.seats !== undefined && patch.seats !== null) {
		next.seats = patch.seats
	}
	if (patch.status !== undefined && patch.status !== null) {
		next.status = patch.status
	}
	return next
}

function composePatch(room = {}, patchList = []) {
	const acc = {}
	patchList.filter(Boolean).forEach((patch) => {
		if (patch.state !== undefined && patch.state !== null) {
			acc.state = patch.state
		}
		if (patch.answer !== undefined && patch.answer !== null) {
			acc.answer = patch.answer
		}
		if (patch.seats !== undefined && patch.seats !== null) {
			acc.seats = patch.seats
		}
		if (patch.status !== undefined && patch.status !== null) {
			acc.status = patch.status
		}
	})
	return Object.keys(acc).length ? acc : null
}

function bumpTimerSeq(state = {}) {
	return Object.assign({}, state, {
		timer_seq: Number(state.timer_seq || 0) + 1
	})
}

function appendSpeech(state = {}, speech = {}) {
	const speeches = Array.isArray(state.speeches) ? state.speeches.slice() : []
	speeches.push(speech)
	while (speeches.length > MAX_SPEECHES) {
		speeches.shift()
	}
	return speeches
}

/**
 * 把「刚结算完的这一轮投票」归档进 `state.vote_history`。
 *
 * 为什么要归档：`goToVote` 每开一轮就把 `state.votes` 重置为 []，
 * 结算后历史票箱立刻消失，前端只剩 `last_vote_result`（只有票数、没有「谁投了谁」）。
 * 归档后每轮留一条完整快照（含每个人的票 + 淘汰结果 + 时间戳），
 * 前端据此按轮次分组、与 `state.speeches` 一起渲染成一条完整时间线。
 *
 * 幂等：同一 vote_round 重复归档会**覆盖**而不是追加——
 * `resolveAfterVote` 可能被并发/重试路径重复执行，覆盖可避免出现两条同轮记录。
 */
function archiveVoteRound(state = {}, result = {}, now = Date.now()) {
	const history = Array.isArray(state.vote_history) ? state.vote_history.slice() : []
	const voteRound = Number(state.vote_round || 0)
	const votes = Array.isArray(state.votes) ? state.votes : []

	const record = {
		round: Number(state.round || 1),
		vote_round: voteRound,
		alive_seats: Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : [],
		votes: votes
			.map((vote) => ({
				voter_seat: Number(vote.voter_seat),
				target_seat: Number(vote.target_seat),
				create_time: Number(vote.create_time || 0)
			}))
			.sort((left, right) => left.voter_seat - right.voter_seat),
		counts: result.counts || {},
		tie: Boolean(result.tie),
		eliminated_seat: Number(result.eliminatedSeat),
		create_time: now
	}

	// 同一 vote_round 只保留一条（覆盖最后写入的）
	const duplicated = history.findIndex((item) => Number(item.vote_round) === voteRound)
	if (duplicated >= 0) {
		history.splice(duplicated, 1)
	}
	history.push(record)

	// 只保留最近 MAX_VOTE_HISTORY 轮（更早的整轮丢弃）
	while (history.length > MAX_VOTE_HISTORY) {
		history.shift()
	}
	return history
}

/* ------------------------------------------------------------------ *
 * 开局
 * ------------------------------------------------------------------ */

function markSeatsPlaying(room = {}) {
	return sortedSeats(room).map((seat) => Object.assign({}, seat, {
		status: SEAT_STATUS_PLAYING,
		ready: false
	}))
}

async function buildStartPatch(room = {}, params = {}, now = Date.now()) {
	const seats = sortedSeats(room)
	const rings = seats.map((seat) => Number(seat.seat_index))
	const playerCount = rings.length

	if (playerCount < UNDERCOVER_MIN_PLAYERS) {
		throw buildError(
			ERROR_CODES.notEnoughPlayers,
			`谁是卧底至少需要 ${UNDERCOVER_MIN_PLAYERS} 名玩家`
		)
	}

	const wordPair = await pickWordPair({
		source: params.wordSource === 'mine' ? 'mine' : 'preset',
		uid: params.uid || '',
		category: params.category,
		excludeIds: []
	})

	if (!wordPair) {
		throw buildError(ERROR_CODES.noRecord, '词库里没有可用词条，先去添加几条吧')
	}

	// 卧底人数来自房间属性（room.props.undercoverCount），不是房间根字段
	const roomProps = resolveRoomProps(room.game_type, room.props).props
	const undercoverCount = resolveUndercoverCount(roomProps.undercoverCount, playerCount)
	const undercoverSeats = shuffle(rings).slice(0, undercoverCount).sort((left, right) => left - right)

	const assignments = {}
	rings.forEach((seatIndex) => {
		assignments[String(seatIndex)] = undercoverSeats.includes(seatIndex) ? 'undercover' : 'civilian'
	})

	const speakOrder = shuffle(rings)
	const previousState = room.state || {}
	const partyMode = isPartyMode(room)

	const nextState = Object.assign({}, previousState, {
		// 聚会模式：跳过轮流发言，开局直接进投票阶段（见 isPartyMode）
		phase: partyMode ? PHASE_VOTE : PHASE_SPEAK,
		speak_order: speakOrder,
		current_speaker_seat: partyMode ? -1 : speakOrder[0],
		spoken_seats: [],
		speeches: [],
		vote_round: partyMode ? 1 : 0,
		votes: [],
		// 历史轮次投票归档（每轮一条完整快照，前端据此渲染完整时间线）
		vote_history: [],
		last_vote_result: null,
		alive_seats: rings.slice(),
		eliminated_seats: [],
		word_pair_id: wordPair.wordPairId || '',
		word_category: wordPair.category || '',
		civilian_word_public: '',
		undercover_count: undercoverCount,
		word_fallback_to_preset: Boolean(wordPair.fallbackToPreset),
		round: 1,
		winner: '',
		started_at: now,
		settled_at: 0,
		// 无计时限制：卧底整局不限时，deadline 恒为 0
		turn_deadline: 0,
		timer_seq: Number(previousState.timer_seq || 0) + 1,
		auto_actions: Array.isArray(previousState.auto_actions) ? previousState.auto_actions : []
	})

	return {
		state: nextState,
		answer: {
			assignments,
			undercover_seats: undercoverSeats,
			word_pair: {
				civilian_word: wordPair.civilianWord,
				undercover_word: wordPair.undercoverWord
			}
		},
		seats: markSeatsPlaying(room),
		status: ROOM_STATUS_PLAYING
	}
}

/* ------------------------------------------------------------------ *
 * 发言推进
 * ------------------------------------------------------------------ */

function goToVote(room = {}, state = {}, now = Date.now()) {
	return {
		state: Object.assign({}, bumpTimerSeq(state), {
			phase: PHASE_VOTE,
			current_speaker_seat: -1,
			vote_round: Number(state.vote_round || 0) + 1,
			votes: [],
			// 无计时限制：投票不限时
			turn_deadline: 0
		})
	}
}

function advanceSpeaker(room = {}, state = {}, now = Date.now()) {
	const speakOrder = Array.isArray(state.speak_order) ? state.speak_order.map(Number) : []
	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	const spokenSeats = Array.isArray(state.spoken_seats) ? state.spoken_seats.map(Number) : []
	const pending = speakOrder.filter((seat) => aliveSeats.includes(seat) && !spokenSeats.includes(seat))

	if (!pending.length) {
		return goToVote(room, state, now)
	}

	return {
		state: Object.assign({}, bumpTimerSeq(state), {
			current_speaker_seat: pending[0],
			// 无计时限制：发言不限时
			turn_deadline: 0
		})
	}
}

function applySpeak(room = {}, seatIndex = -1, text = '', now = Date.now(), { skip = false } = {}) {
	const state = room.state || {}
	if (state.phase !== PHASE_SPEAK) {
		throw buildError(ERROR_CODES.roomNotWaiting, '现在不是发言阶段')
	}
	if (Number(state.current_speaker_seat) !== Number(seatIndex)) {
		throw buildError(ERROR_CODES.notYourTurn, '还没轮到你发言')
	}

	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	if (!aliveSeats.includes(Number(seatIndex))) {
		throw buildError(ERROR_CODES.notAlive, '你已经被淘汰了')
	}

	const spokenSeats = Array.isArray(state.spoken_seats) ? state.spoken_seats.map(Number) : []
	const content = skip ? '' : String(text || '').trim().slice(0, MAX_SPEECH_LENGTH)
	if (!skip && !content) {
		throw buildError(ERROR_CODES.paramInvalid, '先写一句描述吧')
	}

	// 跳过发言**也要留痕**（text 为空 + skipped 标记）：
	// 前端的完整记录按轮次展示所有人的发言，跳过的人若完全不出现，
	// 看记录的人会以为他还没发言。历史版本这里直接不记，已改。
	const speeches = appendSpeech(state, {
		seat_index: Number(seatIndex),
		text: content,
		round: Number(state.round || 1),
		skipped: Boolean(skip),
		create_time: now
	})

	const nextState = Object.assign({}, state, {
		spoken_seats: spokenSeats.includes(Number(seatIndex))
			? spokenSeats
			: spokenSeats.concat(Number(seatIndex)),
		speeches
	})

	return advanceSpeaker(room, nextState, now)
}

/* ------------------------------------------------------------------ *
 * 投票与结算
 * ------------------------------------------------------------------ */

function tallyVotes(state = {}) {
	const votes = Array.isArray(state.votes) ? state.votes : []
	const counts = {}
	votes.forEach((vote) => {
		const target = Number(vote.target_seat)
		counts[String(target)] = (counts[String(target)] || 0) + 1
	})

	let max = 0
	let winners = []
	Object.keys(counts).forEach((key) => {
		const value = counts[key]
		if (value > max) {
			max = value
			winners = [Number(key)]
		} else if (value === max) {
			winners.push(Number(key))
		}
	})

	return {
		counts,
		max,
		tie: winners.length !== 1,
		eliminatedSeat: winners.length === 1 ? winners[0] : -1
	}
}

/**
 * 胜负判定
 *
 * ⚠️ 卧底名单只存放在 `room.answer.undercover_seats` —— **绝不能放进 state**，
 * state 是下发给所有玩家的，放进去等于把卧底身份公开。
 * 早期版本误读 `state.undercover_seats`：那里永远是空的，于是 aliveUndercover 恒为 0，
 * `checkWinner` 每次都返回 'civilian'，**每局第一轮投票后必定判平民赢、卧底永远赢不了**。
 *
 * @param {object} room 房间文档（从 answer 取卧底名单）
 * @param {object} state 可选，房间状态；不传则用 room.state
 */
function checkWinner(room = {}, state = {}) {
	const scene = state && Object.keys(state).length ? state : (room.state || {})
	const aliveSeats = Array.isArray(scene.alive_seats) ? scene.alive_seats.map(Number) : []

	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	const source = Array.isArray(answer.undercover_seats)
		? answer.undercover_seats
		: (Array.isArray(scene.undercover_seats) ? scene.undercover_seats : [])
	const undercoverSeats = source.map(Number)

	const aliveUndercover = undercoverSeats.filter((seat) => aliveSeats.includes(seat)).length
	const aliveCivilian = aliveSeats.length - aliveUndercover

	// 卧底全灭（或场上无人）→ 平民胜
	if (aliveUndercover <= 0) {
		return 'civilian'
	}
	// 卧底人数追平平民（含「平民全灭」）→ 卧底胜。
	// 这里不要写成 `if (!aliveCivilian) return 'civilian'`，那会把「只剩卧底活着」误判成平民赢。
	if (aliveUndercover >= aliveCivilian) {
		return 'undercover'
	}
	return ''
}

function buildSettlePatch(room = {}, state = {}, winner = '', now = Date.now()) {
	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	const wordPair = answer.word_pair && typeof answer.word_pair === 'object' ? answer.word_pair : {}

	const undercoverSeats = Array.isArray(answer.undercover_seats)
		? answer.undercover_seats.map(Number)
		: []

	const nextSeats = sortedSeats(room).map((seat) => {
		const seatIndex = Number(seat.seat_index)
		const isUndercover = undercoverSeats.includes(seatIndex)
		const camp = isUndercover ? 'undercover' : 'civilian'
		const score = camp === winner ? 10 : 0
		return Object.assign({}, seat, {
			status: SEAT_STATUS_FINISHED,
			score: Number(seat.score || 0) + score
		})
	})

	return {
		state: Object.assign({}, bumpTimerSeq(state), {
			phase: PHASE_SETTLED,
			winner,
			civilian_word_public: wordPair.civilian_word || '',
			current_speaker_seat: -1,
			turn_deadline: 0,
			settled_at: now
		}),
		seats: nextSeats,
		status: ROOM_STATUS_SETTLED
	}
}

function resolveAfterVote(room = {}, state = {}, now = Date.now()) {
	const result = tallyVotes(state)
	const lastVoteResult = {
		vote_round: Number(state.vote_round || 0),
		counts: result.counts,
		tie: result.tie,
		eliminated_seat: result.eliminatedSeat
	}

	let aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	let eliminatedSeats = Array.isArray(state.eliminated_seats) ? state.eliminated_seats.slice() : []
	let seats = null

	if (result.eliminatedSeat >= 0 && aliveSeats.includes(result.eliminatedSeat)) {
		aliveSeats = aliveSeats.filter((seat) => seat !== result.eliminatedSeat)
		eliminatedSeats = eliminatedSeats.concat(result.eliminatedSeat)
		seats = sortedSeats(room).map((seat) => (
			Number(seat.seat_index) === result.eliminatedSeat
				? Object.assign({}, seat, { status: SEAT_STATUS_OUT })
				: seat
		))
	}

	const nextState = Object.assign({}, state, {
		alive_seats: aliveSeats,
		eliminated_seats: eliminatedSeats,
		last_vote_result: lastVoteResult,
		// 归档这一轮的完整票箱（必须在清空votes 之前做，见 archiveVoteRound）
		vote_history: archiveVoteRound(state, result, now)
	})

	// 胜负判定（卧底名单在 room.answer 里，必须把 room 传进去）
	const winner = checkWinner(room, nextState)
	if (winner) {
		return composePatch(room, [
			{ state: nextState, seats },
			buildSettlePatch(room, nextState, winner, now)
		])
	}

	// 平票或没人出局时防止无限循环
	if (Number(state.round || 0) >= MAX_ROUNDS_SAFETY) {
		return composePatch(room, [
			{ state: nextState, seats },
			buildSettlePatch(room, nextState, 'undercover', now)
		])
	}

	// 进入下一轮
	const nextRound = Number(state.round || 1) + 1

	// 聚会模式：不轮流发言，直接开下一轮投票（复用 goToVote 重置票箱与投票轮次）
	if (isPartyMode(room)) {
		const nextVoteState = Object.assign({}, goToVote(room, nextState, now).state, {
			round: nextRound,
			spoken_seats: []
		})
		return composePatch(room, [{ state: nextVoteState, seats }])
	}

	// 经典流程：进入下一轮发言
	const speakOrder = Array.isArray(state.speak_order) ? state.speak_order.map(Number) : []
	const pendingOrder = speakOrder.filter((seat) => aliveSeats.includes(seat))
	const rotatedOrder = pendingOrder.length ? pendingOrder : aliveSeats.slice()

	const nextRoundState = Object.assign({}, bumpTimerSeq(nextState), {
		phase: PHASE_SPEAK,
		round: nextRound,
		speak_order: rotatedOrder,
		spoken_seats: [],
		current_speaker_seat: rotatedOrder[0],
		// 无计时限制：新一轮发言不限时
		turn_deadline: 0
	})

	return composePatch(room, [{ state: nextRoundState, seats }])
}

function applyVote(room = {}, seatIndex = -1, targetSeat = -1, now = Date.now()) {
	const voteEntry = buildVoteEntry(room, seatIndex, targetSeat, now)
	const state = room.state || {}
	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	const votes = Array.isArray(state.votes) ? state.votes.slice() : []
	votes.push(voteEntry)

	const nextState = Object.assign({}, state, { votes })

	// 所有存活玩家都投完 → 结算本轮
	if (votes.length >= aliveSeats.length) {
		return resolveAfterVote(room, nextState, now)
	}

	return {
		state: Object.assign({}, nextState, {
			// 无计时限制：投票不限时，保持 0
			turn_deadline: 0
		})
	}
}

/**
 * 校验投票合法性并构造投票项（不做任何状态变更）。
 * 供服务层「先校验、再原子追加 state.votes、票齐才结算」使用 ——
 * 投票是追加操作，不该走整房 state 替换 + version 乐观锁，否则多人齐投互相撞车。
 */
function buildVoteEntry(room = {}, seatIndex = -1, targetSeat = -1, now = Date.now()) {
	const state = room.state || {}
	if (state.phase !== PHASE_VOTE) {
		throw buildError(ERROR_CODES.roomNotWaiting, '现在不是投票阶段')
	}

	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	if (!aliveSeats.includes(Number(seatIndex))) {
		throw buildError(ERROR_CODES.notAlive, '你已经被淘汰了，不能投票')
	}

	const votes = Array.isArray(state.votes) ? state.votes : []
	if (votes.some((vote) => Number(vote.voter_seat) === Number(seatIndex))) {
		throw buildError(ERROR_CODES.alreadyVoted, '你已经投过票了')
	}
	if (!aliveSeats.includes(Number(targetSeat))) {
		throw buildError(ERROR_CODES.paramInvalid, '只能投给还活着的玩家')
	}
	if (Number(targetSeat) === Number(seatIndex)) {
		throw buildError(ERROR_CODES.paramInvalid, '不能投给自己')
	}

	return {
		voter_seat: Number(seatIndex),
		target_seat: Number(targetSeat),
		create_time: now
	}
}

/**
 * 玩家中途退出：把该座位按「已被淘汰」处理，并把发言轮次 / 投票进度 / 胜负一并修正，
 * 让剩下的人能继续把这一局打完。
 *
 * ⚠️ 传进来的 `room` 必须**已经移除该玩家的座位**（服务层先删座位再调这里）——
 * 这样定局结算时 `buildSettlePatch` 生成的 seats 自然不含离开的人。
 *
 * @param {object} room 已移除该座位的房间
 * @param {number} seatIndex 离开者的座位号
 * @returns {object|null} `{ state }`；若直接定局则 `{ state, seats, status }`
 */
function buildLeavePatch(room = {}, seatIndex = -1, now = Date.now()) {
	const index = Number(seatIndex)
	const state = room.state || {}
	if (!Number.isInteger(index) || index < 0) {
		return null
	}
	if (state.phase === PHASE_SETTLED || state.phase === PHASE_ASSIGN) {
		return null
	}

	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	// 已经出局的人退出：只是少了个座位，对局状态不用动
	if (!aliveSeats.includes(index)) {
		return null
	}

	const nextAlive = aliveSeats.filter((seat) => seat !== index)
	const nextState = Object.assign({}, state, {
		alive_seats: nextAlive,
		eliminated_seats: (Array.isArray(state.eliminated_seats) ? state.eliminated_seats.map(Number) : [])
			.concat(index)
	})

	// 人数变化后可能直接定局（例如最后一个平民走了 → 卧底胜）
	const winner = checkWinner(room, nextState)
	if (winner) {
		return buildSettlePatch(room, nextState, winner, now)
	}

	// 发言阶段：正好轮到他 → 顺延到下一位
	if (state.phase === PHASE_SPEAK && Number(state.current_speaker_seat) === index) {
		return advanceSpeaker(room, nextState, now)
	}

	// 投票阶段：他不投了；剩下的人若已全部投完 → 直接开票结算
	if (state.phase === PHASE_VOTE) {
		const votes = (Array.isArray(state.votes) ? state.votes : [])
			.filter((vote) => Number(vote.voter_seat) !== index)
		const votedState = Object.assign({}, nextState, { votes })
		if (votes.length >= nextAlive.length) {
			return resolveAfterVote(room, votedState, now)
		}
		return { state: votedState }
	}

	return { state: nextState }
}

/* ------------------------------------------------------------------ *
 * 机器人 / 超时
 * ------------------------------------------------------------------ */

function buildRobotSpeakPatch(room = {}, seatIndex = -1, now = Date.now()) {
	const text = ROBOT_SPEECH_POOL[Math.floor(Math.random() * ROBOT_SPEECH_POOL.length)]
	return applySpeak(room, seatIndex, text, now, { skip: false })
}

/**
 * 机器人挑一个人投票 —— 模拟「投给自己觉得是卧底的人」。
 *
 * 规则（都很朴素，但不违反任何身份信息边界）：
 *   1. 绝不投自己；
 *   2. 卧底机器人**不投队友**（它知道自己的阵营，但不知道谁是平民里的「聪明人」）；
 *   3. 已经有人被投过票时，按 ROBOT_BANDWAGON_RATE 的比例跟投当前票数最高的那个人
 *      —— 表现就是「大家都在怀疑他，那我也投他」；
 *   4. 否则在候选里随机挑一个（保留不确定性，避免每局剧本一模一样）。
 *
 * @returns {number} 目标座位号；没有可选目标时返回 -1
 */
function pickRobotVoteTarget(room = {}, seatIndex = -1) {
	const state = room.state || {}
	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	const votes = Array.isArray(state.votes) ? state.votes : []
	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	const assignments = answer.assignments && typeof answer.assignments === 'object' ? answer.assignments : {}
	const undercoverSeats = Array.isArray(answer.undercover_seats)
		? answer.undercover_seats.map(Number)
		: []

	let candidates = aliveSeats.filter((seat) => seat !== Number(seatIndex))
	if (!candidates.length) {
		return -1
	}

	// 卧底不投同伙
	if (assignments[String(seatIndex)] === 'undercover') {
		const civilians = candidates.filter((seat) => !undercoverSeats.includes(seat))
		if (civilians.length) {
			candidates = civilians
		}
	}

	// 统计当前票数，找票数最高的候选
	const counts = {}
	votes.forEach((vote) => {
		const target = Number(vote.target_seat)
		if (candidates.includes(target)) {
			counts[target] = (counts[target] || 0) + 1
		}
	})
	const ranked = candidates.slice().sort((left, right) => (counts[right] || 0) - (counts[left] || 0))
	const leader = ranked[0]
	if ((counts[leader] || 0) > 0 && Math.random() < ROBOT_BANDWAGON_RATE) {
		return leader
	}

	return candidates[Math.floor(Math.random() * candidates.length)]
}

function buildRobotVotePatch(room = {}, seatIndex = -1, now = Date.now()) {
	const target = pickRobotVoteTarget(room, seatIndex)
	if (target < 0) {
		return null
	}
	return applyVote(room, seatIndex, target, now)
}

/**
 * 场上是否已经没有活着的真人。
 *
 * 这是「自动推进能不能一路跑到游戏结束」的唯一判据：
 *   - 全是机器人 → 没人会再操作，必须由引擎一路推到结算；
 *   - 还有真人 → 必须停下来等真人先投票（见 advanceAutoSeats 里的守卫）。
 */
function hasAliveHumanSeat(room = {}) {
	const state = room.state || {}
	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	return aliveSeats.some((seat) => !isAutoSeat(room, seat))
}

/**
 * 本次允许走多少步自动操作。
 *
 * 默认 AUTO_STEP_LIMIT(20) 只够推完一轮投票；结算后进入下一轮会因步数耗尽而中断，
 * 表现为「全机器人房间停在某一轮不动」。全机器人时按「存活人数 × 可玩轮数」放大，
 * 保证**一次调用就能把整局跑完**（MAX_ROUNDS_SAFETY 是引擎自己的定局兜底轮数）。
 */
function resolveAutoStepLimit(room = {}, baseLimit = AUTO_STEP_LIMIT) {
	if (hasAliveHumanSeat(room)) {
		return baseLimit
	}
	const aliveCount = Array.isArray((room.state || {}).alive_seats)
		? room.state.alive_seats.length
		: 0
	if (!aliveCount) {
		return baseLimit
	}
	const needed = aliveCount * (MAX_ROUNDS_SAFETY + 2) + baseLimit
	return Math.min(AUTO_STEP_LIMIT_ALL_ROBOT, Math.max(baseLimit, needed))
}

function advanceAutoSeats(room = {}, now = Date.now(), limit = 0) {
	const patchList = []
	let virtualRoom = room
	const stepLimit = limit > 0
		? limit
		: resolveAutoStepLimit(room, AUTO_STEP_LIMIT)

	for (let step = 0; step < stepLimit; step += 1) {
		const state = virtualRoom.state || {}
		if (state.phase === PHASE_SETTLED || state.phase === PHASE_ASSIGN) {
			break
		}

		let seatIndex = -1
		if (state.phase === PHASE_SPEAK) {
			seatIndex = Number(state.current_speaker_seat)
		} else if (state.phase === PHASE_VOTE) {
			const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
			const votes = Array.isArray(state.votes) ? state.votes : []

			// 投票是「同时投」，人人随时能投；但机器人不抢在玩家前面开票 ——
			// 房间里有活着的真人时，等出现第一票之后再让机器人自动跟投。
			// （没有这一条的话，进投票阶段的瞬间机器人就把票投完了，玩家看到的
			//   是「还没反应过来就开票了」。若房间里已经没有真人，则不拦，一路跑到结束。）
			const hasAliveHuman = aliveSeats.some((seat) => !isAutoSeat(virtualRoom, seat))
			if (!votes.length && hasAliveHuman) {
				break
			}

			seatIndex = aliveSeats.find(
				(seat) => isAutoSeat(virtualRoom, seat)
					&& !votes.some((vote) => Number(vote.voter_seat) === seat)
			)
		}

		if (seatIndex === undefined || seatIndex < 0 || !isAutoSeat(virtualRoom, seatIndex)) {
			break
		}

		let patch = null
		try {
			patch = state.phase === PHASE_SPEAK
				? buildRobotSpeakPatch(virtualRoom, seatIndex, now)
				: buildRobotVotePatch(virtualRoom, seatIndex, now)
		} catch (error) {
			console.warn('undercover-engine advanceAutoSeats step failed', error)
			break
		}

		if (!patch) {
			break
		}

		patchList.push(patch)
		virtualRoom = mergePatch(virtualRoom, patch)

		if (patch.status === ROOM_STATUS_SETTLED) {
			break
		}
	}

	return composePatch(room, patchList)
}

async function computeTimerPatch(room = {}, now = Date.now(), options = {}) {
	if (!room || room.status !== ROOM_STATUS_PLAYING) {
		return null
	}
	const state = room.state || {}
	if (state.phase !== PHASE_SPEAK && state.phase !== PHASE_VOTE) {
		return null
	}

	// 无计时限制：不再根据 deadline 自动跳过发言 / 按弃票结算投票。
	// 只保留机器人自动推进（测试环境凑人用），真人想好了再操作、不限时。
	return advanceAutoSeats(room, now)
}

/* ------------------------------------------------------------------ *
 * 对外接口
 * ------------------------------------------------------------------ */

async function handleAction({ room, uid, action, params = {} }) {
	const now = Date.now()
	const seatIndex = requireSeatIndex(room, uid)

	switch (action) {
	case 'start': {
		if (String(room.host_uid || '') !== String(uid || '')) {
			throw buildError(ERROR_CODES.notHost, '只有房主可以开始游戏')
		}
		if (room.status !== 'waiting') {
			throw buildError(ERROR_CODES.roomNotWaiting, '游戏已经开始了')
		}
		const startPatch = await buildStartPatch(room, Object.assign({ uid }, params), now)
		const base = mergePatch(room, startPatch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [startPatch, autoPatch])
	}
	case 'speak': {
		const patch = applySpeak(room, seatIndex, params.text, now, { skip: false })
		const base = mergePatch(room, patch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [patch, autoPatch])
	}
	case 'skipSpeak': {
		const patch = applySpeak(room, seatIndex, '', now, { skip: true })
		const base = mergePatch(room, patch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [patch, autoPatch])
	}
	case 'vote': {
		const targetSeat = Number(params.targetSeat)
		if (!Number.isInteger(targetSeat)) {
			throw buildError(ERROR_CODES.paramInvalid, '请选择要投票的玩家')
		}
		const patch = applyVote(room, seatIndex, targetSeat, now)
		const base = mergePatch(room, patch)
		const autoPatch = advanceAutoSeats(base, now)
		return composePatch(room, [patch, autoPatch])
	}
	case 'nextRound': {
		if (String(room.host_uid || '') !== String(uid || '')) {
			throw buildError(ERROR_CODES.notHost, '只有房主可以推进轮次')
		}
		const state = room.state || {}
		if (state.phase !== PHASE_VOTE) {
			throw buildError(ERROR_CODES.roomNotWaiting, '现在不需要推进轮次')
		}
		return resolveAfterVote(room, state, now)
	}
	case 'reveal': {
		if (String(room.host_uid || '') !== String(uid || '')) {
			throw buildError(ERROR_CODES.notHost, '只有房主可以结束本局')
		}
		const state = room.state || {}
		if (state.phase === PHASE_SETTLED) {
			return null
		}
		const winner = checkWinner(room, state) || 'civilian'
		return buildSettlePatch(room, state, winner, now)
	}
	default:
		throw buildError(ERROR_CODES.paramInvalid, '不支持的操作')
	}
}

function cropAnswerForUid(room = {}, uid = '') {
	const seatIndex = getSeatIndexByUid(room, uid)
	if (seatIndex < 0) {
		return {}
	}
	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	const assignments = answer.assignments && typeof answer.assignments === 'object' ? answer.assignments : {}
	const wordPair = answer.word_pair && typeof answer.word_pair === 'object' ? answer.word_pair : {}
	const role = assignments[String(seatIndex)] || ''

	// 只下发本人身份与本人的词，绝不带出其他人的身份或整体 answer
	return {
		myRole: role,
		myWord: role === 'undercover' ? (wordPair.undercover_word || '') : (wordPair.civilian_word || ''),
		undercoverCount: Number((room.state && room.state.undercover_count) || 0)
	}
}

function buildResult(room = {}, uid = '') {
	const state = room.state || {}
	if (state.phase !== PHASE_SETTLED) {
		return null
	}
	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	const wordPair = answer.word_pair && typeof answer.word_pair === 'object' ? answer.word_pair : {}
	const undercoverSeats = Array.isArray(answer.undercover_seats)
		? answer.undercover_seats.map(Number)
		: []
	const mySeat = getSeatIndexByUid(room, uid)
	const myRole = mySeat >= 0 ? (answer.assignments || {})[String(mySeat)] || '' : ''

	return {
		winner: state.winner || '',
		civilianWord: wordPair.civilian_word || '',
		undercoverWord: wordPair.undercover_word || '',
		undercoverSeats,
		eliminatedSeats: Array.isArray(state.eliminated_seats) ? state.eliminated_seats.map(Number) : [],
		rounds: Number(state.round || 1),
		mySeat,
		myRole,
		iWin: Boolean(myRole) && myRole === state.winner
	}
}

async function buildRecord(room = {}, { createUid = '', now = Date.now() } = {}) {
	const state = room.state || {}
	if (state.phase !== PHASE_SETTLED) {
		return null
	}
	const answer = room.answer && typeof room.answer === 'object' ? room.answer : {}
	const undercoverSeats = Array.isArray(answer.undercover_seats)
		? answer.undercover_seats.map(Number)
		: []
	const eliminatedSeats = Array.isArray(state.eliminated_seats)
		? state.eliminated_seats.map(Number)
		: []

	const seats = sortedSeats(room)
	const players = seats.map((seat) => {
		const seatIndex = Number(seat.seat_index)
		const isUndercover = undercoverSeats.includes(seatIndex)
		const camp = isUndercover ? 'undercover' : 'civilian'
		return {
			uid: String(seat.uid || ''),
			nickname: seat.nickname || '',
			avatar_url: seat.avatar_url || '',
			seat_index: seatIndex,
			is_robot: Boolean(seat.is_robot),
			role: camp,
			score_delta: camp === state.winner ? 10 : 0,
			result: camp === state.winner ? 'win' : 'lose'
		}
	})

	const campText = state.winner === 'undercover' ? '卧底' : '平民'
	return {
		game_type: 'undercover',
		room_id: room._id || '',
		room_code: room.room_code || '',
		players,
		winner_uids: players.filter((item) => item.result === 'win').map((item) => item.uid).filter(Boolean),
		loser_uids: players.filter((item) => item.result === 'lose').map((item) => item.uid).filter(Boolean),
		winner_camp: state.winner || '',
		summary: `${campText}方获胜 · 共 ${Number(state.round || 1)} 轮`,
		detail: {
			undercoverSeats,
			eliminatedSeats,
			rounds: Number(state.round || 1),
			civilianWord: (answer.word_pair || {}).civilian_word || '',
			undercoverWord: (answer.word_pair || {}).undercover_word || '',
			wordPairId: state.word_pair_id || ''
		},
		round_count: Number(state.round || 1),
		duration: Math.max(0, now - Number(state.started_at || now)),
		create_uid: createUid || '',
		create_time: now,
		is_deleted: false
	}
}

module.exports = {
	PHASE_ASSIGN,
	PHASE_SPEAK,
	PHASE_VOTE,
	PHASE_SETTLED,
	MAX_SPEECH_LENGTH,
	handleAction,
	computeTimerPatch,
	cropAnswerForUid,
	buildResult,
	buildRecord,
	// 导出内部工具便于调试与复用
	getSeatIndexByUid,
	isPartyMode,
	isAutoSeat,
	hasAliveHumanSeat,
	resolveAutoStepLimit,
	listPendingRobotVotes,
	pickRobotVoteTarget,
	applySpeak,
	applyVote,
	buildVoteEntry,
	buildLeavePatch,
	resolveAfterVote,
	tallyVotes,
	checkWinner,
	advanceAutoSeats,
	archiveVoteRound,
	buildStartPatch
}
