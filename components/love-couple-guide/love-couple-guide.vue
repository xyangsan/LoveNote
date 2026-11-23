<template>
	<fui-dialog
		:show="visible"
		:title="content.title"
		:color="'#FBF4EA'"
		background="#1C1613"
		:buttons="buttons"
		:radius="32"
		:mask-closable="true"
		mask-background="rgba(8, 6, 5, 0.74)"
		@click="handleButtonClick"
		@close="handleClose"
	>
		<view class="couple-guide">
			<view class="couple-guide__badge">
				<text class="couple-guide__badge-text">LOVE NOTE</text>
			</view>
			<text class="couple-guide__desc">{{ content.desc }}</text>
			<view class="couple-guide__hint">
				<text class="couple-guide__hint-text">{{ content.hint }}</text>
			</view>
		</view>
	</fui-dialog>
</template>

<script>
import {
	getCoupleGuideContent,
	markCoupleGuideShown,
	shouldShowCoupleGuide
} from '../../common/couple-guide.js'

export default {
	name: 'LoveCoupleGuide',
	props: {
		// album | feed | anniversary | plan，决定文案
		scene: {
			type: String,
			default: ''
		},
		// 页面是否已确认「已登录 + 未绑定情侣 + 列表加载完成」
		active: {
			type: Boolean,
			default: false
		}
	},
	data() {
		return {
			visible: false
		}
	},
	computed: {
		content() {
			return getCoupleGuideContent(this.scene)
		},
		buttons() {
			return [
				{ text: '稍后再说', color: 'rgba(245, 237, 228, 0.56)' },
				{ text: '去绑定', color: '#E5865C' }
			]
		}
	},
	watch: {
		active: {
			immediate: true,
			handler(value) {
				if (!value) {
					return
				}
				this.tryShowGuide()
			}
		}
	},
	methods: {
		tryShowGuide() {
			if (this.visible) {
				return
			}
			if (!shouldShowCoupleGuide(this.scene)) {
				return
			}
			// 弹出即记录，避免用户关掉后反复进出页面又被弹一次
			markCoupleGuideShown(this.scene)
			this.visible = true
		},
		handleClose() {
			this.visible = false
		},
		handleButtonClick(event = {}) {
			const index = Number(event.index)
			this.visible = false
			if (index === 1) {
				uni.navigateTo({
					url: '/pages/couple/index'
				})
			}
		}
	}
}
</script>

<style>
.couple-guide {
	padding: 4rpx 6rpx 0;
}

.couple-guide__badge {
	display: inline-block;
	margin-bottom: 18rpx;
	padding: 4rpx 16rpx;
	border-radius: 999rpx;
	border: 1rpx solid rgba(216, 176, 140, 0.32);
	background: rgba(216, 176, 140, 0.12);
}

.couple-guide__badge-text {
	font-family: "SF Mono", "Consolas", monospace;
	font-size: 20rpx;
	letter-spacing: 3rpx;
	color: #D8B08C;
}

.couple-guide__desc {
	display: block;
	font-size: 26rpx;
	line-height: 1.7;
	color: rgba(245, 237, 228, 0.72);
}

.couple-guide__hint {
	margin-top: 20rpx;
	padding: 16rpx 20rpx;
	border-radius: 18rpx;
	background: rgba(216, 176, 140, 0.06);
	border: 1rpx dashed rgba(216, 176, 140, 0.28);
}

.couple-guide__hint-text {
	display: block;
	font-size: 22rpx;
	line-height: 1.6;
	color: #EAD4BC;
}
</style>
