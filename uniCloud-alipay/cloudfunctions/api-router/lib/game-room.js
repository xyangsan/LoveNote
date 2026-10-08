'use strict'

const {
	gameRoomCollection,
	gameConnectionCollection,
	dbCmd
} = require('./db')
const {
	DEFAULT_NICKNAME
} = require('./constants')
const { getUserById, resolveAvatar } = require('./user-base')
const {
	GAME_TYPE_UNDERCOVER,
	GAME_TYPE_LANDLORD,
	ROOM_GAME_TYPE_SET,
	ROOM_STATUS_WAITING,
	ROOM_STATUS_PLAYING,
	ROOM_STATUS_SETTLED,
	ROOM_STATUS_CLOSED,
	ACTIVE_ROOM_STATUS_LIST,
	ROOM_MIN_HUMANS_TO_KEEP,
	SEAT_STATUS_WAITING,
	SEAT_ONLINE_WINDOW,
	ROOM_TTL,
	UNDERCOVER_MIN_PLAYERS,
	UNDERCOVER_MAX_PLAYERS,
	LANDLORD_PLAYER_COUNT,
	ROOM_CODE_LENGTH,
	ROOM_CODE_ALPHABET,
	ROOM_CODE_MAX_RETRY,
	MAX_SPEECHES,
	MAX_AUTO_ACTIONS,
	GAME_SERVICE_BUILD,
	buildDefaultRoomProps,
	resolveRoomProps,
	ERROR_CODES
} = require('./game-constants')

/** 游戏引擎按需加载，避免互相 require 造成循环依赖 */
function getEngine(gameType) {
	try {
		if (gameType === GAME_TYPE_UNDERCOVER) {
			return require('./undercover-engine')
		}
		if (gameType === GAME_TYPE_LANDLORD) {
			return require('./landlord-engine')
		}
	} catch (error) {
		console.warn('api-router getEngine failed', gameType, error)
	}
	return null
}

function getUpdatedCount(result = {}) {
	const candidates = [
		result.updated,
		result.updatedCount,
		result.modifiedCount,
		result.matchedCount
	].filter((item) => typeof item === 'number')

	return candidates.length ? Math.max(...candidates) : 0
}

function sleep(duration = 0) {
	return new Promise((resolve) => {
		setTimeout(resolve, duration)
	})
}

/* ------------------------------------------------------------------ *
 * 房间邀请码
 * ------------------------------------------------------------------ */

function normalizeRoomCode(value = '') {
	return String(value || '').trim().toUpperCase()
}

function buildRoomCode() {
	let code = ''
	for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
		const position = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
		code += ROOM_CODE_ALPHABET.charAt(position)
	}
	return code
}

async function buildUniqueRoomCode() {
	for (let attempt = 0; attempt < ROOM_CODE_MAX_RETRY; attempt += 1) {
		const code = buildRoomCode()
		const existRes = await gameRoomCollection
			.where({
				room_code: code,
				status: dbCmd.in(ACTIVE_ROOM_STATUS_LIST)
			})
			.limit(1)
			.get()
		if (!existRes || !existRes.data || !existRes.data.length) {
			return code
		}
	}
	// 极端情况下退化为「时间戳后 4 位 + 2 位随机」，仍保证 6 位
	const suffix = String(Date.now()).slice(-4)
	const tail = Math.floor(Math.random() * 90 + 10)
	return `${suffix}${tail}`
}

/* ------------------------------------------------------------------ *
 * 用户快照 / 机器人快照
 * ------------------------------------------------------------------ */

async function buildUserSnapshot(uid = '') {
	const userRecord = uid ? await getUserById(uid) : null
	const avatar = userRecord ? await resolveAvatar(userRecord) : {
		avatarUrl: '',
		avatarFileId: ''
	}

	return {
		uid,
		nickname: (userRecord && (userRecord.nickname || userRecord.username)) || DEFAULT_NICKNAME,
		avatar_url: avatar.avatarUrl || '',
		avatar_file_id: avatar.avatarFileId || ''
	}
}

const ROBOT_NAME_POOL = ['小机灵', '牌神', '幸运星', '阿飞', '豆豆', '老K', '大白', '闪电']

function buildRobotSnapshot(roomId = '', seatIndex = 0) {
	const nickname = ROBOT_NAME_POOL[seatIndex % ROBOT_NAME_POOL.length]
	return {
		uid: `robot_${roomId}_${seatIndex}`,
		nickname,
		avatar_url: '',
		avatar_file_id: ''
	}
}

function isRobotUid(uid = '') {
	return /^robot_/.test(String(uid || ''))
}

/** 机器人座位：以 is_robot 标记为准，uid 前缀兜底（老数据可能只写了其中之一） */
function isRobotSeat(seat = {}) {
	if (!seat || typeof seat !== 'object') {
		return false
	}
	return Boolean(seat.is_robot) || isRobotUid(seat.uid)
}

/* ------------------------------------------------------------------ *
 * 房间人数与善后规则（纯函数，便于脱离云环境验证）
 * ------------------------------------------------------------------ */

/** 座位数组里已入座的人（有 uid 的座位） */
function joinedSeatList(seats = []) {
	return normalizeSeats(seats).filter((seat) => String(seat.uid || '').trim())
}

/** 房间里还有几位**真人**玩家（机器人不算） */
function countHumanSeats(seats = []) {
	return joinedSeatList(seats).filter((seat) => !isRobotSeat(seat)).length
}

/**
 * 移出玩家后房间是否应当自动解散。
 * 规则：房间内真人玩家 ≤ ROOM_MIN_HUMANS_TO_KEEP 时解散 ——
 * 同时覆盖「只剩机器人」（0 人）与「仅剩 1 个人」（1 人）两种情形。
 */
function shouldDissolveRoom(seats = []) {
	return countHumanSeats(seats) <= ROOM_MIN_HUMANS_TO_KEEP
}

/** 房主离开后由谁接手：优先第一位真人，没有真人就退而求其次取第一个座位 */
function pickNextHost(seats = []) {
	const joined = joinedSeatList(seats)
	if (!joined.length) {
		return null
	}
	return joined.find((seat) => !isRobotSeat(seat)) || joined[0]
}

/* ------------------------------------------------------------------ *
 * 座位工具
 * ------------------------------------------------------------------ */

function normalizeSeats(seats = []) {
	return Array.isArray(seats)
		? seats.filter((item) => item && typeof item === 'object')
		: []
}

function getJoinedSeats(room = {}) {
	return normalizeSeats(room.seats).filter((seat) => String(seat.uid || '').trim())
}

function getPlayerCount(room = {}) {
	return getJoinedSeats(room).length
}

function getSeatIndexByUid(room = {}, uid = '') {
	const target = String(uid || '').trim()
	if (!target) {
		return -1
	}
	const seats = normalizeSeats(room.seats)
	for (let index = 0; index < seats.length; index += 1) {
		if (String(seats[index].uid || '') === target) {
			return Number(seats[index].seat_index) >= 0
				? Number(seats[index].seat_index)
				: index
		}
	}
	return -1
}

function getSeatByUid(room = {}, uid = '') {
	const seatIndex = getSeatIndexByUid(room, uid)
	if (seatIndex < 0) {
		return null
	}
	return getSeatByIndex(room, seatIndex)
}

function getSeatByIndex(room = {}, seatIndex = -1) {
	const target = Number(seatIndex)
	return normalizeSeats(room.seats).find(
		(item) => Number(item.seat_index) === target
	) || null
}

function getNextFreeSeatIndex(room = {}, maxPlayers = 0) {
	const seats = normalizeSeats(room.seats)
	const limit = Number(maxPlayers) || Number(room.max_players) || seats.length
	const used = new Set(seats.map((item) => Number(item.seat_index)))
	for (let index = 0; index < limit; index += 1) {
		if (!used.has(index)) {
			return index
		}
	}
	return -1
}

function buildSeat({
	seatIndex = 0,
	snapshot = {},
	isRobot = false,
	now = Date.now()
} = {}) {
	return {
		seat_index: seatIndex,
		uid: snapshot.uid || '',
		nickname: snapshot.nickname || DEFAULT_NICKNAME,
		avatar_url: snapshot.avatar_url || '',
		avatar_file_id: snapshot.avatar_file_id || '',
		is_robot: Boolean(isRobot),
		ready: false,
		score: 0,
		status: SEAT_STATUS_WAITING,
		last_seen: now
	}
}

function replaceSeat(room = {}, nextSeat = {}) {
	const seats = normalizeSeats(room.seats).map((item) => (
		Number(item.seat_index) === Number(nextSeat.seat_index) ? nextSeat : item
	))
	return seats
}

function removeSeatByIndex(room = {}, seatIndex = -1) {
	return normalizeSeats(room.seats).filter(
		(item) => Number(item.seat_index) !== Number(seatIndex)
	)
}

function removeSeatByUid(room = {}, uid = '') {
	const target = String(uid || '').trim()
	return normalizeSeats(room.seats).filter(
		(item) => String(item.uid || '') !== target
	)
}

/* ------------------------------------------------------------------ *
 * 在线状态：统一走 love-game-connections（与传输方式无关）
 * ------------------------------------------------------------------ */

/**
 * 刷新在线信标。WS 模式由 game-ws 维护真实连接行；
 * 降级轮询模式用 `poll:<uid>` 作为确定性 connection_id，避免行数膨胀。
 */
async function beaconPresence(uid = '', roomId = '', now = Date.now()) {
	if (!uid || isRobotUid(uid)) {
		return
	}
	const connectionId = `poll:${uid}`
	try {
		const existRes = await gameConnectionCollection
			.where({ connection_id: connectionId })
			.limit(1)
			.get()
		const exist = existRes && existRes.data && existRes.data[0] ? existRes.data[0] : null
		if (exist) {
			await gameConnectionCollection.doc(exist._id).update({
				uid,
				room_id: roomId || '',
				last_ping: now
			})
			return
		}
		await gameConnectionCollection.add({
			connection_id: connectionId,
			uid,
			room_id: roomId || '',
			last_ping: now,
			create_time: now
		})
	} catch (error) {
		// 唯一索引冲突等并发情况直接忽略：在线状态不是强一致需求
		console.warn('api-router beaconPresence failed', error)
	}
}

async function getOnlineUidSet(roomId = '', now = Date.now()) {
	if (!roomId) {
		return new Set()
	}
	try {
		const res = await gameConnectionCollection
			.where({
				room_id: roomId,
				last_ping: dbCmd.gte(now - SEAT_ONLINE_WINDOW)
			})
			.field({ uid: true })
			.limit(50)
			.get()
		const list = res && Array.isArray(res.data) ? res.data : []
		return new Set(list.map((item) => String(item.uid || '')).filter(Boolean))
	} catch (error) {
		console.warn('api-router getOnlineUidSet failed', error)
		return new Set()
	}
}

function isSeatOnline(seat = {}, onlineUidSet = new Set(), now = Date.now()) {
	if (!seat) {
		return false
	}
	if (isRobotSeat(seat)) {
		return true
	}
	const uid = String(seat.uid || '')
	if (!uid) {
		return false
	}
	if (onlineUidSet && typeof onlineUidSet.has === 'function' && onlineUidSet.has(uid)) {
		return true
	}
	// 兜底：无连接记录时用座位最近活跃时间判断
	return Number(seat.last_seen || 0) > now - SEAT_ONLINE_WINDOW
}

function isUidOffline(uid = '', onlineUidSet = new Set()) {
	if (!uid || isRobotUid(uid)) {
		return false
	}
	return !(onlineUidSet && typeof onlineUidSet.has === 'function' && onlineUidSet.has(uid))
}

/* ------------------------------------------------------------------ *
 * 房间读取
 * ------------------------------------------------------------------ */

async function getRoomById(roomId = '') {
	const id = String(roomId || '').trim()
	if (!id) {
		return null
	}
	const res = await gameRoomCollection
		.where({
			_id: id,
			is_deleted: false
		})
		.limit(1)
		.get()
	return res && res.data && res.data[0] ? res.data[0] : null
}

async function getRoomByCode(roomCode = '') {
	const code = normalizeRoomCode(roomCode)
	if (!code) {
		return null
	}
	const res = await gameRoomCollection
		.where({
			room_code: code,
			is_deleted: false,
			status: dbCmd.in(ACTIVE_ROOM_STATUS_LIST)
		})
		.orderBy('create_time', 'desc')
		.limit(1)
		.get()
	return res && res.data && res.data[0] ? res.data[0] : null
}

async function getActiveRoomByUid(uid = '') {
	if (!uid) {
		return null
	}
	try {
		const res = await gameRoomCollection
			.where({
				'seats.uid': uid,
				is_deleted: false,
				status: dbCmd.in(ACTIVE_ROOM_STATUS_LIST)
			})
			.orderBy('update_time', 'desc')
			.limit(1)
			.get()
		return res && res.data && res.data[0] ? res.data[0] : null
	} catch (error) {
		console.warn('api-router getActiveRoomByUid failed', error)
		return null
	}
}

function isRoomExpired(room = {}, now = Date.now()) {
	if (!room) {
		return true
	}
	if (room.status === ROOM_STATUS_CLOSED) {
		return true
	}
	return Number(room.expire_at || 0) > 0 && Number(room.expire_at) < now
}

function buildActiveRoomBrief(room = {}) {
	if (!room || !room._id) {
		return null
	}
	return {
		roomId: room._id,
		roomCode: room.room_code || '',
		gameType: room.game_type || '',
		status: room.status || '',
		round: Number(room.round || 0),
		playerCount: getPlayerCount(room),
		maxPlayers: Number(room.max_players || 0),
		version: Number(room.version || 0),
		updateTime: Number(room.update_time || 0)
	}
}

/* ------------------------------------------------------------------ *
 * 房间创建与写入
 * ------------------------------------------------------------------ */

function buildInitialState(gameType) {
	if (gameType === GAME_TYPE_UNDERCOVER) {
		return {
			phase: 'assign',
			speak_order: [],
			current_speaker_seat: -1,
			spoken_seats: [],
			speeches: [],
			vote_round: 0,
			votes: [],
			last_vote_result: null,
			alive_seats: [],
			word_pair_id: '',
			civilian_word_public: '',
			round: 0,
			winner: '',
			turn_deadline: 0,
			timer_seq: 0,
			auto_actions: []
		}
	}
	if (gameType === GAME_TYPE_LANDLORD) {
		return {
			phase: 'dealing',
			base_score: 1,
			multiplier: 1,
			landlord_seat: -1,
			current_seat: -1,
			turn_deadline: 0,
			timer_seq: 0,
			bids: {},
			bid_first_seat: -1,
			last_play: null,
			pass_count: 0,
			bomb_count: 0,
			cards_left: {},
			played_counts: {},
			winner_seat: -1,
			winner_camp: '',
			score_delta: {},
			trustee_seats: [],
			trustee_meta: {},
			auto_actions: [],
			history: [],
			started_at: 0,
			settled_at: 0
		}
	}
	return {}
}

function resolveMaxPlayers(gameType, requested) {
	if (gameType === GAME_TYPE_LANDLORD) {
		return LANDLORD_PLAYER_COUNT
	}
	if (gameType === GAME_TYPE_UNDERCOVER) {
		const value = Number(requested)
		if (!Number.isFinite(value)) {
			return UNDERCOVER_MAX_PLAYERS
		}
		const rounded = Math.floor(value)
		return Math.min(
			UNDERCOVER_MAX_PLAYERS,
			Math.max(UNDERCOVER_MIN_PLAYERS, rounded)
		)
	}
	return 0
}

async function createRoomRecord({
	gameType,
	hostUid,
	hostSnapshot,
	requestedMaxPlayers,
	now = Date.now()
} = {}) {
	if (!ROOM_GAME_TYPE_SET.has(gameType)) {
		throw {
			errCode: ERROR_CODES.paramInvalid,
			errMsg: '不支持的游戏类型'
		}
	}

	const roomCode = await buildUniqueRoomCode()
	const maxPlayers = resolveMaxPlayers(gameType, requestedMaxPlayers)
	const seat = buildSeat({
		seatIndex: 0,
		snapshot: hostSnapshot,
		isRobot: false,
		now
	})

	const roomData = {
		room_code: roomCode,
		game_type: gameType,
		status: ROOM_STATUS_WAITING,
		host_uid: hostUid,
		max_players: maxPlayers,
		// 玩法专属的房间属性统一收在这个 JSON 里，按 game_type 由 ROOM_PROPS_SCHEMA 决定内容
		// （卧底 = { undercoverCount, partyMode }；斗地主暂为空对象）
		props: buildDefaultRoomProps(gameType),
		version: 0,
		seats: [seat],
		state: buildInitialState(gameType),
		answer: {},
		round: 0,
		expire_at: now + ROOM_TTL,
		create_time: now,
		update_time: now,
		is_deleted: false
	}

	const result = await gameRoomCollection.add(roomData)
	return Object.assign({}, roomData, {
		_id: result.id
	})
}

/**
 * 把 state/answer 这类「嵌套对象」**显式展平成点号路径**再写库。
 *
 * ⚠️ 必须自己展平的原因（踩过的坑）：支付宝云的数据库 SDK 会把嵌套对象**自动展开**成点号路径，
 * 于是 `update({ state: { last_vote_result: { counts: {...} } } })` 实际发出去的是
 * `$set: { 'state.last_vote_result.counts': {...} }`。而 MongoDB **不允许在「值为 null 的字段」上
 * 创建子字段**，只要历史上有人往 `state.xxx` 写过 `null`（各 engine 用 `null` 表示「本轮没有」，
 * 例如 `last_vote_result: null` / `last_play: null`），下一次写它的子字段就会整条 update 失败：
 *
 *   write exception: write errors: [Cannot create field 'counts' in element {last_vote_result: null}]
 *
 * 由此带来的两个连锁问题：
 *   1. 房间再也推进不了（真人投票成功、机器人投票提交失败 → 永远停在 1/N 票）；
 *   2. 状态变更全军覆没（一次 update 里所有字段一起失败）。
 *
 * 所以这里统一处理：
 *   - 值为 `null` → 改成**显式删除该路径**（`dbCmd.remove()`），字段回到「不存在」；
 *     之后写子字段时 Mongo 会自动创建中间对象。读侧 `if (!state.last_play)` 语义完全不变。
 *   - 数组 / 标量 / dbCmd 命令 → 原样作为叶子写入（数组是整体覆盖，与 SDK 行为一致）。
 *   - `undefined` → 跳过（等同于「本次不改」）。
 */
function flattenStateUpdate(prefix = '', value = {}, out = {}) {
	if (!value || typeof value !== 'object' || Array.isArray(value) || isDbCommand(value)) {
		out[prefix] = value
		return out
	}
	Object.keys(value).forEach((key) => {
		const current = value[key]
		if (current === undefined) {
			return
		}
		const path = `${prefix}.${key}`
		if (current === null) {
			// null = 「本次把这个槽位清空」→ 删字段，绝不写 null（见上方注释）
			out[path] = dbCmd.remove()
			return
		}
		flattenStateUpdate(path, current, out)
	})
	return out
}

function isDbCommand(value) {
	return Boolean(value && typeof value === 'object' && typeof value.__op === 'string')
}

function buildCommitUpdate(room = {}, patch = {}, now = Date.now()) {
	const update = {}
	const fields = ['seats', 'status', 'round', 'host_uid', 'props']
	fields.forEach((field) => {
		// ⚠️ null 表示「本次不改这个字段」，绝不能写进 update：
		// 各 engine 里普遍用 `let seats = null` 表示「本轮不动座位」（如平票不淘汰），
		// 若把 null 落库，房间的 seats 会被整片清空 → 所有玩家掉出房间。
		// 需要真正清字段时用 dbCmd.remove()（项目里已有先例），不要用 null。
		if (patch[field] !== undefined && patch[field] !== null) {
			update[field] = patch[field]
		}
	})

	// state / answer 走展平写入（见 flattenStateUpdate 的注释）
	if (patch.state !== undefined && patch.state !== null) {
		flattenStateUpdate('state', patch.state, update)
	}
	if (patch.answer !== undefined && patch.answer !== null) {
		flattenStateUpdate('answer', patch.answer, update)
	}

	if (patch.is_deleted !== undefined) {
		update.is_deleted = patch.is_deleted
	}
	update.update_time = now
	update.expire_at = now + ROOM_TTL
	// version 自增：乐观锁游标 + 推送载荷 + 增量拉取判定
	update.version = dbCmd.inc(1)
	return update
}

/**
 * 乐观锁提交。expectVersion 必须是发起方读到的版本号。
 * requireStatus 用于「只允许从某状态跳变一次」的幂等场景（如 playing -> settled）。
 */
async function commitRoomPatch(room = {}, patch = {}, {
	expectVersion = null,
	requireStatus = ''
} = {}) {
	if (!room || !room._id) {
		return { ok: false, conflict: true, version: 0 }
	}

	const now = Number(patch.now) || Date.now()
	const where = {
		_id: room._id,
		is_deleted: false
	}
	if (Number.isInteger(expectVersion)) {
		where.version = expectVersion
	}
	if (requireStatus) {
		where.status = requireStatus
	}

	const update = buildCommitUpdate(room, patch, now)

	try {
		const result = await gameRoomCollection.where(where).update(update)
		const ok = getUpdatedCount(result) > 0
		return {
			ok,
			conflict: !ok,
			version: ok ? Number(room.version || 0) + 1 : Number(room.version || 0),
			updateTime: now
		}
	} catch (error) {
		// 自愈：库里可能已经存着「值为 null 的槽位」（早期版本写入的 last_vote_result: null 等），
		// 新版已经不再写 null，但老房间要能救回来。报错形如
		//   Cannot create field 'counts' in element {last_vote_result: null}
		// 命中就把那个父字段删掉再重试一次：字段变成「不存在」后，Mongo 会自动重建中间对象。
		const repaired = await repairNullSlot(room, error)
		if (repaired) {
			console.warn('api-router commitRoomPatch repaired null slot', {
				roomId: room._id,
				slot: repaired
			})
			try {
				const retry = await gameRoomCollection.where(where).update(update)
				const ok = getUpdatedCount(retry) > 0
				return {
					ok,
					conflict: !ok,
					version: ok ? Number(room.version || 0) + 1 : Number(room.version || 0),
					updateTime: now,
					repaired
				}
			} catch (retryError) {
				console.warn('api-router commitRoomPatch failed after repair', retryError)
				return { ok: false, conflict: true, version: Number(room.version || 0) }
			}
		}
		console.warn('api-router commitRoomPatch failed', error)
		return { ok: false, conflict: true, version: Number(room.version || 0) }
	}
}

/**
 * 写入失败且报错形如 `Cannot create field 'x' in element {y: null}` 时，
 * 把 state.y / answer.y 删掉（删不存在的路径是空操作），返回被清理的槽位名。
 */
async function repairNullSlot(room = {}, error = null) {
	const message = String(
		(error && (error.errorMessage || error.message || error.errMsg))
		|| (error && error.error && error.error.message)
		|| ''
	)
	if (!/Cannot create field/.test(message)) {
		return ''
	}
	const matched = /in element \{([^:]+):\s*null\}/.exec(message)
	const slot = matched ? String(matched[1] || '').trim() : ''
	if (!slot || !/^[A-Za-z0-9_]+$/.test(slot)) {
		return ''
	}
	try {
		await gameRoomCollection.doc(room._id).update({
			[`state.${slot}`]: dbCmd.remove(),
			[`answer.${slot}`]: dbCmd.remove()
		})
	} catch (repairError) {
		console.warn('api-router repairNullSlot failed', repairError)
		return ''
	}
	return slot
}

/** 仅做时间戳续期（不涉及状态变化，不 inc version） */
async function touchRoom(roomId = '', now = Date.now()) {
	if (!roomId) {
		return
	}
	try {
		await gameRoomCollection.doc(roomId).update({
			update_time: now,
			expire_at: now + ROOM_TTL
		})
	} catch (error) {
		console.warn('api-router touchRoom failed', error)
	}
}

/**
 * 原子追加一票到 state.votes —— 不走 version 乐观锁，各人投票互不冲突。
 *
 * 投票是「追加」操作，若走整房 state 替换 + expectVersion 乐观锁，多人齐投（或与机器人
 * 自动推进并发）会互相 bump version 导致后提交者撞车。这里用 dbCmd.push 增量追加 + inc(1)
 * version（保证客户端增量同步游标仍推进），并用 where 约束：
 *   - 房间仍在 playing 且 vote 阶段（已结算/进下一轮则追加失败，读回最新即可）；
 *   - 该玩家尚未投过票（'state.votes.voter_seat' 不匹配 = 数组里没有自己的票）。
 *
 * @returns {{ ok: boolean, updated: number }}
 */
async function appendVoteAtomic(room = {}, voteEntry = {}) {
	if (!room || !room._id) {
		return { ok: false, updated: 0 }
	}
	const voterSeat = Number(voteEntry.voter_seat)
	const now = Date.now()
	try {
		const result = await gameRoomCollection.where({
			_id: room._id,
			is_deleted: false,
			status: ROOM_STATUS_PLAYING,
			'state.phase': 'vote',
			'state.votes.voter_seat': dbCmd.neq(voterSeat)
		}).update({
			'state.votes': dbCmd.push(voteEntry),
			version: dbCmd.inc(1),
			update_time: now,
			expire_at: now + ROOM_TTL
		})
		const updated = getUpdatedCount(result)
		return { ok: updated > 0, updated }
	} catch (error) {
		console.warn('api-router appendVoteAtomic failed', error)
		return { ok: false, updated: 0 }
	}
}

/* ------------------------------------------------------------------ *
 * 自动操作流水（断线/超时）
 * ------------------------------------------------------------------ */

function buildAutoAction(room = {}, entry = {}, now = Date.now()) {
	const state = room.state || {}
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

function appendSpeech(room = {}, speech = {}) {
	const state = room.state || {}
	const speeches = Array.isArray(state.speeches) ? state.speeches.slice() : []
	speeches.push(speech)
	while (speeches.length > MAX_SPEECHES) {
		speeches.shift()
	}
	return speeches
}

/* ------------------------------------------------------------------ *
 * 懒计时器：把超时自动推进交给各引擎计算，房间层负责派发与提交
 * ------------------------------------------------------------------ */

async function resolveTimerPatch(room = {}, now = Date.now()) {
	if (!room || room.status !== ROOM_STATUS_PLAYING) {
		return null
	}
	const engine = getEngine(room.game_type)
	if (!engine || typeof engine.computeTimerPatch !== 'function') {
		return null
	}
	try {
		// 在线状态由房间层统一查询后注入，引擎不直接依赖连接表
		const onlineUidSet = await getOnlineUidSet(room._id, now)
		return await engine.computeTimerPatch(room, now, { onlineUidSet })
	} catch (error) {
		console.warn('api-router resolveTimerPatch failed', error)
		return null
	}
}

/* ------------------------------------------------------------------ *
 * 下发裁剪：唯一出口，任何 action 都不允许直接 return 原始 room
 * ------------------------------------------------------------------ */

function buildPublicSeats(room = {}, { onlineUidSet = new Set(), now = Date.now() } = {}) {
	return normalizeSeats(room.seats)
		.slice()
		.sort((left, right) => Number(left.seat_index) - Number(right.seat_index))
		.map((seat) => ({
			seatIndex: Number(seat.seat_index),
			nickname: seat.nickname || DEFAULT_NICKNAME,
			avatarUrl: seat.avatar_url || '',
			isRobot: Boolean(seat.is_robot),
			ready: Boolean(seat.ready),
			score: Number(seat.score || 0),
			seatStatus: seat.status || SEAT_STATUS_WAITING,
			online: isSeatOnline(seat, onlineUidSet, now),
			offlineSeconds: seat.is_robot
				? 0
				: Math.max(0, Math.floor((now - Number(seat.last_seen || now)) / 1000))
		}))
}

function buildMeInfo(room = {}, uid = '') {
	const seatIndex = getSeatIndexByUid(room, uid)
	const state = room.state || {}
	const trusteeSeats = Array.isArray(state.trustee_seats) ? state.trustee_seats.map(Number) : []
	const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats.map(Number) : []
	return {
		seatIndex,
		inRoom: seatIndex >= 0,
		isHost: String(room.host_uid || '') === String(uid || ''),
		isTrustee: seatIndex >= 0 && trusteeSeats.includes(seatIndex),
		alive: seatIndex >= 0 && (!aliveSeats.length || aliveSeats.includes(seatIndex))
	}
}

function cropRoomForUid(room = {}, uid = '', {
	onlineUidSet = new Set(),
	serverTime = Date.now()
} = {}) {
	if (!room || !room._id) {
		return null
	}
	const engine = getEngine(room.game_type)
	const me = buildMeInfo(room, uid)

	let answer = {}
	if (engine && typeof engine.cropAnswerForUid === 'function') {
		answer = engine.cropAnswerForUid(room, uid) || {}
	}

	let result = null
	if (room.status === ROOM_STATUS_SETTLED && engine && typeof engine.buildResult === 'function') {
		result = engine.buildResult(room, uid)
	}

	return {
		roomId: room._id,
		roomCode: room.room_code || '',
		gameType: room.game_type || '',
		status: room.status || '',
		maxPlayers: Number(room.max_players || 0),
		// 玩法专属房间属性：由 game_type 决定内容（卧底 = 卧底人数 + 聚会模式）
		props: resolveRoomProps(room.game_type, room.props).props,
		// 云函数构建标记：客户端据此判断「云端是否已更新到新版」
		serverBuild: GAME_SERVICE_BUILD,
		playerCount: getPlayerCount(room),
		hostSeatIndex: getSeatIndexByUid(room, room.host_uid),
		version: Number(room.version || 0),
		round: Number(room.round || 0),
		serverTime,
		expireAt: Number(room.expire_at || 0),
		seats: buildPublicSeats(room, { onlineUidSet, now: serverTime }),
		state: room.state || {},
		me,
		answer,
		result
	}
}

module.exports = {
	ROOM_STATUS_WAITING,
	ROOM_STATUS_PLAYING,
	ROOM_STATUS_SETTLED,
	ROOM_STATUS_CLOSED,
	ACTIVE_ROOM_STATUS_LIST,
	getEngine,
	getUpdatedCount,
	sleep,
	normalizeRoomCode,
	buildRoomCode,
	buildUniqueRoomCode,
	buildUserSnapshot,
	buildRobotSnapshot,
	isRobotUid,
	isRobotSeat,
	countHumanSeats,
	shouldDissolveRoom,
	pickNextHost,
	normalizeSeats,
	getJoinedSeats,
	getPlayerCount,
	getSeatIndexByUid,
	getSeatByUid,
	getSeatByIndex,
	getNextFreeSeatIndex,
	buildSeat,
	replaceSeat,
	removeSeatByIndex,
	removeSeatByUid,
	beaconPresence,
	getOnlineUidSet,
	isSeatOnline,
	isUidOffline,
	getRoomById,
	getRoomByCode,
	getActiveRoomByUid,
	isRoomExpired,
	buildActiveRoomBrief,
	buildInitialState,
	resolveMaxPlayers,
	createRoomRecord,
	commitRoomPatch,
	appendVoteAtomic,
	touchRoom,
	buildAutoAction,
	appendSpeech,
	resolveTimerPatch,
	buildPublicSeats,
	buildMeInfo,
	cropRoomForUid
}
