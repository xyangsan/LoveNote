'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class AlbumController extends Controller {
	async getList() {
		return this.service.album.getList(this.ctx.data || {})
	}

	async getDetail() {
		return this.service.album.getDetail(this.ctx.data || {})
	}

	async create() {
		return this.service.album.create(this.ctx.data || {})
	}

	async update() {
		return this.service.album.update(this.ctx.data || {})
	}

	async delete() {
		return this.service.album.delete(this.ctx.data || {})
	}
}
