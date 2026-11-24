<template>
	<view class="love-page love-page--compact love-page--with-tabbar">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<noir-navbar title="聚会游戏" subtitle="PARTY GAMES" :show-back="false" />

		<view class="love-layer">
			<view class="game-head">
				<text class="love-title-block__eyebrow">LOVENOTE · PARTY GAMES</text>
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

			<!-- 游戏网格：每个小游戏受运营「权限」tab 的子开关控制 -->
			<view v-if="!visibleGameCards.length" class="game-empty">
				<text class="game-empty__title">当前没有开放的游戏</text>
				<text class="game-empty__desc">运营暂时收起了全部小游戏，晚点再来看看</text>
			</view>
			<view v-else class="game-grid">
				<view
					v-for="item in visibleGameCards"
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
			<view class="ad-view ad-grid">
				<ad unit-id="adunit-38461899baf8b875"></ad>
			</view>
			<view class="ad-view">
				<ad unit-id="adunit-7da35bd90c83c292"></ad>
			</view>

			<!-- 最近战绩 -->
			<view class="game-section">
				<view class="game-section__header">
					<text class="game-section__title">最近战绩</text>
					<text class="game-section__more" @click="handleOpenRecords">全部 ›</text>
				</view>
				<view v-if="!isLoggedIn || loadingRecords || !records.length" class="ad-view ad-grid">
					<ad unit-id="adunit-7a1e5e50b619b450"></ad>
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

		<noir-tabbar active="game" @refresh="handleTabRefresh" />
	</view>
</template>

<script>
	import LoveGameRules from '@/components/love-game-rules/love-game-rules.vue'
	import LoveGameIcon from '@/components/love-game-icon/love-game-icon.vue'
	import { getGameApi } from '@/common/api/game.js'
	import { getPlatformApi } from '@/common/api/platform.js'
	import { readAppSettingsCache, writeAppSettingsCache } from '@/common/app-settings.js'
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
import { requirePageLogin } from '@/common/auth-entry.js'

	const ROOM_PAGE_MAP = {
		undercover: '/pages/game/undercover/room',
		landlord: '/pages/game/landlord/room'
	}

	// 小游戏子开关（运营管理「权限」tab）：大厅每次进入最多对齐一次配置，
	// 从房间返回大厅会触发 onShow，30 秒节流避免反复请求
	const MODULE_VISIBILITY_FETCH_INTERVAL = 30 * 1000
	let lastModuleVisibilityFetchAt = 0

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
				// 每个小游戏是否在大厅展示：先用启动时缓存的配置渲染，onShow 再与服务端对齐
				gameItems: readAppSettingsCache().gameItems,
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
			// 被运营关掉的小游戏不出现；未在 gameItems 里的类型按默认开启处理
			visibleGameCards() {
				return this.gameCards.filter((item) => this.gameItems[item.gameType] !== false)
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
				const statusText = room.status === 'waiting'
					? '等待开局'
					: (room.status === 'settled' ? '已结算 · 可再来一局' : '对局进行中')
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
			// 未登录先跳登录页，登录成功后由登录页 redirect 回本页（分享 / 扫码可直接落地本页）
			if (!requirePageLogin()) return
			this.ensureAppStateStore()
			this.syncLoginState()
			this.loadModuleVisibility()
			this.refreshActiveRoom()
			this.loadRecords()
		},
		onShow() {
			// onLoad 的闸门只负责跳转，onShow 仍会先跑一次（redirectTo 是异步的），
			// 这里再挡一刀，避免未登录就发对局/战绩请求、在登录页上闪错误 toast。
			if (!requirePageLogin()) return
			this.syncLoginState()
			this.loadModuleVisibility()
			this.refreshActiveRoom()
			this.loadRecords()
		},
		onPullDownRefresh() {
			Promise.resolve()
				.then(() => this.loadModuleVisibility(true))
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
			// 运营「权限」tab 的小游戏子开关：读不到就维持默认全开，不影响大厅可用性
			async loadModuleVisibility(force = false) {
				const now = Date.now()
				if (!force && now - lastModuleVisibilityFetchAt < MODULE_VISIBILITY_FETCH_INTERVAL) {
					return
				}
				lastModuleVisibilityFetchAt = now
				try {
					const result = await getPlatformApi().getModuleVisibility()
					if (!result || (result.errCode && result.errCode !== 0)) {
						return
					}
					const items = result.data && result.data.gameItems
					const source = items && typeof items === 'object' ? items : {}
					this.gameItems = {
						undercover: source.undercover !== false,
						landlord: source.landlord !== false,
						bomb: source.bomb !== false
					}
					// 顺手刷新公共缓存，其它页面（首页 / 心动点）下次读缓存就能拿到最新值
					writeAppSettingsCache({ gameItems: this.gameItems })
				} catch (error) {
					// 配置接口失败就沿用当前值（默认全开），大厅照常可用
					console.warn('loadModuleVisibility failed', error)
				}
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
			},
			handleTabRefresh() {
				this.loadModuleVisibility(true)
				this.refreshActiveRoom()
				this.loadRecords()
			}
		}
	}
</script>

<style>
	.game-head {
		padding: 18rpx 6rpx 26rpx;
	}

	.resume-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		margin-bottom: 24rpx;
		padding: 26rpx 28rpx;
		border-radius: 30rpx;
		border: 1rpx solid rgba(226, 100, 63, 0.44);
		background: linear-gradient(135deg, rgba(226, 100, 63, 0.18), rgba(255, 255, 255, 0.03));
	}

	.resume-card__label {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		letter-spacing: 3rpx;
		color: var(--noir-gold);
	}

	.resume-card__title {
		display: block;
		margin-top: 8rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.resume-card__desc {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.resume-card__action-wrap {
		flex-shrink: 0;
	}

	.game-grid {
		display: flex;
		flex-wrap: wrap;
		margin: 0 -8rpx;
	}

	.game-card {
		position: relative;
		box-sizing: border-box;
		width: calc(50% - 16rpx);
		margin: 0 8rpx 16rpx;
		padding: 24rpx;
		border-radius: 28rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.034);
	}

	.game-card--hover {
		opacity: 0.92;
		transform: translateY(2rpx);
	}

	.game-card__icon {
		display: flex;
		align-items: center;
		justify-content: center;
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
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(216, 176, 140, 0.1);
	}

	.game-card__badge-text {
		font-size: 24rpx;
		font-weight: 600;
		color: var(--noir-gold);
	}

	.game-card__title {
		display: block;
		margin-top: 20rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 30rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.game-card__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 22rpx;
		line-height: 1.55;
		color: rgba(245, 237, 228, 0.50);
	}

	.game-card__meta {
		display: block;
		margin-top: 12rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: var(--noir-gold);
	}

	.game-section {
		margin-top: 22rpx;
	}

	.game-section__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 16rpx;
		padding: 0 6rpx;
	}

	.game-section__title {
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.game-section__more {
		font-size: 23rpx;
		color: var(--noir-gold);
	}

	.game-empty {
		padding: 36rpx 28rpx;
		border-radius: 28rpx;
		border: 1rpx dashed rgba(216, 176, 140, 0.22);
		background: rgba(255, 255, 255, 0.024);
		text-align: center;
	}

	.game-empty__title {
		display: block;
		font-size: 28rpx;
		font-weight: 500;
		color: var(--noir-text-strong);
	}

	.game-empty__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 23rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.46);
	}

	.record-list {
		padding: 8rpx 24rpx;
		border-radius: 28rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.032);
	}

	.record-item {
		display: flex;
		align-items: center;
		gap: 18rpx;
		padding: 22rpx 0;
	}

	.record-item + .record-item {
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
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
		font-weight: 500;
		color: var(--noir-text-strong);
	}

	.record-item__summary {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.50);
	}

	.record-item__right {
		flex-shrink: 0;
		text-align: right;
	}

	.record-item__result {
		display: block;
		font-size: 24rpx;
		font-weight: 600;
		color: rgba(245, 237, 228, 0.56);
	}

	.record-item__result--win {
		color: var(--noir-green);
	}

	.record-item__result--lose {
		color: var(--noir-coral-soft);
	}

	.record-item__time {
		display: block;
		margin-top: 6rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.34);
	}
</style>
