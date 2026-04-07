export function getDefaultPlanPreview() {
	return [
		{
			title: '创建第一条愿望',
			status: '待开始',
			desc: '可在愿望清单里创建愿望或计划，并同步双方进度。',
			progress: 0
		}
	]
}

export function buildPlanPreviewFromResult(result = {}) {
	const data = result && result.data ? result.data : {}
	const list = Array.isArray(data.list) ? data.list : []
	if (!list.length) {
		const recommendations = Array.isArray(data.recommendations) ? data.recommendations : []
		if (recommendations.length) {
			return recommendations.slice(0, 2).map((item) => ({
				title: item.title || '推荐愿望',
				status: '推荐',
				desc: item.description || `分类：${item.category || '未分类'}`,
				progress: 0
			}))
		}
		return getDefaultPlanPreview()
	}

	return list.slice(0, 3).map((item) => ({
		title: item.title || '愿望清单',
		status: item.status_text || '待开始',
		desc: `${item.type_text || '清单'} · ${item.category || '未分类'} · 负责人：${item.owner_snapshot && item.owner_snapshot.nickname ? item.owner_snapshot.nickname : '我'}`,
		progress: Number(item.progress || 0)
	}))
}