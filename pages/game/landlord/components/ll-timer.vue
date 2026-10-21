<template>
	<view class="ll-timer" :class="{ 'll-timer--warn': isWarn, 'll-timer--danger': isDanger }">
		<text class="ll-timer__text">{{ displayText }}</text>
		<view v-if="showBar" class="ll-timer__bar">
			<view class="ll-timer__fill" :style="{ width: percent + '%' }"></view>
		</view>
	</view>
</template>

<script>
	/**
	 * QQ 三人斗地主的服务端权威倒计时。
	 *
	 * 关键点：剩余时间必须用「服务端时间」计算。
	 * serverOffset = 某次同步返回的 serverTime - 当时的本地 Date.now()，
	 * 之后用 本地时间 + serverOffset 外推，避免手机时钟偏差让倒计时错乱。
	 *
	 * 与旧 love-game-timer 的区别：纯视觉皮肤对齐 QQ 牌桌（白底胶囊 + 暖橙进度条，
	 * 警告 / 危险态走 QQ 的黄 / 红），逻辑（200ms 轮询 + deadline 重置）保持一致。
	 */
	export default {
		name: 'LlTimer',
		props: {
			/** 服务端下发的回合截止时间戳（毫秒） */
			deadline: { type: Number, default: 0 },
			/** serverTime - Date.now()，由同步层校时得到 */
			serverOffset: { type: Number, default: 0 },
			/** 本回合总时长（毫秒），用于进度条 */
			total: { type: Number, default: 20000 },
			warnSeconds: { type: Number, default: 5 },
			showBar: { type: Boolean, default: false },
			/** 已过期时的占位文案（服务端正在推进时用） */
			expiredText: { type: String, default: '推进中' }
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
	/* 横屏页面：px 单位 */
	.ll-timer {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		padding: 3px 10px 5px;
		border-radius: 999px;
		background: rgba(255, 250, 244, 0.96);
		box-shadow: 0 2px 6px rgba(12, 36, 22, 0.28);
		position: relative;
	}

	.ll-timer--warn {
		background: rgba(255, 236, 168, 0.98);
	}

	.ll-timer--danger {
		background: rgba(255, 210, 200, 0.98);
	}

	.ll-timer__text {
		font-size: 12px;
		font-weight: 700;
		color: #c0674d;
	}

	.ll-timer--warn .ll-timer__text {
		color: #d8642f;
	}

	.ll-timer--danger .ll-timer__text {
		color: #b8412c;
	}

	.ll-timer__bar {
		bottom: 1px;
		position: absolute;
		left: 12px;
		right: 12px;
		height: 3px;
		margin-top: 3px;
		border-radius: 999px;
		background: rgba(179, 158, 150, 0.7);
		overflow: hidden;
	}

	.ll-timer__fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(135deg, #ffb84d 0%, #f59b2a 100%);
		transition: width 0.2s linear;
	}
</style>
