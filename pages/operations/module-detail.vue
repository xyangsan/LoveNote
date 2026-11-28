<template>
	<view class="love-page love-page--compact opsm-page" :class="themeClass">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<noir-navbar
			:title="currentModuleMeta.name + '明细'"
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		/>

		<view class="love-layer opsm-wrap">
			<!-- 模块切换条 -->
			<scroll-view scroll-x class="opsm-chips-scroll" :show-scrollbar="false">
				<view class="opsm-chips">
					<view
						v-for="mod in moduleTabs"
						:key="mod.key"
						class="opsm-chip"
						:class="{ 'opsm-chip--active': activeModule === mod.key }"
						@tap="switchModule(mod.key)"
					>
						<text class="opsm-chip__txt" :class="{ 'opsm-chip__txt--active': activeModule === mod.key }">
							{{ mod.name }}
						</text>
					</view>
				</view>
			</scroll-view>

			<!-- 无权限 -->
			<view v-if="permissionDenied" class="opsm-forbidden">
				<text class="opsm-forbidden__title">暂无管理权限</text>
				<text class="opsm-forbidden__desc">该页面仅 admin 角色可访问。</text>
			</view>

			<template v-else>
				<!-- 汇总头 -->
				<view class="opsm-summary">
					<view class="opsm-summary__cell">
						<text class="opsm-summary__num">{{ summary.totalUsers }}</text>
						<text class="opsm-summary__lbl">{{ activeModule === 'couple' ? '已绑定情侣（对）' : '参与用户（人）' }}</text>
					</view>
					<view class="opsm-summary__sep"></view>
					<view class="opsm-summary__cell">
						<text class="opsm-summary__num opsm-summary__num--accent">{{ summary.totalRecords }}</text>
						<text class="opsm-summary__lbl">累计{{ currentModuleMeta.contentLabel }}（{{ currentModuleMeta.unit }}）</text>
					</view>
				</view>

				<!-- 首次加载 -->
				<view v-if="loading && !list.length" class="opsm-tip">
					<text class="opsm-tip__txt">加载中…</text>
				</view>

				<!-- 空态 -->
				<noir-empty
					v-else-if="!loading && !list.length"
					kicker="MODULE DETAIL"
					:title="'暂无' + currentModuleMeta.name + '数据'"
					desc="该模块目前还没有用户产生记录"
				/>

				<!-- 列表 -->
				<view v-else class="opsm-list">
					<!-- 情侣空间：双人绑定列表 -->
					<template v-if="activeModule === 'couple'">
						<view v-for="item in list" :key="item.id" class="opsm-card opsm-couple">
							<view class="opsm-couple__members">
								<view class="opsm-member">
									<image
										v-if="item.userA && item.userA.avatarUrl"
										class="opsm-ava"
										:src="item.userA.avatarUrl"
										mode="aspectFill"
									/>
									<view v-else class="opsm-ava opsm-ava--fallback">
										<text class="opsm-ava__init">{{ initialOf(item.userA && item.userA.nickname) }}</text>
									</view>
									<text class="opsm-member__name">{{ (item.userA && item.userA.nickname) || '微信用户' }}</text>
								</view>

								<text class="opsm-couple__link">♥</text>

								<view class="opsm-member">
									<image
										v-if="item.userB && item.userB.avatarUrl"
										class="opsm-ava"
										:src="item.userB.avatarUrl"
										mode="aspectFill"
									/>
									<view v-else class="opsm-ava opsm-ava--fallback">
										<text class="opsm-ava__init">{{ initialOf(item.userB && item.userB.nickname) }}</text>
									</view>
									<text class="opsm-member__name">{{ (item.userB && item.userB.nickname) || '微信用户' }}</text>
								</view>
							</view>

							<view class="opsm-couple__foot">
								<text class="opsm-meta">{{ item.relationNo ? '编号 ' + item.relationNo : '已绑定' }}</text>
								<text class="opsm-time">绑定于 {{ formatDateTime(item.bindDate) }}</text>
							</view>
						</view>
					</template>

					<!-- 其余 5 个模块：按用户聚合数据 -->
					<template v-else>
						<view v-for="(item, idx) in list" :key="item.id" class="opsm-card opsm-user">
							<view class="opsm-rank">
								<text class="opsm-rank__txt">{{ idx + 1 }}</text>
							</view>
							<image
								v-if="item.avatarUrl"
								class="opsm-ava"
								:src="item.avatarUrl"
								mode="aspectFill"
							/>
							<view v-else class="opsm-ava opsm-ava--fallback">
								<text class="opsm-ava__init">{{ initialOf(item.nickname) }}</text>
							</view>

							<view class="opsm-user__body">
								<view class="opsm-user__head">
									<text class="opsm-user__name">{{ item.nickname || '微信用户' }}</text>
									<view class="opsm-count">
										<text class="opsm-count__num">{{ item.count }}</text>
										<text class="opsm-count__unit">{{ item.unit || currentModuleMeta.unit }}</text>
									</view>
								</view>
								<text class="opsm-meta">{{ item.detailText || '' }}</text>
								<view class="opsm-user__foot">
									<text class="opsm-uid">UID {{ shortId(item.uid) }}</text>
									<text class="opsm-time">最近 {{ formatDateTime(item.lastTime) }}</text>
								</view>
							</view>
						</view>
					</template>
				</view>

				<view v-if="loading && list.length" class="opsm-tip">
					<text class="opsm-tip__txt">正在加载更多…</text>
				</view>
				<view v-else-if="!pagination.hasMore && list.length" class="opsm-tip">
					<text class="opsm-tip__txt">已经到底了（共 {{ pagination.total }} 项）</text>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
	import { getPlatformApi } from '@/common/api/platform.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const MODULE_TABS = [
		{ key: 'couple', name: '情侣空间', unit: '对', contentLabel: '绑定' },
		{ key: 'anniversary', name: '纪念日', unit: '条', contentLabel: '纪念日' },
		{ key: 'album', name: '相册', unit: '张', contentLabel: '照片/视频' },
		{ key: 'daily', name: '双人日常', unit: '条', contentLabel: '日常' },
		{ key: 'wish', name: '愿望清单', unit: '条', contentLabel: '愿望' },
		{ key: 'game', name: '聚会游戏', unit: '局', contentLabel: '对局' }
	]

	const PAGE_SIZE = 20

	function pad2(v) {
		return String(v).padStart(2, '0')
	}

	export default {
		data() {
			return {
				scrollTop: 0,
				moduleTabs: MODULE_TABS,
				activeModule: 'couple',
				permissionDenied: false,
				loading: false,
				summary: {
					totalUsers: 0,
					totalRecords: 0
				},
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
			currentModuleMeta() {
				return MODULE_TABS.find((m) => m.key === this.activeModule) || MODULE_TABS[0]
			}
		},
		onLoad(options = {}) {
			if (!requirePageLogin()) return
			const mod = String(options.module || '').trim()
			if (MODULE_TABS.some((m) => m.key === mod)) {
				this.activeModule = mod
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
				return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
			},
			switchModule(key) {
				if (this.activeModule === key) return
				this.activeModule = key
				this.loadList(true)
			},
			async loadList(reset = false) {
				if (this.loading) return
				const targetPage = reset ? 1 : this.pagination.page + 1
				this.loading = true
				try {
					const res = await getPlatformApi().getModuleDetail({
						module: this.activeModule,
						page: targetPage,
						pageSize: PAGE_SIZE
					})
					if (res && res.errCode === 'love-note-no-permission') {
						this.permissionDenied = true
						return
					}
					if (!res || (res.errCode && res.errCode !== 0)) {
						throw new Error((res && res.errMsg) || '加载模块明细失败')
					}
					const data = res.data || {}
					const rows = Array.isArray(data.list) ? data.list : []
					const pg = data.pagination || {}
					const sum = data.summary || {}

					this.summary = {
						totalUsers: Number(sum.totalUsers) || 0,
						totalRecords: Number(sum.totalRecords) || 0
					}
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
	.opsm-wrap {
		padding-bottom: calc(36rpx + env(safe-area-inset-bottom));
	}

	.opsm-chips-scroll {
		margin-top: 12rpx;
		white-space: nowrap;
	}

	.opsm-chips {
		display: inline-flex;
		align-items: center;
		gap: 12rpx;
		padding-bottom: 6rpx;
	}

	.opsm-chip {
		height: 54rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.opsm-chip--active {
		border-color: rgba(var(--noir-coral-rgb), 0.52);
		background: rgba(var(--noir-coral-rgb), 0.16);
	}

	.opsm-chip__txt {
		font-size: 22rpx;
		color: var(--noir-text-sub);
		white-space: nowrap;
	}

	.opsm-chip__txt--active {
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.opsm-summary {
		margin-top: 18rpx;
		padding: 24rpx 28rpx;
		border-radius: 26rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-sheet-hi);
		display: flex;
		align-items: center;
	}

	.opsm-summary__cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6rpx;
	}

	.opsm-summary__sep {
		width: 1rpx;
		height: 52rpx;
		background: var(--noir-border);
	}

	.opsm-summary__num {
		font-family: "NoirSerifNum", Georgia, serif;
		font-size: 44rpx;
		font-weight: 600;
		line-height: 1;
		color: var(--noir-text-strong);
	}

	.opsm-summary__num--accent {
		color: var(--noir-coral);
	}

	.opsm-summary__lbl {
		font-size: 20rpx;
		color: var(--noir-text-sub);
	}

	.opsm-list {
		margin-top: 18rpx;
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.opsm-card {
		padding: 22rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-sheet-hi);
	}

	.opsm-user {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.opsm-rank {
		width: 38rpx;
		text-align: center;
		flex-shrink: 0;
	}

	.opsm-rank__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 22rpx;
		font-weight: 600;
		color: var(--noir-gold);
	}

	.opsm-ava {
		width: 72rpx;
		height: 72rpx;
		border-radius: 50%;
		border: 1.5rpx solid var(--noir-border-gold);
		background: var(--noir-surface-2);
		flex-shrink: 0;
	}

	.opsm-ava--fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--noir-gold-rgb), 0.16);
	}

	.opsm-ava__init {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-gold);
	}

	.opsm-user__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8rpx;
	}

	.opsm-user__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.opsm-user__name {
		font-size: 27rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opsm-count {
		height: 42rpx;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4rpx;
		padding: 0 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border-coral);
		background: rgba(var(--noir-coral-rgb), 0.14);
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.opsm-count__num {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 22rpx;
		line-height: 1;
		font-weight: 700;
		color: var(--noir-coral);
	}

	.opsm-count__unit {
		font-size: 18rpx;
		line-height: 1;
		color: var(--noir-coral);
	}

	.opsm-meta {
		font-size: 22rpx;
		color: var(--noir-text-sub);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opsm-user__foot,
	.opsm-couple__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.opsm-uid {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: var(--noir-text-muted);
	}

	.opsm-time {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: var(--noir-text-muted);
		flex-shrink: 0;
	}

	.opsm-couple {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.opsm-couple__members {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14rpx;
	}

	.opsm-member {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.opsm-member__name {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.opsm-couple__link {
		font-size: 26rpx;
		color: var(--noir-coral);
		flex-shrink: 0;
	}

	.opsm-tip {
		padding: 36rpx 0 12rpx;
		text-align: center;
	}

	.opsm-tip__txt {
		font-size: 22rpx;
		color: var(--noir-text-muted);
	}

	.opsm-forbidden {
		margin-top: 80rpx;
		padding: 40rpx 28rpx;
		border-radius: 26rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-sheet-hi);
		text-align: center;
	}

	.opsm-forbidden__title {
		display: block;
		font-size: 30rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.opsm-forbidden__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 23rpx;
		color: var(--noir-text-sub);
	}
</style>
