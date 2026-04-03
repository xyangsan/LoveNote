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

function getDefaultCoupleCenterData() {
	return {
		selfInfo: null,
		activeCouple: null,
		incomingRequests: [],
		outgoingRequests: [],
		historyList: [],
		canSendRequest: true
	}
}

function getDefaultPlanPreview() {
	return [
		{
			title: '创建第一条愿望',
			status: '待开始',
			desc: '可在愿望清单里创建愿望或计划，并同步双方进度。',
			progress: 0
		}
	]
}

function getDefaultOverviewStats() {
	return {
		isBound: false,
		albumTotal: null,
		dailyTotal: null,
		anniversaryTotal: null,
		planTotal: null,
		wishTotal: null
	}
}

function getDefaultProfileFeatureStats() {
	return {
		anniversaryTotal: null,
		albumTotal: null,
		dailyTotal: null,
		wishTotal: null,
		planTotal: null
	}
}

function normalizeCoupleCenterResult(result = {}) {
	return {
		selfInfo: result.selfInfo || null,
		activeCouple: result.activeCouple || null,
		incomingRequests: Array.isArray(result.incomingRequests) ? result.incomingRequests : [],
		outgoingRequests: Array.isArray(result.outgoingRequests) ? result.outgoingRequests : [],
		historyList: Array.isArray(result.historyList) ? result.historyList : [],
		canSendRequest: Boolean(result.canSendRequest)
	}
}

function buildPlanPreviewFromResult(result = {}) {
	const data = result && result.data ? result.data : {}
	const list = Array.isArray(data.list) ? data.list : []
	if (!list.length) {
		const recommendations = Array.isArray(data.recommendations) ? data.recommendations : []
		if (recommendations.length) {
			return recommendations.slice(0, 2).map((item) => ({
				title: item.title || '推荐愿望',
				status: '推荐',
				desc: item.description || `分类：${item.category || '未分类'}`,
				progress: 0
			}))
		}
		return getDefaultPlanPreview()
	}

	return list.slice(0, 3).map((item) => ({
		title: item.title || '愿望清单',
		status: item.status_text || '待开始',
		desc: `${item.type_text || '清单'} · ${item.category || '未分类'} · 负责人 ${item.owner_snapshot && item.owner_snapshot.nickname ? item.owner_snapshot.nickname : '我'}`,
		progress: Number(item.progress || 0)
	}))
}

function buildOverviewStats(result = {}) {
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

function buildProfileFeatureStatsFromOverview(overviewStats = {}) {
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

export const useAppStateStore = defineStore('app-state', {
	state: () => ({
		userInfo: null,
		coupleCenterData: getDefaultCoupleCenterData(),
		planPreview: getDefaultPlanPreview(),
		overviewStats: getDefaultOverviewStats(),
		profileFeatureStats: getDefaultProfileFeatureStats(),
		cacheAt: {
			[CACHE_KEY_USER]: 0,
			[CACHE_KEY_COUPLE]: 0,
			[CACHE_KEY_PLAN_PREVIEW]: 0,
			[CACHE_KEY_OVERVIEW]: 0
		}
	}),
	getters: {
		isLoggedIn() {
			const userState = this.userInfo || {}
			if (userState && userState._id) {
				return true
			}
			return hasValidLogin(getCurrentUniIdUser())
		}
	},
	actions: {
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

			this.cacheAt = Object.assign({}, this.cacheAt, {
				[cacheKey]: Date.now()
			})
		},
		invalidateCaches(cacheKeys = []) {
			const keys = Array.isArray(cacheKeys) && cacheKeys.length
				? cacheKeys
				: [CACHE_KEY_USER, CACHE_KEY_COUPLE, CACHE_KEY_PLAN_PREVIEW, CACHE_KEY_OVERVIEW]

			const nextCacheAt = Object.assign({}, this.cacheAt)
			keys.forEach((cacheKey) => {
				nextCacheAt[cacheKey] = 0
			})
			this.cacheAt = nextCacheAt
		},
		invalidateRelationCounters() {
			this.invalidateCaches([CACHE_KEY_PLAN_PREVIEW, CACHE_KEY_OVERVIEW])
		},
		clearAllState() {
			this.userInfo = null
			this.coupleCenterData = getDefaultCoupleCenterData()
			this.planPreview = getDefaultPlanPreview()
			this.overviewStats = getDefaultOverviewStats()
			this.profileFeatureStats = getDefaultProfileFeatureStats()
			this.invalidateCaches()
			Object.keys(pendingTaskMap).forEach((taskKey) => {
				delete pendingTaskMap[taskKey]
			})
		},
		updateUserInfo(userInfo = null, { markFetched = true } = {}) {
			this.userInfo = userInfo || null
			if (userInfo) {
				saveCachedUserProfile(userInfo)
			}
			if (markFetched) {
				this.markCache(CACHE_KEY_USER)
			}
		},
		updateCoupleCenterData(centerData = {}, { markFetched = true } = {}) {
			this.coupleCenterData = normalizeCoupleCenterResult(centerData)
			if (markFetched) {
				this.markCache(CACHE_KEY_COUPLE)
			}
		},
		updateOverviewStats(overviewStats = {}, { markFetched = true } = {}) {
			this.overviewStats = overviewStats && typeof overviewStats === 'object'
				? Object.assign({}, getDefaultOverviewStats(), overviewStats)
				: getDefaultOverviewStats()
			this.profileFeatureStats = buildProfileFeatureStatsFromOverview(this.overviewStats)
			if (markFetched) {
				this.markCache(CACHE_KEY_OVERVIEW)
			}
		},
		updatePlanPreview(planPreview = [], { markFetched = true } = {}) {
			this.planPreview = Array.isArray(planPreview) && planPreview.length ? planPreview : getDefaultPlanPreview()
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
				this.fetchUserInfo({
					force
				}),
				this.fetchCoupleCenter({
					force
				}),
				this.fetchPlanPreview({
					force
				}),
				this.fetchOverviewStats({
					force
				})
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
	getDefaultCoupleCenterData,
	getDefaultOverviewStats,
	getDefaultPlanPreview,
	getDefaultProfileFeatureStats
}
