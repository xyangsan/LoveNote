import { createRouterModule } from './router.js'

let albumApi = null

export function getAlbumApi() {
	if (!albumApi) {
		albumApi = createRouterModule({
			getList: 'album/getList',
			getDetail: 'album/getDetail',
			create: 'album/create',
			update: 'album/update',
			delete: 'album/delete'
		})
	}

	return albumApi
}
