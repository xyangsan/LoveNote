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
	anniversaryCollection: db.collection('love-anniversaries')
}
