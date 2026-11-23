<template>
	<view class="love-auth-required-wrap" :style="wrapStyle">
		<noir-card variant="hero" kicker="AUTH REQUIRED" padding="38rpx 34rpx">
			<text class="love-auth-required__title">{{ title }}</text>
			<text class="love-auth-required__desc">{{ desc }}</text>
			<view class="love-auth-required__actions">
				<noir-button
					:text="loginText"
					variant="primary"
					size="lg"
					block
					@click="$emit('login')"
				/>
				<noir-button
					v-if="secondaryText"
					:text="secondaryText"
					variant="ghost"
					size="lg"
					block
					@click="$emit('secondary')"
				/>
			</view>
		</noir-card>
	</view>
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
		},
		computed: {
			wrapStyle() {
				const m = this.margin || []
				return {
					marginTop: m[0] || 0,
					marginRight: m[1] || 0,
					marginBottom: m[2] || m[0] || 0,
					marginLeft: m[3] || m[1] || 0
				}
			}
		}
	}
</script>

<style scoped>
	.love-auth-required__title {
		display: block;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 36rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.love-auth-required__desc {
		display: block;
		margin-top: 16rpx;
		font-size: 24rpx;
		line-height: 1.75;
		color: rgba(245, 237, 228, 0.56);
	}

	.love-auth-required__actions {
		display: flex;
		flex-direction: column;
		gap: 20rpx;
		margin-top: 30rpx;
	}
</style>
