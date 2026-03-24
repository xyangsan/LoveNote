<template>
	<view class="login-page">
		<image
			class="login-page__bg"
			src="https://env-00jxhb140x6o.normal.cloudstatic.cn/love-note/login-bg.jpg"
			mode="aspectFill"
		></image>
		<view class="login-page__mask"></view>
		<image
			class="login-page__bottom"
			src="https://env-00jxhb140x6o.normal.cloudstatic.cn/love-note/login-bg-1.png"
			mode="widthFix"
		></image>
		<view class="login-page__meteor">
			<view
				v-for="item in meteorList"
				:key="item.id"
				class="meteor"
				:style="{
					top: item.top,
					left: item.left,
					'--meteor-length': item.length,
					'--meteor-duration': item.duration,
					'--meteor-delay': item.delay,
					'--meteor-travel-x': item.travelX,
					'--meteor-travel-y': item.travelY,
					'--meteor-glint-duration': item.glintDuration,
					'--meteor-glint-delay': item.glintDelay,
					'--meteor-head-size': item.headSize
				}"
			></view>
		</view>

		<view class="login-page__content">
			<view class="login-page__main">
				<view class="love-title-block login-title-block">
					<text class="love-title-block__title">一键进入你的情侣空间</text>
				</view>

				<!-- #ifdef MP-WEIXIN -->
				<view class="login-editor">
					<view class="login-editor__avatar">
						<love-avatar-picker
							:src="displayAvatar"
							fallback="/static/user-empty.png"
							label="选择头像"
							@chooseavatar="onChooseAvatar"
						></love-avatar-picker>
					</view>

					<view class="login-editor__body">
						<text class="love-field-label login-editor__label">微信昵称</text>
						<fui-input
							:value="loginForm.nickname"
							type="nickname"
							placeholder="请输入你的昵称"
							background-color="rgba(255, 255, 255, 0.94)"
							:border-bottom="false"
							:padding="['28rpx', '24rpx']"
							:radius="24"
							:size="28"
							color="#5a3427"
							@input="onNicknameInput"
							@blur="onNicknameBlur"
						></fui-input>
						<text class="love-field-tip login-editor__tip">首次填写后会自动记住头像和昵称，后续登录可直接回填。</text>
					</view>

					<view class="love-action-stack login-actions">
						<fui-button
							text="微信一键登录"
							background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
							color="#ffffff"
							radius="999rpx"
							height="90rpx"
							:size="28"
							:bold="true"
							:loading="isLoggingIn"
							@click="handleWechatLogin"
						></fui-button>
					</view>
				</view>
				<!-- #endif -->

				<!-- #ifndef MP-WEIXIN -->
				<view class="login-notice">
					<text class="login-notice__text">当前登录页面面向微信小程序环境开发，请在微信开发者工具或真机小程序中体验。</text>
				</view>
				<!-- #endif -->
			</view>
		</view>

		<view class="login-page__footer">
			<fui-divider
				class="login-divider"
				text="登录说明"
				width="100%"
				height="56"
				divider-color="rgba(147, 69, 49, 0.22)"
				color="#9f4936"
				:size="22"
			></fui-divider>
			<text class="love-field-tip login-note">如果你是从受保护页面进入，登录成功后会自动继续原来的跳转。</text>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		emitAuthChanged,
		getCachedUserProfile,
		hasValidLogin
	} from '../../common/auth-center.js'
	import { loginByWeixinProfile } from '../../common/auth-login.js'

	const TABBAR_PATHS = ['/pages/index/index', '/pages/profile/index']

	function normalizePath(url = '') {
		const path = `${url}`.split('?')[0].split('#')[0]
		if (!path) {
			return ''
		}

		return path.startsWith('/') ? path : `/${path}`
	}

	export default {
		data() {
			return {
				isLoggingIn: false,
				redirectUrl: '',
				meteorList: [
					{
						id: 'meteor-1',
						top: '8%',
						left: '86%',
						length: '250rpx',
						duration: '6.6s',
						delay: '0s',
						travelX: '-560rpx',
						travelY: '560rpx',
						glintDuration: '8.2s',
						glintDelay: '0.4s',
						headSize: '19rpx'
					},
					{
						id: 'meteor-2',
						top: '16%',
						left: '72%',
						length: '208rpx',
						duration: '7.2s',
						delay: '1.6s',
						travelX: '-520rpx',
						travelY: '520rpx',
						glintDuration: '9.4s',
						glintDelay: '1.3s',
						headSize: '17rpx'
					},
					{
						id: 'meteor-3',
						top: '4%',
						left: '64%',
						length: '226rpx',
						duration: '5.8s',
						delay: '3.2s',
						travelX: '-500rpx',
						travelY: '500rpx',
						glintDuration: '7.8s',
						glintDelay: '2.7s',
						headSize: '18rpx'
					},
					{
						id: 'meteor-4',
						top: '22%',
						left: '92%',
						length: '272rpx',
						duration: '7.8s',
						delay: '2.4s',
						travelX: '-620rpx',
						travelY: '620rpx',
						glintDuration: '10.2s',
						glintDelay: '0.9s',
						headSize: '21rpx'
					},
					{
						id: 'meteor-5',
						top: '12%',
						left: '56%',
						length: '194rpx',
						duration: '6.9s',
						delay: '4.1s',
						travelX: '-480rpx',
						travelY: '480rpx',
						glintDuration: '8.8s',
						glintDelay: '3.1s',
						headSize: '16rpx'
					},
					{
						id: 'meteor-6',
						top: '28%',
						left: '78%',
						length: '220rpx',
						duration: '7.5s',
						delay: '5.2s',
						travelX: '-540rpx',
						travelY: '540rpx',
						glintDuration: '9.8s',
						glintDelay: '2.2s',
						headSize: '18rpx'
					}
				],
				loginForm: {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				}
			}
		},
		computed: {
			displayAvatar() {
				return this.loginForm.avatarUrl || DEFAULT_AVATAR
			}
		},
		onLoad(options = {}) {
			this.redirectUrl = options.redirect ? decodeURIComponent(options.redirect) : ''
			this.applyCachedProfile({
				force: true
			})
		},
		onShow() {
			if (hasValidLogin()) {
				this.navigateAfterLogin()
				return
			}

			this.applyCachedProfile()
		},
		methods: {
			resetLoginForm() {
				this.loginForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				}
			},
			applyCachedProfile({ force = false } = {}) {
				const cachedProfile = getCachedUserProfile()
				if (!cachedProfile) {
					return
				}

				const shouldUseCachedNickname = force || !this.loginForm.nickname
				const shouldUseCachedAvatar = force || !this.loginForm.avatarUrl
				const nextNickname = shouldUseCachedNickname ? (cachedProfile.nickname || '') : this.loginForm.nickname
				const nextAvatar = shouldUseCachedAvatar
					? (cachedProfile.avatarUrl || cachedProfile.avatarFileId || '')
					: this.loginForm.avatarUrl
				const nextAvatarFileId = shouldUseCachedAvatar
					? (cachedProfile.avatarFileId || '')
					: this.loginForm.avatarFileId

				this.loginForm = {
					...this.loginForm,
					nickname: nextNickname,
					avatarUrl: nextAvatar,
					avatarFileId: nextAvatarFileId
				}
			},
			onChooseAvatar(event) {
				this.loginForm.avatarUrl = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : ''
				this.loginForm.avatarFileId = ''
			},
			onNicknameInput(value) {
				this.loginForm.nickname = value ? `${value}` : ''
			},
			onNicknameBlur(event) {
				this.loginForm.nickname = event.detail.value || this.loginForm.nickname
			},
			navigateAfterLogin() {
				const targetPath = normalizePath(this.redirectUrl)
				if (targetPath) {
					if (TABBAR_PATHS.includes(targetPath)) {
						uni.switchTab({
							url: targetPath
						})
						return
					}

					uni.redirectTo({
						url: this.redirectUrl
					})
					return
				}

				if (getCurrentPages().length > 1) {
					uni.navigateBack()
					return
				}

				uni.switchTab({
					url: '/pages/profile/index'
				})
			},
			async handleWechatLogin() {
				// #ifndef MP-WEIXIN
				uni.showToast({
					title: '请在微信小程序环境中登录',
					icon: 'none'
				})
				return
				// #endif

				if (this.isLoggingIn) {
					return
				}

				this.isLoggingIn = true
				uni.showLoading({
					title: '登录中',
					mask: true
				})

				try {
					const result = await loginByWeixinProfile(this.loginForm)
					this.resetLoginForm()
					emitAuthChanged({
						action: 'login',
						userInfo: result.userInfo || null
					})
					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})
					setTimeout(() => {
						this.navigateAfterLogin()
					}, 300)
				} catch (error) {
					console.error('login page handleWechatLogin failed', error)
					uni.showToast({
						title: error.message || '登录失败，请稍后重试',
						icon: 'none'
					})
				} finally {
					this.isLoggingIn = false
					uni.hideLoading()
				}
			}
		}
	}
</script>

<style>
	page {
		background: #fff6f1;
	}

	.login-page {
		position: relative;
		min-height: 100vh;
		overflow: hidden;
		background: #fff6f1;
	}

	.login-page__bg,
	.login-page__mask,
	.login-page__bottom,
	.login-page__meteor {
		position: absolute;
		left: 0;
		width: 100%;
		pointer-events: none;
	}

	.login-page__bg {
		top: 0;
		height: 100%;
	}

	.login-page__mask {
		top: 0;
		height: 100%;
		background:
			linear-gradient(180deg, rgba(255, 248, 244, 0.22) 0%, rgba(255, 244, 238, 0.12) 26%, rgba(255, 247, 241, 0.18) 56%, rgba(255, 247, 241, 0.78) 100%);
	}

	.login-page__meteor {
		top: 0;
		height: 56%;
		z-index: 1;
		overflow: hidden;
	}

	.login-page__meteor .meteor {
		position: absolute;
		width: var(--meteor-length);
		height: 3rpx;
		border-radius: 999rpx;
		opacity: 0;
		transform: translate3d(120rpx, -120rpx, 0) rotate(135deg);
		transform-origin: right center;
		background: linear-gradient(90deg, rgba(236, 117, 88, 0) 0%, rgba(238, 126, 98, 0.08) 28%, rgba(244, 160, 138, 0.26) 62%, rgba(255, 226, 216, 0.82) 100%);
		box-shadow: 0 0 10rpx rgba(244, 170, 151, 0.24);
		animation: meteorFall var(--meteor-duration) cubic-bezier(0.2, 0.08, 0.18, 1) var(--meteor-delay) infinite;
	}

	.login-page__meteor .meteor::before {
		content: "";
		position: absolute;
		right: -2rpx;
		top: 50%;
		width: var(--meteor-head-size);
		height: var(--meteor-head-size);
		border-radius: 28% 62% 24% 58%;
		border: 1rpx solid rgba(255, 255, 255, 0.7);
		transform: translateY(-50%) rotate(45deg) scale(0.9);
		background: linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.98) 32%, rgba(255, 248, 244, 0.92) 56%, rgba(255, 234, 226, 0.46) 82%, rgba(236, 117, 88, 0.06) 100%);
		box-shadow: 0 0 14rpx rgba(255, 255, 255, 1), 0 0 26rpx rgba(255, 247, 243, 0.84), 0 0 34rpx rgba(255, 236, 228, 0.3);
		animation: meteorGlint var(--meteor-glint-duration) ease-in-out var(--meteor-glint-delay) infinite;
	}

	.login-page__meteor .meteor::after {
		content: "";
		position: absolute;
		top: 50%;
		left: 18%;
		width: 72%;
		height: 8rpx;
		transform: translateY(-50%);
		border-radius: 999rpx;
		background: linear-gradient(90deg, rgba(236, 117, 88, 0) 0%, rgba(239, 132, 104, 0.06) 28%, rgba(246, 174, 155, 0.2) 54%, rgba(255, 230, 222, 0.28) 70%, rgba(255, 255, 255, 0) 100%);
		filter: blur(2rpx);
	}

	@keyframes meteorFall {
		0% {
			transform: translate3d(120rpx, -120rpx, 0) rotate(135deg);
			opacity: 0;
		}

		8% {
			opacity: 0.92;
		}

		72% {
			opacity: 0.84;
		}

		100% {
			transform: translate3d(var(--meteor-travel-x), var(--meteor-travel-y), 0) rotate(135deg);
			opacity: 0;
		}
	}

	@keyframes meteorGlint {
		0%, 10%, 26%, 100% {
			opacity: 0.48;
			transform: translateY(-50%) rotate(45deg) scale(0.82);
		}

		13% {
			opacity: 1;
			transform: translateY(-50%) rotate(45deg) scale(1.46);
		}

		16% {
			opacity: 0.7;
			transform: translateY(-50%) rotate(45deg) scale(0.94);
		}

		55% {
			opacity: 0.46;
			transform: translateY(-50%) rotate(45deg) scale(0.86);
		}

		59% {
			opacity: 1;
			transform: translateY(-50%) rotate(45deg) scale(1.52);
		}

		63% {
			opacity: 0.72;
			transform: translateY(-50%) rotate(45deg) scale(0.96);
		}

		81% {
			opacity: 0.88;
			transform: translateY(-50%) rotate(45deg) scale(1.16);
		}
	}


	.login-page__bottom {
		bottom: 0;
		z-index: 1;
	}

	.login-page__content {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 88rpx 40rpx 220rpx;
		box-sizing: border-box;
	}

	.login-page__main {
		width: 100%;
		max-width: 620rpx;
	}

	.login-page__footer {
		position: absolute;
		left: 40rpx;
		right: 40rpx;
		bottom: calc(4rpx + env(safe-area-inset-bottom));
		z-index: 2;
		text-align: center;
	}

	.login-title-block {
		padding: 0;
		text-align: center;
	}

	.login-title-block .love-title-block__eyebrow {
		color: #a64a36;
	}

	.login-title-block .love-title-block__title {
		color: #7f2f21;
		text-shadow: 0 8rpx 18rpx rgba(255, 255, 255, 0.16);
	}

	.login-title-block .love-title-block__desc {
		color: #9d4735;
	}

	.login-editor {
		margin-top: 56rpx;
	}

	.login-editor__avatar {
		display: flex;
		justify-content: center;
	}

	.login-editor__body {
		margin-top: 36rpx;
	}

	.login-editor__label {
		text-align: center;
		color: #8f3c2b;
	}

	.login-editor__tip,
	.login-note {
		text-align: center;
		color: #a24c39;
	}

	.login-note {
		display: block;
		margin-top: 16rpx;
	}

	.login-actions {
		margin-top: 32rpx;
	}

	.login-notice {
		margin-top: 56rpx;
		padding: 24rpx 28rpx;
		border-radius: 28rpx;
		background: rgba(255, 255, 255, 0.5);
	}

	.login-notice__text {
		font-size: 22rpx;
		line-height: 1.7;
		color: #94503d;
		text-align: center;
	}

	.login-divider {
		margin-top: 0;
	}
</style>
