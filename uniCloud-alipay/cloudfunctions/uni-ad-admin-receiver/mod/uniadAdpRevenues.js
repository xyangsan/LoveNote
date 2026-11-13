/**
 * @class 广告位收益数据模型
 */
const BaseMod = require('./base')
const {
	result
} = require('../lib/utils')
const {
	STATUS
} = require('../lib/constants')
module.exports = class uniadAdpRevenues extends BaseMod {
	constructor() {
		super()
		this.tableName = 'adp-revenues'
	}

	/**
	 * 接收推送数据
	 * @param {Object} params
	 */
	async receiverDataAll(params) {

		const UniadPosition = require('./uniadPositions')
		const uniadPosition = new UniadPosition()
		const UniadSync = require('./uniadSyncLogs')
		const uniadSync = new UniadSync()
		const UniadApp = require('./uniadAppRevenues')
		const uniadApp = new UniadApp()
		// 重组插入数据
		let datas = params.data
		if (datas.length === 0) {
			let {
				revenue_date,
				appid,
				ad_region
			} = params
			
			uniadSync.createOrUpdate(appid, revenue_date, ad_region, STATUS.COMPLETE)
			return result(0, '', 'no data')
		}
		await this.deleteReceiver(datas[0])

		let insertDatas = []
		let positions = []
		let summarys = []
		let apps = []
		for (var i = 0; i < datas.length; i++) {
			let data = datas[i]

			let ad_region = data.ad_region ? parseInt(data.ad_region) : 0
			let revenue_date = data.revenue_date ? parseInt(data.revenue_date) : 0
			let appid = data.appid ? data.appid : ''
			let appname = data.appname ? data.appname : ''
			let adp_id = data.adp_id ? data.adp_id : ''
			let ad_platform = data.ad_platform ? parseInt(data.ad_platform) : 0
			let show_count = data.show_count ? parseInt(data.show_count) : 0
			let click_count = data.click_count ? parseInt(data.click_count) : 0
			let click_rate = data.click_rate ? data.click_rate+'' : '0.0'
			let revenue = data.revenue ? parseInt(data.revenue) : 0
			let cpc = data.cpc ? data.cpc+'' : '0.0'
			let cpm = data.cpm ? data.cpm+'' : '0.0'
			let ad_type = data.ad_type ? parseInt(data.ad_type) : 0
			let os = data.os ? data.os : ''
			let adp_name = data.adp_name ? data.adp_name : ''

			// 每天第一次循环到的广告位，自动处理
			if (adp_id) {
				let tmp_adp_id = adp_id + '_' + ad_region
				if (!positions.includes(tmp_adp_id)) {
					positions.push(tmp_adp_id)
					await uniadPosition.addPosition({
						appid,
						ad_region,
						adp_id,
						adp_type: ad_type,
						adp_name
					})
				}
			}

			// 需要汇总的应用
			let checkSummary = summarys.find(item => item.appid == appid && item.ad_region)
			if (!checkSummary) {
				summarys.push({
					revenue_date,
					ad_region,
					appid
				})
			}

			// 需要创建的应用
			let checkApp = apps.find(item => item.appid == appid)
			if (!checkApp) {
				apps.push({
					appid,
					appname
				})
			}

			insertDatas.push({
				ad_region,
				revenue_date,
				appid,
				adp_id,
				ad_platform,
				show_count,
				click_count,
				click_rate,
				revenue,
				cpc,
				cpm,
				ad_type,
				os,
				create_time: Date.now()
			})
		}

		let res = await this.batchInsert('', insertDatas)
		// console.log('insert res ',res)

		let isok = (res.data.inserted === insertDatas.length)
		let tmpStatus = STATUS.COMPLETE
		if (!isok) {
			tmpStatus = STATUS.FAILED
		}
		// 需要创建的应用
		const App = require('./apps')
		const app = new App()
		for (var i = 0; i < apps.length; i++) {
			let {
				appid,
				appname
			} = apps[i]

			await app.create(appid, appname)
		}
		// 需要汇总的应用
		for (var i = 0; i < summarys.length; i++) {
			let {
				revenue_date,
				ad_region,
				appid
			} = summarys[i]

			// 处理数据汇总
			await uniadApp.Summary(revenue_date, appid, ad_region)
			// 更新同步状态
			await uniadSync.createOrUpdate(appid, revenue_date, ad_region, tmpStatus)
		}
		return isok
	}

	// 按日期删除数据
	async deleteReceiver(data) {
		let {
			revenue_date,
			appid,
			ad_region
		} = data
		await this.getCollection().where({
			revenue_date,
			appid,
			ad_region
		}).remove()
	}
}