<template>
	<view class="page">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view class="header">
			<view class="header__back" @click="goBack">
				<text class="header__back-icon">←</text>
				<text class="header__back-text">返回</text>
			</view>
			<text class="header__title">上传媒体</text>
			<view class="header__placeholder"></view>
		</view>

		<view class="album-selector">
			<text class="album-selector__label">选择相册</text>
			<picker mode="selector" :range="albumList" range-key="title" :value="selectedAlbumIndex" @change="onAlbumChange">
				<view class="album-selector__value">
					<text class="album-selector__text">{{ selectedAlbum ? selectedAlbum.title : '请选择相册' }}</text>
					<text class="album-selector__arrow">▼</text>
				</view>
			</picker>
		</view>

		<view class="upload-area">
			<love-media-uploader
				ref="mediaUploader"
				:file-types="['image', 'video']"
				:max-file-size="maxFileSize"
				:compressed="compressed"
				:enable-compression="enableCompression"
				:save-path="savePath"
				upload-prefix="photo"
				:max-count="maxCount"
				:show-tips="showUploaderTips"
				:tip-text="uploaderTipText"
				:item-width="220"
				:item-height="220"
				:previewable="true"
				object-fit="aspectFill"
				:source-type="sourceType"
				:show-delete-button="true"
				add-text="添加媒体"
				upload-icon="+"
				@change="onUploaderChange"
				@progress="onUploaderProgress"
			>
				<template #tip>
					<text class="upload-custom-tip">{{ uploaderTipText }}</text>
				</template>
				<template #upload-icon>
					<text class="upload-custom-icon">+</text>
				</template>
			</love-media-uploader>
		</view>

		<view class="options">
			<view class="option-item">
				<text class="option-item__label">添加描述</text>
				<textarea
					class="option-item__textarea"
					v-model="commonDescription"
					placeholder="为这批媒体添加描述（可选）"
					maxlength="500"
				/>
			</view>
		</view>

		<view class="footer">
			<button class="upload-btn" :disabled="!canUpload || uploading" :loading="uploading" @click="handleUpload">
				{{ uploadButtonText }}
			</button>
		</view>
	</view>
</template>

<script>
import { getAlbumApi } from '../../common/api/album.js'
import { getPhotoApi } from '../../common/api/photo.js'

const MAX_COUNT = 20
const MAX_FILE_SIZE = 100 * 1024 * 1024

export default {
	data() {
		return {
			albumId: '',
			albumList: [],
			selectedAlbumIndex: 0,
			selectedCount: 0,
			maxCount: MAX_COUNT,
			maxFileSize: MAX_FILE_SIZE,
			savePath: 'album/media',
			compressed: true,
			enableCompression: true,
			showUploaderTips: true,
			sourceType: ['album', 'camera'],
			commonDescription: '',
			uploading: false,
			uploadProgress: 0
		}
	},
	computed: {
		selectedAlbum() {
			return this.albumList[this.selectedAlbumIndex] || null
		},
		canUpload() {
			return this.selectedCount > 0 && this.selectedAlbum && !this.uploading
		},
		uploaderTipText() {
			return `支持图片和视频，单次最多 ${this.maxCount} 个文件，单个不超过 ${Math.floor(this.maxFileSize / 1024 / 1024)}MB`
		},
		uploadButtonText() {
			if (this.uploading) {
				return `上传中 ${this.uploadProgress}/${this.selectedCount || 0}`
			}
			return `上传 ${this.selectedCount} 个媒体`
		}
	},
	onLoad(options) {
		this.albumId = options.albumId || ''
		this.loadAlbumList()
	},
	methods: {
		async loadAlbumList() {
			try {
				const result = await getAlbumApi().getList({
					page: 1,
					pageSize: 100
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '获取相册列表失败')
				}
				const data = result.data || {}
				this.albumList = data.list || []

				if (this.albumId) {
					const index = this.albumList.findIndex(album => album._id === this.albumId)
					if (index !== -1) {
						this.selectedAlbumIndex = index
					}
				}
			} catch (error) {
				console.error('加载相册列表失败:', error)
				uni.showToast({
					title: error.message || '加载相册失败',
					icon: 'none'
				})
			}
		},
		onAlbumChange(e) {
			this.selectedAlbumIndex = Number(e && e.detail ? e.detail.value : 0) || 0
		},
		onUploaderChange(files = []) {
			this.selectedCount = Array.isArray(files) ? files.length : 0
		},
		onUploaderProgress(payload = {}) {
			this.uploadProgress = Number(payload.current || 0)
		},
		async handleUpload() {
			if (!this.canUpload) {
				return
			}
			if (!this.selectedAlbum) {
				uni.showToast({
					title: '请选择相册',
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

			this.uploading = true
			this.uploadProgress = 0

			try {
				const uploadedFiles = await uploader.uploadAll({
					savePath: this.savePath,
					prefix: 'photo'
				})
				if (!uploadedFiles.length) {
					throw new Error('没有媒体上传成功')
				}

				const photos = uploadedFiles.map(file => ({
					url: file.url,
					fileId: file.fileId,
					thumbnailUrl: file.mediaType === 'image' ? file.url : '',
					description: this.commonDescription,
					fileSize: file.fileSize || 0,
					mimeType: file.mimeType || '',
					mediaType: file.mediaType,
					duration: file.duration || 0,
					width: file.width || 0,
					height: file.height || 0
				}))

				await getPhotoApi().upload({
					albumId: this.selectedAlbum._id,
					photos
				})

				uni.showToast({
					title: `成功上传 ${photos.length} 个媒体`,
					icon: 'success'
				})

				if (typeof uploader.clear === 'function') {
					uploader.clear()
				}
				this.selectedCount = 0
				this.uploadProgress = 0

				setTimeout(() => {
					uni.navigateBack()
				}, 1200)
			} catch (error) {
				console.error('上传失败:', error)
				uni.showToast({
					title: error.message || '上传失败',
					icon: 'none'
				})
			} finally {
				this.uploading = false
			}
		},
		goBack() {
			if (this.uploading) {
				uni.showModal({
					title: '确认返回',
					content: '媒体正在上传中，确定要返回吗？',
					success: (res) => {
						if (res.confirm) {
							uni.navigateBack()
						}
					}
				})
			} else {
				uni.navigateBack()
			}
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

.header {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 32rpx;
}

.header__back {
	display: flex;
	align-items: center;
	padding: 16rpx 0;
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

.album-selector {
	position: relative;
	z-index: 1;
	margin-bottom: 24rpx;
	padding: 24rpx;
	background: rgba(255, 255, 255, 0.9);
	border-radius: 20rpx;
}

.album-selector__label {
	display: block;
	font-size: 24rpx;
	color: #8b6659;
	margin-bottom: 16rpx;
}

.album-selector__value {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 24rpx;
	background: #f8f4f2;
	border-radius: 16rpx;
}

.album-selector__text {
	font-size: 30rpx;
	color: #5a3427;
	font-weight: 500;
}

.album-selector__arrow {
	font-size: 20rpx;
	color: #8b6659;
}

.upload-area {
	position: relative;
	z-index: 1;
	margin-bottom: 24rpx;
	padding: 24rpx;
	background: rgba(255, 255, 255, 0.9);
	border-radius: 20rpx;
}

.upload-custom-tip {
	display: block;
	padding-bottom: 8rpx;
	font-size: 22rpx;
	line-height: 1.7;
	color: #9f7568;
}

.upload-custom-icon {
	font-size: 52rpx;
	line-height: 1;
	color: #e76f51;
}

.options {
	position: relative;
	z-index: 1;
	margin-bottom: 32rpx;
}

.option-item {
	padding: 24rpx;
	background: rgba(255, 255, 255, 0.9);
	border-radius: 20rpx;
}

.option-item__label {
	display: block;
	font-size: 24rpx;
	color: #8b6659;
	margin-bottom: 16rpx;
}

.option-item__textarea {
	width: 100%;
	height: 160rpx;
	padding: 20rpx 24rpx;
	background: #f8f4f2;
	border-radius: 16rpx;
	font-size: 28rpx;
	color: #5a3427;
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

.upload-btn {
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

.upload-btn::after {
	border: none;
}

.upload-btn[disabled] {
	opacity: 0.6;
	background: linear-gradient(135deg, #ccc 0%, #999 100%);
}
</style>
