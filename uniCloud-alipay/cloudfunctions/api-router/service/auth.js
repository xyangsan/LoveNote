'use strict'

const { Service } = require('uni-cloud-router')
const { createUniIdCo } = require('../lib/uni-id-co')
const { ensureDefaultRole } = require('../lib/auth')
const { updateUserProfile, formatUserInfo } = require('../lib/profile')
const { ensureUserNickname } = require('../lib/nickname')
const { ensureUserAvatar } = require('../lib/avatar-pool')
const { getUserById } = require('../lib/user-base')
const { formatError } = require('../lib/response')

module.exports = class AuthService extends Service {
	async loginByWeixin(params = {}) {
		try {
			const code = params && params.code ? String(params.code).trim() : ''
			if (!code) {
				return {
					errCode: 'uni-id-param-required',
					errMsg: '缺少参数: code'
				}
			}

			const uniIdCo = createUniIdCo(this.ctx, {
				code
			})
			const loginResult = await uniIdCo.loginByWeixin({
				code
			})

			if (loginResult.errCode) {
				return loginResult
			}

			let userRecord = await ensureDefaultRole(loginResult.uid)
			const hasProfilePayload = (
				params.nickname !== undefined ||
				params.gender !== undefined ||
				params.mobile !== undefined ||
				params.birthday !== undefined ||
				params.age !== undefined ||
				params.avatarFileId ||
				params.avatarUrl
			)

			// ① 先落用户本次提交的资料：填了昵称/头像就以用户为准
			if (hasProfilePayload) {
				userRecord = await updateUserProfile(loginResult.uid, params)
			}

			// ② 幂等兜底：仍无有效昵称 → 生成；仍无任何头像 → 随机分配。
			//    两者都只在「缺失」时写库，已有值原样返回，保证二次登录零写库。
			//    判断源必须是库里的记录，不能是入参，否则每次登录都会重新生成。
			const nicknameRecord = await ensureUserNickname(loginResult.uid, userRecord)
			if (nicknameRecord) {
				userRecord = nicknameRecord
			}

			const avatarRecord = await ensureUserAvatar(loginResult.uid, userRecord)
			if (avatarRecord) {
				userRecord = avatarRecord
			}

			if (!userRecord) {
				userRecord = await getUserById(loginResult.uid)
			}

			return Object.assign({}, loginResult, {
				errCode: 0,
				userInfo: await formatUserInfo(userRecord || {})
			})
		} catch (error) {
			return formatError(error, '微信登录失败')
		}
	}

	async logout() {
		try {
			const uniIdCo = createUniIdCo(this.ctx)
			return await uniIdCo.logout()
		} catch (error) {
			return formatError(error, '退出登录失败')
		}
	}
}
