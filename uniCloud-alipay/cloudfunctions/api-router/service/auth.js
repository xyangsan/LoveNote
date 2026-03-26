'use strict'

const { Service } = require('uni-cloud-router')
const { createUniIdCo } = require('../lib/uni-id-co')
const { ensureDefaultRole } = require('../lib/auth')
const { updateUserProfile, formatUserInfo } = require('../lib/profile')
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

			if (hasProfilePayload) {
				userRecord = await updateUserProfile(loginResult.uid, params)
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
