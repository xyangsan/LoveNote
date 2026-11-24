<template>
	<view class="image-viewer">
		<swiper
			v-if="imageList.length"
			class="image-viewer__swiper"
			:current="activeIndex"
			:duration="220"
			:circular="false"
			@change="handleSwiperChange"
		>
			<swiper-item
				v-for="(item, index) in imageList"
				:key="index"
				class="image-viewer__item"
			>
				<!-- 缩略图先顶上，原图加载完再盖掉它，避免大图白屏 -->
				<image
					v-if="showThumbnailLayer(index)"
					class="image-viewer__image"
					:src="item.thumbnailUrl"
					mode="aspectFit"
					:show-menu-by-longpress="true"
					@click="handleClose"
				/>

				<image
					v-if="showOriginLayer(index)"
					class="image-viewer__image image-viewer__image--origin"
					:src="item.originalUrl"
					mode="aspectFit"
					:show-menu-by-longpress="true"
					@load="handleOriginLoad(index)"
					@error="handleOriginError(index)"
					@click="handleClose"
				/>

				<view v-if="showLoading(index)" class="image-viewer__loading">
					<view class="image-viewer__loading-ring"></view>
				</view>
			</swiper-item>
		</swiper>

		<view class="image-viewer__top">
			<view class="image-viewer__close" @click.stop="handleClose">
				<text class="image-viewer__close-icon">×</text>
			</view>
			<text v-if="imageList.length > 1" class="image-viewer__counter">{{ activeIndex + 1 }} / {{ imageList.length }}</text>
		</view>

		<view v-if="!imageList.length" class="image-viewer__empty">
			<text class="image-viewer__empty-text">{{ '图片已失效，请返回重新打开' }}</text>
		</view>
	</view>
</template>

<script>
/**
 * 图片查看页：从列表点缩略图进来，这里直接展示原图。
 *
 * 数据不落 URL（会超长），由列表页通过 openImageViewer() 暂存、本页 onLoad 消费，
 * 详见 common/utils/image-viewer.js。
 *
 * 加载策略：
 *   1. 原图层是主视图，缩略图只作为原图就绪前的占位；原图没加载完，图上一直挂 loading 图标；
 *   2. 当前这张（含相邻一张）加载完就顺着列表往后推下一张 —— 还没滑到的图在后台预加载，
 *      滑过去时原图已经就绪，不用再等；
 *   3. 同时在途的原图最多 PRELOAD_INFLIGHT 张，避免一进页面就把 9 张大图全拉下来；
 *   4. 原图加载失败则停在缩略图上，不弹「查看原图」之类的按钮 —— 进来就是原图。
 */
import { consumeImageViewerPayload } from '@/common/utils/image-viewer.js'

// 预加载并发上限：当前这张 + 下一张
const PRELOAD_INFLIGHT = 2

export default {
	data() {
		return {
			imageList: [],
			activeIndex: 0,
			// 索引 → 原图是否已加载完成
			originLoadedMap: {},
			// 索引 → 原图是否加载失败（失败后不再重试，保留缩略图兜底）
			originFailedMap: {},
			// 索引 → 是否已放行渲染原图层（没放行的不会发起请求，靠它控制预加载节奏）
			preloadMap: {},
			// 下一个待预加载的索引
			preloadCursor: 0
		}
	},
	onLoad() {
		const payload = consumeImageViewerPayload()
		const images = payload && Array.isArray(payload.images) ? payload.images : []
		this.imageList = images
		const maxIndex = Math.max(0, images.length - 1)
		this.activeIndex = Math.max(0, Math.min(maxIndex, Number(payload && payload.current) || 0))

		this.preloadCursor = this.activeIndex + 1
		this.ensurePreloadWindow()
	},
	methods: {
		/** 放行某个索引的原图层（放行后 swiper-item 里才会渲染原图 → 触发下载） */
		markPreload(index) {
			if (index < 0 || index >= this.imageList.length) {
				return false
			}
			if (this.preloadMap[index] || this.originFailedMap[index]) {
				return false
			}
			this.preloadMap = Object.assign({}, this.preloadMap, {
				[index]: true
			})
			return true
		},
		/** 还在下载中的原图数量（放行了但既没 load 也没 error） */
		pendingPreloadCount() {
			return Object.keys(this.preloadMap).filter((key) => {
				const index = Number(key)
				return !this.originLoadedMap[index] && !this.originFailedMap[index]
			}).length
		},
		/** 当前页 + 相邻页先就位，保证滑动手感 */
		ensurePreloadWindow() {
			this.markPreload(this.activeIndex)
			this.markPreload(this.activeIndex + 1)
			this.advancePreload()
		},
		/**
		 * 顺着列表往后补一张预加载。
		 * 每张加载完（load / error）才推下一张，所以「没滑到的图」是一张张补上来的，
		 * 不会一进页面就并发拉满。
		 */
		advancePreload() {
			if (this.preloadCursor < this.activeIndex) {
				this.preloadCursor = this.activeIndex
			}
			if (this.pendingPreloadCount() >= PRELOAD_INFLIGHT) {
				return
			}
			const total = this.imageList.length
			for (let index = this.preloadCursor; index < total; index += 1) {
				this.preloadCursor = index + 1
				if (this.preloadMap[index] || this.originFailedMap[index]) {
					continue
				}
				this.markPreload(index)
				return
			}
		},
		showThumbnailLayer(index) {
			const item = this.imageList[index] || {}
			if (!item.thumbnailUrl || item.thumbnailUrl === item.originalUrl) {
				return false
			}
			return !this.originLoadedMap[index]
		},
		showOriginLayer(index) {
			const item = this.imageList[index] || {}
			if (!item.originalUrl || this.originFailedMap[index]) {
				return false
			}
			// 只渲染放行过的（当前页 / 下一张 / 已预加载到的）。
			// 别在这里放「缩略图就是原图就直接显示」的快捷分支 —— 服务端没生成缩略图时
			// 所有图都会命中它，等于把 9 张原图全并发拉下来，预加载节奏就白控了。
			return Boolean(this.preloadMap[index])
		},
		showLoading(index) {
			// 只有当前这张需要转圈：原图没加载完就一直挂着，缩略图糊着也照样提示
			if (index !== this.activeIndex) {
				return false
			}
			return !this.originLoadedMap[index] && !this.originFailedMap[index]
		},
		handleOriginLoad(index) {
			this.originLoadedMap = Object.assign({}, this.originLoadedMap, {
				[index]: true
			})
			// 这张就绪了，继续补下一张
			this.advancePreload()
		},
		handleOriginError(index) {
			// 同时撤掉「已加载」标记：否则原图层和缩略图层都不渲染，画面直接空掉
			const nextLoadedMap = Object.assign({}, this.originLoadedMap)
			delete nextLoadedMap[index]
			this.originLoadedMap = nextLoadedMap
			this.originFailedMap = Object.assign({}, this.originFailedMap, {
				[index]: true
			})
			const item = this.imageList[index] || {}
			// 有缩略图就静默兜底，一张都显示不出来才提示
			if (!item.thumbnailUrl || item.thumbnailUrl === item.originalUrl) {
				uni.showToast({
					title: '原图加载失败，请返回重试',
					icon: 'none'
				})
			}
			// 失败的这张不该拖住后面的预加载
			this.advancePreload()
		},
		handleSwiperChange(event = {}) {
			const nextIndex = Number(event.detail && event.detail.current)
			if (Number.isNaN(nextIndex) || nextIndex < 0) {
				return
			}
			this.activeIndex = nextIndex
			// 滑到新的一页：它和下一张立刻排上，游标跟过去继续往后补
			this.markPreload(nextIndex)
			this.markPreload(nextIndex + 1)
			if (this.preloadCursor < nextIndex + 2) {
				this.preloadCursor = nextIndex + 2
			}
			this.advancePreload()
		},
		handleClose() {
			if (getCurrentPages().length > 1) {
				uni.navigateBack()
				return
			}
			uni.reLaunch({
				url: '/pages/index/index'
			})
		}
	}
}
</script>

<style>
.image-viewer {
	position: fixed;
	inset: 0;
	background: #000000;
	overflow: hidden;
}

.image-viewer__swiper {
	width: 100%;
	height: 100%;
}

.image-viewer__item {
	position: relative;
	width: 100%;
	height: 100%;
}

.image-viewer__image {
	position: absolute;
	top: 0;
	left: 0;
	z-index: 1;
	width: 100%;
	height: 100%;
}

/* 原图盖在缩略图上；转圈再盖在两者之上 */
.image-viewer__image--origin {
	z-index: 2;
}

.image-viewer__top {
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

.image-viewer__close {
	position: absolute;
	top: calc(16rpx + env(safe-area-inset-top));
	left: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.42);
	pointer-events: auto;
}

.image-viewer__close-icon {
	font-size: 44rpx;
	line-height: 1;
	color: var(--noir-white);
}

.image-viewer__counter {
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.86);
}

/* 原图没加载完时挂在图中间：深色圆底保证在浅色照片上也看得清 */
.image-viewer__loading {
	position: absolute;
	top: 50%;
	left: 50%;
	z-index: 3;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 96rpx;
	height: 96rpx;
	margin: -48rpx 0 0 -48rpx;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.38);
	/* 别挡住「点图关闭」 */
	pointer-events: none;
}

.image-viewer__loading-ring {
	width: 40rpx;
	height: 40rpx;
	border-radius: 50%;
	border: 4rpx solid rgba(255, 255, 255, 0.28);
	border-top-color: var(--noir-white);
	box-sizing: border-box;
	animation: image-viewer-spin 0.8s linear infinite;
}

@keyframes image-viewer-spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

.image-viewer__empty {
	position: absolute;
	top: 50%;
	left: 0;
	right: 0;
	transform: translateY(-50%);
	padding: 0 60rpx;
	text-align: center;
}

.image-viewer__empty-text {
	font-size: 26rpx;
	line-height: 1.6;
	color: rgba(255, 255, 255, 0.7);
}
</style>
