<template>
	<view class="love-page love-page--compact">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<view class="records-head">
				<text class="love-title-block__eyebrow">聚会游戏</text>
				<text class="love-title-block__title">游戏战绩</text>
				<text class="love-title-block__desc">每一局结束后自动记录，试试看你的胜率如何。</text>
			</view>

			<love-auth-required
				v-if="!isLoggedIn"
				class="records-auth"
				title="登录后查看战绩"
				desc="战绩保存在云端，登录后会同步你在各个设备上的对局记录。"
				login-text="前往登录"
				@login="handleLogin"
			></love-auth-required>

			<template v-else>
				<fui-segmented-control
					:values="filterLabels"
					:current="filterIndex"
					type="button"
					color="#ec7558"
					active-color="#ffffff"
					:height="70"
					:size="25"
					:radius="999"
					:bold="true"
					:margin-bottom="18"
					@click="handleFilterChange"
				></fui-segmented-control>

				<view v-if="loading && !records.length" class="records-tip">
					<text class="records-tip__text">正在加载…</text>
				</view>

				<view v-else-if="!records.length" class="records-tip">
					<text class="records-tip__title">还没有战绩</text>
					<text class="records-tip__desc">去大厅开一局，结束后这里就会自动出现记录</text>
					<fui-button
						text="去玩一局"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						height="80rpx"
						radius="999rpx"
						:size="28"
						:margin="['24rpx', '0', '0', '0']"
						@click="handleGoHall"
					/>
				</view>

				<view v-else class="records-list">
					<view
						v-for="item in records"
						:key="item.recordId"
						class="record-card"
						@click="handleOpenDetail(item)"
					>
						<view class="record-card__top">
							<view class="record-card__icon" :style="{ background: gradientOf(item.gameType) }">
								<love-game-icon :game-type="item.gameType" :size="54" />
							</view>
							<view class="record-card__head">
								<text class="record-card__title">{{ titleOf(item.gameType) }}</text>
								<text class="record-card__time">{{ formatTime(item.createTime) }}</text>
							</view>
<view class="record-card__badge-wrap">
							<uni-tag
								:text="resultText(item)"
								size="small"
								:custom-style="resultTagStyle(item)"
							></uni-tag>
						</view>
						</view>

						<text class="record-card__summary">{{ item.summary }}</text>

						<view class="record-card__meta">
							<text class="record-card__meta-item">{{ item.playerCount }} 人</text>
							<text class="record-card__meta-item">{{ formatDuration(item.duration) }}</text>
							<text v-if="roleText(item)" class="record-card__meta-item record-card__meta-item--role">
								{{ roleText(item) }}
							</text>
						</view>
					</view>

					<view class="records-more">
						<text class="records-more__text">
							{{ hasMore ? '上拉加载更多' : '没有更多了' }}
						</text>
					</view>
				</view>
			</template>
		</view>

		<fui-bottom-popup
			:show="detailVisible"
			:radius="'32rpx'"
			:mask-closable="true"
			:safe-area="true"
			@close="detailVisible = false"
		>
			<view class="record-detail">
				<text class="record-detail__title">{{ detailTitle }}</text>
				<text class="record-detail__summary">{{ detailSummary }}</text>

				<view v-if="detailLines.length" class="record-detail__lines">
					<view v-for="(line, index) in detailLines" :key="index" class="record-detail__line">
						<text class="record-detail__line-label">{{ line.label }}</text>
						<text class="record-detail__line-value">{{ line.value }}</text>
					</view>
				</view>

				<view v-if="detailPlayers.length" class="record-detail__players">
					<view
						v-for="(player, index) in detailPlayers"
						:key="index"
						class="record-detail__player"
						:class="{ 'record-detail__player--self': player.isSelf }"
					>
						<view class="record-detail__avatar">
							<image
								v-if="player.avatarUrl"
								class="record-detail__avatar-img"
								:src="player.avatarUrl"
								mode="aspectFill"
							></image>
							<text v-else class="record-detail__avatar-text">{{ (player.nickname || '玩').slice(0, 1) }}</text>
						</view>
						<view class="record-detail__player-body">
							<text class="record-detail__player-name">
								{{ player.nickname || '玩家' }}<text v-if="player.isSelf" class="record-detail__self">（我）</text>
							</text>
							<text class="record-detail__player-role">
								{{ player.roleText }}{{ player.isRobot ? ' · 机器人' : '' }}
							</text>
						</view>
						<text
							class="record-detail__player-score"
							:class="{
								'record-detail__player-score--win': player.result === 'win',
								'record-detail__player-score--lose': player.result === 'lose'
							}"
						>{{ player.scoreText }}</text>
					</view>
				</view>

				<view class="record-detail__footer">
					<fui-button
						text="关闭"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						height="84rpx"
						radius="999rpx"
						:size="29"
						:bold="true"
						@click="detailVisible = false"
					/>
				</view>
			</view>
		</fui-bottom-popup>
	</view>
</template>

<script>
	import LoveAuthRequired from '@/components/love-auth-required/love-auth-required.vue'
	import LoveGameIcon from '@/components/love-game-icon/love-game-icon.vue'
	import { getGameApi, assertGameResult } from '@/common/api/game.js'
	import { getGameMeta } from '@/common/game/rules.js'
	import {
		normalizeGameRecordList,
		formatGameTime,
		formatGameDuration,
		getRoleText,
		getResultText
	} from '@/store/modules/game.js'
	import { useAppStateStore } from '@/store/app-state.js'
	import { hasValidLogin } from '@/common/auth-center.js'
	import { openLoginModal } from '@/common/auth-modal.js'

	const FILTERS = [
		{ label: '全部', value: '' },
		{ label: '卧底', value: 'undercover' },
		{ label: '斗地主', value: 'landlord' },
		{ label: '炸弹', value: 'bomb' }
	]

	export default {
		components: {
			LoveAuthRequired,
			LoveGameIcon
		},
		data() {
			return {
				appStateStore: null,
				isLoggedIn: false,
				filterIndex: 0,
				records: [],
				page: 1,
				pageSize: 10,
				hasMore: false,
				loading: false,
				detailVisible: false,
				detail: null
			}
		},
		computed: {
			filterLabels() {
				return FILTERS.map((item) => item.label)
			},
			currentFilter() {
				const filter = FILTERS[this.filterIndex] || FILTERS[0]
				return filter.value
			},
			detailTitle() {
				return this.detail ? this.titleOf(this.detail.gameType) : '战绩详情'
			},
			detailSummary() {
				return this.detail ? this.detail.summary : ''
			},
			detailLines() {
				if (!this.detail) {
					return []
				}
				const lines = [
					{ label: '对局时间', value: formatGameTime(this.detail.createTime) },
					{ label: '参与人数', value: `${this.detail.playerCount} 人` },
					{ label: '对局时长', value: formatGameDuration(this.detail.duration) }
				]
				if (this.detail.roundCount > 1) {
					lines.push({ label: '进行轮次', value: `${this.detail.roundCount} 轮` })
				}
				const extra = this.detail.detail || {}
				if (extra.civilianWord) {
					lines.push({ label: '平民词 / 卧底词', value: `${extra.civilianWord} / ${extra.undercoverWord}` })
				}
				if (extra.multiplier) {
					lines.push({ label: '倍数', value: `${extra.multiplier} 倍` })
				}
				if (extra.rangeLimit) {
					lines.push({ label: '数字范围', value: `1 ~ ${extra.rangeLimit}` })
				}
				if (extra.guessCount) {
					lines.push({ label: '猜测次数', value: `${extra.guessCount} 次` })
				}
				return lines
			},
			detailPlayers() {
				if (!this.detail || !Array.isArray(this.detail.players)) {
					return []
				}
				return this.detail.players.map((item) => ({
					nickname: item.nickname,
					avatarUrl: item.avatarUrl,
					roleText: getRoleText(this.detail.gameType, item.role) || (item.result === 'win' ? '胜' : '负'),
					scoreText: item.scoreDelta > 0 ? `+${item.scoreDelta}` : String(item.scoreDelta || 0),
					result: item.result,
					isSelf: item.isSelf,
					isRobot: item.isRobot
				}))
			}
		},
		onLoad() {
			this.ensureAppStateStore()
			this.syncLoginState()
			this.reload()
		},
		onShow() {
			this.syncLoginState()
		},
		onPullDownRefresh() {
			this.reload().finally(() => {
				uni.stopPullDownRefresh()
			})
		},
		onReachBottom() {
			this.loadMore()
		},
		methods: {
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			syncLoginState() {
				const userInfo = this.appStateStore ? this.appStateStore.userInfo : null
				this.isLoggedIn = Boolean(userInfo && userInfo._id) || hasValidLogin()
			},
			handleLogin() {
				openLoginModal({
					reason: '登录后查看你的游戏战绩'
				})
			},
			handleGoHall() {
				uni.navigateTo({
					url: '/pages/game/index'
				})
			},
			titleOf(gameType) {
				const meta = getGameMeta(gameType)
				return meta ? meta.title : '对局'
			},
			gradientOf(gameType) {
				const meta = getGameMeta(gameType)
				return meta ? meta.gradient : 'linear-gradient(135deg, #ffb37a 0%, #e76f51 100%)'
			},
			resultText(item) {
				return getResultText(item.myResult)
			},
			/**
			 * 战绩卡的胜负标签样式。外观全部交给 uni-tag（见其自带色板是冷色，
			 * 这里用 customStyle 换成项目暖色调；定位/收缩交给外层 .record-card__badge-wrap）。
			 * 注意 border-color 必须一起覆盖，否则会露出 uni-tag 自带的灰边。
			 */
			resultTagStyle(item) {
				const palette = {
					win: { bg: 'rgba(255, 226, 205, 0.98)', color: '#c0674d' },
					lose: { bg: 'rgba(226, 241, 233, 0.98)', color: '#6a8f7b' }
				}
				const tone = palette[item.myResult] || { bg: 'rgba(240, 240, 240, 0.98)', color: '#a07d71' }
				return [
					'display:inline-block',
					'padding:8rpx 20rpx',
					'border-radius:999rpx',
					'font-size:24rpx',
					'font-weight:700',
					`background-color:${tone.bg}`,
					`border-color:${tone.bg}`,
					`color:${tone.color}`
				].join(';')
			},
			roleText(item) {
				return getRoleText(item.gameType, item.myRole)
			},
			formatTime(timestamp) {
				return formatGameTime(timestamp)
			},
			formatDuration(duration) {
				return formatGameDuration(duration)
			},
			handleFilterChange(event = {}) {
				const index = Number(event.index)
				if (!Number.isInteger(index) || index === this.filterIndex) {
					return
				}
				this.filterIndex = index
				this.reload()
			},
			async fetchRecords({ append = false } = {}) {
				if (this.loading || !this.isLoggedIn) {
					return
				}
				this.loading = true
				try {
					const result = assertGameResult(
						await getGameApi().getRecords({
							gameType: this.currentFilter,
							page: this.page,
							pageSize: this.pageSize
						}),
						'获取战绩失败'
					)
					const data = result.data || {}
					const list = normalizeGameRecordList(data.list || [])
					this.records = append ? this.records.concat(list) : list
					this.hasMore = Boolean(data.pagination && data.pagination.hasMore)
				} catch (error) {
					console.warn('fetchRecords failed', error)
					if (!append) {
						this.records = []
					}
					uni.showToast({
						title: error.message || '获取战绩失败',
						icon: 'none'
					})
				} finally {
					this.loading = false
				}
			},
			async reload() {
				this.page = 1
				await this.fetchRecords({ append: false })
			},
			async loadMore() {
				if (!this.hasMore || this.loading) {
					return
				}
				this.page += 1
				await this.fetchRecords({ append: true })
			},
			async handleOpenDetail(item) {
				if (!item || !item.recordId) {
					return
				}
				uni.showLoading({
					title: '加载中',
					mask: true
				})
				try {
					const result = assertGameResult(
						await getGameApi().getRecordDetail({ recordId: item.recordId }),
						'获取战绩详情失败'
					)
					this.detail = (result.data || {}).detail || null
					this.detailVisible = Boolean(this.detail)
				} catch (error) {
					uni.showToast({
						title: error.message || '获取战绩详情失败',
						icon: 'none'
					})
				} finally {
					uni.hideLoading()
				}
			}
		}
	}
</script>

<style>
	.records-head {
		padding: 20rpx 8rpx 30rpx;
	}

	.records-auth {
		margin-top: 10rpx;
	}

	.records-tip {
		margin-top: 40rpx;
		padding: 60rpx 30rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
		text-align: center;
	}

	.records-tip__title {
		display: block;
		font-size: 30rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.records-tip__text {
		font-size: 25rpx;
		color: #917165;
	}

	.records-tip__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 24rpx;
		line-height: 1.7;
		color: #8f6e63;
	}

	.records-list {
		margin-top: 6rpx;
	}

	.record-card {
		padding: 26rpx 28rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
	}

	.record-card + .record-card {
		margin-top: 18rpx;
	}

	.record-card__top {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.record-card__icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 68rpx;
		height: 68rpx;
		border-radius: 20rpx;
	}

	.record-card__head {
		flex: 1;
		min-width: 0;
	}

	.record-card__title {
		display: block;
		font-size: 29rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.record-card__time {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: #b0a09a;
	}

	/* 胜负标签：外观交给 uni-tag（见 methods resultTagStyle），这里只保留 flex 收缩约束 */
	.record-card__badge-wrap {
		flex-shrink: 0;
	}

	.record-card__summary {
		display: block;
		margin-top: 18rpx;
		font-size: 26rpx;
		line-height: 1.7;
		color: #6d473a;
	}

	.record-card__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 16rpx;
		margin-top: 16rpx;
	}

	.record-card__meta-item {
		font-size: 22rpx;
		color: #a07d71;
	}

	.record-card__meta-item--role {
		color: #c0674d;
	}

	.records-more {
		padding: 28rpx 0 10rpx;
		text-align: center;
	}

	.records-more__text {
		font-size: 23rpx;
		color: #b0a09a;
	}

	/* ---------- 详情 ---------- */

	.record-detail {
		padding: 28rpx 32rpx 24rpx;
		background: #ffffff;
	}

	.record-detail__title {
		display: block;
		font-size: 38rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.record-detail__summary {
		display: block;
		margin-top: 12rpx;
		font-size: 25rpx;
		line-height: 1.7;
		color: #8b6659;
	}

	.record-detail__lines {
		margin-top: 22rpx;
		padding: 18rpx 24rpx;
		border-radius: 26rpx;
		background: rgba(255, 247, 241, 0.98);
	}

	.record-detail__line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10rpx 0;
	}

	.record-detail__line-label {
		font-size: 24rpx;
		color: #917165;
	}

	.record-detail__line-value {
		font-size: 26rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.record-detail__players {
		margin-top: 22rpx;
	}

	.record-detail__player {
		display: flex;
		align-items: center;
		gap: 16rpx;
		padding: 16rpx 20rpx;
		border-radius: 24rpx;
		background: rgba(255, 251, 248, 0.98);
	}

	.record-detail__player + .record-detail__player {
		margin-top: 12rpx;
	}

	.record-detail__player--self {
		background: rgba(255, 240, 232, 0.98);
	}

	.record-detail__avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 60rpx;
		height: 60rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ffb37a 0%, #e76f51 100%);
		overflow: hidden;
	}

	.record-detail__avatar-img {
		width: 100%;
		height: 100%;
	}

	.record-detail__avatar-text {
		font-size: 24rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.record-detail__player-body {
		flex: 1;
		min-width: 0;
	}

	.record-detail__player-name {
		display: block;
		font-size: 26rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.record-detail__self {
		font-size: 21rpx;
		font-weight: 400;
		color: #b8604c;
	}

	.record-detail__player-role {
		display: block;
		margin-top: 4rpx;
		font-size: 21rpx;
		color: #a07d71;
	}

	.record-detail__player-score {
		font-size: 26rpx;
		font-weight: 700;
		color: #a07d71;
	}

	.record-detail__player-score--win {
		color: #c0674d;
	}

	.record-detail__player-score--lose {
		color: #6a8f7b;
	}

	.record-detail__footer {
		margin-top: 26rpx;
	}
</style>
