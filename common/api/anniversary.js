import { createRouterModule } from './router.js'

let anniversaryApi = null

export function getAnniversaryApi() {
	if (!anniversaryApi) {
		anniversaryApi = createRouterModule({
			getList: 'anniversary/getList',
			getDetail: 'anniversary/getDetail',
			create: 'anniversary/create',
			update: 'anniversary/update',
			delete: 'anniversary/delete'
		})
	}

	return anniversaryApi
}
