'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class PointsController extends Controller {
	async getSummary() {
		return this.service.points.getSummary()
	}

	async getLogs() {
		return this.service.points.getLogs(this.ctx.data || {})
	}

	async signIn() {
		return this.service.points.signIn()
	}

	async claimChallenge() {
		return this.service.points.claimChallenge(this.ctx.data || {})
	}
}
