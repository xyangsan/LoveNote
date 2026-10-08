'use strict'

/** 游戏枚举、超时、TTL 与各种上限常量 */

const GAME_TYPE_UNDERCOVER = 'undercover'
const GAME_TYPE_LANDLORD = 'landlord'
const GAME_TYPE_BOMB = 'bomb'

const ROOM_GAME_TYPE_SET = new Set([GAME_TYPE_UNDERCOVER, GAME_TYPE_LANDLORD])
const ALL_GAME_TYPE_SET = new Set([GAME_TYPE_UNDERCOVER, GAME_TYPE_LANDLORD, GAME_TYPE_BOMB])

/* ---------------- 机器人（测试环境专用能力） ---------------- */

/** 允许「添加机器人」的玩法。斗地主本来就是单人可练，卧底只在测试环境开放 */
const ROBOT_ALLOWED_GAME_TYPES = [GAME_TYPE_LANDLORD, GAME_TYPE_UNDERCOVER]
/** 其中**只在测试环境**开放的玩法：正式环境不显示入口，服务端也直接拒绝 */
const ROBOT_TEST_ONLY_GAME_TYPES = [GAME_TYPE_UNDERCOVER]
/**
 * 测试环境对应的服务空间 ID。
 * 填了就以**服务空间**为准（最可靠，客户端伪造不了）；留空则退回客户端上报的 envVersion（软校验）。
 */
const TEST_ENV_SPACE_IDS = []

const ROOM_STATUS_WAITING = 'waiting'
const ROOM_STATUS_PLAYING = 'playing'
const ROOM_STATUS_SETTLED = 'settled'
const ROOM_STATUS_CLOSED = 'closed'

const ACTIVE_ROOM_STATUS_LIST = [ROOM_STATUS_WAITING, ROOM_STATUS_PLAYING]

/**
 * 移出玩家后，房间内真人玩家少于此值时自动解散。
 * 值为 1 = 「只剩机器人」（0 人）与「仅剩 1 个人」（1 人）都直接解散 ——
 * 卧底要 4 人、斗地主 3 人，留下 1 人的房间没有意义。
 */
const ROOM_MIN_HUMANS_TO_KEEP = 1

const SEAT_STATUS_WAITING = 'waiting'
const SEAT_STATUS_PLAYING = 'playing'
const SEAT_STATUS_OUT = 'out'
const SEAT_STATUS_FINISHED = 'finished'

const ACTOR_TYPE_USER = 'user'
const ACTOR_TYPE_ROBOT = 'robot'

/** 房间生命周期 */
const ROOM_TTL = 6 * 60 * 60 * 1000
const ROOM_IDLE_TTL = 30 * 60 * 1000
const CONNECTION_IDLE_TTL = 5 * 60 * 1000

/**
 * 云函数构建标记 —— 随房间快照下发给客户端（`serverBuild`），客户端只在变化时打一条日志。
 *
 * 用途：排查「客户端已经是新版、云端还是旧版」这类问题。改了 `api-router` 里任何
 * 影响对局的逻辑（尤其机器人推进、props、投票）后**把这个字符串改掉**，
 * 然后在房间页控制台看 `[game] server build` —— 没变就说明云函数没上传成功。
 */
const GAME_SERVICE_BUILD = '2026-10-08.8'

/** 在线/离线判定窗口 */
const SEAT_ONLINE_WINDOW = 20 * 1000
const HOST_OFFLINE_WINDOW = 60 * 1000
const OFFLINE_TRUSTEE_WINDOW = 30 * 1000

/** 人数 */
const UNDERCOVER_MIN_PLAYERS = 4
const UNDERCOVER_MAX_PLAYERS = 10
const LANDLORD_PLAYER_COUNT = 3

/** 计时（毫秒） */
const LANDLORD_BID_MS = 15 * 1000
const LANDLORD_TURN_MS = 20 * 1000
const UNDERCOVER_SPEAK_MS = 60 * 1000
const UNDERCOVER_VOTE_MS = 45 * 1000

/** 数组与轮询上限 */
const MAX_SPEECHES = 200
/**
 * 投票归档（state.vote_history）最多保留多少轮。
 *
 *为什么需要它：`state.votes` 每开一轮投票就被 `goToVote` 重置为 []，
 * 结算后历史票箱就丢了，前端无法「展示完整记录」。
 * 归档后每轮一条（含该轮所有人的票 + 淘汰结果），前端按轮次分组渲染时间线。
 * 轮数本身受 MAX_ROUNDS_SAFETY 限制，这里留一倍余量即可。
 */
const MAX_VOTE_HISTORY = 20
const MAX_AUTO_ACTIONS = 20
const MAX_PLAYED_HISTORY = 8
const MAX_LANDLORD_LOG = 40
const MAX_CONNECTIONS_PER_ROOM = 50
const MAX_AUTO_ACTION_BEFORE_TRUSTEE = 2

/** 房间邀请码 */
const ROOM_CODE_LENGTH = 6
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_MAX_RETRY = 16

/** 数字炸弹（仅用于 reportRecord 校验，游戏本身在客户端跑） */
const BOMB_MIN_LIMIT = 10
const BOMB_MAX_LIMIT = 1000
const BOMB_MAX_GUESS_COUNT = 100
const BOMB_MAX_PLAYERS = 8
const BOMB_MIN_PLAYERS = 1

/** 卧底身份配比（默认值：4-6 人 1 个，7-10 人 2 个） */
function getUndercoverCount(playerCount) {
	const count = Number(playerCount) || 0
	if (count < UNDERCOVER_MIN_PLAYERS) {
		return 0
	}
	return count <= 6 ? 1 : 2
}

/** 该人数下允许的最大卧底数：4-6 人只能 1 个，7-10 人最多 2 个 */
function getMaxUndercoverCount(playerCount) {
	const count = Number(playerCount) || 0
	if (count < UNDERCOVER_MIN_PLAYERS) {
		return 0
	}
	return count <= 6 ? 1 : 2
}

/** 错误码 */
const ERROR_CODES = {
	paramInvalid: 'love-note-game-param-invalid',
	roomNotFound: 'love-note-game-room-not-found',
	roomFull: 'love-note-game-room-full',
	roomPlaying: 'love-note-game-room-playing',
	roomExpired: 'love-note-game-room-expired',
	roomNotWaiting: 'love-note-game-room-not-waiting',
	alreadyInRoom: 'love-note-game-already-in-room',
	notInRoom: 'love-note-game-not-in-room',
	notHost: 'love-note-game-not-host',
	hostOnline: 'love-note-game-host-online',
	notEnoughPlayers: 'love-note-game-not-enough-players',
	tooManyPlayers: 'love-note-game-too-many-players',
	notYourTurn: 'love-note-game-not-your-turn',
	invalidCards: 'love-note-game-invalid-cards',
	cannotBeat: 'love-note-game-cannot-beat',
	versionConflict: 'love-note-game-version-conflict',
	alreadyVoted: 'love-note-game-already-voted',
	alreadyActed: 'love-note-game-already-acted',
	notAlive: 'love-note-game-not-alive',
	guessOutOfRange: 'love-note-game-guess-out-of-range',
	recordNotFound: 'love-note-game-record-not-found',
	wordNotFound: 'love-note-game-word-not-found',
	wordDuplicated: 'love-note-game-word-duplicated',
	presetNotEditable: 'love-note-game-preset-not-editable',
	trusteeInvalid: 'love-note-game-trustee-invalid',
	settling: 'love-note-game-settling',
	noRecord: 'love-note-game-no-record',
	robotNotAllowed: 'love-note-game-robot-not-allowed',
	undercoverCountInvalid: 'love-note-game-undercover-count-invalid'
}

/**
 * 根据「房主设置的卧底数 + 实际参与人数」解出本局卧底数。
 *
 * 规则（用户明确要求）：
 *   - 4-6 人只能 1 个卧底；7-10 人最多 2 个卧底。
 *   - 房主可在开局前手动改卧底数（1 或 2）；若设了 2 但实际不足 7 人，
 *     这里抛 undercoverCountInvalid，提示修改卧底人数。
 *
 * @param {number} requested 房主设置的卧底数（1 或 2），非法/缺省按默认配比
 * @param {number} playerCount 实际参与人数
 * @returns {number} 有效的卧底数
 * @throws {Error} error.errCode = ERROR_CODES.undercoverCountInvalid
 */
function resolveUndercoverCount(requested, playerCount) {
	const count = Number(playerCount) || 0
	const max = getMaxUndercoverCount(count)

	const raw = Number(requested)
	let resolved = getUndercoverCount(count)
	if (Number.isInteger(raw) && raw >= 1 && raw <= 2) {
		resolved = raw
	}

	if (resolved > max) {
		const error = new Error(`当前 ${count} 人最多只能有 ${max} 个卧底，请修改卧底人数`)
		error.errCode = ERROR_CODES.undercoverCountInvalid
		throw error
	}
	return resolved
}

/**
 * 房间级「玩法属性」规格（`love-game-rooms.props`）。
 *
 * 各玩法的房间属性差别很大，**不再往房间文档上摊平成一堆类型专属字段**
 * （历史上是 `undercover_count` / `party_mode` 直接挂在房间根上），
 * 而是统一收进一个 JSON 字段 `props`，由这里按 `game_type` 决定它该有哪些键。
 *
 * - `fields`：每个键的**默认值**。读房间时字段缺失 / 类型不对 / 值非法，一律用默认值填充
 *   （见 `resolveRoomProps`）—— 房间属性是「可自愈」的配置，不因为一个字段丢了就把用户拦在门外。
 * - `labels`：字段的中文名，用于日志与自检。
 * - `check`（可选）：值合法性校验。不通过也按默认值填充（脏数据不进引擎）。
 *
 * 新增玩法时在这里加一条即可，房间表结构不用动。
 */
const ROOM_PROPS_SCHEMA = {
	[GAME_TYPE_UNDERCOVER]: {
		fields: {
			// 本局卧底数（1 或 2），房主开局前可改
			undercoverCount: 1,
			// 聚会模式：开启后不轮流发言，开局即可投票
			partyMode: true
		},
		labels: {
			undercoverCount: '卧底人数',
			partyMode: '聚会模式'
		},
		// 卧底数只允许 1 或 2，其它值（如字符串 '2'、3、-1）都按默认值处理
		check: {
			undercoverCount(value) {
				return value === 1 || value === 2
			},
			partyMode(value) {
				return typeof value === 'boolean'
			}
		}
	},
	// 斗地主暂无房间级玩法属性（底分等在 state 里），留空对象作为扩展位
	[GAME_TYPE_LANDLORD]: {
		fields: {},
		labels: {}
	}
}

/** 某玩法的房间属性规格（未知玩法按空规格兜底） */
function getRoomPropsSchema(gameType = '') {
	return ROOM_PROPS_SCHEMA[String(gameType || '')] || { fields: {}, labels: {} }
}

/** 新建房间时写入的初始 props（全部取默认值） */
function buildDefaultRoomProps(gameType = '') {
	const schema = getRoomPropsSchema(gameType)
	const props = {}
	Object.keys(schema.fields).forEach((key) => {
		props[key] = schema.fields[key]
	})
	return props
}

/**
 * 读取并规整房间属性 —— **字段不一致时用默认值填充，永远返回一份完整可用的 props**。
 *
 * 处理规则（按顺序）：
 *   1. `raw` 不是普通对象（undefined / null / 数组 / 字符串）→ 整份取默认值；
 *   2. 规格内的键：缺失、null、或 `check` 不通过 → 取该键的默认值；
 *   3. 规格外的键：直接丢弃（props 只保留当前玩法认识的键）。
 *
 * 不用它报错拦人 —— 房间属性是可自愈的配置，一个字段丢了不该把用户挡在门外。
 * 被填充的字段会通过 `filled` / `filledLabels` 返回，调用方可据此打日志排查。
 *
 * @returns {{ props: object, filled: string[], filledLabels: string[] }}
 */
function resolveRoomProps(gameType = '', raw = null) {
	const schema = getRoomPropsSchema(gameType)
	const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null
	const props = {}
	const filled = []
	const filledLabels = []

	Object.keys(schema.fields).forEach((key) => {
		const fallback = schema.fields[key]
		const checker = schema.check ? schema.check[key] : null
		const value = source ? source[key] : undefined
		const usable = value !== undefined
			&& value !== null
			&& (typeof checker !== 'function' || checker(value))

		if (usable) {
			props[key] = value
			return
		}
		props[key] = fallback
		filled.push(key)
		filledLabels.push(schema.labels[key] || key)
	})

	return { props, filled, filledLabels }
}

/** 在已有 props 上合并局部修改（用于房主改设置），并保持规格内的键齐全 */
function mergeRoomProps(gameType = '', current = null, partial = {}) {
	const patch = partial && typeof partial === 'object' && !Array.isArray(partial) ? partial : {}
	const merged = Object.assign(
		{},
		current && typeof current === 'object' && !Array.isArray(current) ? current : {}
	)
	Object.keys(patch).forEach((key) => {
		// undefined / null = 「本次不改这个键」，不要用它覆盖已有值
		if (patch[key] !== undefined && patch[key] !== null) {
			merged[key] = patch[key]
		}
	})
	// 统一走 resolveRoomProps：规格外的键丢弃，缺失/非法的键取默认值
	return resolveRoomProps(gameType, merged).props
}

module.exports = {
	GAME_TYPE_UNDERCOVER,
	GAME_TYPE_LANDLORD,
	GAME_TYPE_BOMB,
	ROOM_GAME_TYPE_SET,
	ALL_GAME_TYPE_SET,
	ROOM_STATUS_WAITING,
	ROOM_STATUS_PLAYING,
	ROOM_STATUS_SETTLED,
	ROOM_STATUS_CLOSED,
	ACTIVE_ROOM_STATUS_LIST,
	ROOM_MIN_HUMANS_TO_KEEP,
	SEAT_STATUS_WAITING,
	SEAT_STATUS_PLAYING,
	SEAT_STATUS_OUT,
	SEAT_STATUS_FINISHED,
	ACTOR_TYPE_USER,
	ACTOR_TYPE_ROBOT,
	ROBOT_ALLOWED_GAME_TYPES,
	ROBOT_TEST_ONLY_GAME_TYPES,
	TEST_ENV_SPACE_IDS,
	ROOM_TTL,
	ROOM_IDLE_TTL,
	CONNECTION_IDLE_TTL,
	GAME_SERVICE_BUILD,
	SEAT_ONLINE_WINDOW,
	HOST_OFFLINE_WINDOW,
	OFFLINE_TRUSTEE_WINDOW,
	UNDERCOVER_MIN_PLAYERS,
	UNDERCOVER_MAX_PLAYERS,
	LANDLORD_PLAYER_COUNT,
	LANDLORD_BID_MS,
	LANDLORD_TURN_MS,
	UNDERCOVER_SPEAK_MS,
	UNDERCOVER_VOTE_MS,
	MAX_SPEECHES,
	MAX_VOTE_HISTORY,
	MAX_AUTO_ACTIONS,
	MAX_PLAYED_HISTORY,
	MAX_LANDLORD_LOG,
	MAX_CONNECTIONS_PER_ROOM,
	MAX_AUTO_ACTION_BEFORE_TRUSTEE,
	ROOM_CODE_LENGTH,
	ROOM_CODE_ALPHABET,
	ROOM_CODE_MAX_RETRY,
	BOMB_MIN_LIMIT,
	BOMB_MAX_LIMIT,
	BOMB_MAX_GUESS_COUNT,
	BOMB_MAX_PLAYERS,
	BOMB_MIN_PLAYERS,
	getUndercoverCount,
	getMaxUndercoverCount,
	resolveUndercoverCount,
	ROOM_PROPS_SCHEMA,
	getRoomPropsSchema,
	buildDefaultRoomProps,
	resolveRoomProps,
	mergeRoomProps,
	ERROR_CODES
}
