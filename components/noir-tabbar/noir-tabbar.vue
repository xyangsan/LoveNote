<template>
	<view class="noir-tabbar-shell" :class="{ 'noir-tabbar-shell--placeholder': placeholder }">
		<view v-if="placeholder" class="noir-tabbar-placeholder"></view>
		<view class="noir-tabbar-fixed">
			<view class="noir-tabbar">
				<view
					v-for="item in visibleTabs"
					:key="item.key"
					class="noir-tabbar__item"
					:class="{ 'is-active': item.key === active }"
					@tap="handleTap(item)"
				>
					<view v-if="item.key === active" class="noir-tabbar__dot"></view>
					<image
						class="noir-tabbar__icon"
						:src="getIconSrc(item.key, item.key === active)"
						mode="aspectFit"
					></image>
					<text class="noir-tabbar__label">{{ item.label }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { loadAppSettings, readAppSettingsCache } from '../../common/app-settings.js'
	import { getVisibleTabItems, navigateToTab } from '../../common/utils/tab-nav.js'
	import { themeState, getThemeIconColors } from '../../common/theme.js'

	function encodeSvg(svg) {
		return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
	}

	/**
	 * ⚠️ 图标颜色必须是字面值：SVG 走 `data:image/svg+xml` 作为独立图片文档加载，
	 * 不继承页面的 CSS 变量，`stroke="var(--x)"` 会失效导致图标不显示。
	 * 颜色按当前主题从 theme.js 取，这里只负责拼 SVG。
	 */
	function buildIcon(key, active, colors) {
		const color = active ? colors.active : colors.idle
		const sw = active ? '1.8' : '1.5'
		if (key === 'home') {
			return encodeSvg(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4v-9Z"/></svg>`
			)
		}
		if (key === 'feed') {
			return encodeSvg(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H9l-5 4V6Z"/></svg>`
			)
		}
		if (key === 'game') {
			return encodeSvg(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="9" rx="4"/><circle cx="7.5" cy="12.5" r="1.2" fill="${color}" stroke="none"/><circle cx="16.5" cy="12.5" r="1.2" fill="${color}" stroke="none"/></svg>`
			)
		}
		return encodeSvg(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/></svg>`
		)
	}

	/** 按一套颜色生成 4 个 Tab 的两态图标 */
	function buildIconSet(colors) {
		const set = {}
		for (const key of ['home', 'feed', 'game', 'profile']) {
			set[key] = {
				on: buildIcon(key, true, colors),
				off: buildIcon(key, false, colors)
			}
		}
		return set
	}

	export default {
		name: 'NoirTabbar',
		props: {
			active: {
				type: String,
				default: 'home'
			},
			placeholder: {
				type: Boolean,
				default: true
			},
			settings: {
				type: Object,
				default: null
			},
			/** 是否在主 Tab 容器页内：为 true 时仅派发 @change 原地切换，不触发路由跳转 */
			inShell: {
				type: Boolean,
				default: false
			}
		},
		emits: ['change', 'refresh'],
		data() {
			return {
				localSettings: readAppSettingsCache()
			}
		},
		computed: {
			effectiveSettings() {
				return this.settings && typeof this.settings === 'object'
					? this.settings
					: this.localSettings
			},
			visibleTabs() {
				return getVisibleTabItems(this.effectiveSettings)
			},
			/**
			 * 图标随主题重建：依赖 themeState.key，切换主题时 computed 失效并重新生成，
			 * 已挂载的页面也会立即换色（不需要重新进入）。
			 */
			iconSrcMap() {
				return buildIconSet(getThemeIconColors(themeState.key))
			}
		},
		mounted() {
			this.syncPermissions(false)
		},
		methods: {
			getIconSrc(key, isActive) {
				const entry = this.iconSrcMap[key] || this.iconSrcMap.home
				return isActive ? entry.on : entry.off
			},
			async syncPermissions(remote = false) {
				this.localSettings = readAppSettingsCache()
				if (remote) {
					const latest = await loadAppSettings()
					if (latest) {
						this.localSettings = latest
					}
				}
			},
			handleTap(item) {
				if (!item) return
				if (item.key === this.active) {
					this.syncPermissions(true)
					this.$emit('refresh', item.key)
					if (typeof uni.pageScrollTo === 'function') {
						uni.pageScrollTo({ scrollTop: 0, duration: 220 })
					}
					return
				}
				this.$emit('change', item.key)
				if (!this.inShell) {
					navigateToTab(item.key, { refresh: true })
				}
			}
		}
	}
</script>

<style scoped>
	.noir-tabbar-placeholder {
		height: calc(156rpx + env(safe-area-inset-bottom));
		width: 100%;
	}

	.noir-tabbar-fixed {
		position: fixed;
		left: 28rpx;
		right: 28rpx;
		bottom: calc(20rpx + env(safe-area-inset-bottom));
		z-index: 95;
		pointer-events: none;
	}

	.noir-tabbar {
		pointer-events: auto;
		height: 122rpx;
		padding: 0 16rpx;
		border-radius: 42rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--noir-tabbar-bg);
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.22);
		box-shadow: var(--noir-tabbar-shadow);
		backdrop-filter: blur(22rpx);
		-webkit-backdrop-filter: blur(22rpx);
		box-sizing: border-box;
	}

	.noir-tabbar__item {
		flex: 1;
		height: 94rpx;
		border-radius: 30rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6rpx;
		position: relative;
		transition: background 0.18s ease, border-color 0.18s ease;
		border: 1rpx solid transparent;
	}

	.noir-tabbar__item.is-active {
		background: linear-gradient(180deg, rgba(var(--noir-coral-rgb), 0.16), rgba(var(--noir-gold-rgb), 0.06));
		border-color: rgba(var(--noir-coral-rgb), 0.30);
	}

	.noir-tabbar__dot {
		position: absolute;
		bottom: 5rpx;
		width: 28rpx;
		height: 4rpx;
		border-radius: 999rpx;
		background: var(--noir-coral-soft);
	}

	.noir-tabbar__icon {
		width: 38rpx;
		height: 38rpx;
		display: block;
	}

	.noir-tabbar__label {
		font-size: 20rpx;
		letter-spacing: 2rpx;
		line-height: 1;
		color: var(--noir-text-muted);
	}

	.noir-tabbar__item.is-active .noir-tabbar__label {
		color: var(--noir-coral-bright);
		font-weight: 500;
	}
</style>
