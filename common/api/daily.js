import { createRouterModule } from './router.js'

let dailyApi = null

export function getDailyApi() {
	if (!dailyApi) {
		dailyApi = createRouterModule({
			getList: 'daily/getList',
			create: 'daily/create',
			delete: 'daily/delete'
		})
	}

	return dailyApi
}
