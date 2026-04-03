'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class PlanController extends Controller {
	async getList() {
		return this.service.plan.getList(this.ctx.data || {})
	}

	async create() {
		return this.service.plan.create(this.ctx.data || {})
	}

	async addStep() {
		return this.service.plan.addStep(this.ctx.data || {})
	}

	async actionStep() {
		return this.service.plan.actionStep(this.ctx.data || {})
	}

	async addStepComment() {
		return this.service.plan.addStepComment(this.ctx.data || {})
	}

	async finish() {
		return this.service.plan.finish(this.ctx.data || {})
	}

	async delete() {
		return this.service.plan.delete(this.ctx.data || {})
	}
}
