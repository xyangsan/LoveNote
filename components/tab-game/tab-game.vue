<template>
	<view class="tab-game">
		<noir-navbar :show-back="false" :transparent="true" :border="false" :scroll-top="scrollTop">
			<template #left>
				<view class="tg-brand">
					<text class="tg-brand__title">聚会游戏</text>
					<text class="tg-brand__sub">PARTY GAMES</text>
				</view>
			</template>
			<template #right>
				<view class="tg-rec-pill" @tap="handleOpenRecords">
					<text class="tg-rec-pill__txt">战绩 ›</text>
				</view>
			</template>
		</noir-navbar>

		<view class="tg-body">
			<!-- 进行中的对局续局横幅（09 设计稿） -->
			<view v-if="activeRoom" class="tg-resume" @tap="handleResume">
				<view class="tg-resume__body">
					<text class="tg-resume__title">{{ resumeTitle }} · 进行中</text>
					<text class="tg-resume__desc">{{ resumeDesc }}</text>
				</view>
				<noir-button text="回到房间" variant="primary" size="xs" @click.stop="handleResume" />
			</view>

			<!-- 全宽竖排游戏卡片（对齐 09 设计稿） -->
			<noir-empty
				v-if="!visibleGameCards.length"
				kicker="PARTY GAMES"
				title="当前没有开放的游戏"
				desc="运营暂时收起了全部小游戏，晚点再来看看"
			/>
			<view v-else class="tg-cards">
				<view
					v-for="(item, idx) in visibleGameCards"
					:key="item.gameType"
					class="tg-card"
					:class="{ 'tg-card--hi': idx === 0 }"
					@tap="handleEnterGame(item)"
				>
					<view class="tg-card__head">
						<view class="tg-card__title-wrap">
							<love-game-icon :game-type="item.gameType" :size="52" />
							<text class="tg-card__title">{{ item.title }}</text>
						</view>
						<noir-tag
							:text="item.playerText"
							:variant="item.gameType === 'undercover' ? 'coral' : (item.gameType === 'bomb' ? 'green' : 'gold')"
						/>
					</view>
					<text class="tg-card__desc">{{ item.desc }}</text>
					<view class="tg-card__foot">
						<view class="tg-card__tags">
							<noir-tag :text="item.durationText" variant="muted" />
							<view class="tg-rule-btn" @tap.stop="handleShowRules(item.gameType)">
								<text class="tg-rule-btn__txt">玩法说明</text>
							</view>
						</view>
						<view class="tg-go-btn">
							<text class="tg-go-btn__txt">{{ item.gameType === 'bomb' ? '立即开始' : '创建 / 加入' }}</text>
						</view>
					</view>
				</view>
			</view>

			<text class="tg-points-tip">完成任意一局结算可获 +5 心动点（每日限 5 局）</text>


			<!-- #ifdef MP-WEIXIN -->
			<view class="tg-ad-grid">
				<ad unit-id="adunit-7a1e5e50b619b450" ad-theme="black"></ad>
			</view>
			<!-- #endif -->

			<!-- 最近战绩 -->
			<noir-section-head title="最近战绩" action="全部 ›" @action="handleOpenRecords" />
			<noir-empty
				v-if="!isLoggedIn"
				kicker="RECORDS"
				title="登录后自动保存战绩"
				desc="完成微信登录后，历史战绩与心动点将同步到云端"
				action-text="去登录"
				@action="handleRequireLogin"
			/>
			<noir-empty
				v-else-if="!records.length"
				kicker="RECORDS"
				title="还没有战绩"
				desc="选一个游戏开一局，结算后会自动记录"
			/>
			<noir-card v-else padding="6rpx 24rpx">
				<view
					v-for="(item, idx) in records"
					:key="item.recordId"
					class="tg-rec-row"
					:class="{ 'tg-rec-row--last': idx === records.length - 1 }"
					@tap="handleOpenRecords"
				>
					<view class="tg-rec-row__main">
						<text class="tg-rec-row__title">{{ titleOf(item.gameType) }}</text>
						<text class="tg-rec-row__sum">{{ item.summary }}</text>
					</view>
					<view class="tg-rec-row__r">
						<noir-tag
							:text="resultText(item)"
							:variant="item.myResult === 'win' ? 'green' : (item.myResult === 'lose' ? 'coral' : 'muted')"
						/>
						<text class="tg-rec-row__time">{{ formatTime(item.createTime) }}</text>
					</view>
				</view>
			</noir-card>
			
			<view class="ad-view">
				<ad unit-id="adunit-38461899baf8b875"></ad>
			</view>
		</view>

		<love-game-rules
			:show="rulesVisible"
			:game-type="rulesGameType"
			@close="rulesVisible = false"
		></love-game-rules>
	</view>
</template>

<script>
	import LoveGameRules from '../love-game-rules/love-game-rules.vue'
	import LoveGameIcon from '../love-game-icon/love-game-icon.vue'
	import { getGameApi } from '../../common/api/game.js'
	import { readAppSettingsCache } from '../../common/app-settings.js'
	import { getGameCardList, getGameMeta, GAME_TYPE_BOMB } from '../../common/game/rules.js'
	import { getActiveRoom, clearActiveRoom } from '../../common/game/active-room.js'
	import {
		normalizeGameRoomBrief,
		normalizeGameRecordList,
		formatGameTime,
		getResultText
	} from '../../store/modules/game.js'
	import { useAppStateStore } from '../../store/app-state.js'
	import { hasValidLogin } from '../../common/auth-center.js'
	import { openLoginModal } from '../../common/auth-modal.js'

	const ROOM_PAGE_MAP = {
		undercover: '/pages/game/undercover/room',
		landlord: '/pages/game/landlord/room'
	}

	export default {
		name: 'TabGame',
		components: {
			LoveGameRules,
			LoveGameIcon
		},
		props: {
			settings: {
				type: Object,
				default: () => readAppSettingsCache()
			},
			scrollTop: {
				type: Number,
				default: 0
			}
		},
		data() {
			return {
				appStateStore: null,
				isLoggedIn: false,
				gameCards: getGameCardList(),
				activeRoom: null,
				records: [],
				rulesVisible: false,
				rulesGameType: ''
			}
		},
		computed: {
			currentUid() {
				const userInfo = this.appStateStore ? this.appStateStore.userInfo : null
				return userInfo && userInfo._id ? String(userInfo._id) : ''
			},
			visibleGameCards() {
				const items = (this.settings && this.settings.gameItems) || {}
				return this.gameCards.filter((item) => items[item.gameType] !== false)
			},
			resumeTitle() {
				if (!this.activeRoom) return ''
				const meta = getGameMeta(this.activeRoom.gameType)
				return meta ? meta.title : '进行中的对局'
			},
			resumeDesc() {
				if (!this.activeRoom) return ''
				const room = this.activeRoom
				const codeText = room.roomCode ? `房间 ${room.roomCode}` : ''
				return `${codeText}${codeText ? ' · ' : ''}${room.playerCount}/${room.maxPlayers} 人`
			}
		},
		mounted() {
			this.refresh({ force: false })
		},
		methods: {
			ensureStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			async refresh({ force = false } = {}) {
				const store = this.ensureStore()
				const userInfo = store.userInfo || null
				this.isLoggedIn = Boolean(userInfo && userInfo._id) || hasValidLogin()
				if (!this.isLoggedIn) {
					this.activeRoom = null
					this.records = []
					return
				}
				this.refreshActiveRoom(force)
				this.loadRecords()
			},
			async refreshActiveRoom(force = true) {
				const uid = this.currentUid
				const store = this.ensureStore()
				try {
					await store.fetchGameActiveRoom({ force })
					this.activeRoom = store.gameActiveRoom
					if (!this.activeRoom && uid) clearActiveRoom(uid)
				} catch (error) {
					const local = uid ? getActiveRoom(uid) : null
					this.activeRoom = local ? normalizeGameRoomBrief(local) : null
				}
			},
			async loadRecords() {
				try {
					const res = await getGameApi().getRecords({ page: 1, pageSize: 5 })
					const list = res && res.data && Array.isArray(res.data.list) ? res.data.list : []
					this.records = normalizeGameRecordList(list)
				} catch (error) {
					this.records = []
				}
			},
			titleOf(gameType) {
				const meta = getGameMeta(gameType)
				return meta ? meta.title : '对局'
			},
			resultText(item) {
				return getResultText(item.myResult)
			},
			formatTime(ts) {
				return formatGameTime(ts)
			},
			handleShowRules(gameType) {
				this.rulesGameType = gameType
				this.rulesVisible = true
			},
			handleRequireLogin() {
				openLoginModal({ reason: '登录后才能保存战绩、创建房间' })
			},
			handleEnterGame(item) {
				const gameType = item && item.gameType
				if (!gameType) return
				if (gameType === GAME_TYPE_BOMB) {
					uni.navigateTo({ url: '/pages/game/bomb/index' })
					return
				}
				if (!this.isLoggedIn) {
					openLoginModal({ reason: '联机游戏需要先完成微信登录' })
					return
				}
				const url = ROOM_PAGE_MAP[gameType]
				if (url) uni.navigateTo({ url })
			},
			handleResume() {
				if (!this.activeRoom) return
				const url = ROOM_PAGE_MAP[this.activeRoom.gameType]
				if (url) {
					uni.navigateTo({ url: `${url}?roomId=${encodeURIComponent(this.activeRoom.roomId)}` })
				}
			},
			handleOpenRecords() {
				if (!this.isLoggedIn) {
					this.handleRequireLogin()
					return
				}
				uni.navigateTo({ url: '/pages/game/records' })
			}
		}
	}
</script>

<style scoped>
	.tab-game {
		min-height: 100vh;
		padding-bottom: calc(184rpx + env(safe-area-inset-bottom));
	}

	.tg-brand {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.tg-brand__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		letter-spacing: 3rpx;
		line-height: 1.15;
		color: #FBF4EA;
		white-space: nowrap;
	}

	.tg-brand__sub {
		margin-top: 2rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 15rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.58);
		white-space: nowrap;
	}

	.tg-rec-pill {
		height: 52rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.42);
		background: rgba(216, 176, 140, 0.10);
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.tg-rec-pill__txt {
		font-size: 22rpx;
		color: #EAD4BC;
		white-space: nowrap;
	}

	.tg-body {
		padding: 16rpx 28rpx 0;
	}

	.tg-resume {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-bottom: 22rpx;
		padding: 22rpx 26rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(226, 100, 63, 0.46);
		background: linear-gradient(135deg, rgba(226, 100, 63, 0.20), rgba(255, 255, 255, 0.03));
	}

	.tg-resume__body {
		flex: 1;
		min-width: 0;
	}

	.tg-resume__title {
		display: block;
		font-size: 27rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.tg-resume__desc {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.58);
	}

	.tg-cards {
		display: flex;
		flex-direction: column;
		gap: 20rpx;
	}

	.tg-card {
		padding: 28rpx 28rpx 24rpx;
		border-radius: 30rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.034);
	}

	.tg-card--hi {
		border-color: rgba(216, 176, 140, 0.30);
		background: linear-gradient(135deg, rgba(216, 176, 140, 0.12), rgba(255, 255, 255, 0.03));
	}

	.tg-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.tg-card__title-wrap {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.tg-card__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 34rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.tg-card__desc {
		display: block;
		margin-top: 14rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.56);
	}

	.tg-card__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 20rpx;
	}

	.tg-card__tags {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.tg-rule-btn {
		height: 40rpx;
		padding: 0 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.14);
		display: flex;
		align-items: center;
	}

	.tg-rule-btn__txt {
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.tg-go-btn {
		height: 54rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.46);
		background: rgba(216, 176, 140, 0.09);
		display: flex;
		align-items: center;
	}

	.tg-go-btn__txt {
		font-size: 22rpx;
		color: #EAD4BC;
	}

	.tg-points-tip {
		display: block;
		margin-top: 22rpx;
		text-align: center;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.38);
	}

	.tg-rec-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		padding: 22rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.tg-rec-row--last {
		border-bottom: none;
	}

	.tg-rec-row__main {
		flex: 1;
		min-width: 0;
	}

	.tg-rec-row__title {
		display: block;
		font-size: 27rpx;
		color: #FBF4EA;
	}

	.tg-rec-row__sum {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.tg-rec-row__r {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6rpx;
		flex-shrink: 0;
	}

	.tg-rec-row__time {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: rgba(245, 237, 228, 0.34);
	}

	.tg-ad-grid {
		margin-top: 28rpx;
		border-radius: 26rpx;
		overflow: hidden;
	}
</style>
