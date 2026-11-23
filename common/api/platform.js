import { createRouterModule } from './router.js'

let platformApi = null

export function getPlatformApi() {
	if (!platformApi) {
		platformApi = createRouterModule({
			getOverview: 'platform/getOverview',
			getModuleStats: 'platform/getModuleStats',
			getAdStats: 'platform/getAdStats',
			getAdDiag: 'platform/getAdDiag',
			getPermissionSettings: 'platform/getPermissionSettings',
			updatePermissionSettings: 'platform/updatePermissionSettings',
			backfillPoints: 'platform/backfillPoints',
			getMediaCleanupStats: 'platform/getMediaCleanupStats',
			cleanupDailyMedia: 'platform/cleanupDailyMedia',
			getModuleVisibility: 'platform/getModuleVisibility',
			reportVisit: 'platform/reportVisit'
		})
	}

	return platformApi
}
