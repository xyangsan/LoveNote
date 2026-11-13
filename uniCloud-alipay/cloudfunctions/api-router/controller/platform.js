'use strict'

const { Controller } = require('uni-cloud-router')

module.exports = class PlatformController extends Controller {
	/** 平台总览：核心指标 / 今日转化漏斗 / 每日趋势 / 反馈概况（仅 admin） */
	async getOverview() {
		return this.service.platform.getOverview(this.ctx.data || {})
	}

	/** 模块统计：6 个模块的内容量与参与用户数（仅 admin） */
	async getModuleStats() {
		return this.service.platform.getModuleStats(this.ctx.data || {})
	}

	/** 广告收益：uni-ad 广告位日报（仅 admin） */
	async getAdStats() {
		return this.service.platform.getAdStats(this.ctx.data || {})
	}

	/** 广告数据核对：按 appid / 平台 / 区域 / 类型摊开昨日与近 7 日（仅 admin，排查对账用） */
	async getAdDiag() {
		return this.service.platform.getAdDiag()
	}

	/** 进入小程序上报（游客可调，见 config.js 白名单） */
	async reportVisit() {
		return this.service.platform.reportVisit(this.ctx.data || {})
	}
}
