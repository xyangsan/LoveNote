export function getDefaultAppBaseInfo() {
	return {}
}

export function normalizeAppBaseInfo(baseInfo = {}) {
	if (!baseInfo || typeof baseInfo !== 'object' || Array.isArray(baseInfo)) {
		return getDefaultAppBaseInfo()
	}

	return Object.assign({}, baseInfo)
}