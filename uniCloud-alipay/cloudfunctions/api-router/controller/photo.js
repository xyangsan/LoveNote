'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class PhotoController extends Controller {
	async getList() {
		return this.service.photo.getList(this.ctx.data || {})
	}

	async getDetail() {
		return this.service.photo.getDetail(this.ctx.data || {})
	}

	async upload() {
		return this.service.photo.upload(this.ctx.data || {})
	}

	async update() {
		return this.service.photo.update(this.ctx.data || {})
	}

	async delete() {
		return this.service.photo.delete(this.ctx.data || {})
	}

	async toggleFavorite() {
		return this.service.photo.toggleFavorite(this.ctx.data || {})
	}

	async moveToAlbum() {
		return this.service.photo.moveToAlbum(this.ctx.data || {})
	}
}
