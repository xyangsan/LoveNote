<template>
	<view
		class="anniversary-card"
		:class="{ 'anniversary-card--clickable': clickable }"
		:style="cardDynamicStyle"
		@click="handleClick"
	>
		<view class="anniversary-card__bg" :style="backgroundStyle"></view>
		<view
			v-if="maskEnabled"
			class="anniversary-card__mask"
			:style="maskStyle"
		></view>
		<view class="anniversary-card__content" :style="textStyle">
			<view class="anniversary-card__top">
				<text class="anniversary-card__title">{{ title || '纪念日标题' }}</text>
				<view v-if="showActions" class="anniversary-card__top-actions">
					<fui-tag
						v-if="repeatTypeText"
						:text="repeatTypeText"
						:is-border="false"
						background="rgba(255,255,255,0.24)"
						color="#ffffff"
						radius="999"
						:padding="['6rpx', '14rpx']"
					></fui-tag>
					<text
						v-if="showDelete"
						class="anniversary-card__delete"
						@click.stop="handleDelete"
					>删除</text>
				</view>
			</view>

			<view class="anniversary-card__meta">
				<view class="anniversary-card__meta-main">
					<template v-if="metaText">
						<text class="anniversary-card__meta-text">{{ metaText }}</text>
					</template>
					<template v-else>
						<text v-if="dateText" class="anniversary-card__date">{{ dateText }}</text>
						<fui-tag
							v-if="dateTypeText"
							:text="dateTypeText"
							:is-border="false"
							background="rgba(255,255,255,0.18)"
							color="#ffffff"
							radius="999"
							:padding="['6rpx', '14rpx']"
						></fui-tag>
					</template>
				</view>
				<text
					v-if="elapsedText"
					class="anniversary-card__elapsed"
				>{{ elapsedText }}</text>
			</view>

			<view class="anniversary-card__countdown">
				<text class="anniversary-card__countdown-text">{{ countdownText || '--' }}</text>
				<view v-if="nextDateText" class="anniversary-card__next">
					<text class="anniversary-card__next-date">{{ nextDateText }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
export default {
	name: 'LoveAnniversaryCard',
	props: {
		title: {
			type: String,
			default: ''
		},
		countdownText: {
			type: String,
			default: ''
		},
		elapsedText: {
			type: String,
			default: ''
		},
		nextDateText: {
			type: String,
			default: ''
		},
		metaText: {
			type: String,
			default: ''
		},
		dateText: {
			type: String,
			default: ''
		},
		dateTypeText: {
			type: String,
			default: ''
		},
		repeatTypeText: {
			type: String,
			default: ''
		},
		backgroundStyle: {
			type: Object,
			default: () => ({})
		},
		maskStyle: {
			type: Object,
			default: () => ({})
		},
		textStyle: {
			type: Object,
			default: () => ({})
		},
		maskEnabled: {
			type: Boolean,
			default: false
		},
		showDelete: {
			type: Boolean,
			default: false
		},
		clickable: {
			type: Boolean,
			default: false
		},
		height: {
			type: String,
			default: '238rpx'
		},
		shadow: {
			type: Boolean,
			default: true
		},
		radius: {
			type: String,
			default: '30rpx'
		}
	},
	computed: {
		showActions() {
			return Boolean(this.repeatTypeText || this.showDelete)
		},
		cardDynamicStyle() {
			const style = {
				height: this.height,
				borderRadius: this.radius
			}
			if (this.shadow) {
				style.boxShadow = '0 16rpx 38rpx rgba(173, 109, 77, 0.16)'
			}
			return style
		}
	},
	methods: {
		handleClick() {
			if (this.clickable) {
				this.$emit('click')
			}
		},
		handleDelete() {
			this.$emit('delete')
		}
	}
}
</script>

<style>
	.anniversary-card {
		position: relative;
		overflow: hidden;
	}

	.anniversary-card--clickable {
		cursor: pointer;
	}

	.anniversary-card__bg,
	.anniversary-card__mask,
	.anniversary-card__content {
		position: absolute;
		inset: 0;
	}

	.anniversary-card__content {
		z-index: 2;
		display: flex;
		flex-direction: column;
		padding: 28rpx 30rpx;
		box-sizing: border-box;
	}

	.anniversary-card__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18rpx;
	}

	.anniversary-card__top-actions {
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.anniversary-card__title {
		flex: 1;
		min-width: 0;
		font-size: 36rpx;
		font-weight: 700;
		line-height: 1.35;
		word-break: break-all;
	}

	.anniversary-card__delete {
		font-size: 22rpx;
		line-height: 1.2;
		opacity: 0.94;
	}

	.anniversary-card__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
		margin-top: 20rpx;
		font-size: 26rpx;
	}

	.anniversary-card__meta-main {
		display: flex;
		align-items: center;
		gap: 12rpx;
		min-width: 0;
	}

	.anniversary-card__meta-text,
	.anniversary-card__date {
		font-size: 26rpx;
		line-height: 1.3;
		opacity: 0.95;
		white-space: nowrap;
	}

	.anniversary-card__meta-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.anniversary-card__elapsed {
		font-size: 26rpx;
		font-weight: 700;
		line-height: 1.2;
		opacity: 0.98;
		white-space: nowrap;
	}

	.anniversary-card__countdown {
		margin-top: auto;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 18rpx;
	}

	.anniversary-card__countdown-text {
		font-size: 42rpx;
		font-weight: 700;
		line-height: 1.25;
	}

	.anniversary-card__next {
		display: flex;
		align-items: flex-end;
		justify-content: flex-end;
		min-width: 0;
	}

	.anniversary-card__next-date {
		font-size: 22rpx;
		line-height: 1.2;
		opacity: 0.94;
	}
</style>
