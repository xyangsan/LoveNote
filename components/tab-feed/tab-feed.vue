<template>
	<view class="tab-feed">
		<noir-navbar :show-back="false" :transparent="true" :placeholder="false" :border="false" :scroll-top="scrollTop">
			<template #left>
				<view class="tf-brand">
					<text class="tf-brand__title">双人日常</text>
					<text class="tf-brand__sub">OUR MOMENTS</text>
				</view>
			</template>
			<template #right>
				<view class="tf-nav-actions">
					<view v-if="isLoggedIn" class="tf-cover-btn" @tap="handleChangeCover">
						<text class="tf-cover-btn__txt">{{ coverUploading ? '上传中' : '换封面' }}</text>
					</view>
					<view class="tf-cam-btn" @tap="goPublish">
						<fui-icon name="camera" :size="34" color="#EAD4BC"></fui-icon>
					</view>
				</view>
			</template>
		</noir-navbar>

		<!-- 封面区（全出血延伸至导航栏下方） -->
		<view class="tf-cover" :style="coverStyle">
			<image class="tf-cover__img" :src="coverImage" mode="aspectFill"></image>
			<view class="tf-cover__shade"></view>
			<view class="tf-cover__copy">
				<view class="tf-cover__left">
					<image class="tf-cover__ava" :src="headerAvatar" mode="aspectFill"></image>
					<view>
						<text class="tf-cover__name">{{ headerNickname }}</text>
						<text class="tf-cover__sub">{{ noCouple ? '记录属于自己的时光' : '双人共享 · 一起记录' }}</text>
					</view>
				</view>
				<text class="tf-cover__date">{{ todayLabel }}</text>
			</view>
		</view>

		<view class="tf-body">
			<noir-empty
				v-if="!isLoggedIn"
				kicker="MOMENTS"
				title="登录后查看双人日常"
				desc="完成微信登录后即可发布图文或视频动态"
				action-text="去登录"
				@action="goLogin"
			/>

			<view v-else-if="loading && !postList.length" class="tf-loading">
				<text class="tf-loading__txt">正在加载日常…</text>
			</view>

			<noir-empty
				v-else-if="!postList.length"
				kicker="OUR MOMENTS"
				title="还没有双人日常"
				:desc="noCouple ? '发布第一条日常，绑定情侣后 TA 也能看到' : '发布第一条图文或视频，记录你们的今天'"
				action-text="发布第一条日常"
				@action="goPublish"
			/>

			<view v-else class="tf-list">
				<template v-for="item in displayList" :key="item.key">
					<view v-if="item.type === 'ad'" class="tf-ad-card">
						<!-- #ifdef MP-WEIXIN -->
						<ad unit-id="adunit-230be1ed0ea4b29b" ad-theme="black"></ad>
						<!-- #endif -->
					</view>
					<view v-else class="tf-post">
						<view class="tf-post__head">
							<image
								class="tf-post__ava"
								:src="(item.post.author_snapshot && item.post.author_snapshot.avatar_url) || '/static/user-empty.png'"
								mode="aspectFill"
							></image>
							<view class="tf-post__meta">
								<text class="tf-post__name">{{ (item.post.author_snapshot && item.post.author_snapshot.nickname) || '恋人' }}</text>
								<text class="tf-post__time">{{ formatTime(item.post.create_time) }}{{ locationText(item.post) ? ' · ' + locationText(item.post) : '' }}</text>
							</view>
							<text v-if="item.post.is_self" class="tf-post__del" @tap="handleDelete(item.post)">删除</text>
						</view>

						<text v-if="item.post.content" class="tf-post__content" selectable>{{ item.post.content }}</text>

						<view v-if="isVideoPost(item.post)" class="tf-post__video">
							<love-auto-video
								:video-id="'tf_v_' + item.post._id"
								:src="mediaUrl(item.post.media_list[0])"
								:poster="mediaThumb(item.post.media_list[0])"
								object-fit="contain"
								inline-loop
							/>
						</view>

						<image
							v-else-if="isImagePost(item.post) && item.post.media_list.length === 1"
							class="tf-post__single"
							:src="mediaThumb(item.post.media_list[0])"
							mode="aspectFill"
							@tap="previewImages(item.post, 0)"
						></image>

						<view v-else-if="isImagePost(item.post)" class="tf-post__grid">
							<image
								v-for="(m, idx) in item.post.media_list"
								:key="idx"
								class="tf-post__grid-img"
								:src="mediaThumb(m)"
								mode="aspectFill"
								@tap="previewImages(item.post, idx)"
							></image>
						</view>

						<view class="tf-post__acts">
							<view class="tf-act" :class="{ 'is-on': item.post.is_liked }" @tap="toggleLike(item.post)">
								<text class="tf-act__txt">♥ {{ Number(item.post.like_count || 0) }}</text>
							</view>
							<view class="tf-act" @tap="openComment(item.post)">
								<text class="tf-act__txt">评论 {{ Array.isArray(item.post.comment_list) ? item.post.comment_list.length : 0 }}</text>
							</view>
						</view>

						<view v-if="Array.isArray(item.post.comment_list) && item.post.comment_list.length" class="tf-comments">
							<view
								v-for="c in item.post.comment_list"
								:key="c.comment_id"
								class="tf-citem"
								@tap.stop="openComment(item.post, c)"
								@longpress.stop="handleCommentLongPress(item.post, c)"
							>
								<text class="tf-citem__name">{{ c.nickname || '恋人' }}</text>
								<text v-if="c.reply_to_nickname" class="tf-citem__reply"> 回复 </text>
								<text v-if="c.reply_to_nickname" class="tf-citem__name">{{ c.reply_to_nickname }}</text>
								<text class="tf-citem__name">：</text>
								<text class="tf-citem__txt">{{ c.content }}</text>
							</view>
						</view>
					</view>
				</template>

				<view v-if="hasMore" class="tf-more" @tap="loadMore">
					<text class="tf-more__txt">{{ loading ? '加载中…' : '加载更多' }}</text>
				</view>
				<text v-else class="tf-end">已经到底了</text>
			</view>
		</view>

		<!-- 底部评论输入框 + 表情包面板 -->
		<view v-if="commentTargetId" class="tf-comment-mask" @tap="closeComment" @touchmove.stop.prevent>
			<view class="tf-comment-sheet" :style="commentSheetStyle" @tap.stop>
				<view class="tf-comment-bar">
					<input
						class="tf-comment-input"
						v-model="commentDraft"
						:placeholder="commentPlaceholder"
						confirm-type="send"
						:adjust-position="false"
						:focus="commentInputFocus"
						@focus="onCommentFocus"
						@keyboardheightchange="onKeyboardHeightChange"
						@blur="onCommentBlur"
						@confirm="submitComment"
					/>
					<view class="tf-emoji-btn" :class="{ 'is-active': showEmojiPanel }" @tap.stop="toggleEmojiPanel">
						<fui-icon :name="showEmojiPanel ? 'keyboard' : 'face'" :size="42" color="#EAD4BC"></fui-icon>
					</view>
					<noir-button text="发送" variant="primary" size="xs" @click="submitComment" />
				</view>

				<view v-if="showEmojiPanel" class="tf-emoji-panel">
					<scroll-view scroll-y class="tf-emoji-scroll">
						<view class="tf-emoji-grid">
							<view
								v-for="(item, idx) in emojiList"
								:key="item.unicode || idx"
								class="tf-emoji-item"
								@tap.stop="appendCommentEmoji(item)"
							>
								<text class="tf-emoji-glyph">{{ item.glyph }}</text>
							</view>
						</view>
					</scroll-view>
					<view class="tf-emoji-del" @tap.stop="deleteLastCommentChar">
						<text class="tf-emoji-del__txt">⌫</text>
					</view>
				</view>
			</view>
		</view>

		<love-couple-guide scene="feed" :active="noCouple" />
	</view>
</template>

<script>
	import { DEFAULT_AVATAR, getCachedUserProfile, hasValidLogin } from '../../common/auth-center.js'
	import { getDailyApi } from '../../common/api/daily.js'
	import { getUserApi } from '../../common/api/user.js'
	import { uploadFileWithModule } from '../../common/utils/file-upload.js'
	import { openImageViewer } from '../../common/utils/image-viewer.js'
	import { getNavBarHeight, getNavBarMetrics } from '../../common/utils/nav-bar.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import LoveCoupleGuide from '../love-couple-guide/love-couple-guide.vue'
	import glyph from '../love-editor/glyph.json'

	const DEFAULT_COVER = '/static/images/feed-cover-bg.jpg'
	const AD_SEED_MAX = 2147483647
	const AD_MIN_GAP = 10

	// 广告插入：每 10~20 条动态之间随机插入一条广告（至少间隔 10 条）；总数不足 10 条时在末尾显示一条
	function buildAdPositions(total = 0, seed = 0, hasMore = false) {
		if (total <= 0) {
			return []
		}
		if (total < AD_MIN_GAP) {
			return [total]
		}
		let state = Math.floor(Math.abs(Number(seed) || 0)) % AD_SEED_MAX || 1
		const random = () => {
			state = (state * 48271) % AD_SEED_MAX
			return state / AD_SEED_MAX
		}
		const positions = []
		let cursor = AD_MIN_GAP + Math.floor(random() * 11) // 10~20
		while (cursor <= total) {
			positions.push(cursor)
			cursor += AD_MIN_GAP + Math.floor(random() * 11)
		}
		if (!positions.length && !hasMore) {
			positions.push(total)
		}
		return positions
	}

	export default {
		name: 'TabFeed',
		components: { LoveCoupleGuide },
		props: {
			scrollTop: {
				type: Number,
				default: 0
			}
		},
		emits: ['comment-visible-change'],
		data() {
			return {
				appStateStore: null,
				isLoggedIn: false,
				loading: false,
				noCouple: false,
				postList: [],
				adSeed: Math.floor(Math.random() * AD_SEED_MAX) + 1,
				page: 1,
				hasMore: true,
				headerProfile: {},
				commentTargetId: '',
				commentReplyCommentId: '',
				commentReplyNickname: '',
				commentDraft: '',
				commentInputFocus: false,
				showEmojiPanel: false,
				keyboardHeight: 0,
				emojiList: Array.isArray(glyph) ? glyph : [],
				coverUploading: false,
				navBarHeight: getNavBarHeight(getNavBarMetrics())
			}
		},
		computed: {
			coverStyle() {
				return {
					height: `${this.navBarHeight + 132}px`
				}
			},
			commentSheetStyle() {
				if (!this.showEmojiPanel && this.keyboardHeight > 0) {
					return {
						marginBottom: `${this.keyboardHeight}px`,
						paddingBottom: '0px'
					}
				}
				return {}
			},
			commentPlaceholder() {
				return this.commentReplyNickname ? `回复 ${this.commentReplyNickname}…` : '写一句评论…'
			},
			coverImage() {
				const custom = String((this.headerProfile && this.headerProfile.momentsCoverUrl) || '').trim()
				return custom || DEFAULT_COVER
			},
			headerAvatar() {
				return this.headerProfile.avatarUrl || DEFAULT_AVATAR
			},
			headerNickname() {
				return this.headerProfile.nickname || '双人手札'
			},
			todayLabel() {
				const d = new Date()
				const m = `${d.getMonth() + 1}`.padStart(2, '0')
				const day = `${d.getDate()}`.padStart(2, '0')
				return `${m}.${day}`
			},
			displayList() {
				const posts = Array.isArray(this.postList) ? this.postList : []
				if (!posts.length) return []
				const adPosSet = new Set(buildAdPositions(posts.length, this.adSeed, this.hasMore))
				const result = []
				let adIndex = 0
				for (let i = 0; i < posts.length; i += 1) {
					const post = posts[i]
					result.push({
						type: 'post',
						key: post && post._id ? `post_${post._id}` : `post_idx_${i}`,
						post
					})
					if (adPosSet.has(i + 1)) {
						adIndex += 1
						result.push({
							type: 'ad',
							key: `ad_${this.adSeed}_${adIndex}`
						})
					}
				}
				return result
			}
		},
		mounted() {
			this.refresh({ force: true })
		},
		beforeUnmount() {
			this.$emit('comment-visible-change', false)
		},
		methods: {
			ensureStore() {
				if (!this.appStateStore) this.appStateStore = useAppStateStore()
				return this.appStateStore
			},
			syncHeaderProfile() {
				const store = this.ensureStore()
				const user = store.userInfo || getCachedUserProfile() || {}
				this.isLoggedIn = Boolean(user && user._id) || hasValidLogin()
				this.headerProfile = {
					uid: user._id || '',
					nickname: user.nickname || '双人手札',
					avatarUrl: user.avatarUrl || DEFAULT_AVATAR,
					momentsCoverUrl: user.momentsCoverUrl || ''
				}
			},
			async refresh({ force = true } = {}) {
				const store = this.ensureStore()
				this.syncHeaderProfile()
				if (!this.isLoggedIn) {
					this.postList = []
					return
				}
				store.fetchUserInfo({ force: false }).then(() => {
					this.syncHeaderProfile()
				}).catch(() => {})
				if (force || !this.postList.length) {
					await this.loadList(true)
				}
			},
			async loadList(reset = false) {
				if (this.loading) return
				if (reset) {
					this.page = 1
					this.hasMore = true
					this.adSeed = Math.floor(Math.random() * AD_SEED_MAX) + 1
				}
				this.loading = true
				try {
					const res = await getDailyApi().getList({ page: this.page, pageSize: 10 })
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '加载失败')
					}
					const data = (res && res.data) || {}
					const list = Array.isArray(data.list) ? data.list : []
					this.noCouple = Boolean(data.noCouple || data.isUnbound)
					this.postList = reset ? list : this.postList.concat(list)
					this.hasMore = list.length >= 10
					if (list.length) this.page += 1
				} catch (error) {
					console.warn('tab-feed loadList failed', error)
				} finally {
					this.loading = false
				}
			},
			loadMore() {
				if (this.hasMore && !this.loading) this.loadList(false)
			},
			isVideoPost(post) {
				return Array.isArray(post.media_list) && post.media_list.length > 0 && post.media_list[0].type === 'video'
			},
			isImagePost(post) {
				return Array.isArray(post.media_list) && post.media_list.length > 0 && post.media_list[0].type !== 'video'
			},
			mediaThumb(m = {}) {
				return String(m.thumbnail_url || m.url || '').trim()
			},
			mediaUrl(m = {}) {
				return String(m.url || m.thumbnail_url || '').trim()
			},
			locationText(post = {}) {
				return post.location && post.location.name ? String(post.location.name).trim() : ''
			},
			formatTime(ts) {
				if (!ts) return ''
				const d = new Date(Number(ts))
				if (Number.isNaN(d.getTime())) return ''
				const m = `${d.getMonth() + 1}`.padStart(2, '0')
				const day = `${d.getDate()}`.padStart(2, '0')
				const hh = `${d.getHours()}`.padStart(2, '0')
				const mm = `${d.getMinutes()}`.padStart(2, '0')
				return `${m}-${day} ${hh}:${mm}`
			},
			previewImages(post, idx) {
				const urls = (post.media_list || []).map((m) => this.mediaUrl(m)).filter(Boolean)
				if (urls.length) openImageViewer({ urls, current: idx })
			},
			async toggleLike(post) {
				try {
					const res = await getDailyApi().toggleLike({ postId: post._id })
					if (res && res.data) {
						post.is_liked = Boolean(res.data.is_liked)
						post.like_count = Number(res.data.like_count || 0)
					}
				} catch (error) {
					uni.showToast({ title: '操作失败', icon: 'none' })
				}
			},
			openComment(post, replyComment = null) {
				this.commentTargetId = post._id
				this.commentReplyCommentId = replyComment && replyComment.comment_id ? String(replyComment.comment_id) : ''
				this.commentReplyNickname = replyComment && replyComment.nickname ? String(replyComment.nickname).trim() : ''
				this.commentDraft = ''
				this.showEmojiPanel = false
				this.keyboardHeight = 0
				this.$emit('comment-visible-change', true)
				this.$nextTick(() => {
					this.commentInputFocus = true
				})
			},
			closeComment() {
				this.commentInputFocus = false
				this.showEmojiPanel = false
				this.commentTargetId = ''
				this.commentReplyCommentId = ''
				this.commentReplyNickname = ''
				this.commentDraft = ''
				this.keyboardHeight = 0
				if (typeof uni.hideKeyboard === 'function') {
					uni.hideKeyboard()
				}
				this.$emit('comment-visible-change', false)
			},
			onCommentFocus() {
				this.commentInputFocus = true
				this.showEmojiPanel = false
			},
			onKeyboardHeightChange(event) {
				const h = Number(event && event.detail && event.detail.height || 0)
				this.keyboardHeight = h > 0 ? h : 0
			},
			onCommentBlur() {
				this.commentInputFocus = false
				this.keyboardHeight = 0
			},
			toggleEmojiPanel() {
				if (this.showEmojiPanel) {
					this.showEmojiPanel = false
					this.$nextTick(() => {
						this.commentInputFocus = true
					})
				} else {
					this.commentInputFocus = false
					this.keyboardHeight = 0
					if (typeof uni.hideKeyboard === 'function') {
						uni.hideKeyboard()
					}
					this.showEmojiPanel = true
				}
			},
			appendCommentEmoji(item) {
				const ch = item && typeof item === 'object' ? String(item.glyph || '') : String(item || '')
				if (!ch) return
				this.commentDraft = `${this.commentDraft || ''}${ch}`
			},
			deleteLastCommentChar() {
				const chars = Array.from(String(this.commentDraft || ''))
				if (!chars.length) return
				chars.pop()
				this.commentDraft = chars.join('')
			},
			async submitComment() {
				const content = String(this.commentDraft || '').trim()
				if (!content || !this.commentTargetId) return
				try {
					const res = await getDailyApi().addComment({
						postId: this.commentTargetId,
						content,
						replyToCommentId: this.commentReplyCommentId || ''
					})
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '评论失败')
					}
					this.closeComment()
					this.loadList(true)
				} catch (error) {
					uni.showToast({ title: error.message || '评论失败', icon: 'none' })
				}
			},
			handleCommentLongPress(post, comment) {
				if (!post || !comment || !comment.comment_id) return
				const selfUid = String((this.headerProfile && this.headerProfile.uid) || '').trim()
				if (!selfUid || String(comment.uid || '').trim() !== selfUid) {
					return
				}
				uni.showActionSheet({
					itemList: ['删除评论'],
					itemColor: '#E2643F',
					success: async (res) => {
						if (Number(res.tapIndex) !== 0) return
						try {
							const result = await getDailyApi().deleteComment({
								postId: post._id,
								commentId: comment.comment_id
							})
							if (result && result.errCode && result.errCode !== 0) {
								throw new Error(result.errMsg || '删除评论失败')
							}
							post.comment_list = (Array.isArray(post.comment_list) ? post.comment_list : []).filter(
								(item) => item.comment_id !== comment.comment_id
							)
							post.comment_count = post.comment_list.length
							uni.showToast({ title: '已删除评论', icon: 'success' })
						} catch (error) {
							uni.showToast({ title: error.message || '删除评论失败', icon: 'none' })
						}
					}
				})
			},
			handleDelete(post) {
				uni.showModal({
					title: '删除动态',
					content: '删除后不可恢复，确定删除这条动态吗？',
					confirmColor: '#E2643F',
					success: async (res) => {
						if (!res.confirm) return
						try {
							await getDailyApi().delete({ postId: post._id })
							this.loadList(true)
						} catch (e) {
							uni.showToast({ title: '删除失败', icon: 'none' })
						}
					}
				})
			},
			goPublish() {
				if (!this.isLoggedIn) {
					this.goLogin()
					return
				}
				uni.showActionSheet({
					itemList: ['发布图片', '发布视频'],
					success: (res) => {
						const type = Number(res.tapIndex) === 1 ? 'video' : 'image'
						uni.navigateTo({ url: `/pages/feed/publish?type=${type}` })
					}
				})
			},
			handleChangeCover() {
				if (this.coverUploading) return
				if (!this.isLoggedIn) {
					this.goLogin()
					return
				}
				const hasCustom = Boolean(this.headerProfile && this.headerProfile.momentsCoverUrl)
				const itemList = hasCustom ? ['拍照', '从相册选择', '恢复默认封面'] : ['拍照', '从相册选择']
				uni.showActionSheet({
					itemList,
					success: (res) => {
						const idx = Number(res.tapIndex)
						if (idx === 0) {
							this.chooseCoverImage('camera')
						} else if (idx === 1) {
							this.chooseCoverImage('album')
						} else if (idx === 2 && hasCustom) {
							this.resetCoverImage()
						}
					}
				})
			},
			chooseCoverImage(sourceType = 'album') {
				uni.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: [sourceType],
					success: (res) => {
						const filePath = Array.isArray(res.tempFilePaths) && res.tempFilePaths[0] ? res.tempFilePaths[0] : ''
						if (filePath) {
							this.saveCoverImage(filePath)
						}
					}
				})
			},
			async saveCoverImage(filePath = '') {
				if (this.coverUploading || !filePath) return
				this.coverUploading = true
				uni.showLoading({ title: '上传中...', mask: true })
				try {
					const uploadResult = await uploadFileWithModule({
						filePath,
						module: 'daily/covers',
						prefix: 'feed-cover',
						fileType: 'image'
					})
					const result = await getUserApi().updateProfile({
						momentsCoverUrl: uploadResult.fileURL || '',
						momentsCoverFileId: uploadResult.fileID || ''
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '更新封面失败')
					}
					if (result && result.userInfo) {
						this.ensureStore().updateUserInfo(result.userInfo)
						this.syncHeaderProfile()
					} else {
						this.headerProfile = Object.assign({}, this.headerProfile, {
							momentsCoverUrl: String(uploadResult.fileURL || '').trim()
						})
					}
					uni.showToast({ title: '封面已更新', icon: 'success' })
				} catch (error) {
					uni.showToast({ title: error.message || '更新封面失败', icon: 'none' })
				} finally {
					this.coverUploading = false
					uni.hideLoading()
				}
			},
			async resetCoverImage() {
				if (this.coverUploading) return
				this.coverUploading = true
				uni.showLoading({ title: '恢复中...', mask: true })
				try {
					const result = await getUserApi().updateProfile({
						momentsCoverUrl: '',
						momentsCoverFileId: ''
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '恢复封面失败')
					}
					if (result && result.userInfo) {
						this.ensureStore().updateUserInfo(result.userInfo)
						this.syncHeaderProfile()
					} else {
						this.headerProfile = Object.assign({}, this.headerProfile, {
							momentsCoverUrl: ''
						})
					}
					uni.showToast({ title: '已恢复默认封面', icon: 'success' })
				} catch (error) {
					uni.showToast({ title: error.message || '恢复封面失败', icon: 'none' })
				} finally {
					this.coverUploading = false
					uni.hideLoading()
				}
			},
			goLogin() {
				uni.navigateTo({ url: '/pages/login/index' })
			}
		}
	}
</script>

<style scoped>
	.tab-feed {
		min-height: 100vh;
		padding-bottom: calc(184rpx + env(safe-area-inset-bottom));
	}

	.tf-brand {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.tf-brand__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		letter-spacing: 3rpx;
		line-height: 1.15;
		color: #FBF4EA;
		white-space: nowrap;
	}

	.tf-brand__sub {
		margin-top: 2rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 15rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.58);
		white-space: nowrap;
	}

	.tf-nav-actions {
		display: flex;
		align-items: center;
		gap: 14rpx;
		flex-shrink: 0;
	}

	.tf-cover-btn {
		height: 54rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.54);
		background: rgba(26, 21, 18, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.tf-cover-btn__txt {
		font-size: 21rpx;
		letter-spacing: 1rpx;
		color: #EAD4BC;
		white-space: nowrap;
	}

	.tf-cam-btn {
		width: 56rpx;
		height: 56rpx;
		border-radius: 50%;
		border: 1.5rpx solid rgba(216, 176, 140, 0.72);
		background: linear-gradient(135deg, rgba(216, 176, 140, 0.24) 0%, rgba(26, 21, 18, 0.88) 100%);
		box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.36);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.tf-cam-btn__icon {
		width: 28rpx;
		height: 28rpx;
		display: block;
	}

	.tf-cover {
		position: relative;
		width: 100%;
		min-height: 360rpx;
		overflow: hidden;
		background: #110D0B;
	}

	.tf-cover__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.tf-cover__shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(13, 10, 8, 0.52) 0%,
			rgba(13, 10, 8, 0.16) 44%,
			rgba(13, 10, 8, 0.72) 78%,
			#110D0B 100%
		);
	}

	.tf-cover__copy {
		position: absolute;
		left: 28rpx;
		right: 28rpx;
		bottom: 20rpx;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
	}

	.tf-cover__left {
		display: flex;
		align-items: center;
		gap: 18rpx;
	}

	.tf-cover__ava {
		width: 84rpx;
		height: 84rpx;
		border-radius: 50%;
		border: 2rpx solid rgba(216, 176, 140, 0.56);
		background: #231C18;
	}

	.tf-cover__name {
		display: block;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		color: #FBF4EA;
		font-weight: 600;
	}

	.tf-cover__sub {
		display: block;
		margin-top: 4rpx;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.tf-cover__date {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 22rpx;
		color: #D8B08C;
	}

	.tf-body {
		padding: 16rpx 28rpx 0;
	}

	.tf-loading {
		padding: 80rpx 0;
		text-align: center;
	}

	.tf-loading__txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.44);
	}

	.tf-post {
		padding: 26rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.tf-post__head {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.tf-post__ava {
		width: 68rpx;
		height: 68rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(216, 176, 140, 0.36);
		flex-shrink: 0;
	}

	.tf-post__meta {
		flex: 1;
		min-width: 0;
	}

	.tf-post__name {
		display: block;
		font-size: 27rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.tf-post__time {
		display: block;
		margin-top: 4rpx;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.tf-post__del {
		font-size: 22rpx;
		color: rgba(226, 100, 63, 0.78);
	}

	.tf-post__content {
		display: block;
		margin-top: 16rpx;
		font-size: 27rpx;
		line-height: 1.7;
		color: rgba(245, 237, 228, 0.86);
		white-space: pre-wrap;
	}

	.tf-post__video {
		margin-top: 16rpx;
		border-radius: 20rpx;
		overflow: hidden;
	}

	.tf-post__single {
		width: 100%;
		height: 360rpx;
		margin-top: 16rpx;
		border-radius: 20rpx;
		display: block;
	}

	.tf-post__grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10rpx;
		margin-top: 16rpx;
	}

	.tf-post__grid-img {
		width: 100%;
		height: 210rpx;
		border-radius: 14rpx;
	}

	.tf-post__acts {
		display: flex;
		align-items: center;
		gap: 24rpx;
		margin-top: 18rpx;
	}

	.tf-act {
		padding: 6rpx 18rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}

	.tf-act.is-on {
		border-color: rgba(226, 100, 63, 0.46);
		background: rgba(226, 100, 63, 0.14);
	}

	.tf-act__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.64);
	}

	.tf-act.is-on .tf-act__txt {
		color: #F5B496;
	}

	.tf-comments {
		margin-top: 14rpx;
		padding: 14rpx 18rpx;
		border-radius: 16rpx;
		background: rgba(255, 255, 255, 0.032);
		border: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.tf-citem {
		font-size: 23rpx;
		line-height: 1.6;
	}

	.tf-citem + .tf-citem {
		margin-top: 8rpx;
	}

	.tf-citem__name {
		color: #D8B08C;
		font-weight: 500;
	}

	.tf-citem__reply {
		color: rgba(245, 237, 228, 0.44);
	}

	.tf-citem__txt {
		font-family: "Fluent Emoji Flat", "PingFang SC", sans-serif;
		color: rgba(245, 237, 228, 0.78);
	}

	.tf-more {
		margin: 28rpx auto 0;
		width: 280rpx;
		height: 68rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tf-more__txt {
		font-size: 23rpx;
		color: #EAD4BC;
	}

	.tf-end {
		display: block;
		margin-top: 28rpx;
		text-align: center;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.32);
	}

	.tf-comment-mask {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: rgba(8, 6, 5, 0.62);
		display: flex;
		align-items: flex-end;
	}

	.tf-comment-sheet {
		width: 100%;
		background: #1A1512;
		border-top: 1rpx solid rgba(216, 176, 140, 0.24);
		padding-bottom: env(safe-area-inset-bottom);
		box-sizing: border-box;
	}

	.tf-comment-bar {
		width: 100%;
		padding: 18rpx 22rpx;
		display: flex;
		align-items: center;
		gap: 14rpx;
		box-sizing: border-box;
	}

	.tf-comment-input {
		flex: 1;
		height: 74rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: #FBF4EA;
		font-family: "Fluent Emoji Flat", "PingFang SC", sans-serif;
		font-size: 26rpx;
	}

	.tf-emoji-btn {
		width: 68rpx;
		height: 68rpx;
		border-radius: 50%;
		border: 1.5rpx solid rgba(216, 176, 140, 0.42);
		background: rgba(216, 176, 140, 0.10);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.tf-emoji-btn.is-active {
		border-color: rgba(216, 176, 140, 0.78);
		background: rgba(216, 176, 140, 0.22);
	}

	.tf-emoji-btn__icon {
		width: 34rpx;
		height: 34rpx;
		display: block;
	}

	.tf-emoji-panel {
		position: relative;
		height: 440rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
		background: #14100E;
	}

	.tf-emoji-scroll {
		height: 100%;
		width: 100%;
	}

	.tf-emoji-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		padding: 16rpx 14rpx 96rpx;
		box-sizing: border-box;
	}

	.tf-emoji-item {
		height: 82rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 14rpx;
	}

	.tf-emoji-item:active {
		background: rgba(216, 176, 140, 0.16);
	}

	.tf-emoji-glyph {
		font-family: "Fluent Emoji Flat", sans-serif;
		font-size: 46rpx;
		line-height: 1;
	}

	.tf-emoji-del {
		position: absolute;
		right: 22rpx;
		bottom: 20rpx;
		width: 86rpx;
		height: 60rpx;
		border-radius: 18rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.48);
		background: rgba(26, 21, 18, 0.94);
		box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tf-emoji-del__txt {
		font-size: 28rpx;
		color: #EAD4BC;
		line-height: 1;
	}

	.tf-ad-card {
		border-radius: 26rpx;
		overflow: hidden;
		border: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.025);
	}
</style>
