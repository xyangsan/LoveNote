'use strict'

/**
 * 默认头像池：新用户没有设置头像时，从内置的 24 张里分一张。
 *
 * ⚠️ 云函数无法 import 前端的 common/auth-center.js，所以文件名清单在这里
 * 独立维护一份。两边必须严格一致，由 scripts/game-debug/avatar-default-regress.js
 * 切片读取前端源码做集合比对，防止加图时只改了一边。
 *
 * 前缀与前端 DEFAULT_AVATAR_CDN_BASE 保持一致：支付宝云 public 桶的静态地址，
 * 纯 https，不需要 getTempFileURL，也不会过期。
 */

const { hashSeed } = require('./hash')

const AVATAR_CDN_BASE = 'https://env-00jxhb140x6o.normal.cloudstatic.cn/love-note/avatar/default'

// 与 common/auth-center.js 的 DEFAULT_AVATAR_GROUPS_SOURCE 一一对应（24 张）
const DEFAULT_AVATAR_FILES = [
	'modern-01.png', 'modern-02.png', 'modern-03.png',
	'modern-04.png', 'modern-05.png', 'modern-06.png',
	'guofeng-01.png', 'guofeng-02.png', 'guofeng-03.png',
	'guofeng-04.png', 'guofeng-05.png',
	'magic-01.png', 'magic-02.png', 'magic-03.png',
	'magic-04.png', 'magic-05.png',
	'anime-01.png', 'anime-02.png', 'anime-03.png', 'anime-04.png',
	'cartoon-01.png', 'cartoon-02.png', 'cartoon-03.png', 'cartoon-04.png'
]

function buildAvatarUrl(file = '') {
	const name = `${file}`.replace(/^\/+/, '')
	return name ? `${AVATAR_CDN_BASE}/${name}` : ''
}

/**
 * 24 张等概率（按 uid 哈希均匀分布），同一 uid 恒定同一张。
 * 不用 Math.random()：并发首登时两个请求会写两张不同头像，
 * 其中一个客户端会拿到「已经不存在」的图。
 */
function pickDefaultAvatar(seed) {
	const index = hashSeed(`${seed}#avatar`) % DEFAULT_AVATAR_FILES.length
	return buildAvatarUrl(DEFAULT_AVATAR_FILES[index])
}

/** 判定优先级与 lib/user-base.js 的 resolveAvatar 保持一致 */
function hasUserAvatar(record = {}) {
	const fileId = record.avatar_file_id || (record.avatar_file && record.avatar_file.url) || ''
	return Boolean(String(fileId).trim() || String(record.avatar || '').trim())
}

async function getUserRecord(uid) {
	// 取新的 collection 句柄，避免与 lib/db.js 里长期持有的 userCollection
	// 共用同一个 query 构建器（.doc() 的 _docId 会污染后续 .where() 查询）。
	const { db } = require('./db')
	const result = await db.collection('uni-id-users').doc(uid).get()
	return result && Array.isArray(result.data) && result.data[0] ? result.data[0] : null
}

/**
 * 幂等补齐默认头像：已有任意头像（外链或 fileID）就原样返回，零写库。
 * 不区分 register / login —— 「缺失即补」天然同时覆盖新注册与存量用户。
 *
 * 必须走 updateUserProfile({ avatarUrl })，不能用 doc(uid).update({ avatar })：
 * 后者不会清掉残留的 avatar_file_id / avatar_file，而 resolveAvatar 优先读 fileID，
 * 会导致随机头像「写了但看不见」。
 */
async function ensureUserAvatar(uid, userRecord) {
	if (!uid) {
		return userRecord || null
	}

	try {
		const record = userRecord && userRecord._id ? userRecord : await getUserRecord(uid)
		if (!record) {
			return userRecord || null
		}
		if (hasUserAvatar(record)) {
			return record
		}

		const avatarUrl = pickDefaultAvatar(uid)
		const { updateUserProfile } = require('./profile')
		const updated = await updateUserProfile(uid, { avatarUrl })
		return updated || Object.assign({}, record, { avatar: avatarUrl })
	} catch (error) {
		console.warn('api-router ensureUserAvatar failed', error)
		return userRecord || null
	}
}

module.exports = {
	AVATAR_CDN_BASE,
	DEFAULT_AVATAR_FILES,
	buildAvatarUrl,
	pickDefaultAvatar,
	hasUserAvatar,
	ensureUserAvatar
}
