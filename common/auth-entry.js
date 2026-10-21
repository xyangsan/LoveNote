/**
 * 页面级登录闸门：进入「需要登录」的页面时，未登录先换页去登录页，登录成功后原路返回。
 *
 * 为什么必须由页面自己判断：
 *   1. 微信从分享卡片 / 扫码 / 场景值链接**冷启动**落地页面时，页面是微信直接创建的，
 *      不经过 uni.navigateTo / redirectTo / reLaunch / switchTab ——
 *      而 hh-router-guard（main.js）与 auth-guard（App.vue 的 onLaunch）都是 `uni.addInterceptor`，
 *      只能拦住这些 API 调用，**冷启动入口一个都拦不到**。未登录的人点链接就能直接看到页面骨架。
 *   2. 入口页的页面栈里只有它自己：用 redirectTo 换页比 navigateTo 更干净 ——
 *      登录页登录成功后自己会 `redirectTo` 回来，栈里不会残留一个废弃的空页面。
 *
 * 用法（每个需要登录的页面，onLoad 第一行）：
 *   onLoad(options) {
 *     if (!requirePageLogin()) return   // 未登录：已经跳登录页了，后面什么都别做
 *     ...
 *   }
 *
 * 房间页传 `onlyWithEntryParams: true`：只有带 roomCode / roomId（= 分享卡片或外部链接）才拦，
 * 从大厅点进来的（无参数）保留页面原有的就地登录弹窗。
 *
 * 白名单只在这里维护一份（PUBLIC_PAGE_PATHS / PUBLIC_PAGE_PREFIXES），
 * main.js 的 hh-router-guard 与 common/auth-guard.js 都引用它，别再各写一套。
 */

import { hasValidLogin } from './auth-center.js'

export const LOGIN_PAGE_PATH = '/pages/login/index'

/**
 * 无需登录即可访问的页面（tabBar 页与登录页本身）。
 * ⚠️ tabBar 页只能出现在这里：登录回跳用的是 redirectTo，对 tabBar 页会直接失败。
 */
export const PUBLIC_PAGE_PATHS = [
	'/pages/index/index',
	'/pages/profile/index',
	'/pages/login/index'
]

/** 前缀匹配的公开页（纯工具页，本身不带任何数据） */
export const PUBLIC_PAGE_PREFIXES = [
	'/pages/public/'
]

/** 房间页认得的入房参数：其它 query（fromShare、scene 等）不该带进回跳地址 */
const ROOM_ENTRY_KEYS = ['roomId', 'roomCode']

/**
 * 路由归一：`pages/album/list` / `pages/album/list?id=1` / `/pages/album/list` → `/pages/album/list`
 * @param {string} route
 * @returns {string}
 */
export function normalizePagePath(route) {
	const value = String(route || '').split('?')[0].split('#')[0].trim()
	if (!value) {
		return ''
	}
	return value.charAt(0) === '/' ? value : '/' + value
}

/**
 * 是否公开页（无需登录）。
 * @param {string} route
 * @returns {boolean}
 */
export function isPublicPage(route) {
	const path = normalizePagePath(route)
	if (!path) {
		// 拿不到路由时按「公开」处理：宁可放行，也别把用户拦在门外
		return true
	}
	if (PUBLIC_PAGE_PATHS.indexOf(path) !== -1) {
		return true
	}
	return PUBLIC_PAGE_PREFIXES.some((prefix) => path.indexOf(prefix) === 0)
}

function readCurrentPageInstance() {
	if (typeof getCurrentPages !== 'function') {
		return null
	}
	const pages = getCurrentPages()
	return pages && pages.length ? pages[pages.length - 1] : null
}

function readOptionValue(source, key) {
	if (!source || typeof source !== 'object') {
		return ''
	}
	const raw = source[key]
	if (raw === null || raw === undefined || typeof raw === 'object') {
		return ''
	}
	return String(raw).trim()
}

/**
 * 入房参数提取（房间页专用）。
 * @param {object} options 页面 onLoad 的 options
 * @returns {{ roomId: string, roomCode: string, hasEntry: boolean }}
 */
export function pickRoomEntry(options) {
	const roomId = readOptionValue(options, 'roomId')
	const roomCode = readOptionValue(options, 'roomCode')
	return {
		roomId,
		roomCode,
		hasEntry: Boolean(roomId || roomCode)
	}
}

function buildQueryString(query, keys) {
	const source = query && typeof query === 'object' ? query : {}
	const names = keys || Object.keys(source)
	const parts = names
		.map((key) => {
			const value = readOptionValue(source, key)
			return value ? `${key}=${encodeURIComponent(value)}` : ''
		})
		.filter(Boolean)
	return parts.join('&')
}

/**
 * 拼出当前页完整路径（含 query），用作登录页的 redirect 目标。
 * 例：/pages/album/detail?albumId=abc
 * @param {string} route 页面路由
 * @param {object} query 页面 query
 * @param {string[]} [onlyKeys] 只保留这些参数（房间页用 ROOM_ENTRY_KEYS）
 * @returns {string}
 */
export function buildPageFullPath(route, query, onlyKeys) {
	const path = normalizePagePath(route)
	if (!path) {
		return ''
	}
	const search = buildQueryString(query, onlyKeys)
	return search ? `${path}?${search}` : path
}

/**
 * 拼登录页地址（把回跳目标塞进 redirect，与 main.js 的 loginHandler 同口径）。
 * @param {string} targetPath 回跳目标完整路径
 * @param {string} [loginPath] 登录页路由
 * @returns {string}
 */
export function buildPageLoginUrl(targetPath, loginPath = LOGIN_PAGE_PATH) {
	const target = String(targetPath || '').trim()
	if (!target) {
		return ''
	}
	const page = normalizePagePath(loginPath) || LOGIN_PAGE_PATH
	return `${page}?redirect=${encodeURIComponent(target)}`
}

function safeHasValidLogin() {
	try {
		return hasValidLogin()
	} catch (error) {
		console.warn('requirePageLogin: hasValidLogin failed', error)
		return false
	}
}

/**
 * 同一次入口里 onLoad / onShow 可能连着问两次（页面 onShow 一般还会再请求一次数据）。
 * redirectTo 是异步的，两次都跳会报 "redirectTo:fail cant redirect" —— 用冷却窗口合并掉。
 * 另外两层守卫（hh-router-guard / auth-guard）也可能同时命中，共用这套时间戳去重。
 */
const REDIRECT_COOLDOWN_MS = 3000
let lastRedirectAt = 0

/** 是否刚刚已经发起过一次「去登录页」的跳转（冷却窗口内） */
export function isEntryRedirecting() {
	return Date.now() - lastRedirectAt < REDIRECT_COOLDOWN_MS
}

/** 记一次「去登录页」的跳转，供其它守卫做去重 */
export function beginEntryRedirect() {
	lastRedirectAt = Date.now()
}

/**
 * 页面级登录闸门。
 *
 * @param {object} [params]
 * @param {string} [params.route] 页面路由；缺省从当前页面栈取
 * @param {object} [params.options] 页面 onLoad 的 options；缺省从当前页面实例取
 * @param {boolean} [params.isLoggedIn] 登录态；缺省用 hasValidLogin()
 * @param {boolean} [params.onlyWithEntryParams] 只有带入房参数（roomCode/roomId）才拦
 * @param {string} [params.loginPath] 登录页路由
 * @returns {boolean} true = 放行，调用方继续；false = 已发起跳转，调用方必须立刻 return
 */
export function requirePageLogin({
	route,
	options,
	isLoggedIn,
	onlyWithEntryParams = false,
	loginPath = LOGIN_PAGE_PATH
} = {}) {
	const page = readCurrentPageInstance()
	const pageRoute = normalizePagePath(route || (page && page.route) || '')
	const pageQuery = options || (page && page.options) || {}

	// 公开页：永远放行
	if (isPublicPage(pageRoute)) {
		return true
	}

	// 房间页：没有入房参数 = 从大厅/首页进来的，交给页面原有的就地登录弹窗，不抢跳转
	if (onlyWithEntryParams && !pickRoomEntry(pageQuery).hasEntry) {
		return true
	}

	const logged = isLoggedIn === undefined ? safeHasValidLogin() : Boolean(isLoggedIn)
	if (logged) {
		return true
	}

	const fullPath = buildPageFullPath(
		pageRoute,
		pageQuery,
		onlyWithEntryParams ? ROOM_ENTRY_KEYS : null
	)
	const loginUrl = buildPageLoginUrl(fullPath, loginPath)
	if (!loginUrl || typeof uni === 'undefined' || typeof uni.redirectTo !== 'function') {
		// 拿不到跳转能力就放行：宁可让用户停在页面点「去登录」，也不要白屏
		return true
	}

	// 已经在跳了（onLoad 刚发起、onShow 又来问，或外层守卫刚跳过）→ 返回 false，别重复 redirectTo
	if (isEntryRedirecting()) {
		return false
	}

	// redirectTo 替换掉当前页：登录页登录成功后按 redirect 回到本页，
	// 页面栈里始终只有一页，不会出现两个页面实例同时起同步/请求。
	beginEntryRedirect()
	uni.redirectTo({
		url: loginUrl
	})
	return false
}
