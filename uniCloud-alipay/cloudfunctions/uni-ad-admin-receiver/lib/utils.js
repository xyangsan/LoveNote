const {
	resolve
} = require('path')
const fs = require('fs')
const uniCrypto = require('./uni-crypto')
//获取基础配置
const config = {}

function getConfig(key) {
	if (Object.keys(config).length === 0) {
		const configPath = resolve(__dirname + '/../config/')
		const configFiles = fs.readdirSync(configPath)
		let configFileContent
		for (let cfi in configFiles) {
			configFileContent = fs.readFileSync(configPath + '/' + configFiles[cfi], 'utf-8')
			if (configFileContent) {
				configFileContent = JSON.parse(configFileContent)
				Object.assign(config, configFileContent)
			}
		}
	}

	return key ? config[key] : config
}


/**
 * 获取签名
 * @param {Object} params
 */
function getSign(params) {
	let keys = Object.keys(params)
	keys.sort()
	let signStr = ''
	for (let i = 0; i < keys.length; i++) {
		if (params[keys[i]] && (typeof params[keys[i]] === "object" || typeof params[keys[i]] === "array")) {
			signStr += keys[i] + '=' + JSON.stringify(params[keys[i]])
		} else if (params[keys[i]] === undefined) {
			continue
		} else {
			signStr += keys[i] + '=' + (params[keys[i]] === null ? '' : params[keys[i]])
		}
		if (i < keys.length - 1) {
			signStr += '&'
		}
	}
	const signPrivateKey = getConfig('secret')
	console.log('signPrivateKey', signPrivateKey)
	signStr += signPrivateKey
	let crypto = new uniCrypto()
	let sign = crypto.sha256(signStr)
	sign = sign.toUpperCase()
	console.log('sign', sign)
	return sign
}

/**
 * 校验签名
 * @param {Object} params
 */
function checkSign(params) {
	if (!params.sign) {
		return false
	}
	const signGet = params.sign
	delete params.sign
	const sign = getSign(params)
	if (signGet !== sign) {
		return false
	}
	return true
}

function result(code, data, message) {
	return {
		errCode: code,
		data: data || [],
		errMsg: message || 'ok'
	}
}

module.exports = {
	result,
	getSign,
	checkSign,
	getConfig
}