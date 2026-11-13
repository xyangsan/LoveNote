/**
 * @class 数据同步日志模型
 */
const BaseMod = require('./base')
const {
	result,
	getSign
} = require('../lib/utils')
const DateTime = require('../lib/date')
const {
	STATUS
} = require('../lib/constants')

module.exports = class uniadSyncLogs extends BaseMod {
	constructor() {
		super()
		this.tableName = 'sync-logs'
	}

	// 重新推送数据
	async repush(params) {
		let {
			appid,
			sync_date,
			ad_region
		} = params

		if (!appid) {
			return result(100, '', 'param error')
		}

		let res = await this.repushRequest(appid, sync_date, ad_region)
		if (res.errCode === 0) {
			await this.createOrUpdate(appid, sync_date, ad_region, STATUS.PEDDING)
			return result(0, '', '操作成功，请耐心等待。')
		} else {
			return res
		}
	}

	// 更新推送日志
	async createOrUpdate(appid, sync_date, ad_region, status) {
		let result = await this.getCollection().where({
			appid,
			sync_date,
			ad_region
		}).get()

		let create_time = Date.now()
		if (result.data.length) {
			await this.getCollection().doc(result.data[0]._id).update({
				status,
				update_time: create_time
			})
		} else {
			await this.getCollection().add({
				appid,
				sync_date,
				ad_region,
				create_time,
				status,
				update_time: create_time
			})
		}

		return true
	}

	// 请求接口
	async repushRequest(appid, sync_date, ad_region) {
		const url = 'https://uniad-dev.dcloud.net.cn/api/uniad/admin/repush'

		return await this.sendRequest(url, {
			appid,
			push_date: sync_date,
			ad_region
		})
	}

	async sendRequest(url, params) {
		const dateTime = new DateTime()
		params.time = dateTime.getTime()
		params.sign = getSign(params)

		try {
			const res = await uniCloud.httpclient.request(url, {
				method: "POST",
				data: params,
				contentType: 'json',
				dataType: 'json',
				timeout: 30000
			})

			let {
				ret,
				data
			} = res.data

			return result(ret, '', data)
		} catch (e) {
			return result(111, '', 'server error')
		}
	}
}