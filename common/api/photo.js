import { createRouterModule } from './router.js'

let photoApi = null

export function getPhotoApi() {
	if (!photoApi) {
		photoApi = createRouterModule({
			getList: 'photo/getList',
			getDetail: 'photo/getDetail',
			upload: 'photo/upload',
			update: 'photo/update',
			delete: 'photo/delete',
			toggleFavorite: 'photo/toggleFavorite',
			moveToAlbum: 'photo/moveToAlbum'
		})
	}

	return photoApi
}
