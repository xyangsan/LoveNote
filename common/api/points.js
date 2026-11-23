import { createRouterModule } from './router.js'

let pointsApi = null

export function getPointsApi() {
	if (!pointsApi) {
		pointsApi = createRouterModule({
			getSummary: 'points/getSummary',
			getLogs: 'points/getLogs',
			signIn: 'points/signIn',
			claimChallenge: 'points/claimChallenge'
		})
	}

	return pointsApi
}
