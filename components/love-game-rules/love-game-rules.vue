<template>
	<view
		v-if="show"
		class="gr-mask"
		:class="{ 'gr-mask--landscape': landscape }"
		@tap="handleClose"
		@touchmove.stop.prevent
	>
		<view class="gr-sheet" :class="{ 'gr-sheet--landscape': landscape }" @tap.stop>
			<view v-if="!landscape" class="gr-handle"></view>

			<!-- 头部：Kicker + 标题 + 关闭钮 + Meta 标签 -->
			<view class="gr-head">
				<view class="gr-head__main">
					<text class="gr-kicker">GAME RULES</text>
					<text class="gr-title">{{ currentRules.title }}</text>
				</view>
				<view class="gr-close" @tap="handleClose">
					<text class="gr-close__txt">✕</text>
				</view>
			</view>

			<text v-if="currentRules.subtitle" class="gr-subtitle">{{ currentRules.subtitle }}</text>

			<view v-if="currentRules.meta && currentRules.meta.length" class="gr-meta">
				<view v-for="(item, index) in currentRules.meta" :key="index" class="gr-meta__pill">
					<text class="gr-meta__txt">{{ item }}</text>
				</view>
			</view>

			<!-- 正文区 -->
			<scroll-view class="gr-body" scroll-y>
				<view class="gr-sections">
					<view v-for="(section, index) in currentRules.sections" :key="index" class="gr-sec">
						<view class="gr-sec__head">
							<text class="gr-sec__idx">{{ formatIndex(index) }}</text>
							<text class="gr-sec__heading">{{ section.heading }}</text>
						</view>
						<view v-for="(item, itemIndex) in section.items" :key="itemIndex" class="gr-item">
							<view class="gr-item__dot"></view>
							<text class="gr-item__text">{{ item }}</text>
						</view>
					</view>
				</view>
			</scroll-view>

			<!-- 底部常驻按钮 -->
			<view class="gr-footer">
				<view class="gr-btn" @tap="handleClose">
					<text class="gr-btn__txt">知道了</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { getGameRules } from '@/common/game/rules.js'

	const FALLBACK_RULES = {
		title: '玩法说明',
		subtitle: '这个游戏还没有补充说明',
		meta: [],
		sections: []
	}

	export default {
		name: 'LoveGameRules',
		props: {
			show: {
				type: Boolean,
				default: false
			},
			gameType: {
				type: String,
				default: ''
			},
			customRules: {
				type: Object,
				default: null
			},
			landscape: {
				type: Boolean,
				default: false
			}
		},
		emits: ['close'],
		mounted() {
			this.warnIfLandscapeMissed()
		},
		computed: {
			currentRules() {
				const rules = this.customRules || getGameRules(this.gameType) || FALLBACK_RULES
				return {
					title: rules.title || FALLBACK_RULES.title,
					subtitle: rules.subtitle || '',
					meta: Array.isArray(rules.meta) ? rules.meta : [],
					sections: Array.isArray(rules.sections) ? rules.sections : []
				}
			}
		},
		methods: {
			formatIndex(idx) {
				return `0${idx + 1}`.slice(-2)
			},
			handleClose() {
				this.$emit('close')
			},
			warnIfLandscapeMissed() {
				if (this.landscape) return
				try {
					const info = uni.getSystemInfoSync()
					if (Number(info.windowWidth) > Number(info.windowHeight)) {
						console.warn('[love-game-rules] 当前屏幕是横屏，请在调用处传 :landscape="true"')
					}
				} catch (error) {
					// ignore
				}
			}
		}
	}
</script>

<style scoped>
	.gr-mask {
		position: fixed;
		inset: 0;
		z-index: 980;
		background: rgba(8, 6, 5, 0.72);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.gr-sheet {
		width: 100%;
		padding: 16rpx 32rpx calc(28rpx + env(safe-area-inset-bottom));
		border-radius: 34rpx 34rpx 0 0;
		border-top: 1.5rpx solid rgba(216, 176, 140, 0.32);
		background: linear-gradient(180deg, #1E1814 0%, #15110E 100%);
		box-shadow: 0 -16rpx 48rpx rgba(0, 0, 0, 0.52);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}

	.gr-handle {
		width: 72rpx;
		height: 8rpx;
		border-radius: 999rpx;
		background: rgba(216, 176, 140, 0.28);
		margin: 0 auto 18rpx;
	}

	.gr-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16rpx;
	}

	.gr-head__main {
		flex: 1;
		min-width: 0;
	}

	.gr-kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 17rpx;
		letter-spacing: 4rpx;
		color: rgba(216, 176, 140, 0.68);
	}

	.gr-title {
		display: block;
		margin-top: 6rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 38rpx;
		font-weight: 600;
		line-height: 1.28;
		color: var(--noir-text-strong);
	}

	.gr-close {
		width: 56rpx;
		height: 56rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.05);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.gr-close__txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.72);
	}

	.gr-subtitle {
		display: block;
		margin-top: 12rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.56);
	}

	.gr-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 10rpx;
		margin-top: 18rpx;
	}

	.gr-meta__pill {
		height: 44rpx;
		padding: 0 18rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(216, 176, 140, 0.10);
		display: inline-flex;
		align-items: center;
	}

	.gr-meta__txt {
		font-size: 20rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
	}

	.gr-body {
		max-height: 54vh;
		margin-top: 22rpx;
	}

	.gr-sections {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
		padding-bottom: 8rpx;
	}

	.gr-sec {
		padding: 20rpx 22rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.07);
		background: rgba(255, 255, 255, 0.03);
	}

	.gr-sec__head {
		display: flex;
		align-items: baseline;
		gap: 12rpx;
		margin-bottom: 12rpx;
	}

	.gr-sec__idx {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(216, 176, 140, 0.64);
	}

	.gr-sec__heading {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-coral-soft);
	}

	.gr-item {
		display: flex;
		align-items: flex-start;
		padding: 6rpx 0;
	}

	.gr-item__dot {
		flex-shrink: 0;
		width: 10rpx;
		height: 10rpx;
		margin-top: 15rpx;
		margin-right: 14rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, var(--noir-gold) 0%, var(--noir-coral) 100%);
	}

	.gr-item__text {
		flex: 1;
		font-size: 24rpx;
		line-height: 1.68;
		color: rgba(245, 237, 228, 0.84);
	}

	.gr-footer {
		padding-top: 22rpx;
	}

	.gr-btn {
		height: 86rpx;
		border-radius: 999rpx;
		background: var(--noir-btn-gradient);
		box-shadow: 0 12rpx 28rpx rgba(222, 95, 60, 0.30);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gr-btn__txt {
		font-size: 28rpx;
		font-weight: 600;
		letter-spacing: 2rpx;
		color: #FFF9F4;
	}

	/* 横屏 px 适配 */
	.gr-mask--landscape {
		align-items: center;
	}

	.gr-sheet--landscape {
		width: 540px;
		max-width: 90vw;
		padding: 16px 20px 16px;
		border-radius: 18px;
		border: 1px solid rgba(216, 176, 140, 0.32);
	}

	.gr-sheet--landscape .gr-kicker { font-size: 10px; letter-spacing: 2px; }
	.gr-sheet--landscape .gr-title { font-size: 19px; margin-top: 3px; }
	.gr-sheet--landscape .gr-close { width: 30px; height: 30px; }
	.gr-sheet--landscape .gr-close__txt { font-size: 13px; }
	.gr-sheet--landscape .gr-subtitle { font-size: 12px; margin-top: 6px; }
	.gr-sheet--landscape .gr-meta { gap: 6px; margin-top: 8px; }
	.gr-sheet--landscape .gr-meta__pill { height: 22px; padding: 0 10px; }
	.gr-sheet--landscape .gr-meta__txt { font-size: 11px; }
	.gr-sheet--landscape .gr-body { max-height: 44vh; margin-top: 10px; }
	.gr-sheet--landscape .gr-sections { gap: 8px; }
	.gr-sheet--landscape .gr-sec { padding: 10px 12px; border-radius: 12px; }
	.gr-sheet--landscape .gr-sec__idx { font-size: 10px; }
	.gr-sheet--landscape .gr-sec__heading { font-size: 13px; }
	.gr-sheet--landscape .gr-item { padding: 3px 0; }
	.gr-sheet--landscape .gr-item__dot { width: 5px; height: 5px; margin-top: 8px; margin-right: 8px; }
	.gr-sheet--landscape .gr-item__text { font-size: 12px; line-height: 1.55; }
	.gr-sheet--landscape .gr-footer { padding-top: 10px; }
	.gr-sheet--landscape .gr-btn { height: 38px; }
	.gr-sheet--landscape .gr-btn__txt { font-size: 14px; }
</style>
