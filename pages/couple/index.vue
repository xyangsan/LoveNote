<template>
	<view class="cp-page" :class="{ 'cp-page--bound': Boolean(activeCouple) }">
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
					v-if="isLoggedIn && !activeCouple && !inviteMode"
					class="cp-nav-pill"
					@tap="handleRefreshCode"
				>
					<text class="cp-nav-pill__txt">{{ actionLoading === 'refresh' ? '刷新中…' : '刷新码' }}</text>
				</view>
				<view
					v-else-if="isLoggedIn && !activeCouple && inviteMode"
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
				desc="情侣信息页需要登录后才能查看和操作，登录后可获取 6 位数字绑定码或接受好友邀请。"
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
								color="rgba(245, 237, 228, 0.42)"
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
								接受邀请后，你们将共享纪念日、双人日常、照片与愿望单，并同步记录在一起的每一天。
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
								<text class="il-feat__txt">共享纪念日、双人日常、照片视频流与愿望单</text>
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
								<text class="cp-btn__txt">去使用 6 位绑定码绑定</text>
							</view>
							<view class="cp-btn cp-btn--ghost" hover-class="cp-btn--hover" @tap="goHome">
								<text class="cp-btn__txt cp-btn__txt--ghost">先逛逛首页</text>
							</view>
						</view>
					</template>
				</view>
			</template>

			<!-- ==================== 15 情侣绑定（6 位数字码 · NOIR v3 s15） ==================== -->
			<template v-else>
				<view class="cb-card">
					<text class="cb-kicker">MY BINDING CODE · {{ bindCodeValidityText }}</text>
					<text class="cb-code" @tap="copyMyBindCode">{{ formattedMyCode }}</text>
					<text class="cb-meta">发给另一半微信好友，或让 TA 输入上方 6 位数字绑定码</text>
					<view class="cb-acts">
						<view class="cp-btn cp-btn--ghost" hover-class="cp-btn--hover" @tap="copyMyBindCode">
							<text class="cp-btn__txt cp-btn__txt--ghost">复制绑定码</text>
						</view>
						<button class="cp-btn cp-btn--primary cp-share-btn" open-type="share" hover-class="cp-btn--hover">
							<text class="cp-btn__txt">发给微信好友</text>
						</button>
					</view>
				</view>

				<view class="cb-div">
					<view class="cb-div__line"></view>
					<text class="cb-div__txt">或输入 TA 的 6 位绑定码</text>
					<view class="cb-div__line"></view>
				</view>

				<view class="cb-input-section">
					<text class="cb-label">输入 6 位数字绑定码</text>

					<!-- 6 格数字槽 + 透明覆盖输入（点击任意格即拉起数字键盘，支持整段粘贴） -->
					<view class="cb-slots-wrap">
						<view class="cb-slots">
							<view
								v-for="(slot, idx) in codeSlots"
								:key="idx"
								class="cb-slot"
								:class="{
									'cb-slot--empty': !slot,
									'cb-slot--active': codeInputFocused && idx === Math.min(inputCode.length, 5)
								}"
							>
								<text class="cb-slot__txt">{{ slot || '·' }}</text>
							</view>
						</view>
						<input
							class="cb-hidden-input"
							type="number"
							:maxlength="6"
							:value="inputCode"
							@focus="codeInputFocused = true"
							@blur="codeInputFocused = false"
							@input="onCodeNativeInput"
						/>
					</view>

					<text v-if="inputCodeError" class="cb-error">{{ inputCodeError }}</text>

					<view
						class="cp-btn cp-btn--primary cb-submit"
						:class="{ 'cp-btn--disabled': inputCode.length !== 6 || actionLoading === 'bind' }"
						hover-class="cp-btn--hover"
						@tap="handleBindByCode"
					>
						<text class="cp-btn__txt">{{ actionLoading === 'bind' ? '绑定中…' : '确认绑定' }}</text>
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
								color="rgba(245, 237, 228, 0.42)"
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
				actionLoading: '',
				historyExpanded: false,
				removeAuthListener: null,
				// 6 位数字绑定码输入
				inputCode: '',
				inputCodeError: '',
				codeInputFocused: false,
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
			myBindCode() {
				return normalizeSixDigits(this.bindCodeInfo && this.bindCodeInfo.code)
			},
			formattedMyCode() {
				return formatSpacedCode(this.myBindCode)
			},
			bindCodeValidityText() {
				const exp = Number(this.bindCodeInfo && this.bindCodeInfo.expiresAt || 0)
				if (!exp) {
					return '7 天内有效'
				}
				const remainMs = exp - Date.now()
				if (remainMs <= 0) {
					return '已过期 · 请刷新'
				}
				const days = Math.max(1, Math.ceil(remainMs / 86400000))
				return `${days} 天内有效`
			},
			codeSlots() {
				const digits = normalizeSixDigits(this.inputCode)
				return Array.from({ length: 6 }, (_, i) => digits[i] || '')
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
					value: `${momentCount}`
				}, {
					label: '共同愿望',
					value: `${wishCount}`
				}]
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
			const code = this.myBindCode
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
				this.inputCode = ''
				this.inputCodeError = ''
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
						force: !this.activeCouple && !this.myBindCode
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
			onCodeNativeInput(event) {
				const raw = event && event.detail ? event.detail.value : ''
				this.inputCode = normalizeSixDigits(raw)
				if (this.inputCodeError) {
					this.inputCodeError = ''
				}
			},
			copyMyBindCode() {
				if (!this.myBindCode) {
					uni.showToast({
						title: '正在生成绑定码，请稍候',
						icon: 'none'
					})
					return
				}
				uni.setClipboardData({
					data: this.myBindCode,
					success: () => {
						uni.showToast({
							title: '绑定码已复制',
							icon: 'success'
						})
					}
				})
			},
			async handleRefreshCode() {
				if (this.actionLoading) {
					return
				}
				this.actionLoading = 'refresh'
				try {
					const result = await getCoupleApi().refreshBindCode()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '刷新绑定码失败')
					}
					this.applyCenterData(result)
					uni.showToast({
						title: '已生成新的 6 位绑定码',
						icon: 'success'
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '刷新绑定码失败',
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
				}
			},
			async handleBindByCode() {
				if (this.actionLoading) {
					return
				}
				const code = normalizeSixDigits(this.inputCode)
				if (code.length !== 6) {
					this.inputCodeError = '请输入完整的 6 位数字绑定码'
					return
				}
				if (this.myBindCode && code === this.myBindCode) {
					this.inputCodeError = '不能输入自己的绑定码'
					return
				}
				await this.submitBindByCode(code, 'code')
			},
			async handleAcceptInvite() {
				if (this.actionLoading || !this.invite || this.invite.status !== 'valid') {
					return
				}
				await this.submitBindByCode(this.inviteCode, 'invite')
			},
			async submitBindByCode(code, source = 'code') {
				this.actionLoading = 'bind'
				this.inputCodeError = ''
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
					this.inputCode = ''
					this.inviteMode = false
					this.invite = null
					uni.showToast({
						title: '绑定成功！双人空间已开启',
						icon: 'success'
					})
				} catch (error) {
					const msg = error.message || '绑定失败'
					if (source === 'code') {
						this.inputCodeError = msg
					}
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

	.cp-nav-pill {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 52rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.44);
		background: rgba(216, 176, 140, 0.10);
	}

	.cp-nav-pill__txt {
		font-size: 22rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
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
		background: linear-gradient(135deg, rgba(216, 176, 140, 0.12), rgba(255, 255, 255, 0.025));
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
		border: 2rpx solid rgba(255, 240, 226, 0.50);
		background: linear-gradient(135deg, #D9B08A, #9A6347);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.ci-av--alt {
		background: linear-gradient(135deg, #6D7C74, #3F4C46);
	}

	.ci-av__img {
		width: 100%;
		height: 100%;
	}

	.ci-av__txt {
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 38rpx;
		color: #FFF6EC;
	}

	.ci-gender {
		position: absolute;
		right: -2rpx;
		bottom: -2rpx;
		width: 34rpx;
		height: 34rpx;
		border-radius: 50%;
		border: 3rpx solid #181310;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ci-gender--m {
		background: #4A8FE2;
	}

	.ci-gender--f {
		background: #E26478;
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
		background: rgba(216, 176, 140, 0.46);
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
		color: rgba(216, 176, 140, 0.74);
	}

	.ci-stats {
		display: flex;
		margin-top: 28rpx;
		padding-top: 22rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.07);
	}

	.ci-stat {
		flex: 1;
		text-align: center;
	}

	.ci-stat + .ci-stat {
		border-left: 1rpx solid rgba(255, 255, 255, 0.06);
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
		background: rgba(255, 255, 255, 0.03);
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
		color: rgba(245, 237, 228, 0.60);
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
		color: rgba(245, 237, 228, 0.40);
	}

	.ci-warn {
		margin-top: 24rpx;
		padding: 22rpx 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(226, 100, 63, 0.28);
		background: rgba(226, 100, 63, 0.07);
	}

	.ci-warn__txt {
		font-size: 22rpx;
		line-height: 1.65;
		color: rgba(240, 176, 140, 0.86);
	}

	.ci-foot-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		padding: 20rpx 36rpx calc(24rpx + env(safe-area-inset-bottom));
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(17, 13, 11, 0.94);
	}

	/* ==================== 绑定邀请落地 s16 ==================== */

	.il-wrap {
		padding-top: 28rpx;
		text-align: center;
	}

	.il-card {
		padding: 44rpx 36rpx;
		border-radius: 38rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.28);
		background: linear-gradient(155deg, rgba(226, 124, 78, 0.16), rgba(255, 255, 255, 0.03));
	}

	.il-loading {
		font-size: 25rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.il-av {
		width: 136rpx;
		height: 136rpx;
		margin: 0 auto;
		border-radius: 50%;
		border: 3rpx solid rgba(255, 240, 226, 0.55);
		background: linear-gradient(135deg, #D9B08A, #9A6347);
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
		color: #FFF7EC;
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
		color: rgba(245, 237, 228, 0.58);
	}

	.il-code-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 28rpx;
		height: 56rpx;
		padding: 0 28rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.40);
		background: rgba(17, 13, 11, 0.55);
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
		background: rgba(226, 100, 63, 0.12);
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
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.028);
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
		color: rgba(245, 237, 228, 0.78);
		line-height: 1.5;
	}

	.il-acts {
		margin-top: 38rpx;
		display: flex;
		flex-direction: column;
		gap: 20rpx;
	}

	/* ==================== 未绑定 6 位绑定码 s15 ==================== */

	.cb-card {
		padding: 36rpx 28rpx 32rpx;
		border-radius: 34rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: linear-gradient(135deg, rgba(226, 124, 78, 0.14), rgba(255, 255, 255, 0.03));
		text-align: center;
	}

	.cb-kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.78);
	}

	.cb-code {
		display: block;
		margin-top: 22rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 64rpx;
		letter-spacing: 12rpx;
		color: var(--noir-text-strong);
		font-weight: 600;
		line-height: 1.15;
	}

	.cb-meta {
		display: block;
		margin-top: 16rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.48);
	}

	.cb-acts {
		display: flex;
		gap: 16rpx;
		margin-top: 28rpx;
	}

	.cb-acts .cp-btn {
		flex: 1;
		height: 76rpx;
	}

	.cp-share-btn {
		margin: 0;
		padding: 0;
		line-height: 1;
	}

	.cp-share-btn::after {
		border: none;
	}

	.cb-div {
		display: flex;
		align-items: center;
		gap: 20rpx;
		margin: 36rpx 0 28rpx;
	}

	.cb-div__line {
		flex: 1;
		height: 1rpx;
		background: rgba(255, 255, 255, 0.08);
	}

	.cb-div__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.40);
	}

	.cb-label {
		display: block;
		margin-bottom: 18rpx;
		font-size: 24rpx;
		color: rgba(216, 176, 140, 0.78);
	}

	.cb-slots-wrap {
		position: relative;
	}

	.cb-slots {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 14rpx;
	}

	.cb-slot {
		height: 94rpx;
		border-radius: 22rpx;
		border: 1.5rpx solid rgba(216, 176, 140, 0.36);
		background: rgba(255, 255, 255, 0.04);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cb-slot--empty {
		border-color: rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.025);
	}

	.cb-slot--active {
		border-color: var(--noir-coral);
		box-shadow: 0 0 0 3rpx rgba(226, 100, 63, 0.22);
	}

	.cb-slot__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 40rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.cb-slot--empty .cb-slot__txt {
		color: rgba(245, 237, 228, 0.20);
	}

	.cb-hidden-input {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 94rpx;
		opacity: 0;
		z-index: 2;
	}

	.cb-error {
		display: block;
		margin-top: 14rpx;
		font-size: 22rpx;
		color: #F08A6C;
	}

	.cb-submit {
		margin-top: 30rpx;
	}

	.cb-reward {
		margin-top: 28rpx;
		padding: 20rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(132, 190, 156, 0.28);
		background: rgba(132, 190, 156, 0.07);
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
		border: 1.5rpx solid rgba(216, 176, 140, 0.34);
		background: linear-gradient(135deg, #D9B08A, #9A6347);
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
		color: #FFF6EC;
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
		color: rgba(245, 237, 228, 0.46);
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
		border: 1rpx solid rgba(132, 190, 156, 0.38);
		background: rgba(132, 190, 156, 0.14);
	}

	.cp-tag--green .cp-tag__txt {
		color: var(--noir-green);
	}

	.cp-tag--coral {
		border: 1rpx solid var(--noir-border-coral);
		background: rgba(226, 100, 63, 0.16);
	}

	.cp-tag--coral .cp-tag__txt {
		color: var(--noir-coral-light);
	}

	.cp-tag--gold {
		border: 1rpx solid rgba(216, 176, 140, 0.40);
		background: rgba(216, 176, 140, 0.14);
	}

	.cp-tag--gold .cp-tag__txt {
		color: var(--noir-gold-soft);
	}

	.cp-tag--muted {
		border: 1rpx solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.05);
	}

	.cp-tag--muted .cp-tag__txt {
		color: rgba(245, 237, 228, 0.56);
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
		box-shadow: 0 12rpx 26rpx rgba(222, 95, 60, 0.26);
	}

	.cp-btn--ghost {
		border: 1rpx solid rgba(216, 176, 140, 0.36);
		background: rgba(216, 176, 140, 0.08);
	}

	.cp-btn--danger {
		border: 1rpx solid rgba(226, 100, 63, 0.46);
		background: rgba(226, 100, 63, 0.14);
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
		color: #F5A384;
	}

	.ad-view {
		margin-top: 32rpx;
	}
</style>
