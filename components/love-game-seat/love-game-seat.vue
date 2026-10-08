<template>
	<view
		class="game-seat"
		:class="[
			'game-seat--' + size,
			{
				'game-seat--self': isSelf,
				'game-seat--speaker': isSpeaker,
				'game-seat--offline': !isOnline,
				'game-seat--out': isOut,
				'game-seat--selected': isSelected,
				'game-seat--clickable': clickable
			}
		]"
		@click="handleTap"
	>
		<view class="game-seat__avatar-wrap">
			<view class="game-seat__avatar">
				<image
					v-if="seat.avatarUrl"
					class="game-seat__avatar-img"
					:src="seat.avatarUrl"
					mode="aspectFill"
				></image>
				<text v-else class="game-seat__avatar-text">{{ shortName }}</text>
			</view>
			<view v-if="isHost" class="game-seat__badge game-seat__host">
				<text class="game-seat__host-icon">👑</text>
			</view>
			<view v-if="seat.isRobot" class="game-seat__badge game-seat__robot">
				<text class="game-seat__robot-text">AI</text>
			</view>
		</view>

		<text class="game-seat__name">{{ displayName }}</text>

		<view v-if="tagText" class="game-seat__tag-wrap">
			<uni-tag :text="tagText" size="small" :custom-style="tagStyle"></uni-tag>
		</view>

		<view v-else-if="showReady" class="game-seat__ready" :class="{ 'game-seat__ready--on': seat.ready }">
			<text class="game-seat__ready-text">{{ seat.ready ? '已准备' : '未准备' }}</text>
		</view>

		<text v-else-if="statusText" class="game-seat__status">{{ statusText }}</text>

		<text v-if="showScore" class="game-seat__score">{{ scoreText }}</text>
	</view>
</template>

<script>
	export default {
		name: 'LoveGameSeat',
		props: {
			seat: {
				type: Object,
				default: () => ({})
			},
			isSelf: {
				type: Boolean,
				default: false
			},
			isHost: {
				type: Boolean,
				default: false
			},
			isSpeaker: {
				type: Boolean,
				default: false
			},
			isAlive: {
				type: Boolean,
				default: true
			},
			isSelected: {
				type: Boolean,
				default: false
			},
			clickable: {
				type: Boolean,
				default: false
			},
			showReady: {
				type: Boolean,
				default: false
			},
			showScore: {
				type: Boolean,
				default: false
			},
			tagText: {
				type: String,
				default: ''
			},
			tagTone: {
				type: String,
				default: 'normal'
			},
			size: {
				type: String,
				default: 'normal'
			}
		},
		// 用独一无二的事件名，避免与原生 tap 撞名 → 触发两次（选中后被立即取消）
		emits: ['seat-tap'],
		computed: {
			shortName() {
				const name = String(this.seat.nickname || '').trim()
				return name ? name.slice(0, 1) : '玩'
			},
			displayName() {
				const name = String(this.seat.nickname || '').trim() || '等待加入'
				if (name.length <= 5) {
					return name
				}
				return `${name.slice(0, 5)}…`
			},
			isOnline() {
				return this.seat.online !== false
			},
			isOut() {
				return !this.isAlive || this.seat.seatStatus === 'out'
			},
			statusText() {
				if (!this.seat.uid && this.seat.nickname === undefined) {
					return ''
				}
				if (this.isOut) {
					return '已淘汰'
				}
				if (!this.isOnline) {
					const seconds = Number(this.seat.offlineSeconds || 0)
					return seconds > 0 ? `离线 ${seconds}s` : '离线'
				}
				if (this.seat.seatStatus === 'finished') {
					return '已完成'
				}
				return ''
			},
			scoreText() {
				const score = Number(this.seat.score || 0)
				if (!score) {
					return '0 分'
				}
				return score > 0 ? `+${score}` : `${score}`
			},
			/**
			 * uni-tag 默认色板是冷色（#8f939c / #45B7AF 等），与项目暖色主题冲突，
			 * 用 customStyle 覆盖回主题色；tone 只描述语义，具体色值在这里统一维护。
			 */
			tagStyle() {
				const TONES = {
					normal: { bg: 'rgba(255, 241, 235, 0.98)', border: 'rgba(231, 204, 194, 0.7)', color: '#b05b48' },
					win: { bg: 'rgba(255, 226, 205, 0.98)', border: 'rgba(231, 111, 81, 0.36)', color: '#b05b48' },
					warn: { bg: 'rgba(255, 240, 214, 0.98)', border: 'rgba(214, 158, 80, 0.4)', color: '#a8794a' },
					danger: { bg: 'rgba(255, 220, 214, 0.98)', border: 'rgba(200, 90, 70, 0.36)', color: '#b05b48' }
				}
				const tone = TONES[this.tagTone] || TONES.normal
				return [
					'display:inline-block',
					`background-color:${tone.bg}`,
					`border-color:${tone.border}`,
					`color:${tone.color}`,
					'font-size:20rpx',
					'font-weight:500',
					'line-height:1.5',
					'padding:2rpx 14rpx',
					'border-radius:999rpx',
					'box-shadow:0 6rpx 16rpx rgba(168, 110, 80, 0.18)'
				].join(';')
			}
		},
		methods: {
			handleTap() {
				if (!this.clickable) {
					return
				}
				this.$emit('seat-tap', this.seat)
			}
		}
	}
</script>

<style>
	.game-seat {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 35rpx 8rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 12rpx 30rpx rgba(168, 110, 80, 0.08);
		transition: all 0.18s ease;
	}

	.game-seat--small {
		padding: 35rpx 6rpx;
		border-radius: 22rpx;
	}

	.game-seat--self {
		background: rgba(255, 244, 236, 0.98);
	}

	.game-seat--speaker {
		box-shadow: 0 0 0 4rpx rgba(231, 111, 81, 0.5), 0 12rpx 30rpx rgba(168, 110, 80, 0.14);
	}

	.game-seat--selected {
		box-shadow: 0 0 0 5rpx #e76f51, 0 12rpx 30rpx rgba(231, 111, 81, 0.22);
	}

	.game-seat--offline {
		opacity: 0.62;
		filter: grayscale(0.75);
	}

	.game-seat--out {
		opacity: 0.5;
		filter: grayscale(0.9);
	}

	.game-seat--clickable {
		transform: translateY(0);
	}

	.game-seat__avatar-wrap {
		position: relative;
	}

	.game-seat__avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 96rpx;
		height: 96rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ffb37a 0%, #e76f51 100%);
		overflow: hidden;
	}

	.game-seat--small .game-seat__avatar {
		width: 76rpx;
		height: 76rpx;
	}

	.game-seat__avatar-img {
		width: 100%;
		height: 100%;
	}

	.game-seat__avatar-text {
		font-size: 34rpx;
		font-weight: 700;
		color: #ffffff;
	}

	/* 房主 / 机器人徽章**共用同一个位置**：头像右上角，整体倾斜 45°。
	   两个徽章同尺寸（见下 width/height），所以「同一 top/right + 同一 rotate」= 视觉上完全重合，
	   换位置或换角度只需动这一处。
	   两者在实际对局里也互斥 —— 房主只会是真人（服务层 pickNextHost 只在剩余真人 ≥ 2 时才转移房主，
	   只剩机器人时房间会直接解散），所以叠在同一个锚点上不会有冲突。 */
	.game-seat__badge {
		position: absolute;
		top: -2rpx;
		right: -8rpx;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		/* 同尺寸是「位置相同」的前提：尺寸不同 → 旋转中心不同 → 会错开几 rpx */
		width: 36rpx;
		height: 28rpx;
	}

	/* 房主：👑 皇冠（emoji 不响应 color / font-weight，只给字号） */
	.game-seat__host-icon {
		font-size: 26rpx;
		line-height: 1;
	}
	.game-seat__host {
		height: 30rpx;
		width: 30rpx;
		display: flex;
		align-items: self-start;
		justify-content: center;
		padding: 4rpx;
		top: -10rpx;
		right: -14rpx;
		transform: rotate(35deg);
		transform-origin: center center;
		border-radius: 50%;
		background-color: #ffffff;
	}

	/* 机器人：蓝色文字药丸（尺寸由 .game-seat__badge 统一给，这里只做观感） */
	.game-seat__robot {
		border-radius: 999rpx;
		background: #6cb8ff;
		box-shadow: 0 4rpx 10rpx rgba(108, 184, 255, 0.36);
	}

	.game-seat__robot-text {
		font-size: 18rpx;
		font-weight: 700;
		line-height: 1;
		color: #ffffff;
		white-space: nowrap;
	}

	.game-seat__name {
		display: block;
		max-width: 100%;
		margin-top: 8rpx;
		font-size: 25rpx;
		font-weight: 600;
		color: #5d372b;
		text-align: center;
	}

	.game-seat--small .game-seat__name {
		font-size: 23rpx;
	}

	/* 悬浮徽章：这里只负责定位，药丸外观与配色交给 uni-tag（见 computed tagStyle）。
	   绝对定位是为了脱离文档流、不参与撑高，保证同一行各席位卡片等高 */
	.game-seat__tag-wrap {
		position: absolute;
		left: 50%;
		bottom: -14rpx;
		z-index: 2;
		transform: translateX(-50%);
		white-space: nowrap;
	}

	.game-seat__ready {
		margin-top: 10rpx;
		padding: 4rpx 16rpx;
		border-radius: 999rpx;
		background: rgba(240, 240, 240, 0.96);
	}

	.game-seat__ready--on {
		background: rgba(255, 226, 205, 0.98);
	}

	.game-seat__ready-text {
		font-size: 20rpx;
		color: #a07d71;
	}

	.game-seat__ready--on .game-seat__ready-text {
		color: #b05b48;
	}

	.game-seat__status {
		display: block;
		margin-top: 8rpx;
		font-size: 20rpx;
		color: #b0a09a;
	}

	.game-seat__score {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		font-weight: 600;
		color: #c0674d;
	}
</style>
