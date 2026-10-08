/**
 * 运行环境判断（客户端）
 *
 * 「测试环境」= 微信**开发版**（develop）/ **体验版**（trial）；
 * 「正式环境」= 微信**正式版**（release）。
 * 非微信端没有 envVersion 这个概念，退回构建时的 NODE_ENV
 * （HBuilderX「运行」= development，「发行」= production）。
 *
 * ⚠️ 这里的判断只决定**要不要显示入口**，真正的权限在服务端
 * （见 `api-router/lib/game-env.js`，按服务空间 ID 或客户端上报的 envVersion 校验）。
 * 所以不要在客户端用它做安全决策。
 */

function readEnvVersion() {
	// #ifdef MP-WEIXIN
	try {
		const accountInfo = typeof uni !== 'undefined' && typeof uni.getAccountInfoSync === 'function'
			? uni.getAccountInfoSync()
			: null
		const version = accountInfo && accountInfo.miniProgram
			? String(accountInfo.miniProgram.envVersion || '')
			: ''
		if (version) {
			return version
		}
	} catch (error) {
		// 开发者工具个别版本会抛「not supported」，忽略，走下面的兜底
	}
	// #endif
	return ''
}

/**
 * 当前运行环境标识：'develop' | 'trial' | 'release'
 * 写法与 uv-ui 保持一致（`process.env.NODE_ENV` 会在构建时被替换成字面量）
 */
export const ENV_VERSION = readEnvVersion() || (process.env.NODE_ENV === 'production' ? 'release' : 'develop')

/** 是否测试环境（开发版 / 体验版 / 非生产构建） */
export const IS_TEST_ENV = ENV_VERSION !== 'release'
