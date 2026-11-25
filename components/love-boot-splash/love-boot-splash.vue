<template>
	<view v-if="visible" class="boot" :class="{ 'boot--out': leaving }" @touchmove.stop.prevent>
		<view class="boot__glow boot__glow--coral"></view>
		<view class="boot__glow boot__glow--gold"></view>

		<view class="boot__center">
			<view class="boot__ring">
				<view class="boot__ring-dot"></view>
			</view>
			<text class="boot__title">恋人手札</text>
			<text class="boot__hint">正在翻开这一页</text>
		</view>
	</view>
</template>

<script>
	/**
	 * 启动遮罩：小程序冷启动 / 重新载入时，页面首屏数据回来之前盖住屏幕。
	 *
	 * 为什么需要它：
	 *   微信原生启动屏的底色来自 app.json（构建期静态值，pages.json 里写死 #EDF1EA），
	 *   换不了主题；而本项目的主题是账号级、运行时解析的。暗夜 / 暮色这类深色主题下，
	 *   原生启动屏会闪一屏浅色再跳到深色。这层遮罩从页面首帧就存在（data 里 booting 初始 true），
	 *   底色取当前主题的 `--noir-bg`，把那段跳变盖掉，顺带给出「正在加载」的反馈。
	 *
	 * ⚠️ 必须放在绑了 `:class="themeClass"` 的子树里，否则 `--noir-*` 取的是 page 上的暗夜默认值。
	 * ⚠️ 用 v-if + 外部延迟卸载（父组件先加 leaving，动画结束再置 visible=false）来做淡出，
	 *    别在组件内部自己卸载，否则过渡会被直接裁掉。
	 */
	export default {
		name: 'LoveBootSplash',
		props: {
			visible: {
				type: Boolean,
				default: false
			},
			// 淡出阶段：父组件先置 true，等过渡结束再置 visible=false
			leaving: {
				type: Boolean,
				default: false
			}
		}
	}
</script>

<style scoped>
	.boot {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: var(--noir-bg);
		transition: opacity 0.26s ease;
	}

	.boot--out {
		opacity: 0;
	}

	/* 与首页 hero 一致的两团光斑，避免纯色背景显得死板 */
	.boot__glow {
		position: absolute;
		width: 620rpx;
		height: 620rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		pointer-events: none;
	}

	.boot__glow--coral {
		top: -220rpx;
		left: -180rpx;
		background: rgba(var(--noir-coral-rgb), 0.26);
	}

	.boot__glow--gold {
		right: -200rpx;
		bottom: -240rpx;
		background: rgba(var(--noir-gold-rgb), 0.18);
	}

	.boot__center {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.boot__ring {
		position: relative;
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		border: 3rpx solid rgba(var(--noir-text-rgb), 0.12);
		border-top-color: var(--noir-coral);
		animation: boot-spin 0.92s linear infinite;
	}

	/* 环上的小圆点，让旋转方向更明确 */
	.boot__ring-dot {
		position: absolute;
		top: -5rpx;
		left: 50%;
		width: 8rpx;
		height: 8rpx;
		margin-left: -4rpx;
		border-radius: 50%;
		background: var(--noir-coral);
	}

	.boot__title {
		margin-top: 36rpx;
		font-size: 30rpx;
		line-height: 42rpx;
		letter-spacing: 6rpx;
		color: var(--noir-text);
	}

	.boot__hint {
		margin-top: 12rpx;
		font-size: 22rpx;
		line-height: 32rpx;
		letter-spacing: 2rpx;
		color: var(--noir-text-faded);
	}

	@keyframes boot-spin {
		from {
			transform: rotate(0deg);
		}

		to {
			transform: rotate(360deg);
		}
	}
</style>
