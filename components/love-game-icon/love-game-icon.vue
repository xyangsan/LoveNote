<template>
	<view class="love-game-icon" :style="boxStyle">
		<!-- SVG 图标（斗地主）：微信 image 组件官方支持 svg 格式 -->
		<image v-if="isSvg" class="love-game-icon__image" :src="iconSrc" mode="aspectFit" />

		<!-- emoji 图标（谁是卧底 / 数字炸弹 / 角色角标，以及未配置或缺失资源时的兜底） -->
		<text v-else class="love-game-icon__emoji" :style="emojiStyle">{{ emoji }}</text>
	</view>
</template>

<script>
	import {
		getGameIconType,
		getGameIconSrc,
		getGameMeta,
		FALLBACK_GAME_ICON,
		GAME_ICON_TYPE_SVG,
		getBadgeIconType,
		getBadgeIconSrc,
		getBadgeMeta,
		FALLBACK_BADGE_ICON
	} from '@/common/game/rules.js'

	/**
	 * 统一图标出口：`gameType`（玩法图标）与 `badgeType`（角色 / 状态角标）**二选一**，
	 * badgeType 优先。两者都走同一套 emoji / svg 分发，调用方不必关心资源形式。
	 */
	export default {
		name: 'LoveGameIcon',
		props: {
			gameType: {
				type: String,
				default: ''
			},
			/** 角标类型：landlord / farmer / robot / trustee / trustee-offline */
			badgeType: {
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
			/** 唯一解析口：先看 badgeType，再退回 gameType，最后兜底 emoji */
			iconSpec() {
				if (this.badgeType) {
					const meta = getBadgeMeta(this.badgeType)
					return {
						iconType: getBadgeIconType(this.badgeType),
						iconSrc: getBadgeIconSrc(this.badgeType),
						emoji: (meta && meta.icon) || FALLBACK_BADGE_ICON
					}
				}
				const meta = getGameMeta(this.gameType)
				return {
					iconType: getGameIconType(this.gameType),
					iconSrc: getGameIconSrc(this.gameType),
					emoji: (meta && meta.icon) || FALLBACK_GAME_ICON
				}
			},
			iconSrc() {
				return this.iconSpec.iconSrc
			},
			isSvg() {
				// 配了 svg 但没给 src 时退回 emoji，避免出现空白
				return this.iconSpec.iconType === GAME_ICON_TYPE_SVG && Boolean(this.iconSpec.iconSrc)
			},
			emoji() {
				return this.iconSpec.emoji
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
