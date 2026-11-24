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
				<text class="love-media-uploader__add-text" v-if="addText">{{ addText }}</text>
				<text class="love-media-uploader__add-hint">{{ files.length }}/{{ safeMaxCount }}</text>
			</view>
		</view>

		<canvas
			v-if="thumbnailEnabled"
			:id="thumbnailCanvasId"
			:canvas-id="thumbnailCanvasId"
			class="love-media-uploader__thumbnail-canvas"
			:style="thumbnailCanvasStyle"
		></canvas>
	</view>
</template>

<script>
import { uploadFileWithModule } from '../../common/utils/file-upload.js'

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif']
const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'avi', 'wmv', 'flv', 'mkv', 'webm']
const DEFAULT_COMPRESS_OVER_SIZE = 10 * 1024 * 1024
// 缩略图画布边长（px）。短边固定缩放到 thumbnail 短边（默认 200），长边按原比例算，
// 画布要能装下长边，所以留 4 倍余量：200 短边 → 最长可到 800（≈4:1 的图）。
const THUMBNAIL_CANVAS_MAX_EDGE = 800

/**
 * 图片压缩的目标长边（px）。
 *
 * 只把 quality 调低是压不动的：4000×3000 的手机原图降到 quality 86 依旧两三兆 ——
 * 体积的大头是像素数量，不是质量参数。2560 足够详情页全屏看
 * （iPhone 15 Pro Max 屏幕长边也才 2796），再大纯属浪费用户流量。
 */
const DEFAULT_MAX_IMAGE_EDGE = 2560

/** 动图不能碰：compressImage 会把 gif 压成静态单帧，直接跳过（webp 静图居多，照常压） */
const ANIMATED_IMAGE_EXTS = ['gif']

/**
 * 并发上传数。
 * 原图上传是纯网络 IO，串行时 9 张图就是 9 个来回；2~3 路并发能明显压短总耗时，
 * 再往上意义不大 —— 反而抢带宽，还会同时挤一堆临时文件在内存里。
 */
const UPLOAD_CONCURRENCY = 3

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

function normalizeExistingFile(file = {}, index = 0, safeFileTypes = ['image']) {
	const path = String(file.path || file.url || file.fileURL || file.tempFileURL || '').trim()
	const fileId = String(file.fileId || file.fileID || file.file_id || '').trim()
	const thumbnailUrl = String(file.thumbnailUrl || file.thumbnail_url || file.poster || '').trim()
	const thumbnailFileId = String(file.thumbnailFileId || file.thumbnailFileID || file.thumbnail_file_id || '').trim()
	const thumbnailCloudPath = String(file.thumbnailCloudPath || file.thumbnail_cloud_path || '').trim()
	if (!path && !fileId) {
		return null
	}

	let mediaType = String(file.mediaType || file.fileType || '').toLowerCase()
	if (!mediaType || !safeFileTypes.includes(mediaType)) {
		mediaType = inferMediaTypeByPath(path) || 'image'
	}
	if (!safeFileTypes.includes(mediaType)) {
		return null
	}

	return {
		id: file.id || `existing_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
		path: path || fileId,
		size: Number(file.size || file.fileSize || 0),
		mediaType,
		mimeType: file.mimeType || inferMimeTypeByPath(path, mediaType),
		duration: Number(file.duration || 0),
		width: Number(file.width || 0),
		height: Number(file.height || 0),
		poster: file.poster || thumbnailUrl || '',
		status: file.status || 'success',
		cloudPath: file.cloudPath || '',
		url: String(file.url || file.fileURL || file.tempFileURL || path || '').trim(),
		fileId,
		thumbnailUrl,
		thumbnailFileId,
		thumbnailCloudPath,
		errorMsg: file.errorMsg || '',
		source: file.source || 'remote'
	}
}

function pickCropperProps(options = {}) {
	const propKeys = [
		'width',
		'height',
		'showBorder',
		'showGrid',
		'showAngle',
		'areaScale',
		'minScale',
		'maxScale',
		'checkRange',
		'backgroundColor',
		'bounce',
		'rotatable',
		'reverseRotatable',
		'gpu',
		'angleSize',
		'angleBorderWidth',
		'zIndex',
		'radius',
		'fileType',
		'delay',
		'navigation'
	]
	return propKeys.reduce((props, key) => {
		if (options[key] !== undefined) {
			props[key] = options[key]
		}
		return props
	}, {})
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
		// 图片压缩的目标长边（px）。长边超过它就按比例缩；传 0 退回「只降质量」的旧行为
		maxImageEdge: {
			type: Number,
			default: DEFAULT_MAX_IMAGE_EDGE
		},
		videoCompressQuality: {
			type: String,
			default: 'medium'
		},
		enableThumbnail: {
			type: Boolean,
			default: false
		},
		thumbnailOptions: {
			type: Object,
			default() {
				return {}
			}
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
			default: ''
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
		},
		cropOptions: {
			type: Object,
			default() {
				return {}
			}
		},
		exclusiveMediaTypes: {
			type: Boolean,
			default: false
		},
		maxImageCount: {
			type: Number,
			default: 9
		},
		maxVideoCount: {
			type: Number,
			default: 1
		},
		mixedMediaTip: {
			type: String,
			default: '不允许同时选择图片和视频'
		}
	},
	data() {
		return {
			files: [],
			uploading: false,
			thumbnailCanvasId: `love_media_thumbnail_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
			// 缩略图绘制队列：canvas 只有一个 id，多张并发画会互相覆盖（串图）
			thumbnailQueue: Promise.resolve()
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
		currentMediaType() {
			const first = this.files.find(item => item && item.mediaType)
			return first ? first.mediaType : ''
		},
		safeMaxImageCount() {
			const count = Number(this.maxImageCount || 0)
			return count > 0 ? count : 9
		},
		safeMaxVideoCount() {
			const count = Number(this.maxVideoCount || 0)
			return count > 0 ? count : 1
		},
		canAdd() {
			if (this.disabled || this.files.length >= this.safeMaxCount) {
				return false
			}
			if (!this.exclusiveMediaTypes) {
				return true
			}
			const currentType = this.currentMediaType
			if (currentType === 'video') {
				return this.files.filter(item => item.mediaType === 'video').length < this.safeMaxVideoCount
			}
			if (currentType === 'image') {
				return this.files.filter(item => item.mediaType === 'image').length < this.safeMaxImageCount
			}
			return true
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
		// 0 = 不做尺寸缩放（只降质量）
		compressMaxEdge() {
			const value = Number(this.maxImageEdge)
			if (!Number.isFinite(value) || value <= 0) {
				return 0
			}
			return Math.round(value)
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
		},
		normalizedCropOptions() {
			return this.cropOptions && typeof this.cropOptions === 'object' ? this.cropOptions : {}
		},
		cropEnabled() {
			return this.normalizedCropOptions.enabled === true || this.normalizedCropOptions.enable === true
		},
		normalizedThumbnailOptions() {
			return this.thumbnailOptions && typeof this.thumbnailOptions === 'object' ? this.thumbnailOptions : {}
		},
		thumbnailEnabled() {
			return this.enableThumbnail === true ||
				this.normalizedThumbnailOptions.enabled === true ||
				this.normalizedThumbnailOptions.enable === true
		},
		thumbnailSize() {
			return {
				width: this.getThumbnailOptionSize('width', 'thumbnailWidth'),
				height: this.getThumbnailOptionSize('height', 'thumbnailHeight')
			}
		},
		// 缩略图的「短边像素」：宽高两个配置里取小的那个，默认 200
		thumbnailShortEdge() {
			const size = this.thumbnailSize
			return Math.max(1, Math.min(size.width, size.height))
		},
		// 画布要装得下按原比例算出来的长边（短边 200 时，4:1 的图长边会到 800）
		thumbnailCanvasEdge() {
			return Math.max(THUMBNAIL_CANVAS_MAX_EDGE, this.thumbnailShortEdge * 4)
		},
		thumbnailCanvasStyle() {
			return {
				width: `${this.thumbnailCanvasEdge}px`,
				height: `${this.thumbnailCanvasEdge}px`
			}
		}
	},
	methods: {
		emitChange() {
			this.$emit('change', this.files.map(item => ({ ...item })))
		},
		getFiles() {
			return this.files.map(item => ({ ...item }))
		},
		setFiles(files = [], options = {}) {
			if (this.uploading) {
				return
			}
			const list = Array.isArray(files) ? files : []
			this.files = list
				.map((item, index) => normalizeExistingFile(item, index, this.safeFileTypes))
				.filter(Boolean)
				.slice(0, this.safeMaxCount)
			if (options.emit !== false) {
				this.emitChange()
			}
		},
		clear() {
			if (this.uploading) {
				return
			}
			this.files = []
			this.emitChange()
		},
		shouldCropFile(file = {}) {
			return this.cropEnabled && file.source === 'local' && file.mediaType === 'image'
		},
		openImageCropper(filePath = '') {
			return new Promise((resolve, reject) => {
				const path = String(filePath || '').trim()
				if (!path) {
					reject(new Error('图片路径不能为空'))
					return
				}
				uni.navigateTo({
					url: '/pages/public/image-cropper',
					success: (res) => {
						const eventChannel = res && res.eventChannel
						if (!eventChannel) {
							reject(new Error('裁剪页面初始化失败'))
							return
						}
						eventChannel.on('cropper:success', (event = {}) => {
							resolve(String(event.tempFilePath || '').trim())
						})
						eventChannel.on('cropper:cancel', () => {
							reject(new Error('crop-cancel'))
						})
						eventChannel.emit('cropper:init', {
							src: path,
							options: {
								zIndex: 1200,
								navigation: false,
								...pickCropperProps(this.normalizedCropOptions)
							}
						})
					},
					fail: (error) => {
						reject(error || new Error('打开裁剪页面失败'))
					}
				})
			})
		},
		async cropPickedFiles(files = []) {
			const nextFiles = []
			for (let i = 0; i < files.length; i += 1) {
				const current = files[i]
				if (!this.shouldCropFile(current)) {
					nextFiles.push(current)
					continue
				}

				const croppedPath = await this.openImageCropper(current.path)
				if (!croppedPath) {
					continue
				}
				const fileInfo = await this.getFileInfo(croppedPath)
				nextFiles.push({
					...current,
					path: croppedPath,
					size: Number((fileInfo && fileInfo.size) || current.size || 0),
					mimeType: inferMimeTypeByPath(croppedPath, 'image'),
					width: Number((fileInfo && fileInfo.width) || current.width || 0),
					height: Number((fileInfo && fileInfo.height) || current.height || 0)
				})
				this.$emit('crop', {
					file: { ...current },
					tempFilePath: croppedPath
				})
			}
			return nextFiles
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
				thumbnailUrl: '',
				thumbnailFileId: '',
				thumbnailCloudPath: '',
				errorMsg: '',
				source: 'local'
			}
		},
		getSelectableRemain() {
			if (!this.exclusiveMediaTypes) {
				return this.safeMaxCount - this.files.length
			}
			const currentType = this.currentMediaType
			if (currentType === 'video') {
				return Math.min(this.safeMaxCount - this.files.length, this.safeMaxVideoCount - this.files.filter(item => item.mediaType === 'video').length)
			}
			if (currentType === 'image') {
				return Math.min(this.safeMaxCount - this.files.length, this.safeMaxImageCount - this.files.filter(item => item.mediaType === 'image').length)
			}
			return this.safeMaxCount - this.files.length
		},
		validateExclusivePickedFiles(nextFiles = []) {
			if (!this.exclusiveMediaTypes) {
				return true
			}
			const pickedTypes = Array.from(new Set(nextFiles.map(item => item.mediaType).filter(Boolean)))
			const currentType = this.currentMediaType
			if (pickedTypes.length > 1 || (currentType && pickedTypes.length && pickedTypes[0] !== currentType)) {
				uni.showToast({
					title: this.mixedMediaTip || '不允许同时选择图片和视频',
					icon: 'none'
				})
				return false
			}
			const nextType = currentType || pickedTypes[0] || ''
			if (nextType === 'video' && this.files.filter(item => item.mediaType === 'video').length + nextFiles.filter(item => item.mediaType === 'video').length > this.safeMaxVideoCount) {
				uni.showToast({
					title: `视频只能发布 ${this.safeMaxVideoCount} 个`,
					icon: 'none'
				})
				return false
			}
			if (nextType === 'image' && this.files.filter(item => item.mediaType === 'image').length + nextFiles.filter(item => item.mediaType === 'image').length > this.safeMaxImageCount) {
				uni.showToast({
					title: `图片最多发布 ${this.safeMaxImageCount} 张`,
					icon: 'none'
				})
				return false
			}
			return true
		},
		chooseFiles() {
			if (this.disabled) {
				return
			}
			const remain = this.getSelectableRemain()
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
				success: async (res) => {
					const tempFiles = Array.isArray(res.tempFiles) ? res.tempFiles : []
					let unsupportedCount = 0
					let oversizeCount = 0
					let nextFiles = tempFiles
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

					if (!this.validateExclusivePickedFiles(nextFiles)) {
						return
					}

					try {
						nextFiles = await this.cropPickedFiles(nextFiles)
					} catch (error) {
						if (error && error.message !== 'crop-cancel') {
							uni.showToast({
								title: error.message || '图片裁剪失败',
								icon: 'none'
							})
						}
						return
					}

					if (!nextFiles.length) {
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
		runCompressImage(options = {}) {
			return new Promise((resolve, reject) => {
				uni.compressImage({
					...options,
					success: (res) => {
						resolve(res || {})
					},
					fail: (error) => {
						reject(error || new Error('图片压缩失败'))
					}
				})
			})
		},
		/**
		 * 算压缩目标尺寸：返回 null 表示不用缩（尺寸本来就达标 / 读不到尺寸 / 没开缩放）。
		 */
		async resolveCompressedImageSize(filePath = '') {
			const maxEdge = this.compressMaxEdge
			if (!maxEdge) {
				return null
			}
			let imageInfo = null
			try {
				imageInfo = await this.getImageInfo(filePath)
			} catch (error) {
				console.warn('读取图片尺寸失败，跳过缩放（只降质量）', error)
				return null
			}
			const width = Number((imageInfo && imageInfo.width) || 0)
			const height = Number((imageInfo && imageInfo.height) || 0)
			if (width <= 0 || height <= 0) {
				return null
			}
			const longEdge = Math.max(width, height)
			if (longEdge <= maxEdge) {
				return null
			}
			const scale = maxEdge / longEdge
			return {
				width: Math.max(1, Math.round(width * scale)),
				height: Math.max(1, Math.round(height * scale))
			}
		},
		/**
		 * 图片压缩：降质量 + 缩分辨率。
		 *
		 * 尺寸走 uni.compressImage 的 compressedWidth / compressedHeight（wx 2.26+ 起支持），
		 * 只传长边对应的那一个，让底层按比例缩放 —— 两个都传会被当成目标宽高直接拉伸变形。
		 * 不认这两个参数的端会失败，兜底退回「只降质量」，跟旧行为一致。
		 */
		async compressImageFile(filePath = '') {
			if (!filePath || typeof uni.compressImage !== 'function') {
				throw new Error('当前环境不支持图片压缩')
			}
			const quality = Math.max(1, Math.min(100, Number(this.imageCompressQuality || 80)))
			const target = await this.resolveCompressedImageSize(filePath)
			const options = {
				src: filePath,
				quality
			}
			if (target) {
				if (target.width >= target.height) {
					options.compressedWidth = target.width
				} else {
					options.compressedHeight = target.height
				}
			}

			try {
				return await this.runCompressImage(options)
			} catch (error) {
				if (!options.compressedWidth && !options.compressedHeight) {
					throw error
				}
				console.warn('带尺寸压缩失败，退回只降质量', error)
				return this.runCompressImage({
					src: filePath,
					quality
				})
			}
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
		isAnimatedImage(filePath = '') {
			const ext = String(filePath || '').split('?')[0].split('.').pop().toLowerCase()
			return ANIMATED_IMAGE_EXTS.includes(ext)
		},
		async prepareFileForUpload(file = {}) {
			const originPath = String(file.path || '')
			const originSize = Number(file.size || 0)
			const untouched = {
				path: originPath,
				size: originSize,
				width: Number(file.width || 0),
				height: Number(file.height || 0),
				compressed: false
			}
			if (!originPath) {
				return {
					...untouched,
					path: '',
					size: 0
				}
			}

			// 动图压不得：gif 会被压成静态单帧
			if (this.isAnimatedImage(originPath)) {
				return untouched
			}

			// 体积没超阈值就不折腾：像素数量同样是这个量级，再压收益很低
			if (!this.useCompression || originSize <= this.compressThreshold) {
				return untouched
			}

			try {
				if (file.mediaType === 'image') {
					const compressRes = await this.compressImageFile(originPath)
					const compressedPath = String(compressRes.tempFilePath || compressRes.filePath || '')
					if (!compressedPath) {
						throw new Error('图片压缩结果无效')
					}
					const info = await this.getFileInfo(compressedPath)
					const compressedSize = Number((info && info.size) || 0)
					// 大小都读不到就不冒险用了，宁可传原图
					if (!compressedSize) {
						return untouched
					}
					// 压完反而更大（小图重编码 / 原图已是高压缩比）→ 保留原图
					if (compressedSize >= originSize) {
						return untouched
					}
					// 压缩后尺寸要写回，服务端存的是这个宽高（列表排版依赖它算比例）
					const compressedInfo = await this.getImageInfo(compressedPath).catch(() => null)
					return {
						path: compressedPath,
						size: compressedSize,
						width: Number((compressedInfo && compressedInfo.width) || file.width || 0),
						height: Number((compressedInfo && compressedInfo.height) || file.height || 0),
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
						width: Number(file.width || 0),
						height: Number(file.height || 0),
						compressed: compressedPath !== originPath
					}
				}
			} catch (error) {
				console.warn('prepareFileForUpload compress failed, fallback to original file', error)
			}

			return untouched
		},
		shouldCreateThumbnail(file = {}) {
			if (!this.thumbnailEnabled) {
				return false
			}
			const mediaType = String(file.mediaType || '').toLowerCase()
			if (mediaType === 'image') {
				return this.normalizedThumbnailOptions.image !== false
			}
			if (mediaType === 'video') {
				return this.normalizedThumbnailOptions.video !== false
			}
			return false
		},
		getThumbnailImageQuality() {
			const options = this.normalizedThumbnailOptions
			const value = Number(
				options.imageQuality !== undefined
					? options.imageQuality
					: (options.quality !== undefined ? options.quality : 45)
			)
			if (Number.isNaN(value)) {
				return 45
			}
			return Math.max(1, Math.min(100, value))
		},
		getThumbnailOptionSize(primaryKey = '', fallbackKey = '') {
			const options = this.normalizedThumbnailOptions
			const value = Number(
				options[primaryKey] !== undefined
					? options[primaryKey]
					: (options[fallbackKey] !== undefined ? options[fallbackKey] : 200)
			)
			if (Number.isNaN(value) || value <= 0) {
				return 200
			}
			return Math.round(value)
		},
		getThumbnailFileType() {
			const value = String(this.normalizedThumbnailOptions.fileType || '').trim().toLowerCase()
			return ['jpg', 'jpeg', 'png'].includes(value) ? (value === 'jpeg' ? 'jpg' : value) : 'jpg'
		},
		getThumbnailUploadModule(file = {}, modulePath = '') {
			const options = this.normalizedThumbnailOptions
			if (file.mediaType === 'image' && options.imageSavePath) {
				return String(options.imageSavePath).trim()
			}
			if (file.mediaType === 'video' && options.videoSavePath) {
				return String(options.videoSavePath).trim()
			}
			if (options.savePath) {
				return String(options.savePath).trim()
			}
			const typeFolder = file.mediaType === 'video' ? 'videos' : 'images'
			return `${modulePath}/thumbnails/${typeFolder}`
		},
		getThumbnailUploadPrefix(file = {}, prefix = '') {
			const options = this.normalizedThumbnailOptions
			if (file.mediaType === 'image' && options.imagePrefix) {
				return String(options.imagePrefix).trim()
			}
			if (file.mediaType === 'video' && options.videoPrefix) {
				return String(options.videoPrefix).trim()
			}
			if (options.prefix) {
				return String(options.prefix).trim()
			}
			return `${prefix}-thumb`
		},
		getImageInfo(filePath = '') {
			return new Promise((resolve, reject) => {
				if (!filePath || typeof uni.getImageInfo !== 'function') {
					reject(new Error('当前环境不支持读取图片信息'))
					return
				}
				uni.getImageInfo({
					src: filePath,
					success: (res) => resolve(res || {}),
					fail: (error) => reject(error || new Error('读取图片信息失败'))
				})
			})
		},
		drawThumbnailToCanvas(imageInfo = {}, sourcePath = '') {
			return new Promise((resolve, reject) => {
				if (typeof uni.createCanvasContext !== 'function' || typeof uni.canvasToTempFilePath !== 'function') {
					reject(new Error('当前环境不支持生成缩略图'))
					return
				}
				const sourceWidth = Number(imageInfo.width || 0)
				const sourceHeight = Number(imageInfo.height || 0)
				const shortEdge = this.thumbnailShortEdge
				const canvasEdge = this.thumbnailCanvasEdge
				if (!sourcePath || sourceWidth <= 0 || sourceHeight <= 0 || shortEdge <= 0) {
					reject(new Error('缩略图尺寸无效'))
					return
				}

				// ⚠️ 统一按「短边对齐」算尺寸：短边固定缩放到 thumbnail 短边（默认 200），
				// 长边按原图比例算出来。画面不裁剪、不补边、不改比例。
				// 列表用 aspectFill 展示，短边决定清晰度；只让长边 ≤ 200 会让竖图/截图变糊。
				// 原图短边不足目标值时保持原尺寸，避免把小图放大成糊图（体积反而更大）。
				const minSide = Math.min(sourceWidth, sourceHeight)
				let scale = shortEdge / minSide
				if (scale > 1) {
					scale = 1
				}
				let targetWidth = Math.max(1, Math.round(sourceWidth * scale))
				let targetHeight = Math.max(1, Math.round(sourceHeight * scale))
				// 极端比例（长边超出画布）等比回缩到画布内，保证能完整画出来
				const longEdge = Math.max(targetWidth, targetHeight)
				if (longEdge > canvasEdge) {
					const shrink = canvasEdge / longEdge
					targetWidth = Math.max(1, Math.round(targetWidth * shrink))
					targetHeight = Math.max(1, Math.round(targetHeight * shrink))
				}
				const fileType = this.getThumbnailFileType()
				const context = uni.createCanvasContext(this.thumbnailCanvasId, this)

				context.clearRect(0, 0, canvasEdge, canvasEdge)
				// jpg 不支持透明通道，透明 png 直接导出会变黑块：先只把「内容区域」铺白，
				// 不铺整块画布，所以不会多出白边。
				if (fileType !== 'png') {
					context.setFillStyle('#ffffff')
					context.fillRect(0, 0, targetWidth, targetHeight)
				}
				context.drawImage(sourcePath, 0, 0, targetWidth, targetHeight)
				let exported = false
				const exportCanvas = () => {
					if (exported) {
						return
					}
					exported = true
					uni.canvasToTempFilePath({
						canvasId: this.thumbnailCanvasId,
						x: 0,
						y: 0,
						width: targetWidth,
						height: targetHeight,
						destWidth: targetWidth,
						destHeight: targetHeight,
						fileType,
						quality: this.getThumbnailImageQuality() / 100,
						success: (res) => {
							const nextPath = String(res && (res.tempFilePath || res.filePath) || '').trim()
							nextPath ? resolve(nextPath) : reject(new Error('缩略图生成结果无效'))
						},
						fail: (error) => reject(error || new Error('缩略图生成失败'))
					}, this)
				}
				context.draw(false, exportCanvas)
				setTimeout(exportCanvas, 120)
			})
		},
		compressImageThumbnailFallback(filePath = '') {
			return new Promise((resolve) => {
				const sourcePath = String(filePath || '').trim()
				if (!sourcePath || typeof uni.compressImage !== 'function') {
					resolve(sourcePath)
					return
				}
				uni.compressImage({
					src: sourcePath,
					quality: this.getThumbnailImageQuality(),
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
		async createImageThumbnailFile(filePath = '') {
			const sourcePath = String(filePath || '').trim()
			if (!sourcePath) {
				return ''
			}
			try {
				const imageInfo = await this.getImageInfo(sourcePath)
				const drawablePath = String(imageInfo.path || sourcePath).trim()
				return await this.drawThumbnailToCanvas(imageInfo, drawablePath)
			} catch (error) {
				console.warn('create image thumbnail by canvas failed, fallback to compressImage', error)
				return this.compressImageThumbnailFallback(sourcePath)
			}
		},
		async buildThumbnailSource(file = {}) {
			if (file.mediaType === 'image') {
				return this.createImageThumbnailFile(file.path)
			}
			if (file.mediaType === 'video') {
				return this.createImageThumbnailFile(String(file.poster || '').trim())
			}
			return ''
		},
		/**
		 * 缩略图任务排队执行。
		 * 并发上传原图时，多张图会同时走到「画 canvas → 导出临时文件」，
		 * 而画布只有一个 id，谁后画谁覆盖，导出的图会串成别人的照片。
		 * 这里用一条 Promise 链把绘制/导出串起来，上传本身仍然并发。
		 */
		enqueueThumbnailTask(task) {
			const run = () => task()
			const next = this.thumbnailQueue.then(run, run)
			// 队列自身要吞掉失败，否则一张图缩略图失败会卡死后面所有图
			this.thumbnailQueue = next.then(() => {}, () => {})
			return next
		},
		async uploadThumbnailForFile(file = {}, modulePath = '', prefix = '') {
			if (!this.shouldCreateThumbnail(file)) {
				return {
					thumbnailUrl: '',
					thumbnailFileId: '',
					thumbnailCloudPath: ''
				}
			}

			try {
				const thumbnailSource = await this.enqueueThumbnailTask(() => this.buildThumbnailSource(file))
				if (!thumbnailSource) {
					return {
						thumbnailUrl: '',
						thumbnailFileId: '',
						thumbnailCloudPath: ''
					}
				}
				const uploadRes = await uploadFileWithModule({
					filePath: thumbnailSource,
					module: this.getThumbnailUploadModule(file, modulePath),
					prefix: this.getThumbnailUploadPrefix(file, prefix),
					fileType: 'image'
				})
				return {
					thumbnailUrl: uploadRes.fileURL || '',
					thumbnailFileId: uploadRes.fileID || '',
					thumbnailCloudPath: uploadRes.cloudPath || ''
				}
			} catch (error) {
				console.warn('upload thumbnail failed', error)
				this.$emit('thumbnail-error', {
					file: { ...file },
					error
				})
				return {
					thumbnailUrl: '',
					thumbnailFileId: '',
					thumbnailCloudPath: ''
				}
			}
		},
		/**
		 * 这个文件是不是已经躺在云存储里了。
		 * 回填的既有媒体（source: remote）算，上一次上传成功的也算。
		 *
		 * ⚠️ 上传成功后 source 仍然是 local，只看 source 会把整批重传一遍 ——
		 * 「发布失败后重试」正是踩在这里：云存储凭空多出一整套孤儿文件。
		 */
		isUploadedFile(file = {}) {
			if (!file.url && !file.fileId) {
				return false
			}
			return file.source === 'remote' || file.status === 'success'
		},
		/** 把内部文件对象摊成对外的上传结果（提交表单只认这几个字段） */
		toUploadResult(file = {}) {
			const url = String(file.url || '').trim()
			const mediaUrl = url || String(file.path || '').trim()
			return {
				path: file.path,
				url: mediaUrl,
				fileId: String(file.fileId || '').trim(),
				cloudPath: file.cloudPath || '',
				mediaType: file.mediaType,
				mimeType: file.mimeType || '',
				fileSize: file.size || 0,
				duration: file.duration || 0,
				width: file.width || 0,
				height: file.height || 0,
				thumbnailUrl: file.thumbnailUrl || (file.mediaType === 'video' ? '' : mediaUrl),
				thumbnailFileId: file.thumbnailFileId || '',
				thumbnailCloudPath: file.thumbnailCloudPath || '',
				poster: file.poster || ''
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
			// 拍快照：并发时 this.files 会被多处 splice，按下标写回才不会串位
			const snapshot = this.files.slice()
			const total = snapshot.length
			// 结果按下标占位再过滤，保证 success / failed 的顺序与用户选图顺序一致
			const successSlots = new Array(total).fill(null)
			const failedSlots = new Array(total).fill(null)
			let finished = 0

			const emitProgress = () => {
				finished += 1
				this.$emit('progress', {
					current: finished,
					total,
					success: successSlots.filter(Boolean).length,
					failed: failedSlots.filter(Boolean).length
				})
			}

			const uploadOne = async (file, index) => {
				if (!file) {
					emitProgress()
					return
				}

				if (this.isUploadedFile(file)) {
					successSlots[index] = this.toUploadResult(file)
					emitProgress()
					return
				}

				this.files.splice(index, 1, {
					...file,
					status: 'uploading',
					errorMsg: ''
				})

				try {
					const uploadSource = await this.prepareFileForUpload(file)
					const uploadRes = await uploadFileWithModule({
						filePath: uploadSource.path || file.path,
						module: modulePath,
						prefix,
						fileType: file.mediaType === 'video' ? 'video' : 'image'
					})
					const thumbnailRes = await this.uploadThumbnailForFile(file, modulePath, prefix)
					const thumbnailUrl = thumbnailRes.thumbnailUrl ||
						(file.mediaType === 'image' ? (uploadRes.fileURL || '') : '')

					const nextItem = {
						...file,
						size: Number(uploadSource.size || file.size || 0),
						// 压缩会改尺寸，这里必须用压缩后的真实宽高（服务端按它算列表排版比例）
						width: Number(uploadSource.width || file.width || 0),
						height: Number(uploadSource.height || file.height || 0),
						status: 'success',
						cloudPath: uploadRes.cloudPath || '',
						url: uploadRes.fileURL || '',
						fileId: uploadRes.fileID || '',
						thumbnailUrl,
						thumbnailFileId: thumbnailRes.thumbnailFileId || '',
						thumbnailCloudPath: thumbnailRes.thumbnailCloudPath || '',
						errorMsg: ''
					}
					this.files.splice(index, 1, nextItem)
					successSlots[index] = this.toUploadResult(nextItem)
				} catch (error) {
					const failedItem = {
						...file,
						status: 'error',
						errorMsg: error && error.message ? error.message : '上传失败'
					}
					this.files.splice(index, 1, failedItem)
					failedSlots[index] = failedItem
					this.$emit('error', {
						file: { ...failedItem },
						error
					})
				}

				emitProgress()
			}

			try {
				// 固定并发池：worker 领一个下标就往下走，跑完再领下一个
				let cursor = 0
				const workerCount = Math.min(UPLOAD_CONCURRENCY, total)
				const workers = []
				for (let i = 0; i < workerCount; i += 1) {
					workers.push((async () => {
						while (cursor < total) {
							const index = cursor
							cursor += 1
							await uploadOne(snapshot[index], index)
						}
					})())
				}
				await Promise.all(workers)
			} finally {
				this.uploading = false
				const successList = successSlots.filter(Boolean)
				const failedList = failedSlots.filter(Boolean)
				this.$emit('uploaded', {
					success: [...successList],
					failed: [...failedList],
					total
				})
				this.emitChange()
			}

			return successSlots.filter(Boolean)
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
	color: rgba(245, 237, 228, 0.48);
}

.love-media-uploader__grid {
	display: flex;
	flex-wrap: wrap;
	margin: 0 -8rpx;
}

.love-media-uploader__item {
	position: relative;
	box-sizing: border-box;
	margin: 0 8rpx 16rpx;
	border-radius: 22rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.10);
	overflow: hidden;
	background: #1B1512;
}

.love-media-uploader__image,
.love-media-uploader__video {
	width: 100%;
	height: 100%;
}

.love-media-uploader__type {
	position: absolute;
	left: 10rpx;
	bottom: 10rpx;
	padding: 4rpx 12rpx;
	border-radius: 12rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.12);
	background: rgba(17, 13, 11, 0.78);
	display: flex;
	justify-content: center;
	align-items: center;
}

.love-media-uploader__type-text {
	font-size: 20rpx;
	color: var(--noir-text-strong);
}

.love-media-uploader__remove {
	position: absolute;
	top: 10rpx;
	right: 10rpx;
	width: 42rpx;
	height: 42rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1rpx solid rgba(255, 255, 255, 0.14);
	background: rgba(17, 13, 11, 0.74);
	border-radius: 50%;
}

.love-media-uploader__remove-icon {
	font-size: 26rpx;
	line-height: 1;
	color: var(--noir-text-strong);
}

.love-media-uploader__mask,
.love-media-uploader__error {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.love-media-uploader__mask {
	background: rgba(17, 13, 11, 0.55);
}

.love-media-uploader__success {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(132, 190, 156, 0.86);
}

.love-media-uploader__success-icon,
.love-media-uploader__error-icon {
	font-size: 44rpx;
	color: var(--noir-text-warm);
	font-weight: 700;
}

.love-media-uploader__success-icon {
	font-size: 26rpx;
	line-height: 1;
}

.love-media-uploader__error {
	background: rgba(226, 100, 63, 0.86);
}

.love-media-uploader__item--add {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.03);
	border: 1.5rpx dashed rgba(216, 176, 140, 0.36);
}

.love-media-uploader__add-icon {
	font-size: 46rpx;
	line-height: 1;
	color: rgba(216, 176, 140, 0.84);
}

.love-media-uploader__add-icon-image {
	width: 52rpx;
	height: 52rpx;
}

.love-media-uploader__add-text {
	margin-top: 8rpx;
	font-size: 22rpx;
	color: rgba(234, 212, 188, 0.82);
}

.love-media-uploader__add-hint {
	margin-top: 6rpx;
	font-family: "SF Mono", "Consolas", monospace;
	font-size: 20rpx;
	color: rgba(216, 176, 140, 0.52);
}

.love-media-uploader__thumbnail-canvas {
	position: fixed;
	left: -9999px;
	top: -9999px;
	opacity: 0;
	pointer-events: none;
}

</style>
