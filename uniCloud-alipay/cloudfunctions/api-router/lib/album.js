'use strict'

/**
 * 相册兜底：保证「每个账号至少有一个可用的相册」。
 *
 * 为什么需要：
 *   照片的数据结构是 相册 → 照片（photo.upload 必须带 albumId，且会校验相册可见性）。
 *   而项目里没有任何「新建相册」的前端入口，相册只在历史数据里存在过 ——
 *   新账号（尤其是未绑定情侣的账号）打开上传页时 albumList 是空的，
 *   前端 `canUpload` 直接变成 false，表现就是「不绑定情侣就传不了照片」。
 *
 * 口径：
 *   1. 相册不依附情侣关系，未绑定也能有（couple_id 记空，绑定后由可见性条件自然共享）；
 *   2. 已有相册就直接用它（优先 is_default，其次最早创建），不回头改用户已有数据；
 *   3. 一条都没有时才新建，新建的带 is_default=true，上传页优先选它。
 */

const { albumCollection } = require('./db')
const { buildCreatorVisibilityCondition } = require('./content-scope')
const { normalizeAlbumRecord } = require('./media')

const DEFAULT_ALBUM_TITLE = '我的回忆'

function buildAlbumVisibility(uid, activeCouple) {
	return buildCreatorVisibilityCondition({
		uid,
		activeCouple,
		creatorField: 'create_uid'
	})
}

/** 查用户当前能看到的第一本相册（优先 is_default，其次 sort_order / 创建时间最早的） */
async function findFirstAlbum(uid, activeCouple) {
	if (!uid) {
		return null
	}
	const visibility = buildAlbumVisibility(uid, activeCouple)

	// ① 带 is_default 标记的（老数据可能没有这个字段，查不到再走 ②）
	try {
		const defaultRes = await albumCollection
			.where(Object.assign({}, visibility, { is_default: true }))
			.orderBy('create_time', 'asc')
			.limit(1)
			.get()
		const defaultList = (defaultRes && defaultRes.data) || []
		if (defaultList.length) {
			return defaultList[0]
		}
	} catch (error) {
		console.warn('album findFirstAlbum(default) failed', error)
	}

	// ② 任意一本可见相册
	try {
		const res = await albumCollection
			.where(visibility)
			.orderBy('sort_order', 'asc')
			.orderBy('create_time', 'asc')
			.limit(1)
			.get()
		const list = (res && res.data) || []
		return list.length ? list[0] : null
	} catch (error) {
		console.warn('album findFirstAlbum failed', error)
		return null
	}
}

/**
 * 拿到「默认相册」；一本都没有时创建一本。
 * @returns {Promise<Object|null>} 相册原始记录（含 _id）
 */
async function ensureDefaultAlbum(uid, activeCouple) {
	if (!uid) {
		return null
	}

	const existing = await findFirstAlbum(uid, activeCouple)
	if (existing) {
		return existing
	}

	const now = Date.now()
	const albumData = {
		// 未绑定情侣时 couple_id 留空，绑定后是否可见由可见性条件决定
		couple_id: activeCouple && activeCouple._id ? activeCouple._id : '',
		title: DEFAULT_ALBUM_TITLE,
		description: '',
		photo_count: 0,
		sort_order: 0,
		is_default: true,
		create_uid: uid,
		create_time: now,
		update_time: now
	}

	try {
		const result = await albumCollection.add(albumData)
		return Object.assign({ _id: result.id }, albumData)
	} catch (error) {
		console.warn('album ensureDefaultAlbum create failed', error)
		return null
	}
}

/** 兜底相册的对外结构（和列表接口返回的一致） */
function formatDefaultAlbum(record = {}, uid = '') {
	return normalizeAlbumRecord(record, {}, uid)
}

module.exports = {
	DEFAULT_ALBUM_TITLE,
	ensureDefaultAlbum,
	formatDefaultAlbum
}
