<template>
	<view class="tab-shell">
		<view class="tab-shell__glow tab-shell__glow--l"></view>
		<view class="tab-shell__glow tab-shell__glow--r"></view>

		<view class="tab-shell__content">
			<tab-home
				v-if="mountedTabs.home"
				v-show="activeTab === 'home'"
				ref="tabHome"
				:settings="appSettings"
				:scroll-top="scrollTop"
				@switch-tab="handleSwitchTab"
			/>
			<tab-feed
				v-if="mountedTabs.feed"
				v-show="activeTab === 'feed'"
				ref="tabFeed"
				:scroll-top="scrollTop"
				@comment-visible-change="handleFeedCommentVisible"
			/>
			<tab-game
				v-if="mountedTabs.game"
				v-show="activeTab === 'game'"
				ref="tabGame"
				:settings="appSettings"
				:scroll-top="scrollTop"
			/>
			<tab-profile
				v-if="mountedTabs.profile"
				v-show="activeTab === 'profile'"
				ref="tabProfile"
				:scroll-top="scrollTop"
				@switch-tab="handleSwitchTab"
			/>
		</view>

		<!-- 自定义 4-Tab 底部导航（原地组件切换，不使用 uni.reLaunch） -->
		<noir-tabbar
			v-show="!hideTabbar"
			ref="tabbar"
			:active="activeTab"
			:settings="appSettings"
			:in-shell="true"
			@change="handleSwitchTab"
			@refresh="handleRefreshActiveTab"
		/>
	</view>
</template>

<script>
	import { loadAppSettings, readAppSettingsCache } from '../../common/app-settings.js'
	import { subscribeAuthChanged } from '../../common/auth-center.js'
	import {
		getActiveTabKey,
		getVisibleTabItems,
		resolveTabKey,
		setActiveTabKey,
		subscribeTabChange
	} from '../../common/utils/tab-nav.js'
	import { tryShowInterstitialAd } from '../../common/utils/interstitial-ad.js'
	import TabHome from './tabbar/tab-home.vue'
	import TabFeed from './tabbar/tab-feed.vue'
	import TabGame from './tabbar/tab-game.vue'
	import TabProfile from './tabbar/tab-profile.vue'

	const INTERSTITIAL_AD_SHOW_RATE = 1 / 3

	export default {
		components: {
			TabHome,
			TabFeed,
			TabGame,
			TabProfile
		},
		data() {
			return {
				activeTab: 'home',
				mountedTabs: {
					home: true,
					feed: false,
					game: false,
					profile: false
				},
				appSettings: readAppSettingsCache(),
				scrollTop: 0,
				hideTabbar: false,
				unsubTab: null,
				unsubAuth: null
			}
		},
		onLoad(options = {}) {
			// 初始化只确定「当前打开的是哪个 Tab」，数据刷新统一交给 onShow：
			// onLoad 与 onShow 会连续触发，两边都刷会对同一 Tab 发两轮首屏请求。
			const initKey = options.tab ? resolveTabKey(options.tab) : getActiveTabKey()
			this.activateTab(initKey, { refresh: false })
			if (initKey !== getActiveTabKey()) {
				// 路由参数 ?tab=xxx 优先（分享卡片 / redirectTo 冷启动落地），同步到全局总线，
				// 保证 tabbar 高亮、下次 onShow 的判定基准都指向同一个 Tab
				setActiveTabKey(initKey, { refresh: false })
			}
			this.syncPermissions(true).then((forcedHome) => {
				// 远端权限晚于 onShow 返回时，当前 Tab 可能已被运营端关闭，补刷一次首页
				if (forcedHome) this.$nextTick(() => this.refreshActiveTab(true))
			})

			this.unsubTab = subscribeTabChange(({ key, refresh }) => {
				this.activateTab(key, { refresh })
			})
			this.unsubAuth = subscribeAuthChanged(() => {
				this.refreshActiveTab(true)
			})

			tryShowInterstitialAd(INTERSTITIAL_AD_SHOW_RATE)
		},
		onShow() {
			this.syncPermissions(false)
			// tabbar 页在 onShow 里按「当前打开的 Tab」刷新数据：
			// 全局总线可能已被别的入口改过（独立 tabbar 页点「首页」、二级页 goHomeTab、
			// 分享冷启动 ?tab=xxx），所以先与 getActiveTabKey() 对齐，再只刷这一个 Tab。
			// 隐藏的 Tab 不刷：它们重新显示时会各自走一次 onShow。
			const globalKey = getActiveTabKey()
			const switched = globalKey !== this.activeTab
			if (switched) {
				this.activateTab(globalKey, { refresh: false })
			}
			const flush = () => this.refreshActiveTab(true)
			if (switched) {
				// 新 Tab 的内容刚被 v-if 挂载，等渲染完再取 ref，否则刷到的是空引用
				this.$nextTick(flush)
			} else {
				flush()
			}
		},
		onUnload() {
			if (this.unsubTab) {
				this.unsubTab()
				this.unsubTab = null
			}
			if (this.unsubAuth) {
				this.unsubAuth()
				this.unsubAuth = null
			}
		},
		onPageScroll(e) {
			const next = Math.max(0, Number(e && e.scrollTop || 0))
			if (next !== this.scrollTop) {
				this.scrollTop = next
			}
		},
		async onPullDownRefresh() {
			try {
				// 先对齐权限（可能把已关闭的 Tab 切回首页），再刷「最终」当前 Tab
				await this.syncPermissions(true)
				await this.refreshActiveTab(true)
			} finally {
				uni.stopPullDownRefresh()
			}
		},
		onReachBottom() {
			if (this.activeTab === 'feed' && this.$refs.tabFeed && typeof this.$refs.tabFeed.loadMore === 'function') {
				this.$refs.tabFeed.loadMore()
			}
		},
		methods: {
			/**
			 * 对齐模块权限与当前 Tab。
			 * @param {boolean} remote 是否强制向服务端拉一次最新配置
			 * @returns {Promise<boolean>} 当前 Tab 因被关闭而强制切回首页时返回 true
			 */
			async syncPermissions(remote = false) {
				this.appSettings = readAppSettingsCache()
				if (remote) {
					const latest = await loadAppSettings()
					if (latest) this.appSettings = latest
				}
				const visibleKeys = getVisibleTabItems(this.appSettings).map((t) => t.key)
				if (!visibleKeys.includes(this.activeTab)) {
					this.activeTab = 'home'
					setActiveTabKey('home', { refresh: false })
					return true
				}
				return false
			},
			activateTab(key, { refresh = true } = {}) {
				const safeKey = resolveTabKey(key)
				this.mountedTabs[safeKey] = true
				this.activeTab = safeKey
				if (safeKey !== 'feed') {
					this.hideTabbar = false
				}
				if (refresh) {
					this.$nextTick(() => {
						this.refreshActiveTab(true)
					})
				}
			},
			handleFeedCommentVisible(visible) {
				this.hideTabbar = Boolean(visible)
			},
			handleSwitchTab(key) {
				const safeKey = resolveTabKey(key)
				this.scrollTop = 0
				setActiveTabKey(safeKey, { refresh: true })
				this.syncPermissions(false)
				if (typeof uni.pageScrollTo === 'function') {
					uni.pageScrollTo({ scrollTop: 0, duration: 0 })
				}
			},
			async handleRefreshActiveTab() {
				// 点 tabbar 当前项：权限可能刚被运营端改过，先对齐再刷同一个 Tab
				await this.syncPermissions(true)
				await this.refreshActiveTab(true)
			},
			async refreshActiveTab(force = true) {
				const refMap = {
					home: this.$refs.tabHome,
					feed: this.$refs.tabFeed,
					game: this.$refs.tabGame,
					profile: this.$refs.tabProfile
				}
				const comp = refMap[this.activeTab]
				if (comp && typeof comp.refresh === 'function') {
					await comp.refresh({ force })
				}
			}
		}
	}
</script>

<style scoped>
	.tab-shell {
		position: relative;
		min-height: 100vh;
		background:
			radial-gradient(88% 42% at 50% 0%, rgba(226, 124, 78, 0.10) 0%, rgba(17, 13, 11, 0) 68%),
			var(--noir-bg);
		color: var(--noir-text);
		overflow-x: hidden;
	}

	.tab-shell__glow {
		position: fixed;
		width: 380rpx;
		height: 380rpx;
		border-radius: 50%;
		filter: blur(52rpx);
		opacity: 0.24;
		pointer-events: none;
		z-index: 0;
	}

	.tab-shell__glow--l {
		top: -120rpx;
		left: -140rpx;
		background: rgba(226, 100, 63, 0.36);
	}

	.tab-shell__glow--r {
		top: 260rpx;
		right: -140rpx;
		background: rgba(216, 176, 140, 0.24);
	}

	.tab-shell__content {
		position: relative;
	}
</style>
