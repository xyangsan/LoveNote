<template>
	<view
		:id="wrapperDomId"
		class="love-auto-video"
		:style="customStyle"
		:data-video-id="videoDomId"
		@click.stop="openFullscreen"
	>
		<video
			:id="videoDomId"
			class="love-auto-video__video"
			:src="src"
			:poster="poster"
			:object-fit="objectFit"
			:autoplay="false"
			:muted="muted"
			:controls="isFullscreen && fullscreenControls"
			:show-play-btn="isFullscreen"
			:show-center-play-btn="isFullscreen"
			:show-fullscreen-btn="false"
			:enable-progress-gesture="isFullscreen"
			@fullscreenchange="handleFullscreenChange"
			@loadedmetadata="handleVideoReady"
			@error="handleVideoError"
			@click.stop="openFullscreen"
		></video>
	</view>
</template>

<script>
function normalizeDomId(value = '') {
	const raw = String(value || '').trim()
	const safeValue = raw.replace(/[^\w-]/g, '_')
	return /^[A-Za-z_]/.test(safeValue) ? safeValue : `v_${safeValue || 'auto_video'}`
}

export default {
	name: 'LoveAutoVideo',
	props: {
		videoId: {
			type: String,
			default: ''
		},
		src: {
			type: String,
			default: ''
		},
		poster: {
			type: String,
			default: ''
		},
		customStyle: {
			type: [Object, String],
			default: () => ({})
		},
		objectFit: {
			type: String,
			default: 'contain'
		},
		fullscreenDirection: {
			type: Number,
			default: 0
		},
		fullscreenControls: {
			type: Boolean,
			default: true
		}
	},
	data() {
		return {
			localVideoId: `love_auto_video_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
			videoContext: null,
			isFullscreen: false,
			muted: true,
			playTimer: null
		}
	},
	computed: {
		videoDomId() {
			return normalizeDomId(this.videoId || this.localVideoId)
		},
		wrapperDomId() {
			return `${this.videoDomId}_wrap`
		}
	},
	watch: {
		src() {
			this.pause()
		}
	},
	beforeDestroy() {
		this.pause()
	},
	unmounted() {
		this.pause()
	},
	methods: {
		getVideoContext() {
			if (!this.videoContext) {
				this.videoContext = uni.createVideoContext(this.videoDomId, this)
			}
			return this.videoContext
		},
		handleVideoReady() {
			this.$emit('ready')
		},
		clearPendingPlay() {
			if (this.playTimer) {
				clearTimeout(this.playTimer)
				this.playTimer = null
			}
		},
		playVideo(delay = 0) {
			this.clearPendingPlay()
			this.playTimer = setTimeout(() => {
				this.playTimer = null
				if (!this.src) {
					return
				}
				const context = this.getVideoContext()
				if (!context || typeof context.play !== 'function') {
					return
				}
				try {
					const playResult = context.play()
					if (playResult && typeof playResult.catch === 'function') {
						playResult.catch(() => {})
					}
				} catch (error) {
					console.warn('video play failed', error)
				}
			}, delay)
		},
		playMuted() {
			if (!this.src || this.isFullscreen) {
				return
			}
			this.muted = true
			this.$nextTick(() => this.playVideo(80))
		},
		pause() {
			this.clearPendingPlay()
			const context = this.getVideoContext()
			if (this.isFullscreen && context && typeof context.exitFullScreen === 'function') {
				context.exitFullScreen()
			}
			if (context && typeof context.pause === 'function') {
				context.pause()
			}
			this.muted = true
		},
		exitFullscreen() {
			const context = this.getVideoContext()
			if (context && typeof context.exitFullScreen === 'function') {
				context.exitFullScreen()
			}
		},
		playFullscreen() {
			if (!this.src || this.isFullscreen) {
				return
			}
			this.clearPendingPlay()
			this.muted = false
			this.isFullscreen = true
			this.$nextTick(() => {
				const context = this.getVideoContext()
				if (context && typeof context.requestFullScreen === 'function') {
					context.requestFullScreen({
						direction: this.fullscreenDirection
					})
				}
			})
		},
		openFullscreen() {
			this.playFullscreen()
		},
		handleFullscreenChange(event = {}) {
			const detail = event.detail || {}
			const fullscreen = Boolean(detail.fullScreen || detail.fullscreen)
			this.isFullscreen = fullscreen
			this.muted = !fullscreen
			this.$emit('fullscreenchange', {
				fullscreen
			})
			if (fullscreen) {
				this.playVideo(80)
				return
			}
			this.clearPendingPlay()
			this.muted = true
			this.$emit('fullscreenclose')
		},
		handleVideoError(event = {}) {
			this.$emit('error', event)
		}
	}
}
</script>

<style>
.love-auto-video {
	display: inline-block;
	overflow: hidden;
	border-radius: 8rpx;
	background: #000000;
	vertical-align: top;
}

.love-auto-video__video {
	display: block;
	width: 100%;
	height: 100%;
	border-radius: inherit;
}
</style>
