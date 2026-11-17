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

	/** 权限设置：首页模块显示开关（feed / game，仅 admin） */
	async getPermissionSettings() {
		return this.service.platform.getPermissionSettings()
	}

	/** 更新权限设置：feedVisible / gameVisible，支持只传要改的项（仅 admin） */
	async updatePermissionSettings() {
		return this.service.platform.updatePermissionSettings(this.ctx.data || {})
	}

	/** 云存储清理统计：已删除动态还剩多少文件没回收（仅 admin） */
	async getMediaCleanupStats() {
		return this.service.platform.getMediaCleanupStats()
	}

	/** 云存储清理：回收已删除动态的原图与缩略图，单次最多 50 条（仅 admin） */
	async cleanupDailyMedia() {
		return this.service.platform.cleanupDailyMedia(this.ctx.data || {})
	}

	/** 模块可见性：首页读取，游客也要按同一口径渲染（见 config.js 白名单） */
	async getModuleVisibility() {
		return this.service.platform.getModuleVisibility()
	}

	/** 进入小程序上报（游客可调，见 config.js 白名单） */
	async reportVisit() {
		return this.service.platform.reportVisit(this.ctx.data || {})
	}
}
