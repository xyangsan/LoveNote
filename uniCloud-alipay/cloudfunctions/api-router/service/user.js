'use strict'

const { Service } = require('uni-cloud-router')
const { checkAuth } = require('../lib/auth')
const { updateUserProfile, formatUserInfo } = require('../lib/profile')
const { getUserById } = require('../lib/user-base')
const { formatError } = require('../lib/response')

module.exports = class UserService extends Service {
	async getMine() {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const userRecord = await getUserById(authState.authResult.uid)

			if (!userRecord) {
				return {
					errCode: 'uni-id-account-not-exists',
					errMsg: '当前用户不存在'
				}
			}

			return Object.assign({}, authState.response, {
				errCode: 0,
				userInfo: await formatUserInfo(userRecord)
			})
		} catch (error) {
			return formatError(error, '获取用户信息失败')
		}
	}

	async updateProfile(params = {}) {
		try {
			const authState = this.ctx.authState || await checkAuth(this.ctx.event, this.ctx.context)
			const userRecord = await updateUserProfile(authState.authResult.uid, params)

			return Object.assign({}, authState.response, {
				errCode: 0,
				userInfo: await formatUserInfo(userRecord || {})
			})
		} catch (error) {
			return formatError(error, '更新用户资料失败')
		}
	}
}
