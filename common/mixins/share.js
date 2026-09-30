/**
 * 微信小程序分享 mixin —— 全局注册后，所有页面右上角胶囊都可「转发给朋友 / 分享到朋友圈」。
 *
 * 注册方式（见 main.js，必须在首个页面创建前执行）：
 *   Vue3  createApp() 内   app.mixin(shareMixin)
 *   Vue2  new Vue 之前      Vue.mixin(shareMixin)
 *
 * 机制说明：
 * uni Vue3 运行时通过 findMixinRuntimeHooks() 读取 app.mixin() 注册的全局 mixin
 * （见编译产物 common/vendor.js，其中带了 once() 缓存，所以注册时机不能晚于首个页面创建），
 * 命中 MINI_PROGRAM_PAGE_RUNTIME_HOOKS 里的 onShareAppMessage / onShareTimeline 后，
 * 会把钩子挂到 Page 的 methods 上（Component 构造页面时微信要求页面生命周期写在 methods 内）。
 *
 * 优先级：页面自身声明了同名钩子时优先生效，会覆盖本 mixin。
 * 目前 pages/index/index.vue 自带 onShareAppMessage / onShareTimeline，文案与下表的首页项一致；
 * 若以后想统一交给本文件管理，删掉页面里那两个钩子即可。
 */

import { hasValidLogin } from '@/common/auth-center.js'
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

// 未命中映射表的页面统一使用该兜底文案
const DEFAULT_TITLE = '恋人手札｜记录你们的双人日常'

// 按页面路径定制分享标题（路径统一带前导斜杠、不带 query）
// 只对「落地当前页」的页面生效；落地首页的页面一律用首页标题，避免卡片与落地页不符
const SHARE_TITLE_MAP = {
	'/pages/index/index': '恋人手札｜记录你们的双人日常',
	'/pages/profile/index': '恋人手札｜我们的故事，都在这里',
	'/pages/couple/index': '恋人手札｜我们的小世界',
	'/pages/album/list': '恋人手札｜我们的照片墙',
	'/pages/album/detail': '恋人手札｜翻开我们的相册',
	'/pages/feed/list': '恋人手札｜我们的日常碎片',
	'/pages/plan/list': '恋人手札｜想要一起做的事',
	'/pages/anniversary/list': '恋人手札｜值得记住的日子'
}

/**
 * 隐藏胶囊里的分享入口（在页面 onLoad 时调 uni.hideShareMenu）。
 * 命中这里的页面「转发给朋友」「分享到朋友圈」两项都会消失。
 * 只保留「分享出去没有任何意义」的入口页与纯工具页。
 */
const HIDE_SHARE_PAGES = [
	'/pages/login/index', // 登录入口，无内容
	'/pages/public/image-cropper' // 图片裁剪工具，依赖上一页传入的图片
]

/**
 * 转发时强制落地首页，而不是当前页。
 * 这些页面本身不适合对外展示（编辑态表单、或个人私密提交内容），
 * 落地首页能让被分享者从一个完整可用的页面开始浏览。
 * 朋友圈分享不支持指定 path（只能打开当前页），所以这些页面会同时关掉朋友圈入口。
 */
const LANDING_HOME_PAGES = [
	'/pages/profile/edit',
	'/pages/album/upload',
	'/pages/album/edit',
	'/pages/feed/publish',
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

		if (shouldHideShare(route)) {
			// #ifdef MP-WEIXIN
			uni.hideShareMenu()
			// #endif
			return
		}

		if (shouldLandingHome(route)) {
			// 转发会落地首页，但朋友圈不支持指定 path、只能打开当前页，
			// 这类页面打开没有意义，所以单独关掉朋友圈入口，保留转发
			// #ifdef MP-WEIXIN
			uni.hideShareMenu({
				menus: ['shareTimeline']
			})
			// #endif
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
	onShareAppMessage() {
		const route = resolveCurrentRoute(this)
		const payload = {
			title: resolveShareTitle(route),
			imageUrl: SHARE_IMAGE
		}

		if (shouldLandingHome(route)) {
			payload.path = HOME_PATH
			return payload
		}

		// 正常跳转：落地当前页并保留 query 参数，同时打上分享进入标记供权限校验使用
		const fullPath = resolveCurrentFullPath(this)
		if (fullPath) {
			payload.path = appendShareEntryFlag(fullPath)
		}
		return payload
	},
	onShareTimeline() {
		const route = resolveCurrentRoute(this)
		const fullPath = resolveCurrentFullPath(this)
		const queryIndex = fullPath.indexOf('?')
		return {
			title: resolveShareTitle(route),
			// 朋友圈不支持 path，只能带 query；同样保留当前页参数
			query: queryIndex === -1 ? '' : fullPath.slice(queryIndex + 1),
			imageUrl: SHARE_IMAGE
		}
	}
}
