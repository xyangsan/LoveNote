<template>
	<view class="love-relation-bar">
		<view class="love-relation-bar__avatars">
			<view class="love-relation-bar__avatar-wrap">
				<image class="love-relation-bar__avatar love-relation-bar__avatar--primary" :src="primaryAvatar" mode="aspectFill" :style="avatarStyle"></image>
				<view v-if="primaryGenderMeta" class="love-relation-bar__gender-badge" :class="primaryGenderMeta.className">
					<text class="love-relation-bar__gender-text">{{ primaryGenderMeta.icon }}</text>
				</view>
			</view>
			<view v-if="secondaryAvatar" class="love-relation-bar__avatar-wrap">
				<image
					class="love-relation-bar__avatar love-relation-bar__avatar--secondary"
					:src="secondaryAvatar"
					mode="aspectFill"
					:style="avatarStyle"
				></image>
				<view v-if="secondaryGenderMeta" class="love-relation-bar__gender-badge" :class="secondaryGenderMeta.className">
					<text class="love-relation-bar__gender-text">{{ secondaryGenderMeta.icon }}</text>
				</view>
			</view>
			<view v-else class="love-relation-bar__avatar-wrap">
				<view class="love-relation-bar__avatar love-relation-bar__avatar--placeholder" :style="avatarStyle">
					<text class="love-relation-bar__placeholder-text" :style="placeholderTextStyle">{{ secondaryPlaceholder }}</text>
				</view>
			</view>
		</view>
		<view class="love-relation-bar__body" :class="{ 'love-relation-bar__body--borderless': borderless }">
			<view class="love-relation-bar__head">
				<text class="love-relation-bar__title" :style="titleStyle">{{ title }}</text>
				<view v-if="badgeText" class="love-relation-bar__badge">
					<text class="love-relation-bar__badge-text">{{ badgeText }}</text>
				</view>
			</view>
			<text v-if="desc" class="love-relation-bar__desc" :style="descStyle">{{ desc }}</text>
			<slot></slot>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'love-relation-bar',
		props: {
			primaryAvatar: {
				type: String,
				default: '/static/user-empty.png'
			},
			secondaryAvatar: {
				type: String,
				default: ''
			},
			secondaryPlaceholder: {
				type: String,
				default: 'TA'
			},
			title: {
				type: String,
				default: ''
			},
			desc: {
				type: String,
				default: ''
			},
			badgeText: {
				type: String,
				default: ''
			},
			primaryGender: {
				type: [Number, String],
				default: 0
			},
			secondaryGender: {
				type: [Number, String],
				default: 0
			},
			borderless: {
				type: Boolean,
				default: false
			},
			avatarSize: {
				type: [Number, String],
				default: 88
			},
			titleSize: {
				type: [Number, String],
				default: 34
			},
			descSize: {
				type: [Number, String],
				default: 24
			}
		},
		computed: {
			avatarStyle() {
				const size = `${this.avatarSize}rpx`
				return {
					width: size,
					height: size
				}
			},
			titleStyle() {
				return {
					fontSize: `${this.titleSize}rpx`
				}
			},
			descStyle() {
				return {
					fontSize: `${this.descSize}rpx`
				}
			},
			placeholderTextStyle() {
				return {
					fontSize: `${Math.round(Number(this.avatarSize || 88) * 0.32)}rpx`
				}
			},
			primaryGenderMeta() {
				return this.getGenderMeta(this.primaryGender)
			},
			secondaryGenderMeta() {
				return this.getGenderMeta(this.secondaryGender)
			}
		},
		methods: {
			getGenderMeta(value) {
				const gender = Number(value || 0)
				if (gender === 1) {
					return {
						icon: '♂',
						className: 'love-relation-bar__gender-badge--male'
					}
				}
				if (gender === 2) {
					return {
						icon: '♀',
						className: 'love-relation-bar__gender-badge--female'
					}
				}
				return null
			}
		}
	}
</script>

<style scoped>
	.love-relation-bar {
		display: flex;
		align-items: flex-start;
		gap: 22rpx;
		padding: 24rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.72);
	}

	.love-relation-bar__avatars {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.love-relation-bar__avatar-wrap {
		position: relative;
		margin-right: -14rpx;
	}

	.love-relation-bar__avatar {
		border: 4rpx solid rgba(255, 255, 255, 0.95);
		border-radius: 50%;
		background: #fff2ec;
		box-shadow: 0 12rpx 24rpx rgba(168, 99, 76, 0.14);
	}

	.love-relation-bar__avatar--placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #ffd0c3 0%, #ffc371 100%);
	}

	.love-relation-bar__placeholder-text {
		font-weight: 700;
		color: #ffffff;
	}

	.love-relation-bar__body {
		flex: 1;
		min-width: 0;
		padding-top: 6rpx;
	}

	.love-relation-bar__body--borderless {
		padding-right: 0;
	}

	.love-relation-bar__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16rpx;
	}

	.love-relation-bar__title {
		flex: 1;
		min-width: 0;
		font-weight: 700;
		line-height: 1.4;
		color: #5b3529;
		word-break: break-all;
	}

	.love-relation-bar__badge {
		flex-shrink: 0;
		padding: 10rpx 18rpx;
		border-radius: 999rpx;
		background: rgba(255, 241, 235, 0.98);
	}

	.love-relation-bar__badge-text {
		font-size: 22rpx;
		font-weight: 600;
		color: #be6f59;
	}

	.love-relation-bar__desc {
		display: block;
		margin-top: 14rpx;
		line-height: 1.7;
		color: #906b61;
	}

	.love-relation-bar__gender-badge {
		position: absolute;
		left: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30rpx;
		height: 30rpx;
		border: 3rpx solid rgba(255, 255, 255, 0.96);
		border-radius: 50%;
		box-shadow: 0 8rpx 16rpx rgba(118, 79, 64, 0.16);
	}

	.love-relation-bar__gender-badge--male {
		background: linear-gradient(135deg, #6cb8ff 0%, #4387ff 100%);
	}

	.love-relation-bar__gender-badge--female {
		background: linear-gradient(135deg, #ff94b8 0%, #ff6b95 100%);
	}

	.love-relation-bar__gender-text {
		font-size: 18rpx;
		font-weight: 700;
		line-height: 1;
		color: #ffffff;
	}
</style>
