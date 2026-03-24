<template>
	<fui-card
		:margin="margin"
		background="rgba(255, 250, 247, 0.96)"
		radius="32rpx"
		shadow="0 20rpx 48rpx rgba(192, 120, 92, 0.12)"
		:padding="['0', '0']"
		:header-line="false"
	>
		<view class="love-auth-required">
			<text class="love-auth-required__title">{{ title }}</text>
			<text class="love-auth-required__desc">{{ desc }}</text>
			<view class="love-auth-required__actions">
				<fui-button
					:text="loginText"
					background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
					color="#ffffff"
					radius="999rpx"
					height="88rpx"
					:size="28"
					:bold="true"
					@click="$emit('login')"
				></fui-button>
				<fui-button
					v-if="secondaryText"
					:text="secondaryText"
					background="rgba(255, 241, 235, 0.98)"
					color="#b05b48"
					border-color="rgba(214, 145, 122, 0.24)"
					radius="999rpx"
					height="88rpx"
					:size="28"
					:bold="true"
					@click="$emit('secondary')"
				></fui-button>
			</view>
		</view>
	</fui-card>
</template>

<script>
	export default {
		name: 'love-auth-required',
		emits: ['login', 'secondary'],
		props: {
			title: {
				type: String,
				default: '当前未登录'
			},
			desc: {
				type: String,
				default: '请先完成登录后再继续当前操作。'
			},
			loginText: {
				type: String,
				default: '前往登录页'
			},
			secondaryText: {
				type: String,
				default: '返回上一页'
			},
			margin: {
				type: Array,
				default() {
					return ['0', '0', '0', '0']
				}
			}
		}
	}
</script>

<style scoped>
	.love-auth-required {
		padding: 38rpx 34rpx;
	}

	.love-auth-required__title {
		display: block;
		font-size: 34rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.love-auth-required__desc {
		display: block;
		margin-top: 18rpx;
		font-size: 24rpx;
		line-height: 1.8;
		color: #906b61;
	}

	.love-auth-required__actions {
		display: flex;
		flex-direction: column;
		gap: 22rpx;
		margin-top: 30rpx;
	}
</style>
