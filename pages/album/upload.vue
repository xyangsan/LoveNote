<template>
	<view class="up-page">
		<view class="up-glow up-glow--l"></view>
		<view class="up-glow up-glow--r"></view>

		<noir-navbar
			title="上传照片 / 视频"
			:show-back="true"
			:custom-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
			@back="goBack"
		>
			<template #right>
				<view v-if="selectedCount > 0" class="up-count-pill">
					<text class="up-count-pill__txt">已选 {{ selectedCount }} 项</text>
				</view>
			</template>
		</noir-navbar>

		<view class="up-wrap">
			<!-- 媒体选择九宫格卡片 -->
			<noir-card padding="24rpx">
				<love-media-uploader
					ref="mediaUploader"
					:file-types="['image', 'video']"
					:max-file-size="maxFileSize"
					:compressed="compressed"
					:enable-compression="enableCompression"
					:compress-over-size="imageCompressOverSize"
					:enable-thumbnail="true"
					:thumbnail-options="thumbnailOptions"
					:save-path="savePath"
					upload-prefix="photo"
					:max-count="maxCount"
					:show-tips="true"
					:tip-text="uploaderTipText"
					:item-width="202"
					:item-height="202"
					:previewable="true"
					object-fit="aspectFill"
					:source-type="sourceType"
					:show-delete-button="true"
					add-text="继续选择"
					upload-icon="＋"
					@change="onUploaderChange"
					@progress="onUploaderProgress"
				>
					<template #tip>
						<text class="up-grid-tip">{{ uploaderTipText }}</text>
					</template>
					<template #upload-icon>
						<text class="up-add-plus">＋</text>
					</template>
				</love-media-uploader>
			</noir-card>

			<!-- 标签选择区（用于照片单流筛选） -->
			<view class="up-sec">
				<view class="up-sec__head">
					<text class="up-sec__lbl">添加标签（用于单流筛选）</text>
					<text class="up-sec__cnt">{{ selectedTags.length }} / 5</text>
				</view>
				<view class="up-chips">
					<view
						v-for="tag in allTagOptions"
						:key="tag"
						class="up-chip"
						:class="{ 'is-on': selectedTags.includes(tag) }"
						@tap="toggleTag(tag)"
					>
						<text class="up-chip__txt">{{ tag }}</text>
					</view>
					<view class="up-chip up-chip--custom" @tap="toggleCustomInput">
						<text class="up-chip__txt">{{ showCustomTag ? '收起' : '＋ 自定义' }}</text>
					</view>
				</view>

				<view v-if="showCustomTag" class="up-custom-row">
					<input
						class="up-custom-input"
						v-model="customTagDraft"
						placeholder="输入自定义标签（如：青岛、周末）"
						placeholder-style="color: rgba(245, 237, 228, 0.34);"
						maxlength="16"
						confirm-type="done"
						@confirm="confirmCustomTag"
					/>
					<view class="up-custom-btn" @tap="confirmCustomTag">
						<text class="up-custom-btn__txt">添加</text>
					</view>
				</view>
			</view>

			<!-- 拍摄地点 / 拍摄日期 / 说明文案卡片 -->
			<view class="up-sec">
				<noir-card padding="4rpx 26rpx">
					<!-- 拍摄地点（通过定位服务选择） -->
					<view class="up-loc-wrap">
						<view class="up-row" :class="{ 'up-row--no-border': Boolean(locationAddress) }" @tap="handleChooseLocation">
							<text class="up-row__lbl">拍摄地点</text>
							<view class="up-row__val-wrap">
								<fui-icon name="location" :size="28" color="#D8B08C"></fui-icon>
								<text class="up-row__val" :class="{ 'is-placeholder': !locationName }">
									{{ locationName || '点击定位选择地点' }}
								</text>
								<text v-if="locationName" class="up-row__clear" @tap.stop="clearLocation">✕</text>
								<text v-else class="up-row__chev">›</text>
							</view>
						</view>
						<text v-if="locationAddress" class="up-loc-addr">{{ locationAddress }}</text>
					</view>

					<!-- 拍摄日期 -->
					<picker mode="date" :value="takenDate" :end="todayStr" @change="onDateChange">
						<view class="up-row">
							<text class="up-row__lbl">拍摄日期</text>
							<view class="up-row__val-wrap">
								<text class="up-row__val up-row__val--mono">{{ takenDate }}</text>
								<text class="up-row__chev">›</text>
							</view>
						</view>
					</picker>

					<!-- 说明文案 -->
					<view class="up-desc-row">
						<view class="up-desc-row__head">
							<text class="up-row__lbl">说明文案</text>
							<text class="up-desc-row__cnt">{{ commonDescription.length }} / 500</text>
						</view>
						<textarea
							class="up-textarea"
							v-model="commonDescription"
							placeholder="写下这一刻的故事、心情或小确幸（可选）…"
							placeholder-style="color: rgba(245, 237, 228, 0.30);"
							maxlength="500"
						/>
					</view>
				</noir-card>
			</view>

			<text class="up-tip">
				支持批量上传图片与短视频，上传后自动同步双人空间；每张 +5 心动点（每日限 10 张）。
			</text>

			<!-- 广告位保留 -->
			<view class="ad-view">
				<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
			</view>
		</view>

		<!-- 底部固定主操作栏 -->
		<view class="up-footer">
			<noir-button
				:text="uploadButtonText"
				variant="primary"
				size="lg"
				block
				:disabled="!canUpload || uploading"
				:loading="uploading"
				@click="handleUpload"
			/>
		</view>
	</view>
</template>

<script>
	import { getAlbumApi } from '../../common/api/album.js'
	import { getPhotoApi } from '../../common/api/photo.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const MAX_COUNT = 20
	const MAX_FILE_SIZE = 20 * 1024 * 1024
	const ALBUM_IMAGE_COMPRESS_OVER_SIZE = 2 * 1024 * 1024
	const PRESET_TAGS = ['旅行', '美食', '日常', '纪念日', '约会', '风景']

	function getTodayYmd() {
		const d = new Date()
		const y = d.getFullYear()
		const m = `${d.getMonth() + 1}`.padStart(2, '0')
		const day = `${d.getDate()}`.padStart(2, '0')
		return `${y}-${m}-${day}`
	}

	export default {
		data() {
			const today = getTodayYmd()
			return {
				scrollTop: 0,
				albumId: '',
				albumList: [],
				selectedAlbumIndex: 0,
				selectedCount: 0,
				maxCount: MAX_COUNT,
				maxFileSize: MAX_FILE_SIZE,
				savePath: 'album/media',
				compressed: true,
				enableCompression: true,
				imageCompressOverSize: ALBUM_IMAGE_COMPRESS_OVER_SIZE,
				sourceType: ['album', 'camera'],
				presetTags: [...PRESET_TAGS],
				customTags: [],
				selectedTags: [],
				showCustomTag: false,
				customTagDraft: '',
				location: null,
				todayStr: today,
				takenDate: today,
				commonDescription: '',
				uploading: false,
				uploadProgress: 0,
				thumbnailOptions: {
					imageSavePath: 'album/thumbnails/images',
					videoSavePath: 'album/thumbnails/videos',
					imagePrefix: 'thumb',
					videoPrefix: 'poster',
					imageQuality: 50,
					image: true,
					video: true
				}
			}
		},
		computed: {
			selectedAlbum() {
				return this.albumList[this.selectedAlbumIndex] || null
			},
			allTagOptions() {
				return [...this.presetTags, ...this.customTags]
			},
			locationName() {
				if (!this.location) return ''
				return String(this.location.name || this.location.address || '').trim()
			},
			locationAddress() {
				if (!this.location) return ''
				const addr = String(this.location.address || '').trim()
				const name = String(this.location.name || '').trim()
				return addr && addr !== name ? addr : ''
			},
			canUpload() {
				return this.selectedCount > 0 && Boolean(this.selectedAlbum) && !this.uploading
			},
			uploaderTipText() {
				return `支持图片与短视频，单次最多 ${this.maxCount} 项，单个 ≤ ${Math.floor(this.maxFileSize / 1024 / 1024)}MB`
			},
			estimatedPoints() {
				return Math.min(10, this.selectedCount) * 5
			},
			uploadButtonText() {
				if (this.uploading) {
					return `正在上传 ${this.uploadProgress} / ${this.selectedCount || 0}…`
				}
				if (this.selectedCount <= 0) {
					return '请先选择照片或视频'
				}
				return `开始上传 ${this.selectedCount} 项 (+${this.estimatedPoints}点)`
			}
		},
		onLoad(options = {}) {
			if (!requirePageLogin()) return
			this.albumId = String(options.albumId || '').trim()
			this.loadAlbumList()
		},
		onPageScroll(e) {
			const next = Math.max(0, Number((e && e.scrollTop) || 0))
			if (next !== this.scrollTop) {
				this.scrollTop = next
			}
		},
		methods: {
			async loadAlbumList() {
				try {
					const result = await getAlbumApi().getList({ page: 1, pageSize: 50 })
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取默认空间失败')
					}
					const data = result.data || {}
					this.albumList = Array.isArray(data.list) ? data.list : []

					if (this.albumId) {
						const idx = this.albumList.findIndex((a) => a._id === this.albumId)
						this.selectedAlbumIndex = idx >= 0 ? idx : 0
					} else {
						const defaultIdx = this.albumList.findIndex((a) => a && a.is_default)
						this.selectedAlbumIndex = defaultIdx >= 0 ? defaultIdx : 0
					}
				} catch (error) {
					console.error('loadAlbumList failed:', error)
					uni.showToast({ title: error.message || '初始化失败', icon: 'none' })
				}
			},
			onUploaderChange(files = []) {
				this.selectedCount = Array.isArray(files) ? files.length : 0
			},
			onUploaderProgress(payload = {}) {
				this.uploadProgress = Number(payload.current || 0)
			},
			toggleTag(tag) {
				if (this.selectedTags.includes(tag)) {
					this.selectedTags = this.selectedTags.filter((t) => t !== tag)
					return
				}
				if (this.selectedTags.length >= 5) {
					uni.showToast({ title: '最多选择 5 个标签', icon: 'none' })
					return
				}
				this.selectedTags = [...this.selectedTags, tag]
			},
			toggleCustomInput() {
				this.showCustomTag = !this.showCustomTag
				if (!this.showCustomTag) {
					this.customTagDraft = ''
				}
			},
			confirmCustomTag() {
				const tag = String(this.customTagDraft || '').trim()
				if (!tag) return
				if (!this.allTagOptions.includes(tag)) {
					this.customTags = [...this.customTags, tag]
				}
				if (!this.selectedTags.includes(tag)) {
					if (this.selectedTags.length >= 5) {
						uni.showToast({ title: '最多选择 5 个标签', icon: 'none' })
						return
					}
					this.selectedTags = [...this.selectedTags, tag]
				}
				this.customTagDraft = ''
				this.showCustomTag = false
			},
			async ensureLocationPermission() {
				if (typeof uni.getSetting !== 'function') {
					return true
				}
				const settingRes = await new Promise((resolve) => {
					uni.getSetting({
						success: (res) => resolve(res || {}),
						fail: () => resolve({})
					})
				})
				const authSetting = settingRes.authSetting || {}
				if (authSetting['scope.userLocation'] === true) {
					return true
				}
				if (authSetting['scope.userLocation'] === false) {
					const modalRes = await new Promise((resolve) => {
						uni.showModal({
							title: '需要定位权限',
							content: '请开启位置权限以通过定位服务选择拍摄地点',
							confirmText: '去设置',
							confirmColor: '#E2643F',
							success: (res) => resolve(res || {}),
							fail: () => resolve({})
						})
					})
					if (!modalRes.confirm || typeof uni.openSetting !== 'function') {
						return false
					}
					const openRes = await new Promise((resolve) => {
						uni.openSetting({
							success: (res) => resolve(res || {}),
							fail: () => resolve({})
						})
					})
					return Boolean(openRes.authSetting && openRes.authSetting['scope.userLocation'])
				}
				if (typeof uni.authorize === 'function') {
					const ok = await new Promise((resolve) => {
						uni.authorize({
							scope: 'scope.userLocation',
							success: () => resolve(true),
							fail: () => resolve(false)
						})
					})
					return ok
				}
				return true
			},
			async handleChooseLocation() {
				if (this.uploading) return
				if (typeof uni.chooseLocation !== 'function') {
					uni.showToast({ title: '当前环境不支持定位选点', icon: 'none' })
					return
				}
				const granted = await this.ensureLocationPermission()
				if (!granted) {
					uni.showToast({ title: '未开启定位权限', icon: 'none' })
					return
				}
				try {
					const selected = await new Promise((resolve, reject) => {
						uni.chooseLocation({
							success: (res) => resolve(res || {}),
							fail: (err) => reject(err)
						})
					})
					const name = String(selected.name || selected.address || '').trim()
					if (!name && (selected.latitude === undefined || selected.longitude === undefined)) {
						return
					}
					this.location = {
						name: name || '已选定位地点',
						address: String(selected.address || '').trim(),
						latitude: Number.isNaN(Number(selected.latitude)) ? null : Number(selected.latitude),
						longitude: Number.isNaN(Number(selected.longitude)) ? null : Number(selected.longitude)
					}
				} catch (err) {
					const msg = String((err && (err.errMsg || err.message)) || '')
					if (msg.includes('cancel')) return
					uni.showToast({ title: '定位选点失败，请重试', icon: 'none' })
				}
			},
			clearLocation() {
				this.location = null
			},
			onDateChange(e) {
				const val = String((e && e.detail && e.detail.value) || '').trim()
				if (val) {
					this.takenDate = val
				}
			},
			async handleUpload() {
				if (!this.canUpload) return

				const uploader = this.$refs.mediaUploader
				if (!uploader || typeof uploader.uploadAll !== 'function') {
					uni.showToast({ title: '上传组件未就绪', icon: 'none' })
					return
				}

				this.uploading = true
				this.uploadProgress = 0

				try {
					const uploadedFiles = await uploader.uploadAll({
						savePath: this.savePath,
						prefix: 'photo'
					})
					if (!uploadedFiles.length) {
						throw new Error('没有媒体上传成功')
					}

					const takenTimestamp = this.takenDate ? new Date(`${this.takenDate}T12:00:00`).getTime() : Date.now()
					const photos = uploadedFiles.map((file) => {
						const doc = {
							url: file.url,
							fileId: file.fileId,
							thumbnailUrl: file.thumbnailUrl || (file.mediaType === 'image' ? file.url : ''),
							thumbnailFileId: file.thumbnailFileId || '',
							description: String(this.commonDescription || '').trim(),
							tags: [...this.selectedTags],
							takenDate: Number.isNaN(takenTimestamp) ? Date.now() : takenTimestamp,
							fileSize: file.fileSize || 0,
							mimeType: file.mimeType || '',
							mediaType: file.mediaType,
							duration: file.duration || 0,
							width: file.width || 0,
							height: file.height || 0
						}
						if (this.location) {
							doc.location = this.location
						}
						return doc
					})

					const res = await getPhotoApi().upload({
						albumId: this.selectedAlbum._id,
						photos
					})
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '保存照片失败')
					}

					uni.showToast({
						title: `已上传 ${photos.length} 项`,
						icon: 'success'
					})

					if (typeof uploader.clear === 'function') {
						uploader.clear()
					}
					this.selectedCount = 0
					this.uploadProgress = 0

					setTimeout(() => {
						uni.navigateBack()
					}, 900)
				} catch (error) {
					console.error('upload failed:', error)
					uni.showToast({
						title: error.message || '上传失败',
						icon: 'none'
					})
				} finally {
					this.uploading = false
				}
			},
			goBack() {
				if (this.uploading) {
					uni.showModal({
						title: '确认返回',
						content: '媒体正在上传中，确定要离开吗？',
						confirmColor: '#E2643F',
						success: (res) => {
							if (res.confirm) uni.navigateBack()
						}
					})
					return
				}
				uni.navigateBack()
			}
		}
	}
</script>

<style scoped>
	.up-page {
		position: relative;
		min-height: 100vh;
		background:
			radial-gradient(88% 36% at 50% 0%, rgba(226, 124, 78, 0.10) 0%, rgba(17, 13, 11, 0) 68%),
			#110D0B;
		padding-bottom: calc(168rpx + env(safe-area-inset-bottom));
		overflow-x: hidden;
	}

	.up-glow {
		position: fixed;
		width: 360rpx;
		height: 360rpx;
		border-radius: 50%;
		filter: blur(50rpx);
		opacity: 0.22;
		pointer-events: none;
		z-index: 0;
	}

	.up-glow--l {
		top: -120rpx;
		left: -130rpx;
		background: rgba(226, 100, 63, 0.36);
	}

	.up-glow--r {
		top: 240rpx;
		right: -130rpx;
		background: rgba(216, 176, 140, 0.24);
	}

	.up-count-pill {
		height: 48rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.48);
		background: rgba(216, 176, 140, 0.14);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.up-count-pill__txt {
		font-size: 21rpx;
		color: #EAD4BC;
		white-space: nowrap;
	}

	.up-wrap {
		position: relative;
		z-index: 1;
		padding: 16rpx 28rpx 0;
	}

	.up-grid-tip {
		display: block;
		font-size: 21rpx;
		line-height: 1.5;
		color: rgba(245, 237, 228, 0.44);
	}

	.up-add-plus {
		font-size: 46rpx;
		font-weight: 300;
		color: #D8B08C;
		line-height: 1;
	}

	/* 适配内置 love-media-uploader 为暗夜 NOIR 视觉 */
	:deep(.love-media-uploader__item) {
		border-radius: 20rpx !important;
		border: 1rpx solid rgba(255, 255, 255, 0.10) !important;
		background: #1A1512 !important;
	}

	:deep(.love-media-uploader__item--add) {
		border: 1.5rpx dashed rgba(216, 176, 140, 0.44) !important;
		background: rgba(216, 176, 140, 0.06) !important;
	}

	:deep(.love-media-uploader__add-text) {
		color: #EAD4BC !important;
		font-size: 22rpx !important;
	}

	:deep(.love-media-uploader__add-hint) {
		color: rgba(245, 237, 228, 0.40) !important;
		font-size: 19rpx !important;
	}

	.up-sec {
		margin-top: 26rpx;
	}

	.up-sec__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14rpx;
		padding: 0 4rpx;
	}

	.up-sec__lbl {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.54);
		letter-spacing: 1rpx;
	}

	.up-sec__cnt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: #D8B08C;
	}

	.up-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}

	.up-chip {
		height: 56rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.10);
		background: rgba(255, 255, 255, 0.036);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.up-chip.is-on {
		border-color: rgba(216, 176, 140, 0.62);
		background: rgba(216, 176, 140, 0.18);
	}

	.up-chip--custom {
		border-style: dashed;
		border-color: rgba(216, 176, 140, 0.36);
		background: transparent;
	}

	.up-chip__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.66);
		white-space: nowrap;
	}

	.up-chip.is-on .up-chip__txt {
		color: #FBF4EA;
		font-weight: 500;
	}

	.up-chip--custom .up-chip__txt {
		color: #D8B08C;
	}

	.up-custom-row {
		display: flex;
		align-items: center;
		gap: 14rpx;
		margin-top: 16rpx;
	}

	.up-custom-input {
		flex: 1;
		height: 68rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.32);
		background: rgba(26, 21, 18, 0.92);
		color: #FBF4EA;
		font-size: 24rpx;
	}

	.up-custom-btn {
		height: 68rpx;
		padding: 0 28rpx;
		border-radius: 999rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.56);
		background: rgba(216, 176, 140, 0.16);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.up-custom-btn__txt {
		font-size: 23rpx;
		color: #EAD4BC;
	}

	.up-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		min-height: 92rpx;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.up-row--no-border {
		border-bottom: none;
	}

	.up-loc-addr {
		display: block;
		padding: 0 0 18rpx;
		font-size: 21rpx;
		line-height: 1.5;
		color: rgba(245, 237, 228, 0.44);
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.up-row__lbl {
		font-size: 25rpx;
		color: rgba(245, 237, 228, 0.68);
		flex-shrink: 0;
	}

	.up-row__val-wrap {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10rpx;
	}

	.up-row__val {
		font-size: 25rpx;
		color: #FBF4EA;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.up-row__val.is-placeholder {
		color: rgba(245, 237, 228, 0.34);
	}

	.up-row__val--mono {
		font-family: "SF Mono", "Consolas", monospace;
		color: #EAD4BC;
	}

	.up-row__clear {
		padding: 6rpx 10rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.up-row__chev {
		font-size: 32rpx;
		color: rgba(216, 176, 140, 0.56);
	}

	.up-desc-row {
		padding: 22rpx 0 18rpx;
	}

	.up-desc-row__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14rpx;
	}

	.up-desc-row__cnt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.38);
	}

	.up-textarea {
		width: 100%;
		height: 156rpx;
		padding: 18rpx 20rpx;
		box-sizing: border-box;
		border-radius: 18rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		color: #FBF4EA;
		font-size: 25rpx;
		line-height: 1.6;
	}

	.up-tip {
		display: block;
		margin-top: 20rpx;
		padding: 0 6rpx;
		font-size: 21rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.40);
	}

	.ad-view {
		margin-top: 22rpx;
	}

	.up-footer {
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
