<template>
	<fui-card
		class="love-glass-card"
		:margin="margin"
		:padding="padding"
		:radius="radius"
		:background="background"
		:shadow="shadow"
		:title="title"
		:tag="tag"
		:size="size"
		:color="color"
		:tag-size="tagSize"
		:tag-color="tagColor"
		:header-line="headerLine"
		:footer-line="footerLine"
		:show-border="showBorder"
		:full="full"
		@click="handleClick"
	>
		<view class="love-glass-card__content" :style="contentStyle">
			<slot></slot>
		</view>
		<template #footer>
			<slot name="footer"></slot>
		</template>
	</fui-card>
</template>

<script>
	const DEFAULT_BACKGROUND = 'linear-gradient(145deg, rgba(30, 24, 20, 0.96), rgba(22, 17, 14, 0.96))'
	const DEFAULT_SHADOW = '0 18rpx 44rpx rgba(var(--noir-shadow-rgb), 0.42)'

	export default {
		name: 'love-glass-card',
		props: {
			margin: {
				type: Array,
				default() {
					return ['0', '0', '0', '0']
				}
			},
			padding: {
				type: Array,
				default() {
					return ['28rpx', '34rpx', '20rpx', '34rpx']
				}
			},
			contentPadding: {
				type: Array,
				default() {
					return ['28rpx', '34rpx', '32rpx', '34rpx']
				}
			},
			radius: {
				type: String,
				default: '36rpx'
			},
			background: {
				type: String,
				default: DEFAULT_BACKGROUND
			},
			shadow: {
				type: String,
				default: DEFAULT_SHADOW
			},
			title: {
				type: String,
				default: ''
			},
			tag: {
				type: String,
				default: ''
			},
			size: {
				type: [Number, String],
				default: 32
			},
			color: {
				type: String,
				default: 'var(--noir-text-strong)'
			},
			tagSize: {
				type: [Number, String],
				default: 22
			},
			tagColor: {
				type: String,
				default: 'var(--noir-gold)'
			},
			headerLine: {
				type: Boolean,
				default: true
			},
			footerLine: {
				type: Boolean,
				default: false
			},
			showBorder: {
				type: Boolean,
				default: false
			},
			full: {
				type: Boolean,
				default: false
			}
		},
		computed: {
			contentStyle() {
				const padding = this.contentPadding || []
				return {
					paddingTop: padding[0] || 0,
					paddingRight: padding[1] || 0,
					paddingBottom: padding[2] || padding[0] || 0,
					paddingLeft: padding[3] || padding[1] || 0
				}
			}
		},
		methods: {
			handleClick(event) {
				this.$emit('click', event)
			}
		}
	}
</script>

<style scoped>
	.love-glass-card {
		position: relative;
		z-index: 1;
	}

	.love-glass-card :deep(.fui-card__wrap) {
		border: 1rpx solid var(--noir-border);
		backdrop-filter: blur(18rpx);
		-webkit-backdrop-filter: blur(18rpx);
	}

	.love-glass-card :deep(.fui-card__header) {
		background: linear-gradient(180deg, rgba(var(--noir-gold-rgb), 0.08), var(--noir-glass-1));
		border-bottom-color: rgba(var(--noir-wash-rgb), 0.06);
	}

	.love-glass-card__content {
		position: relative;
		box-sizing: border-box;
		min-width: 0;
	}
</style>
