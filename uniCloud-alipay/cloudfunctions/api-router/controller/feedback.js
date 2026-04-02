'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class FeedbackController extends Controller {
	async create() {
		return this.service.feedback.create(this.ctx.data || {})
	}

	async getList() {
		return this.service.feedback.getList(this.ctx.data || {})
	}

	async getDetail() {
		return this.service.feedback.getDetail(this.ctx.data || {})
	}

	async reply() {
		return this.service.feedback.reply(this.ctx.data || {})
	}

	async updateStatus() {
		return this.service.feedback.updateStatus(this.ctx.data || {})
	}
}
