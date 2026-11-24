<template>
	<view class="noir-empty">
		<text v-if="kicker" class="noir-empty__kicker">{{ kicker }}</text>
		<text class="noir-empty__title">{{ title }}</text>
		<text v-if="desc" class="noir-empty__desc">{{ desc }}</text>
		<view v-if="actionText" class="noir-empty__act">
			<noir-button :text="actionText" variant="primary" size="sm" @click="$emit('action')" />
		</view>
	</view>
</template>

<script>
	export default {
		name: 'NoirEmpty',
		props: {
			kicker: {
				type: String,
				default: 'LOVENOTE · EMPTY'
			},
			title: {
				type: String,
				default: '这里还没有内容'
			},
			desc: {
				type: String,
				default: ''
			},
			actionText: {
				type: String,
				default: ''
			}
		},
		emits: ['action']
	}
</script>

<style scoped>
	.noir-empty {
		padding: 64rpx 36rpx;
		border-radius: 30rpx;
		border: 1rpx dashed rgba(216, 176, 140, 0.22);
		background: rgba(255, 255, 255, 0.024);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.noir-empty__kicker {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.62);
	}

	.noir-empty__title {
		margin-top: 14rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		color: var(--noir-text-strong);
	}

	.noir-empty__desc {
		margin-top: 12rpx;
		font-size: 24rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.46);
	}

	.noir-empty__act {
		margin-top: 26rpx;
	}
</style>
