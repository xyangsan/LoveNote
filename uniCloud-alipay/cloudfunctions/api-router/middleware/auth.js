'use strict'

const { checkAuth } = require('../lib/auth')

module.exports = () => {
	return async function auth(ctx, next) {
		ctx.authState = await checkAuth(ctx.event, ctx.context)
		await next()
	}
}
