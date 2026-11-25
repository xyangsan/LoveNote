<template>
	<button
		class="noir-btn"
		:class="[
			`noir-btn--${variant}`,
			`noir-btn--${size}`,
			{ 'noir-btn--block': block, 'is-disabled': disabled || loading }
		]"
		:disabled="disabled || loading"
		:open-type="openType"
		@tap="handleTap"
		@chooseavatar="$emit('chooseavatar', $event)"
	>
		<text v-if="loading" class="noir-btn__loading">···</text>
		<slot>
			<text class="noir-btn__text">{{ text }}</text>
		</slot>
	</button>
</template>

<script>
	export default {
		name: 'NoirButton',
		props: {
			text: {
				type: String,
				default: ''
			},
			variant: {
				type: String,
				default: 'primary' // primary | ghost | danger | pill
			},
			size: {
				type: String,
				default: 'md' // lg | md | sm | xs
			},
			block: {
				type: Boolean,
				default: false
			},
			loading: {
				type: Boolean,
				default: false
			},
			disabled: {
				type: Boolean,
				default: false
			},
			openType: {
				type: String,
				default: ''
			}
		},
		emits: ['click', 'chooseavatar'],
		methods: {
			handleTap(e) {
				if (this.disabled || this.loading) return
				this.$emit('click', e)
			}
		}
	}
</script>

<style scoped>
	.noir-btn {
		margin: 0;
		padding: 0 32rpx;
		border-radius: 999rpx;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10rpx;
		line-height: 1;
		letter-spacing: 2rpx;
		box-sizing: border-box;
		border: 1rpx solid transparent;
	}

	.noir-btn::after {
		border: none;
	}

	.noir-btn--block {
		display: flex;
		width: 100%;
	}

	.noir-btn--lg {
		height: 92rpx;
		font-size: 28rpx;
	}

	.noir-btn--md {
		height: 82rpx;
		font-size: 26rpx;
	}

	.noir-btn--sm {
		height: 66rpx;
		padding: 0 24rpx;
		font-size: 24rpx;
	}

	.noir-btn--xs {
		height: 52rpx;
		padding: 0 20rpx;
		font-size: 22rpx;
	}

	.noir-btn--primary {
		background: var(--noir-btn-gradient);
		color: var(--noir-text-warm);
		box-shadow: 0 14rpx 34rpx rgba(var(--noir-coral-rgb), 0.28);
		font-weight: 500;
	}

	.noir-btn--ghost {
		background: var(--noir-glass-1);
		border-color: rgba(var(--noir-gold-rgb), 0.28);
		color: rgba(var(--noir-text-rgb), 0.78);
	}

	.noir-btn--danger {
		background: rgba(var(--comp-05-rgb), 0.18);
		border-color: rgba(var(--comp-06-rgb), 0.56);
		color: var(--comp-09);
	}

	.noir-btn--pill {
		background: rgba(var(--noir-gold-rgb), 0.09);
		border-color: rgba(var(--noir-gold-rgb), 0.42);
		color: var(--noir-gold-soft);
	}

	.noir-btn.is-disabled {
		opacity: 0.42;
		box-shadow: none;
	}

	.noir-btn__text {
		color: inherit;
		font-size: inherit;
	}

	.noir-btn__loading {
		color: inherit;
		letter-spacing: 2rpx;
	}
</style>
