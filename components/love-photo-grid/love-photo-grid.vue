<template>
	<view v-if="scheme && cells.length" class="love-photo-grid" :style="containerStyle">
		<view
			v-for="cell in cells"
			:key="cell.key"
			class="lpg-cell"
			:class="cell.cls"
			:style="cell.style"
			@tap="handleCellTap(cell)"
		>
			<!-- 照片 -->
			<image v-if="cell.photo" class="lpg-img" :src="cell.photo.thumb" mode="aspectFill"></image>
			<view v-if="cell.photo && cell.photo.isVideo" class="lpg-badge" :class="{ 'lpg-badge--sm': cell.small }">
				<text class="lpg-badge__icon">▶</text>
				<text v-if="!cell.small" class="lpg-badge__txt">视频</text>
			</view>
			<view v-if="cell.showCap" class="lpg-cap">
				<text class="lpg-cap__title">{{ cell.photo.title }}</text>
				<view class="lpg-cap__meta">
					<text class="lpg-cap__date">{{ cell.photo.date }}</text>
					<text v-if="cell.photo.location" class="lpg-cap__loc">· {{ cell.photo.location }}</text>
				</view>
			</view>
			<text v-else-if="cell.showDate" class="lpg-date">{{ cell.photo.date }}</text>

			<!-- 照片超量：最后一块变成「+N 全部」入口 -->
			<text v-if="cell.allCard" class="lpg-all__num">+{{ overflowCount }}</text>
			<text v-if="cell.allCard" class="lpg-all__txt">全部</text>

			<!-- 空位：上传入口 -->
			<text v-if="cell.emptySlot" class="lpg-add__plus">＋</text>
			<text v-if="cell.emptySlot && !cell.small" class="lpg-add__txt">{{ cell.index === 0 ? '上传照片' : '记录此刻' }}</text>
		</view>
	</view>
</template>

<script>
	import {
		buildPhotoGridLayout
	} from '@/common/utils/photo-grid-selector.js'

	export default {
		name: 'love-photo-grid',
		props: {
			photos: {
				type: Array,
				default() {
					return []
				}
			},
			// 用户照片总数（用于决定是否出「+N 全部」块）
			total: {
				type: Number,
				default: 0
			},
			// photo-grid-selector 选出的方案
			scheme: {
				type: Object,
				default: null
			}
		},
		data() {
			return {
				// rpx → px 比例：750rpx 设计稿宽度对应窗口宽（默认按 375 宽的机型兜底）
				pxScale: 0.5
			}
		},
		created() {
			this.updatePxScale()
		},
		computed: {
			gridLayout() {
				return buildPhotoGridLayout(this.scheme)
			},

			containerStyle() {
				if (!this.gridLayout.height) return {}
				return {
					width: this.toPx(this.gridLayout.width),
					height: this.toPx(this.gridLayout.height)
				}
			},

			// 照片能占的块数：照片超量时留最后一块给「+N 全部」
			photoSlots() {
				const slots = this.gridLayout.photoOrder.length
				if (!slots) return 0
				return this.total > slots ? slots - 1 : slots
			},

			overflowCount() {
				return Math.max(0, this.total - this.photoSlots)
			},

			cells() {
				const layout = this.gridLayout
				// photoOrder：面积大的块排前面 → 最新照片落在左上最大块
				const order = layout.photoOrder
				const limit = Math.min(this.photoSlots, this.photos.length)
				const allKey = this.total > order.length && order[this.photoSlots] ? order[this.photoSlots].key : ''

				return layout.cells.map((cell) => {
					const slotIndex = order.findIndex((item) => item.key === cell.key)
					const photo = slotIndex > -1 && slotIndex < limit ? this.photos[slotIndex] : null
					const allCard = !photo && cell.key === allKey
					const emptySlot = !photo && !allCard
					const area = cell.area
					const small = area <= 3
					return {
						key: cell.key,
						index: slotIndex,
						area,
						small,
						photo,
						photoIndex: slotIndex,
						allCard,
						emptySlot,
						showCap: !!photo && area >= 4,
						showDate: !!photo && area > 1 && area < 4,
						cls: {
							'lpg-cell--hero': area >= 6,
							'lpg-cell--middle': area >= 3 && area < 6,
							'lpg-cell--tiny': small,
							'lpg-cell--empty': emptySlot,
							'lpg-cell--all': allCard
						},
						style: {
							left: this.toPx(cell.left),
							top: this.toPx(cell.top),
							width: this.toPx(cell.width),
							height: this.toPx(cell.height)
						}
					}
				})
			}
		},
		methods: {
			// 750rpx 设计稿宽度 ↔ 实际窗口宽度
			updatePxScale() {
				let width = 0
				try {
					const info = typeof uni !== 'undefined' && uni.getSystemInfoSync ? uni.getSystemInfoSync() : null
					width = (info && info.windowWidth) || 0
				} catch (e) {
					width = 0
				}
				this.pxScale = width > 0 ? width / 750 : 0.5
			},

			toPx(rpx) {
				return `${(Number(rpx) * this.pxScale).toFixed(2)}px`
			},

			handleCellTap(cell) {
				if (cell.allCard) {
					this.$emit('all')
					return
				}
				if (cell.photo) {
					this.$emit('photo', {
						photo: cell.photo,
						index: cell.photoIndex
					})
					return
				}
				this.$emit('upload')
			}
		}
	}
</script>

<style scoped>
	.love-photo-grid {
		position: relative;
		margin: 0 auto;
	}

	.lpg-cell {
		position: absolute;
		box-sizing: border-box;
		overflow: hidden;
		border-radius: 20rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.09);
		background: var(--noir-surface);
	}

	.lpg-cell--hero {
		border-radius: 26rpx;
	}

	.lpg-cell--middle {
		border-radius: 22rpx;
	}

	.lpg-cell--tiny {
		border-radius: 16rpx;
	}

	.lpg-cell--empty {
		border-style: dashed;
		border-color: rgba(var(--noir-gold-rgb), 0.28);
		background: var(--noir-glass-1);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6rpx;
	}

	.lpg-cell--all {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2rpx;
		border-color: rgba(var(--noir-gold-rgb), 0.34);
		background: linear-gradient(145deg, rgba(var(--noir-gold-rgb), 0.16), rgba(var(--noir-surface2-rgb), 0.96));
	}

	.lpg-img {
		width: 100%;
		height: 100%;
		display: block;
	}

	.lpg-badge {
		position: absolute;
		top: 10rpx;
		left: 10rpx;
		display: flex;
		align-items: center;
		padding: 3rpx 10rpx;
		border-radius: 999rpx;
		background: rgba(var(--noir-shadow-rgb), 0.62);
	}

	.lpg-badge--sm {
		padding: 2rpx 7rpx;
	}

	.lpg-badge__icon {
		font-size: 16rpx;
		line-height: 1;
		color: var(--noir-on-media);
	}

	.lpg-badge__txt {
		margin-left: 4rpx;
		font-size: 17rpx;
		line-height: 1.2;
		color: var(--noir-on-media);
	}

	.lpg-cap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 44rpx 16rpx 14rpx;
		background: linear-gradient(
			180deg,
			rgba(var(--noir-shadow-rgb), 0) 0%,
			rgba(var(--noir-shadow-rgb), 0.36) 48%,
			rgba(var(--noir-shadow-rgb), 0.76) 100%
		);
	}

	.lpg-cap__title {
		display: block;
		font-size: 22rpx;
		font-weight: 500;
		color: var(--noir-on-media);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lpg-cap__meta {
		display: flex;
		align-items: center;
		margin-top: 4rpx;
		overflow: hidden;
	}

	.lpg-cap__date {
		flex-shrink: 0;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 17rpx;
		color: var(--noir-on-media-accent);
	}

	.lpg-cap__loc {
		flex: 1;
		min-width: 0;
		margin-left: 6rpx;
		font-size: 17rpx;
		color: var(--noir-on-media-sub);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.lpg-date {
		position: absolute;
		left: 10rpx;
		bottom: 8rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 16rpx;
		color: var(--noir-on-media);
		text-shadow: 0 1rpx 6rpx rgba(var(--noir-shadow-rgb), 0.7);
	}

	.lpg-all__num {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
		line-height: 1.2;
	}

	.lpg-all__txt {
		font-size: 17rpx;
		color: rgba(var(--noir-gold-rgb), 0.9);
	}

	.lpg-add__plus {
		font-size: 28rpx;
		line-height: 1;
		color: var(--noir-gold);
	}

	.lpg-add__txt {
		font-size: 19rpx;
		color: rgba(var(--noir-text-rgb), 0.48);
	}
</style>
