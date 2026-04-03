<template>
	<view class="love-page feedback-list-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<fui-section
				title="反馈列表"
				descr="管理员可查看所有反馈，进入详情后回复并确认问题是否已解决。"
				:is-line="true"
				line-width="10rpx"
				line-color="#ec7558"
				:line-right="22"
				:descr-top="14"
				:size="40"
				descr-size="24"
				color="#5a3427"
				descr-color="#906b61"
				:padding="['0', '0']"
				:margin-top="12"
				:margin-bottom="28"
			></fui-section>

			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先登录后查看反馈列表。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<fui-card
				v-else-if="adminChecked && !isAdmin"
				:margin="['0', '0', '0', '0']"
				background="rgba(255, 250, 247, 0.97)"
				radius="32rpx"
				shadow="0 20rpx 48rpx rgba(192, 120, 92, 0.12)"
				:padding="['0', '0']"
				:header-line="false"
			>
				<view class="feedback-list-page__forbidden">
					<fui-empty
						title="暂无管理权限"
						descr="该页面仅管理员可访问。你可以进入反馈页提交问题或建议。"
						:size="28"
						descr-size="22"
						color="#6e4a3f"
						descr-color="#9a766c"
						:margin-top="8"
					></fui-empty>
					<fui-button
						text="去提交反馈"
						background="rgba(255, 241, 235, 0.98)"
						color="#b05b48"
						border-color="rgba(214, 145, 122, 0.24)"
						radius="999rpx"
						height="86rpx"
						:size="26"
						:bold="true"
						:margin="['12rpx', '0', '0', '0']"
						@click="goFeedbackSubmit"
					></fui-button>
				</view>
			</fui-card>

			<view v-else class="feedback-list-page__body">
				<fui-card
					:margin="['0', '0', '0', '0']"
					background="rgba(255, 250, 247, 0.97)"
					radius="32rpx"
					shadow="0 20rpx 48rpx rgba(192, 120, 92, 0.12)"
					:padding="['0', '0']"
					:header-line="false"
				>
					<view class="feedback-list-page__filter">
						<fui-segmented-control
							:values="statusOptions"
							:current="statusIndex"
							color="#ec7558"
							active-color="#ffffff"
							:height="72"
							:size="24"
							:bold="true"
							:radius="999"
							@click="handleStatusChange"
						></fui-segmented-control>
					</view>

					<fui-divider
						:text="`共 ${pagination.total} 条反馈`"
						width="100%"
						height="52"
						divider-color="rgba(231, 204, 194, 0.7)"
						color="#b36a56"
						:size="22"
					></fui-divider>

					<view v-if="loading && feedbackList.length === 0" class="feedback-list-page__loading">
						<fui-loading type="rotate" size="42"></fui-loading>
						<text class="feedback-list-page__loading-text">加载中...</text>
					</view>

					<view v-else-if="feedbackList.length > 0" class="feedback-list">
						<fui-list-cell
							v-for="(item, index) in feedbackList"
							:key="item._id"
							:padding="['24rpx', '24rpx']"
							background="transparent"
							:border-color="'rgba(231, 204, 194, 0.62)'"
							:bottom-border="index !== feedbackList.length - 1"
							arrow
							arrow-color="#d2a394"
							@click="goDetail(item)"
						>
							<view class="feedback-item">
								<view class="feedback-item__head">
									<text class="feedback-item__name">{{ getNickname(item) }}</text>
									<view class="feedback-item__status" :style="getStatusStyle(item.status)">
										<text class="feedback-item__status-text">{{ item.status_text || getStatusText(item.status) }}</text>
									</view>
								</view>
								<view class="feedback-item__meta">
									<text class="feedback-item__meta-text">{{ getCategoryText(item.category) }}</text>
									<text class="feedback-item__meta-text">{{ formatDateTime(item.create_time) }}</text>
								</view>
								<text class="feedback-item__content">{{ item.content || '' }}</text>
								<view class="feedback-item__extra">
									<text class="feedback-item__extra-text">图片 {{ Number(item.image_count || 0) }} 张</text>
									<text v-if="item.admin_reply" class="feedback-item__extra-text feedback-item__extra-text--reply">
										已回复
									</text>
								</view>
							</view>
						</fui-list-cell>
					</view>

					<view v-else class="feedback-list-page__empty">
						<fui-empty
							title="暂无反馈"
							descr="当前筛选条件下没有反馈记录。"
							:size="28"
							descr-size="22"
							color="#6e4a3f"
							descr-color="#9a766c"
							:margin-top="12"
						></fui-empty>
					</view>
				</fui-card>

				<view v-if="feedbackList.length > 0" class="feedback-list-page__loadmore">
					<text class="feedback-list-page__loadmore-text">
						{{ loadingMore ? '加载更多中...' : (pagination.hasMore ? '上拉加载更多' : '已经到底了') }}
					</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		subscribeAuthChanged
	} from '../../common/auth-center.js'
	import { getFeedbackApi } from '../../common/api/feedback.js'

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
			statusOptions() {
				return STATUS_FILTERS.map((item) => ({
					name: item.name
				}))
			},
			currentStatusFilter() {
				return STATUS_FILTERS[this.statusIndex] || STATUS_FILTERS[0]
			}
		},
		onLoad() {
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
			getStatusStyle(status) {
				const value = Number(status)
				if (value === 2) {
					return {
						background: 'rgba(224, 247, 230, 0.95)',
						color: '#2f8a4b'
					}
				}
				if (value === 1) {
					return {
						background: 'rgba(230, 244, 255, 0.95)',
						color: '#3f75b6'
					}
				}
				return {
					background: 'rgba(255, 241, 235, 0.98)',
					color: '#c4684f'
				}
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
			handleStatusChange(event = {}) {
				const nextIndex = Number(event.index || 0)
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
				uni.navigateTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/feedback/list')
				})
			},
			backToProfile() {
				uni.switchTab({
					url: '/pages/profile/index'
				})
			}
		}
	}
</script>

<style>
	.feedback-list-page {
		padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
	}

	.feedback-list-page__forbidden {
		padding: 34rpx 28rpx 30rpx;
	}

	.feedback-list-page__body {
		padding-top: 2rpx;
	}

	.feedback-list-page__filter {
		padding: 28rpx 24rpx 8rpx;
	}

	.feedback-list-page__loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 56rpx 0 52rpx;
	}

	.feedback-list-page__loading-text {
		margin-top: 16rpx;
		font-size: 24rpx;
		color: #9a766c;
	}

	.feedback-list {
		padding: 6rpx 0;
	}

	.feedback-item {
		width: 100%;
	}

	.feedback-item__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.feedback-item__name {
		flex: 1;
		min-width: 0;
		font-size: 28rpx;
		font-weight: 700;
		color: #5a3427;
		word-break: break-all;
	}

	.feedback-item__status {
		flex-shrink: 0;
		padding: 8rpx 16rpx;
		border-radius: 999rpx;
	}

	.feedback-item__status-text {
		font-size: 20rpx;
		font-weight: 600;
	}

	.feedback-item__meta {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 18rpx;
		margin-top: 10rpx;
	}

	.feedback-item__meta-text {
		font-size: 22rpx;
		color: #947064;
	}

	.feedback-item__content {
		display: block;
		margin-top: 12rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #6e4a3f;
		display: -webkit-box;
		overflow: hidden;
		text-overflow: ellipsis;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		word-break: break-all;
	}

	.feedback-item__extra {
		display: flex;
		align-items: center;
		gap: 16rpx;
		margin-top: 12rpx;
	}

	.feedback-item__extra-text {
		font-size: 22rpx;
		color: #9a766c;
	}

	.feedback-item__extra-text--reply {
		color: #3f75b6;
	}

	.feedback-list-page__empty {
		padding: 26rpx 0 20rpx;
	}

	.feedback-list-page__loadmore {
		padding: 18rpx 0 8rpx;
		text-align: center;
	}

	.feedback-list-page__loadmore-text {
		font-size: 22rpx;
		color: #ab8376;
	}
</style>
