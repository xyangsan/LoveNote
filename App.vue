<template>
	<view class="app-root" :class="themeClass">
		<love-login-popup :visible="loginModal.visible" :reason="loginModal.reason"
			:redirect-url="loginModal.redirectUrl" @close="handleCloseLoginModal" @success="handleLoginSuccess" />
	</view>
</template>

<script>
	import LoveLoginPopup from './components/love-login-popup/love-login-popup.vue'
	import {
		emitAuthChanged,
		subscribeAuthChanged
	} from './common/auth-center.js'
	import {
		continuePendingRoute,
		installRouteAuthGuard
	} from './common/auth-guard.js'
	import {
		useAppStateStore
	} from './store/app-state.js'
	import {
		closeLoginModal,
		getLoginModalSnapshot,
		hideLoginModal,
		subscribeLoginModal
	} from './common/auth-modal.js'
	import {
		resetInterstitialAdState
	} from './common/utils/interstitial-ad.js'
	import { getPlatformApi } from './common/api/platform.js'
	import { loadAppSettings } from './common/app-settings.js'
	import { resetPhotoGridSession } from './common/utils/photo-grid-selector.js'
	import { loadThemeForUser, resetThemeToGuest, syncThemeFromUserInfo } from './common/theme.js'
	import { flushPendingGuestTheme } from './common/api/user.js'

	const DEVICE_ID_KEY = 'love_device_id'
	const VISIT_REPORT_TS_PREFIX = 'love_visit_report_ts_'
	const VISIT_DEDUPE_WINDOW_MS = 30 * 60 * 1000

	function resolveCurrentUidSync() {
		try {
			if (typeof uniCloud !== 'undefined' && typeof uniCloud.getCurrentUserInfo === 'function') {
				const info = uniCloud.getCurrentUserInfo()
				return String((info && info.uid) || '').trim()
			}
		} catch (error) {
			// ignore
		}
		return ''
	}

	function resolveDeviceId() {
		try {
			let deviceId = uni.getStorageSync(DEVICE_ID_KEY)
			if (!deviceId) {
				deviceId = `d_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
				uni.setStorageSync(DEVICE_ID_KEY, deviceId)
			}
			return deviceId
		} catch (error) {
			return ''
		}
	}

	function readLaunchOptions() {
		try {
			if (typeof uni.getLaunchOptionsSync === 'function') {
				const options = uni.getLaunchOptionsSync() || {}
				return {
					scene: options.scene === undefined ? '' : options.scene,
					path: options.path || ''
				}
			}
		} catch (error) {
			// 非小程序环境没有这个 API
		}
		return { scene: '', path: '' }
	}

	export default {
		components: {
			LoveLoginPopup
		},
		data() {
			return {
				appStateStore: null,
				loginModal: getLoginModalSnapshot(),
				unsubscribeLoginModal: null
			}
		},
		created() {
			this.unsubscribeLoginModal = subscribeLoginModal((snapshot) => {
				this.loginModal = snapshot
			})
		},
		beforeDestroy() {
			if (this.unsubscribeLoginModal) {
				this.unsubscribeLoginModal()
				this.unsubscribeLoginModal = null
			}
		},
		onLaunch() {
			// 插屏广告每次冷启动重置「已展示」状态：一次 App 运行内最多弹一次
			resetInterstitialAdState()
			// 首页宫格方案每次冷启动重新分配（进入首页时才会真正选一次）
			resetPhotoGridSession()
			installRouteAuthGuard()
			// 按「当前登录用户」恢复主题：冷启动时 JWT 已在本地，可同步解析出 uid。
			// 主题跟账号走，不同账号各存各的；未登录则落在 guest 作用域。
			// 内部会一并设置状态栏前景色与窗口底色，否则首屏会沿用 manifest 的深色预设。
			loadThemeForUser()
			// 登录成功 / 切换账号后 uid 变了，要换成该账号自己的主题。
			// onLaunch 只会跑一次，这里加个标记避免重复订阅。
			// 优先用事件里带的 userInfo 兜底 uid：万一 JWT 落盘比事件广播晚，
			// 仅靠 getCurrentUserInfo() 会读到空 uid 而误落到游客作用域。
			if (!this.themeAuthBridge) {
				this.themeAuthBridge = subscribeAuthChanged((detail) => {
					const action = (detail && detail.action) || ''
					const info = detail && detail.userInfo
					const uid = info && (info._id || info.uid)
					// 退出登录：JWT 已清空，主题要跟着交还给游客作用域，
					// 否则上一个账号的配色会一直留在屏幕上（下次冷启动才会纠正）。
					if (action === 'logout') {
						resetThemeToGuest()
						return
					}
					// 登录 / 切换账号：按「内存缓存 → storageSync → 读库 → 默认」定值，
					// 并把结果写回本地缓存（云端值只在本地没有可用主题时才生效）。
					syncThemeFromUserInfo(info, uid || undefined)
					// 未登录时换过主题：登录后把这笔选择写进账号资料，
					// 换设备 / 清缓存后也能恢复。只提交一次（取走即清标记）。
					flushPendingGuestTheme(info)
				})
			}
			this.reportVisit()
			// 全局配置（模块可见性 / 心动点任务开关）启动时拉一次写缓存，
			// 其它页面直接读 common/app-settings.js 的缓存，不再各自发请求
			loadAppSettings()
			this.ensureAppStateStore().initAppBaseInfo()
			uni.loadFontFace({
				global: true,
				family: "Fluent Emoji Flat",
				source: 'url("https://env-00jxhb140x6o.normal.cloudstatic.cn/fonts/FluentEmojiFlat.ttf")',
				success() {
					console.log("font load success");
				},
			});

		},
		onShow() {},
		onHide() {},
		methods: {
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}

				return this.appStateStore
			},
			/**
			 * 上报「进入小程序」：每次冷启动一条，用于运营后台算每日 UV / 打开次数。
			 * 任何异常都不能影响启动，所以整段包在 try 里，Promise 也吞掉。
			 */
			reportVisit() {
				try {
					const launch = readLaunchOptions()
					const deviceId = resolveDeviceId()
					const uid = resolveCurrentUidSync()
					const scopeKey = uid || (deviceId ? `guest:${deviceId}` : '')
					const now = Date.now()
					if (scopeKey) {
						try {
							const lastTs = Number(uni.getStorageSync(`${VISIT_REPORT_TS_PREFIX}${scopeKey}`)) || 0
							if (lastTs > 0 && now - lastTs < VISIT_DEDUPE_WINDOW_MS) {
								return
							}
							uni.setStorageSync(`${VISIT_REPORT_TS_PREFIX}${scopeKey}`, now)
						} catch (error) {
							// 缓存不可用时交给服务端 30 分钟窗口兜底
						}
					}

					let platform = ''
					let version = ''

					try {
						const systemInfo = uni.getSystemInfoSync() || {}
						platform = systemInfo.uniPlatform || ''
						version = systemInfo.appVersion || ''
					} catch (error) {
						// 拿不到就不传
					}

					getPlatformApi()
						.reportVisit({
							deviceId,
							scene: String(launch.scene === undefined ? '' : launch.scene),
							path: launch.path || '',
							platform,
							version
						})
						.catch(() => {})
				} catch (error) {
					console.warn('reportVisit failed', error)
				}
			},
			handleCloseLoginModal() {
				closeLoginModal()
			},
			handleLoginSuccess(result = {}) {
				hideLoginModal()
				emitAuthChanged({
					action: 'login',
					userInfo: result.userInfo || null
				})

				const hasPendingRoute = continuePendingRoute()
				if (!hasPendingRoute) {
					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})
				}
			}
		}
	}
</script>

<style lang="scss">
	/*每个页面公共css */
	@import './components/firstui/common/fui-app.css';
	@import './components/firstui/fui-theme/fui-theme.css';
	@import './common/styles/noir-serif-num.css';
	@import './common/styles/love-theme.css';

	.app-root {
		position: relative;
		z-index: 0;
	}
	.ad-view {
		margin-top: 15px;
	}
</style>