<template>
	<view class="love-page album-edit-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<fui-section
				title="编辑相册"
				descr="调整相册名称、描述和封面，记录更有仪式感。"
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

			<love-glass-card
				class="edit-card"
				:margin="['0', '0', '0', '0']"
				:padding="['0', '0']"
				:content-padding="['30rpx', '28rpx', '32rpx', '28rpx']"
				:header-line="false"
			>
				<view class="cover-panel">
					<image class="cover-panel__preview" :src="coverPreviewUrl" mode="aspectFill"></image>
					<view class="cover-panel__body">
						<text class="cover-panel__title">相册封面</text>
						<text class="cover-panel__desc">建议使用清晰图片，视觉效果更好。</text>
						<view class="cover-panel__actions">
							<fui-tag
								text="更换封面"
								background="rgba(255, 236, 229, 0.96)"
								border-color="rgba(236, 117, 88, 0.32)"
								color="#be6f59"
								:radius="999"
								:padding="['12rpx', '24rpx']"
								highlight
								@click="chooseCover"
							></fui-tag>
							<fui-tag
								text="移除封面"
								background="rgba(245, 239, 236, 0.95)"
								border-color="rgba(208, 177, 166, 0.42)"
								color="#9f796c"
								:radius="999"
								:padding="['12rpx', '24rpx']"
								highlight
								@click="clearCover"
							></fui-tag>
						</view>
					</view>
				</view>

				<fui-divider
					width="100%"
					height="44"
					divider-color="rgba(231, 204, 194, 0.66)"
				></fui-divider>

				<view class="love-form-item">
					<text class="love-field-label">相册名称</text>
					<fui-input
						:value="form.title"
						type="text"
						placeholder="请输入相册名称"
						background-color="#fff7f3"
						:border-bottom="false"
						:padding="['26rpx', '24rpx']"
						:radius="24"
						:size="28"
						color="#5a3427"
						maxlength="50"
						@input="onTitleInput"
					></fui-input>
				</view>

				<view class="love-form-item">
					<text class="love-field-label">相册描述</text>
					<fui-textarea
						:value="form.description"
						placeholder="添加相册描述（可选）"
						background-color="#fff7f3"
						:border-top="false"
						:border-bottom="false"
						:radius="24"
						:padding="['22rpx', '24rpx']"
						height="220rpx"
						:size="28"
						color="#5a3427"
						:maxlength="500"
						:is-counter="true"
						counter-color="#b08a7d"
						:counter-size="22"
						@input="onDescriptionInput"
					></fui-textarea>
				</view>

			</love-glass-card>

			<view class="love-action-stack action-stack">
				<fui-button
					text="保存修改"
					background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
					color="#ffffff"
					radius="999rpx"
					height="90rpx"
					:size="28"
					:bold="true"
					:loading="saving"
					@click="handleSave"
				></fui-button>
				<fui-button
					text="取消"
					background="rgba(255, 241, 235, 0.98)"
					color="#b05b48"
					border-color="rgba(214, 145, 122, 0.24)"
					radius="999rpx"
					height="90rpx"
					:size="28"
					:bold="true"
					@click="goBack"
				></fui-button>
			</view>
		</view>
	</view>
</template>

<script>
import { getAlbumApi } from '../../common/api/album.js'
import { uploadFileWithModule } from '../../common/utils/file-upload.js'

const DEFAULT_COVER = 'https://pic.616pic.com/bg_w1180/00/03/95/2AHp5qATBm.jpg!w700wp'

export default {
	data() {
		return {
			albumId: '',
			saving: false,
			defaultCover: DEFAULT_COVER,
			form: {
				title: '',
				description: '',
				coverPreview: '',
				coverFileId: '',
				coverLocalPath: '',
				coverChanged: false
			}
		}
	},
	computed: {
		coverPreviewUrl() {
			return this.form.coverPreview || this.defaultCover
		}
	},
	onLoad(options) {
		const albumId = String(options && options.albumId || '').trim()
		if (!albumId) {
			uni.showToast({
				title: '相册ID不能为空',
				icon: 'none'
			})
			setTimeout(() => {
				uni.navigateBack()
			}, 800)
			return
		}

		this.albumId = albumId
		this.loadAlbumDetail()
	},
	methods: {
		onTitleInput(value) {
			this.form.title = String(value || '')
		},
		onDescriptionInput(value) {
			this.form.description = String(value || '')
		},
		async loadAlbumDetail() {
			uni.showLoading({
				title: '加载中...',
				mask: true
			})
			try {
				const result = await getAlbumApi().getDetail({
					albumId: this.albumId,
					photoPage: 1,
					photoPageSize: 1
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '获取相册详情失败')
				}
				const album = result && result.data ? result.data.album || {} : {}
				const coverImage = album.cover_image && typeof album.cover_image === 'object'
					? album.cover_image
					: {}
				this.form = {
					title: album.title || '',
					description: album.description || '',
					coverPreview: coverImage.url || album.cover_url || '',
					coverFileId: coverImage.file_id || album.cover_file_id || '',
					coverLocalPath: '',
					coverChanged: false
				}
			} catch (error) {
				console.error('加载相册详情失败:', error)
				uni.showToast({
					title: error.message || '加载失败',
					icon: 'none'
				})
			} finally {
				uni.hideLoading()
			}
		},
		chooseCover() {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				sourceType: ['album', 'camera'],
				success: (res) => {
					const filePath = Array.isArray(res.tempFilePaths) && res.tempFilePaths.length
						? res.tempFilePaths[0]
						: ''
					if (!filePath) {
						return
					}
					this.form.coverPreview = filePath
					this.form.coverLocalPath = filePath
					this.form.coverFileId = ''
					this.form.coverChanged = true
				}
			})
		},
		clearCover() {
			this.form.coverPreview = ''
			this.form.coverLocalPath = ''
			this.form.coverFileId = ''
			this.form.coverChanged = true
		},
		async handleSave() {
			if (this.saving) {
				return
			}

			const title = String(this.form.title || '').trim()
			const description = String(this.form.description || '').trim()

			if (!title) {
				uni.showToast({
					title: '请输入相册名称',
					icon: 'none'
				})
				return
			}

			this.saving = true
			uni.showLoading({
				title: '保存中...',
				mask: true
			})

			try {
				const payload = {
					albumId: this.albumId,
					title,
					description
				}

				if (this.form.coverChanged) {
					let coverImage = null
					if (this.form.coverLocalPath) {
						const uploadResult = await uploadFileWithModule({
							filePath: this.form.coverLocalPath,
							module: 'album/covers',
							prefix: 'cover',
							fileType: 'image'
						})
						coverImage = {
							url: uploadResult.fileURL || '',
							fileId: uploadResult.fileID || ''
						}
					} else if (this.form.coverPreview && /^https?:\/\//i.test(this.form.coverPreview)) {
						coverImage = {
							url: this.form.coverPreview,
							fileId: ''
						}
					} else if (this.form.coverFileId) {
						coverImage = {
							url: '',
							fileId: this.form.coverFileId
						}
					} else {
						coverImage = {}
					}
					payload.coverImage = coverImage
				}

				const result = await getAlbumApi().update(payload)
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '保存失败')
				}

				uni.showToast({
					title: '保存成功',
					icon: 'success'
				})
				setTimeout(() => {
					uni.navigateBack()
				}, 350)
			} catch (error) {
				console.error('保存相册失败:', error)
				uni.showToast({
					title: error.message || '保存失败',
					icon: 'none'
				})
			} finally {
				this.saving = false
				uni.hideLoading()
			}
		},
		goBack() {
			if (this.saving) {
				return
			}
			uni.navigateBack()
		}
	}
}
</script>

<style>
.album-edit-page {
	padding: 28rpx 24rpx 52rpx;
}

.edit-card {
	overflow: hidden;
}

.cover-panel {
	display: flex;
	align-items: flex-start;
	gap: 20rpx;
}

.cover-panel__preview {
	flex-shrink: 0;
	width: 168rpx;
	height: 168rpx;
	border-radius: 24rpx;
	background: #f3ece8;
	box-shadow: 0 14rpx 30rpx rgba(192, 120, 92, 0.16);
}

.cover-panel__body {
	flex: 1;
	min-width: 0;
	padding-top: 2rpx;
}

.cover-panel__title {
	display: block;
	font-size: 30rpx;
	font-weight: 700;
	color: #5a3427;
}

.cover-panel__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	line-height: 1.7;
	color: #9b776d;
}

.cover-panel__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 14rpx;
	margin-top: 18rpx;
}

.action-stack {
	padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
}
</style>
