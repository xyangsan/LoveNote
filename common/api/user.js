import { createRouterModule } from './router.js'

let userApi = null

export function getUserApi() {
	if (!userApi) {
		userApi = createRouterModule({
			getMine: 'user/getMine',
			updateProfile: 'user/updateProfile'
		})
	}

	return userApi
}
