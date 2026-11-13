/**
 * @class 应用模型
 */
const BaseMod = require('./base')
module.exports = class Apps extends BaseMod {
	constructor() {
		super()
		this.tableName = 'opendb-app-list'
		this.tablePrefix = false
	}
	
	// 应用更新、创建
	async create(appid, name){
		
		let apps = await this.getCollection().where({
			appid
		}).get()
		if(!apps.data.length){
			await this.getCollection().add({
				appid,
				name,
				create_date: Date.now()
			})
		}
		
		return true
	}
	
}