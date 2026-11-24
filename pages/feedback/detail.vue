<template>
	<view class="love-page fd-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<noir-navbar title="反馈详情" :transparent="true" :scroll-top="scrollTop" />

		<view class="love-layer fd-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先登录后查看反馈详情。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<view v-else-if="adminChecked && !isAdmin" class="fd-forbidden">
				<text class="fd-forbidden__title">暂无管理权限</text>
				<text class="fd-forbidden__desc">该页面仅管理员可访问。</text>
			</view>

			<view v-else class="fd-body">
				<view v-if="loading && !detail" class="fd-loading">
					<fui-loading type="rotate" size="40"></fui-loading>
					<text class="fd-loading__txt">加载中...</text>
				</view>

				<view v-else-if="detail" class="fd-detail">
					<view class="fd-status-bar">
						<text class="fd-label">当前状态</text>
						<view class="fd-nav-status" :class="getStatusTagClass(detail.status)">
							<text class="fd-nav-status__txt">{{ detail.status_text || getStatusText(detail.status) }}</text>
						</view>
					</view>

					<view class="fd-grid">
						<view class="fd-cell">
							<text class="fd-cell__label">提交人</text>
							<text class="fd-cell__val">{{ getNickname(detail) }}</text>
						</view>
						<view class="fd-cell">
							<text class="fd-cell__label">分类</text>
							<text class="fd-cell__val">{{ getCategoryText(detail.category) }}</text>
						</view>
						<view class="fd-cell">
							<text class="fd-cell__label">提交时间</text>
							<text class="fd-cell__val fd-cell__val--mono">{{ formatDateTime(detail.create_time) }}</text>
						</view>
						<view class="fd-cell">
							<text class="fd-cell__label">更新时间</text>
							<text class="fd-cell__val fd-cell__val--mono">{{ formatDateTime(detail.update_time) }}</text>
						</view>
					</view>

					<view class="fd-blk">
						<text class="fd-label">反馈内容</text>
						<text class="fd-content">{{ detail.content || '' }}</text>

						<view v-if="imageList.length" class="fd-imgs">
							<image
								v-for="(item, index) in imageList"
								:key="`${detail._id}_${index}`"
								class="fd-img"
								:src="item.url"
								mode="aspectFill"
								@tap="previewImages(index)"
							></image>
						</view>
					</view>

					<view v-if="detail.admin_reply" class="fd-cur">
						<text class="fd-cur__title">当前回复</text>
						<text class="fd-cur__content">{{ detail.admin_reply }}</text>
						<text class="fd-cur__time">
							{{ detail.reply_time ? `回复时间：${formatDateTime(detail.reply_time)}` : '回复时间：暂无记录' }}
						</text>
					</view>

					<view class="fd-reply">
						<text class="fd-label">管理员回复（限 {{ replyMaxLength }} 字）</text>
						<view class="fd-rbox">
							<textarea
								class="fd-textarea"
								:value="replyContent"
								placeholder="请输入回复内容…"
								placeholder-class="fd-textarea__ph"
								:maxlength="replyMaxLength"
								:disable-default-padding="true"
								@input="onNativeReplyInput"
							/>
							<text class="fd-count">{{ replyContent.length }} / {{ replyMaxLength }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<view v-if="detail" class="fd-foot">
			<view class="fd-foot__ghost">
				<noir-button
					text="确认已解决"
					variant="ghost"
					size="lg"
					block
					:loading="actionLoading === 'resolved'"
					@click="handleResolved"
				/>
			</view>
			<view class="fd-foot__primary">
				<noir-button
					text="提交回复"
					variant="primary"
					size="lg"
					block
					:loading="actionLoading === 'reply'"
					@click="handleReply"
				/>
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
				feedbackId: '',
				loggedIn: false,
				isAdmin: false,
				adminChecked: false,
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
		onPageScroll(e) {
			this.scrollTop = Number((e && e.scrollTop) || 0)
		},
		onLoad(options = {}) {
			if (!requirePageLogin()) return
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
			getStatusTagClass(status) {
				const value = Number(status)
				if (value === 2) return 'fd-nav-status--green'
				if (value === 1) return 'fd-nav-status--gold'
				return 'fd-nav-status--coral'
			},
			async restoreLoginState() {
				const userInfo = getCurrentUniIdUser()
				if (!userInfo || !userInfo.uid) {
					this.loggedIn = false
					this.isAdmin = false
					this.adminChecked = false
					this.detail = null
					return
				}

				if (userInfo.tokenExpired && userInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.loggedIn = false
					this.isAdmin = false
					this.adminChecked = false
					this.detail = null
					return
				}

				this.loggedIn = true
				this.adminChecked = false
				await this.fetchDetail()
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
							this.adminChecked = true
							this.detail = null
							return
						}
						throw new Error(result.errMsg || '获取反馈详情失败')
					}

					this.isAdmin = true
					this.adminChecked = true
					const detail = result && result.data ? result.data.detail || null : null
					this.detail = detail
					this.replyContent = detail && detail.admin_reply ? detail.admin_reply : ''
				} catch (error) {
					console.error('fetch feedback detail failed', error)
					this.adminChecked = true
					uni.showToast({
						title: error.message || '获取反馈详情失败',
						icon: 'none'
					})
				} finally {
					this.loading = false
				}
			},
			onNativeReplyInput(e) {
				const value = e && e.detail ? e.detail.value : ''
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
				uni.redirectTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent(`/pages/feedback/detail?feedbackId=${this.feedbackId}`)
				})
			},
			backToProfile() {
				navigateToTab('/pages/profile/index')
			}
		}
	}
</script>

<style scoped>
	.fd-page {
		min-height: 100vh;
		background: var(--noir-bg);
		padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
	}

	.fd-nav-status {
		display: flex;
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid transparent;
	}

	.fd-nav-status--coral {
		background: rgba(226, 100, 63, 0.16);
		border-color: rgba(226, 100, 63, 0.36);
	}

	.fd-nav-status--coral .fd-nav-status__txt {
		color: var(--noir-coral-bright);
	}

	.fd-nav-status--gold {
		background: rgba(216, 176, 140, 0.14);
		border-color: rgba(216, 176, 140, 0.28);
	}

	.fd-nav-status--gold .fd-nav-status__txt {
		color: var(--noir-gold-soft);
	}

	.fd-nav-status--green {
		background: rgba(104, 196, 140, 0.14);
		border-color: rgba(104, 196, 140, 0.3);
	}

	.fd-nav-status--green .fd-nav-status__txt {
		color: #7ED4A2;
	}

	.fd-nav-status__txt {
		font-size: 20rpx;
		font-weight: 500;
	}

	.fd-wrap {
		padding: 12rpx 32rpx 0;
	}

	.fd-status-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18rpx;
	}

	.fd-forbidden {
		padding: 64rpx 36rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
		text-align: center;
	}

	.fd-forbidden__title {
		display: block;
		font-family: "Songti SC", "SimSun", serif;
		font-size: 32rpx;
		color: var(--noir-text-strong);
	}

	.fd-forbidden__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.46);
	}

	.fd-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 96rpx 0;
	}

	.fd-loading__txt {
		margin-top: 16rpx;
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.46);
	}

	.fd-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20rpx;
		padding: 24rpx 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
	}

	.fd-cell__label {
		display: block;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.38);
	}

	.fd-cell__val {
		display: block;
		margin-top: 8rpx;
		font-size: 25rpx;
		font-weight: 500;
		color: var(--noir-text);
		word-break: break-all;
	}

	.fd-cell__val--mono {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 22rpx;
		font-weight: 400;
	}

	.fd-blk {
		margin-top: 30rpx;
	}

	.fd-label {
		display: block;
		font-size: 22rpx;
		letter-spacing: 2rpx;
		color: rgba(216, 176, 140, 0.78);
	}

	.fd-content {
		display: block;
		margin-top: 14rpx;
		font-size: 26rpx;
		line-height: 1.75;
		color: rgba(245, 237, 228, 0.78);
		white-space: pre-wrap;
		word-break: break-all;
	}

	.fd-imgs {
		display: flex;
		flex-wrap: wrap;
		gap: 16rpx;
		margin-top: 20rpx;
	}

	.fd-img {
		width: 148rpx;
		height: 148rpx;
		border-radius: 20rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.1);
		background: #1A1411;
	}

	.fd-cur {
		margin-top: 28rpx;
		padding: 22rpx 26rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.22);
		background: rgba(216, 176, 140, 0.06);
	}

	.fd-cur__title {
		display: block;
		font-size: 22rpx;
		font-weight: 500;
		color: var(--noir-gold);
	}

	.fd-cur__content {
		display: block;
		margin-top: 10rpx;
		font-size: 25rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.78);
		white-space: pre-wrap;
		word-break: break-all;
	}

	.fd-cur__time {
		display: block;
		margin-top: 12rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.4);
	}

	.fd-reply {
		margin-top: 30rpx;
	}

	.fd-rbox {
		position: relative;
		margin-top: 14rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.09);
		background: rgba(255, 255, 255, 0.03);
		padding: 22rpx 24rpx 52rpx;
	}

	.fd-textarea {
		width: 100%;
		height: 180rpx;
		font-size: 26rpx;
		line-height: 1.65;
		color: var(--noir-text-strong);
	}

	.fd-textarea__ph {
		color: rgba(245, 237, 228, 0.34);
		font-size: 26rpx;
	}

	.fd-count {
		position: absolute;
		right: 24rpx;
		bottom: 16rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.34);
	}

	.fd-foot {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 20rpx;
		padding: 20rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
		background: linear-gradient(180deg, rgba(17, 13, 11, 0), rgba(17, 13, 11, 0.94) 24%, var(--noir-bg));
	}

	.fd-foot__ghost {
		width: 244rpx;
		flex-shrink: 0;
	}

	.fd-foot__primary {
		flex: 1;
		min-width: 0;
	}
</style>
