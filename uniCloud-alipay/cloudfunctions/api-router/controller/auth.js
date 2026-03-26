'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class AuthController extends Controller {
	async loginByWeixin() {
		return this.service.auth.loginByWeixin(this.ctx.data || {})
	}

	async logout() {
		return this.service.auth.logout()
	}
}
