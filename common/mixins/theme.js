/**
 * 全局主题 mixin（main.js 里 app.mixin 注册）
 *
 * 提供三样东西给页面：
 *   :class="themeClass"  → theme-noir / theme-warm-1 / theme-warm-2 / theme-pale-3 / theme-green-4
 *   themeKey             → 当前主题 key，主题选择页用来标高亮
 *   themeDark            → 是否暗色主题，首页 hero「照片 / 主题渐变」二选一靠它
 *
 * onShow 里同步状态栏前景色：页面全部是自定义导航栏，状态栏文字色只能靠
 * setNavigationBarColor 的 frontColor 控制，切到浅色主题后必须改成深色文字。
 */
import { themeState, themeClassOf, getTheme, getCurrentTheme, applySystemChrome } from '../theme.js'

export default {
	computed: {
		themeClass() {
			return themeClassOf(themeState.key)
		},
		themeKey() {
			return themeState.key
		},
		/** 当前是否暗色主题：首页 hero 等「暗色用照片、亮色用主题渐变」的地方靠它切换 */
		themeDark() {
			return getTheme(themeState.key).dark === true
		}
	},
	onShow() {
		applySystemChrome(getCurrentTheme(), true)
	}
}
