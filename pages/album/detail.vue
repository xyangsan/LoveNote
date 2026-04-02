<template>
	<view class="page">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view class="header">
			<view class="header__back" @click="goBack">
				<text class="header__back-icon">←</text>
				<text class="header__back-text">返回</text>
			</view>
			<view class="header__info">
				<text class="header__title">{{ album.title || '相册' }}</text>
				<text class="header__count">{{ pagination.total }} 个媒体</text>
			</view>
			<view class="header__actions">
				<view class="header__action" @click="handleUpload">
					<text class="header__action-icon">+</text>
				</view>
				<view class="header__action" @click="showAlbumMenu">
					<text class="header__action-icon">⋮</text>
				</view>
			</view>
		</view>

		<view v-if="album.description" class="album-desc">
			<text class="album-desc__text">{{ album.description }}</text>
		</view>

		<view class="photo-grid">
			<view
				v-for="photo in photoList"
				:key="photo._id"
				class="photo-item"
				@click="previewPhoto(photo)"
				@longpress="showPhotoMenu(photo)"
			>
				<video
					v-if="isVideo(photo)"
					class="photo-item__video"
					:src="photo.url"
					:poster="photo.thumbnail_url"
					object-fit="cover"
					:controls="false"
					:show-play-btn="true"
					:enable-progress-gesture="false"
				></video>
				<image
					v-else
					class="photo-item__image"
					:src="photo.thumbnail_url || photo.url"
					mode="aspectFill"
					lazy-load
				/>
				<view v-if="isVideo(photo)" class="photo-item__type">
					<text class="photo-item__type-text">视频</text>
				</view>
				<view v-if="photo.is_favorite" class="photo-item__favorite">
					<text class="photo-item__favorite-icon">♥</text>
				</view>
			</view>
		</view>

		<view v-if="loading" class="loading-state">
			<fui-loading type="rotate" size="48"></fui-loading>
			<text class="loading-text">加载中...</text>
		</view>

		<view v-else-if="photoList.length === 0" class="empty-state">
			<image class="empty-icon" src="/static/user-empty.png" mode="aspectFit" />
			<text class="empty-title">相册还是空的</text>
			<text class="empty-desc">点击右上角 + 上传图片或视频，记录美好瞬间</text>
		</view>

		<view v-else-if="!pagination.hasMore && photoList.length > 0" class="load-more">
			<text class="load-more__text">已经到底了</text>
		</view>

		<fui-actionsheet
			:show="photoActionSheet.show"
			:item-list="photoActionSheet.items"
			@cancel="closePhotoActionSheet"
			@click="handlePhotoAction"
		/>

		<fui-actionsheet
			:show="albumActionSheet.show"
			:item-list="albumActionSheet.items"
			@cancel="closeAlbumActionSheet"
			@click="handleAlbumAction"
		/>

	</view>
</template>

<script>
import { getAlbumApi } from '../../common/api/album.js'
import { getPhotoApi } from '../../common/api/photo.js'

export default {
	data() {
		return {
			albumId: '',
			album: {},
			photoList: [],
			loading: false,
			hasInitialized: false,
			needRefreshOnShow: false,
			pagination: {
				page: 1,
				pageSize: 30,
				total: 0,
				hasMore: true
			},
			currentPhoto: null,
			photoActionSheet: {
				show: false,
				items: [],
				actionKeys: []
			},
			albumActionSheet: {
				show: false,
				items: [
					{ text: '编辑相册信息', color: '#5a3427' },
					{ text: '删除相册', color: '#e76f51' }
				]
			}
		}
	},
	onLoad(options) {
		this.albumId = options.albumId || ''
		if (!this.albumId) {
			uni.showToast({
				title: '相册ID不能为空',
				icon: 'none'
			})
			setTimeout(() => {
				uni.navigateBack()
			}, 1500)
			return
		}
		this.loadAlbumDetail(true).finally(() => {
			this.hasInitialized = true
		})
	},
	onShow() {
		if (!this.hasInitialized || !this.needRefreshOnShow) {
			return
		}
		this.needRefreshOnShow = false
		this.loadAlbumDetail(true)
	},
	onReachBottom() {
		if (this.pagination.hasMore && !this.loading) {
			this.loadAlbumDetail()
		}
	},
	onPullDownRefresh() {
		this.loadAlbumDetail(true).finally(() => {
			uni.stopPullDownRefresh()
		})
	},
	methods: {
		async loadAlbumDetail(reset = false) {
			if (this.loading) return

			this.loading = true

			try {
				if (reset) {
					this.pagination.page = 1
					this.photoList = []
				}

				const result = await getAlbumApi().getDetail({
					albumId: this.albumId,
					photoPage: this.pagination.page,
					photoPageSize: this.pagination.pageSize
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '获取相册详情失败')
				}
				const data = result.data || {}

				this.album = data.album || {}

				const photos = data.photos || []
				const pagination = data.pagination || {}

				if (reset) {
					this.photoList = photos
				} else {
					this.photoList = [...this.photoList, ...photos]
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

				uni.setNavigationBarTitle({
					title: this.album.title || '相册详情'
				})
			} catch (error) {
				console.error('加载相册详情失败:', error)
				uni.showToast({
					title: error.message || '加载失败',
					icon: 'none'
				})
			} finally {
				this.loading = false
			}
		},

		goBack() {
			uni.navigateBack()
		},

		handleUpload() {
			this.needRefreshOnShow = true
			uni.navigateTo({
				url: `/pages/album/upload?albumId=${this.albumId}`
			})
		},

		previewPhoto(photo) {
			this.currentPhoto = photo
			if (this.isVideo(photo)) {
				this.previewVideo(photo)
				return
			}
			const imageList = this.photoList.filter(item => !this.isVideo(item))
			const urls = imageList.map(item => item.url).filter(Boolean)
			const currentIndex = imageList.findIndex(item => item._id === photo._id)
			if (!urls.length) {
				uni.showToast({
					title: '暂无可预览图片',
					icon: 'none'
				})
				return
			}

			uni.previewImage({
				urls,
				current: currentIndex,
				longPressActions: {
					itemList: ['收藏', '保存图片', '删除'],
					success: (data) => {
						this.handleLongPressAction(data.tapIndex, photo)
					}
				}
			})
		},

		handleLongPressAction(index, photo) {
			switch (index) {
				case 0:
					this.toggleFavorite(photo)
					break
				case 1:
					this.saveMedia(photo)
					break
				case 2:
					this.confirmDeletePhoto(photo)
					break
			}
		},

		isVideo(photo) {
			return String(photo && photo.media_type || '').toLowerCase() === 'video'
		},

		previewVideo(photo) {
			if (!photo || !photo.url) {
				uni.showToast({
					title: '视频地址无效',
					icon: 'none'
				})
				return
			}

			if (typeof uni.previewMedia === 'function') {
				uni.previewMedia({
					sources: [
						{
							url: photo.url,
							type: 'video'
						}
					],
					current: 0
				})
				return
			}

			uni.showToast({
				title: '当前环境暂不支持视频预览',
				icon: 'none'
			})
		},

		showPhotoMenu(photo) {
			this.currentPhoto = photo
			const isFavorite = photo.is_favorite
			const isVideo = this.isVideo(photo)
			const items = []
			const actionKeys = []

			items.push({ text: isVideo ? '播放视频' : '查看原图', color: '#5a3427' })
			actionKeys.push('preview')
			items.push({ text: isFavorite ? '取消收藏' : '收藏', color: '#e76f51' })
			actionKeys.push('favorite')
			items.push({ text: isVideo ? '保存视频' : '保存图片', color: '#5a3427' })
			actionKeys.push('save')
			items.push({ text: '移动到相册', color: '#5a3427' })
			actionKeys.push('move')
			items.push({ text: '删除', color: '#999' })
			actionKeys.push('delete')

			this.photoActionSheet.items = items
			this.photoActionSheet.actionKeys = actionKeys
			this.photoActionSheet.show = true
		},

		closePhotoActionSheet() {
			this.photoActionSheet.show = false
		},

		handlePhotoAction(e) {
			const photo = this.currentPhoto
			if (!photo) return
			const actionKey = this.photoActionSheet.actionKeys[e.index]

			switch (actionKey) {
				case 'preview':
					this.previewSinglePhoto(photo)
					break
				case 'favorite':
					this.toggleFavorite(photo)
					break
				case 'save':
					this.saveMedia(photo)
					break
				case 'move':
					this.movePhotoToAlbum(photo)
					break
				case 'delete':
					this.confirmDeletePhoto(photo)
					break
			}

			this.closePhotoActionSheet()
		},

		previewSinglePhoto(photo) {
			if (this.isVideo(photo)) {
				this.previewVideo(photo)
				return
			}

			uni.previewImage({
				urls: [photo.url],
				current: 0
			})
		},

		async toggleFavorite(photo) {
			try {
				await getPhotoApi().toggleFavorite({ photoId: photo._id })
				photo.is_favorite = !photo.is_favorite
				uni.showToast({
					title: photo.is_favorite ? '已收藏' : '已取消收藏',
					icon: 'none'
				})
			} catch (error) {
				console.error('收藏操作失败:', error)
				uni.showToast({
					title: error.message || '操作失败',
					icon: 'none'
				})
			}
		},

		movePhotoToAlbum(photo) {
			uni.showToast({
				title: '功能开发中',
				icon: 'none'
			})
		},

		confirmDeletePhoto(photo) {
			uni.showModal({
				title: '确认删除',
				content: '确定要删除这张照片吗？',
				confirmColor: '#e76f51',
				success: async (res) => {
					if (res.confirm) {
						uni.showLoading({ title: '删除中...', mask: true })
						try {
							await getPhotoApi().delete({ photoId: photo._id })
							this.photoList = this.photoList.filter(p => p._id !== photo._id)
							this.pagination.total--
							uni.showToast({
								title: '删除成功',
								icon: 'success'
							})
						} catch (error) {
							console.error('删除照片失败:', error)
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
		},

		async saveMedia(photo) {
			try {
				uni.showLoading({ title: '保存中...' })
				const res = await uni.downloadFile({ url: photo.url })
				if (this.isVideo(photo)) {
					if (typeof uni.saveVideoToPhotosAlbum !== 'function') {
						throw new Error('当前环境不支持保存视频')
					}
					await uni.saveVideoToPhotosAlbum({
						filePath: res.tempFilePath
					})
				} else {
					await uni.saveImageToPhotosAlbum({
						filePath: res.tempFilePath
					})
				}
				uni.showToast({
					title: '保存成功',
					icon: 'success'
				})
			} catch (error) {
				console.error('保存媒体失败:', error)
				uni.showToast({
					title: '保存失败',
					icon: 'none'
				})
			} finally {
				uni.hideLoading()
			}
		},

		showAlbumMenu() {
			this.albumActionSheet.show = true
		},

		closeAlbumActionSheet() {
			this.albumActionSheet.show = false
		},

		handleAlbumAction(e) {
			switch (e.index) {
				case 0:
					this.editAlbum()
					break
				case 1:
					this.confirmDeleteAlbum()
					break
			}
			this.closeAlbumActionSheet()
		},

		editAlbum() {
			this.needRefreshOnShow = true
			uni.navigateTo({
				url: `/pages/album/edit?albumId=${this.albumId}`
			})
		},

		confirmDeleteAlbum() {
			uni.showModal({
				title: '确认删除',
				content: `确定要删除相册"${this.album.title}"吗？相册中的所有照片也会被删除。`,
				confirmColor: '#e76f51',
				success: async (res) => {
					if (res.confirm) {
						uni.showLoading({ title: '删除中...', mask: true })
						try {
							await getAlbumApi().delete({ albumId: this.albumId })
							uni.showToast({
								title: '删除成功',
								icon: 'success'
							})
							setTimeout(() => {
								uni.navigateBack()
							}, 1500)
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
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 24rpx;
}

.header__back {
	display: flex;
	align-items: center;
	padding: 16rpx 0;
}

.header__back-icon {
	font-size: 36rpx;
	color: #5a3427;
	margin-right: 8rpx;
}

.header__back-text {
	font-size: 28rpx;
	color: #5a3427;
}

.header__info {
	flex: 1;
	text-align: center;
}

.header__title {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
	color: #5a3427;
}

.header__count {
	display: block;
	font-size: 24rpx;
	color: #8b6659;
	margin-top: 4rpx;
}

.header__actions {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.header__action {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(231, 111, 81, 0.1);
	border-radius: 50%;
}

.header__action-icon {
	font-size: 32rpx;
	color: #e76f51;
	font-weight: 600;
}

.album-desc {
	position: relative;
	z-index: 1;
	margin-bottom: 24rpx;
	padding: 20rpx 24rpx;
	background: rgba(255, 255, 255, 0.8);
	border-radius: 16rpx;
}

.album-desc__text {
	font-size: 26rpx;
	color: #6d473a;
	line-height: 1.6;
}

.photo-grid {
	position: relative;
	z-index: 1;
	display: flex;
	flex-wrap: wrap;
	margin: 0 -8rpx;
}

.photo-item {
	position: relative;
	width: calc(33.333% - 16rpx);
	height: 220rpx;
	margin: 0 8rpx 16rpx;
	border-radius: 16rpx;
	overflow: hidden;
	background: #f0f0f0;
}

.photo-item__image {
	width: 100%;
	height: 100%;
}

.photo-item__video {
	width: 100%;
	height: 100%;
}

.photo-item__type {
	position: absolute;
	top: 8rpx;
	left: 8rpx;
	padding: 4rpx 10rpx;
	border-radius: 12rpx;
	background: rgba(0, 0, 0, 0.58);
}

.photo-item__type-text {
	font-size: 20rpx;
	color: #fff;
}

.photo-item__favorite {
	position: absolute;
	top: 8rpx;
	right: 8rpx;
	width: 40rpx;
	height: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(231, 111, 81, 0.9);
	border-radius: 50%;
}

.photo-item__favorite-icon {
	font-size: 20rpx;
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

.load-more {
	text-align: center;
	padding: 40rpx 0;
}

.load-more__text {
	font-size: 24rpx;
	color: #ad8476;
}
</style>
