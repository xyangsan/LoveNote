<template>
	<view
		class="noir-tag"
		:class="[`noir-tag--${variant}`, { 'is-active': active }]"
		@tap="$emit('click', $event)"
	>
		<slot>
			<text class="noir-tag__text">{{ text }}</text>
		</slot>
	</view>
</template>

<script>
	export default {
		name: 'NoirTag',
		props: {
			text: {
				type: String,
				default: ''
			},
			variant: {
				type: String,
				default: 'gold' // gold | coral | green | muted | chip
			},
			active: {
				type: Boolean,
				default: false
			}
		},
		emits: ['click']
	}
</script>

<style scoped>
	.noir-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 40rpx;
		padding: 0 16rpx;
		border-radius: 999rpx;
		font-size: 20rpx;
		letter-spacing: 1rpx;
		white-space: nowrap;
		box-sizing: border-box;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.34);
		background: rgba(var(--noir-gold-rgb), 0.10);
		color: var(--noir-gold-soft);
	}

	.noir-tag--coral {
		border-color: rgba(var(--noir-coral-rgb), 0.46);
		background: rgba(var(--noir-coral-rgb), 0.16);
		color: var(--noir-coral-light);
	}

	.noir-tag--green {
		border-color: rgba(var(--noir-green-rgb), 0.40);
		background: rgba(var(--noir-green-rgb), 0.12);
		color: var(--noir-green);
	}

	.noir-tag--muted {
		border-color: rgba(var(--noir-wash-rgb), 0.14);
		background: var(--noir-glass-2);
		color: rgba(var(--noir-text-rgb), 0.50);
	}

	.noir-tag--chip {
		height: 52rpx;
		padding: 0 24rpx;
		font-size: 22rpx;
		border-color: rgba(var(--noir-text-rgb), 0.14);
		background: transparent;
		color: rgba(var(--noir-text-rgb), 0.52);
	}

	.noir-tag--chip.is-active {
		border-color: rgba(var(--noir-gold-rgb), 0.52);
		background: rgba(var(--noir-gold-rgb), 0.14);
		color: var(--noir-text-strong);
	}

	.noir-tag__text {
		color: inherit;
		font-size: inherit;
		line-height: 1;
	}
</style>
