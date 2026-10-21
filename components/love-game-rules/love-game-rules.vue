<template>
	<fui-bottom-popup
		:show="show"
		:radius="landscape ? 16 : 32"
		:mask-closable="true"
		:safe-area="true"
		@close="handleClose"
	>
		<view class="game-rules" :class="{ 'game-rules--landscape': landscape }">
			<view class="game-rules__head">
				<text class="game-rules__title">{{ currentRules.title }}</text>
				<text class="game-rules__subtitle">{{ currentRules.subtitle }}</text>
				<view v-if="currentRules.meta && currentRules.meta.length" class="game-rules__meta">
					<fui-tag
						v-for="(item, index) in currentRules.meta"
						:key="index"
						:text="item"
						theme="light"
						background="#fff1eb"
						color="#b8604c"
						:radius="999"
						:size="landscape ? 9 : 20"
						:marginTop="0"
						:marginBottom="0"
						:marginRight="landscape ? 6 : 12"
					/>
				</view>
			</view>

			<scroll-view class="game-rules__body" scroll-y>
				<view v-for="(section, index) in currentRules.sections" :key="index" class="game-rules__section">
					<text class="game-rules__heading">{{ section.heading }}</text>
					<view v-for="(item, itemIndex) in section.items" :key="itemIndex" class="game-rules__item">
						<view class="game-rules__dot"></view>
						<text class="game-rules__text">{{ item }}</text>
					</view>
				</view>
			</scroll-view>

			<view class="game-rules__footer">
				<fui-button
					text="知道了"
					background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
					color="#ffffff"
					:height="landscape ? '42px' : '88rpx'"
					:radius="landscape ? '999px' : '999rpx'"
					:size="landscape ? 14 : 30"
					:bold="true"
					@click="handleClose"
				/>
			</view>
		</view>
	</fui-bottom-popup>
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
			/**
			 * 横屏页面（斗地主房间页是 pageOrientation: landscape）必须传 true：
			 * rpx 按屏宽换算，横屏下 750rpx ≈ 整个屏宽 → 字号/内边距会整体放大到 2 倍以上、
			 * 竖向空间又只有 375px 左右，弹框会被撑爆。传 true 后内部改用 px 尺寸。
			 */
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
			handleClose() {
				this.$emit('close')
			},
			/**
			 * 兜底提醒：横屏页面忘了传 `landscape` 时，rpx 会把整个弹框放大 2 倍以上
			 * —— 这种错误不报错、只是静默变丑，所以给一条 warn。
			 */
			warnIfLandscapeMissed() {
				if (this.landscape) {
					return
				}
				try {
					const info = uni.getSystemInfoSync()
					if (Number(info.windowWidth) > Number(info.windowHeight)) {
						console.warn('[love-game-rules] 当前屏幕是横屏，请在调用处传 :landscape="true"')
					}
				} catch (error) {
					// 取不到屏幕信息就算了，不影响功能
				}
			}
		}
	}
</script>

<style>
	.game-rules {
		display: flex;
		flex-direction: column;
		padding: 8rpx 32rpx 24rpx;
		background: #ffffff;
	}

	.game-rules__head {
		padding: 24rpx 0 18rpx;
	}

	.game-rules__title {
		display: block;
		font-size: 40rpx;
		font-weight: 700;
		line-height: 1.3;
		color: #5a3427;
	}

	.game-rules__subtitle {
		display: block;
		margin-top: 12rpx;
		font-size: 25rpx;
		line-height: 1.6;
		color: #8b6659;
	}

	.game-rules__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin-top: 18rpx;
	}

	.game-rules__body {
		max-height: 56vh;
	}

	.game-rules__section {
		padding: 18rpx 0 4rpx;
	}

	.game-rules__section + .game-rules__section {
		margin-top: 8rpx;
		padding-top: 22rpx;
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.game-rules__heading {
		display: block;
		margin-bottom: 14rpx;
		font-size: 28rpx;
		font-weight: 700;
		color: #c0674d;
	}

	.game-rules__item {
		display: flex;
		align-items: flex-start;
		padding: 8rpx 0;
	}

	.game-rules__dot {
		flex-shrink: 0;
		width: 12rpx;
		height: 12rpx;
		margin-top: 14rpx;
		margin-right: 16rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ff9a76 0%, #f4b183 100%);
		box-shadow: 0 0 0 6rpx rgba(255, 186, 160, 0.16);
	}

	.game-rules__text {
		flex: 1;
		font-size: 26rpx;
		line-height: 1.7;
		color: #6d473a;
	}

	.game-rules__footer {
		padding-top: 22rpx;
	}

	/* ---------------- 横屏（斗地主房间页）----------------
	   全部换 px：横屏 rpx 会按屏宽放大，这里用固定的 px 才不会撑爆；
	   同时给内容加 max-width 居中，避免 800px 宽的一行字读起来吃力。 */
	/* 外层保留左右 gutter：横屏窄屏（如 568px 宽）下内容限宽后只剩几像素，
	   没有这层 padding 正文会直接贴到弹框边上 */
	.game-rules--landscape {
		padding: 4px 16px 12px;
	}

	.game-rules--landscape .game-rules__head,
	.game-rules--landscape .game-rules__body,
	.game-rules--landscape .game-rules__footer {
		width: 100%;
		max-width: 560px;
		margin-left: auto;
		margin-right: auto;
		box-sizing: border-box;
	}

	.game-rules--landscape .game-rules__head {
		padding: 12px 0 9px;
	}

	.game-rules--landscape .game-rules__title {
		font-size: 20px;
	}

	.game-rules--landscape .game-rules__subtitle {
		margin-top: 6px;
		font-size: 13px;
	}

	.game-rules--landscape .game-rules__meta {
		margin-top: 9px;
	}

	/* 横屏可用高度只有 ~375px，正文必须自己滚 */
	.game-rules--landscape .game-rules__body {
		max-height: 46vh;
	}

	.game-rules--landscape .game-rules__section {
		padding: 9px 0 2px;
	}

	.game-rules--landscape .game-rules__section + .game-rules__section {
		margin-top: 4px;
		padding-top: 11px;
	}

	.game-rules--landscape .game-rules__heading {
		margin-bottom: 7px;
		font-size: 14px;
	}

	.game-rules--landscape .game-rules__item {
		padding: 4px 0;
	}

	.game-rules--landscape .game-rules__dot {
		width: 6px;
		height: 6px;
		margin-top: 7px;
		margin-right: 8px;
		box-shadow: 0 0 0 3px rgba(255, 186, 160, 0.16);
	}

	.game-rules--landscape .game-rules__text {
		font-size: 13px;
		line-height: 1.6;
	}

	.game-rules--landscape .game-rules__footer {
		padding-top: 11px;
	}
</style>
