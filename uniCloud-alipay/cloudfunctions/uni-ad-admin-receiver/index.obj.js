// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129

const utils = require('./lib/utils')
module.exports = {
	// 参数接收
	receiver: async function(params = {}) {
		const httpInfo = this.getHttpInfo()
		let requestParams = {}
		if (httpInfo && httpInfo.body && typeof httpInfo.body === 'string') {
			requestParams = JSON.parse(httpInfo.body)
		}
		
		let isCheckSign = utils.checkSign(requestParams)
		if (!isCheckSign) {
			return utils.result(100, '', 'sign error')
		}

		// 接收推送数据
		const Revenues = require('./mod/uniadAdpRevenues')
		const revenues = new Revenues()
		const result = await revenues.receiverDataAll(requestParams)

		if (result) {
			return utils.result(0, '', 'ok')
		}

		return utils.result(100, '', 'error')
	},
	// 服务器重新推送数据
	repush: async function(params = {}) {
		let {
			appid,
			sync_date,
			ad_region
		} = params

		if (!appid || !sync_date) {
			return utils.result(100, '', 'param error')
		}

		const SyncLog = require('./mod/uniadSyncLogs')
		const syncLog = new SyncLog()
		return await syncLog.repush(params)
	}
}