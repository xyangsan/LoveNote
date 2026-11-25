<template>
	<view class="tv-page" :class="themeClass">
		<view class="tv-glow tv-glow--left"></view>
		<view class="tv-glow tv-glow--right"></view>

		<noir-navbar
			title="主题"
			subtitle="APPEARANCE"
			:show-back="true"
			:transparent="true" :placeholder="false" :border="false"
		>
		</noir-navbar>

		<view class="tv-wrap" :style="{ paddingTop: navBarHeight + 'px' }">
			<!-- 当前主题的大预览：按手机屏幕比例画一个界面示意 -->
			<view class="tv-hero">
				<view class="tv-phone">
					<view class="tv-phone__screen">
						<!-- 灵动岛 -->
						<view class="tv-phone__notch"></view>

						<!-- 状态栏 -->
						<view class="tv-phone__status">
							<text class="tv-phone__time">9:41</text>
							<view class="tv-phone__signals">
								<view class="tv-phone__signal"></view>
								<view class="tv-phone__signal"></view>
								<view class="tv-phone__battery"></view>
							</view>
						</view>

						<!-- 应用导航栏 -->
						<view class="tv-phone__nav">
							<view class="tv-phone__nav-btn"></view>
							<text class="tv-phone__nav-title">恋人手札</text>
							<view class="tv-phone__nav-avatar"></view>
						</view>

						<!-- 首页 Hero：铺当前主题的背景图（art.home），切换主题后跟着换图；
						     没有配图时回落到主题色渐变。上面压一层暗角保证文字可读。 -->
						<view class="tv-phone__hero">
							<image
								v-if="heroCoverUrl"
								class="tv-phone__hero-bg"
								:src="heroCoverUrl"
								mode="aspectFill"
							/>
							<view class="tv-phone__hero-shade"></view>
							<text class="tv-phone__hero-kicker">TOGETHER SINCE</text>
							<view class="tv-phone__hero-num"></view>
							<view class="tv-phone__hero-line"></view>
						</view>

						<!-- 内容卡片 -->
						<view class="tv-phone__list">
							<view class="tv-phone__card" v-for="n in 2" :key="n">
								<view class="tv-phone__card-ic"></view>
								<view class="tv-phone__card-txt">
									<view class="tv-phone__card-line"></view>
									<view class="tv-phone__card-line tv-phone__card-line--short"></view>
								</view>
							</view>
						</view>

						<view class="tv-phone__spacer"></view>

						<!-- 底部导航 -->
						<view class="tv-phone__tabbar">
							<view
								class="tv-phone__tab"
								v-for="n in 4"
								:key="n"
								:class="{ 'is-on': n === 1 }"
							></view>
						</view>

						<!-- Home 指示条 -->
						<view class="tv-phone__home"></view>
					</view>
				</view>

				<view class="tv-hero__meta">
					<view class="tv-hero__meta-main">
						<text class="tv-hero__name">{{ currentTheme.name }}</text>
						<text class="tv-hero__en">{{ currentTheme.en }}</text>
					</view>
					<view class="tv-hero__badge">
						<view class="tv-hero__badge-dot"></view>
						<text class="tv-hero__badge-txt">使用中</text>
					</view>
					<text class="tv-hero__desc">{{ currentTheme.desc }}</text>
				</view>
			</view>

			<!-- 全部主题 -->
			<view class="tv-section">
				<text class="tv-section__title">全部主题</text>
				<text class="tv-section__count">{{ themes.length }} 套</text>
			</view>

			<view class="tv-grid">
				<view
					v-for="item in themes"
					:key="item.key"
					class="tv-cell"
					:class="{ 'is-active': item.key === themeKey }"
					@tap="handlePick(item)"
				>
					<view class="tv-thumb" :style="{ backgroundColor: item.swatches[0] }">
						<view class="tv-thumb__bar" :style="{ backgroundColor: item.ink }"></view>
						<view class="tv-thumb__card" :style="{ backgroundColor: item.swatches[1] }">
							<view class="tv-thumb__line" :style="{ backgroundColor: item.swatches[2] }"></view>
							<view
								class="tv-thumb__line tv-thumb__line--short"
								:style="{ backgroundColor: item.swatches[2] }"
							></view>
						</view>
						<view class="tv-thumb__dots">
							<view class="tv-thumb__dot" :style="{ backgroundColor: item.swatches[3] }"></view>
							<view
								class="tv-thumb__dot"
								:style="{ backgroundColor: item.ink, opacity: 0.42 }"
							></view>
							<view
								class="tv-thumb__dot"
								:style="{ backgroundColor: item.ink, opacity: 0.42 }"
							></view>
						</view>
					</view>
					<text class="tv-cell__name">{{ item.name }}</text>
				</view>
			</view>

			<text class="tv-foot">主题只改配色与背景图，不影响任何数据、权限与对局进度。</text>
		</view>

		<!-- 切换涟漪：从左上角扩出的圆形，颜色取新主题底色 -->
		<view v-if="rippleActive" class="tv-ripple" :style="rippleStyle"></view>
	</view>
</template>

<script>
	import { THEMES, setThemeKey, getTheme, themeState } from '@/common/theme.js'
	import { getNavBarHeight, getNavBarMetrics } from '@/common/utils/nav-bar.js'
	import { getUserApi } from '@/common/api/user.js'

	// 涟漪时序（毫秒）：扩散 -> 扩散到近满时才换主题 -> 淡出 -> 收层
	const RIPPLE_SWAP_AT = 380
	const RIPPLE_END_AT = 640

	export default {
		name: 'ThemeIndex',
		data() {
			return {
				themes: THEMES,
				// 导航栏 fixed 且不占位，内容要自己让出「状态栏 + 导航栏」的总高度，
				// 否则首屏文字会被压在状态栏下面
				navBarHeight: getNavBarHeight(getNavBarMetrics()),
				rippleActive: false,
				rippleStyle: {}
			}
		},
		computed: {
			currentTheme() {
				return getTheme(this.themeKey)
			},
			/** 大图预览的 Hero 背景：跟当前主题的 art.home 走，切主题即换图 */
			heroCoverUrl() {
				const art = this.currentTheme && this.currentTheme.art
				return (art && art.home) || ''
			}
		},
		beforeUnmount() {
			this.clearRippleTimers()
		},
		// 小程序端没有 beforeUnmount 时用 onUnload 兜底
		onUnload() {
			this.clearRippleTimers()
		},
		methods: {
			clearRippleTimers() {
				if (this.swapTimer) {
					clearTimeout(this.swapTimer)
					this.swapTimer = null
				}
				if (this.endTimer) {
					clearTimeout(this.endTimer)
					this.endTimer = null
				}
				if (this.themeSyncTimer) {
					clearTimeout(this.themeSyncTimer)
					this.themeSyncTimer = null
				}
			},
			/**
			 * 把主题同步到账号。未登录只存本地 —— 游客没有可写入的账号记录。
			 * 600ms 防抖：用户连续点几套主题时只提交最后一次。
			 */
			syncThemeToServer(key) {
				if (!themeState.uid) return
				if (this.themeSyncTimer) {
					clearTimeout(this.themeSyncTimer)
				}
				this.themeSyncTimer = setTimeout(async () => {
					this.themeSyncTimer = null
					try {
						await getUserApi().updateProfile({ themeKey: key })
					} catch (e) {
						// 同步失败不回滚本地主题：用户下次切换或下次登录会重新对齐
					}
				}, 600)
			},
			handlePick(item) {
				if (!item || item.key === this.themeKey) return
				// 动画进行中不响应连点，避免多层涟漪叠加
				if (this.rippleActive) return
				this.playRipple(item)
			},
			/**
			 * 从屏幕左上角扩散的圆形涟漪。
			 * 圆心固定在 (0, 0)，元素边长取屏幕对角线两倍、偏移一半，
			 * 这样 scale(0) 时圆心正好在左上角，scale(1) 时半径覆盖整屏对角线。
			 */
			playRipple(item) {
				let info = {}
				try {
					info = uni.getSystemInfoSync() || {}
				} catch (e) {}
				const w = Number(info.windowWidth) || 375
				const h = Number(info.windowHeight) || 667
				const radius = Math.ceil(Math.sqrt(w * w + h * h))

				this.rippleStyle = {
					width: radius * 2 + 'px',
					height: radius * 2 + 'px',
					left: -radius + 'px',
					top: -radius + 'px',
					backgroundColor: getTheme(item.key).bg
				}
				this.rippleActive = true

				// 扩散到约 99% 屏幕时才换主题，此时薄膜已浓到 0.92，切换不会被察觉
				this.swapTimer = setTimeout(() => {
					this.swapTimer = null
					setThemeKey(item.key)
					// 本地先落盘（上面那步），再异步同步到账号，失败不影响观感
					this.syncThemeToServer(item.key)
				}, RIPPLE_SWAP_AT)

				this.endTimer = setTimeout(() => {
					this.endTimer = null
					this.rippleActive = false
					this.rippleStyle = {}
					uni.showToast({
						title: `已切换为${item.name}`,
						icon: 'none',
						duration: 1000
					})
				}, RIPPLE_END_AT)
			}
		}
	}
</script>

<style scoped>
	.tv-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
		background: var(--noir-bg);
		overflow: hidden;
	}

	.tv-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(84rpx);
		opacity: 0.16;
		pointer-events: none;
		z-index: 0;
	}

	.tv-glow--left {
		top: -140rpx;
		left: -150rpx;
		background: var(--noir-coral);
	}

	.tv-glow--right {
		top: 320rpx;
		right: -160rpx;
		background: var(--noir-gold);
	}

	.tv-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 28rpx 0;
	}

	/* ===== 当前主题大预览 ===== */

	.tv-hero {
		position: relative;
		margin-bottom: 42rpx;
	}

	/* 手机外壳：机身 + 屏幕两层，营造真实设备预览感 */
	.tv-phone {
		position: relative;
		box-sizing: border-box;
		width: 360rpx;
		height: 660rpx;
		margin: 0 auto;
		padding: 8rpx;
		border-radius: 52rpx;
		background: var(--noir-surface-2);
		border: 1rpx solid var(--noir-border-gold);
		box-shadow:
			0 24rpx 56rpx rgba(var(--noir-shadow-rgb), 0.30),
			inset 0 0 0 1rpx rgba(var(--noir-text-rgb), 0.05);
	}

	.tv-phone__screen {
		position: relative;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 16rpx;
		border-radius: 44rpx;
		background: var(--noir-bg);
		overflow: hidden;
	}

	/* 灵动岛 */
	.tv-phone__notch {
		position: absolute;
		top: 10rpx;
		left: 50%;
		width: 68rpx;
		height: 16rpx;
		margin-left: -34rpx;
		border-radius: 999rpx;
		background: rgba(var(--noir-shadow-rgb), 0.82);
	}

	/* 状态栏 */
	.tv-phone__status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 46rpx;
		padding-top: 6rpx;
	}

	.tv-phone__time {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 15rpx;
		font-weight: 600;
		color: var(--noir-text);
		opacity: 0.9;
	}

	.tv-phone__signals {
		display: flex;
		align-items: center;
		gap: 4rpx;
	}

	.tv-phone__signal {
		width: 4rpx;
		height: 7rpx;
		border-radius: 1rpx;
		background: var(--noir-text);
		opacity: 0.66;
	}

	.tv-phone__battery {
		width: 15rpx;
		height: 8rpx;
		margin-left: 4rpx;
		border-radius: 2rpx;
		border: 1rpx solid var(--noir-text);
		opacity: 0.66;
	}

	/* 应用导航栏 */
	.tv-phone__nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56rpx;
	}

	.tv-phone__nav-btn {
		width: 22rpx;
		height: 22rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(var(--noir-text-rgb), 0.22);
	}

	.tv-phone__nav-title {
		font-size: 17rpx;
		letter-spacing: 1rpx;
		color: var(--noir-text);
		opacity: 0.86;
	}

	.tv-phone__nav-avatar {
		width: 22rpx;
		height: 22rpx;
		border-radius: 50%;
		background: rgba(var(--noir-gold-rgb), 0.24);
	}

	/*
	 * 首页 Hero：默认用主题色渐变兜底，有主题背景图时由 .tv-phone__hero-bg 铺满
	 * （必须 overflow:hidden + 圆角，否则 aspectFill 的图会溢出卡片）。
	 * 图之上再压一层从透明到深色的暗角，保证 kicker / 数字块在亮色照片上也能看清。
	 */
	.tv-phone__hero {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		box-sizing: border-box;
		height: 200rpx;
		padding: 18rpx;
		border-radius: 20rpx;
		background: linear-gradient(
			150deg,
			rgba(var(--noir-coral-rgb), 0.26) 0%,
			rgba(var(--noir-gold-rgb), 0.10) 100%
		);
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.20);
	}

	.tv-phone__hero-bg {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	.tv-phone__hero-shade {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		background: linear-gradient(
			180deg,
			rgba(0, 0, 0, 0.10) 0%,
			rgba(0, 0, 0, 0.20) 45%,
			rgba(0, 0, 0, 0.48) 100%
		);
	}

	.tv-phone__hero-kicker,
	.tv-phone__hero-num,
	.tv-phone__hero-line {
		position: relative;
		z-index: 2;
	}

	.tv-phone__hero-kicker {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 12rpx;
		letter-spacing: 1rpx;
		color: rgba(255, 255, 255, 0.92);
		text-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.42);
	}

	.tv-phone__hero-num {
		width: 92rpx;
		height: 28rpx;
		margin-top: 9rpx;
		border-radius: 5rpx;
		background: var(--noir-white);
		opacity: 0.92;
	}

	.tv-phone__hero-line {
		width: 120rpx;
		height: 8rpx;
		margin-top: 9rpx;
		border-radius: 999rpx;
		background: var(--noir-white);
		opacity: 0.46;
	}

	/* 内容卡片 */
	.tv-phone__list {
		display: flex;
		flex-direction: column;
		gap: 10rpx;
		margin-top: 16rpx;
	}

	.tv-phone__card {
		display: flex;
		align-items: center;
		gap: 10rpx;
		box-sizing: border-box;
		height: 68rpx;
		padding: 0 14rpx;
		border-radius: 14rpx;
		background: var(--noir-surface);
		border: 1rpx solid rgba(var(--noir-text-rgb), 0.06);
	}

	.tv-phone__card-ic {
		width: 26rpx;
		height: 26rpx;
		border-radius: 8rpx;
		background: rgba(var(--noir-coral-rgb), 0.22);
	}

	.tv-phone__card-txt {
		flex: 1;
		min-width: 0;
	}

	.tv-phone__card-line {
		width: 60%;
		height: 8rpx;
		border-radius: 999rpx;
		background: rgba(var(--noir-text-rgb), 0.62);
	}

	.tv-phone__card-line--short {
		width: 38%;
		height: 6rpx;
		margin-top: 7rpx;
		background: rgba(var(--noir-text-rgb), 0.28);
	}

	.tv-phone__spacer {
		flex: 1;
	}

	/* 底部悬浮导航 */
	.tv-phone__tabbar {
		display: flex;
		align-items: center;
		justify-content: space-around;
		height: 60rpx;
		padding: 0 14rpx;
		border-radius: 18rpx;
		background: var(--noir-tabbar-bg);
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.18);
	}

	.tv-phone__tab {
		width: 12rpx;
		height: 12rpx;
		border-radius: 50%;
		background: rgba(var(--noir-text-rgb), 0.28);
	}

	.tv-phone__tab.is-on {
		width: 24rpx;
		border-radius: 999rpx;
		background: var(--noir-coral);
	}

	/* Home 指示条 */
	.tv-phone__home {
		width: 96rpx;
		height: 6rpx;
		margin: 12rpx auto 10rpx;
		border-radius: 999rpx;
		background: rgba(var(--noir-text-rgb), 0.32);
	}

	/* 「使用中」浮在预览区右上角，不占手机框内的空间 */
	.tv-hero__badge {
		position: absolute;
		top: 8rpx;
		right: 0;
		display: flex;
		align-items: center;
		gap: 8rpx;
		height: 34rpx;
		padding: 0 14rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.36);
		background: rgba(var(--noir-coral-rgb), 0.12);
	}

	.tv-hero__badge-dot {
		width: 8rpx;
		height: 8rpx;
		border-radius: 50%;
		background: var(--noir-coral);
	}

	.tv-hero__badge-txt {
		font-size: 18rpx;
		letter-spacing: 1rpx;
		color: var(--noir-coral-bright);
	}

	.tv-hero__meta {
		padding: 24rpx 6rpx 0;
		text-align: center;
	}

	.tv-hero__meta-main {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 14rpx;
	}

	.tv-hero__name {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 38rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.tv-hero__en {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 2rpx;
		color: rgba(var(--noir-gold-rgb), 0.68);
	}

	.tv-hero__desc {
		display: block;
		margin-top: 12rpx;
		text-align: center;
		font-size: 23rpx;
		line-height: 1.65;
		color: rgba(var(--noir-text-rgb), 0.56);
	}

	/* ===== 全部主题 ===== */

	.tv-section {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 20rpx;
		padding: 0 4rpx;
	}

	.tv-section__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 30rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.tv-section__count {
		font-size: 20rpx;
		letter-spacing: 2rpx;
		color: rgba(var(--noir-text-rgb), 0.40);
	}

	.tv-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 18rpx 14rpx;
	}

	.tv-cell {
		width: calc((100% - 28rpx) / 3);
	}

	/*
	 * 缩略图：用「该主题的」底色 / 浮层 / 强调色画一个迷你界面。
	 * 注意这些是内联注入的其他主题色值，不能用 CSS 变量 —— 变量只会是当前主题。
	 */
	.tv-thumb {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		box-sizing: border-box;
		height: 166rpx;
		padding: 14rpx;
		border-radius: 16rpx;
		border: 3rpx solid transparent;
	}

	.tv-cell.is-active .tv-thumb {
		border-color: var(--noir-white);
		box-shadow:
			0 0 0 5rpx rgba(var(--noir-shadow-rgb), 0.32),
			0 10rpx 26rpx rgba(var(--noir-shadow-rgb), 0.34);
	}

	.tv-thumb__bar {
		width: 56%;
		height: 9rpx;
		border-radius: 999rpx;
		opacity: 0.85;
	}

	.tv-thumb__card {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8rpx;
		margin: 10rpx 0;
		padding: 0 12rpx;
		border-radius: 10rpx;
	}

	.tv-thumb__line {
		width: 66%;
		height: 7rpx;
		border-radius: 999rpx;
		opacity: 0.9;
	}

	.tv-thumb__line--short {
		width: 40%;
		opacity: 0.5;
	}

	.tv-thumb__dots {
		display: flex;
		align-items: center;
		justify-content: space-around;
	}

	.tv-thumb__dot {
		width: 7rpx;
		height: 7rpx;
		border-radius: 50%;
	}

	.tv-cell__name {
		display: block;
		margin-top: 14rpx;
		text-align: center;
		font-size: 23rpx;
		color: var(--noir-text);
		opacity: 0.72;
	}

	.tv-cell.is-active .tv-cell__name {
		opacity: 1;
	}

	.tv-foot {
		display: block;
		margin-top: 36rpx;
		padding: 0 8rpx;
		font-size: 21rpx;
		line-height: 1.7;
		text-align: center;
		color: rgba(var(--noir-text-rgb), 0.34);
	}

	/*
	 * 切换涟漪：圆心锚定屏幕左上角。
	 * 元素边长 = 对角线 ×2、偏移 -半径，使圆心落在 (0,0)；scale(0)→scale(1)
	 * 即从左上角一点扩到盖满整屏。颜色由 JS 按新主题底色注入。
	 *
	 * 半透明替换 —— 不透明度随扩散**渐浓**，不是恒定值：
	 *   起始 0.62：一层淡色雾，底层内容清晰可见，有"浸润"感
	 *   59% 时 0.92：此刻换主题。实测暗夜↔浅色这种极端跨度，
	 *       恒定 0.72 会留下 57~62 的亮度跳变（肉眼明显）；0.92 只剩约 20（轻微）
	 *   66% 起淡出：薄膜散去，露出已经换好的新主题
	 */
	.tv-ripple {
		position: fixed;
		z-index: 999;
		border-radius: 50%;
		pointer-events: none;
		transform: scale(0);
		animation: tv-ripple 640ms ease-out forwards;
	}

	@keyframes tv-ripple {
		0% {
			transform: scale(0);
			opacity: 0.62;
		}
		59% {
			transform: scale(0.997);
			opacity: 0.92;
		}
		66% {
			transform: scale(1);
			opacity: 0.92;
		}
		100% {
			transform: scale(1);
			opacity: 0;
		}
	}
</style>
