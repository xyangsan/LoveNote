<template>
	<view class="image-cropper-page">
		<qf-image-cropper
			v-if="cropperVisible"
			v-bind="cropperOptions"
			:src="cropperSrc"
			:choosable="false"
			@crop="handleCrop"
		>
			<view class="cropper-cancel" :style="cancelStyle" @click="cancelCrop">取消</view>
		</qf-image-cropper>
	</view>
</template>

<script>
function pickOptions(options = {}) {
	const source = options && typeof options === 'object' ? options : {}
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
		if (source[key] !== undefined) {
			props[key] = source[key]
		}
		return props
	}, {})
}

export default {
	data() {
		return {
			cropperSrc: '',
			cropperOptions: {
				zIndex: 1200,
				navigation: false
			},
			cropperVisible: false,
			settled: false,
			eventChannel: null
		}
	},
	computed: {
		cancelStyle() {
			const zIndex = Number(this.cropperOptions && this.cropperOptions.zIndex || 1200)
			return {
				zIndex: Number.isNaN(zIndex) ? 1300 : zIndex + 100
			}
		}
	},
	onLoad(options = {}) {
		this.eventChannel = this.getOpenerEventChannel && this.getOpenerEventChannel()
		if (this.eventChannel && typeof this.eventChannel.on === 'function') {
			this.eventChannel.on('cropper:init', this.initCropper)
		}

		if (options.src) {
			let cropOptions = {}
			try {
				cropOptions = options.cropOptions ? JSON.parse(decodeURIComponent(options.cropOptions)) : {}
			} catch (error) {
				cropOptions = {}
			}
			this.initCropper({
				src: decodeURIComponent(options.src || ''),
				options: cropOptions
			})
		}
	},
	onUnload() {
		if (!this.settled) {
			this.emitCancel()
		}
	},
	methods: {
		initCropper(payload = {}) {
			const src = String(payload.src || '').trim()
			if (!src) {
				this.cancelCrop()
				return
			}
			this.cropperVisible = false
			this.cropperSrc = ''
			this.cropperOptions = {
				zIndex: 1200,
				navigation: false,
				...pickOptions(payload.options)
			}
			this.$nextTick(() => {
				this.cropperSrc = src
				this.cropperVisible = true
			})
		},
		emitCancel() {
			this.settled = true
			if (this.eventChannel && typeof this.eventChannel.emit === 'function') {
				this.eventChannel.emit('cropper:cancel')
			}
		},
		cancelCrop() {
			this.emitCancel()
			uni.navigateBack()
		},
		handleCrop(event = {}) {
			const tempFilePath = String(event.tempFilePath || '').trim()
			this.settled = true
			if (this.eventChannel && typeof this.eventChannel.emit === 'function') {
				this.eventChannel.emit('cropper:success', {
					tempFilePath
				})
			}
			uni.navigateBack()
		}
	}
}
</script>

<style>
page {
	background: #000;
}

.image-cropper-page {
	min-height: 100vh;
	background: #000;
}

.cropper-cancel {
	position: fixed;
	left: 28rpx;
	top: 28rpx;
	min-width: 104rpx;
	height: 56rpx;
	padding: 0 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 28rpx;
	background: rgba(0, 0, 0, 0.46);
	color: #fff;
	font-size: 26rpx;
}
</style>
