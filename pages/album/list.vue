<template>
	<view class="photos-page" :class="themeClass">
		<view class="photos-glow photos-glow--l"></view>
		<view class="photos-glow photos-glow--r"></view>

		<noir-navbar
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		>
			<template #center>
				<text class="ph-nav-title">照片</text>
			</template>
			<template #right>
				<view v-if="photoList.length" class="ph-batch-pill" @tap="toggleBatchMode">
					<text class="ph-batch-pill__txt">{{ batchMode ? '完成' : '批量选择' }}</text>
				</view>
			</template>
		</noir-navbar>

		<view class="a-wrap">
			<!-- 统计头（05 照片与视频流设计稿） -->
			<view class="a-head">
				<view class="a-count">
					<text class="a-count__num">{{ totalCount }}</text>
					<text class="a-count__unit">项 · 含 {{ videoCount }} 段视频</text>
				</view>
				<noir-tag text="单流 · 双人同步" variant="gold" />
			</view>
			<text class="a-sub">按时间与标签浏览 · 每次上传自动同步双人空间</text>

			<!-- 筛选标签行 -->
			<scroll-view scroll-x class="a-filters-scroll" :show-scrollbar="false">
				<view class="a-filters">
					<view
						v-for="chip in filterChips"
						:key="chip.key"
						class="a-chip"
						:class="{ 'is-on': activeFilter === chip.key }"
						@tap="selectFilter(chip.key)"
					>
						<text class="a-chip__txt">{{ chip.label }}</text>
					</view>
				</view>
			</scroll-view>

			<!-- 骨架屏 -->
			<view v-if="loading && !photoList.length" class="a-grid">
				<view class="a-col">
					<view class="a-skel" style="height: 410rpx;"></view>
					<view class="a-skel" style="height: 310rpx;"></view>
				</view>
				<view class="a-col">
					<view class="a-skel" style="height: 300rpx;"></view>
					<view class="a-skel" style="height: 400rpx;"></view>
				</view>
			</view>

			<!-- 空态 -->
			<noir-empty
				v-else-if="!loading && !photoList.length"
				kicker="PHOTOS & VIDEO"
				:title="activeFilter === 'all' ? '还没有照片或视频' : '该分类下暂无内容'"
				:desc="activeFilter === 'all' ? '点击下方上传你们的第一张照片或视频，每张可得 +5 心动点' : '切换其他标签，或上传一张带该标签的新照片'"
				:action-text="activeFilter === 'all' ? '＋ 立即上传' : '查看全部'"
				@action="activeFilter === 'all' ? goUpload() : selectFilter('all')"
			/>

			<!-- 双列错落瀑布流（首个分页数据之后展示广告位，后续分页顺延在广告下方） -->
			<template v-else>
				<template v-for="section in photoSections" :key="section.key">
					<view class="a-grid">
						<view class="a-col">
							<view
								v-for="(item, idx) in section.left"
								:key="item._id"
								class="a-ph"
								:class="{ 'is-selected': isSelected(item._id) }"
								:style="{ height: getCardHeight(item, idx, 'left') }"
								@tap="handlePhotoTap(item)"
								@longpress="handlePhotoLongPress(item)"
							>
								<image
									v-if="!isVideo(item) || hasVideoThumb(item)"
									class="a-ph__img"
									:src="isVideo(item) ? getVideoThumbUrl(item) : getThumbUrl(item)"
									mode="aspectFill"
									lazy-load
									@error="onMediaThumbError(item)"
								></image>
								<video
									v-else
									class="a-ph__video"
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
								<view v-if="isVideo(item)" class="a-vbadge">
									<text class="a-vbadge__txt">▶ {{ formatDuration(item.duration) }}</text>
								</view>
								<view v-if="batchMode" class="a-check" :class="{ 'is-on': isSelected(item._id) }">
									<text v-if="isSelected(item._id)" class="a-check__tick">✓</text>
								</view>
								<view class="a-shade"></view>
								<text class="a-date">{{ formatDateDot(item.taken_date || item.create_time) }}</text>
								<text v-if="item.is_favorite" class="a-like">♥</text>
							</view>
						</view>

						<view class="a-col">
							<view
								v-for="(item, idx) in section.right"
								:key="item._id"
								class="a-ph"
								:class="{ 'is-selected': isSelected(item._id) }"
								:style="{ height: getCardHeight(item, idx, 'right') }"
								@tap="handlePhotoTap(item)"
								@longpress="handlePhotoLongPress(item)"
							>
								<image
									v-if="!isVideo(item) || hasVideoThumb(item)"
									class="a-ph__img"
									:src="isVideo(item) ? getVideoThumbUrl(item) : getThumbUrl(item)"
									mode="aspectFill"
									lazy-load
									@error="onMediaThumbError(item)"
								></image>
								<video
									v-else
									class="a-ph__video"
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
								<view v-if="isVideo(item)" class="a-vbadge">
									<text class="a-vbadge__txt">▶ {{ formatDuration(item.duration) }}</text>
								</view>
								<view v-if="batchMode" class="a-check" :class="{ 'is-on': isSelected(item._id) }">
									<text v-if="isSelected(item._id)" class="a-check__tick">✓</text>
								</view>
								<view class="a-shade"></view>
								<text class="a-date">{{ formatDateDot(item.taken_date || item.create_time) }}</text>
								<text v-if="item.is_favorite" class="a-like">♥</text>
							</view>
						</view>
					</view>

					<!-- 广告位展示在第一个分页数据之后 -->
					<view v-if="section.showAdAfter" class="ad-view">
						<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
					</view>
				</template>
			</template>

			<view v-if="loading && photoList.length" class="a-foot-tip">
				<text class="a-foot-tip__txt">正在加载更多…</text>
			</view>
			<view v-else-if="!pagination.hasMore && photoList.length" class="a-foot-tip">
				<text class="a-foot-tip__txt">已经到底了</text>
			</view>
		</view>

		<!-- 底部固定操作栏 -->
		<view class="a-bottom-bar">
			<template v-if="batchMode">
				<view class="a-batch-bar">
					<text class="a-batch-bar__count">已选 {{ selectedIds.length }} 项</text>
					<view class="a-batch-bar__acts">
						<noir-button
							text="加标签"
							variant="ghost"
							size="sm"
							:disabled="!selectedIds.length"
							@click="handleBatchAddTag"
						/>
						<noir-button
							text="删除所选"
							variant="danger"
							size="sm"
							:disabled="!selectedIds.length"
							@click="handleBatchDelete"
						/>
					</view>
				</view>
			</template>
			<template v-else>
				<noir-button
					text="＋ 上传照片 / 视频 (每张 +5点)"
					variant="primary"
					size="lg"
					block
					@click="goUpload"
				/>
			</template>
		</view>

		<love-couple-guide scene="album" :active="noCouple" />
	</view>
</template>

<script>
	import { getThemeCoral } from '@/common/theme.js'
	import { getPhotoApi } from '../../common/api/photo.js'
	import { requirePageLogin } from '@/common/auth-entry.js'
	import { useAppStateStore } from '@/store/app-state.js'

	const FILTER_CHIPS = [
		{ key: 'all', label: '全部' },
		{ key: '旅行', label: '旅行' },
		{ key: '美食', label: '美食' },
		{ key: '日常', label: '日常' },
		{ key: 'favorite', label: '喜欢' },
		{ key: 'video', label: '视频' }
	]

	const LEFT_HEIGHTS = [416, 326, 260, 380, 310]
	const RIGHT_HEIGHTS = [312, 408, 286, 344, 392]

	export default {
		data() {
			return {
				scrollTop: 0,
				filterChips: FILTER_CHIPS,
				activeFilter: 'all',
				photoList: [],
				totalCount: 0,
				videoCount: 0,
				loading: false,
				noCouple: false,
				hasInitialized: false,
				needRefreshOnShow: false,
				batchMode: false,
				selectedIds: [],
				failedThumbMap: {},
				pagination: {
					page: 1,
					pageSize: 20,
					total: 0,
					hasMore: true
				}
			}
		},
		computed: {
			photoSections() {
				const size = Math.max(1, Number((this.pagination && this.pagination.pageSize) || 20))
				const firstPage = this.photoList.slice(0, size)
				const restPages = this.photoList.slice(size)
				const sections = []
				if (firstPage.length) {
					sections.push({
						key: 'page-1',
						left: firstPage.filter((_, i) => i % 2 === 0),
						right: firstPage.filter((_, i) => i % 2 === 1),
						showAdAfter: true
					})
				}
				if (restPages.length) {
					sections.push({
						key: 'page-more',
						left: restPages.filter((_, i) => i % 2 === 0),
						right: restPages.filter((_, i) => i % 2 === 1),
						showAdAfter: false
					})
				}
				return sections
			}
		},
		onLoad() {
			if (!requirePageLogin()) return
			this.syncCoupleGuide()
			this.loadPhotoList(true).finally(() => {
				this.hasInitialized = true
			})
		},
		onShow() {
			if (!this.hasInitialized) return
			if (this.needRefreshOnShow) {
				this.needRefreshOnShow = false
				this.loadPhotoList(true)
			}
		},
		onPageScroll(e) {
			const next = Math.max(0, Number((e && e.scrollTop) || 0))
			if (next !== this.scrollTop) {
				this.scrollTop = next
			}
		},
		onPullDownRefresh() {
			this.loadPhotoList(true).finally(() => {
				uni.stopPullDownRefresh()
			})
		},
		onReachBottom() {
			if (this.pagination.hasMore && !this.loading) {
				this.loadPhotoList(false)
			}
		},
		methods: {
			async syncCoupleGuide() {
				try {
					const store = useAppStateStore()
					await store.fetchCoupleCenter({ force: false })
					this.noCouple = !(store.coupleCenterData && store.coupleCenterData.activeCouple)
				} catch (e) {
					// ignore
				}
			},
			isVideo(item) {
				return String((item && item.media_type) || '').toLowerCase() === 'video'
			},
			getOriginalUrl(item = {}) {
				return String(item.url || item.thumbnail_url || '').trim()
			},
			getVideoThumbUrl(item = {}) {
				return String(item.thumbnail_url || '').trim()
			},
			hasVideoThumb(item = {}) {
				const thumb = this.getVideoThumbUrl(item)
				if (!thumb) return false
				if (item._id && this.failedThumbMap[item._id]) return false
				return true
			},
			onMediaThumbError(item = {}) {
				if (this.isVideo(item) && item._id) {
					this.failedThumbMap = Object.assign({}, this.failedThumbMap, {
						[item._id]: true
					})
				}
			},
			getThumbUrl(item = {}) {
				return String(item.thumbnail_url || item.url || '').trim()
			},
			getCardHeight(item, idx, col) {
				const w = Number(item && item.width || 0)
				const h = Number(item && item.height || 0)
				if (w > 0 && h > 0) {
					const ratio = Math.min(1.55, Math.max(0.75, h / w))
					return `${Math.round(330 * ratio)}rpx`
				}
				const arr = col === 'left' ? LEFT_HEIGHTS : RIGHT_HEIGHTS
				return `${arr[idx % arr.length]}rpx`
			},
			formatDateDot(val) {
				if (!val) return ''
				const d = new Date(val)
				if (Number.isNaN(d.getTime())) return ''
				const y = d.getFullYear()
				const m = `${d.getMonth() + 1}`.padStart(2, '0')
				const day = `${d.getDate()}`.padStart(2, '0')
				return `${y}.${m}.${day}`
			},
			formatDuration(sec) {
				const s = Math.max(0, Math.round(Number(sec || 0)))
				if (!s) return '视频'
				const mm = `${Math.floor(s / 60)}`.padStart(2, '0')
				const ss = `${s % 60}`.padStart(2, '0')
				return `${mm}:${ss}`
			},
			async loadPhotoList(reset = false) {
				if (this.loading) return
				if (reset) {
					this.pagination.page = 1
					this.pagination.hasMore = true
				}
				this.loading = true
				try {
					const query = {
						page: this.pagination.page,
						pageSize: this.pagination.pageSize
					}
					if (this.activeFilter === 'video') {
						query.mediaType = 'video'
					} else if (this.activeFilter === 'favorite') {
						query.isFavorite = true
					} else if (this.activeFilter !== 'all') {
						query.tag = this.activeFilter
					}

					const res = await getPhotoApi().getList(query)
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '加载照片失败')
					}
					const data = res.data || {}
					const list = Array.isArray(data.list) ? data.list : []
					const pg = data.pagination || {}

					this.photoList = reset ? list : [...this.photoList, ...list]
					this.pagination = {
						page: (pg.page || this.pagination.page) + (pg.hasMore ? 1 : 0),
						pageSize: pg.pageSize || this.pagination.pageSize,
						total: Number(pg.total || 0),
						hasMore: Boolean(pg.hasMore)
					}
					if (reset) {
						this.totalCount = Number(pg.total || list.length || 0)
						if (typeof data.videoCount === 'number') {
							this.videoCount = data.videoCount
						} else {
							this.videoCount = list.filter((item) => this.isVideo(item)).length
						}
					}
				} catch (error) {
					uni.showToast({ title: error.message || '加载失败', icon: 'none' })
				} finally {
					this.loading = false
				}
			},
			selectFilter(key) {
				if (this.activeFilter === key) return
				this.activeFilter = key
				this.selectedIds = []
				this.loadPhotoList(true)
			},
			toggleBatchMode() {
				this.batchMode = !this.batchMode
				this.selectedIds = []
			},
			isSelected(id) {
				return this.selectedIds.includes(id)
			},
			toggleSelect(id) {
				if (!id) return
				if (this.isSelected(id)) {
					this.selectedIds = this.selectedIds.filter((x) => x !== id)
				} else {
					this.selectedIds = [...this.selectedIds, id]
				}
			},
			handlePhotoTap(item) {
				if (!item || !item._id) return
				if (this.batchMode) {
					this.toggleSelect(item._id)
					return
				}
				this.needRefreshOnShow = true
				uni.navigateTo({
					url: `/pages/album/photo-detail?photoId=${encodeURIComponent(item._id)}&filter=${encodeURIComponent(this.activeFilter)}`
				})
			},
			handlePhotoLongPress(item) {
				if (!item || !item._id) return
				if (!this.batchMode) {
					this.batchMode = true
					this.selectedIds = [item._id]
				}
			},
			goUpload() {
				this.needRefreshOnShow = true
				uni.navigateTo({
					url: '/pages/album/upload'
				})
			},
			handleBatchAddTag() {
				if (!this.selectedIds.length) return
				uni.showModal({
					title: `为 ${this.selectedIds.length} 项添加标签`,
					editable: true,
					placeholderText: '例如：旅行、美食、日常',
					confirmColor: getThemeCoral(),
					success: async (res) => {
						if (!res.confirm) return
						const tag = String(res.content || '').trim()
						if (!tag) return
						uni.showLoading({ title: '处理中...', mask: true })
						let ok = 0
						for (const id of this.selectedIds) {
							const item = this.photoList.find((p) => p._id === id)
							const prevTags = Array.isArray(item && item.tags) ? item.tags : []
							if (prevTags.includes(tag)) {
								ok += 1
								continue
							}
							const nextTags = [...prevTags, tag].slice(0, 10)
							try {
								const r = await getPhotoApi().update({ photoId: id, tags: nextTags })
								if (!r || !r.errCode || r.errCode === 0) {
									if (item) item.tags = nextTags
									ok += 1
								}
							} catch (e) {
								// continue
							}
						}
						uni.hideLoading()
						this.batchMode = false
						this.selectedIds = []
						uni.showToast({ title: `已为 ${ok} 项添加标签`, icon: 'success' })
					}
				})
			},
			handleBatchDelete() {
				if (!this.selectedIds.length) return
				const ownIds = this.selectedIds.filter((id) => {
					const item = this.photoList.find((p) => p._id === id)
					return item && item.is_self === true
				})
				if (!ownIds.length) {
					uni.showToast({ title: '仅支持删除本人上传的照片', icon: 'none' })
					return
				}
				uni.showModal({
					title: '批量删除',
					content: `确定删除选中的 ${ownIds.length} 项本人上传的照片/视频吗？删除后不可恢复。`,
					confirmColor: getThemeCoral(),
					success: async (res) => {
						if (!res.confirm) return
						uni.showLoading({ title: '删除中...', mask: true })
						let deleted = 0
						for (const id of ownIds) {
							try {
								const r = await getPhotoApi().delete({ photoId: id })
								if (!r || !r.errCode || r.errCode === 0) {
									deleted += 1
								}
							} catch (e) {
								// continue
							}
						}
						uni.hideLoading()
						this.batchMode = false
						this.selectedIds = []
						uni.showToast({ title: `已删除 ${deleted} 项`, icon: 'success' })
						this.loadPhotoList(true)
					}
				})
			}
		}
	}
</script>

<style scoped>
	.photos-page {
		position: relative;
		min-height: 100vh;
		background:
			radial-gradient(88% 40% at 50% 0%, var(--noir-page-glow) 0%, rgba(var(--noir-bg-rgb), 0) 68%),
			var(--noir-bg);
		padding-bottom: calc(164rpx + env(safe-area-inset-bottom));
		overflow-x: hidden;
	}

	.photos-glow {
		position: fixed;
		width: 360rpx;
		height: 360rpx;
		border-radius: 50%;
		filter: blur(50rpx);
		opacity: 0.22;
		pointer-events: none;
		z-index: 0;
	}

	.photos-glow--l {
		top: -120rpx;
		left: -130rpx;
		background: rgba(var(--noir-coral-rgb), 0.36);
	}

	.photos-glow--r {
		top: 240rpx;
		right: -130rpx;
		background: rgba(var(--noir-gold-rgb), 0.24);
	}

	.ph-nav-title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		letter-spacing: 3rpx;
		color: var(--noir-text-strong);
	}

	.ph-batch-pill {
		height: 50rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.44);
		background: rgba(var(--noir-surface2-rgb), 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ph-batch-pill__txt {
		font-size: 21rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
	}

	.a-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 28rpx 0;
	}

	.a-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12rpx;
	}

	.a-count {
		display: flex;
		align-items: baseline;
		gap: 12rpx;
	}

	.a-count__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 68rpx;
		line-height: 0.96;
		font-weight: 500;
		color: var(--noir-text-strong);
	}

	.a-count__unit {
		font-size: 22rpx;
		color: rgba(var(--noir-text-rgb), 0.52);
	}

	.a-sub {
		display: block;
		margin-top: 10rpx;
		font-size: 21rpx;
		color: var(--noir-text-muted);
	}

	.a-filters-scroll {
		margin-top: 22rpx;
		white-space: nowrap;
	}

	.a-filters {
		display: inline-flex;
		align-items: center;
		gap: 12rpx;
		padding-bottom: 4rpx;
	}

	.a-chip {
		height: 56rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.10);
		background: var(--noir-surface-glass);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.a-chip.is-on {
		border-color: rgba(var(--noir-gold-rgb), 0.56);
		background: rgba(var(--noir-gold-rgb), 0.16);
	}

	.a-chip__txt {
		font-size: 22rpx;
		color: var(--noir-text-sub);
		white-space: nowrap;
	}

	.a-chip.is-on .a-chip__txt {
		color: var(--noir-text-strong);
		font-weight: 500;
	}

	/* 双列错落瀑布流 */
	.a-grid {
		display: flex;
		align-items: flex-start;
		gap: 18rpx;
		margin-top: 22rpx;
	}

	.a-col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 18rpx;
	}

	.a-ph {
		position: relative;
		width: 100%;
		border-radius: 26rpx;
		overflow: hidden;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-surface);
		box-sizing: border-box;
	}

	.a-ph.is-selected {
		border: 3rpx solid var(--noir-gold);
	}

	.a-ph__img,
	.a-ph__video {
		width: 100%;
		height: 100%;
		display: block;
	}

	.a-ph__video {
		pointer-events: none;
	}

	.a-shade {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(
			180deg,
			rgba(var(--noir-shadow-rgb), 0) 52%,
			rgba(var(--noir-shadow-rgb), 0.24) 78%,
			rgba(var(--noir-shadow-rgb), 0.68) 100%
		);
	}

	.a-date {
		position: absolute;
		left: 18rpx;
		bottom: 14rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: var(--noir-on-media);
		text-shadow: 0 2rpx 8rpx rgba(var(--noir-shadow-rgb), 0.48);
	}

	.a-like {
		position: absolute;
		right: 18rpx;
		bottom: 12rpx;
		font-size: 22rpx;
		color: var(--noir-on-media-accent);
		text-shadow: 0 2rpx 8rpx rgba(var(--noir-shadow-rgb), 0.48);
	}

	.a-vbadge {
		position: absolute;
		top: 14rpx;
		right: 14rpx;
		height: 38rpx;
		padding: 0 14rpx;
		border-radius: 999rpx;
		background: rgba(var(--noir-shadow-rgb), 0.62);
		border: 1rpx solid var(--noir-on-media-line);
		display: flex;
		align-items: center;
	}

	.a-vbadge__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		color: var(--noir-on-media);
	}

	.a-check {
		position: absolute;
		top: 14rpx;
		left: 14rpx;
		width: 40rpx;
		height: 40rpx;
		border-radius: 50%;
		border: 2rpx solid var(--noir-on-media-sub);
		background: rgba(var(--noir-shadow-rgb), 0.46);
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	.a-check.is-on {
		border-color: var(--noir-coral);
		background: var(--noir-coral);
	}

	.a-check__tick {
		font-size: 22rpx;
		font-weight: 700;
		color: var(--noir-white);
	}

	.a-skel {
		width: 100%;
		border-radius: 26rpx;
		background: var(--noir-glass-2);
	}

	.a-foot-tip {
		padding: 30rpx 0 12rpx;
		text-align: center;
	}

	.a-foot-tip__txt {
		font-size: 21rpx;
		color: rgba(var(--noir-text-rgb), 0.34);
	}

	.ad-view {
		margin-top: 18rpx;
	}

	.a-bottom-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		padding: 18rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
		background: linear-gradient(180deg, rgba(var(--noir-bg-rgb), 0) 0%, rgba(var(--noir-bg-rgb), 0.94) 30%, var(--noir-bg) 100%);
		box-sizing: border-box;
	}

	.a-batch-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 22rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.28);
		background: rgba(var(--noir-surface2-rgb), 0.96);
	}

	.a-batch-bar__count {
		font-size: 24rpx;
		color: var(--noir-gold-soft);
	}

	.a-batch-bar__acts {
		display: flex;
		align-items: center;
		gap: 14rpx;
	}
</style>
