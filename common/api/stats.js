import { createRouterModule } from './router.js'

let statsApi = null

export function getStatsApi() {
	if (!statsApi) {
		statsApi = createRouterModule({
			getOverview: 'stats/getOverview'
		})
	}

	return statsApi
}
