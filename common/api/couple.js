import { createRouterModule } from './router.js'

let coupleApi = null

export function getCoupleApi() {
	if (!coupleApi) {
		coupleApi = createRouterModule({
			getCenter: 'couple/getCenter',
			refreshBindCode: 'couple/refreshBindCode',
			getInvitePreview: 'couple/getInvitePreview',
			bindByCode: 'couple/bindByCode',
			sendRequest: 'couple/sendRequest',
			reviewRequest: 'couple/reviewRequest',
			cancelRequest: 'couple/cancelRequest',
			unbind: 'couple/unbind'
		})
	}

	return coupleApi
}
