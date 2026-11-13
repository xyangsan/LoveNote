/**
 * @class 广告位模型
 */
const BaseMod = require('./base')
module.exports = class uniadPositions extends BaseMod {
	constructor() {
		super()
		this.tableName = 'positions'
	}

	async addPosition(params) {
		let {
			appid,
			ad_region,
			adp_id,
			adp_type,
			adp_name
		} = params
		
		let where = {
			appid,
			ad_region,
			adp_id,
			adp_type
		}
		let adps = await this.getCollection().where(where).get()
		if(!adps.data.length){
			where.adp_name = adp_name
			where.create_time = Date.now()
			await this.getCollection().add(where)
		}

		return true
	}
}