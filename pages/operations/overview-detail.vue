<template>
	<view class="love-page love-page--compact opsd-page" :class="themeClass">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<noir-navbar
			:title="currentTypeMeta.label"
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		/>

		<view class="love-layer opsd-wrap">
			<!-- 指标切换 -->
			<view class="opsd-tabs">
				<view
					v-for="tab in typeTabs"
					:key="tab.key"
					class="opsd-tabs__item"
					@tap="switchType(tab.key)"
				>
					<text class="opsd-tabs__label" :class="{ 'opsd-tabs__label--active': activeType === tab.key }">
						{{ tab.label }}
					</text>
					<view class="opsd-tabs__bar" :class="{ 'opsd-tabs__bar--active': activeType === tab.key }"></view>
				</view>
			</view>

			<!-- 时间筛选 -->
			<view class="opsd-filter">
				<view class="opsd-filter__chips">
					<view
						v-for="opt in rangeOptions"
						:key="opt.key"
						class="opsd-chip"
						:class="{ 'opsd-chip--active': rangeKey === opt.key }"
						@tap="selectRange(opt.key)"
					>
						<text class="opsd-chip__txt" :class="{ 'opsd-chip__txt--active': rangeKey === opt.key }">
							{{ opt.label }}
						</text>
					</view>
				</view>

				<view
					class="opsd-date"
					:class="{ 'opsd-date--active': rangeKey === 'custom' }"
					@tap="openRangePicker"
				>
					<text class="opsd-date__txt">{{ shortDate(startDate) }}</text>
					<text class="opsd-date__sep">-</text>
					<text class="opsd-date__txt">{{ shortDate(endDate) }}</text>
					<view class="opsd-date__caret"></view>
				</view>
			</view>

			<!-- 无权限 -->
			<view v-if="permissionDenied" class="opsd-forbidden">
				<text class="opsd-forbidden__title">暂无管理权限</text>
				<text class="opsd-forbidden__desc">该页面仅 admin 角色可访问。</text>
			</view>

			<template v-else>
				<!-- 汇总头 -->
				<view class="opsd-summary">
					<view class="opsd-summary__left">
						<text class="opsd-summary__num">{{ pagination.total }}</text>
						<text class="opsd-summary__unit">{{ currentTypeMeta.unit }}</text>
					</view>
					<text class="opsd-summary__range">{{ rangeLabel }}</text>
				</view>

				<!-- 首次加载 -->
				<view v-if="loading && !list.length" class="opsd-tip">
					<text class="opsd-tip__txt">加载中…</text>
				</view>

				<!-- 空态 -->
				<noir-empty
					v-else-if="!loading && !list.length"
					kicker="OPERATIONS DETAIL"
					:title="'该时段暂无' + currentTypeMeta.label"
					desc="可切换上方时间范围查看更多记录"
				/>

				<!-- 列表 -->
				<view v-else class="opsd-list">
					<!-- 新增绑定：情侣双人卡片 -->
					<template v-if="activeType === 'bindings'">
						<view v-for="item in list" :key="item.id" class="opsd-card opsd-couple">
							<view class="opsd-couple__members">
								<view class="opsd-member">
									<image
										v-if="item.userA && item.userA.avatarUrl"
										class="opsd-ava"
										:src="item.userA.avatarUrl"
										mode="aspectFill"
									/>
									<view v-else class="opsd-ava opsd-ava--fallback">
										<text class="opsd-ava__init">{{ initialOf(item.userA && item.userA.nickname) }}</text>
									</view>
									<text class="opsd-member__name">{{ (item.userA && item.userA.nickname) || '微信用户' }}</text>
								</view>

								<text class="opsd-couple__link">♥</text>

								<view class="opsd-member">
									<image
										v-if="item.userB && item.userB.avatarUrl"
										class="opsd-ava"
										:src="item.userB.avatarUrl"
										mode="aspectFill"
									/>
									<view v-else class="opsd-ava opsd-ava--fallback">
										<text class="opsd-ava__init">{{ initialOf(item.userB && item.userB.nickname) }}</text>
									</view>
									<text class="opsd-member__name">{{ (item.userB && item.userB.nickname) || '微信用户' }}</text>
								</view>
							</view>
							<view class="opsd-couple__foot">
								<text class="opsd-meta">{{ item.relationNo ? '编号 ' + item.relationNo : '情侣绑定' }}</text>
								<text class="opsd-time">{{ formatDateTime(item.bindDate) }}</text>
							</view>
						</view>
					</template>

					<!-- 新增用户 / 访问 UV / 登录人数：单用户卡片 -->
					<template v-else>
						<view v-for="item in list" :key="item.id" class="opsd-card opsd-user">
							<image
								v-if="item.avatarUrl"
								class="opsd-ava"
								:src="item.avatarUrl"
								mode="aspectFill"
							/>
							<view v-else class="opsd-ava opsd-ava--fallback">
								<text class="opsd-ava__init">{{ initialOf(item.nickname) }}</text>
							</view>

							<view class="opsd-user__body">
								<view class="opsd-user__head">
									<text class="opsd-user__name">{{ item.nickname || '微信用户' }}</text>
									<view v-if="activeType === 'visits' && item.isGuest" class="opsd-tag opsd-tag--muted">
										<text class="opsd-tag__txt">游客</text>
									</view>
									<view v-else-if="activeType === 'newUsers' && item.isBound" class="opsd-tag opsd-tag--coral">
										<text class="opsd-tag__txt">已绑定</text>
									</view>
									<view v-else-if="activeType === 'visits' && item.visitCount > 0" class="opsd-tag">
										<text class="opsd-tag__txt">访问 {{ item.visitCount }} 次</text>
									</view>
									<view v-else-if="activeType === 'logins' && item.loginCount > 0" class="opsd-tag">
										<text class="opsd-tag__txt">登录 {{ item.loginCount }} 次</text>
									</view>
								</view>

								<text class="opsd-meta">{{ formatUserSub(item) }}</text>

								<view class="opsd-user__foot">
									<text class="opsd-uid">{{ item.uid ? 'UID ' + shortId(item.uid) : shortId(item.visitorKey) }}</text>
									<text class="opsd-time">{{ formatDateTime(item.actionTime) }}</text>
								</view>
							</view>
						</view>
					</template>
				</view>

				<view v-if="loading && list.length" class="opsd-tip">
					<text class="opsd-tip__txt">正在加载更多…</text>
				</view>
				<view v-else-if="!pagination.hasMore && list.length" class="opsd-tip">
					<text class="opsd-tip__txt">已经到底了（共 {{ pagination.total }} {{ currentTypeMeta.unit }}）</text>
				</view>
			</template>
		</view>

		<love-date-range
			:visible="rangePicker.visible"
			:start-date="rangePicker.start"
			:end-date="rangePicker.end"
			:min-date="rangePicker.minDate"
			:max-date="rangePicker.maxDate"
			:max-days="90"
			title="选择时间范围"
			subtitle="单次最多可选 90 天"
			@close="closeRangePicker"
			@confirm="confirmRangePicker"
		/>
	</view>
</template>

<script>
	import LoveDateRange from '@/components/love-date-range/love-date-range.vue'
	import { getPlatformApi } from '@/common/api/platform.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const TYPE_TABS = [
		{ key: 'newUsers', label: '新增用户', unit: '人' },
		{ key: 'visits', label: '访问 UV', unit: '位访客' },
		{ key: 'logins', label: '登录人数', unit: '人' },
		{ key: 'bindings', label: '新增绑定', unit: '对' }
	]

	const RANGE_OPTIONS = [
		{ key: 'today', label: '今日' },
		{ key: '7d', label: '近 7 天' },
		{ key: '30d', label: '近 30 天' }
	]

	const RANGE_DAYS = { today: 1, '7d': 7, '30d': 30 }
	const RANGE_LIMIT_DAYS = 90
	const PAGE_SIZE = 20

	function pad2(v) {
		return String(v).padStart(2, '0')
	}

	function toDateKey(date) {
		return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
	}

	function addDays(dateKey, delta) {
		const parts = String(dateKey || '').split('-').map(Number)
		if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return dateKey
		const next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + delta))
		return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`
	}

	export default {
		components: {
			LoveDateRange
		},
		data() {
			const today = toDateKey(new Date())
			return {
				scrollTop: 0,
				typeTabs: TYPE_TABS,
				rangeOptions: RANGE_OPTIONS,
				activeType: 'newUsers',
				rangeKey: 'today',
				startDate: today,
				endDate: today,
				rangePicker: {
					visible: false,
					start: today,
					end: today,
					minDate: addDays(today, -(RANGE_LIMIT_DAYS - 1)),
					maxDate: today
				},
				permissionDenied: false,
				loading: false,
				list: [],
				pagination: {
					page: 1,
					pageSize: PAGE_SIZE,
					total: 0,
					hasMore: false
				}
			}
		},
		computed: {
			currentTypeMeta() {
				return TYPE_TABS.find((t) => t.key === this.activeType) || TYPE_TABS[0]
			},
			rangeLabel() {
				if (this.startDate === this.endDate) {
					return this.startDate
				}
				return `${this.startDate} 至 ${this.endDate}`
			}
		},
		onLoad(options = {}) {
			if (!requirePageLogin()) return
			const type = String(options.type || '').trim()
			if (TYPE_TABS.some((t) => t.key === type)) {
				this.activeType = type
			}
			this.loadList(true)
		},
		onPageScroll(e) {
			const next = Math.max(0, Number((e && e.scrollTop) || 0))
			if (next !== this.scrollTop) {
				this.scrollTop = next
			}
		},
		onPullDownRefresh() {
			this.loadList(true).finally(() => {
				uni.stopPullDownRefresh()
			})
		},
		onReachBottom() {
			if (this.pagination.hasMore && !this.loading) {
				this.loadList(false)
			}
		},
		methods: {
			shortDate(dateKey) {
				const value = String(dateKey || '')
				if (value.length < 10) return value
				return `${Number(value.slice(5, 7))}/${value.slice(8, 10)}`
			},
			shortId(value) {
				const s = String(value || '').trim()
				if (s.length <= 12) return s
				return `${s.slice(0, 6)}…${s.slice(-4)}`
			},
			initialOf(name) {
				const s = String(name || '').trim()
				return s ? s.slice(0, 1).toUpperCase() : '爱'
			},
			formatDateTime(ts) {
				const num = Number(ts)
				if (!Number.isFinite(num) || num <= 0) return '—'
				const d = new Date(num)
				if (Number.isNaN(d.getTime())) return '—'
				return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
			},
			formatUserSub(item) {
				if (!item) return ''
				if (this.activeType === 'newUsers') {
					const parts = []
					if (item.isBound && item.partnerNickname) {
						parts.push(`绑定对象：${item.partnerNickname}`)
					} else {
						parts.push('暂未绑定情侣')
					}
					if (item.lastLoginDate) {
						parts.push(`最近登录 ${this.formatDateTime(item.lastLoginDate)}`)
					}
					return parts.join(' · ')
				}
				if (this.activeType === 'visits') {
					const parts = []
					if (item.platform) parts.push(item.platform)
					if (item.scene) parts.push(`场景 ${item.scene}`)
					if (item.enterPath) parts.push(item.enterPath)
					return parts.length ? parts.join(' · ') : '进入小程序'
				}
				if (this.activeType === 'logins') {
					const parts = []
					if (item.registerDate) {
						parts.push(`注册 ${this.formatDateTime(item.registerDate)}`)
					}
					if (item.ip) {
						parts.push(`IP ${item.ip}`)
					}
					return parts.length ? parts.join(' · ') : '微信登录'
				}
				return ''
			},
			switchType(key) {
				if (this.activeType === key) return
				this.activeType = key
				this.loadList(true)
			},
			selectRange(key) {
				if (this.rangeKey === key) return
				const today = toDateKey(new Date())
				const days = RANGE_DAYS[key] || 1
				this.rangeKey = key
				this.startDate = addDays(today, -(days - 1))
				this.endDate = today
				this.loadList(true)
			},
			openRangePicker() {
				const today = toDateKey(new Date())
				this.rangePicker = {
					visible: true,
					start: this.startDate,
					end: this.endDate,
					minDate: addDays(today, -(RANGE_LIMIT_DAYS - 1)),
					maxDate: today
				}
			},
			closeRangePicker() {
				this.rangePicker.visible = false
			},
			confirmRangePicker(payload = {}) {
				const start = String(payload.startDate || '').trim()
				const end = String(payload.endDate || '').trim()
				this.rangePicker.visible = false
				if (!start || !end) return
				if (this.rangeKey === 'custom' && this.startDate === start && this.endDate === end) return
				this.rangeKey = 'custom'
				this.startDate = start <= end ? start : end
				this.endDate = start <= end ? end : start
				this.loadList(true)
			},
			async loadList(reset = false) {
				if (this.loading) return
				const targetPage = reset ? 1 : this.pagination.page + 1
				this.loading = true
				try {
					const payload = {
						type: this.activeType,
						page: targetPage,
						pageSize: PAGE_SIZE
					}
					if (this.rangeKey === 'custom') {
						payload.startDate = this.startDate
						payload.endDate = this.endDate
					} else {
						payload.range = this.rangeKey
					}

					const res = await getPlatformApi().getOverviewUsers(payload)
					if (res && res.errCode === 'love-note-no-permission') {
						this.permissionDenied = true
						return
					}
					if (!res || (res.errCode && res.errCode !== 0)) {
						throw new Error((res && res.errMsg) || '加载明细失败')
					}
					const data = res.data || {}
					const rows = Array.isArray(data.list) ? data.list : []
					const pg = data.pagination || {}

					this.list = reset ? rows : this.list.concat(rows)
					this.pagination = {
						page: Number(pg.page) || targetPage,
						pageSize: Number(pg.pageSize) || PAGE_SIZE,
						total: Number(pg.total) || 0,
						hasMore: Boolean(pg.hasMore)
					}
				} catch (error) {
					uni.showToast({ title: error.message || '加载失败', icon: 'none' })
				} finally {
					this.loading = false
				}
			}
		}
	}
</script>

<style scoped>
	.opsd-wrap {
		padding-bottom: calc(36rpx + env(safe-area-inset-bottom));
	}

	.opsd-tabs {
		display: flex;
		align-items: center;
		border-bottom: 1rpx solid var(--noir-border);
	}

	.opsd-tabs__item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12rpx;
		padding-top: 14rpx;
	}

	.opsd-tabs__label {
		font-size: 24rpx;
		font-weight: 500;
		color: var(--noir-text-muted);
	}

	.opsd-tabs__label--active {
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.opsd-tabs__bar {
		width: 40rpx;
		height: 5rpx;
		border-radius: 3rpx;
		background: transparent;
	}

	.opsd-tabs__bar--active {
		background: var(--noir-coral);
	}

	.opsd-filter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14rpx;
		padding: 20rpx 0 8rpx;
	}

	.opsd-filter__chips {
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.opsd-chip {
		padding: 10rpx 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
		display: flex;
	}

	.opsd-chip--active {
		border-color: rgba(var(--noir-coral-rgb), 0.50);
		background: rgba(var(--noir-coral-rgb), 0.16);
	}

	.opsd-chip__txt {
		font-size: 20rpx;
		color: var(--noir-text-sub);
	}

	.opsd-chip__txt--active {
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.opsd-date {
		display: flex;
		align-items: center;
		gap: 6rpx;
		padding: 10rpx 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: var(--noir-glass-1);
	}

	.opsd-date--active {
		border-color: rgba(var(--noir-coral-rgb), 0.50);
	}

	.opsd-date__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: var(--noir-gold);
	}

	.opsd-date__sep {
		font-size: 18rpx;
		color: var(--noir-text-dim);
	}

	.opsd-date__caret {
		width: 9rpx;
		height: 9rpx;
		margin-top: -5rpx;
		margin-left: 2rpx;
		border-right: 2rpx solid var(--noir-gold);
		border-bottom: 2rpx solid var(--noir-gold);
		transform: rotate(45deg);
	}

	.opsd-summary {
		margin-top: 14rpx;
		padding: 20rpx 26rpx;
		border-radius: 24rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-sheet-hi);
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.opsd-summary__left {
		display: flex;
		align-items: baseline;
		gap: 8rpx;
	}

	.opsd-summary__num {
		font-family: "NoirSerifNum", Georgia, serif;
		font-size: 46rpx;
		font-weight: 600;
		line-height: 1;
		color: var(--noir-text-strong);
	}

	.opsd-summary__unit {
		font-size: 22rpx;
		color: var(--noir-text-sub);
	}

	.opsd-summary__range {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: var(--noir-gold);
	}

	.opsd-list {
		margin-top: 18rpx;
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.opsd-card {
		padding: 22rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-sheet-hi);
	}

	.opsd-user {
		display: flex;
		align-items: center;
		gap: 20rpx;
	}

	.opsd-ava {
		width: 76rpx;
		height: 76rpx;
		border-radius: 50%;
		border: 1.5rpx solid var(--noir-border-gold);
		background: var(--noir-surface-2);
		flex-shrink: 0;
	}

	.opsd-ava--fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--noir-gold-rgb), 0.16);
	}

	.opsd-ava__init {
		font-size: 28rpx;
		font-weight: 600;
		color: var(--noir-gold);
	}

	.opsd-user__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8rpx;
	}

	.opsd-user__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.opsd-user__name {
		font-size: 28rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opsd-tag {
		height: 40rpx;
		padding: 0 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: rgba(var(--noir-gold-rgb), 0.12);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.opsd-tag--coral {
		border-color: var(--noir-border-coral);
		background: rgba(var(--noir-coral-rgb), 0.14);
	}

	.opsd-tag--muted {
		border-color: var(--noir-border);
		background: var(--noir-glass-2);
	}

	.opsd-tag__txt {
		font-size: 20rpx;
		line-height: 1;
		color: var(--noir-gold);
		white-space: nowrap;
	}

	.opsd-tag--coral .opsd-tag__txt {
		color: var(--noir-coral);
	}

	.opsd-tag--muted .opsd-tag__txt {
		color: var(--noir-text-muted);
	}

	.opsd-meta {
		font-size: 22rpx;
		color: var(--noir-text-sub);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opsd-user__foot,
	.opsd-couple__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.opsd-uid {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: var(--noir-text-muted);
	}

	.opsd-time {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: var(--noir-text-muted);
		flex-shrink: 0;
	}

	.opsd-couple {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.opsd-couple__members {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14rpx;
	}

	.opsd-member {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.opsd-member__name {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opsd-couple__link {
		font-size: 26rpx;
		color: var(--noir-coral);
		flex-shrink: 0;
	}

	.opsd-tip {
		padding: 36rpx 0 12rpx;
		text-align: center;
	}

	.opsd-tip__txt {
		font-size: 22rpx;
		color: var(--noir-text-muted);
	}

	.opsd-forbidden {
		margin-top: 80rpx;
		padding: 40rpx 28rpx;
		border-radius: 26rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-sheet-hi);
		text-align: center;
	}

	.opsd-forbidden__title {
		display: block;
		font-size: 30rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.opsd-forbidden__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 23rpx;
		color: var(--noir-text-sub);
	}
</style>
