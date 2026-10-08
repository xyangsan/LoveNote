<template>
	<view class="ll-page">
		<!-- 桌面背景 -->
		<view class="ll-desk"></view>
		<view class="ll-desk__glow ll-desk__glow--a"></view>
		<view class="ll-desk__glow ll-desk__glow--b"></view>

		<!-- 顶栏：右内边距按胶囊位置动态给出（topSafeStyle），避免「叫分 / 规则」被胶囊盖住 -->
		<view class="ll-top" :style="topSafeStyle">
			<view class="ll-top__left">
				<view class="ll-top__btn" @click="handleBack">
					<text class="ll-top__btn-text">‹ 退出</text>
				</view>
				<view v-if="room" class="ll-top__code">
					<text class="ll-top__code-text">房号 {{ room.roomCode }}</text>
				</view>
				<view class="ll-top__conn" :class="'ll-top__conn--' + connTone">
					<text class="ll-top__conn-text">{{ connText }}</text>
				</view>
			</view>

			<!-- 底牌 -->
			<view class="ll-bottom-cards">
				<text class="ll-bottom-cards__label">底牌</text>
				<view class="ll-bottom-cards__list">
					<love-playing-card
						v-for="(cardId, index) in bottomCards"
						:key="'bottom-' + index"
						:card-id="cardId"
						:width="30"
						:height="44"
						:face-down="bottomHidden"
						:dimmed="isBottomDimmed(index)"
					></love-playing-card>
				</view>
			</view>

			<view class="ll-top__right">
				<view v-if="phase === 'bidding'" class="ll-top__phase">
					<text class="ll-top__phase-text">叫分</text>
				</view>
				<view class="ll-top__btn" @click="rulesVisible = true">
					<text class="ll-top__btn-text">规则</text>
				</view>
			</view>
		</view>

		<!-- 牌桌 -->
		<view class="ll-board">
			<!-- 左侧对手 -->
			<view class="ll-side ll-side--left">
				<love-player-figure
					v-if="leftSeat"
					:nickname="leftSeat.nickname"
					:avatar-url="leftSeat.avatarUrl"
					:role="seatRole(leftSeat.seatIndex)"
					:seat-index="leftSeat.seatIndex"
					:cards-left="cardsLeftOf(leftSeat.seatIndex)"
					:is-robot="leftSeat.isRobot"
					:is-trustee="isTrusteeSeat(leftSeat.seatIndex)"
					:trustee-auto="isTrusteeAuto(leftSeat.seatIndex)"
					:online="leftSeat.online !== false"
					:is-current="isCurrentSeat(leftSeat.seatIndex)"
					:size="'small'"
				></love-player-figure>
				<view v-if="playedOf(leftSeatIndex).length" class="ll-played ll-played--side">
					<love-playing-card
						v-for="(cardId, index) in playedOf(leftSeatIndex)"
						:key="'lp-' + index"
						:card-id="cardId"
						:width="34"
						:height="48"
						:dimmed="!isLatestSeat(leftSeatIndex)"
					></love-playing-card>
				</view>
			</view>

			<!-- 中央 -->
			<view class="ll-center">
				<view v-if="room && room.status === 'waiting'" class="ll-center__waiting">
					<text class="ll-center__waiting-title">{{ waitingTitle }}</text>
					<text class="ll-center__waiting-desc">{{ waitingDesc }}</text>
				</view>

				<template v-else>
					<view class="ll-center__timer">
						<love-game-timer
							v-if="state.turn_deadline"
							:key="'ll-timer-' + state.timer_seq"
							:deadline="state.turn_deadline"
							:server-offset="serverOffset"
							:total="timerTotal"
							:show-bar="true"
							expired-text="推进中"
						></love-game-timer>
					</view>

					<view class="ll-center__play">
						<template v-if="centerPlay.cards.length">
							<love-playing-card
								v-for="(cardId, index) in centerPlay.cards"
								:key="'cp-' + index"
								:card-id="cardId"
								:width="44"
								:height="62"
							></love-playing-card>
						</template>
						<text v-else class="ll-center__play-hint">{{ centerHint }}</text>
					</view>

					<text v-if="centerPlay.text" class="ll-center__combo">{{ centerPlay.text }}</text>
					<text v-if="centerPlay.multiplierText" class="ll-center__multiplier">{{ centerPlay.multiplierText }}</text>

					<view v-if="currentTurnText" class="ll-center__turn">
						<text class="ll-center__turn-text">{{ currentTurnText }}</text>
					</view>
				</template>
			</view>

			<!-- 右侧对手 -->
			<view class="ll-side ll-side--right">
				<love-player-figure
					v-if="rightSeat"
					:nickname="rightSeat.nickname"
					:avatar-url="rightSeat.avatarUrl"
					:role="seatRole(rightSeat.seatIndex)"
					:seat-index="rightSeat.seatIndex"
					:cards-left="cardsLeftOf(rightSeat.seatIndex)"
					:is-robot="rightSeat.isRobot"
					:is-trustee="isTrusteeSeat(rightSeat.seatIndex)"
					:trustee-auto="isTrusteeAuto(rightSeat.seatIndex)"
					:online="rightSeat.online !== false"
					:is-current="isCurrentSeat(rightSeat.seatIndex)"
					:size="'small'"
				></love-player-figure>
				<view v-if="playedOf(rightSeatIndex).length" class="ll-played ll-played--side">
					<love-playing-card
						v-for="(cardId, index) in playedOf(rightSeatIndex)"
						:key="'rp-' + index"
						:card-id="cardId"
						:width="34"
						:height="48"
						:dimmed="!isLatestSeat(rightSeatIndex)"
					></love-playing-card>
				</view>
			</view>
		</view>

		<!-- 底部：我的手牌 + 操作 -->
		<view class="ll-bottom">
			<view class="ll-mybar">
				<love-player-figure
					v-if="selfSeat"
					:nickname="selfSeat.nickname"
					:avatar-url="selfSeat.avatarUrl"
					:role="seatRole(mySeat)"
					:seat-index="mySeat"
					:show-cards-left="false"
					:is-trustee="isTrusteeSeat(mySeat)"
					:trustee-auto="isTrusteeAuto(mySeat)"
					:online="selfSeat.online !== false"
					:is-current="isCurrentSeat(mySeat)"
					:size="'small'"
				></love-player-figure>
				<view class="ll-mybar__info">
					<text class="ll-mybar__count">剩 {{ myHand.length }} 张</text>
					<view v-if="autoActionMessage" class="ll-mybar__notice">
						<text class="ll-mybar__notice-text">{{ autoActionMessage }}</text>
					</view>
				</view>
			</view>

			<view class="ll-hand">
				<love-card-hand
					:cards="myHand"
					:selected="selectedCards"
					:card-width="48"
					:card-height="70"
					:max-width="handMaxWidth"
					:selectable="canSelectCards"
					:disabled="!canSelectCards"
					@change="handleCardsChange"
				></love-card-hand>
			</view>

			<view class="ll-actions">
				<!-- 等待开局 -->
				<template v-if="!room">
					<view class="ll-action ll-action--ghost" @click="handleCreateRoom">
						<text class="ll-action__text ll-action__text--ghost">创建房间</text>
					</view>
					<view class="ll-action ll-action--primary" @click="joinVisible = true">
						<text class="ll-action__text">输入房间号</text>
					</view>
				</template>

				<template v-else-if="room.status === 'waiting'">
					<view
						class="ll-action ll-action--ghost"
						:class="{ 'll-action--on': selfSeat && selfSeat.ready }"
						@click="handleToggleReady"
					>
						<text class="ll-action__text ll-action__text--ghost">
							{{ selfSeat && selfSeat.ready ? '取消准备' : '准备' }}
						</text>
					</view>
					<view v-if="isHost" class="ll-action ll-action--ghost" @click="handleAddRobot">
						<text class="ll-action__text ll-action__text--ghost">加机器人</text>
					</view>
					<view v-if="isHost" class="ll-action ll-action--ghost" @click="handleCloseRoom">
						<text class="ll-action__text ll-action__text--ghost">解散</text>
					</view>
					<view
						v-if="isHost"
						class="ll-action ll-action--primary"
						:class="{ 'll-action--disabled': !canStart }"
						@click="handleStart"
					>
						<text class="ll-action__text">{{ canStart ? '开始游戏' : '人未齐' }}</text>
					</view>
					<view v-else class="ll-action ll-action--ghost" @click="handleShareTap">
						<text class="ll-action__text ll-action__text--ghost">邀请好友</text>
					</view>
				</template>

				<!-- 叫分 -->
				<template v-else-if="phase === 'bidding'">
					<template v-if="isMyTurn">
						<view class="ll-action ll-action--ghost" @click="handleBid(0)">
							<text class="ll-action__text ll-action__text--ghost">不叫</text>
						</view>
						<view class="ll-action ll-action--ghost" @click="handleBid(1)">
							<text class="ll-action__text ll-action__text--ghost">1 分</text>
						</view>
						<view class="ll-action ll-action--ghost" @click="handleBid(2)">
							<text class="ll-action__text ll-action__text--ghost">2 分</text>
						</view>
						<view class="ll-action ll-action--primary" @click="handleBid(3)">
							<text class="ll-action__text">3 分</text>
						</view>
					</template>
					<view v-else class="ll-action ll-action--ghost ll-action--wide">
						<text class="ll-action__text ll-action__text--ghost">等待其他人叫分…</text>
					</view>
				</template>

				<!-- 出牌 -->
				<template v-else-if="phase === 'playing'">
					<view class="ll-action ll-action--ghost" @click="handleRemind">
						<text class="ll-action__text ll-action__text--ghost">提醒</text>
					</view>
					<view
						class="ll-action ll-action--ghost"
						:class="{ 'll-action--disabled': !canPass }"
						@click="handlePass"
					>
						<text class="ll-action__text ll-action__text--ghost">不出</text>
					</view>
					<view class="ll-action ll-action--ghost" @click="handleHint">
						<text class="ll-action__text ll-action__text--ghost">提示</text>
					</view>
					<view
						class="ll-action ll-action--ghost"
						:class="{ 'll-action--on': isTrusteeSeat(mySeat) }"
						@click="handleToggleTrustee"
					>
						<text class="ll-action__text ll-action__text--ghost">
							{{ isTrusteeSeat(mySeat) ? '恢复操作' : '挂机' }}
						</text>
					</view>
					<view
						class="ll-action ll-action--primary"
						:class="{ 'll-action--disabled': !canPlay }"
						@click="handlePlay"
					>
						<text class="ll-action__text">出牌</text>
					</view>
				</template>

				<!-- 结算 -->
				<template v-else-if="phase === 'settled'">
					<view class="ll-action ll-action--primary" @click="resultVisible = true">
						<text class="ll-action__text">查看结果</text>
					</view>
					<view v-if="isHost" class="ll-action ll-action--ghost" @click="handleCloseRoom">
						<text class="ll-action__text ll-action__text--ghost">解散房间</text>
					</view>
				</template>

				<view v-if="hostOffline" class="ll-action ll-action--ghost" @click="handleClaimHost">
					<text class="ll-action__text ll-action__text--ghost">接管房主</text>
				</view>
			</view>
		</view>

		<!-- 加入房间 -->
		<fui-bottom-popup
			:show="joinVisible"
			:radius="'32rpx'"
			:mask-closable="true"
			:safe-area="true"
			@close="joinVisible = false"
		>
			<view class="ll-join">
				<text class="ll-join__title">加入房间</text>
				<text class="ll-join__desc">输入好友分享的 6 位房间号</text>
				<fui-input
					placeholder="例如 AB3K9M"
					:value="joinCode"
					:size="32"
					:radius="20"
					background-color="#fffaf7"
					color="#5a3427"
					:padding="['20rpx', '24rpx']"
					@input="handleJoinCodeInput"
				></fui-input>
				<view class="ll-join__btn" @click="handleJoinRoom">
					<text class="ll-join__btn-text">进入房间</text>
				</view>
			</view>
		</fui-bottom-popup>

		<love-game-result-dialog
			:show="resultVisible"
			:tone="iWin ? 'success' : 'fail'"
			:emoji="iWin ? '🎉' : '😵'"
			:title="resultTitle"
			:subtitle="resultSubtitle"
			:lines="resultLines"
			:players="resultPlayers"
			:tips="resultTips"
			primary-text="留在房间"
			secondary-text="返回大厅"
			@close="resultVisible = false"
			@primary="resultVisible = false"
			@secondary="handleBackToHall"
		></love-game-result-dialog>

		<love-game-rules
			:show="rulesVisible"
			game-type="landlord"
			@close="rulesVisible = false"
		></love-game-rules>
	</view>
</template>

<script>
	import LovePlayingCard from '@/components/love-playing-card/love-playing-card.vue'
	import LoveCardHand from '@/components/love-card-hand/love-card-hand.vue'
	import LovePlayerFigure from '@/components/love-player-figure/love-player-figure.vue'
	import LoveGameTimer from '@/components/love-game-timer/love-game-timer.vue'
	import LoveGameRules from '@/components/love-game-rules/love-game-rules.vue'
	import LoveGameResultDialog from '@/components/love-game-result-dialog/love-game-result-dialog.vue'
	import { getGameApi, assertGameResult } from '@/common/api/game.js'
	import { createRoomSync } from '@/common/game/room-sync.js'
	import { saveActiveRoom, clearActiveRoom, getActiveRoom } from '@/common/game/active-room.js'
	import { pickNewAutoActions } from '@/store/modules/game.js'
	import { COMBO_TEXT_FALLBACK } from '@/common/game/cards.js'
	import { useAppStateStore } from '@/store/app-state.js'
	import { hasValidLogin } from '@/common/auth-center.js'
	import { openLoginModal } from '@/common/auth-modal.js'
	import { getLandscapeTopSafeArea } from '@/common/utils/nav-bar.js'

	const GAME_TYPE = 'landlord'
	const PLAYER_COUNT = 3
	const BID_MS = 15 * 1000
	const TURN_MS = 20 * 1000

	export default {
		components: {
			LovePlayingCard,
			LoveCardHand,
			LovePlayerFigure,
			LoveGameTimer,
			LoveGameRules,
			LoveGameResultDialog
		},
		data() {
			return {
				appStateStore: null,
				// 横屏右上角胶囊的安全区（横屏不能用 statusBarHeight，见 nav-bar.js 注释）
				topSafe: getLandscapeTopSafeArea(),
				room: null,
				answer: {},
				state: {},
				sync: null,
				serverOffset: 0,
				lastSeenSeq: 0,
				autoActionMessage: '',
				connMode: 'push',
				connStatus: 'connecting',
				selectedCards: [],
				joinVisible: false,
				joinCode: '',
				rulesVisible: false,
				resultVisible: false,
				resultShown: false,
				handMaxWidth: 420
			}
		},
		computed: {
			topSafeStyle() {
				// 只补右内边距，让「叫分 / 规则」落在胶囊左侧
				return { paddingRight: this.topSafe.extraRightPadding + 'px' }
			},
			isLoggedIn() {
				const userInfo = this.appStateStore ? this.appStateStore.userInfo : null
				return Boolean(userInfo && userInfo._id) || hasValidLogin()
			},
			currentUid() {
				const userInfo = this.appStateStore ? this.appStateStore.userInfo : null
				return userInfo && userInfo._id ? String(userInfo._id) : ''
			},
			roomId() {
				return this.room ? this.room.roomId : ''
			},
			mySeat() {
				return this.room && this.room.me ? Number(this.room.me.seatIndex) : -1
			},
			isHost() {
				return Boolean(this.room && this.room.me && this.room.me.isHost)
			},
			selfSeat() {
				return this.findSeat(this.mySeat)
			},
			ring() {
				return (this.room && Array.isArray(this.room.seats) ? this.room.seats : [])
					.slice()
					.sort((left, right) => Number(left.seatIndex) - Number(right.seatIndex))
					.map((seat) => Number(seat.seatIndex))
			},
			leftSeatIndex() {
				const ring = this.ring
				const position = ring.indexOf(this.mySeat)
				if (position < 0 || ring.length < PLAYER_COUNT) {
					return -1
				}
				return ring[(position + ring.length - 1) % ring.length]
			},
			rightSeatIndex() {
				const ring = this.ring
				const position = ring.indexOf(this.mySeat)
				if (position < 0 || ring.length < PLAYER_COUNT) {
					return -1
				}
				return ring[(position + 1) % ring.length]
			},
			leftSeat() {
				return this.findSeat(this.leftSeatIndex)
			},
			rightSeat() {
				return this.findSeat(this.rightSeatIndex)
			},
			phase() {
				return this.state.phase || ''
			},
			myHand() {
				return Array.isArray(this.answer.myHand) ? this.answer.myHand : []
			},
			bottomCards() {
				const cards = Array.isArray(this.answer.bottomCards) ? this.answer.bottomCards : []
				if (cards.length) {
					return cards
				}
				return ['', '', '']
			},
			bottomHidden() {
				return Boolean(this.answer.bottomHidden)
			},
			isMyTurn() {
				return Number(this.state.current_seat) === this.mySeat && this.mySeat >= 0
			},
			isAliveSeat() {
				return this.myHand.length > 0
			},
			canSelectCards() {
				return this.phase === 'playing' && this.isMyTurn && !this.isTrusteeSeat(this.mySeat)
			},
			canPlay() {
				return this.canSelectCards && this.selectedCards.length > 0
			},
			canPass() {
				return this.canSelectCards && Boolean(this.state.last_play)
			},
			centerPlay() {
				const last = this.state.last_play
				if (!last) {
					return {
						cards: [],
						text: '',
						multiplierText: ''
					}
				}
				const multiplier = Number(this.state.multiplier || 1)
				const bombCount = Number(this.state.bomb_count || 0)
				return {
					cards: Array.isArray(last.cards) ? last.cards : [],
					text: `${this.seatName(last.seat_index)} 出牌 · ${COMBO_TEXT_FALLBACK[last.combo_type] || ''}`,
					multiplierText: bombCount ? `炸弹 ×${bombCount} · 当前 ${multiplier} 倍` : `当前 ${multiplier} 倍`
				}
			},
			centerHint() {
				if (this.phase === 'bidding') {
					return '等待叫分…'
				}
				if (this.phase === 'settled') {
					return '本局已结束'
				}
				// 用「取反」而不是 === null：服务端清空 last_play 用的是删除字段，
				// 客户端拿到的是 undefined 而不是 null（见 game-room.js 的 flattenStateUpdate）
				if (!this.state.last_play && this.phase === 'playing') {
					return '新一轮，先手出牌'
				}
				return '等待出牌…'
			},
			currentTurnText() {
				if (this.phase === 'settled' || this.phase === 'dealing') {
					return ''
				}
				if (this.isMyTurn) {
					return this.phase === 'bidding' ? '轮到你叫分' : '轮到你出牌'
				}
				const seatIndex = Number(this.state.current_seat)
				if (seatIndex < 0) {
					return ''
				}
				return `等待 ${this.seatName(seatIndex)} 操作`
			},
			timerTotal() {
				return this.phase === 'bidding' ? BID_MS : TURN_MS
			},
			waitingTitle() {
				return `等待开局（${this.room ? this.room.playerCount : 0}/${PLAYER_COUNT} 人）`
			},
			waitingDesc() {
				if (!this.room) {
					return ''
				}
				if (this.room.playerCount < PLAYER_COUNT) {
					return this.isHost
						? '邀请好友加入，或点「加机器人」补位'
						: '等房主补齐人数，或点右上角「···」邀请好友'
				}
				return this.isHost ? '人齐了，点「开始游戏」发牌' : '等房主开始游戏'
			},
			canStart() {
				return Boolean(
					this.room
					&& this.room.status === 'waiting'
					&& this.isHost
					&& this.room.playerCount >= PLAYER_COUNT
				)
			},
			hostOffline() {
				if (!this.room || this.isHost || this.room.status === 'settled') {
					return false
				}
				const hostSeat = this.findSeat(Number(this.room.hostSeatIndex))
				return Boolean(hostSeat && hostSeat.online === false && !hostSeat.isRobot)
			},
			connText() {
				return this.connMode === 'push' ? '实时' : '轮询'
			},
			connTone() {
				if (this.connMode === 'push') {
					return 'ok'
				}
				return this.connStatus === 'unavailable' ? 'warn' : 'pending'
			},
			result() {
				return (this.room && this.room.result) || null
			},
			iWin() {
				return Boolean(this.result && this.result.iWin)
			},
			resultTitle() {
				if (!this.result) {
					return '本局结束'
				}
				return this.result.winnerCamp === 'landlord' ? '地主获胜' : '农民获胜'
			},
			resultSubtitle() {
				if (!this.result) {
					return ''
				}
				return `${this.result.baseScore} 分底 × ${this.result.multiplier} 倍 = ${this.result.myScoreDelta > 0 ? '+' : ''}${this.result.myScoreDelta} 分`
			},
			resultLines() {
				if (!this.result) {
					return []
				}
				return [
					{
						label: '你的身份',
						value: Number(this.result.landlordSeat) === this.mySeat ? '地主' : '农民',
						highlight: true
					},
					{ label: '底分 / 倍数', value: `${this.result.baseScore} / ${this.result.multiplier}` },
					{ label: '炸弹次数', value: `${this.result.bombCount} 次` },
					{
						label: '本局得分',
						value: `${this.result.myScoreDelta > 0 ? '+' : ''}${this.result.myScoreDelta}`,
						highlight: this.result.myScoreDelta > 0
					}
				]
			},
			resultPlayers() {
				if (!this.result || !this.room) {
					return []
				}
				const scoreDelta = this.result.scoreDelta || {}
				const cardsLeft = this.result.cardsLeft || {}
				return (this.room.seats || []).map((seat) => {
					const seatIndex = Number(seat.seatIndex)
					const delta = Number(scoreDelta[String(seatIndex)] || 0)
					const isLandlord = Number(this.result.landlordSeat) === seatIndex
					const win = isLandlord
						? this.result.winnerCamp === 'landlord'
						: this.result.winnerCamp === 'farmer'
					return {
						nickname: seat.nickname,
						avatarUrl: seat.avatarUrl,
						roleText: `${isLandlord ? '地主' : '农民'} · 剩 ${Number(cardsLeft[String(seatIndex)] || 0)} 张`,
						scoreText: delta > 0 ? `+${delta}` : String(delta),
						result: win ? 'win' : 'lose',
						isSelf: seatIndex === this.mySeat
					}
				})
			},
			resultTips() {
				if (!this.result) {
					return ''
				}
				return this.iWin ? '这一局稳住了，战绩已保存。' : '别急，下一局抢地主翻盘。'
			}
		},
		onLoad(options = {}) {
			this.ensureAppStateStore()
			this.refreshTopSafe()
			this.loadLocalState()
			this.computeHandWidth()

			const roomId = String(options.roomId || '').trim()
			const roomCode = String(options.roomCode || '').trim()
			if (roomId) {
				this.enterRoom({ roomId })
			} else if (roomCode) {
				this.enterRoom({ roomCode })
			}
		},
		onReady() {
			this.computeHandWidth()
		},
		onShow() {
			this.refreshTopSafe()
			this.computeHandWidth()
			if (this.sync) {
				this.sync.resume()
			}
		},
		onResize() {
			// 横竖屏切换 / iPad 分屏时胶囊位置会变，必须重新测量
			this.refreshTopSafe()
			this.computeHandWidth()
		},
		onHide() {
			if (this.sync) {
				this.sync.pause()
			}
			this.persistActiveRoom()
		},
		onUnload() {
			this.persistActiveRoom()
			if (this.sync) {
				this.sync.stop()
				this.sync = null
			}
		},
		onShareAppMessage() {
			const roomCode = this.room ? this.room.roomCode : ''
			return {
				title: roomCode
					? `三人斗地主｜房间号 ${roomCode}，三缺一快来`
					: '恋人手札｜三人斗地主',
				path: roomCode
					? `/pages/game/landlord/room?roomCode=${roomCode}`
					: '/pages/game/index'
			}
		},
		methods: {
			refreshTopSafe() {
				const next = getLandscapeTopSafeArea()
				const current = this.topSafe
				if (
					current
					&& current.rightInset === next.rightInset
					&& current.extraRightPadding === next.extraRightPadding
				) {
					return
				}
				this.topSafe = next
			},
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			computeHandWidth() {
				try {
					const info = uni.getSystemInfoSync()
					const width = Number(info.windowWidth || 375)
					// 横屏下 windowWidth 即屏幕长边，留出左右各 40px 安全边距
					this.handMaxWidth = Math.max(240, Math.min(720, width - 160))
				} catch (error) {
					this.handMaxWidth = 420
				}
			},
			loadLocalState() {
				const uid = this.currentUid
				const local = uid ? getActiveRoom(uid) : null
				this.lastSeenSeq = local && local.gameType === GAME_TYPE ? Number(local.lastSeenSeq || 0) : 0
			},
			persistActiveRoom() {
				const uid = this.currentUid
				if (!uid) {
					return
				}
				if (!this.room || this.room.status === 'settled') {
					clearActiveRoom(uid)
					return
				}
				saveActiveRoom(uid, {
					roomId: this.room.roomId,
					gameType: GAME_TYPE,
					roomCode: this.room.roomCode,
					version: this.room.version,
					lastSeenSeq: this.lastSeenSeq
				})
			},
			findSeat(seatIndex) {
				const seats = this.room && Array.isArray(this.room.seats) ? this.room.seats : []
				return seats.find((item) => Number(item.seatIndex) === Number(seatIndex)) || null
			},
			seatName(seatIndex) {
				const seat = this.findSeat(seatIndex)
				return seat ? seat.nickname || `座位${Number(seatIndex) + 1}` : `座位${Number(seatIndex) + 1}`
			},
			seatRole(seatIndex) {
				if (this.phase === 'dealing' || this.phase === 'bidding') {
					return ''
				}
				const landlordSeat = Number(this.state.landlord_seat)
				if (landlordSeat < 0) {
					return ''
				}
				return Number(seatIndex) === landlordSeat ? 'landlord' : 'farmer'
			},
			cardsLeftOf(seatIndex) {
				const left = this.state.cards_left || {}
				return Number(left[String(seatIndex)] || 0)
			},
			isTrusteeSeat(seatIndex) {
				const list = Array.isArray(this.state.trustee_seats) ? this.state.trustee_seats.map(Number) : []
				return list.includes(Number(seatIndex))
			},
			isTrusteeAuto(seatIndex) {
				const meta = this.state.trustee_meta || {}
				const item = meta[String(seatIndex)]
				return Boolean(item && item.auto)
			},
			isCurrentSeat(seatIndex) {
				return Number(this.state.current_seat) === Number(seatIndex) && this.phase !== 'settled'
			},
			isLatestSeat(seatIndex) {
				const last = this.state.last_play
				return Boolean(last && Number(last.seat_index) === Number(seatIndex))
			},
			playedOf(seatIndex) {
				const history = Array.isArray(this.state.history) ? this.state.history : []
				const entry = history.find((item) => Number(item.seat_index) === Number(seatIndex))
				return entry && Array.isArray(entry.cards) ? entry.cards : []
			},
			isBottomDimmed(index) {
				if (this.bottomHidden) {
					return false
				}
				// 底牌最后归地主，非最后一张不用变灰；这里仅做轻微层次感
				return index > 0 && this.phase === 'playing'
			},
			handleBack() {
				this.persistActiveRoom()
				const pages = getCurrentPages()
				if (pages && pages.length > 1) {
					uni.navigateBack()
					return
				}
				this.handleBackToHall()
			},
			handleBackToHall() {
				this.resultVisible = false
				uni.reLaunch({
					url: '/pages/game/index'
				})
			},
			handleShareTap() {
				uni.showToast({
					title: '点右上角「···」转发给朋友',
					icon: 'none',
					duration: 2400
				})
			},
			requireLogin() {
				if (this.isLoggedIn) {
					return true
				}
				openLoginModal({
					reason: '联机游戏需要先完成微信登录'
				})
				return false
			},
			async handleCreateRoom() {
				if (!this.requireLogin()) {
					return
				}
				uni.showLoading({
					title: '创建中',
					mask: true
				})
				try {
					const result = assertGameResult(
						await getGameApi().createRoom({
							gameType: GAME_TYPE
						}),
						'创建房间失败'
					)
					this.applySnapshot(result.data, { source: 'local', changed: true, reset: true })
					this.startSync()
				} catch (error) {
					uni.showToast({
						title: error.message || '创建房间失败',
						icon: 'none'
					})
				} finally {
					uni.hideLoading()
				}
			},
			handleJoinCodeInput(event = '') {
				// fui-input 的 input 事件回传原始字符串（不是 event.detail.value），
				// 与 undercover/room.vue 的 resolveInputText 同口径剥壳
				let value = event
				if (value && typeof value === 'object') {
					value = value.detail
				}
				if (value && typeof value === 'object') {
					value = value.value
				}
				const text = value === null || value === undefined ? '' : String(value)
				this.joinCode = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
			},
			async handleJoinRoom() {
				const roomCode = String(this.joinCode || '').trim()
				if (roomCode.length !== 6) {
					uni.showToast({
						title: '请输入 6 位房间号',
						icon: 'none'
					})
					return
				}
				this.joinVisible = false
				await this.enterRoom({ roomCode })
			},
			async enterRoom(payload = {}) {
				if (!this.requireLogin()) {
					return
				}
				uni.showLoading({
					title: '进入房间',
					mask: true
				})
				try {
					const result = assertGameResult(
						await getGameApi().joinRoom(payload),
						'进入房间失败'
					)
					this.applySnapshot(result.data, { source: 'local', changed: true, reset: true })
					this.startSync()
				} catch (error) {
					uni.showToast({
						title: error.message || '进入房间失败',
						icon: 'none'
					})
					if (error.errCode === 'love-note-game-room-not-found') {
						setTimeout(() => this.handleBackToHall(), 1200)
					}
				} finally {
					uni.hideLoading()
				}
			},
			startSync() {
				if (!this.roomId) {
					return
				}
				if (this.sync) {
					this.sync.setVersion(this.room ? this.room.version : 0)
					return
				}
				this.sync = createRoomSync({
					roomId: this.roomId,
					onUpdate: (payload, meta) => this.applySnapshot(payload, meta),
					onError: (error, info) => this.handleSyncError(error, info),
					onStatusChange: (status) => {
						this.connMode = status.mode
						this.connStatus = status.pushReady ? 'connected' : 'pending'
					}
				})
				this.sync.setVersion(this.room ? this.room.version : 0)
				this.sync.start()
			},
			handleSyncError(error = {}, info = {}) {
				if (info.fatal) {
					uni.showModal({
						title: '对局已结束',
						content: error.message || '房间不存在或已关闭',
						showCancel: false,
						success: () => {
							clearActiveRoom(this.currentUid)
							this.handleBackToHall()
						}
					})
					return
				}
				if (info.retryDelay) {
					this.connStatus = 'error'
				}
			},
			applySnapshot(payload = {}, meta = {}) {
				if (!payload) {
					return
				}
				// 先校时：即使本次没有 room（changed:false 的零成本响应），也要刷新时钟偏移
				if (payload.serverTime) {
					this.serverOffset = Number(payload.serverTime) - Date.now()
				}
				if (!payload.room) {
					return
				}

				const previousTurnSeat = Number(this.state.current_seat)
				const previousDeadline = Number(this.state.turn_deadline)
				const previousVersion = this.room ? Number(this.room.version) : -1
				const nextVersion = Number(payload.version || 0)

				if (meta.reset) {
					this.selectedCards = []
				}

				if (!payload.changed && nextVersion === previousVersion) {
					return
				}

				const room = payload.room
				this.room = room
				this.answer = room.answer || {}
				this.state = room.state || {}
				if (this.sync) {
					this.sync.setVersion(nextVersion)
				}

				// 轮次变化 → 清空已选牌，避免"选中了已经出掉的牌"
				const turnSeat = Number(this.state.current_seat)
				const deadline = Number(this.state.turn_deadline)
				if (turnSeat !== previousTurnSeat || deadline !== previousDeadline) {
					this.selectedCards = []
				}
				if (!this.canSelectCards) {
					this.selectedCards = []
				}

				this.notifyAutoActions()
				this.persistActiveRoom()

				if (this.phase === 'settled' && !this.resultShown) {
					this.resultShown = true
					this.resultVisible = true
					clearActiveRoom(this.currentUid)
				}
				if (this.phase !== 'settled') {
					this.resultShown = false
				}
			},
			notifyAutoActions() {
				const picked = pickNewAutoActions({
					autoActions: this.state.auto_actions || [],
					lastSeenSeq: this.lastSeenSeq,
					mySeat: this.mySeat
				})
				if (picked.maxSeq > this.lastSeenSeq) {
					this.lastSeenSeq = picked.maxSeq
				}
				this.autoActionMessage = picked.message || ''
				if (picked.message) {
					uni.showToast({
						title: picked.message,
						icon: 'none',
						duration: 2600
					})
				}
			},
			handleCardsChange(selected) {
				this.selectedCards = Array.isArray(selected) ? selected : []
			},
			async runRoomAction(action, payload = {}, { successText = '' } = {}) {
				try {
					const result = assertGameResult(
						await getGameApi()[action](Object.assign({ roomId: this.roomId }, payload)),
						'操作失败'
					)
					if (result.data && result.data.room) {
						this.applySnapshot(result.data, { source: 'local', changed: true })
					} else if (this.sync) {
						await this.sync.syncNow()
					}
					if (successText) {
						uni.showToast({
							title: successText,
							icon: 'none'
						})
					}
					return true
				} catch (error) {
					if (error.errCode === 'love-note-game-version-conflict') {
						if (this.sync) {
							await this.sync.syncNow()
						}
						uni.showToast({
							title: '手慢了，牌桌已更新',
							icon: 'none'
						})
						return false
					}
					uni.showToast({
						title: error.message || '操作失败',
						icon: 'none'
					})
					return false
				}
			},
			handleToggleReady() {
				const ready = !(this.selfSeat && this.selfSeat.ready)
				this.runRoomAction('setReady', { ready })
			},
			handleAddRobot() {
				this.runRoomAction('addRobot', { count: 1 })
			},
			handleStart() {
				if (!this.canStart) {
					uni.showToast({
						title: `需要 ${PLAYER_COUNT} 名玩家`,
						icon: 'none'
					})
					return
				}
				this.runRoomAction('landlordStart', {})
			},
			handleBid(score) {
				this.runRoomAction('landlordBid', { score })
			},
			handlePlay() {
				if (!this.selectedCards.length) {
					uni.showToast({
						title: '先选要出的牌',
						icon: 'none'
					})
					return
				}
				const cardIds = this.selectedCards.slice()
				this.runRoomAction('landlordPlay', { cardIds }).then((ok) => {
					if (ok) {
						this.selectedCards = []
					}
				})
			},
			handlePass() {
				if (!this.canPass) {
					uni.showToast({
						title: '你是先手，必须出牌',
						icon: 'none'
					})
					return
				}
				this.runRoomAction('landlordPass', {})
			},
			async handleHint() {
				try {
					const result = assertGameResult(
						await getGameApi().landlordHint({ roomId: this.roomId }),
						'获取提示失败'
					)
					const hint = (result.data || {}).hint
					if (!hint || !Array.isArray(hint.cardIds) || !hint.cardIds.length) {
						uni.showToast({
							title: hint && hint.canPass ? '这手牌管不上，建议不出' : '没有可出的牌',
							icon: 'none'
						})
						return
					}
					this.selectedCards = hint.cardIds.slice()
				} catch (error) {
					uni.showToast({
						title: error.message || '获取提示失败',
						icon: 'none'
					})
				}
			},
			handleRemind() {
				try {
					uni.vibrateShort()
				} catch (error) {
					// 部分端不支持震动，忽略
				}
				uni.showToast({
					title: '已经提醒队友啦',
					icon: 'none'
				})
			},
			handleToggleTrustee() {
				const enabled = !this.isTrusteeSeat(this.mySeat)
				this.runRoomAction('landlordTrustee', { enabled }, {
					successText: enabled ? '已开启托管' : '已恢复操作'
				})
			},
			handleClaimHost() {
				this.runRoomAction('claimHost', {}, { successText: '你已成为房主' })
			},
			handleCloseRoom() {
				uni.showModal({
					title: '解散房间',
					content: '房间会被关闭，所有人都会退出，确定吗？',
					success: (res) => {
						if (!res.confirm) {
							return
						}
						this.runRoomAction('closeRoom', {}).then(() => {
							clearActiveRoom(this.currentUid)
							this.handleBackToHall()
						})
					}
				})
			}
		}
	}
</script>

<style>
	/* 横屏页面：全部用 px / vh，不能用 rpx（rpx 以屏宽为基准会被放大） */
	.ll-page {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100vw;
		height: 100vh;
		padding-left: env(safe-area-inset-left);
		padding-right: env(safe-area-inset-right);
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		overflow: hidden;
	}

	.ll-desk {
		position: absolute;
		top: 8px;
		left: 8px;
		right: 8px;
		bottom: 8px;
		border-radius: 18px;
		background: linear-gradient(160deg, #2f6b4f 0%, #1f4d39 62%, #17392b 100%);
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.08);
	}

	.ll-desk__glow {
		position: absolute;
		border-radius: 50%;
		filter: blur(26px);
		pointer-events: none;
	}

	.ll-desk__glow--a {
		top: -30px;
		left: 12%;
		width: 160px;
		height: 120px;
		background: radial-gradient(circle, rgba(255, 220, 170, 0.32), transparent 68%);
	}

	.ll-desk__glow--b {
		bottom: -20px;
		right: 10%;
		width: 180px;
		height: 120px;
		background: radial-gradient(circle, rgba(255, 200, 150, 0.22), transparent 70%);
	}

	.ll-top {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		/* padding-right 会被 topSafeStyle 按胶囊位置覆盖（横屏胶囊在右上角，宽 87~95px） */
		padding: 12px 16px 4px;
	}

	.ll-top__left,
	.ll-top__right {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.ll-top__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 28px;
		padding: 0 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.22);
	}

	.ll-top__btn-text {
		font-size: 12px;
		color: #fff3ec;
	}

	.ll-top__code {
		padding: 3px 10px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.18);
	}

	.ll-top__code-text {
		font-size: 11px;
		letter-spacing: 1px;
		color: #ffe9dd;
	}

	.ll-top__conn {
		padding: 3px 9px;
		border-radius: 999px;
		background: rgba(132, 199, 168, 0.32);
	}

	.ll-top__conn--warn {
		background: rgba(245, 181, 68, 0.34);
	}

	.ll-top__conn--pending {
		background: rgba(255, 255, 255, 0.22);
	}

	.ll-top__conn-text {
		font-size: 10px;
		color: #f2fff8;
	}

	.ll-top__phase {
		padding: 3px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.26);
	}

	.ll-top__phase-text {
		font-size: 11px;
		color: #fff3ec;
	}

	.ll-bottom-cards {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.ll-bottom-cards__label {
		font-size: 11px;
		color: rgba(255, 240, 230, 0.8);
	}

	.ll-bottom-cards__list {
		display: flex;
		gap: 3px;
	}

	.ll-board {
		position: relative;
		z-index: 2;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 4px 14px;
		min-height: 0;
	}

	.ll-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 116px;
		flex-shrink: 0;
	}

	.ll-played {
		display: flex;
		justify-content: center;
		gap: 2px;
	}

	.ll-played--side {
		flex-wrap: wrap;
		max-width: 116px;
	}

	.ll-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 0;
	}

	.ll-center__waiting {
		padding: 14px 20px;
		border-radius: 14px;
		background: rgba(0, 0, 0, 0.2);
		text-align: center;
	}

	.ll-center__waiting-title {
		display: block;
		font-size: 14px;
		font-weight: 700;
		color: #fff3ec;
	}

	.ll-center__waiting-desc {
		display: block;
		margin-top: 4px;
		font-size: 11px;
		color: rgba(255, 240, 230, 0.82);
	}

	.ll-center__timer {
		min-height: 26px;
	}

	.ll-center__play {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		min-height: 62px;
		min-width: 150px;
		padding: 4px 10px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.14);
	}

	.ll-center__play-hint {
		font-size: 12px;
		color: rgba(255, 244, 235, 0.72);
	}

	.ll-center__combo {
		font-size: 11px;
		color: #ffe6cf;
	}

	.ll-center__multiplier {
		font-size: 11px;
		color: #ffd9a8;
	}

	.ll-center__turn {
		padding: 3px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.22);
	}

	.ll-center__turn-text {
		font-size: 11px;
		color: #fff3ec;
	}

	.ll-bottom {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 2px 16px 12px;
	}

	.ll-mybar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.ll-mybar__info {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 150px;
	}

	.ll-mybar__count {
		font-size: 11px;
		color: #fff3ec;
	}

	.ll-mybar__notice {
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(245, 181, 68, 0.34);
	}

	.ll-mybar__notice-text {
		font-size: 10px;
		color: #fff6e2;
	}

	.ll-hand {
		flex: 1;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		min-width: 0;
		min-height: 96px;
	}

	.ll-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.ll-action {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 60px;
		height: 34px;
		padding: 0 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.24);
	}

	.ll-action--wide {
		min-width: 150px;
	}

	.ll-action--primary {
		background: linear-gradient(135deg, #ffd08a 0%, #f2a25c 100%);
		box-shadow: 0 4px 12px rgba(120, 60, 30, 0.28);
	}

	.ll-action--on {
		background: rgba(245, 181, 68, 0.5);
	}

	.ll-action--disabled {
		opacity: 0.45;
	}

	.ll-action__text {
		font-size: 13px;
		font-weight: 600;
		color: #5a3427;
	}

	.ll-action__text--ghost {
		color: #fff6ef;
	}

	.ll-join {
		padding: 28px 28px 24px;
		background: #ffffff;
	}

	.ll-join__title {
		display: block;
		font-size: 20px;
		font-weight: 700;
		color: #5a3427;
	}

	.ll-join__desc {
		display: block;
		margin: 8px 0 16px;
		font-size: 12px;
		color: #8b6659;
	}

	.ll-join__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		margin-top: 16px;
		border-radius: 999px;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	}

	.ll-join__btn-text {
		font-size: 15px;
		font-weight: 700;
		color: #ffffff;
	}
</style>
