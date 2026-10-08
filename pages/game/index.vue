<template>
	<view class="love-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<view class="game-head">
				<text class="love-title-block__eyebrow">LoveNote 聚会游戏</text>
				<text class="love-title-block__title">一起玩点什么</text>
				<text class="love-title-block__desc">选一个游戏开一局，结果会自动记进战绩。</text>
			</view>

			<!-- 继续对局 -->
			<view v-if="activeRoom" class="resume-card" @click="handleResume">
				<view class="resume-card__body">
					<text class="resume-card__label">继续对局</text>
					<text class="resume-card__title">{{ resumeTitle }}</text>
					<text class="resume-card__desc">{{ resumeDesc }}</text>
				</view>
				<view class="resume-card__action-wrap">
					<uni-tag text="进入" size="small" :custom-style="resumeActionStyle"></uni-tag>
				</view>
			</view>

			<!-- 游戏网格 -->
			<view class="game-grid">
				<view
					v-for="item in gameCards"
					:key="item.gameType"
					class="game-card"
					hover-class="game-card--hover"
					@click="handleEnterGame(item)"
				>
					<view class="game-card__icon">
						<love-game-icon :game-type="item.gameType" :size="84" />
					</view>
					<view class="game-card__badge" @click.stop="handleShowRules(item.gameType)">
						<text class="game-card__badge-text">?</text>
					</view>
					<text class="game-card__title">{{ item.title }}</text>
					<text class="game-card__desc">{{ item.desc }}</text>
					<text class="game-card__meta">{{ item.playerText }} · {{ item.durationText }}</text>
				</view>
			</view>

			<!-- 最近战绩 -->
			<view class="game-section">
				<view class="game-section__header">
					<text class="game-section__title">最近战绩</text>
					<text class="game-section__more" @click="handleOpenRecords">全部 ›</text>
				</view>

				<view v-if="!isLoggedIn" class="game-empty" @click="handleRequireLogin">
					<text class="game-empty__title">登录后自动保存战绩</text>
					<text class="game-empty__desc">点这里完成微信登录，战绩会同步到云端</text>
				</view>

				<view v-else-if="loadingRecords" class="game-empty">
					<text class="game-empty__title">正在加载战绩…</text>
				</view>

				<view v-else-if="!records.length" class="game-empty">
					<text class="game-empty__title">还没有战绩</text>
					<text class="game-empty__desc">选个游戏开一局，结束后会自动记录</text>
				</view>

				<view v-else class="record-list">
					<view
						v-for="item in records"
						:key="item.recordId"
						class="record-item"
						@click="handleOpenRecords"
					>
						<view class="record-item__icon" :style="{ background: gradientOf(item.gameType) }">
							<love-game-icon :game-type="item.gameType" :size="52" />
						</view>
						<view class="record-item__body">
							<text class="record-item__title">{{ titleOf(item.gameType) }}</text>
							<text class="record-item__summary">{{ item.summary }}</text>
						</view>
						<view class="record-item__right">
							<text
								class="record-item__result"
								:class="{
									'record-item__result--win': item.myResult === 'win',
									'record-item__result--lose': item.myResult === 'lose'
								}"
							>{{ resultText(item) }}</text>
							<text class="record-item__time">{{ formatTime(item.createTime) }}</text>
						</view>
					</view>
				</view>
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
	import LoveGameRules from '@/components/love-game-rules/love-game-rules.vue'
	import LoveGameIcon from '@/components/love-game-icon/love-game-icon.vue'
	import { getGameApi } from '@/common/api/game.js'
	import { getGameCardList, getGameMeta, GAME_TYPE_BOMB } from '@/common/game/rules.js'
	import { getActiveRoom, clearActiveRoom } from '@/common/game/active-room.js'
	import {
		normalizeGameRoomBrief,
		normalizeGameRecordList,
		formatGameTime,
		getResultText
	} from '@/store/modules/game.js'
	import { useAppStateStore } from '@/store/app-state.js'
	import { hasValidLogin } from '@/common/auth-center.js'
	import { openLoginModal } from '@/common/auth-modal.js'

	const ROOM_PAGE_MAP = {
		undercover: '/pages/game/undercover/room',
		landlord: '/pages/game/landlord/room'
	}

	export default {
		components: {
			LoveGameRules,
			LoveGameIcon
		},
		data() {
			return {
				appStateStore: null,
				isLoggedIn: false,
				gameCards: getGameCardList(),
				activeRoom: null,
				records: [],
				loadingRecords: false,
				rulesVisible: false,
				rulesGameType: ''
			}
		},
		computed: {
			currentUid() {
				const userInfo = this.appStateStore ? this.appStateStore.userInfo : null
				return userInfo && userInfo._id ? String(userInfo._id) : ''
			},
			resumeTitle() {
				if (!this.activeRoom) {
					return ''
				}
				const meta = getGameMeta(this.activeRoom.gameType)
				return meta ? meta.title : '进行中的对局'
			},
			resumeDesc() {
				if (!this.activeRoom) {
					return ''
				}
				const room = this.activeRoom
				const statusText = room.status === 'waiting' ? '等待开局' : '对局进行中'
				const codeText = room.roomCode ? `房间号 ${room.roomCode}` : ''
				return `${statusText} · ${room.playerCount}/${room.maxPlayers} 人${codeText ? ' · ' + codeText : ''}`
			},
			/**
			 * 「进入」按钮的样式。uni-tag 默认色板是冷色，这里用 customStyle 换成项目主渐变。
			 * 注意同时给 background-color 兜底，并让 border-color 与渐变首色一致，
			 * 否则会露出一圈 uni-tag 自带的灰边。
			 */
			resumeActionStyle() {
				return [
					'display:inline-block',
					'background-color:#e76f51',
					'background-image:linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)',
					'border-color:#e76f51',
					'color:#ffffff',
					'font-size:25rpx',
					'font-weight:600',
					'line-height:1.2',
					'padding:16rpx 30rpx',
					'border-radius:999rpx'
				].join(';')
			},
		},
		onLoad() {
			this.ensureAppStateStore()
			this.syncLoginState()
			this.refreshActiveRoom()
			this.loadRecords()
		},
		onShow() {
			this.syncLoginState()
			this.refreshActiveRoom()
			this.loadRecords()
		},
		onPullDownRefresh() {
			Promise.resolve()
				.then(() => this.refreshActiveRoom())
				.then(() => this.loadRecords())
				.finally(() => {
					uni.stopPullDownRefresh()
				})
		},
		onShareAppMessage() {
			return {
				title: '恋人手札｜来一局聚会小游戏',
				path: '/pages/game/index'
			}
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
			formatTime(timestamp) {
				return formatGameTime(timestamp)
			},
			handleShowRules(gameType) {
				this.rulesGameType = gameType
				this.rulesVisible = true
			},
			handleRequireLogin() {
				openLoginModal({
					reason: '登录后才能保存战绩、创建房间'
				})
			},
			handleEnterGame(item) {
				const gameType = item && item.gameType
				if (!gameType) {
					return
				}

				// 数字炸弹免房间、免登录，点击直接进游戏
				if (gameType === GAME_TYPE_BOMB) {
					uni.navigateTo({
						url: '/pages/game/bomb/index'
					})
					return
				}

				if (!this.isLoggedIn) {
					openLoginModal({
						reason: '联机游戏需要先完成微信登录'
					})
					return
				}

				const url = ROOM_PAGE_MAP[gameType]
				if (!url) {
					uni.showToast({
						title: '该游戏即将上线',
						icon: 'none'
					})
					return
				}

				uni.navigateTo({ url })
			},
			handleResume() {
				if (!this.activeRoom) {
					return
				}
				const url = ROOM_PAGE_MAP[this.activeRoom.gameType]
				if (!url) {
					this.clearRoomRecord()
					return
				}
				uni.navigateTo({
					url: `${url}?roomId=${encodeURIComponent(this.activeRoom.roomId)}`
				})
			},
			handleOpenRecords() {
				if (!this.isLoggedIn) {
					this.handleRequireLogin()
					return
				}
				uni.navigateTo({
					url: '/pages/game/records'
				})
			},
			clearRoomRecord() {
				if (this.currentUid) {
					clearActiveRoom(this.currentUid)
				}
				this.activeRoom = null
			},
			async refreshActiveRoom() {
				if (!this.isLoggedIn) {
					this.activeRoom = null
					return
				}
				const uid = this.currentUid
				const store = this.ensureAppStateStore()

				try {
					await store.fetchGameActiveRoom({ force: true })
					this.activeRoom = store.gameActiveRoom
					if (!this.activeRoom && uid) {
						// 服务端说没有进行中的对局 → 清掉过期本地缓存
						clearActiveRoom(uid)
					}
				} catch (error) {
					console.warn('refreshActiveRoom failed', error)
					const local = uid ? getActiveRoom(uid) : null
					this.activeRoom = local ? normalizeGameRoomBrief(local) : null
				}
			},
			async loadRecords() {
				if (!this.isLoggedIn) {
					this.records = []
					return
				}
				this.loadingRecords = true
				try {
					const result = await getGameApi().getRecords({
						page: 1,
						pageSize: 5
					})
					if (result && result.errCode && result.errCode !== 0) {
						throw new Error(result.errMsg || '获取战绩失败')
					}
					const list = result && result.data && Array.isArray(result.data.list)
						? result.data.list
						: []
					this.records = normalizeGameRecordList(list)
				} catch (error) {
					console.warn('loadRecords failed', error)
					this.records = []
				} finally {
					this.loadingRecords = false
				}
			}
		}
	}
</script>

<style>
	.game-head {
		padding: 20rpx 8rpx 30rpx;
	}

	.resume-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		margin-bottom: 24rpx;
		padding: 28rpx 30rpx;
		border-radius: 32rpx;
		background: linear-gradient(135deg, rgba(255, 226, 205, 0.98), rgba(255, 240, 226, 0.98));
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.12);
	}

	.resume-card__label {
		display: block;
		font-size: 22rpx;
		letter-spacing: 4rpx;
		color: #b98069;
	}

	.resume-card__title {
		display: block;
		margin-top: 10rpx;
		font-size: 32rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.resume-card__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #8b6659;
	}

	/* 「进入」按钮：外观交给 uni-tag（见 computed resumeActionStyle），
	   这里只保留 flex 布局约束 */
	.resume-card__action-wrap {
		flex-shrink: 0;
	}

	.game-grid {
		display: flex;
		flex-wrap: wrap;
		margin: 0 -9rpx;
	}

	.game-card {
		position: relative;
		box-sizing: border-box;
		width: calc(50% - 18rpx);
		margin: 0 9rpx 18rpx;
		padding: 24rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
	}

	.game-card--hover {
		opacity: 0.92;
		transform: translateY(2rpx);
	}

	.game-card__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		/* 图标由 love-game-icon 按玩法自绘（🕵️ / 三张扑克 / 💣），不再用色块 + 编号占位。
		   固定 84rpx 见方：图标字形高度在不同机型/字体下不一致，用固定盒子才能保证三张卡片等高。 */
		width: 84rpx;
		height: 84rpx;
	}

	.game-card__badge {
		position: absolute;
		top: 20rpx;
		right: 20rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44rpx;
		height: 44rpx;
		border-radius: 50%;
		background: rgba(255, 241, 235, 0.96);
	}

	.game-card__badge-text {
		font-size: 26rpx;
		font-weight: 700;
		color: #b98069;
	}

	.game-card__title {
		display: block;
		margin-top: 22rpx;
		font-size: 30rpx;
		font-weight: 700;
		color: #5b3529;
	}

	.game-card__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: #917165;
	}

	.game-card__meta {
		display: block;
		margin-top: 14rpx;
		font-size: 22rpx;
		color: #b98069;
	}

	.game-section {
		margin-top: 14rpx;
	}

	.game-section__header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		margin-bottom: 18rpx;
		padding: 0 8rpx;
	}

	.game-section__title {
		font-size: 34rpx;
		font-weight: 700;
		color: #5b3529;
	}

	.game-section__more {
		font-size: 23rpx;
		color: #b98069;
	}

	.game-empty {
		padding: 34rpx 28rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
		text-align: center;
	}

	.game-empty__title {
		display: block;
		font-size: 28rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.game-empty__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: #8f6e63;
	}

	.record-list {
		padding: 10rpx 24rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
	}

	.record-item {
		display: flex;
		align-items: center;
		gap: 18rpx;
		padding: 22rpx 0;
	}

	.record-item + .record-item {
		border-top: 1rpx solid rgba(231, 204, 194, 0.6);
	}

	.record-item__icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64rpx;
		height: 64rpx;
		border-radius: 20rpx;
	}

	.record-item__body {
		flex: 1;
		min-width: 0;
	}

	.record-item__title {
		display: block;
		font-size: 27rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.record-item__summary {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: #917165;
	}

	.record-item__right {
		flex-shrink: 0;
		text-align: right;
	}

	.record-item__result {
		display: block;
		font-size: 25rpx;
		font-weight: 700;
		color: #a07d71;
	}

	.record-item__result--win {
		color: #c0674d;
	}

	.record-item__result--lose {
		color: #7f9b8e;
	}

	.record-item__time {
		display: block;
		margin-top: 6rpx;
		font-size: 20rpx;
		color: #b0a09a;
	}
</style>
