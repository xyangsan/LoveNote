<template>
	<view class="pt-page" :class="themeClass">
		<view class="pt-glow pt-glow--left"></view>
		<view class="pt-glow pt-glow--right"></view>

		<noir-navbar
			title="心动点"
			:show-back="true"
			:custom-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
			@back="goBack"
		>
			<template #right>
				<view class="pt-nav-pill" @tap="goToRecords">
					<text class="pt-nav-pill__txt">明细</text>
					<fui-icon name="arrowright" :size="24" color="var(--noir-gold-soft)" />
				</view>
			</template>
		</noir-navbar>

		<view class="pt-wrap">
			<!-- 骨架加载 -->
			<view v-if="!loaded" class="pt-skeleton">
				<view class="pt-skeleton__hero"></view>
				<view class="pt-skeleton__block"></view>
				<view class="pt-skeleton__block pt-skeleton__block--tall"></view>
				<view v-if="loadFailed" class="pt-skeleton__retry" @tap="fetchSummary({ force: true })">
					<text class="pt-skeleton__retry-txt">加载失败，点击重试</text>
				</view>
			</view>

			<template v-else>
				<!-- 余额主卡片（对标 s11 .pt-hero） -->
				<view class="pt-hero">
					<view class="pt-hero__left">
						<text class="pt-kicker">HEART POINTS · {{ summary.isBound ? heroSubtitle : '未绑定 · 签到照常' }}</text>
						<view class="pt-bal">
							<text class="pt-bal__num">{{ balanceText }}</text>
							<text class="pt-bal__unit">点</text>
						</view>
						<text class="pt-hero__sub">今日任务 +{{ taskPointsText }} / 每日任务上限 {{ dailyLimitText }}</text>
					</view>
					<view class="pt-hlinks">
						<view class="pt-pill-act" @tap="milestonesVisible = true">
							<text class="pt-pill-act__txt">成长里程碑</text>
							<fui-icon name="arrowright" :size="22" color="var(--noir-gold-soft)" />
						</view>
						<view v-if="!summary.isBound" class="pt-tag pt-tag--coral" @tap="goCouplePage">
							<text class="pt-tag__txt">未绑定 · 去绑定</text>
						</view>
					</view>
				</view>

				<!-- 未绑定提醒条 -->
				<view v-if="!summary.isBound" class="pt-bind-tip" @tap="goCouplePage">
					<view class="pt-bind-tip__body">
						<text class="pt-bind-tip__title">还没有绑定情侣</text>
						<text class="pt-bind-tip__desc">首次绑定双方各得 +1,000 心动点，并解锁任务计分与挑战奖励</text>
					</view>
					<view class="pt-bind-tip__btn">
						<text class="pt-bind-tip__btn-txt">去绑定</text>
					</view>
				</view>

				<!-- 1. 每日签到 7 天循环（对标 s11 .pt-sign7） -->
				<view class="pt-card">
					<view class="pt-chead" @tap="openSignDialog">
						<text class="pt-chead__title">每日签到（7 天循环 · 断签重算）</text>
						<view
							v-if="!summary.dailyBonusClaimed"
							class="pt-sign-btn"
							:class="{ 'pt-sign-btn--loading': signing }"
						>
							<text class="pt-sign-btn__txt">{{ signing ? '签到中…' : '立即签到' }}</text>
						</view>
						<view v-else class="pt-chead__act-wrap">
							<text class="pt-chead__act pt-chead__act--done">{{ signHeaderAction }}</text>
						</view>
					</view>
					<view class="pt-sign7" @tap="openSignDialog">
						<view
							v-for="tier in signTiers"
							:key="tier.day"
							class="pt-d"
							:class="{
								'pt-d--done': tier.day < summary.signCycleDay || (tier.day === summary.signCycleDay && summary.dailyBonusClaimed),
								'pt-d--now': tier.day === summary.signCycleDay && !summary.dailyBonusClaimed
							}"
						>
							<text class="pt-d__day">D{{ tier.day }}</text>
							<text class="pt-d__pts">+{{ tier.points }}</text>
						</view>
					</view>
				</view>

				<!-- 2. 每日挑战 3 档（对标 s11 .pt-tiers） -->
				<view class="pt-card">
					<view class="pt-chead">
						<text class="pt-chead__title">每日挑战（完成不同任务手动领）</text>
						<text class="pt-chead__act">已完成 {{ summary.taskCount }} / {{ summary.totalTaskCount }} 项</text>
					</view>
					<view class="pt-tiers">
						<view
							v-for="tier in summary.tiers"
							:key="tier.taskCount"
							class="pt-t"
							:class="{
								'pt-t--claim': summary.isBound && tier.claimable,
								'pt-t--done': summary.isBound && tier.claimed
							}"
							@tap="openClaimDialog(tier, $event)"
						>
							<text class="pt-t__pts">+{{ tier.points }}</text>
							<text class="pt-t__lbl">{{ tierStatusText(tier) }}</text>
						</view>
					</view>
				</view>

				<!-- 3. 每日任务 6 项（对标 s11 .pt-task） -->
				<view class="pt-card">
					<view class="pt-chead">
						<text class="pt-chead__title">每日任务（{{ visibleTasks.length }} 项 · 共限 {{ dailyLimitText }}/日）</text>
						<text class="pt-chead__act">{{ summary.isBound ? '按真实业务计分' : '未绑定 · 完成不计分' }}</text>
					</view>
					<view v-if="visibleTasks.length" class="pt-tasks">
						<view
							v-for="(task, index) in visibleTasks"
							:key="task.key"
							class="pt-task"
							:class="{ 'pt-task--last': index === visibleTasks.length - 1 }"
							@tap="handleTaskTap(task)"
						>
							<view class="pt-task__row">
								<view class="pt-tl">
									<text class="pt-tl__title">{{ task.title }}</text>
									<text class="pt-tl__sub">+{{ task.points }}/{{ task.unit || '次' }}<text v-if="task.limit"> · 限 {{ task.limit }} {{ task.unit || '次' }}</text></text>
								</view>
								<view class="pt-tr">
									<text class="pt-tr__num" :class="{ 'pt-tr__num--done': task.reached && summary.isBound }">
										{{ task.limit ? `${task.used} / ${task.limit}` : `${task.used} 次` }}
									</text>
									<text v-if="task.reached && summary.isBound" class="pt-tr__done">已满</text>
									<fui-icon v-else name="arrowright" :size="24" color="rgba(var(--noir-gold-rgb), 0.56)" />
								</view>
							</view>
							<view class="pt-task__track">
								<view
									class="pt-task__fill"
									:class="{ 'pt-task__fill--done': task.reached && summary.isBound }"
									:style="{ width: taskProgressPercent(task) + '%' }"
								></view>
							</view>
						</view>
					</view>
					<view v-else class="pt-empty">
						<text class="pt-empty__txt">当前没有开放的任务</text>
					</view>
				</view>

				<!-- 规则提示条（对标 s11 .pt-warn） -->
				<view class="pt-warn">
					<text class="pt-warn__txt">规则提示：无兑换商城；仅已绑定情侣每日计分。解除情侣关系将立即清零双方全部心动点且无法恢复。</text>
				</view>

				<view class="ad-view">
					<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
				</view>
			</template>
		</view>

		<!-- 成长里程碑与规则底部弹层（对标 NOIR v3 s12） -->
		<view v-if="milestonesVisible" class="ms-wrap" @touchmove.stop.prevent>
			<view class="ms-mask" @tap="milestonesVisible = false"></view>
			<view class="ms-sheet">
				<view class="ms-sheet__bar"></view>
				<view class="ms-sheet__head">
					<text class="ms-sheet__title">成长里程碑与规则</text>
					<view class="ms-sheet__close" @tap="milestonesVisible = false">
						<text class="ms-sheet__close-txt">✕</text>
					</view>
				</view>

				<scroll-view class="ms-scroll" scroll-y>
					<view class="ms-hero">
						<text class="pt-kicker">ONE-TIME MILESTONES · 一次性成长奖励</text>
						<text class="ms-hero__title">记录彼此的每一步</text>
						<text class="ms-hero__desc">以下一次性成长奖励按系统真实规则自动发放（已完成 {{ milestoneDoneCount }} / {{ summary.milestones.length }}）。</text>
					</view>

					<view class="ms-list">
						<view
							v-for="item in summary.milestones"
							:key="item.key"
							class="ms-item"
							:class="{ 'ms-item--done': item.done }"
							@tap="handleMilestoneTap(item)"
						>
							<view class="ms-item__left">
								<text class="ms-item__title">{{ item.title }}</text>
								<text class="ms-item__desc">{{ item.desc }}</text>
							</view>
							<view class="ms-pts">
								<text class="ms-pts__val">+{{ formatPointsNum(item.points) }}</text>
								<view class="pt-tag" :class="item.done ? 'pt-tag--green' : 'pt-tag--coral'">
									<text class="pt-tag__txt">{{ item.done ? '已发放' : '去完成' }}</text>
								</view>
							</view>
						</view>
					</view>

					<view class="ms-rule">
						<text class="ms-rule__head">每日上限与梯队速览</text>
						<view class="ms-rrow">
							<text class="ms-rrow__l">7 天循环签到</text>
							<text class="ms-rrow__r">10 / 15 / 20 / 25 / 30 / 40 / 100</text>
						</view>
						<view class="ms-rrow">
							<text class="ms-rrow__l">每日挑战 3 档</text>
							<text class="ms-rrow__r">2/4/6 项 → +15 / +50 / +100</text>
						</view>
						<view class="ms-rrow">
							<text class="ms-rrow__l">6 项每日任务总上限</text>
							<text class="ms-rrow__r">{{ dailyLimitText }} 点 / 日</text>
						</view>
						<view class="ms-rrow ms-rrow--last">
							<text class="ms-rrow__l">任务开关联动</text>
							<text class="ms-rrow__r">随模块权限动态启停</text>
						</view>
					</view>

					<view class="ms-danger">
						<text class="ms-danger__title">解绑清零规则（重要）</text>
						<text class="ms-danger__desc">当任意一方主动解除情侣关系时，系统将把双方的心动点余额与累计进度统一清零，并写入一条清零流水记录，清零后不可恢复。</text>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 签到弹框：七天进度 + 直接领取 -->
		<love-checkin-dialog
			:visible="signDialogVisible"
			:streak="summary.signStreak"
			:cycle-day="summary.signCycleDay"
			:today-checked="summary.dailyBonusClaimed"
			:sign-points="summary.signPoints"
			:tiers="signTiers"
			:loading="signing"
			@close="closeSignDialog"
			@claim="handleSignClaim"
		></love-checkin-dialog>

		<!-- 挑战奖励弹框 -->
		<view v-if="claimDialog.show" class="claim-dialog" @tap="closeClaimDialog">
			<view class="claim-dialog__panel" @tap.stop>
				<text class="pt-kicker">CHALLENGE REWARD</text>
				<text class="claim-dialog__title">领取每日挑战奖励</text>
				<text class="claim-dialog__points">+{{ claimDialog.points }} 心动点</text>
				<view class="claim-dialog__btn" @tap="claimNow">
					<text class="claim-dialog__btn-text">立即领取</text>
				</view>
			</view>
		</view>

		<!-- 领取动画 -->
		<view v-if="claimFx.show" class="claim-fx">
			<view
				v-for="n in 6"
				:key="'petal-' + n"
				class="claim-fx__petal"
				:class="['claim-fx__petal--' + n, { 'claim-fx__petal--fly': claimFx.flying }]"
			></view>
			<view
				class="claim-fx__heart"
				:class="{ 'claim-fx__heart--fly': claimFx.flying }"
				:style="{ '--fx-x': claimFx.offsetX + 'px', '--fx-y': claimFx.offsetY + 'px' }"
			>
				<image class="claim-fx__heart-img" src="/static/images/points/red_heart.png" mode="aspectFit"></image>
				<text class="claim-fx__points">+{{ claimFx.points }}</text>
			</view>
		</view>
	</view>
</template>

<script>
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import { getPointsApi } from '../../common/api/points.js'
	import { getCurrentUniIdUser } from '../../common/auth-center.js'
	import { requirePageLogin } from '@/common/auth-entry.js'
	import { readAppSettingsCache, isPointsTaskEnabled } from '@/common/app-settings.js'
	import LoveCheckinDialog from '@/components/love-checkin-dialog/love-checkin-dialog.vue'

	const REFRESH_THROTTLE_MS = 8 * 1000

	function formatPoints(value) {
		const num = Math.max(0, Math.floor(Number(value) || 0))
		return `${num}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	function getDefaultSummary() {
		return {
			isBound: false,
			balance: 0,
			totalEarned: 0,
			todayEarned: 0,
			todayTaskPoints: 0,
			registerBonusPoints: 100,
			dailyLimitPoints: 180,
			taskCount: 0,
			totalTaskCount: 6,
			nextTierGap: 0,
			nextTierPoints: 0,
			dailyBonusPoints: 10,
			dailyBonusClaimed: false,
			signStreak: 0,
			signNextStreak: 1,
			signCycleDay: 1,
			signPoints: 10,
			signTiers: [],
			bindDays: 0,
			partnerNickname: '',
			tiers: [],
			tasks: [],
			milestones: []
		}
	}

	export default {
		components: {
			LoveCheckinDialog
		},
		data() {
			return {
				scrollTop: 0,
				appSettings: readAppSettingsCache(),
				summary: getDefaultSummary(),
				loading: false,
				loaded: false,
				loadFailed: false,
				lastFetchAt: 0,
				signing: false,
				signDialogVisible: false,
				milestonesVisible: false,
				claiming: false,
				displayBalance: 0,
				balanceAnimating: false,
				claimDialog: {
					show: false,
					tier: null,
					points: 0,
					offset: { x: 0, y: 0 }
				},
				claimFx: {
					show: false,
					flying: false,
					points: 0,
					offsetX: 0,
					offsetY: 0
				}
			}
		},
		watch: {
			'summary.balance': {
				handler(value) {
					if (!this.balanceAnimating) {
						this.displayBalance = Number(value || 0)
					}
				},
				immediate: true
			}
		},
		computed: {
			visibleTasks() {
				return this.summary.tasks.filter((task) => isPointsTaskEnabled(this.appSettings, task.key))
			},
			signTiers() {
				const tiers = Array.isArray(this.summary.signTiers) ? this.summary.signTiers : []
				if (tiers.length) {
					return tiers
				}
				const fallback = [10, 15, 20, 25, 30, 40, 100]
				return fallback.map((points, index) => ({ day: index + 1, points }))
			},
			signHeaderAction() {
				if (this.summary.dailyBonusClaimed) {
					return `已签 · 连续 ${this.summary.signStreak} 天`
				}
				return this.signing ? '签到中…' : '立即签到'
			},
			todayClaimableTotal() {
				let total = 0
				if (!this.summary.dailyBonusClaimed) {
					total += Number(this.summary.signPoints || 0)
				}
				;(this.summary.tiers || []).forEach((tier) => {
					if (tier && tier.claimable) {
						total += Number(tier.points || 0)
					}
				})
				return total
			},
			balanceText() {
				return formatPoints(this.displayBalance)
			},
			totalText() {
				return formatPoints(this.summary.totalEarned)
			},
			heroSubtitle() {
				if (!this.summary.isBound) {
					return '绑定情侣生效'
				}
				const name = this.summary.partnerNickname || '另一半'
				const days = Number(this.summary.bindDays || 0)
				return days > 0 ? `与 ${name} 相伴 ${days} 天` : `与 ${name} 相伴`
			},
			dailyLimitText() {
				const total = this.visibleTasks.reduce((sum, task) => {
					return sum + Number(task.points || 0) * Number(task.limit || 0)
				}, 0)
				return formatPoints(total || this.summary.dailyLimitPoints || 180)
			},
			taskPointsText() {
				return formatPoints(this.summary.todayTaskPoints || 0)
			},
			milestoneDoneCount() {
				return (this.summary.milestones || []).filter((item) => item.done).length
			}
		},
		onLoad() {
			if (!requirePageLogin()) return
			this.fetchSummary({ force: true })
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
		},
		onShow() {
			if (!requirePageLogin()) return
			this.appSettings = readAppSettingsCache()
			if (!this.loaded || Date.now() - this.lastFetchAt < REFRESH_THROTTLE_MS) {
				return
			}
			this.fetchSummary({ silent: true })
		},
		onUnload() {
			this.balanceTimer && clearTimeout(this.balanceTimer)
			this.claimFxTimer && clearTimeout(this.claimFxTimer)
			this.claimFxHideTimer && clearTimeout(this.claimFxHideTimer)
		},
		onPullDownRefresh() {
			if (!requirePageLogin()) {
				uni.stopPullDownRefresh()
				return
			}
			this.fetchSummary({ force: true, silent: true }).then(() => {
				uni.stopPullDownRefresh()
			})
		},
		methods: {
			formatPointsNum(val) {
				return formatPoints(val)
			},
			taskProgressPercent(task = {}) {
				const used = Math.max(0, Number(task.used || 0))
				const limit = Number(task.limit || 0)
				if (limit > 0) {
					return Math.min(100, Math.round((used / limit) * 100))
				}
				return used > 0 ? 100 : 0
			},
			goBack() {
				uni.navigateBack({
					fail() {
						navigateToTab('/pages/profile/index')
					}
				})
			},
			goToRecords() {
				uni.navigateTo({
					url: '/pages/profile/points-records'
				})
			},
			goCouplePage() {
				uni.navigateTo({
					url: '/pages/couple/index'
				})
			},
			tierStatusText(tier) {
				if (!this.summary.isBound) {
					return `${tier.taskCount} 项 · 绑定解锁`
				}
				if (tier.claimable) {
					return `${tier.taskCount} 项 · 点击领取`
				}
				if (tier.claimed) {
					return `${tier.taskCount} 项 · 已领`
				}
				return `${tier.taskCount} 项 · 待解锁`
			},
			async doSignIn(offset) {
				if (this.signing) {
					return
				}
				this.signing = true
				try {
					const result = await getPointsApi().signIn()
					if (result && result.errCode && result.errCode !== 0) {
						uni.showToast({ title: result.errMsg || '签到失败', icon: 'none' })
						return
					}
					const data = result && result.data ? result.data : {}
					const gained = Number(data.points || 0)
					const oldBalance = Number(this.summary.balance || 0)

					this.playClaimFx(gained, offset || { x: 0, y: 0 })
					await this.fetchSummary({ force: true, silent: true })
					const newBalance = Number(this.summary.balance || 0)

					this.balanceTimer && clearTimeout(this.balanceTimer)
					this.balanceTimer = setTimeout(() => {
						this.animateBalance(oldBalance, newBalance)
					}, 460)
				} catch (error) {
					console.warn('points signIn failed', error)
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.signing = false
				}
			},
			openClaimDialog(tier, event) {
				if (!this.summary.isBound) {
					this.goCouplePage()
					return
				}
				if (!tier || !tier.claimable || this.claiming) {
					return
				}
				this.claimDialog = {
					show: true,
					tier,
					points: Number(tier.points || 0),
					offset: this.getClaimOffset(event)
				}
			},
			openSignDialog() {
				// 签到不依赖情侣关系：未绑定也能签
				if (this.signing) {
					return
				}
				this.signDialogVisible = true
			},
			closeSignDialog() {
				this.signDialogVisible = false
			},
			async handleSignClaim() {
				await this.doSignIn({ x: 0, y: 0 })
				if (this.summary.dailyBonusClaimed) {
					this.signDialogVisible = false
				}
			},
			closeClaimDialog() {
				this.claimDialog = { show: false, tier: null, points: 0, offset: { x: 0, y: 0 } }
			},
			async claimNow() {
				const dialog = this.claimDialog
				this.closeClaimDialog()
				await this.doClaim(dialog.tier, dialog.offset)
			},
			async doClaim(tier, offset) {
				if (!tier || this.claiming) {
					return
				}
				this.claiming = true
				try {
					const result = await getPointsApi().claimChallenge({
						tierTaskCount: tier.taskCount
					})
					if (result && result.errCode && result.errCode !== 0) {
						uni.showToast({ title: result.errMsg || '领取失败', icon: 'none' })
						return
					}
					const data = result && result.data ? result.data : {}
					const gained = Number(data.points || tier.points || 0)
					const oldBalance = Number(this.summary.balance || 0)

					this.playClaimFx(gained, offset || { x: 0, y: 0 })
					await this.fetchSummary({ force: true, silent: true })
					const newBalance = Number(this.summary.balance || 0)

					this.balanceTimer && clearTimeout(this.balanceTimer)
					this.balanceTimer = setTimeout(() => {
						this.animateBalance(oldBalance, newBalance)
					}, 460)
				} catch (error) {
					console.warn('points claimChallenge failed', error)
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.claiming = false
				}
			},
			getClaimOffset(event) {
				try {
					const detail = (event && event.detail) || {}
					const touch = (event && event.touches && event.touches[0])
						|| (event && event.changedTouches && event.changedTouches[0])
						|| {}
					const x = Number(detail.x || touch.clientX || 0)
					const y = Number(detail.y || touch.clientY || 0)
					if (!x && !y) {
						return { x: 0, y: 0 }
					}
					const info = uni.getSystemInfoSync()
					return {
						x: x - Number(info.windowWidth || 0) / 2,
						y: y - Number(info.windowHeight || 0) / 2
					}
				} catch (error) {
					return { x: 0, y: 0 }
				}
			},
			playClaimFx(points, offset = { x: 0, y: 0 }) {
				this.claimFxTimer && clearTimeout(this.claimFxTimer)
				this.claimFxHideTimer && clearTimeout(this.claimFxHideTimer)
				this.claimFx = {
					show: true,
					flying: false,
					points,
					offsetX: Number(offset.x || 0),
					offsetY: Number(offset.y || 0)
				}
				this.claimFxTimer = setTimeout(() => {
					this.claimFx.flying = true
				}, 560)
				this.claimFxHideTimer = setTimeout(() => {
					this.claimFx = { show: false, flying: false, points: 0, offsetX: 0, offsetY: 0 }
				}, 1400)
			},
			animateBalance(from, to) {
				const start = Number(from || 0)
				const end = Number(to || 0)
				if (start === end) {
					this.displayBalance = end
					return
				}
				this.balanceAnimating = true
				const duration = 900
				const startedAt = Date.now()
				const tick = () => {
					const progress = Math.min(1, (Date.now() - startedAt) / duration)
					const eased = 1 - Math.pow(1 - progress, 3)
					this.displayBalance = Math.round(start + (end - start) * eased)
					if (progress < 1) {
						this.balanceTimer = setTimeout(tick, 16)
					} else {
						this.displayBalance = end
						this.balanceAnimating = false
					}
				}
				tick()
			},
			handleTaskTap(task) {
				// 任务不拦未绑定：照样能去完成，只是不计分（计分仍需情侣关系，卡头已写明）
				if (task.reached) {
					uni.showToast({
						title: '今天这项已经拿满啦',
						icon: 'none'
					})
					return
				}
				const targetPath = task.key === 'photo_upload' ? '/pages/album/upload' : task.path
				if (!targetPath) {
					return
				}
				const tabPages = ['/pages/index/index', '/pages/feed/list', '/pages/game/index', '/pages/profile/index']
				if (tabPages.includes(targetPath)) {
					navigateToTab(targetPath)
					return
				}
				uni.navigateTo({
					url: targetPath
				})
			},
			handleMilestoneTap(item) {
				if (item.done || !item.path) {
					return
				}
				this.milestonesVisible = false
				uni.navigateTo({
					url: item.path
				})
			},
			async fetchSummary({ force = false, silent = false } = {}) {
				const currentUser = getCurrentUniIdUser()
				if (!currentUser || !currentUser.uid) {
					this.loaded = true
					this.loadFailed = true
					return
				}
				if (!force && Date.now() - this.lastFetchAt < REFRESH_THROTTLE_MS) {
					return
				}

				this.loading = true
				try {
					const result = await getPointsApi().getSummary()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取心动点失败')
					}
					const data = result && result.data ? result.data : {}
					this.summary = Object.assign(getDefaultSummary(), data, {
						tiers: Array.isArray(data.tiers) ? data.tiers : [],
						tasks: Array.isArray(data.tasks) ? data.tasks : [],
						milestones: Array.isArray(data.milestones) ? data.milestones : []
					})
					this.loaded = true
					this.loadFailed = false
					this.lastFetchAt = Date.now()

					const granted = Array.isArray(data.challengeGranted) ? data.challengeGranted : []
					if (granted.length) {
						const points = granted.reduce((sum, item) => sum + Number(item.points || 0), 0)
						uni.showToast({
							title: `每日挑战达成 +${points}`,
							icon: 'none'
						})
					}
				} catch (error) {
					console.warn('points fetchSummary failed', error)
					if (!this.loaded) {
						this.loadFailed = true
					}
					if (!silent) {
						uni.showToast({
							title: error.message || '获取心动点失败',
							icon: 'none'
						})
					}
				} finally {
					this.loading = false
				}
			}
		}
	}
</script>

<style scoped>
	.pt-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
		background: var(--noir-bg);
		overflow: hidden;
	}

	.pt-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.2;
		pointer-events: none;
		z-index: 0;
	}

	.pt-glow--left {
		top: -120rpx;
		left: -140rpx;
		background: var(--noir-coral);
	}

	.pt-glow--right {
		top: 300rpx;
		right: -160rpx;
		background: var(--noir-gold);
	}

	.pt-nav-pill {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4rpx;
		height: 52rpx;
		padding: 0 18rpx 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.44);
		background: rgba(var(--noir-gold-rgb), 0.10);
	}

	.pt-nav-pill__txt {
		font-size: 22rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
	}

	.pt-wrap {
		position: relative;
		z-index: 1;
		padding: 8rpx 32rpx 0;
	}

	.pt-kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 2rpx;
		color: rgba(var(--noir-gold-rgb), 0.76);
	}

	/* 骨架 */
	.pt-skeleton__hero {
		height: 220rpx;
		border-radius: 30rpx;
		background: var(--noir-glass-2);
	}

	.pt-skeleton__block {
		height: 180rpx;
		margin-top: 20rpx;
		border-radius: 26rpx;
		background: var(--noir-glass-1);
	}

	.pt-skeleton__block--tall {
		height: 360rpx;
	}

	.pt-skeleton__retry {
		margin-top: 28rpx;
		text-align: center;
	}

	.pt-skeleton__retry-txt {
		font-size: 24rpx;
		color: var(--noir-coral-soft);
	}

	/* 余额主卡（s11 .pt-hero） */
	.pt-hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		padding: 26rpx 28rpx;
		border-radius: 30rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: linear-gradient(135deg, rgba(var(--noir-coral-rgb), 0.16), var(--noir-glass-1));
	}

	.pt-hero__left {
		flex: 1;
		min-width: 0;
	}

	.pt-bal {
		display: flex;
		align-items: baseline;
		gap: 12rpx;
		margin-top: 10rpx;
	}

	.pt-bal__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", serif;
		font-size: 68rpx;
		line-height: 1;
		color: var(--noir-text-strong);
		font-weight: 500;
	}

	.pt-bal__unit {
		font-size: 22rpx;
		color: rgba(var(--noir-text-rgb), 0.52);
	}

	.pt-hero__sub {
		display: block;
		margin-top: 12rpx;
		font-size: 21rpx;
		color: var(--noir-coral-soft);
	}

	.pt-hlinks {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 12rpx;
	}

	.pt-pill-act {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4rpx;
		height: 48rpx;
		padding: 0 16rpx 0 20rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.42);
		background: rgba(var(--noir-gold-rgb), 0.10);
	}

	.pt-pill-act__txt {
		font-size: 21rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
	}

	.pt-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 40rpx;
		padding: 0 16rpx;
		border-radius: 20rpx;
	}

	.pt-tag--green {
		border: 1rpx solid rgba(var(--noir-green-rgb), 0.38);
		background: rgba(var(--noir-green-rgb), 0.14);
	}

	.pt-tag--green .pt-tag__txt {
		color: var(--noir-green);
	}

	.pt-tag--coral {
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.44);
		background: rgba(var(--noir-coral-rgb), 0.16);
	}

	.pt-tag--coral .pt-tag__txt {
		color: var(--noir-coral-light);
	}

	.pt-tag--muted {
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.12);
		background: var(--noir-glass-2);
	}

	.pt-tag--muted .pt-tag__txt {
		color: rgba(var(--noir-text-rgb), 0.56);
	}

	.pt-tag__txt {
		font-size: 20rpx;
		font-weight: 600;
		white-space: nowrap;
	}

	/* 未绑定横幅 */
	.pt-bind-tip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18rpx;
		margin-top: 18rpx;
		padding: 20rpx 24rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.44);
		background: linear-gradient(135deg, rgba(var(--noir-coral-rgb), 0.18), var(--noir-glass-1));
	}

	.pt-bind-tip__body {
		flex: 1;
		min-width: 0;
	}

	.pt-bind-tip__title {
		display: block;
		font-size: 25rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.pt-bind-tip__desc {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		line-height: 1.5;
		color: rgba(var(--noir-text-rgb), 0.62);
	}

	.pt-bind-tip__btn {
		flex-shrink: 0;
		height: 54rpx;
		padding: 0 24rpx;
		border-radius: 27rpx;
		background: linear-gradient(135deg, var(--noir-coral-bright), var(--noir-coral-deep));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pt-bind-tip__btn-txt {
		font-size: 22rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
	}

	/* 通用区块卡片（s11 .pt-card） */
	.pt-card {
		margin-top: 18rpx;
		padding: 22rpx 24rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.075);
		background: var(--noir-glass-1);
	}

	.pt-chead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
		margin-bottom: 16rpx;
	}

	.pt-chead__title {
		font-size: 24rpx;
		font-weight: 500;
		color: var(--noir-text);
	}

	.pt-chead__act-wrap {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 4rpx;
	}

	.pt-chead__act {
		flex-shrink: 0;
		font-size: 21rpx;
		color: var(--noir-coral-soft);
	}

	.pt-chead__act--done {
		color: var(--noir-green);
	}

	/* 「立即签到」按钮（替代纯文字，紧凑胶囊） */
	.pt-sign-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 52rpx;
		padding: 0 26rpx;
		border-radius: 26rpx;
		background: linear-gradient(135deg, var(--noir-coral-bright), var(--noir-coral-deep));
		box-shadow: 0 8rpx 20rpx rgba(var(--noir-coral-rgb), 0.28);
	}

	.pt-sign-btn__txt {
		font-size: 22rpx;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 1rpx;
		white-space: nowrap;
		color: var(--noir-text-warm);
	}

	.pt-sign-btn--loading {
		opacity: 0.6;
		box-shadow: none;
	}

	/* 7 天签到（s11 .pt-sign7） */
	.pt-sign7 {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 8rpx;
	}

	.pt-d {
		padding: 14rpx 4rpx;
		border-radius: 16rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
		text-align: center;
	}

	.pt-d--done {
		border-color: rgba(var(--noir-gold-rgb), 0.42);
		background: rgba(var(--noir-gold-rgb), 0.12);
	}

	.pt-d--now {
		border-color: rgba(var(--noir-coral-rgb), 0.68);
		background: rgba(var(--noir-coral-rgb), 0.20);
	}

	.pt-d__day {
		display: block;
		font-size: 18rpx;
		color: rgba(var(--noir-text-rgb), 0.48);
	}

	.pt-d__pts {
		display: block;
		margin-top: 6rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 21rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	/* 每日挑战 3 档（s11 .pt-tiers） */
	.pt-tiers {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 14rpx;
	}

	.pt-t {
		padding: 18rpx 12rpx;
		border-radius: 20rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
		text-align: center;
	}

	.pt-t--claim {
		border-color: rgba(var(--noir-coral-rgb), 0.60);
		background: rgba(var(--noir-coral-rgb), 0.16);
	}

	.pt-t--done {
		border-color: rgba(var(--noir-green-rgb), 0.34);
		background: rgba(var(--noir-green-rgb), 0.08);
	}

	.pt-t__pts {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 30rpx;
		font-weight: 600;
		color: var(--noir-coral-soft);
	}

	.pt-t--done .pt-t__pts {
		color: var(--noir-green);
	}

	.pt-t__lbl {
		display: block;
		margin-top: 8rpx;
		font-size: 19rpx;
		color: rgba(var(--noir-text-rgb), 0.62);
	}

	/* 每日任务列表（s11 .pt-task + 进度条） */
	.pt-task {
		padding: 18rpx 0;
		border-bottom: 1rpx solid rgba(var(--noir-wash-rgb), 0.05);
	}

	.pt-task--last {
		border-bottom: none;
		padding-bottom: 4rpx;
	}

	.pt-task__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.pt-task__track {
		margin-top: 12rpx;
		height: 8rpx;
		border-radius: 4rpx;
		background: var(--noir-glass-2);
		overflow: hidden;
	}

	.pt-task__fill {
		height: 100%;
		border-radius: 4rpx;
		background: linear-gradient(90deg, var(--noir-coral-bright) 0%, var(--noir-coral-deep) 100%);
		transition: width 0.25s ease;
	}

	.pt-task__fill--done {
		background: linear-gradient(90deg, var(--page-08) 0%, var(--noir-green) 100%);
	}

	.pt-tl {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 10rpx;
	}

	.pt-tl__title {
		font-size: 25rpx;
		color: rgba(var(--noir-text-rgb), 0.86);
	}

	.pt-tl__sub {
		font-size: 20rpx;
		color: rgba(var(--noir-text-rgb), 0.40);
	}

	.pt-tr {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.pt-tr__num {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 23rpx;
		color: var(--noir-gold-soft);
	}

	.pt-tr__num--done {
		color: var(--noir-green);
	}

	.pt-tr__done {
		font-size: 19rpx;
		color: var(--noir-green);
	}

	.pt-tr__go {
		font-size: 26rpx;
		color: rgba(var(--noir-gold-rgb), 0.46);
	}

	.pt-empty {
		padding: 32rpx 0;
		text-align: center;
	}

	.pt-empty__txt {
		font-size: 23rpx;
		color: var(--noir-text-muted);
	}

	/* 规则警示条（s11 .pt-warn） */
	.pt-warn {
		margin-top: 20rpx;
		padding: 18rpx 22rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.28);
		background: rgba(var(--noir-coral-rgb), 0.07);
	}

	.pt-warn__txt {
		font-size: 21rpx;
		line-height: 1.6;
		color: rgba(var(--noir-coral-light-rgb), 0.84);
	}

	.ad-view {
		margin-top: 24rpx;
	}

	/* ==================== 成长里程碑与规则弹层（s12） ==================== */

	.ms-wrap {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1200;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.ms-mask {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(var(--page-01-rgb), 0.72);
	}

	.ms-sheet {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		max-height: 84vh;
		padding: 16rpx 36rpx calc(32rpx + env(safe-area-inset-bottom));
		border-radius: 40rpx 40rpx 0 0;
		border-top: 1rpx solid rgba(var(--noir-gold-rgb), 0.28);
		background: linear-gradient(180deg, var(--noir-sheet-hi) 0%, var(--noir-sheet-lo) 100%);
	}

	.ms-sheet__bar {
		width: 68rpx;
		height: 8rpx;
		margin: 0 auto 18rpx;
		border-radius: 4rpx;
		background: rgba(var(--noir-text-rgb), 0.16);
	}

	.ms-sheet__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18rpx;
	}

	.ms-sheet__title {
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ms-sheet__close {
		width: 52rpx;
		height: 52rpx;
		border-radius: 50%;
		background: var(--noir-glass-2);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ms-sheet__close-txt {
		font-size: 24rpx;
		color: var(--noir-text-sub);
	}

	.ms-scroll {
		flex: 1;
		min-height: 0;
		max-height: 68vh;
	}

	.ms-hero {
		padding: 26rpx 28rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.22);
		background: linear-gradient(135deg, rgba(var(--noir-gold-rgb), 0.12), var(--noir-glass-1));
	}

	.ms-hero__title {
		display: block;
		margin-top: 10rpx;
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 36rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ms-hero__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: rgba(var(--noir-text-rgb), 0.54);
	}

	.ms-list {
		margin-top: 20rpx;
		display: flex;
		flex-direction: column;
		gap: 14rpx;
	}

	.ms-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		padding: 22rpx 24rpx;
		border-radius: 26rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
	}

	.ms-item--done {
		border-color: rgba(var(--noir-green-rgb), 0.30);
		background: rgba(var(--noir-green-rgb), 0.07);
	}

	.ms-item__left {
		flex: 1;
		min-width: 0;
	}

	.ms-item__title {
		display: block;
		font-size: 26rpx;
		font-weight: 500;
		color: var(--noir-text-strong);
	}

	.ms-item__desc {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: rgba(var(--noir-text-rgb), 0.48);
	}

	.ms-pts {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8rpx;
	}

	.ms-pts__val {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 28rpx;
		font-weight: 600;
		color: var(--noir-coral-soft);
	}

	.ms-rule {
		margin-top: 20rpx;
		padding: 22rpx 24rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.075);
		background: var(--noir-glass-1);
	}

	.ms-rule__head {
		display: block;
		margin-bottom: 12rpx;
		font-size: 23rpx;
		color: rgba(var(--noir-gold-rgb), 0.78);
	}

	.ms-rrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
		padding: 12rpx 0;
		border-bottom: 1rpx solid rgba(var(--noir-wash-rgb), 0.05);
	}

	.ms-rrow--last {
		border-bottom: none;
	}

	.ms-rrow__l {
		font-size: 22rpx;
		color: rgba(var(--noir-text-rgb), 0.60);
	}

	.ms-rrow__r {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 21rpx;
		color: var(--noir-gold-soft);
		text-align: right;
	}

	.ms-danger {
		margin-top: 20rpx;
		padding: 22rpx 24rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.36);
		background: rgba(var(--noir-coral-rgb), 0.09);
	}

	.ms-danger__title {
		display: block;
		font-size: 24rpx;
		font-weight: 600;
		color: var(--noir-coral-light);
	}

	.ms-danger__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 21rpx;
		line-height: 1.65;
		color: var(--noir-text-sub);
	}

	/* ==================== 挑战领取弹框 & 动画 ==================== */

	.claim-dialog {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1300;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(var(--page-01-rgb), 0.72);
	}

	.claim-dialog__panel {
		width: 540rpx;
		padding: 40rpx 36rpx 34rpx;
		border-radius: 34rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.28);
		background: linear-gradient(155deg, var(--noir-sheet-hi) 0%, var(--noir-sheet-lo) 100%);
		text-align: center;
	}

	.claim-dialog__title {
		display: block;
		margin-top: 12rpx;
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 34rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.claim-dialog__points {
		display: block;
		margin-top: 20rpx;
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", serif;
		font-size: 56rpx;
		font-weight: 500;
		color: var(--noir-coral-bright);
	}

	.claim-dialog__btn {
		margin-top: 32rpx;
		height: 84rpx;
		border-radius: 42rpx;
		background: var(--noir-btn-gradient);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.claim-dialog__btn-text {
		font-size: 28rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
	}

	.claim-fx {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1400;
		pointer-events: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.claim-fx__heart {
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: translate(var(--fx-x, 0px), var(--fx-y, 0px)) scale(0.75);
		transition: transform 0.52s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease;
	}

	.claim-fx__heart--fly {
		transform: translate(0px, -260px) scale(1.15);
		opacity: 0;
	}

	.claim-fx__heart-img {
		width: 112rpx;
		height: 112rpx;
	}

	.claim-fx__points {
		margin-top: 8rpx;
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", serif;
		font-size: 44rpx;
		font-weight: 600;
		color: var(--noir-coral-bright);
	}
</style>
