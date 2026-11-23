import { createRouterModule } from './router.js'

let dailyApi = null

export function getDailyApi() {
	if (!dailyApi) {
		dailyApi = createRouterModule({
			getList: 'daily/getList',
			create: 'daily/create',
			toggleLike: 'daily/toggleLike',
			addComment: 'daily/addComment',
			deleteComment: 'daily/deleteComment',
			delete: 'daily/delete'
		})
	}

	return dailyApi
}
