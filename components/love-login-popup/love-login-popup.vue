<template>
	<view v-if="visible" class="login-popup">
		<view class="login-popup__mask" @tap="handleClose"></view>
		<view class="login-popup__panel">
			<view class="login-popup__header">
				<view>
					<text class="login-popup__eyebrow">LoveNote 登录</text>
					<text class="login-popup__title">登录后继续操作</text>
					<text class="login-popup__desc">{{ reasonText }}</text>
					<text v-if="redirectUrl" class="login-popup__target">目标页面：{{ redirectUrl }}</text>
				</view>
				<text class="login-popup__close" @tap="handleClose">关闭</text>
			</view>

			<!-- #ifdef MP-WEIXIN -->
			<view class="editor-card">
				<button class="avatar-button" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
					<image class="avatar-button__image" :src="displayAvatar"></image>
					<text class="avatar-button__hint">选择头像</text>
				</button>
				<view class="editor-card__body">
					<text class="field-label">微信昵称</text>
					<input
						class="text-input"
						type="nickname"
						placeholder="请输入你的昵称"
						:value="loginForm.nickname"
						@input="onNicknameInput"
						@blur="onNicknameBlur"
					/>
					<text class="field-tip">登录后会同步保存你的头像和昵称，后续可在资料页继续完善。</text>
				</view>
			</view>

			<button class="primary-button" hover-class="button-hover" :loading="isLoggingIn" @click="handleWechatLogin">
				微信一键登录
			</button>
			<!-- #endif -->

			<!-- #ifndef MP-WEIXIN -->
			<view class="notice-card">
				<text class="notice-card__text">当前登录弹框仅支持微信小程序环境，请在微信开发者工具或真机小程序中体验。</text>
			</view>
			<!-- #endif -->
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR
	} from '../../common/auth-center.js'
	import { loginByWeixinProfile } from '../../common/auth-login.js'

	export default {
		props: {
			visible: {
				type: Boolean,
				default: false
			},
			reason: {
				type: String,
				default: ''
			},
			redirectUrl: {
				type: String,
				default: ''
			}
		},
		data() {
			return {
				isLoggingIn: false,
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
			},
			reasonText() {
				return this.reason || '请先完成登录，之后将继续访问目标页面。'
			}
		},
		watch: {
			visible(nextVisible) {
				if (!nextVisible) {
					this.resetLoginForm()
				}
			}
		},
		methods: {
			resetLoginForm() {
				this.loginForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				}
			},
			onChooseAvatar(event) {
				this.loginForm.avatarUrl = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : ''
				this.loginForm.avatarFileId = ''
			},
			onNicknameInput(event) {
				this.loginForm.nickname = event.detail.value || ''
			},
			onNicknameBlur(event) {
				this.loginForm.nickname = event.detail.value || this.loginForm.nickname
			},
			handleClose() {
				if (this.isLoggingIn) {
					return
				}

				this.$emit('close')
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
					this.$emit('success', result)
					this.resetLoginForm()
				} catch (error) {
					console.error('love login popup login failed', error)
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
	.login-popup {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
	}

	.login-popup__mask {
		position: absolute;
		inset: 0;
		background: rgba(83, 42, 28, 0.38);
		backdrop-filter: blur(10rpx);
	}

	.login-popup__panel {
		position: absolute;
		left: 24rpx;
		right: 24rpx;
		top: 50%;
		transform: translateY(-50%);
		padding: 36rpx 32rpx;
		border-radius: 36rpx;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 246, 239, 0.98));
		box-shadow: 0 24rpx 60rpx rgba(173, 109, 77, 0.18);
	}

	.login-popup__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 20rpx;
	}

	.login-popup__eyebrow {
		display: block;
		font-size: 22rpx;
		letter-spacing: 4rpx;
		color: #b98069;
		margin-bottom: 14rpx;
	}

	.login-popup__title {
		display: block;
		font-size: 42rpx;
		font-weight: 700;
		line-height: 1.3;
		color: #5a3427;
	}

	.login-popup__desc,
	.login-popup__target {
		display: block;
		margin-top: 14rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #8b6659;
		word-break: break-all;
	}

	.login-popup__target {
		color: #c0674d;
	}

	.login-popup__close {
		flex-shrink: 0;
		font-size: 24rpx;
		color: #a97a6c;
	}

	.editor-card {
		display: flex;
		align-items: center;
		gap: 24rpx;
		margin-top: 30rpx;
		padding: 24rpx;
		border-radius: 28rpx;
		background: rgba(255, 255, 255, 0.76);
	}

	.avatar-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 200rpx;
		padding: 0;
		background: transparent;
		border: 0;
	}

	.avatar-button::after,
	.primary-button::after {
		border: 0;
	}

	.avatar-button__image {
		width: 116rpx;
		height: 116rpx;
		border-radius: 50%;
		background: #fff1eb;
		box-shadow: 0 12rpx 24rpx rgba(177, 114, 83, 0.14);
	}

	.avatar-button__hint {
		margin-top: 14rpx;
		font-size: 22rpx;
		color: #a17567;
	}

	.editor-card__body {
		flex: 1;
	}

	.field-label {
		display: block;
		font-size: 24rpx;
		color: #936d62;
		margin-bottom: 12rpx;
	}

	.text-input {
		height: 84rpx;
		padding: 0 22rpx;
		border-radius: 22rpx;
		background: #fffaf7;
		font-size: 28rpx;
		color: #5a3427;
	}

	.field-tip,
	.notice-card__text {
		display: block;
		margin-top: 12rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #a07b70;
	}

	.primary-button {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		margin-top: 26rpx;
		border: 0;
		border-radius: 999rpx;
		font-size: 28rpx;
		font-weight: 600;
		line-height: 88rpx;
		color: #ffffff;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 16rpx 28rpx rgba(231, 111, 81, 0.28);
	}

	.notice-card {
		margin-top: 26rpx;
		padding: 24rpx;
		border-radius: 24rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.button-hover {
		opacity: 0.92;
		transform: translateY(2rpx);
	}
</style>
