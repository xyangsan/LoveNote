<template>
	<view class="love-page love-page--compact profile-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<noir-navbar :show-back="false" :transparent="true" :border="false">
				<template #left>
					<view class="tp-brand">
						<text class="tp-brand__title">我的</text>
						<text class="tp-brand__sub">PROFILE</text>
					</view>
				</template>
			</noir-navbar>

			<view class="page-head">
				<love-glass-card
					:margin="['0', '0', '0', '0']"
					:padding="['0', '0']"
					:content-padding="['32rpx', '30rpx']"
					:header-line="false"
					@click="handleProfileTap"
				>
					<view class="user-card">
						<fui-avatar
							class="user-card__avatar"
							:src="displayAvatar"
							error-src="/static/user-empty.png"
							width="120"
							height="120"
							background="#231C18"
						></fui-avatar>
						<view class="user-card__body">
							<text class="user-card__name">{{ displayNickname }}</text>
							<text class="user-card__meta">{{ profileMetaText }}</text>
							<text class="user-card__desc">{{ profileDescText }}</text>
						</view>
						<text class="user-card__action">{{ isLoggedIn ? '编辑资料' : '登录' }}</text>
					</view>
				</love-glass-card>

				<view
					v-if="isLoggedIn"
					class="heart-card"
					@click="goToPointsPage"
				>
					<image
						class="heart-card__glow"
						src="/static/images/points/heart_glow.png"
						mode="aspectFit"
					></image>
					<view class="heart-card__head">
						<view class="heart-card__label">
							<image
								class="heart-card__label-heart"
								src="/static/images/points/heart_white.png"
								mode="aspectFit"
							></image>
							<text class="heart-card__label-text">心动点</text>
						</view>
						<view class="heart-card__aside">
							<text class="heart-card__delta">{{ pointsDeltaText }}</text>
							<view class="heart-card__link">
								<text class="heart-card__link-text">明细</text>
								<text class="heart-card__link-arrow">›</text>
							</view>
						</view>
					</view>
					<text class="heart-card__value">{{ pointsBalanceText }}</text>
				</view>
			</view>

			<view
				v-for="(group, groupIndex) in menuGroups"
				:key="group.key"
				class="menu-group"
				:class="{ 'menu-group--first': groupIndex === 0 }"
			>

				<love-glass-card
					class="menu-card"
					:margin="['0', '0', '0', '0']"
					:padding="['0', '0']"
					:content-padding="['12rpx', '14rpx']"
					:header-line="false"
				>
					<view class="menu-card__body">
						<fui-list-cell
							v-for="(item, index) in group.items"
							:key="item.key"
							:padding="['24rpx', '26rpx']"
							background="transparent"
							:bottom-border="index !== group.items.length - 1"
							border-color="rgba(255, 255, 255, 0.06)"
							arrow
							arrow-color="rgba(245, 237, 228, 0.34)"
							@click="handleCardClick(item)"
						>
							<view class="menu-item">
								<view class="menu-item__icon" :style="{ background: item.iconBg }">
									<text class="menu-item__icon-text">{{ item.iconText }}</text>
								</view>
								<view class="menu-item__body">
									<text class="menu-item__title">{{ item.title }}</text>
									<text class="menu-item__desc">{{ item.desc }}</text>
								</view>
								<view class="menu-item__right">
									<view
										v-if="item.value"
										class="menu-item__value-badge"
										:style="{ background: item.iconBg || 'rgba(181, 140, 126, 0.14)' }"
									>
										<text class="menu-item__value-text">{{ item.value }}</text>
									</view>
								</view>
							</view>
						</fui-list-cell>
					</view>
				</love-glass-card>
			</view>

			<view class="profile-logout-wrap">
				<noir-button
					text="退出登录"
					variant="danger"
					size="lg"
					block
					:disabled="!isLoggedIn"
					@click="handleLogout"
				/>
			</view>
		</view>

		<noir-tabbar active="profile" @refresh="handleTabRefresh" />
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		emitAuthChanged,
		getCurrentUniIdUser,
		subscribeAuthChanged
	} from '../../common/auth-center.js'
	import { getAuthApi } from '../../common/api/auth.js'
	import { getPointsApi } from '../../common/api/points.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { APP_VERSION_TEXT } from '../../common/version.js'

	const genderOptions = ['保密', '男', '女']
	const PROFILE_DEFAULT_AVATAR = '/static/user-empty.png'
	const POINTS_CACHE_MS = 30 * 1000
	/** 个人中心回到前台时的强制刷新阈值（比缓存窗口短得多） */
	const POINTS_FORCE_MS = 5 * 1000
	/** 纪念日 / 相册 / 愿望这类计数，回到本页超过这个时间就重查，别让用户看到 60s 前的旧数字 */
	const STATS_FORCE_MS = 5 * 1000

	function getDefaultPointsSummary() {
		return {
			balance: 0,
			todayEarned: 0,
			todayTaskPoints: 0,
			dailyLimitPoints: 180,
			isBound: false
		}
	}

	function getDefaultFeatureStats() {
		return {
			anniversaryTotal: null,
			albumTotal: null,
			dailyTotal: null,
			wishTotal: null,
			planTotal: null
		}
	}

	function formatPoints(value) {
		const num = Math.max(0, Math.floor(Number(value) || 0))
		return `${num}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	function formatDate(timestamp) {
		if (!timestamp) {
			return '暂未设置'
		}

		const date = new Date(timestamp)
		const year = date.getFullYear()
		const month = `${date.getMonth() + 1}`.padStart(2, '0')
		const day = `${date.getDate()}`.padStart(2, '0')
		return `${year}.${month}.${day}`
	}

	function formatBirthday(value = '') {
		if (!value) {
			return '未设置'
		}

		return `${value}`.replace(/-/g, '.')
	}

	export default {
		data() {
			return {
				appStateStore: null,
				userInfo: null,
				removeAuthListener: null,
				pointsSummary: getDefaultPointsSummary(),
				pointsFetchedAt: 0,
				/** pointsSummary 属于哪个 uid：换账号后必须作废，否则会把上一个人的余额画上去 */
				pointsUid: '',
				/** 至少成功拉过一次心动点：没拉到时余额显示「--」，0 分和「没拿到」是两件事 */
				pointsLoaded: false,
				pointsErrorNotified: false,
				statsFetchedAt: 0,
				featureStats: getDefaultFeatureStats()
			}
		},
		computed: {
			isLoggedIn() {
				return Boolean(this.userInfo && this.userInfo._id)
			},
			isAdmin() {
				const roleList = Array.isArray(this.userInfo && this.userInfo.role) ? this.userInfo.role : []
				return roleList.some((item) => String(item || '').trim().toLowerCase() === 'admin')
			},
			hasBoundCouple() {
				return Boolean(this.currentCouple && this.currentCouple.isBound)
			},
			/**
			 * 是否已绑定 —— 只能有一个权威来源，否则卡片会自己打自己的脸：
			 *   ① 心动点接口拉通了：以它的 isBound 为准（服务端实时查的 activeCouple，
			 *      比页面上 60s 缓存的情侣数据新）；
			 *   ② 接口没拉通（isBound 是默认 false）：退回情侣数据，别让已绑定的人
			 *      看到「绑定后累积」——这正是「下方已绑定、上方说去绑定」的成因。
			 */
			isCoupleBound() {
				if (this.pointsLoaded) {
					return Boolean(this.pointsSummary.isBound)
				}
				return this.hasBoundCouple
			},
			pointsBalanceText() {
				if (!this.pointsLoaded) {
					return '--'
				}
				return formatPoints(this.pointsSummary.balance)
			},
			pointsDeltaText() {
				if (!this.isCoupleBound) {
					return '绑定后累积'
				}
				if (!this.pointsLoaded) {
					return '今日 --'
				}
				return `今日 +${formatPoints(this.pointsSummary.todayEarned)}`
			},
			currentUserName() {
				return this.userInfo && this.userInfo.nickname ? this.userInfo.nickname : '微信用户'
			},
			displayNickname() {
				return this.isLoggedIn ? this.currentUserName : '未登录'
			},
			displayAvatar() {
				return (this.userInfo && this.userInfo.avatarUrl) || PROFILE_DEFAULT_AVATAR || DEFAULT_AVATAR
			},
			currentGenderText() {
				return genderOptions[Number(this.userInfo && this.userInfo.gender || 0)] || genderOptions[0]
			},
			currentBirthdayText() {
				return this.userInfo && this.userInfo.birthday ? formatBirthday(this.userInfo.birthday) : '未设置'
			},
			registerDateText() {
				return this.userInfo ? formatDate(this.userInfo.registerDate) : '暂未设置'
			},
			currentCouple() {
				const appStateStore = this.appStateStore || null
				const centerData = appStateStore && appStateStore.coupleCenterData ? appStateStore.coupleCenterData : null
				const activeCouple = centerData && centerData.activeCouple ? centerData.activeCouple : null
				const incomingRequests = centerData && Array.isArray(centerData.incomingRequests) ? centerData.incomingRequests : []
				const outgoingRequests = centerData && Array.isArray(centerData.outgoingRequests) ? centerData.outgoingRequests : []

				if (activeCouple || incomingRequests.length || outgoingRequests.length) {
					return {
						isBound: Boolean(activeCouple),
						statusText: activeCouple
							? '已绑定'
							: (incomingRequests.length ? '待处理' : (outgoingRequests.length ? '等待回应' : '未绑定')),
						partnerNickname: activeCouple
							? (activeCouple.partnerNickname || '')
							: ((incomingRequests[0] && incomingRequests[0].partnerNicknameMasked) ||
								(outgoingRequests[0] && outgoingRequests[0].partnerNicknameMasked) ||
								''),
						pendingIncomingCount: incomingRequests.length,
						pendingOutgoingCount: outgoingRequests.length
					}
				}

				return this.userInfo && this.userInfo.coupleInfo ? this.userInfo.coupleInfo : null
			},
			profileMetaText() {
				if (!this.isLoggedIn) {
					return '默认头像已展示，点击进入登录'
				}

				const meta = []
				if (this.currentGenderText !== '保密') {
					meta.push(this.currentGenderText)
				}
				if (this.currentBirthdayText !== '未设置') {
					meta.push(`生日 ${this.currentBirthdayText}`)
				}
				return meta.length ? meta.join(' · ') : `注册于 ${this.registerDateText}`
			},
			profileDescText() {
				return this.isLoggedIn
					? '查看并管理你的头像、昵称与基础资料'
					: '登录后同步微信头像、昵称与情侣空间信息'
			},
			coupleStatusText() {
				if (!this.currentCouple) {
					return '未绑定'
				}

				if (this.currentCouple.isBound) {
					return '已绑定'
				}

				const incomingCount = Number(this.currentCouple.pendingIncomingCount || 0)
				if (incomingCount > 0) {
					return incomingCount > 1 ? `待处理 ${incomingCount}` : '待处理'
				}

				const outgoingCount = Number(this.currentCouple.pendingOutgoingCount || 0)
				if (outgoingCount > 0) {
					return '等待回应'
				}

				return this.currentCouple.statusText || '待确认'
			},
			coupleCardDesc() {
				if (!this.currentCouple) {
					return '还没有绑定情侣关系'
				}

				if (this.currentCouple.isBound) {
					return `当前伴侣：${this.currentCouple.partnerNickname || '另一半'}`
				}

				const incomingCount = Number(this.currentCouple.pendingIncomingCount || 0)
				if (incomingCount > 1) {
					return `已收到 ${incomingCount} 条绑定请求，请先确认其中 1 条`
				}

				if (incomingCount === 1) {
					return `收到来自 ${this.currentCouple.partnerNickname || '对方'} 的绑定请求`
				}

				const outgoingCount = Number(this.currentCouple.pendingOutgoingCount || 0)
				if (outgoingCount > 1) {
					return `已发出 ${outgoingCount} 条绑定请求，等待对方回应`
				}

				if (outgoingCount === 1) {
					return `已向 ${this.currentCouple.partnerNickname || '对方'} 发起绑定请求`
				}

				return '当前绑定邀请还在等待确认'
			},
			anniversaryCardValue() {
				if (!this.isLoggedIn) {
					return '登录后开启'
				}
				if (!this.hasBoundCouple) {
					return '未绑定'
				}

				const total = this.featureStats.anniversaryTotal
				if (total === null || total === undefined) {
					return '去查看'
				}
				return Number(total) > 0 ? `${Number(total)}` : '去创建'
			},
			albumCardValue() {
				if (!this.isLoggedIn) {
					return '登录后开启'
				}
				if (!this.hasBoundCouple) {
					return '未绑定'
				}

				const total = this.featureStats.albumTotal
				if (total === null || total === undefined) {
					return '去查看'
				}
				return Number(total) > 0 ? `${Number(total)}` : '去创建'
			},
			planCardValue() {
				if (!this.isLoggedIn) {
					return '登录后开启'
				}
				if (!this.hasBoundCouple) {
					return '未绑定'
				}

				const wishTotal = this.featureStats.wishTotal
				const planTotal = this.featureStats.planTotal
				if (wishTotal === null || wishTotal === undefined || planTotal === null || planTotal === undefined) {
					return '去查看'
				}
				
				return `${Number(wishTotal || 0) + Number(planTotal || 0)}`
			},
			coreCards() {
				return [
					{
						key: 'couple',
						title: '情侣信息',
						desc: this.coupleCardDesc,
						value: this.coupleStatusText,
						iconText: '伴',
						iconBg: 'linear-gradient(135deg, #ffd3c2 0%, #ffb199 100%)'
					},
					{
						key: 'anniversary',
						title: '纪念日',
						desc: '记录相恋、生日与重要时刻',
						value: this.anniversaryCardValue,
						iconText: '纪',
						iconBg: 'linear-gradient(135deg, #ffe29f 0%, #ffa99f 100%)'
					},
					{
						key: 'album',
						title: '相册',
						desc: '保存你们的照片和回忆片段',
						value: this.albumCardValue,
						iconText: '册',
						iconBg: 'linear-gradient(135deg, #ffd8f1 0%, #f6b7d2 100%)'
					},
					{
						key: 'plan',
						title: '愿望清单',
						desc: '同步愿望与计划，查看双方进度',
						value: this.planCardValue,
						iconText: '计',
						iconBg: 'linear-gradient(135deg, #d7f5c6 0%, #98d8aa 100%)'
					}
				]
			},
			supportCards() {
				const cards = []

				// 运营管理：仅 admin 角色可见（role 数组含 admin）
				if (this.isAdmin) {
					cards.push({
						key: 'operations',
						title: '运营管理',
						desc: '用户、模块与广告收益数据',
						value: 'ADMIN',
						iconText: '运',
						iconBg: 'linear-gradient(135deg, #f0d3a8 0%, #d9a86c 100%)'
					})
				}

				cards.push({
					key: 'feedback',
					title: '反馈&帮助',
					desc: '遇到问题或有建议都可以告诉我们',
					value: '',
					iconText: '助',
					iconBg: 'linear-gradient(135deg, #d7e8ff 0%, #afcfff 100%)'
				})
				cards.push({
					key: 'version',
					title: '版本信息',
					desc: '查看当前应用版本和更新状态',
					value: APP_VERSION_TEXT,
					iconText: '版',
					iconBg: 'linear-gradient(135deg, #f6ddc3 0%, #eac6a3 100%)'
				})

				return cards
			},
			menuGroups() {
				return [
					{
						key: 'core',
						items: this.coreCards
					},
					{
						key: 'support',
						items: this.supportCards
					}
				]
			}
		},
		onLoad() {
			this.ensureAppStateStore()
			this.syncFromAppState()
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
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			syncFromAppState() {
				const appStateStore = this.ensureAppStateStore()
				this.userInfo = appStateStore.userInfo || null
				this.featureStats = appStateStore.profileFeatureStats || getDefaultFeatureStats()
			},
			resetFeatureStats() {
				this.featureStats = getDefaultFeatureStats()
			},
			/** 退出登录 / 换账号：本页缓存的账号快照必须一起清，否则新账号首屏会闪一眼旧数字 */
			resetLocalUserData() {
				this.pointsSummary = getDefaultPointsSummary()
				this.pointsFetchedAt = 0
				this.pointsUid = ''
				this.pointsLoaded = false
				this.pointsErrorNotified = false
				this.statsFetchedAt = 0
				this.resetFeatureStats()
			},
			async refreshFeatureStats({ force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchOverviewStats({
						force
					})
					this.statsFetchedAt = Date.now()
					this.syncFromAppState()
				} catch (error) {
					console.warn('profile refreshFeatureStats failed', error)
					this.syncFromAppState()
				}
			},
			/** 情侣信息：本页的「已绑定 / 待处理 / 伴侣昵称」全看它，别指望别的页面先拉过 */
			async fetchCoupleCenter({ force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchCoupleCenter({
						force
					})
					this.syncFromAppState()
				} catch (error) {
					console.warn('profile fetchCoupleCenter failed', error)
					this.syncFromAppState()
				}
			},
			async fetchPointsSummary({ force = false } = {}) {
				const currentUser = getCurrentUniIdUser()
				if (!currentUser || !currentUser.uid) {
					this.resetLocalUserData()
					return
				}

				// 缓存是按「上一个账号」算的，换人之后必须重拉，否则会把别人的余额画上去
				const accountChanged = this.pointsUid !== currentUser.uid
				if (!force && !accountChanged && Date.now() - this.pointsFetchedAt < POINTS_CACHE_MS) {
					return
				}

				try {
					const result = await getPointsApi().getSummary()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取心动点失败')
					}
					const data = result && result.data ? result.data : {}
					this.pointsSummary = {
						balance: Number(data.balance || 0),
						todayEarned: Number(data.todayEarned || 0),
						todayTaskPoints: Number(data.todayTaskPoints || 0),
						dailyLimitPoints: Number(data.dailyLimitPoints || 180),
						isBound: Boolean(data.isBound)
					}
					this.pointsUid = currentUser.uid
					this.pointsFetchedAt = Date.now()
					this.pointsLoaded = true
					this.pointsErrorNotified = false
				} catch (error) {
					console.warn('profile fetchPointsSummary failed', error)
					// 一次都没成功过就别让卡片一直显示 0：0 分和「没拿到」是两件事，
					// 顺手提示一次，免得用户以为是新人礼没到账
					if (!this.pointsLoaded && !this.pointsErrorNotified) {
						this.pointsErrorNotified = true
						uni.showToast({
							title: '心动点加载失败，请稍后重试',
							icon: 'none'
						})
					}
				}
			},
			goToPointsPage() {
				if (!this.isLoggedIn) {
					this.goToLoginPage()
					return
				}

				uni.navigateTo({
					url: '/pages/profile/points'
				})
			},
			async restoreLoginState() {
				const appStateStore = this.ensureAppStateStore()
				const currentUserInfo = getCurrentUniIdUser()

				if (!currentUserInfo || !currentUserInfo.uid) {
					appStateStore.clearAllState()
					this.resetLocalUserData()
					this.syncFromAppState()
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					appStateStore.clearAllState()
					this.resetLocalUserData()
					this.syncFromAppState()
					return
				}

				// 换账号：先把上一个账号的本地快照清掉，再拉新的
				if (this.pointsUid && this.pointsUid !== currentUserInfo.uid) {
					this.resetLocalUserData()
				}

				try {
					// 先把「我是谁」拿到手，后面的昵称 / 头像 / 情侣 / 计数才有依附的对象；
					// 它命中 2 分钟缓存时是同步返回，串行成本可以忽略。
					await this.fetchCurrentUser({
						silent: true,
						force: false
					})

					// token 已经失效：再拉情侣 / 计数 / 余额只会一起 401，直接收摊
					if (!this.isLoggedIn) {
						this.resetLocalUserData()
						return
					}

					// 本页的附属数据（情侣、模块计数）用同一个时间戳判定，避免两个都各自留一份缓存
					const forceAux = Date.now() - this.statsFetchedAt > STATS_FORCE_MS

					await Promise.all([
						this.fetchCoupleCenter({
							force: forceAux
						}),
						this.refreshFeatureStats({
							force: forceAux
						}),
						// 从心动点详情 / 任务页返回时余额可能已经变了：超过 5s 就强制拉一次，
						// 不再等 30s 的缓存窗口，否则卡片上还是旧的数字
						this.fetchPointsSummary({
							force: this.pointsUid !== currentUserInfo.uid ||
								Date.now() - this.pointsFetchedAt > POINTS_FORCE_MS
						})
					])
				} catch (error) {
					console.warn('profile restoreLoginState failed', error)
					this.syncFromAppState()
				}
			},
			async fetchCurrentUser({ silent = false, force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchUserInfo({
						force
					})
					this.syncFromAppState()
				} catch (error) {
					console.warn('profile fetchCurrentUser failed', error)
					this.syncFromAppState()

					// store 里已经没有用户了（token 失效被 clearAllState）：本地快照一起丢掉，
					// 否则登录页跳回来的一瞬间还会闪一眼上一个人的余额
					if (!this.userInfo) {
						this.resetLocalUserData()
					}

					if (!silent) {
						uni.showToast({
							title: '登录状态已失效，请重新登录',
							icon: 'none'
						})
					}
				}
			},
			goToLoginPage() {
				// 本页是 tabBar 页：不能 redirectTo（tabBar 页关不掉），
				// 登录页登录成功后走 switchTab 回来，会清掉栈里的登录页，不会留重复实例
				uni.navigateTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/profile/index')
				})
			},
			goToEdit() {
				uni.navigateTo({
					url: '/pages/profile/edit'
				})
			},
			handleProfileTap() {
				if (!this.isLoggedIn) {
					this.goToLoginPage()
					return
				}

				this.goToEdit()
			},
			handleCardClick(item) {
				if (!item) {
					return
				}

				if (!this.isLoggedIn && ['couple', 'anniversary', 'album', 'plan', 'feedback'].includes(item.key)) {
					this.goToLoginPage()
					return
				}

				switch (item.key) {
					case 'couple':
						uni.navigateTo({
							url: '/pages/couple/index'
						})
						break
					case 'anniversary':
						uni.navigateTo({
							url: '/pages/anniversary/list'
						})
						break
					case 'album':
						uni.navigateTo({
							url: '/pages/album/list'
						})
						break
					case 'plan':
						uni.navigateTo({
							url: '/pages/plan/list'
						})
						break
					case 'operations':
						uni.navigateTo({
							url: '/pages/operations/index'
						})
						break
					case 'feedback':
						if (!this.isAdmin) {
							uni.navigateTo({
								url: '/pages/feedback/index'
							})
							break
						}

						uni.showActionSheet({
							itemList: ['进入反馈列表', '我要反馈'],
							success: (res = {}) => {
								const tapIndex = Number(res.tapIndex || 0)
								if (tapIndex === 0) {
									uni.navigateTo({
										url: '/pages/feedback/list'
									})
									return
								}
								uni.navigateTo({
									url: '/pages/feedback/index'
								})
							}
						})
						break
					case 'version':
						uni.showToast({
							title: `当前版本 ${APP_VERSION_TEXT}`,
							icon: 'none'
						})
						break
					default:
						break
				}
			},
			async handleLogout() {
				if (!this.isLoggedIn) {
					uni.showToast({
						title: '当前未登录',
						icon: 'none'
					})
					return
				}

				try {
					const currentUserInfo = getCurrentUniIdUser()
					if (currentUserInfo && currentUserInfo.uid) {
						await getAuthApi().logout()
					}
				} catch (error) {
					console.warn('profile handleLogout failed', error)
				} finally {
					clearUniIdTokenStorage()
					this.ensureAppStateStore().clearAllState()
					this.resetLocalUserData()
					this.syncFromAppState()
					emitAuthChanged({
						action: 'logout'
					})
					uni.showToast({
						title: '已退出登录',
						icon: 'none'
					})
				}
			},
			handleTabRefresh() {
				this.restoreLoginState()
			}
		}
	}
</script>

<style>
	.profile-page {
		padding: 0 28rpx calc(184rpx + env(safe-area-inset-bottom));
	}

	.tp-brand {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.tp-brand__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		letter-spacing: 3rpx;
		line-height: 1.15;
		color: #FBF4EA;
		white-space: nowrap;
	}

	.tp-brand__sub {
		margin-top: 2rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 15rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.58);
		white-space: nowrap;
	}

	.page-head {
		padding-top: 16rpx;
		padding-bottom: 18rpx;
	}

	.user-card {
		display: flex;
		align-items: center;
		gap: 22rpx;
	}

	.user-card__avatar {
		flex-shrink: 0;
		border: 2rpx solid rgba(216, 176, 140, 0.52);
		border-radius: 50%;
	}

	.user-card__body {
		flex: 1;
		min-width: 0;
	}

	.user-card__name {
		display: block;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 38rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.user-card__meta,
	.user-card__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.48);
		word-break: break-all;
	}

	.user-card__action {
		flex-shrink: 0;
		align-self: center;
		padding: 10rpx 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(245, 237, 228, 0.20);
		background: rgba(255, 255, 255, 0.04);
		font-size: 22rpx;
		color: #EAD4BC;
	}

	.menu-group {
		margin-top: 22rpx;
	}

	.menu-group--first {
		margin-top: 24rpx;
	}

	.menu-card__body {
		padding: 0;
	}

	.menu-item {
		display: flex;
		align-items: center;
		width: 100%;
	}

	.menu-item__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 68rpx;
		height: 68rpx;
		border-radius: 20rpx;
		flex-shrink: 0;
		border: 1rpx solid rgba(216, 176, 140, 0.28);
	}

	.menu-item__icon-text {
		font-size: 26rpx;
		font-weight: 600;
		color: #FFF7EF;
	}

	.menu-item__body {
		flex: 1;
		min-width: 0;
		margin-left: 18rpx;
	}

	.menu-item__title {
		display: block;
		font-size: 28rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.menu-item__desc {
		margin-top: 6rpx;
		font-size: 22rpx;
		line-height: 1.5;
		color: rgba(245, 237, 228, 0.44);
		display: -webkit-box;
		overflow: hidden;
		text-overflow: ellipsis;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.menu-item__right {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		margin-left: 14rpx;
		max-width: 220rpx;
	}

	.menu-item__value-badge {
		max-width: 220rpx;
		padding: 6rpx 14rpx;
		border-radius: 999rpx;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(216, 176, 140, 0.14) !important;
	}

	.menu-item__value-text {
		max-width: 188rpx;
		font-size: 20rpx;
		color: #EAD4BC;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.profile-logout-wrap {
		margin-top: 36rpx;
	}

	/* 心动点卡 · NOIR 暖金余烬流光卡 */
	.heart-card {
		position: relative;
		height: 168rpx;
		margin-top: 22rpx;
		padding: 22rpx 30rpx 0;
		box-sizing: border-box;
		border-radius: 28rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.28);
		background: linear-gradient(135deg, rgba(226, 124, 78, 0.22) 0%, rgba(255, 255, 255, 0.04) 100%);
		box-shadow: 0 18rpx 40rpx rgba(0, 0, 0, 0.36);
		overflow: hidden;
	}

	.heart-card__glow {
		position: absolute;
		right: 46rpx;
		bottom: -22rpx;
		width: 120rpx;
		height: 110rpx;
		opacity: 0.22;
		pointer-events: none;
		transform-origin: 50% 58%;
		animation: heart-glow-beat 2.2s ease-in-out infinite;
	}

	@keyframes heart-glow-beat {
		0%, 100% { transform: scale(1); }
		20% { transform: scale(1.08); }
		38% { transform: scale(1); }
		56% { transform: scale(1.05); }
		74% { transform: scale(1); }
	}

	.heart-card__head {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.heart-card__label {
		display: flex;
		align-items: center;
	}

	.heart-card__label-heart {
		width: 24rpx;
		height: 22rpx;
		margin-right: 8rpx;
		flex-shrink: 0;
		animation: heart-beat 1.4s ease-in-out infinite;
		transform-origin: center;
	}

	.heart-card__label-text {
		font-size: 24rpx;
		font-weight: 500;
		letter-spacing: 2rpx;
		color: rgba(245, 237, 228, 0.72);
	}

	.heart-card__aside {
		display: flex;
		align-items: center;
	}

	.heart-card__delta {
		font-size: 22rpx;
		color: #E5865C;
	}

	.heart-card__link {
		display: flex;
		align-items: center;
		height: 40rpx;
		margin-left: 16rpx;
		padding: 0 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.36);
		background: rgba(216, 176, 140, 0.12);
	}

	.heart-card__link-text {
		font-size: 20rpx;
		color: #EAD4BC;
	}

	.heart-card__link-arrow {
		margin-left: 4rpx;
		font-size: 18rpx;
		line-height: 1;
		color: #EAD4BC;
	}

	.heart-card__value {
		position: relative;
		z-index: 1;
		display: block;
		margin-top: 8rpx;
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 72rpx;
		font-weight: 500;
		line-height: 1;
		letter-spacing: -1rpx;
		color: #FBF4EA;
	}

	@keyframes heart-beat {
		0%, 100% { transform: scale(1); }
		18% { transform: scale(1.14); }
		36% { transform: scale(1); }
		54% { transform: scale(1.08); }
		72% { transform: scale(1); }
	}
</style>
