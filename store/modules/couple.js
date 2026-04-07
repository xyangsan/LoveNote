export function getDefaultCoupleCenterData() {
	return {
		selfInfo: null,
		activeCouple: null,
		incomingRequests: [],
		outgoingRequests: [],
		historyList: [],
		canSendRequest: true
	}
}

export function normalizeCoupleCenterResult(result = {}) {
	return {
		selfInfo: result.selfInfo || null,
		activeCouple: result.activeCouple || null,
		incomingRequests: Array.isArray(result.incomingRequests) ? result.incomingRequests : [],
		outgoingRequests: Array.isArray(result.outgoingRequests) ? result.outgoingRequests : [],
		historyList: Array.isArray(result.historyList) ? result.historyList : [],
		canSendRequest: Boolean(result.canSendRequest)
	}
}