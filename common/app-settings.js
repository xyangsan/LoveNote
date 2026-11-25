import { getPlatformApi } from './api/platform.js'

/**
 * 全局配置（服务端 love-app-settings）的本地缓存与读取。
 *
 * 读取链路：
 *   1. App 启动时 loadAppSettings() 拉一次服务端配置写进本地缓存；
 *   2. 其它页面只调 readAppSettingsCache()，不再各自发请求；
 *   3. 运营管理「权限」tab 是唯一需要实时的页面：它直接读服务端，保存后同步写缓存。
 *
 * 缓存 key 复用首页历史上用的 love_module_visibility，避免新旧两套缓存打架。
 */

const CACHE_KEY = 'love_module_visibility'
// 上一版单独存过 feed 布尔值，升级后第一次读缓存时兼容一下
const LEGACY_FEED_KEY = 'love_feed_visible'

// 小游戏子开关：必须和 common/game/rules.js 的 GAME_TYPE_* 一致
const GAME_ITEM_KEYS = ['undercover', 'landlord', 'bomb']
// 心动点每日任务：必须和云函数 lib/points.js 的 TASK_DISPLAY_ORDER 一致
const POINTS_TASK_KEYS = ['daily_post', 'photo_upload', 'game_settle', 'anniversary', 'plan_create', 'plan_finish']
// 任务依赖的页面显示开关：对应页面关掉后，任务在用户端也不展示
const POINTS_TASK_DEPENDS = {
	daily_post: 'feedVisible',
	game_settle: 'gameVisible'
}

const DEFAULT_APP_SETTINGS = {
	feedVisible: false, // 双人日常：权限类开关，默认关闭
	gameVisible: true, // 聚会游戏：功能类开关，默认开启
	gameItems: {},
	pointsTasks: {}
}
GAME_ITEM_KEYS.forEach((key) => {
	DEFAULT_APP_SETTINGS.gameItems[key] = true
})
POINTS_TASK_KEYS.forEach((key) => {
	DEFAULT_APP_SETTINGS.pointsTasks[key] = true
})

/** 服务端可能缺字段（老版本云函数），一律按「默认开启」补齐 */
function normalizeGameItems(items) {
	const source = items && typeof items === 'object' ? items : {}
	const normalized = {}
	GAME_ITEM_KEYS.forEach((key) => {
		normalized[key] = source[key] !== false
	})
	return normalized
}

function normalizePointsTasks(tasks) {
	const source = tasks && typeof tasks === 'object' ? tasks : {}
	const normalized = {}
	POINTS_TASK_KEYS.forEach((key) => {
		normalized[key] = source[key] !== false
	})
	return normalized
}

function normalizeAppSettings(raw) {
	const source = raw && typeof raw === 'object' ? raw : {}
	return {
		feedVisible: source.feedVisible === true,
		gameVisible: source.gameVisible !== false,
		gameItems: normalizeGameItems(source.gameItems),
		pointsTasks: normalizePointsTasks(source.pointsTasks)
	}
}

function getDefaultAppSettings() {
	return normalizeAppSettings(DEFAULT_APP_SETTINGS)
}

/** 读缓存：缺失 / 读失败一律用默认值，别把异常带进页面 */
function readAppSettingsCache() {
	try {
		const cached = uni.getStorageSync(CACHE_KEY)
		if (!cached || typeof cached !== 'object') {
			const fallback = getDefaultAppSettings()
			const legacyFeed = uni.getStorageSync(LEGACY_FEED_KEY)
			if (legacyFeed !== '' && legacyFeed !== undefined && legacyFeed !== null) {
				fallback.feedVisible = legacyFeed === true || legacyFeed === 'true' || legacyFeed === 1
			}
			return fallback
		}
		return normalizeAppSettings(cached)
	} catch (error) {
		return getDefaultAppSettings()
	}
}

/**
 * 写缓存：按 patch 合并，没传的字段保留缓存里的值。
 * 首页只关心 feedVisible / gameVisible，不能因为它的写入把 pointsTasks 抹掉。
 */
function writeAppSettingsCache(patch = {}) {
	try {
		const current = readAppSettingsCache()
		const next = normalizeAppSettings(Object.assign({}, current, patch))
		uni.setStorageSync(CACHE_KEY, next)
		return next
	} catch (error) {
		// 缓存写失败不影响本次渲染，下次启动会重新拉服务端配置
		return readAppSettingsCache()
	}
}

/**
 * 拉服务端配置并写缓存。失败时返回缓存值、不抛错 —— 调用方是 App 启动流程，
 * 配置读不到不该影响启动。
 *
 * 去重策略（冷启动时 App.onLaunch 与首页 onLoad 会各要一次）：
 *   - 有请求在飞 → 直接复用同一个 Promise，不再发第二次；
 *   - 默认 5s 内复用上次结果（`loadedAt`），避免各页面挂载时各拉一遍；
 *   - 需要「一定要最新」时传 `{ force: true }`：只跳过 TTL，仍然复用飞行中的请求。
 */
const LOAD_TTL = 5 * 1000

let pendingLoad = null
let loadedAt = 0

async function fetchAppSettings() {
	try {
		const result = await getPlatformApi().getModuleVisibility()
		if (!result || (result.errCode && result.errCode !== 0)) {
			return { ok: false, settings: readAppSettingsCache() }
		}
		return { ok: true, settings: writeAppSettingsCache(result.data || {}) }
	} catch (error) {
		console.warn('loadAppSettings failed', error)
		return { ok: false, settings: readAppSettingsCache() }
	}
}

function loadAppSettings(options = {}) {
	const force = Boolean(options && options.force)
	if (pendingLoad) {
		return pendingLoad
	}
	if (!force && loadedAt && Date.now() - loadedAt < LOAD_TTL) {
		return Promise.resolve(readAppSettingsCache())
	}

	const settle = (outcome) => {
		if (pendingLoad === task) {
			pendingLoad = null
			// 失败不记时间戳：首页 onLoad 紧接着还会要一次，得让它能立刻重试
			loadedAt = outcome.ok ? Date.now() : 0
		}
		return outcome.settings
	}
	const task = fetchAppSettings().then(settle, (error) => {
		console.warn('loadAppSettings failed', error)
		return settle({ ok: false, settings: readAppSettingsCache() })
	})
	pendingLoad = task
	return task
}

/** 只给回归脚本 / 调试用：把节流状态清干净 */
function resetAppSettingsLoadState() {
	pendingLoad = null
	loadedAt = 0
}

/** 心动点任务开关：没配置过按开启处理；依赖的页面关掉了，任务也不展示 */
function isPointsTaskEnabled(settings, taskKey) {
	const tasks = settings && settings.pointsTasks ? settings.pointsTasks : {}
	if (tasks[taskKey] === false) {
		return false
	}
	const dependsOn = POINTS_TASK_DEPENDS[taskKey]
	if (dependsOn && (!settings || settings[dependsOn] !== true)) {
		return false
	}
	return true
}

export {
	CACHE_KEY as APP_SETTINGS_CACHE_KEY,
	GAME_ITEM_KEYS,
	POINTS_TASK_KEYS,
	getDefaultAppSettings,
	readAppSettingsCache,
	writeAppSettingsCache,
	loadAppSettings,
	resetAppSettingsLoadState,
	isPointsTaskEnabled
}
