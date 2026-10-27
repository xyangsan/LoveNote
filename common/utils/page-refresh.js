/**
 * 跨页面「下次显示时刷新」标记。
 *
 * 场景：A 页面改动数据后返回 B 列表页，B 需要在 onShow 里重新拉一次数据。
 * 直接在 onShow 里无条件刷新会带来副作用 —— 从图片预览、系统相册等回来也会重拉，
 * 视频列表会被整页暂停重载。所以由改动方打标记、列表页消费标记：
 *
 *   // 改动方（如发布页保存成功后）
 *   markPageRefresh('feed')
 *
 *   // 列表页 onShow
 *   if (consumePageRefresh('feed')) {
 *       this.loadList(true)
 *   }
 *
 * 标记是「一次性」的：consume 时即删除，不会重复触发。
 * 存在 storage 里（而不是内存变量），页面被回收重建后依然生效。
 */

const STORAGE_PREFIX = 'love_page_refresh_'

function normalizeKey(key = '') {
	return String(key || '').trim()
}

/**
 * 标记某个页面下次显示时需要刷新。
 * @param {string} key 页面标识，如 'feed'
 */
export function markPageRefresh(key = '') {
	const safeKey = normalizeKey(key)
	if (!safeKey) {
		return
	}
	try {
		uni.setStorageSync(`${STORAGE_PREFIX}${safeKey}`, Date.now())
	} catch (error) {
		console.warn('markPageRefresh failed', safeKey, error)
	}
}

/**
 * 消费刷新标记：有标记返回 true 并清除，没有标记返回 false。
 * @param {string} key 页面标识，如 'feed'
 * @returns {boolean}
 */
export function consumePageRefresh(key = '') {
	const safeKey = normalizeKey(key)
	if (!safeKey) {
		return false
	}
	const storageKey = `${STORAGE_PREFIX}${safeKey}`
	try {
		const value = uni.getStorageSync(storageKey)
		if (!value) {
			return false
		}
		uni.removeStorageSync(storageKey)
		return true
	} catch (error) {
		console.warn('consumePageRefresh failed', safeKey, error)
		return false
	}
}
