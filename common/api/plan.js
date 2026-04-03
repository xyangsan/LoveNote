import { createRouterModule } from './router.js'

let planApi = null

export function getPlanApi() {
	if (!planApi) {
		planApi = createRouterModule({
			getList: 'plan/getList',
			create: 'plan/create',
			addStep: 'plan/addStep',
			actionStep: 'plan/actionStep',
			addStepComment: 'plan/addStepComment',
			finish: 'plan/finish',
			delete: 'plan/delete'
		})
	}

	return planApi
}
