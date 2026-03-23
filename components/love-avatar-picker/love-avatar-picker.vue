<template>
	<!-- #ifdef MP-WEIXIN -->
	<button class="love-avatar-picker" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
		<view class="love-avatar-picker__frame" :style="styles">
			<fui-avatar
				class="love-avatar-picker__avatar"
				:src="src"
				:error-src="fallback"
				:width="width"
				:height="height"
				background="#fff1eb"
			></fui-avatar>
		</view>
		<text class="love-avatar-picker__label">{{ label }}</text>
	</button>
	<!-- #endif -->

	<!-- #ifndef MP-WEIXIN -->
	<view class="love-avatar-picker">
		<view class="love-avatar-picker__frame" :style="styles">
			<fui-avatar
				class="love-avatar-picker__avatar"
				:src="src"
				:error-src="fallback"
				:width="width"
				:height="height"
				background="#fff1eb"
			></fui-avatar>
		</view>
		<text class="love-avatar-picker__label">{{ label }}</text>
	</view>
	<!-- #endif -->
</template>

<script>
	export default {
		name: 'love-avatar-picker',
		props: {
			src: {
				type: String,
				default: ''
			},
			fallback: {
				type: String,
				default: '/static/logo.png'
			},
			label: {
				type: String,
				default: '选择头像'
			},
			//图片圆角值，默认使用shape，当设置大于等于0的数值，shape失效
			radius: {
				type: [Number, String],
				default: -1
			},
			width: {
				type: [Number, String],
				default: 132
			},
			height: {
				type: [Number, String],
				default: 132
			}
		},
		computed: {
			styles() {
				let styles = '';
				if (this.width) {
					styles = `width:${this.width}rpx;height:${this.height || this.width}rpx;`
				}
				if (this.radius !== -1) {
					styles += `border-radius:${this.radius}rpx;`
				}
				return styles;
			}
		},
		methods: {
			handleChooseAvatar(event) {
				this.$emit('chooseavatar', event)
			}
		}
	}
</script>

<style scoped>
	.love-avatar-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 0;
		background: transparent;
	}

	.love-avatar-picker::after {
		border: 0;
	}

	.love-avatar-picker__frame {
		padding: 6rpx;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.56);
		box-shadow: 0 14rpx 26rpx rgba(177, 114, 83, 0.14);
	}

	.love-avatar-picker__avatar {
		display: block;
	}

	.love-avatar-picker__label {
		margin-top: 16rpx;
		font-size: 22rpx;
		color: #a17567;
	}
</style>
