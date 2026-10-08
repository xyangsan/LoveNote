<template>
	<view class="love-game-icon" :style="boxStyle">
		<!-- SVG 图标（斗地主）：微信 image 组件官方支持 svg 格式 -->
		<image v-if="isSvg" class="love-game-icon__image" :src="iconSrc" mode="aspectFit" />

		<!-- emoji 图标（谁是卧底 / 数字炸弹，以及未配置或缺失资源时的兜底） -->
		<text v-else class="love-game-icon__emoji" :style="emojiStyle">{{ emoji }}</text>
	</view>
</template>

<script>
	import {
		getGameIconType,
		getGameIconSrc,
		getGameMeta,
		FALLBACK_GAME_ICON,
		GAME_ICON_TYPE_SVG
	} from '@/common/game/rules.js'

	export default {
		name: 'LoveGameIcon',
		props: {
			gameType: {
				type: String,
				default: ''
			},
			/** 图标占据的正方形边长 */
			size: {
				type: Number,
				default: 84
			},
			/** 竖屏页面用 rpx；横屏 px 页要显式传 'px' */
			unit: {
				type: String,
				default: 'rpx'
			}
		},
		computed: {
			iconSrc() {
				return getGameIconSrc(this.gameType)
			},
			isSvg() {
				// 配了 svg 但没给 src 时退回 emoji，避免出现空白
				return getGameIconType(this.gameType) === GAME_ICON_TYPE_SVG && Boolean(this.iconSrc)
			},
			emoji() {
				const meta = getGameMeta(this.gameType)
				return meta && meta.icon ? meta.icon : FALLBACK_GAME_ICON
			},
			boxStyle() {
				const side = this.px(this.size)
				return {
					width: side,
					height: side
				}
			},
			emojiStyle() {
				// emoji 字形比字号本身小，0.72 倍视觉上才与同尺寸的图标相当
				return {
					fontSize: this.px(this.size * 0.72),
					lineHeight: 1
				}
			}
		},
		methods: {
			px(value) {
				return Math.round(Number(value) || 0) + this.unit
			}
		}
	}
</script>

<style>
	.love-game-icon {
		position: relative;
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
	}

	.love-game-icon__image {
		/* image 组件默认尺寸是 320x240，必须显式撑满图标盒 */
		width: 100%;
		height: 100%;
	}

	.love-game-icon__emoji {
		/* emoji 不响应 color / font-weight，样式只用字号与行高 */
		text-align: center;
	}
</style>
