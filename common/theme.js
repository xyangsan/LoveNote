/**
 * LoveNote · 主题注册表
 *
 * ⚠️ 单一真值在样式层：`common/styles/love-theme.css` 里的 `page, .theme-noir` 与
 * `.theme-warm-1 / .theme-warm-2 / .theme-pale-3 / .theme-green-4` 四组类。
 * 本文件只存元信息（名称 / 描述 / 预览色 / 明暗 / 背景图），不重复存放色值 ——
 * 否则改一次主题要改两处，必然漂移。
 *
 * 6 套主题来自 Ardot 设计稿 `749174707492860` 的 05 页（`05 组件与规范`）：
 * 参考板 `67:1`（暗夜）+ v1 `158:1` / v2 `158:340` / v3 `158:679` / v4 `158:1018` /
 * v5 樱粉晚风 `196:1`（PINK-5 · SAKURA BLUSH）。
 *
 * 背景图（`art` 字段）来自设计稿 01 页「核心四屏」的 Hero 位图：
 * V1~V4 各 3 张归档在 `warm/assets/四主题图片`，压缩后落在 `static/images/theme/`；
 * 暗夜沿用工程原有的 3 张默认图。
 *
 * 切换方式：页面根节点绑 `:class="themeClass"`（全局 mixin 提供），
 * 变量在该子树内被覆盖，`page` 上仍保留暗夜默认值作为兜底。
 */
import { reactive } from 'vue'

export const THEME_STORAGE_KEY = 'love_theme_key'
export const DEFAULT_THEME_KEY = 'green-4'

export const THEMES = [
	{
		key: 'noir',
		name: '暗夜余烬',
		en: 'NOIR · EMBER',
		desc: '暖棕深底配暖金与余烬，月白正文，暗但不闷。',
		dark: true,
		bg: '#241D18',
		swatches: ['#241D18', '#2E251E', '#E3BE9A', '#E2643F', '#F7F1E9'],
		ink: '#F7F1E9',
		art: {
			home: '/static/images/home-hero-bg.jpg',
			feed: '/static/images/feed-cover-bg.jpg',
			anniv: '/static/images/anniv-hero-bg.jpg'
		}
	},
	{
		key: 'warm-1',
		name: '暖阳奶咖',
		en: 'WARM-1 · MILK CARAMEL',
		desc: '奶白浮层配焦糖暖金，余烬橘作强调，最柔和的一套。',
		dark: false,
		bg: '#F4E6D6',
		swatches: ['#F4E6D6', '#FBF0E3', '#9B5F2E', '#C24A29', '#FFF3E4'],
		ink: '#1F130A',
		art: {
			home: '/static/images/theme/v1-home.jpg',
			feed: '/static/images/theme/v1-feed.jpg',
			anniv: '/static/images/theme/v1-anniv.jpg'
		}
	},
	{
		key: 'warm-2',
		name: '暮色暖橘',
		en: 'WARM-2 · DUSK TANGERINE',
		desc: '暖驼焦糖奶茶调，陶土橘为主色，更浓也更复古。',
		dark: false,
		bg: '#E7C6A6',
		swatches: ['#E7C6A6', '#F3DCC4', '#875121', '#B3451E', '#FBE3C8'],
		ink: '#1C0F06',
		art: {
			home: '/static/images/theme/v2-home.jpg',
			feed: '/static/images/theme/v2-feed.jpg',
			anniv: '/static/images/theme/v2-anniv.jpg'
		}
	},
	{
		key: 'pale-3',
		name: '素白极简',
		en: 'PALE-3 · MINIMAL WHITE',
		desc: '纯白浮层配细灰线与克制暖金，留白最多的一套。',
		dark: false,
		bg: '#F6F5F2',
		swatches: ['#F6F5F2', '#FFFFFF', '#86633D', '#A85B2C', '#F6F3ED'],
		ink: '#12100E',
		art: {
			home: '/static/images/theme/v3-home.jpg',
			feed: '/static/images/theme/v3-feed.jpg',
			anniv: '/static/images/theme/v3-anniv.jpg'
		}
	},
	{
		key: 'green-4',
		name: '青野浅绿',
		en: 'GREEN-4 · SAGE MIST',
		desc: '白底配细绿灰线与低饱和鼠尾草绿，清透安静。',
		dark: false,
		bg: '#EDF1EA',
		swatches: ['#EDF1EA', '#FFFFFF', '#4F7446', '#487140', '#EFF4E9'],
		ink: '#141A11',
		art: {
			home: '/static/images/theme/v4-home.jpg',
			feed: '/static/images/theme/v4-feed.jpg',
			anniv: '/static/images/theme/v4-anniv.jpg'
		}
	},
	{
		key: 'pink-5',
		name: '樱粉晚风',
		en: 'PINK-5 · SAKURA BLUSH',
		desc: '粉雾奶白底配玫瑰金与樱红，深莓棕正文，柔和里带一点晚霞。',
		dark: false,
		// 五个色点直取设计稿 05 页 196:1：底色 / 浮层 / 主金 / 主色 / 浅底
		bg: '#F6E7EA',
		swatches: ['#F6E7EA', '#FFFFFF', '#964C66', '#C1385C', '#FFF1F4'],
		ink: '#31181F',
		// 樱粉专属配图（720×600 / 720×405，按出图中心裁切压缩）：
		// home = 室内粉调特写、feed = 樱花大道、anniv = 海边落日
		art: {
			home: '/static/images/theme/v5-home.jpg',
			feed: '/static/images/theme/v5-feed.jpg',
			anniv: '/static/images/theme/v5-anniv.jpg'
		}
	}
]

const THEME_MAP = THEMES.reduce((acc, item) => {
	acc[item.key] = item
	return acc
}, {})

/**
 * ⚠️ 唯一一处「色值重复」：小程序 API（`uni.showModal` 的 confirmColor 等）
 * 只吃字面值，不认 CSS 变量。这里存的是各主题的 --noir-coral，校验脚本会
 * 断言它和 love-theme.css 里的取值一致，改主题时两边要一起改。
 * 除 API 传参外一律走 CSS 变量，不要从这张表里取色。
 */
const THEME_CORAL = {
	'noir': '#E2643F',
	'warm-1': '#C24A29',
	'warm-2': '#B3451E',
	'pale-3': '#A85B2C',
	'green-4': '#487140',
	'pink-5': '#C1385C'
}

/** 当前主题的强调色（仅供小程序 API 传参使用） */
export function getThemeCoral() {
	return THEME_CORAL[themeState.key] || THEME_CORAL[DEFAULT_THEME_KEY]
}

/** 供校验脚本比对 */
export const THEME_CORAL_TABLE = THEME_CORAL

/**
 * ⚠️ 第二处「色值重复」：tabbar 图标是内联 SVG（`data:image/svg+xml`），
 * SVG 作为独立图片文档**不继承页面的 CSS 变量**，写 `stroke="var(--x)"` 会直接失效、
 * 图标不显示。所以这里必须存字面值。
 *
 * 取值来源：`--noir-coral-bright`（选中）与 `--noir-text` 的 44%/58% alpha（未选中），
 * 校验脚本会断言与 love-theme.css 一致。改主题时两边要一起改。
 */
const THEME_ICON = {
	'noir': { active: '#F4A87A', idle: 'rgba(247, 241, 233, 0.44)' },
	'warm-1': { active: '#CC5B3C', idle: 'rgba(31, 19, 10, 0.58)' },
	'warm-2': { active: '#BF542E', idle: 'rgba(28, 15, 6, 0.58)' },
	'pale-3': { active: '#B56B3D', idle: 'rgba(18, 16, 14, 0.58)' },
	'green-4': { active: '#588050', idle: 'rgba(20, 26, 17, 0.58)' },
	'pink-5': { active: '#CC4A6D', idle: 'rgba(49, 24, 31, 0.58)' }
}

/** 当前主题的图标两档颜色（仅供内联 SVG 使用） */
export function getThemeIconColors(key) {
	return THEME_ICON[key] || THEME_ICON[DEFAULT_THEME_KEY]
}

/** 供校验脚本比对 */
export const THEME_ICON_TABLE = THEME_ICON

/** 新版存储前缀（带尾下划线），实际 key 形如 `love_theme_key_<uid>` */
export const THEME_STORAGE_PREFIX = 'love_theme_key_'
/** 未登录时使用的作用域，保证游客换主题也能被记住 */
export const GUEST_THEME_SCOPE = 'guest'

/**
 * 读当前登录用户的 uid。
 * `getCurrentUserInfo()` 是本地解析 uni_id_token（JWT），同步、不发请求，
 * 所以启动阶段就能用它决定主题该落在哪个用户作用域下。
 */
function readCurrentUid() {
	try {
		if (typeof uniCloud !== 'undefined' && typeof uniCloud.getCurrentUserInfo === 'function') {
			const info = uniCloud.getCurrentUserInfo()
			return (info && info.uid) || ''
		}
	} catch (e) {}
	return ''
}

/** 作用域化存储 key：同一个 uid 永远映射到同一个 key */
function storageKeyOf(uid) {
	return `${THEME_STORAGE_PREFIX}${uid || GUEST_THEME_SCOPE}`
}

/** 存储 key 对外只读出口：调试面板 / 回归脚本要确认「写到了哪个账号名下」 */
export function getThemeStorageKey(uid) {
	return storageKeyOf(uid)
}

/**
 * 内存缓存：作用域 uid → 该作用域已确认的主题 key。
 *
 * `themeState` 只表示「当前生效值」，而启动链路上 `loadThemeForUser()` /
 * `applyRemoteTheme()` / 登录事件会连着调好几次，每次都同步读一遍 storageSync
 * 是启动路径上不必要的同步 IO。这里做读穿透：
 *   · 命中直接返回，不再碰 storage
 *   · 未命中才读 storageSync，并把结果缓存 —— **包括空值**，
 *     因为「确认过这个账号没有记录」同样是有用的信息，否则首次登录会反复回读
 *
 * ⚠️ 所有写操作都必须走 `writeStoredKey()`（write-through），
 * 不要在本模块外直接 `uni.setStorageSync(storageKeyOf(...))`，
 * 否则内存缓存会留着旧值，比不缓存更难排查。
 */
const themeKeyCache = new Map()

/** 只在本次运行内做一次旧 key 迁移，避免每次 load 都多读一次 storage */
let legacyMigrationDone = false

function readStoredKey(uid) {
	return readStoredKeyWithSource(uid).key
}

/**
 * 读库并回报来源：`memory`（内存缓存命中）/ `storage`（本次从 getStorageSync 读到）。
 * 两级的先后顺序就是在这里落地的，`readStoredKey()` 只是拿 key 的薄封装。
 */
function readStoredKeyWithSource(uid) {
	const scope = uid || ''
	if (themeKeyCache.has(scope)) {
		return { key: themeKeyCache.get(scope), source: 'memory' }
	}

	let key = ''
	try {
		const raw = uni.getStorageSync(storageKeyOf(scope))
		if (isValidThemeKey(raw)) {
			key = raw
		}
	} catch (e) {
		// 存储不可用（隐私模式 / 配额满）时按「没有记录」处理，绝不抛给调用方
		key = ''
	}
	themeKeyCache.set(scope, key)
	return { key, source: key ? 'storage' : 'memory' }
}

function writeStoredKey(key, uid) {
	const scope = uid || ''
	// 先写内存再写库：写库失败时至少本次运行内的读路径是一致的
	themeKeyCache.set(scope, key)
	try {
		uni.setStorageSync(storageKeyOf(scope), key)
	} catch (e) {}
}

/**
 * 清掉某个作用域（不传 = 全部）的内存缓存。
 *
 * 用途：回归脚本模拟「冷启动」，或外部直接改过 storage 后需要让下一次读取重新以
 * storage 为准。
 *
 * ⚠️ **不要在退出登录时调用**：登出只切作用域（`resetThemeToGuest`），
 * 该账号的 `love_theme_key_<uid>` 和它的内存缓存都要留着，下次登录直接复用。
 * ⚠️ 只清内存，不动 storage —— 主题本身仍跟着账号持久化。
 */
export function clearThemeCache(uid) {
	if (uid === undefined) {
		themeKeyCache.clear()
		pendingGuestThemeCache = null
		return
	}
	themeKeyCache.delete(String(uid || ''))
}

/**
 * 「游客期间切的主题」标记。
 *
 * 场景：未登录时用户点了一套主题 —— 没有 uid 可归属，只能先记在游客名下。
 * 等他登录后，这笔选择应该：
 *   1. 覆盖到该账号名下（本地 storageSync + 内存缓存）
 *   2. 推一份到云端用户资料（`user/updateProfile` 的 `themeKey`），换设备也能带走
 *
 * 为什么单独一个 key：它要跨「游客 → 登录」这次身份切换存活，
 * 而 `love_theme_key_<uid>` 是账号作用域的，游客态写不进去。
 * 一旦登录后消费掉（`takePendingGuestTheme()`），立即删除，避免下次登录又重复推。
 */
const PENDING_GUEST_THEME_KEY = 'love_theme_pending_theme_key'

/** 内存镜像：null = 还没读过；'' = 读过且没有待同步值。避免每次解析都同步读 storage */
let pendingGuestThemeCache = null

function readPendingGuestTheme() {
	if (pendingGuestThemeCache !== null) return pendingGuestThemeCache
	let key = ''
	try {
		const raw = uni.getStorageSync(PENDING_GUEST_THEME_KEY)
		if (isValidThemeKey(raw)) key = raw
	} catch (e) {
		key = ''
	}
	pendingGuestThemeCache = key
	return key
}

function writePendingGuestTheme(key) {
	if (isValidThemeKey(key)) {
		pendingGuestThemeCache = key
		try {
			uni.setStorageSync(PENDING_GUEST_THEME_KEY, key)
		} catch (e) {}
		return
	}
	pendingGuestThemeCache = ''
	try {
		uni.removeStorageSync(PENDING_GUEST_THEME_KEY)
	} catch (e) {}
}

/**
 * 取走「游客期间切的主题」（读一次即清空）。
 *
 * 调用方：登录成功后把返回值写进用户信息（`updateProfile({ themeKey })`）。
 * 只返回一次 —— 后续调用返回空串，天然防止 App.vue 与 store 两处重复提交。
 *
 * @returns {string} 待同步的主题 key，没有则空串
 */
export function takePendingGuestTheme() {
	const key = readPendingGuestTheme()
	if (key) writePendingGuestTheme('')
	return key
}

/** 是否还有未同步到账号的游客主题（调试 / 回归用） */
export function hasPendingGuestTheme() {
	return Boolean(readPendingGuestTheme())
}

/**
 * 旧版本用的是无后缀的 `love_theme_key`（全局唯一、不区分账号）。
 * 升级到按用户隔离后，把它迁移到当前作用域，避免用户已经选好的主题丢失；
 * 迁移完立即删掉旧 key，防止下次启动又被当成"新装用户的旧值"读回来。
 */
function migrateLegacyThemeKey(uid) {
	if (legacyMigrationDone) return
	legacyMigrationDone = true
	try {
		const legacy = uni.getStorageSync(THEME_STORAGE_KEY)
		if (!legacy) return
		if (isValidThemeKey(legacy) && !readStoredKey(uid)) {
			writeStoredKey(legacy, uid)
		}
		uni.removeStorageSync(THEME_STORAGE_KEY)
	} catch (e) {}
}

export function isValidThemeKey(key) {
	return typeof key === 'string' && Object.prototype.hasOwnProperty.call(THEME_MAP, key)
}

export function getTheme(key) {
	return THEME_MAP[key] || THEME_MAP[DEFAULT_THEME_KEY]
}

export function getCurrentTheme() {
	return getTheme(themeState.key)
}

/** 主题类名，直接给页面根节点用 */
export function themeClassOf(key) {
	return `theme-${getTheme(key).key}`
}

/**
 * 取当前主题在某场景下的 Hero 背景图。
 *
 * 场景：`home`（首页） / `feed`（双人日常） / `anniv`（纪念日）。
 * ⚠️ 这些是**兜底图**：feed 与 anniv 若用户上传了自己的封面 / 动态首图，
 * 调用方必须先判断用户内容，只有没有用户内容时才回落到这里。
 */
export function getThemeArt(scene, key) {
	const theme = getTheme(key || themeState.key)
	const art = theme && theme.art
	return (art && art[scene]) || ''
}

/** '#RRGGBB' → 'r, g, b'（拼 rgba(var()) 用） */
function hexToRgbTriplet(hex) {
	const value = String(hex || '').replace('#', '')
	if (value.length !== 6) return '0, 0, 0'
	return [0, 2, 4].map((i) => parseInt(value.substr(i, 2), 16)).join(', ')
}

/**
 * Canvas 图表色板。
 *
 * `xtf-charts` 是 Canvas 2D 绘制，**不继承页面 CSS 变量**，
 * 所以主题色只能在这里按当前主题算成字面值，页面构建 option 时传进去。
 * 底色取主题的浮层色（暗夜 #2E251E / 浅色各主题用白），文字与网格按 ink 推 alpha。
 */
export function getChartPalette(key) {
	const theme = getTheme(key || themeState.key)
	const ink = hexToRgbTriplet(theme.ink)
	// 第二格预览色就是该主题的「浮层色」（暗夜 #2E251E / 暖咖 #FBF0E3 / 素白与青野 #FFFFFF），
	// 与卡片底色一致，图表不会在白卡片上糊出一块纯白或纯黑。
	const surface = theme.swatches[1] || theme.bg
	return {
		bg: surface,
		text: `rgba(${ink}, ${theme.dark ? 0.58 : 0.72})`,
		title: theme.ink,
		grid: `rgba(${ink}, 0.10)`,
		tooltipBg: `rgba(${hexToRgbTriplet(surface)}, 0.96)`,
		tooltipText: theme.ink,
		// 柱图右侧的百分比标签：按传入主题取强调色（getThemeCoral() 读的是当前生效主题，这里不能用）
		label: theme.dark ? '#F2E0C9' : (THEME_CORAL[theme.key] || THEME_CORAL[DEFAULT_THEME_KEY])
	}
}

/**
 * 全局响应式主题状态。
 * 用 reactive 而不是事件总线：所有已挂载页面会自动重渲染，无需各自订阅。
 *
 * `uid` 记录当前主题归属的账号（空串 = 未登录的游客作用域），
 * 切换主题时按它决定写入哪个存储 key。
 */
export const themeState = reactive({
	key: DEFAULT_THEME_KEY,
	uid: ''
})

let lastChromeKey = ''

/**
 * 同步状态栏与窗口底色。
 * 页面全部使用自定义导航栏（navigationStyle: custom），但状态栏文字色仍由
 * `setNavigationBarColor` 的 frontColor 控制，不设的话浅色主题上白字会看不见。
 * 各平台差异较大，统一 try/catch 兜住，失败不影响业务。
 */
export function applySystemChrome(theme, force) {
	const target = theme || getCurrentTheme()
	if (!force && lastChromeKey === target.key) return
	lastChromeKey = target.key

	const frontColor = target.dark ? '#ffffff' : '#000000'
	try {
		uni.setNavigationBarColor({ frontColor, backgroundColor: target.bg })
	} catch (e) {}
	try {
		// 仅小程序端有；用于下拉回弹时的窗口底色，避免露出上一套主题
		uni.setBackgroundColor && uni.setBackgroundColor({ backgroundColor: target.bg })
	} catch (e) {}
}

/** 切换主题并持久化到「当前用户」名下 */
export function setThemeKey(key) {
	if (!isValidThemeKey(key)) return false
	themeState.key = key
	// 游客期间的选择记一笔：登录后要把它推给账号（云端用户信息）
	if (!themeState.uid) {
		writePendingGuestTheme(key)
	} else {
		// 已登录用户的操作本身就是最新意图，旧标记作废
		writePendingGuestTheme('')
	}
	// 写库同时刷新内存缓存，保证「刚切完再读」不会读回旧值
	writeStoredKey(key, themeState.uid)
	applySystemChrome(getTheme(key), true)
	return true
}

/**
 * 主题解析的唯一真值来源（运行时读配置都走这里）。
 *
 * 顺序（严格按此优先级，先命中先返回）：
 *   1. 内存缓存        —— `themeKeyCache`，免同步 IO
 *   2. getStorageSync  —— `love_theme_key_<uid>`，冷启动后的本地持久化值
 *   3. 读库            —— 调用方传入的 `remoteThemeKey`（`userInfo.themeKey`，来自 user/getMine）
 *   4. 默认            —— `DEFAULT_THEME_KEY`（青野浅绿）
 *
 * 「首次登录继承游客主题」插在第 2 和第 3 步之间：它同样是本地值，
 * 只是存在另一个作用域里，属于本地优先的一部分。
 *
 * 本函数**无副作用**：不写库、不改 `themeState`，只回答「该用哪套」。
 *
 * @param {string} [uid] 作用域 uid，不传 = 当前登录用户（未登录 → guest）
 * @param {string} [remoteThemeKey] 云端读库得到的主题 key（未查询时留空）
 * @returns {{ key: string, source: 'memory'|'storage'|'guest'|'remote'|'default', uid: string }}
 */
export function resolveTheme(uid, remoteThemeKey) {
	const scopeUid = uid === undefined ? readCurrentUid() : String(uid || '')

	// 1 + 2：readStoredKeyWithSource 内部就是「内存缓存 → getStorageSync → 回填缓存」
	const stored = readStoredKeyWithSource(scopeUid)
	let key = stored.key
	let source = key ? stored.source : ''

	// 2.5：账号自己名下没有记录时，继承游客期间选的那套（本地值，优先于云端）
	if (!key && scopeUid) {
		const guestKey = readStoredKey('')
		if (guestKey && guestKey !== DEFAULT_THEME_KEY) {
			key = guestKey
			source = 'guest'
		}
	}

	// 3：读库（云端用户资料里的 theme_key）
	if (!key && isValidThemeKey(remoteThemeKey)) {
		key = String(remoteThemeKey)
		source = 'remote'
	}

	// 4：兜底默认
	if (!key) {
		key = DEFAULT_THEME_KEY
		source = 'default'
	}

	return { key, source, uid: scopeUid }
}

/** 只取 key 的便捷版（给页面读当前配置用，不产生任何写操作） */
export function getThemeKeyForUser(uid, remoteThemeKey) {
	return resolveTheme(uid, remoteThemeKey).key
}

/**
 * 账号视角的解析：游客期间切过主题时，**那笔选择比账号的旧记录更新**，优先采用。
 *
 * 之所以插在 `resolveTheme()` 之前而不是塞进去：`resolveTheme()` 是对外的
 * 「四级顺序」纯函数（缓存 → 存储 → 读库 → 默认），而这个 pending 是
 * 「跨身份切换的一次性意图」，语义不同，混进四级里会让顺序难以解释。
 */
function resolveForAccount(scopeUid, remoteThemeKey) {
	const pending = readPendingGuestTheme()
	if (pending && scopeUid) {
		return { key: pending, source: 'pending', uid: scopeUid }
	}
	return resolveTheme(scopeUid, remoteThemeKey)
}

/** 应用解析结果；`persist` 为真时写穿到 storageSync + 内存缓存 */
function applyResolvedTheme(resolved, persist) {
	themeState.uid = resolved.uid
	themeState.key = resolved.key
	if (persist) {
		writeStoredKey(resolved.key, resolved.uid)
	}
	applySystemChrome(getTheme(resolved.key), true)
	return resolved.key
}

/**
 * 按用户加载主题并应用。主题是「跟账号走」的，所以每次账号变化都要重新加载。
 *
 * 调用时机：
 *   1. `App.vue` onLaunch —— 冷启动时从 JWT 恢复登录态后（此时还没有云端数据）
 *   2. 退出登录 —— 传 '' 回到游客作用域（见 `resetThemeToGuest`）
 *
 * 解析顺序见 `resolveTheme()`：内存缓存 → getStorageSync → 游客继承 → 默认。
 * 云端值请走 `syncThemeFromUserInfo()` —— 那里会带上「读库」这一级并负责写回。
 *
 * @param {string} [uid] 不传则自动读取当前登录 uid（未登录 → 游客作用域）
 * @returns {string} 应用后的主题 key
 */
export function loadThemeForUser(uid) {
	const scopeUid = uid === undefined ? readCurrentUid() : String(uid || '')

	migrateLegacyThemeKey(scopeUid)

	const resolved = resolveForAccount(scopeUid)
	// 继承来的游客主题 / 游客刚切的主题都必须落到该账号名下，否则下次登录又回到旧状态；
	// 其余情况纯读不写库，避免冷启动就把每个游客都写一条记录。
	return applyResolvedTheme(resolved, resolved.source === 'guest' || resolved.source === 'pending')
}

/**
 * 查询用户信息后同步主题（`user/getMine` 回来时调用，登录事件也走这里）。
 *
 * 行为：
 *   · 按 `resolveTheme()` 的四级顺序定值（本地优先，云端只在本地没有可用值时才生效）
 *   · **无论取值来自哪一级，都把结果写进 storageSync + 内存缓存** ——
 *     这样下次冷启动（甚至断网）能直接恢复到正确主题
 *   · 本地、云端都没有可用主题时，落到默认「青野浅绿」并写回，避免每次都重新判定
 *
 * @param {object} userInfo 用户资料（读 `_id` / `uid` / `themeKey`）
 * @param {string} [uid] 显式指定归属账号，不传则从 userInfo 推
 * @returns {string} 应用后的主题 key
 */
export function syncThemeFromUserInfo(userInfo, uid) {
	const info = userInfo || {}
	const scopeUid = uid === undefined
		? String(info._id || info.uid || readCurrentUid() || '')
		: String(uid || '')

	migrateLegacyThemeKey(scopeUid)

	// 游客期间切过主题 → 直接采用那套（比账号旧记录、云端值都新），并写回该账号；
	// 不做"消费"动作，推送云端由调用方用 `takePendingGuestTheme()` 取一次。
	const resolved = resolveForAccount(scopeUid, info.themeKey)
	return applyResolvedTheme(resolved, true)
}

/**
 * 退出登录：把「当前生效主题」交还给游客作用域。
 *
 * 不能只传 uid 让调用方自己拼 —— 登出时 JWT 已清空，但事件里可能还带着
 * 上一个账号的 userInfo；显式走 guest 作用域才不会把 A 账号的配色留在屏幕上。
 *
 * ⚠️ **只切作用域，不删任何 storageSync 数据**：
 * `love_theme_key_<uid>` 是这个账号的主题偏好，和登录态解耦 ——
 * 登出后原样保留（内存缓存也保留），下次这个账号登录时直接复用，
 * 不需要再等接口、也不会出现「刚登录闪一下默认主题」。
 * 本模块**唯一**一处 `removeStorageSync` 在 `migrateLegacyThemeKey()` 里，
 * 删的是老版本遗留的全局 key `love_theme_key`，与账号作用域无关。
 */
export function resetThemeToGuest() {
	return loadThemeForUser('')
}

export function getCurrentThemeUid() {
	return themeState.uid
}

/**
 * 强制应用服务端主题（不参与优先级判断）。
 *
 * ⚠️ 主链路（登录 / 查询用户信息）请用 `syncThemeFromUserInfo()`，
 * 那个是「本地优先、云端兜底」的。本函数只用于明确知道云端值必须覆盖本地的场景
 * （例如后台把用户主题改掉后要求强制对齐），调用前请确认这是预期行为。
 *
 * @param {string} themeKey 服务端 `userInfo.themeKey`
 * @param {string} [uid] 归属账号，不传则用当前作用域
 */
export function applyRemoteTheme(themeKey, uid) {
	if (!isValidThemeKey(themeKey)) return false
	const scopeUid = uid === undefined ? themeState.uid : String(uid || '')
	applyResolvedTheme({ key: themeKey, source: 'remote', uid: scopeUid }, true)
	return true
}

// 模块加载时尽早恢复一次，缩短「冷启动 → onLaunch」之间可能出现的默认主题窗口。
// 此时 uniCloud / JWT 若尚未就绪，readCurrentUid() 会回落成游客作用域，
// App.vue 的 onLaunch 会再调一次 loadThemeForUser() 纠正（幂等）。
try {
	loadThemeForUser()
} catch (e) {}
