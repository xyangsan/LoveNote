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