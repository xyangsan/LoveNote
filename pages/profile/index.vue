<template>
	<view class="love-page love-page--compact profile-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<fui-status-bar background="transparent"></fui-status-bar>

			<view class="page-head">
				<view class="page-head__bar">
					<text class="page-head__title">个人中心</text>
				</view>

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
							background="#fff1eb"
						></fui-avatar>
						<view class="user-card__body">
							<text class="user-card__name">{{ displayNickname }}</text>
							<text class="user-card__meta">{{ profileMetaText }}</text>
							<text class="user-card__desc">{{ profileDescText }}</text>
						</view>
						<text class="user-card__action">{{ isLoggedIn ? '编辑' : '登录' }}</text>
					</view>
				</love-glass-card>
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
							:padding="['26rpx', '28rpx']"
							background="transparent"
							:bottom-border="index !== group.items.length - 1"
							border-color="rgba(231, 204, 194, 0.6)"
							arrow
							arrow-color="#d2a394"
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

			<fui-button
				:margin="['80rpx']"
				text="退出登录"
				background="linear-gradient(135deg, #fff0ec 0%, #ffd4c8 100%)"
				color="#c74d33"
				border-color="rgba(219, 117, 90, 0.22)"
				disabled-background="rgba(255, 240, 236, 0.92)"
				disabled-color="#d5aaa1"
				radius="999rpx"
				height="90rpx"
				:size="28"
				:bold="true"
				:disabled="!isLoggedIn"
				@click="handleLogout"
			></fui-button>
		</view>
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
	import { useAppStateStore } from '../../store/app-state.js'

	const genderOptions = ['保密', '男', '女']
	const PROFILE_DEFAULT_AVATAR = '/static/user-empty.png'
	const VERSION_TEXT = 'v1.0.0'

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
				featureStats: {
					anniversaryTotal: null,
					albumTotal: null,
					dailyTotal: null,
					wishTotal: null,
					planTotal: null
				}
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
				return `愿望${Number(wishTotal || 0)} / 计划${Number(planTotal || 0)}`
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
				return [
					{
						key: 'feedback',
						title: '反馈&帮助',
						desc: '遇到问题或有建议都可以告诉我们',
						value: '',
						iconText: '助',
						iconBg: 'linear-gradient(135deg, #d7e8ff 0%, #afcfff 100%)'
					},
					{
						key: 'version',
						title: '版本信息',
						desc: '查看当前应用版本和更新状态',
						value: VERSION_TEXT,
						iconText: '版',
						iconBg: 'linear-gradient(135deg, #f6ddc3 0%, #eac6a3 100%)'
					}
				]
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
				this.featureStats = appStateStore.profileFeatureStats || {
					anniversaryTotal: null,
					albumTotal: null,
					dailyTotal: null,
					wishTotal: null,
					planTotal: null
				}
			},
			resetFeatureStats() {
				this.featureStats = {
					anniversaryTotal: null,
					albumTotal: null,
					dailyTotal: null,
					wishTotal: null,
					planTotal: null
				}
			},
			async refreshFeatureStats() {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchOverviewStats({
						force: false
					})
					this.syncFromAppState()
				} catch (error) {
					console.warn('profile refreshFeatureStats failed', error)
					this.syncFromAppState()
				}
			},
			async restoreLoginState() {
				const appStateStore = this.ensureAppStateStore()
				const currentUserInfo = getCurrentUniIdUser()
				if (!currentUserInfo || !currentUserInfo.uid) {
					appStateStore.clearAllState()
					this.syncFromAppState()
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					appStateStore.clearAllState()
					this.syncFromAppState()
					return
				}

				try {
					await Promise.all([
						this.fetchCurrentUser({
							silent: true,
							force: false
						}),
						this.refreshFeatureStats()
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

					if (!silent) {
						uni.showToast({
							title: '登录状态已失效，请重新登录',
							icon: 'none'
						})
					}
				}
			},
			goToLoginPage() {
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
							title: `当前版本 ${VERSION_TEXT}`,
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
					this.syncFromAppState()
					emitAuthChanged({
						action: 'logout'
					})
					uni.showToast({
						title: '已退出登录',
						icon: 'none'
					})
				}
			}
		}
	}
</script>

<style>
	.profile-page {
		padding: 28rpx 24rpx 52rpx;
	}

	.page-head {
		padding-bottom: 20rpx;
	}

	.page-head__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18rpx 4rpx 24rpx;
	}

	.page-head__title {
		font-size: 40rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.user-card {
		display: flex;
		align-items: flex-start;
		gap: 24rpx;
	}

	.user-card__avatar {
		flex-shrink: 0;
		box-shadow: 0 18rpx 34rpx rgba(196, 126, 101, 0.18);
		border-radius: 50%;
	}

	.user-card__body {
		flex: 1;
		min-width: 0;
		padding-top: 8rpx;
	}

	.user-card__name {
		display: block;
		font-size: 38rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.user-card__meta,
	.user-card__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: #8d6a60;
		word-break: break-all;
	}

	.user-card__action {
		flex-shrink: 0;
		align-self: center;
		padding: 12rpx 22rpx;
		border-radius: 999rpx;
		background: rgba(255, 240, 234, 0.92);
		font-size: 24rpx;
		font-weight: 600;
		color: #bf6e59;
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
		width: 82rpx;
		height: 82rpx;
		border-radius: 26rpx;
		flex-shrink: 0;
		box-shadow: 0 14rpx 28rpx rgba(183, 120, 94, 0.18);
	}

	.menu-item__icon-text {
		font-size: 28rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.menu-item__body {
		flex: 1;
		min-width: 0;
		margin-left: 18rpx;
	}

	.menu-item__title {
		display: block;
		font-size: 30rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.menu-item__desc {
		margin-top: 8rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #9b786d;
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
		padding: 6rpx 10rpx;
		border-radius: 12rpx;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 10rpx 20rpx rgba(183, 120, 94, 0.16);
	}

	.menu-item__value-text {
		max-width: 188rpx;
		font-size: 20rpx;
		color: #ffffff;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

</style>
