import {
	clearUniIdTokenStorage,
	getCurrentUniIdUser,
	hasValidLogin,
	saveCachedUserProfile
} from '@/common/auth-center.js'
import { getUserApi } from '@/common/api/user.js'
import { getCoupleApi } from '@/common/api/couple.js'
import { getPlanApi } from '@/common/api/plan.js'
import { getStatsApi } from '@/common/api/stats.js'
import { defineStore } from 'pinia'
import {
	getDefaultAppBaseInfo,
	normalizeAppBaseInfo
} from './modules/app.js'
import {
	getDefaultCoupleCenterData,
	normalizeCoupleCenterResult
} from './modules/couple.js'
import {
	getDefaultPlanPreview,
	buildPlanPreviewFromResult
} from './modules/plan.js'
import {
	getDefaultOverviewStats,
	getDefaultProfileFeatureStats,
	buildOverviewStats,
	buildProfileFeatureStatsFromOverview
} from './modules/overview.js'

const CACHE_KEY_USER = 'user'
const CACHE_KEY_COUPLE = 'couple'
const CACHE_KEY_PLAN_PREVIEW = 'plan_preview'
const CACHE_KEY_OVERVIEW = 'overview'

const CACHE_TTL = {
	[CACHE_KEY_USER]: 2 * 60 * 1000,
	[CACHE_KEY_COUPLE]: 60 * 1000,
	[CACHE_KEY_PLAN_PREVIEW]: 60 * 1000,
	[CACHE_KEY_OVERVIEW]: 60 * 1000
}

const pendingTaskMap = {}

function getDefaultCacheAt() {
	return {
		[CACHE_KEY_USER]: 0,
		[CACHE_KEY_COUPLE]: 0,
		[CACHE_KEY_PLAN_PREVIEW]: 0,
		[CACHE_KEY_OVERVIEW]: 0
	}
}

export const useAppStateStore = defineStore('app-state', {
	state: () => ({
		appModule: {
			baseInfo: getDefaultAppBaseInfo()
		},
		authModule: {
			userInfo: null
		},
		coupleModule: {
			centerData: getDefaultCoupleCenterData()
		},
		planModule: {
			preview: getDefaultPlanPreview()
		},
		overviewModule: {
			stats: getDefaultOverviewStats(),
			profileFeatureStats: getDefaultProfileFeatureStats()
		},
		cacheModule: {
			at: getDefaultCacheAt()
		}
	}),
	getters: {
		appBaseInfo(state) {
			return state.appModule && state.appModule.baseInfo
				? state.appModule.baseInfo
				: getDefaultAppBaseInfo()
		},
		appName() {
			const name = String(this.appBaseInfo && this.appBaseInfo.appName || '').trim()
			return name || '恋人手册'
		},
		userInfo(state) {
			return state.authModule ? state.authModule.userInfo : null
		},
		coupleCenterData(state) {
			return state.coupleModule && state.coupleModule.centerData
				? state.coupleModule.centerData
				: getDefaultCoupleCenterData()
		},
		planPreview(state) {
			return state.planModule && Array.isArray(state.planModule.preview)
				? state.planModule.preview
				: getDefaultPlanPreview()
		},
		overviewStats(state) {
			return state.overviewModule && state.overviewModule.stats
				? state.overviewModule.stats
				: getDefaultOverviewStats()
		},
		profileFeatureStats(state) {
			return state.overviewModule && state.overviewModule.profileFeatureStats
				? state.overviewModule.profileFeatureStats
				: getDefaultProfileFeatureStats()
		},
		cacheAt(state) {
			return state.cacheModule && state.cacheModule.at
				? state.cacheModule.at
				: getDefaultCacheAt()
		},
		isLoggedIn() {
			const userState = this.userInfo || {}
			if (userState && userState._id) {
				return true
			}
			return hasValidLogin(getCurrentUniIdUser())
		}
	},
	actions: {
		initAppBaseInfo(baseInfo = null) {
			const nextBaseInfo = baseInfo && typeof baseInfo === 'object'
				? baseInfo
				: (typeof uni.getAppBaseInfo === 'function' ? uni.getAppBaseInfo() : {})
			this.setAppBaseInfo(nextBaseInfo)
			return this.appBaseInfo
		},
		setAppBaseInfo(baseInfo = {}) {
			this.appModule = {
				baseInfo: normalizeAppBaseInfo(baseInfo)
			}
		},
		isCacheValid(cacheKey = '', ttl = 0) {
			const cachedAt = Number(this.cacheAt[cacheKey] || 0)
			if (!cachedAt) {
				return false
			}

			const validDuration = Math.max(0, Number(ttl || CACHE_TTL[cacheKey] || 0))
			if (!validDuration) {
				return false
			}

			return Date.now() - cachedAt < validDuration
		},
		markCache(cacheKey = '') {
			if (!cacheKey) {
				return
			}

			this.cacheModule = {
				at: Object.assign({}, this.cacheAt, {
					[cacheKey]: Date.now()
				})
			}
		},
		invalidateCaches(cacheKeys = []) {
			const keys = Array.isArray(cacheKeys) && cacheKeys.length
				? cacheKeys
				: [CACHE_KEY_USER, CACHE_KEY_COUPLE, CACHE_KEY_PLAN_PREVIEW, CACHE_KEY_OVERVIEW]

			const nextCacheAt = Object.assign({}, this.cacheAt)
			keys.forEach((cacheKey) => {
				nextCacheAt[cacheKey] = 0
			})
			this.cacheModule = {
				at: nextCacheAt
			}
		},
		invalidateRelationCounters() {
			this.invalidateCaches([CACHE_KEY_PLAN_PREVIEW, CACHE_KEY_OVERVIEW])
		},
		clearAllState() {
			const currentBaseInfo = this.appBaseInfo
			this.appModule = {
				baseInfo: normalizeAppBaseInfo(currentBaseInfo)
			}
			this.authModule = {
				userInfo: null
			}
			this.coupleModule = {
				centerData: getDefaultCoupleCenterData()
			}
			this.planModule = {
				preview: getDefaultPlanPreview()
			}
			this.overviewModule = {
				stats: getDefaultOverviewStats(),
				profileFeatureStats: getDefaultProfileFeatureStats()
			}
			this.cacheModule = {
				at: getDefaultCacheAt()
			}
			Object.keys(pendingTaskMap).forEach((taskKey) => {
				delete pendingTaskMap[taskKey]
			})
		},
		updateUserInfo(userInfo = null, { markFetched = true } = {}) {
			this.authModule = {
				userInfo: userInfo || null
			}
			if (userInfo) {
				saveCachedUserProfile(userInfo)
			}
			if (markFetched) {
				this.markCache(CACHE_KEY_USER)
			}
		},
		updateCoupleCenterData(centerData = {}, { markFetched = true } = {}) {
			this.coupleModule = {
				centerData: normalizeCoupleCenterResult(centerData)
			}
			if (markFetched) {
				this.markCache(CACHE_KEY_COUPLE)
			}
		},
		updateOverviewStats(overviewStats = {}, { markFetched = true } = {}) {
			const nextOverviewStats = overviewStats && typeof overviewStats === 'object'
				? Object.assign({}, getDefaultOverviewStats(), overviewStats)
				: getDefaultOverviewStats()
			this.overviewModule = {
				stats: nextOverviewStats,
				profileFeatureStats: buildProfileFeatureStatsFromOverview(nextOverviewStats)
			}
			if (markFetched) {
				this.markCache(CACHE_KEY_OVERVIEW)
			}
		},
		updatePlanPreview(planPreview = [], { markFetched = true } = {}) {
			this.planModule = {
				preview: Array.isArray(planPreview) && planPreview.length ? planPreview : getDefaultPlanPreview()
			}
			if (markFetched) {
				this.markCache(CACHE_KEY_PLAN_PREVIEW)
			}
		},
		runPending(taskKey = '', taskExecutor = async () => null) {
			if (!taskKey || typeof taskExecutor !== 'function') {
				return Promise.resolve(null)
			}

			if (pendingTaskMap[taskKey]) {
				return pendingTaskMap[taskKey]
			}

			const pendingTask = Promise.resolve()
				.then(() => taskExecutor())
				.finally(() => {
					delete pendingTaskMap[taskKey]
				})

			pendingTaskMap[taskKey] = pendingTask
			return pendingTask
		},
		async restoreSessionData({ force = false } = {}) {
			const authInfo = getCurrentUniIdUser()
			if (!hasValidLogin(authInfo)) {
				if (authInfo && authInfo.uid) {
					clearUniIdTokenStorage()
				}
				this.clearAllState()
				return
			}

			await Promise.all([
				this.fetchUserInfo({ force }),
				this.fetchCoupleCenter({ force }),
				this.fetchPlanPreview({ force }),
				this.fetchOverviewStats({ force })
			])
		},
		async fetchUserInfo({ force = false } = {}) {
			if (!this.isLoggedIn) {
				this.updateUserInfo(null, {
					markFetched: false
				})
				return null
			}

			if (!force && this.userInfo && this.userInfo._id && this.isCacheValid(CACHE_KEY_USER)) {
				return this.userInfo
			}

			return this.runPending(CACHE_KEY_USER, async () => {
				const result = await getUserApi().getMine()
				if (result && result.errCode && result.errCode !== 0) {
					clearUniIdTokenStorage()
					this.clearAllState()
					throw new Error(result.errMsg || '获取用户信息失败')
				}

				this.updateUserInfo(result.userInfo || null)
				return this.userInfo
			})
		},
		async fetchCoupleCenter({ force = false } = {}) {
			if (!this.isLoggedIn) {
				this.updateCoupleCenterData(getDefaultCoupleCenterData(), {
					markFetched: false
				})
				return this.coupleCenterData
			}

			if (!force && this.isCacheValid(CACHE_KEY_COUPLE)) {
				return this.coupleCenterData
			}

			return this.runPending(CACHE_KEY_COUPLE, async () => {
				const result = await getCoupleApi().getCenter()
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '获取情侣信息失败')
				}

				this.updateCoupleCenterData(result || {})
				return this.coupleCenterData
			})
		},
		async fetchPlanPreview({ force = false } = {}) {
			if (!this.isLoggedIn) {
				this.updatePlanPreview(getDefaultPlanPreview(), {
					markFetched: false
				})
				return this.planPreview
			}

			if (!force && this.isCacheValid(CACHE_KEY_PLAN_PREVIEW)) {
				return this.planPreview
			}

			return this.runPending(CACHE_KEY_PLAN_PREVIEW, async () => {
				const result = await getPlanApi().getList({
					page: 1,
					pageSize: 3
				})
				if (result && result.errCode && result.errCode !== 0) {
					if (result.errCode === 'love-note-no-couple') {
						this.updatePlanPreview(getDefaultPlanPreview())
						return this.planPreview
					}
					throw new Error(result.errMsg || '获取愿望清单失败')
				}

				this.updatePlanPreview(buildPlanPreviewFromResult(result))
				return this.planPreview
			})
		},
		async fetchOverviewStats({ force = false } = {}) {
			if (!this.isLoggedIn) {
				this.updateOverviewStats(getDefaultOverviewStats(), {
					markFetched: false
				})
				return this.overviewStats
			}

			if (!force && this.isCacheValid(CACHE_KEY_OVERVIEW)) {
				return this.overviewStats
			}

			return this.runPending(CACHE_KEY_OVERVIEW, async () => {
				const result = await getStatsApi().getOverview()
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '获取统计信息失败')
				}

				this.updateOverviewStats(buildOverviewStats(result))
				return this.overviewStats
			})
		}
	}
})

export {
	getDefaultAppBaseInfo,
	getDefaultCoupleCenterData,
	getDefaultOverviewStats,
	getDefaultPlanPreview,
	getDefaultProfileFeatureStats
}
