'use strict'

const db = uniCloud.database()

module.exports = {
	db,
	dbCmd: db.command,
	gameRoomCollection: db.collection('love-game-rooms'),
	gameConnectionCollection: db.collection('love-game-connections')
}
