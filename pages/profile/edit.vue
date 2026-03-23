<template>
	<view class="love-page edit-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<love-glass-card class="love-layer" :margin="['0', '0', '0', '0']" :padding="['0', '0']" :header-line="false">
			<view class="love-title-block">
				<text class="love-title-block__eyebrow">LoveNote 编辑资料</text>
				<text class="love-title-block__title">完善你的基础信息</text>
				<text class="love-title-block__desc">你可以在这里修改头像、昵称、性别和年龄，保存后会同步到个人资料页与后续情侣空间展示中。</text>
			</view>
		</love-glass-card>

		<love-glass-card
			v-if="!isLoggedIn"
			class="love-layer"
			:margin="['22rpx', '0', '0', '0']"
			title="当前未登录"
			tag="请先登录"
		>
			<view class="panel-body">
				<text class="love-muted-text">该页面已接入登录拦截。若你是直接进入这里，请先完成登录，再继续编辑资料。</text>
				<view class="love-action-stack">
					<fui-button
						text="前往登录页"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						@click="goToLoginPage"
					></fui-button>
					<fui-button
						text="返回我的资料"
						background="rgba(255, 241, 235, 0.96)"
						color="#b05b48"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						@click="backToProfile"
					></fui-button>
				</view>
			</view>
		</love-glass-card>

		<view v-else class="love-layer">
			<love-glass-card :margin="['22rpx', '0', '0', '0']" :padding="['0', '0']" :header-line="false">
				<view class="profile-card">
					<love-avatar-picker
						:src="displayProfileAvatar"
						fallback="/static/logo.png"
						label="更换头像"
						@chooseavatar="onChooseProfileAvatar"
					></love-avatar-picker>
					<view class="profile-card__meta">
						<text class="profile-card__name">{{ profileForm.nickname || currentUserName }}</text>
						<text class="profile-card__summary">头像会优先保存到 uniCloud，昵称、性别和年龄会一起更新。</text>
					</view>
				</view>
			</love-glass-card>

			<love-glass-card :margin="['22rpx', '0', '0', '0']" title="编辑资料" tag="可保存">
				<view class="edit-form">
					<view class="love-form-item">
						<text class="love-field-label">昵称</text>
						<fui-input
							:value="profileForm.nickname"
							type="text"
							placeholder="请输入昵称"
							background-color="#fffaf7"
							:border-bottom="false"
							:padding="['28rpx', '24rpx']"
							:radius="24"
							:size="28"
							color="#5a3427"
							@input="onProfileNicknameInput"
						></fui-input>
					</view>

					<view class="love-form-item">
						<text class="love-field-label">性别</text>
						<picker mode="selector" :range="genderOptions" :value="profileForm.gender" @change="onGenderChange">
							<fui-list-cell
								:padding="['28rpx', '24rpx']"
								background="#fffaf7"
								:bottom-border="false"
								radius="24rpx"
								arrow
								arrow-color="#d2a394"
							>
								<view class="picker-field">
									<text class="picker-field__value">{{ currentGenderText }}</text>
								</view>
							</fui-list-cell>
						</picker>
					</view>

					<view class="love-form-item">
						<text class="love-field-label">年龄</text>
						<fui-input
							:value="profileForm.age"
							type="digit"
							placeholder="请输入年龄，可留空"
							background-color="#fffaf7"
							:border-bottom="false"
							:padding="['28rpx', '24rpx']"
							:radius="24"
							:size="28"
							color="#5a3427"
							maxlength="3"
							@input="onAgeInput"
						></fui-input>
						<text class="love-field-tip">年龄可选填，范围为 1 到 120 岁。</text>
					</view>

					<view class="love-action-stack">
						<fui-button
							text="保存资料"
							background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
							color="#ffffff"
							radius="999rpx"
							height="90rpx"
							:size="28"
							:bold="true"
							:loading="isSaving"
							@click="handleSaveProfile"
						></fui-button>
					</view>
				</view>
			</love-glass-card>

			<love-glass-card :margin="['22rpx', '0', '0', '0']" title="资料说明" tag="参考">
				<view class="info-list">
					<fui-list-cell
						:padding="['22rpx', '0']"
						background="transparent"
						border-color="rgba(231, 204, 194, 0.6)"
					>
						<view class="info-row">
							<text class="info-row__label">注册时间</text>
							<text class="info-row__value">{{ registerDateText }}</text>
						</view>
					</fui-list-cell>
					<fui-list-cell
						:padding="['22rpx', '0']"
						background="transparent"
						:bottom-border="false"
						border-color="rgba(231, 204, 194, 0.6)"
					>
						<view class="info-row">
							<text class="info-row__label">最近登录</text>
							<text class="info-row__value">{{ lastLoginDateText }}</text>
						</view>
					</fui-list-cell>
				</view>
			</love-glass-card>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		getAuthCenterObject,
		getCurrentUniIdUser,
		subscribeAuthChanged,
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
				isSaving: false,
				userInfo: null,
				genderOptions,
				removeAuthListener: null,
				profileForm: {
					nickname: '',
					avatarUrl: '',
					avatarFileId: '',
					gender: 0,
					age: ''
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
			displayProfileAvatar() {
				return this.profileForm.avatarUrl || (this.userInfo && this.userInfo.avatarUrl) || DEFAULT_AVATAR
			},
			currentGenderText() {
				return this.genderOptions[this.profileForm.gender] || this.genderOptions[0]
			},
			registerDateText() {
				return this.userInfo ? formatDateTime(this.userInfo.registerDate) : '暂未记录'
			},
			lastLoginDateText() {
				return this.userInfo ? formatDateTime(this.userInfo.lastLoginDate) : '暂未记录'
			}
		},
		onLoad() {
			this.removeAuthListener = subscribeAuthChanged(() => {
				this.restoreLoginState()
			})
		},
		onShow() {
			this.restoreLoginState()
		},
		onUnload() {
			if (this.removeAuthListener) {
				this.removeAuthListener()
				this.removeAuthListener = null
			}
		},
		methods: {
			resetProfileForm() {
				this.profileForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: '',
					gender: 0,
					age: ''
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
					gender: Number(userInfo.gender || 0),
					age: userInfo.age ? String(userInfo.age) : ''
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
					console.warn('profile edit fetchCurrentUser failed', error)
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
			goToLoginPage() {
				uni.navigateTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/profile/edit')
				})
			},
			onChooseProfileAvatar(event) {
				this.profileForm.avatarUrl = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : ''
				this.profileForm.avatarFileId = ''
			},
			onProfileNicknameInput(value) {
				this.profileForm.nickname = value ? `${value}` : ''
			},
			onGenderChange(event) {
				this.profileForm.gender = Number(event.detail.value || 0)
			},
			onAgeInput(value) {
				this.profileForm.age = `${value || ''}`.replace(/[^\d]/g, '').slice(0, 3)
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

				const ageValue = this.profileForm.age === '' ? '' : Number(this.profileForm.age)
				const currentAge = Number(this.userInfo.age || 0)
				if (ageValue !== '' && (!Number.isInteger(ageValue) || ageValue < 1 || ageValue > 120)) {
					uni.showToast({
						title: '年龄范围需在 1 到 120 岁之间',
						icon: 'none'
					})
					return
				}
				if ((ageValue === '' && currentAge !== 0) || (ageValue !== '' && ageValue !== currentAge)) {
					payload.age = ageValue
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

					setTimeout(() => {
						uni.navigateBack()
					}, 400)
				} catch (error) {
					console.error('profile edit handleSaveProfile failed', error)
					uni.showToast({
						title: error.message || '保存失败，请稍后重试',
						icon: 'none'
					})
				} finally {
					this.isSaving = false
					uni.hideLoading()
				}
			},
			backToProfile() {
				uni.switchTab({
					url: '/pages/profile/index'
				})
			}
		}
	}
</script>

<style>
	.panel-body {
		padding-top: 6rpx;
	}

	.profile-card {
		display: flex;
		align-items: center;
		padding: 34rpx;
	}

	.profile-card__meta {
		flex: 1;
		min-width: 0;
		margin-left: 24rpx;
	}

	.profile-card__name {
		display: block;
		font-size: 38rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.profile-card__summary {
		display: block;
		margin-top: 16rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #906b61;
	}

	.picker-field {
		display: flex;
		align-items: center;
		width: 100%;
	}

	.picker-field__value {
		font-size: 28rpx;
		color: #5a3427;
	}

	.info-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		width: 100%;
	}

	.info-row__label {
		flex-shrink: 0;
		font-size: 24rpx;
		color: #9b786d;
	}

	.info-row__value {
		margin-left: 20rpx;
		text-align: right;
		font-size: 24rpx;
		line-height: 1.6;
		color: #604036;
		word-break: break-all;
	}
</style>
