<template>
	<view class="noir-navbar-wrap">
		<view
			class="noir-navbar"
			:class="{
				'noir-navbar--fixed': fixed,
				'noir-navbar--transparent': transparent,
				'noir-navbar--border': border && !transparent
			}"
			:style="barStyle"
		>
			<view class="noir-navbar__row" :style="rowStyle">
				<view class="noir-navbar__left" :style="leftStyle">
					<slot name="left">
						<view v-if="showBack" class="noir-navbar__back" @tap="handleBack">
							<text class="noir-navbar__back-icon">‹</text>
						</view>
					</slot>
				</view>

				<view class="noir-navbar__center">
					<slot name="center">
						<text class="noir-navbar__title">{{ title }}</text>
						<text v-if="subtitle" class="noir-navbar__subtitle">{{ subtitle }}</text>
					</slot>
				</view>

				<view class="noir-navbar__right" :style="rightStyle">
					<slot name="right"></slot>
				</view>
			</view>
		</view>
		<view v-if="fixed && placeholder" :style="placeholderStyle"></view>
	</view>
</template>

<script>
	import {
		buildNavBarEdgeInsets,
		buildNavBarStyle,
		getNavBarHeight,
		getNavBarMetrics
	} from '../../common/utils/nav-bar.js'
	import { goHomeTab } from '../../common/utils/tab-nav.js'

	export default {
		name: 'NoirNavbar',
		props: {
			title: {
				type: String,
				default: ''
			},
			subtitle: {
				type: String,
				default: ''
			},
			showBack: {
				type: Boolean,
				default: true
			},
			transparent: {
				type: Boolean,
				default: false
			},
			fixed: {
				type: Boolean,
				default: true
			},
			placeholder: {
				type: Boolean,
				default: true
			},
			border: {
				type: Boolean,
				default: false
			},
			customBack: {
				type: Boolean,
				default: false
			},
			scrollTop: {
				type: Number,
				default: 0
			},
			scrollThreshold: {
				type: Number,
				default: 200
			}
		},
		emits: ['back'],
		data() {
			return {
				metrics: getNavBarMetrics()
			}
		},
		computed: {
			scrollProgress() {
				if (!this.transparent) return 1
				const threshold = Math.max(1, Number(this.scrollThreshold || 200))
				const linear = Math.min(1, Math.max(0, Number(this.scrollTop || 0) / threshold))
				// Ease-in 缓入曲线：前段变化慢，后段加速过渡到完全不透明实色背景
				return Math.pow(linear, 2.5)
			},
			barStyle() {
				const base = buildNavBarStyle(this.metrics)
				if (!this.transparent) {
					return base
				}
				const p = this.scrollProgress
				if (p <= 0.001) {
					return base
				}
				if (p >= 0.999) {
					return Object.assign({}, base, {
						background: 'var(--noir-bg)',
						borderBottom: '1px solid rgba(var(--noir-gold-rgb), 0.12)'
					})
				}
				const topA = (0.72 + 0.28 * p).toFixed(3)
				const midA = (0.32 + 0.68 * p).toFixed(3)
				const botA = p.toFixed(3)
				const borderA = (0.12 * p).toFixed(3)
				return Object.assign({}, base, {
					// rgba(var(--x), a)：令牌里存的是 "17, 13, 11" 三元组，拼出来换主题就跟着变
					background: `linear-gradient(180deg, rgba(var(--noir-bg-rgb), ${topA}) 0%, rgba(var(--noir-bg-rgb), ${midA}) 62%, rgba(var(--noir-bg-rgb), ${botA}) 100%)`,
					borderBottom: p > 0.08 ? `1px solid rgba(var(--noir-gold-rgb), ${borderA})` : 'none'
				})
			},
			rowStyle() {
				return {
					height: `${this.metrics.contentHeight}px`
				}
			},
			edgeInsets() {
				return buildNavBarEdgeInsets(this.metrics)
			},
			leftStyle() {
				return {
					marginLeft: `${this.edgeInsets.left}px`
				}
			},
			rightStyle() {
				return {
					marginRight: `${this.edgeInsets.right}px`
				}
			},
			placeholderStyle() {
				return {
					height: `${getNavBarHeight(this.metrics)}px`
				}
			}
		},
		methods: {
			handleBack() {
				if (this.customBack) {
					this.$emit('back')
					return
				}
				const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
				if (pages.length > 1) {
					uni.navigateBack({ delta: 1 })
				} else {
					goHomeTab()
				}
			}
		}
	}
</script>

<style scoped>
	.noir-navbar {
		width: 100%;
		box-sizing: border-box;
		background: rgba(var(--noir-bg-rgb), 0.92);
		backdrop-filter: blur(18rpx);
		-webkit-backdrop-filter: blur(18rpx);
		z-index: 60;
	}

	.noir-navbar--fixed {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
	}

	.noir-navbar--transparent {
		background: linear-gradient(
			180deg,
			rgba(var(--noir-bg-rgb), 0.78) 0%,
			rgba(var(--noir-bg-rgb), 0.38) 64%,
			rgba(var(--noir-bg-rgb), 0) 100%
		);
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}

	.noir-navbar--border {
		border-bottom: 1rpx solid var(--noir-border-soft);
	}

	.noir-navbar__row {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.noir-navbar__left,
	.noir-navbar__right {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 12rpx;
		min-width: 60rpx;
	}

	.noir-navbar__right {
		justify-content: flex-end;
	}

	.noir-navbar__back {
		width: 60rpx;
		height: 60rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(var(--noir-text-rgb), 0.16);
		background: rgba(var(--noir-bg-rgb), 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.noir-navbar__back-icon {
		color: var(--noir-text);
		font-size: 38rpx;
		line-height: 1;
		margin-top: -4rpx;
		margin-left: -2rpx;
	}

	.noir-navbar__center {
		position: absolute;
		left: 140rpx;
		right: 140rpx;
		top: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.noir-navbar__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 500;
		letter-spacing: 3rpx;
		color: var(--noir-text-strong);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.noir-navbar__subtitle {
		margin-top: 2rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 16rpx;
		letter-spacing: 3rpx;
		color: rgba(var(--noir-gold-rgb), 0.62);
	}
</style>
