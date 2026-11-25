'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class HomeController extends Controller {
	async getDashboard() {
		return this.service.home.getDashboard(this.ctx.data || {})
	}
}
