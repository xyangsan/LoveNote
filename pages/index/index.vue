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
					<text class="profile-editor__label">昵称（选填）</text>
					<input
						class="profile-editor__input"
						type="nickname"
						placeholder="选填，不填自动帮你取一个"
						maxlength="20"
						:value="loginForm.nickname"
						@input="onNicknameInput"
						@blur="onNicknameBlur"
					/>
					<text class="profile-editor__tip">昵称可以不填，不填会帮你自动生成一个；登录后可在资料页随时改。</text>
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
				<view v-for="item in relationshipStats()" :key="item.label" class="hero-stats__item">
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

		<view class="ad-view ad-banner">
			<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
		</view>
		<view class="section">
			<view class="section__header">
				<text class="section__title">今天想先做什么</text>
				<text class="section__hint">快捷入口</text>
			</view>
			<view class="quick-grid">
				<view
					v-for="item in visibleQuickActions"
					:key="item.title"
					class="quick-grid__item"
					@click="handleAction(item.action || item.title)"
				>
					<view class="quick-grid__icon" :style="{ background: item.gradient }">
						<text class="quick-grid__emoji">{{ item.icon }}</text>
					</view>
					<text class="quick-grid__title">{{ item.title }}</text>
					<text class="quick-grid__desc">{{ item.desc }}</text>
				</view>
			</view>
		</view>

		<view class="ad-view ad-grid">
			<ad unit-id="adunit-7a1e5e50b619b450"></ad>
		</view>
		<view class="ad-view ad">
			<ad unit-id="adunit-38461899baf8b875"></ad>
		</view>

		<view class="section">
			<view class="section__header">
				<text class="section__title">纪念日提醒</text>
				<text class="section__hint">{{ anniversaryHint }}</text>
			</view>
			<view v-if="anniversaries.length" class="timeline-card">
				<view v-for="item in anniversaries" :key="item.id" class="timeline-card__item">
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
			<view v-else class="section-empty-card" @click="handleAction('anniversary')">
				<text class="section-empty-card__title">暂无纪念日提醒</text>
				<text class="section-empty-card__desc">去创建一条纪念日，首页会自动展示倒计时</text>
			</view>
		</view>

		<!-- 双人日常：受运营管理「权限」tab 的 feed 显示开关控制，默认关闭 -->
		<view v-if="feedVisible" class="section">
			<view class="section__header">
				<text class="section__title">最近双人动态</text>
				<text class="section__hint">{{ momentHint }}</text>
			</view>
			<view v-if="moments.length">
				<view
					v-for="post in moments"
					:key="post.id"
					class="moment-card"
					@click="handleAction('feed')"
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
					</view>
					<text class="moment-card__content">{{ post.content }}</text>
					<view v-if="post.location" class="moment-card__footer">
						<text v-if="post.location" class="moment-card__meta moment-card__meta--location">{{ post.location }}</text>
					</view>
				</view>
			</view>
			<view v-else class="section-empty-card" @click="handleAction('feed')">
				<text class="section-empty-card__title">暂无双人日常</text>
				<text class="section-empty-card__desc">发布第一条图文或视频，记录你们今天的瞬间</text>
			</view>
		</view>

		<view class="section">
			<view class="section__header">
				<text class="section__title">愿望清单预览</text>
				<text class="section__hint">同步展示双方愿望与计划进度</text>
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
	import { getAnniversaryApi } from '../../common/api/anniversary.js'
	import { getDailyApi } from '../../common/api/daily.js'
	import { getPlatformApi } from '../../common/api/platform.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { tryShowInterstitialAd } from '../../common/utils/interstitial-ad.js'
	import LoveRelationBar from '../../components/love-relation-bar/love-relation-bar.vue'

	// 插屏广告展示概率：onLoad / 回到首页的 onShow 各抽一次，抽中才弹；
	// 全 App 生命周期内最多弹一次（状态由 common/utils/interstitial-ad.js 维护，App 启动时重置）
	const INTERSTITIAL_AD_SHOW_RATE = 1 / 3

	// 首页模块显示开关的本地缓存：先用上次结果渲染，避免每次进首页都闪一下。
	// 存一个对象而不是每个模块一个 key，后续加模块只要在 DEFAULT_MODULE_VISIBILITY 里加一行
	const MODULE_VISIBILITY_CACHE_KEY = 'love_module_visibility'
	const DEFAULT_MODULE_VISIBILITY = {
		feedVisible: false, // 双人日常：权限类开关，默认关闭
		gameVisible: true // 聚会游戏：功能类开关，默认开启
	}
	// 首页是 tabBar 页，onShow 触发很密（从任何页面返回都算），配置最多 30 秒对齐一次
	const MODULE_VISIBILITY_FETCH_INTERVAL = 30 * 1000
	let lastModuleVisibilityFetchAt = 0

	/** 缓存缺失 / 读失败一律用默认值（feed 关、game 开），别把异常带进首屏 */
	function readModuleVisibilityCache() {
		try {
			const cached = uni.getStorageSync(MODULE_VISIBILITY_CACHE_KEY)
			if (!cached || typeof cached !== 'object') {
				// 兼容上一版单独存的 feed 布尔值（love_feed_visible），读到就接着用，避免升级后闪一下
				const legacyFeed = uni.getStorageSync('love_feed_visible')
				return {
					feedVisible: legacyFeed === true || legacyFeed === 'true' || legacyFeed === 1,
					gameVisible: DEFAULT_MODULE_VISIBILITY.gameVisible
				}
			}
			return {
				feedVisible: cached.feedVisible === true,
				gameVisible: cached.gameVisible !== false
			}
		} catch (error) {
			return Object.assign({}, DEFAULT_MODULE_VISIBILITY)
		}
	}

	function writeModuleVisibilityCache(visibility = {}) {
		try {
			uni.setStorageSync(MODULE_VISIBILITY_CACHE_KEY, {
				feedVisible: visibility.feedVisible === true,
				gameVisible: visibility.gameVisible !== false
			})
		} catch (error) {
			// 缓存写失败不影响本次渲染，下次进首页重新拉服务端配置
		}
	}

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

	function getDefaultPlanPreview() {
		return [
			{
				title: '创建第一条愿望',
				status: '待开始',
				desc: '可在愿望清单里创建愿望或计划，并同步双方进度。',
				progress: 0
			}
		]
	}

	function getDefaultOverviewStats() {
		return {
			isBound: false,
			albumTotal: null,
			dailyTotal: null,
			anniversaryTotal: null,
			planTotal: null,
			wishTotal: null
		}
	}

	function getDefaultAnniversaryReminderList() {
		return []
	}

	function getDefaultMomentPreviewList() {
		return []
	}

	function formatDateTimeWithTime(timestamp) {
		if (!timestamp) {
			return '--'
		}
		const date = new Date(Number(timestamp))
		if (Number.isNaN(date.getTime())) {
			return '--'
		}
		const month = `${date.getMonth() + 1}`.padStart(2, '0')
		const day = `${date.getDate()}`.padStart(2, '0')
		const hour = `${date.getHours()}`.padStart(2, '0')
		const minute = `${date.getMinutes()}`.padStart(2, '0')
		return `${month}-${day} ${hour}:${minute}`
	}

	function getAuthorShortName(name = '') {
		const text = String(name || '').trim()
		return text ? text.slice(0, 1) : '爱'
	}

	function getMomentLocationText(post = {}) {
		const location = post && post.location && typeof post.location === 'object' ? post.location : {}
		const name = String(location.name || '').trim()
		return name
	}

	function trimContentText(content = '', maxLength = 64) {
		const text = String(content || '').trim()
		if (text.length <= maxLength) {
			return text
		}
		return `${text.slice(0, maxLength)}...`
	}

	function buildAnniversaryNote(item = {}) {
		const parts = []
		if (item.repeat_type === 'yearly') {
			parts.push('每年提醒')
		} else if (item.repeat_type === 'monthly') {
			parts.push('每月提醒')
		} else if (item.repeat_type === 'weekly') {
			parts.push('每周提醒')
		} else if (item.repeat_type === 'none') {
			parts.push('单次提醒')
		}
		if (item.date_type === 'lunar') {
			parts.push('农历')
		} else {
			parts.push('公历')
		}
		if (item.next_date) {
			parts.push(`下次 ${item.next_date}`)
		}
		return parts.join(' · ')
	}

	function normalizeAnniversaryReminderList(list = []) {
		const sourceList = Array.isArray(list) ? list : []
		return sourceList.slice(0, 3).map((item) => ({
			id: String(item._id || ''),
			title: String(item.title || '').trim() || '纪念日',
			date: String(item.date_value || '--'),
			countdown: String(item.countdown_text || '--'),
			note: buildAnniversaryNote(item)
		}))
	}

	function buildAvatarGradient(seed = '') {
		const palettes = [
			'linear-gradient(135deg, #ff9a8b 0%, #ff6a88 100%)',
			'linear-gradient(135deg, #ffc371 0%, #ff8c42 100%)',
			'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
			'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
		]
		const text = String(seed || '')
		const sum = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
		return palettes[sum % palettes.length]
	}

	function normalizeMomentPreviewList(list = []) {
		const sourceList = Array.isArray(list) ? list : []
		return sourceList.slice(0, 3).map((item) => {
			const authorName = String(item.author_snapshot && item.author_snapshot.nickname || '').trim() || '恋人'
			const fallbackText = item.media_type === 'video'
				? '发布了一个视频'
				: (item.media_type === 'image' ? '分享了新的照片' : '记录了一条日常')
			return {
				id: String(item._id || ''),
				author: authorName,
				authorShort: getAuthorShortName(authorName),
				time: formatDateTimeWithTime(item.create_time),
				content: trimContentText(item.content || fallbackText, 72),
				location: getMomentLocationText(item),
				avatarGradient: buildAvatarGradient(item.author_uid || authorName)
			}
		})
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
			// 模块开关先按上次结果渲染（feed 默认关、game 默认开），onShow 再对齐服务端配置。
			// 放在 data 里而不是 onLoad：首屏就按缓存画，省掉一次「先全显示再收起」的跳动
			const visibility = readModuleVisibilityCache()

			return {
				loveDays,
				startDateText: formatDate(startDate),
				interstitialAdShow: true,
				// onShow 只在「页面被盖住 / App 退到后台后再回来」时抽插屏广告，
				// 首次 onShow（紧跟 onLoad）不抽，否则相当于 onLoad 连抽两次
				allowInterstitialAdOnShow: false,
				// 双人日常：权限类开关，默认关闭
				feedVisible: visibility.feedVisible,
				// 聚会游戏：功能类开关，默认开启
				gameVisible: visibility.gameVisible,
				isLoggingIn: false,
				appStateStore: null,
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
						action: 'anniversary',
						icon: '01',
						gradient: 'linear-gradient(135deg, #ffe29f 0%, #ffa99f 100%)'
					},
					{
						title: '双人日常',
						desc: '发布今天的小片段',
						action: 'feed',
						icon: '02',
						gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
					},
					{
						title: '相册',
						desc: '记录我们的美好瞬间',
						action: 'album',
						icon: '03',
						gradient: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)'
					},
					{
						title: '愿望清单',
						desc: '制定愿望与计划并同步执行进度',
						action: 'plan',
						icon: '04',
						gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'
					},
					{
						title: '聚会游戏',
						desc: '谁是卧底、斗地主、数字炸弹',
						action: 'game',
						icon: '05',
						gradient: 'linear-gradient(135deg, #ffb37a 0%, #e76f51 100%)'
					}
				],
				anniversaries: getDefaultAnniversaryReminderList(),
				moments: getDefaultMomentPreviewList(),
				plans: getDefaultPlanPreview(),
				overviewStats: getDefaultOverviewStats()
			}
		},
		computed: {
			// 关掉的模块不在快捷入口里留格子（关 feed 剩 4 个，两个都关剩 3 个，flex 自动均分）
			visibleQuickActions() {
				return this.quickActions.filter((item) => {
					if (item.action === 'feed') {
						return this.feedVisible
					}
					if (item.action === 'game') {
						return this.gameVisible
					}
					return true
				})
			},
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
			},
			anniversaryHint() {
				if (!this.isLoggedIn) {
					return '登录后可查看你们的纪念日倒计时'
				}
				if (!this.activeCouple) {
					return '完成情侣绑定后自动同步纪念日提醒'
				}
				if (!this.anniversaries.length) {
					return '暂未创建纪念日，点击进入去添加'
				}
				return `已同步 ${this.anniversaries.length} 条提醒`
			},
			momentHint() {
				if (!this.isLoggedIn) {
					return '登录后可查看你们最近发布的双人日常'
				}
				if (!this.activeCouple) {
					return '完成情侣绑定后同步双人动态'
				}
				if (!this.moments.length) {
					return '还没有双人日常，点击去发布第一条'
				}
				return `已展示最新 ${this.moments.length} 条动态`
			}
		},
		onLoad() {
			this.ensureAppStateStore()
			this.syncFromAppState()
			// 分享入口由 common/mixins/share.js 统一管理（默认开放，仅黑名单页面关闭），
			// 这里不需要再调 showShareMenu
			// #ifdef MP-WEIXIN
			// 首屏抽一次：1/3 概率弹插屏（没抽中连实例都不创建，省一次素材请求）
			// 全 App 生命周期内只弹一次，状态在 utils/interstitial-ad.js 里
			tryShowInterstitialAd({ chance: INTERSTITIAL_AD_SHOW_RATE })
			// #endif
		},
		onShow() {
			this.restoreLoginState()
			// 运营侧刚改过开关时，回到首页要立刻按新配置渲染
			this.fetchModuleVisibility()
			// 首次 onShow 紧跟 onLoad，已经抽过一次了，这里跳过；
			// 之后每次「回到首页」（从别的页面返回 / App 切回前台）再随机抽一次
			if (this.allowInterstitialAdOnShow) {
				tryShowInterstitialAd({ chance: INTERSTITIAL_AD_SHOW_RATE })
			}
		},
		onHide() {
			// 页面被盖住或 App 退到后台：下一次 onShow 说明是「回来」，才允许再抽
			this.allowInterstitialAdOnShow = true
		},
		onShareAppMessage() {
			return {
				// ⚠️ 文案里不要出现「记录 / 日常 / 相册」这类笔记语义的词，
				// 会被审核员当成「社交-笔记」类目的直接证据
				title: '恋人手札｜纪念日、心愿与聚会游戏',
				path: '/pages/index/index',
				imageUrl: '/static/logo.png'
			}
		},
		onShareTimeline() {
			return {
				title: '恋人手札｜纪念日、心愿与聚会游戏',
				query: '',
				imageUrl: '/static/logo.png'
			}
		},
		methods: {
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			syncFromAppState() {
				const appStateStore = this.ensureAppStateStore()
				this.userInfo = appStateStore.userInfo || null
				this.coupleCenterData = appStateStore.coupleCenterData || getDefaultCoupleCenterData()
				this.plans = Array.isArray(appStateStore.planPreview) && appStateStore.planPreview.length
					? appStateStore.planPreview
					: getDefaultPlanPreview()
				this.overviewStats = appStateStore.overviewStats || getDefaultOverviewStats()
			},
			resetLoginForm() {
				this.loginForm = {
					nickname: '',
					avatarUrl: '',
					avatarFileId: ''
				}
			},
			resetOverviewStats() {
				this.overviewStats = getDefaultOverviewStats()
			},
			resetHomeSections() {
				this.anniversaries = getDefaultAnniversaryReminderList()
				this.moments = getDefaultMomentPreviewList()
			},
			async fetchAnniversaryReminders({ silent = true } = {}) {
				// ⚠️ 不要加 `!this.activeCouple` 前置判断：未绑定情侣也能创建纪念日，
				// 后端 getList 只按创建者可见性返回（自己创建的全量 + 对方绑定后的），
				// 加了这道门会让未绑定用户首页永远显示「暂无纪念日提醒」。
				if (!this.isLoggedIn) {
					this.anniversaries = getDefaultAnniversaryReminderList()
					return
				}

				try {
					const result = await getAnniversaryApi().getList({
						page: 1,
						pageSize: 3
					})
					if (result && result.errCode && result.errCode !== 0) {
						if (result.errCode === 'love-note-no-couple') {
							this.anniversaries = getDefaultAnniversaryReminderList()
							return
						}
						throw new Error(result.errMsg || '获取纪念日提醒失败')
					}
					const list = Array.isArray(result.data && result.data.list) ? result.data.list : []
					this.anniversaries = normalizeAnniversaryReminderList(list)
				} catch (error) {
					console.warn('fetchAnniversaryReminders failed', error)
					this.anniversaries = getDefaultAnniversaryReminderList()
					if (!silent) {
						uni.showToast({
							title: error.message || '获取纪念日提醒失败',
							icon: 'none'
						})
					}
				}
			},
			async fetchMomentPreview({ silent = true } = {}) {
				// 双人日常被运营关掉后，首页连这份列表都不该请求
				if (!this.feedVisible) {
					this.moments = getDefaultMomentPreviewList()
					return
				}
				// 同上：未绑定也能发双人日常，别用 activeCouple 挡请求
				if (!this.isLoggedIn) {
					this.moments = getDefaultMomentPreviewList()
					return
				}

				try {
					const result = await getDailyApi().getList({
						page: 1,
						pageSize: 3
					})
					if (result && result.errCode && result.errCode !== 0) {
						if (result.errCode === 'love-note-no-couple') {
							this.moments = getDefaultMomentPreviewList()
							return
						}
						throw new Error(result.errMsg || '获取双人日常失败')
					}
					const list = Array.isArray(result.data && result.data.list) ? result.data.list : []
					this.moments = normalizeMomentPreviewList(list)
				} catch (error) {
					console.warn('fetchMomentPreview failed', error)
					this.moments = getDefaultMomentPreviewList()
					if (!silent) {
						uni.showToast({
							title: error.message || '获取双人日常失败',
							icon: 'none'
						})
					}
				}
			},
			// 运营管理「权限」tab 的模块开关：游客也按同一口径渲染，读不到就用默认值
			async fetchModuleVisibility() {
				const now = Date.now()
				if (now - lastModuleVisibilityFetchAt < MODULE_VISIBILITY_FETCH_INTERVAL) {
					return
				}
				lastModuleVisibilityFetchAt = now
				try {
					const result = await getPlatformApi().getModuleVisibility()
					if (!result || (result.errCode && result.errCode !== 0)) {
						return
					}
					this.applyModuleVisibility(result.data || {})
				} catch (error) {
					// 配置接口失败就沿用缓存值，不影响首页其它模块
					console.warn('fetchModuleVisibility failed', error)
				}
			},
			applyModuleVisibility(visibility = {}) {
				const feedVisible = visibility.feedVisible === true
				const gameVisible = visibility.gameVisible !== false
				const feedChanged = this.feedVisible !== feedVisible
				this.feedVisible = feedVisible
				this.gameVisible = gameVisible
				writeModuleVisibilityCache({
					feedVisible,
					gameVisible
				})

				if (!feedVisible) {
					this.moments = getDefaultMomentPreviewList()
					return
				}

				// 缓存里是「关」、服务端刚打开：补一次列表请求，否则这次进首页要等下次才有内容
				if (feedChanged && this.isLoggedIn && !this.moments.length) {
					this.fetchMomentPreview({
						silent: true
					})
				}
			},
			async loadHomeSections({ silent = true } = {}) {
				if (!this.isLoggedIn) {
					this.resetHomeSections()
					return
				}
				await Promise.all([
					this.fetchAnniversaryReminders({
						silent
					}),
					this.fetchMomentPreview({
						silent
					})
				])
			},
			safeCount(value) {
				const nextValue = Number(value)
				return Number.isNaN(nextValue) ? 0 : Math.max(0, Math.floor(nextValue))
			},
			relationshipStats() {
				const stats = this.overviewStats || {}
				const list = stats.isBound
					? [
						{
							key: 'anniversary',
							label: '共同纪念日',
							value: `${this.safeCount(stats.anniversaryTotal)}`
						},
						{
							key: 'feed',
							label: '双人动态',
							value: `${this.safeCount(stats.dailyTotal)}`
						},
						{
							key: 'plan',
							label: '共同计划',
							value: `${this.safeCount(stats.planTotal)}`
						},
						{
							key: 'album',
							label: '相册',
							value: `${this.safeCount(stats.albumTotal)}`
						}
					]
					: [
						{
							key: 'anniversary',
							label: '共同纪念日',
							value: '--'
						},
						{
							key: 'feed',
							label: '双人动态',
							value: '--'
						},
						{
							key: 'plan',
							label: '共同计划',
							value: '--'
						},
						{
							key: 'album',
							label: '相册',
							value: '--'
						}
					]

				// 双人日常关掉后，统计里也不留「双人动态」—— 看得到数字却找不到入口更奇怪
				return this.feedVisible ? list : list.filter((item) => item.key !== 'feed')
			},
			async restoreLoginState() {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.restoreSessionData({
						force: false
					})
					this.syncFromAppState()
					if (this.userInfo) {
						this.loginForm.nickname = this.userInfo.nickname || this.loginForm.nickname
						this.loginForm.avatarUrl = this.userInfo.avatarUrl || this.loginForm.avatarUrl
						this.loginForm.avatarFileId = this.userInfo.avatarFileId || this.loginForm.avatarFileId
					}
					await this.loadHomeSections({
						silent: true
					})
				} catch (error) {
					console.warn('restoreLoginState failed', error)
					this.syncFromAppState()
					this.resetHomeSections()
				}
			},
			async fetchCurrentUser({ silent = false, force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchUserInfo({
						force
					})
					this.syncFromAppState()
					if (this.userInfo) {
						this.loginForm.nickname = this.userInfo.nickname || this.loginForm.nickname
						this.loginForm.avatarUrl = this.userInfo.avatarUrl || this.loginForm.avatarUrl
						this.loginForm.avatarFileId = this.userInfo.avatarFileId || this.loginForm.avatarFileId
					}
				} catch (error) {
					console.warn('fetchCurrentUser failed', error)
					this.syncFromAppState()
					if (!silent) {
						uni.showToast({
							title: error.message || '登录状态已失效，请重新登录',
							icon: 'none'
						})
					}
				}
			},
			async fetchCoupleCenter({ silent = false, force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchCoupleCenter({
						force
					})
					this.syncFromAppState()
				} catch (error) {
					console.warn('fetchCoupleCenter failed', error)
					this.syncFromAppState()
					if (!silent) {
						uni.showToast({
							title: error.message || '获取情侣信息失败',
							icon: 'none'
						})
					}
				}
			},
			async fetchPlanPreview({ silent = false, force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchPlanPreview({
						force
					})
					this.syncFromAppState()
				} catch (error) {
					console.warn('fetchPlanPreview failed', error)
					this.syncFromAppState()
					if (!silent) {
						uni.showToast({
							title: error.message || '获取愿望清单失败',
							icon: 'none'
						})
					}
				}
			},
			async fetchOverviewStats({ silent = false, force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchOverviewStats({
						force
					})
					this.syncFromAppState()
				} catch (error) {
					console.warn('fetchOverviewStats failed', error)
					this.syncFromAppState()
					if (!silent) {
						uni.showToast({
							title: error.message || '获取统计信息失败',
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

					const appStateStore = this.ensureAppStateStore()
					appStateStore.clearAllState()
					await Promise.all([
						this.fetchCurrentUser({
							silent: true,
							force: true
						}),
						this.fetchCoupleCenter({
							silent: true,
							force: true
						}),
						this.fetchPlanPreview({
							silent: true,
							force: true
						}),
						this.fetchOverviewStats({
							silent: true,
							force: true
						})
					])
					await this.loadHomeSections({
						silent: true
					})

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
					this.ensureAppStateStore().clearAllState()
					this.syncFromAppState()
					this.resetLoginForm()
					this.resetHomeSections()
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
				const action = String(name || '').trim()

				// 聚会游戏大厅免登录可进（数字炸弹本地即玩），房间类游戏内部再校验登录
				if (action === 'game') {
					uni.navigateTo({
						url: '/pages/game/index'
					})
					return
				}

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

				if (name === '双人日常' || name === '双人动态') {
					uni.navigateTo({
						url: '/pages/feed/list'
					})
					return
				}

				if (action === 'anniversary') {
					uni.navigateTo({
						url: '/pages/anniversary/list'
					})
					return
				}

				if (action === 'album') {
					uni.navigateTo({
						url: '/pages/album/list'
					})
					return
				}

				if (action === 'feed') {
					uni.navigateTo({
						url: '/pages/feed/list'
					})
					return
				}

				if (action === 'plan') {
					uni.navigateTo({
						url: '/pages/plan/list'
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

	.section-empty-card {
		padding: 30rpx 28rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
	}

	.section-empty-card__title {
		display: block;
		font-size: 28rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.section-empty-card__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: #8f6e63;
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

	.moment-card__meta--location {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
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
