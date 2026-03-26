'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class UserController extends Controller {
	async getMine() {
		return this.service.user.getMine()
	}

	async updateProfile() {
		return this.service.user.updateProfile(this.ctx.data || {})
	}
}
