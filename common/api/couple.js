import { createRouterModule } from './router.js'

let coupleApi = null

export function getCoupleApi() {
	if (!coupleApi) {
		coupleApi = createRouterModule({
			getCenter: 'couple/getCenter',
			sendRequest: 'couple/sendRequest',
			reviewRequest: 'couple/reviewRequest',
			cancelRequest: 'couple/cancelRequest',
			unbind: 'couple/unbind'
		})
	}

	return coupleApi
}
