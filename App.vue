<template>
	<view class="app-root">
		<love-login-popup :visible="loginModal.visible" :reason="loginModal.reason"
			:redirect-url="loginModal.redirectUrl" @close="handleCloseLoginModal" @success="handleLoginSuccess" />
	</view>
</template>

<script>
	import LoveLoginPopup from './components/love-login-popup/love-login-popup.vue'
	import {
		emitAuthChanged
	} from './common/auth-center.js'
	import {
		continuePendingRoute,
		installRouteAuthGuard
	} from './common/auth-guard.js'
	import {
		useAppStateStore
	} from './store/app-state.js'
	import {
		closeLoginModal,
		getLoginModalSnapshot,
		hideLoginModal,
		subscribeLoginModal
	} from './common/auth-modal.js'
	import {
		resetInterstitialAdState
	} from './common/utils/interstitial-ad.js'
	import { getPlatformApi } from './common/api/platform.js'

	const DEVICE_ID_KEY = 'love_device_id'

	function resolveDeviceId() {
		try {
			let deviceId = uni.getStorageSync(DEVICE_ID_KEY)
			if (!deviceId) {
				deviceId = `d_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
				uni.setStorageSync(DEVICE_ID_KEY, deviceId)
			}
			return deviceId
		} catch (error) {
			return ''
		}
	}

	function readLaunchOptions() {
		try {
			if (typeof uni.getLaunchOptionsSync === 'function') {
				const options = uni.getLaunchOptionsSync() || {}
				return {
					scene: options.scene === undefined ? '' : options.scene,
					path: options.path || ''
				}
			}
		} catch (error) {
			// 非小程序环境没有这个 API
		}
		return { scene: '', path: '' }
	}

	export default {
		components: {
			LoveLoginPopup
		},
		data() {
			return {
				appStateStore: null,
				loginModal: getLoginModalSnapshot(),
				unsubscribeLoginModal: null
			}
		},
		created() {
			this.unsubscribeLoginModal = subscribeLoginModal((snapshot) => {
				this.loginModal = snapshot
			})
		},
		beforeDestroy() {
			if (this.unsubscribeLoginModal) {
				this.unsubscribeLoginModal()
				this.unsubscribeLoginModal = null
			}
		},
		onLaunch() {
			// 插屏广告每次冷启动重置「已展示」状态：一次 App 运行内最多弹一次
			resetInterstitialAdState()
			installRouteAuthGuard()
			this.reportVisit()
			this.ensureAppStateStore().initAppBaseInfo()
			uni.loadFontFace({
				global: true,
				family: "Fluent Emoji Flat",
				source: 'url("https://env-00jxhb140x6o.normal.cloudstatic.cn/fonts/FluentEmojiFlat.ttf")',
				success() {
					console.log("font load success");
				},
			});

		},
		onShow() {},
		onHide() {},
		methods: {
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}

				return this.appStateStore
			},
			/**
			 * 上报「进入小程序」：每次冷启动一条，用于运营后台算每日 UV / 打开次数。
			 * 任何异常都不能影响启动，所以整段包在 try 里，Promise 也吞掉。
			 */
			reportVisit() {
				try {
					const launch = readLaunchOptions()
					const deviceId = resolveDeviceId()
					let platform = ''
					let version = ''

					try {
						const systemInfo = uni.getSystemInfoSync() || {}
						platform = systemInfo.uniPlatform || ''
						version = systemInfo.appVersion || ''
					} catch (error) {
						// 拿不到就不传
					}

					getPlatformApi()
						.reportVisit({
							deviceId,
							scene: String(launch.scene === undefined ? '' : launch.scene),
							path: launch.path || '',
							platform,
							version
						})
						.catch(() => {})
				} catch (error) {
					console.warn('reportVisit failed', error)
				}
			},
			handleCloseLoginModal() {
				closeLoginModal()
			},
			handleLoginSuccess(result = {}) {
				hideLoginModal()
				emitAuthChanged({
					action: 'login',
					userInfo: result.userInfo || null
				})

				const hasPendingRoute = continuePendingRoute()
				if (!hasPendingRoute) {
					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})
				}
			}
		}
	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import './components/firstui/common/fui-app.css';
	@import './components/firstui/fui-theme/fui-theme.css';
	@import './common/styles/love-theme.css';

	.app-root {
		position: relative;
		z-index: 0;
	}
	.ad-view {
		margin-top: 15px;
	}
</style>