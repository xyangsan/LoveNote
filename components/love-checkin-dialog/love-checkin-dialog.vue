<template>
	<view v-if="visible" class="checkin-mask" @click="handleMaskTap" @touchmove.stop.prevent>
		<view class="checkin-dialog" @click.stop>
			<!-- 头部：珊瑚红渐变 + 右下角半透明大心，只做氛围不抢标题 -->
			<view class="checkin-hd">
				<image
					class="checkin-hd__deco"
					src="/static/images/points/heart_white.png"
					mode="aspectFit"
				></image>

				<view class="checkin-hd__close" @click="handleClose">
					<text class="checkin-hd__close-icon">×</text>
				</view>

				<view class="checkin-hd__title">
					<image
						class="checkin-hd__title-heart"
						src="/static/images/points/heart_white.png"
						mode="aspectFit"
					></image>
					<text class="checkin-hd__title-text">每日签到</text>
				</view>

				<text class="checkin-hd__sub">{{ subtitle }}</text>
			</view>

			<view class="checkin-body">
				<!-- 七天进度：已完成 / 今天 / 还没到 -->
				<view class="checkin-days">
					<view
						v-for="item in dayList"
						:key="item.day"
						class="checkin-day"
						:class="'checkin-day--' + item.state"
					>
						<text class="checkin-day__num">{{ item.day }}</text>
						<image class="checkin-day__heart" :src="item.heart" mode="aspectFit"></image>
						<text class="checkin-day__points">+{{ item.points }}</text>
					</view>
				</view>

				<view class="checkin-actions">
					<view
						class="checkin-btn"
						:class="{ 'checkin-btn--disabled': todayChecked || loading }"
						@click="handleClaim"
					>
						<text class="checkin-btn__text">{{ claimText }}</text>
					</view>
				</view>

				<text class="checkin-tip">{{ tipText }}</text>

				<view class="checkin-ad">
					<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	const HEART_WHITE = '/static/images/points/heart_white.png'
	const HEART_RED = '/static/images/points/red_heart.png'
	const HEART_GRAY = '/static/images/points/gray_heart.png'

	/** 一轮固定 7 格：超过 7 天时整排都是已完成，额外收益靠连续加成 */
	const CYCLE_DAYS = 7

	export default {
		name: 'love-checkin-dialog',
		props: {
			visible: {
				type: Boolean,
				default: false
			},
			/** 当前连续天数（今天没签时 = 截至昨天的连续） */
			streak: {
				type: Number,
				default: 0
			},
			/** 今天落在七天周期里的第几格（1-7），由服务端算好传进来 */
			cycleDay: {
				type: Number,
				default: 1
			},
			todayChecked: {
				type: Boolean,
				default: false
			},
			/** 今天直接签可得 */
			signPoints: {
				type: Number,
				default: 10
			},
			/** 七格奖励：[{ day: 1, points: 10 }]，缺项按 0 显示 */
			tiers: {
				type: Array,
				default() {
					return []
				}
			},
			loading: {
				type: Boolean,
				default: false
			}
		},
		computed: {
			currentDay() {
				return Math.min(CYCLE_DAYS, Math.max(1, Number(this.cycleDay || 1)))
			},
			dayList() {
				const list = []
				for (let day = 1; day <= CYCLE_DAYS; day += 1) {
					const tier = (this.tiers || []).find((item) => Number(item.day) === day)
					let state = 'future'
					if (day < this.currentDay) {
						state = 'done'
					} else if (day === this.currentDay) {
						state = this.todayChecked ? 'done' : 'today'
					}
					list.push({
						day,
						points: tier ? Number(tier.points || 0) : 0,
						state,
						heart: state === 'done'
							? HEART_RED
							: (state === 'today' ? HEART_WHITE : HEART_GRAY)
					})
				}
				return list
			},
			subtitle() {
				if (this.todayChecked) {
					return `今天已签到，已连续 ${Math.max(1, Number(this.streak || 0))} 天`
				}
				return `本轮第 ${this.currentDay} 天，签到得 ${this.signPoints} 点`
			},
			claimText() {
				if (this.todayChecked) {
					return '今天已签到'
				}
				if (this.loading) {
					return '签到中...'
				}
				return `领取 +${this.signPoints}`
			},
			tipText() {
				return '连续签到 7 天可得 100 心动点，断签从第 1 天重算'
			}
		},
		methods: {
			handleMaskTap() {
				this.$emit('close')
			},
			handleClose() {
				this.$emit('close')
			},
			handleClaim() {
				if (this.todayChecked || this.loading) {
					return
				}
				this.$emit('claim')
			}
		}
	}
</script>

<style>
	.checkin-mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 95;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(8, 6, 5, 0.74);
		animation: checkin-fade 0.2s ease-out;
	}

	.checkin-dialog {
		position: relative;
		width: 660rpx;
		border-radius: 36rpx;
		overflow: hidden;
		border: 1rpx solid rgba(216, 176, 140, 0.26);
		background: linear-gradient(160deg, #231B16 0%, #16110E 100%);
		box-shadow: 0 36rpx 80rpx rgba(0, 0, 0, 0.62);
		animation: checkin-pop 0.26s cubic-bezier(0.2, 0.9, 0.3, 1.2);
	}

	.checkin-hd {
		position: relative;
		height: 184rpx;
		padding: 32rpx 36rpx 0;
		overflow: hidden;
		background: linear-gradient(135deg, rgba(226, 124, 78, 0.26) 0%, rgba(216, 176, 140, 0.1) 100%);
		border-bottom: 1rpx solid rgba(216, 176, 140, 0.16);
	}

	/* 装饰心：压到右下角再溢出裁掉，只留一个弧形轮廓 */
	.checkin-hd__deco {
		position: absolute;
		right: -28rpx;
		bottom: -32rpx;
		width: 192rpx;
		height: 176rpx;
		opacity: 0.16;
		pointer-events: none;
	}

	.checkin-hd__close {
		position: absolute;
		right: 24rpx;
		top: 24rpx;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48rpx;
		height: 48rpx;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.26);
	}

	.checkin-hd__close-icon {
		font-size: 30rpx;
		line-height: 1;
		color: #ffffff;
	}

	.checkin-hd__title {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
	}

	.checkin-hd__title-heart {
		width: 36rpx;
		height: 32rpx;
		margin-right: 14rpx;
		flex-shrink: 0;
	}

	.checkin-hd__title-text {
		font-size: 36rpx;
		font-weight: 600;
		color: #ffffff;
	}

	.checkin-hd__sub {
		position: relative;
		z-index: 1;
		display: block;
		margin-top: 14rpx;
		padding-right: 80rpx;
		font-size: 24rpx;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.86);
	}

	.checkin-body {
		padding: 32rpx 32rpx 30rpx;
	}

	.checkin-days {
		display: flex;
		gap: 8rpx;
	}

	.checkin-day {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		height: 116rpx;
		padding: 14rpx 0 12rpx;
		border-radius: 20rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}

	.checkin-day__num {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		line-height: 1;
		color: rgba(245, 237, 228, 0.44);
	}

	.checkin-day__heart {
		width: 30rpx;
		height: 28rpx;
		margin: 10rpx 0 8rpx;
	}

	.checkin-day__points {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		font-weight: 500;
		line-height: 1;
		color: rgba(245, 237, 228, 0.62);
	}

	.checkin-day--done {
		border-color: rgba(216, 176, 140, 0.42);
		background: rgba(216, 176, 140, 0.14);
	}

	.checkin-day--done .checkin-day__num {
		color: #D8B08C;
	}

	.checkin-day--done .checkin-day__points {
		color: #FBF4EA;
	}

	/* 今日是唯一的行动点，视觉必须最重 */
	.checkin-day--today {
		border-color: rgba(226, 100, 63, 0.62);
		background: linear-gradient(145deg, rgba(240, 154, 107, 0.28), rgba(222, 95, 60, 0.24));
		box-shadow: 0 10rpx 24rpx rgba(222, 95, 60, 0.24);
	}

	.checkin-day--today .checkin-day__num {
		color: #FBF4EA;
	}

	.checkin-day--today .checkin-day__points {
		color: #FFF7EF;
	}

	.checkin-actions {
		display: flex;
		gap: 20rpx;
		margin-top: 32rpx;
	}

	.checkin-btn {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		height: 92rpx;
		border-radius: 46rpx;
		background: linear-gradient(135deg, #F09A6B 0%, #DE5F3C 100%);
		box-shadow: 0 14rpx 32rpx rgba(222, 95, 60, 0.30);
	}

	.checkin-btn__text {
		font-size: 28rpx;
		font-weight: 500;
		letter-spacing: 2rpx;
		color: #FFF7EF;
	}

	.checkin-btn--disabled {
		opacity: 0.45;
		box-shadow: none;
	}

	.checkin-tip {
		display: block;
		margin-top: 20rpx;
		text-align: center;
		font-size: 22rpx;
		line-height: 1.5;
		color: rgba(245, 237, 228, 0.44);
	}

	.checkin-ad {
		margin-top: 22rpx;
		border-radius: 18rpx;
		overflow: hidden;
	}

	@keyframes checkin-fade {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	@keyframes checkin-pop {
		from {
			opacity: 0;
			transform: scale(0.92);
		}

		to {
			opacity: 1;
			transform: scale(1);
		}
	}
</style>
