/**
 * 自定义 4-Tab 底部导航状态总线与无 reLaunch 切页工具
 *
 * 设计原则：
 *   1. 不使用系统级 pages.json tabBar，也不使用 uni.reLaunch 切换 Tab（避免整页销毁闪烁）
 *   2. pages/index/index 作为主 Tab 容器页，内嵌 4 个 Tab 视图组件（首页 / 日常 / 游戏 / 我的）
 *   3. 切 Tab 时通过状态总线即时切换 + 动态触发目标 Tab 的 refresh() 与权限同步
 *   4. 从二级页返回任意 Tab 时：优先查栈内已有的 pages/index/index，设置目标 Tab 后 uni.navigateBack；
 *      仅当栈内不存在首页（如冷启动落地二级页）时使用 uni.redirectTo('/pages/index/index?tab=...')
 */

import { readAppSettingsCache } from '../app-settings.js'
import { markPageRefresh } from './page-refresh.js'

export const TAB_ITEMS = [
	{
		key: 'home',
		label: '首页',
		path: '/pages/index/index',
		refreshKey: 'tab_home'
	},
	{
		key: 'feed',
		label: '日常',
		path: '/pages/feed/list',
		refreshKey: 'feed',
		settingKey: 'feedVisible'
	},
	{
		key: 'game',
		label: '游戏',
		path: '/pages/game/index',
		refreshKey: 'tab_game',
		settingKey: 'gameVisible'
	},
	{
		key: 'profile',
		label: '我的',
		path: '/pages/profile/index',
		refreshKey: 'tab_profile'
	}
]

let currentTabKey = 'home'
const listeners = new Set()

export function normalizePagePath(path = '') {
	const raw = String(path || '').split('?')[0].trim()
	if (!raw) return ''
	return raw.startsWith('/') ? raw : `/${raw}`
}

export function resolveTabKey(keyOrPath = 'home') {
	const raw = String(keyOrPath || '').trim()
	const normalized = normalizePagePath(raw)
	const found = TAB_ITEMS.find((item) => item.key === raw || item.path === normalized)
	return found ? found.key : 'home'
}

export function isTabPagePath(path = '') {
	const normalized = normalizePagePath(path)
	return TAB_ITEMS.some((item) => item.path === normalized)
}

export function getActiveTabKey() {
	return currentTabKey
}

export function setActiveTabKey(key = 'home', options = {}) {
	const nextKey = resolveTabKey(key)
	const changed = nextKey !== currentTabKey
	currentTabKey = nextKey
	const payload = {
		key: nextKey,
		changed,
		refresh: options.refresh !== false
	}
	listeners.forEach((fn) => {
		try {
			fn(payload)
		} catch (error) {
			console.warn('tab listener failed', error)
		}
	})
	return nextKey
}

export function subscribeTabChange(listener) {
	if (typeof listener !== 'function') {
		return () => {}
	}
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function getVisibleTabItems(settings) {
	const resolved = settings && typeof settings === 'object' ? settings : readAppSettingsCache()
	return TAB_ITEMS.filter((item) => {
		if (!item.settingKey) return true
		return resolved[item.settingKey] === true
	})
}

/**
 * 切换到指定 Tab（不使用 uni.reLaunch）：
 *   - 已在主容器页（pages/index/index）：原地切换并动态刷新
 *   - 主容器页在页面栈中：先写入目标 Tab + 刷新标记，再 uni.navigateBack 回到主容器页
 *   - 栈中无主容器页（如分享卡片冷启动）：uni.redirectTo 到 /pages/index/index?tab=xxx
 */
export function navigateToTab(keyOrPath = 'home', options = {}) {
	const targetKey = resolveTabKey(keyOrPath)
	const targetItem = TAB_ITEMS.find((item) => item.key === targetKey) || TAB_ITEMS[0]

	if (options.refresh !== false && targetItem.refreshKey) {
		markPageRefresh(targetItem.refreshKey)
	}

	const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
	const topPage = pages.length ? pages[pages.length - 1] : null
	const topRoute = topPage ? normalizePagePath(topPage.route || '') : ''

	// 1. 当前就在主 Tab 容器页：直接原地切 Tab
	if (topRoute === '/pages/index/index') {
		setActiveTabKey(targetKey, { refresh: options.refresh !== false })
		return
	}

	// 2. 页面栈中已有主 Tab 容器页：更新目标 Tab 后 navigateBack 返回，无闪烁无 reLaunch
	const shellIndex = pages.findIndex((p) => normalizePagePath(p && p.route) === '/pages/index/index')
	if (shellIndex >= 0) {
		const delta = pages.length - 1 - shellIndex
		setActiveTabKey(targetKey, { refresh: options.refresh !== false })
		if (delta > 0) {
			uni.navigateBack({ delta })
		}
		return
	}

	// 3. 栈中无主容器页（冷启动落地二级页）：redirectTo 进入主容器页
	setActiveTabKey(targetKey, { refresh: options.refresh !== false })
	uni.redirectTo({
		url: `/pages/index/index?tab=${encodeURIComponent(targetKey)}`
	})
}

export function goHomeTab(options = {}) {
	navigateToTab('home', options)
}

export function goProfileTab(options = {}) {
	navigateToTab('profile', options)
}
