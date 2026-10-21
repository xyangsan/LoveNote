<template>
	<view class="love-page avatar-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先完成登录，再继续更换头像。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<template v-else>
				<!-- 当前头像：上方居中 -->
				<view class="avatar-hero">
					<view class="avatar-hero__ring" :class="{ 'avatar-hero__ring--busy': isUploading }">
						<image class="avatar-hero__img" :src="previewUrl" mode="aspectFill"></image>
						<view v-if="isUploading" class="avatar-hero__mask">
							<text class="avatar-hero__mask-text">上传中</text>
						</view>
						<view class="avatar-hero__badge">当前</view>
					</view>

					<text class="avatar-hero__name">{{ nicknameText }}</text>
					<text class="avatar-hero__hint">{{ previewHint }}</text>

					<!-- #ifdef MP-WEIXIN -->
					<button
						class="wx-avatar-btn"
						open-type="chooseAvatar"
						:disabled="isUploading"
						@chooseavatar="onChooseWxAvatar"
					>
						<text class="wx-avatar-btn__icon">💬</text>
						<text class="wx-avatar-btn__text">用微信头像</text>
					</button>
					<!-- #endif -->

					<!-- #ifndef MP-WEIXIN -->
					<view class="wx-avatar-btn wx-avatar-btn--disabled">
						<text class="wx-avatar-btn__icon">💬</text>
						<text class="wx-avatar-btn__text">微信头像仅小程序可用</text>
					</view>
					<!-- #endif -->
				</view>

				<!-- 分组头像列表 -->
				<view class="avatar-groups">
					<view v-for="group in groups" :key="group.key" class="avatar-group">
						<view class="avatar-group__head">
							<view class="avatar-group__title-wrap">
								<view class="avatar-group__dot"></view>
								<text class="avatar-group__title">{{ group.name }}</text>
							</view>
							<text class="avatar-group__count">{{ group.avatars.length }} 张</text>
						</view>

						<view class="avatar-grid">
							<view
								v-for="item in group.avatars"
								:key="item.file"
								class="avatar-cell"
								:class="{ 'avatar-cell--active': item.url === selectedUrl }"
								@tap="selectAvatar(item)"
							>
								<image class="avatar-cell__img" :src="item.url" mode="aspectFill" lazy-load></image>
								<view v-if="item.url === selectedUrl" class="avatar-cell__check">✓</view>
							</view>
						</view>
					</view>
				</view>

				<view class="avatar-footer-space"></view>
			</template>
		</view>

		<!-- 底部悬浮保存 -->
		<view v-if="isLoggedIn" class="avatar-savebar">
			<view class="avatar-savebar__meta">
				<text class="avatar-savebar__label">{{ selectedLabelText }}</text>
				<text class="avatar-savebar__tip">{{ hasChanged ? '点击保存后生效' : '还没有切换头像' }}</text>
			</view>
			<fui-button
				text="保存头像"
				background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
				color="#ffffff"
				radius="999rpx"
				height="88rpx"
				width="240rpx"
				:size="28"
				:bold="true"
				:disabled="!hasChanged || isUploading"
				:loading="isSaving"
				@click="handleSave"
			></fui-button>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		DEFAULT_AVATAR_LIST,
		clearUniIdTokenStorage,
		emitAuthChanged,
		getCachedUserProfile,
		getCurrentUniIdUser,
		saveCachedUserProfile,
		subscribeAuthChanged,
		uploadAvatarIfNeeded
	} from '../../common/auth-center.js'
	import { getUserApi } from '../../common/api/user.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { requirePageLogin } from '../../common/auth-entry.js'
	import { isTempFilePath } from '../../common/utils/file-upload.js'

	export default {
		data() {
			return {
				appStateStore: null,
				userInfo: null,
				authUid: '',
				// 先回显缓存头像（与登录页 applyCachedProfile 同一套：getCachedUserProfile）
				cachedAvatarUrl: '',
				cachedNickname: '',
				groups: DEFAULT_AVATAR_LIST,
				selectedUrl: '',
				selectedFile: '',
				selectedLabel: '',
				// 微信头像只存临时路径，点保存时才上传（和登录页 loginByWeixinProfile 一致）
				wxAvatar: null,
				isSaving: false,
				isUploading: false,
				removeAuthListener: null
			}
		},
		computed: {
			isLoggedIn() {
				return Boolean(this.authUid)
			},
			nicknameText() {
				if (this.userInfo && this.userInfo.nickname) {
					return this.userInfo.nickname
				}
				return this.cachedNickname || '微信用户'
			},
			currentAvatarUrl() {
				// 历史脏数据兜底：老逻辑曾把 https://tmp/… 这类临时路径写进用户表，
				// 这种地址换台设备就失效，当作没头像处理，避免一直显示破图。
				const fromUser = this.userInfo && this.userInfo.avatarUrl
				if (fromUser && !isTempFilePath(fromUser)) {
					return fromUser
				}
				return this.cachedAvatarUrl || DEFAULT_AVATAR
			},
			// 服务端真正保存着的头像（临时路径视为空，历史脏数据不参与比较）
			currentSavedAvatarUrl() {
				const fromUser = this.userInfo && this.userInfo.avatarUrl
				return fromUser && !isTempFilePath(fromUser) ? fromUser : ''
			},
			previewUrl() {
				return this.selectedUrl || this.currentAvatarUrl
			},
			hasChanged() {
				if (this.wxAvatar) {
					return true
				}
				if (!this.selectedUrl) {
					return false
				}
				return this.selectedUrl !== this.currentSavedAvatarUrl
			},
			previewHint() {
				if (this.isUploading) {
					return '正在上传微信头像…'
				}
				if (this.wxAvatar) {
					return '微信头像已选好，保存时自动上传'
				}
				if (this.selectedUrl) {
					return this.hasChanged ? '已选择新头像，别忘了保存' : '这就是你正在使用的头像'
				}
				return '从下方分组里挑一张，或直接用微信头像'
			},
			selectedLabelText() {
				if (this.wxAvatar) {
					return '微信头像'
				}
				if (this.selectedLabel) {
					return this.selectedLabel
				}
				return '自定义头像'
			}
		},
		onLoad() {
			if (!requirePageLogin()) return
			this.ensureAppStateStore()
			this.applyCachedProfile()
			this.syncUserFromStore()
			this.removeAuthListener = subscribeAuthChanged(() => {
				this.restoreLoginState()
			})
		},
		onShow() {
			this.applyCachedProfile()
			this.restoreLoginState()
		},
		onUnload() {
			if (this.removeAuthListener) {
				this.removeAuthListener()
				this.removeAuthListener = null
			}
		},
		methods: {
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			syncUserFromStore() {
				const appStateStore = this.ensureAppStateStore()
				this.userInfo = appStateStore.userInfo || null
				this.syncSelectedFromUser()
			},
			// 和登录页一样：先用本地缓存把头像/昵称回显出来，再等服务端覆盖
			applyCachedProfile() {
				const cachedProfile = getCachedUserProfile()
				if (!cachedProfile) {
					return
				}

				this.cachedAvatarUrl = cachedProfile.avatarUrl || ''
				this.cachedNickname = cachedProfile.nickname || ''

				if (!this.selectedUrl && this.cachedAvatarUrl) {
					this.selectedUrl = this.cachedAvatarUrl
				}
			},
			syncSelectedFromUser() {
				if (this.wxAvatar) {
					return
				}
				const currentAvatarUrl = this.currentSavedAvatarUrl || this.cachedAvatarUrl || ''
				this.selectedUrl = currentAvatarUrl
				this.selectedFile = ''
				this.selectedLabel = ''
			},
			async restoreLoginState() {
				const appStateStore = this.ensureAppStateStore()
				const currentUserInfo = getCurrentUniIdUser()
				if (!currentUserInfo || !currentUserInfo.uid) {
					this.authUid = ''
					this.userInfo = null
					this.selectedUrl = ''
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					appStateStore.clearAllState()
					this.authUid = ''
					this.userInfo = null
					this.selectedUrl = ''
					return
				}

				this.authUid = currentUserInfo.uid

				try {
					await appStateStore.fetchUserInfo({
						force: false
					})
					this.syncUserFromStore()
				} catch (error) {
					console.warn('avatar page restoreLoginState failed', error)
					this.syncUserFromStore()
				}
			},
			goToLoginPage() {
				uni.redirectTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/profile/avatar')
				})
			},
			backToProfile() {
				uni.switchTab({
					url: '/pages/profile/index'
				})
			},
			selectAvatar(item) {
				if (!item || !item.url || this.isUploading) {
					return
				}

				this.wxAvatar = null
				this.selectedUrl = item.url
				this.selectedFile = item.file || ''
				this.selectedLabel = item.label || ''
			},
			// 只回显微信给的临时图（wxfile://），不在这里上传 —— 上传留到点保存时，跟登录页一致
			onChooseWxAvatar(event) {
				const tempAvatarUrl = event && event.detail ? event.detail.avatarUrl || '' : ''
				if (!tempAvatarUrl) {
					return
				}

				this.wxAvatar = {
					tempUrl: tempAvatarUrl
				}
				this.selectedUrl = tempAvatarUrl
				this.selectedFile = ''
				this.selectedLabel = '微信头像'
			},
			buildSavePayload() {
				// 只有「真实的 https 地址」才允许当 avatarUrl 提交，临时路径一律拦住
				if (this.selectedUrl && !isTempFilePath(this.selectedUrl) && this.selectedUrl !== this.currentSavedAvatarUrl) {
					return {
						avatarUrl: this.selectedUrl
					}
				}

				return {}
			},
			// 微信临时图 → 云存储：与 loginByWeixinProfile 同一套（fileId 优先，拿不到再退 url）
			async resolveWxAvatarPayload() {
				const avatarResult = await uploadAvatarIfNeeded(this.wxAvatar ? this.wxAvatar.tempUrl : '')
				if (avatarResult.avatarFileId) {
					return {
						avatarFileId: avatarResult.avatarFileId,
						avatarFile: avatarResult.avatarFile
					}
				}
				if (avatarResult.avatarUrl && !isTempFilePath(avatarResult.avatarUrl)) {
					return {
						avatarUrl: avatarResult.avatarUrl
					}
				}
				throw new Error('头像上传失败，请重试')
			},
			async handleSave() {
				if (!this.isLoggedIn || this.isSaving || this.isUploading) {
					return
				}

				if (!this.hasChanged) {
					uni.showToast({
						title: '头像没有变化',
						icon: 'none'
					})
					return
				}

				this.isSaving = true
				uni.showLoading({
					title: this.wxAvatar ? '上传头像' : '保存中',
					mask: true
				})

				try {
					let payload = {}
					if (this.wxAvatar) {
						this.isUploading = true
						payload = await this.resolveWxAvatarPayload()
					} else {
						payload = this.buildSavePayload()
					}

					if (!Object.keys(payload).length) {
						uni.showToast({
							title: '头像没有变化',
							icon: 'none'
						})
						return
					}

					const result = await getUserApi().updateProfile(payload)
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '保存失败')
					}

					this.userInfo = result.userInfo || this.userInfo
					saveCachedUserProfile(this.userInfo)
					this.ensureAppStateStore().updateUserInfo(this.userInfo)
					emitAuthChanged({
						action: 'profile',
						userInfo: this.userInfo
					})

					this.cachedAvatarUrl = (this.userInfo && this.userInfo.avatarUrl) || ''
					this.cachedNickname = (this.userInfo && this.userInfo.nickname) || this.cachedNickname
					this.wxAvatar = null
					this.syncSelectedFromUser()

					uni.showToast({
						title: '头像已更新',
						icon: 'success'
					})

					setTimeout(() => {
						uni.navigateBack()
					}, 450)
				} catch (error) {
					console.error('avatar page handleSave failed', error)
					uni.showToast({
						title: error.message || '保存失败，请稍后重试',
						icon: 'none'
					})
				} finally {
					this.isSaving = false
					this.isUploading = false
					uni.hideLoading()
				}
			}
		}
	}
</script>

<style>
	.avatar-page {
		padding: 24rpx 24rpx 0;
	}

	/* 当前头像 */
	.avatar-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40rpx 32rpx 34rpx;
		border-radius: 36rpx;
		background: rgba(255, 250, 247, 0.96);
		box-shadow: 0 20rpx 48rpx rgba(192, 120, 92, 0.12);
	}

	.avatar-hero__ring {
		position: relative;
		padding: 8rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ffb59f 0%, #e76f51 100%);
		box-shadow: 0 18rpx 36rpx rgba(199, 116, 88, 0.28);
	}

	.avatar-hero__ring--busy {
		opacity: 0.86;
	}

	.avatar-hero__img {
		display: block;
		width: 190rpx;
		height: 190rpx;
		border-radius: 50%;
		background: #fff1eb;
	}

	.avatar-hero__mask {
		position: absolute;
		left: 8rpx;
		top: 8rpx;
		right: 8rpx;
		bottom: 8rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(90, 52, 39, 0.52);
	}

	.avatar-hero__mask-text {
		font-size: 22rpx;
		color: #fff7f3;
	}

	.avatar-hero__badge {
		position: absolute;
		right: -4rpx;
		bottom: 10rpx;
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		font-size: 20rpx;
		color: #ffffff;
		box-shadow: 0 8rpx 16rpx rgba(199, 116, 88, 0.32);
	}

	.avatar-hero__name {
		margin-top: 24rpx;
		font-size: 34rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.avatar-hero__hint {
		margin-top: 12rpx;
		font-size: 23rpx;
		line-height: 1.7;
		text-align: center;
		color: #906b61;
	}

	.wx-avatar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10rpx;
		margin-top: 26rpx;
		padding: 0 34rpx;
		height: 72rpx;
		line-height: 72rpx;
		border-radius: 999rpx;
		background: rgba(255, 236, 229, 0.96);
		border: 1rpx solid rgba(236, 117, 88, 0.36);
		font-size: 25rpx;
		color: #b05b48;
	}

	.wx-avatar-btn::after {
		border: 0;
	}

	.wx-avatar-btn--disabled {
		opacity: 0.6;
	}

	.wx-avatar-btn__icon {
		font-size: 26rpx;
	}

	.wx-avatar-btn__text {
		font-size: 25rpx;
		font-weight: 600;
		color: #b05b48;
	}

	/* 分组列表 */
	.avatar-groups {
		margin-top: 28rpx;
	}

	.avatar-group {
		padding: 26rpx 24rpx 28rpx;
		border-radius: 32rpx;
		background: rgba(255, 250, 247, 0.96);
		box-shadow: 0 14rpx 34rpx rgba(192, 120, 92, 0.1);
	}

	.avatar-group + .avatar-group {
		margin-top: 22rpx;
	}

	.avatar-group__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 22rpx;
	}

	.avatar-group__title-wrap {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.avatar-group__dot {
		width: 10rpx;
		height: 30rpx;
		border-radius: 999rpx;
		background: linear-gradient(180deg, #ff8b72 0%, #e76f51 100%);
	}

	.avatar-group__title {
		font-size: 28rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.avatar-group__count {
		font-size: 21rpx;
		color: #b08478;
	}

	.avatar-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16rpx;
	}

	.avatar-cell {
		position: relative;
		border-radius: 24rpx;
		overflow: hidden;
		box-shadow: inset 0 0 0 1rpx rgba(239, 203, 191, 0.7);
		transition: transform 0.16s ease;
	}

	.avatar-cell--active {
		box-shadow: inset 0 0 0 4rpx rgba(236, 117, 88, 0.92), 0 10rpx 20rpx rgba(199, 116, 88, 0.24);
	}

	.avatar-cell__img {
		display: block;
		width: 100%;
		height: 150rpx;
		background: #fff1eb;
	}

	.avatar-cell__check {
		position: absolute;
		right: 8rpx;
		top: 8rpx;
		width: 34rpx;
		height: 34rpx;
		line-height: 34rpx;
		text-align: center;
		border-radius: 50%;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		font-size: 20rpx;
		color: #ffffff;
	}

	/* 底部悬浮保存 */
	.avatar-footer-space {
		height: calc(190rpx + env(safe-area-inset-bottom));
	}

	.avatar-savebar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24rpx;
		padding: 20rpx 28rpx;
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
		background: rgba(255, 247, 241, 0.98);
		box-shadow: 0 -10rpx 30rpx rgba(192, 120, 92, 0.12);
	}

	.avatar-savebar__meta {
		flex: 1;
		min-width: 0;
	}

	.avatar-savebar__label {
		display: block;
		font-size: 25rpx;
		font-weight: 600;
		color: #5a3427;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.avatar-savebar__tip {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: #a17567;
	}
</style>
