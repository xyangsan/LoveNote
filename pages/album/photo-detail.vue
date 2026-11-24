<template>
	<view class="ph-page">
		<!-- 全屏背景媒体滑动区 -->
		<swiper
			v-if="photoList.length"
			class="ph-swiper"
			:current="currentIndex"
			:duration="260"
			:disable-touch="chromeHidden && currentImageScale > 1.05"
			@change="handleSwiperChange"
		>
			<swiper-item v-for="(item, idx) in photoList" :key="item._id || idx" class="ph-slide">
				<!-- 整页展示原图或视频（窗口内前后各 10 张渲染；隐藏底部信息时图片支持双指缩放） -->
				<view class="ph-stage" @tap="toggleChrome">
					<template v-if="isInRenderWindow(idx)">
						<video
							v-if="isVideo(item) && idx === currentIndex"
							:id="'ph-inline-video-' + idx"
							class="ph-video"
							:src="getOriginalUrl(item)"
							:poster="getThumbUrl(item)"
							:autoplay="false"
							:controls="false"
							:muted="videoMuted"
							:show-center-play-btn="false"
							:show-play-btn="false"
							:show-fullscreen-btn="false"
							:enable-progress-gesture="true"
							object-fit="contain"
							@play="onVideoPlay"
							@pause="onVideoPause"
							@ended="onVideoEnded"
							@timeupdate="onVideoTimeUpdate"
							@loadedmetadata="onVideoLoadedMeta"
						></video>
						<movable-area v-else class="ph-zoom-area">
							<movable-view
								:key="'mv-' + (item._id || idx) + '-' + (slideZoomVersions[idx] || 0)"
								class="ph-zoom-view"
								direction="all"
								:scale="chromeHidden && idx === currentIndex"
								:scale-min="1"
								:scale-max="3"
								:scale-value="1"
								:disabled="!(chromeHidden && idx === currentIndex)"
								:out-of-bounds="false"
								@scale="onImageScale(idx, $event)"
							>
								<image
									class="ph-photo"
									:src="getDisplayUrl(item)"
									mode="aspectFit"
								></image>
							</movable-view>
						</movable-area>
					</template>
				</view>

				<!-- 视频暂停时的居中播放按钮 -->
				<view
					v-if="isVideo(item) && idx === currentIndex && !videoPlaying"
					class="ph-play-btn"
					@tap.stop="toggleVideoPlay"
				>
					<text class="ph-play-btn__icon">▶</text>
				</view>
			</swiper-item>
		</swiper>
		<view v-else class="ph-empty-bg"></view>

		<!-- 暗夜电影感上下遮罩（沉浸看图时淡出） -->
		<view class="ph-shade" :class="{ 'is-hidden': chromeHidden }"></view>

		<!-- 顶部通透导航栏 -->
		<noir-navbar
			:title="navTitle"
			:show-back="true"
			:transparent="true"
			:placeholder="false"
			:border="false"
		>
			<template #right>
				<view class="ph-more-btn" @tap="openMoreMenu">
					<fui-icon name="more" :size="36" color="#F5EDE4"></fui-icon>
				</view>
			</template>
		</noir-navbar>

		<!-- 加载中 / 空态 -->
		<view v-if="loading && !currentPhoto" class="ph-center-tip">
			<text class="ph-center-tip__txt">正在加载照片…</text>
		</view>

		<!-- 底部悬浮区：自定义视频控制栏 + 文案区 + 缩略图条 -->
		<view class="ph-bottom-dock">
			<!-- 视频自定义控制框（仅当前项为视频时显示） -->
			<view
				v-if="currentPhoto && isVideo(currentPhoto)"
				class="ph-vctrl"
				:class="{ 'is-solo': chromeHidden }"
				@tap.stop
			>
				<view class="ph-vctrl__btn" @tap="toggleVideoPlay">
					<text class="ph-vctrl__glyph">{{ videoPlaying ? '❚❚' : '▶' }}</text>
				</view>
				<text class="ph-vctrl__time">{{ formatMediaTime(videoCurrentTime) }}</text>
				<slider
					class="ph-vctrl__slider"
					:min="0"
					:max="videoDuration > 0 ? videoDuration : 1"
					:value="videoSliderValue"
					:step="0.2"
					activeColor="#D8B08C"
					backgroundColor="rgba(255,255,255,0.18)"
					block-color="#FBF4EA"
					:block-size="13"
					@changing="onVideoSliderChanging"
					@change="onVideoSliderChange"
				/>
				<text class="ph-vctrl__time">{{ formatMediaTime(videoDuration) }}</text>
				<view class="ph-vctrl__btn" @tap="toggleVideoMute">
					<text class="ph-vctrl__glyph">{{ videoMuted ? '✕' : '♪' }}</text>
				</view>
				<view class="ph-vctrl__btn" @tap="requestVideoFullscreen">
					<text class="ph-vctrl__glyph">⛶</text>
				</view>
			</view>

			<!-- 底部文案与操作区（06 照片详情设计稿） -->
			<view
				v-if="currentPhoto"
				class="ph-copy"
				:class="{ 'is-hidden': chromeHidden }"
				@tap.stop
			>
				<text class="ph-kicker">{{ metaKicker }}</text>
				<text class="ph-title" @tap="handleEditDescription">{{ displayHeadline }}</text>
				<text v-if="displayBodyText" class="ph-text" @tap="handleEditDescription">{{ displayBodyText }}</text>

				<!-- 标签行 -->
				<view class="ph-tags">
					<view
						v-for="(tag, tIdx) in currentTags"
						:key="tag + '-' + tIdx"
						class="ph-tag"
						@longpress.stop="confirmRemoveTag(tag)"
					>
						<text class="ph-tag__txt">{{ tag }}</text>
					</view>
					<view class="ph-tag ph-tag--add" @tap="handleAddTag">
						<text class="ph-tag__txt">＋ 标签</text>
					</view>
				</view>

				<!-- 操作按钮条：已赞 / 保存 / 照片信息 -->
				<view class="ph-acts">
					<view
						class="ph-abtn"
						:class="{ 'ph-abtn--coral': currentPhoto.is_favorite }"
						@tap="handleToggleFavorite"
					>
						<fui-icon
							:name="currentPhoto.is_favorite ? 'like-fill' : 'like'"
							:size="28"
							:color="currentPhoto.is_favorite ? '#F5B496' : '#F5EDE4'"
						></fui-icon>
						<text class="ph-abtn__txt">{{ currentPhoto.is_favorite ? '已赞' : '喜欢' }}</text>
					</view>

					<view class="ph-abtn" @tap="handleSaveMedia">
						<text class="ph-abtn__glyph">↓</text>
						<text class="ph-abtn__txt">{{ saving ? '保存中' : '保存' }}</text>
					</view>

					<view class="ph-abtn ph-abtn--gold" @tap="openInfoSheet">
						<text class="ph-abtn__txt">照片信息</text>
					</view>
				</view>
			</view>

			<!-- 底部缩略图胶片条 -->
			<scroll-view
				v-if="photoList.length > 1"
				scroll-x
				:scroll-into-view="'thumb-' + currentIndex"
				scroll-with-animation
				class="ph-thumbs-scroll"
				:class="{ 'is-hidden': chromeHidden }"
				@tap.stop
			>
				<view class="ph-thumbs">
					<view
						v-for="(item, idx) in photoList"
						:id="'thumb-' + idx"
						:key="item._id || idx"
						class="ph-thumb"
						:class="{ 'is-on': idx === currentIndex }"
						@tap="selectIndex(idx)"
					>
						<image
							v-if="!isVideo(item) || hasVideoThumb(item)"
							class="ph-thumb__img"
							:src="getThumbStripSrc(item)"
							mode="aspectFill"
							lazy-load
							@error="onThumbStripError(item)"
						></image>
						<video
							v-else
							class="ph-thumb__video"
							:src="getOriginalUrl(item)"
							:controls="false"
							:autoplay="false"
							:muted="true"
							:show-center-play-btn="false"
							:show-play-btn="false"
							:show-fullscreen-btn="false"
							:enable-progress-gesture="false"
							object-fit="cover"
						></video>
						<view v-if="isVideo(item)" class="ph-thumb__v">
							<text class="ph-thumb__v-txt">▶</text>
						</view>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 照片信息暗夜底部抽屉 -->
		<view v-if="infoSheetVisible && currentPhoto" class="ph-sheet-mask" @tap="closeInfoSheet">
			<view class="ph-sheet" @tap.stop>
				<view class="ph-sheet__head">
					<view>
						<text class="ph-sheet__kicker">PHOTO METADATA</text>
						<text class="ph-sheet__title">照片信息</text>
					</view>
					<view class="ph-sheet__close" @tap="closeInfoSheet">
						<text class="ph-sheet__close-txt">✕</text>
					</view>
				</view>

				<view class="ph-sheet__rows">
					<view class="ph-sheet__row">
						<text class="ph-sheet__lbl">记录时间</text>
						<text class="ph-sheet__val">{{ formatFullDate(currentPhoto.taken_date || currentPhoto.create_time) }}</text>
					</view>
					<view v-if="locationLabel" class="ph-sheet__row">
						<text class="ph-sheet__lbl">拍摄地点</text>
						<text class="ph-sheet__val">{{ locationLabel }}</text>
					</view>
					<view class="ph-sheet__row">
						<text class="ph-sheet__lbl">上传者</text>
						<view class="ph-sheet__uploader">
							<image
								v-if="uploaderAvatar"
								class="ph-sheet__ava"
								:src="uploaderAvatar"
								mode="aspectFill"
							></image>
							<text class="ph-sheet__val">{{ uploaderLabel }}</text>
							<text v-if="currentPhoto.is_self === true" class="ph-sheet__me">我</text>
						</view>
					</view>
					<view class="ph-sheet__row">
						<text class="ph-sheet__lbl">媒体格式</text>
						<text class="ph-sheet__val">{{ mediaTypeLabel }}</text>
					</view>
					<view v-if="dimensionLabel" class="ph-sheet__row">
						<text class="ph-sheet__lbl">分辨率</text>
						<text class="ph-sheet__val">{{ dimensionLabel }}</text>
					</view>
					<view v-if="fileSizeLabel" class="ph-sheet__row">
						<text class="ph-sheet__lbl">文件大小</text>
						<text class="ph-sheet__val">{{ fileSizeLabel }}</text>
					</view>
					<view v-if="updatedTimeLabel" class="ph-sheet__row">
						<text class="ph-sheet__lbl">最近编辑</text>
						<text class="ph-sheet__val">{{ updatedTimeLabel }}</text>
					</view>
					<view v-if="album.title" class="ph-sheet__row ph-sheet__row--last">
						<text class="ph-sheet__lbl">所属相册</text>
						<text class="ph-sheet__val">{{ album.title }}</text>
					</view>
				</view>

				<view class="ph-sheet__foot">
					<noir-button text="编辑标签" variant="ghost" size="sm" @click="handleEditTagsFromSheet" />
					<noir-button text="编辑文字描述" variant="primary" size="sm" @click="handleEditFromSheet" />
				</view>
			</view>
		</view>

		<!-- 描述与标签暗夜 NOIR 编辑抽屉 -->
		<view
			v-if="editSheetMode && currentPhoto"
			class="ph-sheet-mask"
			@tap="closeEditSheet"
			@touchmove.stop.prevent
		>
			<view class="ph-sheet ph-edit-sheet" @tap.stop>
				<view class="ph-sheet__head">
					<view>
						<text class="ph-sheet__kicker">{{ editSheetMode === 'tags' ? 'EDIT TAGS' : 'EDIT STORY' }}</text>
						<text class="ph-sheet__title">{{ editSheetMode === 'tags' ? '编辑照片标签' : '编辑文字描述' }}</text>
					</view>
					<view class="ph-sheet__close" @tap="closeEditSheet">
						<text class="ph-sheet__close-txt">✕</text>
					</view>
				</view>

				<!-- 描述编辑态 -->
				<template v-if="editSheetMode === 'desc'">
					<view class="ph-desc-box">
						<textarea
							class="ph-desc-textarea"
							v-model="editDescDraft"
							placeholder="写下这一刻的故事、心情或小确幸…"
							placeholder-style="color: rgba(245, 237, 228, 0.32);"
							maxlength="500"
							:fixed="true"
							:cursor-spacing="24"
							auto-focus
						/>
						<view class="ph-desc-bar">
							<text class="ph-desc-count">{{ editDescDraft.length }} / 500</text>
							<text v-if="editDescDraft" class="ph-desc-clear" @tap="editDescDraft = ''">清空</text>
						</view>
					</view>

					<view class="ph-sheet__foot">
						<noir-button text="取消" variant="ghost" size="sm" @click="closeEditSheet" />
						<noir-button
							:text="editSaving ? '保存中…' : '保存描述'"
							variant="primary"
							size="sm"
							:disabled="editSaving"
							@click="submitEditDesc"
						/>
					</view>
				</template>

				<!-- 标签编辑态 -->
				<template v-else>
					<view class="ph-edit-sec">
						<view class="ph-edit-sec__head">
							<text class="ph-edit-sec__lbl">已选标签（点击移除）</text>
							<text class="ph-edit-sec__cnt">{{ editTagsDraft.length }} / 10</text>
						</view>
						<view v-if="editTagsDraft.length" class="ph-edit-chips">
							<view
								v-for="(tag, idx) in editTagsDraft"
								:key="tag + '-' + idx"
								class="ph-echip ph-echip--selected"
								@tap="removeDraftTag(tag)"
							>
								<text class="ph-echip__txt">{{ tag }}</text>
								<text class="ph-echip__x">×</text>
							</view>
						</view>
						<text v-else class="ph-edit-empty">暂无标签，可从下方快捷选择或自定义添加</text>
					</view>

					<view class="ph-edit-sec">
						<text class="ph-edit-sec__lbl">快捷推荐</text>
						<view class="ph-edit-chips">
							<view
								v-for="tag in presetTags"
								:key="tag"
								class="ph-echip"
								:class="{ 'is-picked': editTagsDraft.includes(tag) }"
								@tap="toggleDraftTag(tag)"
							>
								<text class="ph-echip__txt">{{ editTagsDraft.includes(tag) ? '✓ ' + tag : '＋ ' + tag }}</text>
							</view>
						</view>
					</view>

					<view class="ph-tag-input-row">
						<input
							class="ph-tag-input"
							v-model="customTagDraft"
							placeholder="输入自定义标签…"
							placeholder-style="color: rgba(245, 237, 228, 0.34);"
							maxlength="16"
							confirm-type="done"
							@confirm="appendCustomDraftTag"
						/>
						<view class="ph-tag-add-btn" @tap="appendCustomDraftTag">
							<text class="ph-tag-add-btn__txt">＋ 添加</text>
						</view>
					</view>

					<view class="ph-sheet__foot">
						<noir-button text="取消" variant="ghost" size="sm" @click="closeEditSheet" />
						<noir-button
							:text="editSaving ? '保存中…' : '保存标签'"
							variant="primary"
							size="sm"
							:disabled="editSaving"
							@click="submitEditTags"
						/>
					</view>
				</template>
			</view>
		</view>

		<!-- 视频全屏播放器 -->
		<love-auto-video
			v-if="activeVideoPhoto && activeVideoPhoto.url"
			ref="detailVideoPlayer"
			class="ph-video-hidden"
			:video-id="'ph-video-' + (activeVideoPhoto._id || 'active')"
			:src="getOriginalUrl(activeVideoPhoto)"
			:poster="getThumbUrl(activeVideoPhoto)"
			object-fit="contain"
			@fullscreenclose="stopVideo"
		></love-auto-video>
	</view>
</template>

<script>
	import { getAlbumApi } from '../../common/api/album.js'
	import { getPhotoApi } from '../../common/api/photo.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const PREFETCH_RADIUS = 10

	function formatDateDot(val) {
		if (!val) return ''
		const d = new Date(val)
		if (Number.isNaN(d.getTime())) return ''
		const y = d.getFullYear()
		const m = `${d.getMonth() + 1}`.padStart(2, '0')
		const day = `${d.getDate()}`.padStart(2, '0')
		return `${y}.${m}.${day}`
	}

	function formatDateTimeFull(val) {
		if (!val) return '未知'
		const d = new Date(val)
		if (Number.isNaN(d.getTime())) return '未知'
		const y = d.getFullYear()
		const m = `${d.getMonth() + 1}`.padStart(2, '0')
		const day = `${d.getDate()}`.padStart(2, '0')
		const hh = `${d.getHours()}`.padStart(2, '0')
		const mm = `${d.getMinutes()}`.padStart(2, '0')
		return `${y}-${m}-${day} ${hh}:${mm}`
	}

	function formatBytes(bytes) {
		const n = Number(bytes || 0)
		if (!(n > 0)) return ''
		if (n < 1024) return `${n} B`
		if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
		return `${(n / (1024 * 1024)).toFixed(2)} MB`
	}

	export default {
		data() {
			return {
				albumId: '',
				initialPhotoId: '',
				filterKey: 'all',
				album: {},
				photoList: [],
				currentIndex: 0,
				page: 1,
				pageSize: 50,
				hasMore: false,
				loading: false,
				loadingMore: false,
				prefetchedUrls: {},
				failedThumbMap: {},
				chromeHidden: false,
				currentImageScale: 1,
				slideZoomVersions: {},
				videoPlaying: false,
				videoMuted: false,
				videoCurrentTime: 0,
				videoDuration: 0,
				videoSeeking: false,
				saving: false,
				infoSheetVisible: false,
				editSheetMode: '',
				editDescDraft: '',
				editTagsDraft: [],
				customTagDraft: '',
				editSaving: false,
				presetTags: ['旅行', '美食', '日常', '纪念', '约会', '风景', '海边', '夜景'],
				activeVideoPhoto: null
			}
		},
		computed: {
			currentPhoto() {
				if (!this.photoList.length) return null
				return this.photoList[this.currentIndex] || this.photoList[0] || null
			},
			navTitle() {
				if (!this.photoList.length) return '照片详情'
				return `${this.currentIndex + 1} / ${this.photoList.length}`
			},
			locationLabel() {
				const loc = this.currentPhoto && this.currentPhoto.location
				if (!loc) return ''
				if (typeof loc === 'string') return loc.trim()
				return String(loc.name || loc.address || '').trim()
			},
			uploaderAvatar() {
				const snap = this.currentPhoto && this.currentPhoto.uploader_snapshot
				return String((snap && snap.avatar_url) || '').trim()
			},
			uploaderLabel() {
				if (!this.currentPhoto) return ''
				const snap = this.currentPhoto.uploader_snapshot
				const nick = String((snap && snap.nickname) || this.currentPhoto.uploader_nickname || '').trim()
				if (nick) return nick
				if (this.currentPhoto.is_self === true) return '我'
				if (this.currentPhoto.is_self === false) return 'TA'
				return '恋人'
			},
			mediaTypeLabel() {
				if (!this.currentPhoto) return ''
				const base = this.isVideo(this.currentPhoto) ? '视频' : '图片'
				const mime = String(this.currentPhoto.mime_type || '').trim()
				const sub = mime.includes('/') ? mime.split('/')[1].toUpperCase() : ''
				return sub ? `${base} · ${sub}` : base
			},
			updatedTimeLabel() {
				if (!this.currentPhoto) return ''
				const created = Number(this.currentPhoto.create_time || 0)
				const updated = Number(this.currentPhoto.update_time || 0)
				if (updated > 0 && Math.abs(updated - created) > 60000) {
					return formatDateTimeFull(updated)
				}
				return ''
			},
			metaKicker() {
				if (!this.currentPhoto) return ''
				const parts = []
				const dateStr = formatDateDot(this.currentPhoto.taken_date || this.currentPhoto.create_time)
				if (dateStr) parts.push(dateStr)
				if (this.locationLabel) parts.push(this.locationLabel)
				parts.push(`${this.uploaderLabel}上传`)
				return parts.join(' · ')
			},
			displayHeadline() {
				if (!this.currentPhoto) return ''
				const desc = String(this.currentPhoto.description || '').trim()
				if (desc) {
					const firstLine = desc.split(/\r?\n/)[0].trim()
					return firstLine.length > 26 ? `${firstLine.slice(0, 26)}…` : firstLine
				}
				return this.album.title || '此刻光阴'
			},
			displayBodyText() {
				if (!this.currentPhoto) return ''
				const desc = String(this.currentPhoto.description || '').trim()
				if (!desc) return ''
				const lines = desc.split(/\r?\n/)
				if (lines.length > 1) {
					return lines.slice(1).join('\n').trim()
				}
				return desc.length > 26 ? desc : ''
			},
			currentTags() {
				const tags = this.currentPhoto && this.currentPhoto.tags
				return Array.isArray(tags) ? tags.filter(Boolean) : []
			},
			dimensionLabel() {
				if (!this.currentPhoto) return ''
				const w = Number(this.currentPhoto.width || 0)
				const h = Number(this.currentPhoto.height || 0)
				return w > 0 && h > 0 ? `${w} × ${h}` : ''
			},
			fileSizeLabel() {
				if (!this.currentPhoto) return ''
				return formatBytes(this.currentPhoto.file_size || this.currentPhoto.size)
			},
			videoSliderValue() {
				if (!(this.videoDuration > 0)) return 0
				return Math.min(this.videoDuration, Math.max(0, Number(this.videoCurrentTime || 0)))
			}
		},
		onLoad(options = {}) {
			if (!requirePageLogin()) return
			this.albumId = String(options.albumId || '').trim()
			this.initialPhotoId = String(options.photoId || '').trim()
			this.filterKey = String(options.filter || 'all').trim() || 'all'
			this.loadPhotos()
		},
		onHide() {
			this.stopVideo()
		},
		onUnload() {
			this.stopVideo()
		},
		methods: {
			isInRenderWindow(idx) {
				return Math.abs(idx - this.currentIndex) <= PREFETCH_RADIUS
			},
			isVideo(photo) {
				return String((photo && photo.media_type) || '').toLowerCase() === 'video'
			},
			getThumbUrl(photo = {}) {
				return String(photo.thumbnail_url || photo.url || '').trim()
			},
			getRawThumbUrl(photo = {}) {
				return String(photo.thumbnail_url || '').trim()
			},
			hasVideoThumb(photo = {}) {
				const thumb = this.getRawThumbUrl(photo)
				if (!thumb) return false
				if (photo._id && this.failedThumbMap[photo._id]) return false
				return true
			},
			getThumbStripSrc(photo = {}) {
				const thumb = this.getRawThumbUrl(photo)
				if (this.isVideo(photo)) {
					return thumb
				}
				if (thumb && !(photo._id && this.failedThumbMap[photo._id])) {
					return thumb
				}
				return this.getOriginalUrl(photo)
			},
			onThumbStripError(photo = {}) {
				if (!photo || !photo._id) return
				if (this.failedThumbMap[photo._id]) return
				this.failedThumbMap = Object.assign({}, this.failedThumbMap, {
					[photo._id]: true
				})
			},
			getOriginalUrl(photo = {}) {
				return String(photo.url || photo.thumbnail_url || '').trim()
			},
			getDisplayUrl(photo = {}) {
				if (this.isVideo(photo)) {
					return this.getThumbUrl(photo)
				}
				return this.getOriginalUrl(photo)
			},
			formatFullDate(val) {
				return formatDateTimeFull(val)
			},
			buildStreamQuery(page = 1) {
				const query = { page, pageSize: this.pageSize }
				if (this.filterKey === 'video') {
					query.mediaType = 'video'
				} else if (this.filterKey === 'favorite') {
					query.isFavorite = true
				} else if (this.filterKey && this.filterKey !== 'all') {
					query.tag = this.filterKey
				}
				return query
			},
			prefetchAround(centerIdx = this.currentIndex) {
				const total = this.photoList.length
				if (!total) return
				const indices = [centerIdx]
				for (let step = 1; step <= PREFETCH_RADIUS; step += 1) {
					if (centerIdx + step < total) indices.push(centerIdx + step)
					if (centerIdx - step >= 0) indices.push(centerIdx - step)
				}
				indices.forEach((idx) => {
					const item = this.photoList[idx]
					if (!item || this.isVideo(item)) return
					const url = this.getOriginalUrl(item)
					if (!url || this.prefetchedUrls[url]) return
					this.prefetchedUrls[url] = true
					if (typeof uni.getImageInfo === 'function') {
						uni.getImageInfo({
							src: url,
							fail: () => {
								delete this.prefetchedUrls[url]
							}
						})
					}
				})
				// 接近尾部前 10 张时自动续拉下一页
				if (this.hasMore && !this.loadingMore && centerIdx >= total - PREFETCH_RADIUS) {
					this.loadMorePhotos()
				}
			},
			async loadMorePhotos() {
				if (!this.hasMore || this.loadingMore) return
				this.loadingMore = true
				const nextPage = this.page + 1
				try {
					if (this.albumId) {
						const res = await getAlbumApi().getDetail({
							albumId: this.albumId,
							photoPage: nextPage,
							photoPageSize: this.pageSize
						})
						const data = (res && res.data) || {}
						const more = Array.isArray(data.photos) ? data.photos : []
						const pg = data.pagination || {}
						this.appendUniquePhotos(more)
						this.page = nextPage
						this.hasMore = Boolean(pg.hasMore)
					} else {
						const res = await getPhotoApi().getList(this.buildStreamQuery(nextPage))
						const data = (res && res.data) || {}
						const more = Array.isArray(data.list) ? data.list : []
						const pg = data.pagination || {}
						this.appendUniquePhotos(more)
						this.page = nextPage
						this.hasMore = Boolean(pg.hasMore)
					}
					this.prefetchAround(this.currentIndex)
				} catch (e) {
					// silent background pagination failure
				} finally {
					this.loadingMore = false
				}
			},
			appendUniquePhotos(more = []) {
				if (!more.length) return
				const existing = new Set(this.photoList.map((p) => p._id))
				const fresh = more.filter((p) => p && p._id && !existing.has(p._id))
				if (fresh.length) {
					this.photoList = [...this.photoList, ...fresh]
				}
			},
			async loadPhotos() {
				this.loading = true
				this.page = 1
				this.hasMore = false
				try {
					if (this.albumId) {
						const res = await getAlbumApi().getDetail({
							albumId: this.albumId,
							photoPage: 1,
							photoPageSize: this.pageSize
						})
						if (res && res.errCode && res.errCode !== 0) {
							throw new Error(res.errMsg || '加载照片失败')
						}
						const data = res.data || {}
						this.album = data.album || {}
						this.photoList = Array.isArray(data.photos) ? data.photos : []
						this.hasMore = Boolean(data.pagination && data.pagination.hasMore)
					} else {
						const res = await getPhotoApi().getList(this.buildStreamQuery(1))
						if (res && res.errCode && res.errCode !== 0) {
							throw new Error(res.errMsg || '加载照片失败')
						}
						const data = res.data || {}
						const list = Array.isArray(data.list) ? data.list : []
						this.photoList = list
						this.hasMore = Boolean(data.pagination && data.pagination.hasMore)
						if (this.initialPhotoId && !this.photoList.some((p) => p._id === this.initialPhotoId)) {
							const single = await getPhotoApi().getDetail({ photoId: this.initialPhotoId }).catch(() => null)
							const p = single && single.data && (single.data.photo || single.data)
							if (p && p._id) {
								this.photoList = [p, ...this.photoList]
							}
						}
					}

					if (this.initialPhotoId && this.photoList.length) {
						const found = this.photoList.findIndex((p) => p._id === this.initialPhotoId)
						this.currentIndex = found >= 0 ? found : 0
					} else {
						this.currentIndex = 0
					}
					this.$nextTick(() => {
						this.resetVideoStateForCurrent()
						this.prefetchAround(this.currentIndex)
					})
				} catch (error) {
					uni.showToast({ title: error.message || '加载失败', icon: 'none' })
				} finally {
					this.loading = false
				}
			},
			handleSwiperChange(e) {
				const idx = Number((e && e.detail && e.detail.current) || 0)
				if (idx >= 0 && idx < this.photoList.length) {
					const prevIdx = this.currentIndex
					this.pauseInlineVideo()
					this.resetSlideZoom(prevIdx)
					this.currentIndex = idx
					this.currentImageScale = 1
					this.resetSlideZoom(idx)
					this.resetVideoStateForCurrent()
					this.prefetchAround(idx)
				}
			},
			selectIndex(idx) {
				if (idx >= 0 && idx < this.photoList.length) {
					const prevIdx = this.currentIndex
					this.pauseInlineVideo()
					this.resetSlideZoom(prevIdx)
					this.currentIndex = idx
					this.currentImageScale = 1
					this.resetSlideZoom(idx)
					this.resetVideoStateForCurrent()
					this.prefetchAround(idx)
				}
			},
			resetSlideZoom(idx) {
				if (idx === undefined || idx === null || idx < 0) return
				const nextVer = Number(this.slideZoomVersions[idx] || 0) + 1
				this.slideZoomVersions = Object.assign({}, this.slideZoomVersions, {
					[idx]: nextVer
				})
			},
			onImageScale(idx, e) {
				if (idx !== this.currentIndex) return
				const s = Number((e && e.detail && e.detail.scale) || 1)
				this.currentImageScale = s > 0 ? s : 1
			},
			toggleChrome() {
				const nextHidden = !this.chromeHidden
				this.chromeHidden = nextHidden
				if (!nextHidden && this.currentImageScale > 1.01) {
					this.currentImageScale = 1
					this.resetSlideZoom(this.currentIndex)
				}
			},
			formatMediaTime(sec) {
				const s = Math.max(0, Math.floor(Number(sec || 0)))
				const mm = `${Math.floor(s / 60)}`.padStart(2, '0')
				const ss = `${s % 60}`.padStart(2, '0')
				return `${mm}:${ss}`
			},
			getInlineVideoCtx() {
				if (typeof uni.createVideoContext !== 'function') return null
				return uni.createVideoContext(`ph-inline-video-${this.currentIndex}`, this)
			},
			resetVideoStateForCurrent() {
				this.videoPlaying = false
				this.videoCurrentTime = 0
				this.videoSeeking = false
				const p = this.currentPhoto
				this.videoDuration = p && this.isVideo(p) ? Math.max(0, Number(p.duration || 0)) : 0
			},
			pauseInlineVideo() {
				const ctx = this.getInlineVideoCtx()
				if (ctx && typeof ctx.pause === 'function') {
					ctx.pause()
				}
				this.videoPlaying = false
			},
			toggleVideoPlay() {
				const ctx = this.getInlineVideoCtx()
				if (!ctx) return
				if (this.videoPlaying) {
					ctx.pause()
				} else {
					ctx.play()
				}
			},
			toggleVideoMute() {
				this.videoMuted = !this.videoMuted
			},
			requestVideoFullscreen() {
				const ctx = this.getInlineVideoCtx()
				if (ctx && typeof ctx.requestFullScreen === 'function') {
					ctx.requestFullScreen()
				}
			},
			onVideoPlay() {
				this.videoPlaying = true
			},
			onVideoPause() {
				this.videoPlaying = false
			},
			onVideoEnded() {
				this.videoPlaying = false
				this.videoCurrentTime = 0
			},
			onVideoLoadedMeta(e) {
				const d = Number((e && e.detail && e.detail.duration) || 0)
				if (d > 0) this.videoDuration = d
			},
			onVideoTimeUpdate(e) {
				if (this.videoSeeking) return
				const cur = Number((e && e.detail && e.detail.currentTime) || 0)
				const dur = Number((e && e.detail && e.detail.duration) || 0)
				if (dur > 0) this.videoDuration = dur
				this.videoCurrentTime = cur
			},
			onVideoSliderChanging(e) {
				this.videoSeeking = true
				this.videoCurrentTime = Number((e && e.detail && e.detail.value) || 0)
			},
			onVideoSliderChange(e) {
				const target = Number((e && e.detail && e.detail.value) || 0)
				this.videoCurrentTime = target
				this.videoSeeking = false
				const ctx = this.getInlineVideoCtx()
				if (ctx && typeof ctx.seek === 'function') {
					ctx.seek(target)
				}
			},
			handleStageTap(photo) {
				if (!photo) return
				if (this.isVideo(photo)) {
					this.toggleVideoPlay()
					return
				}
				const url = this.getOriginalUrl(photo)
				if (!url) return
				uni.previewImage({
					urls: [url],
					current: url
				})
			},
			playCurrentVideo(photo) {
				if (!photo) return
				this.toggleVideoPlay()
			},
			stopVideo() {
				this.pauseInlineVideo()
				const ref = this.$refs.detailVideoPlayer
				const player = Array.isArray(ref) ? ref[0] : ref
				if (player && typeof player.pause === 'function') {
					player.pause()
				}
				this.activeVideoPhoto = null
			},
			async handleToggleFavorite() {
				const photo = this.currentPhoto
				if (!photo || !photo._id) return
				const prev = Boolean(photo.is_favorite)
				photo.is_favorite = !prev
				try {
					const res = await getPhotoApi().toggleFavorite({ photoId: photo._id })
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '操作失败')
					}
					uni.showToast({ title: photo.is_favorite ? '已加入喜欢' : '已取消喜欢', icon: 'none' })
				} catch (error) {
					photo.is_favorite = prev
					uni.showToast({ title: error.message || '操作失败', icon: 'none' })
				}
			},
			handleSaveMedia() {
				const photo = this.currentPhoto
				if (!photo || this.saving) return
				const url = this.getOriginalUrl(photo)
				if (!url) {
					uni.showToast({ title: '媒体地址无效', icon: 'none' })
					return
				}
				this.saving = true
				uni.showLoading({ title: '保存中...', mask: true })
				uni.downloadFile({
					url,
					success: (dlRes) => {
						if (dlRes.statusCode !== 200 || !dlRes.tempFilePath) {
							uni.showToast({ title: '下载失败', icon: 'none' })
							return
						}
						const saveFn = this.isVideo(photo) ? uni.saveVideoToPhotosAlbum : uni.saveImageToPhotosAlbum
						saveFn({
							filePath: dlRes.tempFilePath,
							success: () => {
								uni.showToast({ title: '已保存到相册', icon: 'success' })
							},
							fail: () => {
								uni.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
							}
						})
					},
					fail: () => {
						uni.showToast({ title: '下载失败', icon: 'none' })
					},
					complete: () => {
						this.saving = false
						uni.hideLoading()
					}
				})
			},
			handleAddTag() {
				const photo = this.currentPhoto
				if (!photo || !photo._id) return
				this.editTagsDraft = [...this.currentTags]
				this.customTagDraft = ''
				this.editSheetMode = 'tags'
			},
			confirmRemoveTag(tag) {
				const photo = this.currentPhoto
				if (!photo || !photo._id) return
				uni.showActionSheet({
					itemList: [`删除标签「${tag}」`],
					itemColor: '#E2643F',
					success: async (res) => {
						if (Number(res.tapIndex) !== 0) return
						const nextTags = this.currentTags.filter((item) => item !== tag)
						await this.updatePhotoMeta(photo, { tags: nextTags }, '已删除标签')
					}
				})
			},
			handleEditDescription() {
				const photo = this.currentPhoto
				if (!photo || !photo._id) return
				this.editDescDraft = String(photo.description || '')
				this.editSheetMode = 'desc'
			},
			closeEditSheet() {
				if (this.editSaving) return
				this.editSheetMode = ''
				this.customTagDraft = ''
			},
			toggleDraftTag(tag) {
				if (this.editTagsDraft.includes(tag)) {
					this.editTagsDraft = this.editTagsDraft.filter((t) => t !== tag)
					return
				}
				if (this.editTagsDraft.length >= 10) {
					uni.showToast({ title: '最多添加 10 个标签', icon: 'none' })
					return
				}
				this.editTagsDraft = [...this.editTagsDraft, tag]
			},
			removeDraftTag(tag) {
				this.editTagsDraft = this.editTagsDraft.filter((t) => t !== tag)
			},
			appendCustomDraftTag() {
				const tag = String(this.customTagDraft || '').trim()
				if (!tag) return
				if (this.editTagsDraft.includes(tag)) {
					uni.showToast({ title: '标签已存在', icon: 'none' })
					return
				}
				if (this.editTagsDraft.length >= 10) {
					uni.showToast({ title: '最多添加 10 个标签', icon: 'none' })
					return
				}
				this.editTagsDraft = [...this.editTagsDraft, tag]
				this.customTagDraft = ''
			},
			async submitEditDesc() {
				const photo = this.currentPhoto
				if (!photo || !photo._id || this.editSaving) return
				this.editSaving = true
				const ok = await this.updatePhotoMeta(
					photo,
					{ description: String(this.editDescDraft || '').trim() },
					'描述已更新'
				)
				this.editSaving = false
				if (ok) {
					this.editSheetMode = ''
				}
			},
			async submitEditTags() {
				const photo = this.currentPhoto
				if (!photo || !photo._id || this.editSaving) return
				this.editSaving = true
				const ok = await this.updatePhotoMeta(
					photo,
					{ tags: [...this.editTagsDraft] },
					'标签已更新'
				)
				this.editSaving = false
				if (ok) {
					this.editSheetMode = ''
				}
			},
			async updatePhotoMeta(photo, payload, successMsg) {
				try {
					const res = await getPhotoApi().update(Object.assign({ photoId: photo._id }, payload))
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '更新失败')
					}
					Object.assign(photo, payload)
					uni.showToast({ title: successMsg, icon: 'success' })
					return true
				} catch (error) {
					uni.showToast({ title: error.message || '更新失败', icon: 'none' })
					return false
				}
			},
			openInfoSheet() {
				this.infoSheetVisible = true
			},
			closeInfoSheet() {
				this.infoSheetVisible = false
			},
			handleEditFromSheet() {
				this.closeInfoSheet()
				this.handleEditDescription()
			},
			handleEditTagsFromSheet() {
				this.closeInfoSheet()
				this.handleAddTag()
			},
			openMoreMenu() {
				const photo = this.currentPhoto
				if (!photo) return
				const isSelf = photo.is_self === true
				const isVid = this.isVideo(photo)
				const actions = []
				if (isVid) {
					actions.push({ label: '全屏播放视频', fn: () => this.requestVideoFullscreen() })
				}
				actions.push({ label: '编辑文字描述', fn: () => this.handleEditDescription() })
				actions.push({ label: '编辑标签', fn: () => this.handleAddTag() })
				actions.push({ label: '保存到本地', fn: () => this.handleSaveMedia() })
				if (isSelf) {
					actions.push({ label: '删除照片', fn: () => this.confirmDeletePhoto(photo) })
				}
				uni.showActionSheet({
					itemList: actions.map((a) => a.label),
					success: (res) => {
						const act = actions[Number(res.tapIndex)]
						if (act && typeof act.fn === 'function') {
							act.fn()
						}
					}
				})
			},
			confirmDeletePhoto(photo) {
				uni.showModal({
					title: '删除照片',
					content: '删除后不可恢复，确定删除这张照片吗？',
					confirmColor: '#E2643F',
					success: async (res) => {
						if (!res.confirm) return
						try {
							const result = await getPhotoApi().delete({ photoId: photo._id })
							if (result && result.errCode && result.errCode !== 0) {
								throw new Error(result.errMsg || '删除失败')
							}
							this.photoList = this.photoList.filter((item) => item._id !== photo._id)
							if (!this.photoList.length) {
								uni.showToast({ title: '已删除', icon: 'success' })
								setTimeout(() => uni.navigateBack(), 400)
								return
							}
							if (this.currentIndex >= this.photoList.length) {
								this.currentIndex = this.photoList.length - 1
							}
							uni.showToast({ title: '已删除', icon: 'success' })
						} catch (error) {
							uni.showToast({ title: error.message || '删除失败', icon: 'none' })
						}
					}
				})
			}
		}
	}
</script>

<style scoped>
	.ph-page {
		position: relative;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
		background: #0A0807;
	}

	.ph-swiper,
	.ph-slide,
	.ph-empty-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.ph-stage {
		position: relative;
		z-index: 3;
		width: 100%;
		height: 100%;
		padding: 0;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #0A0807;
	}

	.ph-zoom-area,
	.ph-zoom-view,
	.ph-photo,
	.ph-video {
		width: 100%;
		height: 100%;
		display: block;
	}

	.ph-zoom-view {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ph-shade {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 4;
		background: linear-gradient(
			180deg,
			rgba(10, 8, 7, 0.56) 0%,
			rgba(10, 8, 7, 0) 22%,
			rgba(10, 8, 7, 0) 58%,
			rgba(10, 8, 7, 0.90) 100%
		);
		transition: opacity 0.28s ease;
	}

	.ph-shade.is-hidden {
		opacity: 0;
	}

	.ph-more-btn {
		width: 60rpx;
		height: 60rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(245, 237, 228, 0.22);
		background: rgba(17, 13, 11, 0.52);
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	.ph-play-btn {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 5;
		width: 112rpx;
		height: 112rpx;
		border-radius: 50%;
		border: 2rpx solid rgba(216, 176, 140, 0.72);
		background: rgba(17, 13, 11, 0.68);
		box-shadow: 0 10rpx 32rpx rgba(0, 0, 0, 0.48);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ph-play-btn__icon {
		font-size: 38rpx;
		color: var(--noir-text-strong);
		margin-left: 6rpx;
	}

	.ph-center-tip {
		position: absolute;
		inset: 0;
		z-index: 6;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.ph-center-tip__txt {
		font-size: 26rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	/* 底部悬浮容器：自定义视频控制栏 + 文案区 + 缩略图条 */
	.ph-bottom-dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 6;
		padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		pointer-events: none;
	}

	/* 视频自定义控制框 */
	.ph-vctrl {
		margin: 0 28rpx 18rpx;
		padding: 12rpx 18rpx;
		border-radius: 999rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.36);
		background: rgba(20, 16, 14, 0.86);
		box-shadow: 0 10rpx 28rpx rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		gap: 12rpx;
		pointer-events: auto;
		transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.ph-vctrl.is-solo {
		transform: translateY(0);
	}

	.ph-vctrl__btn {
		width: 48rpx;
		height: 48rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(216, 176, 140, 0.12);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ph-vctrl__glyph {
		font-size: 20rpx;
		color: var(--noir-gold-soft);
		line-height: 1;
	}

	.ph-vctrl__time {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: rgba(245, 237, 228, 0.78);
		flex-shrink: 0;
	}

	.ph-vctrl__slider {
		flex: 1;
		margin: 0 4rpx;
	}

	/* 底部文案与操作区（向下消失 / 向上弹出动画） */
	.ph-copy {
		padding: 0 36rpx 22rpx;
		pointer-events: auto;
		transform: translateY(0);
		opacity: 1;
		max-height: 520rpx;
		overflow: hidden;
		transition:
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.24s ease,
			max-height 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			padding 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.ph-copy.is-hidden {
		transform: translateY(110%);
		opacity: 0;
		max-height: 0;
		padding-bottom: 0;
		pointer-events: none;
	}

	.ph-kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		letter-spacing: 2rpx;
		color: var(--noir-gold);
	}

	.ph-title {
		display: block;
		margin-top: 10rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 42rpx;
		font-weight: 600;
		line-height: 1.32;
		color: var(--noir-text-strong);
		text-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.55);
	}

	.ph-text {
		display: block;
		margin-top: 12rpx;
		font-size: 24rpx;
		line-height: 1.68;
		color: rgba(245, 237, 228, 0.68);
	}

	.ph-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
		margin-top: 20rpx;
		align-items: center;
	}

	.ph-tag {
		height: 44rpx;
		padding: 0 18rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(216, 176, 140, 0.12);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.ph-tag--add {
		border-style: dashed;
		border-color: rgba(245, 237, 228, 0.24);
		background: rgba(17, 13, 11, 0.42);
	}

	.ph-tag__txt {
		font-size: 20rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
	}

	.ph-tag--add .ph-tag__txt {
		color: rgba(245, 237, 228, 0.62);
	}

	.ph-acts {
		display: flex;
		align-items: center;
		gap: 16rpx;
		margin-top: 24rpx;
	}

	.ph-abtn {
		height: 60rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(245, 237, 228, 0.22);
		background: rgba(17, 13, 11, 0.58);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10rpx;
		box-sizing: border-box;
	}

	.ph-abtn--coral {
		border-color: rgba(226, 100, 63, 0.56);
		background: rgba(226, 100, 63, 0.20);
	}

	.ph-abtn--gold {
		margin-left: auto;
		border-color: rgba(216, 176, 140, 0.52);
		background: rgba(26, 21, 18, 0.72);
	}

	.ph-abtn__glyph {
		font-size: 24rpx;
		color: var(--noir-gold-soft);
		line-height: 1;
	}

	.ph-abtn__txt {
		font-size: 22rpx;
		color: var(--noir-text);
		white-space: nowrap;
	}

	.ph-abtn--coral .ph-abtn__txt {
		color: var(--noir-coral-light);
	}

	.ph-abtn--gold .ph-abtn__txt {
		color: var(--noir-gold-soft);
	}

	/* 底部缩略图胶片条（向下消失 / 向上弹出动画） */
	.ph-thumbs-scroll {
		width: 100%;
		height: 104rpx;
		white-space: nowrap;
		pointer-events: auto;
		transform: translateY(0);
		opacity: 1;
		transition:
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.24s ease,
			height 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.ph-thumbs-scroll.is-hidden {
		transform: translateY(140%);
		opacity: 0;
		height: 0;
		pointer-events: none;
	}

	.ph-thumbs {
		display: inline-flex;
		align-items: center;
		gap: 14rpx;
		padding: 0 36rpx;
	}

	.ph-thumb {
		position: relative;
		width: 146rpx;
		height: 98rpx;
		border-radius: 16rpx;
		overflow: hidden;
		border: 2rpx solid rgba(255, 255, 255, 0.14);
		opacity: 0.62;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.ph-thumb.is-on {
		opacity: 1;
		border-color: var(--noir-gold);
		box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.48);
	}

	.ph-thumb__img,
	.ph-thumb__video {
		width: 100%;
		height: 100%;
		display: block;
	}

	.ph-thumb__video {
		pointer-events: none;
	}

	.ph-thumb__v {
		position: absolute;
		right: 8rpx;
		bottom: 8rpx;
		width: 30rpx;
		height: 30rpx;
		border-radius: 50%;
		background: rgba(17, 13, 11, 0.74);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ph-thumb__v-txt {
		font-size: 14rpx;
		color: var(--noir-text-strong);
	}

	/* 照片信息底部抽屉 */
	.ph-sheet-mask {
		position: fixed;
		inset: 0;
		z-index: 120;
		background: rgba(8, 6, 5, 0.68);
		display: flex;
		align-items: flex-end;
	}

	.ph-sheet {
		width: 100%;
		padding: 30rpx 32rpx calc(34rpx + env(safe-area-inset-bottom));
		border-radius: 32rpx 32rpx 0 0;
		border-top: 1rpx solid rgba(216, 176, 140, 0.28);
		background: var(--noir-surface);
		box-sizing: border-box;
	}

	.ph-sheet__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20rpx;
	}

	.ph-sheet__kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 17rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.66);
	}

	.ph-sheet__title {
		display: block;
		margin-top: 4rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 34rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ph-sheet__close {
		width: 56rpx;
		height: 56rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ph-sheet__close-txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.7);
	}

	.ph-sheet__rows {
		border-radius: 22rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.07);
		background: rgba(255, 255, 255, 0.025);
		padding: 0 24rpx;
	}

	.ph-sheet__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		padding: 22rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.ph-sheet__row--last {
		border-bottom: none;
	}

	.ph-sheet__lbl {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.48);
		flex-shrink: 0;
	}

	.ph-sheet__val {
		font-size: 24rpx;
		color: var(--noir-text-strong);
		text-align: right;
	}

	.ph-sheet__uploader {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.ph-sheet__ava {
		width: 40rpx;
		height: 40rpx;
		border-radius: 50%;
		border: 1.5rpx solid rgba(216, 176, 140, 0.48);
		background: var(--noir-surface-2);
		flex-shrink: 0;
	}

	.ph-sheet__me {
		padding: 2rpx 10rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.42);
		background: rgba(216, 176, 140, 0.14);
		font-size: 18rpx;
		color: var(--noir-gold-soft);
		line-height: 1.4;
	}

	.ph-sheet__foot {
		display: flex;
		justify-content: flex-end;
		gap: 16rpx;
		margin-top: 26rpx;
	}

	/* 描述与标签 NOIR 编辑抽屉 */
	.ph-desc-box {
		border-radius: 22rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: rgba(255, 255, 255, 0.032);
		padding: 20rpx 22rpx 16rpx;
	}

	.ph-desc-textarea {
		width: 100%;
		height: 200rpx;
		font-size: 26rpx;
		line-height: 1.65;
		color: var(--noir-text-strong);
	}

	.ph-desc-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 10rpx;
		padding-top: 10rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.ph-desc-count {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.ph-desc-clear {
		font-size: 21rpx;
		color: var(--noir-gold);
	}

	.ph-edit-sec {
		margin-bottom: 22rpx;
	}

	.ph-edit-sec__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14rpx;
	}

	.ph-edit-sec__lbl {
		display: block;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.52);
		margin-bottom: 12rpx;
	}

	.ph-edit-sec__head .ph-edit-sec__lbl {
		margin-bottom: 0;
	}

	.ph-edit-sec__cnt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: var(--noir-gold);
	}

	.ph-edit-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}

	.ph-echip {
		height: 54rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		display: inline-flex;
		align-items: center;
		gap: 8rpx;
	}

	.ph-echip--selected {
		border-color: rgba(216, 176, 140, 0.56);
		background: rgba(216, 176, 140, 0.16);
	}

	.ph-echip.is-picked {
		border-color: rgba(226, 100, 63, 0.52);
		background: rgba(226, 100, 63, 0.16);
	}

	.ph-echip__txt {
		font-size: 22rpx;
		color: var(--noir-text);
	}

	.ph-echip--selected .ph-echip__txt {
		color: var(--noir-text-strong);
	}

	.ph-echip.is-picked .ph-echip__txt {
		color: var(--noir-coral-light);
	}

	.ph-echip__x {
		font-size: 24rpx;
		color: var(--noir-gold);
		line-height: 1;
	}

	.ph-edit-empty {
		display: block;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.34);
		padding: 6rpx 0;
	}

	.ph-tag-input-row {
		display: flex;
		align-items: center;
		gap: 14rpx;
		margin-top: 8rpx;
	}

	.ph-tag-input {
		flex: 1;
		height: 70rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		color: var(--noir-text-strong);
		font-size: 24rpx;
	}

	.ph-tag-add-btn {
		height: 70rpx;
		padding: 0 26rpx;
		border-radius: 999rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.54);
		background: rgba(216, 176, 140, 0.14);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.ph-tag-add-btn__txt {
		font-size: 23rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
	}

	.ph-video-hidden {
		position: fixed;
		left: -9999rpx;
		top: -9999rpx;
		width: 1px;
		height: 1px;
	}
</style>
