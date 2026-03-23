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
		<slot></slot>
		<template #footer>
			<slot name="footer"></slot>
		</template>
	</fui-card>
</template>

<script>
	const DEFAULT_BACKGROUND = 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 246, 239, 0.96))'
	const DEFAULT_SHADOW = '0 20rpx 50rpx rgba(177, 114, 83, 0.1)'

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
				default: '#5d372b'
			},
			tagSize: {
				type: [Number, String],
				default: 22
			},
			tagColor: {
				type: String,
				default: '#b8604c'
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
</style>
