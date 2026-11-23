<template>
	<view class="anniv-page">
		<noir-navbar
			title="纪念日"
			:show-back="true"
			:transparent="true"
			:placeholder="false"
			:border="false"
			:scroll-top="scrollTop"
		>
			<template #right>
				<view v-if="isLoggedIn" class="n-add-pill" @tap="goToEdit()">
					<text class="n-add-pill__txt">＋ 新增</text>
				</view>
			</template>
		</noir-navbar>

		<love-auth-required
			v-if="!isLoggedIn"
			desc="纪念日功能需要登录后使用，登录后可创建并管理你们的重要日期。"
			secondary-text="返回首页"
			@login="goToLoginPage"
			@secondary="backToHome"
		></love-auth-required>

		<template v-else>
			<!-- 顶部全出血 Hero（03 纪念日设计稿） -->
			<view class="n-hero" :style="heroStyle" @tap="heroAnniversary ? goToEdit(heroAnniversary) : goToEdit()">
				<image class="n-hero__img" :src="heroCoverUrl" mode="aspectFill"></image>
				<view class="n-hero__shade"></view>

				<view class="n-hero__copy" :style="heroCopyStyle">
					<text class="noir-kicker">{{ heroAnniversary ? 'NEXT ANNIVERSARY' : 'LOVE NOTE · ANNIVERSARY' }}</text>

					<template v-if="heroAnniversary">
						<view class="n-dayrow">
							<text class="n-dayrow__num">{{ heroCountdown.num }}</text>
							<text class="n-dayrow__unit">{{ heroCountdown.unit }}</text>
						</view>
						<view class="n-hero__title-row">
							<text class="n-hero__title">{{ heroAnniversary.title }}</text>
							<text class="n-hero__meta">{{ heroMetaText }}</text>
						</view>
					</template>

					<template v-else>
						<view class="n-dayrow">
							<text class="n-dayrow__num">0</text>
							<text class="n-dayrow__unit">个纪念日</text>
						</view>
						<view class="n-hero__title-row">
							<text class="n-hero__title">记录第一个重要日子</text>
							<text class="n-hero__meta">公历 / 农历 · 4 种重复规则</text>
						</view>
					</template>
				</view>
			</view>

			<!-- 主体内容区 -->
			<view class="n-body">
				<!-- 筛选胶囊 -->
				<view class="n-filter">
					<view
						v-for="tab in filterTabs"
						:key="tab.key"
						class="n-chip"
						:class="{ 'is-on': activeFilter === tab.key }"
						@tap="activeFilter = tab.key"
					>
						<text class="n-chip__txt">{{ tab.label }}</text>
					</view>
				</view>

				<!-- 分区头 -->
				<view class="n-sec">
					<text class="n-sec__title">我们的时间</text>
					<text class="n-sec__cnt">{{ filteredList.length }} ENTRIES</text>
				</view>

				<!-- 加载态 -->
				<view v-if="loading && !anniversaryList.length" class="n-loading">
					<fui-loading type="rotate" size="44" color="#D8B08C"></fui-loading>
					<text class="n-loading__txt">正在加载纪念日…</text>
				</view>

				<!-- 空态 -->
				<noir-empty
					v-else-if="!filteredList.length"
					kicker="ANNIVERSARY"
					:title="anniversaryList.length ? '该分类下暂无纪念日' : '还没有纪念日'"
					:desc="anniversaryList.length ? '切换筛选查看全部纪念日，或新建一个重要日期' : '点击下方新建你们的第一个纪念日，支持公历/农历与自动倒计时'"
					:action-text="anniversaryList.length ? '查看全部' : '＋ 新建纪念日'"
					@action="anniversaryList.length ? (activeFilter = 'all') : goToEdit()"
				/>

				<!-- 纪念日时间线列表（对齐 03 设计稿） -->
				<view v-else class="n-list">
					<view
						v-for="(item, idx) in filteredList"
						:key="item._id"
						class="n-row"
						:class="{ 'n-row--last': idx === filteredList.length - 1 }"
						@tap="goToEdit(item)"
						@longpress="handleCardLongPress(item)"
					>
						<view class="n-date">
							<text class="n-date__day">{{ getDateParts(item).day }}</text>
							<text class="n-date__ym">{{ getDateParts(item).monthYear }}</text>
						</view>

						<view class="n-info">
							<view class="n-info__head">
								<text class="n-info__title">{{ item.title }}</text>
								<text v-if="item.is_self === false" class="n-info__owner">TA 的</text>
							</view>
							<text class="n-info__sub">{{ getItemSubtitle(item) }}</text>
							<view class="n-tags">
								<noir-tag
									:text="dateTypeTextMap[item.date_type] || '公历'"
									:variant="item.date_type === 'lunar' ? 'coral' : 'gold'"
								/>
								<noir-tag
									:text="repeatTypeTextMap[item.repeat_type] || '每年重复'"
									:variant="item.repeat_type === 'none' ? 'muted' : 'gold'"
								/>
							</view>
						</view>

						<view class="n-right" :class="getCountdownClass(item)">
							<text class="n-right__num">{{ getCountdownDisplay(item).num }}</text>
							<text class="n-right__unit">{{ getCountdownDisplay(item).unit }}</text>
						</view>
					</view>
				</view>

				<text class="n-note">支持公历 / 农历、4 种重复规则与自定义封面遮罩 · 长按可删除</text>

				<view class="ad-view">
					<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
				</view>
			</view>

			<!-- 底部固定主操作栏 -->
			<view class="n-footer">
				<noir-button
					text="＋ 新建一个纪念日 (+5点)"
					variant="primary"
					size="lg"
					block
					@click="goToEdit()"
				/>
			</view>
		</template>

		<love-couple-guide scene="anniversary" :active="noCouple" />
	</view>
</template>

<script>
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import {
		clearUniIdTokenStorage,
		getCurrentUniIdUser
	} from '../../common/auth-center.js'
	import { getAnniversaryApi } from '../../common/api/anniversary.js'
	import { normalizeAnniversaryCountdownItem } from '../../common/utils/anniversary-countdown.js'
	import { getNavBarHeight, getNavBarMetrics } from '../../common/utils/nav-bar.js'
	import LoveCoupleGuide from '@/components/love-couple-guide/love-couple-guide.vue'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const DEFAULT_ANNIV_HERO = '/static/images/anniv-hero-bg.jpg'

	const MONTH_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

	const DATE_TYPE_TEXT_MAP = {
		solar: '公历',
		lunar: '农历'
	}

	const REPEAT_TYPE_TEXT_MAP = {
		none: '不重复',
		weekly: '每周重复',
		monthly: '每月重复',
		yearly: '每年重复'
	}

	const FILTER_TABS = [
		{ key: 'all', label: '全部' },
		{ key: 'upcoming', label: '即将到来' },
		{ key: 'past', label: '已过去' }
	]

	function getDefaultPagination() {
		return {
			page: 1,
			pageSize: 30,
			total: 0,
			hasMore: true
		}
	}

	export default {
		components: {
			LoveCoupleGuide
		},
		data() {
			return {
				scrollTop: 0,
				navBarHeight: getNavBarHeight(getNavBarMetrics()),
				isLoggedIn: false,
				loading: false,
				refreshPending: false,
				noCouple: false,
				activeFilter: 'all',
				filterTabs: FILTER_TABS,
				anniversaryList: [],
				pagination: getDefaultPagination(),
				dateTypeTextMap: DATE_TYPE_TEXT_MAP,
				repeatTypeTextMap: REPEAT_TYPE_TEXT_MAP
			}
		},
		computed: {
			heroStyle() {
				return {
					minHeight: `${this.navBarHeight + 196}px`
				}
			},
			heroCopyStyle() {
				return {
					paddingTop: `${this.navBarHeight + 34}px`
				}
			},
			heroAnniversary() {
				if (!this.anniversaryList.length) return null
				const upcoming = this.anniversaryList
					.filter((item) => Number(item.countdown_days) >= 0)
					.sort((a, b) => Number(a.countdown_days) - Number(b.countdown_days))
				return upcoming[0] || this.anniversaryList[0]
			},
			heroCoverUrl() {
				const item = this.heroAnniversary
				const custom = item && item.background_type === 'image' && item.background_image && item.background_image.url
					? String(item.background_image.url).trim()
					: ''
				return custom || DEFAULT_ANNIV_HERO
			},
			heroCountdown() {
				return this.getCountdownDisplay(this.heroAnniversary || {})
			},
			heroMetaText() {
				const item = this.heroAnniversary
				if (!item) return ''
				const parts = []
				const d = String(item.next_date || item.display_date_value || item.date_value || '').replace(/-/g, '.')
				if (d) parts.push(d)
				parts.push(DATE_TYPE_TEXT_MAP[item.date_type] || '公历')
				parts.push(REPEAT_TYPE_TEXT_MAP[item.repeat_type] || '每年重复')
				return parts.join(' · ')
			},
			filteredList() {
				if (this.activeFilter === 'upcoming') {
					return this.anniversaryList.filter((item) => !this.isPassedItem(item))
				}
				if (this.activeFilter === 'past') {
					return this.anniversaryList.filter((item) => this.isPassedItem(item))
				}
				return this.anniversaryList
			}
		},
		onLoad() {
			if (!requirePageLogin()) return
		},
		onShow() {
			this.syncLoginState()
			if (this.isLoggedIn) {
				this.loadList(true)
			}
		},
		onPageScroll(e) {
			const next = Math.max(0, Number((e && e.scrollTop) || 0))
			if (next !== this.scrollTop) {
				this.scrollTop = next
			}
		},
		onPullDownRefresh() {
			if (!this.isLoggedIn) {
				uni.stopPullDownRefresh()
				return
			}
			this.loadList(true).finally(() => {
				uni.stopPullDownRefresh()
			})
		},
		onReachBottom() {
			if (!this.isLoggedIn || this.loading || !this.pagination.hasMore) {
				return
			}
			this.loadList(false)
		},
		methods: {
			isPassedItem(item = {}) {
				return item.repeat_type === 'none' && Number(item.countdown_days) < 0
			},
			getDateParts(item = {}) {
				const raw = String(item.next_date || item.date_value || '').trim()
				const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
				if (!m) {
					return { day: '--', monthYear: 'LOVE NOTE' }
				}
				const year = m[1]
				const monthIdx = Math.max(0, Math.min(11, Number(m[2]) - 1))
				const day = m[3]
				return {
					day,
					monthYear: `${MONTH_EN[monthIdx]} ${year}`
				}
			},
			getItemSubtitle(item = {}) {
				const remark = String(item.remark || item.note || '').trim()
				if (remark) return remark
				const parts = []
				const dateTxt = String(item.display_date_value || item.date_value || '').trim()
				if (dateTxt) parts.push(dateTxt)
				if (item.elapsed_text) parts.push(`已走过${item.elapsed_text}`)
				return parts.join(' · ') || '点击编辑详情与封面'
			},
			getCountdownDisplay(item = {}) {
				const raw = item.countdown_days
				if (raw === null || raw === undefined || Number.isNaN(Number(raw))) {
					return { num: '--', unit: '天' }
				}
				const days = Number(raw)
				if (days === 0) {
					return { num: '今天', unit: '纪念日' }
				}
				if (days > 0) {
					return { num: String(days), unit: '天后' }
				}
				return { num: String(Math.abs(days)), unit: '已走过' }
			},
			getCountdownClass(item = {}) {
				if (this.isPassedItem(item)) return 'n-right--muted'
				const days = Number(item.countdown_days ?? 999)
				if (days <= 30) return 'n-right--coral'
				return 'n-right--gold'
			},
			syncLoginState() {
				const currentUser = getCurrentUniIdUser()
				const valid = Boolean(
					currentUser &&
					currentUser.uid &&
					(!currentUser.tokenExpired || currentUser.tokenExpired > Date.now())
				)
				this.isLoggedIn = valid
				if (!valid) {
					clearUniIdTokenStorage()
					this.noCouple = false
					this.anniversaryList = []
					this.pagination = getDefaultPagination()
				}
			},
			async loadList(reset = false) {
				if (this.loading) {
					if (reset) this.refreshPending = true
					return
				}

				const requestPage = reset ? 1 : Number(this.pagination.page || 1)
				const requestPageSize = Number(this.pagination.pageSize || 30)
				this.loading = true

				try {
					if (reset) this.noCouple = false

					const result = await getAnniversaryApi().getList({
						page: requestPage,
						pageSize: requestPageSize
					})

					if (result && result.errCode && result.errCode !== 0) {
						if (result.errCode === 'love-note-no-couple') {
							this.noCouple = true
							this.anniversaryList = []
							this.pagination = { ...getDefaultPagination(), hasMore: false }
							return
						}
						throw new Error(result.errMsg || '获取纪念日列表失败')
					}

					const data = result && result.data ? result.data : {}
					this.noCouple = data.hasCouple === false
					const list = Array.isArray(data.list)
						? data.list.map((item) => normalizeAnniversaryCountdownItem(item))
						: []
					const pageInfo = data.pagination || {}
					const total = Number(pageInfo.total || 0)
					const hasMore = pageInfo.hasMore !== undefined
						? Boolean(pageInfo.hasMore)
						: requestPage * requestPageSize < total

					this.anniversaryList = reset ? list : [...this.anniversaryList, ...list]
					this.pagination = {
						page: requestPage + 1,
						pageSize: requestPageSize,
						total,
						hasMore
					}
				} catch (error) {
					console.error('anniversary list load failed', error)
					uni.showToast({ title: error.message || '加载失败', icon: 'none' })
				} finally {
					this.loading = false
					if (this.refreshPending) {
						this.refreshPending = false
						this.loadList(true)
					}
				}
			},
			goToEdit(item = null) {
				const id = item && item._id ? String(item._id) : ''
				const url = id ? `/pages/anniversary/edit?anniversaryId=${id}` : '/pages/anniversary/edit'
				uni.navigateTo({ url })
			},
			handleCardLongPress(item = {}) {
				const anniversaryId = String(item._id || '').trim()
				if (!anniversaryId) return
				const actionList = ['编辑']
				if (item.is_self === true) {
					actionList.push('删除')
				}
				uni.showActionSheet({
					itemList: actionList,
					success: (res) => {
						const actionText = actionList[res.tapIndex]
						if (actionText === '编辑') {
							this.goToEdit(item)
						} else if (actionText === '删除') {
							this.handleDelete(item)
						}
					}
				})
			},
			handleDelete(item = {}) {
				const anniversaryId = String(item._id || '').trim()
				if (!anniversaryId) return
				uni.showModal({
					title: '删除纪念日',
					content: `确定要删除「${item.title || '该纪念日'}」吗？删除后无法恢复。`,
					confirmColor: '#E2643F',
					success: async (res) => {
						if (!res.confirm) return
						try {
							const result = await getAnniversaryApi().delete({ anniversaryId })
							if (result && result.errCode && result.errCode !== 0) {
								throw new Error(result.errMsg || '删除失败')
							}
							uni.showToast({ title: '已删除', icon: 'success' })
							this.loadList(true)
						} catch (error) {
							uni.showToast({ title: error.message || '删除失败', icon: 'none' })
						}
					}
				})
			},
			goToLoginPage() {
				uni.navigateTo({ url: '/pages/login/index' })
			},
			backToHome() {
				navigateToTab('home')
			}
		}
	}
</script>

<style scoped>
	.anniv-page {
		min-height: 100vh;
		background: #110D0B;
		padding-bottom: calc(164rpx + env(safe-area-inset-bottom));
		overflow-x: hidden;
	}

	.n-add-pill {
		height: 50rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.52);
		background: rgba(26, 21, 18, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.n-add-pill__txt {
		font-size: 21rpx;
		color: #EAD4BC;
		white-space: nowrap;
	}

	/* 顶部全出血 Hero */
	.n-hero {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: #110D0B;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.n-hero__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	.n-hero__shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(17, 13, 11, 0.56) 0%,
			rgba(17, 13, 11, 0.22) 38%,
			rgba(17, 13, 11, 0.72) 72%,
			#110D0B 100%
		);
	}

	.n-hero__copy {
		position: relative;
		z-index: 2;
		padding: 0 36rpx 24rpx;
	}

	.n-dayrow {
		display: flex;
		align-items: baseline;
		gap: 16rpx;
		margin-top: 8rpx;
	}

	.n-dayrow__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 112rpx;
		line-height: 0.94;
		font-weight: 500;
		color: #FBF4EA;
		text-shadow: 0 4rpx 28rpx rgba(0, 0, 0, 0.55);
	}

	.n-dayrow__unit {
		font-size: 24rpx;
		letter-spacing: 3rpx;
		color: rgba(245, 237, 228, 0.68);
	}

	.n-hero__title-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16rpx;
		margin-top: 18rpx;
		padding-top: 16rpx;
		border-top: 1rpx solid rgba(216, 176, 140, 0.30);
	}

	.n-hero__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.n-hero__meta {
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.54);
		text-align: right;
		flex-shrink: 0;
	}

	/* 主体 */
	.n-body {
		padding: 6rpx 32rpx 0;
	}

	.n-filter {
		display: flex;
		align-items: center;
		gap: 14rpx;
		margin-top: 14rpx;
	}

	.n-chip {
		height: 54rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.10);
		background: rgba(255, 255, 255, 0.036);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.n-chip.is-on {
		border-color: rgba(216, 176, 140, 0.58);
		background: rgba(216, 176, 140, 0.16);
	}

	.n-chip__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.64);
	}

	.n-chip.is-on .n-chip__txt {
		color: #FBF4EA;
		font-weight: 500;
	}

	.n-sec {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin: 30rpx 0 10rpx;
	}

	.n-sec__title {
		font-size: 24rpx;
		font-weight: 500;
		letter-spacing: 2rpx;
		color: rgba(245, 237, 228, 0.86);
	}

	.n-sec__cnt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 2rpx;
		color: rgba(245, 237, 228, 0.36);
	}

	.n-loading {
		padding: 72rpx 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16rpx;
	}

	.n-loading__txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	/* 时间线列表行 */
	.n-row {
		display: flex;
		align-items: center;
		gap: 24rpx;
		padding: 26rpx 0;
		border-bottom: 1rpx solid rgba(216, 176, 140, 0.14);
	}

	.n-row--last {
		border-bottom: none;
	}

	.n-date {
		width: 100rpx;
		flex-shrink: 0;
	}

	.n-date__day {
		display: block;
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 48rpx;
		line-height: 1;
		font-weight: 500;
		color: #F0DCC4;
	}

	.n-date__ym {
		display: block;
		margin-top: 8rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 16rpx;
		letter-spacing: 1rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.n-info {
		flex: 1;
		min-width: 0;
	}

	.n-info__head {
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.n-info__title {
		font-size: 28rpx;
		font-weight: 500;
		color: #F5EDE4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.n-info__owner {
		padding: 2rpx 10rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.36);
		font-size: 17rpx;
		color: #D8B08C;
		flex-shrink: 0;
	}

	.n-info__sub {
		display: block;
		margin-top: 8rpx;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.46);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.n-tags {
		display: flex;
		align-items: center;
		gap: 10rpx;
		margin-top: 12rpx;
	}

	.n-right {
		text-align: right;
		flex-shrink: 0;
		min-width: 92rpx;
	}

	.n-right__num {
		display: block;
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 46rpx;
		line-height: 1;
		font-weight: 500;
		color: #E5865C;
	}

	.n-right--gold .n-right__num {
		color: #D8B08C;
	}

	.n-right--muted .n-right__num {
		font-size: 38rpx;
		color: rgba(245, 237, 228, 0.46);
	}

	.n-right__unit {
		display: block;
		margin-top: 6rpx;
		font-size: 19rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.n-note {
		display: block;
		margin-top: 24rpx;
		text-align: center;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.32);
	}

	.ad-view {
		margin-top: 24rpx;
	}

	.n-footer {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		padding: 18rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
		background: linear-gradient(180deg, rgba(17, 13, 11, 0) 0%, rgba(17, 13, 11, 0.94) 30%, #110D0B 100%);
		box-sizing: border-box;
	}
</style>
