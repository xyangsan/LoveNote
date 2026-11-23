<template>
	<view class="pe-page">
		<view class="pe-glow pe-glow--left"></view>
		<view class="pe-glow pe-glow--right"></view>

		<noir-navbar
			title="编辑资料"
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		/>

		<view class="pe-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				class="pe-auth"
				desc="请先完成登录，再继续修改头像和昵称。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<template v-else>
				<!-- 顶部头像与昵称概览（对标 s28 .pe-avatar） -->
				<view class="pe-avatar" @tap="goToAvatarPage">
					<view class="pe-av-box">
						<view class="pe-av">
							<image
								v-if="displayProfileAvatar && !avatarLoadError"
								class="pe-av__img"
								:src="displayProfileAvatar"
								mode="aspectFill"
								@error="avatarLoadError = true"
							></image>
							<text v-else class="pe-av__txt">{{ avatarFallbackText }}</text>
						</view>
						<view class="pe-av-plus">
							<text class="pe-av-plus__txt">＋</text>
						</view>
					</view>
					<view class="pe-av-meta">
						<text class="pe-av-meta__name">{{ profileForm.nickname || currentUserName }}</text>
						<text class="pe-av-meta__sub">点击更换头像 · 昵称 {{ nicknameCountText }}</text>
					</view>
				</view>

				<!-- 表单行卡片（对标 s28 .pe-form） -->
				<view class="pe-form">
					<!-- 昵称 -->
					<view class="pe-row-block">
						<view class="pe-row">
							<text class="pe-row__label">昵称（必填）</text>
							<view class="pe-row__right">
								<input
									class="pe-row__input"
									type="text"
									:value="profileForm.nickname"
									placeholder="请输入昵称"
									placeholder-class="pe-input-ph"
									:maxlength="20"
									@input="onNicknameNativeInput"
									@blur="onProfileNicknameBlur"
								/>
								<text class="pe-chev">›</text>
							</view>
						</view>
						<text v-if="formErrors.nickname" class="pe-row__error">{{ formErrors.nickname }}</text>
					</view>

					<!-- 性别 -->
					<view class="pe-row-block">
						<view class="pe-row">
							<text class="pe-row__label">性别</text>
							<view class="pe-gender">
								<view
									v-for="(item, index) in genderOptions"
									:key="item"
									class="pe-chip"
									:class="{ 'pe-chip--on': profileForm.gender === index }"
									@tap="selectGender(index)"
								>
									<text class="pe-chip__txt">{{ item }}</text>
								</view>
							</view>
						</view>
					</view>

					<!-- 手机号 -->
					<view class="pe-row-block">
						<view class="pe-row">
							<text class="pe-row__label">手机号（选填）</text>
							<view class="pe-row__right">
								<input
									class="pe-row__input"
									type="number"
									:value="profileForm.mobile"
									placeholder="选填，留空清除"
									placeholder-class="pe-input-ph"
									:maxlength="11"
									@input="onMobileNativeInput"
									@blur="onMobileBlur"
								/>
								<text class="pe-chev">›</text>
							</view>
						</view>
						<text v-if="formErrors.mobile" class="pe-row__error">{{ formErrors.mobile }}</text>
					</view>

					<!-- 生日 -->
					<view class="pe-row-block">
						<picker
							mode="date"
							fields="day"
							:value="profileForm.birthday || birthdayPickerEnd"
							:start="birthdayPickerStart"
							:end="birthdayPickerEnd"
							@change="onBirthdayChange"
						>
							<view class="pe-row">
								<text class="pe-row__label">生日（选填）</text>
								<view class="pe-row__right">
									<text
										class="pe-row__val"
										:class="{ 'pe-row__val--placeholder': !profileForm.birthday }"
									>{{ birthdayDisplayText }}</text>
									<text class="pe-chev">›</text>
								</view>
							</view>
						</picker>
						<text v-if="formErrors.birthday" class="pe-row__error">{{ formErrors.birthday }}</text>
					</view>

					<!-- 注册时间 -->
					<view class="pe-row-block pe-row-block--last">
						<view class="pe-row">
							<text class="pe-row__label">注册时间</text>
							<text class="pe-row__val pe-row__val--mono">{{ registerDateText }}</text>
						</view>
					</view>
				</view>

				<!-- 完善奖励提示（对标 s28 .pe-bonus） -->
				<view class="pe-bonus">
					<text class="pe-bonus__txt">完善奖励：头像、昵称与生日全部填写完成（绑定情侣后），可自动获得一次性 +50 心动点。</text>
				</view>

				<!-- 底部说明（对标 s28 .pe-note） -->
				<text class="pe-note">手机号仅为可选联系资料字段，留空将清除；不支持占位昵称「微信用户」。</text>
			</template>
		</view>

		<!-- 底部操作栏（对标 s28 .pe-foot） -->
		<view v-if="isLoggedIn" class="pe-foot-bar">
			<view class="pe-foot">
				<view class="pe-btn pe-btn--ghost" hover-class="pe-btn--hover" @tap="backToProfile">
					<text class="pe-btn__txt pe-btn__txt--ghost">暂不修改</text>
				</view>
				<view
					class="pe-btn pe-btn--primary"
					:class="{ 'pe-btn--disabled': isSaving }"
					hover-class="pe-btn--hover"
					@tap="handleSaveTap"
				>
					<text class="pe-btn__txt">{{ isSaving ? '保存中…' : '保存资料' }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import LoveAuthRequired from '@/components/love-auth-required/love-auth-required.vue'
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		saveCachedUserProfile,
		subscribeAuthChanged,
		uploadAvatarIfNeeded
	} from '../../common/auth-center.js'
	import { getUserApi } from '../../common/api/user.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const genderOptions = ['保密', '男', '女']
	const NICKNAME_MAX_LENGTH = 20
	const BIRTHDAY_START = '1900-01-01'

	function padDateUnit(value) {
		return `${value}`.padStart(2, '0')
	}

	function getTodayDateString() {
		const today = new Date()
		return `${today.getFullYear()}-${padDateUnit(today.getMonth() + 1)}-${padDateUnit(today.getDate())}`
	}

	function isValidBirthday(value = '') {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
			return false
		}

		const date = new Date(`${value}T00:00:00`)
		if (Number.isNaN(date.getTime())) {
			return false
		}

		return `${date.getFullYear()}-${padDateUnit(date.getMonth() + 1)}-${padDateUnit(date.getDate())}` === value
	}

	function formatBirthdayText(value = '') {
		if (!value || !isValidBirthday(value)) {
			return '未设置'
		}

		return value.replace(/-/g, '.')
	}

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
		components: {
			LoveAuthRequired
		},
		data() {
			return {
				scrollTop: 0,
				isSaving: false,
				avatarLoadError: false,
				appStateStore: null,
				userInfo: null,
				genderOptions,
				removeAuthListener: null,
				formErrors: {
					nickname: '',
					mobile: '',
					birthday: ''
				},
				profileForm: {
					nickname: '',
					avatarUrl: '',
					avatarFileId: '',
					gender: 0,
					mobile: '',
					birthday: ''
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
			avatarFallbackText() {
				const name = String(this.profileForm.nickname || this.currentUserName || '我').trim()
				return name ? name.slice(0, 1) : '我'
			},
			displayProfileAvatar() {
				return this.profileForm.avatarUrl || (this.userInfo && this.userInfo.avatarUrl) || DEFAULT_AVATAR
			},
			registerDateText() {
				return this.userInfo ? formatDateTime(this.userInfo.registerDate) : '暂未记录'
			},
			nicknameCountText() {
				return `${(this.profileForm.nickname || '').trim().length} / ${NICKNAME_MAX_LENGTH}`
			},
			birthdayPickerStart() {
				return BIRTHDAY_START
			},
			birthdayPickerEnd() {
				return getTodayDateString()
			},
			birthdayDisplayText() {
				return this.profileForm.birthday ? formatBirthdayText(this.profileForm.birthday) : '请选择生日'
			}
		},
		watch: {
			displayProfileAvatar() {
				this.avatarLoadError = false
			}
		},
		onLoad() {
			if (!requirePageLogin()) return
			this.ensureAppStateStore()
			this.syncUserFromStore()
			this.removeAuthListener = subscribeAuthChanged(() => {
				this.restoreLoginState()
			})
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
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
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			syncUserFromStore() {
				const appStateStore = this.ensureAppStateStore()
				this.userInfo = appStateStore.userInfo || null
			},
			resetValidation() {
				this.formErrors = {
					nickname: '',
					mobile: '',
					birthday: ''
				}
			},
			setFieldError(field, message = '') {
				this.formErrors = {
					...this.formErrors,
					[field]: message
				}
			},
			resetProfileForm() {
				this.profileForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: '',
					gender: 0,
					mobile: '',
					birthday: ''
				}
				this.resetValidation()
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
					mobile: userInfo.mobile || '',
					birthday: userInfo.birthday || ''
				}
				this.resetValidation()
			},
			normalizeProfileValues(source = {}) {
				const nickname = `${source.nickname !== undefined ? source.nickname : this.profileForm.nickname || ''}`
					.trim()
					.slice(0, NICKNAME_MAX_LENGTH)
				const mobile = `${source.mobile !== undefined ? source.mobile : this.profileForm.mobile || ''}`
					.replace(/[^\d]/g, '')
					.slice(0, 11)
				const birthday = `${source.birthday !== undefined ? source.birthday : this.profileForm.birthday || ''}`.trim()
				const gender = Number(source.gender !== undefined ? source.gender : this.profileForm.gender || 0)

				return {
					nickname,
					gender: Number.isNaN(gender) ? 0 : gender,
					mobile,
					birthday
				}
			},
			validateProfileForm(source = {}, { showToast = true } = {}) {
				const values = this.normalizeProfileValues(source)
				const errors = {
					nickname: '',
					mobile: '',
					birthday: ''
				}

				if (!values.nickname) {
					errors.nickname = '请输入昵称'
				} else if (values.nickname.length > NICKNAME_MAX_LENGTH) {
					errors.nickname = `昵称最多 ${NICKNAME_MAX_LENGTH} 个字`
				}

				if (values.birthday) {
					if (!isValidBirthday(values.birthday)) {
						errors.birthday = '生日格式不正确'
					} else if (values.birthday < BIRTHDAY_START || values.birthday > this.birthdayPickerEnd) {
						errors.birthday = '生日日期超出可选范围'
					}
				}

				if (values.mobile && !/^1[3-9]\d{9}$/.test(values.mobile)) {
					errors.mobile = '手机号格式不正确'
				}

				this.formErrors = errors

				const firstError = errors.nickname || errors.mobile || errors.birthday
				if (firstError && showToast) {
					uni.showToast({
						title: firstError,
						icon: 'none'
					})
				}

				return {
					valid: !firstError,
					values
				}
			},
			async restoreLoginState() {
				const appStateStore = this.ensureAppStateStore()
				const currentUserInfo = getCurrentUniIdUser()
				if (!currentUserInfo || !currentUserInfo.uid) {
					this.userInfo = null
					this.resetProfileForm()
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					appStateStore.clearAllState()
					this.userInfo = null
					this.resetProfileForm()
					return
				}

				try {
					await appStateStore.fetchUserInfo({
						force: false
					})
					this.syncUserFromStore()
					if (this.userInfo) {
						this.fillProfileForm(this.userInfo)
					} else {
						this.resetProfileForm()
					}
				} catch (error) {
					console.warn('profile edit restoreLoginState failed', error)
					this.syncUserFromStore()
					if (!this.userInfo) {
						this.resetProfileForm()
					}
				}
			},
			goToLoginPage() {
				uni.redirectTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/profile/edit')
				})
			},
			goToAvatarPage() {
				uni.navigateTo({
					url: '/pages/profile/avatar'
				})
			},
			onNicknameNativeInput(event) {
				const value = event && event.detail ? event.detail.value : ''
				this.profileForm.nickname = `${value || ''}`.slice(0, NICKNAME_MAX_LENGTH)
				if (this.formErrors.nickname) {
					this.setFieldError('nickname', '')
				}
			},
			onProfileNicknameBlur(event) {
				const value = event && event.detail ? event.detail.value : this.profileForm.nickname
				this.profileForm.nickname = `${value || ''}`.trim().slice(0, NICKNAME_MAX_LENGTH)
				this.validateProfileForm({
					nickname: this.profileForm.nickname,
					mobile: this.profileForm.mobile,
					birthday: this.profileForm.birthday,
					gender: this.profileForm.gender
				}, {
					showToast: false
				})
			},
			selectGender(index) {
				this.profileForm.gender = Number(index || 0)
			},
			onBirthdayChange(event) {
				const value = event && event.detail ? event.detail.value : ''
				this.profileForm.birthday = value || ''
				if (this.formErrors.birthday) {
					this.setFieldError('birthday', '')
				}
				this.validateProfileForm({
					nickname: this.profileForm.nickname,
					mobile: this.profileForm.mobile,
					birthday: this.profileForm.birthday,
					gender: this.profileForm.gender
				}, {
					showToast: false
				})
			},
			onMobileNativeInput(event) {
				const value = event && event.detail ? event.detail.value : ''
				this.profileForm.mobile = `${value || ''}`.replace(/[^\d]/g, '').slice(0, 11)
				if (this.formErrors.mobile) {
					this.setFieldError('mobile', '')
				}
			},
			onMobileBlur(event) {
				const value = event && event.detail ? event.detail.value : this.profileForm.mobile
				this.profileForm.mobile = `${value || ''}`.replace(/[^\d]/g, '').slice(0, 11)
				this.validateProfileForm({
					nickname: this.profileForm.nickname,
					mobile: this.profileForm.mobile,
					birthday: this.profileForm.birthday,
					gender: this.profileForm.gender
				}, {
					showToast: false
				})
			},
			handleSaveTap() {
				this.handleFormSubmit({
					detail: {
						value: {
							nickname: this.profileForm.nickname,
							mobile: this.profileForm.mobile,
							gender: this.profileForm.gender,
							birthday: this.profileForm.birthday
						}
					}
				})
			},
			async handleFormSubmit(event) {
				if (!this.isLoggedIn || this.isSaving) {
					return
				}

				const formValue = event && event.detail ? event.detail.value || {} : {}
				const { valid, values } = this.validateProfileForm({
					nickname: formValue.nickname,
					mobile: formValue.mobile,
					gender: formValue.gender,
					birthday: formValue.birthday
				})
				if (!valid) {
					return
				}

				const payload = {}
				if (values.nickname !== (this.userInfo.nickname || '')) {
					payload.nickname = values.nickname
				}

				if (values.gender !== Number(this.userInfo.gender || 0)) {
					payload.gender = values.gender
				}

				const currentMobile = this.userInfo && this.userInfo.mobile ? this.userInfo.mobile : ''
				if (values.mobile !== currentMobile) {
					payload.mobile = values.mobile
				}

				const currentBirthday = this.userInfo && this.userInfo.birthday ? this.userInfo.birthday : ''
				if (values.birthday !== currentBirthday) {
					payload.birthday = values.birthday
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

					const result = await getUserApi().updateProfile(payload)
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '保存失败')
					}

					this.userInfo = result.userInfo || this.userInfo
					saveCachedUserProfile(this.userInfo)
					this.ensureAppStateStore().updateUserInfo(this.userInfo)
					this.fillProfileForm(this.userInfo)

					uni.showToast({
						title: '保存成功',
						icon: 'success'
					})

					setTimeout(() => {
						uni.navigateBack()
					}, 400)
				} catch (error) {
					console.error('profile edit handleFormSubmit failed', error)
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
				const pages = getCurrentPages()
				if (pages && pages.length > 1) {
					uni.navigateBack()
					return
				}
				navigateToTab('/pages/profile/index')
			}
		}
	}
</script>

<style scoped>
	.pe-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
		background: #110D0B;
		overflow: hidden;
	}

	.pe-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.2;
		pointer-events: none;
		z-index: 0;
	}

	.pe-glow--left {
		top: -120rpx;
		left: -140rpx;
		background: #E2643F;
	}

	.pe-glow--right {
		top: 320rpx;
		right: -160rpx;
		background: #D8B08C;
	}

	.pe-wrap {
		position: relative;
		z-index: 1;
		padding: 16rpx 36rpx 0;
	}

	.pe-auth {
		margin-top: 20rpx;
	}

	/* 顶部头像区（对标 s28 .pe-avatar） */
	.pe-avatar {
		display: flex;
		align-items: center;
		gap: 28rpx;
		padding: 8rpx 4rpx 6rpx;
	}

	.pe-av-box {
		position: relative;
		width: 144rpx;
		height: 144rpx;
		flex-shrink: 0;
	}

	.pe-av {
		width: 144rpx;
		height: 144rpx;
		border-radius: 50%;
		border: 2rpx solid rgba(255, 240, 226, 0.48);
		background: linear-gradient(135deg, #D9B08A, #9A6347);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.pe-av__img {
		width: 100%;
		height: 100%;
	}

	.pe-av__txt {
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 52rpx;
		color: #FFF6EC;
	}

	.pe-av-plus {
		position: absolute;
		right: -2rpx;
		bottom: 0;
		width: 44rpx;
		height: 44rpx;
		border-radius: 50%;
		background: #E2643F;
		border: 4rpx solid #110D0B;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pe-av-plus__txt {
		font-size: 24rpx;
		line-height: 1;
		color: #FFF7EF;
		font-weight: 700;
	}

	.pe-av-meta {
		flex: 1;
		min-width: 0;
	}

	.pe-av-meta__name {
		display: block;
		font-size: 32rpx;
		font-weight: 500;
		color: #F5EDE4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pe-av-meta__sub {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.44);
	}

	/* 表单行卡片（对标 s28 .pe-form） */
	.pe-form {
		margin-top: 32rpx;
		padding: 0 28rpx;
		border-radius: 32rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}

	.pe-row-block {
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.pe-row-block--last {
		border-bottom: none;
	}

	.pe-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		min-height: 104rpx;
	}

	.pe-row__label {
		flex-shrink: 0;
		font-size: 26rpx;
		color: rgba(245, 237, 228, 0.68);
	}

	.pe-row__right {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10rpx;
	}

	.pe-row__input {
		flex: 1;
		min-width: 0;
		height: 68rpx;
		font-size: 26rpx;
		color: #FBF4EA;
		text-align: right;
	}

	.pe-input-ph {
		color: rgba(245, 237, 228, 0.30);
	}

	.pe-row__val {
		font-size: 26rpx;
		color: #FBF4EA;
		text-align: right;
	}

	.pe-row__val--placeholder {
		color: rgba(245, 237, 228, 0.32);
	}

	.pe-row__val--mono {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.pe-chev {
		flex-shrink: 0;
		font-size: 30rpx;
		color: rgba(245, 237, 228, 0.30);
		line-height: 1;
	}

	.pe-row__error {
		display: block;
		padding-bottom: 16rpx;
		font-size: 21rpx;
		color: #F08A6C;
		text-align: right;
	}

	/* 性别胶囊选择（对标 s28 .pe-gender） */
	.pe-gender {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.pe-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 54rpx;
		padding: 0 22rpx;
		border-radius: 27rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.10);
		background: rgba(255, 255, 255, 0.03);
	}

	.pe-chip--on {
		border-color: rgba(226, 100, 63, 0.52);
		background: rgba(226, 100, 63, 0.18);
	}

	.pe-chip__txt {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.62);
	}

	.pe-chip--on .pe-chip__txt {
		color: #FBF4EA;
		font-weight: 600;
	}

	/* 奖励卡与说明（对标 s28 .pe-bonus / .pe-note） */
	.pe-bonus {
		margin-top: 26rpx;
		padding: 22rpx 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.24);
		background: rgba(216, 176, 140, 0.06);
	}

	.pe-bonus__txt {
		font-size: 22rpx;
		line-height: 1.65;
		color: rgba(234, 212, 188, 0.80);
	}

	.pe-note {
		display: block;
		margin-top: 20rpx;
		padding: 0 6rpx;
		font-size: 21rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.36);
	}

	/* 底部操作栏（对标 s28 .pe-foot） */
	.pe-foot-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		padding: 20rpx 36rpx calc(24rpx + env(safe-area-inset-bottom));
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(17, 13, 11, 0.94);
	}

	.pe-foot {
		display: flex;
		align-items: center;
		gap: 20rpx;
	}

	.pe-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		border-radius: 44rpx;
	}

	.pe-btn--ghost {
		flex: 0 0 216rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(216, 176, 140, 0.08);
	}

	.pe-btn--primary {
		flex: 1;
		background: linear-gradient(135deg, #F09A6B 0%, #DE5F3C 100%);
		box-shadow: 0 12rpx 28rpx rgba(222, 95, 60, 0.28);
	}

	.pe-btn--disabled {
		opacity: 0.6;
	}

	.pe-btn--hover {
		opacity: 0.86;
	}

	.pe-btn__txt {
		font-size: 28rpx;
		font-weight: 600;
		color: #FFF7EF;
		letter-spacing: 2rpx;
	}

	.pe-btn__txt--ghost {
		color: #EAD4BC;
		letter-spacing: 1rpx;
	}
</style>
