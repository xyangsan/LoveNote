<template>
	<view
		class="playing-card"
		:class="{
			'playing-card--selected': selected,
			'playing-card--disabled': disabled,
			'playing-card--dimmed': dimmed,
			'playing-card--clickable': clickable,
			'playing-card--back': faceDown
		}"
		:style="cardStyle"
		@click="handleTap"
	>
		<!-- 牌背 -->
		<view v-if="faceDown" class="playing-card__back">
			<view class="playing-card__back-inner">
				<text class="playing-card__back-mark">♥</text>
			</view>
		</view>

		<!-- 牌面 -->
		<template v-else>
			<view class="playing-card__corner" :style="{ color: card.color }">
				<text class="playing-card__corner-rank" :style="{ color: card.color }">{{ card.label }}</text>
				<text class="playing-card__corner-suit" :style="{ color: card.color }">{{ card.symbol }}</text>
			</view>
			<view class="playing-card__center">
				<text
					v-if="card.isJoker"
					class="playing-card__center-joker"
					:style="{ color: card.color }"
				>{{ card.label }}</text>
				<text v-else class="playing-card__center-suit" :style="{ color: card.color }">{{ card.symbol }}</text>
			</view>
		</template>

		<view v-if="badge" class="playing-card__badge">
			<text class="playing-card__badge-text">{{ badge }}</text>
		</view>
	</view>
</template>

<script>
	import { parseCard } from '@/common/game/cards.js'

	export default {
		name: 'LovePlayingCard',
		props: {
			cardId: {
				type: String,
				default: ''
			},
			/** 横屏下必须用 px，不能再用 rpx（rpx 会以屏宽为基准被放大） */
			width: {
				type: Number,
				default: 56
			},
			height: {
				type: Number,
				default: 80
			},
			faceDown: {
				type: Boolean,
				default: false
			},
			selected: {
				type: Boolean,
				default: false
			},
			disabled: {
				type: Boolean,
				default: false
			},
			dimmed: {
				type: Boolean,
				default: false
			},
			clickable: {
				type: Boolean,
				default: false
			},
			badge: {
				type: String,
				default: ''
			}
		},
		// 用独一无二的事件名，避免与原生 tap 撞名 → 触发两次（选牌被立即取消）
		emits: ['card-tap'],
		computed: {
			card() {
				return parseCard(this.cardId)
			},
			cardStyle() {
				return {
					width: `${this.width}px`,
					height: `${this.height}px`,
					borderRadius: `${Math.max(6, Math.round(this.width * 0.16))}px`
				}
			}
		},
		methods: {
			handleTap() {
				if (!this.clickable || this.disabled) {
					return
				}
				this.$emit('card-tap', this.cardId)
			}
		}
	}
</script>

<style>
	.playing-card {
		position: relative;
		flex-shrink: 0;
		box-sizing: border-box;
		background: #ffffff;
		border: 1px solid rgba(180, 120, 95, 0.22);
		box-shadow: 0 3px 8px rgba(120, 80, 60, 0.14);
		overflow: hidden;
		transition: transform 0.12s ease, box-shadow 0.12s ease;
	}

	.playing-card--clickable {
		cursor: pointer;
	}

	.playing-card--selected {
		transform: translateY(-14px);
		box-shadow: 0 8px 16px rgba(231, 111, 81, 0.32);
		border-color: rgba(231, 111, 81, 0.6);
	}

	.playing-card--disabled {
		opacity: 0.55;
	}

	.playing-card--dimmed {
		opacity: 0.5;
		transform: scale(0.94);
	}

	.playing-card__corner {
		position: absolute;
		top: 3px;
		left: 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}

	.playing-card__corner-rank {
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
	}

	.playing-card__corner-suit {
		font-size: 11px;
		line-height: 1;
		margin-top: 1px;
	}

	.playing-card__center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -42%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.playing-card__center-suit {
		font-size: 22px;
		opacity: 0.42;
		line-height: 1;
	}

	.playing-card__center-joker {
		font-size: 20px;
		font-weight: 700;
		opacity: 0.85;
	}

	.playing-card__badge {
		position: absolute;
		right: 2px;
		bottom: 2px;
		padding: 1px 4px;
		border-radius: 999px;
		background: #e76f51;
	}

	.playing-card__badge-text {
		font-size: 8px;
		color: #ffffff;
	}

	.playing-card__back {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #f2a25c 0%, #e76f51 100%);
	}

	.playing-card__back-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 68%;
		height: 76%;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.5);
		background: rgba(255, 255, 255, 0.14);
	}

	.playing-card__back-mark {
		font-size: 16px;
		color: rgba(255, 255, 255, 0.85);
	}
</style>
