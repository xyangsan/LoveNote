<template>
	<view v-if="visible" class="love-image-preview">
		<swiper
			class="love-image-preview__swiper"
			:current="activeIndex"
			:duration="220"
			:circular="false"
			@change="handleSwiperChange"
		>
			<swiper-item
				v-for="(item, index) in safeImages"
				:key="index"
				class="love-image-preview__item"
			>
				<image
					class="love-image-preview__image"
					:src="resolveSrc(index)"
					mode="aspectFit"
					:show-menu-by-longpress="true"
					@load="handleImageLoad(index)"
					@error="handleImageError(index)"
					@click="handleClose"
				/>
			</swiper-item>
		</swiper>

		<view class="love-image-preview__top">
			<text v-if="safeImages.length > 1" class="love-image-preview__counter">{{ activeIndex + 1 }} / {{ safeImages.length }}</text>
			<view class="love-image-preview__close" @click.stop="handleClose">
				<text class="love-image-preview__close-icon">×</text>
			</view>
		</view>

		<view v-if="showOriginButton" class="love-image-preview__bottom">
			<view
				class="love-image-preview__origin"
				:class="{ 'love-image-preview__origin--loading': originLoading }"
				@click.stop="handleLoadOrigin"
			>
				<text class="love-image-preview__origin-text">{{ originLoading ? '原图加载中…' : '查看原图' }}</text>
			</view>
		</view>
	</view>
</template>

<script>
/**
 * 全屏图片预览（保留缩略图优先，按需加载原图）。
 *
 * 为什么不用 uni.previewImage：原生预览无法在左下角放「查看原图」这样的自定义控件，
 * 而且它只能拿到一份 url 列表，没法区分「缩略图 / 原图」。
 *
 * 用法：
 *   <love-image-preview :visible="previewVisible" :images="previewImageList"
 *       :current="previewCurrentIndex" @close="previewVisible = false" />
 *
 * images 结构：[{ thumbnailUrl: '', originalUrl: '' }]
 *   - 预览默认一律用 thumbnailUrl（没有才回落到 originalUrl），避免一打开就拉原图；
 *   - 只有点了「查看原图」才把当前这一张切到 originalUrl；
 *   - 原图与缩略图相同（或没有原图）时不显示按钮。
 */
export default {
	name: 'LoveImagePreview',
	props: {
		visible: {
			type: Boolean,
			default: false
		},
		images: {
			type: Array,
			default: () => []
		},
		// 打开时定位到第几张
		current: {
			type: Number,
			default: 0
		}
	},
	data() {
		return {
			activeIndex: 0,
			// 索引 → 是否已切到原图
			originLoadedMap: {},
			// 索引 → 原图是否还在加载
			originLoadingMap: {}
		}
	},
	computed: {
		safeImages() {
			const list = Array.isArray(this.images) ? this.images : []
			return list.map((item) => {
				const thumbnailUrl = String((item && item.thumbnailUrl) || '').trim()
				const originalUrl = String((item && item.originalUrl) || '').trim()
				return {
					thumbnailUrl: thumbnailUrl || originalUrl,
					originalUrl
				}
			})
		},
		currentImage() {
			return this.safeImages[this.activeIndex] || {}
		},
		hasOriginal() {
			const { thumbnailUrl, originalUrl } = this.currentImage
			return Boolean(originalUrl && originalUrl !== thumbnailUrl)
		},
		originLoaded() {
			return Boolean(this.originLoadedMap[this.activeIndex])
		},
		originLoading() {
			return Boolean(this.originLoadingMap[this.activeIndex])
		},
		showOriginButton() {
			return this.hasOriginal && !this.originLoaded
		}
	},
	watch: {
		visible: {
			immediate: true,
			handler(value) {
				if (!value) {
					return
				}
				// 每次打开都从缩略图开始，并定位到点进来的那张
				this.originLoadedMap = {}
				this.originLoadingMap = {}
				const maxIndex = Math.max(0, this.safeImages.length - 1)
				const nextIndex = Math.max(0, Math.min(maxIndex, Number(this.current) || 0))
				this.activeIndex = nextIndex
			}
		}
	},
	methods: {
		resolveSrc(index) {
			const item = this.safeImages[index] || {}
			if (this.originLoadedMap[index] && item.originalUrl) {
				return item.originalUrl
			}
			return item.thumbnailUrl || item.originalUrl || ''
		},
		handleSwiperChange(event = {}) {
			const nextIndex = Number(event.detail && event.detail.current)
			if (Number.isNaN(nextIndex) || nextIndex < 0) {
				return
			}
			this.activeIndex = nextIndex
		},
		handleLoadOrigin() {
			const index = this.activeIndex
			if (!this.hasOriginal || this.originLoading) {
				return
			}
			// 直接切到原图地址，靠 image 的 load 事件收尾（小程序没有现成的进度回调）
			this.originLoadingMap = Object.assign({}, this.originLoadingMap, { [index]: true })
			this.originLoadedMap = Object.assign({}, this.originLoadedMap, { [index]: true })
		},
		handleImageLoad(index) {
			if (!this.originLoadingMap[index]) {
				return
			}
			this.originLoadingMap = Object.assign({}, this.originLoadingMap, { [index]: false })
		},
		handleImageError(index) {
			if (!this.originLoadingMap[index]) {
				return
			}
			// 原图加载失败：回落到缩略图，并允许用户重试
			this.originLoadingMap = Object.assign({}, this.originLoadingMap, { [index]: false })
			this.originLoadedMap = Object.assign({}, this.originLoadedMap, { [index]: false })
			uni.showToast({
				title: '原图加载失败，请稍后重试',
				icon: 'none'
			})
		},
		handleClose() {
			this.$emit('close')
		}
	}
}
</script>

<style>
.love-image-preview {
	position: fixed;
	inset: 0;
	z-index: 9999;
	background: #000000;
}

.love-image-preview__swiper {
	width: 100%;
	height: 100%;
}

.love-image-preview__item {
	width: 100%;
	height: 100%;
}

.love-image-preview__image {
	width: 100%;
	height: 100%;
}

.love-image-preview__top {
	position: absolute;
	top: 0;
	right: 0;
	left: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: calc(20rpx + env(safe-area-inset-top)) 24rpx 20rpx;
	pointer-events: none;
}

.love-image-preview__counter {
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.86);
}

.love-image-preview__close {
	position: absolute;
	top: calc(16rpx + env(safe-area-inset-top));
	right: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.42);
	pointer-events: auto;
}

.love-image-preview__close-icon {
	font-size: 44rpx;
	line-height: 1;
	color: #ffffff;
}

.love-image-preview__bottom {
	position: absolute;
	right: 0;
	bottom: 0;
	left: 0;
	display: flex;
	justify-content: flex-start;
	padding: 24rpx 24rpx calc(28rpx + env(safe-area-inset-bottom));
	pointer-events: none;
}

.love-image-preview__origin {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 14rpx 30rpx;
	border-radius: 999rpx;
	background: rgba(0, 0, 0, 0.52);
	border: 1rpx solid rgba(255, 255, 255, 0.28);
	pointer-events: auto;
}

.love-image-preview__origin--loading {
	opacity: 0.7;
}

.love-image-preview__origin-text {
	font-size: 26rpx;
	line-height: 1.2;
	color: #ffffff;
}
</style>
