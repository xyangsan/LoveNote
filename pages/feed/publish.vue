<template>
	<view class="page" @click="handlePageTap">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view class="card">
			<textarea
				v-model="content"
				class="content-input"
				placeholder="写点今天的故事"
				maxlength="2000"
				auto-height
				:show-confirm-bar="false"
				:adjust-position="false"
				:focus="inputFocus"
				:cursor-spacing="emojiTriggerSpacing"
				@focus="handleInputFocus"
				@blur="handleInputBlur"
				@tap.stop="handleInputTap"
				@keyboardheightchange="onKeyboardHeightChange"
			/>



			<love-media-uploader
				ref="mediaUploader"
				:file-types="uploaderFileTypes"
				:max-file-size="maxFileSize"
				:compressed="true"
				:enable-compression="true"
				:compress-over-size="uploaderCompressOverSize"
				:image-compress-quality="uploaderImageCompressQuality"
				:enable-thumbnail="true"
				:thumbnail-options="uploaderThumbnailOptions"
				:save-path="uploaderSavePath"
				upload-prefix="daily"
				:max-count="uploaderMaxCount"
				:exclusive-media-types="true"
				:max-image-count="9"
				:max-video-count="1"
				:mixed-media-tip="'不允许同时选择图片和视频'"
				:tip-text="uploaderTipText"
				:item-width="200"
				:item-height="200"
				:previewable="true"
				object-fit="aspectFill"
				:source-type="['album', 'camera']"
				:show-delete-button="true"
				:show-tips="false"
				@change="onUploaderChange"
				@progress="onUploaderProgress"
			>
				<template #upload-icon>
					<text class="upload-icon">+</text>
				</template>
			</love-media-uploader>
		</view>

		<view class="card">
			<view class="location-row" @click="handleChooseLocation">
				<view class="location-row__main">
					<text class="location-row__label">当前位置</text>
					<text class="location-row__value">{{ locationDisplayText }}</text>
				</view>
				<text class="location-row__action">{{ hasSelectedLocation ? '重新选择' : '选择位置' }}</text>
			</view>
			<view v-if="hasSelectedLocation" class="location-extra">
				<text v-if="locationAddressText" class="location-extra__line">{{ locationAddressText }}</text>
				<text class="location-extra__clear" @click="clearLocation">清除位置</text>
			</view>
		</view>

		<view class="footer">
			<button class="submit-btn" :loading="submitting" :disabled="submitting" @click="handleSubmit">
				{{ submitting ? `发布中 ${uploadProgress}/${selectedCount || 0}` : '发布动态' }}
			</button>
		</view>


			<view
				v-if="showEmojiToolbarPanel"
				class="emoji-toolbar-panel"
				@tap.stop
			>
				<view class="emoji-toolbar">
					<view
						class="emoji-toolbar__button"
						@touchstart.prevent="prepareOpenEmojiPanel"
						@click.stop="toggleEmojiPanel"
					>
						<fui-icon name="face" :size="56" color="#333333"></fui-icon>
					</view>
				</view>
				<view v-if="showEmojiPanel" class="emoji-panel">
					<text
						v-for="emoji in emojiList"
						:key="emoji.unicode || emoji.glyph"
						class="emoji-panel__item"
						@click.stop="appendEmoji(emoji)"
					>{{ emoji.glyph }}</text>
				</view>
			</view>
	</view>
</template>

<script>
import { getDailyApi } from '../../common/api/daily.js'
import { uploadFileWithModule } from '../../common/utils/file-upload.js'
import glyph from '../../components/love-editor/glyph.json'

const MAX_FILE_SIZE = 100 * 1024 * 1024
const DAILY_IMAGE_COMPRESS_OVER_SIZE = 1024 * 1024
const DAILY_IMAGE_COMPRESS_QUALITY = 86
const THUMBNAIL_IMAGE_QUALITY = 45

export default {
	data() {
		return {
			mediaMode: 'image',
			keyboardHeight: 0,
			emojiPanelHeight: 0,
			inputFocus: false,
			inputFocused: false,
			showEmojiPanel: false,
			pendingOpenEmojiPanel: false,
			content: '',
			emojiList: glyph,
			maxFileSize: MAX_FILE_SIZE,
			selectedCount: 0,
			uploadProgress: 0,
			submitting: false,
			locationInfo: {
				name: '',
				address: '',
				latitude: null,
				longitude: null
			}
		}
	},
	computed: {
		uploaderFileTypes() {
			return this.mediaMode ? [this.mediaMode] : ['image', 'video']
		},
		uploaderMaxCount() {
			return this.mediaMode === 'video' ? 1 : 9
		},
		uploaderSavePath() {
			return this.mediaMode === 'video' ? 'daily/videos' : 'daily/images'
		},
		uploaderCompressOverSize() {
			return this.mediaMode === 'video' ? (10 * 1024 * 1024) : DAILY_IMAGE_COMPRESS_OVER_SIZE
		},
		uploaderImageCompressQuality() {
			return this.mediaMode === 'video' ? 80 : DAILY_IMAGE_COMPRESS_QUALITY
		},
		uploaderThumbnailOptions() {
			if (this.mediaMode === 'video') {
				return {
					videoSavePath: 'daily/thumbnails/videos',
					videoPrefix: 'poster',
					image: false,
					video: true,
					imageQuality: THUMBNAIL_IMAGE_QUALITY
				}
			}
			return {
				imageSavePath: 'daily/thumbnails/images',
				imagePrefix: 'thumb',
				image: true,
				video: false,
				imageQuality: THUMBNAIL_IMAGE_QUALITY
			}
		},
		uploaderTipText() {
			return this.mediaMode === 'video' ? '视频最多发布 1 个' : '图片最多发布 9 张'
		},
		emojiTriggerSpacing() {
			return 24
		},
		showEmojiToolbarPanel() {
			return this.inputFocused
		},
		hasSelectedLocation() {
			return Boolean(
				this.locationInfo &&
				(this.locationInfo.name || this.locationInfo.address || (
					this.locationInfo.latitude !== null && this.locationInfo.longitude !== null
				))
			)
		},
		locationDisplayText() {
			if (!this.hasSelectedLocation) {
				return '未选择位置'
			}
			return this.locationInfo.name || this.locationInfo.address || '已选择坐标位置'
		},
		locationAddressText() {
			return this.locationInfo.address || ''
		}
	},
	onLoad(options = {}) {
		const type = String(options.type || '').trim()
		this.mediaMode = type === 'video' ? 'video' : 'image'
	},
	methods: {
		appendEmoji(emoji = '') {
			const glyphText = emoji && typeof emoji === 'object' ? String(emoji.glyph || '') : String(emoji || '')
			if (!glyphText) {
				return
			}
			this.content = `${this.content || ''}${glyphText}`
		},
		handleInputFocus() {
			this.inputFocused = true
		},
		handleInputTap() {
			this.inputFocused = true
		},
		handleInputBlur() {
			if (this.pendingOpenEmojiPanel || this.showEmojiPanel) {
				return
			}
			this.inputFocused = false
		},
		onKeyboardHeightChange(event = {}) {
			const detail = event.detail || {}
			const height = Math.max(0, Number(detail.height || 0))
			this.keyboardHeight = Number.isFinite(height) ? height : 0
		},
		hideKeyboardOnly() {
			if (typeof uni.hideKeyboard === 'function') {
				uni.hideKeyboard({})
			}
		},
		prepareOpenEmojiPanel() {
			this.pendingOpenEmojiPanel = true
		},
		toggleEmojiPanel() {
			this.pendingOpenEmojiPanel = false
			this.inputFocused = true
			this.inputFocus = false
			this.hideKeyboardOnly()
			this.showEmojiPanel = !this.showEmojiPanel
		},
		closeEmojiPanel() {
			this.pendingOpenEmojiPanel = false
			this.showEmojiPanel = false
		},
		closeEmojiToolbarPanel() {
			this.closeEmojiPanel()
			this.inputFocused = false
		},
		handlePageTap() {
			if (this.inputFocused || this.showEmojiPanel) {
				this.closeEmojiToolbarPanel()
			}
		},
		formatCoordinate(value) {
			const num = Number(value)
			if (Number.isNaN(num)) {
				return '--'
			}
			return num.toFixed(6)
		},
		clearLocation() {
			this.locationInfo = {
				name: '',
				address: '',
				latitude: null,
				longitude: null
			}
		},
		async handleChooseLocation() {
			if (this.submitting) {
				return
			}

			try {
				const selected = await new Promise((resolve, reject) => {
					uni.chooseLocation({
						success: (res) => resolve(res || {}),
						fail: (error) => reject(error)
					})
				})

				this.locationInfo = {
					name: String(selected.name || '').trim(),
					address: String(selected.address || '').trim(),
					latitude: Number.isNaN(Number(selected.latitude)) ? null : Number(selected.latitude),
					longitude: Number.isNaN(Number(selected.longitude)) ? null : Number(selected.longitude)
				}
			} catch (error) {
				const message = String(error && (error.errMsg || error.message) || '')
				if (message.includes('cancel')) {
					return
				}
				uni.showToast({
					title: '位置选择失败，请重试',
					icon: 'none'
				})
			}
		},
		buildLocationPayload() {
			if (!this.hasSelectedLocation) {
				return null
			}
			return {
				name: String(this.locationInfo.name || '').trim(),
				address: String(this.locationInfo.address || '').trim(),
				latitude: this.locationInfo.latitude === null ? null : Number(this.locationInfo.latitude),
				longitude: this.locationInfo.longitude === null ? null : Number(this.locationInfo.longitude)
			}
		},
		compressImageForThumbnail(filePath = '') {
			return new Promise((resolve) => {
				const sourcePath = String(filePath || '').trim()
				if (!sourcePath || typeof uni.compressImage !== 'function') {
					resolve(sourcePath)
					return
				}
				uni.compressImage({
					src: sourcePath,
					quality: THUMBNAIL_IMAGE_QUALITY,
					success: (res) => {
						const nextPath = String(res && (res.tempFilePath || res.filePath) || '').trim()
						resolve(nextPath || sourcePath)
					},
					fail: () => {
						resolve(sourcePath)
					}
				})
			})
		},
		async uploadThumbnailFile({
			localPath = '',
			module = '',
			prefix = ''
		} = {}) {
			const sourcePath = String(localPath || '').trim()
			if (!sourcePath) {
				return ''
			}
			const result = await uploadFileWithModule({
				filePath: sourcePath,
				module,
				prefix,
				fileType: 'image'
			})
			return String(result.fileURL || '').trim()
		},
		async buildMediaPayload(file = {}) {
			const mediaType = String(file.mediaType || '').trim().toLowerCase()
			const sourceUrl = String(file.url || '').trim()
			let thumbnailUrl = String(file.thumbnailUrl || '').trim()

			if (mediaType === 'image' && !thumbnailUrl) {
				try {
					const thumbnailSourcePath = await this.compressImageForThumbnail(String(file.path || '').trim())
					thumbnailUrl = await this.uploadThumbnailFile({
						localPath: thumbnailSourcePath,
						module: 'daily/thumbnails/images',
						prefix: 'thumb'
					})
				} catch (error) {
					console.warn('build image thumbnail failed', error)
				}
				if (!thumbnailUrl) {
					thumbnailUrl = sourceUrl
				}
			}

			if (mediaType === 'video' && !thumbnailUrl) {
				try {
					thumbnailUrl = await this.uploadThumbnailFile({
						localPath: String(file.poster || '').trim(),
						module: 'daily/thumbnails/videos',
						prefix: 'poster'
					})
				} catch (error) {
					console.warn('build video thumbnail failed', error)
				}
			}

			return {
				url: sourceUrl,
				fileId: file.fileId,
				thumbnailUrl,
				thumbnailFileId: file.thumbnailFileId || '',
				mediaType: file.mediaType,
				mimeType: file.mimeType || '',
				fileSize: Number(file.fileSize || 0),
				duration: Number(file.duration || 0),
				width: Number(file.width || 0),
				height: Number(file.height || 0)
			}
		},
		onUploaderChange(files = []) {
			const list = Array.isArray(files) ? files : []
			this.selectedCount = list.length
		},
		onUploaderProgress(payload = {}) {
			this.uploadProgress = Number(payload.current || 0)
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

				const mediaList = await Promise.all(uploadedFiles.map((file) => this.buildMediaPayload(file)))

				const location = this.buildLocationPayload()
				const result = await getDailyApi().create({
					content,
					mediaList,
					location
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
				this.clearLocation()

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
	margin-bottom: 20rpx;
	box-sizing: border-box;
	border-radius: 18rpx;
	background: #fff7f3;
	font-size: 28rpx;
	line-height: 1.8;
	color: #5a3427;
}


.emoji-toolbar-panel {
	position: relative;
	z-index: 3000;
	width: 100%;
	margin: 16rpx 0 20rpx;
	box-sizing: border-box;
	background: #ffffff;
	border-radius: 18rpx;
	box-shadow: 0 8rpx 24rpx rgba(177, 114, 83, 0.08);
	overflow: hidden;
}

.emoji-toolbar {
	width: 100%;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: flex-start;
	padding: 0 24rpx;
	box-sizing: border-box;
	background: #ffffff;
}

.emoji-toolbar__button {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
}

.emoji-panel {
	display: flex;
	flex-wrap: wrap;
	align-content: flex-start;
	gap: 20rpx;
	max-height: 560rpx;
	padding: 20rpx 24rpx 28rpx;
	box-sizing: border-box;
	background: #ffffff;
	overflow-y: auto;
}

.emoji-panel__item {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 14rpx;
	background: #fff1eb;
	font-size: 34rpx;
	line-height: 1;
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

.location-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20rpx;
}

.location-row__main {
	flex: 1;
	min-width: 0;
}

.location-row__label {
	display: block;
	font-size: 24rpx;
	color: #7d5c52;
}

.location-row__value {
	display: block;
	margin-top: 10rpx;
	font-size: 28rpx;
	font-weight: 600;
	color: #5a3427;
	word-break: break-all;
}

.location-row__action {
	flex-shrink: 0;
	font-size: 24rpx;
	color: #c46e56;
}

.location-extra {
	margin-top: 16rpx;
	padding-top: 14rpx;
	border-top: 1rpx solid rgba(231, 204, 194, 0.6);
}

.location-extra__line {
	display: block;
	font-size: 22rpx;
	line-height: 1.6;
	color: #8d695f;
	word-break: break-all;
}

.location-extra__line + .location-extra__line {
	margin-top: 6rpx;
}

.location-extra__clear {
	display: inline-block;
	margin-top: 10rpx;
	font-size: 22rpx;
	color: #c46e56;
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
