<template>
	<view class="love-page edit-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">

			<fui-section
				title="编辑资料"
				descr="头像、昵称与基础信息会同步到个人中心和后续情侣空间展示。"
				:is-line="true"
				line-width="10rpx"
				line-color="#ec7558"
				:line-right="22"
				:descr-top="14"
				:size="40"
				descr-size="24"
				color="#5a3427"
				descr-color="#906b61"
				:padding="['0', '0']"
				:margin-top="12"
				:margin-bottom="28"
			></fui-section>

			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先完成登录，再继续修改头像和昵称。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<form v-else report-submit="true" @submit="handleFormSubmit">
				<fui-form-field hidden name="nickname" :value="profileForm.nickname"></fui-form-field>
				<fui-form-field hidden name="mobile" :value="profileForm.mobile"></fui-form-field>
				<fui-form-field hidden name="birthday" :value="profileForm.birthday"></fui-form-field>

				<fui-card
					class="editor-card"
					:margin="['0', '0', '0', '0']"
					background="rgba(255, 250, 247, 0.97)"
					radius="32rpx"
					shadow="0 20rpx 48rpx rgba(192, 120, 92, 0.12)"
					:padding="['0', '0']"
					:header-line="false"
				>
					<view class="editor-card__hero">
						<love-avatar-picker
							:src="displayProfileAvatar"
							fallback="/static/user-empty.png"
							label="点击更换头像"
							:width="136"
							:height="136"
							@chooseavatar="onChooseProfileAvatar"
						></love-avatar-picker>

						<view class="editor-card__hero-body">
							<view class="editor-card__hero-top">
								<text class="editor-card__name">{{ profileForm.nickname || currentUserName }}</text>
								<text class="editor-card__count">{{ nicknameCountText }}</text>
							</view>
							<text class="editor-card__summary">资料更新后会自动同步到登录页和个人中心。</text>

							<view class="meta-grid">
								<view class="meta-grid__item">
									<text class="meta-grid__label">注册时间</text>
									<text class="meta-grid__value">{{ registerDateText }}</text>
								</view>
							</view>
						</view>
					</view>

					<fui-divider
						text="基础资料"
						width="100%"
						height="54"
						divider-color="rgba(231, 204, 194, 0.7)"
						color="#b36a56"
						:size="22"
					></fui-divider>

					<view class="editor-form">
						<view class="form-block">
							<view class="form-block__head">
								<text class="form-block__label">昵称</text>
								<text class="form-block__meta">必填</text>
							</view>
							<fui-input
								:value="profileForm.nickname"
								type="text"
								placeholder="请输入昵称"
								background-color="#fff7f3"
								:border-bottom="false"
								:padding="['28rpx', '24rpx']"
								:radius="26"
								:size="28"
								color="#5a3427"
								maxlength="20"
								@input="onProfileNicknameInput"
								@blur="onProfileNicknameBlur"
							></fui-input>
							<text class="form-block__tip">建议填写真实昵称或你希望另一半看到的称呼。</text>
							<text v-if="formErrors.nickname" class="form-block__error">{{ formErrors.nickname }}</text>
						</view>

						<view class="form-block">
							<view class="form-block__head">
								<text class="form-block__label">性别</text>
								<text class="form-block__meta">可修改</text>
							</view>
							<fui-radio-group name="gender" :value="String(profileForm.gender)" @change="onGenderChange">
								<view class="gender-grid">
									<view
										v-for="(item, index) in genderOptions"
										:key="item"
										class="gender-chip"
										:class="{ 'gender-chip--active': profileForm.gender === index }"
										@tap="selectGender(index)"
									>
										<fui-radio
											:value="String(index)"
											color="#ec7558"
											border-color="#efcbbf"
											check-mark-color="#ffffff"
											:scale-ratio="0.9"
										></fui-radio>
										<text class="gender-chip__text">{{ item }}</text>
									</view>
								</view>
							</fui-radio-group>
						</view>

						<view class="form-block">
							<view class="form-block__head">
								<text class="form-block__label">手机号</text>
								<text class="form-block__meta">选填</text>
							</view>
							<fui-input
								:value="profileForm.mobile"
								type="number"
								placeholder="请输入手机号"
								background-color="#fff7f3"
								:border-bottom="false"
								:padding="['28rpx', '24rpx']"
								:radius="26"
								:size="28"
								color="#5a3427"
								maxlength="11"
								@input="onMobileInput"
								@blur="onMobileBlur"
							></fui-input>
							<text v-if="formErrors.mobile" class="form-block__error">{{ formErrors.mobile }}</text>
						</view>
						
						<view class="form-block">
							<view class="form-block__head">
								<text class="form-block__label">生日</text>
								<text class="form-block__meta">选填</text>
							</view>
							<picker
								mode="date"
								fields="day"
								:value="profileForm.birthday || birthdayPickerEnd"
								:start="birthdayPickerStart"
								:end="birthdayPickerEnd"
								@change="onBirthdayChange"
							>
								<fui-list-cell
									:padding="['28rpx', '24rpx']"
									background="#fff7f3"
									:bottom-border="false"
									radius="26rpx"
									arrow
									arrow-color="#d2a394"
								>
									<view class="date-picker-field">
										<text class="date-picker-field__value" :class="{ 'date-picker-field__value--placeholder': !profileForm.birthday }">
											{{ birthdayDisplayText }}
										</text>
									</view>
								</fui-list-cell>
							</picker>
							<text class="form-block__tip">可选择你的生日日期，后续会在个人资料和纪念提醒中使用。</text>
							<text v-if="formErrors.birthday" class="form-block__error">{{ formErrors.birthday }}</text>
						</view>
					</view>
				</fui-card>

				<view class="edit-actions edit-actions--form">
					<fui-button
						form-type="submit"
						text="保存资料"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						:loading="isSaving"
					></fui-button>
					<fui-button
						text="暂不修改"
						background="rgba(255, 241, 235, 0.98)"
						color="#b05b48"
						border-color="rgba(214, 145, 122, 0.24)"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						@click="backToProfile"
					></fui-button>
				</view>
			</form>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		saveCachedUserProfile,
		subscribeAuthChanged,
		uploadAvatarIfNeeded
	} from '../../common/auth-center.js'
	import { getUserApi } from '../../common/api/user.js'

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
		data() {
			return {
				isSaving: false,
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
			displayProfileAvatar() {
				return this.profileForm.avatarUrl || (this.userInfo && this.userInfo.avatarUrl) || DEFAULT_AVATAR
			},
			registerDateText() {
				return this.userInfo ? formatDateTime(this.userInfo.registerDate) : '暂未记录'
			},
			lastLoginDateText() {
				return this.userInfo ? formatDateTime(this.userInfo.lastLoginDate) : '暂未记录'
			},
			nicknameCountText() {
				return `${(this.profileForm.nickname || '').trim().length}/${NICKNAME_MAX_LENGTH}`
			},
			birthdayPickerStart() {
				return BIRTHDAY_START
			},
			birthdayPickerEnd() {
				return getTodayDateString()
			},
			birthdayDisplayText() {
				return this.profileForm.birthday ? formatBirthdayText(this.profileForm.birthday) : '请选择生日日期'
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
					const result = await getUserApi().getMine()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取用户信息失败')
					}

					this.userInfo = result.userInfo || null
					saveCachedUserProfile(this.userInfo)
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
			onGenderChange(event) {
				this.profileForm.gender = Number(event.detail.value || 0)
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
			onMobileInput(value) {
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
				uni.switchTab({
					url: '/pages/profile/index'
				})
			}
		}
	}
</script>

<style>
	.edit-page {
		padding: 28rpx 24rpx 52rpx;
	}

	.editor-card {
		overflow: hidden;
	}

	.editor-card__hero {
		display: flex;
		align-items: flex-start;
		padding: 34rpx 32rpx 28rpx;
	}

	.editor-card__hero-body {
		flex: 1;
		min-width: 0;
		margin-left: 24rpx;
	}

	.editor-card__hero-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18rpx;
	}

	.editor-card__name {
		flex: 1;
		min-width: 0;
		font-size: 38rpx;
		font-weight: 700;
		color: #5a3427;
		word-break: break-all;
	}

	.editor-card__count {
		flex-shrink: 0;
		padding: 8rpx 14rpx;
		border-radius: 999rpx;
		background: rgba(255, 236, 229, 0.96);
		font-size: 22rpx;
		color: #c16b55;
	}

	.editor-card__summary {
		display: block;
		margin-top: 16rpx;
		font-size: 23rpx;
		line-height: 1.8;
		color: #906b61;
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(1, minmax(0, 1fr));
		gap: 16rpx;
		margin-top: 24rpx;
	}

	.meta-grid__item {
		padding: 20rpx 18rpx;
		border-radius: 24rpx;
		background: rgba(255, 244, 239, 0.92);
	}

	.meta-grid__label {
		display: block;
		font-size: 21rpx;
		color: #b08478;
	}

	.meta-grid__value {
		display: block;
		margin-top: 10rpx;
		font-size: 24rpx;
		line-height: 1.6;
		color: #5e3f35;
		word-break: break-all;
	}

	.editor-form {
		padding: 8rpx 32rpx 34rpx;
	}

	.form-block + .form-block {
		margin-top: 30rpx;
	}

	.form-block__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.form-block__label {
		font-size: 26rpx;
		font-weight: 600;
		color: #5a3427;
	}

	.form-block__meta {
		font-size: 22rpx;
		color: #c07a68;
	}

	.form-block__tip {
		display: block;
		margin-top: 14rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: #9a766c;
	}

	.form-block__error {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #da5a41;
	}

	.date-picker-field {
		display: flex;
		align-items: center;
		width: 100%;
		min-height: 42rpx;
	}

	.date-picker-field__value {
		font-size: 28rpx;
		color: #5a3427;
	}

	.date-picker-field__value--placeholder {
		color: #b29a93;
	}

	.gender-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 16rpx;
	}

	.gender-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12rpx;
		padding: 24rpx 16rpx;
		border-radius: 26rpx;
		background: #fff7f3;
		box-shadow: inset 0 0 0 1rpx rgba(239, 203, 191, 0.78);
		transition: all 0.2s ease;
	}

	.gender-chip--active {
		background: rgba(255, 236, 229, 0.98);
		box-shadow: inset 0 0 0 1rpx rgba(236, 117, 88, 0.4);
	}

	.gender-chip__text {
		font-size: 25rpx;
		font-weight: 600;
		color: #6a4337;
	}

	.edit-actions {
		display: flex;
		flex-direction: column;
		gap: 22rpx;
		margin-top: 30rpx;
	}

	.edit-actions--form {
		margin-top: 34rpx;
		padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	}
</style>
