<template>
	<view class="love-page fb-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<noir-navbar title="反馈与帮助" :transparent="true" :scroll-top="scrollTop" />

		<view class="love-layer fb-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先登录后提交反馈。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<view v-else class="fb-body">
				<view class="fb-intro">
					<text class="fb-intro__title">有问题，告诉我们</text>
					<text class="fb-intro__desc">提交后由管理员处理；常见问题可先看下方静态 FAQ。</text>
				</view>

				<text class="fb-label">反馈分类</text>
				<view class="fb-topics">
					<view
						v-for="(item, index) in categoryOptions"
						:key="item.value"
						class="fb-chip"
						:class="{ 'fb-chip--on': categoryIndex === index }"
						@tap="selectCategory(index)"
					>
						<text class="fb-chip__txt">{{ item.name }}</text>
					</view>
				</view>

				<view class="fb-textbox">
					<textarea
						class="fb-textarea"
						:value="content"
						placeholder="请描述问题场景、复现步骤或你的建议…"
						placeholder-class="fb-textarea__ph"
						:maxlength="contentMaxLength"
						:disable-default-padding="true"
						@input="onNativeContentInput"
					/>
					<text class="fb-count">{{ content.length }} / {{ contentMaxLength }}</text>
				</view>

				<view class="fb-upload-block">
					<love-media-uploader
						ref="mediaUploader"
						:file-types="['image']"
						:max-file-size="imageMaxSize"
						:compressed="true"
						:enable-compression="true"
						:compressOverSize="5 * 1024 * 1024"
						save-path="feedback/images"
						upload-prefix="feedback"
						:max-count="9"
						:show-tips="true"
						:tip-text="uploaderTipText"
						:item-width="148"
						:item-height="148"
						:previewable="true"
						object-fit="aspectFill"
						:source-type="['album', 'camera']"
						:show-delete-button="true"
						add-text="截图"
						upload-icon="+"
						@change="onUploaderChange"
					>
						<template #tip>
							<text class="fb-upload-tip">问题截图（可选）· {{ uploaderTipText }}</text>
						</template>
					</love-media-uploader>
				</view>

				<view class="fb-actions">
					<noir-button
						text="提交反馈"
						variant="primary"
						size="lg"
						block
						:loading="submitting"
						@click="handleSubmit"
					/>
				</view>

				<view class="fb-faq">
					<view class="fb-fhead">
						<text class="fb-label fb-label--inline">常见问题 · 静态 8 条</text>
						<view class="fb-fhead__action" @tap="faqExpanded = !faqExpanded">
							<text class="fb-fhead__action-txt">{{ faqExpanded ? '收起' : '查看全部 8 条' }}</text>
							<fui-icon
								:name="faqExpanded ? 'arrowup' : 'arrowright'"
								:size="24"
								color="rgba(216, 176, 140, 0.72)"
							></fui-icon>
						</view>
					</view>

					<view class="fb-flist">
						<view
							v-for="(item, idx) in visibleFaqList"
							:key="item.q"
							class="fb-q-item"
							:class="{ 'fb-q-item--open': openFaqIndex === idx }"
							@tap="toggleFaqItem(idx)"
						>
							<view class="fb-q-row">
								<text class="fb-q-txt">{{ item.q }}</text>
								<fui-icon
									:name="openFaqIndex === idx ? 'arrowdown' : 'arrowright'"
									:size="26"
									color="rgba(216, 176, 140, 0.56)"
								></fui-icon>
							</view>
							<text v-if="openFaqIndex === idx" class="fb-a-txt">{{ item.a }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import {
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		subscribeAuthChanged
	} from '../../common/auth-center.js'
	import { getFeedbackApi } from '../../common/api/feedback.js'
	import { requirePageLogin } from '@/common/auth-entry.js'

	const CATEGORY_OPTIONS = [{
		name: '功能异常',
		value: 'bug'
	}, {
		name: '功能建议',
		value: 'feature'
	}, {
		name: '体验问题',
		value: 'experience'
	}, {
		name: '其他',
		value: 'other'
	}]

	const IMAGE_MAX_SIZE = 20 * 1024 * 1024
	const CONTENT_MAX_LENGTH = 2000

	const STATIC_FAQ_LIST = [
		{ q: '怎么邀请另一半绑定？', a: '进入「我的 → 情侣信息」生成 6 位绑定码或转发微信邀请卡片给对方，对方确认后即开启双人空间。' },
		{ q: '照片上传失败怎么办？', a: '请检查网络并在上传进度弹窗中点击重试失败项；单张图片建议不超过 20MB。' },
		{ q: '心动点怎么获得、解绑会清零吗？', a: '绑定情侣后可通过 7 天循环签到、每日任务、每日挑战及一次性里程碑获得；解除情侣关系将清零双方全部心动点且无法恢复。' },
		{ q: '未绑定情侣可以记录日常和照片吗？', a: '可以，未绑定状态下也能先记录自己的纪念日、照片与愿望；绑定后会自动同步至双人空间。' },
		{ q: '纪念日支持农历和每年重复吗？', a: '支持。新建或编辑纪念日时可切换公历/农历，并支持不重复、每年、每月、每周 4 种重复规则。' },
		{ q: '愿望和计划有什么区别？', a: '愿望是轻量心愿，无步骤拆解，可直接一键完成；计划支持多执行步骤、跳过状态与步骤评论协作。' },
		{ q: '聚会游戏怎么邀请好友一起玩？', a: '谁是卧底与三人斗地主创建房间后会生成 6 位房间号，可直接转发微信好友卡片加入；数字炸弹为单机同设备轮流猜。' },
		{ q: '提交反馈后怎么查看处理进度？', a: '提交后管理员会尽快查看并处理，问题修复或回复将在后续版本与站内同步。' }
	]

	export default {
		data() {
			return {
				scrollTop: 0,
				submitting: false,
				loggedIn: false,
				removeAuthListener: null,
				content: '',
				categoryIndex: 0,
				selectedImageCount: 0,
				imageMaxSize: IMAGE_MAX_SIZE,
				contentMaxLength: CONTENT_MAX_LENGTH,
				faqExpanded: false,
				openFaqIndex: -1
			}
		},
		computed: {
			isLoggedIn() {
				return this.loggedIn
			},
			categoryOptions() {
				return CATEGORY_OPTIONS
			},
			currentCategory() {
				return CATEGORY_OPTIONS[this.categoryIndex] || CATEGORY_OPTIONS[0]
			},
			uploaderTipText() {
				return `最多上传 9 张，单张 ≤ ${Math.floor(this.imageMaxSize / 1024 / 1024)}MB`
			},
			visibleFaqList() {
				return this.faqExpanded ? STATIC_FAQ_LIST : STATIC_FAQ_LIST.slice(0, 5)
			}
		},
		onPageScroll(e) {
			this.scrollTop = Number((e && e.scrollTop) || 0)
		},
		onLoad() {
			if (!requirePageLogin()) return
			this.removeAuthListener = subscribeAuthChanged(() => {
				this.restoreLoginState()
			})
		},
		onShow() {
			this.restoreLoginState()
		},
		onUnload() {
			if (this.removeAuthListener) {
				this.removeAuthListener()
				this.removeAuthListener = null
			}
		},
		methods: {
			restoreLoginState() {
				const userInfo = getCurrentUniIdUser()
				if (!userInfo || !userInfo.uid) {
					this.loggedIn = false
					return
				}

				if (userInfo.tokenExpired && userInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.loggedIn = false
					return
				}

				this.loggedIn = true
			},
			goToLoginPage() {
				uni.redirectTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/feedback/index')
				})
			},
			backToProfile() {
				navigateToTab('/pages/profile/index')
			},
			selectCategory(index) {
				const nextIndex = Number(index || 0)
				this.categoryIndex = Number.isNaN(nextIndex) ? 0 : nextIndex
			},
			toggleFaqItem(idx) {
				this.openFaqIndex = this.openFaqIndex === idx ? -1 : idx
			},
			onNativeContentInput(e) {
				const value = e && e.detail ? e.detail.value : ''
				this.content = String(value || '').slice(0, this.contentMaxLength)
			},
			onUploaderChange(files = []) {
				this.selectedImageCount = Array.isArray(files) ? files.length : 0
			},
			async handleSubmit() {
				if (this.submitting) {
					return
				}
				if (!this.isLoggedIn) {
					this.goToLoginPage()
					return
				}

				const content = String(this.content || '').trim()
				if (!content) {
					uni.showToast({
						title: '请填写反馈内容',
						icon: 'none'
					})
					return
				}

				const uploader = this.$refs.mediaUploader
				if (!uploader || typeof uploader.uploadAll !== 'function') {
					uni.showToast({
						title: '上传组件未准备好',
						icon: 'none'
					})
					return
				}

				this.submitting = true
				uni.showLoading({
					title: '提交中...',
					mask: true
				})

				try {
					let uploadedFiles = []
					if (this.selectedImageCount > 0) {
						uploadedFiles = await uploader.uploadAll({
							savePath: 'feedback/images',
							prefix: 'feedback'
						})
						if (!uploadedFiles.length) {
							throw new Error('截图上传失败，请重试')
						}
					}

					const imageList = uploadedFiles.map((item) => ({
						url: item.url,
						fileId: item.fileId,
						mimeType: item.mimeType || 'image/jpeg',
						fileSize: Number(item.fileSize || 0),
						width: Number(item.width || 0),
						height: Number(item.height || 0)
					}))

					const result = await getFeedbackApi().create({
						category: this.currentCategory.value,
						content,
						imageList
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '提交反馈失败')
					}

					this.content = ''
					this.categoryIndex = 0
					this.selectedImageCount = 0
					if (uploader && typeof uploader.clear === 'function') {
						uploader.clear()
					}

					uni.showToast({
						title: '反馈提交成功',
						icon: 'success'
					})
				} catch (error) {
					console.error('feedback submit failed', error)
					uni.showToast({
						title: error.message || '提交反馈失败',
						icon: 'none'
					})
				} finally {
					this.submitting = false
					uni.hideLoading()
				}
			}
		}
	}
</script>

<style scoped>
	.fb-page {
		min-height: 100vh;
		background: #110D0B;
		padding-bottom: calc(64rpx + env(safe-area-inset-bottom));
	}

	.fb-wrap {
		padding: 12rpx 32rpx 0;
	}

	.fb-body {
		padding-top: 4rpx;
	}

	.fb-intro {
		margin-bottom: 28rpx;
	}

	.fb-intro__title {
		display: block;
		font-family: "Songti SC", "SimSun", serif;
		font-size: 42rpx;
		font-weight: 500;
		color: #FBF4EA;
		letter-spacing: 2rpx;
	}

	.fb-intro__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.44);
	}

	.fb-label {
		display: block;
		font-size: 22rpx;
		letter-spacing: 2rpx;
		color: rgba(216, 176, 140, 0.78);
		margin-bottom: 16rpx;
	}

	.fb-label--inline {
		margin-bottom: 0;
	}

	.fb-topics {
		display: flex;
		flex-wrap: wrap;
		gap: 14rpx;
	}

	.fb-chip {
		padding: 14rpx 28rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.032);
		transition: all 0.2s ease;
		display: flex;
	}

	.fb-chip--on {
		border-color: rgba(226, 100, 63, 0.56);
		background: rgba(226, 100, 63, 0.16);
	}

	.fb-chip__txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.72);
	}

	.fb-chip--on .fb-chip__txt {
		color: #F09A6B;
		font-weight: 500;
	}

	.fb-textbox {
		position: relative;
		margin-top: 24rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
		padding: 24rpx 26rpx 54rpx;
	}

	.fb-textarea {
		width: 100%;
		height: 220rpx;
		font-size: 26rpx;
		line-height: 1.7;
		color: #FBF4EA;
	}

	.fb-textarea__ph {
		color: rgba(245, 237, 228, 0.34);
		font-size: 26rpx;
	}

	.fb-count {
		position: absolute;
		right: 26rpx;
		bottom: 18rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.34);
	}

	.fb-upload-block {
		margin-top: 24rpx;
	}

	.fb-upload-tip {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.38);
	}

	.fb-actions {
		margin-top: 32rpx;
	}

	.fb-faq {
		margin-top: 44rpx;
	}

	.fb-fhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-bottom: 14rpx;
	}

	.fb-fhead__action {
		display: flex;
		align-items: center;
		gap: 4rpx;
	}

	.fb-fhead__action-txt {
		font-size: 22rpx;
		color: rgba(216, 176, 140, 0.72);
	}

	.fb-flist {
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.fb-q-item {
		padding: 24rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.055);
	}

	.fb-q-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.fb-q-txt {
		flex: 1;
		min-width: 0;
		font-size: 26rpx;
		line-height: 1.5;
		color: rgba(245, 237, 228, 0.76);
	}

	.fb-q-item--open .fb-q-txt {
		color: #FBF4EA;
		font-weight: 500;
	}

	.fb-a-txt {
		display: block;
		margin-top: 14rpx;
		padding-right: 12rpx;
		font-size: 23rpx;
		line-height: 1.7;
		color: rgba(245, 237, 228, 0.48);
	}
</style>
