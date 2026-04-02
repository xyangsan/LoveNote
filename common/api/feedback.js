import { createRouterModule } from './router.js'

let feedbackApi = null

export function getFeedbackApi() {
	if (!feedbackApi) {
		feedbackApi = createRouterModule({
			create: 'feedback/create',
			getList: 'feedback/getList',
			getDetail: 'feedback/getDetail',
			reply: 'feedback/reply',
			updateStatus: 'feedback/updateStatus'
		})
	}

	return feedbackApi
}
