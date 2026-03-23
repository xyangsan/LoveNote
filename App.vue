<template>
	<view class="app-root">
		<love-login-popup
			:visible="loginModal.visible"
			:reason="loginModal.reason"
			:redirect-url="loginModal.redirectUrl"
			@close="handleCloseLoginModal"
			@success="handleLoginSuccess"
		/>
	</view>
</template>

<script>
	import LoveLoginPopup from './components/love-login-popup/love-login-popup.vue'
	import { emitAuthChanged } from './common/auth-center.js'
	import { continuePendingRoute, installRouteAuthGuard } from './common/auth-guard.js'
	import {
		closeLoginModal,
		getLoginModalSnapshot,
		hideLoginModal,
		subscribeLoginModal
	} from './common/auth-modal.js'

	export default {
		components: {
			LoveLoginPopup
		},
		data() {
			return {
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
			installRouteAuthGuard()
			console.log('App Launch')
		},
		onShow() {
			console.log('App Show')
		},
		onHide() {
			console.log('App Hide')
		},
		methods: {
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
</style>
