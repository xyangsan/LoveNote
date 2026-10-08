import { createRouterModule } from './router.js'

let gameApi = null

export function getGameApi() {
	if (!gameApi) {
		gameApi = createRouterModule({
			// 房间通用
			createRoom: 'game/createRoom',
			joinRoom: 'game/joinRoom',
			leaveRoom: 'game/leaveRoom',
			getRoom: 'game/getRoom',
			syncRoom: 'game/syncRoom',
			getActiveRoom: 'game/getActiveRoom',
			setReady: 'game/setReady',
			addRobot: 'game/addRobot',
			removeRobot: 'game/removeRobot',
			kickPlayer: 'game/kickPlayer',
			claimHost: 'game/claimHost',
			closeRoom: 'game/closeRoom',

			// 谁是卧底
			undercoverStart: 'game/undercoverStart',
			undercoverSpeak: 'game/undercoverSpeak',
			undercoverSkipSpeak: 'game/undercoverSkipSpeak',
			undercoverVote: 'game/undercoverVote',
			undercoverNextRound: 'game/undercoverNextRound',
			undercoverReveal: 'game/undercoverReveal',
			setUndercoverCount: 'game/setUndercoverCount',
			setPartyMode: 'game/setPartyMode',

			// 三人斗地主
			landlordStart: 'game/landlordStart',
			landlordBid: 'game/landlordBid',
			landlordPlay: 'game/landlordPlay',
			landlordPass: 'game/landlordPass',
			landlordHint: 'game/landlordHint',
			landlordTrustee: 'game/landlordTrustee',

			// 词库
			listWordCategories: 'game/listWordCategories',
			listWords: 'game/listWords',
			saveWord: 'game/saveWord',
			deleteWord: 'game/deleteWord',
			randomWordPair: 'game/randomWordPair',

			// 战绩
			getRecords: 'game/getRecords',
			getRecordDetail: 'game/getRecordDetail',
			reportRecord: 'game/reportRecord'
		})
	}

	return gameApi
}

/**
 * 统一的 action 结果判定：errCode 非 0 即视为失败并抛出，便于页面 try/catch
 */
export function assertGameResult(result, fallbackMessage = '操作失败') {
	const data = result || {}
	if (data.errCode && data.errCode !== 0) {
		const error = new Error(data.errMsg || fallbackMessage)
		error.errCode = data.errCode
		throw error
	}
	return data
}
