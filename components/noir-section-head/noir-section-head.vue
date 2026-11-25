<template>
	<view class="noir-sec-head">
		<view class="noir-sec-head__left">
			<text class="noir-sec-head__title">{{ title }}</text>
			<text v-if="kicker" class="noir-sec-head__kicker">{{ kicker }}</text>
		</view>
		<view v-if="action || $slots.right" class="noir-sec-head__right" @tap="$emit('action')">
			<slot name="right">
				<text class="noir-sec-head__action">{{ action }}</text>
			</slot>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'NoirSectionHead',
		props: {
			title: {
				type: String,
				default: ''
			},
			kicker: {
				type: String,
				default: ''
			},
			action: {
				type: String,
				default: ''
			}
		},
		emits: ['action']
	}
</script>

<style scoped>
	.noir-sec-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16rpx;
		margin: 26rpx 0 14rpx;
	}

	.noir-sec-head__left {
		display: flex;
		align-items: baseline;
		gap: 12rpx;
		min-width: 0;
	}

	.noir-sec-head__title {
		font-size: 26rpx;
		font-weight: 500;
		letter-spacing: 2rpx;
		color: rgba(var(--noir-text-rgb), 0.88);
	}

	.noir-sec-head__kicker {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 2rpx;
		color: rgba(var(--noir-gold-rgb), 0.56);
	}

	.noir-sec-head__action {
		font-size: 22rpx;
		color: rgba(var(--noir-gold-rgb), 0.72);
	}
</style>
