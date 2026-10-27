<template>
	<fui-dialog
		:show="visible"
		:title="content.title"
		:color="'#5a3427'"
		:buttons="buttons"
		:radius="28"
		:mask-closable="true"
		mask-background="rgba(41, 24, 18, 0.55)"
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
				{ text: '稍后再说', color: '#8b6659' },
				{ text: '去绑定', color: '#e76f51' }
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
	background: rgba(255, 139, 114, 0.14);
}

.couple-guide__badge-text {
	font-size: 20rpx;
	letter-spacing: 2rpx;
	color: #b05b48;
}

.couple-guide__desc {
	display: block;
	font-size: 26rpx;
	line-height: 1.7;
	color: #7a5346;
}

.couple-guide__hint {
	margin-top: 20rpx;
	padding: 16rpx 20rpx;
	border-radius: 18rpx;
	background: #fff4ee;
	border: 1rpx solid rgba(223, 160, 140, 0.24);
}

.couple-guide__hint-text {
	display: block;
	font-size: 22rpx;
	line-height: 1.6;
	color: #b05b48;
}
</style>
