<template>
	<view class="page">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view class="header">
			<view>
				<text class="header__title">双人日常</text>
				<text class="header__subtitle">定格我们在一起的平凡与美好。</text>
			</view>
		</view>

		<view v-if="loading && postList.length === 0" class="loading-state">
			<fui-loading type="rotate" size="48"></fui-loading>
			<text class="loading-text">加载中...</text>
		</view>

		<view v-else-if="postList.length === 0" class="empty-state">
			<image class="empty-icon" src="/static/user-empty.png" mode="aspectFit" />
			<text class="empty-title">{{ noCouple ? '还未绑定情侣关系' : '还没有双人日常' }}</text>
			<text class="empty-desc">{{ noCouple ? '请先进入情侣信息页面完成绑定，再发布双人日常。' : '发一条图文或视频，记录今天的心情吧。' }}</text>
		</view>

		<view v-else class="post-list">
			<view v-for="post in postList" :key="post._id" class="post-card">
				<view class="post-card__top">
					<view class="post-author">
						<fui-avatar
							:src="post.author_snapshot && post.author_snapshot.avatar_url"
							error-src="/static/user-empty.png"
							width="72"
							height="72"
							background="#fff1eb"
						></fui-avatar>
						<view class="post-author__body">
							<text class="post-author__name">{{ post.author_snapshot && post.author_snapshot.nickname || '恋人' }}</text>
							<text class="post-author__time">{{ formatTime(post.create_time) }}</text>
						</view>
					</view>
					<view class="post-card__actions">
						<text v-if="post.is_self" class="post-card__delete" @click.stop="handleDelete(post)">删除</text>
					</view>
				</view>

				<text v-if="post.content" class="post-card__content" selectable>{{ post.content }}</text>

				<view v-if="isVideoPost(post)" class="post-media-video">
					<video
						class="post-media-video__player"
						:src="post.media_list[0].url"
						:poster="post.media_list[0].thumbnail_url"
						object-fit="cover"
						:controls="true"
						:show-play-btn="true"
					></video>
				</view>

				<view v-else-if="isImagePost(post)" class="post-media-grid">
					<image
						v-for="(media, index) in post.media_list"
						:key="`${post._id}_${index}`"
						class="post-media-grid__item"
						:src="media.thumbnail_url || media.url"
						mode="aspectFill"
						@click="previewImages(post, index)"
					/>
				</view>

				<view class="post-card__footer">
				</view>
			</view>
		</view>

		<view v-if="!loading && postList.length > 0 && !pagination.hasMore" class="load-more">
			<text class="load-more__text">已经到底了</text>
		</view>

		<view class="publish-fab" @click="noCouple ? goCouplePage() : goPublish()">
			<text class="publish-fab__icon">+</text>
			<text class="publish-fab__text">{{ noCouple ? '去绑定' : '发布' }}</text>
		</view>
	</view>
</template>

<script>
import { getDailyApi } from '../../common/api/daily.js'

function formatDateTime(timestamp) {
	if (!timestamp) {
		return ''
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
			loading: false,
			noCouple: false,
			postList: [],
			pagination: {
				page: 1,
				pageSize: 10,
				total: 0,
				hasMore: true
			}
		}
	},
	onShow() {
		this.loadPostList(true)
	},
	onPullDownRefresh() {
		this.loadPostList(true).finally(() => {
			uni.stopPullDownRefresh()
		})
	},
	onReachBottom() {
		if (this.loading || !this.pagination.hasMore) {
			return
		}
		this.loadPostList(false)
	},
	methods: {
		formatTime(value) {
			return formatDateTime(value) || '刚刚'
		},
		isVideoPost(post = {}) {
			return String(post.media_type || '').toLowerCase() === 'video'
				&& Array.isArray(post.media_list)
				&& post.media_list.length > 0
		},
		isImagePost(post = {}) {
			return String(post.media_type || '').toLowerCase() === 'image'
				&& Array.isArray(post.media_list)
				&& post.media_list.length > 0
		},
		previewImages(post = {}, current = 0) {
			const mediaList = Array.isArray(post.media_list) ? post.media_list : []
			const urls = mediaList
				.filter(item => String(item.media_type || '').toLowerCase() === 'image')
				.map(item => item.url)
				.filter(Boolean)

			if (!urls.length) {
				return
			}

			uni.previewImage({
				urls,
				current: Math.max(0, Math.min(current, urls.length - 1))
			})
		},
		async loadPostList(reset = false) {
			if (this.loading) {
				return
			}

			this.loading = true
			try {
				if (reset) {
					this.pagination.page = 1
					this.postList = []
					this.noCouple = false
				}

				const result = await getDailyApi().getList({
					page: this.pagination.page,
					pageSize: this.pagination.pageSize
				})

				if (result && result.errCode && result.errCode !== 0) {
					if (result.errCode === 'love-note-no-couple') {
						this.noCouple = true
						this.postList = []
						this.pagination.hasMore = false
						return
					}
					throw new Error(result.errMsg || '加载双人日常失败')
				}

				const data = result.data || {}
				const list = Array.isArray(data.list) ? data.list : []
				const pageInfo = data.pagination || {}

				this.noCouple = false
				if (reset) {
					this.postList = list
				} else {
					this.postList = [...this.postList, ...list]
				}

				this.pagination = {
					page: Number(pageInfo.page || this.pagination.page),
					pageSize: Number(pageInfo.pageSize || this.pagination.pageSize),
					total: Number(pageInfo.total || 0),
					hasMore: Boolean(pageInfo.hasMore)
				}

				if (this.pagination.hasMore) {
					this.pagination.page += 1
				}
			} catch (error) {
				console.error('loadPostList failed', error)
				uni.showToast({
					title: error.message || '加载失败',
					icon: 'none'
				})
			} finally {
				this.loading = false
			}
		},
		goPublish() {
			uni.navigateTo({
				url: '/pages/feed/publish'
			})
		},
		goCouplePage() {
			uni.navigateTo({
				url: '/pages/couple/index'
			})
		},
		handleDelete(post = {}) {
			const postId = String(post._id || '').trim()
			if (!postId) {
				return
			}

			uni.showModal({
				title: '删除动态',
				content: '确定删除这条日常吗？删除后无法恢复。',
				confirmColor: '#e76f51',
				success: async (res) => {
					if (!res.confirm) {
						return
					}

					uni.showLoading({
						title: '删除中...',
						mask: true
					})
					try {
						const result = await getDailyApi().delete({
							postId
						})
						if (result && result.errCode && result.errCode !== 0) {
							throw new Error(result.errMsg || '删除失败')
						}

						uni.showToast({
							title: '删除成功',
							icon: 'success'
						})
						this.loadPostList(true)
					} catch (error) {
						console.error('delete daily post failed', error)
						uni.showToast({
							title: error.message || '删除失败',
							icon: 'none'
						})
					} finally {
						uni.hideLoading()
					}
				}
			})
		}
	}
}
</script>

<style>
.page {
	position: relative;
	min-height: 100vh;
	padding: 32rpx 24rpx 170rpx;
	background: linear-gradient(180deg, #FFF7F1 0%, #FFF0E8 100%);
	overflow: hidden;
}

.page__glow {
	position: absolute;
	width: 320rpx;
	height: 320rpx;
	border-radius: 50%;
	filter: blur(24rpx);
	opacity: 0.4;
	z-index: 0;
}

.page__glow--left {
	top: -80rpx;
	left: -120rpx;
	background: rgba(255, 170, 153, 0.55);
}

.page__glow--right {
	top: 240rpx;
	right: -120rpx;
	background: rgba(255, 220, 174, 0.55);
}

.header,
.loading-state,
.empty-state,
.post-list,
.load-more {
	position: relative;
	z-index: 1;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 28rpx;
}

.header__title {
	display: block;
	font-size: 48rpx;
	font-weight: 700;
	color: #5a3427;
}

.header__subtitle {
	display: block;
	margin-top: 12rpx;
	font-size: 24rpx;
	color: #8b6659;
}

.loading-state,
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 80rpx 40rpx;
}

.loading-text {
	margin-top: 18rpx;
	font-size: 24rpx;
	color: #8b6659;
}

.empty-icon {
	width: 200rpx;
	height: 200rpx;
	opacity: 0.65;
}

.empty-title {
	margin-top: 24rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: #5a3427;
}

.empty-desc {
	margin-top: 14rpx;
	font-size: 24rpx;
	color: #8b6659;
	line-height: 1.7;
	text-align: center;
}

.post-card {
	margin-bottom: 20rpx;
	padding: 24rpx;
	border-radius: 24rpx;
	background: rgba(255, 255, 255, 0.92);
	box-shadow: 0 12rpx 30rpx rgba(177, 114, 83, 0.09);
}

.post-card__top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
}

.post-author {
	flex: 1;
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 14rpx;
}

.post-author__body {
	flex: 1;
	min-width: 0;
}

.post-author__name {
	display: block;
	font-size: 28rpx;
	font-weight: 700;
	color: #5d372b;
}

.post-author__time {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #9b786d;
}

.post-card__actions {
	display: flex;
	align-items: center;
	gap: 14rpx;
}

.post-card__type {
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background: rgba(255, 241, 235, 0.96);
	font-size: 20rpx;
	color: #b05b48;
}

.post-card__delete {
	font-size: 22rpx;
	color: #c46e56;
}

.post-card__content {
	display: block;
	margin-top: 18rpx;
	font-size: 28rpx;
	line-height: 1.8;
	color: #6d473a;
	white-space: pre-wrap;
}

.post-media-video {
	margin-top: 18rpx;
}

.post-media-video__player {
	width: 100%;
	height: 420rpx;
	border-radius: 18rpx;
	background: #000;
}

.post-media-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 10rpx;
	margin-top: 18rpx;
}

.post-media-grid__item {
	width: calc((100% - 20rpx) / 3);
	height: 220rpx;
	border-radius: 14rpx;
	background: #f3ece8;
}

.post-card__footer {
	margin-top: 16rpx;
}

.post-card__meta {
	font-size: 22rpx;
	color: #9b786d;
}

.load-more {
	padding: 20rpx 0 8rpx;
	text-align: center;
}

.load-more__text {
	font-size: 22rpx;
	color: #ad8476;
}

.publish-fab {
	position: fixed;
	left: 50%;
	transform: translateX(-50%);
	bottom: calc(34rpx + env(safe-area-inset-bottom));
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 14rpx 24rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	box-shadow: 0 12rpx 28rpx rgba(231, 111, 81, 0.34);
	z-index: 99;
}

.publish-fab__icon {
	font-size: 28rpx;
	line-height: 1;
	color: #fff;
	font-weight: 700;
}

.publish-fab__text {
	font-size: 24rpx;
	color: #fff;
	font-weight: 600;
}
</style>
