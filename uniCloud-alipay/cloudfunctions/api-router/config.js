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
				// 免登录白名单：
				//   auth/loginByWeixin    —— 登录本身
				//   platform/reportVisit  —— 游客也要能上报「进入小程序」，服务内部做可选鉴权
				ignore: /^(auth\/loginByWeixin|platform\/reportVisit)$/
			}
		]
	]
}
