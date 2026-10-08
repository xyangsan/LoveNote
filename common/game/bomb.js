/**
 * 数字炸弹：纯函数玩法逻辑（零依赖，便于直接跑 node 用例）
 *
 * 规则：
 *  - 可设置范围上限，默认 1~100，最大 1~1000
 *  - 点「开始游戏」后在 [1, rangeLimit] 内随机埋雷
 *  - 轮流输入猜测：命中即爆炸；否则提示偏大/偏小并把区间收窄
 *  - 不建房间、不依赖网络；结算时由页面把战绩上报云端
 */

export const RANGE_PRESETS = [100, 200, 500, 1000]
export const MIN_RANGE_LIMIT = 10
export const MAX_RANGE_LIMIT = 1000
export const DEFAULT_RANGE_LIMIT = 100
export const MIN_PLAYERS = 1
export const MAX_PLAYERS = 8
export const MAX_GUESS_HISTORY = 100

export const PHASE_SETUP = 'setup'
export const PHASE_PLAYING = 'playing'
export const PHASE_EXPLODED = 'exploded'

export const GUESS_RESULT = {
	HIT: 'hit',
	LOW: 'low',
	HIGH: 'high',
	INVALID: 'invalid',
	OUT_OF_RANGE: 'out_of_range',
	NOT_PLAYING: 'not_playing'
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value))
}

export function normalizeRangeLimit(value) {
	const number = parseInt(value, 10)
	if (!Number.isInteger(number)) {
		return DEFAULT_RANGE_LIMIT
	}
	return clamp(number, MIN_RANGE_LIMIT, MAX_RANGE_LIMIT)
}

export function validateRangeLimit(value) {
	const number = parseInt(value, 10)
	if (!Number.isInteger(number)) {
		return {
			ok: false,
			message: '请输入正整数'
		}
	}
	if (number < MIN_RANGE_LIMIT || number > MAX_RANGE_LIMIT) {
		return {
			ok: false,
			message: `范围上限需要在 ${MIN_RANGE_LIMIT}~${MAX_RANGE_LIMIT} 之间`
		}
	}
	return {
		ok: true,
		value: number
	}
}

export function normalizePlayerCount(value) {
	const number = parseInt(value, 10)
	if (!Number.isInteger(number)) {
		return 1
	}
	return clamp(number, MIN_PLAYERS, MAX_PLAYERS)
}

function buildDefaultPlayers(count = 1) {
	const total = normalizePlayerCount(count)
	if (total <= 1) {
		return [{
			name: '我',
			avatarUrl: ''
		}]
	}
	return Array.from({ length: total }).map((item, index) => ({
		name: `玩家${index + 1}`,
		avatarUrl: ''
	}))
}

export function randomInt(min, max) {
	const low = Math.min(min, max)
	const high = Math.max(min, max)
	return low + Math.floor(Math.random() * (high - low + 1))
}

/** 创建一局（处于 setup 阶段） */
export function createBombGame({
	rangeLimit = DEFAULT_RANGE_LIMIT,
	players = null,
	playerCount = 1
} = {}) {
	const limit = normalizeRangeLimit(rangeLimit)
	const list = Array.isArray(players) && players.length
		? players.map((item, index) => ({
			name: String((item && (item.name || item.nickname)) || `玩家${index + 1}`),
			avatarUrl: String((item && (item.avatarUrl || item.avatar_url)) || '')
		})).slice(0, MAX_PLAYERS)
		: buildDefaultPlayers(playerCount)

	return {
		phase: PHASE_SETUP,
		rangeLimit: limit,
		rangeMin: 1,
		rangeMax: limit,
		bombNumber: 0,
		guesses: [],
		players: list,
		currentPlayerIndex: 0,
		startedAt: 0,
		elapsedMs: 0,
		lastResult: null,
		guessCount: 0
	}
}

/** 开始游戏：本地随机埋雷 */
export function startBombGame(game = {}, now = Date.now()) {
	return Object.assign({}, game, {
		phase: PHASE_PLAYING,
		rangeMin: 1,
		rangeMax: Number(game.rangeLimit || DEFAULT_RANGE_LIMIT),
		bombNumber: randomInt(1, Number(game.rangeLimit || DEFAULT_RANGE_LIMIT)),
		guesses: [],
		currentPlayerIndex: 0,
		startedAt: now,
		elapsedMs: 0,
		lastResult: null,
		guessCount: 0
	})
}

export function updateRangeLimit(game = {}, rangeLimit = DEFAULT_RANGE_LIMIT) {
	const limit = normalizeRangeLimit(rangeLimit)
	return Object.assign({}, game, {
		rangeLimit: limit,
		rangeMin: 1,
		rangeMax: limit
	})
}

export function updatePlayers(game = {}, players = []) {
	const list = (Array.isArray(players) ? players : [])
		.map((item, index) => ({
			name: String((item && (item.name || item.nickname)) || `玩家${index + 1}`),
			avatarUrl: String((item && (item.avatarUrl || item.avatar_url)) || '')
		}))
		.slice(0, MAX_PLAYERS)

	return Object.assign({}, game, {
		players: list.length ? list : buildDefaultPlayers(1),
		currentPlayerIndex: 0
	})
}

/**
 * 提交一次猜测
 * @returns {{ game:Object, result:String, message:String }}
 */
export function submitGuess(game = {}, rawValue, now = Date.now()) {
	if (game.phase !== PHASE_PLAYING) {
		return {
			game,
			result: GUESS_RESULT.NOT_PLAYING,
			message: '当前不在游戏中'
		}
	}

	const value = Math.floor(Number(rawValue))
	if (!Number.isFinite(value)) {
		return {
			game,
			result: GUESS_RESULT.INVALID,
			message: '请输入数字'
		}
	}

	if (value < game.rangeMin || value > game.rangeMax) {
		return {
			game,
			result: GUESS_RESULT.OUT_OF_RANGE,
			message: `请输入 ${game.rangeMin} ~ ${game.rangeMax} 之间的数字`
		}
	}

	const entry = {
		playerIndex: Number(game.currentPlayerIndex) || 0,
		value,
		createTime: now
	}
	const guesses = [entry].concat(Array.isArray(game.guesses) ? game.guesses : [])
		.slice(0, MAX_GUESS_HISTORY)
	const guessCount = Number(game.guessCount || 0) + 1

	// 命中炸弹
	if (value === Number(game.bombNumber)) {
		return {
			game: Object.assign({}, game, {
				phase: PHASE_EXPLODED,
				guesses,
				guessCount,
				elapsedMs: Math.max(0, now - Number(game.startedAt || now)),
				lastResult: {
					result: GUESS_RESULT.HIT,
					value,
					playerIndex: entry.playerIndex,
					rangeMin: game.rangeMin,
					rangeMax: game.rangeMax
				}
			}),
			result: GUESS_RESULT.HIT,
			message: '踩中炸弹！'
		}
	}

	// 未命中：提示方向并收窄区间
	const isLow = value < Number(game.bombNumber)
	const rangeMin = isLow ? value + 1 : game.rangeMin
	const rangeMax = isLow ? game.rangeMax : value - 1
	const playerTotal = Math.max(1, (game.players || []).length)

	return {
		game: Object.assign({}, game, {
			guesses,
			guessCount,
			rangeMin,
			rangeMax,
			currentPlayerIndex: (entry.playerIndex + 1) % playerTotal,
			lastResult: {
				result: isLow ? GUESS_RESULT.LOW : GUESS_RESULT.HIGH,
				value,
				playerIndex: entry.playerIndex,
				rangeMin,
				rangeMax
			}
		}),
		result: isLow ? GUESS_RESULT.LOW : GUESS_RESULT.HIGH,
		message: isLow ? `${value} 偏小，炸弹更大` : `${value} 偏大，炸弹更小`
	}
}

/** 重新开一局（保留范围与玩家设置） */
export function restartBombGame(game = {}, now = Date.now()) {
	return startBombGame(game, now)
}

/** 剩余可能数量，用于 UI 提示「还剩 N 种可能」 */
export function getRemainingCount(game = {}) {
	const min = Number(game.rangeMin || 1)
	const max = Number(game.rangeMax || 0)
	return Math.max(0, max - min + 1)
}

/** 结算摘要：上报战绩用 */
export function buildRecordPayload(game = {}) {
	const players = Array.isArray(game.players) && game.players.length
		? game.players
		: buildDefaultPlayers(1)
	const loserIndex = Number((game.lastResult || {}).playerIndex || 0)

	return {
		gameType: 'bomb',
		rangeLimit: Number(game.rangeLimit || DEFAULT_RANGE_LIMIT),
		guessCount: Math.max(1, Number(game.guessCount || 1)),
		players: players.map((item, index) => ({
			name: item.name || `玩家${index + 1}`,
			avatarUrl: item.avatarUrl || ''
		})),
		loserIndex: players.length > 1 ? loserIndex : 0,
		duration: Math.max(0, Number(game.elapsedMs || 0))
	}
}

/** 序列化/反序列化：用于本地中断续玩 */
export function serializeGame(game = {}) {
	try {
		return JSON.stringify({
			phase: game.phase,
			rangeLimit: game.rangeLimit,
			rangeMin: game.rangeMin,
			rangeMax: game.rangeMax,
			bombNumber: game.bombNumber,
			guesses: game.guesses,
			players: game.players,
			currentPlayerIndex: game.currentPlayerIndex,
			startedAt: game.startedAt,
			elapsedMs: game.elapsedMs,
			guessCount: game.guessCount,
			lastResult: game.lastResult
		})
	} catch (error) {
		console.warn('bomb serializeGame failed', error)
		return ''
	}
}

export function deserializeGame(raw) {
	if (!raw) {
		return null
	}
	try {
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
		if (!parsed || parsed.phase !== PHASE_PLAYING) {
			return null
		}
		return Object.assign(createBombGame({ rangeLimit: parsed.rangeLimit }), parsed)
	} catch (error) {
		console.warn('bomb deserializeGame failed', error)
		return null
	}
}
