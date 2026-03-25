<template>
	<view class="love-page love-page--compact couple-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">

			<view class="love-title-block couple-title-block">
				<text class="love-title-block__eyebrow">LOVE NOTE</text>
				<text class="love-title-block__title">情侣绑定</text>
				<text class="love-title-block__desc">{{ overviewDesc }}</text>
				<view class="couple-title-block__status">
					<fui-tag
						:text="relationStatusText"
						:is-border="false"
						background="rgba(255, 237, 231, 0.96)"
						color="#c0634d"
						radius="999"
						:padding="['12rpx', '22rpx']"
					></fui-tag>
					<text class="couple-title-block__count">{{ titleBlockCountText }}</text>
				</view>
			</view>

			<love-auth-required
				v-if="!isLoggedIn"
				desc="情侣信息页需要登录后才能查看和操作，登录后可继续发起绑定、处理请求与查看历史记录。"
				secondary-text="返回个人中心"
				@login="goToLoginPage"
				@secondary="backToProfile"
			></love-auth-required>

			<view v-else class="couple-page__body">
				<love-glass-card
					title="我的信息"
					:margin="['0', '0', '0', '0']"
				>
					<love-relation-bar
						class="self-card"
						:primary-avatar="selfInfo.avatarUrl || DEFAULT_AVATAR"
						:secondary-avatar="activeCouple && activeCouple.partnerAvatarUrl ? activeCouple.partnerAvatarUrl : ''"
						:primary-gender="Number(selfInfo.gender || 0)"
						:secondary-gender="Number(activeCouple && activeCouple.partnerGender || 0)"
						secondary-placeholder="TA"
						:title="selfRelationTitle"
						:badge-text="selfStatusBadgeText"
						:desc="selfStatusBarDesc"
						:borderless="true"
						:avatar-size="112"
						:title-size="36"
						:desc-size="23"
					></love-relation-bar>

					<view class="relation-stats">
						<view v-for="item in relationshipOverviewStats" :key="item.label" class="relation-stats__item">
							<text class="relation-stats__value">{{ item.value }}</text>
							<text class="relation-stats__label">{{ item.label }}</text>
						</view>
					</view>

					<view class="info-panel">
						<fui-list-cell
							:padding="['20rpx', '0']"
							background="transparent"
							:highlight="false"
							:bottom-border="false"
						>
							<view class="info-row">
								<view class="info-row__body">
									<text class="info-row__label">用户 ID</text>
									<text class="info-row__value info-row__value--compact">{{ selfMetaValue }}</text>
									<text v-if="selfMetaHint" class="info-row__hint">{{ selfMetaHint }}</text>
								</view>
								<fui-button
									text="复制"
									width="144rpx"
									height="60rpx"
									:size="22"
									radius="999rpx"
									background="rgba(255, 239, 231, 0.98)"
									color="#be6f59"
									border-color="rgba(223, 160, 140, 0.28)"
									@click="copySelfUid"
								></fui-button>
							</view>
						</fui-list-cell>
					</view>
				</love-glass-card>

				<love-glass-card
					v-if="activeCouple"
					title="绑定信息"
					tag="已绑定"
					:margin="['24rpx', '0', '0', '0']"
				>
					<love-relation-bar
						class="relation-card"
						:primary-avatar="selfInfo.avatarUrl || DEFAULT_AVATAR"
						:secondary-avatar="activeCouple.partnerAvatarUrl || DEFAULT_AVATAR"
						:primary-gender="Number(selfInfo.gender || 0)"
						:secondary-gender="Number(activeCouple && activeCouple.partnerGender || 0)"
						:title="activeRelationTitle"
						badge-text="关系进行中"
						:desc="activeRelationDesc"
						:borderless="true"
						:avatar-size="108"
						:title-size="36"
						:desc-size="23"
					></love-relation-bar>

					<view class="info-panel info-panel--relation">
						<fui-list-cell
							:padding="['20rpx', '0']"
							background="transparent"
							:border-color="'rgba(231, 204, 194, 0.62)'"
						>
							<view class="info-row">
								<view class="info-row__body">
									<text class="info-row__label">对方 ID</text>
									<text class="info-row__value">{{ activeCouple.partnerUidMasked }}</text>
								</view>
							</view>
						</fui-list-cell>
						<fui-list-cell
							:padding="['20rpx', '0']"
							background="transparent"
							:bottom-border="false"
						>
							<view class="info-row">
								<view class="info-row__body">
									<text class="info-row__label">绑定时间</text>
									<text class="info-row__value">{{ formatDateTime(activeCouple.bindDate) }}</text>
								</view>
							</view>
						</fui-list-cell>
					</view>

					<view class="love-soft-notice relation-card__notice">
						<text class="love-muted-text">一次只能维持一个绑定关系。如果要与其他人重新绑定，请先解除当前关系。</text>
					</view>

					<fui-button
						text="解绑当前关系"
						background="rgba(255, 239, 233, 0.98)"
						color="#ca5d43"
						border-color="rgba(223, 122, 94, 0.28)"
						radius="999rpx"
						height="84rpx"
						:size="26"
						:bold="true"
						:margin="['26rpx', '0', '0', '0']"
						:loading="actionLoading === 'unbind'"
						@click="handleUnbind"
					></fui-button>
				</love-glass-card>

				<love-glass-card
					v-else
					title="发起绑定"
					:margin="['24rpx', '0', '0', '0']"
				>
					<view class="request-form">
						<text class="request-form__desc">把上方“我的 ID”发给另一半，或直接在这里输入对方的 ID 发起绑定请求。</text>

						<view class="love-form-item">
							<text class="love-field-label">对方用户 ID</text>
							<fui-input
								:value="targetUid"
								type="text"
								placeholder="请输入对方的用户 ID"
								background-color="#fff7f3"
								:border-bottom="false"
								:padding="['28rpx', '24rpx']"
								:radius="26"
								:size="28"
								color="#5a3427"
								maxlength="64"
								@input="onTargetUidInput"
								@blur="onTargetUidBlur"
							></fui-input>
							<text v-if="targetUidError" class="request-form__error">{{ targetUidError }}</text>
							<text class="love-field-tip">{{ requestFormTipText }}</text>
						</view>

						<view class="love-action-stack request-form__actions">
							<fui-button
								text="发送绑定请求"
								background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
								color="#ffffff"
								radius="999rpx"
								height="88rpx"
								:size="28"
								:bold="true"
								:disabled="!canSendRequest"
								:loading="actionLoading === 'send'"
								@click="handleSendRequest"
							></fui-button>
						</view>
					</view>
				</love-glass-card>

				<love-glass-card
					title="请求与记录"
					:tag="activeTabCountText"
					:margin="['24rpx', '0', '0', '0']"
				>
					<fui-segmented-control
						:values="requestTabOptions"
						:current="activeTabIndex"
						color="#ec7558"
						active-color="#ffffff"
						:height="72"
						:size="24"
						:bold="true"
						:radius="999"
						@click="handleTabChange"
					></fui-segmented-control>

					<fui-divider
						:text="activeTabTitle"
						width="100%"
						height="54"
						divider-color="rgba(231, 204, 194, 0.7)"
						color="#b36a56"
						:size="22"
					></fui-divider>

					<text class="records-card__desc">{{ activeTabDesc }}</text>

					<view v-if="activeTabKey === 'incoming'" class="records-card__body">
						<view v-if="incomingRequests.length" class="records-list">
							<fui-list-cell
								v-for="(item, index) in incomingRequests"
								:key="item.requestId"
								:padding="['24rpx', '0']"
								background="transparent"
								:border-color="'rgba(231, 204, 194, 0.62)'"
								:bottom-border="index !== incomingRequests.length - 1"
							>
								<view class="request-item">
									<view class="request-item__main">
										<fui-avatar
											:src="item.partnerAvatarUrl || DEFAULT_AVATAR"
											error-src="/static/user-empty.png"
											width="84"
											height="84"
											background="#fff1eb"
										></fui-avatar>
										<view class="request-item__body">
											<view class="request-item__head">
												<text class="request-item__name">{{ item.partnerNicknameMasked }}</text>
												<fui-tag
													text="待处理"
													:is-border="false"
													background="rgba(255, 241, 235, 0.98)"
													color="#c4684f"
													radius="999"
													:padding="['8rpx', '16rpx']"
												></fui-tag>
											</view>
											<text class="request-item__meta">对方 ID：{{ item.partnerUidMasked }}</text>
											<text class="request-item__meta">发起时间：{{ formatDateTime(item.createdAt) }}</text>
										</view>
									</view>
									<view class="request-item__actions">
										<fui-button
											text="拒绝"
											background="rgba(255, 239, 231, 0.98)"
											color="#be6f59"
											border-color="rgba(223, 160, 140, 0.28)"
											radius="999rpx"
											height="72rpx"
											:size="24"
											width="180rpx"
											:loading="actionLoading === `reject-${item.requestId}`"
											@click="handleReviewRequest(item, 'reject')"
										></fui-button>
										<fui-button
											text="确认绑定"
											background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
											color="#ffffff"
											radius="999rpx"
											height="72rpx"
											:size="24"
											width="180rpx"
											:loading="actionLoading === `accept-${item.requestId}`"
											@click="handleReviewRequest(item, 'accept')"
										></fui-button>
									</view>
								</view>
							</fui-list-cell>
						</view>
						<view v-else class="records-empty">
							<fui-empty
								title="暂无待处理请求"
								descr="收到新的绑定邀请后，会在这里显示。"
								:size="28"
								descr-size="22"
								color="#6e4a3f"
								descr-color="#9a766c"
								:margin-top="12"
							></fui-empty>
						</view>
					</view>

					<view v-else-if="activeTabKey === 'outgoing'" class="records-card__body">
						<view v-if="outgoingRequests.length" class="records-list">
							<fui-list-cell
								v-for="(item, index) in outgoingRequests"
								:key="item.requestId"
								:padding="['24rpx', '0']"
								background="transparent"
								:border-color="'rgba(231, 204, 194, 0.62)'"
								:bottom-border="index !== outgoingRequests.length - 1"
							>
								<view class="request-item">
									<view class="request-item__main">
										<fui-avatar
											:src="item.partnerAvatarUrl || DEFAULT_AVATAR"
											error-src="/static/user-empty.png"
											width="84"
											height="84"
											background="#fff1eb"
										></fui-avatar>
										<view class="request-item__body">
											<view class="request-item__head">
												<text class="request-item__name">{{ item.partnerNicknameMasked }}</text>
												<fui-tag
													text="待回应"
													:is-border="false"
													background="rgba(255, 246, 241, 0.98)"
													color="#b97862"
													radius="999"
													:padding="['8rpx', '16rpx']"
												></fui-tag>
											</view>
											<text class="request-item__meta">对方 ID：{{ item.partnerUidMasked }}</text>
											<text class="request-item__meta">发起时间：{{ formatDateTime(item.createdAt) }}</text>
										</view>
									</view>
									<view class="request-item__actions request-item__actions--single">
										<fui-button
											text="撤回"
											width="156rpx"
											height="60rpx"
											:size="22"
											radius="999rpx"
											background="rgba(255, 239, 231, 0.98)"
											color="#be6f59"
											border-color="rgba(223, 160, 140, 0.28)"
											:loading="actionLoading === `cancel-${item.requestId}`"
											@click="handleCancelRequest(item)"
										></fui-button>
									</view>
								</view>
							</fui-list-cell>
						</view>
						<view v-else class="records-empty">
							<fui-empty
								title="暂无已发出的请求"
								descr="主动发送的绑定请求会在这里展示，也可以随时撤回。"
								:size="28"
								descr-size="22"
								color="#6e4a3f"
								descr-color="#9a766c"
								:margin-top="12"
							></fui-empty>
						</view>
					</view>

					<view v-else class="records-card__body">
						<view v-if="historyList.length" class="records-list">
							<fui-list-cell
								v-for="(item, index) in historyList"
								:key="item.relationId"
								:padding="['24rpx', '0']"
								background="transparent"
								:border-color="'rgba(231, 204, 194, 0.62)'"
								:bottom-border="index !== historyList.length - 1"
							>
								<view class="history-item">
									<fui-avatar
										:src="item.partnerAvatarUrl || DEFAULT_AVATAR"
										error-src="/static/user-empty.png"
										width="76"
										height="76"
										background="#fff1eb"
									></fui-avatar>
									<view class="history-item__body">
										<view class="history-item__head">
											<text class="history-item__name">{{ item.partnerNicknameMasked }}</text>
											<fui-tag
												:text="item.statusText || '已处理'"
												:is-border="false"
												:background="getHistoryTagStyle(item.statusText).background"
												:color="getHistoryTagStyle(item.statusText).color"
												radius="999"
												:padding="['8rpx', '16rpx']"
											></fui-tag>
										</view>
										<text class="history-item__meta">对方 ID：{{ item.partnerUidMasked }}</text>
										<text class="history-item__meta">{{ formatHistoryPeriod(item) }}</text>
									</view>
								</view>
							</fui-list-cell>
						</view>
						<view v-else class="records-empty">
							<fui-empty
								title="暂无绑定记录"
								descr="成功绑定或解绑之后，历史记录会保留在这里。"
								:size="28"
								descr-size="22"
								color="#6e4a3f"
								descr-color="#9a766c"
								:margin-top="12"
							></fui-empty>
						</view>
					</view>
				</love-glass-card>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		DEFAULT_AVATAR,
		clearUniIdTokenStorage,
		getAuthCenterObject,
		getCurrentUniIdUser,
		subscribeAuthChanged
	} from '../../common/auth-center.js'
	import LoveRelationBar from '../../components/love-relation-bar/love-relation-bar.vue'

	const TAB_KEYS = ['incoming', 'outgoing', 'history']

	function getDefaultCenterData() {
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

	export default {
		components: {
			LoveRelationBar
		},
		data() {
			return {
				DEFAULT_AVATAR,
				actionLoading: '',
				activeTabIndex: 0,
				removeAuthListener: null,
				targetUid: '',
				targetUidError: '',
				centerData: getDefaultCenterData()
			}
		},
		computed: {
			isLoggedIn() {
				const currentUserInfo = getCurrentUniIdUser()
				return Boolean(currentUserInfo && currentUserInfo.uid)
			},
			selfInfo() {
				return this.centerData.selfInfo || {}
			},
			activeCouple() {
				return this.centerData.activeCouple || null
			},
			incomingRequests() {
				return Array.isArray(this.centerData.incomingRequests) ? this.centerData.incomingRequests : []
			},
			outgoingRequests() {
				return Array.isArray(this.centerData.outgoingRequests) ? this.centerData.outgoingRequests : []
			},
			historyList() {
				return Array.isArray(this.centerData.historyList) ? this.centerData.historyList : []
			},
			canSendRequest() {
				return Boolean(this.centerData.canSendRequest)
			},
			relationStatusText() {
				if (!this.isLoggedIn) {
					return '未登录'
				}

				if (this.activeCouple) {
					return '已绑定'
				}

				if (this.incomingRequests.length) {
					return '待处理'
				}

				if (this.outgoingRequests.length) {
					return '等待回应'
				}

				return '未绑定'
			},
			overviewDesc() {
				if (!this.isLoggedIn) {
					return '登录后即可查看当前情侣关系、处理绑定请求，并查看历史记录。'
				}

				if (this.activeCouple) {
					return `当前已与 ${this.activeCouple.partnerNickname || '另一半'} 完成绑定，可在下方继续管理当前关系。`
				}

				if (this.incomingRequests.length) {
					return `你有 ${this.incomingRequests.length} 条待处理的绑定请求，只能确认其中一个完成绑定。`
				}

				if (this.outgoingRequests.length) {
					return `你已发出 ${this.outgoingRequests.length} 条绑定请求，正在等待对方回应。`
				}

				return '复制自己的 ID 或填写对方 ID，即可开始创建情侣绑定关系。'
			},
			titleBlockCountText() {
				if (!this.isLoggedIn) {
					return '登录后可查看请求与绑定记录'
				}

				return `待处理 ${this.incomingRequests.length} · 已发出 ${this.outgoingRequests.length} · 历史 ${this.historyList.length}`
			},
			selfStatusText() {
				if (this.activeCouple) {
					return '已完成绑定'
				}

				if (this.incomingRequests.length) {
					return '收到新请求'
				}

				if (this.outgoingRequests.length) {
					return '等待对方确认'
				}

				return '可发起绑定'
			},
			selfStatusBadgeText() {
				if (!this.activeCouple && !this.incomingRequests.length && !this.outgoingRequests.length) {
					return ''
				}

				return this.selfStatusText
			},
			selfStatusSummary() {
				if (this.activeCouple) {
					return `已与 ${this.activeCouple.partnerNickname || '另一半'} 建立情侣关系`
				}

				if (this.incomingRequests.length) {
					return `你有 ${this.incomingRequests.length} 条待确认请求，可在下方快速处理`
				}

				if (this.outgoingRequests.length) {
					return `已发送 ${this.outgoingRequests.length} 条请求，等待对方同意`
				}

				return '当前还没有绑定关系，可以复制自己的 ID 或主动发起邀请'
			},
			selfStatusBarDesc() {
				if (this.activeCouple && this.activeCouple.bindDate) {
					return `绑定日期：${formatDateTime(this.activeCouple.bindDate)}`
				}

				return '绑定日期：--'
			},
			selfMetaValue() {
				return `ID：${this.selfInfo.uid || '未获取'}`
			},
			selfMetaHint() {
				return !this.activeCouple && !this.incomingRequests.length && !this.outgoingRequests.length
					? this.selfStatusSummary
					: ''
			},
			selfRelationTitle() {
				const selfName = this.selfInfo.nickname || '微信用户'
				const partnerName = this.activeCouple && this.activeCouple.partnerNickname
					? this.activeCouple.partnerNickname
					: '待绑定'
				return `${selfName} & ${partnerName}`
			},
			activeRelationTitle() {
				if (!this.activeCouple) {
					return this.selfRelationTitle
				}

				const selfName = this.selfInfo.nickname || '微信用户'
				const partnerName = this.activeCouple.partnerNickname || '待绑定'
				return `${selfName} & ${partnerName}`
			},
			activeRelationDesc() {
				if (!this.activeCouple || !this.activeCouple.bindDate) {
					return '已完成绑定'
				}

				return `已绑定于 ${formatDateTime(this.activeCouple.bindDate)}`
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

				if (this.activeCouple) {
					return [{
						label: '共同纪念日',
						value: `${anniversaryCount}`
					}, {
						label: '双人动态',
						value: `${momentCount}`
					}, {
						label: '愿望',
						value: `${wishCount}`
					}]
				}

				return [{
					label: '共同纪念日',
					value: '--'
				}, {
					label: '双人动态',
					value: '0'
				}, {
					label: '愿望',
					value: '0'
				}]
			},
			requestFormTipText() {
				if (this.canSendRequest) {
					return '发送后，对方会在自己的情侣页看到这条待处理请求。'
				}

				if (this.outgoingRequests.length) {
					return '你已经发出过绑定请求，请等待对方确认，或在“我发出”中撤回后再发送新的请求。'
				}

				return '当前状态暂时无法发送新的绑定请求。'
			},
			requestTabOptions() {
				return [{
					name: '待处理'
				}, {
					name: '我发出'
				}, {
					name: this.activeCouple ? '其他记录' : '历史记录'
				}]
			},
			activeTabKey() {
				return TAB_KEYS[this.activeTabIndex] || TAB_KEYS[0]
			},
			activeTabTitle() {
				if (this.activeTabKey === 'outgoing') {
					return '我发出的请求'
				}

				if (this.activeTabKey === 'history') {
					return this.activeCouple ? '其他绑定记录' : '绑定记录'
				}

				return '待处理请求'
			},
			activeTabDesc() {
				if (this.activeTabKey === 'outgoing') {
					return '这里会展示你主动发起的绑定请求，必要时可以直接撤回。'
				}

				if (this.activeTabKey === 'history') {
					return '已经完成或结束的绑定关系会保留在这里，信息会按规则脱敏展示。'
				}

				return '收到的绑定邀请会显示在这里，你只能确认其中一个完成绑定。'
			},
			activeTabCountText() {
				const count = this.getRecordsByKey(this.activeTabKey).length
				return count ? `${count} 条` : ''
			}
		},
		onLoad() {
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
			formatDateTime,
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
			getRecordsByKey(key = 'incoming') {
				if (key === 'outgoing') {
					return this.outgoingRequests
				}

				if (key === 'history') {
					return this.historyList
				}

				return this.incomingRequests
			},
			getHistoryTagStyle(statusText = '') {
				const text = String(statusText || '')
				if (text.includes('解绑')) {
					return {
						background: 'rgba(255, 244, 239, 0.98)',
						color: '#b5715d'
					}
				}

				if (text.includes('取消') || text.includes('关闭')) {
					return {
						background: 'rgba(249, 242, 238, 0.98)',
						color: '#a88478'
					}
				}

				if (text.includes('绑定')) {
					return {
						background: 'rgba(255, 239, 231, 0.98)',
						color: '#c4684f'
					}
				}

				return {
					background: 'rgba(255, 246, 241, 0.98)',
					color: '#b97862'
				}
			},
			handleTabChange(event = {}) {
				const nextIndex = Number(event.index || 0)
				this.activeTabIndex = Number.isNaN(nextIndex) ? 0 : nextIndex
			},
			resetCenterData() {
				this.centerData = getDefaultCenterData()
				this.activeTabIndex = 0
				this.resetTargetForm()
			},
			resetTargetForm() {
				this.targetUid = ''
				this.targetUidError = ''
			},
			syncActiveTabIndex() {
				const recordGroups = [this.incomingRequests, this.outgoingRequests, this.historyList]
				const currentList = recordGroups[this.activeTabIndex]
				if (Array.isArray(currentList) && currentList.length) {
					return
				}

				const nextIndex = recordGroups.findIndex((item) => Array.isArray(item) && item.length)
				this.activeTabIndex = nextIndex === -1 ? 0 : nextIndex
			},
			applyCenterData(result = {}) {
				this.centerData = {
					selfInfo: result.selfInfo || null,
					activeCouple: result.activeCouple || null,
					incomingRequests: Array.isArray(result.incomingRequests) ? result.incomingRequests : [],
					outgoingRequests: Array.isArray(result.outgoingRequests) ? result.outgoingRequests : [],
					historyList: Array.isArray(result.historyList) ? result.historyList : [],
					canSendRequest: Boolean(result.canSendRequest)
				}
				this.syncActiveTabIndex()
			},
			async restoreLoginState() {
				const currentUserInfo = getCurrentUniIdUser()
				if (!currentUserInfo || !currentUserInfo.uid) {
					this.resetCenterData()
					return
				}

				if (currentUserInfo.tokenExpired && currentUserInfo.tokenExpired <= Date.now()) {
					clearUniIdTokenStorage()
					this.resetCenterData()
					return
				}

				await this.fetchCoupleCenter({
					silent: true
				})
			},
			async fetchCoupleCenter({ silent = false } = {}) {
				try {
					const result = await getAuthCenterObject().getCoupleCenter()
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取情侣信息失败')
					}

					this.applyCenterData(result)
				} catch (error) {
					console.warn('couple fetchCoupleCenter failed', error)
					if (!silent) {
						uni.showToast({
							title: error.message || '获取情侣信息失败',
							icon: 'none'
						})
					}
				}
			},
			goToLoginPage() {
				uni.navigateTo({
					url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/couple/index')
				})
			},
			backToProfile() {
				uni.switchTab({
					url: '/pages/profile/index'
				})
			},
			onTargetUidInput(value) {
				this.targetUid = `${value || ''}`.trim()
				if (this.targetUidError) {
					this.targetUidError = ''
				}
			},
			onTargetUidBlur(event) {
				const value = event && event.detail ? event.detail.value : this.targetUid
				this.targetUid = `${value || ''}`.trim()
			},
			validateTargetUid() {
				const value = `${this.targetUid || ''}`.trim()
				if (!value) {
					this.targetUidError = '请输入对方的用户 ID'
					return false
				}

				if (this.selfInfo.uid && value === this.selfInfo.uid) {
					this.targetUidError = '不能向自己发起绑定请求'
					return false
				}

				this.targetUidError = ''
				return true
			},
			copySelfUid() {
				if (!this.selfInfo.uid) {
					uni.showToast({
						title: '当前未获取到用户 ID',
						icon: 'none'
					})
					return
				}

				uni.setClipboardData({
					data: this.selfInfo.uid,
					success: () => {
						uni.showToast({
							title: '复制成功',
							icon: 'success'
						})
					}
				})
			},
			async handleSendRequest() {
				if (this.actionLoading || !this.validateTargetUid()) {
					return
				}

				this.actionLoading = 'send'
				try {
					const result = await getAuthCenterObject().sendCoupleRequest({
						targetUid: this.targetUid
					})
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '发送绑定请求失败')
					}

					this.applyCenterData(result)
					this.resetTargetForm()
					uni.showToast({
						title: result.errMsg || '绑定请求已发送',
						icon: 'success'
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '发送绑定请求失败',
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
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
			async handleReviewRequest(item, action) {
				if (!item || !item.requestId || this.actionLoading) {
					return
				}

				const isAccept = action === 'accept'
				const confirmed = await this.confirmAction({
					title: isAccept ? '确认绑定' : '拒绝请求',
					content: isAccept
						? '确认后会立即完成绑定，并自动关闭其他待处理请求。'
						: '确认后将关闭这条绑定请求。'
				})
				if (!confirmed) {
					return
				}

				this.actionLoading = `${action}-${item.requestId}`
				try {
					const result = await getAuthCenterObject().reviewCoupleRequest({
						requestId: item.requestId,
						action
					})
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '处理绑定请求失败')
					}

					this.applyCenterData(result)
					uni.showToast({
						title: result.errMsg || (isAccept ? '绑定成功' : '已拒绝请求'),
						icon: isAccept ? 'success' : 'none'
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '处理绑定请求失败',
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
				}
			},
			async handleCancelRequest(item) {
				if (!item || !item.requestId || this.actionLoading) {
					return
				}

				const confirmed = await this.confirmAction({
					title: '撤回请求',
					content: '撤回后，对方将不再看到这条待处理请求。'
				})
				if (!confirmed) {
					return
				}

				this.actionLoading = `cancel-${item.requestId}`
				try {
					const result = await getAuthCenterObject().cancelCoupleRequest({
						requestId: item.requestId
					})
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '撤回绑定请求失败')
					}

					this.applyCenterData(result)
					uni.showToast({
						title: result.errMsg || '已撤回绑定请求',
						icon: 'none'
					})
				} catch (error) {
					uni.showToast({
						title: error.message || '撤回绑定请求失败',
						icon: 'none'
					})
				} finally {
					this.actionLoading = ''
				}
			},
			async handleUnbind() {
				if (!this.activeCouple || this.actionLoading) {
					return
				}

				const confirmed = await this.confirmAction({
					title: '解绑当前关系',
					content: '解绑后才能重新绑定其他人，当前绑定关系会保留在历史记录中。'
				})
				if (!confirmed) {
					return
				}

				this.actionLoading = 'unbind'
				try {
					const result = await getAuthCenterObject().unbindCouple({
						relationId: this.activeCouple.coupleId
					})
					if (result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '解绑失败')
					}

					this.applyCenterData(result)
					uni.showToast({
						title: result.errMsg || '已解绑当前情侣关系',
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
			}
		}
	}
</script>

<style>
	.couple-page {
		padding-bottom: calc(52rpx + env(safe-area-inset-bottom));
	}

	.couple-title-block {
		padding-top: 8rpx;
		padding-left: 0;
		padding-right: 0;
	}

	.couple-title-block__status {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 16rpx;
		margin-top: 24rpx;
	}

	.couple-title-block__count {
		font-size: 22rpx;
		line-height: 1.6;
		color: #a37a6f;
	}

	.couple-page__body {
		padding-top: 12rpx;
	}

	.self-card,
	.relation-card {
		background: linear-gradient(180deg, rgba(255, 250, 247, 0.98), rgba(255, 244, 239, 0.72));
	}

	.relation-stats {
		display: flex;
		gap: 18rpx;
		margin-top: 28rpx;
	}

	.relation-stats__item {
		flex: 1;
		padding: 24rpx 18rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.8);
		text-align: center;
	}

	.relation-stats__value {
		display: block;
		font-size: 40rpx;
		font-weight: 700;
		line-height: 1.3;
		color: #8f4f3e;
		word-break: break-all;
	}

	.relation-stats__label {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		line-height: 1.5;
		color: #9a776d;
	}

	.info-panel {
		margin-top: 26rpx;
		padding: 4rpx 22rpx;
		border-radius: 28rpx;
		background: rgba(255, 247, 243, 0.92);
		box-shadow: inset 0 0 0 1rpx rgba(236, 207, 198, 0.7);
		overflow: hidden;
	}

	.info-panel--relation {
		margin-top: 22rpx;
	}

	.info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		width: 100%;
	}

	.info-row__body {
		flex: 1;
		min-width: 0;
	}

	.info-row__label {
		display: block;
		font-size: 22rpx;
		color: #a27a6f;
	}

	.info-row__value {
		display: block;
		margin-top: 8rpx;
		font-size: 26rpx;
		line-height: 1.6;
		color: #5a3427;
		word-break: break-all;
	}

	.info-row__value--compact {
		font-size: 28rpx;
		font-weight: 700;
	}

	.info-row__hint {
		display: block;
		margin-top: 10rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: #8f6a61;
		word-break: break-all;
	}

	.info-row__value--accent {
		color: #c4684f;
	}

	.relation-card__notice {
		margin-top: 24rpx;
	}

	.request-form__intro {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 16rpx;
		padding: 24rpx;
		border-radius: 28rpx;
		background: rgba(255, 248, 244, 0.94);
		box-shadow: inset 0 0 0 1rpx rgba(238, 209, 199, 0.68);
	}

	.request-form__desc {
		font-size: 23rpx;
		line-height: 1.8;
		color: #906b61;
	}

	.request-form .love-form-item {
		margin-top: 24rpx;
	}

	.request-form__error {
		display: block;
		margin-top: 12rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #da5a41;
	}

	.request-form__actions {
		margin-top: 0;
	}

	.records-card__desc {
		display: block;
		margin-top: 16rpx;
		padding: 0 4rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: #976f64;
	}

	.records-card__body {
		margin-top: 20rpx;
	}

	.records-list {
		padding: 4rpx 8rpx;
		border-radius: 26rpx;
		background: rgba(255, 247, 243, 0.86);
		box-shadow: inset 0 0 0 1rpx rgba(236, 209, 199, 0.65);
		overflow: hidden;
	}

	.request-item,
	.history-item {
		width: 100%;
		padding: 2rpx 0;
	}

	.request-item__main,
	.history-item {
		display: flex;
		align-items: flex-start;
		gap: 18rpx;
		width: 100%;
	}

	.request-item__body,
	.history-item__body {
		flex: 1;
		min-width: 0;
	}

	.request-item__head,
	.history-item__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14rpx;
	}

	.request-item__name,
	.history-item__name {
		flex: 1;
		min-width: 0;
		font-size: 28rpx;
		font-weight: 700;
		line-height: 1.5;
		color: #5a3427;
		word-break: break-all;
	}

	.request-item__meta,
	.history-item__meta {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		line-height: 1.6;
		color: #8f6a61;
		word-break: break-all;
	}

	.request-item__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 16rpx;
		margin-top: 22rpx;
	}

	.request-item__actions--single {
		justify-content: flex-end;
	}

	.records-empty {
		padding: 32rpx 0 12rpx;
	}

</style>
