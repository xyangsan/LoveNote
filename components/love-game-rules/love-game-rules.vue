<template>
	<fui-bottom-popup :show="show" :radius="'32rpx'" :mask-closable="true" :safe-area="true" @close="handleClose">
		<view class="game-rules">
			<view class="game-rules__head">
				<text class="game-rules__title">{{ currentRules.title }}</text>
				<text class="game-rules__subtitle">{{ currentRules.subtitle }}</text>
				<view v-if="currentRules.meta && currentRules.meta.length" class="game-rules__meta">
					<fui-tag
						v-for="(item, index) in currentRules.meta"
						:key="index"
						:text="item"
						theme="light"
						background="#fff1eb"
						color="#b8604c"
						:radius="999"
						size="20"
						:marginTop="0"
						:marginBottom="0"
						:marginRight="12"
					/>
				</view>
			</view>

			<scroll-view class="game-rules__body" scroll-y>
				<view v-for="(section, index) in currentRules.sections" :key="index" class="game-rules__section">
					<text class="game-rules__heading">{{ section.heading }}</text>
					<view v-for="(item, itemIndex) in section.items" :key="itemIndex" class="game-rules__item">
						<view class="game-rules__dot"></view>
						<text class="game-rules__text">{{ item }}</text>
					</view>
				</view>
			</scroll-view>

			<view class="game-rules__footer">
				<fui-button
					text="知道了"
					background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
					color="#ffffff"
					height="88rpx"
					radius="999rpx"
					:size="30"
					:bold="true"
					@click="handleClose"
				/>
			</view>
		</view>
	</fui-bottom-popup>
</template>

<script>
	import { getGameRules } from '@/common/game/rules.js'

	const FALLBACK_RULES = {
		title: '玩法说明',
		subtitle: '这个游戏还没有补充说明',
		meta: [],
		sections: []
	}

	export default {
		name: 'LoveGameRules',
		props: {
			show: {
				type: Boolean,
				default: false
			},
			gameType: {
				type: String,
				default: ''
			},
			customRules: {
				type: Object,
				default: null
			}
		},
		emits: ['close'],
		computed: {
			currentRules() {
				const rules = this.customRules || getGameRules(this.gameType) || FALLBACK_RULES
				return {
					title: rules.title || FALLBACK_RULES.title,
					subtitle: rules.subtitle || '',
					meta: Array.isArray(rules.meta) ? rules.meta : [],
					sections: Array.isArray(rules.sections) ? rules.sections : []
				}
			}
		},
		methods: {
			handleClose() {
				this.$emit('close')
			}
		}
	}
</script>

<style>
	.game-rules {
		display: flex;
		flex-direction: column;
		padding: 8rpx 32rpx 24rpx;
		background: #ffffff;
	}

	.game-rules__head {
		padding: 24rpx 0 18rpx;
	}

	.game-rules__title {
		display: block;
		font-size: 40rpx;
		font-weight: 700;
		line-height: 1.3;
		color: #5a3427;
	}

	.game-rules__subtitle {
		display: block;
		margin-top: 12rpx;
		font-size: 25rpx;
		line-height: 1.6;
		color: #8b6659;
	}

	.game-rules__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin-top: 18rpx;
	}

	.game-rules__body {
		max-height: 56vh;
	}

	.game-rules__section {
		padding: 18rpx 0 4rpx;
	}

	.game-rules__section + .game-rules__section {
		margin-top: 8rpx;
		padding-top: 22rpx;
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.game-rules__heading {
		display: block;
		margin-bottom: 14rpx;
		font-size: 28rpx;
		font-weight: 700;
		color: #c0674d;
	}

	.game-rules__item {
		display: flex;
		align-items: flex-start;
		padding: 8rpx 0;
	}

	.game-rules__dot {
		flex-shrink: 0;
		width: 12rpx;
		height: 12rpx;
		margin-top: 14rpx;
		margin-right: 16rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ff9a76 0%, #f4b183 100%);
		box-shadow: 0 0 0 6rpx rgba(255, 186, 160, 0.16);
	}

	.game-rules__text {
		flex: 1;
		font-size: 26rpx;
		line-height: 1.7;
		color: #6d473a;
	}

	.game-rules__footer {
		padding-top: 22rpx;
	}
</style>
