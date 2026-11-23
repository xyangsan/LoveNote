/**
 * 微信小程序分享 mixin —— 全局注册后统一管理各页面的右上角分享入口。
 *
 * 注册方式（见 main.js，必须在首个页面创建前执行）：
 *   Vue3  createApp() 内   app.mixin(shareMixin)
 *   Vue2  new Vue 之前      Vue.mixin(shareMixin)
 *
 * 机制说明：
 * uni Vue3 运行时通过 findMixinRuntimeHooks() 读取 app.mixin() 注册的全局 mixin
 * （见编译产物 common/vendor.js，其中带了 once() 缓存，所以注册时机不能晚于首个页面创建）。
 *
 * 策略：**默认开放，黑名单关闭**。
 *   微信小程序只要不调 hideShareMenu，右上角胶囊就自带「转发给朋友」；
 *   定义 onShareTimeline 后又多出「分享到朋友圈」。所以"不做处理"= 全部开放。
 *   本文件只对 HIDE_SHARE_PAGES 里的页面调 hideShareMenu，其余页面保持默认开放。
 *
 * ⚠️ 为什么 feed 模块要单独关（2026-11 审核驳回）：
 *   微信判定「用户自行生成内容（文字、图片、音视频）的记录、分享」即属「社交-笔记」类目，
 *   该类目个人主体不可选。双人日常（feed）是纯 UGC 图文发布页，一旦能把内容转发出去，
 *   就等于把「内容 + 分享」两条证据一起递给审核员，所以整模块关闭分享入口。
 */

import { hasValidLogin } from '@/common/auth-center.js'
import { getActiveTabKey, resolveTabKey } from '@/common/utils/tab-nav.js'
import { useAppStateStore } from '@/store/app-state.js'

/**
 * 首页地址。tabBar 页面 —— 页面间跳转必须用 uni.switchTab / uni.reLaunch，
 * uni.navigateTo 会直接失败；分享卡片的 path 则可以指向它。
 */
export const HOME_PATH = '/pages/index/index'

const SHARE_IMAGE = '/static/logo.png'

/**
 * 分享卡片落地当前页时追加的标记。
 * 被分享者打开卡片后，页面 onLoad 的 options 里会拿到 fromShare=1，
 * 据此判断「这次进入来自分享」，再决定是否要做权限校验。
 */
const SHARE_ENTRY_FLAG = 'fromShare'

// 未命中映射表的页面统一使用该兜底文案。
// 文案里避免出现「记录 / 日常 / 相册」这类笔记语义的词 —— 会被审核员当成
// 「社交-笔记」类目的直接证据。
const DEFAULT_TITLE = '恋人手札｜纪念日、心愿与聚会游戏'

// 按页面路径定制分享标题（路径统一带前导斜杠、不带 query）
// 只对「落地当前页」的页面生效；落地首页的页面一律用首页标题，避免卡片与落地页不符
const SHARE_TITLE_MAP = {
	'/pages/index/index': '恋人手札｜纪念日、心愿与聚会游戏',
	'/pages/profile/index': '恋人手札｜我们的小世界',
	'/pages/couple/index': '恋人手札｜我们的小世界',
	'/pages/album/list': '恋人手札｜我们的照片墙',
	'/pages/plan/list': '恋人手札｜想要一起做的事',
	'/pages/anniversary/list': '恋人手札｜值得记住的日子'
}

/**
 * 关闭分享入口的页面（转发 + 朋友圈一起关）。
 * hideShareMenu 是唯一能关掉微信默认转发入口的办法。
 *
 * ⚠️ feed 模块（双人日常）是审核驳回的直接来源，整模块关闭，别单独放开某一页。
 */
const HIDE_SHARE_PAGES = [
	'/pages/login/index', // 登录入口，无内容
	'/pages/public/image-cropper', // 图片裁剪工具，依赖上一页传入的图片
	'/pages/feed/list', // 双人日常列表：用户发布的图文（UGC）
	'/pages/feed/publish' // 发布日常：UGC 编辑页
]

/**
 * 首页容器页里不参与分享的 Tab。
 *
 * ⚠️ feed（双人日常）与 HIDE_SHARE_PAGES 同理：它是用户自行发布的图文 UGC，
 * 微信按「社交-笔记」类目驳回过一次（个人主体不可选）。首页内嵌的 feed Tab
 * 只要能被分享卡片的 path 直接打开，就等于把 UGC 入口递给了审核员。
 * 所以在 feed Tab 下分享一律回落 home；要放开就把它从数组里删掉。
 */
const SHARE_BLOCKED_TABS = ['feed']

/**
 * 转发时强制落地首页，而不是当前页。
 * 这些页面本身不适合对外展示（编辑态表单、或个人私密提交内容），
 * 落地首页能让被分享者从一个完整可用的页面开始浏览。
 * 朋友圈分享不支持指定 path（只能打开当前页），所以这些页面会同时关掉朋友圈入口。
 */
const LANDING_HOME_PAGES = [
	'/pages/profile/edit',
	'/pages/album/upload',
	'/pages/anniversary/edit',
	'/pages/feedback/list',
	'/pages/feedback/detail'
]

/**
 * 从分享卡片进入时需要校验权限的页面。
 * 校验不通过 → 提示并跳回首页（uni.reLaunch 会清空页面栈）。
 * 注意：只在 fromShare 标记存在时生效，用户自己从首页点进来不受影响。
 */
const SHARE_GUARD_PAGES = {
	'/pages/couple/index': {
		requireCouple: true,
		message: '情侣信息仅绑定后可查看'
	}
}

/**
 * 把路由整理成「带前导斜杠、不带 query」的统一格式。
 * 页面栈里的 route 是 pages/album/list，uni 的 $page.fullPath 是 /pages/album/list?id=1，
 * 两者都要能命中同一张表。
 * @param {string} route
 * @returns {string}
 */
function normalizeRoute(route) {
	const value = String(route || '').split('?')[0].trim()
	if (!value) {
		return ''
	}
	return value.charAt(0) === '/' ? value : '/' + value
}

/**
 * 从页面实例上读取路径。
 * @param {object} context mixin 钩子里的 this
 * @returns {string}
 */
function readRouteFromInstance(context) {
	if (!context) {
		return ''
	}
	if (context.$page && context.$page.fullPath) {
		return normalizeRoute(context.$page.fullPath)
	}
	if (context.$scope && context.$scope.route) {
		return normalizeRoute(context.$scope.route)
	}
	if (context.route) {
		return normalizeRoute(context.route)
	}
	return ''
}

/**
 * 取当前页面路径，形如 /pages/album/list。
 * 实例上的 $page 更精确，页面栈末项作为兜底（分享总是从当前页发起）。
 * @param {object} [context] mixin 钩子里的 this
 * @returns {string}
 */
export function resolveCurrentRoute(context) {
	const fromInstance = readRouteFromInstance(context)
	if (fromInstance) {
		return fromInstance
	}
	const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const current = pages && pages.length ? pages[pages.length - 1] : null
	return normalizeRoute(current && current.route)
}

/**
 * 取当前页面完整路径（含 query），用于让分享卡片「正常跳转并携带参数」。
 * 例：/pages/album/detail?albumId=abc
 * @param {object} [context] mixin 钩子里的 this
 * @returns {string}
 */
export function resolveCurrentFullPath(context) {
	if (context && context.$page && context.$page.fullPath) {
		return String(context.$page.fullPath)
	}

	const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const current = pages && pages.length ? pages[pages.length - 1] : null
	if (!current) {
		return ''
	}

	if (current.$page && current.$page.fullPath) {
		return String(current.$page.fullPath)
	}

	const route = normalizeRoute(current.route)
	if (!route) {
		return ''
	}
	const params = current.options || {}
	const keys = Object.keys(params)
	if (!keys.length) {
		return route
	}
	const query = keys
		.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
		.join('&')
	return `${route}?${query}`
}

/**
 * 取分享卡片要落地的 Tab：以页面实例当前的 activeTab 为准（用户看到哪个就分享哪个），
 * 兜底走全局总线 getActiveTabKey()。被禁分享的 Tab（feed）回落 home。
 * @param {object} [context] mixin 钩子里的 this
 * @returns {string}
 */
function resolveShareTabKey(context) {
	const rawKey = (context && context.activeTab) || getActiveTabKey()
	const key = resolveTabKey(rawKey)
	return SHARE_BLOCKED_TABS.indexOf(key) === -1 ? key : resolveTabKey('home')
}

/**
 * 首页容器页的分享路径：/pages/index/index?tab=xxx
 *
 * 不复用 $page.fullPath —— 它是冷启动时的原始地址（可能是 ?tab=game，也可能没有参数），
 * 用户在页内切过 Tab 之后就已经过期，分享卡会落到错的 Tab 上。
 * @param {object} [context] mixin 钩子里的 this
 * @returns {string}
 */
function buildHomeSharePath(context) {
	return `${HOME_PATH}?tab=${encodeURIComponent(resolveShareTabKey(context))}`
}

/**
 * 给分享路径追加分享进入标记（已带则不重复追加）。
 * @param {string} path
 * @returns {string}
 */
export function appendShareEntryFlag(path) {
	const value = String(path || '')
	if (!value) {
		return ''
	}
	if (value.indexOf(`${SHARE_ENTRY_FLAG}=`) !== -1) {
		return value
	}
	const separator = value.indexOf('?') === -1 ? '?' : '&'
	return `${value}${separator}${SHARE_ENTRY_FLAG}=1`
}

/**
 * 判断本次进入是否来自分享卡片。
 * @param {object} options 页面 onLoad 的 options
 * @returns {boolean}
 */
export function isShareEntry(options) {
	return Boolean(options && String(options[SHARE_ENTRY_FLAG]) === '1')
}

/**
 * 该页面转发时是否落地首页。
 * @param {string} route
 * @returns {boolean}
 */
export function shouldLandingHome(route) {
	return LANDING_HOME_PAGES.indexOf(normalizeRoute(route)) !== -1
}

/**
 * 该页面是否隐藏分享入口。
 * @param {string} route
 * @returns {boolean}
 */
export function shouldHideShare(route) {
	return HIDE_SHARE_PAGES.indexOf(normalizeRoute(route)) !== -1
}

/**
 * 该页面从分享进入时是否需要校验权限。
 * @param {string} route
 * @returns {boolean}
 */
export function shouldGuardShareEntry(route) {
	return Boolean(SHARE_GUARD_PAGES[normalizeRoute(route)])
}

/**
 * 按路径取分享标题。落地首页的页面用首页标题，其余命中映射表，未命中回退 DEFAULT_TITLE。
 * @param {string} route
 * @returns {string}
 */
export function resolveShareTitle(route) {
	const normalized = normalizeRoute(route)
	if (shouldLandingHome(normalized)) {
		return SHARE_TITLE_MAP[HOME_PATH] || DEFAULT_TITLE
	}
	return SHARE_TITLE_MAP[normalized] || DEFAULT_TITLE
}

/**
 * 关掉当前页面的分享入口。
 * @param {string[]} [menus] 只关指定菜单项，不传则转发 + 朋友圈全关
 */
function hideShare(menus) {
	// #ifdef MP-WEIXIN
	try {
		if (menus && menus.length) {
			uni.hideShareMenu({
				menus
			})
			return
		}
		uni.hideShareMenu()
	} catch (error) {
		console.warn('hideShareMenu failed', error)
	}
	// #endif
}

/**
 * 执行分享进入的权限校验。
 * @param {string} route
 * @returns {Promise<{ passed: boolean, message: string }>}
 */
async function runShareGuard(route) {
	const guard = SHARE_GUARD_PAGES[normalizeRoute(route)]
	if (!guard) {
		return { passed: true, message: '' }
	}

	const message = guard.message || '暂无查看权限'

	if (guard.requireCouple) {
		// 未登录的情况交给 hh-router-guard 处理（会跳登录页），这里不抢跳转，避免两个跳转打架
		if (!hasValidLogin()) {
			return { passed: true, message }
		}

		const appStateStore = useAppStateStore()
		try {
			// force: false —— 命中缓存时不会重复请求
			await appStateStore.fetchCoupleCenter({ force: false })
		} catch (error) {
			console.warn('share guard fetchCoupleCenter failed', error)
		}

		const centerData = appStateStore.coupleCenterData || {}
		return { passed: Boolean(centerData.activeCouple), message }
	}

	return { passed: true, message }
}

export default {
	async onLoad(options) {
		const route = resolveCurrentRoute(this)

		// 黑名单页面：转发 + 朋友圈一次关掉，直接 return（这类页面没有需要守卫的分享入口）
		if (shouldHideShare(route)) {
			hideShare()
			return
		}

		if (shouldLandingHome(route)) {
			// 转发会落地首页，但朋友圈不支持指定 path、只能打开当前页，
			// 这类页面打开没有意义，所以单独关掉朋友圈入口，保留转发
			hideShare(['shareTimeline'])
		}

		// 从分享卡片进入 → 校验权限，不通过则提示并跳回首页
		if (!isShareEntry(options)) {
			return
		}

		const result = await runShareGuard(route)
		if (result.passed) {
			return
		}

		uni.showToast({
			title: result.message,
			icon: 'none'
		})
		// reLaunch 会清空页面栈，避免用户再返回到无权限的页面
		uni.reLaunch({
			url: HOME_PATH
		})
	},
	onShow() {
		// 兜底：页面实例被复用或从后台切回时，菜单状态可能被系统重置，
		// 黑名单页面每次显示都再关一次（其余页面不干预，保持默认开放）
		const route = resolveCurrentRoute(this)
		if (shouldHideShare(route)) {
			hideShare()
			return
		}
		if (shouldLandingHome(route)) {
			hideShare(['shareTimeline'])
		}
	},
	onShareAppMessage() {
		const route = resolveCurrentRoute(this)

		// 防御：黑名单页面正常不会有分享入口，万一被唤起也只分享首页，绝不把 UGC 内容带出去
		if (shouldHideShare(route)) {
			return {
				title: DEFAULT_TITLE,
				path: HOME_PATH,
				imageUrl: SHARE_IMAGE
			}
		}

		const payload = {
			title: resolveShareTitle(route),
			imageUrl: SHARE_IMAGE
		}

		if (shouldLandingHome(route)) {
			payload.path = HOME_PATH
			return payload
		}

		// 首页容器页：卡片必须带上「当前激活的 Tab」，被分享者落地后直接进入同一个 Tab
		// （pages/index/index 的 onLoad 读 options.tab → activateTab + 同步全局总线）
		// 其余页面：正常跳转，落地当前页并保留 query 参数
		const fullPath = normalizeRoute(route) === HOME_PATH
			? buildHomeSharePath(this)
			: resolveCurrentFullPath(this)
		if (fullPath) {
			payload.path = appendShareEntryFlag(fullPath)
		}
		return payload
	},
	onShareTimeline() {
		const route = resolveCurrentRoute(this)
		// 朋友圈不支持指定 path（只能打开当前页），首页也只能带 query —— 同样按当前 Tab 生成
		const fullPath = normalizeRoute(route) === HOME_PATH
			? buildHomeSharePath(this)
			: resolveCurrentFullPath(this)
		const queryIndex = fullPath.indexOf('?')
		return {
			title: resolveShareTitle(route),
			// 朋友圈不支持 path，只能带 query；同样保留当前页参数
			query: queryIndex === -1 ? '' : fullPath.slice(queryIndex + 1),
			imageUrl: SHARE_IMAGE
		}
	}
}
