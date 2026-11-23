/**
 * 广告位清单 + API 方式使用的统一配置。
 *
 * ⚠️ 微信小程序 <ad> 组件的 unit-id 不支持动态绑定（v-bind），
 *    所以页面里的 <ad unit-id="adunit-xxx"> 必须静态写死，不能绑这里的常量。
 *    本文件供 API 方式使用（插屏），同时作为广告位清单备查。
 *
 * 广告位在 uni-ad 后台（或微信广告后台）创建，小程序端 id 形如 adunit-xxxxxxxx。
 *
 * 使用方式：
 *   - 插屏：`wx.createInterstitialAd({ adUnitId: AD_ID_UNITS.interstitial })`
 *   - <ad> 标签：页面里直接静态写 unit-id="adunit-xxx"（值见下面的清单）
 */

export const AD_ID_UNITS = {
	// 插屏广告：页面切换 / 回到首页时按概率弹出（common/utils/interstitial-ad.js）
	interstitial: 'adunit-7da35bd90c83c292',
	// 原生模板 - 横版卡片：首页 / 游戏大厅信息流
	card: 'adunit-38461899baf8b875',
	// 原生模板 - 横幅 banner：各列表页底部
	banner: 'adunit-230be1ed0ea4b29b',
	// 原生模板 - 全屏：预留，暂未接入
	fullscreen: 'adunit-2767290265e577dd',
	// 格子广告：首页 / 游戏大厅宫格区
	grid: 'adunit-7a1e5e50b619b450'
}
