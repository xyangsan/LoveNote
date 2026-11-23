<template>
	<view class="tab-profile">
		<noir-navbar :show-back="false" :transparent="true" :border="false" :scroll-top="scrollTop">
			<template #left>
				<view class="tp-brand">
					<text class="tp-brand__title">我的</text>
					<text class="tp-brand__sub">PROFILE</text>
				</view>
			</template>
		</noir-navbar>

		<view class="tp-body">
			<!-- 用户信息头（04 设计稿：无设置齿轮，直接编辑资料） -->
			<view class="tp-user" @tap="handleProfileTap">
				<view class="tp-user__ava-wrap">
					<image class="tp-user__ava" :src="displayAvatar" mode="aspectFill"></image>
					<view v-if="genderMeta" class="tp-gender" :class="genderMeta.className">
						<text class="tp-gender__txt">{{ genderMeta.icon }}</text>
					</view>
				</view>
				<view class="tp-user__info">
					<text class="tp-user__name">{{ displayNickname }}</text>
					<text class="tp-user__meta">{{ profileMetaText }}</text>
				</view>
				<view class="tp-user__edit">
					<text class="tp-user__edit-txt">{{ isLoggedIn ? '编辑资料' : '去登录' }}</text>
				</view>
			</view>

			<!-- 心动点卡 -->
			<view v-if="isLoggedIn" class="tp-points" @tap="goPage('/pages/profile/points')">
				<view>
					<text class="tp-points__lbl">♥ 心动点</text>
					<view class="tp-points__val">
						<text class="tp-points__num">{{ pointsBalanceText }}</text>
						<text class="tp-points__unit">点</text>
						<text class="tp-points__delta">{{ pointsDeltaText }}</text>
					</view>
				</view>
				<text class="tp-points__link">任务与明细 ›</text>
			</view>

			<!-- 4 列数据条（04 设计稿：纪念日 / 日常 / 照片 / 愿望） -->
			<view class="tp-stats">
				<view class="tp-stat" @tap="goGuarded('/pages/anniversary/list')">
					<text class="tp-stat__val">{{ formatStat(featureStats.anniversaryTotal) }}</text>
					<text class="tp-stat__lbl">纪念日</text>
				</view>
				<view class="tp-stat tp-stat--sep" @tap="$emit('switch-tab', 'feed')">
					<text class="tp-stat__val">{{ formatStat(featureStats.dailyTotal) }}</text>
					<text class="tp-stat__lbl">日常</text>
				</view>
				<view class="tp-stat tp-stat--sep" @tap="goGuarded('/pages/album/list')">
					<text class="tp-stat__val">{{ formatStat(featureStats.albumTotal) }}</text>
					<text class="tp-stat__lbl">照片</text>
				</view>
				<view class="tp-stat tp-stat--sep" @tap="goGuarded('/pages/plan/list')">
					<text class="tp-stat__val">{{ formatStat(featureStats.wishTotal) }}</text>
					<text class="tp-stat__lbl">愿望</text>
				</view>
			</view>

			<!-- 分组 1：关系与记录 -->
			<noir-section-head title="关系与记录" kicker="OUR SPACE" />
			<noir-card padding="4rpx 26rpx">
				<view class="tp-row" @tap="goGuarded('/pages/couple/index')">
					<text class="tp-row__title">情侣信息</text>
					<text class="tp-row__val">{{ coupleStatusText }}</text>
					<text class="tp-row__chev">›</text>
				</view>
				<view class="tp-row" @tap="goGuarded('/pages/anniversary/list')">
					<text class="tp-row__title">纪念日</text>
					<text class="tp-row__val">{{ formatStat(featureStats.anniversaryTotal) }} 个</text>
					<text class="tp-row__chev">›</text>
				</view>
				<view class="tp-row" @tap="goGuarded('/pages/album/list')">
					<text class="tp-row__title">照片</text>
					<text class="tp-row__val">{{ formatStat(featureStats.albumTotal) }} 项</text>
					<text class="tp-row__chev">›</text>
				</view>
				<view class="tp-row tp-row--last" @tap="goGuarded('/pages/plan/list')">
					<text class="tp-row__title">愿望单</text>
					<text class="tp-row__val">{{ formatStat(featureStats.wishTotal) }} 个</text>
					<text class="tp-row__chev">›</text>
				</view>
			</noir-card>

			<!-- 分组 2：支持与管理 -->
			<noir-section-head title="支持与管理" kicker="SUPPORT & ADMIN" />
			<noir-card padding="4rpx 26rpx">
				<view v-if="isAdmin" class="tp-row" @tap="goPage('/pages/operations/index')">
					<text class="tp-row__title">运营管理</text>
					<noir-tag text="ADMIN" variant="coral" />
					<text class="tp-row__chev">›</text>
				</view>
				<view class="tp-row" @tap="handleFeedbackTap">
					<text class="tp-row__title">反馈与帮助</text>
					<text class="tp-row__chev">›</text>
				</view>
				<view class="tp-row tp-row--last" @tap="showVersion">
					<text class="tp-row__title">版本信息</text>
					<text class="tp-row__val">{{ appVersion }}</text>
					<text class="tp-row__chev">›</text>
				</view>
			</noir-card>

			<view v-if="isLoggedIn" class="tp-logout">
				<noir-button text="退出登录" variant="danger" size="lg" block @click="handleLogout" />
			</view>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		emitAuthChanged,
		getCachedUserProfile,
		getCurrentUniIdUser,
		hasValidLogin
	} from '../../common/auth-center.js'
	import { getAuthApi } from '../../common/api/auth.js'
	import { getPointsApi } from '../../common/api/points.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { APP_VERSION_TEXT } from '../../common/version.js'

	function formatNum(n) {
		return String(Math.max(0, Math.floor(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	export default {
		name: 'TabProfile',
		props: {
			scrollTop: {
				type: Number,
				default: 0
			}
		},
		emits: ['switch-tab'],
		data() {
			return {
				appStateStore: null,
				userInfo: null,
				// ⚠️ 登录态必须是 data 而不是 computed：hasValidLogin() 读的是 uniCloud 里的 token，
				// 不是响应式依赖，computed 会把「未登录」一直缓存到 userInfo 变化为止 ——
				// 登录页 navigateBack 回来时 store.userInfo 还是 null，refresh 就会被挡在这里不发请求。
				isLoggedIn: hasValidLogin(),
				featureStats: {},
				pointsLoaded: false,
				pointsSummary: { balance: 0, todayEarned: 0, isBound: false },
				appVersion: APP_VERSION_TEXT
			}
		},
		computed: {
			isAdmin() {
				const roles = Array.isArray(this.userInfo && this.userInfo.role) ? this.userInfo.role : []
				return roles.some((r) => String(r || '').trim().toLowerCase() === 'admin')
			},
			displayNickname() {
				return this.isLoggedIn ? ((this.userInfo && this.userInfo.nickname) || '微信用户') : '未登录'
			},
			displayAvatar() {
				return (this.userInfo && this.userInfo.avatarUrl) || '/static/user-empty.png' || DEFAULT_AVATAR
			},
			activeCouple() {
				const center = this.appStateStore && this.appStateStore.coupleCenterData
				return center && center.activeCouple ? center.activeCouple : null
			},
			coupleStatusText() {
				if (!this.isLoggedIn) return '未登录'
				if (this.activeCouple) return `${this.activeCouple.partnerNickname || 'TA'} · 已绑定`
				return '未绑定'
			},
			profileMetaText() {
				if (!this.isLoggedIn) return '登录后同步双人空间与心动点'
				if (this.activeCouple) return `与 ${this.activeCouple.partnerNickname || 'TA'} 已绑定双人空间`
				return '未绑定情侣 · 点击绑定开启双人空间'
			},
			pointsBalanceText() {
				return this.pointsLoaded ? formatNum(this.pointsSummary.balance) : '--'
			},
			pointsDeltaText() {
				if (!this.pointsLoaded) return '今日 --'
				return this.pointsSummary.isBound ? `今日 +${formatNum(this.pointsSummary.todayEarned)}` : '绑定后计分'
			},
			genderMeta() {
				const g = Number((this.userInfo && this.userInfo.gender) || 0)
				if (g === 1) return { icon: '♂', className: 'tp-gender--male' }
				if (g === 2) return { icon: '♀', className: 'tp-gender--female' }
				return null
			}
		},
		mounted() {
			this.refresh({ force: false })
		},
		methods: {
			ensureStore() {
				if (!this.appStateStore) this.appStateStore = useAppStateStore()
				return this.appStateStore
			},
			formatStat(val) {
				return val === null || val === undefined ? '--' : String(val)
			},
			/** 登录态实时同步：token 变了（登录 / 退出 / 换号）下次调用立刻反映出来 */
			syncLoginState() {
				this.isLoggedIn = hasValidLogin()
				return this.isLoggedIn
			},
			async refresh({ force = true } = {}) {
				const store = this.ensureStore()
				// 先按此刻的 token 定登录态，再看 store 里有没有用户：
				// 登录成功但 store 还没拉到 userInfo 时，用本地缓存的昵称/头像先把界面点亮，
				// 真正的完整资料由下面的 fetchUserInfo 补全
				const loggedIn = this.syncLoginState()
				this.userInfo = store.userInfo || (loggedIn ? getCachedUserProfile() : null)
				if (!loggedIn) {
					this.userInfo = null
					this.pointsLoaded = false
					this.featureStats = {}
					return
				}
				try {
					await Promise.all([
						store.fetchUserInfo({ force }).catch(() => {}),
						store.fetchCoupleCenter({ force }).catch(() => {}),
						store.fetchOverviewStats({ force }).catch(() => {})
					])
					this.userInfo = store.userInfo || null
					this.featureStats = store.profileFeatureStats || {}
				} catch (error) {
					console.warn('tab-profile refresh failed', error)
				}

				getPointsApi().getSummary().then((res) => {
					if (res && res.data) {
						this.pointsSummary = {
							balance: Number(res.data.balance || 0),
							todayEarned: Number(res.data.todayEarned || 0),
							isBound: Boolean(res.data.isBound)
						}
						this.pointsLoaded = true
					}
				}).catch(() => {})
			},
			handleProfileTap() {
				if (!this.syncLoginState()) {
					uni.navigateTo({ url: '/pages/login/index' })
					return
				}
				uni.navigateTo({ url: '/pages/profile/edit' })
			},
			goGuarded(url) {
				if (!this.syncLoginState()) {
					uni.navigateTo({ url: '/pages/login/index?redirect=' + encodeURIComponent(url) })
					return
				}
				uni.navigateTo({ url })
			},
			goPage(url) {
				uni.navigateTo({ url })
			},
			handleFeedbackTap() {
				if (!this.isAdmin) {
					this.goGuarded('/pages/feedback/index')
					return
				}
				uni.showActionSheet({
					itemList: ['进入反馈列表（ADMIN）', '我要反馈'],
					success: (res) => {
						uni.navigateTo({
							url: Number(res.tapIndex) === 0 ? '/pages/feedback/list' : '/pages/feedback/index'
						})
					}
				})
			},
			showVersion() {
				uni.showToast({ title: `当前版本 ${this.appVersion}`, icon: 'none' })
			},
			async handleLogout() {
				try {
					const user = getCurrentUniIdUser()
					if (user && user.uid) await getAuthApi().logout()
				} catch (e) {
					// ignore
				} finally {
					clearUniIdTokenStorage()
					this.ensureStore().clearAllState()
					this.isLoggedIn = false
					this.userInfo = null
					this.pointsLoaded = false
					this.featureStats = {}
					emitAuthChanged({ action: 'logout' })
					uni.showToast({ title: '已退出登录', icon: 'none' })
				}
			}
		}
	}
</script>

<style scoped>
	.tab-profile {
		min-height: 100vh;
		padding-bottom: calc(184rpx + env(safe-area-inset-bottom));
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

	.tp-body {
		padding: 14rpx 28rpx 0;
	}

	.tp-user {
		display: flex;
		align-items: center;
		gap: 22rpx;
		padding: 10rpx 0 22rpx;
	}

	.tp-user__ava-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.tp-user__ava {
		display: block;
		width: 112rpx;
		height: 112rpx;
		box-sizing: border-box;
		border-radius: 50%;
		overflow: hidden;
		border: 2rpx solid rgba(216, 176, 140, 0.56);
		background: #231C18;
	}

	.tp-gender {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 32rpx;
		height: 32rpx;
		border-radius: 50%;
		border: 3rpx solid #110D0B;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}

	.tp-gender--male {
		background: linear-gradient(135deg, #6CB8FF 0%, #4387FF 100%);
	}

	.tp-gender--female {
		background: linear-gradient(135deg, #FF94B8 0%, #FF6B95 100%);
	}

	.tp-gender__txt {
		font-size: 18rpx;
		font-weight: 700;
		line-height: 1;
		color: #FFFFFF;
	}

	.tp-user__info {
		flex: 1;
		min-width: 0;
	}

	.tp-user__name {
		display: block;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 40rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.tp-user__meta {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.tp-user__edit {
		height: 52rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(245, 237, 228, 0.22);
		background: rgba(255, 255, 255, 0.04);
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.tp-user__edit-txt {
		font-size: 22rpx;
		color: #EAD4BC;
	}

	.tp-points {
		padding: 26rpx 28rpx;
		border-radius: 30rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.28);
		background: linear-gradient(135deg, rgba(226, 124, 78, 0.20) 0%, rgba(255, 255, 255, 0.036) 100%);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.tp-points__lbl {
		display: block;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.62);
	}

	.tp-points__val {
		display: flex;
		align-items: baseline;
		gap: 14rpx;
		margin-top: 8rpx;
	}

	.tp-points__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 62rpx;
		line-height: 1;
		color: #FBF4EA;
	}

	.tp-points__unit {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.tp-points__delta {
		font-size: 22rpx;
		color: #E5865C;
	}

	.tp-points__link {
		font-size: 23rpx;
		color: #EAD4BC;
	}

	.tp-stats {
		margin-top: 20rpx;
		height: 112rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.032);
		display: flex;
		align-items: center;
	}

	.tp-stat {
		flex: 1;
		text-align: center;
	}

	.tp-stat--sep {
		border-left: 1rpx solid rgba(255, 255, 255, 0.07);
	}

	.tp-stat__val {
		display: block;
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 34rpx;
		color: #EAD4BC;
	}

	.tp-stat__lbl {
		display: block;
		margin-top: 6rpx;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.tp-row {
		height: 92rpx;
		display: flex;
		align-items: center;
		gap: 14rpx;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.tp-row--last {
		border-bottom: none;
	}

	.tp-row__title {
		flex: 1;
		font-size: 27rpx;
		color: rgba(245, 237, 228, 0.88);
	}

	.tp-row__val {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.tp-row__chev {
		font-size: 30rpx;
		color: rgba(245, 237, 228, 0.28);
	}

	.tp-logout {
		margin-top: 34rpx;
	}
</style>
