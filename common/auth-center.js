import { clearUniIdTokenStorage } from './api/router.js'
import {
	getFileExtname,
	isTempFilePath,
	normalizeHttpsUrl,
	resolveHttpsFileUrl,
	uploadFileWithModule
} from './utils/file-upload.js'

export const DEFAULT_AVATAR = '/static/user-empty.png'
export const AUTH_CHANGE_EVENT = 'love-note-auth-change'
export const USER_PROFILE_CACHE_KEY = 'love_note_user_profile_cache'

// 内置头像云存储目录：love-note/avatar/default/{file}
// 支付宝云的 fileID 是 cloud:// 形式，<image> 不能直接用，必须换成 https 再下发，
// 所以这里存的是解析好的 https 地址（公共权限下 getTempFileURL 返回的就是永久地址）。
export const DEFAULT_AVATAR_CDN_BASE = 'https://env-00jxhb140x6o.normal.cloudstatic.cn/love-note/avatar/default'

/**
 * 分组清单（唯一的数据源）：分组 key / 中文名 / 文件清单。
 * 新增头像只改这里 + 往云存储同名上传即可，不用动 DEFAULT_AVATAR_LIST。
 */
const DEFAULT_AVATAR_GROUPS_SOURCE = [
	{
		key: 'modern',
		name: '现代',
		files: [
			['modern-01.png', '珊瑚粉短发女孩 · 薄荷卫衣'],
			['modern-02.png', '银白乱发少年 · 藏青外套'],
			['modern-03.png', '双马尾学妹 · 水手服 · 樱花'],
			['modern-04.png', '耳机少年 · 连帽衫 · 霓虹夜'],
			['modern-05.png', '棒球帽马尾少女 · 运动外套'],
			['modern-06.png', '圆框眼镜少女 · 麻花辫 · 图书馆']
		]
	},
	{
		key: 'guofeng',
		name: '古风',
		files: [
			['guofeng-01.png', '古风闺秀 · 发簪步摇 · 梅花'],
			['guofeng-02.png', '武侠少侠 · 束发青衫 · 剑'],
			['guofeng-03.png', '仙侠女仙 · 白发白衣 · 云雾'],
			['guofeng-04.png', '书生少年 · 布巾长袍 · 卷轴'],
			['guofeng-05.png', '古风插画少女 · 花钿发饰']
		]
	},
	{
		key: 'magic',
		name: '魔幻',
		files: [
			['magic-01.png', '魔法少女 · 尖顶帽 · 星尘'],
			['magic-02.png', '精灵 · 尖耳银绿发 · 萤火'],
			['magic-03.png', '小恶魔 · 角 · 红瞳 · 余烬'],
			['magic-04.png', '狼耳少年 · 琥珀眼 · 雪林'],
			['magic-05.png', '占卜师 · 兜帽水晶球 · 星云']
		]
	},
	{
		key: 'anime',
		name: '动漫',
		files: [
			['anime-01.png', '日系少年 · 黑发琥珀瞳'],
			['anime-02.png', '日系少女 · 银灰短发'],
			['anime-03.png', '日系少女 · 红发带马尾'],
			['anime-04.png', '日系少女 · 麻花辫圆眼镜']
		]
	},
	{
		key: 'cartoon',
		name: '3D卡通',
		files: [
			['cartoon-01.png', '3D 卡通女孩 · 心形发夹'],
			['cartoon-02.png', '3D 卡通小孩 · 绿帽子'],
			['cartoon-03.png', '3D 卡通男孩 · 卷发'],
			['cartoon-04.png', '3D 卡通女孩 · 丸子头']
		]
	}
]

// 单张头像的云存储地址：优先用下面 OVERRIDES 里逐条指定的完整地址，
// 否则用 CDN 前缀 + 文件名拼（支付宝云/阿里云的控制台上传路径是统一的）。
const DEFAULT_AVATAR_URL_OVERRIDES = {}

function resolveDefaultAvatarUrl(file = '') {
	const name = `${file}`.replace(/^\/+/, '')
	if (!name) {
		return ''
	}
	const overrideUrl = normalizeHttpsUrl(DEFAULT_AVATAR_URL_OVERRIDES[name] || '')
	if (overrideUrl) {
		return overrideUrl
	}
	const base = `${DEFAULT_AVATAR_CDN_BASE}`.replace(/\/+$/, '')
	return base ? `${base}/${name}` : ''
}

/**
 * 按「现代 / 古风 / 魔幻 / 动漫 / 3D卡通」分组的内置头像。
 * 结构：[{ key, name, avatars: [{ url, file, label }] }]
 * ⚠️ 若 DEFAULT_AVATAR_CDN_BASE 被置空，则 avatars 为空数组，调用方要兜底 DEFAULT_AVATAR。
 */
export const DEFAULT_AVATAR_LIST = DEFAULT_AVATAR_GROUPS_SOURCE.map((group) => ({
	key: group.key,
	name: group.name,
	avatars: group.files
		.map(([file, label]) => ({
			url: resolveDefaultAvatarUrl(file),
			file,
			label
		}))
		.filter((item) => Boolean(item.url))
}))

// 拍平版：普通头像选择器直接吃 url 数组
export const DEFAULT_AVATAR_URLS = DEFAULT_AVATAR_LIST.reduce(
	(urls, group) => urls.concat(group.avatars.map((item) => item.url)),
	[]
)

export function getDefaultAvatarGroups() {
	return DEFAULT_AVATAR_LIST.map((group) => ({
		key: group.key,
		name: group.name,
		avatars: group.avatars.map((item) => ({ ...item }))
	}))
}

export { clearUniIdTokenStorage }
export { getFileExtname }

// '微信用户' 是后端读时的占位兜底，不是真实昵称。
// 旧版本会把它写进本地缓存，再被登录页回填到输入框，最后当成真实昵称提交落库 —— 在缓存两端统一过滤掉。
const NICKNAME_PLACEHOLDERS = ['微信用户']

function normalizeCachedNickname(value) {
	const nickname = `${value || ''}`.trim()
	return NICKNAME_PLACEHOLDERS.includes(nickname) ? '' : nickname
}

export function getCachedUserProfile() {
	const cachedValue = uni.getStorageSync(USER_PROFILE_CACHE_KEY)
	if (!cachedValue || typeof cachedValue !== 'object') {
		return null
	}

	const nickname = normalizeCachedNickname(cachedValue.nickname)
	const avatarUrl = cachedValue.avatarUrl ? `${cachedValue.avatarUrl}` : ''
	const avatarFileId = cachedValue.avatarFileId ? `${cachedValue.avatarFileId}` : ''
	const momentsCoverUrl = cachedValue.momentsCoverUrl ? `${cachedValue.momentsCoverUrl}` : ''
	const momentsCoverFileId = cachedValue.momentsCoverFileId ? `${cachedValue.momentsCoverFileId}` : ''

	if (!nickname && !avatarUrl && !avatarFileId && !momentsCoverUrl && !momentsCoverFileId) {
		return null
	}

	return {
		nickname,
		avatarUrl,
		avatarFileId,
		momentsCoverUrl,
		momentsCoverFileId,
		updatedAt: Number(cachedValue.updatedAt || Date.now())
	}
}

export function saveCachedUserProfile(profile = {}) {
	if (!profile || typeof profile !== 'object') {
		return null
	}

	const nickname = normalizeCachedNickname(profile.nickname)
	const avatarUrl = profile.avatarUrl ? `${profile.avatarUrl}` : ''
	const avatarFileId = profile.avatarFileId ? `${profile.avatarFileId}` : ''
	const momentsCoverUrl = profile.momentsCoverUrl ? `${profile.momentsCoverUrl}` : ''
	const momentsCoverFileId = profile.momentsCoverFileId ? `${profile.momentsCoverFileId}` : ''

	if (!nickname && !avatarUrl && !avatarFileId && !momentsCoverUrl && !momentsCoverFileId) {
		return null
	}

	const cachedProfile = {
		nickname,
		avatarUrl,
		avatarFileId,
		momentsCoverUrl,
		momentsCoverFileId,
		updatedAt: Date.now()
	}

	uni.setStorageSync(USER_PROFILE_CACHE_KEY, cachedProfile)
	return cachedProfile
}

export function getCurrentUniIdUser() {
	return uniCloud.getCurrentUserInfo ? uniCloud.getCurrentUserInfo() : null
}

export function hasValidLogin(userInfo = getCurrentUniIdUser()) {
	return Boolean(userInfo && userInfo.uid && (!userInfo.tokenExpired || userInfo.tokenExpired > Date.now()))
}

export function emitAuthChanged(detail = {}) {
	uni.$emit(AUTH_CHANGE_EVENT, detail)
}

export function subscribeAuthChanged(handler) {
	if (typeof handler !== 'function') {
		return () => {}
	}

	uni.$on(AUTH_CHANGE_EVENT, handler)
	return () => {
		uni.$off(AUTH_CHANGE_EVENT, handler)
	}
}

export async function uploadAvatarIfNeeded(currentAvatar = '') {
	if (!currentAvatar) {
		return {
			avatarUrl: '',
			avatarFileId: '',
			avatarFile: null
		}
	}

	if (currentAvatar.startsWith('cloud://')) {
		const avatarUrl = await resolveHttpsFileUrl(currentAvatar)
		return {
			avatarUrl,
			avatarFileId: currentAvatar,
			avatarFile: {
				name: currentAvatar.split('/').pop() || `avatar.${getFileExtname(currentAvatar)}`,
				extname: getFileExtname(currentAvatar),
				url: currentAvatar
			}
		}
	}

	// ⚠️ 顺序很重要：先排掉「本地临时路径」，再判断远程 URL。
	// 微信开发者工具把 chooseAvatar 的临时图给成 http://tmp/xxx.jpeg，
	// 老逻辑见到 http(s) 就当远程图直接返回 → 临时路径被原样存进了用户表。
	if (!isTempFilePath(currentAvatar) && /^https?:\/\//i.test(currentAvatar)) {
		return {
			avatarUrl: normalizeHttpsUrl(currentAvatar),
			avatarFileId: '',
			avatarFile: null
		}
	}

	const uploadRes = await uploadFileWithModule({
		filePath: currentAvatar,
		module: 'avatar',
		prefix: 'avatar',
		fileType: 'image'
	})
	const extname = getFileExtname(currentAvatar)
	const fileName = uploadRes.cloudPath.split('/').pop()

	return {
		avatarUrl: uploadRes.fileURL,
		avatarFileId: uploadRes.fileID,
		avatarFile: {
			name: fileName,
			extname,
			url: uploadRes.fileID
		}
	}
}
