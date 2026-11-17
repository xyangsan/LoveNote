/**
 * 图片查看器（pages/public/image-viewer）的跨页传参。
 *
 * 为什么不走 URL query：一条动态最多 9 张图，每张要带「缩略图 + 原图」两个地址，
 * 拼进 query 轻松破千字符，小程序的 navigateTo 会因为地址过长直接失败。
 * 这里用模块级内存暂存：跳转前写入、目标页 onLoad 消费，一次性，读完即清。
 *
 *   // 列表页
 *   openImageViewer([{ thumbnailUrl, originalUrl }], 2)
 *
 *   // pages/public/image-viewer 的 onLoad
 *   const payload = consumeImageViewerPayload()   // { images, current } | null
 *
 * 拿不到 payload 时（页面被系统回收后重建、直接输码打开等）查看器会显示空态，
 * 不会白屏，也不会去猜任何 URL。
 */

export const IMAGE_VIEWER_PATH = '/pages/public/image-viewer'

/** 上一份待消费的数据。页面是单例跳转，同一时刻只会有一份 */
let pendingPayload = null

/**
 * 归一化图片项：缺原图回落缩略图，缺缩略图回落原图，两个都没有的直接丢掉。
 * @param {Array} images [{ thumbnailUrl, originalUrl }]
 * @returns {Array<{ thumbnailUrl: string, originalUrl: string }>}
 */
export function normalizeViewerImages(images = []) {
	const list = Array.isArray(images) ? images : []
	return list
		.map((item) => {
			const source = item && typeof item === 'object' ? item : {}
			const thumbnail = String(source.thumbnailUrl || '').trim()
			const original = String(source.originalUrl || '').trim()
			return {
				thumbnailUrl: thumbnail || original,
				originalUrl: original || thumbnail
			}
		})
		.filter((item) => item.originalUrl)
}

/**
 * 打开图片查看页。
 * @param {Array} images [{ thumbnailUrl, originalUrl }]
 * @param {number} current 打开时定位到第几张（从 0 开始）
 * @returns {boolean} 是否已发起跳转
 */
export function openImageViewer(images = [], current = 0) {
	const list = normalizeViewerImages(images)
	if (!list.length) {
		return false
	}

	if (typeof uni === 'undefined' || typeof uni.navigateTo !== 'function') {
		return false
	}

	const maxIndex = list.length - 1
	const currentIndex = Math.max(0, Math.min(maxIndex, Number(current) || 0))
	pendingPayload = {
		images: list,
		current: currentIndex
	}

	uni.navigateTo({
		url: IMAGE_VIEWER_PATH,
		fail: () => {
			pendingPayload = null
		}
	})
	return true
}

/**
 * 取出（并清空）待消费的查看器数据。
 * @returns {{ images: Array, current: number } | null}
 */
export function consumeImageViewerPayload() {
	const payload = pendingPayload
	pendingPayload = null
	return payload
}
