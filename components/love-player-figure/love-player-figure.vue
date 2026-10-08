<template>
	<view
		class="player-figure"
		:class="[
			'player-figure--' + size,
			{
				'player-figure--offline': !online,
				'player-figure--current': isCurrent
			}
		]"
	>
		<view v-if="bubbleText" class="player-figure__bubble">
			<text class="player-figure__bubble-text">{{ bubbleText }}</text>
		</view>

		<view class="player-figure__body" :style="{ background: bodyGradient }">
			<view class="player-figure__head">
				<image
					v-if="avatarUrl"
					class="player-figure__avatar-img"
					:src="avatarUrl"
					mode="aspectFill"
				></image>
				<text v-else class="player-figure__avatar-text">{{ shortName }}</text>
			</view>
		</view>

		<view class="player-figure__meta">
			<text class="player-figure__name">{{ displayName }}</text>
			<view class="player-figure__badges">
				<view v-if="role" class="player-figure__role" :class="'player-figure__role--' + role">
					<text class="player-figure__role-text">{{ role === 'landlord' ? '地主' : '农民' }}</text>
				</view>
				<view v-if="isRobot" class="player-figure__tag player-figure__tag--robot">
					<text class="player-figure__tag-text">AI</text>
				</view>
				<view v-if="isTrustee" class="player-figure__tag player-figure__tag--trustee">
					<text class="player-figure__tag-text">{{ trusteeAuto ? '掉线托管' : '托管中' }}</text>
				</view>
			</view>
		</view>

		<view v-if="showCardsLeft" class="player-figure__cards">
			<text class="player-figure__cards-text">剩 {{ cardsLeft }} 张</text>
		</view>
	</view>
</template>

<script>
	/** 人物形象：纯 CSS 绘制（圆头 + 圆角肩），不依赖任何图片资源 */
	const BODY_GRADIENTS = [
		'linear-gradient(160deg, #ffb37a 0%, #e76f51 100%)',
		'linear-gradient(160deg, #84c7a8 0%, #4f9d80 100%)',
		'linear-gradient(160deg, #a6c1ee 0%, #7b9bd6 100%)'
	]

	export default {
		name: 'LovePlayerFigure',
		props: {
			nickname: {
				type: String,
				default: ''
			},
			avatarUrl: {
				type: String,
				default: ''
			},
			/** landlord / farmer / '' */
			role: {
				type: String,
				default: ''
			},
			seatIndex: {
				type: Number,
				default: 0
			},
			cardsLeft: {
				type: Number,
				default: 0
			},
			showCardsLeft: {
				type: Boolean,
				default: true
			},
			isRobot: {
				type: Boolean,
				default: false
			},
			isTrustee: {
				type: Boolean,
				default: false
			},
			trusteeAuto: {
				type: Boolean,
				default: false
			},
			online: {
				type: Boolean,
				default: true
			},
			isCurrent: {
				type: Boolean,
				default: false
			},
			bubbleText: {
				type: String,
				default: ''
			},
			size: {
				type: String,
				default: 'normal'
			}
		},
		computed: {
			shortName() {
				const name = String(this.nickname || '').trim()
				return name ? name.slice(0, 1) : '玩'
			},
			displayName() {
				const name = String(this.nickname || '').trim() || '玩家'
				return name.length <= 6 ? name : `${name.slice(0, 6)}…`
			},
			bodyGradient() {
				const index = Math.abs(Number(this.seatIndex) || 0) % BODY_GRADIENTS.length
				return BODY_GRADIENTS[index]
			}
		}
	}
</script>

<style>
	.player-figure {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.player-figure--offline {
		opacity: 0.6;
		filter: grayscale(0.8);
	}

	.player-figure__body {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		width: 72px;
		height: 62px;
		padding-top: 5px;
		border-radius: 36px 36px 14px 14px;
		box-shadow: 0 6px 14px rgba(60, 40, 30, 0.22);
	}

	.player-figure--small .player-figure__body {
		width: 56px;
		height: 50px;
		border-radius: 28px 28px 12px 12px;
	}

	.player-figure__head {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #fff7f1;
		border: 2px solid rgba(255, 255, 255, 0.85);
		overflow: hidden;
	}

	.player-figure--small .player-figure__head {
		width: 32px;
		height: 32px;
	}

	.player-figure__avatar-img {
		width: 100%;
		height: 100%;
	}

	.player-figure__avatar-text {
		font-size: 17px;
		font-weight: 700;
		color: #b05b48;
	}

	.player-figure--current .player-figure__body {
		box-shadow: 0 0 0 2px #ffe0c2, 0 6px 14px rgba(60, 40, 30, 0.26);
	}

	.player-figure__meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 6px;
	}

	.player-figure__name {
		font-size: 12px;
		font-weight: 600;
		color: #fff6ef;
		text-shadow: 0 1px 3px rgba(40, 20, 10, 0.5);
	}

	.player-figure__badges {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
	}

	.player-figure__role {
		padding: 1px 6px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.9);
	}

	.player-figure__role--landlord {
		background: #e76f51;
	}

	.player-figure__role-text {
		font-size: 9px;
		font-weight: 700;
		color: #8a4a34;
	}

	.player-figure__role--landlord .player-figure__role-text {
		color: #ffffff;
	}

	.player-figure__tag {
		padding: 1px 6px;
		border-radius: 999px;
	}

	.player-figure__tag--robot {
		background: #6cb8ff;
	}

	.player-figure__tag--trustee {
		background: #f5b544;
	}

	.player-figure__tag-text {
		font-size: 9px;
		color: #ffffff;
	}

	.player-figure__cards {
		margin-top: 4px;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(30, 45, 35, 0.55);
	}

	.player-figure__cards-text {
		font-size: 10px;
		color: #f6efe8;
	}

	.player-figure__bubble {
		position: absolute;
		top: -26px;
		min-width: 44px;
		max-width: 140px;
		padding: 4px 10px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 4px 10px rgba(40, 20, 10, 0.22);
	}

	.player-figure__bubble-text {
		font-size: 11px;
		color: #5d372b;
	}
</style>
