'use strict'

const authMiddleware = require('./middleware/auth')

module.exports = {
	debug: false,
	baseDir: __dirname,
	middleware: [
		[
			authMiddleware(),
			{
				enable: true,
				ignore: /^auth\/loginByWeixin$/
			}
		]
	]
}
