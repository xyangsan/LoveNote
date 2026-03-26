'use strict'

const { callAdapter } = require('x-uni-id-co')
const { getUniIdToken } = require('./auth')

function createUniIdCo(ctx, data = {}) {
	const event = Object.assign({}, ctx.event || {}, {
		data,
		uniIdToken: getUniIdToken(ctx.event || {}, ctx.context || {})
	})

	return callAdapter.cloudfunction(ctx.context || {}, event)
}

module.exports = {
	createUniIdCo
}
