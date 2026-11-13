'use strict'

const db = uniCloud.database()

module.exports = {
	db,
	database: uniCloud.database,
	dbCmd: db.command,
	userCollection: db.collection('uni-id-users'),
	coupleCollection: db.collection('love-couples'),
	feedbackCollection: db.collection('love-feedbacks'),
	albumCollection: db.collection('love-albums'),
	photoCollection: db.collection('love-photos'),
	dailyPostCollection: db.collection('love-daily-posts'),
	anniversaryCollection: db.collection('love-anniversaries'),
	wishPlanCollection: db.collection('love-wish-plans'),
	gameRoomCollection: db.collection('love-game-rooms'),
	gameRecordCollection: db.collection('love-game-records'),
	gameMatchCollection: db.collection('love-game-matches'),
	gameWordCollection: db.collection('love-game-undercover-words'),
	gameConnectionCollection: db.collection('love-game-connections'),
	// 运营统计：访问流水 / 每日快照 / 登录流水（uni-id-log 由 lib/login-log.js 写入）
	visitCollection: db.collection('love-visits'),
	dailyStatCollection: db.collection('love-daily-stats'),
	uniIdLogCollection: db.collection('uni-id-log'),
	// 广告收益：由 uni-ad-admin-receiver 云对象每日推送写入（T+1）
	adpRevenueCollection: db.collection('uni-ad-adp-revenues'),
	appRevenueCollection: db.collection('uni-ad-app-revenues'),
	adPositionCollection: db.collection('uni-ad-positions'),
	adSyncLogCollection: db.collection('uni-ad-sync-logs')
}
