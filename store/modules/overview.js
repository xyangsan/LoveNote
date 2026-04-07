export function getDefaultOverviewStats() {
	return {
		isBound: false,
		albumTotal: null,
		dailyTotal: null,
		anniversaryTotal: null,
		planTotal: null,
		wishTotal: null
	}
}

export function getDefaultProfileFeatureStats() {
	return {
		anniversaryTotal: null,
		albumTotal: null,
		dailyTotal: null,
		wishTotal: null,
		planTotal: null
	}
}

export function buildOverviewStats(result = {}) {
	const data = result && result.data ? result.data : {}
	if (!data.isBound) {
		return getDefaultOverviewStats()
	}

	return {
		isBound: true,
		albumTotal: Number(data.album_total || 0),
		dailyTotal: Number(data.daily_total || 0),
		anniversaryTotal: Number(data.anniversary_total || 0),
		planTotal: Number(data.plan_total || 0),
		wishTotal: Number(data.wish_total || 0)
	}
}

export function buildProfileFeatureStatsFromOverview(overviewStats = {}) {
	if (!overviewStats || !overviewStats.isBound) {
		return getDefaultProfileFeatureStats()
	}

	return {
		anniversaryTotal: Number(overviewStats.anniversaryTotal || 0),
		albumTotal: Number(overviewStats.albumTotal || 0),
		dailyTotal: Number(overviewStats.dailyTotal || 0),
		wishTotal: Number(overviewStats.wishTotal || 0),
		planTotal: Number(overviewStats.planTotal || 0)
	}
}