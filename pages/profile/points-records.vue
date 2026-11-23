<template>
	<view class="pr-page">
		<view class="pr-glow pr-glow--left"></view>
		<view class="pr-glow pr-glow--right"></view>

		<noir-navbar
			title="心动点记录"
			:show-back="true"
			:custom-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
			@back="goBack"
		/>

		<view class="pr-wrap">
			<!-- 顶部统计卡（对标 s30 .pr-bal） -->
			<view class="pr-bal">
				<text class="pr-kicker">HEART POINTS LEDGER · 流水统计</text>
				<view class="pr-stats">
					<view class="pr-stat">
						<text class="pr-stat__val pr-stat__val--coral">+{{ summaryText.today }}</text>
						<text class="pr-stat__lbl">今日</text>
					</view>
					<view class="pr-stat pr-stat--sep">
						<text class="pr-stat__val pr-stat__val--coral">+{{ summaryText.week }}</text>
						<text class="pr-stat__lbl">本周</text>
					</view>
					<view class="pr-stat pr-stat--sep">
						<text class="pr-stat__val">{{ summaryText.total }}</text>
						<text class="pr-stat__lbl">累计</text>
					</view>
				</view>
			</view>

			<!-- 按日分组流水（对标 s30 .pr-list） -->
			<view v-if="groupedLogs.length" class="pr-list">
				<view v-for="group in groupedLogs" :key="group.dateKey" class="pr-group">
					<view class="pr-date">
						<text class="pr-date__lbl">{{ group.label }}</text>
						<text class="pr-date__sum" :class="{ 'pr-date__sum--minus': group.total < 0 }">{{ group.totalText }}</text>
					</view>
					<view class="pr-card">
						<view
							v-for="(item, index) in group.items"
							:key="item.id"
							class="pr-item"
							:class="{ 'pr-item--last': index === group.items.length - 1 }"
						>
							<view class="pr-main">
								<text class="pr-main__title">{{ item.title || '心动点变动' }}</text>
								<text class="pr-main__time">{{ formatTime(item.createTime) }}</text>
							</view>
							<text
								class="pr-val"
								:class="{ 'pr-val--minus': item.points < 0 }"
							>{{ item.points > 0 ? '+' : '' }}{{ item.points }}</text>
						</view>
					</view>
				</view>
			</view>

			<view v-else-if="loading && !logs.length" class="pr-loading">
				<view class="pr-loading__line"></view>
				<view class="pr-loading__line"></view>
				<view class="pr-loading__line"></view>
			</view>

			<view v-else class="pr-empty">
				<text class="pr-empty__txt">{{ loadFailed ? '记录加载失败，下拉重试' : '还没有心动点记录，去完成每日任务试试' }}</text>
			</view>

			<view v-if="hasMore" class="pr-more" hover-class="pr-more--hover" @tap="loadMore">
				<text class="pr-more__txt">{{ loadingMore ? '加载中…' : '加载更多记录' }}</text>
			</view>

			<text v-else-if="groupedLogs.length" class="pr-note">仅展示真实业务计分与里程碑发放流水</text>
		</view>
	</view>
</template>

<script>
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import { getPointsApi } from '../../common/api/points.js'
	import { getCurrentUniIdUser } from '../../common/auth-center.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const REFRESH_THROTTLE_MS = 8 * 1000

	function formatPoints(value) {
		const num = Math.max(0, Math.floor(Number(value) || 0))
		return `${num}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	function pad2(value) {
		return `${Number(value || 0)}`.padStart(2, '0')
	}

	export default {
		data() {
			return {
				scrollTop: 0,
				logs: [],
				summary: {
					today: 0,
					week: 0,
					total: 0
				},
				hasMore: false,
				nextBefore: 0,
				loading: false,
				loadingMore: false,
				loadFailed: false,
				lastFetchAt: 0
			}
		},
		computed: {
			summaryText() {
				return {
					today: formatPoints(this.summary.today),
					week: formatPoints(this.summary.week),
					total: formatPoints(this.summary.total)
				}
			},
			groupedLogs() {
				const order = []
				const map = {}
				this.logs.forEach((log) => {
					const key = log.dateKey || ''
					if (!map[key]) {
						map[key] = {
							dateKey: key,
							label: this.buildDateLabel(key, log.createTime),
							items: [],
							total: 0
						}
						order.push(key)
					}
					map[key].items.push(log)
					map[key].total += Number(log.points || 0)
				})
				return order.map((key) => {
					const group = map[key]
					const abs = formatPoints(Math.abs(group.total))
					group.totalText = group.total < 0 ? `-${abs}` : `+${abs}`
					return group
				})
			}
		},
		onLoad() {
			if (!requirePageLogin()) return
			this.fetchLogs({ refresh: true })
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
		},
		onShow() {
			if (!requirePageLogin()) return
			if (!this.lastFetchAt || Date.now() - this.lastFetchAt < REFRESH_THROTTLE_MS) {
				return
			}
			this.fetchLogs({ refresh: true, silent: true })
		},
		onPullDownRefresh() {
			if (!requirePageLogin()) {
				uni.stopPullDownRefresh()
				return
			}
			this.fetchLogs({ refresh: true, silent: true }).then(() => {
				uni.stopPullDownRefresh()
			})
		},
		methods: {
			goBack() {
				uni.navigateBack({
					fail() {
						navigateToTab('/pages/profile/index')
					}
				})
			},
			formatTime(timestamp) {
				const date = new Date(Number(timestamp) || Date.now())
				return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
			},
			buildDateLabel(dateKey, timestamp) {
				const date = new Date(Number(timestamp) || Date.now())
				const todayKey = this.localDateKey(Date.now())
				const yesterdayKey = this.localDateKey(Date.now() - 86400000)
				if (dateKey === todayKey) {
					return '今天'
				}
				if (dateKey === yesterdayKey) {
					return '昨天'
				}
				return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
			},
			localDateKey(timestamp) {
				const date = new Date(timestamp)
				return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
			},
			async fetchLogs({ refresh = false, silent = false } = {}) {
				const currentUser = getCurrentUniIdUser()
				if (!currentUser || !currentUser.uid) {
					if (!this.logs.length) {
						this.loadFailed = true
					}
					return
				}

				if (refresh) {
					this.loading = true
				} else {
					this.loadingMore = true
				}

				try {
					const result = await getPointsApi().getLogs(refresh ? { limit: 30 } : {
						limit: 30,
						before: this.nextBefore
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取记录失败')
					}
					const data = result && result.data ? result.data : {}
					const logs = Array.isArray(data.logs) ? data.logs : []

					this.logs = refresh ? logs : this.logs.concat(logs)
					this.hasMore = Boolean(data.hasMore)
					this.nextBefore = Number(data.nextBefore || 0)
					this.loadFailed = false
					this.lastFetchAt = Date.now()
					if (data.summary) {
						this.summary = {
							today: Number(data.summary.today || 0),
							week: Number(data.summary.week || 0),
							total: Number(data.summary.total || 0)
						}
					}
				} catch (error) {
					console.warn('points records fetch failed', error)
					if (!this.logs.length) {
						this.loadFailed = true
					}
					if (!silent) {
						uni.showToast({
							title: error.message || '获取记录失败',
							icon: 'none'
						})
					}
				} finally {
					this.loading = false
					this.loadingMore = false
				}
			},
			loadMore() {
				if (!this.hasMore || this.loadingMore) {
					return
				}
				this.fetchLogs({ refresh: false })
			}
		}
	}
</script>

<style scoped>
	.pr-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
		background: #110D0B;
		overflow: hidden;
	}

	.pr-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.2;
		pointer-events: none;
		z-index: 0;
	}

	.pr-glow--left {
		top: -120rpx;
		left: -140rpx;
		background: #E2643F;
	}

	.pr-glow--right {
		top: 300rpx;
		right: -160rpx;
		background: #D8B08C;
	}

	.pr-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 36rpx 0;
	}

	.pr-kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.74);
		text-align: center;
	}

	.pr-bal {
		padding: 28rpx 24rpx;
		border-radius: 32rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.22);
		background: linear-gradient(135deg, rgba(216, 176, 140, 0.12), rgba(226, 100, 63, 0.06) 58%, rgba(255, 255, 255, 0.02));
	}

	.pr-stats {
		display: flex;
		margin-top: 22rpx;
	}

	.pr-stat {
		flex: 1;
		text-align: center;
	}

	.pr-stat--sep {
		border-left: 1rpx solid rgba(255, 255, 255, 0.08);
	}

	.pr-stat__val {
		display: block;
		font-family: "Georgia", serif;
		font-size: 40rpx;
		font-weight: 500;
		color: #FBF4EA;
		line-height: 1.1;
	}

	.pr-stat__val--coral {
		color: #E5865C;
	}

	.pr-stat__lbl {
		display: block;
		margin-top: 8rpx;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.44);
	}

	.pr-list {
		margin-top: 24rpx;
	}

	.pr-group {
		margin-top: 22rpx;
	}

	.pr-date {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 10rpx;
		padding: 0 6rpx;
	}

	.pr-date__lbl {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 22rpx;
		color: rgba(216, 176, 140, 0.76);
		font-weight: 500;
	}

	.pr-date__sum {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 22rpx;
		color: #E5865C;
	}

	.pr-date__sum--minus {
		color: rgba(245, 237, 228, 0.56);
	}

	.pr-card {
		padding: 0 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.028);
	}

	.pr-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		padding: 20rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.055);
	}

	.pr-item--last {
		border-bottom: none;
	}

	.pr-main {
		flex: 1;
		min-width: 0;
	}

	.pr-main__title {
		display: block;
		font-size: 26rpx;
		color: rgba(245, 237, 228, 0.86);
	}

	.pr-main__time {
		display: block;
		margin-top: 6rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.36);
	}

	.pr-val {
		flex-shrink: 0;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 28rpx;
		font-weight: 600;
		color: #E5865C;
	}

	.pr-val--minus {
		color: rgba(245, 237, 228, 0.54);
	}

	.pr-loading {
		margin-top: 30rpx;
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.pr-loading__line {
		height: 88rpx;
		border-radius: 22rpx;
		background: rgba(255, 255, 255, 0.035);
	}

	.pr-empty {
		margin-top: 40rpx;
		padding: 60rpx 28rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.07);
		background: rgba(255, 255, 255, 0.025);
		text-align: center;
	}

	.pr-empty__txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.pr-more {
		margin-top: 28rpx;
		height: 76rpx;
		border-radius: 38rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.03);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pr-more--hover {
		opacity: 0.82;
	}

	.pr-more__txt {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.pr-note {
		display: block;
		margin-top: 24rpx;
		text-align: center;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.30);
	}
</style>
