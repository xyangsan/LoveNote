/**
 * 情侣绑定引导弹框：统一的触发判定与文案配置。
 *
 * 触发条件（四个页面一致）：
 *   1. 已登录；
 *   2. 当前账号没有已绑定的情侣关系（由页面接口返回的 hasCouple / activeCouple 判定）；
 *   3. 页面首次成功加载完列表之后（不在 onShow 里反复触发）；
 *   4. 当天该场景还没弹过，且距离上次弹出已超过冷却时间。
 *
 * 之所以要冷却：四个页面各自独立触发，用户连着点进来时不至于被连续弹四次。
 */

const STORAGE_KEY = 'love_couple_guide_state'
const COOLDOWN_MS = 30 * 60 * 1000

export const COUPLE_GUIDE_SCENES = {
	album: {
		title: '绑定情侣，相册才完整',
		desc: '绑定之后 TA 也能往相册里传照片，两个人的回忆放在同一个地方。',
		hint: '未绑定前，你创建的内容只有你自己能看到。'
	},
	feed: {
		title: '绑定情侣，日常才有回应',
		desc: '绑定之后你们发布的日常会互相可见，点赞和评论也能同步收到。',
		hint: '未绑定前，你发布的日常只有你自己能看到。'
	},
	anniversary: {
		title: '绑定情侣，一起数日子',
		desc: '绑定之后一起维护纪念日，倒计时和提醒双方同步更新。',
		hint: '未绑定前，你新建的纪念日只有你自己能看到。'
	},
	plan: {
		title: '绑定情侣，愿望一起完成',
		desc: '绑定之后 TA 能看到你的愿望和计划，一起打勾、一起写完成备注。',
		hint: '未绑定前，你创建的清单只有你自己能看到。'
	}
}

function getSceneConfig(scene) {
	return COUPLE_GUIDE_SCENES[scene] || COUPLE_GUIDE_SCENES.album
}

export function getCoupleGuideContent(scene) {
	return getSceneConfig(scene)
}

function getTodayKey() {
	const now = new Date(Date.now())
	const month = `${now.getMonth() + 1}`.padStart(2, '0')
	const day = `${now.getDate()}`.padStart(2, '0')
	return `${now.getFullYear()}-${month}-${day}`
}

function readGuideState() {
	try {
		const state = uni.getStorageSync(STORAGE_KEY)
		return state && typeof state === 'object' ? state : {}
	} catch (error) {
		return {}
	}
}

function writeGuideState(state = {}) {
	try {
		uni.setStorageSync(STORAGE_KEY, state)
	} catch (error) {
		// 存储失败不影响弹框逻辑，按未记录处理
	}
}

/**
 * 是否应该弹出引导
 * @param {string} scene album | feed | anniversary | plan
 */
export function shouldShowCoupleGuide(scene = '') {
	if (!scene || !COUPLE_GUIDE_SCENES[scene]) {
		return false
	}

	const today = getTodayKey()
	const state = readGuideState()
	const isSameDay = state.date === today
	const shownScenes = isSameDay && Array.isArray(state.scenes) ? state.scenes : []

	if (shownScenes.includes(scene)) {
		return false
	}

	const lastAt = isSameDay ? Number(state.lastAt || 0) : 0
	if (lastAt > 0 && Date.now() - lastAt < COOLDOWN_MS) {
		return false
	}

	return true
}

/**
 * 记录某场景已弹出（跨天自动重置）
 */
export function markCoupleGuideShown(scene = '') {
	if (!scene) {
		return
	}

	const today = getTodayKey()
	const state = readGuideState()
	const isSameDay = state.date === today
	const shownScenes = isSameDay && Array.isArray(state.scenes) ? state.scenes : []
	const nextScenes = shownScenes.includes(scene) ? shownScenes.slice() : shownScenes.concat(scene)

	writeGuideState({
		date: today,
		scenes: nextScenes,
		lastAt: Date.now()
	})
}

/**
 * 清空记录（调试或用户绑定后需要重置时使用）
 */
export function resetCoupleGuideState() {
	try {
		uni.removeStorageSync(STORAGE_KEY)
	} catch (error) {
		// ignore
	}
}
