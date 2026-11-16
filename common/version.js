/**
 * 应用版本号（运行时 API 优先，项目版本兜底）
 *
 * 读取顺序：
 * 1. **App（Android / iOS）**：`uni.getAppBaseInfo().appVersion`
 *    打包时写进安装包，来源是 manifest.json 的 `versionName`，最准。
 * 2. **微信小程序**：`uni.getAccountInfoSync().miniProgram.version`
 *    ⚠️ 只有**正式版**有值 —— 开发版 / 体验版返回空串，所以必须兜底，
 *    否则「我的」页会出现一个只有 `v` 的版本号。
 * 3. **兜底**：项目根 `package.json` 的 `version`
 *    编译期被打进代码，任何平台、任何环境都有值。
 *
 * ⚠️ 微信后台填的版本号是**自由文本**，可能写成「体验版-1116」这类内容，
 *    所以加了「必须以数字开头」的校验，不合格就退回项目版本号，
 *    避免把一段描述当成版本号显示出来。
 *
 * ⚠️ 页面里不要再直接调 `getAccountInfoSync()` 取版本，统一走这里。
 */
// ⚠️ 本文件在 common/ 下，向上**一级**就是项目根的 package.json。
//    写成 ../../ 会指到项目外，编译直接报 "Could not resolve"。
import packageInfo from '../package.json'

/** 项目版本号（package.json），与运行时无关，任何环境都拿得到 */
export const PROJECT_VERSION = String((packageInfo && packageInfo.version) || '').trim() || '0.0.0'

/** 合法版本号：数字开头（允许 1.1.8、1.1.8-beta、2） */
const VERSION_PATTERN = /^\d+(\.\d+)*/

/**
 * 规整版本号：去空格、去 `v` 前缀、丢弃不符合格式的内容
 * @param {*} value
 * @returns {string} 不含 v 前缀的版本号，取不到返回空串
 */
function normalizeVersion(value) {
	const text = String(value === undefined || value === null ? '' : value)
		.trim()
		.replace(/^[vV]\s*/, '')
	if (!text || !VERSION_PATTERN.test(text)) {
		return ''
	}
	return text
}

/**
 * App 端版本号：manifest.json 的 versionName（打包时已固化进安装包）
 * @returns {string}
 */
function readAppVersion() {
	// #ifdef APP-PLUS
	try {
		let baseInfo = {}
		if (typeof uni !== 'undefined' && typeof uni.getAppBaseInfo === 'function') {
			baseInfo = uni.getAppBaseInfo() || {}
		} else if (typeof uni !== 'undefined' && typeof uni.getSystemInfoSync === 'function') {
			// 老版本 HBuilderX / 基础库没有 getAppBaseInfo，退回旧 API
			baseInfo = uni.getSystemInfoSync() || {}
		}
		const version = normalizeVersion(baseInfo.appVersion)
		if (version) {
			return version
		}
	} catch (error) {
		// 个别环境 API 不可用，忽略后走下一个来源
	}
	// #endif
	return ''
}

/**
 * 微信小程序版本号：微信后台「上传」时填的版本号
 * 只有正式版返回；开发版 / 体验版是空串
 * @returns {string}
 */
function readMiniProgramVersion() {
	// #ifdef MP-WEIXIN
	try {
		const accountInfo = typeof uni !== 'undefined' && typeof uni.getAccountInfoSync === 'function'
			? uni.getAccountInfoSync()
			: null
		const miniProgram = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram : null
		const version = normalizeVersion(miniProgram && miniProgram.version)
		if (version) {
			return version
		}
	} catch (error) {
		// 开发者工具个别版本会抛「not supported」，忽略后走兜底
	}
	// #endif
	return ''
}

const appVersion = readAppVersion()
const miniProgramVersion = appVersion ? '' : readMiniProgramVersion()
const runtimeVersion = appVersion || miniProgramVersion

/**
 * 版本号来源，便于排查「显示的和预期不一致」：
 * 'app' | 'miniprogram' | 'project'
 */
export const VERSION_SOURCE = appVersion ? 'app' : (miniProgramVersion ? 'miniprogram' : 'project')

/** 版本号（不含 v 前缀），如 1.1.8 */
export const APP_VERSION = runtimeVersion || PROJECT_VERSION

/** 带前缀的展示文案，如 v1.1.8 */
export const APP_VERSION_TEXT = `v${APP_VERSION}`
