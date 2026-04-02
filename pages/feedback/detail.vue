<template>
	<view class="love-page feedback-detail-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<fui-section
				title="反馈详情"
				descr="管理员可回复反馈，并确认问题是否已解决。"
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
				desc="请先登录后查看反馈详情。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<fui-card
				v-else-if="!isAdmin"
				:margin="['0', '0', '0', '0']"
				background="rgba(255, 250, 247, 0.97)"
				radius="32rpx"
				shadow="0 20rpx 48rpx rgba(192, 120, 92, 0.12)"
				:padding="['0', '0']"
				:header-line="false"
			>
				<view class="feedback-detail-page__forbidden">
					<fui-empty
						title="暂无管理权限"
						descr="该页面仅管理员可访问。"
						:size="28"
						descr-size="22"
						color="#6e4a3f"
						descr-color="#9a766c"
						:margin-top="8"
					></fui-empty>
				</view>
			</fui-card>

			<view v-else class="feedback-detail-page__body">
				<fui-card
					:margin="['0', '0', '0', '0']"
					background="rgba(255, 250, 247, 0.97)"
					radius="32rpx"
					shadow="0 20rpx 48rpx rgba(192, 120, 92, 0.12)"
					:padding="['0', '0']"
					:header-line="false"
				>
					<view v-if="loading && !detail" class="feedback-detail-page__loading">
						<fui-loading type="rotate" size="42"></fui-loading>
						<text class="feedback-detail-page__loading-text">加载中...</text>
					</view>

					<view v-else-if="detail" class="feedback-detail">
						<view class="feedback-detail__head">
							<view class="feedback-detail__status" :style="getStatusStyle(detail.status)">
								<text class="feedback-detail__status-text">{{ detail.status_text || getStatusText(detail.status) }}</text>
							</view>
						</view>

						<view class="feedback-detail__meta-grid">
							<view class="feedback-detail__meta-item">
								<text class="feedback-detail__meta-label">提交人</text>
								<text class="feedback-detail__meta-value">{{ getNickname(detail) }}</text>
							</view>
							<view class="feedback-detail__meta-item">
								<text class="feedback-detail__meta-label">分类</text>
								<text class="feedback-detail__meta-value">{{ getCategoryText(detail.category) }}</text>
							</view>
							<view class="feedback-detail__meta-item">
								<text class="feedback-detail__meta-label">提交时间</text>
								<text class="feedback-detail__meta-value">{{ formatDateTime(detail.create_time) }}</text>
							</view>
							<view class="feedback-detail__meta-item">
								<text class="feedback-detail__meta-label">更新时间</text>
								<text class="feedback-detail__meta-value">{{ formatDateTime(detail.update_time) }}</text>
							</view>
						</view>

						<view class="feedback-detail__content-wrap">
							<text class="feedback-detail__content-label">反馈内容</text>
							<text class="feedback-detail__content">{{ detail.content || '' }}</text>
						</view>

						<view v-if="imageList.length" class="feedback-detail__images">
							<text class="feedback-detail__content-label">反馈截图</text>
							<view class="feedback-detail__image-grid">
								<image
									v-for="(item, index) in imageList"
									:key="`${detail._id}_${index}`"
									class="feedback-detail__image"
									:src="item.url"
									mode="aspectFill"
									@click="previewImages(index)"
								></image>
							</view>
						</view>

						<fui-divider
							width="100%"
							height="50"
							divider-color="rgba(231, 204, 194, 0.68)"
						></fui-divider>

						<view class="feedback-detail__reply-section">
							<text class="feedback-detail__content-label">管理员回复</text>
							<fui-textarea
								:value="replyContent"
								placeholder="请输入回复内容"
								background-color="#fff7f3"
								:border-top="false"
								:border-bottom="false"
								:radius="24"
								:padding="['22rpx', '24rpx']"
								height="240rpx"
								:size="28"
								color="#5a3427"
								:maxlength="replyMaxLength"
								:is-counter="true"
								counter-color="#b08a7d"
								:counter-size="22"
								@input="onReplyInput"
							></fui-textarea>

							<view v-if="detail.admin_reply" class="feedback-detail__reply-history">
								<text class="feedback-detail__reply-history-label">当前回复</text>
								<text class="feedback-detail__reply-history-content">{{ detail.admin_reply }}</text>
								<text class="feedback-detail__reply-history-time">
									{{ detail.reply_time ? `回复时间：${formatDateTime(detail.reply_time)}` : '回复时间：暂无记录' }}
								</text>
							</view>
						</view>
					</view>
				</fui-card>

				<view v-if="detail" class="feedback-detail-page__actions">
					<fui-button
						text="提交回复"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						:loading="actionLoading === 'reply'"
						@click="handleReply"
					></fui-button>
					<fui-button
						text="确认已解决"
						background="rgba(227, 245, 233, 0.96)"
						color="#2f8a4b"
						border-color="rgba(114, 189, 138, 0.38)"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						:loading="actionLoading === 'resolved'"
						@click="handleResolved"
					></fui-button>
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
	import { getUserApi } from '../../common/api/user.js'

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
				feedbackId: '',
				loggedIn: false,
				isAdmin: false,
				loading: false,
				actionLoading: '',
				detail: null,
				replyContent: '',
				replyMaxLength: 2000,
				removeAuthListener: null
			}
		},
		computed: {
			isLoggedIn() {
				return this.loggedIn
			},
			imageList() {
				const list = this.detail && Array.isArray(this.detail.image_list) ? this.detail.image_list : []
				return list.filter((item) => item && item.url)
			}
		},
		onLoad(options = {}) {
			this.feedbackId = String(options.feedbackId || '').trim()
			this.removeAuthListener = subscribeAuthChanged(() => {
				this.restoreLoginState()
			})
		},
		onShow() {
			this.restoreLoginState()
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
			async restoreLoginState() {
				const userInfo = getCurrentUniIdUser()
				if (!userInfo || !userInfo.uid) {
					this.loggedIn = false
					this.isAdmin = false
					this.detail = null
					return
				}

				if (userInfo.tokenExpired && userInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.loggedIn = false
					this.isAdmin = false
					this.detail = null
					return
				}

				this.loggedIn = true
				await this.fetchRoleAndDetail()
			},
			async fetchRoleAndDetail() {
				try {
					const result = await getUserApi().getMine()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取用户信息失败')
					}
					const roleList = Array.isArray(result && result.userInfo && result.userInfo.role)
						? result.userInfo.role
						: []
					this.isAdmin = roleList.some((item) => String(item || '').trim().toLowerCase() === 'admin')
					if (!this.isAdmin) {
						this.detail = null
						return
					}

					await this.fetchDetail()
				} catch (error) {
					console.warn('feedback detail fetchRoleAndDetail failed', error)
					this.isAdmin = false
					this.detail = null
					uni.showToast({
						title: error.message || '获取用户信息失败',
						icon: 'none'
					})
				}
			},
			async fetchDetail() {
				if (!this.feedbackId) {
					uni.showToast({
						title: '反馈ID不能为空',
						icon: 'none'
					})
					return
				}
				this.loading = true
				try {
					const result = await getFeedbackApi().getDetail({
						feedbackId: this.feedbackId
					})
					if (result && result.errCode && result.errCode !== 0) {
						if (result.errCode === 'love-note-no-permission') {
							this.isAdmin = false
							this.detail = null
							return
						}
						throw new Error(result.errMsg || '获取反馈详情失败')
					}

					const detail = result && result.data ? result.data.detail || null : null
					this.detail = detail
					this.replyContent = detail && detail.admin_reply ? detail.admin_reply : ''
				} catch (error) {
					console.error('fetch feedback detail failed', error)
					uni.showToast({
						title: error.message || '获取反馈详情失败',
						icon: 'none'
					})
				} finally {
					this.loading = false
				}
			},
			onReplyInput(value) {
				this.replyContent = String(value || '').slice(0, this.replyMaxLength)
			},
			async handleReply() {
				if (!this.detail || this.actionLoading) {
					return
				}
				const replyContent = String(this.replyContent || '').trim()
				if (!replyContent) {
					uni.showToast({
						title: '请填写回复内容',
						icon: 'none'
					})
					return
				}

				this.actionLoading = 'reply'
				try {
					const result = await getFeedbackApi().reply({
						feedbackId: this.feedbackId,
						replyContent,
						status: Number(this.detail.status) === 2 ? 2 : 1
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '提交回复失败')
					}

					uni.showToast({
						title: '回复成功',
						icon: 'success'
					})
					await this.fetchDetail()
				} catch (error) {
					console.error('reply feedback failed', error)
					uni.showToast({
						title: error.message || '提交回复失败',
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
				}
			},
			async handleResolved() {
				if (!this.detail || this.actionLoading) {
					return
				}
				if (Number(this.detail.status) === 2) {
					uni.showToast({
						title: '该反馈已是已解决状态',
						icon: 'none'
					})
					return
				}

				this.actionLoading = 'resolved'
				try {
					const result = await getFeedbackApi().updateStatus({
						feedbackId: this.feedbackId,
						status: 2
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '更新状态失败')
					}

					uni.showToast({
						title: '已确认解决',
						icon: 'success'
					})
					await this.fetchDetail()
				} catch (error) {
					console.error('resolve feedback failed', error)
					uni.showToast({
						title: error.message || '更新状态失败',
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
				}
			},
			previewImages(current = 0) {
				const urls = this.imageList.map((item) => item.url).filter(Boolean)
				if (!urls.length) {
					return
				}
				uni.previewImage({
					urls,
					current: Math.max(0, Math.min(current, urls.length - 1))
				})
			},
			goToLoginPage() {
				uni.navigateTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent(`/pages/feedback/detail?feedbackId=${this.feedbackId}`)
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
	.feedback-detail-page {
		padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
	}

	.feedback-detail-page__forbidden {
		padding: 34rpx 28rpx 30rpx;
	}

	.feedback-detail-page__body {
		padding-top: 2rpx;
	}

	.feedback-detail-page__loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 56rpx 0 52rpx;
	}

	.feedback-detail-page__loading-text {
		margin-top: 16rpx;
		font-size: 24rpx;
		color: #9a766c;
	}

	.feedback-detail {
		padding: 30rpx 28rpx 32rpx;
	}

	.feedback-detail__head {
		display: flex;
		justify-content: flex-end;
	}

	.feedback-detail__status {
		padding: 8rpx 18rpx;
		border-radius: 999rpx;
	}

	.feedback-detail__status-text {
		font-size: 22rpx;
		font-weight: 600;
	}

	.feedback-detail__meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16rpx;
		margin-top: 20rpx;
	}

	.feedback-detail__meta-item {
		padding: 18rpx 16rpx;
		border-radius: 20rpx;
		background: rgba(255, 247, 243, 0.9);
	}

	.feedback-detail__meta-label {
		display: block;
		font-size: 22rpx;
		color: #a57d71;
	}

	.feedback-detail__meta-value {
		display: block;
		margin-top: 8rpx;
		font-size: 24rpx;
		color: #5a3427;
		line-height: 1.6;
		word-break: break-all;
	}

	.feedback-detail__content-wrap {
		margin-top: 22rpx;
	}

	.feedback-detail__content-label {
		display: block;
		font-size: 25rpx;
		font-weight: 600;
		color: #5a3427;
	}

	.feedback-detail__content {
		display: block;
		margin-top: 12rpx;
		font-size: 24rpx;
		line-height: 1.8;
		color: #6e4a3f;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.feedback-detail__images {
		margin-top: 22rpx;
	}

	.feedback-detail__image-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
		margin-top: 12rpx;
	}

	.feedback-detail__image {
		width: calc((100% - 24rpx) / 3);
		height: 196rpx;
		border-radius: 16rpx;
		background: #f3ece8;
	}

	.feedback-detail__reply-section {
		margin-top: 16rpx;
	}

	.feedback-detail__reply-history {
		margin-top: 16rpx;
		padding: 18rpx 16rpx;
		border-radius: 20rpx;
		background: rgba(232, 244, 255, 0.86);
	}

	.feedback-detail__reply-history-label {
		display: block;
		font-size: 22rpx;
		color: #4e6e95;
	}

	.feedback-detail__reply-history-content {
		display: block;
		margin-top: 8rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #34587f;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.feedback-detail__reply-history-time {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		color: #6f89a8;
	}

	.feedback-detail-page__actions {
		display: flex;
		flex-direction: column;
		gap: 18rpx;
		margin-top: 28rpx;
	}
</style>
