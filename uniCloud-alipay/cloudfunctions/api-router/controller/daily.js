'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class DailyController extends Controller {
	async getList() {
		return this.service.daily.getList(this.ctx.data || {})
	}

	async create() {
		return this.service.daily.create(this.ctx.data || {})
	}

	async delete() {
		return this.service.daily.delete(this.ctx.data || {})
	}
}
