import { createRouterModule } from './router.js'

let homeApi = null

export function getHomeApi() {
	if (!homeApi) {
		homeApi = createRouterModule({
			// 首页首屏聚合：一次调用取回用户 / 情侣 / 统计 / 心动点 / 纪念日 / 照片 / 日常 / 愿望 / 进行中对局
			getDashboard: 'home/getDashboard'
		})
	}

	return homeApi
}
