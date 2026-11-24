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
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(216, 176, 140, 0.10);
		color: var(--noir-gold-soft);
	}

	.noir-tag--coral {
		border-color: rgba(226, 100, 63, 0.46);
		background: rgba(226, 100, 63, 0.16);
		color: var(--noir-coral-light);
	}

	.noir-tag--green {
		border-color: rgba(158, 214, 178, 0.40);
		background: rgba(158, 214, 178, 0.12);
		color: var(--noir-green);
	}

	.noir-tag--muted {
		border-color: rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.04);
		color: rgba(245, 237, 228, 0.50);
	}

	.noir-tag--chip {
		height: 52rpx;
		padding: 0 24rpx;
		font-size: 22rpx;
		border-color: rgba(245, 237, 228, 0.14);
		background: transparent;
		color: rgba(245, 237, 228, 0.52);
	}

	.noir-tag--chip.is-active {
		border-color: rgba(216, 176, 140, 0.52);
		background: rgba(216, 176, 140, 0.14);
		color: var(--noir-text-strong);
	}

	.noir-tag__text {
		color: inherit;
		font-size: inherit;
		line-height: 1;
	}
</style>
