const modalState = {
	visible: false,
	reason: '',
	redirectUrl: '',
	pendingRoute: null
}

const listeners = new Set()

function cloneState() {
	return {
		visible: modalState.visible,
		reason: modalState.reason,
		redirectUrl: modalState.redirectUrl,
		pendingRoute: modalState.pendingRoute
			? {
				type: modalState.pendingRoute.type,
				options: Object.assign({}, modalState.pendingRoute.options)
			}
			: null
	}
}

function notify() {
	const snapshot = cloneState()
	listeners.forEach((listener) => {
		try {
			listener(snapshot)
		} catch (error) {
			console.warn('auth modal listener failed', error)
		}
	})
}

function setState(patch = {}) {
	Object.assign(modalState, patch)
	notify()
}

export function getLoginModalSnapshot() {
	return cloneState()
}

export function subscribeLoginModal(listener) {
	if (typeof listener !== 'function') {
		return () => {}
	}

	listeners.add(listener)
	listener(cloneState())
	return () => {
		listeners.delete(listener)
	}
}

export function openLoginModal({ reason = '', pendingRoute = null } = {}) {
	setState({
		visible: true,
		reason,
		redirectUrl: pendingRoute && pendingRoute.options && pendingRoute.options.url ? pendingRoute.options.url : '',
		pendingRoute
	})
}

export function hideLoginModal() {
	setState({
		visible: false
	})
}

export function closeLoginModal() {
	setState({
		visible: false,
		reason: '',
		redirectUrl: '',
		pendingRoute: null
	})
}

export function consumePendingRoute() {
	const pendingRoute = modalState.pendingRoute
	setState({
		reason: '',
		redirectUrl: '',
		pendingRoute: null
	})
	return pendingRoute
}
