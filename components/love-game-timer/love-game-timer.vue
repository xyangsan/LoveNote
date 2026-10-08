<template>
	<view class="game-timer" :class="{ 'game-timer--warn': isWarn, 'game-timer--danger': isDanger }">
		<text class="game-timer__text">{{ displayText }}</text>
		<view v-if="showBar" class="game-timer__bar">
			<view class="game-timer__fill" :style="{ width: percent + '%' }"></view>
		</view>
	</view>
</template>

<script>
	/**
	 * 服务端权威倒计时
	 *
	 * 关键点：剩余时间必须用「服务端时间」计算。
	 * serverOffset = 某次同步返回的 serverTime - 当时的本地 Date.now()，
	 * 之后用 本地时间 + serverOffset 外推，避免手机时钟偏差让倒计时错乱。
	 */
	export default {
		name: 'LoveGameTimer',
		props: {
			/** 服务端下发的回合截止时间戳（毫秒） */
			deadline: {
				type: Number,
				default: 0
			},
			/** serverTime - Date.now()，由同步层校时得到 */
			serverOffset: {
				type: Number,
				default: 0
			},
			/** 本回合总时长（毫秒），用于进度条 */
			total: {
				type: Number,
				default: 20000
			},
			warnSeconds: {
				type: Number,
				default: 5
			},
			showBar: {
				type: Boolean,
				default: false
			},
			/** 已过期时的占位文案（服务端正在推进时用） */
			expiredText: {
				type: String,
				default: '推进中'
			}
		},
		emits: ['timeout'],
		data() {
			return {
				remainingMs: 0,
				fired: false,
				timer: null
			}
		},
		computed: {
			remainingSeconds() {
				return Math.max(0, Math.ceil(this.remainingMs / 1000))
			},
			isExpired() {
				return Number(this.deadline || 0) > 0 && this.remainingMs <= 0
			},
			isWarn() {
				return !this.isExpired && this.remainingSeconds <= this.warnSeconds
			},
			isDanger() {
				return this.isExpired
			},
			displayText() {
				if (!this.deadline) {
					return '--'
				}
				if (this.isExpired) {
					return this.expiredText
				}
				return `${this.remainingSeconds}s`
			},
			percent() {
				const total = Math.max(1, Number(this.total || 1))
				const ratio = Math.max(0, Math.min(1, this.remainingMs / total))
				return Math.round(ratio * 100)
			}
		},
		watch: {
			deadline() {
				this.fired = false
				this.tick()
			}
		},
		created() {
			this.tick()
			this.timer = setInterval(() => this.tick(), 200)
		},
		beforeDestroy() {
			this.clearTimer()
		},
		methods: {
			clearTimer() {
				if (this.timer) {
					clearInterval(this.timer)
					this.timer = null
				}
			},
			serverNow() {
				return Date.now() + Number(this.serverOffset || 0)
			},
			tick() {
				const deadline = Number(this.deadline || 0)
				if (!deadline) {
					this.remainingMs = 0
					return
				}
				this.remainingMs = deadline - this.serverNow()
				if (this.remainingMs <= 0 && !this.fired) {
					this.fired = true
					this.$emit('timeout')
				}
			}
		}
	}
</script>

<style>
	.game-timer {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 80rpx;
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.game-timer--warn {
		background: rgba(255, 236, 214, 0.98);
	}

	.game-timer--danger {
		background: rgba(255, 222, 214, 0.98);
	}

	.game-timer__text {
		font-size: 24rpx;
		font-weight: 700;
		color: #c0674d;
	}

	.game-timer--warn .game-timer__text {
		color: #d8642f;
	}

	.game-timer--danger .game-timer__text {
		color: #b8412c;
	}

	.game-timer__bar {
		width: 100%;
		height: 6rpx;
		margin-top: 6rpx;
		border-radius: 999rpx;
		background: rgba(231, 204, 194, 0.7);
		overflow: hidden;
	}

	.game-timer__fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(135deg, #ff9c74 0%, #f48c63 100%);
		transition: width 0.2s linear;
	}
</style>
