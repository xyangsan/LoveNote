<template>
	<view class="love-media-uploader">
		<view v-if="showTips" class="love-media-uploader__tip-wrap">
			<slot name="tip">
				<text class="love-media-uploader__tip">{{ resolvedTipText }}</text>
			</slot>
		</view>

		<view class="love-media-uploader__grid">
			<view
				v-for="(file, index) in files"
				:key="file.id"
				class="love-media-uploader__item"
				:style="itemStyle"
				@click="handlePreview(file)"
			>
				<video
					v-if="file.mediaType === 'video'"
					class="love-media-uploader__video"
					:src="file.path"
					:poster="file.poster"
					:object-fit="videoObjectFit"
					:controls="false"
					:show-play-btn="true"
					:enable-progress-gesture="false"
				></video>
				<image
					v-else
					class="love-media-uploader__image"
					:src="file.path"
					:mode="objectFit"
					lazy-load
				></image>

				<view v-if="file.mediaType === 'video'" class="love-media-uploader__type">
					<text class="love-media-uploader__type-text">视频</text>
				</view>

				<view
					v-if="showDeleteButton"
					class="love-media-uploader__remove"
					@click.stop="removeFile(index)"
				>
					<text class="love-media-uploader__remove-icon">×</text>
				</view>

				<view v-if="file.status === 'uploading'" class="love-media-uploader__mask">
					<fui-loading type="rotate" size="32" color="#fff"></fui-loading>
				</view>
				<view v-if="file.status === 'success'" class="love-media-uploader__success">
					<text class="love-media-uploader__success-icon">✓</text>
				</view>
				<view v-if="file.status === 'error'" class="love-media-uploader__error">
					<text class="love-media-uploader__error-icon">!</text>
				</view>
			</view>

			<view
				v-if="canAdd"
				class="love-media-uploader__item love-media-uploader__item--add"
				:style="itemStyle"
				@click="chooseFiles"
			>
				<slot name="upload-icon">
					<image
						v-if="isIconImage"
						class="love-media-uploader__add-icon-image"
						:src="uploadIcon"
						mode="aspectFit"
					></image>
					<text v-else class="love-media-uploader__add-icon">{{ uploadIcon }}</text>
				</slot>
				<text class="love-media-uploader__add-text">{{ addText }}</text>
				<text class="love-media-uploader__add-hint">{{ files.length }}/{{ safeMaxCount }}</text>
			</view>
		</view>
	</view>
</template>

<script>
import { uploadFileWithModule } from '../../common/utils/file-upload.js'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']
const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'avi', 'wmv', 'flv', 'mkv', 'webm']
const DEFAULT_COMPRESS_OVER_SIZE = 10 * 1024 * 1024

function toUniqueArray(value = [], fallback = []) {
	const list = Array.isArray(value) ? value : fallback
	return Array.from(new Set(list.map(item => String(item || '').trim().toLowerCase()).filter(Boolean)))
}

function toUnit(value, fallback = '220rpx') {
	if (typeof value === 'number') {
		return `${value}rpx`
	}
	const raw = String(value || '').trim()
	return raw || fallback
}

function inferMediaTypeByPath(path = '') {
	const ext = String(path || '').split('?')[0].split('.').pop().toLowerCase()
	if (IMAGE_EXTS.includes(ext)) {
		return 'image'
	}
	if (VIDEO_EXTS.includes(ext)) {
		return 'video'
	}
	return ''
}

function inferMimeTypeByPath(path = '', mediaType = '') {
	const ext = String(path || '').split('?')[0].split('.').pop().toLowerCase()
	if (mediaType === 'image') {
		if (ext === 'jpg' || ext === 'jpeg') {
			return 'image/jpeg'
		}
		return ext ? `image/${ext}` : 'image/jpeg'
	}
	if (mediaType === 'video') {
		if (ext === 'mov') {
			return 'video/quicktime'
		}
		return ext ? `video/${ext}` : 'video/mp4'
	}
	return ''
}

function normalizeSourceType(value = []) {
	const list = toUniqueArray(value, ['album', 'camera'])
	const next = list.filter(item => ['album', 'camera'].includes(item))
	return next.length ? next : ['album', 'camera']
}

export default {
	name: 'love-media-uploader',
	props: {
		fileTypes: {
			type: Array,
			default() {
				return ['image']
			}
		},
		maxFileSize: {
			type: Number,
			default: 0
		},
		compressed: {
			type: Boolean,
			default: true
		},
		enableCompression: {
			type: Boolean,
			default: true
		},
		compressOverSize: {
			type: Number,
			default: DEFAULT_COMPRESS_OVER_SIZE
		},
		imageCompressQuality: {
			type: Number,
			default: 80
		},
		videoCompressQuality: {
			type: String,
			default: 'medium'
		},
		savePath: {
			type: String,
			default: 'common'
		},
		uploadPrefix: {
			type: String,
			default: 'file'
		},
		maxCount: {
			type: Number,
			default: 9
		},
		showTips: {
			type: Boolean,
			default: true
		},
		tipText: {
			type: String,
			default: ''
		},
		itemWidth: {
			type: [String, Number],
			default: 220
		},
		itemHeight: {
			type: [String, Number],
			default: 220
		},
		previewable: {
			type: Boolean,
			default: true
		},
		objectFit: {
			type: String,
			default: 'aspectFill'
		},
		sourceType: {
			type: Array,
			default() {
				return ['album', 'camera']
			}
		},
		showDeleteButton: {
			type: Boolean,
			default: true
		},
		addText: {
			type: String,
			default: '添加文件'
		},
		uploadIcon: {
			type: String,
			default: '+'
		},
		maxDuration: {
			type: Number,
			default: 60
		},
		disabled: {
			type: Boolean,
			default: false
		}
	},
	data() {
		return {
			files: [],
			uploading: false
		}
	},
	computed: {
		safeFileTypes() {
			const list = toUniqueArray(this.fileTypes, ['image']).filter(item => ['image', 'video'].includes(item))
			return list.length ? list : ['image']
		},
		safeMaxCount() {
			const count = Number(this.maxCount || 0)
			return count > 0 ? count : 1
		},
		itemStyle() {
			return {
				width: toUnit(this.itemWidth, '220rpx'),
				height: toUnit(this.itemHeight, '220rpx')
			}
		},
		canAdd() {
			return !this.disabled && this.files.length < this.safeMaxCount
		},
		pickerMediaType() {
			if (this.safeFileTypes.includes('image') && this.safeFileTypes.includes('video')) {
				return ['image', 'video']
			}
			return [...this.safeFileTypes]
		},
		pickerSourceType() {
			return normalizeSourceType(this.sourceType)
		},
		useCompression() {
			return this.enableCompression && this.compressed
		},
		compressThreshold() {
			const value = Number(this.compressOverSize || 0)
			return value > 0 ? value : DEFAULT_COMPRESS_OVER_SIZE
		},
		resolvedTipText() {
			if (this.tipText) {
				return this.tipText
			}
			const typeText = this.safeFileTypes.length > 1 ? '图片和视频' : (this.safeFileTypes[0] === 'video' ? '视频' : '图片')
			const sizeText = this.maxFileSize > 0 ? `，单个不超过 ${Math.floor(this.maxFileSize / 1024 / 1024)}MB` : ''
			const compressText = this.useCompression ? `，超过 ${Math.floor(this.compressThreshold / 1024 / 1024)}MB 自动压缩` : ''
			return `支持上传${typeText}${sizeText}${compressText}`
		},
		isIconImage() {
			return /^https?:\/\//i.test(String(this.uploadIcon || ''))
		},
		videoObjectFit() {
			if (this.objectFit === 'aspectFit') {
				return 'contain'
			}
			return 'cover'
		}
	},
	methods: {
		emitChange() {
			this.$emit('change', this.files.map(item => ({ ...item })))
		},
		getFiles() {
			return this.files.map(item => ({ ...item }))
		},
		clear() {
			if (this.uploading) {
				return
			}
			this.files = []
			this.emitChange()
		},
		normalizePickedFile(file, index) {
			const path = file.tempFilePath || file.path || ''
			if (!path) {
				return null
			}
			const nativeType = String(file.fileType || '').toLowerCase()
			let mediaType = ''
			if (nativeType === 'image' || nativeType.includes('image')) {
				mediaType = 'image'
			} else if (nativeType === 'video' || nativeType.includes('video')) {
				mediaType = 'video'
			} else {
				mediaType = inferMediaTypeByPath(path)
			}
			if (!this.safeFileTypes.includes(mediaType)) {
				return null
			}
			const size = Number(file.size || 0)
			if (this.maxFileSize > 0 && size > this.maxFileSize) {
				return null
			}
			return {
				id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
				path,
				size,
				mediaType,
				mimeType: inferMimeTypeByPath(path, mediaType),
				duration: Number(file.duration || 0),
				width: Number(file.width || 0),
				height: Number(file.height || 0),
				poster: file.thumbTempFilePath || '',
				status: 'pending',
				cloudPath: '',
				url: '',
				fileId: '',
				errorMsg: ''
			}
		},
		chooseFiles() {
			if (this.disabled) {
				return
			}
			const remain = this.safeMaxCount - this.files.length
			if (remain <= 0) {
				uni.showToast({
					title: `最多选择 ${this.safeMaxCount} 个文件`,
					icon: 'none'
				})
				return
			}
			if (typeof uni.chooseMedia !== 'function') {
				uni.showToast({
					title: '当前环境不支持文件选择',
					icon: 'none'
				})
				return
			}

			uni.chooseMedia({
				count: remain,
				mediaType: this.pickerMediaType,
				sourceType: this.pickerSourceType,
				maxDuration: Number(this.maxDuration || 60),
				sizeType: this.useCompression ? ['compressed'] : ['original'],
				success: (res) => {
					const tempFiles = Array.isArray(res.tempFiles) ? res.tempFiles : []
					let unsupportedCount = 0
					let oversizeCount = 0
					const nextFiles = tempFiles
						.map((item, index) => {
							const normalized = this.normalizePickedFile(item, index)
							if (!normalized) {
								const size = Number(item && item.size || 0)
								if (this.maxFileSize > 0 && size > this.maxFileSize) {
									oversizeCount++
								} else {
									unsupportedCount++
								}
							}
							return normalized
						})
						.filter(Boolean)

					if (!nextFiles.length) {
						uni.showToast({
							title: '未选择可上传文件',
							icon: 'none'
						})
						return
					}

					this.files = [...this.files, ...nextFiles]
					this.emitChange()

					if (oversizeCount > 0) {
						uni.showToast({
							title: `${oversizeCount} 个文件超出大小限制`,
							icon: 'none'
						})
						return
					}
					if (unsupportedCount > 0) {
						uni.showToast({
							title: `${unsupportedCount} 个文件类型不支持`,
							icon: 'none'
						})
					}
				}
			})
		},
		removeFile(index) {
			if (!this.showDeleteButton) {
				return
			}
			if (this.uploading) {
				uni.showToast({
					title: '上传中不可删除',
					icon: 'none'
				})
				return
			}
			if (index < 0 || index >= this.files.length) {
				return
			}
			this.files.splice(index, 1)
			this.emitChange()
		},
		handlePreview(file) {
			if (!this.previewable || !file) {
				return
			}
			if (file.mediaType === 'video') {
				const videoUrl = file.url || file.path
				if (!videoUrl) {
					return
				}
				if (typeof uni.previewMedia === 'function') {
					uni.previewMedia({
						sources: [
							{
								url: videoUrl,
								type: 'video',
								poster: file.poster || ''
							}
						],
						current: 0
					})
					return
				}
				uni.showToast({
					title: '当前环境不支持视频预览',
					icon: 'none'
				})
				return
			}

			const imageFiles = this.files.filter(item => item.mediaType === 'image')
			const urls = imageFiles.map(item => item.url || item.path).filter(Boolean)
			if (!urls.length) {
				return
			}
			const current = imageFiles.findIndex(item => item.id === file.id)
			uni.previewImage({
				urls,
				current: current >= 0 ? current : 0
			})
		},
		getFileInfo(filePath = '') {
			return new Promise((resolve) => {
				if (!filePath || typeof uni.getFileInfo !== 'function') {
					resolve(null)
					return
				}
				uni.getFileInfo({
					filePath,
					success: (res) => {
						resolve(res || null)
					},
					fail: () => {
						resolve(null)
					}
				})
			})
		},
		compressImageFile(filePath = '') {
			return new Promise((resolve, reject) => {
				if (!filePath || typeof uni.compressImage !== 'function') {
					reject(new Error('当前环境不支持图片压缩'))
					return
				}
				const quality = Math.max(1, Math.min(100, Number(this.imageCompressQuality || 80)))
				uni.compressImage({
					src: filePath,
					quality,
					success: (res) => {
						resolve(res || {})
					},
					fail: (error) => {
						reject(error || new Error('图片压缩失败'))
					}
				})
			})
		},
		compressVideoFile(filePath = '') {
			return new Promise((resolve, reject) => {
				if (!filePath || typeof uni.compressVideo !== 'function') {
					reject(new Error('当前环境不支持视频压缩'))
					return
				}
				uni.compressVideo({
					src: filePath,
					quality: this.videoCompressQuality || 'medium',
					success: (res) => {
						resolve(res || {})
					},
					fail: (error) => {
						reject(error || new Error('视频压缩失败'))
					}
				})
			})
		},
		async prepareFileForUpload(file = {}) {
			const originPath = String(file.path || '')
			const originSize = Number(file.size || 0)
			if (!originPath) {
				return {
					path: '',
					size: 0,
					compressed: false
				}
			}

			if (!this.useCompression || originSize <= this.compressThreshold) {
				return {
					path: originPath,
					size: originSize,
					compressed: false
				}
			}

			try {
				if (file.mediaType === 'image') {
					const compressRes = await this.compressImageFile(originPath)
					const compressedPath = String(compressRes.tempFilePath || compressRes.filePath || '')
					if (!compressedPath) {
						throw new Error('图片压缩结果无效')
					}
					const info = await this.getFileInfo(compressedPath)
					return {
						path: compressedPath,
						size: Number((info && info.size) || originSize),
						compressed: compressedPath !== originPath
					}
				}

				if (file.mediaType === 'video') {
					const compressRes = await this.compressVideoFile(originPath)
					const compressedPath = String(compressRes.tempFilePath || compressRes.filePath || '')
					if (!compressedPath) {
						throw new Error('视频压缩结果无效')
					}
					return {
						path: compressedPath,
						size: Number(compressRes.size || originSize),
						compressed: compressedPath !== originPath
					}
				}
			} catch (error) {
				console.warn('prepareFileForUpload compress failed, fallback to original file', error)
			}

			return {
				path: originPath,
				size: originSize,
				compressed: false
			}
		},
		async uploadAll(options = {}) {
			if (this.uploading) {
				return []
			}
			if (!this.files.length) {
				return []
			}

			const modulePath = String(options.savePath || this.savePath || 'common').trim() || 'common'
			const prefix = String(options.prefix || this.uploadPrefix || 'file').trim() || 'file'

			this.uploading = true
			const successList = []
			const failedList = []
			const total = this.files.length

			try {
				for (let i = 0; i < total; i++) {
					const current = this.files[i]
					if (!current) {
						continue
					}

					this.files.splice(i, 1, {
						...current,
						status: 'uploading',
						errorMsg: ''
					})

					try {
						const uploadSource = await this.prepareFileForUpload(current)
						const uploadRes = await uploadFileWithModule({
							filePath: uploadSource.path || current.path,
							module: modulePath,
							prefix,
							fileType: current.mediaType === 'video' ? 'video' : 'image'
						})

						const nextItem = {
							...current,
							size: Number(uploadSource.size || current.size || 0),
							status: 'success',
							cloudPath: uploadRes.cloudPath || '',
							url: uploadRes.fileURL || '',
							fileId: uploadRes.fileID || '',
							errorMsg: ''
						}
						this.files.splice(i, 1, nextItem)

						successList.push({
							path: nextItem.path,
							url: nextItem.url,
							fileId: nextItem.fileId,
							cloudPath: nextItem.cloudPath,
							mediaType: nextItem.mediaType,
							mimeType: nextItem.mimeType || '',
							fileSize: nextItem.size || 0,
							duration: nextItem.duration || 0,
							width: nextItem.width || 0,
							height: nextItem.height || 0,
							thumbnailUrl: nextItem.mediaType === 'video' ? '' : nextItem.url,
							poster: nextItem.poster || ''
						})
					} catch (error) {
						const failedItem = {
							...current,
							status: 'error',
							errorMsg: error && error.message ? error.message : '上传失败'
						}
						this.files.splice(i, 1, failedItem)
						failedList.push({
							...failedItem
						})
						this.$emit('error', {
							file: { ...failedItem },
							error
						})
					}

					this.$emit('progress', {
						current: i + 1,
						total,
						success: successList.length,
						failed: failedList.length
					})
				}
			} finally {
				this.uploading = false
				this.$emit('uploaded', {
					success: [...successList],
					failed: [...failedList],
					total
				})
				this.emitChange()
			}

			return successList
		}
	}
}
</script>

<style scoped>
.love-media-uploader {
	width: 100%;
}

.love-media-uploader__tip-wrap {
	margin-bottom: 14rpx;
}

.love-media-uploader__tip {
	display: block;
	font-size: 22rpx;
	line-height: 1.7;
	color: #9f7568;
}

.love-media-uploader__grid {
	display: flex;
	flex-wrap: wrap;
	margin: 0 -8rpx;
}

.love-media-uploader__item {
	position: relative;
	margin: 0 8rpx 16rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #f0f0f0;
}

.love-media-uploader__image,
.love-media-uploader__video {
	width: 100%;
	height: 100%;
}

.love-media-uploader__type {
	position: absolute;
	left: 10rpx;
	top: 10rpx;
	padding: 4rpx 12rpx;
	border-radius: 12rpx;
	background: rgba(0, 0, 0, 0.56);
}

.love-media-uploader__type-text {
	font-size: 20rpx;
	color: #fff;
}

.love-media-uploader__remove {
	position: absolute;
	top: 8rpx;
	right: 8rpx;
	width: 44rpx;
	height: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.5);
	border-radius: 50%;
}

.love-media-uploader__remove-icon {
	font-size: 28rpx;
	color: #fff;
}

.love-media-uploader__mask,
.love-media-uploader__success,
.love-media-uploader__error {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.love-media-uploader__mask {
	background: rgba(0, 0, 0, 0.4);
}

.love-media-uploader__success {
	background: rgba(76, 175, 80, 0.8);
}

.love-media-uploader__success-icon,
.love-media-uploader__error-icon {
	font-size: 48rpx;
	color: #fff;
	font-weight: 700;
}

.love-media-uploader__error {
	background: rgba(244, 67, 54, 0.82);
}

.love-media-uploader__item--add {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.8);
	border: 2rpx dashed rgba(231, 111, 81, 0.4);
}

.love-media-uploader__add-icon {
	font-size: 52rpx;
	line-height: 1;
	color: #e76f51;
}

.love-media-uploader__add-icon-image {
	width: 56rpx;
	height: 56rpx;
}

.love-media-uploader__add-text {
	margin-top: 8rpx;
	font-size: 26rpx;
	color: #e76f51;
}

.love-media-uploader__add-hint {
	margin-top: 4rpx;
	font-size: 22rpx;
	color: #ad8476;
}
</style>
