'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class StatsController extends Controller {
	async getOverview() {
		return this.service.stats.getOverview(this.ctx.data || {})
	}
}
