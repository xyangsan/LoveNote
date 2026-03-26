import { createRouterModule } from './router.js'

let authApi = null

export function getAuthApi() {
	if (!authApi) {
		authApi = createRouterModule({
			loginByWeixin: 'auth/loginByWeixin',
			logout: 'auth/logout'
		})
	}

	return authApi
}
