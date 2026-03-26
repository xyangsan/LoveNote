'use strict'

const db = uniCloud.database()

module.exports = {
	db,
	dbCmd: db.command,
	userCollection: db.collection('uni-id-users'),
	coupleCollection: db.collection('love-couples')
}
