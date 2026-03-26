'use strict'

const { Router } = require('uni-cloud-router')

const router = new Router(require('./config'))

exports.main = async (event, context) => {
	return router.serve(event, context)
}
