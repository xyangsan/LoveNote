/**
 * @class 应用维度日收益模型
 */
const BaseMod = require('./base')
const Adp = require('./uniadAdpRevenues')

const db = uniCloud.database()
const dbCmd = db.command
const $ = dbCmd.aggregate
module.exports = class uniadDayRevenues extends BaseMod {
	constructor() {
		super()
		this.tableName = 'app-revenues'
	}

	/**
	 * 收益汇总
	 */
	async Summary(revenue_date, appid, ad_region) {
		const adp = new Adp()
		//let revenue = await adp.getDateSummary(revenue_date, appid, ad_region)
		let summarys = await adp.getCollection()
			.aggregate()
			.match({
				revenue_date,
				appid,
				ad_region
			})
			.group({
				_id:null,
				revenue: $.sum('$revenue')
			})
			.end()

		let revenue = 0
		if (summarys.data.length) {
			revenue = summarys.data[0].revenue
		}

		let revenues = await this.getCollection().where({
			revenue_date,
			appid,
			ad_region
		}).get()
		if (revenues.data.length) {
			await this.getCollection().doc(revenues.data[0]._id).update({
				revenue
			})
		} else {
			await this.getCollection().add({
				ad_region,
				revenue_date,
				appid,
				revenue,
				create_time: Date.now()
			})
		}
		return true
	}

}