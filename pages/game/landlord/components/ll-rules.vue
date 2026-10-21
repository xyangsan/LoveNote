<template>
	<view v-if="show" class="ll-rules">
		<view class="ll-rules__mask" @click="handleMask"></view>
		<view class="ll-rules__panel">
			<!-- 头部：标题 + 副标题 + meta 标签 -->
			<view class="ll-rules__head">
				<text class="ll-rules__title">{{ currentRules.title }}</text>
				<text class="ll-rules__subtitle">{{ currentRules.subtitle }}</text>
				<view v-if="currentRules.meta && currentRules.meta.length" class="ll-rules__meta">
					<text
						v-for="(item, index) in currentRules.meta"
						:key="index"
						class="ll-rules__meta-tag"
					>{{ item }}</text>
				</view>
			</view>

			<!-- 正文：小程序 <view> 的 overflow:auto 是死代码，必须用 scroll-view。
			     高度分两层保证：
			       1. 外层 .ll-rules__body 拿**确切 px**（measureBody 量面板/头/脚算出来）并 overflow:hidden；
			       2. 内层 scroll-view 高度 100%，只负责滚。
			     ⚠️ 只给 scroll-view 写 max-height / flex:1 是不够的：它会按内容撑开，
			        正文就压到「知道了」按钮下面（历史上的溢出就是这么来的）。 -->
			<view class="ll-rules__body" :style="bodyStyle">
				<scroll-view class="ll-rules__scroll" scroll-y>
					<view class="ll-rules__content">
						<view
							v-for="(section, index) in currentRules.sections"
							:key="index"
							class="ll-rules__section"
						>
							<text class="ll-rules__heading">{{ section.heading }}</text>
							<view
								v-for="(item, itemIndex) in section.items"
								:key="itemIndex"
								class="ll-rules__item"
							>
								<view class="ll-rules__dot"></view>
								<text class="ll-rules__text">{{ item }}</text>
							</view>
						</view>
					</view>
				</scroll-view>
			</view>

			<!-- 底部按钮常驻，不跟着滚 -->
			<view class="ll-rules__footer">
				<view class="ll-rules__btn" @click="handleClose">
					<text class="ll-rules__btn-text">知道了</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { getGameRules } from '@/common/game/rules.js'

	/**
	 * 斗地主横屏规则弹框（独立于通用 love-game-rules）。
	 *
	 * 与通用版的区别：
	 *   · 自绘 mask + panel，不依赖 fui-bottom-popup（横屏下 popup 的 rpx 安全区计算会偏）；
	 *   · 全 px 尺寸（横屏 rpx 按屏宽放大 2 倍会撑爆）；
	 *   · 正文 scroll-y，规则再多也能完整滚到底；
	 *   · QQ 风格皮肤：白底 + 暖橙标题 + 棕色正文。
	 *
	 * 内容来源：common/game/rules.js 的 getGameRules('landlord')。
	 */
	const FALLBACK_RULES = {
		title: '玩法说明',
		subtitle: '这个游戏还没有补充说明',
		meta: [],
		sections: []
	}

	/** 正文最小高度：屏再矮也要留出能滚的区域 */
	const BODY_MIN_HEIGHT = 96
	/** 面板底部 padding（跟 .ll-rules__panel 的 padding-bottom 对齐） */
	const PANEL_BOTTOM_PADDING = 14
	/** 量不到 head / footer 时的兜底占位（标题区 ~112 + 按钮区 ~60 + 边距） */
	const PANEL_CHROME_FALLBACK = 186

	export default {
		name: 'LlRules',
		props: {
			show: { type: Boolean, default: false },
			maskClosable: { type: Boolean, default: true }
		},
		emits: ['close'],
		data() {
			return {
				/**
				 * 正文区的**确切高度**（px）。
				 * ⚠️ 小程序里 `scroll-view` 只写 `flex:1; min-height:0` **拿不到确定高度** ——
				 *    它会按内容撑开，把「知道了」按钮顶出面板（被 overflow:hidden 裁掉），
				 *    表现就是正文压到按钮下面、底部内容看不见。所以这里量一次面板 / head / footer，
				 *    算出正文能占多少像素，绑到外层 view 上（scroll-view 自己撑满 100%）。
				 */
				bodyHeight: 0,
				/** 补量定时器（小程序视图层是异步的，nextTick 时节点可能还没上屏） */
				measureTimer: null
			}
		},
		watch: {
			show(next) {
				if (next) {
					this.scheduleMeasure()
				} else {
					this.clearMeasureTimer()
					this.bodyHeight = 0
				}
			}
		},
		mounted() {
			// 组件可能一创建就是 show=true（父级用 v-if 包着它）→ watch 不会触发，这里补一次
			if (this.show) {
				this.scheduleMeasure()
			}
		},
		beforeUnmount() {
			this.clearMeasureTimer()
		},
		computed: {
			currentRules() {
				const rules = getGameRules('landlord') || FALLBACK_RULES
				return {
					title: rules.title || FALLBACK_RULES.title,
					subtitle: rules.subtitle || '',
					meta: Array.isArray(rules.meta) ? rules.meta : [],
					sections: Array.isArray(rules.sections) ? rules.sections : []
				}
			},
			/** 量出高度后绑到外层 view 上；没量到就交给 CSS 的 calc 兜底 */
			bodyStyle() {
				return this.bodyHeight > 0 ? { height: `${this.bodyHeight}px` } : {}
			}
		},
		methods: {
			/** 横屏可用高度 = 窗口短边（部分机型横屏下 windowWidth 仍是短边，取 min 最稳） */
			screenHeight() {
				try {
					const info = uni.getSystemInfoSync()
					const shortSide = Math.min(Number(info.windowWidth) || 0, Number(info.windowHeight) || 0)
					if (shortSide > 0) {
						return shortSide
					}
				} catch (error) {
					console.warn('ll-rules screenHeight failed', error)
				}
				return 375
			},
			/**
			 * 量两次：nextTick 一次 + 80ms 后补一次。
			 * 小程序 setData 之后视图层是异步渲染的，nextTick 时节点可能还没上屏 →
			 * 第一次 query 全 null，只能靠补量拿到真实高度。
			 */
			scheduleMeasure() {
				this.clearMeasureTimer()
				this.$nextTick(() => this.measureBody())
				this.measureTimer = setTimeout(() => {
					this.measureTimer = null
					if (this.show) {
						this.measureBody()
					}
				}, 80)
			},
			clearMeasureTimer() {
				if (this.measureTimer) {
					clearTimeout(this.measureTimer)
					this.measureTimer = null
				}
			},
			/**
			 * 量出正文应该有多高（**确切 px**，不是 max-height）：
			 *   可用高度 = 整屏高度 × 86%（面板 max-height）- head - footer - 面板底部 padding
			 *   正文高度 = min(可用高度, 规则内容实际高度)
			 * 屏高不用 getSystemInfo（横屏时机不可靠），直接量铺满整屏的 .ll-rules 浮层。
			 * 量不到 head/footer 就退回保守估算（宁可少显示一点，也不能把按钮顶出去）。
			 */
			measureBody() {
				const query = uni.createSelectorQuery().in(this)
				query.select('.ll-rules').boundingClientRect()
				query.select('.ll-rules__panel').boundingClientRect()
				query.select('.ll-rules__head').boundingClientRect()
				query.select('.ll-rules__footer').boundingClientRect()
				query.select('.ll-rules__content').boundingClientRect()
				query.exec((res) => {
					if (!this.show) {
						return
					}
					const view = res && res[0]
					const panel = res && res[1]
					const head = res && res[2]
					const footer = res && res[3]
					const content = res && res[4]
					const viewHeight = (view && view.height) || this.screenHeight()
					const headHeight = head && head.height ? head.height : 0
					const footerHeight = footer && footer.height ? footer.height : 0
					if (!headHeight || !footerHeight) {
						this.bodyHeight = Math.max(
							BODY_MIN_HEIGHT,
							Math.floor(viewHeight * 0.86) - PANEL_CHROME_FALLBACK
						)
						return
					}
					const chrome = headHeight + footerHeight + PANEL_BOTTOM_PADDING
					// 面板真高（CSS max-height: 86vh 生效后的结果）与「视口 × 86%」取小：
					// 有的机型横屏下 vh 和 getSystemInfo 的短边对不上，以实际渲染出来的为准
					const maxByView = Math.floor(viewHeight * 0.86) - chrome
					const maxByPanel = panel && panel.height ? Math.floor(panel.height) - chrome : maxByView
					const available = Math.max(BODY_MIN_HEIGHT, Math.min(maxByView, maxByPanel))
					// content 的 boundingClientRect 已经含自己的 padding → 直接当需求高度
					const contentHeight = content && content.height
						? Math.ceil(content.height)
						: available
					this.bodyHeight = Math.min(available, Math.max(BODY_MIN_HEIGHT, contentHeight))
				})
			},
			handleMask() {
				if (this.maskClosable) {
					this.$emit('close')
				}
			},
			handleClose() {
				this.$emit('close')
			}
		}
	}
</script>

<style>
	/* 横屏页面：全 px，不用 rpx */
	.ll-rules {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1500;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ll-rules__mask {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(8, 30, 18, 0.55);
	}

	.ll-rules__panel {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: 520px;
		max-width: 90vw;
		max-height: 86vh;
		padding: 0 18px 14px;
		border-radius: 18px;
		background: linear-gradient(180deg, #fffdf8 0%, #fff5ec 100%);
		box-shadow: 0 14px 32px rgba(0, 0, 0, 0.32);
		overflow: hidden;
	}

	.ll-rules__head {
		flex-shrink: 0;
		padding: 14px 0 10px;
		text-align: center;
	}

	.ll-rules__title {
		display: block;
		font-size: 20px;
		font-weight: 700;
		color: #5a3a10;
	}

	.ll-rules__subtitle {
		display: block;
		margin-top: 6px;
		font-size: 12px;
		line-height: 1.5;
		color: #8b6659;
	}

	.ll-rules__meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 6px;
		margin-top: 9px;
	}

	.ll-rules__meta-tag {
		padding: 2px 8px;
		border-radius: 999px;
		background: #fff1e6;
		font-size: 10px;
		color: #b8604c;
	}

	/* 正文区：**确切高度** —— JS 算好后绑 height（见 measureBody），
	   CSS 这里只是「还没量到」时的兜底（86vh 减去标题区+按钮区的大致占位）。
	   flex: 0 0 auto 是为了让这个高度不被 flex 拉伸/压缩，面板总高才可控 */
	.ll-rules__body {
		flex: 0 0 auto;
		height: calc(86vh - 186px);
		min-height: 96px;
		box-sizing: border-box;
		overflow: hidden;
	}

	/* 内层 scroll-view 只负责滚：撑满外层定高容器。
	   ⚠️ padding 不要写在这里 —— 小程序原生 scroll-view 带 padding 时滚动区域会算歪，
	      统一放到 .ll-rules__content 上 */
	.ll-rules__scroll {
		height: 100%;
		box-sizing: border-box;
	}

	/* 规则内容自然撑开：measureBody 量它（含 padding）来算「实际需要多高」 */
	.ll-rules__content {
		padding: 6px 4px 8px;
	}

	.ll-rules__section {
		padding: 9px 0 2px;
	}

	.ll-rules__section + .ll-rules__section {
		margin-top: 4px;
		padding-top: 11px;
		border-top: 1px solid rgba(231, 204, 194, 0.55);
	}

	.ll-rules__heading {
		display: block;
		margin-bottom: 7px;
		font-size: 14px;
		font-weight: 700;
		color: #c0674d;
	}

	.ll-rules__item {
		display: flex;
		align-items: flex-start;
		padding: 4px 0;
	}

	.ll-rules__dot {
		flex-shrink: 0;
		width: 6px;
		height: 6px;
		margin-top: 7px;
		margin-right: 8px;
		border-radius: 50%;
		background: linear-gradient(135deg, #ff9a76 0%, #f4b183 100%);
	}

	.ll-rules__text {
		flex: 1;
		font-size: 13px;
		line-height: 1.6;
		color: #6d473a;
	}

	.ll-rules__footer {
		flex-shrink: 0;
		padding-top: 11px;
	}

	.ll-rules__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 40px;
		border-radius: 999px;
		background: linear-gradient(180deg, #ffdf8e 0%, #ffb84d 55%, #f59b2a 100%);
		border-bottom: 2px solid #b86a14;
		box-shadow: 0 4px 10px rgba(120, 60, 20, 0.26);
	}

	.ll-rules__btn-text {
		font-size: 14px;
		font-weight: 700;
		color: #5a3a10;
	}
</style>
