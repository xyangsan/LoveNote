'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class GameController extends Controller {
	/* 房间通用 */
	async createRoom() {
		return this.service.game.createRoom(this.ctx.data || {})
	}

	async joinRoom() {
		return this.service.game.joinRoom(this.ctx.data || {})
	}

	async leaveRoom() {
		return this.service.game.leaveRoom(this.ctx.data || {})
	}

	async getRoom() {
		return this.service.game.getRoom(this.ctx.data || {})
	}

	async syncRoom() {
		return this.service.game.syncRoom(this.ctx.data || {})
	}

	async getActiveRoom() {
		return this.service.game.getActiveRoom(this.ctx.data || {})
	}

	async setReady() {
		return this.service.game.setReady(this.ctx.data || {})
	}

	async addRobot() {
		return this.service.game.addRobot(this.ctx.data || {})
	}

	async removeRobot() {
		return this.service.game.removeRobot(this.ctx.data || {})
	}

	async kickPlayer() {
		return this.service.game.kickPlayer(this.ctx.data || {})
	}

	async claimHost() {
		return this.service.game.claimHost(this.ctx.data || {})
	}

	async closeRoom() {
		return this.service.game.closeRoom(this.ctx.data || {})
	}

	/* 谁是卧底 */
	async setUndercoverCount() {
		return this.service.game.setUndercoverCount(this.ctx.data || {})
	}

	async setPartyMode() {
		return this.service.game.setPartyMode(this.ctx.data || {})
	}

	async undercoverStart() {
		return this.service.game.undercoverStart(this.ctx.data || {})
	}

	async undercoverSpeak() {
		return this.service.game.undercoverSpeak(this.ctx.data || {})
	}

	async undercoverSkipSpeak() {
		return this.service.game.undercoverSkipSpeak(this.ctx.data || {})
	}

	async undercoverVote() {
		return this.service.game.undercoverVote(this.ctx.data || {})
	}

	async undercoverNextRound() {
		return this.service.game.undercoverNextRound(this.ctx.data || {})
	}

	async undercoverReveal() {
		return this.service.game.undercoverReveal(this.ctx.data || {})
	}

	/* 三人斗地主 */
	async landlordStart() {
		return this.service.game.landlordStart(this.ctx.data || {})
	}

	async landlordBid() {
		return this.service.game.landlordBid(this.ctx.data || {})
	}

	async landlordPlay() {
		return this.service.game.landlordPlay(this.ctx.data || {})
	}

	async landlordPass() {
		return this.service.game.landlordPass(this.ctx.data || {})
	}

	async landlordHint() {
		return this.service.game.landlordHint(this.ctx.data || {})
	}

	async landlordTrustee() {
		return this.service.game.landlordTrustee(this.ctx.data || {})
	}

	/* 词库 */
	async listWordCategories() {
		return this.service.game.listWordCategories(this.ctx.data || {})
	}

	async listWords() {
		return this.service.game.listWords(this.ctx.data || {})
	}

	async saveWord() {
		return this.service.game.saveWord(this.ctx.data || {})
	}

	async deleteWord() {
		return this.service.game.deleteWord(this.ctx.data || {})
	}

	async randomWordPair() {
		return this.service.game.randomWordPair(this.ctx.data || {})
	}

	/* 战绩 */
	async getRecords() {
		return this.service.game.getRecords(this.ctx.data || {})
	}

	async getRecordDetail() {
		return this.service.game.getRecordDetail(this.ctx.data || {})
	}

	async reportRecord() {
		return this.service.game.reportRecord(this.ctx.data || {})
	}
}
