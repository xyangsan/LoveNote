'use strict'

/**
 * 登录流水。
 *
 * 为什么需要它：uni-id-common 登录成功时只做
 *   updateUserRecord({ last_login_ip, last_login_date })
 * 也就是说「最近登录时间」是覆盖式的，跨天之后昨天的登录人数就查不回来了。
 * 运营后台要看「每天多少人登录」，必须有一条不可变的流水。
 *
 * 直接复用 uni-id 自带的 uni-id-log 集合（已有 type+create_date 索引），
 * 不另建表：type 固定 'login'，user_id 存 uid，create_date 存毫秒时间戳。
 *
 * 写库失败绝不能影响登录本身，所以内部 try/catch 后只打日志。
 */

const { uniIdLogCollection } = require('./db')

const LOG_TYPE_LOGIN = 'login'
const LOG_STATE_OK = 1

async function recordLoginLog(options = {}) {
	const uid = String(options.uid || '').trim()
	if (!uid) {
		return false
	}

	try {
		await uniIdLogCollection.add({
			type: LOG_TYPE_LOGIN,
			user_id: uid,
			create_date: Date.now(),
			state: LOG_STATE_OK,
			ip: String(options.ip || ''),
			ua: String(options.ua || ''),
			appid: String(options.appid || ''),
			device_id: String(options.deviceId || '')
		})
		return true
	} catch (error) {
		console.error('recordLoginLog failed', error)
		return false
	}
}

module.exports = {
	LOG_TYPE_LOGIN,
	recordLoginLog
}
