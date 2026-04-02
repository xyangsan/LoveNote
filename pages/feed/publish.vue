<template>
	<view class="page">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view class="header">
			<view class="header__back" @click="goBack">
				<text class="header__back-icon">←</text>
				<text class="header__back-text">返回</text>
			</view>
			<text class="header__title">发布日常</text>
			<view class="header__placeholder"></view>
		</view>

		<view class="card">
			<view class="type-switch">
				<view
					class="type-switch__item"
					:class="{ 'type-switch__item--active': publishType === 'image' }"
					@click="changePublishType('image')"
				>
					<text class="type-switch__text">图文动态</text>
				</view>
				<view
					class="type-switch__item"
					:class="{ 'type-switch__item--active': publishType === 'video' }"
					@click="changePublishType('video')"
				>
					<text class="type-switch__text">视频动态</text>
				</view>
			</view>

			<textarea
				v-model="content"
				class="content-input"
				placeholder="写点今天的故事"
				maxlength="2000"
				auto-height
			/>

			<view class="emoji-panel">
				<text
					v-for="emoji in emojiList"
					:key="emoji"
					class="emoji-panel__item"
					@click="appendEmoji(emoji)"
				>{{ emoji }}</text>
			</view>
		</view>

		<view class="card">
			<love-media-uploader
				ref="mediaUploader"
				:file-types="uploaderFileTypes"
				:max-file-size="maxFileSize"
				:compressed="true"
				:enable-compression="true"
				:save-path="uploaderSavePath"
				upload-prefix="daily"
				:max-count="uploaderMaxCount"
				:show-tips="true"
				:tip-text="uploaderTipText"
				:item-width="210"
				:item-height="210"
				:previewable="true"
				object-fit="aspectFill"
				:source-type="['album', 'camera']"
				:show-delete-button="true"
				add-text="添加媒体"
				upload-icon="+"
				@change="onUploaderChange"
				@progress="onUploaderProgress"
			>
				<template #tip>
					<text class="upload-tip">{{ uploaderTipText }}</text>
				</template>
				<template #upload-icon>
					<text class="upload-icon">+</text>
				</template>
			</love-media-uploader>
		</view>

		<view class="footer">
			<button class="submit-btn" :loading="submitting" :disabled="submitting" @click="handleSubmit">
				{{ submitting ? `发布中 ${uploadProgress}/${selectedCount || 0}` : '发布动态' }}
			</button>
		</view>
	</view>
</template>

<script>
import { getDailyApi } from '../../common/api/daily.js'

const MAX_FILE_SIZE = 100 * 1024 * 1024

export default {
	data() {
		return {
			publishType: 'image',
			content: '',
			emojiList: ['😀', '🥰', '😍', '😘', '🥺', '🤗', '🎉', '✨', '💖', '🌈', '📷', '🎬', '🍰', '🌙', '☀️', '🧡'],
			maxFileSize: MAX_FILE_SIZE,
			selectedCount: 0,
			uploadProgress: 0,
			submitting: false
		}
	},
	computed: {
		uploaderFileTypes() {
			return this.publishType === 'video' ? ['video'] : ['image']
		},
		uploaderMaxCount() {
			return this.publishType === 'video' ? 1 : 9
		},
		uploaderSavePath() {
			return this.publishType === 'video' ? 'daily/videos' : 'daily/images'
		},
		uploaderTipText() {
			return this.publishType === 'video'
				? '视频动态：单次最多 1 个视频'
				: '图文动态：单次最多 9 张图片'
		}
	},
	methods: {
		appendEmoji(emoji = '') {
			this.content = `${this.content || ''}${emoji}`
		},
		onUploaderChange(files = []) {
			this.selectedCount = Array.isArray(files) ? files.length : 0
		},
		onUploaderProgress(payload = {}) {
			this.uploadProgress = Number(payload.current || 0)
		},
		changePublishType(nextType = 'image') {
			if (this.submitting || this.publishType === nextType) {
				return
			}

			const switchType = () => {
				this.publishType = nextType
				const uploader = this.$refs.mediaUploader
				if (uploader && typeof uploader.clear === 'function') {
					uploader.clear()
				}
				this.selectedCount = 0
				this.uploadProgress = 0
			}

			if (this.selectedCount > 0) {
				uni.showModal({
					title: '切换发布类型',
					content: '切换后会清空当前已选择的媒体，是否继续？',
					confirmColor: '#e76f51',
					success: (res) => {
						if (res.confirm) {
							switchType()
						}
					}
				})
				return
			}

			switchType()
		},
		async handleSubmit() {
			if (this.submitting) {
				return
			}

			const content = String(this.content || '').trim()
			if (!content && this.selectedCount <= 0) {
				uni.showToast({
					title: '请输入文字或添加媒体',
					icon: 'none'
				})
				return
			}

			const uploader = this.$refs.mediaUploader
			if (!uploader || typeof uploader.uploadAll !== 'function') {
				uni.showToast({
					title: '上传组件未就绪',
					icon: 'none'
				})
				return
			}

			this.submitting = true
			this.uploadProgress = 0
			uni.showLoading({
				title: '发布中...',
				mask: true
			})

			try {
				let uploadedFiles = []
				if (this.selectedCount > 0) {
					uploadedFiles = await uploader.uploadAll({
						savePath: this.uploaderSavePath,
						prefix: 'daily'
					})
					if (!uploadedFiles.length) {
						throw new Error('媒体上传失败，请重试')
					}
				}

				const mediaList = uploadedFiles.map((file) => ({
					url: file.url,
					fileId: file.fileId,
					thumbnailUrl: file.mediaType === 'image' ? file.url : (file.poster || ''),
					mediaType: file.mediaType,
					mimeType: file.mimeType || '',
					fileSize: Number(file.fileSize || 0),
					duration: Number(file.duration || 0),
					width: Number(file.width || 0),
					height: Number(file.height || 0)
				}))

				const result = await getDailyApi().create({
					content,
					mediaList
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '发布失败')
				}

				uni.showToast({
					title: '发布成功',
					icon: 'success'
				})

				if (uploader && typeof uploader.clear === 'function') {
					uploader.clear()
				}
				this.content = ''
				this.selectedCount = 0
				this.uploadProgress = 0

				setTimeout(() => {
					uni.navigateBack()
				}, 350)
			} catch (error) {
				console.error('publish daily failed', error)
				uni.showToast({
					title: error.message || '发布失败',
					icon: 'none'
				})
			} finally {
				this.submitting = false
				uni.hideLoading()
			}
		},
		goBack() {
			if (this.submitting) {
				return
			}
			uni.navigateBack()
		}
	}
}
</script>

<style>
.page {
	position: relative;
	min-height: 100vh;
	padding: 32rpx 24rpx 160rpx;
	background: linear-gradient(180deg, #FFF7F1 0%, #FFF0E8 100%);
	overflow: hidden;
}

.page__glow {
	position: absolute;
	width: 320rpx;
	height: 320rpx;
	border-radius: 50%;
	filter: blur(24rpx);
	opacity: 0.4;
	z-index: 0;
}

.page__glow--left {
	top: -80rpx;
	left: -120rpx;
	background: rgba(255, 170, 153, 0.55);
}

.page__glow--right {
	top: 240rpx;
	right: -120rpx;
	background: rgba(255, 220, 174, 0.55);
}

.header,
.card {
	position: relative;
	z-index: 1;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 22rpx;
}

.header__back {
	display: flex;
	align-items: center;
	padding: 14rpx 0;
}

.header__back-icon {
	font-size: 36rpx;
	color: #5a3427;
	margin-right: 8rpx;
}

.header__back-text {
	font-size: 28rpx;
	color: #5a3427;
}

.header__title {
	font-size: 36rpx;
	font-weight: 700;
	color: #5a3427;
}

.header__placeholder {
	width: 100rpx;
}

.card {
	margin-top: 16rpx;
	padding: 24rpx;
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 12rpx 30rpx rgba(177, 114, 83, 0.09);
}

.type-switch {
	display: flex;
	gap: 14rpx;
	margin-bottom: 18rpx;
}

.type-switch__item {
	flex: 1;
	height: 72rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 999rpx;
	background: rgba(255, 241, 235, 0.9);
}

.type-switch__item--active {
	background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
}

.type-switch__text {
	font-size: 24rpx;
	font-weight: 600;
	color: #b05b48;
}

.type-switch__item--active .type-switch__text {
	color: #fff;
}

.content-input {
	width: 100%;
	min-height: 220rpx;
	padding: 18rpx 20rpx;
	box-sizing: border-box;
	border-radius: 18rpx;
	background: #fff7f3;
	font-size: 28rpx;
	line-height: 1.8;
	color: #5a3427;
}

.emoji-panel {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 18rpx;
}

.emoji-panel__item {
	padding: 10rpx 12rpx;
	border-radius: 14rpx;
	background: rgba(255, 241, 235, 0.9);
	font-size: 30rpx;
	line-height: 1.2;
}

.upload-tip {
	display: block;
	font-size: 22rpx;
	color: #9f7568;
	padding-bottom: 8rpx;
}

.upload-icon {
	font-size: 52rpx;
	line-height: 1;
	color: #e76f51;
}

.footer {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 24rpx 32rpx;
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	background: rgba(255, 247, 241, 0.98);
	backdrop-filter: blur(10rpx);
	z-index: 100;
}

.submit-btn {
	width: 100%;
	height: 96rpx;
	line-height: 96rpx;
	background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
	border-radius: 48rpx;
	border: none;
}

.submit-btn::after {
	border: none;
}

.submit-btn[disabled] {
	opacity: 0.7;
}
</style>
