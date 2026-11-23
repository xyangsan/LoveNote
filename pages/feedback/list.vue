<template>
	<view class="love-page fl-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<noir-navbar title="反馈列表" :transparent="true" :scroll-top="scrollTop">
		</noir-navbar>

		<view class="love-layer fl-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先登录后查看反馈列表。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<view v-else-if="adminChecked && !isAdmin" class="fl-forbidden-card">
				<text class="fl-forbidden__title">暂无管理权限</text>
				<text class="fl-forbidden__desc">该页面仅管理员可访问。你可以进入反馈页提交问题或建议。</text>
				<view class="fl-forbidden__btn">
					<noir-button
						text="去提交反馈"
						variant="ghost"
						size="md"
						block
						@click="goFeedbackSubmit"
					/>
				</view>
			</view>

			<view v-else class="fl-body">
				<view class="fl-seg">
					<view
						v-for="(item, index) in statusFilters"
						:key="item.name"
						class="fl-seg__item"
						:class="{ 'fl-seg__item--on': statusIndex === index }"
						@tap="selectStatus(index)"
					>
						<text class="fl-seg__txt">{{ item.name }}</text>
					</view>
				</view>

				<text class="fl-div">共 {{ pagination.total }} 条反馈（按提交时间倒序）</text>

				<view v-if="loading && feedbackList.length === 0" class="fl-loading">
					<fui-loading type="rotate" size="40"></fui-loading>
					<text class="fl-loading__txt">加载中...</text>
				</view>

				<view v-else-if="feedbackList.length > 0" class="fl-list">
					<view
						v-for="item in feedbackList"
						:key="item._id"
						class="fl-card"
						@tap="goDetail(item)"
					>
						<view class="fl-chead">
							<text class="fl-name">{{ getNickname(item) }}</text>
							<view class="fl-status" :class="getStatusTagClass(item.status)">
								<text class="fl-status__txt">{{ item.status_text || getStatusText(item.status) }}</text>
							</view>
						</view>

						<view class="fl-meta">
							<text class="fl-meta__txt">{{ getCategoryText(item.category) }}</text>
							<text class="fl-meta__time">{{ formatDateTime(item.create_time) }}</text>
						</view>

						<text class="fl-content">{{ item.content || '' }}</text>

						<view class="fl-cfoot">
							<view class="fl-cfoot__left">
								<text class="fl-cfoot__txt">图片 {{ Number(item.image_count || 0) }} 张</text>
								<text v-if="item.admin_reply" class="fl-cfoot__dot">·</text>
								<text v-if="item.admin_reply" class="fl-cfoot__reply">已回复</text>
							</view>
							<fui-icon name="arrowright" :size="26" color="rgba(216, 176, 140, 0.56)"></fui-icon>
						</view>
					</view>
				</view>

				<view v-else class="fl-empty-card">
					<text class="fl-empty__title">暂无反馈</text>
					<text class="fl-empty__desc">当前筛选条件下没有反馈记录。</text>
				</view>

				<view v-if="feedbackList.length > 0" class="fl-loadmore">
					<text class="fl-loadmore__txt">
						{{ loadingMore ? '加载更多中...' : (pagination.hasMore ? '上拉加载更多' : '已经到底了') }}
					</text>
				</view>

				<text class="fl-note">仅 admin 角色可访问 · 非管理员展示「暂无管理权限」提示卡</text>
			</view>
		</view>
	</view>
</template>

<script>
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import {
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		subscribeAuthChanged
	} from '../../common/auth-center.js'
	import { getFeedbackApi } from '../../common/api/feedback.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const STATUS_FILTERS = [{
		name: '全部',
		value: null
	}, {
		name: '待处理',
		value: 0
	}, {
		name: '已回复',
		value: 1
	}, {
		name: '已解决',
		value: 2
	}]

	const STATUS_TEXT_MAP = {
		0: '待处理',
		1: '已回复',
		2: '已解决'
	}

	const CATEGORY_TEXT_MAP = {
		bug: '功能异常',
		feature: '功能建议',
		experience: '体验问题',
		other: '其他'
	}

	function formatDateTime(timestamp) {
		if (!timestamp) {
			return '暂无记录'
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
				scrollTop: 0,
				loggedIn: false,
				isAdmin: false,
				adminChecked: false,
				loading: false,
				loadingMore: false,
				statusIndex: 0,
				feedbackList: [],
				pagination: {
					page: 1,
					pageSize: 10,
					total: 0,
					hasMore: true
				},
				removeAuthListener: null
			}
		},
		computed: {
			isLoggedIn() {
				return this.loggedIn
			},
			statusFilters() {
				return STATUS_FILTERS
			},
			currentStatusFilter() {
				return STATUS_FILTERS[this.statusIndex] || STATUS_FILTERS[0]
			}
		},
		onPageScroll(e) {
			this.scrollTop = Number((e && e.scrollTop) || 0)
		},
		onLoad() {
			if (!requirePageLogin()) return
			this.removeAuthListener = subscribeAuthChanged(() => {
				this.restoreLoginState()
			})
		},
		onShow() {
			this.restoreLoginState()
		},
		onPullDownRefresh() {
			if (!this.isLoggedIn || !this.isAdmin) {
				uni.stopPullDownRefresh()
				return
			}
			this.loadFeedbackList(true).finally(() => {
				uni.stopPullDownRefresh()
			})
		},
		onReachBottom() {
			if (!this.isLoggedIn || !this.isAdmin) {
				return
			}
			if (this.loading || this.loadingMore || !this.pagination.hasMore) {
				return
			}
			this.loadFeedbackList(false)
		},
		onUnload() {
			if (this.removeAuthListener) {
				this.removeAuthListener()
				this.removeAuthListener = null
			}
		},
		methods: {
			formatDateTime,
			getStatusText(status) {
				return STATUS_TEXT_MAP[Number(status)] || STATUS_TEXT_MAP[0]
			},
			getCategoryText(category = '') {
				return CATEGORY_TEXT_MAP[String(category || '').trim()] || CATEGORY_TEXT_MAP.other
			},
			getNickname(item = {}) {
				const userSnapshot = item.user_snapshot && typeof item.user_snapshot === 'object'
					? item.user_snapshot
					: {}
				return String(userSnapshot.nickname || '').trim() || '微信用户'
			},
			getStatusTagClass(status) {
				const value = Number(status)
				if (value === 2) return 'fl-status--green'
				if (value === 1) return 'fl-status--gold'
				return 'fl-status--coral'
			},
			resetListState() {
				this.feedbackList = []
				this.pagination = {
					page: 1,
					pageSize: 10,
					total: 0,
					hasMore: true
				}
			},
			async restoreLoginState() {
				const userInfo = getCurrentUniIdUser()
				if (!userInfo || !userInfo.uid) {
					this.loggedIn = false
					this.isAdmin = false
					this.adminChecked = false
					this.resetListState()
					return
				}

				if (userInfo.tokenExpired && userInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.loggedIn = false
					this.isAdmin = false
					this.adminChecked = false
					this.resetListState()
					return
				}

				this.loggedIn = true
				this.adminChecked = false
				await this.loadFeedbackList(true)
			},
			async loadFeedbackList(reset = false) {
				if (this.loading || this.loadingMore) {
					return
				}

				if (reset) {
					this.loading = true
					this.resetListState()
				} else {
					this.loadingMore = true
				}

				try {
					const payload = {
						page: this.pagination.page,
						pageSize: this.pagination.pageSize
					}
					if (this.currentStatusFilter.value !== null) {
						payload.status = this.currentStatusFilter.value
					}

					const result = await getFeedbackApi().getList(payload)
					if (result && result.errCode && result.errCode !== 0) {
						if (result.errCode === 'love-note-no-permission') {
							this.isAdmin = false
							this.adminChecked = true
							this.resetListState()
							return
						}
						throw new Error(result.errMsg || '获取反馈列表失败')
					}

					this.isAdmin = true
					this.adminChecked = true
					const data = result && result.data ? result.data : {}
					const list = Array.isArray(data.list) ? data.list : []
					const pageInfo = data.pagination || {}

					this.feedbackList = reset ? list : this.feedbackList.concat(list)
					this.pagination.total = Number(pageInfo.total || 0)
					this.pagination.hasMore = Boolean(pageInfo.hasMore)
					this.pagination.page = this.pagination.hasMore
						? Number(pageInfo.page || this.pagination.page) + 1
						: Number(pageInfo.page || this.pagination.page)
				} catch (error) {
					console.error('loadFeedbackList failed', error)
					this.adminChecked = true
					uni.showToast({
						title: error.message || '获取反馈列表失败',
						icon: 'none'
					})
				} finally {
					this.loading = false
					this.loadingMore = false
				}
			},
			selectStatus(index) {
				const nextIndex = Number(index || 0)
				if (nextIndex === this.statusIndex) return
				this.statusIndex = Number.isNaN(nextIndex) ? 0 : nextIndex
				if (!this.isAdmin) {
					return
				}
				this.loadFeedbackList(true)
			},
			goDetail(item = {}) {
				const feedbackId = String(item._id || '').trim()
				if (!feedbackId) {
					return
				}
				uni.navigateTo({
					url: `/pages/feedback/detail?feedbackId=${feedbackId}`
				})
			},
			goFeedbackSubmit() {
				uni.navigateTo({
					url: '/pages/feedback/index'
				})
			},
			goToLoginPage() {
				uni.redirectTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/feedback/list')
				})
			},
			backToProfile() {
				navigateToTab('/pages/profile/index')
			}
		}
	}
</script>

<style scoped>
	.fl-page {
		min-height: 100vh;
		background: #110D0B;
		padding-bottom: calc(64rpx + env(safe-area-inset-bottom));
	}

	.fl-nav-tag {
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(226, 100, 63, 0.36);
		background: rgba(226, 100, 63, 0.14);
	}

	.fl-nav-tag__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 2rpx;
		color: #F09A6B;
		font-weight: 500;
	}

	.fl-wrap {
		padding: 12rpx 32rpx 0;
	}

	.fl-body {
		padding-top: 2rpx;
	}

	.fl-seg {
		display: flex;
		align-items: center;
		padding: 6rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}

	.fl-seg__item {
		flex: 1;
		height: 64rpx;
		border-radius: 999rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
	}

	.fl-seg__item--on {
		background: linear-gradient(135deg, rgba(240, 154, 107, 0.24), rgba(222, 95, 60, 0.28));
		box-shadow: inset 0 0 0 1rpx rgba(226, 100, 63, 0.44);
	}

	.fl-seg__txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.fl-seg__item--on .fl-seg__txt {
		color: #FBF4EA;
		font-weight: 500;
	}

	.fl-div {
		display: block;
		margin: 24rpx 0 20rpx;
		text-align: center;
		font-size: 21rpx;
		letter-spacing: 1rpx;
		color: rgba(216, 176, 140, 0.68);
	}

	.fl-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 96rpx 0;
	}

	.fl-loading__txt {
		margin-top: 16rpx;
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.46);
	}

	.fl-list {
		display: flex;
		flex-direction: column;
		gap: 18rpx;
	}

	.fl-card {
		padding: 24rpx 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
	}

	.fl-chead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.fl-name {
		flex: 1;
		min-width: 0;
		font-size: 29rpx;
		font-weight: 500;
		color: #F5EDE4;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fl-status {
		flex-shrink: 0;
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		display: flex;
		border: 1rpx solid transparent;
	}

	.fl-status--coral {
		background: rgba(226, 100, 63, 0.16);
		border-color: rgba(226, 100, 63, 0.34);
	}

	.fl-status--coral .fl-status__txt {
		color: #F09A6B;
	}

	.fl-status--gold {
		background: rgba(216, 176, 140, 0.14);
		border-color: rgba(216, 176, 140, 0.28);
	}

	.fl-status--gold .fl-status__txt {
		color: #EAD4BC;
	}

	.fl-status--green {
		background: rgba(104, 196, 140, 0.14);
		border-color: rgba(104, 196, 140, 0.3);
	}

	.fl-status--green .fl-status__txt {
		color: #7ED4A2;
	}

	.fl-status__txt {
		font-size: 20rpx;
		font-weight: 500;
	}

	.fl-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 10rpx;
	}

	.fl-meta__txt {
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.fl-meta__time {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.38);
	}

	.fl-content {
		display: -webkit-box;
		margin-top: 14rpx;
		font-size: 25rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.68);
		overflow: hidden;
		text-overflow: ellipsis;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		word-break: break-all;
	}

	.fl-cfoot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 16rpx;
		padding-top: 14rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.fl-cfoot__left {
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	.fl-cfoot__txt,
	.fl-cfoot__dot {
		font-size: 21rpx;
		color: rgba(216, 176, 140, 0.62);
	}

	.fl-cfoot__reply {
		font-size: 21rpx;
		color: #EAD4BC;
	}

	.fl-empty-card,
	.fl-forbidden-card {
		padding: 64rpx 36rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
		text-align: center;
	}

	.fl-empty__title,
	.fl-forbidden__title {
		display: block;
		font-family: "Songti SC", "SimSun", serif;
		font-size: 32rpx;
		color: #FBF4EA;
	}

	.fl-empty__desc,
	.fl-forbidden__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.46);
	}

	.fl-forbidden__btn {
		margin-top: 32rpx;
	}

	.fl-loadmore {
		padding: 26rpx 0 6rpx;
		text-align: center;
	}

	.fl-loadmore__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.4);
	}

	.fl-note {
		display: block;
		margin-top: 22rpx;
		text-align: center;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.3);
	}
</style>
