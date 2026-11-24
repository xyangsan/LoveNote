<template>
	<view class="gr-page">
		<view class="gr-glow gr-glow--left"></view>
		<view class="gr-glow gr-glow--right"></view>

		<noir-navbar
			title="游戏战绩"
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		/>

		<view class="gr-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				class="gr-auth"
				title="登录后查看战绩"
				desc="战绩保存在云端，登录后会同步你在各个设备上的对局记录。"
				login-text="前往登录"
				@login="handleLogin"
			></love-auth-required>

			<template v-else>
				<!-- 4 项筛选分段控件（对标 s24） -->
				<view class="gr-seg">
					<view
						v-for="(item, idx) in filters"
						:key="item.value || 'all'"
						class="gr-seg__item"
						:class="{ 'gr-seg__item--on': filterIndex === idx }"
						@tap="handleFilterChange({ index: idx })"
					>
						<text class="gr-seg__txt">{{ item.label }}</text>
					</view>
				</view>

				<view v-if="loading && !records.length" class="gr-tip">
					<text class="gr-tip__text">正在加载战绩…</text>
				</view>

				<view v-else-if="!records.length" class="gr-tip">
					<text class="gr-tip__kicker">GAME RECORDS</text>
					<text class="gr-tip__title">还没有战绩记录</text>
					<text class="gr-tip__desc">去大厅开一局，结束后这里就会自动记录胜负与详情</text>
					<view class="gr-tip__btn" hover-class="gr-btn--hover" @tap="handleGoHall">
						<text class="gr-tip__btn-txt">去玩一局</text>
					</view>
				</view>

				<view v-else class="gr-list">
					<template v-for="entry in displayList" :key="entry.key">
						<view v-if="entry.type === 'ad'" class="gr-ad-card">
							<!-- #ifdef MP-WEIXIN -->
							<ad v-if="entry.adType === 'grid'" unit-id="adunit-7a1e5e50b619b450" ad-theme="black"></ad>
							<ad v-else unit-id="adunit-230be1ed0ea4b29b" ad-theme="black"></ad>
							<!-- #endif -->
						</view>
						<view
							v-else
							class="gr-card"
							hover-class="gr-card--hover"
							@tap="handleOpenDetail(entry.record)"
						>
							<view class="gr-top">
								<view class="gr-top__left">
									<view class="gr-card__icon">
										<love-game-icon :game-type="entry.record.gameType" :size="36" />
									</view>
									<text class="gr-top__title">{{ titleOf(entry.record.gameType) }}</text>
									<text class="gr-top__time">{{ formatTime(entry.record.createTime) }}</text>
								</view>
								<view class="gr-tag" :class="'gr-tag--' + resultTone(entry.record.myResult)">
									<text class="gr-tag__txt">{{ resultText(entry.record) }}</text>
								</view>
							</view>

							<text v-if="entry.record.summary" class="gr-sum">{{ entry.record.summary }}</text>

							<view class="gr-meta">
								<view class="gr-meta__left">
									<text class="gr-meta__item">{{ entry.record.playerCount }} 人</text>
									<text class="gr-meta__item">{{ formatDuration(entry.record.duration) }}</text>
									<text v-if="roleText(entry.record)" class="gr-meta__item gr-meta__item--role">角色：{{ roleText(entry.record) }}</text>
								</view>
								<text class="gr-meta__more">详情 ›</text>
							</view>
						</view>
					</template>

					<view class="gr-more">
						<text class="gr-more__txt">
							{{ loading ? '加载中…' : (hasMore ? '上拉加载更多' : '已展示全部战绩') }}
						</text>
					</view>
				</view>
			</template>
		</view>

		<!-- 底部战绩详情弹层（对标 NOIR v3 s24 .gr-sheet） -->
		<view v-if="detailVisible && detail" class="gr-sheet-wrap" @touchmove.stop.prevent>
			<view class="gr-sheet-mask" @tap="detailVisible = false"></view>
			<view class="gr-sheet">
				<view class="gr-sheet__bar"></view>

				<view class="gr-sh-head">
					<text class="gr-sh-head__title">战绩详情 · {{ detailTitle }}</text>
					<view class="gr-tag" :class="'gr-tag--' + resultTone(detail.myResult)">
						<text class="gr-tag__txt">{{ detailResultText }}</text>
					</view>
				</view>

				<text v-if="detailSummary" class="gr-sh-sub">{{ detailSummary }}</text>

				<scroll-view class="gr-sh-scroll" scroll-y>
					<view v-if="detailLines.length" class="gr-sh-lines">
						<view v-for="(line, index) in detailLines" :key="index" class="gr-sh-line">
							<text class="gr-sh-line__label">{{ line.label }}</text>
							<text class="gr-sh-line__val">{{ line.value }}</text>
						</view>
					</view>

					<view v-if="detailPlayers.length" class="gr-sh-players">
						<view
							v-for="(player, index) in detailPlayers"
							:key="index"
							class="gr-sh-p"
							:class="{ 'gr-sh-p--self': player.isSelf }"
						>
							<view class="gr-sh-ava">
								<image
									v-if="player.avatarUrl"
									class="gr-sh-ava__img"
									:src="player.avatarUrl"
									mode="aspectFill"
								></image>
								<text v-else class="gr-sh-ava__txt">{{ (player.nickname || '玩').slice(0, 1) }}</text>
							</view>
							<view class="gr-sh-p__name-wrap">
								<text class="gr-sh-p__name">{{ player.nickname || '玩家' }}</text>
								<text v-if="player.isSelf" class="gr-sh-p__self">（我）</text>
								<text v-if="player.isRobot" class="gr-sh-p__ai">AI</text>
							</view>
							<text class="gr-sh-p__role">{{ player.roleText }}</text>
							<text
								class="gr-sh-p__score"
								:class="{
									'gr-sh-p__score--win': player.result === 'win',
									'gr-sh-p__score--lose': player.result === 'lose'
								}"
							>{{ player.scoreText }}</text>
						</view>
					</view>
				</scroll-view>

				<view class="gr-sh-foot">
					<view class="gr-sh-btn" hover-class="gr-btn--hover" @tap="detailVisible = false">
						<text class="gr-sh-btn__txt">关闭</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import LoveAuthRequired from '@/components/love-auth-required/love-auth-required.vue'
	import LoveGameIcon from '@/components/love-game-icon/love-game-icon.vue'
	import { getGameApi, assertGameResult } from '@/common/api/game.js'
	import { getGameMeta } from '@/common/game/rules.js'
	import { navigateToTab } from '@/common/utils/tab-nav.js'
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
	import { requirePageLogin } from '@/common/auth-entry.js'

	const FILTERS = [
		{ label: '全部', value: '' },
		{ label: '卧底', value: 'undercover' },
		{ label: '斗地主', value: 'landlord' },
		{ label: '炸弹', value: 'bomb' }
	]

	const AD_SEED_MAX = 2147483647
	const AD_MIN_GAP = 10

	// 广告插入：每 10~20 条战绩之间随机插入一条广告（至少间隔 10 条），在横幅广告与宫格广告间随机选择；不足 10 条时在末尾补一条
	function buildAdSlotMap(total = 0, seed = 0, hasMore = false) {
		const slotMap = new Map()
		if (total <= 0) {
			return slotMap
		}
		let state = Math.floor(Math.abs(Number(seed) || 0)) % AD_SEED_MAX || 1
		const random = () => {
			state = (state * 48271) % AD_SEED_MAX
			return state / AD_SEED_MAX
		}
		const pickAdType = () => (random() < 0.5 ? 'banner' : 'grid')
		if (total < AD_MIN_GAP) {
			slotMap.set(total, pickAdType())
			return slotMap
		}
		let cursor = AD_MIN_GAP + Math.floor(random() * 11) // 10~20
		while (cursor <= total) {
			slotMap.set(cursor, pickAdType())
			cursor += AD_MIN_GAP + Math.floor(random() * 11)
		}
		if (!slotMap.size && !hasMore) {
			slotMap.set(total, pickAdType())
		}
		return slotMap
	}

	export default {
		components: {
			LoveAuthRequired,
			LoveGameIcon
		},
		data() {
			return {
				appStateStore: null,
				scrollTop: 0,
				isLoggedIn: false,
				filters: FILTERS,
				filterIndex: 0,
				records: [],
				adSeed: Math.floor(Math.random() * AD_SEED_MAX) + 1,
				page: 1,
				pageSize: 10,
				hasMore: false,
				loading: false,
				detailVisible: false,
				detail: null
			}
		},
		computed: {
			currentFilter() {
				const filter = FILTERS[this.filterIndex] || FILTERS[0]
				return filter.value
			},
			displayList() {
				const list = Array.isArray(this.records) ? this.records : []
				if (!list.length) return []
				const adSlotMap = buildAdSlotMap(list.length, this.adSeed, this.hasMore)
				const result = []
				let adIndex = 0
				for (let i = 0; i < list.length; i += 1) {
					const record = list[i]
					result.push({
						type: 'record',
						key: record && record.recordId ? `rec_${record.recordId}` : `rec_idx_${i}`,
						record
					})
					const adType = adSlotMap.get(i + 1)
					if (adType) {
						adIndex += 1
						result.push({
							type: 'ad',
							adType,
							key: `ad_${this.adSeed}_${adIndex}_${adType}`
						})
					}
				}
				return result
			},
			detailTitle() {
				return this.detail ? this.titleOf(this.detail.gameType) : '战绩详情'
			},
			detailResultText() {
				return this.detail ? getResultText(this.detail.myResult) : ''
			},
			detailSummary() {
				return this.detail ? this.detail.summary : ''
			},
			detailLines() {
				if (!this.detail) {
					return []
				}
				const lines = [
					{
						label: '对局时间 / 时长',
						value: `${formatGameTime(this.detail.createTime)} · ${formatGameDuration(this.detail.duration)}`
					}
				]
				const extra = this.detail.detail || {}
				if (extra.civilianWord) {
					lines.push({ label: '平民词 / 卧底词', value: `${extra.civilianWord} / ${extra.undercoverWord}` })
				}
				if (this.detail.roundCount > 1) {
					lines.push({ label: '进行轮次', value: `${this.detail.roundCount} 轮 · ${this.detail.playerCount} 人局` })
				} else {
					lines.push({ label: '参与人数', value: `${this.detail.playerCount} 人局` })
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
			if (!requirePageLogin()) return
			this.ensureAppStateStore()
			this.syncLoginState()
			this.reload()
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
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
				navigateToTab('game')
			},
			titleOf(gameType) {
				const meta = getGameMeta(gameType)
				return meta ? meta.title : '对局'
			},
			resultText(item) {
				return getResultText(item.myResult)
			},
			resultTone(result) {
				if (result === 'win') return 'green'
				if (result === 'lose') return 'coral'
				return 'muted'
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
				this.adSeed = Math.floor(Math.random() * AD_SEED_MAX) + 1
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

<style scoped>
	.gr-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
		background: var(--noir-bg);
		overflow: hidden;
	}

	.gr-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.2;
		pointer-events: none;
		z-index: 0;
	}

	.gr-glow--left {
		top: -120rpx;
		left: -140rpx;
		background: var(--noir-coral);
	}

	.gr-glow--right {
		top: 320rpx;
		right: -160rpx;
		background: var(--noir-gold);
	}

	.gr-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 32rpx 0;
	}

	.gr-auth {
		margin-top: 20rpx;
	}

	/* 4 项分段筛选（对标 s24 .m-seg） */
	.gr-seg {
		display: flex;
		align-items: center;
		padding: 6rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
	}

	.gr-seg__item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 60rpx;
		border-radius: 17rpx;
		transition: all 0.18s ease;
	}

	.gr-seg__item--on {
		background: linear-gradient(135deg, rgba(226, 100, 63, 0.24), rgba(216, 176, 140, 0.14));
		border: 1rpx solid var(--noir-border-coral);
	}

	.gr-seg__txt {
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.gr-seg__item--on .gr-seg__txt {
		color: var(--noir-text-strong);
		font-weight: 600;
	}

	/* 空态 & 加载 */
	.gr-tip {
		margin-top: 36rpx;
		padding: 64rpx 36rpx;
		border-radius: 32rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
		text-align: center;
	}

	.gr-tip__kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		letter-spacing: 4rpx;
		color: rgba(216, 176, 140, 0.66);
	}

	.gr-tip__title {
		display: block;
		margin-top: 14rpx;
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 34rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.gr-tip__text {
		font-size: 25rpx;
		color: rgba(245, 237, 228, 0.52);
	}

	.gr-tip__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 24rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.50);
	}

	.gr-tip__btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 30rpx;
		height: 76rpx;
		padding: 0 56rpx;
		border-radius: 38rpx;
		background: var(--noir-btn-gradient);
		box-shadow: 0 12rpx 28rpx rgba(222, 95, 60, 0.26);
	}

	.gr-tip__btn-txt {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
	}

	/* 战绩列表（对标 s24 .gr-list / .gr-card） */
	.gr-list {
		margin-top: 22rpx;
	}

	.gr-card {
		padding: 24rpx 26rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.075);
		background: rgba(255, 255, 255, 0.03);
		margin-bottom: 18rpx;
	}

	.gr-card--hover {
		background: rgba(255, 255, 255, 0.055);
	}

	.gr-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.gr-top__left {
		display: flex;
		align-items: center;
		gap: 12rpx;
		min-width: 0;
		flex: 1;
	}

	.gr-card__icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48rpx;
		height: 48rpx;
		border-radius: 14rpx;
		background: rgba(216, 176, 140, 0.10);
	}

	.gr-top__title {
		font-size: 28rpx;
		font-weight: 500;
		color: var(--noir-text);
		white-space: nowrap;
	}

	.gr-top__time {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.38);
		white-space: nowrap;
	}

	.gr-tag {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 40rpx;
		padding: 0 18rpx;
		border-radius: 20rpx;
	}

	.gr-tag--green {
		border: 1rpx solid rgba(132, 190, 156, 0.38);
		background: rgba(132, 190, 156, 0.14);
	}

	.gr-tag--green .gr-tag__txt {
		color: var(--noir-green);
	}

	.gr-tag--coral {
		border: 1rpx solid var(--noir-border-coral);
		background: rgba(226, 100, 63, 0.16);
	}

	.gr-tag--coral .gr-tag__txt {
		color: var(--noir-coral-light);
	}

	.gr-tag--muted {
		border: 1rpx solid rgba(216, 176, 140, 0.32);
		background: rgba(216, 176, 140, 0.12);
	}

	.gr-tag--muted .gr-tag__txt {
		color: var(--noir-gold-soft);
	}

	.gr-tag__txt {
		font-size: 21rpx;
		font-weight: 600;
	}

	.gr-sum {
		display: block;
		margin-top: 14rpx;
		font-size: 24rpx;
		line-height: 1.55;
		color: rgba(245, 237, 228, 0.58);
	}

	.gr-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 14rpx;
		padding-top: 12rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.045);
	}

	.gr-meta__left {
		display: flex;
		flex-wrap: wrap;
		gap: 20rpx;
	}

	.gr-meta__item {
		font-size: 21rpx;
		color: rgba(216, 176, 140, 0.66);
	}

	.gr-meta__item--role {
		color: var(--noir-coral-soft);
	}

	.gr-meta__more {
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.38);
	}

	.gr-more {
		padding: 24rpx 0 12rpx;
		text-align: center;
	}

	.gr-more__txt {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.36);
	}

	/* ---------- 战绩详情底部弹层（s24 .gr-sheet） ---------- */

	.gr-sheet-wrap {
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

	.gr-sheet-mask {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(8, 5, 4, 0.72);
	}

	.gr-sheet {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		max-height: 82vh;
		padding: 16rpx 36rpx calc(28rpx + env(safe-area-inset-bottom));
		border-radius: 40rpx 40rpx 0 0;
		border-top: 1rpx solid rgba(216, 176, 140, 0.28);
		background: linear-gradient(180deg, #1E1713 0%, #140F0D 100%);
		box-shadow: 0 -20rpx 60rpx rgba(0, 0, 0, 0.64);
	}

	.gr-sheet__bar {
		width: 68rpx;
		height: 8rpx;
		margin: 0 auto 22rpx;
		border-radius: 4rpx;
		background: rgba(245, 237, 228, 0.16);
	}

	.gr-sh-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.gr-sh-head__title {
		font-family: "Songti SC", "STSong", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.gr-sh-sub {
		display: block;
		margin-top: 10rpx;
		font-size: 23rpx;
		line-height: 1.55;
		color: rgba(245, 237, 228, 0.52);
	}

	.gr-sh-scroll {
		flex: 1;
		min-height: 0;
		max-height: 54vh;
		margin-top: 20rpx;
	}

	.gr-sh-lines {
		padding: 14rpx 22rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.03);
	}

	.gr-sh-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		padding: 10rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.045);
	}

	.gr-sh-line:last-child {
		border-bottom: none;
	}

	.gr-sh-line__label {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.46);
	}

	.gr-sh-line__val {
		font-size: 24rpx;
		font-weight: 500;
		color: var(--noir-gold-soft);
		text-align: right;
	}

	.gr-sh-players {
		margin-top: 18rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.02);
		overflow: hidden;
	}

	.gr-sh-p {
		display: flex;
		align-items: center;
		gap: 16rpx;
		padding: 16rpx 20rpx;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.05);
	}

	.gr-sh-p:last-child {
		border-bottom: none;
	}

	.gr-sh-p--self {
		background: rgba(226, 100, 63, 0.10);
	}

	.gr-sh-ava {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 54rpx;
		height: 54rpx;
		border-radius: 50%;
		border: 1.5rpx solid rgba(216, 176, 140, 0.30);
		background: var(--noir-btn-gradient);
		overflow: hidden;
	}

	.gr-sh-ava__img {
		width: 100%;
		height: 100%;
	}

	.gr-sh-ava__txt {
		font-size: 22rpx;
		font-weight: 700;
		color: var(--noir-text-warm);
	}

	.gr-sh-p__name-wrap {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6rpx;
	}

	.gr-sh-p__name {
		font-size: 25rpx;
		color: rgba(245, 237, 228, 0.86);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gr-sh-p__self {
		flex-shrink: 0;
		font-size: 21rpx;
		color: var(--noir-coral-soft);
	}

	.gr-sh-p__ai {
		flex-shrink: 0;
		padding: 0 8rpx;
		border-radius: 8rpx;
		background: rgba(108, 184, 255, 0.18);
		font-size: 18rpx;
		color: #8AC8FF;
	}

	.gr-sh-p__role {
		flex-shrink: 0;
		font-size: 22rpx;
		color: var(--noir-text-muted);
	}

	.gr-sh-p__score {
		flex-shrink: 0;
		min-width: 68rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 25rpx;
		font-weight: 600;
		color: rgba(245, 237, 228, 0.42);
		text-align: right;
	}

	.gr-sh-p__score--win {
		color: var(--noir-coral-soft);
	}

	.gr-sh-p__score--lose {
		color: rgba(245, 237, 228, 0.42);
	}

	.gr-sh-foot {
		flex-shrink: 0;
		margin-top: 24rpx;
	}

	.gr-sh-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 82rpx;
		border-radius: 41rpx;
		background: var(--noir-btn-gradient);
		box-shadow: 0 12rpx 26rpx rgba(222, 95, 60, 0.24);
	}

	.gr-sh-btn__txt {
		font-size: 27rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
		letter-spacing: 2rpx;
	}

	.gr-btn--hover {
		opacity: 0.86;
	}

	.gr-ad-card {
		border-radius: 26rpx;
		overflow: hidden;
		border: 1rpx solid rgba(255, 255, 255, 0.06);
		background: rgba(255, 255, 255, 0.025);
	}
</style>
