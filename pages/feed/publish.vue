<template>
	<view class="pf-page" @tap="handlePageTap">
		<view class="pf-glow pf-glow--left"></view>
		<view class="pf-glow pf-glow--right"></view>

		<noir-navbar
			title="发布日常"
			:show-back="true"
			:custom-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
			@back="goBack"
		>
		</noir-navbar>

		<view class="pf-wrap">
			<!-- 图文 / 视频模式切换（对标 s17 .m-seg） -->
			<view class="pf-seg">
				<view
					class="pf-seg__item"
					:class="{ 'pf-seg__item--on': mediaMode === 'image' }"
					@tap="switchMediaMode('image')"
				>
					<text class="pf-seg__txt">图文模式（最多 9 张）</text>
				</view>
				<view
					class="pf-seg__item"
					:class="{ 'pf-seg__item--on': mediaMode === 'video' }"
					@tap="switchMediaMode('video')"
				>
					<text class="pf-seg__txt">视频模式（1 段）</text>
				</view>
			</view>

			<!-- 正文输入卡片（对标 s17 .pf-box） -->
			<view class="pf-box" @tap.stop>
				<textarea
					v-model="content"
					class="pf-textarea"
					placeholder="写点今天的故事…"
					placeholder-class="pf-ph"
					:maxlength="2000"
					auto-height
					:show-confirm-bar="false"
					:adjust-position="false"
					:focus="inputFocus"
					:cursor-spacing="emojiTriggerSpacing"
					@focus="handleInputFocus"
					@blur="handleInputBlur"
					@tap.stop="handleInputTap"
					@keyboardheightchange="onKeyboardHeightChange"
				/>
				<view class="pf-box__foot">
					<view
						class="pf-emoji-trigger"
						@touchstart.prevent="prepareOpenEmojiPanel"
						@touchend.prevent="toggleEmojiPanel"
					>
						<fui-icon :name="showEmojiPanel ? 'keyboard' : 'face'" :size="36" color="#EAD4BC" />
					</view>
					<text class="pf-cnt">{{ contentLength }} / 2000</text>
				</view>
			</view>

			<!-- 媒体选择区（保留完整压缩与缩略图上传逻辑） -->
			<view class="pf-media">
				<love-media-uploader
					ref="mediaUploader"
					:file-types="uploaderFileTypes"
					:max-file-size="maxFileSize"
					:compressed="true"
					:enable-compression="true"
					:compress-over-size="uploaderCompressOverSize"
					:image-compress-quality="uploaderImageCompressQuality"
					:enable-thumbnail="true"
					:thumbnail-options="uploaderThumbnailOptions"
					:save-path="uploaderSavePath"
					upload-prefix="daily"
					:max-count="uploaderMaxCount"
					:exclusive-media-types="true"
					:max-image-count="9"
					:max-video-count="1"
					:mixed-media-tip="'不允许同时选择图片和视频'"
					:tip-text="uploaderTipText"
					:item-width="214"
					:item-height="214"
					:previewable="true"
					object-fit="aspectFill"
					:source-type="['album', 'camera']"
					:show-delete-button="true"
					:show-tips="false"
					@change="onUploaderChange"
					@progress="onUploaderProgress"
				>
					<template #upload-icon>
						<view class="pf-add-slot">
							<text class="pf-add-slot__plus">＋</text>
							<text class="pf-add-slot__lbl">{{ mediaMode === 'video' ? '添加视频' : '添加图片' }}</text>
						</view>
					</template>
				</love-media-uploader>
			</view>

			<!-- 位置与可见范围（对标 s17 .pf-meta） -->
			<view class="pf-meta">
				<view class="pf-row-block">
					<view class="pf-row" @tap="handleChooseLocation">
						<text class="pf-row__label">位置（选填）</text>
						<view class="pf-row__right">
							<fui-icon name="location" :size="28" :color="hasSelectedLocation ? '#D8B08C' : 'rgba(245, 237, 228, 0.36)'" />
							<text
								class="pf-loc-txt"
								:class="{ 'pf-loc-txt--active': hasSelectedLocation }"
							>{{ locationDisplayText }}</text>
							<fui-icon name="arrowright" :size="24" color="rgba(245, 237, 228, 0.36)" />
						</view>
					</view>
					<view v-if="hasSelectedLocation" class="pf-loc-extra">
						<text v-if="locationAddressText" class="pf-loc-extra__addr">{{ locationAddressText }}</text>
						<text class="pf-loc-extra__clear" @tap.stop="clearLocation">清除</text>
					</view>
				</view>

				<!-- <view class="pf-row-block pf-row-block--last">
					<view class="pf-row">
						<text class="pf-row__label">可见范围</text>
						<text class="pf-row__val">{{ privacyTipTitle }}</text>
					</view>
				</view> -->
			</view>

			<!-- 隐私合规说明 -->
			<view class="pf-privacy">
				<text class="pf-privacy__txt">{{ privacyTipDesc }}</text>
			</view>
		</view>

		<!-- 底部固定发布按钮（对标 s17 .m-foot） -->
		<view class="pf-foot-bar">
			<view
				class="pf-submit"
				:class="{ 'pf-submit--disabled': submitting }"
				hover-class="pf-submit--hover"
				@tap="handleSubmit"
			>
				<text class="pf-submit__txt">{{ submitButtonText }}</text>
			</view>
		</view>

		<!-- 暗色表情工具条与表情面板 -->
		<view v-if="showEmojiToolbarPanel" class="emoji-toolbar-panel" :style="emojiPanelStyle" @tap.stop>
			<view class="emoji-toolbar">
				<view
					class="emoji-toolbar__button"
					@touchstart.prevent="prepareOpenEmojiPanel"
					@touchend.prevent="toggleEmojiPanel"
				>
					<fui-icon :name="showEmojiPanel ? 'keyboard' : 'face'" :size="44" color="#EAD4BC" />
				</view>
				<view class="emoji-toolbar__right">
					<view v-if="showEmojiPanel && content" class="emoji-toolbar__del" @tap.stop="deleteLastChar">
						<text class="emoji-toolbar__del-txt">⌫</text>
					</view>
					<view class="emoji-toolbar__done" @tap.stop="closeEmojiToolbarPanel">
						<text class="emoji-toolbar__done-txt">完成</text>
					</view>
				</view>
			</view>
			<view v-if="showEmojiPanel" class="emoji-panel">
				<view class="emoji-grid">
					<text
						v-for="emoji in emojiList"
						:key="emoji.unicode || emoji.glyph"
						class="emoji-panel__item"
						@tap.stop="appendEmoji(emoji)"
					>{{ emoji.glyph }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { getDailyApi } from '../../common/api/daily.js'
	import { uploadFileWithModule } from '../../common/utils/file-upload.js'
	import glyph from '../../components/love-editor/glyph.json'
	import { requirePageLogin } from '@/common/auth-entry.js'
	import { markPageRefresh } from '@/common/utils/page-refresh.js'
	import { useAppStateStore } from '@/store/app-state.js'

	const MAX_FILE_SIZE = 100 * 1024 * 1024
	const DAILY_IMAGE_COMPRESS_OVER_SIZE = 1024 * 1024
	const DAILY_IMAGE_COMPRESS_QUALITY = 86
	const THUMBNAIL_IMAGE_QUALITY = 45
	const FEED_REFRESH_KEY = 'feed'

	export default {
		data() {
			return {
				scrollTop: 0,
				mediaMode: 'image',
				keyboardHeight: 0,
				inputFocus: false,
				inputFocused: false,
				showEmojiPanel: false,
				pendingOpenEmojiPanel: false,
				restoreKeyboardTimer: null,
				content: '',
				coupleBound: false,
				emojiList: glyph,
				maxFileSize: MAX_FILE_SIZE,
				selectedCount: 0,
				uploadProgress: 0,
				submitting: false,
				locationInfo: {
					name: '',
					address: '',
					latitude: null,
					longitude: null
				}
			}
		},
		computed: {
			contentLength() {
				return String(this.content || '').length
			},
			privacyTipTitle() {
				return this.coupleBound ? '双人共享空间' : '仅自己可见'
			},
			privacyTipDesc() {
				if (this.coupleBound) {
					return '发布后仅你与已绑定的伴侣可见，不会对外公开，也不进入任何公开列表；小程序内无转发或分享入口。'
				}
				return '发布后仅你自己可见，不会对外公开，也不进入任何公开列表；小程序内无转发或分享入口，仅用于私密记录日常。'
			},
			submitButtonText() {
				if (this.submitting) {
					return this.selectedCount > 0
						? `发布中 ${this.uploadProgress}/${this.selectedCount}`
						: '发布中…'
				}
				return this.coupleBound ? '发布日常 (+5 心动点)' : '发布日常'
			},
			uploaderFileTypes() {
				return this.mediaMode ? [this.mediaMode] : ['image', 'video']
			},
			uploaderMaxCount() {
				return this.mediaMode === 'video' ? 1 : 9
			},
			uploaderSavePath() {
				return this.mediaMode === 'video' ? 'daily/videos' : 'daily/images'
			},
			uploaderCompressOverSize() {
				return this.mediaMode === 'video' ? (10 * 1024 * 1024) : DAILY_IMAGE_COMPRESS_OVER_SIZE
			},
			uploaderImageCompressQuality() {
				return this.mediaMode === 'video' ? 80 : DAILY_IMAGE_COMPRESS_QUALITY
			},
			uploaderThumbnailOptions() {
				if (this.mediaMode === 'video') {
					return {
						videoSavePath: 'daily/thumbnails/videos',
						videoPrefix: 'poster',
						image: false,
						video: true,
						imageQuality: THUMBNAIL_IMAGE_QUALITY
					}
				}
				return {
					imageSavePath: 'daily/thumbnails/images',
					imagePrefix: 'thumb',
					image: true,
					video: false,
					imageQuality: THUMBNAIL_IMAGE_QUALITY
				}
			},
			uploaderTipText() {
				return this.mediaMode === 'video' ? '视频最多发布 1 个' : '图片最多发布 9 张'
			},
			emojiTriggerSpacing() {
				return 24
			},
			showEmojiToolbarPanel() {
				return this.inputFocused || this.showEmojiPanel
			},
			hasSelectedLocation() {
				return Boolean(
					this.locationInfo &&
					(this.locationInfo.name || this.locationInfo.address || (
						this.locationInfo.latitude !== null && this.locationInfo.longitude !== null
					))
				)
			},
			locationDisplayText() {
				if (!this.hasSelectedLocation) {
					return '添加位置'
				}
				return this.locationInfo.name || this.locationInfo.address || '已选择位置'
			},
			locationAddressText() {
				return this.locationInfo.address || ''
			},
			emojiPanelStyle() {
				const height = Number(this.keyboardHeight || 0)
				const bottom = this.showEmojiPanel ? 0 : (Number.isFinite(height) ? Math.max(0, height) : 0)
				return [{ bottom: `${bottom}px` }]
			}
		},
		onLoad(options = {}) {
			if (!requirePageLogin()) return
			const type = String(options.type || '').trim()
			this.mediaMode = type === 'video' ? 'video' : 'image'
			this.loadCoupleState()
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
		},
		onUnload() {
			this.clearRestoreKeyboardTimer()
		},
		methods: {
			async loadCoupleState() {
				try {
					const appStateStore = useAppStateStore()
					await appStateStore.fetchCoupleCenter({ force: false })
					const centerData = appStateStore.coupleCenterData || {}
					this.coupleBound = Boolean(centerData.activeCouple)
				} catch (error) {
					console.warn('publish: load couple state failed', error)
				}
			},
			switchMediaMode(nextMode) {
				if (this.submitting || nextMode === this.mediaMode) {
					return
				}
				if (this.selectedCount > 0) {
					uni.showModal({
						title: '切换模式',
						content: '切换后将清空当前已选媒体，确定切换吗？',
						success: (res) => {
							if (!res.confirm) return
							const uploader = this.$refs.mediaUploader
							if (uploader && typeof uploader.clear === 'function') {
								uploader.clear()
							}
							this.selectedCount = 0
							this.mediaMode = nextMode
						}
					})
					return
				}
				this.mediaMode = nextMode
			},
			appendEmoji(emoji = '') {
				const glyphText = emoji && typeof emoji === 'object' ? String(emoji.glyph || '') : String(emoji || '')
				if (!glyphText) {
					return
				}
				this.content = `${this.content || ''}${glyphText}`.slice(0, 2000)
			},
			deleteLastChar() {
				if (!this.content) return
				const chars = Array.from(this.content)
				chars.pop()
				this.content = chars.join('')
			},
			handleInputFocus() {
				this.inputFocused = true
			},
			handleInputTap() {
				this.inputFocused = true
			},
			handleInputBlur() {
				if (this.pendingOpenEmojiPanel || this.showEmojiPanel) {
					return
				}
				this.inputFocused = false
			},
			onKeyboardHeightChange(event = {}) {
				const detail = event.detail || {}
				const height = Math.max(0, Number(detail.height || 0))
				this.keyboardHeight = Number.isFinite(height) ? height : 0
			},
			hideKeyboardOnly() {
				if (typeof uni.hideKeyboard === 'function') {
					uni.hideKeyboard({})
				}
			},
			clearRestoreKeyboardTimer() {
				if (!this.restoreKeyboardTimer) {
					return
				}
				clearTimeout(this.restoreKeyboardTimer)
				this.restoreKeyboardTimer = null
			},
			restoreKeyboard() {
				this.clearRestoreKeyboardTimer()
				this.inputFocused = true
				this.inputFocus = false
				this.$nextTick(() => {
					this.restoreKeyboardTimer = setTimeout(() => {
						this.restoreKeyboardTimer = null
						if (!this.inputFocused || this.showEmojiPanel) {
							return
						}
						this.inputFocus = true
					}, 30)
				})
			},
			prepareOpenEmojiPanel() {
				this.pendingOpenEmojiPanel = true
			},
			toggleEmojiPanel() {
				const nextShowEmojiPanel = !this.showEmojiPanel
				this.pendingOpenEmojiPanel = false
				this.inputFocused = true
				this.inputFocus = false
				if (nextShowEmojiPanel) {
					this.hideKeyboardOnly()
				}
				this.showEmojiPanel = nextShowEmojiPanel
				if (!nextShowEmojiPanel) {
					this.$nextTick(() => {
						this.restoreKeyboard()
					})
				}
			},
			closeEmojiPanel() {
				this.pendingOpenEmojiPanel = false
				this.showEmojiPanel = false
			},
			closeEmojiToolbarPanel() {
				this.closeEmojiPanel()
				this.inputFocused = false
				this.hideKeyboardOnly()
			},
			handlePageTap() {
				if (this.inputFocused || this.showEmojiPanel) {
					this.closeEmojiToolbarPanel()
				}
			},
			clearLocation() {
				this.locationInfo = {
					name: '',
					address: '',
					latitude: null,
					longitude: null
				}
			},
			async handleChooseLocation() {
				if (this.submitting) {
					return
				}

				try {
					const selected = await new Promise((resolve, reject) => {
						uni.chooseLocation({
							success: (res) => resolve(res || {}),
							fail: (error) => reject(error)
						})
					})

					this.locationInfo = {
						name: String(selected.name || '').trim(),
						address: String(selected.address || '').trim(),
						latitude: Number.isNaN(Number(selected.latitude)) ? null : Number(selected.latitude),
						longitude: Number.isNaN(Number(selected.longitude)) ? null : Number(selected.longitude)
					}
				} catch (error) {
					const message = String(error && (error.errMsg || error.message) || '')
					if (message.includes('cancel')) {
						return
					}
					uni.showToast({
						title: '位置选择失败，请重试',
						icon: 'none'
					})
				}
			},
			buildLocationPayload() {
				if (!this.hasSelectedLocation) {
					return null
				}
				return {
					name: String(this.locationInfo.name || '').trim(),
					address: String(this.locationInfo.address || '').trim(),
					latitude: this.locationInfo.latitude === null ? null : Number(this.locationInfo.latitude),
					longitude: this.locationInfo.longitude === null ? null : Number(this.locationInfo.longitude)
				}
			},
			compressImageForThumbnail(filePath = '') {
				return new Promise((resolve) => {
					const sourcePath = String(filePath || '').trim()
					if (!sourcePath || typeof uni.compressImage !== 'function') {
						resolve(sourcePath)
						return
					}
					uni.compressImage({
						src: sourcePath,
						quality: THUMBNAIL_IMAGE_QUALITY,
						success: (res) => {
							const nextPath = String(res && (res.tempFilePath || res.filePath) || '').trim()
							resolve(nextPath || sourcePath)
						},
						fail: () => {
							resolve(sourcePath)
						}
					})
				})
			},
			async uploadThumbnailFile({ localPath = '', module = '', prefix = '' } = {}) {
				const sourcePath = String(localPath || '').trim()
				if (!sourcePath) {
					return ''
				}
				const result = await uploadFileWithModule({
					filePath: sourcePath,
					module,
					prefix,
					fileType: 'image'
				})
				return String(result.fileURL || '').trim()
			},
			async buildMediaPayload(file = {}) {
				const mediaType = String(file.mediaType || '').trim().toLowerCase()
				const sourceUrl = String(file.url || '').trim()
				let thumbnailUrl = String(file.thumbnailUrl || '').trim()

				if (mediaType === 'image' && !thumbnailUrl) {
					try {
						const thumbnailSourcePath = await this.compressImageForThumbnail(String(file.path || '').trim())
						thumbnailUrl = await this.uploadThumbnailFile({
							localPath: thumbnailSourcePath,
							module: 'daily/thumbnails/images',
							prefix: 'thumb'
						})
					} catch (error) {
						console.warn('build image thumbnail failed', error)
					}
					if (!thumbnailUrl) {
						thumbnailUrl = sourceUrl
					}
				}

				if (mediaType === 'video' && !thumbnailUrl) {
					try {
						thumbnailUrl = await this.uploadThumbnailFile({
							localPath: String(file.poster || '').trim(),
							module: 'daily/thumbnails/videos',
							prefix: 'poster'
						})
					} catch (error) {
						console.warn('build video thumbnail failed', error)
					}
				}

				return {
					url: sourceUrl,
					fileId: file.fileId,
					thumbnailUrl,
					thumbnailFileId: file.thumbnailFileId || '',
					mediaType: file.mediaType,
					mimeType: file.mimeType || '',
					fileSize: Number(file.fileSize || 0),
					duration: Number(file.duration || 0),
					width: Number(file.width || 0),
					height: Number(file.height || 0)
				}
			},
			onUploaderChange(files = []) {
				const list = Array.isArray(files) ? files : []
				this.selectedCount = list.length
			},
			onUploaderProgress(payload = {}) {
				this.uploadProgress = Number(payload.current || 0)
			},
			async handleSubmit() {
				if (this.submitting) {
					return
				}

				const content = String(this.content || '').trim()
				if (!content && this.selectedCount <= 0) {
					uni.showToast({
						title: '请输入文字或添加媒体',
						icon: 'none'
					})
					return
				}

				const uploader = this.$refs.mediaUploader
				if (!uploader || typeof uploader.uploadAll !== 'function') {
					uni.showToast({
						title: '上传组件未就绪',
						icon: 'none'
					})
					return
				}

				this.closeEmojiToolbarPanel()
				this.submitting = true
				this.uploadProgress = 0
				uni.showLoading({
					title: '发布中...',
					mask: true
				})
				let submitLoadingVisible = true
				const hideSubmitLoading = () => {
					if (!submitLoadingVisible) {
						return
					}
					submitLoadingVisible = false
					uni.hideLoading()
				}

				try {
					let uploadedFiles = []
					if (this.selectedCount > 0) {
						uploadedFiles = await uploader.uploadAll({
							savePath: this.uploaderSavePath,
							prefix: 'daily'
						})
						if (!uploadedFiles.length) {
							throw new Error('媒体上传失败，请重试')
						}
					}

					const mediaList = await Promise.all(uploadedFiles.map((file) => this.buildMediaPayload(file)))
					const location = this.buildLocationPayload()
					const result = await getDailyApi().create({
						content,
						mediaList,
						location
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '发布失败')
					}

					markPageRefresh(FEED_REFRESH_KEY)

					hideSubmitLoading()
					uni.showToast({
						title: '发布成功',
						icon: 'success'
					})

					if (uploader && typeof uploader.clear === 'function') {
						uploader.clear()
					}
					this.content = ''
					this.selectedCount = 0
					this.uploadProgress = 0
					this.clearLocation()

					setTimeout(() => {
						uni.navigateBack()
					}, 350)
				} catch (error) {
					console.error('publish daily failed', error)
					hideSubmitLoading()
					uni.showToast({
						title: error.message || '发布失败',
						icon: 'none'
					})
				} finally {
					this.submitting = false
				}
			},
			goBack() {
				if (this.submitting) {
					return
				}
				uni.navigateBack()
			}
		}
	}
</script>

<style scoped lang="scss">
	.pf-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
		background: var(--noir-bg);
		overflow: hidden;
	}

	.pf-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.2;
		pointer-events: none;
		z-index: 0;
	}

	.pf-glow--left {
		top: -120rpx;
		left: -140rpx;
		background: var(--noir-coral);
	}

	.pf-glow--right {
		top: 320rpx;
		right: -160rpx;
		background: var(--noir-gold);
	}

	.pf-nav-cancel {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 52rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(245, 237, 228, 0.16);
		background: rgba(255, 255, 255, 0.04);
	}

	.pf-nav-cancel__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.68);
		white-space: nowrap;
	}

	.pf-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 36rpx 0;
	}

	/* 图文 / 视频分段切换（对标 s17 .m-seg） */
	.pf-seg {
		display: flex;
		padding: 6rpx;
		margin-bottom: 22rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
	}

	.pf-seg__item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 60rpx;
		border-radius: 17rpx;
	}

	.pf-seg__item--on {
		border: 1rpx solid var(--noir-border-coral);
		background: linear-gradient(135deg, rgba(226, 100, 63, 0.24), rgba(216, 176, 140, 0.14));
	}

	.pf-seg__txt {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.54);
	}

	.pf-seg__item--on .pf-seg__txt {
		color: var(--noir-text-strong);
		font-weight: 600;
	}

	/* 正文输入卡（对标 s17 .pf-box） */
	.pf-box {
		position: relative;
		padding: 24rpx 28rpx 18rpx;
		border-radius: 28rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.03);
	}

	.pf-textarea {
		width: 100%;
		min-height: 220rpx;
		font-size: 28rpx;
		line-height: 1.75;
		color: var(--noir-text-strong);
		box-sizing: border-box;
	}

	.pf-ph {
		color: rgba(245, 237, 228, 0.30);
	}

	.pf-box__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 14rpx;
		padding-top: 12rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.pf-emoji-trigger {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56rpx;
		height: 56rpx;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.04);
	}

	.pf-cnt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 21rpx;
		color: rgba(216, 176, 140, 0.68);
	}

	/* 媒体选择区 */
	.pf-media {
		margin-top: 22rpx;
	}

	.pf-add-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8rpx;
	}

	.pf-add-slot__plus {
		font-size: 44rpx;
		line-height: 1;
		color: rgba(216, 176, 140, 0.84);
	}

	.pf-add-slot__lbl {
		font-size: 22rpx;
		color: rgba(234, 212, 188, 0.78);
	}

	/* 位置与可见范围卡片（对标 s17 .pf-meta） */
	.pf-meta {
		margin-top: 24rpx;
		padding: 0 28rpx;
		border-radius: 28rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.03);
	}

	.pf-row-block {
		border-bottom: 1rpx solid var(--noir-border-soft);
	}

	.pf-row-block--last {
		border-bottom: none;
	}

	.pf-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		min-height: 94rpx;
	}

	.pf-row__label {
		flex-shrink: 0;
		font-size: 25rpx;
		color: rgba(245, 237, 228, 0.62);
	}

	.pf-row__right {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8rpx;
	}

	.pf-loc-txt {
		font-size: 25rpx;
		color: rgba(245, 237, 228, 0.36);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pf-loc-txt--active {
		color: var(--noir-gold);
	}

	.pf-row__val {
		font-size: 25rpx;
		color: var(--noir-text-strong);
	}

	.pf-loc-extra {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		padding-bottom: 18rpx;
	}

	.pf-loc-extra__addr {
		flex: 1;
		min-width: 0;
		font-size: 21rpx;
		color: var(--noir-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pf-loc-extra__clear {
		flex-shrink: 0;
		font-size: 21rpx;
		color: var(--noir-coral-soft);
	}

	.pf-privacy {
		margin-top: 20rpx;
		padding: 18rpx 22rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.16);
		background: rgba(216, 176, 140, 0.05);
	}

	.pf-privacy__txt {
		font-size: 21rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.46);
	}

	/* 底部固定发布栏 */
	.pf-foot-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		padding: 20rpx 36rpx calc(24rpx + env(safe-area-inset-bottom));
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(17, 13, 11, 0.94);
	}

	.pf-submit {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		border-radius: 44rpx;
		background: var(--noir-btn-gradient);
		box-shadow: 0 12rpx 28rpx rgba(222, 95, 60, 0.28);
	}

	.pf-submit--disabled {
		opacity: 0.55;
	}

	.pf-submit--hover {
		opacity: 0.86;
	}

	.pf-submit__txt {
		font-size: 28rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
		letter-spacing: 2rpx;
	}

	/* 表情工具栏与面板 */
	.emoji-toolbar-panel {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 3000;
		width: 100%;
		box-sizing: border-box;
		border-top: 1rpx solid rgba(216, 176, 140, 0.22);
		background: var(--noir-surface);
		box-shadow: 0 -12rpx 32rpx rgba(0, 0, 0, 0.55);
	}

	.emoji-toolbar {
		width: 100%;
		height: 84rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 28rpx;
		box-sizing: border-box;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.emoji-toolbar__button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
	}

	.emoji-toolbar__right {
		display: flex;
		align-items: center;
		gap: 20rpx;
	}

	.emoji-toolbar__del {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 52rpx;
		padding: 0 20rpx;
		border-radius: 16rpx;
		background: rgba(255, 255, 255, 0.06);
	}

	.emoji-toolbar__del-txt {
		font-size: 26rpx;
		color: var(--noir-gold-soft);
	}

	.emoji-toolbar__done {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 52rpx;
		padding: 0 22rpx;
		border-radius: 26rpx;
		background: rgba(226, 100, 63, 0.18);
		border: 1rpx solid var(--noir-border-coral);
	}

	.emoji-toolbar__done-txt {
		font-size: 22rpx;
		color: var(--noir-coral-light);
		font-weight: 600;
	}

	.emoji-panel {
		max-height: 460rpx;
		padding: 20rpx 24rpx 28rpx;
		box-sizing: border-box;
		overflow-y: auto;
	}

	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-gap: 16rpx;
	}

	.emoji-panel__item {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1 / 1;
		border-radius: 12rpx;
		font-size: 46rpx;
		line-height: 1;
	}
</style>
