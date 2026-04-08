<template>
	<view class="moments-page" @click="closeActionPanel">
		<view class="moments-shell">

			<view class="moments-header">
				<image
					class="moments-header__cover"
					:src="coverImage"
					mode="aspectFill"
				></image>
				<view class="moments-header__mask"></view>
				<view class="moments-header__cover-edit" @click.stop="openCoverActionSheet">
					<text class="moments-header__cover-edit-text">{{ '编辑封面' }}</text>
				</view>
				<view class="moments-header__user">
					<text class="moments-header__name">{{ headerNickname }}</text>
					<fui-avatar
						class="moments-header__avatar"
						:src="headerAvatar"
						error-src="/static/user-empty.png"
						width="120"
						height="120"
						background="#f2f2f2"
						radius="14"
					></fui-avatar>
				</view>
			</view>
			<view v-if="loading && postList.length === 0" class="state-block">
				<fui-loading type="rotate" size="44"></fui-loading>
				<text class="state-block__text">{{ '加载中...' }}</text>
			</view>

			<view v-else-if="postList.length === 0" class="state-block">
				<image class="state-block__icon" src="/static/user-empty.png" mode="aspectFit" />
				<text class="state-block__title">{{ noCouple ? '还未绑定情侣关系' : '还没有双人日常' }}</text>
				<text class="state-block__text">{{ noCouple ? '请先完成情侣绑定，再发布双人日常。' : '发布第一条日常，记录你们的今天。' }}</text>
			</view>

			<view v-else class="moments-list">
				<view v-for="post in postList" :key="post._id" class="moment-item" @click.stop>
					<fui-avatar
						:src="post.author_snapshot && post.author_snapshot.avatar_url"
						error-src="/static/user-empty.png"
						width="84"
						height="84"
						background="#f3f3f3"
						radius="12"
					></fui-avatar>

					<view class="moment-item__main">
						<text class="moment-item__nickname">{{ post.author_snapshot && post.author_snapshot.nickname || '恋人' }}</text>

						<text v-if="post.content" class="moment-item__content" selectable>{{ post.content }}</text>

						<view v-if="isVideoPost(post)" class="moment-video-wrap">
							<video
								class="moment-video"
								:style="singleMediaBoxStyle(post)"
								:src="post.media_list[0].url"
								:poster="post.media_list[0].thumbnail_url"
								object-fit="contain"
								:controls="true"
								:show-play-btn="true"
							></video>
						</view>

						<image
							v-else-if="isImagePost(post) && post.media_list.length === 1"
							class="moment-image--single"
							:style="singleMediaBoxStyle(post)"
							:src="post.media_list[0].thumbnail_url || post.media_list[0].url"
							mode="aspectFit"
							@click.stop="previewImages(post, 0)"
						/>

						<view v-else-if="isImagePost(post)" class="moment-images">
							<image
								v-for="(media, index) in post.media_list"
								:key="`${post._id}_${index}`"
								class="moment-images__item"
								:src="media.thumbnail_url || media.url"
								mode="aspectFill"
								@click.stop="previewImages(post, index)"
							/>
						</view>

						<text v-if="locationText(post)" class="moment-item__location">{{ locationText(post) }}</text>

						<view class="moment-item__meta-row">
							<view class="moment-item__meta-left">
								<text class="moment-item__time">{{ formatTime(post.create_time) }}</text>
								<text
									v-if="post.is_self"
									class="moment-item__delete"
									@click.stop="handleDelete(post)"
								>{{ '删除' }}</text>
							</view>

							<view class="moment-actions">
								<view
									v-if="activeActionPostId === post._id"
									class="moment-action-panel"
									@click.stop
								>
									<text class="moment-action-panel__item" @click.stop="toggleLike(post)">{{ post.is_liked ? '取消赞' : '赞' }}</text>
									<view class="moment-action-panel__divider"></view>
									<text class="moment-action-panel__item" @click.stop="openCommentInput(post)">{{ '评论' }}</text>
								</view>
								<view class="moment-action-trigger" @click.stop="toggleActionPanel(post)">
									<view class="moment-action-trigger__dot"></view>
									<view class="moment-action-trigger__dot"></view>
								</view>
							</view>
						</view>

						<view v-if="hasInteractions(post)" class="moment-interactions">
							<view class="moment-interactions__triangle"></view>

							<view v-if="Number(post.like_count || 0) > 0" class="moment-like-row">
								<text class="moment-like-row__icon">{{ '♥' }}</text>
								<text class="moment-like-row__text">{{ likeSummary(post) }}</text>
							</view>

							<view
								v-if="Array.isArray(post.comment_list) && post.comment_list.length"
								class="moment-comment-list"
								:class="{ 'moment-comment-list--with-like': Number(post.like_count || 0) > 0 }"
							>
								<view v-for="comment in post.comment_list" :key="comment.comment_id" class="moment-comment-item">
									<fui-avatar
										:src="comment.avatar_url"
										error-src="/static/user-empty.png"
										width="44"
										height="44"
										background="#f4f4f4"
										radius="8"
									></fui-avatar>

									<view class="moment-comment-item__main">
										<view class="moment-comment-item__head">
											<text class="moment-comment-item__name">{{ comment.nickname || '用户' }}</text>
											<text class="moment-comment-item__time">{{ formatCommentTime(comment.create_time) }}</text>
										</view>
										<text
											class="moment-comment-item__content"
											@click.stop="openCommentInput(post, comment)"
										>{{ commentDisplayContent(comment) }}</text>
									</view>
								</view>
							</view>
						</view>
					</view>
				</view>
			</view>

			<view v-if="!loading && postList.length > 0 && !pagination.hasMore" class="load-more">
				<text class="load-more__text">已经到底了</text>
			</view>
		</view>

		<love-editor-picker
			:visible="commentEditorVisible"
			:value="commentDraft"
			:placeholder="commentPlaceholder"
			@input="commentDraft = $event"
			@close="handleCommentEditorClose"
			@send="submitComment"
		></love-editor-picker>

		<view v-if="!commentEditorVisible" class="publish-fab" @click.stop="noCouple ? goCouplePage() : goPublish()">
			<text class="publish-fab__icon">+</text>
			<text class="publish-fab__text">{{ noCouple ? '去绑定' : '发布' }}</text>
		</view>
		<fui-actionsheet
			:show="coverActionSheet.show"
			:item-list="coverActionSheet.items"
			@cancel="closeCoverActionSheet"
			@click="handleCoverActionSheetClick"
		></fui-actionsheet>

		<qf-image-cropper
			v-if="coverCropperVisible"
			ref="coverCropper"
			:src="coverCropperSrc"
			:choosable="false"
			:width="720"
			:height="420"
			file-type="jpg"
			:z-index="1200"
			@crop="handleCoverCrop"
		>
			<view class="cover-cropper__cancel" @click="cancelCoverCropper">{{ '取消' }}</view>
		</qf-image-cropper>
	</view>
</template>

<script>
import { DEFAULT_AVATAR, getCachedUserProfile } from '../../common/auth-center.js'
import { getDailyApi } from '../../common/api/daily.js'
import { getUserApi } from '../../common/api/user.js'
import { uploadFileWithModule } from '../../common/utils/file-upload.js'
import { useAppStateStore } from '../../store/app-state.js'

const DEFAULT_COVER_IMAGE = 'https://env-00jxhb140x6o.normal.cloudstatic.cn/love-note/login-bg.png'

function formatDateTime(timestamp) {
	if (!timestamp) {
		return ''
	}

	const date = new Date(Number(timestamp))
	if (Number.isNaN(date.getTime())) {
		return ''
	}

	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	const hour = `${date.getHours()}`.padStart(2, '0')
	const minute = `${date.getMinutes()}`.padStart(2, '0')
	return `${year}-${month}-${day} ${hour}:${minute}`
}

function resolvePostCover(post = {}) {
	const mediaList = Array.isArray(post.media_list) ? post.media_list : []
	if (!mediaList.length) {
		return ''
	}
	const firstMedia = mediaList[0] || {}
	return String(firstMedia.thumbnail_url || firstMedia.url || '').trim()
}

function isChooseCanceledError(error = {}) {
	const message = String((error && (error.errMsg || error.message)) || '').toLowerCase()
	return message.includes('cancel')
}

function getChooseResultFilePath(result = {}) {
	const tempFiles = Array.isArray(result.tempFiles) ? result.tempFiles : []
	if (tempFiles.length) {
		const firstFile = tempFiles[0] && typeof tempFiles[0] === 'object' ? tempFiles[0] : {}
		const filePath = String(firstFile.tempFilePath || firstFile.path || '').trim()
		if (filePath) {
			return filePath
		}
	}

	const tempFilePaths = Array.isArray(result.tempFilePaths) ? result.tempFilePaths : []
	if (tempFilePaths.length) {
		return String(tempFilePaths[0] || '').trim()
	}

	return ''
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
			},
			activeActionPostId: '',
			headerProfile: {
				nickname: '',
				avatarUrl: '',
				momentsCoverUrl: '',
				momentsCoverFileId: ''
			},
			coverActionSheet: {
				show: false,
				items: [
					{ text: '拍照' },
					{ text: '从相册中选择' }
				]
			},
			coverCropperVisible: false,
			coverCropperSrc: '',
			coverUploading: false,
			appStateStore: null,
			commentEditorVisible: false,
			commentDraft: '',
			commentTargetPostId: '',
			commentReplyCommentId: '',
			commentReplyNickname: '',
		}
	},
	onLoad() {
		this.syncHeaderProfile()
		this.loadPostList(true)
	},
	computed: {
		headerNickname() {
			const nickname = String(this.headerProfile.nickname || '').trim()
			return nickname || '我'
		},
		headerAvatar() {
			const avatar = String(this.headerProfile.avatarUrl || '').trim()
			return avatar || DEFAULT_AVATAR
		},
		coverImage() {
			const customCover = String(this.headerProfile.momentsCoverUrl || '').trim()
			if (customCover) {
				return customCover
			}
			const firstPost = this.postList.find((item) => Array.isArray(item.media_list) && item.media_list.length)
			const mediaCover = firstPost ? resolvePostCover(firstPost) : ''
			return mediaCover || DEFAULT_COVER_IMAGE
		},
		commentPlaceholder() {
			const nickname = String(this.commentReplyNickname || '').trim()
			return nickname ? `回复 ${nickname}` : '评论'
		}
	},
	onShow() {
		this.syncHeaderProfile()
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
		goBack() {
			if (getCurrentPages().length > 1) {
				uni.navigateBack()
				return
			}
			uni.switchTab({
				url: '/pages/index/index'
			})
		},
		ensureStore() {
			if (!this.appStateStore) {
				this.appStateStore = useAppStateStore()
			}
			return this.appStateStore
		},
		syncHeaderProfile() {
			const cached = getCachedUserProfile() || {}
			const store = this.ensureStore()
			const userInfo = store && store.userInfo ? store.userInfo : null

			this.headerProfile = {
				nickname: String((userInfo && userInfo.nickname) || cached.nickname || '').trim(),
				avatarUrl: String((userInfo && userInfo.avatarUrl) || cached.avatarUrl || '').trim(),
				momentsCoverUrl: String((userInfo && userInfo.momentsCoverUrl) || cached.momentsCoverUrl || '').trim(),
				momentsCoverFileId: String((userInfo && userInfo.momentsCoverFileId) || cached.momentsCoverFileId || '').trim()
			}
		},
		closeActionPanel() {
			this.activeActionPostId = ''
		},
		openCoverActionSheet() {
			if (this.coverUploading) {
				return
			}
			this.closeActionPanel()
			this.coverActionSheet = Object.assign({}, this.coverActionSheet, {
				show: true
			})
		},
		closeCoverActionSheet() {
			if (!this.coverActionSheet.show) {
				return
			}
			this.coverActionSheet = Object.assign({}, this.coverActionSheet, {
				show: false
			})
		},
		async handleCoverActionSheetClick(action = {}) {
			const actionIndex = Number(action.index)
			this.closeCoverActionSheet()
			if (![0, 1].includes(actionIndex)) {
				return
			}
			await this.chooseCoverImage(actionIndex === 0 ? 'camera' : 'album')
		},
		async chooseCoverImage(sourceType = 'album') {
			try {
				const tempFilePath = await new Promise((resolve, reject) => {
					if (typeof uni.chooseMedia === 'function') {
						uni.chooseMedia({
							count: 1,
							mediaType: ['image'],
							sourceType: [sourceType],
							success: (result) => {
								resolve(getChooseResultFilePath(result))
							},
							fail: reject
						})
						return
					}

					uni.chooseImage({
						count: 1,
						sourceType: [sourceType],
						success: (result) => {
							resolve(getChooseResultFilePath(result))
						},
						fail: reject
					})
				})

				const normalizedFilePath = String(tempFilePath || '').trim()
				if (!normalizedFilePath) {
					throw new Error('未获取到可用的图片文件')
				}

				this.coverCropperSrc = ''
				this.coverCropperVisible = true
				this.$nextTick(() => {
					this.coverCropperSrc = normalizedFilePath
				})
			} catch (error) {
				if (isChooseCanceledError(error)) {
					return
				}
				uni.showToast({
					title: error.message || '选择图片失败',
					icon: 'none'
				})
			}
		},
		cancelCoverCropper() {
			this.coverCropperVisible = false
			this.coverCropperSrc = ''
		},
		async handleCoverCrop(event = {}) {
			const tempFilePath = String(event.tempFilePath || '').trim()
			this.cancelCoverCropper()
			if (!tempFilePath) {
				uni.showToast({
					title: '裁剪失败，请重试',
					icon: 'none'
				})
				return
			}
			await this.saveCoverImage(tempFilePath)
		},
		async saveCoverImage(filePath = '') {
			if (this.coverUploading) {
				return
			}

			const normalizedFilePath = String(filePath || '').trim()
			if (!normalizedFilePath) {
				return
			}

			this.coverUploading = true
			uni.showLoading({
				title: '上传中...',
				mask: true
			})
			try {
				const uploadResult = await uploadFileWithModule({
					filePath: normalizedFilePath,
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

				const latestUserInfo = result && result.userInfo ? result.userInfo : null
				if (latestUserInfo) {
					this.ensureStore().updateUserInfo(latestUserInfo)
					this.syncHeaderProfile()
				} else {
					this.headerProfile = Object.assign({}, this.headerProfile, {
						momentsCoverUrl: String(uploadResult.fileURL || '').trim(),
						momentsCoverFileId: String(uploadResult.fileID || '').trim()
					})
				}

				uni.showToast({
					title: '封面更新成功',
					icon: 'success'
				})
			} catch (error) {
				console.error('saveCoverImage failed', error)
				uni.showToast({
					title: error.message || '更新封面失败',
					icon: 'none'
				})
			} finally {
				this.coverUploading = false
				uni.hideLoading()
			}
		},
		resetCommentEditorState() {
			this.commentDraft = ''
			this.commentTargetPostId = ''
			this.commentReplyCommentId = ''
			this.commentReplyNickname = ''
		},
		handleCommentEditorClose() {
			this.commentEditorVisible = false
			this.resetCommentEditorState()
		},
		toggleActionPanel(post = {}) {
			const postId = String(post._id || '').trim()
			if (!postId) {
				return
			}
			this.activeActionPostId = this.activeActionPostId === postId ? '' : postId
		},
		formatTime(value) {
			return formatDateTime(value) || '刚刚'
		},
		formatCommentTime(value) {
			return formatDateTime(value) || '刚刚'
		},
		hasInteractions(post = {}) {
			return Number(post.like_count || 0) > 0 || (Array.isArray(post.comment_list) && post.comment_list.length > 0)
		},
		likeSummary(post = {}) {
			const likeCount = Number(post.like_count || 0)
			return likeCount > 0 ? `${likeCount} 人点赞` : ''
		},
		commentDisplayContent(comment = {}) {
			const content = String(comment.content || '').trim()
			if (!content) {
				return ''
			}
			const replyNickname = String(comment.reply_to_nickname || '').trim()
			return replyNickname ? `回复 ${replyNickname}: ${content}` : content
		},
		normalizePostItem(post = {}) {
			return Object.assign({}, post, {
				like_count: Number(post.like_count || 0),
				comment_count: Number(post.comment_count || 0),
				is_liked: Boolean(post.is_liked),
				comment_list: Array.isArray(post.comment_list) ? post.comment_list : []
			})
		},
		updatePostInList(postId = '', updater = null) {
			if (!postId || typeof updater !== 'function') {
				return
			}
			this.postList = this.postList.map((item) => {
				if (String(item._id || '') !== postId) {
					return item
				}
				return this.normalizePostItem(updater(Object.assign({}, item)) || item)
			})
		},
		locationText(post = {}) {
			const location = post && post.location && typeof post.location === 'object' ? post.location : {}
			const name = String(location.name || '').trim()
			return name ? `位置：${name}` : ''
		},
		singleMediaBoxStyle(post = {}) {
			const mediaList = Array.isArray(post.media_list) ? post.media_list : []
			const firstMedia = mediaList[0] && typeof mediaList[0] === 'object' ? mediaList[0] : {}
			const mediaWidth = Number(firstMedia.width || 0)
			const mediaHeight = Number(firstMedia.height || 0)
			const mediaType = String(post.media_type || '').toLowerCase()

			const maxWidth = 560
			const maxHeight = 680
			if (mediaWidth <= 0 || mediaHeight <= 0) {
				const fallbackRatio = mediaType === 'video' ? (16 / 9) : (4 / 3)
				const fallbackHeight = Math.max(1, Math.round(maxWidth / fallbackRatio))
				return {
					width: `${maxWidth}rpx`,
					height: `${Math.min(fallbackHeight, maxHeight)}rpx`,
					maxWidth: `${maxWidth}rpx`,
					maxHeight: `${maxHeight}rpx`
				}
			}

			const ratio = mediaWidth / mediaHeight
			let boxWidth = maxWidth
			let boxHeight = maxHeight

			if (mediaWidth >= mediaHeight) {
				boxWidth = maxWidth
				boxHeight = Math.max(1, Math.round(maxWidth / ratio))
				if (boxHeight > maxHeight) {
					boxHeight = maxHeight
					boxWidth = Math.max(1, Math.round(maxHeight * ratio))
				}
			} else {
				boxHeight = maxHeight
				boxWidth = Math.max(1, Math.round(maxHeight * ratio))
				if (boxWidth > maxWidth) {
					boxWidth = maxWidth
					boxHeight = Math.max(1, Math.round(maxWidth / ratio))
				}
			}

			return {
				width: `${boxWidth}rpx`,
				height: `${boxHeight}rpx`,
				maxWidth: `${maxWidth}rpx`,
				maxHeight: `${maxHeight}rpx`
			}
		},
		async toggleLike(post = {}) {
			const postId = String(post._id || '').trim()
			if (!postId) {
				return
			}
			this.closeActionPanel()
			try {
				const result = await getDailyApi().toggleLike({
					postId
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '操作失败，请重试')
				}
				const data = result.data || {}
				this.updatePostInList(postId, (item) => Object.assign({}, item, {
					like_count: Number(data.like_count || 0),
					is_liked: Boolean(data.is_liked)
				}))
			} catch (error) {
				uni.showToast({
					title: error.message || '操作失败，请重试',
					icon: 'none'
				})
			}
		},
		async openCommentInput(post = {}, replyComment = null) {
			const postId = String(post._id || '').trim()
			if (!postId) {
				return
			}
			this.closeActionPanel()

			const replyNickname = replyComment && replyComment.nickname
				? String(replyComment.nickname).trim()
				: ''
			this.commentTargetPostId = postId
			this.commentReplyCommentId = replyComment && replyComment.comment_id
				? String(replyComment.comment_id)
				: ''
			this.commentReplyNickname = replyNickname
			this.commentDraft = ''
			this.commentEditorVisible = true
		},
		async submitComment() {
			const postId = String(this.commentTargetPostId || '').trim()
			if (!postId) {
				return
			}
			const content = String(this.commentDraft || '').trim()
			if (!content) {
				return
			}
			const replyToCommentId = String(this.commentReplyCommentId || '').trim()

			try {
				const result = await getDailyApi().addComment({
					postId,
					content,
					replyToCommentId
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '评论失败，请重试')
				}
				const data = result.data || {}
				const newComment = data.comment && typeof data.comment === 'object' ? data.comment : null
				this.updatePostInList(postId, (item) => {
					const commentList = Array.isArray(item.comment_list) ? [...item.comment_list] : []
					if (newComment) {
						commentList.push(newComment)
					}
					return Object.assign({}, item, {
						comment_list: commentList,
						comment_count: Number(data.comment_count || commentList.length)
					})
				})
				this.handleCommentEditorClose()
			} catch (error) {
				uni.showToast({
					title: error.message || '评论失败，请重试',
					icon: 'none'
				})
			}
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
					throw new Error(result.errMsg || '加载动态失败，请重试')
				}

				const data = result.data || {}
				const list = Array.isArray(data.list) ? data.list.map((item) => this.normalizePostItem(item)) : []
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
					title: error.message || '加载动态失败，请重试',
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
				content: '删除后不可恢复，确定删除这条动态吗？',
				confirmColor: '#e76f51',
				success: async (res) => {
					if (!res.confirm) {
						return
					}

					uni.showLoading({
						title: '正在删除...',
						mask: true
					})
					try {
						const result = await getDailyApi().delete({
							postId
						})
						if (result && result.errCode && result.errCode !== 0) {
							throw new Error(result.errMsg || '删除失败，请重试')
						}

						uni.showToast({
							title: '删除成功',
							icon: 'success'
						})
						this.loadPostList(true)
					} catch (error) {
						console.error('delete daily post failed', error)
						uni.showToast({
							title: error.message || '删除失败，请重试',
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
.moments-page {
	height: 100vh;
	background: linear-gradient(180deg, #FFF7F1 0%, #FFF0E8 100%);
	padding-bottom: 160rpx;
}

.moments-shell {
	background: transparent;
}

.moments-topbar {
	position: absolute;
	top: calc(24rpx + env(safe-area-inset-top));
	left: 0;
	right: 0;
	z-index: 5;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 22rpx;
}

.moments-topbar__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 58rpx;
	height: 58rpx;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.28);
}

.moments-topbar__icon-text {
	font-size: 40rpx;
	color: #ffffff;
	line-height: 1;
}

.moments-topbar__camera {
	font-size: 25rpx;
	color: #ffffff;
	line-height: 1;
}

.moments-header {
	position: relative;
	height: 420rpx;
	overflow: visible;
}

.moments-header__cover {
	width: 100%;
	height: 100%;
}

.moments-header__mask {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 200rpx;
	background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.28) 100%);
}

.moments-header__cover-edit {
	position: absolute;
	left: 24rpx;
	top: 24rpx;
	z-index: 9;
	padding: 10rpx 20rpx;
	border-radius: 999rpx;
	background: rgba(0, 0, 0, 0.34);
}

.moments-header__cover-edit-text {
	font-size: 22rpx;
	color: #ffffff;
	line-height: 1;
}

.moments-header__user {
	position: absolute;
	right: 28rpx;
	bottom: -60rpx;
	display: flex;
	align-items: flex-end;
	gap: 18rpx;
	z-index: 8;
}

.moments-header__name {
	padding-bottom: 78rpx;
	font-size: 40rpx;
	font-weight: 700;
	color: #ffffff;
	text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.4);
}

.moments-header__avatar {
	border-radius: 14rpx;
	box-shadow: 0 10rpx 24rpx rgba(0, 0, 0, 0.22);
	border: 4rpx solid #ffffff;
}

.state-block {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 90rpx 40rpx;
}

.state-block__icon {
	width: 180rpx;
	height: 180rpx;
	opacity: 0.68;
}

.state-block__title {
	margin-top: 22rpx;
	font-size: 30rpx;
	font-weight: 600;
	color: #333333;
}

.state-block__text {
	margin-top: 14rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #8b8b8b;
	text-align: center;
}

.moments-list {
	padding-top: 76rpx;
	background: transparent;
}

.moment-item {
	display: flex;
	align-items: flex-start;
	gap: 16rpx;
	padding: 26rpx 24rpx 24rpx;
	border-bottom: 1rpx solid #f1f1f1;
	background: transparent;
}

.moment-item__main {
	flex: 1;
	min-width: 0;
}

.moment-item__nickname {
	display: block;
	font-size: 30rpx;
	font-weight: 600;
	color: #576b95;
	line-height: 1.2;
}

.moment-item__content {
	display: block;
	margin-top: 10rpx;
	font-size: 28rpx;
	line-height: 1.62;
	color: #111111;
	white-space: pre-wrap;
	word-break: break-all;
}

.moment-video-wrap {
	margin-top: 14rpx;
}

.moment-video {
	display: block;
	border-radius: 8rpx;
}

.moment-image--single {
	margin-top: 14rpx;
	display: block;
	border-radius: 8rpx;
	overflow: hidden;
}

.moment-images {
	display: grid;
	gap: 6rpx;
	margin-top: 14rpx;
	width: 546rpx;
	grid-template-columns: repeat(3, minmax(0, 1fr));
}

.moment-images__item {
	width: 100%;
	height: 178rpx;
	border-radius: 6rpx;
	overflow: hidden;
}

.moment-item__location {
	display: block;
	margin-top: 10rpx;
	max-width: 100%;
	font-size: 22rpx;
	color: #8e8e8e;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.moment-item__meta-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 12rpx;
	min-height: 48rpx;
}

.moment-item__meta-left {
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.moment-item__time {
	font-size: 22rpx;
	color: #b2b2b2;
}

.moment-item__delete {
	font-size: 23rpx;
	color: #576b95;
}

.moment-actions {
	position: relative;
	display: flex;
	align-items: center;
}

.moment-action-trigger {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
	width: 52rpx;
	height: 36rpx;
	border-radius: 6rpx;
}

.moment-action-trigger__dot {
	width: 6rpx;
	height: 6rpx;
	border-radius: 50%;
	background: #576b95;
}

.moment-action-panel {
	position: absolute;
	right: 60rpx;
	top: 50%;
	transform: translateY(-50%);
	display: flex;
	align-items: center;
	height: 62rpx;
	padding: 0 8rpx;
	border-radius: 8rpx;
	background: #4c5154;
	white-space: nowrap;
}

.moment-action-panel__item {
	padding: 0 18rpx;
	font-size: 24rpx;
	color: #ffffff;
	line-height: 62rpx;
}

.moment-action-panel__divider {
	width: 1rpx;
	height: 24rpx;
	background: rgba(255, 255, 255, 0.28);
}

.moment-interactions {
	position: relative;
	margin-top: 6rpx;
	border-radius: 8rpx;
	overflow: hidden;
}

.moment-interactions__triangle {
	position: absolute;
	top: -10rpx;
	left: 22rpx;
	width: 0;
	height: 0;
	border-left: 10rpx solid transparent;
	border-right: 10rpx solid transparent;
	border-bottom: 10rpx solid #f7f7f7;
}

.moment-like-row {
	display: flex;
	align-items: center;
	gap: 10rpx;
	padding: 14rpx 18rpx;
}

.moment-like-row__icon {
	font-size: 22rpx;
	color: #576b95;
}

.moment-like-row__text {
	font-size: 24rpx;
	color: #576b95;
}

.moment-comment-list {
	padding: 10rpx 18rpx 14rpx;
}

.moment-comment-list--with-like {
	border-top: 1rpx solid #ececec;
}

.moment-comment-item {
	display: flex;
	align-items: flex-start;
	gap: 10rpx;
}

.moment-comment-item + .moment-comment-item {
	margin-top: 12rpx;
}

.moment-comment-item__main {
	flex: 1;
	min-width: 0;
}

.moment-comment-item__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12rpx;
}

.moment-comment-item__name {
	font-size: 24rpx;
	color: #576b95;
	font-weight: 500;
}

.moment-comment-item__time {
	font-size: 21rpx;
	color: #b2b2b2;
}

.moment-comment-item__content {
	display: block;
	margin-top: 4rpx;
	font-size: 24rpx;
	line-height: 1.58;
	color: #111111;
	word-break: break-all;
}

.load-more {
	padding: 24rpx 0 12rpx;
	text-align: center;
}

.load-more__text {
	font-size: 22rpx;
	color: #ababab;
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
	color: #ffffff;
	font-weight: 700;
}

.publish-fab__text {
	font-size: 24rpx;
	color: #ffffff;
	font-weight: 600;
}

.cover-cropper__cancel {
	position: fixed;
	top: calc(24rpx + env(safe-area-inset-top));
	left: 24rpx;
	padding: 10rpx 20rpx;
	border-radius: 999rpx;
	font-size: 24rpx;
	line-height: 1.1;
	color: #ffffff;
	background: rgba(255, 255, 255, 0.24);
	z-index: 1600;
}
</style>
