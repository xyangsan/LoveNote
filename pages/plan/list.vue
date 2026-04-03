<template>
	<view class="love-page love-page--compact plan-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>
		<view class="love-layer">
			<view class="plan-head">
				<view>
					<text class="plan-head__title">愿望清单</text>
					<text class="plan-head__desc">愿望一键完成，计划按步骤推进并支持评论</text>
				</view>
				<fui-button text="新建" width="130rpx" height="64rpx" :size="22" radius="999rpx"
					background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)" color="#fff"
					@click="openCreateDialog"></fui-button>
			</view>

			<love-auth-required v-if="!isLoggedIn" desc="请先登录后查看并管理愿望清单"
				secondary-text="返回个人中心" @login="goToLoginPage" @secondary="goToProfile"></love-auth-required>

			<view v-else-if="noCouple" class="empty-wrap">
				<fui-empty title="暂未绑定情侣关系" descr="请先去情侣页完成绑定" :size="30" descr-size="22"></fui-empty>
				<fui-button text="去绑定" :margin="['18rpx', '80rpx', '0', '80rpx']" height="78rpx" :size="24"
					radius="999rpx" background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)" color="#fff"
					@click="goToCouplePage"></fui-button>
			</view>

			<view v-else>
				<love-glass-card :margin="['0','0','0','0']" :header-line="false" :padding="['18rpx','22rpx']">
					<view class="stats">
						<text class="stats__item">愿望 {{ Number(stats.wish_total || 0) }}</text>
						<text class="stats__item">计划 {{ Number(stats.plan_total || 0) }}</text>
						<text class="stats__item">已完成 {{ Number(stats.completed_total || 0) }}</text>
					</view>
					<fui-segmented-control :values="tabs" :current="activeTab" color="#ec7558" active-color="#fff"
						:height="70" :size="24" :radius="999" @click="handleTabChange"></fui-segmented-control>
				</love-glass-card>

				<love-glass-card v-if="recommendations.length" title="推荐" :margin="['20rpx','0','0','0']"
					:header-line="false" :padding="['14rpx','18rpx']">
					<view v-for="rec in recommendations" :key="rec.key" class="recommend-item">
						<view class="recommend-item__body">
							<text class="recommend-item__title">{{ rec.title }}</text>
							<text class="recommend-item__meta">{{ rec.type_text }} · {{ rec.category }}</text>
						</view>
						<fui-button text="加入" width="120rpx" height="54rpx" :size="22" radius="999rpx"
							background="rgba(255, 239, 231, 0.96)" color="#be6f59"
							border-color="rgba(223, 160, 140, 0.26)" @click="applyRecommendation(rec)"></fui-button>
					</view>
				</love-glass-card>

				<view v-if="loading && !list.length" class="loading-wrap">
					<fui-loading type="rotate" size="48"></fui-loading>
				</view>

				<view v-else-if="!list.length" class="empty-wrap">
					<fui-empty title="暂无清单" descr="点击右上角新建愿望或计划" :size="30" descr-size="22"></fui-empty>
				</view>

				<love-glass-card v-for="item in list" :key="item._id" :margin="['20rpx','0','0','0']"
					:header-line="false" :padding="['20rpx','22rpx']">
					<view class="plan-item">
						<view class="plan-item__head">
							<text class="plan-item__title">{{ item.title }}</text>
							<text class="plan-item__status">{{ item.status_text }}</text>
						</view>
						<text class="plan-item__meta">{{ item.type_text }} · {{ item.category || '未分类' }} · 负责人 {{ ownerText(item) }}</text>
						<text class="plan-item__meta">创建 {{ formatDateTime(item.create_time) }} · 完成 {{ item.completed_time ? formatDateTime(item.completed_time) : '--' }}</text>
						<text v-if="item.final_action_mode_text" class="plan-item__meta">
							完成方式 {{ item.final_action_mode_text }} · 执行人 {{ itemFinalActionUserText(item) }} · 时间 {{ item.final_action_time ? formatDateTime(item.final_action_time) : '--' }}
						</text>
						<text v-if="item.final_action_note" class="plan-item__meta">完成备注：{{ item.final_action_note }}</text>
						<view class="progress-row">
							<view class="progress-row__bar">
								<view class="progress-row__fill" :style="{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0)))}%` }"></view>
							</view>
							<text class="progress-row__text">{{ Number(item.progress || 0) }}%</text>
						</view>
						<text class="plan-item__summary">{{ summaryText(item) }}</text>
						<text class="plan-item__toggle" @click="toggleExpand(item._id)">{{ expanded(item._id) ? '收起详情' : '展开详情' }}</text>

						<view v-if="expanded(item._id)" class="step-list">
							<text v-if="!Array.isArray(item.steps) || !item.steps.length" class="step-empty">
								{{ item.type === 'wish' ? '愿望无需执行步骤，可直接完成。' : '还没有步骤，点击“加步骤”开始推进。' }}
							</text>
							<view v-for="step in item.steps" :key="step.step_id" class="step-item">
								<text class="step-item__title">{{ step.title }}（{{ stepStatusText(step.status) }}）</text>
								<text class="step-item__meta">创建：{{ formatDateTime(step.create_time) }} · 最新更新：{{ formatDateTime(step.update_time) }}</text>
								<text class="step-item__meta">操作：{{ step.action_mode_text || '--' }} · 执行人：{{ stepActionUserText(step) }} · 时间：{{ step.action_time ? formatDateTime(step.action_time) : '--' }}</text>
								<text v-if="step.action_note" class="step-item__meta">备注：{{ step.action_note }}</text>
								<view class="step-item__actions" v-if="step.status === 'pending' && !finished(item)">
									<fui-button text="完成" width="122rpx" height="52rpx" :size="22" radius="999rpx"
										background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)" color="#fff"
										@click="actionStep(item._id, step.step_id, 'complete')"></fui-button>
									<fui-button text="跳过" width="122rpx" height="52rpx" :size="22" radius="999rpx"
										background="rgba(255, 239, 231, 0.96)" color="#be6f59"
										border-color="rgba(223, 160, 140, 0.26)"
										@click="openActionDialog('step', item._id, step.step_id, 'skip')"></fui-button>
								</view>
								<view class="comment-row">
									<fui-input :value="commentDraft(item._id, step.step_id)" placeholder="评论..."
										background-color="#fff7f3" :border-bottom="false" :padding="['16rpx','18rpx']"
										:radius="16" :size="22" @input="setCommentDraft(item._id, step.step_id, $event)"></fui-input>
									<fui-button text="发" width="86rpx" height="50rpx" :size="20" radius="999rpx"
										background="rgba(255, 239, 231, 0.96)" color="#be6f59"
										border-color="rgba(223, 160, 140, 0.26)"
										@click="submitComment(item._id, step.step_id)"></fui-button>
								</view>
								<view v-if="Array.isArray(step.comments) && step.comments.length" class="comment-list">
									<view v-for="comment in step.comments" :key="comment.comment_id" class="comment-item">
										<text class="comment-item__meta">{{ comment.nickname || '用户' }} · {{ formatDateTime(comment.create_time) }}</text>
										<text class="comment-item__content">{{ comment.content }}</text>
									</view>
								</view>
							</view>
						</view>

						<view class="plan-item__actions" v-if="!finished(item)">
							<fui-button v-if="item.type === 'plan'" text="加步骤" width="132rpx" height="56rpx" :size="22"
								radius="999rpx" background="rgba(255, 239, 231, 0.96)" color="#be6f59"
								border-color="rgba(223, 160, 140, 0.26)" @click="openAddStepDialog(item._id)"></fui-button>
							<fui-button text="直接完成" width="168rpx" height="56rpx" :size="22" radius="999rpx"
								background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)" color="#fff"
								@click="openActionDialog('item', item._id, '', 'direct_complete')"></fui-button>
							<fui-button text="跳过" width="110rpx" height="56rpx" :size="22" radius="999rpx"
								background="rgba(255, 239, 231, 0.96)" color="#be6f59"
								border-color="rgba(223, 160, 140, 0.26)"
								@click="openActionDialog('item', item._id, '', 'skip')"></fui-button>
						</view>
					</view>
				</love-glass-card>
			</view>
		</view>
	</view>
</template>

<script>
	import { getCurrentUniIdUser } from '../../common/auth-center.js'
	import { getPlanApi } from '../../common/api/plan.js'
	import { useAppStateStore } from '../../store/app-state.js'

	function formatDateTime(timestamp) {
		if (!timestamp) {
			return '--'
		}
		const date = new Date(Number(timestamp))
		const year = date.getFullYear()
		const month = `${date.getMonth() + 1}`.padStart(2, '0')
		const day = `${date.getDate()}`.padStart(2, '0')
		const hour = `${date.getHours()}`.padStart(2, '0')
		const minute = `${date.getMinutes()}`.padStart(2, '0')
		return `${year}-${month}-${day} ${hour}:${minute}`
	}

	export default {
		data() {
			return {
				appStateStore: null,
				loading: false,
				noCouple: false,
				activeCouple: null,
				list: [],
				recommendations: [],
				stats: {
					wish_total: 0,
					plan_total: 0,
					completed_total: 0
				},
				tabs: [{ name: '全部' }, { name: '愿望' }, { name: '计划' }],
				activeTab: 0,
				expandedMap: {},
				commentMap: {}
			}
		},
		computed: {
			isLoggedIn() {
				const current = getCurrentUniIdUser()
				return Boolean(current && current.uid)
			},
			currentUid() {
				const current = getCurrentUniIdUser()
				return current && current.uid ? current.uid : ''
			}
		},
		onShow() {
			this.loadData({
				resetExpand: true
			})
		},
		onLoad() {
			this.ensureAppStateStore()
		},
		onPullDownRefresh() {
			this.loadData({
				resetExpand: false
			}).finally(() => {
				uni.stopPullDownRefresh()
			})
		},
		methods: {
			formatDateTime,
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			getTypeFilter() {
				if (this.activeTab === 1) {
					return 'wish'
				}
				if (this.activeTab === 2) {
					return 'plan'
				}
				return ''
			},
			async loadData({ resetExpand = false } = {}) {
				if (!this.isLoggedIn) {
					this.list = []
					this.recommendations = []
					this.noCouple = false
					return
				}

				this.loading = true
				try {
					const appStateStore = this.ensureAppStateStore()
					await appStateStore.fetchCoupleCenter({
						force: false
					})
					const coupleData = appStateStore.coupleCenterData || {}
					this.activeCouple = coupleData.activeCouple || null
					this.noCouple = !this.activeCouple

					if (this.noCouple) {
						this.list = []
						this.recommendations = []
						this.stats = {
							wish_total: 0,
							plan_total: 0,
							completed_total: 0
						}
						return
					}

					const planRes = await getPlanApi().getList({
						page: 1,
						pageSize: 50,
						type: this.getTypeFilter(),
						recommend: 1
					})
					if (planRes && planRes.errCode && planRes.errCode !== 0) {
						throw new Error(planRes.errMsg || '获取清单失败')
					}
					const data = planRes.data || {}
					this.list = Array.isArray(data.list) ? data.list : []
					this.recommendations = Array.isArray(data.recommendations) ? data.recommendations : []
					this.stats = data.stats || {
						wish_total: 0,
						plan_total: 0,
						completed_total: 0
					}
					if (resetExpand) {
						this.expandedMap = {}
					}
				} catch (error) {
					uni.showToast({
						title: error.message || '加载失败',
						icon: 'none'
					})
				} finally {
					this.loading = false
				}
			},
			handleTabChange(event = {}) {
				const nextIndex = Number(event.index || 0)
				this.activeTab = Number.isNaN(nextIndex) ? 0 : nextIndex
				this.loadData({
					resetExpand: true
				})
			},
			expanded(itemId = '') {
				return Boolean(this.expandedMap[itemId])
			},
			toggleExpand(itemId = '') {
				this.expandedMap = Object.assign({}, this.expandedMap, {
					[itemId]: !this.expanded(itemId)
				})
			},
			finished(item = {}) {
				const status = String(item.status || '')
				return status === 'completed' || status === 'skipped'
			},
			ownerText(item = {}) {
				const ownerUid = String(item.owner_uid || '')
				if (!ownerUid) {
					return '--'
				}
				if (ownerUid === this.currentUid) {
					return '我'
				}
				return this.activeCouple && this.activeCouple.partnerNickname
					? this.activeCouple.partnerNickname
					: 'TA'
			},
			itemFinalActionUserText(item = {}) {
				const actionUid = String(item.final_action_uid || '')
				if (!actionUid) {
					return '--'
				}
				if (actionUid === this.currentUid) {
					return '我'
				}
				if (this.activeCouple && this.activeCouple.partnerUid && actionUid === this.activeCouple.partnerUid) {
					return this.activeCouple.partnerNickname || 'TA'
				}
				return 'TA'
			},
			summaryText(item = {}) {
				const summary = item.step_summary || {}
				return `开始 ${summary.start_title || '--'} · 当前 ${summary.current_title || '--'} · 待完成 ${Number(summary.pending_count || 0)}`
			},
			stepStatusText(status = '') {
				if (status === 'completed') {
					return '已完成'
				}
				if (status === 'skipped') {
					return '已跳过'
				}
				return '待处理'
			},
			stepActionUserText(step = {}) {
				const actionUid = String(step.action_uid || '')
				if (!actionUid) {
					return '--'
				}
				if (actionUid === this.currentUid) {
					return '我'
				}
				if (this.activeCouple && this.activeCouple.partnerUid && actionUid === this.activeCouple.partnerUid) {
					return this.activeCouple.partnerNickname || 'TA'
				}
				return 'TA'
			},
			resolveInputValue(value = '') {
				if (value && typeof value === 'object' && value.detail) {
					return String(value.detail.value || '').trim()
				}
				return String(value || '').trim()
			},
			promptInput({ title = '请输入', placeholder = '', content = '' } = {}) {
				return new Promise((resolve) => {
					uni.showModal({
						title,
						editable: true,
						placeholderText: placeholder,
						content,
						success: (res) => {
							resolve({
								confirm: Boolean(res.confirm),
								content: String(res.content || '').trim()
							})
						},
						fail: () => {
							resolve({
								confirm: false,
								content: ''
							})
						}
					})
				})
			},
			async openCreateDialog() {
				if (this.noCouple) {
					uni.showToast({
						title: '请先绑定情侣关系',
						icon: 'none'
					})
					return
				}

				uni.showActionSheet({
					itemList: ['创建愿望', '创建计划'],
					success: async (res = {}) => {
						const type = Number(res.tapIndex || 0) === 1 ? 'plan' : 'wish'
						const titleRes = await this.promptInput({
							title: '填写标题',
							placeholder: type === 'wish' ? '例如：一起看日出' : '例如：周末短途旅行'
						})
						if (!titleRes.confirm || !titleRes.content) {
							return
						}

						const categoryRes = await this.promptInput({
							title: '填写分类',
							placeholder: '例如：旅行、美食、成长'
						})
						const descriptionRes = await this.promptInput({
							title: '填写描述',
							placeholder: '可选',
							content: ''
						})

						let steps = []
						if (type === 'plan') {
							const stepsRes = await this.promptInput({
								title: '填写步骤',
								placeholder: '使用 / 分隔，例如：订票/订酒店/出发'
							})
							steps = String(stepsRes.content || '')
								.split('/')
								.map((item) => String(item || '').trim())
								.filter(Boolean)
								.map((title) => ({ title }))
						}

						const ownerRes = await new Promise((resolve) => {
							uni.showActionSheet({
								itemList: ['我来完成', 'TA来完成'],
								success: (event = {}) => resolve(Number(event.tapIndex || 0) === 1 ? 'partner' : 'self'),
								fail: () => resolve('self')
							})
						})

						try {
							const result = await getPlanApi().create({
								type,
								title: titleRes.content,
								category: categoryRes.content,
								description: descriptionRes.content,
								ownerUid: ownerRes === 'partner' && this.activeCouple && this.activeCouple.partnerUid
									? this.activeCouple.partnerUid
									: this.currentUid,
								steps
							})
							if (result && result.errCode && result.errCode !== 0) {
								throw new Error(result.errMsg || '创建失败')
							}
							uni.showToast({
								title: '创建成功',
								icon: 'success'
							})
							this.ensureAppStateStore().invalidateRelationCounters()
							await this.loadData({
								resetExpand: true
							})
						} catch (error) {
							uni.showToast({
								title: error.message || '创建失败',
								icon: 'none'
							})
						}
					}
				})
			},
			async applyRecommendation(rec = {}) {
				const recommendationKey = String(rec.key || '').trim()
				if (!recommendationKey) {
					return
				}
				try {
					const result = await getPlanApi().create({
						recommendationKey,
						type: rec.type,
						ownerUid: this.currentUid
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '加入失败')
					}
					uni.showToast({
						title: '已加入',
						icon: 'success'
					})
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({
						resetExpand: false
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '加入失败',
						icon: 'none'
					})
				}
			},
			async openAddStepDialog(itemId = '') {
				const titleRes = await this.promptInput({
					title: '新增步骤',
					placeholder: '步骤标题'
				})
				if (!titleRes.confirm || !titleRes.content) {
					return
				}
				const descRes = await this.promptInput({
					title: '步骤说明',
					placeholder: '可选'
				})

				try {
					const result = await getPlanApi().addStep({
						itemId,
						title: titleRes.content,
						description: descRes.content
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '新增步骤失败')
					}
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({
						resetExpand: false
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '新增步骤失败',
						icon: 'none'
					})
				}
			},
			async openActionDialog(target = 'item', itemId = '', stepId = '', action = 'direct_complete') {
				const noteRes = await this.promptInput({
					title: '操作备注',
					placeholder: '可选'
				})
				if (!noteRes.confirm) {
					return
				}
				const note = noteRes.content

				try {
					if (target === 'step') {
						await this.actionStep(itemId, stepId, action, note)
					} else {
						const result = await getPlanApi().finish({
							itemId,
							action,
							note
						})
						if (result && result.errCode && result.errCode !== 0) {
							throw new Error(result.errMsg || '操作失败')
						}
					}
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({
						resetExpand: false
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '操作失败',
						icon: 'none'
					})
				}
			},
			async actionStep(itemId = '', stepId = '', action = 'complete', note = '') {
				const result = await getPlanApi().actionStep({
					itemId,
					stepId,
					action,
					note
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '步骤操作失败')
				}
			},
			commentKey(itemId = '', stepId = '') {
				return `${itemId}::${stepId}`
			},
			commentDraft(itemId = '', stepId = '') {
				return this.commentMap[this.commentKey(itemId, stepId)] || ''
			},
			setCommentDraft(itemId = '', stepId = '', value = '') {
				this.commentMap = Object.assign({}, this.commentMap, {
					[this.commentKey(itemId, stepId)]: this.resolveInputValue(value)
				})
			},
			async submitComment(itemId = '', stepId = '') {
				const key = this.commentKey(itemId, stepId)
				const content = String(this.commentMap[key] || '').trim()
				if (!content) {
					return
				}
				try {
					const result = await getPlanApi().addStepComment({
						itemId,
						stepId,
						content
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '评论失败')
					}
					this.commentMap = Object.assign({}, this.commentMap, {
						[key]: ''
					})
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({
						resetExpand: false
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '评论失败',
						icon: 'none'
					})
				}
			},
			goToLoginPage() {
				uni.navigateTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/plan/list')
				})
			},
			goToProfile() {
				uni.switchTab({
					url: '/pages/profile/index'
				})
			},
			goToCouplePage() {
				uni.navigateTo({
					url: '/pages/couple/index'
				})
			}
		}
	}
</script>

<style>
	.plan-page {
		padding-bottom: 48rpx;
	}

	.plan-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 24rpx 8rpx 18rpx;
		gap: 16rpx;
	}

	.plan-head__title {
		display: block;
		font-size: 44rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.plan-head__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: #8f6c62;
	}

	.empty-wrap,
	.loading-wrap {
		padding: 40rpx 0 10rpx;
	}

	.loading-wrap {
		display: flex;
		justify-content: center;
	}

	.stats {
		display: flex;
		gap: 16rpx;
		margin-bottom: 14rpx;
	}

	.stats__item {
		font-size: 23rpx;
		color: #8f6a61;
	}

	.recommend-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
		padding: 12rpx 0;
	}

	.recommend-item + .recommend-item {
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.recommend-item__body {
		flex: 1;
		min-width: 0;
	}

	.recommend-item__title {
		display: block;
		font-size: 28rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.recommend-item__meta {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: #8f6a61;
	}

	.plan-item__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.plan-item__title {
		flex: 1;
		min-width: 0;
		font-size: 30rpx;
		font-weight: 700;
		color: #5a3427;
		word-break: break-all;
	}

	.plan-item__status {
		font-size: 22rpx;
		color: #bf6f5a;
	}

	.plan-item__meta {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		color: #8f6a61;
	}

	.progress-row {
		display: flex;
		align-items: center;
		gap: 10rpx;
		margin-top: 12rpx;
	}

	.progress-row__bar {
		flex: 1;
		height: 10rpx;
		border-radius: 999rpx;
		background: #f6dfd6;
		overflow: hidden;
	}

	.progress-row__fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	}

	.progress-row__text {
		font-size: 22rpx;
		color: #b36753;
	}

	.plan-item__summary {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: #8f6a61;
	}

	.plan-item__toggle {
		display: inline-block;
		margin-top: 8rpx;
		font-size: 22rpx;
		color: #c4684f;
	}

	.step-list {
		margin-top: 12rpx;
	}

	.step-empty {
		display: block;
		margin-bottom: 8rpx;
		font-size: 22rpx;
		color: #9a756a;
	}

	.step-item {
		padding: 12rpx 0;
	}

	.step-item + .step-item {
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.step-item__title {
		display: block;
		font-size: 24rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.step-item__meta {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: #8f6a61;
	}

	.step-item__actions,
	.plan-item__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10rpx;
		margin-top: 10rpx;
	}

	.comment-row {
		display: flex;
		align-items: center;
		gap: 8rpx;
		margin-top: 10rpx;
	}

	.comment-row > view:first-child {
		flex: 1;
	}

	.comment-list {
		margin-top: 10rpx;
		padding: 10rpx 12rpx;
		border-radius: 14rpx;
		background: rgba(255, 247, 243, 0.92);
	}

	.comment-item + .comment-item {
		margin-top: 10rpx;
		padding-top: 10rpx;
		border-top: 1rpx solid rgba(231, 204, 194, 0.5);
	}

	.comment-item__meta {
		display: block;
		font-size: 20rpx;
		color: #a17a6d;
	}

	.comment-item__content {
		display: block;
		margin-top: 4rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #6a4337;
		word-break: break-all;
	}
</style>
