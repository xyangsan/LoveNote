<template>
	<view class="wish-page">
		<view class="wish-glow wish-glow--l"></view>
		<view class="wish-glow wish-glow--r"></view>

		<noir-navbar
			title="愿望与计划"
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		/>

		<view class="w-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先登录后查看并管理愿望单与计划清单"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="goToProfile"
			></love-auth-required>

			<template v-else>
				<!-- 顶部统计卡 -->
				<view class="w-sum">
					<view>
						<text class="noir-kicker">WISHLIST &amp; PLANS</text>
						<view class="w-snum">
							<text class="w-snum__val">{{ totalAllCount }}</text>
							<text class="w-snum__unit">项 · 愿望 {{ Number(stats.wish_total || 0) }} · 计划 {{ Number(stats.plan_total || 0) }} · 已完成 {{ Number(stats.completed_total || 0) }}</text>
						</view>
					</view>
					<noir-tag text="完成 +10点" variant="coral" />
				</view>

				<!-- 类型与状态筛选胶囊 -->
				<scroll-view scroll-x class="w-filters-scroll" :show-scrollbar="false">
					<view class="w-filters">
						<view
							v-for="chip in filterChips"
							:key="chip.key"
							class="w-chip"
							:class="{ 'is-on': activeFilter === chip.key }"
							@tap="activeFilter = chip.key"
						>
							<text class="w-chip__txt">{{ chip.label }}</text>
						</view>
					</view>
				</scroll-view>

				<!-- 加载态 -->
				<view v-if="loading && !list.length" class="w-loading">
					<fui-loading type="rotate" size="44" color="#D8B08C"></fui-loading>
					<text class="w-loading__txt">正在加载清单…</text>
				</view>

				<!-- 空态 -->
				<noir-empty
					v-else-if="!filteredList.length"
					kicker="WISHLIST & PLANS"
					:title="emptyTitle"
					desc="愿望支持一键完成，计划支持拆解步骤与评论协作；也可从下方推荐一键加入"
					:action-text="activeFilter !== 'all' ? '查看全部' : '＋ 新建愿望 / 计划'"
					@action="activeFilter !== 'all' ? (activeFilter = 'all') : openCreateSheet()"
				/>

				<!-- 愿望与计划统一列表（清晰区分类型） -->
				<view v-else class="w-list">
					<view
						v-for="item in filteredList"
						:key="item._id"
						class="w-card"
						:class="{ 'is-done': finished(item), 'w-card--plan': item.type === 'plan' }"
						@tap="handleCardTap(item)"
					>
						<view class="w-chead">
							<view class="w-chead__l">
								<view class="w-type-badge" :class="item.type === 'plan' ? 'w-type-badge--plan' : 'w-type-badge--wish'">
									<text class="w-type-badge__txt">{{ item.type === 'plan' ? '计划' : '愿望' }}</text>
								</view>
								<text class="w-chead__title">{{ item.title }}</text>
								<text v-if="item.is_self === false" class="w-owner-tag">TA 的</text>
							</view>
							<noir-tag
								:text="cardRightTag(item).text"
								:variant="cardRightTag(item).variant"
							/>
						</view>

						<text v-if="item.description" class="w-desc">{{ item.description }}</text>

						<!-- 计划专属进度条（愿望不展示步骤进度） -->
						<view v-if="item.type === 'plan'" class="w-prog">
							<view class="w-prog__bar">
								<view
									class="w-prog__fill"
									:style="{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0)))}%` }"
								></view>
							</view>
							<text class="w-prog__txt">{{ Number(item.progress || 0) }}%</text>
						</view>

						<view class="w-cmeta">
							<text class="w-cmeta__txt">
								负责人：{{ ownerText(item) }} · {{ formatShortDate(item.create_time) }}
							</text>

							<view
								v-if="!finished(item) && item.type === 'wish'"
								class="w-done-btn"
								@tap.stop="quickCompleteWish(item)"
							>
								<text class="w-done-btn__txt">一键完成</text>
							</view>
							<text v-else-if="item.type === 'plan'" class="w-expand-txt">
								{{ expanded(item._id) ? '收起步骤 ▲' : `步骤 (${(item.steps || []).length}) ▼` }}
							</text>
							<text v-else-if="item.status === 'completed'" class="w-pts-txt">+10 点</text>
						</view>

						<!-- 计划展开步骤区 -->
						<view v-if="item.type === 'plan' && expanded(item._id)" class="w-steps" @tap.stop>
							<text v-if="!Array.isArray(item.steps) || !item.steps.length" class="w-step-empty">
								还没有执行步骤，点击下方「＋ 加步骤」开始推进。
							</text>

							<view v-for="step in item.steps" :key="step.step_id" class="w-step">
								<view class="w-step__head">
									<text class="w-step__title">{{ step.title }}</text>
									<noir-tag
										:text="stepStatusText(step.status)"
										:variant="step.status === 'completed' ? 'green' : (step.status === 'skipped' ? 'muted' : 'gold')"
									/>
								</view>

								<view v-if="step.status === 'pending' && !finished(item)" class="w-step__acts">
									<view class="w-mini-btn w-mini-btn--primary" @tap="handleActionStep(item._id, step.step_id, 'complete')">
										<text class="w-mini-btn__txt">完成</text>
									</view>
									<view class="w-mini-btn" @tap="handleActionStep(item._id, step.step_id, 'skip')">
										<text class="w-mini-btn__txt">跳过</text>
									</view>
								</view>

								<!-- 步骤评论列表 -->
								<view v-if="Array.isArray(step.comments) && step.comments.length" class="w-scomments">
									<view v-for="c in step.comments" :key="c.comment_id" class="w-scitem">
										<text class="w-scitem__name">{{ c.nickname || '恋人' }}：</text>
										<text class="w-scitem__txt">{{ c.content }}</text>
									</view>
								</view>

								<!-- 步骤评论输入 -->
								<view class="w-cinput-row">
									<input
										class="w-cinput"
										:value="commentDraft(item._id, step.step_id)"
										placeholder="给这一步留言…"
										placeholder-style="color: rgba(245, 237, 228, 0.30);"
										confirm-type="send"
										@input="setCommentDraft(item._id, step.step_id, $event)"
										@confirm="submitComment(item._id, step.step_id)"
									/>
									<view class="w-csend" @tap="submitComment(item._id, step.step_id)">
										<text class="w-csend__txt">发送</text>
									</view>
								</view>
							</view>

							<view v-if="!finished(item)" class="w-plan-foot">
								<view class="w-mini-btn" @tap="openAddStepPrompt(item._id)">
									<text class="w-mini-btn__txt">＋ 加步骤</text>
								</view>
								<view class="w-mini-btn w-mini-btn--primary" @tap="finishItem(item, 'direct_complete')">
									<text class="w-mini-btn__txt">直接完成</text>
								</view>
								<view class="w-mini-btn" @tap="finishItem(item, 'skip')">
									<text class="w-mini-btn__txt">跳过</text>
								</view>
							</view>
						</view>
					</view>
				</view>

				<!-- 推荐愿望与计划 · 一键加入 -->
				<view v-if="visibleRecommendations.length" class="w-rec">
					<text class="w-rec__lbl">推荐愿望与计划 · 一键加入</text>
					<view class="w-rec-card">
						<view
							v-for="(rec, rIdx) in visibleRecommendations"
							:key="rec.key"
							class="w-rec-row"
							:class="{ 'w-rec-row--last': rIdx === visibleRecommendations.length - 1 }"
						>
							<view class="w-rec-row__l">
								<text class="w-rec-row__type">{{ rec.type === 'plan' ? '计划' : '愿望' }}</text>
								<text class="w-rec-row__title">{{ rec.title }}</text>
								<text v-if="rec.category" class="w-rec-row__cat">{{ rec.category }}</text>
							</view>
							<view class="w-join" @tap="applyRecommendation(rec)">
								<text class="w-join__txt">＋ 加入</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 广告位保留 -->
				<view class="ad-view">
					<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
				</view>
			</template>
		</view>

		<!-- 底部固定主操作栏 -->
		<view v-if="isLoggedIn" class="w-footer">
			<noir-button
				text="＋ 新建愿望 / 计划 (+5点)"
				variant="primary"
				size="lg"
				block
				@click="openCreateSheet"
			/>
		</view>

		<!-- 08 愿望详情底部抽屉 -->
		<view v-if="detailItem" class="w-sheet-mask" @tap="closeDetailSheet" @touchmove.stop.prevent>
			<view class="w-sheet" @tap.stop>
				<view class="w-sheet__head">
					<view class="w-detail-tags">
						<noir-tag text="愿望（无步骤）" variant="coral" />
						<noir-tag v-if="detailItem.category" :text="detailItem.category" variant="gold" />
						<noir-tag
							:text="detailItem.status_text || statusLabel(detailItem.status)"
							:variant="detailItem.status === 'completed' ? 'green' : (detailItem.status === 'skipped' ? 'muted' : 'gold')"
						/>
					</view>
					<view class="w-sheet__close" @tap="closeDetailSheet">
						<text class="w-sheet__close-txt">✕</text>
					</view>
				</view>

				<text class="w-detail-title">{{ detailItem.title }}</text>
				<text v-if="detailItem.description" class="w-detail-desc">{{ detailItem.description }}</text>

				<view class="w-detail-rows">
					<view class="w-drow">
						<text class="w-drow__lbl">负责人</text>
						<text class="w-drow__val">{{ ownerText(detailItem) }}</text>
					</view>
					<view class="w-drow">
						<text class="w-drow__lbl">创建时间</text>
						<text class="w-drow__val">{{ formatDateTime(detailItem.create_time) }}</text>
					</view>
					<view v-if="detailItem.completed_time" class="w-drow">
						<text class="w-drow__lbl">完成时间</text>
						<text class="w-drow__val">{{ formatDateTime(detailItem.completed_time) }}</text>
					</view>
					<view class="w-drow w-drow--last">
						<text class="w-drow__lbl">完成奖励</text>
						<text class="w-drow__val w-drow__val--coral">+10 心动点（每日限 5 条）</text>
					</view>
				</view>

				<view v-if="!finished(detailItem)" class="w-detail-foot">
					<noir-button text="跳过" variant="ghost" size="sm" @click="finishFromDetail('skip')" />
					<noir-button text="一键标记完成 (+10点)" variant="primary" size="sm" @click="finishFromDetail('direct_complete')" />
				</view>
				<view v-else-if="detailItem.is_self === true" class="w-detail-foot">
					<noir-button text="删除愿望" variant="danger" size="sm" @click="deleteDetailItem" />
				</view>
			</view>
		</view>

		<!-- 新建愿望 / 计划暗夜底部抽屉 -->
		<view v-if="createVisible" class="w-sheet-mask" @tap="closeCreateSheet" @touchmove.stop.prevent>
			<view class="w-sheet" @tap.stop>
				<view class="w-sheet__head">
					<view>
						<text class="noir-kicker">{{ createForm.type === 'wish' ? 'NEW WISH' : 'NEW PLAN' }}</text>
						<text class="w-sheet__title">{{ createForm.type === 'wish' ? '许一个新愿望' : '新建计划清单' }}</text>
					</view>
					<view class="w-sheet__close" @tap="closeCreateSheet">
						<text class="w-sheet__close-txt">✕</text>
					</view>
				</view>

				<!-- 类型切换 -->
				<view class="w-form-chips">
					<view
						class="w-chip"
						:class="{ 'is-on': createForm.type === 'wish' }"
						@tap="createForm.type = 'wish'"
					>
						<text class="w-chip__txt">愿望（无步骤）</text>
					</view>
					<view
						class="w-chip"
						:class="{ 'is-on': createForm.type === 'plan' }"
						@tap="createForm.type = 'plan'"
					>
						<text class="w-chip__txt">计划（多步骤）</text>
					</view>
				</view>

				<input
					class="w-field-input"
					v-model="createForm.title"
					:placeholder="createForm.type === 'wish' ? '例如：一起去冰岛看极光' : '例如：周末短途旅行计划'"
					placeholder-style="color: rgba(245, 237, 228, 0.30);"
					maxlength="60"
				/>

				<!-- 分类快捷选 -->
				<view class="w-form-sec">
					<text class="w-form-lbl">分类</text>
					<view class="w-form-chips">
						<view
							v-for="cat in categoryPresets"
							:key="cat"
							class="w-chip"
							:class="{ 'is-on': createForm.category === cat }"
							@tap="createForm.category = createForm.category === cat ? '' : cat"
						>
							<text class="w-chip__txt">{{ cat }}</text>
						</view>
					</view>
				</view>

				<textarea
					class="w-field-textarea"
					v-model="createForm.description"
					placeholder="写下心愿细节或小目标（可选）…"
					placeholder-style="color: rgba(245, 237, 228, 0.30);"
					maxlength="300"
				/>

				<input
					v-if="createForm.type === 'plan'"
					class="w-field-input"
					v-model="createForm.stepsText"
					placeholder="执行步骤（用 / 分隔，如：订票/订酒店/出发）"
					placeholder-style="color: rgba(245, 237, 228, 0.30);"
					maxlength="200"
				/>

				<!-- 负责人 -->
				<view v-if="activeCouple && activeCouple.partnerUid" class="w-form-sec">
					<text class="w-form-lbl">负责人</text>
					<view class="w-form-chips">
						<view
							class="w-chip"
							:class="{ 'is-on': createForm.ownerRole === 'self' }"
							@tap="createForm.ownerRole = 'self'"
						>
							<text class="w-chip__txt">我来完成</text>
						</view>
						<view
							class="w-chip"
							:class="{ 'is-on': createForm.ownerRole === 'partner' }"
							@tap="createForm.ownerRole = 'partner'"
						>
							<text class="w-chip__txt">{{ activeCouple.partnerNickname || 'TA' }} 来完成</text>
						</view>
					</view>
				</view>

				<view class="w-detail-foot">
					<noir-button text="取消" variant="ghost" size="sm" @click="closeCreateSheet" />
					<noir-button
						:text="creating ? '提交中…' : (createForm.type === 'wish' ? '许下愿望 (+5点)' : '创建计划 (+5点)')"
						variant="primary"
						size="sm"
						:disabled="creating"
						@click="submitCreate"
					/>
				</view>
			</view>
		</view>

		<love-couple-guide scene="plan" :active="noCouple" />
	</view>
</template>

<script>
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import { getCurrentUniIdUser } from '../../common/auth-center.js'
	import { getPlanApi } from '../../common/api/plan.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { requirePageLogin } from '@/common/auth-entry.js'
	import LoveCoupleGuide from '@/components/love-couple-guide/love-couple-guide.vue'

	const FILTER_CHIPS = [
		{ key: 'all', label: '全部' },
		{ key: 'wish', label: '愿望' },
		{ key: 'plan', label: '计划' },
		{ key: 'pending', label: '进行中' },
		{ key: 'completed', label: '已完成' }
	]

	const CATEGORY_PRESETS = ['旅行', '美食', '回忆', '体验', '日常', '成长']

	function formatDateTime(timestamp) {
		if (!timestamp) return '--'
		const d = new Date(Number(timestamp))
		if (Number.isNaN(d.getTime())) return '--'
		const y = d.getFullYear()
		const m = `${d.getMonth() + 1}`.padStart(2, '0')
		const day = `${d.getDate()}`.padStart(2, '0')
		const hh = `${d.getHours()}`.padStart(2, '0')
		const mm = `${d.getMinutes()}`.padStart(2, '0')
		return `${y}-${m}-${day} ${hh}:${mm}`
	}

	function formatShortDate(timestamp) {
		if (!timestamp) return ''
		const d = new Date(Number(timestamp))
		if (Number.isNaN(d.getTime())) return ''
		const m = `${d.getMonth() + 1}`.padStart(2, '0')
		const day = `${d.getDate()}`.padStart(2, '0')
		return `${m}.${day}`
	}

	export default {
		components: {
			LoveCoupleGuide
		},
		data() {
			return {
				scrollTop: 0,
				appStateStore: null,
				loading: false,
				noCouple: false,
				activeCouple: null,
				activeFilter: 'all',
				filterChips: FILTER_CHIPS,
				categoryPresets: CATEGORY_PRESETS,
				list: [],
				recommendations: [],
				stats: {
					wish_total: 0,
					plan_total: 0,
					completed_total: 0
				},
				expandedMap: {},
				commentMap: {},
				detailItem: null,
				createVisible: false,
				creating: false,
				createForm: {
					type: 'wish',
					title: '',
					category: '旅行',
					description: '',
					stepsText: '',
					ownerRole: 'self'
				}
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
			},
			totalAllCount() {
				const sum = Number(this.stats.wish_total || 0) + Number(this.stats.plan_total || 0)
				return sum || this.list.length
			},
			filteredList() {
				let result = this.list
				if (this.activeFilter === 'wish') {
					result = this.list.filter((item) => item.type === 'wish')
				} else if (this.activeFilter === 'plan') {
					result = this.list.filter((item) => item.type === 'plan')
				} else if (this.activeFilter === 'pending') {
					result = this.list.filter((item) => !this.finished(item))
				} else if (this.activeFilter === 'completed') {
					result = this.list.filter((item) => item.status === 'completed')
				}
				return [...result].sort((a, b) => {
					const aDone = this.finished(a) ? 1 : 0
					const bDone = this.finished(b) ? 1 : 0
					if (aDone !== bDone) return aDone - bDone
					return Number(b.update_time || b.create_time || 0) - Number(a.update_time || a.create_time || 0)
				})
			},
			visibleRecommendations() {
				if (this.activeFilter === 'wish' || this.activeFilter === 'plan') {
					const matched = this.recommendations.filter((r) => !r.type || r.type === this.activeFilter)
					return (matched.length ? matched : this.recommendations).slice(0, 6)
				}
				return this.recommendations.slice(0, 6)
			},
			emptyTitle() {
				if (this.activeFilter === 'wish') return '还没有共同愿望'
				if (this.activeFilter === 'plan') return '还没有计划清单'
				if (this.activeFilter !== 'all') return '该筛选下暂无记录'
				return '还没有愿望或计划'
			}
		},
		onLoad(options = {}) {
			if (!requirePageLogin()) return
			if (options.mode === 'plan' || options.mode === 'wish') {
				this.activeFilter = options.mode
			}
			this.ensureAppStateStore()
		},
		onShow() {
			if (!requirePageLogin()) return
			this.loadData({ resetExpand: false })
		},
		onPageScroll(e) {
			const next = Math.max(0, Number((e && e.scrollTop) || 0))
			if (next !== this.scrollTop) {
				this.scrollTop = next
			}
		},
		onPullDownRefresh() {
			this.loadData({ resetExpand: false }).finally(() => {
				uni.stopPullDownRefresh()
			})
		},
		methods: {
			formatDateTime,
			formatShortDate,
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			toggleMode() {
				this.activeMode = this.activeMode === 'wish' ? 'plan' : 'wish'
				this.activeStatus = 'all'
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
					const store = this.ensureAppStateStore()
					await store.fetchCoupleCenter({ force: false })
					const coupleData = store.coupleCenterData || {}
					this.activeCouple = coupleData.activeCouple || null
					this.noCouple = !this.activeCouple

					const planRes = await getPlanApi().getList({
						page: 1,
						pageSize: 60,
						type: '',
						recommend: 1
					})
					if (planRes && planRes.errCode && planRes.errCode !== 0) {
						throw new Error(planRes.errMsg || '获取清单失败')
					}
					const data = planRes.data || {}
					this.list = Array.isArray(data.list) ? data.list : []
					this.recommendations = Array.isArray(data.recommendations) ? data.recommendations : []
					this.stats = data.stats || { wish_total: 0, plan_total: 0, completed_total: 0 }
					if (resetExpand) {
						this.expandedMap = {}
					}
				} catch (error) {
					uni.showToast({ title: error.message || '加载失败', icon: 'none' })
				} finally {
					this.loading = false
				}
			},
			finished(item = {}) {
				const s = String(item.status || '')
				return s === 'completed' || s === 'skipped'
			},
			statusLabel(status = '') {
				if (status === 'completed') return '已完成'
				if (status === 'skipped') return '已跳过'
				return '进行中'
			},
			stepStatusText(status = '') {
				if (status === 'completed') return '已完成'
				if (status === 'skipped') return '已跳过'
				return '待处理'
			},
			cardRightTag(item = {}) {
				if (item.status === 'completed') return { text: '已完成', variant: 'green' }
				if (item.status === 'skipped') return { text: '已跳过', variant: 'muted' }
				if (item.category) return { text: item.category, variant: item.type === 'wish' ? 'coral' : 'gold' }
				return { text: item.type === 'wish' ? '愿望' : '计划', variant: 'gold' }
			},
			ownerText(item = {}) {
				const ownerUid = String(item.owner_uid || '')
				if (!ownerUid || ownerUid === this.currentUid) return '我'
				return (this.activeCouple && this.activeCouple.partnerNickname) || 'TA'
			},
			expanded(itemId = '') {
				return Boolean(this.expandedMap[itemId])
			},
			toggleExpand(itemId = '') {
				this.expandedMap = Object.assign({}, this.expandedMap, {
					[itemId]: !this.expanded(itemId)
				})
			},
			handleCardTap(item) {
				if (!item) return
				if (item.type === 'wish') {
					this.detailItem = item
					return
				}
				this.toggleExpand(item._id)
			},
			closeDetailSheet() {
				this.detailItem = null
			},
			async quickCompleteWish(item) {
				if (!item || !item._id) return
				await this.finishItem(item, 'direct_complete')
			},
			async finishFromDetail(action) {
				if (!this.detailItem) return
				const target = this.detailItem
				this.closeDetailSheet()
				await this.finishItem(target, action)
			},
			async finishItem(item, action = 'direct_complete') {
				if (!item || !item._id) return
				try {
					const res = await getPlanApi().finish({
						itemId: item._id,
						action,
						note: ''
					})
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '操作失败')
					}
					uni.showToast({
						title: action === 'skip' ? '已标记跳过' : '已完成 +10点',
						icon: 'success'
					})
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({ resetExpand: false })
				} catch (error) {
					uni.showToast({ title: error.message || '操作失败', icon: 'none' })
				}
			},
			deleteDetailItem() {
				const item = this.detailItem
				if (!item || !item._id) return
				uni.showModal({
					title: '删除愿望',
					content: `确定删除「${item.title}」吗？`,
					confirmColor: '#E2643F',
					success: async (res) => {
						if (!res.confirm) return
						try {
							const r = await getPlanApi().delete({ itemId: item._id })
							if (r && r.errCode && r.errCode !== 0) {
								throw new Error(r.errMsg || '删除失败')
							}
							this.closeDetailSheet()
							uni.showToast({ title: '已删除', icon: 'success' })
							this.ensureAppStateStore().invalidateRelationCounters()
							await this.loadData({ resetExpand: false })
						} catch (e) {
							uni.showToast({ title: e.message || '删除失败', icon: 'none' })
						}
					}
				})
			},
			openCreateSheet() {
				const defaultType = this.activeFilter === 'plan' ? 'plan' : 'wish'
				this.createForm = {
					type: defaultType,
					title: '',
					category: '旅行',
					description: '',
					stepsText: '',
					ownerRole: 'self'
				}
				this.createVisible = true
			},
			closeCreateSheet() {
				if (this.creating) return
				this.createVisible = false
			},
			async submitCreate() {
				const title = String(this.createForm.title || '').trim()
				if (!title) {
					uni.showToast({ title: '请输入标题', icon: 'none' })
					return
				}
				if (this.creating) return
				this.creating = true
				try {
					const steps = this.createForm.type === 'plan'
						? String(this.createForm.stepsText || '')
							.split('/')
							.map((s) => s.trim())
							.filter(Boolean)
							.map((t) => ({ title: t }))
						: []

					const ownerUid = this.createForm.ownerRole === 'partner' && this.activeCouple && this.activeCouple.partnerUid
						? this.activeCouple.partnerUid
						: this.currentUid

					const res = await getPlanApi().create({
						type: this.createForm.type,
						title,
						category: String(this.createForm.category || '').trim(),
						description: String(this.createForm.description || '').trim(),
						ownerUid,
						steps
					})
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '创建失败')
					}
					this.createVisible = false
					uni.showToast({ title: '已添加 (+5点)', icon: 'success' })
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({ resetExpand: true })
				} catch (error) {
					uni.showToast({ title: error.message || '创建失败', icon: 'none' })
				} finally {
					this.creating = false
				}
			},
			async applyRecommendation(rec = {}) {
				const recommendationKey = String(rec.key || '').trim()
				if (!recommendationKey) return
				try {
					const res = await getPlanApi().create({
						recommendationKey,
						type: rec.type || 'wish',
						ownerUid: this.currentUid
					})
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '加入失败')
					}
					uni.showToast({ title: '已加入清单', icon: 'success' })
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({ resetExpand: false })
				} catch (error) {
					uni.showToast({ title: error.message || '加入失败', icon: 'none' })
				}
			},
			openAddStepPrompt(itemId = '') {
				uni.showModal({
					title: '新增步骤',
					editable: true,
					placeholderText: '例如：预订车票与酒店',
					confirmColor: '#E2643F',
					success: async (res) => {
						if (!res.confirm) return
						const title = String(res.content || '').trim()
						if (!title) return
						try {
							const r = await getPlanApi().addStep({ itemId, title, description: '' })
							if (r && r.errCode && r.errCode !== 0) {
								throw new Error(r.errMsg || '新增步骤失败')
							}
							this.ensureAppStateStore().invalidateRelationCounters()
							await this.loadData({ resetExpand: false })
						} catch (error) {
							uni.showToast({ title: error.message || '新增步骤失败', icon: 'none' })
						}
					}
				})
			},
			async handleActionStep(itemId = '', stepId = '', action = 'complete') {
				try {
					const res = await getPlanApi().actionStep({ itemId, stepId, action, note: '' })
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '步骤操作失败')
					}
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({ resetExpand: false })
				} catch (error) {
					uni.showToast({ title: error.message || '步骤操作失败', icon: 'none' })
				}
			},
			commentKey(itemId = '', stepId = '') {
				return `${itemId}::${stepId}`
			},
			commentDraft(itemId = '', stepId = '') {
				return this.commentMap[this.commentKey(itemId, stepId)] || ''
			},
			setCommentDraft(itemId = '', stepId = '', event = {}) {
				const val = event && event.detail ? String(event.detail.value || '') : String(event || '')
				this.commentMap = Object.assign({}, this.commentMap, {
					[this.commentKey(itemId, stepId)]: val
				})
			},
			async submitComment(itemId = '', stepId = '') {
				const key = this.commentKey(itemId, stepId)
				const content = String(this.commentMap[key] || '').trim()
				if (!content) return
				try {
					const res = await getPlanApi().addStepComment({ itemId, stepId, content })
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '评论失败')
					}
					this.commentMap = Object.assign({}, this.commentMap, { [key]: '' })
					this.ensureAppStateStore().invalidateRelationCounters()
					await this.loadData({ resetExpand: false })
				} catch (error) {
					uni.showToast({ title: error.message || '评论失败', icon: 'none' })
				}
			},
			goToLoginPage() {
				uni.redirectTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/plan/list')
				})
			},
			goToProfile() {
				navigateToTab('profile')
			}
		}
	}
</script>

<style scoped>
	.wish-page {
		position: relative;
		min-height: 100vh;
		background:
			radial-gradient(88% 36% at 50% 0%, rgba(226, 124, 78, 0.10) 0%, rgba(17, 13, 11, 0) 68%),
			#110D0B;
		padding-bottom: calc(168rpx + env(safe-area-inset-bottom));
		overflow-x: hidden;
	}

	.wish-glow {
		position: fixed;
		width: 360rpx;
		height: 360rpx;
		border-radius: 50%;
		filter: blur(50rpx);
		opacity: 0.22;
		pointer-events: none;
		z-index: 0;
	}

	.wish-glow--l {
		top: -120rpx;
		left: -130rpx;
		background: rgba(226, 100, 63, 0.36);
	}

	.wish-glow--r {
		top: 240rpx;
		right: -130rpx;
		background: rgba(216, 176, 140, 0.24);
	}

	.w-mode-pill {
		height: 50rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.48);
		background: rgba(26, 21, 18, 0.76);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.w-mode-pill__txt {
		font-size: 21rpx;
		color: #EAD4BC;
		white-space: nowrap;
	}

	.w-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 28rpx 0;
	}

	/* 统计卡 */
	.w-sum {
		padding: 26rpx 28rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.24);
		background: linear-gradient(135deg, rgba(226, 124, 78, 0.15) 0%, rgba(255, 255, 255, 0.032) 100%);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.w-snum {
		display: flex;
		align-items: baseline;
		gap: 12rpx;
		margin-top: 10rpx;
	}

	.w-snum__val {
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 64rpx;
		line-height: 1;
		font-weight: 500;
		color: #FBF4EA;
	}

	.w-snum__unit {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.52);
	}

	.w-filters-scroll {
		margin-top: 22rpx;
		white-space: nowrap;
	}

	.w-filters {
		display: inline-flex;
		align-items: center;
		gap: 12rpx;
	}

	.w-type-badge {
		height: 36rpx;
		padding: 0 12rpx;
		border-radius: 10rpx;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.w-type-badge--wish {
		border: 1rpx solid rgba(226, 100, 63, 0.48);
		background: rgba(226, 100, 63, 0.16);
	}

	.w-type-badge--plan {
		border: 1rpx solid rgba(216, 176, 140, 0.48);
		background: rgba(216, 176, 140, 0.14);
	}

	.w-type-badge__txt {
		font-size: 18rpx;
		font-weight: 500;
		line-height: 1;
	}

	.w-type-badge--wish .w-type-badge__txt {
		color: #F5B496;
	}

	.w-type-badge--plan .w-type-badge__txt {
		color: #EAD4BC;
	}

	.w-rec-row__type {
		padding: 2rpx 10rpx;
		border-radius: 8rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		font-size: 17rpx;
		color: #D8B08C;
		flex-shrink: 0;
	}

	.w-chip {
		height: 54rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.10);
		background: rgba(255, 255, 255, 0.036);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.w-chip.is-on {
		border-color: rgba(216, 176, 140, 0.58);
		background: rgba(216, 176, 140, 0.16);
	}

	.w-chip__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.64);
		white-space: nowrap;
	}

	.w-chip.is-on .w-chip__txt {
		color: #FBF4EA;
		font-weight: 500;
	}

	.w-loading {
		padding: 72rpx 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16rpx;
	}

	.w-loading__txt {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.46);
	}

	.w-list {
		margin-top: 20rpx;
	}

	.w-card {
		padding: 24rpx 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.032);
		margin-bottom: 16rpx;
	}

	.w-card.is-done {
		opacity: 0.66;
	}

	.w-chead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14rpx;
	}

	.w-chead__l {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.w-chead__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 30rpx;
		font-weight: 600;
		color: #FBF4EA;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.w-owner-tag {
		padding: 2rpx 10rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.36);
		font-size: 17rpx;
		color: #D8B08C;
		flex-shrink: 0;
	}

	.w-desc {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.54);
	}

	.w-prog {
		display: flex;
		align-items: center;
		gap: 14rpx;
		margin-top: 16rpx;
	}

	.w-prog__bar {
		flex: 1;
		height: 10rpx;
		border-radius: 999rpx;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.w-prog__fill {
		height: 100%;
		border-radius: 999rpx;
		background: linear-gradient(90deg, #D8B08C 0%, #E2643F 100%);
	}

	.w-prog__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: #EAD4BC;
	}

	.w-cmeta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
		margin-top: 16rpx;
	}

	.w-cmeta__txt {
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.44);
	}

	.w-done-btn {
		height: 48rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(226, 100, 63, 0.50);
		background: rgba(226, 100, 63, 0.16);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.w-done-btn__txt {
		font-size: 20rpx;
		color: #F5B496;
		white-space: nowrap;
	}

	.w-expand-txt {
		font-size: 21rpx;
		color: #D8B08C;
	}

	.w-pts-txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 21rpx;
		color: #9ED6B2;
	}

	/* 计划步骤展开区 */
	.w-steps {
		margin-top: 18rpx;
		padding-top: 16rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.w-step-empty {
		display: block;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.42);
		padding: 8rpx 0 14rpx;
	}

	.w-step {
		padding: 18rpx 18rpx;
		border-radius: 18rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.025);
		margin-bottom: 12rpx;
	}

	.w-step__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.w-step__title {
		font-size: 25rpx;
		color: #F5EDE4;
		font-weight: 500;
	}

	.w-step__acts,
	.w-plan-foot {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-top: 14rpx;
	}

	.w-mini-btn {
		height: 48rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.36);
		background: rgba(216, 176, 140, 0.10);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.w-mini-btn--primary {
		border-color: rgba(226, 100, 63, 0.56);
		background: rgba(226, 100, 63, 0.22);
	}

	.w-mini-btn__txt {
		font-size: 20rpx;
		color: #EAD4BC;
	}

	.w-mini-btn--primary .w-mini-btn__txt {
		color: #FBF4EA;
	}

	.w-scomments {
		margin-top: 12rpx;
		padding: 12rpx 14rpx;
		border-radius: 14rpx;
		background: rgba(17, 13, 11, 0.54);
	}

	.w-scitem {
		font-size: 21rpx;
		line-height: 1.55;
	}

	.w-scitem__name {
		color: #D8B08C;
	}

	.w-scitem__txt {
		color: rgba(245, 237, 228, 0.72);
	}

	.w-cinput-row {
		display: flex;
		align-items: center;
		gap: 10rpx;
		margin-top: 12rpx;
	}

	.w-cinput {
		flex: 1;
		height: 58rpx;
		padding: 0 18rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.04);
		color: #FBF4EA;
		font-size: 22rpx;
	}

	.w-csend {
		height: 58rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.44);
		background: rgba(216, 176, 140, 0.14);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.w-csend__txt {
		font-size: 21rpx;
		color: #EAD4BC;
	}

	/* 推荐愿望 */
	.w-rec {
		margin-top: 26rpx;
	}

	.w-rec__lbl {
		display: block;
		margin-bottom: 12rpx;
		padding-left: 4rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.54);
	}

	.w-rec-card {
		padding: 0 24rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.18);
		background: rgba(216, 176, 140, 0.045);
	}

	.w-rec-row {
		min-height: 88rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14rpx;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.w-rec-row--last {
		border-bottom: none;
	}

	.w-rec-row__l {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 12rpx;
	}

	.w-rec-row__title {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.86);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.w-rec-row__cat {
		font-size: 19rpx;
		color: rgba(245, 237, 228, 0.40);
		flex-shrink: 0;
	}

	.w-join {
		height: 46rpx;
		padding: 0 18rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.46);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.w-join__txt {
		font-size: 20rpx;
		color: #D8B08C;
	}

	.ad-view {
		margin-top: 24rpx;
	}

	.w-footer {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		padding: 18rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
		background: linear-gradient(180deg, rgba(17, 13, 11, 0) 0%, rgba(17, 13, 11, 0.94) 30%, #110D0B 100%);
		box-sizing: border-box;
	}

	/* 底部抽屉（愿望详情 & 新建表单） */
	.w-sheet-mask {
		position: fixed;
		inset: 0;
		z-index: 120;
		background: rgba(8, 6, 5, 0.72);
		display: flex;
		align-items: flex-end;
	}

	.w-sheet {
		width: 100%;
		max-height: 86vh;
		overflow-y: auto;
		padding: 30rpx 32rpx calc(34rpx + env(safe-area-inset-bottom));
		border-radius: 32rpx 32rpx 0 0;
		border-top: 1rpx solid rgba(216, 176, 140, 0.28);
		background: #1A1512;
		box-sizing: border-box;
	}

	.w-sheet__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-bottom: 20rpx;
	}

	.w-sheet__title {
		display: block;
		margin-top: 4rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 34rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.w-sheet__close {
		width: 56rpx;
		height: 56rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.w-sheet__close-txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.7);
	}

	.w-detail-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 10rpx;
	}

	.w-detail-title {
		display: block;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 40rpx;
		font-weight: 600;
		color: #FBF4EA;
		line-height: 1.35;
	}

	.w-detail-desc {
		display: block;
		margin-top: 14rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: rgba(245, 237, 228, 0.64);
	}

	.w-detail-rows {
		margin-top: 22rpx;
		padding: 0 22rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.07);
		background: rgba(255, 255, 255, 0.025);
	}

	.w-drow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.w-drow--last {
		border-bottom: none;
	}

	.w-drow__lbl {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.w-drow__val {
		font-size: 24rpx;
		color: #FBF4EA;
	}

	.w-drow__val--coral {
		color: #E5865C;
	}

	.w-detail-foot {
		display: flex;
		justify-content: flex-end;
		gap: 16rpx;
		margin-top: 26rpx;
	}

	.w-form-sec {
		margin-top: 18rpx;
	}

	.w-form-lbl {
		display: block;
		margin-bottom: 10rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.52);
	}

	.w-form-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 10rpx;
		margin-bottom: 14rpx;
	}

	.w-field-input {
		width: 100%;
		height: 78rpx;
		padding: 0 24rpx;
		box-sizing: border-box;
		border-radius: 20rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.24);
		background: rgba(255, 255, 255, 0.04);
		color: #FBF4EA;
		font-size: 26rpx;
		margin-top: 12rpx;
	}

	.w-field-textarea {
		width: 100%;
		height: 140rpx;
		padding: 18rpx 22rpx;
		box-sizing: border-box;
		border-radius: 20rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.10);
		background: rgba(255, 255, 255, 0.036);
		color: #FBF4EA;
		font-size: 25rpx;
		line-height: 1.6;
		margin-top: 12rpx;
	}
</style>
