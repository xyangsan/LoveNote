<template>
	<view v-if="show" class="game-result">
		<view class="game-result__mask" @click="handleMask"></view>
		<view class="game-result__panel">
			<view class="game-result__hero" :class="'game-result__hero--' + tone">
				<text class="game-result__emoji">{{ emoji }}</text>
				<text class="game-result__title">{{ title }}</text>
				<text v-if="subtitle" class="game-result__subtitle">{{ subtitle }}</text>
			</view>

			<view v-if="lines.length" class="game-result__lines">
				<view v-for="(item, index) in lines" :key="index" class="game-result__line">
					<text class="game-result__line-label">{{ item.label }}</text>
					<text
						class="game-result__line-value"
						:class="{ 'game-result__line-value--highlight': item.highlight }"
					>{{ item.value }}</text>
				</view>
			</view>

			<view v-if="players.length" class="game-result__players">
				<view
					v-for="(item, index) in players"
					:key="index"
					class="game-result__player"
					:class="{ 'game-result__player--self': item.isSelf }"
				>
					<view class="game-result__avatar">
						<image v-if="item.avatarUrl" class="game-result__avatar-img" :src="item.avatarUrl" mode="aspectFill"></image>
						<text v-else class="game-result__avatar-text">{{ shortName(item.nickname) }}</text>
					</view>
					<view class="game-result__player-body">
						<text class="game-result__player-name">
							{{ item.nickname || '玩家' }}<text v-if="item.isSelf" class="game-result__self-flag">（我）</text>
						</text>
						<text v-if="item.roleText" class="game-result__player-role">{{ item.roleText }}</text>
					</view>
					<text
						v-if="item.scoreText"
						class="game-result__player-score"
						:class="{
							'game-result__player-score--win': item.result === 'win',
							'game-result__player-score--lose': item.result === 'lose'
						}"
					>{{ item.scoreText }}</text>
				</view>
			</view>

			<view v-if="tips" class="game-result__tips">
				<text class="game-result__tips-text">{{ tips }}</text>
			</view>

			<view class="game-result__actions">
				<view v-if="secondaryText" class="game-result__action" @click="handleSecondary">
					<text class="game-result__action-text game-result__action-text--ghost">{{ secondaryText }}</text>
				</view>
				<view class="game-result__action game-result__action--primary" @click="handlePrimary">
					<text class="game-result__action-text">{{ primaryText }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'LoveGameResultDialog',
		props: {
			show: {
				type: Boolean,
				default: false
			},
			/** success / fail / draw，仅影响头部配色 */
			tone: {
				type: String,
				default: 'success'
			},
			emoji: {
				type: String,
				default: '🎉'
			},
			title: {
				type: String,
				default: '本局结束'
			},
			subtitle: {
				type: String,
				default: ''
			},
			/** [{ label, value, highlight }] */
			lines: {
				type: Array,
				default: () => []
			},
			/** [{ nickname, avatarUrl, roleText, scoreText, result, isSelf }] */
			players: {
				type: Array,
				default: () => []
			},
			tips: {
				type: String,
				default: ''
			},
			primaryText: {
				type: String,
				default: '再来一局'
			},
			secondaryText: {
				type: String,
				default: '返回大厅'
			},
			maskClosable: {
				type: Boolean,
				default: false
			}
		},
		emits: ['close', 'primary', 'secondary'],
		methods: {
			shortName(name = '') {
				const text = String(name || '').trim()
				return text ? text.slice(0, 1) : '玩'
			},
			handleMask() {
				if (this.maskClosable) {
					this.$emit('close')
				}
			},
			handlePrimary() {
				this.$emit('primary')
			},
			handleSecondary() {
				this.$emit('secondary')
			}
		}
	}
</script>

<style>
	.game-result {
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

	.game-result__mask {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(58, 32, 24, 0.45);
	}

	.game-result__panel {
		position: relative;
		z-index: 1;
		box-sizing: border-box;
		width: 620rpx;
		max-height: 84vh;
		padding: 0 32rpx 32rpx;
		border-radius: 36rpx;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.99), rgba(255, 246, 239, 0.98));
		box-shadow: 0 24rpx 60rpx rgba(120, 70, 50, 0.22);
		overflow: hidden;
	}

	.game-result__hero {
		padding: 38rpx 0 26rpx;
		text-align: center;
	}

	.game-result__emoji {
		display: block;
		font-size: 76rpx;
		line-height: 1;
	}

	.game-result__title {
		display: block;
		margin-top: 18rpx;
		font-size: 40rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.game-result__subtitle {
		display: block;
		margin-top: 12rpx;
		font-size: 25rpx;
		line-height: 1.6;
		color: #8b6659;
	}

	.game-result__lines {
		padding: 18rpx 24rpx;
		border-radius: 26rpx;
		background: rgba(255, 247, 241, 0.96);
	}

	.game-result__line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10rpx 0;
	}

	.game-result__line-label {
		font-size: 25rpx;
		color: #917165;
	}

	.game-result__line-value {
		font-size: 27rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.game-result__line-value--highlight {
		color: #c0674d;
	}

	.game-result__players {
		max-height: 40vh;
		margin-top: 20rpx;
		overflow: hidden;
	}

	.game-result__player {
		display: flex;
		align-items: center;
		gap: 16rpx;
		padding: 14rpx 20rpx;
		border-radius: 24rpx;
		background: rgba(255, 255, 255, 0.92);
	}

	.game-result__player + .game-result__player {
		margin-top: 12rpx;
	}

	.game-result__player--self {
		background: rgba(255, 240, 232, 0.96);
	}

	.game-result__avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ffb37a 0%, #e76f51 100%);
		overflow: hidden;
	}

	.game-result__avatar-img {
		width: 100%;
		height: 100%;
	}

	.game-result__avatar-text {
		font-size: 26rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.game-result__player-body {
		flex: 1;
		min-width: 0;
	}

	.game-result__player-name {
		display: block;
		font-size: 27rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.game-result__self-flag {
		font-size: 22rpx;
		font-weight: 400;
		color: #b8604c;
	}

	.game-result__player-role {
		display: block;
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #a07d71;
	}

	.game-result__player-score {
		font-size: 28rpx;
		font-weight: 700;
		color: #a07d71;
	}

	.game-result__player-score--win {
		color: #c0674d;
	}

	.game-result__player-score--lose {
		color: #7f9b8e;
	}

	.game-result__tips {
		margin-top: 18rpx;
		padding: 16rpx 20rpx;
		border-radius: 20rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.game-result__tips-text {
		font-size: 23rpx;
		line-height: 1.6;
		color: #936d62;
	}

	.game-result__actions {
		display: flex;
		gap: 18rpx;
		margin-top: 26rpx;
	}

	.game-result__action {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		border-radius: 999rpx;
		background: rgba(255, 241, 235, 0.96);
	}

	.game-result__action--primary {
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 14rpx 26rpx rgba(231, 111, 81, 0.26);
	}

	.game-result__action-text {
		font-size: 28rpx;
		font-weight: 600;
		color: #ffffff;
	}

	.game-result__action-text--ghost {
		color: #b05b48;
	}
</style>
