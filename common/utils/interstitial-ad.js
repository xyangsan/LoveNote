/**
 * 插屏广告（全 App 生命周期内最多展示一次）。
 *
 * 页面只在合适的时机调 `tryShowInterstitialAd({ chance })`，
 * 「抽概率 → 创建实例 → 等素材加载 → 延迟展示 → 记录已展示」都由这里负责。
 *
 * 状态为什么放这个模块里、还要 App.vue 重置：
 *   - 放页面模块（分包页面可能运行中被回收重建）会丢状态，变成「一次会话弹多次」；
 *   - 放内存后由 App.vue 的 onLaunch 调 `resetInterstitialAdState()` 清一次，
 *     冷启动脚本重新执行，用户下次打开小程序才有机会再弹一次。
 */

// 首页插屏广告位 id
export const INTERSTITIAL_AD_UNIT_ID = 'adunit-7da35bd90c83c292'

// 素材加载完后延迟多久再弹：太早容易误触，太晚用户已经进到别的页面了
const SHOW_DELAY = 4000

// 已真正调起过展示（本次 App 运行内不再弹）
let shown = false
// 已创建实例、正在等素材 / 等待展示（避免多次抽中时重复创建）
let pending = false
// 已经排过一次展示定时器（onLoad 可能多次回调，保证只排一次）
let scheduled = false
let instance = null

function supportsInterstitialAd() {
	return typeof wx !== 'undefined' && typeof wx.createInterstitialAd === 'function'
}

function resolveChance(chance) {
	const value = Number(chance)
	if (!Number.isFinite(value)) {
		return 1
	}
	return Math.min(1, Math.max(0, value))
}

/** 本次 App 运行内是否已经展示过插屏广告 */
export function isInterstitialAdShown() {
	return shown
}

/** App 启动时重置：用户重开小程序后可以再弹一次 */
export function resetInterstitialAdState() {
	shown = false
	pending = false
	scheduled = false
	instance = null
}

function scheduleShow() {
	if (scheduled || shown) {
		return
	}
	scheduled = true
	setTimeout(() => {
		scheduled = false
		if (shown || !instance) {
			return
		}
		instance.show()
			.then(() => {
				// 「显示后才记录状态」：只有真调起展示才算用掉这一次机会
				shown = true
				pending = false
			})
			.catch((error) => {
				console.error('interstitial ad show failed', error)
				// 展示失败不算用过，放开占位让下次 onShow 还能再抽
				pending = false
			})
	}, SHOW_DELAY)
}

/**
 * 按概率尝试展示插屏广告。
 *
 * @param {Object} options
 * @param {Number} options.chance 本次抽中的概率（0~1），默认 1（必弹）
 * @returns {Boolean} 是否进入了「准备展示」流程
 */
export function tryShowInterstitialAd(options = {}) {
	if (shown || pending) {
		return false
	}
	if (!supportsInterstitialAd()) {
		return false
	}
	// 没抽中不占位：下次 onShow 还是一次独立的机会
	if (Math.random() >= resolveChance(options.chance)) {
		return false
	}

	try {
		if (!instance) {
			instance = wx.createInterstitialAd({ adUnitId: INTERSTITIAL_AD_UNIT_ID })
			instance.onError((error) => {
				// 无填充 / 素材异常：放开占位，下次还能再抽
				console.log('interstitial ad error', error)
				pending = false
			})
			instance.onClose((res) => {
				console.log('interstitial ad closed', res)
			})
			instance.onLoad(() => {
				scheduleShow()
			})
		} else {
			// 复用上次没展示成功的实例，直接排展示
			scheduleShow()
		}
		pending = true
		return true
	} catch (error) {
		console.error('createInterstitialAd failed', error)
		pending = false
		instance = null
		return false
	}
}
