'use strict'

/**
 * 服务端的环境判断（游戏模块专用）
 *
 * 有些能力只在测试环境开放（如谁是卧底的机器人）。客户端依据
 * `uni.getAccountInfoSync().miniProgram.envVersion` 决定要不要显示入口，
 * 但那只是「不显示」，服务端必须自己再挡一道，否则别人伪造请求就能用。
 *
 * 两种判断方式，按可靠性排序：
 * 1. **服务空间**：把开发用的空间 ID 填进 `TEST_ENV_SPACE_IDS`，服务端拿
 *    `context.SPACEINFO.spaceId` 比对。客户端伪造不了，最可靠（推荐）。
 * 2. **客户端上报的 envVersion**：`develop`（开发版）/ `trial`（体验版）算测试，
 *    `release`（正式版）算正式。**这是软校验**——入参来自客户端，可以被改。
 *    仅在没配 `TEST_ENV_SPACE_IDS` 时兜底使用。
 *
 * 两种都拿不到时按**正式环境**处理（保守），宁可误拒也不误放。
 */

const { TEST_ENV_SPACE_IDS } = require('./game-constants')

const ENV_VERSION_RELEASE = 'release'

function readSpaceId(context = {}) {
	const info = context && context.SPACEINFO
	return info && info.spaceId ? String(info.spaceId) : ''
}

/**
 * 当前请求是否来自测试环境
 * @param {object} context 云函数上下文（service 里的 `this.ctx.context`）
 * @param {object} params 客户端入参（测试环境会带 `envVersion`）
 */
function isTestEnv(context = {}, params = {}) {
	if (Array.isArray(TEST_ENV_SPACE_IDS) && TEST_ENV_SPACE_IDS.length) {
		const spaceId = readSpaceId(context)
		return Boolean(spaceId) && TEST_ENV_SPACE_IDS.indexOf(spaceId) >= 0
	}

	const envVersion = String((params && params.envVersion) || '').trim()
	return Boolean(envVersion) && envVersion !== ENV_VERSION_RELEASE
}

module.exports = {
	ENV_VERSION_RELEASE,
	isTestEnv
}
