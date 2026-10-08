/**
 * 游戏模块的默认数据与归一化逻辑（照 store/modules/plan.js 的组织方式）
 * 实时对局状态不进 pinia：生命周期短、频率高，放页面 data + room-sync 管理。
 * 这里只服务「继续对局」入口与战绩列表。
 */

export function getDefaultGameActiveRoom() {
	return null
}

export function getDefaultGameRecords() {
	return []
}

export function getDefaultGameRecordsPagination() {
	return {
		page: 1,
		pageSize: 10,
		total: 0,
		hasMore: false
	}
}

/** 归一化 getActiveRoom 返回的房间摘要 */
export function normalizeGameRoomBrief(room = null) {
	if (!room || !room.roomId) {
		return null
	}
	return {
		roomId: String(room.roomId),
		roomCode: String(room.roomCode || ''),
		gameType: String(room.gameType || ''),
		status: String(room.status || ''),
		round: Number(room.round || 0),
		playerCount: Number(room.playerCount || 0),
		maxPlayers: Number(room.maxPlayers || 0),
		version: Number(room.version || 0),
		updateTime: Number(room.updateTime || 0)
	}
}

/** 归一化战绩列表项 */
export function normalizeGameRecord(item = {}) {
	return {
		recordId: String(item.recordId || ''),
		gameType: String(item.gameType || ''),
		roomCode: String(item.roomCode || ''),
		summary: String(item.summary || ''),
		winnerCamp: String(item.winnerCamp || ''),
		roundCount: Number(item.roundCount || 1),
		duration: Number(item.duration || 0),
		playerCount: Number(item.playerCount || 0),
		createTime: Number(item.createTime || 0),
		myResult: String(item.myResult || ''),
		myScoreDelta: Number(item.myScoreDelta || 0),
		myRole: String(item.myRole || '')
	}
}

export function normalizeGameRecordList(list = []) {
	return (Array.isArray(list) ? list : []).map(normalizeGameRecord)
}

/**
 * 从状态的 auto_actions 里挑出「我自己的、且还没提示过的」自动操作
 * 用于断线重连后告知玩家「你已经超时被自动过牌」
 * @returns {{ items:Array, maxSeq:Number, message:String }}
 */
export function pickNewAutoActions({
	autoActions = [],
	lastSeenSeq = 0,
	mySeat = -1
} = {}) {
	const list = Array.isArray(autoActions) ? autoActions : []
	const since = Number(lastSeenSeq || 0)
	const maxSeq = list.reduce(
		(current, item) => Math.max(current, Number(item.seq || 0)),
		since
	)
	const items = list.filter((item) => (
		Number(item.seat_index) === Number(mySeat) && Number(item.seq || 0) > since
	))

	return {
		items,
		maxSeq,
		message: buildAutoActionMessage(items)
	}
}

export function buildAutoActionMessage(items = []) {
	const list = Array.isArray(items) ? items : []
	if (!list.length) {
		return ''
	}

	const hasTrustee = list.some((item) => item.action === 'auto_trustee')
	if (hasTrustee) {
		return '你掉线或连续超时，已被自动托管，点「恢复操作」即可接手'
	}

	const counters = {
		pass: 0,
		play: 0,
		skip_speak: 0,
		vote: 0,
		bid: 0
	}
	list.forEach((item) => {
		if (counters[item.action] !== undefined) {
			counters[item.action] += 1
		}
	})

	const parts = []
	if (counters.pass) {
		parts.push(`自动不出 ${counters.pass} 次`)
	}
	if (counters.play) {
		parts.push(`自动出牌 ${counters.play} 次`)
	}
	if (counters.skip_speak) {
		parts.push(`自动跳过发言 ${counters.skip_speak} 次`)
	}
	if (counters.vote) {
		parts.push(`自动弃票 ${counters.vote} 次`)
	}
	if (counters.bid) {
		parts.push(`自动不叫 ${counters.bid} 次`)
	}

	return parts.length ? `你已${parts.join('、')}` : ''
}

export function formatGameDuration(duration = 0) {
	const ms = Math.max(0, Number(duration || 0))
	if (ms < 60 * 1000) {
		return `${Math.max(1, Math.round(ms / 1000))} 秒`
	}
	const minutes = Math.floor(ms / 60000)
	const seconds = Math.round((ms % 60000) / 1000)
	return seconds ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`
}

export function formatGameTime(timestamp = 0) {
	const value = Number(timestamp)
	if (!value) {
		return '--'
	}
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return '--'
	}
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	const hour = `${date.getHours()}`.padStart(2, '0')
	const minute = `${date.getMinutes()}`.padStart(2, '0')
	return `${month}-${day} ${hour}:${minute}`
}

export function getRoleText(gameType = '', role = '') {
	const map = {
		undercover: {
			undercover: '卧底',
			civilian: '平民'
		},
		landlord: {
			landlord: '地主',
			farmer: '农民'
		},
		bomb: {
			bomb_loser: '中雷',
			bomb_lucky: '躲过一劫'
		}
	}
	return (map[gameType] || {})[role] || ''
}

export function getResultText(result = '') {
	if (result === 'win') {
		return '胜'
	}
	if (result === 'lose') {
		return '负'
	}
	return '平'
}
