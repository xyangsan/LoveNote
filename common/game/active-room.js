/**
 * 游戏相关的本地持久化（杀进程 / 换设备 / 切后台后恢复用）
 *
 * pinia 内存态不跨进程，必须落 storage：
 *  - game_active_room_<uid>   进行中的房间，用于冷启动「继续对局」
 *  - game_rules_seen_<type>   玩法说明只自动弹一次
 *  - bomb_progress_<uid>      数字炸弹本地进度，支持「继续上一局」
 *
 * 所有读写都包 try/catch：小程序 storage 在超配额时会抛异常，不能影响主流程。
 */

const ACTIVE_ROOM_PREFIX = 'game_active_room_'
const RULES_SEEN_PREFIX = 'game_rules_seen_'
const BOMB_PROGRESS_PREFIX = 'bomb_progress_'

/** 超过 12 小时视为失效，避免读到远古房间 */
const ACTIVE_ROOM_TTL = 12 * 60 * 60 * 1000

function scopedKey(prefix = '', uid = '') {
	return `${prefix}${String(uid || 'guest')}`
}

function readStorage(key = '') {
	try {
		return uni.getStorageSync(key)
	} catch (error) {
		console.warn('active-room readStorage failed', key, error)
		return ''
	}
}

function writeStorage(key = '', value = '') {
	try {
		uni.setStorageSync(key, value)
		return true
	} catch (error) {
		console.warn('active-room writeStorage failed', key, error)
		return false
	}
}

function removeStorage(key = '') {
	try {
		uni.removeStorageSync(key)
		return true
	} catch (error) {
		console.warn('active-room removeStorage failed', key, error)
		return false
	}
}

/* ------------------------------------------------------------------ *
 * 进行中的房间
 * ------------------------------------------------------------------ */

export function saveActiveRoom(uid = '', payload = {}) {
	const roomId = String(payload.roomId || '').trim()
	if (!roomId) {
		return false
	}
	return writeStorage(scopedKey(ACTIVE_ROOM_PREFIX, uid), {
		roomId,
		gameType: String(payload.gameType || ''),
		roomCode: String(payload.roomCode || ''),
		version: Number(payload.version || 0),
		lastSeenSeq: Number(payload.lastSeenSeq || 0),
		savedAt: Date.now()
	})
}

export function getActiveRoom(uid = '') {
	const raw = readStorage(scopedKey(ACTIVE_ROOM_PREFIX, uid))
	if (!raw || typeof raw !== 'object' || !raw.roomId) {
		return null
	}
	if (raw.savedAt && Date.now() - Number(raw.savedAt) > ACTIVE_ROOM_TTL) {
		clearActiveRoom(uid)
		return null
	}
	return {
		roomId: String(raw.roomId),
		gameType: String(raw.gameType || ''),
		roomCode: String(raw.roomCode || ''),
		version: Number(raw.version || 0),
		lastSeenSeq: Number(raw.lastSeenSeq || 0),
		savedAt: Number(raw.savedAt || 0)
	}
}

export function clearActiveRoom(uid = '') {
	return removeStorage(scopedKey(ACTIVE_ROOM_PREFIX, uid))
}

/* ------------------------------------------------------------------ *
 * 玩法说明已读标记
 * ------------------------------------------------------------------ */

export function markRulesSeen(gameType = '') {
	if (!gameType) {
		return false
	}
	return writeStorage(`${RULES_SEEN_PREFIX}${gameType}`, true)
}

export function hasSeenRules(gameType = '') {
	if (!gameType) {
		return true
	}
	return Boolean(readStorage(`${RULES_SEEN_PREFIX}${gameType}`))
}

/* ------------------------------------------------------------------ *
 * 数字炸弹本地进度
 * ------------------------------------------------------------------ */

export function saveBombProgress(uid = '', serialized = '') {
	if (!serialized) {
		return false
	}
	return writeStorage(scopedKey(BOMB_PROGRESS_PREFIX, uid), {
		payload: serialized,
		savedAt: Date.now()
	})
}

export function getBombProgress(uid = '') {
	const raw = readStorage(scopedKey(BOMB_PROGRESS_PREFIX, uid))
	if (!raw || typeof raw !== 'object' || !raw.payload) {
		return null
	}
	// 超过 6 小时视为失效
	if (raw.savedAt && Date.now() - Number(raw.savedAt) > 6 * 60 * 60 * 1000) {
		clearBombProgress(uid)
		return null
	}
	return String(raw.payload)
}

export function clearBombProgress(uid = '') {
	return removeStorage(scopedKey(BOMB_PROGRESS_PREFIX, uid))
}
