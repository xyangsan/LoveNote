<template>
	<view class="page">
		<view class="page__glow page__glow--left"></view>
		<view class="page__glow page__glow--right"></view>

		<view v-if="!isLoggedIn" class="auth-card">
			<view class="auth-card__header">
				<view>
					<text class="auth-card__eyebrow">LoveNote 登录</text>
					<text class="auth-card__title">先完成微信登录，再开启情侣空间</text>
					<text class="auth-card__desc">登录后会保存你的微信头像、昵称，并作为后续情侣绑定和双人空间的基础身份信息。</text>
				</view>
				<view class="auth-card__status">未登录</view>
			</view>

			<!-- #ifdef MP-WEIXIN -->
			<view class="profile-editor">
				<button class="avatar-picker" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
					<image class="avatar-picker__image" :src="displayLoginAvatar"></image>
					<text class="avatar-picker__hint">点击选择头像</text>
				</button>
				<view class="profile-editor__form">
					<text class="profile-editor__label">微信昵称</text>
					<input
						class="profile-editor__input"
						type="nickname"
						placeholder="请输入你的昵称"
						:value="loginForm.nickname"
						@input="onNicknameInput"
						@blur="onNicknameBlur"
					/>
					<text class="profile-editor__tip">如果暂时不填写，会默认保存为“微信用户”。</text>
				</view>
			</view>

			<button class="login-button" hover-class="button-hover" :loading="isLoggingIn" @click="handleWechatLogin">
				微信一键登录
			</button>
			<!-- #endif -->

			<!-- #ifndef MP-WEIXIN -->
			<view class="auth-card__notice">
				<text class="auth-card__notice-text">当前登录能力面向微信小程序环境开发，请在微信开发者工具或真机小程序中体验。</text>
			</view>
			<!-- #endif -->
		</view>

			<view class="hero-card" v-else>
				<view class="hero-card__top">
					<view>
						<text class="eyebrow">LoveNote 情侣空间</text>
						<view class="hero-card__title-row">
							<text class="hero-card__title">{{ relationshipHeadline }}</text>
						</view>
						<text class="hero-card__subtitle">{{ heroSubtitle }}</text>
					</view>
				<view class="heart-pill">{{ heroPillText }}</view>
				</view>

			<love-relation-bar
				class="couple-card"
				:primary-avatar="displayUserAvatar"
				:primary-gender="Number(currentUser && currentUser.gender || 0)"
				:secondary-avatar="currentPartnerAvatar"
				secondary-placeholder="TA"
				:title="relationBarTitle"
				:desc="currentUserDesc"
			></love-relation-bar>

			<view class="hero-stats">
				<view v-for="item in heroStats" :key="item.label" class="hero-stats__item">
					<text class="hero-stats__value">{{ item.value }}</text>
					<text class="hero-stats__label">{{ item.label }}</text>
				</view>
			</view>

			<view class="hero-actions">
				<button
					class="primary-action"
					hover-class="button-hover"
					@click="isLoggedIn ? goToCouplePage() : handleAction('登录')"
				>
					{{ isLoggedIn ? (activeCouple ? '进入情侣空间' : '创建情侣空间') : '先去登录' }}
				</button>
				<button
					class="secondary-action"
					hover-class="button-hover"
					@click="isLoggedIn ? handleLogout() : handleAction('邀请码')"
				>
					{{ isLoggedIn ? '退出登录' : '填写邀请码' }}
				</button>
			</view>
		</view>

		<view class="section">
			<view class="section__header">
				<text class="section__title">今天想先做什么</text>
				<text class="section__hint">快捷入口</text>
			</view>
			<view class="quick-grid">
				<view
					v-for="item in quickActions"
					:key="item.title"
					class="quick-grid__item"
					@click="handleAction(item.title)"
				>
					<view class="quick-grid__icon" :style="{ background: item.gradient }">
						<text class="quick-grid__emoji">{{ item.icon }}</text>
					</view>
					<text class="quick-grid__title">{{ item.title }}</text>
					<text class="quick-grid__desc">{{ item.desc }}</text>
				</view>
			</view>
		</view>

		<view class="section">
			<view class="section__header">
				<text class="section__title">纪念日提醒</text>
				<text class="section__hint">{{ isLoggedIn ? '下一步可接真实倒计时数据' : '登录后可同步到你的情侣空间' }}</text>
			</view>
			<view class="timeline-card">
				<view v-for="item in anniversaries" :key="item.title" class="timeline-card__item">
					<view class="timeline-card__dot"></view>
					<view class="timeline-card__body">
						<view class="timeline-card__row">
							<text class="timeline-card__title">{{ item.title }}</text>
							<text class="timeline-card__countdown">{{ item.countdown }}</text>
						</view>
						<text class="timeline-card__date">{{ item.date }}</text>
						<text class="timeline-card__note">{{ item.note }}</text>
					</view>
				</view>
			</view>
		</view>

		<view class="section">
			<view class="section__header">
				<text class="section__title">最近双人动态</text>
				<text class="section__hint">后续替换为真实双人日常时间轴</text>
			</view>
			<view
				v-for="post in moments"
				:key="post.id"
				class="moment-card"
				@click="handleAction('双人动态')"
			>
				<view class="moment-card__top">
					<view class="moment-card__author">
						<view class="moment-card__avatar" :style="{ background: post.avatarGradient }">
							<text class="moment-card__avatar-text">{{ post.authorShort }}</text>
						</view>
						<view>
							<text class="moment-card__name">{{ post.author }}</text>
							<text class="moment-card__time">{{ post.time }}</text>
						</view>
					</view>
					<view class="moment-card__tag">{{ post.mood }}</view>
				</view>
				<text class="moment-card__content">{{ post.content }}</text>
				<view class="moment-card__footer">
					<text class="moment-card__meta">{{ post.location }}</text>
					<text class="moment-card__meta">{{ post.stats }}</text>
				</view>
			</view>
		</view>

		<view class="section">
			<view class="section__header">
				<text class="section__title">愿望与计划预览</text>
				<text class="section__hint">帮助首页具备共同成长的感觉</text>
			</view>
			<view class="plan-card">
				<view v-for="item in plans" :key="item.title" class="plan-card__item">
					<view class="plan-card__head">
						<text class="plan-card__title">{{ item.title }}</text>
						<text class="plan-card__status">{{ item.status }}</text>
					</view>
					<text class="plan-card__desc">{{ item.desc }}</text>
					<view class="plan-card__progress">
						<view class="plan-card__progress-bar">
							<view class="plan-card__progress-fill" :style="{ width: item.progress + '%' }"></view>
						</view>
						<text class="plan-card__progress-text">{{ item.progress }}%</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		uploadAvatarIfNeeded
	} from '../../common/auth-center.js'
	import { getAuthApi } from '../../common/api/auth.js'
	import { getCoupleApi } from '../../common/api/couple.js'
	import { getUserApi } from '../../common/api/user.js'
	import LoveRelationBar from '../../components/love-relation-bar/love-relation-bar.vue'

	function getDefaultCoupleCenterData() {
		return {
			selfInfo: null,
			activeCouple: null,
			incomingRequests: [],
			outgoingRequests: [],
			historyList: [],
			canSendRequest: true
		}
	}

	function formatDateTime(timestamp) {
		if (!timestamp) {
			return ''
		}

		const date = new Date(timestamp)
		const year = date.getFullYear()
		const month = `${date.getMonth() + 1}`.padStart(2, '0')
		const day = `${date.getDate()}`.padStart(2, '0')
		return `${year}.${month}.${day}`
	}

	function getDaysSince(timestamp) {
		if (!timestamp) {
			return 0
		}

		const oneDay = 24 * 60 * 60 * 1000
		return Math.max(1, Math.floor((Date.now() - Number(timestamp)) / oneDay) + 1)
	}

	export default {
		components: {
			LoveRelationBar
		},
		data() {
			const formatDate = (date) => {
				const year = date.getFullYear()
				const month = `${date.getMonth() + 1}`.padStart(2, '0')
				const day = `${date.getDate()}`.padStart(2, '0')
				return `${year}.${month}.${day}`
			}
			const startDate = new Date('2024-02-14T00:00:00')
			const today = new Date()
			const oneDay = 24 * 60 * 60 * 1000
			const loveDays = Math.max(1, Math.floor((today.getTime() - startDate.getTime()) / oneDay) + 1)

			return {
				loveDays,
				startDateText: formatDate(startDate),
				isLoggingIn: false,
				userInfo: null,
				coupleCenterData: getDefaultCoupleCenterData(),
				loginForm: {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				},
				quickActions: [
					{
						title: '纪念日',
						desc: '记录重要节点与倒计时',
						icon: '01',
						gradient: 'linear-gradient(135deg, #ffe29f 0%, #ffa99f 100%)'
					},
					{
						title: '双人日常',
						desc: '发布今天的小片段',
						icon: '02',
						gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
					},
					{
						title: '相册',
						desc: '记录我们的美好瞬间',
						icon: '03',
						gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)'
					},
					{
						title: '约会计划',
						desc: '安排下一次见面和惊喜',
						icon: '04',
						gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
					}
				],
				anniversaries: [
					{
						title: '恋爱两周年',
						date: '2026-02-14',
						countdown: '已纪念',
						note: '已经一起走过两年，适合补一张周年合照。'
					},
					{
						title: '第一次旅行',
						date: '2026-03-15',
						countdown: '还有 4 天',
						note: '记得准备旅拍清单和当天的早餐惊喜。'
					},
					{
						title: '她的生日',
						date: '2026-04-08',
						countdown: '还有 28 天',
						note: '提前准备礼物、贺卡和餐厅预约。'
					}
				],
				moments: [
					{
						id: 1,
						author: '小满',
						authorShort: '满',
						time: '今天 08:40',
						mood: '早安日常',
						content: '今天出门前给你留了热拿铁和便利贴，晚上一起去试那家新开的烘焙店吧。',
						location: '上海 · 静安',
						stats: '2 条回应 · 6 次喜欢',
						avatarGradient: 'linear-gradient(135deg, #ff9a8b 0%, #ff6a88 100%)'
					},
					{
						id: 2,
						author: '阿澈',
						authorShort: '澈',
						time: '昨天 21:15',
						mood: '回忆收藏',
						content: '把上周末拍的照片挑了 18 张，想做成我们三月的回忆卡片，周末一起选封面。',
						location: '家',
						stats: '1 条评论 · 9 次喜欢',
						avatarGradient: 'linear-gradient(135deg, #ffc371 0%, #ff8c42 100%)'
					}
				],
				plans: [
					{
						title: '四月短途旅行',
						status: '筹备中',
						desc: '目的地暂定杭州，待确认出行日期和拍照路线。',
						progress: 65
					},
					{
						title: '一起学会做三道新菜',
						status: '进行中',
						desc: '已完成奶油意面和寿喜锅，还差一道甜品。',
						progress: 67
					}
				]
			}
		},
		computed: {
			isLoggedIn() {
				return Boolean(this.userInfo && this.userInfo._id)
			},
			currentUser() {
				return this.userInfo || null
			},
			activeCouple() {
				return this.coupleCenterData && this.coupleCenterData.activeCouple ? this.coupleCenterData.activeCouple : null
			},
			incomingRequests() {
				return Array.isArray(this.coupleCenterData && this.coupleCenterData.incomingRequests)
					? this.coupleCenterData.incomingRequests
					: []
			},
			outgoingRequests() {
				return Array.isArray(this.coupleCenterData && this.coupleCenterData.outgoingRequests)
					? this.coupleCenterData.outgoingRequests
					: []
			},
			historyList() {
				return Array.isArray(this.coupleCenterData && this.coupleCenterData.historyList)
					? this.coupleCenterData.historyList
					: []
			},
			currentUserName() {
				return this.currentUser && this.currentUser.nickname ? this.currentUser.nickname : '你'
			},
			displayUserAvatar() {
				return this.currentUser && this.currentUser.avatarUrl ? this.currentUser.avatarUrl : DEFAULT_AVATAR
			},
			displayLoginAvatar() {
				return this.loginForm.avatarUrl || DEFAULT_AVATAR
			},
			currentPartnerName() {
				if (this.activeCouple && this.activeCouple.partnerNickname) {
					return this.activeCouple.partnerNickname
				}

				const pendingRelation = this.incomingRequests[0] || this.outgoingRequests[0] || null
				if (pendingRelation && pendingRelation.partnerNicknameMasked) {
					return pendingRelation.partnerNicknameMasked
				}

				return '待绑定'
			},
			currentPartnerAvatar() {
				if (this.activeCouple && this.activeCouple.partnerAvatarUrl) {
					return this.activeCouple.partnerAvatarUrl
				}

				const pendingRelation = this.incomingRequests[0] || this.outgoingRequests[0] || null
				return pendingRelation && pendingRelation.partnerAvatarUrl ? pendingRelation.partnerAvatarUrl : ''
			},
			relationBarTitle() {
				return `${this.currentUserName} & ${this.currentPartnerName}`
			},
			relationshipDays() {
				return this.activeCouple && this.activeCouple.bindDate ? getDaysSince(this.activeCouple.bindDate) : this.loveDays
			},
			relationshipHeadline() {
				if (this.activeCouple) {
					return `已经相伴第 ${this.relationshipDays} 天`
				}

				if (this.incomingRequests.length) {
					return `收到 ${this.incomingRequests.length} 条绑定请求`
				}

				if (this.outgoingRequests.length) {
					return '等待对方确认绑定'
				}

				return '创建属于你们的情侣空间'
			},
			heroSubtitle() {
				if (!this.isLoggedIn) {
					return '先完成微信登录，保存你的昵称和头像，再继续搭建专属双人空间。'
				}

				if (this.activeCouple) {
					return `当前已与 ${this.currentPartnerName} 完成绑定，可以继续前往情侣页管理关系。`
				}

				if (this.incomingRequests.length) {
					return '有人向你发来了绑定邀请，点击“创建情侣空间”即可前往处理。'
				}

				if (this.outgoingRequests.length) {
					return `你已向 ${this.currentPartnerName} 发起绑定邀请，正在等待对方回应。`
				}

				return '你的账号已经完成登录，下一步可以继续创建情侣空间、邀请另一半加入。'
			},
			heroPillText() {
				if (this.activeCouple) {
					return '情侣空间已建立'
				}

				if (this.incomingRequests.length) {
					return '有新的邀请'
				}

				if (this.outgoingRequests.length) {
					return '邀请已发出'
				}

				return '等待绑定中'
			},
			currentUserDesc() {
				if (!this.isLoggedIn) {
					return '当前还没有登录账号，登录后会自动保存你的头像、昵称和首次登录时间。'
				}

				if (this.activeCouple) {
					return `当前伴侣：${this.currentPartnerName}，绑定日期 ${formatDateTime(this.activeCouple.bindDate) || this.startDateText}。`
				}

				if (this.incomingRequests.length) {
					return `你有 ${this.incomingRequests.length} 条待处理邀请，确认其中一条后即可建立情侣空间。`
				}

				if (this.outgoingRequests.length) {
					return `最近一次邀请对象：${this.currentPartnerName}，等待对方确认后就能正式绑定。`
				}

				return `已完成微信登录，登录昵称为 ${this.currentUserName}，可以开始填写对方 ID 发起绑定。`
			},
			heroStats() {
				return [
					{
						label: '待处理请求',
						value: `${this.incomingRequests.length}`
					},
					{
						label: '已发邀请',
						value: `${this.outgoingRequests.length}`
					},
					{
						label: '关系记录',
						value: `${this.historyList.length + (this.activeCouple ? 1 : 0)}`
					}
				]
			}
		},
		onShow() {
			this.restoreLoginState()
		},
		methods: {
			resetLoginForm() {
				this.loginForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				}
			},

			async restoreLoginState() {
				const currentUserInfo = getCurrentUniIdUser()
				if (!currentUserInfo || !currentUserInfo.uid) {
					this.userInfo = null
					this.coupleCenterData = getDefaultCoupleCenterData()
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.userInfo = null
					this.coupleCenterData = getDefaultCoupleCenterData()
					return
				}

				await Promise.all([
					this.fetchCurrentUser({
						silent: true
					}),
					this.fetchCoupleCenter({
						silent: true
					})
				])
			},
			async fetchCurrentUser({ silent = false } = {}) {
				try {
					const result = await getUserApi().getMine()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取用户信息失败')
					}
					this.userInfo = result.userInfo || null

					if (this.userInfo) {
						this.loginForm.nickname = this.userInfo.nickname || this.loginForm.nickname
						this.loginForm.avatarUrl = this.userInfo.avatarUrl || this.loginForm.avatarUrl
						this.loginForm.avatarFileId = this.userInfo.avatarFileId || this.loginForm.avatarFileId
					}
				} catch (error) {
					console.warn('fetchCurrentUser failed', error)
					clearUniIdTokenStorage()
					this.userInfo = null
					this.coupleCenterData = getDefaultCoupleCenterData()

					if (!silent) {
						uni.showToast({
							title: '登录状态已失效，请重新登录',
							icon: 'none'
						})
					}
				}
			},
			async fetchCoupleCenter({ silent = false } = {}) {
				try {
					const result = await getCoupleApi().getCenter()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取情侣信息失败')
					}

					this.coupleCenterData = {
						selfInfo: result.selfInfo || null,
						activeCouple: result.activeCouple || null,
						incomingRequests: Array.isArray(result.incomingRequests) ? result.incomingRequests : [],
						outgoingRequests: Array.isArray(result.outgoingRequests) ? result.outgoingRequests : [],
						historyList: Array.isArray(result.historyList) ? result.historyList : [],
						canSendRequest: Boolean(result.canSendRequest)
					}
				} catch (error) {
					console.warn('fetchCoupleCenter failed', error)
					this.coupleCenterData = getDefaultCoupleCenterData()
					if (!silent) {
						uni.showToast({
							title: error.message || '获取情侣信息失败',
							icon: 'none'
						})
					}
				}
			},
			onChooseAvatar(event) {
				const avatarUrl = event.detail && event.detail.avatarUrl ? event.detail.avatarUrl : ''
				this.loginForm.avatarUrl = avatarUrl
				this.loginForm.avatarFileId = ''
			},
			onNicknameInput(event) {
				this.loginForm.nickname = event.detail.value || ''
			},
			onNicknameBlur(event) {
				this.loginForm.nickname = event.detail.value || this.loginForm.nickname
			},
			async handleWechatLogin() {
				// #ifndef MP-WEIXIN
				uni.showToast({
					title: '请在微信小程序环境中登录',
					icon: 'none'
				})
				return
				// #endif

				if (this.isLoggingIn) {
					return
				}

				this.isLoggingIn = true
				uni.showLoading({
					title: '登录中',
					mask: true
				})

				try {
					const loginRes = await uni.login()
					const code = loginRes.code

					if (!code) {
						throw new Error('未获取到微信登录 code')
					}

					const loginPayload = {
						code
					}
					const nickname = (this.loginForm.nickname || '').trim()
					if (nickname) {
						loginPayload.nickname = nickname
					}
					if (this.loginForm.avatarUrl) {
						const avatarResult = await uploadAvatarIfNeeded(this.loginForm.avatarUrl)
						if (avatarResult.avatarFileId) {
							loginPayload.avatarFileId = avatarResult.avatarFileId
							loginPayload.avatarFile = avatarResult.avatarFile
							this.loginForm.avatarFileId = avatarResult.avatarFileId
						} else if (avatarResult.avatarUrl) {
							loginPayload.avatarUrl = avatarResult.avatarUrl
						}
					}

					const result = await getAuthApi().loginByWeixin(loginPayload)
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '登录失败')
					}

					await Promise.all([
						this.fetchCurrentUser({
							silent: true
						}),
						this.fetchCoupleCenter({
							silent: true
						})
					])

					uni.showToast({
						title: '登录成功',
						icon: 'success'
					})
				} catch (error) {
					console.error('handleWechatLogin failed', error)
					uni.showToast({
						title: error.message || '登录失败，请稍后重试',
						icon: 'none'
					})
				} finally {
					this.isLoggingIn = false
					uni.hideLoading()
				}
			},
			async handleLogout() {
				try {
					const currentUserInfo = getCurrentUniIdUser()
					if (currentUserInfo && currentUserInfo.uid) {
						await getAuthApi().logout()
					}
				} catch (error) {
					console.warn('handleLogout failed', error)
				} finally {
					clearUniIdTokenStorage()
					this.userInfo = null
					this.coupleCenterData = getDefaultCoupleCenterData()
					this.resetLoginForm()
					uni.showToast({
						title: '已退出登录',
						icon: 'none'
					})
				}
			},
			goToCouplePage() {
				uni.navigateTo({
					url: '/pages/couple/index'
				})
			},
			handleAction(name) {
				if (!this.isLoggedIn && name !== '登录') {
					uni.showToast({
						title: '请先完成微信登录',
						icon: 'none'
					})
					return
				}

				if (name === '登录') {
					this.handleWechatLogin()
					return
				}

				if (name === '绑定流程' || name === '创建情侣空间') {
					this.goToCouplePage()
					return
				}

				if (name === '相册') {
					uni.navigateTo({
						url: '/pages/album/list'
					})
					return
				}

				uni.showToast({
					title: `${name}功能开发中`,
					icon: 'none'
				})
			}
		}
	}
</script>

<style>
	.page {
		position: relative;
		padding: 32rpx 24rpx 48rpx;
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

	.auth-card,
	.hero-card,
	.section {
		position: relative;
		z-index: 1;
	}

	.auth-card,
	.hero-card {
		padding: 36rpx;
		border-radius: 40rpx;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(255, 244, 236, 0.96));
		box-shadow: 0 24rpx 60rpx rgba(173, 109, 77, 0.12);
	}

	.auth-card {
		margin-bottom: 24rpx;
	}

	.auth-card__header,
	.hero-card__top,
	.profile-editor {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 24rpx;
	}

	.auth-card__eyebrow,
	.eyebrow {
		display: block;
		font-size: 22rpx;
		letter-spacing: 4rpx;
		color: #b98069;
		margin-bottom: 14rpx;
	}

	.auth-card__title,
	.hero-card__title {
		display: block;
		font-size: 48rpx;
		font-weight: 700;
		line-height: 1.3;
		color: #5a3427;
	}

	.auth-card__desc,
	.hero-card__subtitle {
		display: block;
		margin-top: 16rpx;
		font-size: 26rpx;
		line-height: 1.7;
		color: #8b6659;
	}

	.auth-card__status,
	.heart-pill,
	.demo-badge {
		flex-shrink: 0;
		padding: 12rpx 20rpx;
		border-radius: 999rpx;
		font-size: 22rpx;
	}

	.auth-card__status {
		color: #b35a48;
		background: #fff3ec;
	}

	.profile-editor {
		align-items: center;
		margin-top: 30rpx;
		padding: 24rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.72);
	}

	.avatar-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 220rpx;
		padding: 0;
		background: transparent;
		border: 0;
	}

	.avatar-picker::after {
		border: 0;
	}

	.avatar-picker__image {
		width: 120rpx;
		height: 120rpx;
		border-radius: 50%;
		background: #fff1eb;
	}

	.avatar-picker__hint {
		margin-top: 16rpx;
		font-size: 22rpx;
		color: #a17567;
	}

	.profile-editor__form {
		flex: 1;
	}

	.profile-editor__label {
		display: block;
		font-size: 24rpx;
		color: #936d62;
	}

	.profile-editor__input {
		height: 84rpx;
		margin-top: 14rpx;
		padding: 0 24rpx;
		border-radius: 24rpx;
		background: #fffaf7;
		font-size: 28rpx;
		color: #5a3427;
	}

	.profile-editor__tip,
	.auth-card__notice-text {
		display: block;
		margin-top: 14rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #a07b70;
	}

	.auth-card__notice {
		margin-top: 28rpx;
		padding: 24rpx;
		border-radius: 24rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.login-button,
	.primary-action,
	.secondary-action {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		border: 0;
		border-radius: 999rpx;
		font-size: 28rpx;
		font-weight: 600;
		line-height: 88rpx;
	}

	.login-button::after,
	.primary-action::after,
	.secondary-action::after {
		border: 0;
	}

	.login-button,
	.primary-action {
		color: #ffffff;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 16rpx 28rpx rgba(231, 111, 81, 0.28);
	}

	.login-button {
		margin-top: 28rpx;
	}

	.button-hover {
		opacity: 0.92;
		transform: translateY(2rpx);
	}

	.hero-card__title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16rpx;
	}

	.demo-badge {
		color: #b25a45;
		background: rgba(255, 223, 211, 0.8);
	}

	.heart-pill {
		background: #fff3ec;
		color: #b35a48;
	}

	.couple-card {
		margin-top: 34rpx;
	}

	.hero-stats {
		display: flex;
		gap: 18rpx;
		margin-top: 28rpx;
	}

	.hero-stats__item {
		flex: 1;
		padding: 24rpx 18rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.8);
		text-align: center;
	}

	.hero-stats__value {
		display: block;
		font-size: 40rpx;
		font-weight: 700;
		color: #8f4f3e;
	}

	.hero-stats__label {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		color: #9a776d;
	}

	.hero-actions {
		display: flex;
		gap: 18rpx;
		margin-top: 28rpx;
	}

	.primary-action,
	.secondary-action {
		flex: 1;
	}

	.secondary-action {
		color: #b05b48;
		background: rgba(255, 241, 235, 0.96);
	}

	.section {
		margin-top: 28rpx;
	}

	.section__header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 18rpx;
		padding: 0 8rpx;
	}

	.section__title {
		font-size: 34rpx;
		font-weight: 700;
		color: #5b3529;
	}

	.section__hint {
		font-size: 22rpx;
		color: #ad8476;
	}

	.quick-grid {
		display: flex;
		flex-wrap: wrap;
		margin: 0 -9rpx;
	}

	.quick-grid__item,
	.timeline-card,
	.moment-card,
	.plan-card {
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
	}

	.quick-grid__item {
		box-sizing: border-box;
		width: calc(50% - 18rpx);
		margin: 0 9rpx 18rpx;
		padding: 24rpx;
	}

	.quick-grid__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 84rpx;
		height: 84rpx;
		border-radius: 24rpx;
	}

	.quick-grid__emoji {
		font-size: 28rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.quick-grid__title {
		display: block;
		margin-top: 22rpx;
		font-size: 30rpx;
		font-weight: 700;
		color: #5b3529;
	}

	.quick-grid__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: #917165;
	}

	.timeline-card {
		padding: 12rpx 24rpx;
	}

	.timeline-card__item {
		display: flex;
		gap: 18rpx;
		padding: 24rpx 0;
	}

	.timeline-card__item + .timeline-card__item {
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.timeline-card__dot {
		width: 18rpx;
		height: 18rpx;
		margin-top: 14rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ff9a76 0%, #f4b183 100%);
		box-shadow: 0 0 0 8rpx rgba(255, 186, 160, 0.18);
	}

	.timeline-card__body {
		flex: 1;
	}

	.timeline-card__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
	}

	.timeline-card__title {
		font-size: 28rpx;
		font-weight: 700;
		color: #603b2f;
	}

	.timeline-card__countdown {
		font-size: 22rpx;
		color: #c0674d;
	}

	.timeline-card__date,
	.timeline-card__note {
		display: block;
		margin-top: 8rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: #917165;
	}

	.moment-card {
		padding: 26rpx;
	}

	.moment-card + .moment-card {
		margin-top: 18rpx;
	}

	.moment-card__top,
	.moment-card__author,
	.moment-card__footer,
	.plan-card__head,
	.plan-card__progress {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.moment-card__top {
		gap: 18rpx;
	}

	.moment-card__author {
		gap: 16rpx;
		justify-content: flex-start;
	}

	.moment-card__avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 72rpx;
		height: 72rpx;
		border-radius: 50%;
	}

	.moment-card__avatar-text {
		font-size: 26rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.moment-card__name {
		display: block;
		font-size: 28rpx;
		font-weight: 700;
		color: #5c372b;
	}

	.moment-card__time {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: #a07d71;
	}

	.moment-card__tag {
		padding: 10rpx 18rpx;
		border-radius: 999rpx;
		font-size: 22rpx;
		color: #b8604c;
		background: #fff1eb;
	}

	.moment-card__content {
		display: block;
		margin-top: 20rpx;
		font-size: 27rpx;
		line-height: 1.8;
		color: #6d473a;
	}

	.moment-card__footer {
		margin-top: 20rpx;
		gap: 16rpx;
		flex-wrap: wrap;
	}

	.moment-card__meta {
		font-size: 22rpx;
		color: #a07d71;
	}

	.plan-card {
		padding: 24rpx;
	}

	.plan-card__item + .plan-card__item {
		margin-top: 20rpx;
		padding-top: 20rpx;
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.plan-card__title {
		font-size: 28rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.plan-card__status {
		font-size: 22rpx;
		color: #c0674d;
	}

	.plan-card__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #8f6e63;
	}

	.plan-card__progress {
		gap: 16rpx;
		margin-top: 18rpx;
	}

	.plan-card__progress-bar {
		flex: 1;
		height: 14rpx;
		border-radius: 999rpx;
		background: #f8e4dc;
		overflow: hidden;
	}

	.plan-card__progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(135deg, #ff9c74 0%, #f48c63 100%);
	}

	.plan-card__progress-text {
		font-size: 22rpx;
		color: #a07062;
	}
</style>
