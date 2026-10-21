'use strict'

/**
 * 32 位 FNV-1a 字符串哈希（返回无符号整数）。
 *
 * 昵称与默认头像都靠它把 uid 打散成「看起来随机、但对同一 uid 恒定」的下标：
 * 同一用户并发首登、重复登录都会得到同一结果，不需要 CAS 或条件更新。
 * 用 Math.imul 保证 32 位乘法在不同 Node 版本上结果一致。
 */
function hashSeed(value) {
	const text = `${value}`
	let hash = 2166136261
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

module.exports = {
	hashSeed
}
