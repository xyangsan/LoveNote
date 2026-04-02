<template>
	<view class="page">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view class="header">
			<text class="header__title">情侣相册</text>
			<text class="header__subtitle">记录我们的美好瞬间</text>
		</view>

		<view class="album-grid">
			<view class="album-card album-card--create" @click="handleCreateAlbum">
				<view class="album-card__create-icon">+</view>
				<text class="album-card__create-text">新建相册</text>
			</view>

			<view
				v-for="album in albumList"
				:key="album._id"
				class="album-card"
				@click="goToAlbumDetail(album._id)"
			>
				<image
					class="album-card__cover"
					:src="album.cover_url || defaultCover"
					mode="aspectFill"
				/>
				<view class="album-card__overlay"></view>
				<view class="album-card__info">
					<text class="album-card__title">{{ album.title }}</text>
					<text class="album-card__count">{{ album.photo_count || 0 }} 个媒体</text>
				</view>
				<view
					v-if="!album.is_default"
					class="album-card__menu"
					@click.stop="showAlbumMenu(album)"
				>
					<text class="album-card__menu-icon">⋮</text>
				</view>
			</view>
		</view>

		<view v-if="loading" class="loading-state">
			<fui-loading type="rotate" size="48"></fui-loading>
			<text class="loading-text">加载中...</text>
		</view>

		<view v-else-if="albumList.length === 0" class="empty-state">
			<image class="empty-icon" src="/static/user-empty.png" mode="aspectFit" />
			<text class="empty-title">还没有相册</text>
			<text class="empty-desc">创建一个相册，开始记录你们的回忆吧</text>
			<button class="empty-action" @click="handleCreateAlbum">创建第一个相册</button>
		</view>

		<view v-else-if="!pagination.hasMore && albumList.length > 0" class="load-more">
			<text class="load-more__text">已经到底了</text>
		</view>

		<fui-actionsheet
			:show="actionSheet.show"
			:item-list="actionSheet.items"
			@cancel="closeActionSheet"
			@click="handleActionSheetClick"
		/>

		<fui-dialog
			:show="createDialog.show"
			title="新建相册"
			:buttons="createDialog.buttons"
			@cancel="closeCreateDialog"
			@click="handleCreateConfirm"
		>
			<view class="dialog-content">
				<input
					class="dialog-input"
					v-model="createDialog.form.title"
					placeholder="请输入相册名称"
					maxlength="50"
				/>
				<textarea
					class="dialog-textarea"
					v-model="createDialog.form.description"
					placeholder="添加相册描述（可选）"
					maxlength="500"
				/>
			</view>
		</fui-dialog>

	</view>
</template>

<script>
import { getAlbumApi } from '../../common/api/album.js'

const DEFAULT_COVER = 'https://pic.616pic.com/bg_w1180/00/03/95/2AHp5qATBm.jpg!w700wp'

export default {
	data() {
		return {
			albumList: [],
			loading: false,
			defaultCover: DEFAULT_COVER,
			pagination: {
				page: 1,
				pageSize: 20,
				total: 0,
				hasMore: true
			},
			actionSheet: {
				show: false,
				items: [
					{ text: '编辑相册', color: '#5a3427' },
					{ text: '删除相册', color: '#e76f51' }
				],
				currentAlbum: null
			},
			createDialog: {
				show: false,
				buttons: [
					{ text: '取消', color: '#8b6659' },
					{ text: '创建', color: '#e76f51' }
				],
				form: {
					title: '',
					description: ''
				}
			}
		}
	},
	onShow() {
		this.loadAlbumList(true)
	},
	onReachBottom() {
		if (this.pagination.hasMore && !this.loading) {
			this.loadAlbumList()
		}
	},
	onPullDownRefresh() {
		this.loadAlbumList(true).finally(() => {
			uni.stopPullDownRefresh()
		})
	},
	methods: {
		async loadAlbumList(reset = false) {
			if (this.loading) return

			this.loading = true

			try {
				if (reset) {
					this.pagination.page = 1
					this.albumList = []
				}

				const result = await getAlbumApi().getList({
					page: this.pagination.page,
					pageSize: this.pagination.pageSize
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '获取相册列表失败')
				}
				const data = result.data || {}
				const list = data.list || []
				const pagination = data.pagination || {}

				if (reset) {
					this.albumList = list
				} else {
					this.albumList = [...this.albumList, ...list]
				}

				this.pagination = {
					page: pagination.page || this.pagination.page,
					pageSize: pagination.pageSize || this.pagination.pageSize,
					total: pagination.total || 0,
					hasMore: pagination.hasMore || false
				}

				if (pagination.hasMore) {
					this.pagination.page++
				}
			} catch (error) {
				console.error('加载相册列表失败:', error)
				uni.showToast({
					title: error.message || '加载失败',
					icon: 'none'
				})
			} finally {
				this.loading = false
			}
		},

		goToAlbumDetail(albumId) {
			uni.navigateTo({
				url: `/pages/album/detail?albumId=${albumId}`
			})
		},

		handleCreateAlbum() {
			this.createDialog.form = {
				title: '',
				description: ''
			}
			this.createDialog.show = true
		},

		closeCreateDialog() {
			this.createDialog.show = false
		},

		async handleCreateConfirm(e) {
			if (e.index === 0) {
				this.closeCreateDialog()
				return
			}

			const title = this.createDialog.form.title.trim()
			if (!title) {
				uni.showToast({
					title: '请输入相册名称',
					icon: 'none'
				})
				return
			}

			uni.showLoading({ title: '创建中...', mask: true })

			try {
				await getAlbumApi().create({
					title,
					description: this.createDialog.form.description.trim()
				})

				uni.showToast({
					title: '创建成功',
					icon: 'success'
				})

				this.closeCreateDialog()
				this.loadAlbumList(true)
			} catch (error) {
				console.error('创建相册失败:', error)
				uni.showToast({
					title: error.message || '创建失败',
					icon: 'none'
				})
			} finally {
				uni.hideLoading()
			}
		},

		showAlbumMenu(album) {
			this.actionSheet.currentAlbum = album
			this.actionSheet.show = true
		},

		closeActionSheet() {
			this.actionSheet.show = false
			this.actionSheet.currentAlbum = null
		},

		handleActionSheetClick(e) {
			const album = this.actionSheet.currentAlbum
			if (!album) return

			if (e.index === 0) {
				this.handleEditAlbum(album)
			} else if (e.index === 1) {
				this.handleDeleteAlbum(album)
			}

			this.closeActionSheet()
		},

		handleEditAlbum(album) {
			uni.navigateTo({
				url: `/pages/album/edit?albumId=${album._id}`
			})
		},

		handleDeleteAlbum(album) {
			uni.showModal({
				title: '确认删除',
				content: `确定要删除相册"${album.title}"吗？相册中的照片也会被删除。`,
				confirmColor: '#e76f51',
				success: async (res) => {
					if (res.confirm) {
						uni.showLoading({ title: '删除中...', mask: true })
						try {
							await getAlbumApi().delete({ albumId: album._id })
							uni.showToast({
								title: '删除成功',
								icon: 'success'
							})
							this.loadAlbumList(true)
						} catch (error) {
							console.error('删除相册失败:', error)
							uni.showToast({
								title: error.message || '删除失败',
								icon: 'none'
							})
						} finally {
							uni.hideLoading()
						}
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
	padding: 32rpx 24rpx 48rpx;
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

.header {
	position: relative;
	z-index: 1;
	margin-bottom: 40rpx;
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
	font-size: 26rpx;
	color: #8b6659;
}

.album-grid {
	position: relative;
	z-index: 1;
	display: flex;
	flex-wrap: wrap;
	margin: 0 -12rpx;
}

.album-card {
	position: relative;
	width: calc(50% - 24rpx);
	height: 280rpx;
	margin: 0 12rpx 24rpx;
	border-radius: 24rpx;
	overflow: hidden;
	background: #fff;
	box-shadow: 0 8rpx 32rpx rgba(173, 109, 77, 0.1);
}

.album-card--create {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.8);
	border: 2rpx dashed rgba(231, 111, 81, 0.4);
}

.album-card__create-icon {
	width: 80rpx;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 48rpx;
	color: #e76f51;
	background: rgba(231, 111, 81, 0.1);
	border-radius: 50%;
	margin-bottom: 16rpx;
}

.album-card__create-text {
	font-size: 28rpx;
	color: #e76f51;
	font-weight: 500;
}

.album-card__cover {
	width: 100%;
	height: 100%;
}

.album-card__overlay {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	height: 120rpx;
	background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.6) 100%);
}

.album-card__info {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 20rpx;
}

.album-card__title {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #fff;
	margin-bottom: 8rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.album-card__count {
	display: block;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.8);
}

.album-card__menu {
	position: absolute;
	top: 12rpx;
	right: 12rpx;
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.3);
	border-radius: 50%;
}

.album-card__menu-icon {
	font-size: 32rpx;
	color: #fff;
}

.loading-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 60rpx 0;
}

.loading-text {
	margin-top: 20rpx;
	font-size: 26rpx;
	color: #8b6659;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 100rpx 40rpx;
}

.empty-icon {
	width: 200rpx;
	height: 200rpx;
	opacity: 0.6;
}

.empty-title {
	margin-top: 32rpx;
	font-size: 32rpx;
	font-weight: 600;
	color: #5a3427;
}

.empty-desc {
	margin-top: 16rpx;
	font-size: 26rpx;
	color: #8b6659;
	text-align: center;
}

.empty-action {
	margin-top: 40rpx;
	width: 320rpx;
	height: 88rpx;
	line-height: 88rpx;
	background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	color: #fff;
	font-size: 30rpx;
	font-weight: 600;
	border-radius: 44rpx;
	border: none;
}

.empty-action::after {
	border: none;
}

.load-more {
	text-align: center;
	padding: 40rpx 0;
}

.load-more__text {
	font-size: 24rpx;
	color: #ad8476;
}

.dialog-content {
	padding: 20rpx 0;
}

.dialog-input {
	height: 80rpx;
	padding: 0 24rpx;
	background: #f8f4f2;
	border-radius: 16rpx;
	font-size: 28rpx;
	color: #5a3427;
	margin-bottom: 20rpx;
}

.dialog-textarea {
	width: auto;
	height: 160rpx;
	padding: 20rpx 24rpx;
	background: #f8f4f2;
	border-radius: 16rpx;
	font-size: 28rpx;
	color: #5a3427;
}
</style>
