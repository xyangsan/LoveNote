'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class CoupleController extends Controller {
	async getCenter() {
		return this.service.couple.getCenter()
	}

	async sendRequest() {
		return this.service.couple.sendRequest(this.ctx.data || {})
	}

	async reviewRequest() {
		return this.service.couple.reviewRequest(this.ctx.data || {})
	}

	async cancelRequest() {
		return this.service.couple.cancelRequest(this.ctx.data || {})
	}

	async unbind() {
		return this.service.couple.unbind(this.ctx.data || {})
	}
}
