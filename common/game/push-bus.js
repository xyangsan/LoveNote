/**
 * 极简发布订阅总线：把 WebSocket 推送分发给「当前打开的房间页」
 * 只按 roomId 分发，页面卸载时必须调用返回的取消函数，避免回调泄漏。
 */

const listeners = new Map()

function getBucket(roomId = '') {
	const key = String(roomId || '')
	if (!listeners.has(key)) {
		listeners.set(key, new Set())
	}
	return listeners.get(key)
}

export function subscribe(roomId = '', handler) {
	if (typeof handler !== 'function' || !roomId) {
		return () => {}
	}
	const bucket = getBucket(roomId)
	bucket.add(handler)

	return function unsubscribe() {
		const current = listeners.get(String(roomId))
		if (!current) {
			return
		}
		current.delete(handler)
		if (!current.size) {
			listeners.delete(String(roomId))
		}
	}
}

export function publish(roomId = '', payload = {}) {
	const bucket = listeners.get(String(roomId || ''))
	if (!bucket || !bucket.size) {
		return 0
	}
	let delivered = 0
	Array.from(bucket).forEach((handler) => {
		try {
			handler(payload)
			delivered += 1
		} catch (error) {
			console.warn('push-bus handler failed', error)
		}
	})
	return delivered
}

export function clearAll() {
	listeners.clear()
}

export function getSubscriberCount(roomId = '') {
	const bucket = listeners.get(String(roomId || ''))
	return bucket ? bucket.size : 0
}
