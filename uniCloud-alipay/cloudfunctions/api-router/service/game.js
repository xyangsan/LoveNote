'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const {
	gameRoomCollection,
	gameRecordCollection,
	dbCmd
} = require('../lib/db')
const { formatError } = require('../lib/response')
const {
	ROOM_STATUS_WAITING,
	ROOM_STATUS_PLAYING,
	ROOM_STATUS_SETTLED,
	ROOM_STATUS_CLOSED,
	ROOM_TTL,
	BOMB_MIN_LIMIT,
	BOMB_MAX_LIMIT,
	BOMB_MAX_GUESS_COUNT,
	BOMB_MAX_PLAYERS,
	BOMB_MIN_PLAYERS,
	GAME_TYPE_BOMB,
	GAME_TYPE_LANDLORD,
	GAME_TYPE_UNDERCOVER,
	ALL_GAME_TYPE_SET,
	ROBOT_ALLOWED_GAME_TYPES,
	ROBOT_TEST_ONLY_GAME_TYPES,
	resolveRoomProps,
	mergeRoomProps,
	ERROR_CODES
} = require('../lib/game-constants')
const { isTestEnv } = require('../lib/game-env')
const {
	getEngine,
	normalizeRoomCode,
	buildUserSnapshot,
	buildRobotSnapshot,
	getJoinedSeats,
	getSeatIndexByUid,
	getSeatByIndex,
	getNextFreeSeatIndex,
	buildSeat,
	replaceSeat,
	removeSeatByIndex,
	getRoomById,
	getRoomByCode,
	getActiveRoomByUid,
	shouldDissolveRoom,
	pickNextHost,
	isRoomExpired,
	buildActiveRoomBrief,
	createRoomRecord,
	commitRoomPatch,
	appendVoteAtomic,
	touchRoom,
	beaconPresence,
	getOnlineUidSet,
	cropRoomForUid,
	resolveTimerPatch
} = require('../lib/game-room')
const { pushRoomUpdate, pushRoomClosed, pushToUid } = require('../lib/game-push')
const {
	listCategories,
	listWords,
	pickWordPair,
	saveWord,
	deleteWord
} = require('../lib/game-words')

const MAX_TIMER_ROUNDS = 6
const MAX_PLAYER_NAME_LENGTH = 16

function buildError(errCode, errMsg) {
	const error = new Error(errMsg)
	error.errCode = errCode
	error.errMsg = errMsg
	return error
}

function sleep(duration = 0) {
	return new Promise((resolve) => {
		setTimeout(resolve, duration)
	})
}

function applyPatchToRoom(room = {}, patch = {}, commit = {}) {
	const next = Object.assign({}, room)
	const fields = ['state', 'answer', 'seats', 'status', 'round', 'host_uid', 'props']
	fields.forEach((field) => {
		// null = 「本次不改这个字段」（如平票不淘汰时 seats 为 null），绝不能覆盖成 null
		if (patch[field] !== undefined && patch[field] !== null) {
			next[field] = patch[field]
		}
	})
	next.version = Number(commit.version || 0)
	next.update_time = Number(commit.updateTime || Date.now())
	next.expire_at = next.update_time + ROOM_TTL
	return next
}

module.exports = class GameService extends Service {
	async getAuthUid() {
		const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
		return {
			authState,
			uid: authState.authResult.uid
		}
	}

	/* -------------------------------------------------------------- *
	 * 内部工具
	 * -------------------------------------------------------------- */

	async loadRoom(roomId = '') {
		const room = await getRoomById(roomId)
		if (!room) {
			throw buildError(ERROR_CODES.roomNotFound, '房间不存在或已解散')
		}
		if (isRoomExpired(room, Date.now())) {
			throw buildError(ERROR_CODES.roomExpired, '房间已过期，请重新创建')
		}
		return room
	}

	assertInRoom(room = {}, uid = '') {
		const seatIndex = getSeatIndexByUid(room, uid)
		if (seatIndex < 0) {
			throw buildError(ERROR_CODES.notInRoom, '你不在这个房间里')
		}
		return seatIndex
	}

	assertHost(room = {}, uid = '') {
		if (String(room.host_uid || '') !== String(uid || '')) {
			throw buildError(ERROR_CODES.notHost, '只有房主可以执行该操作')
		}
	}

	assertWaiting(room = {}) {
		if (room.status !== ROOM_STATUS_WAITING) {
			throw buildError(ERROR_CODES.roomNotWaiting, '游戏已经开始，无法执行该操作')
		}
	}

	/** 结算落库：只有从 playing 唯一跳变到 settled 的那次提交会走到这里，天然幂等 */
	async writeGameRecord(room = {}, { createUid = '', now = Date.now() } = {}) {
		try {
			const engine = getEngine(room.game_type)
			if (!engine || typeof engine.buildRecord !== 'function') {
				return null
			}
			const recordData = await engine.buildRecord(room, { createUid, now })
			if (!recordData) {
				return null
			}
			const result = await gameRecordCollection.add(recordData)
			return result && result.id ? result.id : null
		} catch (error) {
			console.warn('api-router writeGameRecord failed', error)
			return null
		}
	}

	/**
	 * 连续推进超时/机器人，直到无进展或达到上限。
	 * 每次推进都写入房间并广播，保证所有客户端都能感知。
	 */
	async resolveTimersUntilStable(room = {}) {
		let current = room
		let changed = false
		let lastVersion = Number(room.version || 0)

		for (let round = 0; round < MAX_TIMER_ROUNDS; round += 1) {
			const now = Date.now()
			const patch = await resolveTimerPatch(current, now)
			if (!patch) {
				break
			}

			const requireStatus = patch.status === ROOM_STATUS_SETTLED ? ROOM_STATUS_PLAYING : ''
			const commit = await commitRoomPatch(current, patch, {
				expectVersion: Number(current.version || 0),
				requireStatus
			})

			if (!commit.ok) {
				// 别人抢先写入，读最新状态再判断
				const fresh = await getRoomById(current._id)
				if (!fresh) {
					break
				}
				current = fresh
				continue
			}

			current = applyPatchToRoom(current, patch, commit)
			changed = true
			lastVersion = commit.version

			if (patch.status === ROOM_STATUS_SETTLED) {
				await this.writeGameRecord(current, { createUid: '', now: commit.updateTime })
				await pushRoomUpdate(current._id, commit.version)
				return { room: current, changed: true, version: commit.version }
			}
		}

		if (changed) {
			await pushRoomUpdate(current._id, lastVersion)
		}

		return { room: current, changed, version: lastVersion }
	}

	async buildSnapshot(room = {}, uid = '', {
		changed = true,
		reset = false,
		version = 0,
		serverTime = Date.now()
	} = {}) {
		// 房间属性字段不一致就用默认值填充（不拦人），并打日志便于排查
		this.ensureRoomProps(room)

		const onlineUidSet = await getOnlineUidSet(room._id, serverTime)
		return {
			changed,
			reset,
			version: Number(version || room.version || 0),
			serverTime,
			room: cropRoomForUid(room, uid, { onlineUidSet, serverTime })
		}
	}

	/**
	 * 规整房间的玩法属性（`room.props`）。
	 *
	 * 各玩法的房间属性不同，由 `ROOM_PROPS_SCHEMA`（lib/game-constants.js）按 game_type 定义。
	 * **字段不一致（缺失 / null / 值非法）时用默认值填充**，不报错拦人 ——
	 * 房间属性是可自愈的配置（旧房间没有 props、字段类型写错都能照常跑），
	 * 被填充的字段打一条 warn 日志便于排查。
	 *
	 * @returns {object} 完整可用的属性对象
	 */
	ensureRoomProps(room = {}) {
		const resolved = resolveRoomProps(room.game_type, room.props)
		if (resolved.filled.length) {
			console.warn('api-router ensureRoomProps filled defaults', {
				roomId: room._id || '',
				gameType: room.game_type || '',
				filled: resolved.filled
			})
		}
		return resolved.props
	}

	async runEngineAction({ room, uid, engineAction, params = {} }) {
		const engine = getEngine(room.game_type)
		if (!engine || typeof engine.handleAction !== 'function') {
			throw buildError(ERROR_CODES.paramInvalid, '该游戏暂不支持此操作')
		}

		// 开局 / 出牌等所有玩法动作的咽喉点：属性字段不一致时用默认值填充，
		// 保证引擎读到的一定是「规格内、值合法」的一份完整 props
		const healedProps = this.ensureRoomProps(room)

		const patch = await engine.handleAction({
			room,
			uid,
			action: engineAction,
			params: params || {}
		})

		if (!patch) {
			return { room, changed: false }
		}

		// 顺手把规整后的 props 一起写回：旧房间（没有 props / 字段写错）在第一次操作后即自愈，
		// 不需要额外的迁移脚本
		const commitPatch = Object.assign({}, patch, { props: healedProps })

		const requireStatus = patch.status === ROOM_STATUS_SETTLED ? ROOM_STATUS_PLAYING : ''
		const commit = await commitRoomPatch(room, commitPatch, {
			expectVersion: Number(room.version || 0),
			requireStatus
		})

		if (!commit.ok) {
			throw buildError(ERROR_CODES.versionConflict, '操作冲突，牌桌状态已变化，请重试')
		}

		const nextRoom = applyPatchToRoom(room, commitPatch, commit)

		if (patch.status === ROOM_STATUS_SETTLED) {
			await this.writeGameRecord(nextRoom, { createUid: uid, now: commit.updateTime })
		}

		await pushRoomUpdate(nextRoom._id, commit.version)
		return { room: nextRoom, changed: true, version: commit.version }
	}

	/** 统一的房间写操作收尾：提交 + 广播 + 返回裁剪快照 */
	async commitAndRespond({
		room,
		uid,
		authState,
		patch,
		requireStatus = ''
	}) {
		const commit = await commitRoomPatch(room, patch, {
			expectVersion: Number(room.version || 0),
			requireStatus
		})
		if (!commit.ok) {
			throw buildError(ERROR_CODES.versionConflict, '操作冲突，请重试')
		}

		const nextRoom = applyPatchToRoom(room, patch, commit)
		if (patch.status === ROOM_STATUS_SETTLED) {
			await this.writeGameRecord(nextRoom, { createUid: uid, now: commit.updateTime })
		}
		await pushRoomUpdate(nextRoom._id, commit.version)

		return Object.assign({}, authState.response, {
			errCode: 0,
			data: await this.buildSnapshot(nextRoom, uid, {
				changed: true,
				version: commit.version
			})
		})
	}

	/* -------------------------------------------------------------- *
	 * 房间通用
	 * -------------------------------------------------------------- */

	async createRoom(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const gameType = String(params.gameType || params.game_type || '').trim()

			const hostSnapshot = await buildUserSnapshot(uid)
			const now = Date.now()

			// 同一用户避免多开：**先自动退出原房间，再开新房**。
			// 等待中 / 已结算的房间、以及卧底进行中的房间都能干净退出；
			// 斗地主进行中会保留座位交托管（退不干净），这种情况沿用原房间，避免破坏三人局。
			const activeRoom = await getActiveRoomByUid(uid)
			if (activeRoom && !this.canLeaveRoomCleanly(activeRoom)) {
				await this.resolveTimersUntilStable(activeRoom)
				const refreshed = await getRoomById(activeRoom._id) || activeRoom
				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '你已有一个进行中的房间',
					data: await this.buildSnapshot(refreshed, uid, { changed: true })
				})
			}
			if (activeRoom) {
				const left = await this.performLeave(activeRoom, uid, now)
				if (left.conflict) {
					throw buildError(ERROR_CODES.versionConflict, '正在退出原房间，请再试一次')
				}
			}

			const room = await createRoomRecord({
				gameType,
				hostUid: uid,
				hostSnapshot,
				requestedMaxPlayers: params.maxPlayers,
				now
			})

			await beaconPresence(uid, room._id, now)

			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '房间已创建',
				data: await this.buildSnapshot(room, uid, { changed: true })
			})
		} catch (error) {
			return formatError(error, '创建房间失败')
		}
	}

	async joinRoom(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const roomId = String(params.roomId || '').trim()
			const roomCode = normalizeRoomCode(params.roomCode || params.room_code || '')

			let room = null
			if (roomId) {
				room = await this.loadRoom(roomId)
			} else if (roomCode) {
				room = await getRoomByCode(roomCode)
				if (!room) {
					throw buildError(ERROR_CODES.roomNotFound, '没找到这个房间，检查一下房间号')
				}
				if (isRoomExpired(room, Date.now())) {
					throw buildError(ERROR_CODES.roomExpired, '房间已过期')
				}
			} else {
				throw buildError(ERROR_CODES.paramInvalid, '请填写房间号')
			}

			const now = Date.now()
			const existSeatIndex = getSeatIndexByUid(room, uid)

			// 已在房内：直接返回快照（含重连与中途回到房间）
			if (existSeatIndex >= 0) {
				const resolved = await this.resolveTimersUntilStable(room)
				const latest = await getRoomById(room._id) || resolved.room
				await beaconPresence(uid, room._id, now)
				return Object.assign({}, authState.response, {
					errCode: 0,
					data: await this.buildSnapshot(latest, uid, {
						changed: true,
						version: latest.version
					})
				})
			}

			if (room.status !== ROOM_STATUS_WAITING) {
				throw buildError(ERROR_CODES.roomPlaying, '房间已经开局了，等下一局吧')
			}
			if (getJoinedSeats(room).length >= Number(room.max_players || 0)) {
				throw buildError(ERROR_CODES.roomFull, '房间人数已满')
			}

			// 目标房间已经确认能进，这时才退出原房间 —— 避免「退了旧房却进不去新的」
			const activeRoom = await getActiveRoomByUid(uid)
			if (activeRoom && String(activeRoom._id || '') !== String(room._id || '')) {
				if (!this.canLeaveRoomCleanly(activeRoom)) {
					throw buildError(
						ERROR_CODES.alreadyInRoom,
						'你正在另一局游戏中，先退出那局再加入新房间'
					)
				}
				const left = await this.performLeave(activeRoom, uid, now)
				if (left.conflict) {
					throw buildError(ERROR_CODES.versionConflict, '正在退出原房间，请再试一次')
				}
			}

			const seatIndex = getNextFreeSeatIndex(room, room.max_players)
			if (seatIndex < 0) {
				throw buildError(ERROR_CODES.roomFull, '房间人数已满')
			}

			const snapshot = await buildUserSnapshot(uid)
			const seats = getJoinedSeats(room).concat(buildSeat({
				seatIndex,
				snapshot,
				isRobot: false,
				now
			}))

			const result = await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: { seats }
			})
			await beaconPresence(uid, room._id, now)
			return result
		} catch (error) {
			return formatError(error, '加入房间失败')
		}
	}

	/**
	 * 把用户移出房间并处理善后（解散 / 转移房主 / 广播 / 写战绩）。
	 *
	 * 解散规则：移出后房间内**真人玩家 ≤ ROOM_MIN_HUMANS_TO_KEEP** 时直接解散 ——
	 * 覆盖「只剩机器人」（0 人）与「仅剩 1 个人」（1 人）两种情形；
	 * 座位里只有机器人时同样按「没有真人」处理。
	 *
	 * @param {object} room 当前房间文档
	 * @param {string} uid 要移出的用户
	 * @param {object} options
	 *        now        当前时间
	 *        statePatch 可选 `{ state, status }`，由引擎基于「已移除该座位」的房间算出，
	 *                   与座位变更一起提交（中途退出时把对局修正到可继续 / 已结算）
	 * @returns {{ skipped:boolean, closed:boolean, room:object|null, conflict?:boolean }}
	 */
	async removeUserFromRoom(room = {}, uid = '', { now = Date.now(), statePatch = null } = {}) {
		const seatIndex = getSeatIndexByUid(room, uid)
		if (seatIndex < 0) {
			return { skipped: true, closed: false, room }
		}

		const nextSeats = removeSeatByIndex(room, seatIndex)

		if (shouldDissolveRoom(nextSeats)) {
			const closed = await commitRoomPatch(room, {
				seats: nextSeats,
				status: ROOM_STATUS_CLOSED,
				is_deleted: true,
				now
			}, { expectVersion: Number(room.version || 0) })
			if (closed.ok) {
				await pushRoomClosed(room._id, '房间已解散')
			}
			return { skipped: false, closed: true, room: null }
		}

		const patch = Object.assign({ seats: nextSeats }, statePatch || {})
		// 房主离开 → 把房主交给剩余的第一位真人（没有真人则给第一个座位）
		if (String(room.host_uid || '') === String(uid || '')) {
			const nextHost = pickNextHost(nextSeats)
			if (nextHost) {
				patch.host_uid = nextHost.uid
			}
		}

		const commit = await commitRoomPatch(room, patch, { expectVersion: Number(room.version || 0) })
		if (!commit.ok) {
			return { skipped: false, closed: false, room: null, conflict: true }
		}

		const nextRoom = applyPatchToRoom(room, patch, commit)
		await pushRoomUpdate(nextRoom._id, commit.version)
		if (patch.status === ROOM_STATUS_SETTLED) {
			await this.writeGameRecord(nextRoom, { createUid: '', now: commit.updateTime })
		}
		return { skipped: false, closed: false, room: nextRoom }
	}

	/**
	 * 「真正退出」的统一入口：移除座位 +（进行中时）让引擎把对局状态修正到可继续。
	 * 引擎没提供 `buildLeavePatch` 的玩法（目前是斗地主）进行中不要走这里 —— 见 canLeaveRoomCleanly。
	 */
	async performLeave(room = {}, uid = '', now = Date.now()) {
		const seatIndex = getSeatIndexByUid(room, uid)
		if (seatIndex < 0) {
			return { skipped: true, closed: false, room }
		}

		let statePatch = null
		if (room.status === ROOM_STATUS_PLAYING) {
			const engine = getEngine(room.game_type)
			if (engine && typeof engine.buildLeavePatch === 'function') {
				// 先按「座位已移除」造一个虚拟房间，引擎据此重算发言轮次 / 投票进度 / 胜负
				const virtualRoom = Object.assign({}, room, {
					seats: removeSeatByIndex(room, seatIndex)
				})
				statePatch = engine.buildLeavePatch(virtualRoom, seatIndex, now)
			}
		}

		return this.removeUserFromRoom(room, uid, { now, statePatch })
	}

	/**
	 * 能否「干净地」把人从房间移出（用于创建 / 加入新房间时自动退出原房间）。
	 * 等待中、已结算：座位只是候场或战绩展示，随时可退；
	 * 进行中：只有引擎支持 `buildLeavePatch` 的玩法（卧底）可退，斗地主保留座位交托管。
	 */
	canLeaveRoomCleanly(room = {}) {
		if (!room) {
			return false
		}
		if (room.status === ROOM_STATUS_WAITING || room.status === ROOM_STATUS_SETTLED) {
			return true
		}
		const engine = getEngine(room.game_type)
		return Boolean(engine && typeof engine.buildLeavePatch === 'function')
	}

	async leaveRoom(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			const now = Date.now()

			// 斗地主进行中「离开」等同于掉线：保留座位交由托管代打，
			// 避免破坏三人回合顺序与结算参与人（卧底没有托管，见下）。
			if (!this.canLeaveRoomCleanly(room)) {
				await touchRoom(room._id, now)
				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '对局进行中，已交由托管代打',
					data: {
						closed: false,
						transferredToTrustee: true
					}
				})
			}

			const result = await this.performLeave(room, uid, now)
			if (result.conflict) {
				throw buildError(ERROR_CODES.versionConflict, '操作冲突，请重试')
			}
			if (result.skipped) {
				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '已退出房间',
					data: { closed: false }
				})
			}
			if (result.closed) {
				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '已退出，房间已解散',
					data: { closed: true }
				})
			}

			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '已退出房间',
				data: {
					closed: false,
					version: Number(result.room && result.room.version) || 0
				}
			})
		} catch (error) {
			return formatError(error, '退出房间失败')
		}
	}

	async getRoom(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)

			const resolved = await this.resolveTimersUntilStable(room)
			const latest = await getRoomById(room._id) || resolved.room
			const now = Date.now()
			await beaconPresence(uid, room._id, now)

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: await this.buildSnapshot(latest, uid, {
					changed: true,
					reset: false,
					version: latest.version,
					serverTime: now
				})
			})
		} catch (error) {
			return formatError(error, '获取房间信息失败')
		}
	}

	/**
	 * 增量同步：version 未变时零成本返回，变了则返回完整裁剪快照。
	 * 不做字段级 diff，客户端整体替换，重连/漏推/乱序都被天然覆盖。
	 */
	async syncRoom(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const roomId = String(params.roomId || '').trim()
			const sinceVersion = Number(params.sinceVersion)
			const serverTime = Date.now()

			const headRes = await gameRoomCollection
				.doc(roomId)
				.field({ version: true, status: true, is_deleted: true, expire_at: true })
				.get()

			const head = headRes && headRes.data && headRes.data[0] ? headRes.data[0] : null
			if (!head || head.is_deleted) {
				throw buildError(ERROR_CODES.roomNotFound, '房间不存在或已解散')
			}
			if (Number(head.expire_at || 0) > 0 && Number(head.expire_at) < serverTime) {
				throw buildError(ERROR_CODES.roomExpired, '房间已过期')
			}

			// 先登记在线信标（不写房间、不 inc version）
			await beaconPresence(uid, roomId, serverTime)

			const serverVersion = Number(head.version || 0)
			// force=true：即使 version 没变也要跑一遍推进逻辑。
			// 客户端只在「发现还有机器人没投票」时才会这样调，用于兜底：
			// 万一上一次投票请求里的机器人推进刚好没生效，这里的下一次同步能把它补上，
			// 房间不会永远卡在「真人投完了、机器人一动不动」。
			const force = params.force === true
			if (!force && Number.isFinite(sinceVersion) && sinceVersion === serverVersion) {
				return Object.assign({}, authState.response, {
					errCode: 0,
					data: {
						changed: false,
						reset: false,
						version: serverVersion,
						serverTime
					}
				})
			}

			const room = await this.loadRoom(roomId)
			this.assertInRoom(room, uid)

			// 客户端游标超前（房间被重建 / 换设备复用旧缓存）→ 强制 reset 重建
			const reset = Number.isFinite(sinceVersion) && sinceVersion > Number(room.version || 0)

			const resolved = await this.resolveTimersUntilStable(room)
			let latest = await getRoomById(room._id) || resolved.room
			if (force) {
				latest = await this.advanceRobotSeats(latest)
			}

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: await this.buildSnapshot(latest, uid, {
					// 与客户端游标比对，避免 force 推进没产生变化时让页面做一次空刷新
					changed: Number(latest.version || 0) !== sinceVersion,
					reset,
					version: latest.version,
					serverTime
				})
			})
		} catch (error) {
			return formatError(error, '同步房间失败')
		}
	}

	/** 「继续对局」入口：查我仍在参与且未结束的房间 */
	async getActiveRoom() {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await getActiveRoomByUid(uid)
			if (!room) {
				return Object.assign({}, authState.response, {
					errCode: 0,
					data: { room: null }
				})
			}
			if (isRoomExpired(room, Date.now())) {
				return Object.assign({}, authState.response, {
					errCode: 0,
					data: { room: null }
				})
			}
			return Object.assign({}, authState.response, {
				errCode: 0,
				data: { room: buildActiveRoomBrief(room) }
			})
		} catch (error) {
			return formatError(error, '获取进行中的对局失败')
		}
	}

	async setReady(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			const seatIndex = this.assertInRoom(room, uid)
			this.assertWaiting(room)

			const seat = getSeatByIndex(room, seatIndex)
			if (!seat) {
				throw buildError(ERROR_CODES.notInRoom, '你不在这个房间里')
			}

			const nextSeat = Object.assign({}, seat, {
				ready: params.ready === undefined ? !seat.ready : Boolean(params.ready)
			})

			return await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: { seats: replaceSeat(room, nextSeat) }
			})
		} catch (error) {
			return formatError(error, '更新准备状态失败')
		}
	}

	async addRobot(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)
			this.assertWaiting(room)

			// 允许加机器人的玩法（斗地主单人可练 + 卧底测试环境凑人）
			if (ROBOT_ALLOWED_GAME_TYPES.indexOf(room.game_type) < 0) {
				throw buildError(ERROR_CODES.paramInvalid, '该游戏暂不支持添加机器人')
			}
			// 只在测试环境开放的玩法：正式环境直接拒绝（客户端也会隐藏入口，这里是服务端兜底）
			if (
				ROBOT_TEST_ONLY_GAME_TYPES.indexOf(room.game_type) >= 0
				&& !isTestEnv(this.ctx.context, params)
			) {
				throw buildError(ERROR_CODES.robotNotAllowed, '正式环境不支持添加机器人')
			}

			const now = Date.now()
			const wantCount = Math.max(1, Math.min(2, parseInt(params.count, 10) || 1))
			let seats = getJoinedSeats(room)

			for (let index = 0; index < wantCount; index += 1) {
				if (seats.length >= Number(room.max_players || 0)) {
					break
				}
				const seatIndex = getNextFreeSeatIndex(
					Object.assign({}, room, { seats }),
					room.max_players
				)
				if (seatIndex < 0) {
					break
				}
				seats = seats.concat(buildSeat({
					seatIndex,
					snapshot: buildRobotSnapshot(room._id, seatIndex),
					isRobot: true,
					now
				}))
			}

			return await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: { seats }
			})
		} catch (error) {
			return formatError(error, '添加机器人失败')
		}
	}

	async removeRobot(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)
			this.assertWaiting(room)

			const seatIndex = Number(params.seatIndex)
			const seat = getSeatByIndex(room, seatIndex)
			if (!seat || !seat.is_robot) {
				throw buildError(ERROR_CODES.paramInvalid, '该座位不是机器人')
			}

			return await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: { seats: removeSeatByIndex(room, seatIndex) }
			})
		} catch (error) {
			return formatError(error, '移除机器人失败')
		}
	}

	async kickPlayer(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)
			this.assertWaiting(room)

			const seatIndex = Number(params.seatIndex)
			const seat = getSeatByIndex(room, seatIndex)
			if (!seat || !String(seat.uid || '').trim()) {
				throw buildError(ERROR_CODES.paramInvalid, '该座位没有玩家')
			}
			if (String(seat.uid) === String(uid)) {
				throw buildError(ERROR_CODES.paramInvalid, '不能移除自己')
			}

			const result = await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: { seats: removeSeatByIndex(room, seatIndex) }
			})

			if (!seat.is_robot) {
				await pushToUid(seat.uid, {
					type: 'room:kicked',
					roomId: room._id,
					reason: '你已被房主移出房间'
				})
			}

			return result
		} catch (error) {
			return formatError(error, '移出玩家失败')
		}
	}

	/** 房主掉线后由其它玩家接管（先到先得 + 乐观锁） */
	async claimHost(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)

			if (String(room.host_uid || '') === String(uid || '')) {
				return Object.assign({}, authState.response, {
					errCode: 0,
					errMsg: '你已经是房主',
					data: await this.buildSnapshot(room, uid, { changed: true })
				})
			}

			const now = Date.now()
			const onlineUidSet = await getOnlineUidSet(room._id, now)
			const hostIndex = getSeatIndexByUid(room, room.host_uid)
			const hostSeat = hostIndex >= 0 ? getSeatByIndex(room, hostIndex) : null
			const hostOnline = hostSeat && (hostSeat.is_robot || onlineUidSet.has(String(hostSeat.uid || '')))

			if (hostOnline) {
				throw buildError(ERROR_CODES.hostOnline, '房主还在线，无需接管')
			}

			return await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: { host_uid: uid }
			})
		} catch (error) {
			return formatError(error, '接管房主失败')
		}
	}

	async closeRoom(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)

			const commit = await commitRoomPatch(room, {
				status: ROOM_STATUS_CLOSED,
				is_deleted: true
			}, { expectVersion: Number(room.version || 0) })

			if (!commit.ok) {
				throw buildError(ERROR_CODES.versionConflict, '操作冲突，请重试')
			}

			await pushRoomClosed(room._id, '房主已解散房间')

			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '房间已解散',
				data: { roomId: room._id, closed: true }
			})
		} catch (error) {
			return formatError(error, '解散房间失败')
		}
	}

	/* -------------------------------------------------------------- *
	 * 谁是卧底
	 * -------------------------------------------------------------- */

	/**
	 * 房主设置卧底数量（1 或 2）。
	 * 仅等待阶段可改；设 2 个要求实际参与 ≥7 人的强校验放在开局（resolveUndercoverCount），
	 * 这里允许先设 2、等人到齐，开局时人数不够会提示「修改卧底人数」。
	 */
	async setUndercoverCount(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)
			this.assertWaiting(room)

			if (room.game_type !== GAME_TYPE_UNDERCOVER) {
				throw buildError(ERROR_CODES.paramInvalid, '仅谁是卧底支持设置卧底人数')
			}

			const count = Math.min(2, Math.max(1, parseInt(params.count, 10) || 1))

			return await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: {
					// props 是全量写回：先按规格把当前属性补齐，再合并本次修改
					props: mergeRoomProps(room.game_type, room.props, { undercoverCount: count })
				}
			})
		} catch (error) {
			return formatError(error, '设置卧底人数失败')
		}
	}

	/**
	 * 房主开关「聚会模式」。
	 * 开启（默认）：开局后不轮流发言，所有存活玩家直接投票，投完即判定本轮与整局结果；
	 * 关闭：走经典流程 —— 轮流发言 → 投票。
	 * 只允许房主在等待阶段修改（开局后对局流程已固定，不能再切）。
	 */
	async setPartyMode(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)
			this.assertWaiting(room)

			if (room.game_type !== GAME_TYPE_UNDERCOVER) {
				throw buildError(ERROR_CODES.paramInvalid, '仅谁是卧底支持聚会模式')
			}

			return await this.commitAndRespond({
				room,
				uid,
				authState,
				patch: {
					props: mergeRoomProps(room.game_type, room.props, { partyMode: params.enabled !== false })
				}
			})
		} catch (error) {
			return formatError(error, '设置聚会模式失败')
		}
	}

	async undercoverStart(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)
			this.assertWaiting(room)

			const result = await this.runEngineAction({
				room,
				uid,
				engineAction: 'start',
				params
			})

			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '游戏开始',
				data: await this.buildSnapshot(result.room, uid, {
					changed: true,
					version: result.version
				})
			})
		} catch (error) {
			return formatError(error, '开始游戏失败')
		}
	}

	async undercoverSpeak(params = {}) {
		return this.handleUndercoverAction('speak', params, '发言失败', { retryOnConflict: 1 })
	}

	async undercoverSkipSpeak(params = {}) {
		return this.handleUndercoverAction('skipSpeak', params, '跳过发言失败', { retryOnConflict: 1 })
	}

	async undercoverVote(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			const seatIndex = this.assertInRoom(room, uid)

			const engine = getEngine(room.game_type)
			if (!engine || typeof engine.buildVoteEntry !== 'function' || typeof engine.resolveAfterVote !== 'function') {
				throw buildError(ERROR_CODES.paramInvalid, '该游戏暂不支持此操作')
			}

			const targetSeat = Number(params.targetSeat)
			if (!Number.isInteger(targetSeat)) {
				throw buildError(ERROR_CODES.paramInvalid, '请选择要投票的玩家')
			}

			// 1. 先推进（可能有机器人还没投票），再读最新
			const resolved = await this.resolveTimersUntilStable(room)
			let latest = await getRoomById(room._id) || resolved.room

			// 2. 确保本人这一票落地（原子追加优先，失败自动退回乐观锁，绝不静默丢弃）
			latest = await this.castVoteForSeat(latest, uid, seatIndex, targetSeat)

			// 3. 已经有人投过票了 → 让房间里的机器人自动跟投
			latest = await this.advanceRobotSeats(latest)

			// 4. 票齐 → 结算本轮，并判定整局是否结束
			latest = await getRoomById(room._id) || latest
			const state = latest.state || {}
			const aliveSeats = Array.isArray(state.alive_seats) ? state.alive_seats : []
			const votes = Array.isArray(state.votes) ? state.votes : []

			if (state.phase === 'vote' && votes.length >= aliveSeats.length) {
				// 结算幂等：多个「最后一票」并发时只有一个能成功（乐观锁），其余读回最新即可
				const settlePatch = engine.resolveAfterVote(latest, state, Date.now())
				const requireStatus = settlePatch && settlePatch.status === 'settled' ? ROOM_STATUS_PLAYING : ''
				const commit = await commitRoomPatch(latest, settlePatch, {
					expectVersion: Number(latest.version || 0),
					requireStatus
				})
				if (commit.ok) {
					const nextRoom = applyPatchToRoom(latest, settlePatch, commit)
					if (settlePatch.status === ROOM_STATUS_SETTLED) {
						await this.writeGameRecord(nextRoom, { createUid: uid, now: commit.updateTime })
					}
					await pushRoomUpdate(nextRoom._id, commit.version)
					return Object.assign({}, authState.response, {
						errCode: 0,
						data: await this.buildSnapshot(nextRoom, uid, {
							changed: true,
							version: commit.version
						})
					})
				}
				latest = await getRoomById(room._id) || latest
			}

			// 5. 返回最新快照（已含机器人刚刚投出的票）
			latest = await getRoomById(room._id) || latest
			return Object.assign({}, authState.response, {
				errCode: 0,
				data: await this.buildSnapshot(latest, uid, {
					changed: true,
					version: latest.version
				})
			})
		} catch (error) {
			return formatError(error, '投票失败')
		}
	}

	/** 某人本轮的票是否已落库 */
	seatHasVoted(room = {}, seatIndex = -1) {
		const state = room.state || {}
		const votes = Array.isArray(state.votes) ? state.votes : []
		return votes.some((vote) => Number(vote.voter_seat) === Number(seatIndex))
	}

	/**
	 * 确保「某人这一票」一定落库。
	 *
	 * 两条路：
	 *   1. 原子追加（appendVoteAtomic：把一票 push 进 state.votes）—— 不带 version 乐观锁，
	 *      多人齐投互不冲突，是主路径；
	 *   2. **兜底**：原子追加失败（嵌套数组写入不被支持、where 不匹配等）时退回整房乐观锁提交
	 *      （handleUndercoverAction('vote') 自带冲突自动重试）。
	 *
	 * 早期版本在第 2 步直接抛 versionConflict，结果是「票没记上 + 机器人也就不会跟投」，
	 * 客户端只看到一句「手慢了」。现在无论如何都要让这一票落地。
	 */
	async castVoteForSeat(room = {}, uid = '', seatIndex = -1, targetSeat = -1) {
		const engine = getEngine(room.game_type)
		let latest = room

		// 已经投过（重复点击 / 网络重发）→ 幂等返回
		if (this.seatHasVoted(latest, seatIndex)) {
			return latest
		}

		// 主路径：原子追加
		if (typeof engine.buildVoteEntry === 'function' && typeof appendVoteAtomic === 'function') {
			try {
				const entry = engine.buildVoteEntry(latest, seatIndex, targetSeat, Date.now())
				const append = await appendVoteAtomic(latest, entry)
				if (append.ok) {
					const fresh = await getRoomById(latest._id)
					if (fresh && this.seatHasVoted(fresh, seatIndex)) {
						// 真人这一票已经落库 → 广播给房间其他人。
						// ⚠️ 原子追加不走 resolveTimersUntilStable，若不在这里补广播，
						// 纯真人房间（无机器人跟投）里 B 投票后 A 收不到 room:update，
						// 只能等票齐结算才有推送 —— 表现为「别人投了票我看不到」。
						await pushRoomUpdate(fresh._id, Number(fresh.version || 0))
						return fresh
					}
					// 写入报告成功但读不到这一票：视为失败，走兜底
				}
				// 没写进去也可能是「别人已经让本轮结算了」——先读最新确认状态
				const fresh = await getRoomById(latest._id)
				if (fresh) {
					latest = fresh
					if (this.seatHasVoted(latest, seatIndex)) {
						return latest
					}
					const phase = (latest.state || {}).phase
					if (phase !== 'vote') {
						// 本轮已结算 / 已进下一轮，本人这一票不需要再补
						return latest
					}
				}
			} catch (error) {
				console.warn('api-router castVoteForSeat atomic append failed', error)
			}
		}

		// 兜底：整房乐观锁 + 冲突自动重试
		const fallback = await this.handleUndercoverAction(
			'vote',
			{ roomId: latest._id, targetSeat },
			'投票失败',
			{ retryOnConflict: 3 }
		)
		if (fallback && fallback.errCode === 0) {
			const fresh = await getRoomById(latest._id)
			return fresh || latest
		}

		throw buildError(
			ERROR_CODES.versionConflict,
			(fallback && fallback.errMsg) || '投票失败，请重试'
		)
	}

	/**
	 * 驱动房间里的机器人把票投完。
	 *
	 * resolveTimersUntilStable 里已经会走一次 advanceAutoSeats（一次调用把所有待投的机器人
	 * 一起投完），这里额外做「校验 + 最多再补一轮」：万一那一轮刚好撞上并发导致提交失败，
	 * 还能在同一个请求里补上，避免出现「真人投完了，机器人一动不动，房间卡在投票阶段」。
	 */
	async advanceRobotSeats(room = {}, { attempts = 2 } = {}) {
		const engine = getEngine(room.game_type)
		if (!engine || typeof engine.listPendingRobotVotes !== 'function') {
			return room
		}

		let latest = room
		for (let attempt = 0; attempt < attempts; attempt += 1) {
			if (!engine.listPendingRobotVotes(latest).length) {
				return latest
			}

			const versionBefore = Number(latest.version || 0)
			const resolved = await this.resolveTimersUntilStable(latest)
			const fresh = await getRoomById(latest._id) || resolved.room
			latest = fresh

			if (resolved.changed) {
				// 云函数日志可见：出现这行说明「服务端确实推进了机器人」。
				// 如果客户端仍显示机器人在等待，那就是客户端/推送的问题，而不是这里没跑。
				console.log('api-router advanceRobotSeats advanced', {
					roomId: latest._id,
					version: latest.version
				})
			}

			// 已经没有待投的机器人 → 完成
			if (!engine.listPendingRobotVotes(latest).length) {
				return latest
			}

			// 版本没动说明这一轮推进没生效，再试一次也大概率无效 → 退出，别白烧调用
			if (Number(latest.version || 0) === versionBefore) {
				return latest
			}

			await sleep(20 + Math.floor(Math.random() * 40))
		}

		return latest
	}

	async undercoverNextRound(params = {}) {
		return this.handleUndercoverAction('nextRound', params, '进入下一轮失败', { retryOnConflict: 1 })
	}

	async undercoverReveal(params = {}) {
		return this.handleUndercoverAction('reveal', params, '查看结果失败', { retryOnConflict: 1 })
	}

	/**
	 * 卧底动作统一入口。
	 *
	 * @param {object} options.retryOnConflict 乐观锁冲突时自动「重读最新 + 重试」的次数。
	 *   投票/发言是「追加」类操作（引擎侧有「未投过 / 未轮到」校验，重试安全且幂等），
	 *   多人同时操作（尤其投票阶段多人齐投）会互相 bump version 导致后提交者撞车，
	 *   自动重试可在服务端无感吸收掉绝大多数冲突，客户端不再弹「手慢了」。
	 */
	async handleUndercoverAction(engineAction = '', params = {}, fallbackMessage = '操作失败', options = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)

			const retryOnConflict = Math.max(0, parseInt(options.retryOnConflict, 10) || 0)
			const maxAttempts = retryOnConflict + 1

			let latest = null
			for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
				// 每次尝试都推进定时器 + 读最新，确保基于最新状态提交
				const base = latest || room
				const resolved = await this.resolveTimersUntilStable(base)
				latest = await getRoomById(room._id) || resolved.room

				try {
					const result = await this.runEngineAction({
						room: latest,
						uid,
						engineAction,
						params
					})

					return Object.assign({}, authState.response, {
						errCode: 0,
						data: await this.buildSnapshot(result.room, uid, {
							changed: result.changed,
							version: result.version
						})
					})
				} catch (error) {
					if (error.errCode === ERROR_CODES.versionConflict && attempt < maxAttempts - 1) {
						// 撞了乐观锁 → 随机退避错开并发提交的节奏，再用最新状态重试
						await sleep(20 + Math.floor(Math.random() * 40))
						continue
					}
					throw error
				}
			}

			throw buildError(ERROR_CODES.versionConflict, '操作冲突，请重试')
		} catch (error) {
			return formatError(error, fallbackMessage)
		}
	}

	/* -------------------------------------------------------------- *
	 * 三人斗地主
	 * -------------------------------------------------------------- */

	async landlordStart(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)
			this.assertHost(room, uid)
			this.assertWaiting(room)

			const result = await this.runEngineAction({
				room,
				uid,
				engineAction: 'start',
				params
			})

			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '开始发牌',
				data: await this.buildSnapshot(result.room, uid, {
					changed: true,
					version: result.version
				})
			})
		} catch (error) {
			return formatError(error, '开始游戏失败')
		}
	}

	async landlordBid(params = {}) {
		return this.handleLandlordAction('bid', params, '叫分失败', { retryOnConflict: 1 })
	}

	async landlordPlay(params = {}) {
		return this.handleLandlordAction('play', params, '出牌失败', { retryOnConflict: 1 })
	}

	async landlordPass(params = {}) {
		return this.handleLandlordAction('pass', params, '过牌失败', { retryOnConflict: 1 })
	}

	async landlordTrustee(params = {}) {
		return this.handleLandlordAction('trustee', params, '切换托管失败', { retryOnConflict: 1 })
	}

	/**
	 * 斗地主动作统一入口。
	 * 与卧底同理：托管/机器人/超时推进会 bump version，真人在推进间隙操作会撞乐观锁，
	 * 冲突时「重读最新 + 重试」。若重读后发现回合已变（轮到别人），引擎会抛「还没轮到你」，
	 * 那是正常提示，不是冲突。
	 */
	async handleLandlordAction(engineAction = '', params = {}, fallbackMessage = '操作失败', options = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)

			const retryOnConflict = Math.max(0, parseInt(options.retryOnConflict, 10) || 0)
			const maxAttempts = retryOnConflict + 1

			let latest = null
			for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
				const base = latest || room
				const resolved = await this.resolveTimersUntilStable(base)
				latest = await getRoomById(room._id) || resolved.room

				try {
					const result = await this.runEngineAction({
						room: latest,
						uid,
						engineAction,
						params
					})

					return Object.assign({}, authState.response, {
						errCode: 0,
						data: await this.buildSnapshot(result.room, uid, {
							changed: result.changed,
							version: result.version
						})
					})
				} catch (error) {
					if (error.errCode === ERROR_CODES.versionConflict && attempt < maxAttempts - 1) {
						await sleep(20 + Math.floor(Math.random() * 40))
						continue
					}
					throw error
				}
			}

			throw buildError(ERROR_CODES.versionConflict, '操作冲突，请重试')
		} catch (error) {
			return formatError(error, fallbackMessage)
		}
	}

	/** 提示：纯计算，不改房间状态 */
	async landlordHint(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const room = await this.loadRoom(params.roomId)
			this.assertInRoom(room, uid)

			const engine = getEngine(room.game_type)
			if (!engine || typeof engine.buildHint !== 'function') {
				throw buildError(ERROR_CODES.paramInvalid, '该游戏暂不支持提示')
			}

			const hint = engine.buildHint(room, uid)
			return Object.assign({}, authState.response, {
				errCode: 0,
				data: { hint }
			})
		} catch (error) {
			return formatError(error, '获取提示失败')
		}
	}

	/* -------------------------------------------------------------- *
	 * 词库（预置 + 自定义统一入口）
	 * -------------------------------------------------------------- */

	async listWordCategories() {
		try {
			const { authState, uid } = await this.getAuthUid()
			const data = await listCategories(uid)
			return Object.assign({}, authState.response, {
				errCode: 0,
				data
			})
		} catch (error) {
			return formatError(error, '获取词库分类失败')
		}
	}

	async listWords(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const source = params.source === 'mine' ? 'mine' : 'preset'
			const data = await listWords({
				source,
				uid,
				category: params.category,
				keyword: params.keyword,
				page: params.page,
				pageSize: params.pageSize
			})
			return Object.assign({}, authState.response, {
				errCode: 0,
				data
			})
		} catch (error) {
			return formatError(error, '获取词条失败')
		}
	}

	async saveWord(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const data = await saveWord({
				uid,
				wordId: params.wordId,
				civilianWord: params.civilianWord,
				undercoverWord: params.undercoverWord,
				category: params.category
			})
			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: data.created ? '词条已添加' : '词条已更新',
				data
			})
		} catch (error) {
			return formatError(error, '保存词条失败')
		}
	}

	async deleteWord(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const data = await deleteWord({ uid, wordId: params.wordId })
			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '词条已删除',
				data
			})
		} catch (error) {
			return formatError(error, '删除词条失败')
		}
	}

	/** 「换一组看看」预览：只返回词对，不落任何房间状态 */
	async randomWordPair(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const source = params.source === 'mine' ? 'mine' : 'preset'
			const wordPair = await pickWordPair({
				source,
				uid,
				category: params.category
			})
			if (!wordPair) {
				return Object.assign({}, authState.response, {
					errCode: ERROR_CODES.noRecord,
					errMsg: '词库里还没有可用的词条'
				})
			}
			return Object.assign({}, authState.response, {
				errCode: 0,
				data: { wordPair }
			})
		} catch (error) {
			return formatError(error, '获取词条失败')
		}
	}

	/* -------------------------------------------------------------- *
	 * 战绩
	 * -------------------------------------------------------------- */

	async getRecords(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const page = Math.max(1, parseInt(params.page, 10) || 1)
			const pageSize = Math.min(30, Math.max(1, parseInt(params.pageSize, 10) || 10))
			const gameType = String(params.gameType || '').trim()

			const conditions = [
				// 联机局按 players.uid 命中；炸弹局玩家可能没有 uid，用 create_uid 兜底
				dbCmd.or([
					{ 'players.uid': uid },
					{ create_uid: uid }
				]),
				{ is_deleted: false }
			]
			if (gameType && ALL_GAME_TYPE_SET.has(gameType)) {
				conditions.push({ game_type: gameType })
			}

			const where = dbCmd.and(conditions)

			const totalRes = await gameRecordCollection.where(where).count()
			const total = Number(totalRes && totalRes.total || 0)

			const listRes = await gameRecordCollection
				.where(where)
				.orderBy('create_time', 'desc')
				.skip((page - 1) * pageSize)
				.limit(pageSize)
				.get()

			const rawList = listRes && Array.isArray(listRes.data) ? listRes.data : []

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: {
					list: rawList.map((item) => this.normalizeRecordForList(item, uid)),
					pagination: {
						page,
						pageSize,
						total,
						hasMore: page * pageSize < total
					}
				}
			})
		} catch (error) {
			return formatError(error, '获取战绩失败')
		}
	}

	normalizeRecordForList(record = {}, uid = '') {
		const players = Array.isArray(record.players) ? record.players : []
		const myEntry = players.find((item) => String(item.uid || '') === String(uid || ''))
			|| (String(record.create_uid || '') === String(uid || '') ? players[0] : null)

		return {
			recordId: record._id || '',
			gameType: record.game_type || '',
			roomCode: record.room_code || '',
			summary: record.summary || '',
			winnerCamp: record.winner_camp || '',
			roundCount: Number(record.round_count || 1),
			duration: Number(record.duration || 0),
			playerCount: players.length,
			createTime: Number(record.create_time || 0),
			myResult: myEntry ? (myEntry.result || '') : '',
			myScoreDelta: myEntry ? Number(myEntry.score_delta || 0) : 0,
			myRole: myEntry ? (myEntry.role || '') : ''
		}
	}

	async getRecordDetail(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const recordId = String(params.recordId || '').trim()
			if (!recordId) {
				throw buildError(ERROR_CODES.paramInvalid, '战绩ID不能为空')
			}

			const res = await gameRecordCollection
				.where({
					_id: recordId,
					is_deleted: false
				})
				.limit(1)
				.get()
			const record = res && res.data && res.data[0] ? res.data[0] : null
			if (!record) {
				throw buildError(ERROR_CODES.recordNotFound, '战绩不存在')
			}

			const players = Array.isArray(record.players) ? record.players : []
			const participated = players.some((item) => String(item.uid || '') === String(uid || ''))
				|| String(record.create_uid || '') === String(uid || '')
			if (!participated) {
				throw buildError(ERROR_CODES.recordNotFound, '战绩不存在')
			}

			const detail = Object.assign({}, this.normalizeRecordForList(record, uid), {
				detail: record.detail || {},
				players: players.map((item) => ({
					nickname: item.nickname || '',
					avatarUrl: item.avatar_url || '',
					seatIndex: Number(item.seat_index || 0),
					isRobot: Boolean(item.is_robot),
					role: item.role || '',
					scoreDelta: Number(item.score_delta || 0),
					result: item.result || '',
					isSelf: String(item.uid || '') === String(uid || '')
				}))
			})

			return Object.assign({}, authState.response, {
				errCode: 0,
				data: { detail }
			})
		} catch (error) {
			return formatError(error, '获取战绩详情失败')
		}
	}

	/**
	 * 数字炸弹战绩上报：游戏完全在客户端跑，服务端只做合理性校验后落库。
	 * 不接受客户端提交的炸弹数字，也不参与任何排行/奖励。
	 */
	async reportRecord(params = {}) {
		try {
			const { authState, uid } = await this.getAuthUid()
			const gameType = String(params.gameType || '').trim()
			if (gameType !== GAME_TYPE_BOMB) {
				throw buildError(ERROR_CODES.paramInvalid, '仅支持上报数字炸弹战绩')
			}

			const rangeLimit = parseInt(params.rangeLimit, 10)
			if (!Number.isInteger(rangeLimit) || rangeLimit < BOMB_MIN_LIMIT || rangeLimit > BOMB_MAX_LIMIT) {
				throw buildError(ERROR_CODES.paramInvalid, '范围上限不合法')
			}

			const guessCount = parseInt(params.guessCount, 10)
			if (!Number.isInteger(guessCount) || guessCount < 1 || guessCount > BOMB_MAX_GUESS_COUNT) {
				throw buildError(ERROR_CODES.paramInvalid, '猜测次数不合法')
			}

			const rawPlayerList = Array.isArray(params.players) ? params.players : []
			// 先校验总数再截断，避免超量数据被静默接受
			if (rawPlayerList.length < BOMB_MIN_PLAYERS) {
				throw buildError(ERROR_CODES.paramInvalid, '玩家数据不合法')
			}
			if (rawPlayerList.length > BOMB_MAX_PLAYERS) {
				throw buildError(ERROR_CODES.paramInvalid, `最多支持 ${BOMB_MAX_PLAYERS} 人`)
			}
			const rawPlayers = rawPlayerList

			const loserIndex = rawPlayers.length > 1 ? parseInt(params.loserIndex, 10) : 0
			if (rawPlayers.length > 1 && (!Number.isInteger(loserIndex) || loserIndex < 0 || loserIndex >= rawPlayers.length)) {
				throw buildError(ERROR_CODES.paramInvalid, '失败者索引不合法')
			}

			const now = Date.now()
			const duration = Math.max(0, Math.min(6 * 60 * 60 * 1000, parseInt(params.duration, 10) || 0))

			const players = rawPlayers.map((item, index) => {
				const source = item && typeof item === 'object' ? item : {}
				const nickname = String(source.nickname || source.name || '').trim().slice(0, MAX_PLAYER_NAME_LENGTH)
					|| `玩家${index + 1}`
				const isLoser = rawPlayers.length > 1 ? index === loserIndex : true
				return {
					uid: index === 0 ? uid : String(source.uid || ''),
					nickname,
					avatar_url: String(source.avatarUrl || source.avatar_url || '').trim(),
					seat_index: index,
					is_robot: false,
					role: isLoser ? 'bomb_loser' : 'bomb_lucky',
					score_delta: isLoser ? 0 : 0,
					result: isLoser ? 'lose' : 'win'
				}
			})

			const loserName = players.length > 1 ? players[loserIndex].nickname : players[0].nickname
			const summary = players.length > 1
				? `${players.length} 人轮流猜 1~${rangeLimit}，第 ${guessCount} 次踩雷，${loserName} 中雷`
				: `挑战 1~${rangeLimit}，第 ${guessCount} 次猜中炸弹`

			const recordData = {
				game_type: GAME_TYPE_BOMB,
				room_id: '',
				room_code: '',
				players,
				winner_uids: players.filter((item) => item.result === 'win').map((item) => item.uid).filter(Boolean),
				loser_uids: players.filter((item) => item.result === 'lose').map((item) => item.uid).filter(Boolean),
				winner_camp: '',
				summary,
				detail: {
					rangeLimit,
					guessCount
				},
				round_count: 1,
				duration,
				create_uid: uid,
				create_time: now,
				is_deleted: false
			}

			const result = await gameRecordCollection.add(recordData)

			return Object.assign({}, authState.response, {
				errCode: 0,
				errMsg: '战绩已保存',
				data: { recordId: result.id }
			})
		} catch (error) {
			return formatError(error, '保存战绩失败')
		}
	}
}
