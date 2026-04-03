'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class DailyController extends Controller {
	async getList() {
		return this.service.daily.getList(this.ctx.data || {})
	}

	async create() {
		return this.service.daily.create(this.ctx.data || {})
	}

	async toggleLike() {
		return this.service.daily.toggleLike(this.ctx.data || {})
	}

	async addComment() {
		return this.service.daily.addComment(this.ctx.data || {})
	}

	async delete() {
		return this.service.daily.delete(this.ctx.data || {})
	}
}
