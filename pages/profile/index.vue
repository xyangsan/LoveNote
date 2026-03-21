<template>
	<view class="page">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view class="hero-card">
			<text class="eyebrow">LoveNote 我的资料</text>
			<text class="hero-card__title">管理你的基础信息</text>
			<text class="hero-card__desc">
				{{ isLoggedIn ? '保持昵称、头像和性别信息最新，方便后续情侣空间、纪念日和双人动态统一展示。' : '先完成微信登录，再开始管理你的个人资料。' }}
			</text>
		</view>

		<view v-if="!isLoggedIn" class="panel-card">
			<view class="panel-card__header">
				<text class="panel-card__title">登录你的账号</text>
				<text class="panel-card__tag">未登录</text>
			</view>

			<!-- #ifdef MP-WEIXIN -->
			<view class="editor-card">
				<button class="avatar-button" open-type="chooseAvatar" @chooseavatar="onChooseLoginAvatar">
					<image class="avatar-button__image" :src="displayLoginAvatar"></image>
					<text class="avatar-button__hint">选择头像</text>
				</button>
				<view class="editor-card__body">
					<text class="field-label">微信昵称</text>
					<input
						class="text-input"
						type="nickname"
						placeholder="请输入你的昵称"
						:value="loginForm.nickname"
						@input="onLoginNicknameInput"
						@blur="onLoginNicknameBlur"
					/>
					<text class="field-tip">登录后会同步保存头像与昵称，后续可以继续修改。</text>
				</view>
			</view>

			<button class="primary-button" hover-class="button-hover" :loading="isLoggingIn" @click="handleWechatLogin">
				微信一键登录
			</button>
			<!-- #endif -->

			<!-- #ifndef MP-WEIXIN -->
			<view class="notice-card">
				<text class="notice-card__text">当前登录能力面向微信小程序环境开发，请在微信开发者工具或真机小程序中体验。</text>
			</view>
			<!-- #endif -->
		</view>

		<view v-else class="content-stack">
			<view class="profile-card">
				<view class="profile-card__top">
					<button class="profile-avatar" open-type="chooseAvatar" @chooseavatar="onChooseProfileAvatar">
						<image class="profile-avatar__image" :src="displayProfileAvatar"></image>
						<text class="profile-avatar__hint">更换头像</text>
					</button>
					<view class="profile-card__meta">
						<text class="profile-card__name">{{ profileForm.nickname || currentUserName }}</text>
						<text class="profile-card__subtitle">{{ roleText }}</text>
						<text class="profile-card__summary">已加入 LoveNote，资料可随时更新。</text>
					</view>
				</view>
			</view>

			<view class="panel-card">
				<view class="panel-card__header">
					<text class="panel-card__title">编辑资料</text>
					<text class="panel-card__tag">可保存</text>
				</view>

				<view class="form-item">
					<text class="field-label">昵称</text>
					<input
						class="text-input"
						type="text"
						placeholder="请输入昵称"
						:value="profileForm.nickname"
						@input="onProfileNicknameInput"
					/>
				</view>

				<view class="form-item">
					<text class="field-label">性别</text>
					<picker class="picker-field" mode="selector" :range="genderOptions" :value="profileForm.gender" @change="onGenderChange">
						<view class="picker-field__value">{{ currentGenderText }}</view>
					</picker>
				</view>

				<button class="primary-button" hover-class="button-hover" :loading="isSaving" @click="handleSaveProfile">
					保存资料
				</button>
			</view>

			<view class="panel-card">
				<view class="panel-card__header">
					<text class="panel-card__title">账户信息</text>
					<text class="panel-card__tag">只读</text>
				</view>

				<view class="info-list">
					<view class="info-row">
						<text class="info-row__label">用户ID</text>
						<text class="info-row__value info-row__value--mono">{{ userInfo._id || '-' }}</text>
					</view>
					<view class="info-row">
						<text class="info-row__label">角色</text>
						<text class="info-row__value">{{ roleText }}</text>
					</view>
					<view class="info-row">
						<text class="info-row__label">注册时间</text>
						<text class="info-row__value">{{ registerDateText }}</text>
					</view>
					<view class="info-row">
						<text class="info-row__label">最近登录</text>
						<text class="info-row__value">{{ lastLoginDateText }}</text>
					</view>
				</view>
			</view>

			<button class="secondary-button" hover-class="button-hover" @click="handleLogout">退出登录</button>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		getAuthCenterObject,
		getCurrentUniIdUser,
		uploadAvatarIfNeeded
	} from '../../common/auth-center.js'

	const genderOptions = ['保密', '男', '女']

	function formatDateTime(timestamp) {
		if (!timestamp) {
			return '暂未记录'
		}

		const date = new Date(timestamp)
		const year = date.getFullYear()
		const month = `${date.getMonth() + 1}`.padStart(2, '0')
		const day = `${date.getDate()}`.padStart(2, '0')
		const hour = `${date.getHours()}`.padStart(2, '0')
		const minute = `${date.getMinutes()}`.padStart(2, '0')
		return `${year}-${month}-${day} ${hour}:${minute}`
	}

	export default {
		data() {
			return {
				isLoggingIn: false,
				isSaving: false,
				userInfo: null,
				genderOptions,
				loginForm: {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				},
				profileForm: {
					nickname: '',
					avatarUrl: '',
					avatarFileId: '',
					gender: 0
				}
			}
		},
		computed: {
			isLoggedIn() {
				return Boolean(this.userInfo && this.userInfo._id)
			},
			currentUserName() {
				return this.userInfo && this.userInfo.nickname ? this.userInfo.nickname : '微信用户'
			},
			displayLoginAvatar() {
				return this.loginForm.avatarUrl || DEFAULT_AVATAR
			},
			displayProfileAvatar() {
				return this.profileForm.avatarUrl || (this.userInfo && this.userInfo.avatarUrl) || DEFAULT_AVATAR
			},
			currentGenderText() {
				return this.genderOptions[this.profileForm.gender] || this.genderOptions[0]
			},
			roleText() {
				const roleList = this.userInfo && Array.isArray(this.userInfo.role) ? this.userInfo.role : []
				return roleList.length ? roleList.join('、') : 'member'
			},
			registerDateText() {
				return this.userInfo ? formatDateTime(this.userInfo.registerDate) : '暂未记录'
			},
			lastLoginDateText() {
				return this.userInfo ? formatDateTime(this.userInfo.lastLoginDate) : '暂未记录'
			}
		},
		onShow() {
			this.restoreLoginState()
		},
		methods: {
			resetLoginForm() {
				this.loginForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				}
			},
			resetProfileForm() {
				this.profileForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: '',
					gender: 0
				}
			},
			fillProfileForm(userInfo) {
				if (!userInfo) {
					this.resetProfileForm()
					return
				}

				this.profileForm = {
					nickname: userInfo.nickname || '',
					avatarUrl: userInfo.avatarUrl || '',
					avatarFileId: userInfo.avatarFileId || '',
					gender: Number(userInfo.gender || 0)
				}
			},
			async restoreLoginState() {
				const currentUserInfo = getCurrentUniIdUser()
				if (!currentUserInfo || !currentUserInfo.uid) {
					this.userInfo = null
					this.resetProfileForm()
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.userInfo = null
					this.resetProfileForm()
					return
				}

				await this.fetchCurrentUser({
					silent: true
				})
			},
			async fetchCurrentUser({ silent = false } = {}) {
				try {
					const result = await getAuthCenterObject().getMine()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取用户信息失败')
					}

					this.userInfo = result.userInfo || null
					this.fillProfileForm(this.userInfo)
				} catch (error) {
					console.warn('profile fetchCurrentUser failed', error)
					clearUniIdTokenStorage()
					this.userInfo = null
					this.resetProfileForm()

					if (!silent) {
						uni.showToast({
							title: '登录状态已失效，请重新登录',
							icon: 'none'
						})
					}
				}
			},
			onChooseLoginAvatar(event) {
				this.loginForm.avatarUrl = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : ''
				this.loginForm.avatarFileId = ''
			},
			onChooseProfileAvatar(event) {
				this.profileForm.avatarUrl = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : ''
				this.profileForm.avatarFileId = ''
			},
			onLoginNicknameInput(event) {
				this.loginForm.nickname = event.detail.value || ''
			},
			onLoginNicknameBlur(event) {
				this.loginForm.nickname = event.detail.value || this.loginForm.nickname
			},
			onProfileNicknameInput(event) {
				this.profileForm.nickname = event.detail.value || ''
			},
			onGenderChange(event) {
				this.profileForm.gender = Number(event.detail.value || 0)
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
					const loginRes = await uni.login()
					const code = loginRes.code
					if (!code) {
						throw new Error('未获取到微信登录 code')
					}

					const loginPayload = {
						code
					}
					const nickname = (this.loginForm.nickname || '').trim()
					if (nickname) {
						loginPayload.nickname = nickname
					}
					if (this.loginForm.avatarUrl) {
						const avatarResult = await uploadAvatarIfNeeded(this.loginForm.avatarUrl)
						if (avatarResult.avatarFileId) {
							loginPayload.avatarFileId = avatarResult.avatarFileId
							loginPayload.avatarFile = avatarResult.avatarFile
							this.loginForm.avatarFileId = avatarResult.avatarFileId
						} else if (avatarResult.avatarUrl) {
							loginPayload.avatarUrl = avatarResult.avatarUrl
						}
					}

					const result = await getAuthCenterObject().loginByWeixin(loginPayload)
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '登录失败')
					}

					await this.fetchCurrentUser({
						silent: true
					})
					this.resetLoginForm()

					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})
				} catch (error) {
					console.error('profile handleWechatLogin failed', error)
					uni.showToast({
						title: error.message || '登录失败，请稍后重试',
						icon: 'none'
					})
				} finally {
					this.isLoggingIn = false
					uni.hideLoading()
				}
			},
			async handleSaveProfile() {
				if (!this.isLoggedIn || this.isSaving) {
					return
				}

				const nickname = (this.profileForm.nickname || '').trim()
				if (!nickname) {
					uni.showToast({
						title: '昵称不能为空',
						icon: 'none'
					})
					return
				}

				const payload = {}
				if (nickname !== (this.userInfo.nickname || '')) {
					payload.nickname = nickname
				}

				const gender = Number(this.profileForm.gender || 0)
				if (gender !== Number(this.userInfo.gender || 0)) {
					payload.gender = gender
				}

				try {
					if (this.profileForm.avatarUrl && this.profileForm.avatarUrl !== (this.userInfo.avatarUrl || '')) {
						const avatarResult = await uploadAvatarIfNeeded(this.profileForm.avatarUrl)
						if (avatarResult.avatarFileId) {
							payload.avatarFileId = avatarResult.avatarFileId
							payload.avatarFile = avatarResult.avatarFile
							this.profileForm.avatarFileId = avatarResult.avatarFileId
						} else if (avatarResult.avatarUrl) {
							payload.avatarUrl = avatarResult.avatarUrl
						}
					}

					if (!Object.keys(payload).length) {
						uni.showToast({
							title: '暂无需要保存的修改',
							icon: 'none'
						})
						return
					}

					this.isSaving = true
					uni.showLoading({
						title: '保存中',
						mask: true
					})

					const result = await getAuthCenterObject().updateProfile(payload)
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '保存失败')
					}

					this.userInfo = result.userInfo || this.userInfo
					this.fillProfileForm(this.userInfo)

					uni.showToast({
						title: '保存成功',
						icon: 'success'
					})
				} catch (error) {
					console.error('handleSaveProfile failed', error)
					uni.showToast({
						title: error.message || '保存失败，请稍后重试',
						icon: 'none'
					})
				} finally {
					this.isSaving = false
					uni.hideLoading()
				}
			},
			async handleLogout() {
				try {
					const currentUserInfo = getCurrentUniIdUser()
					if (currentUserInfo && currentUserInfo.uid) {
						await getAuthCenterObject().logout()
					}
				} catch (error) {
					console.warn('profile handleLogout failed', error)
				} finally {
					clearUniIdTokenStorage()
					this.userInfo = null
					this.resetLoginForm()
					this.resetProfileForm()
					uni.showToast({
						title: '已退出登录',
						icon: 'none'
					})
				}
			}
		}
	}
</script>

<style>
	page {
		background: radial-gradient(circle at top, #fff7f1 0%, #fff7f1 26%, #fff3ea 26%, #fef6f0 100%);
		min-height: 100%;
	}

	.page {
		position: relative;
		padding: 28rpx 24rpx 52rpx;
		overflow: hidden;
	}

	.page__glow {
		position: absolute;
		width: 320rpx;
		height: 320rpx;
		border-radius: 50%;
		filter: blur(26rpx);
		opacity: 0.42;
		z-index: 0;
	}

	.page__glow--left {
		top: -90rpx;
		left: -120rpx;
		background: rgba(255, 180, 160, 0.48);
	}

	.page__glow--right {
		top: 220rpx;
		right: -120rpx;
		background: rgba(255, 220, 174, 0.48);
	}

	.hero-card,
	.panel-card,
	.profile-card,
	.secondary-button {
		position: relative;
		z-index: 1;
	}

	.hero-card,
	.panel-card,
	.profile-card {
		padding: 34rpx;
		border-radius: 36rpx;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(255, 246, 239, 0.96));
		box-shadow: 0 20rpx 50rpx rgba(177, 114, 83, 0.1);
	}

	.hero-card {
		margin-bottom: 22rpx;
	}

	.eyebrow {
		display: block;
		font-size: 22rpx;
		letter-spacing: 4rpx;
		color: #b98069;
		margin-bottom: 14rpx;
	}

	.hero-card__title {
		display: block;
		font-size: 46rpx;
		font-weight: 700;
		line-height: 1.3;
		color: #5a3427;
	}

	.hero-card__desc {
		display: block;
		margin-top: 16rpx;
		font-size: 26rpx;
		line-height: 1.7;
		color: #8b6659;
	}

	.content-stack,
	.panel-card + .panel-card,
	.profile-card + .panel-card {
		margin-top: 22rpx;
	}

	.panel-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18rpx;
		margin-bottom: 22rpx;
	}

	.panel-card__title {
		font-size: 32rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.panel-card__tag {
		padding: 10rpx 18rpx;
		border-radius: 999rpx;
		font-size: 22rpx;
		color: #b8604c;
		background: #fff1eb;
	}

	.editor-card,
	.profile-card__top {
		display: flex;
		align-items: center;
		gap: 24rpx;
	}

	.avatar-button,
	.profile-avatar {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0;
		background: transparent;
		border: 0;
	}

	.avatar-button::after,
	.profile-avatar::after {
		border: 0;
	}

	.avatar-button__image,
	.profile-avatar__image {
		width: 132rpx;
		height: 132rpx;
		border-radius: 50%;
		background: #fff1eb;
		box-shadow: 0 14rpx 26rpx rgba(177, 114, 83, 0.14);
	}

	.avatar-button__hint,
	.profile-avatar__hint {
		margin-top: 16rpx;
		font-size: 22rpx;
		color: #a17567;
	}

	.editor-card__body,
	.profile-card__meta {
		flex: 1;
	}

	.profile-card__name {
		display: block;
		font-size: 38rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.profile-card__subtitle {
		display: inline-flex;
		margin-top: 14rpx;
		padding: 10rpx 18rpx;
		border-radius: 999rpx;
		font-size: 22rpx;
		color: #c0674d;
		background: #fff3ec;
	}

	.profile-card__summary {
		display: block;
		margin-top: 16rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #906b61;
	}

	.form-item + .form-item {
		margin-top: 20rpx;
	}

	.field-label {
		display: block;
		font-size: 24rpx;
		color: #936d62;
		margin-bottom: 12rpx;
	}

	.field-tip {
		display: block;
		margin-top: 12rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #a07b70;
	}

	.text-input,
	.picker-field {
		height: 88rpx;
		padding: 0 24rpx;
		border-radius: 24rpx;
		background: #fffaf7;
		font-size: 28rpx;
		color: #5a3427;
	}

	.picker-field {
		display: flex;
		align-items: center;
	}

	.picker-field__value {
		font-size: 28rpx;
		color: #5a3427;
	}

	.primary-button,
	.secondary-button {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 90rpx;
		border: 0;
		border-radius: 999rpx;
		font-size: 28rpx;
		font-weight: 600;
		line-height: 90rpx;
	}

	.primary-button::after,
	.secondary-button::after {
		border: 0;
	}

	.primary-button {
		margin-top: 26rpx;
		color: #ffffff;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 16rpx 28rpx rgba(231, 111, 81, 0.28);
	}

	.secondary-button {
		width: 100%;
		margin-top: 22rpx;
		color: #b05b48;
		background: rgba(255, 241, 235, 0.96);
	}

	.notice-card {
		padding: 22rpx 24rpx;
		border-radius: 24rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.notice-card__text {
		font-size: 22rpx;
		line-height: 1.7;
		color: #a07b70;
	}

	.info-list {
		display: flex;
		flex-direction: column;
		gap: 18rpx;
	}

	.info-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 20rpx;
		padding: 20rpx 0;
	}

	.info-row + .info-row {
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.info-row__label {
		flex-shrink: 0;
		font-size: 24rpx;
		color: #9b786d;
	}

	.info-row__value {
		text-align: right;
		font-size: 24rpx;
		line-height: 1.6;
		color: #604036;
		word-break: break-all;
	}

	.info-row__value--mono {
		font-family: 'Courier New', monospace;
		font-size: 22rpx;
	}

	.button-hover {
		opacity: 0.92;
		transform: translateY(2rpx);
	}
</style>
