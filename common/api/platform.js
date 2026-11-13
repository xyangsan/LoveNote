import { createRouterModule } from './router.js'

let platformApi = null

export function getPlatformApi() {
	if (!platformApi) {
		platformApi = createRouterModule({
			getOverview: 'platform/getOverview',
			getModuleStats: 'platform/getModuleStats',
			getAdStats: 'platform/getAdStats',
			getAdDiag: 'platform/getAdDiag',
			reportVisit: 'platform/reportVisit'
		})
	}

	return platformApi
}
