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

	function encodeSvg(svg) {
		return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
	}

	function buildIcon(key, active) {
		const color = active ? '#F09A6B' : 'rgba(245,237,228,0.44)'
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

	const ICON_CACHE = {
		home: { on: buildIcon('home', true), off: buildIcon('home', false) },
		feed: { on: buildIcon('feed', true), off: buildIcon('feed', false) },
		game: { on: buildIcon('game', true), off: buildIcon('game', false) },
		profile: { on: buildIcon('profile', true), off: buildIcon('profile', false) }
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
			}
		},
		mounted() {
			this.syncPermissions(false)
		},
		methods: {
			getIconSrc(key, isActive) {
				const entry = ICON_CACHE[key] || ICON_CACHE.home
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
		background: rgba(24, 19, 16, 0.94);
		border: 1rpx solid rgba(216, 176, 140, 0.22);
		box-shadow: 0 22rpx 56rpx rgba(0, 0, 0, 0.58);
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
		background: linear-gradient(180deg, rgba(226, 100, 63, 0.16), rgba(216, 176, 140, 0.06));
		border-color: rgba(226, 100, 63, 0.30);
	}

	.noir-tabbar__dot {
		position: absolute;
		bottom: 5rpx;
		width: 28rpx;
		height: 4rpx;
		border-radius: 999rpx;
		background: #E5865C;
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
		color: rgba(245, 237, 228, 0.44);
	}

	.noir-tabbar__item.is-active .noir-tabbar__label {
		color: #F09A6B;
		font-weight: 500;
	}
</style>
