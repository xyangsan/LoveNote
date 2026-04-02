<template>
	<view class="love-page feedback-submit-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<fui-section
				title="反馈与帮助"
				descr="遇到问题、体验建议或功能想法，都可以提交给我们。"
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
				desc="请先登录后提交反馈。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<view v-else class="feedback-submit-page__body">
				<fui-card
					:margin="['0', '0', '0', '0']"
					background="rgba(255, 250, 247, 0.97)"
					radius="32rpx"
					shadow="0 20rpx 48rpx rgba(192, 120, 92, 0.12)"
					:padding="['0', '0']"
					:header-line="false"
				>
					<view class="feedback-form">
						<view class="feedback-form__item">
							<text class="love-field-label">反馈分类</text>
							<fui-radio-group :value="String(categoryIndex)" @change="handleCategoryChange">
								<view class="category-radio-grid">
									<view
										v-for="(item, index) in categoryOptions"
										:key="item.value"
										class="category-radio-chip"
										:class="{ 'category-radio-chip--active': categoryIndex === index }"
										@tap="selectCategory(index)"
									>
										<fui-radio
											:value="String(index)"
											color="#ec7558"
											border-color="#efcbbf"
											check-mark-color="#ffffff"
											:scale-ratio="0.9"
										></fui-radio>
										<text class="category-radio-chip__text">{{ item.name }}</text>
									</view>
								</view>
							</fui-radio-group>
							<text class="love-field-tip">请选择最符合当前问题的分类。</text>
						</view>

						<view class="feedback-form__item">
							<text class="love-field-label">反馈内容</text>
							<fui-textarea
								:value="content"
								placeholder="请描述问题场景、复现步骤或你的建议"
								background-color="#fff7f3"
								:border-top="false"
								:border-bottom="false"
								:radius="24"
								:padding="['22rpx', '24rpx']"
								height="280rpx"
								:size="28"
								color="#5a3427"
								:maxlength="contentMaxLength"
								:is-counter="true"
								counter-color="#b08a7d"
								:counter-size="22"
								@input="onContentInput"
							></fui-textarea>
						</view>

						<view class="feedback-form__item">
							<text class="love-field-label">问题截图（可选）</text>
							<love-media-uploader
								ref="mediaUploader"
								:file-types="['image']"
								:max-file-size="imageMaxSize"
								:compressed="true"
								:enable-compression="true"
								:compressOverSize="5 * 1024 * 1024"
								save-path="feedback/images"
								upload-prefix="feedback"
								:max-count="9"
								:show-tips="true"
								:tip-text="uploaderTipText"
								:item-width="200"
								:item-height="200"
								:previewable="true"
								object-fit="aspectFill"
								:source-type="['album', 'camera']"
								:show-delete-button="true"
								add-text="添加截图"
								upload-icon="+"
								@change="onUploaderChange"
							>
								<template #tip>
									<text class="feedback-form__upload-tip">{{ uploaderTipText }}</text>
								</template>
							</love-media-uploader>
						</view>
					</view>
				</fui-card>

				<view class="feedback-submit-page__actions">
					<fui-button
						text="提交反馈"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						:loading="submitting"
						@click="handleSubmit"
					></fui-button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		subscribeAuthChanged
	} from '../../common/auth-center.js'
	import { getFeedbackApi } from '../../common/api/feedback.js'

	const CATEGORY_OPTIONS = [{
		name: '功能异常',
		value: 'bug'
	}, {
		name: '功能建议',
		value: 'feature'
	}, {
		name: '体验问题',
		value: 'experience'
	}, {
		name: '其他',
		value: 'other'
	}]

	const IMAGE_MAX_SIZE = 20 * 1024 * 1024
	const CONTENT_MAX_LENGTH = 2000

	export default {
		data() {
			return {
				submitting: false,
				loggedIn: false,
				removeAuthListener: null,
				content: '',
				categoryIndex: 0,
				selectedImageCount: 0,
				imageMaxSize: IMAGE_MAX_SIZE,
				contentMaxLength: CONTENT_MAX_LENGTH
			}
		},
		computed: {
			isLoggedIn() {
				return this.loggedIn
			},
			categoryOptions() {
				return CATEGORY_OPTIONS
			},
			currentCategory() {
				return CATEGORY_OPTIONS[this.categoryIndex] || CATEGORY_OPTIONS[0]
			},
			uploaderTipText() {
				return `最多上传 9 张截图，单张不超过 ${Math.floor(this.imageMaxSize / 1024 / 1024)}MB`
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
			restoreLoginState() {
				const userInfo = getCurrentUniIdUser()
				if (!userInfo || !userInfo.uid) {
					this.loggedIn = false
					return
				}

				if (userInfo.tokenExpired && userInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.loggedIn = false
					return
				}

				this.loggedIn = true
			},
			goToLoginPage() {
				uni.navigateTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/feedback/index')
				})
			},
			backToProfile() {
				uni.switchTab({
					url: '/pages/profile/index'
				})
			},
			handleCategoryChange(event = {}) {
				const value = event && event.detail ? event.detail.value : ''
				const nextIndex = Number(value)
				this.categoryIndex = Number.isNaN(nextIndex) ? 0 : nextIndex
			},
			selectCategory(index) {
				const nextIndex = Number(index || 0)
				this.categoryIndex = Number.isNaN(nextIndex) ? 0 : nextIndex
			},
			onContentInput(value) {
				this.content = String(value || '').slice(0, this.contentMaxLength)
			},
			onUploaderChange(files = []) {
				this.selectedImageCount = Array.isArray(files) ? files.length : 0
			},
			async handleSubmit() {
				if (this.submitting) {
					return
				}
				if (!this.isLoggedIn) {
					this.goToLoginPage()
					return
				}

				const content = String(this.content || '').trim()
				if (!content) {
					uni.showToast({
						title: '请填写反馈内容',
						icon: 'none'
					})
					return
				}

				const uploader = this.$refs.mediaUploader
				if (!uploader || typeof uploader.uploadAll !== 'function') {
					uni.showToast({
						title: '上传组件未准备好',
						icon: 'none'
					})
					return
				}

				this.submitting = true
				uni.showLoading({
					title: '提交中...',
					mask: true
				})

				try {
					let uploadedFiles = []
					if (this.selectedImageCount > 0) {
						uploadedFiles = await uploader.uploadAll({
							savePath: 'feedback/images',
							prefix: 'feedback'
						})
						if (!uploadedFiles.length) {
							throw new Error('截图上传失败，请重试')
						}
					}

					const imageList = uploadedFiles.map((item) => ({
						url: item.url,
						fileId: item.fileId,
						mimeType: item.mimeType || 'image/jpeg',
						fileSize: Number(item.fileSize || 0),
						width: Number(item.width || 0),
						height: Number(item.height || 0)
					}))

					const result = await getFeedbackApi().create({
						category: this.currentCategory.value,
						content,
						imageList
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '提交反馈失败')
					}

					this.content = ''
					this.categoryIndex = 0
					this.selectedImageCount = 0
					if (uploader && typeof uploader.clear === 'function') {
						uploader.clear()
					}

					uni.showToast({
						title: '反馈提交成功',
						icon: 'success'
					})
				} catch (error) {
					console.error('feedback submit failed', error)
					uni.showToast({
						title: error.message || '提交反馈失败',
						icon: 'none'
					})
				} finally {
					this.submitting = false
					uni.hideLoading()
				}
			}
		}
	}
</script>

<style>
	.feedback-submit-page {
		padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
	}

	.feedback-submit-page__body {
		padding-top: 2rpx;
	}

	.feedback-form {
		padding: 32rpx 28rpx 30rpx;
	}

	.feedback-form__item + .feedback-form__item {
		margin-top: 28rpx;
	}

	.category-radio-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16rpx;
	}

	.category-radio-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12rpx;
		padding: 22rpx 16rpx;
		border-radius: 24rpx;
		background: #fff7f3;
		box-shadow: inset 0 0 0 1rpx rgba(239, 203, 191, 0.78);
		transition: all 0.2s ease;
	}

	.category-radio-chip--active {
		background: rgba(255, 236, 229, 0.98);
		box-shadow: inset 0 0 0 1rpx rgba(236, 117, 88, 0.4);
	}

	.category-radio-chip__text {
		font-size: 24rpx;
		font-weight: 600;
		color: #6a4337;
	}

	.feedback-form__upload-tip {
		display: block;
		font-size: 22rpx;
		line-height: 1.7;
		color: #9f7568;
	}

	.feedback-submit-page__actions {
		margin-top: 30rpx;
	}
</style>
