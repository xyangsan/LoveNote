'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class AnniversaryController extends Controller {
	async getList() {
		return this.service.anniversary.getList(this.ctx.data || {})
	}

	async getDetail() {
		return this.service.anniversary.getDetail(this.ctx.data || {})
	}

	async create() {
		return this.service.anniversary.create(this.ctx.data || {})
	}

	async update() {
		return this.service.anniversary.update(this.ctx.data || {})
	}

	async delete() {
		return this.service.anniversary.delete(this.ctx.data || {})
	}
}
