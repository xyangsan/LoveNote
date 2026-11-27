<template>
	<view class="cp-page" :class="[{ 'cp-page--bound': Boolean(activeCouple) }, themeClass]">
		<view class="cp-glow cp-glow--left"></view>
		<view class="cp-glow cp-glow--right"></view>

		<noir-navbar
			:title="navbarTitle"
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		>
			<template #right>
				<view
					v-if="isLoggedIn && !activeCouple && inviteMode"
					class="cp-tag"
					:class="invite && invite.status === 'valid' ? 'cp-tag--gold' : 'cp-tag--coral'"
				>
					<text class="cp-tag__txt">{{ inviteBadgeText }}</text>
				</view>
			</template>
		</noir-navbar>

		<view class="cp-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				class="cp-auth"
				desc="情侣信息页需要登录后才能查看和操作，登录后可邀请另一半绑定或接受好友邀请。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<!-- ==================== 31 已绑定态（NOIR v3 s31） ==================== -->
			<template v-else-if="activeCouple">
				<view class="ci-hero">
					<view class="ci-avs">
						<view class="ci-av-wrap">
							<view class="ci-av">
								<image
									v-if="selfInfo.avatarUrl"
									class="ci-av__img"
									:src="selfInfo.avatarUrl"
									mode="aspectFill"
								></image>
								<text v-else class="ci-av__txt">{{ shortChar(selfInfo.nickname, '我') }}</text>
							</view>
							<view
								v-if="Number(selfInfo.gender) === 1 || Number(selfInfo.gender) === 2"
								class="ci-gender"
								:class="Number(selfInfo.gender) === 1 ? 'ci-gender--m' : 'ci-gender--f'"
							>
								<text class="ci-gender__txt">{{ Number(selfInfo.gender) === 1 ? '♂' : '♀' }}</text>
							</view>
						</view>

						<view class="ci-link">
							<view class="ci-line"></view>
							<text class="ci-heart">♥</text>
							<view class="ci-line"></view>
						</view>

						<view class="ci-av-wrap">
							<view class="ci-av ci-av--alt">
								<image
									v-if="activeCouple.partnerAvatarUrl"
									class="ci-av__img"
									:src="activeCouple.partnerAvatarUrl"
									mode="aspectFill"
								></image>
								<text v-else class="ci-av__txt">{{ shortChar(activeCouple.partnerNickname, 'TA') }}</text>
							</view>
							<view
								v-if="Number(activeCouple.partnerGender) === 1 || Number(activeCouple.partnerGender) === 2"
								class="ci-gender"
								:class="Number(activeCouple.partnerGender) === 1 ? 'ci-gender--m' : 'ci-gender--f'"
							>
								<text class="ci-gender__txt">{{ Number(activeCouple.partnerGender) === 1 ? '♂' : '♀' }}</text>
							</view>
						</view>
					</view>

					<view class="ci-names">
						<text class="ci-names__title">{{ selfInfo.nickname || '我' }} × {{ activeCouple.partnerNickname || '另一半' }}</text>
						<text class="ci-names__sub">{{ boundDaysSubtitle }}</text>
					</view>

					<view class="ci-stats">
						<view v-for="item in relationshipOverviewStats" :key="item.label" class="ci-stat">
							<text class="ci-stat__val">{{ item.value }}</text>
							<text class="ci-stat__lbl">{{ item.label }}</text>
						</view>
					</view>
				</view>

				<view class="ci-card">
					<view class="ci-row">
						<text class="ci-row__label">当前状态</text>
						<view class="cp-tag cp-tag--green">
							<text class="cp-tag__txt">已绑定</text>
						</view>
					</view>
					<view class="ci-row">
						<text class="ci-row__label">绑定时间</text>
						<text class="ci-row__val ci-row__val--mono">{{ formatDateTime(activeCouple.bindDate) }}</text>
					</view>
					<view class="ci-row">
						<text class="ci-row__label">绑定方式</text>
						<text class="ci-row__val">{{ bindMethodText }}</text>
					</view>
					<view class="ci-row ci-row--last" @tap="historyExpanded = !historyExpanded">
						<text class="ci-row__label">历史绑定记录</text>
						<view class="ci-row__right">
							<text class="ci-row__val">{{ historyExpanded ? '收起' : '查看' }}（{{ historyList.length }} 条）</text>
							<fui-icon
								:name="historyExpanded ? 'arrowdown' : 'arrowright'"
								:size="28"
								color="rgba(var(--noir-text-rgb), 0.42)"
							/>
						</view>
					</view>

					<view v-if="historyExpanded" class="ci-hist-panel">
						<view v-if="historyList.length" class="cp-list">
							<view v-for="item in historyList" :key="item.relationId" class="cp-item">
								<view class="cp-item__ava">
									<image
										v-if="item.partnerAvatarUrl"
										class="cp-item__ava-img"
										:src="item.partnerAvatarUrl"
										mode="aspectFill"
									></image>
									<text v-else class="cp-item__ava-txt">{{ shortChar(item.partnerNicknameMasked, 'TA') }}</text>
								</view>
								<view class="cp-item__body">
									<view class="cp-item__head">
										<text class="cp-item__name">{{ item.partnerNicknameMasked }}</text>
										<view class="cp-tag" :class="'cp-tag--' + historyTagTone(item.statusText)">
											<text class="cp-tag__txt">{{ item.statusText || '已处理' }}</text>
										</view>
									</view>
									<text class="cp-item__meta">对方 ID：{{ item.partnerUidMasked }}</text>
									<text class="cp-item__meta">{{ formatHistoryPeriod(item) }}</text>
								</view>
							</view>
						</view>
						<text v-else class="ci-hist-empty">暂无其他历史记录</text>
					</view>
				</view>

				<view class="ci-warn">
					<text class="ci-warn__txt">风险提示：解除当前情侣关系后，双方共享空间将立即关闭，且你与对方当前累计的全部心动点将清零且无法恢复。</text>
				</view>

				<view class="ad-view">
					<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
				</view>
			</template>

			<!-- ==================== 16 绑定邀请落地（NOIR v3 s16） ==================== -->
			<template v-else-if="inviteMode">
				<view class="il-wrap">
					<view v-if="inviteLoading" class="il-card">
						<text class="il-loading">正在核验邀请信息…</text>
					</view>

					<template v-else>
						<view class="il-card">
							<view class="il-av">
								<image
									v-if="invite && invite.inviterAvatarUrl"
									class="il-av__img"
									:src="invite.inviterAvatarUrl"
									mode="aspectFill"
								></image>
								<text v-else class="il-av__txt">{{ shortChar(invite && invite.inviterNickname, '♥') }}</text>
							</view>
							<text class="il-card__title">
								{{ invite && invite.inviterNickname ? `${invite.inviterNickname} 邀请你开启双人空间` : '情侣绑定邀请' }}
							</text>
							<text class="il-card__desc">
								接受邀请后，你们将共享{{ sharedModulesText() }}，并同步记录在一起的每一天。
							</text>
							<view class="il-code-pill">
								<text class="il-code-pill__txt">邀请码 · {{ formatSpacedCode(inviteCode) }}</text>
							</view>
						</view>

						<view v-if="invite && invite.status !== 'valid'" class="il-status-warn">
							<text class="il-status-warn__txt">{{ invite.statusText || '当前邀请不可用，请让对方重新发起' }}</text>
						</view>

						<view class="il-feats">
							<view class="il-feat">
								<view class="il-dot"></view>
								<text class="il-feat__txt">双方各得 +1,000 心动点（一次性成长里程碑）</text>
							</view>
							<view class="il-feat">
								<view class="il-dot"></view>
								<text class="il-feat__txt">共享{{ sharedModulesText('照片视频流与愿望单') }}</text>
							</view>
							<view class="il-feat">
								<view class="il-dot"></view>
								<text class="il-feat__txt">邀请码 7 天内有效，绑定成功后自动失效</text>
							</view>
						</view>

						<view class="il-acts">
							<view
								v-if="invite && invite.status === 'valid'"
								class="cp-btn cp-btn--primary"
								:class="{ 'cp-btn--disabled': actionLoading === 'bind' }"
								hover-class="cp-btn--hover"
								@tap="handleAcceptInvite"
							>
								<text class="cp-btn__txt">{{ actionLoading === 'bind' ? '绑定中…' : '接受邀请并绑定 (+1,000点)' }}</text>
							</view>
							<view
								v-else
								class="cp-btn cp-btn--primary"
								hover-class="cp-btn--hover"
								@tap="exitInviteMode"
							>
								<text class="cp-btn__txt">返回绑定页</text>
							</view>
							<view class="cp-btn cp-btn--ghost" hover-class="cp-btn--hover" @tap="goHome">
								<text class="cp-btn__txt cp-btn__txt--ghost">先逛逛首页</text>
							</view>
						</view>
					</template>
				</view>
			</template>

			<!-- ==================== 15 未绑定态（NOIR v3 s15） ==================== -->
			<template v-else>
				<view class="ci-hero">
					<view class="ci-avs">
						<view class="ci-av-wrap">
							<view class="ci-av">
								<image
									v-if="selfInfo.avatarUrl"
									class="ci-av__img"
									:src="selfInfo.avatarUrl"
									mode="aspectFill"
								></image>
								<text v-else class="ci-av__txt">{{ shortChar(selfInfo.nickname, '我') }}</text>
							</view>
							<view
								v-if="Number(selfInfo.gender) === 1 || Number(selfInfo.gender) === 2"
								class="ci-gender"
								:class="Number(selfInfo.gender) === 1 ? 'ci-gender--m' : 'ci-gender--f'"
							>
								<text class="ci-gender__txt">{{ Number(selfInfo.gender) === 1 ? '♂' : '♀' }}</text>
							</view>
						</view>

						<view class="ci-link">
							<view class="ci-line"></view>
							<text class="ci-heart">♥</text>
							<view class="ci-line"></view>
						</view>

						<view class="ci-av-wrap">
							<view class="ci-av ci-av--alt ci-av--placeholder">
								<text class="ci-av__txt ci-av__txt--q">?</text>
							</view>
						</view>
					</view>

					<view class="ci-names">
						<text class="ci-names__title">{{ selfInfo.nickname || '我' }} × 另一半</text>
						<text class="ci-names__sub">等待绑定 · 开启双人空间</text>
					</view>

					<view class="ci-stats">
						<view class="ci-stat">
							<text class="ci-stat__val">0</text>
							<text class="ci-stat__lbl">共同纪念日</text>
						</view>
						<view v-if="feedVisible" class="ci-stat">
							<text class="ci-stat__val">0</text>
							<text class="ci-stat__lbl">双人日常</text>
						</view>
						<view class="ci-stat">
							<text class="ci-stat__val">0</text>
							<text class="ci-stat__lbl">共同愿望</text>
						</view>
					</view>
				</view>

				<view class="ci-card">
					<view class="ci-row">
						<text class="ci-row__label">当前状态</text>
						<view class="cp-tag cp-tag--gold">
							<text class="cp-tag__txt">未绑定</text>
						</view>
					</view>
					<view class="ci-row ci-row--last">
						<text class="ci-row__label">绑定奖励</text>
						<text class="ci-row__val ci-row__val--mono">+1,000 心动点</text>
					</view>
				</view>

				<view class="cb-invite-section">
					<text class="cb-invite-desc">邀请你的另一半，一起记录每一天的甜蜜时光。绑定后可共享{{ sharedModulesText('照片视频与愿望单') }}。</text>
					<view class="cb-invite-acts">
						<button class="cp-btn cp-btn--primary cp-share-btn" open-type="share" hover-class="cp-btn--hover">
							<text class="cp-btn__txt">邀请 TA 来绑定</text>
						</button>
					</view>
				</view>

				<view class="cb-reward">
					<text class="cb-reward__txt">首次绑定成功后，双方各得 +1,000 心动点并解锁每日签到与任务体系</text>
				</view>

				<!-- 有历史绑定记录时展示折叠入口 -->
				<view v-if="historyList.length" class="ci-card cb-hist-card">
					<view class="ci-row ci-row--last" @tap="historyExpanded = !historyExpanded">
						<text class="ci-row__label">历史绑定记录</text>
						<view class="ci-row__right">
							<text class="ci-row__val">{{ historyExpanded ? '收起' : '查看' }}（{{ historyList.length }} 条）</text>
							<fui-icon
								:name="historyExpanded ? 'arrowdown' : 'arrowright'"
								:size="28"
								color="rgba(var(--noir-text-rgb), 0.42)"
							/>
						</view>
					</view>
					<view v-if="historyExpanded" class="ci-hist-panel">
						<view class="cp-list">
							<view v-for="item in historyList" :key="item.relationId" class="cp-item">
								<view class="cp-item__ava">
									<image
										v-if="item.partnerAvatarUrl"
										class="cp-item__ava-img"
										:src="item.partnerAvatarUrl"
										mode="aspectFill"
									></image>
									<text v-else class="cp-item__ava-txt">{{ shortChar(item.partnerNicknameMasked, 'TA') }}</text>
								</view>
								<view class="cp-item__body">
									<view class="cp-item__head">
										<text class="cp-item__name">{{ item.partnerNicknameMasked }}</text>
										<view class="cp-tag" :class="'cp-tag--' + historyTagTone(item.statusText)">
											<text class="cp-tag__txt">{{ item.statusText || '已处理' }}</text>
										</view>
									</view>
									<text class="cp-item__meta">{{ formatHistoryPeriod(item) }}</text>
								</view>
							</view>
						</view>
					</view>
				</view>

				<view class="ad-view">
					<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
				</view>
			</template>
		</view>

		<!-- 已绑定态底部解绑栏（对标 s31 .m-foot） -->
		<view v-if="isLoggedIn && activeCouple" class="ci-foot-bar">
			<view
				class="cp-btn cp-btn--danger"
				:class="{ 'cp-btn--disabled': actionLoading === 'unbind' }"
				hover-class="cp-btn--hover"
				@tap="handleUnbind"
			>
				<text class="cp-btn__txt cp-btn__txt--danger">{{ actionLoading === 'unbind' ? '解绑中…' : '解除当前关系' }}</text>
			</view>
		</view>
	</view>
</template>

<script>
	import LoveAuthRequired from '@/components/love-auth-required/love-auth-required.vue'
	import { navigateToTab, goHomeTab } from '@/common/utils/tab-nav.js'
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		getCurrentUniIdUser,
		subscribeAuthChanged
	} from '../../common/auth-center.js'
	import { getCoupleApi } from '../../common/api/couple.js'
	import { getPointsApi } from '../../common/api/points.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { requirePageLogin } from '@/common/auth-entry.js'
	import { loadAppSettings, readAppSettingsCache } from '@/common/app-settings.js'

	function getDefaultCenterData() {
		return {
			selfInfo: null,
			activeCouple: null,
			bindCodeInfo: null,
			incomingRequests: [],
			outgoingRequests: [],
			historyList: [],
			canSendRequest: true
		}
	}

	function normalizeSixDigits(value = '') {
		return String(value || '').replace(/[^\d]/g, '').slice(0, 6)
	}

	function formatSpacedCode(code = '') {
		const digits = normalizeSixDigits(code)
		if (digits.length !== 6) {
			return digits || '--- ---'
		}
		return `${digits.slice(0, 3)} ${digits.slice(3)}`
	}

	function formatDateTime(timestamp) {
		if (!timestamp) {
			return '暂未记录'
		}

		const date = new Date(timestamp)
		const year = date.getFullYear()
		const month = `${date.getMonth() + 1}`.padStart(2, '0')
		const day = `${date.getDate()}`.padStart(2, '0')
		const hour = `${date.getHours()}`.padStart(2, '0')
		const minute = `${date.getMinutes()}`.padStart(2, '0')
		return `${year}-${month}-${day} ${hour}:${minute}`
	}

	function formatDateDot(timestamp) {
		if (!timestamp) {
			return ''
		}
		const date = new Date(timestamp)
		const year = date.getFullYear()
		const month = `${date.getMonth() + 1}`.padStart(2, '0')
		const day = `${date.getDate()}`.padStart(2, '0')
		return `${year}.${month}.${day}`
	}

	export default {
		components: {
			LoveAuthRequired
		},
		data() {
			return {
				DEFAULT_AVATAR,
				scrollTop: 0,
				appStateStore: null,
				// 模块权限：放在 data() 里读缓存，首屏就按开关渲染，不跳一下
				appSettings: readAppSettingsCache(),
				actionLoading: '',
				historyExpanded: false,
				removeAuthListener: null,
				// 邀请落地态（s16）
				inviteMode: false,
				inviteCode: '',
				inviteLoading: false,
				invite: null,
				centerData: getDefaultCenterData()
			}
		},
		computed: {
			isLoggedIn() {
				const currentUserInfo = getCurrentUniIdUser()
				return Boolean(currentUserInfo && currentUserInfo.uid)
			},
			// 双人日常是权限类开关（默认关），关掉后本页不再露出任何双人日常入口
			feedVisible() {
				return Boolean(this.appSettings && this.appSettings.feedVisible === true)
			},
			navbarTitle() {
				if (this.activeCouple) return '情侣信息'
				if (this.inviteMode) return '情侣邀请'
				return '情侣绑定'
			},
			selfInfo() {
				return this.centerData.selfInfo || {}
			},
			activeCouple() {
				return this.centerData.activeCouple || null
			},
			bindCodeInfo() {
				return this.centerData.bindCodeInfo || null
			},
			inviteBadgeText() {
				if (this.inviteLoading || !this.invite) return '7 天有效'
				if (this.invite.status === 'valid') return '7 天有效'
				if (this.invite.status === 'expired') return '已过期'
				if (this.invite.status === 'used') return '已失效'
				if (this.invite.status === 'self') return '本人邀请'
				return '无效邀请'
			},
			historyList() {
				return Array.isArray(this.centerData.historyList) ? this.centerData.historyList : []
			},
			bindMethodText() {
				if (!this.activeCouple) {
					return ''
				}
				const raw = String(
					this.activeCouple.bindSource
					|| this.activeCouple.bind_source
					|| this.activeCouple.bindType
					|| this.activeCouple.bind_type
					|| ''
				).trim()
				const key = raw.toLowerCase()
				if (key === 'code' || key === 'bind_code' || key === '6digit') {
					return '6 位数字绑定码'
				}
				if (key === 'invite' || key === 'share' || key === 'wechat_share') {
					return '微信好友邀请'
				}
				if (key === 'qrcode' || key === 'scan') {
					return '扫码绑定'
				}
				if (!key || key === 'uid' || key === 'request' || key === 'legacy') {
					return '用户 ID 双向确认'
				}
				return raw
			},
			boundDaysSubtitle() {
				if (!this.activeCouple || !this.activeCouple.bindDate) {
					return '已绑定双人共享空间'
				}
				const start = new Date(this.activeCouple.bindDate)
				const now = new Date()
				const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
				const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
				const days = Math.max(1, Math.floor((today - startDay) / 86400000) + 1)
				return `${formatDateDot(this.activeCouple.bindDate)} 起 · 已绑定第 ${days} 天`
			},
			relationshipOverviewStats() {
				const metrics = this.activeCouple && this.activeCouple.metrics ? this.activeCouple.metrics : {}
				const anniversaryCount = Number(
					this.activeCouple
						? (this.activeCouple.anniversaryCount !== undefined
							? this.activeCouple.anniversaryCount
							: (metrics.anniversaryCount || (this.activeCouple.anniversaryDate ? 1 : 0)))
						: 0
				)
				const momentCount = Number(
					this.activeCouple
						? (this.activeCouple.momentCount !== undefined
							? this.activeCouple.momentCount
							: (metrics.momentCount || 0))
						: 0
				)
				const wishCount = Number(
					this.activeCouple
						? (this.activeCouple.wishCount !== undefined
							? this.activeCouple.wishCount
							: (metrics.wishCount || 0))
						: 0
				)

				return [{
					label: '共同纪念日',
					value: `${anniversaryCount}`
				}, {
					label: '双人日常',
					value: `${momentCount}`,
					requireFeed: true
				}, {
					label: '共同愿望',
					value: `${wishCount}`
				}].filter((item) => !item.requireFeed || this.feedVisible)
			}
		},
		onLoad(options = {}) {
			if (!requirePageLogin({ route: '/pages/couple/index', options })) return
			const code = normalizeSixDigits(options.inviteCode || options.code || '')
			if (code.length === 6) {
				this.inviteMode = true
				this.inviteCode = code
			}
			this.ensureAppStateStore()
			this.syncCenterDataFromStore()
			this.removeAuthListener = subscribeAuthChanged(() => {
				this.restoreLoginState()
			})
			if (this.inviteMode) {
				this.loadInvitePreview(this.inviteCode)
			}
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
		},
		onShow() {
			this.restoreLoginState()
			this.syncModuleVisibility()
		},
		onPullDownRefresh() {
			this.fetchCoupleCenter({
				silent: true,
				stopPullDownRefresh: true,
				force: true
			})
		},
		onShareAppMessage() {
			const name = this.selfInfo.nickname || '我'
			const codeInfo = this.bindCodeInfo
			const code = codeInfo && codeInfo.code ? normalizeSixDigits(codeInfo.code) : ''
			return {
				title: `${name} 邀请你在恋人手札开启双人空间`,
				path: code ? `/pages/couple/index?inviteCode=${code}` : '/pages/couple/index'
			}
		},
		onUnload() {
			if (this.removeAuthListener) {
				this.removeAuthListener()
				this.removeAuthListener = null
			}
		},
		methods: {
			formatDateTime,
			formatSpacedCode,
			// 双人日常关闭后，绑定文案不再承诺这个模块
			sharedModulesText(rest = '照片与愿望单') {
				return this.feedVisible
					? `纪念日、双人日常、${rest}`
					: `纪念日、${rest}`
			},
			shortChar(name = '', fallback = '我') {
				const text = String(name || '').trim()
				return text ? text.slice(0, 1) : fallback
			},
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			/**
			 * 对齐模块权限：先读缓存（首屏不跳），再拉一次服务端。
			 * 不 force —— 冷启动时 App.onLaunch 那次会被 TTL / 飞行中复用，不会多发请求。
			 */
			async syncModuleVisibility() {
				this.appSettings = readAppSettingsCache()
				const latest = await loadAppSettings()
				if (latest) {
					this.appSettings = latest
				}
			},
			syncCenterDataFromStore() {
				const appStateStore = this.ensureAppStateStore()
				this.centerData = appStateStore.coupleCenterData || getDefaultCenterData()
			},
			formatHistoryPeriod(item = {}) {
				const parts = []
				if (item.bindDate) {
					parts.push(`绑定于 ${formatDateTime(item.bindDate)}`)
				}
				if (item.unbindDate) {
					parts.push(`解绑于 ${formatDateTime(item.unbindDate)}`)
				}
				return parts.length ? parts.join(' · ') : '暂未记录时间'
			},
			historyTagTone(statusText = '') {
				const text = String(statusText || '')
				if (text.includes('解绑')) return 'coral'
				if (text.includes('绑定')) return 'green'
				return 'muted'
			},
			resetCenterData() {
				this.centerData = getDefaultCenterData()
				this.ensureAppStateStore().updateCoupleCenterData(getDefaultCenterData(), {
					markFetched: false
				})
			},
			applyCenterData(result = {}) {
				this.centerData = {
					selfInfo: result.selfInfo || null,
					activeCouple: result.activeCouple || null,
					bindCodeInfo: result.bindCodeInfo || null,
					incomingRequests: Array.isArray(result.incomingRequests) ? result.incomingRequests : [],
					outgoingRequests: Array.isArray(result.outgoingRequests) ? result.outgoingRequests : [],
					historyList: Array.isArray(result.historyList) ? result.historyList : [],
					canSendRequest: Boolean(result.canSendRequest)
				}
				this.ensureAppStateStore().updateCoupleCenterData(this.centerData)
			},
			async restoreLoginState() {
				const appStateStore = this.ensureAppStateStore()
				const currentUserInfo = getCurrentUniIdUser()
				if (!currentUserInfo || !currentUserInfo.uid) {
					appStateStore.clearAllState()
					this.resetCenterData()
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					appStateStore.clearAllState()
					this.resetCenterData()
					return
				}

				try {
					await appStateStore.fetchCoupleCenter({
						force: !this.activeCouple
					})
					this.syncCenterDataFromStore()
				} catch (error) {
					console.warn('couple restoreLoginState failed', error)
					this.syncCenterDataFromStore()
				}
			},
			async fetchCoupleCenter({ silent = false, stopPullDownRefresh = false, force = false } = {}) {
				const appStateStore = this.ensureAppStateStore()
				try {
					await appStateStore.fetchCoupleCenter({
						force
					})
					this.syncCenterDataFromStore()
				} catch (error) {
					console.warn('couple fetchCoupleCenter failed', error)
					this.syncCenterDataFromStore()
					if (!silent) {
						uni.showToast({
							title: error.message || '获取情侣信息失败',
							icon: 'none'
						})
					}
				} finally {
					if (stopPullDownRefresh) {
						uni.stopPullDownRefresh()
					}
				}
			},
			async loadInvitePreview(code) {
				if (!code || this.inviteLoading) {
					return
				}
				this.inviteLoading = true
				try {
					const result = await getCoupleApi().getInvitePreview({ code })
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取邀请信息失败')
					}
					this.invite = (result && result.invite) || {
						status: 'invalid',
						statusText: '邀请码无效',
						code
					}
				} catch (error) {
					this.invite = {
						status: 'invalid',
						statusText: error.message || '获取邀请信息失败',
						code
					}
				} finally {
					this.inviteLoading = false
				}
			},
			exitInviteMode() {
				this.inviteMode = false
				this.invite = null
				this.inviteCode = ''
			},
			goToLoginPage() {
				const query = this.inviteCode ? `?inviteCode=${this.inviteCode}` : ''
				uni.redirectTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/couple/index' + query)
				})
			},
			backToProfile() {
				navigateToTab('/pages/profile/index')
			},
			goHome() {
				goHomeTab()
			},
	
	
			async handleAcceptInvite() {
				if (this.actionLoading || !this.invite || this.invite.status !== 'valid') {
					return
				}
				await this.submitBindByCode(this.inviteCode, 'invite')
			},
			async submitBindByCode(code, source = 'code') {
				this.actionLoading = 'bind'
				uni.showLoading({
					title: '正在绑定',
					mask: true
				})
				try {
					const result = await getCoupleApi().bindByCode({ code, source })
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '绑定失败')
					}
					this.applyCenterData(result)
					this.ensureAppStateStore().invalidateRelationCounters()
					this.inviteMode = false
					this.invite = null
					uni.showToast({
						title: '绑定成功！双人空间已开启',
						icon: 'success'
					})
				} catch (error) {
					const msg = error.message || '绑定失败'
					uni.showToast({
						title: msg,
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
					uni.hideLoading()
				}
			},
			confirmAction({ title = '提示', content = '确定继续吗？' } = {}) {
				return new Promise((resolve) => {
					uni.showModal({
						title,
						content,
						success: (res) => {
							resolve(Boolean(res.confirm))
						},
						fail: () => {
							resolve(false)
						}
					})
				})
			},
			async handleUnbind() {
				if (!this.activeCouple || this.actionLoading) {
					return
				}

				const pointsNotice = await this.fetchPointsClearNotice()
				const confirmed = await this.confirmAction({
					title: '解除当前关系',
					content: `解绑后才能重新绑定其他人，当前绑定关系会保留在历史记录中。${pointsNotice}`
				})
				if (!confirmed) {
					return
				}

				this.actionLoading = 'unbind'
				try {
					const result = await getCoupleApi().unbind({
						relationId: this.activeCouple.coupleId
					})
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '解绑失败')
					}

					this.applyCenterData(result)
					this.ensureAppStateStore().invalidateRelationCounters()
					const cleared = Number(result.pointsCleared || 0)
					uni.showToast({
						title: cleared > 0
							? `已解绑，${cleared} 心动点已清零`
							: (result.errMsg || '已解绑当前情侣关系'),
						icon: 'none'
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '解绑失败',
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
				}
			},
			async fetchPointsClearNotice() {
				try {
					const result = await getPointsApi().getSummary()
					const balance = Number((result && result.data && result.data.balance) || 0)
					if (result && result.errCode && result.errCode !== 0) {
						return '\n解绑后心动点将全部清零。'
					}
					return balance > 0
						? `\n解绑后你的心动点（${balance}）将清零且无法恢复。`
						: '\n解绑后心动点将全部清零。'
				} catch (error) {
					return '\n解绑后心动点将全部清零。'
				}
			}
		}
	}
</script>

<style scoped>
	.cp-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
		background: var(--noir-bg);
		overflow: hidden;
	}

	.cp-page--bound {
		padding-bottom: calc(176rpx + env(safe-area-inset-bottom));
	}

	.cp-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.2;
		pointer-events: none;
		z-index: 0;
	}

	.cp-glow--left {
		top: -120rpx;
		left: -140rpx;
		background: var(--noir-coral);
	}

	.cp-glow--right {
		top: 320rpx;
		right: -160rpx;
		background: var(--noir-gold);
	}

	.cp-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 36rpx 0;
	}

	.cp-auth {
		margin-top: 20rpx;
	}

	/* ==================== 已绑定态 s31 ==================== */

	.ci-hero {
		padding: 36rpx 28rpx 30rpx;
		border-radius: 36rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: linear-gradient(135deg, rgba(var(--noir-gold-rgb), 0.12), var(--noir-glass-1));
	}

	.ci-avs {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 24rpx;
	}

	.ci-av-wrap {
		position: relative;
	}

	.ci-av {
		width: 112rpx;
		height: 112rpx;
		border-radius: 50%;
		border: 2rpx solid rgba(var(--avatar-17-rgb), 0.50);
		background: linear-gradient(135deg, var(--avatar-11), var(--avatar-03));
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.ci-av--alt {
		background: linear-gradient(135deg, var(--avatar-04), var(--avatar-02));
	}

	.ci-av__img {
		width: 100%;
		height: 100%;
	}

	.ci-av__txt {
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 38rpx;
		color: var(--avatar-18);
	}

	.ci-gender {
		position: absolute;
		right: -2rpx;
		bottom: -2rpx;
		width: 34rpx;
		height: 34rpx;
		border-radius: 50%;
		border: 3rpx solid var(--noir-sheet-hi);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ci-gender--m {
		background: var(--avatar-06);
	}

	.ci-gender--f {
		background: var(--avatar-08);
	}

	.ci-gender__txt {
		font-size: 19rpx;
		line-height: 1;
		color: var(--noir-white);
		font-weight: 700;
	}

	.ci-link {
		width: 108rpx;
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.ci-line {
		flex: 1;
		height: 1rpx;
		background: rgba(var(--noir-gold-rgb), 0.46);
	}

	.ci-heart {
		font-size: 22rpx;
		color: var(--noir-coral);
		flex-shrink: 0;
	}

	.ci-names {
		margin-top: 22rpx;
		text-align: center;
	}

	.ci-names__title {
		display: block;
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 36rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ci-names__sub {
		display: block;
		margin-top: 8rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 21rpx;
		color: rgba(var(--noir-gold-rgb), 0.74);
	}

	.ci-stats {
		display: flex;
		margin-top: 28rpx;
		padding-top: 22rpx;
		border-top: 1rpx solid rgba(var(--noir-wash-rgb), 0.07);
	}

	.ci-stat {
		flex: 1;
		text-align: center;
	}

	.ci-stat + .ci-stat {
		border-left: 1rpx solid rgba(var(--noir-wash-rgb), 0.06);
	}

	.ci-stat__val {
		display: block;
		font-family: "Georgia", serif;
		font-size: 36rpx;
		font-weight: 500;
		color: var(--noir-gold-soft);
		line-height: 1.1;
	}

	.ci-stat__lbl {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: var(--noir-text-muted);
	}

	.ci-card {
		margin-top: 24rpx;
		padding: 0 28rpx;
		border-radius: 30rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
	}

	.ci-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		min-height: 94rpx;
		border-bottom: 1rpx solid var(--noir-border-soft);
	}

	.ci-row--last {
		border-bottom: none;
	}

	.ci-row__label {
		font-size: 25rpx;
		color: rgba(var(--noir-text-rgb), 0.60);
	}

	.ci-row__right {
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	.ci-row__val {
		font-size: 25rpx;
		color: var(--noir-text-strong);
	}

	.ci-row__val--mono {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 23rpx;
		color: var(--noir-gold-soft);
	}

	.ci-hist-panel {
		padding: 12rpx 0 24rpx;
		border-top: 1rpx solid var(--noir-border-soft);
	}

	.ci-hist-empty {
		display: block;
		padding: 20rpx 0 4rpx;
		text-align: center;
		font-size: 23rpx;
		color: rgba(var(--noir-text-rgb), 0.40);
	}

	.ci-warn {
		margin-top: 24rpx;
		padding: 22rpx 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.28);
		background: rgba(var(--noir-coral-rgb), 0.07);
	}

	.ci-warn__txt {
		font-size: 22rpx;
		line-height: 1.65;
		color: rgba(var(--avatar-13-rgb), 0.86);
	}

	.ci-foot-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		padding: 20rpx 36rpx calc(24rpx + env(safe-area-inset-bottom));
		border-top: 1rpx solid rgba(var(--noir-wash-rgb), 0.06);
		background: rgba(var(--noir-bg-rgb), 0.94);
	}

	/* ==================== 绑定邀请落地 s16 ==================== */

	.il-wrap {
		padding-top: 28rpx;
		text-align: center;
	}

	.il-card {
		padding: 44rpx 36rpx;
		border-radius: 38rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.28);
		background: linear-gradient(155deg, rgba(var(--noir-coral-rgb), 0.16), var(--noir-glass-1));
	}

	.il-loading {
		font-size: 25rpx;
		color: rgba(var(--noir-text-rgb), 0.56);
	}

	.il-av {
		width: 136rpx;
		height: 136rpx;
		margin: 0 auto;
		border-radius: 50%;
		border: 3rpx solid rgba(var(--avatar-17-rgb), 0.55);
		background: linear-gradient(135deg, var(--avatar-11), var(--avatar-03));
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.il-av__img {
		width: 100%;
		height: 100%;
	}

	.il-av__txt {
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 52rpx;
		color: var(--avatar-19);
	}

	.il-card__title {
		display: block;
		margin-top: 28rpx;
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 40rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.il-card__desc {
		display: block;
		margin-top: 16rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: rgba(var(--noir-text-rgb), 0.58);
	}

	.il-code-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 28rpx;
		height: 56rpx;
		padding: 0 28rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.40);
		background: rgba(var(--noir-bg-rgb), 0.55);
	}

	.il-code-pill__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 24rpx;
		letter-spacing: 3rpx;
		color: var(--noir-gold-soft);
	}

	.il-status-warn {
		margin-top: 24rpx;
		padding: 20rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid var(--noir-border-coral);
		background: rgba(var(--noir-coral-rgb), 0.12);
	}

	.il-status-warn__txt {
		font-size: 23rpx;
		color: var(--noir-coral-light);
	}

	.il-feats {
		margin-top: 30rpx;
		display: flex;
		flex-direction: column;
		gap: 14rpx;
		text-align: left;
	}

	.il-feat {
		display: flex;
		align-items: center;
		gap: 16rpx;
		padding: 20rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.075);
		background: var(--noir-glass-1);
	}

	.il-dot {
		width: 10rpx;
		height: 10rpx;
		border-radius: 50%;
		background: var(--noir-coral-soft);
		flex-shrink: 0;
	}

	.il-feat__txt {
		font-size: 23rpx;
		color: rgba(var(--noir-text-rgb), 0.78);
		line-height: 1.5;
	}

	.il-acts {
		margin-top: 38rpx;
		display: flex;
		flex-direction: column;
		gap: 20rpx;
	}

	/* ==================== 未绑定 邀请 TA 来绑定 s15 ==================== */

	.ci-av--placeholder {
		border-style: dashed;
		border-color: rgba(var(--noir-gold-rgb), 0.38);
		background: rgba(var(--noir-gold-rgb), 0.06);
	}

	.ci-av__txt--q {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 44rpx;
		color: rgba(var(--noir-gold-rgb), 0.52);
	}

	.cb-invite-section {
		margin-top: 28rpx;
		padding: 28rpx 28rpx 32rpx;
		border-radius: 30rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
		text-align: center;
	}

	.cb-invite-desc {
		display: block;
		font-size: 24rpx;
		line-height: 1.72;
		color: rgba(var(--noir-text-rgb), 0.58);
	}

	.cb-invite-acts {
		margin-top: 28rpx;
	}

	.cb-invite-acts .cp-share-btn {
		width: 100%;
	}

	.cp-share-btn {
		margin: 0;
		padding: 0;
		line-height: 1;
	}

	.cp-share-btn::after {
		border: none;
	}

	.cb-reward {
		margin-top: 28rpx;
		padding: 20rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(var(--noir-green-rgb), 0.28);
		background: rgba(var(--noir-green-rgb), 0.07);
		text-align: center;
	}

	.cb-reward__txt {
		font-size: 22rpx;
		line-height: 1.6;
		color: var(--noir-green);
	}

	.cb-hist-card {
		margin-top: 28rpx;
	}

	/* 通用历史条目 / 胶囊 / 按钮 */
	.cp-list {
		display: flex;
		flex-direction: column;
		gap: 18rpx;
	}

	.cp-item {
		display: flex;
		align-items: center;
		gap: 18rpx;
	}

	.cp-item__ava {
		flex-shrink: 0;
		width: 72rpx;
		height: 72rpx;
		border-radius: 50%;
		border: 1.5rpx solid rgba(var(--noir-gold-rgb), 0.34);
		background: linear-gradient(135deg, var(--avatar-11), var(--avatar-03));
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.cp-item__ava-img {
		width: 100%;
		height: 100%;
	}

	.cp-item__ava-txt {
		font-size: 26rpx;
		color: var(--avatar-18);
		font-weight: 600;
	}

	.cp-item__body {
		flex: 1;
		min-width: 0;
	}

	.cp-item__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.cp-item__name {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cp-item__meta {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: rgba(var(--noir-text-rgb), 0.46);
	}

	.cp-tag {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 38rpx;
		padding: 0 16rpx;
		border-radius: 19rpx;
	}

	.cp-tag--green {
		border: 1rpx solid rgba(var(--noir-green-rgb), 0.38);
		background: rgba(var(--noir-green-rgb), 0.14);
	}

	.cp-tag--green .cp-tag__txt {
		color: var(--noir-green);
	}

	.cp-tag--coral {
		border: 1rpx solid var(--noir-border-coral);
		background: rgba(var(--noir-coral-rgb), 0.16);
	}

	.cp-tag--coral .cp-tag__txt {
		color: var(--noir-coral-light);
	}

	.cp-tag--gold {
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.40);
		background: rgba(var(--noir-gold-rgb), 0.14);
	}

	.cp-tag--gold .cp-tag__txt {
		color: var(--noir-gold-soft);
	}

	.cp-tag--muted {
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.12);
		background: var(--noir-glass-2);
	}

	.cp-tag--muted .cp-tag__txt {
		color: rgba(var(--noir-text-rgb), 0.56);
	}

	.cp-tag__txt {
		font-size: 20rpx;
		font-weight: 600;
	}

	.cp-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		border-radius: 44rpx;
	}

	.cp-btn--primary {
		background: var(--noir-btn-gradient);
		box-shadow: 0 12rpx 26rpx rgba(var(--noir-coral-rgb), 0.26);
	}

	.cp-btn--ghost {
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.36);
		background: rgba(var(--noir-gold-rgb), 0.08);
	}

	.cp-btn--danger {
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.46);
		background: rgba(var(--noir-coral-rgb), 0.14);
	}

	.cp-btn--disabled {
		opacity: 0.45;
	}

	.cp-btn--hover {
		opacity: 0.86;
	}

	.cp-btn__txt {
		font-size: 27rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
	}

	.cp-btn__txt--ghost {
		color: var(--noir-gold-soft);
	}

	.cp-btn__txt--danger {
		color: var(--avatar-12);
	}

	.ad-view {
		margin-top: 32rpx;
	}
</style>
