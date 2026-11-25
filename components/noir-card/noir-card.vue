<template>
	<view
		class="noir-card"
		:class="[`noir-card--${variant}`, { 'is-clickable': clickable }]"
		:style="cardStyle"
		@tap="handleTap"
	>
		<view v-if="kicker || title || extra || $slots.header" class="noir-card__head">
			<slot name="header">
				<view class="noir-card__head-left">
					<text v-if="kicker" class="noir-card__kicker">{{ kicker }}</text>
					<text v-if="title" class="noir-card__title">{{ title }}</text>
				</view>
				<text v-if="extra" class="noir-card__extra">{{ extra }}</text>
			</slot>
		</view>
		<view class="noir-card__body">
			<slot></slot>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'NoirCard',
		props: {
			variant: {
				type: String,
				default: 'default' // default | hero | dashed | danger
			},
			kicker: {
				type: String,
				default: ''
			},
			title: {
				type: String,
				default: ''
			},
			extra: {
				type: String,
				default: ''
			},
			padding: {
				type: String,
				default: '26rpx 28rpx'
			},
			radius: {
				type: String,
				default: '30rpx'
			},
			clickable: {
				type: Boolean,
				default: false
			}
		},
		emits: ['click'],
		computed: {
			cardStyle() {
				return {
					padding: this.padding,
					borderRadius: this.radius
				}
			}
		},
		methods: {
			handleTap(e) {
				this.$emit('click', e)
			}
		}
	}
</script>

<style scoped>
	.noir-card {
		position: relative;
		box-sizing: border-box;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
	}

	.noir-card--hero {
		border-color: var(--noir-border-gold);
		background: linear-gradient(135deg, rgba(var(--noir-coral-rgb), 0.16) 0%, var(--noir-glass-1) 100%);
	}

	.noir-card--dashed {
		border-style: dashed;
		border-color: rgba(var(--noir-gold-rgb), 0.28);
		background: rgba(var(--noir-gold-rgb), 0.045);
	}

	.noir-card--danger {
		border-color: rgba(var(--noir-coral-rgb), 0.36);
		background: rgba(var(--noir-coral-rgb), 0.08);
	}

	.noir-card.is-clickable:active {
		opacity: 0.92;
		transform: scale(0.994);
	}

	.noir-card__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16rpx;
		margin-bottom: 16rpx;
	}

	.noir-card__head-left {
		display: flex;
		flex-direction: column;
		gap: 4rpx;
		min-width: 0;
	}

	.noir-card__kicker {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 3rpx;
		color: rgba(var(--noir-gold-rgb), 0.72);
	}

	.noir-card__title {
		font-size: 26rpx;
		font-weight: 500;
		color: var(--noir-text-strong);
	}

	.noir-card__extra {
		font-size: 22rpx;
		color: rgba(var(--noir-gold-rgb), 0.72);
		flex-shrink: 0;
	}
</style>
