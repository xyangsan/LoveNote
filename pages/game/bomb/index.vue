<template>
	<view class="bomb-page">
		<view class="bomb-page__glow bomb-page__glow--left"></view>
		<view class="bomb-page__glow bomb-page__glow--right"></view>

		<!-- 自绘顶栏：navigationStyle 为 custom，需自行避让状态栏与右上角胶囊 -->
		<view class="bomb-navbar" :style="navBarStyle">
			<view class="bomb-navbar__inner">
				<view class="bomb-navbar__back" :style="{ marginLeft: navBar.leftInset + 'px' }" @click="handleBack">
					<text class="bomb-navbar__back-text">‹</text>
				</view>
				<view class="bomb-navbar__title-wrap">
					<text class="bomb-navbar__title">数字炸弹</text>
				</view>
				<view class="bomb-navbar__rule" :style="{ marginRight: navBar.rightInset + 'px' }" @click="handleShowRules">
					<text class="bomb-navbar__rule-text">?</text>
				</view>
			</view>
		</view>

		<view class="bomb-layer">
			<!-- ============ 设置阶段 ============ -->
			<template v-if="phase === 'setup'">
				<view class="bomb-hero">
					<text class="bomb-hero__emoji">💣</text>
					<text class="bomb-hero__title">选个范围，开始埋雷</text>
					<text class="bomb-hero__desc">开始后系统会在范围内随机埋下一个数字，猜中即爆炸。</text>
				</view>

				<love-glass-card :margin="['0', '0', '0', '0']" :header-line="false" :padding="['22rpx', '24rpx']">
					<text class="bomb-label">数字范围上限</text>
					<fui-segmented-control
						:values="limitLabels"
						:current="limitIndex"
						type="button"
						color="#ec7558"
						active-color="#ffffff"
						:height="72"
						:size="26"
						:radius="999"
						:bold="true"
						:margin-top="16"
						@click="handleLimitSelect"
					></fui-segmented-control>

					<view v-if="isCustomLimit" class="bomb-custom">
						<text class="bomb-label">自定义上限（{{ minLimit }}~{{ maxLimit }}）</text>
						<fui-input
							type="number"
							placeholder="请输入范围上限"
							:value="customLimitText"
							:size="30"
							:radius="20"
							background-color="#fffaf7"
							color="#5a3427"
							:padding="['20rpx', '24rpx']"
							@input="handleCustomLimitInput"
						></fui-input>
					</view>

					<view class="bomb-players">
						<text class="bomb-label">玩家人数（多人时同一台设备轮流猜）</text>
						<view class="bomb-stepper">
							<view
								class="bomb-stepper__btn"
								:class="{ 'bomb-stepper__btn--disabled': playerCount <= minPlayers }"
								@click="handlePlayerCountChange(-1)"
							>
								<text class="bomb-stepper__btn-text">−</text>
							</view>
							<text class="bomb-stepper__value">{{ playerCount }}</text>
							<view
								class="bomb-stepper__btn"
								:class="{ 'bomb-stepper__btn--disabled': playerCount >= maxPlayers }"
								@click="handlePlayerCountChange(1)"
							>
								<text class="bomb-stepper__btn-text">+</text>
							</view>
						</view>
					</view>
				</love-glass-card>

				<view v-if="hasProgress" class="bomb-resume" @click="handleResumeProgress">
					<text class="bomb-resume__title">检测到上一局没玩完</text>
					<text class="bomb-resume__desc">区间 {{ progressSummary }}，点这里继续</text>
				</view>

				<view class="bomb-actions">
					<fui-button
						text="开始游戏"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						height="92rpx"
						radius="999rpx"
						:size="32"
						:bold="true"
						@click="handleStart"
					/>
					<view class="bomb-actions__link" @click="handleShowRules">
						<text class="bomb-actions__link-text">查看玩法说明</text>
					</view>
				</view>
			</template>

			<!-- ============ 游戏阶段 ============ -->
			<template v-else-if="phase === 'playing'">
				<view class="bomb-range">
					<text class="bomb-range__label">当前范围</text>
					<view class="bomb-range__row">
						<text class="bomb-range__value">{{ game.rangeMin }}</text>
						<text class="bomb-range__tilde">~</text>
						<text class="bomb-range__value">{{ game.rangeMax }}</text>
					</view>
					<text class="bomb-range__hint">还剩 {{ remainingCount }} 种可能 · 已猜 {{ game.guessCount }} 次</text>
				</view>

				<view v-if="playerCount > 1" class="bomb-turn">
					<text class="bomb-turn__label">轮到</text>
					<text class="bomb-turn__name">{{ currentPlayerName }}</text>
					<text class="bomb-turn__timer">{{ elapsedText }}</text>
				</view>
				<view v-else class="bomb-turn bomb-turn--single">
					<text class="bomb-turn__label">用时</text>
					<text class="bomb-turn__timer">{{ elapsedText }}</text>
				</view>

				<view v-if="lastMessage" class="bomb-message" :class="'bomb-message--' + lastTone">
					<text class="bomb-message__text">{{ lastMessage }}</text>
				</view>

				<scroll-view v-if="game.guesses.length" class="bomb-history" scroll-x>
					<view class="bomb-history__inner">
						<view
							v-for="(item, index) in game.guesses"
							:key="index"
							class="bomb-history__chip"
							:class="{ 'bomb-history__chip--low': item.value < previousBombHint }"
						>
							<text class="bomb-history__chip-text">{{ item.value }}</text>
						</view>
					</view>
				</scroll-view>

				<view class="bomb-input-card">
					<fui-input
						type="number"
						:placeholder="inputPlaceholder"
						:value="guessText"
						:size="34"
						:radius="20"
						background-color="#fffaf7"
						color="#5a3427"
						:padding="['22rpx', '24rpx']"
						@input="handleGuessInput"
						@confirm="handleGuess"
					></fui-input>
					<view class="bomb-input-card__action" @click="handleGuess">
						<text class="bomb-input-card__action-text">引爆</text>
					</view>
				</view>

				<view class="bomb-tools">
					<view class="bomb-tools__item" @click="handleQuickGuess('mid')">
						<text class="bomb-tools__text">猜中点</text>
					</view>
					<view class="bomb-tools__item" @click="handleShowRules">
						<text class="bomb-tools__text">规则</text>
					</view>
					<view class="bomb-tools__item" @click="handleQuit">
						<text class="bomb-tools__text">结束本局</text>
					</view>
				</view>
			</template>
		</view>

		<!-- 爆炸动画层 -->
		<view v-if="exploding" class="bomb-boom">
			<text class="bomb-boom__emoji">💥</text>
		</view>

		<!-- 结算 -->
		<love-game-result-dialog
			:show="resultVisible"
			tone="success"
			emoji="💥"
			:title="resultTitle"
			:subtitle="resultSubtitle"
			:lines="resultLines"
			:players="resultPlayers"
			:tips="resultTips"
			primary-text="再来一局"
			secondary-text="返回大厅"
			@primary="handleRestart"
			@secondary="handleBackToHall"
		></love-game-result-dialog>

		<love-game-rules
			:show="rulesVisible"
			game-type="bomb"
			@close="rulesVisible = false"
		></love-game-rules>
	</view>
</template>

<script>
	import LoveGameRules from '@/components/love-game-rules/love-game-rules.vue'
	import LoveGameResultDialog from '@/components/love-game-result-dialog/love-game-result-dialog.vue'
	import LoveGlassCard from '@/components/love-glass-card/love-glass-card.vue'
	import { getGameApi } from '@/common/api/game.js'
	import {
		createBombGame,
		startBombGame,
		submitGuess,
		restartBombGame,
		updateRangeLimit,
		validateRangeLimit,
		normalizePlayerCount,
		buildRecordPayload,
		serializeGame,
		deserializeGame,
		getRemainingCount,
		RANGE_PRESETS,
		MIN_RANGE_LIMIT,
		MAX_RANGE_LIMIT,
		DEFAULT_RANGE_LIMIT,
		MIN_PLAYERS,
		MAX_PLAYERS,
		GUESS_RESULT,
		PHASE_SETUP,
		PHASE_PLAYING,
		PHASE_EXPLODED
	} from '@/common/game/bomb.js'
	import {
		saveBombProgress,
		getBombProgress,
		clearBombProgress,
		hasSeenRules,
		markRulesSeen
	} from '@/common/game/active-room.js'
	import { formatGameDuration } from '@/store/modules/game.js'
	import { useAppStateStore } from '@/store/app-state.js'
	import { hasValidLogin } from '@/common/auth-center.js'
	import { getNavBarMetrics, buildNavBarStyle } from '@/common/utils/nav-bar.js'

	export default {
		components: {
			LoveGameRules,
			LoveGameResultDialog,
			LoveGlassCard
		},
		data() {
			return {
				appStateStore: null,
				// 状态栏 + 右上角胶囊的安全区，自定义顶栏靠它定位
				navBar: getNavBarMetrics(),
				phase: PHASE_SETUP,
				game: createBombGame({ rangeLimit: DEFAULT_RANGE_LIMIT }),
				limitLabels: ['1~100', '1~200', '1~500', '1~1000', '自定义'],
				limitIndex: 0,
				isCustomLimit: false,
				customLimitText: '',
				playerCount: 1,
				guessText: '',
				lastMessage: '',
				lastTone: 'normal',
				previousBombHint: 0,
				elapsedSeconds: 0,
				timer: null,
				exploding: false,
				resultVisible: false,
				resultData: null,
				rulesVisible: false,
				minLimit: MIN_RANGE_LIMIT,
				maxLimit: MAX_RANGE_LIMIT,
				minPlayers: MIN_PLAYERS,
				maxPlayers: MAX_PLAYERS,
				savedProgressRaw: ''
			}
		},
		computed: {
			navBarStyle() {
				return buildNavBarStyle(this.navBar)
			},
			isLoggedIn() {
				const userInfo = this.appStateStore ? this.appStateStore.userInfo : null
				return Boolean(userInfo && userInfo._id) || hasValidLogin()
			},
			currentUid() {
				const userInfo = this.appStateStore ? this.appStateStore.userInfo : null
				return userInfo && userInfo._id ? String(userInfo._id) : 'guest'
			},
			remainingCount() {
				return getRemainingCount(this.game)
			},
			inputPlaceholder() {
				return `输入 ${this.game.rangeMin} ~ ${this.game.rangeMax} 之间的数字`
			},
			currentPlayerName() {
				const players = this.game.players || []
				const index = Number(this.game.currentPlayerIndex) || 0
				const player = players[index]
				return player ? player.name : '玩家'
			},
			elapsedText() {
				const total = Math.max(0, Number(this.elapsedSeconds) || 0)
				const minute = Math.floor(total / 60)
				const second = total % 60
				return `${minute}:${`${second}`.padStart(2, '0')}`
			},
			hasProgress() {
				return Boolean(this.savedProgressRaw)
			},
			progressSummary() {
				const restored = deserializeGame(this.savedProgressRaw)
				if (!restored) {
					return ''
				}
				return `${restored.rangeMin} ~ ${restored.rangeMax}`
			},
			resultTitle() {
				const data = this.resultData
				if (!data) {
					return '踩到炸弹了'
				}
				if ((data.players || []).length > 1) {
					return `${data.loserName} 踩到炸弹了`
				}
				return '踩到炸弹了'
			},
			resultSubtitle() {
				const data = this.resultData
				return data ? `炸弹数字是 ${data.bombNumber}` : ''
			},
			resultLines() {
				const data = this.resultData
				if (!data) {
					return []
				}
				return [
					{ label: '炸弹数字', value: String(data.bombNumber), highlight: true },
					{ label: '总共猜了', value: `${data.guessCount} 次` },
					{ label: '用时', value: formatGameDuration(data.duration) },
					{ label: '范围上限', value: `1 ~ ${data.rangeLimit}` }
				]
			},
			resultPlayers() {
				const data = this.resultData
				if (!data || (data.players || []).length <= 1) {
					return []
				}
				return data.players.map((item, index) => ({
					nickname: item.name,
					avatarUrl: item.avatarUrl,
					roleText: index === data.loserIndex ? '踩到炸弹' : '躲过一劫',
					scoreText: index === data.loserIndex ? '雷' : '过',
					result: index === data.loserIndex ? 'lose' : 'win',
					isSelf: index === 0
				}))
			},
			resultTips() {
				const data = this.resultData
				if (!data) {
					return ''
				}
				if ((data.players || []).length > 1) {
					return '下一局换个顺序，看看谁的运气更差。'
				}
				return this.isLoggedIn
					? '这一局已经记进战绩了，去「全部」里看看你的记录。'
					: '登录后这一局就会自动记进战绩。'
			}
		},
		onLoad() {
			this.ensureAppStateStore()
			this.refreshNavBar()
			this.syncPlayerCountFromGame()
			this.loadSavedProgress()

			if (!hasSeenRules('bomb')) {
				this.rulesVisible = true
				markRulesSeen('bomb')
			}
		},
		onUnload() {
			this.stopTimer()
		},
		onHide() {
			this.stopTimer()
			this.persistProgress()
		},
		onShow() {
			this.refreshNavBar()
			if (this.phase === PHASE_PLAYING) {
				this.startTimer()
			}
		},
		methods: {
			refreshNavBar() {
				const next = getNavBarMetrics()
				const current = this.navBar
				if (
					current
					&& current.statusBarHeight === next.statusBarHeight
					&& current.barHeight === next.barHeight
					&& current.leftInset === next.leftInset
					&& current.rightInset === next.rightInset
				) {
					return
				}
				this.navBar = next
			},
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			syncPlayerCountFromGame() {
				this.playerCount = normalizePlayerCount((this.game.players || []).length || 1)
			},
			loadSavedProgress() {
				const raw = getBombProgress(this.currentUid)
				this.savedProgressRaw = raw || ''
			},
			persistProgress() {
				if (this.phase !== PHASE_PLAYING) {
					return
				}
				saveBombProgress(this.currentUid, serializeGame(this.game))
				this.loadSavedProgress()
			},
			clearProgress() {
				clearBombProgress(this.currentUid)
				this.savedProgressRaw = ''
			},
			startTimer() {
				this.stopTimer()
				if (this.game.startedAt) {
					this.elapsedSeconds = Math.max(
						0,
						Math.floor((Date.now() - Number(this.game.startedAt)) / 1000)
					)
				}
				this.timer = setInterval(() => {
					if (!this.game.startedAt) {
						return
					}
					this.elapsedSeconds = Math.max(
						0,
						Math.floor((Date.now() - Number(this.game.startedAt)) / 1000)
					)
				}, 1000)
			},
			stopTimer() {
				if (this.timer) {
					clearInterval(this.timer)
					this.timer = null
				}
			},
			handleBack() {
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
			handleShowRules() {
				this.rulesVisible = true
			},
			handleLimitSelect(event = {}) {
				const index = Number(event.index)
				if (!Number.isInteger(index) || index < 0) {
					return
				}
				this.limitIndex = index
				if (index === this.limitLabels.length - 1) {
					this.isCustomLimit = true
					return
				}
				this.isCustomLimit = false
				this.customLimitText = ''
				const limit = RANGE_PRESETS[index] || DEFAULT_RANGE_LIMIT
				this.game = updateRangeLimit(this.game, limit)
			},
			handleCustomLimitInput(event = '') {
				const value = this.resolveInputText(event)
				this.customLimitText = value
				const check = validateRangeLimit(value)
				if (check.ok) {
					this.game = updateRangeLimit(this.game, check.value)
				}
			},
			/** 与 room.vue 的 resolveInputText 同口径：fui-input 的 input 事件回传原始字符串 */
			resolveInputText(value = '') {
				if (value && typeof value === 'object') {
					value = value.detail
				}
				if (value && typeof value === 'object') {
					value = value.value
				}
				return value === null || value === undefined ? '' : String(value)
			},
			handlePlayerCountChange(delta = 0) {
				const next = normalizePlayerCount(this.playerCount + Number(delta || 0))
				if (next === this.playerCount) {
					return
				}
				this.playerCount = next
				this.game = createBombGame({
					rangeLimit: this.game.rangeLimit,
					playerCount: next
				})
			},
			handleStart() {
				if (this.isCustomLimit) {
					const check = validateRangeLimit(this.customLimitText)
					if (!check.ok) {
						uni.showToast({
							title: check.message,
							icon: 'none'
						})
						return
					}
					this.game = updateRangeLimit(this.game, check.value)
				}

				const players = Array.from({ length: this.playerCount }).map((item, index) => ({
					name: index === 0 && this.playerCount > 1 ? '玩家1' : (this.playerCount > 1 ? `玩家${index + 1}` : '我'),
					avatarUrl: ''
				}))

				this.game = startBombGame(
					createBombGame({
						rangeLimit: this.game.rangeLimit,
						players
					})
				)
				this.phase = PHASE_PLAYING
				this.guessText = ''
				this.lastMessage = `炸弹已埋好，${this.game.rangeMin} ~ ${this.game.rangeMax} 开始猜吧`
				this.lastTone = 'normal'
				this.previousBombHint = 0
				this.resultVisible = false
				this.exploding = false
				this.startTimer()
				this.persistProgress()
			},
			handleGuessInput(event = '') {
				this.guessText = this.resolveInputText(event)
			},
			handleQuickGuess(type = '') {
				if (type !== 'mid') {
					return
				}
				const mid = Math.floor((Number(this.game.rangeMin) + Number(this.game.rangeMax)) / 2)
				this.guessText = String(mid)
				this.handleGuess()
			},
			handleGuess() {
				if (this.phase !== PHASE_PLAYING) {
					return
				}
				const raw = this.guessText
				if (String(raw || '').trim() === '') {
					uni.showToast({
						title: '先输入一个数字',
						icon: 'none'
					})
					return
				}

				const outcome = submitGuess(this.game, raw)
				if (outcome.result === GUESS_RESULT.OUT_OF_RANGE || outcome.result === GUESS_RESULT.INVALID) {
					this.lastMessage = outcome.message
					this.lastTone = 'warn'
					uni.showToast({
						title: outcome.message,
						icon: 'none'
					})
					return
				}

				this.game = outcome.game
				this.guessText = ''

				if (outcome.result === GUESS_RESULT.HIT) {
					this.handleExplode()
					return
				}

				this.lastMessage = outcome.message
				this.lastTone = outcome.result === GUESS_RESULT.LOW ? 'low' : 'high'
				this.previousBombHint = Number(outcome.game.lastResult.value) || 0
				this.persistProgress()
			},
			handleExplode() {
				this.stopTimer()
				this.clearProgress()
				this.exploding = true

				const game = this.game
				const players = game.players || []
				const loserIndex = Number((game.lastResult || {}).playerIndex || 0)

				this.resultData = {
					bombNumber: game.bombNumber,
					guessCount: game.guessCount,
					duration: game.elapsedMs,
					rangeLimit: game.rangeLimit,
					players,
					loserIndex,
					loserName: players.length > 1
						? (players[loserIndex] || {}).name || '玩家'
						: '你'
				}

				setTimeout(() => {
					this.exploding = false
					this.resultVisible = true
				}, 700)

				this.reportRecord()
			},
			async reportRecord() {
				if (!this.isLoggedIn) {
					return
				}
				try {
					await getGameApi().reportRecord(buildRecordPayload(this.game))
				} catch (error) {
					// 战绩上报失败不打扰玩家
					console.warn('reportRecord failed', error)
				}
			},
			handleRestart() {
				this.resultVisible = false
				this.game = restartBombGame(this.game)
				this.phase = PHASE_PLAYING
				this.guessText = ''
				this.lastMessage = `新的一局，范围 ${this.game.rangeMin} ~ ${this.game.rangeMax}`
				this.lastTone = 'normal'
				this.previousBombHint = 0
				this.resultData = null
				this.elapsedSeconds = 0
				this.startTimer()
				this.persistProgress()
			},
			handleQuit() {
				uni.showModal({
					title: '结束本局',
					content: '结束后不会记录战绩，确定吗？',
					success: (res) => {
						if (!res.confirm) {
							return
						}
						this.stopTimer()
						this.clearProgress()
						this.phase = PHASE_SETUP
						this.game = createBombGame({
							rangeLimit: this.game.rangeLimit,
							playerCount: this.playerCount
						})
						this.syncPlayerCountFromGame()
						this.lastMessage = ''
						this.lastTone = 'normal'
						this.guessText = ''
					}
				})
			},
			handleResumeProgress() {
				const restored = deserializeGame(this.savedProgressRaw)
				if (!restored) {
					this.clearProgress()
					return
				}
				this.game = restored
				this.phase = PHASE_PLAYING
				this.playerCount = normalizePlayerCount((restored.players || []).length || 1)
				this.lastMessage = `继续上一局，范围 ${restored.rangeMin} ~ ${restored.rangeMax}`
				this.lastTone = 'normal'
				this.startTimer()
			}
		}
	}
</script>

<style>
	.bomb-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding: 0 24rpx 60rpx;
		overflow: hidden;
	}

	.bomb-page__glow {
		position: absolute;
		width: 320rpx;
		height: 320rpx;
		border-radius: 50%;
		filter: blur(28rpx);
		opacity: 0.42;
		z-index: 0;
		pointer-events: none;
	}

	.bomb-page__glow--left {
		top: -90rpx;
		left: -120rpx;
		background: rgba(255, 180, 160, 0.48);
	}

	.bomb-page__glow--right {
		top: 260rpx;
		right: -120rpx;
		background: rgba(255, 220, 174, 0.48);
	}

	.bomb-navbar {
		position: relative;
		z-index: 1;
		box-sizing: border-box;
		/* 负 margin 抵消 .bomb-page 的左右 24rpx 内边距，让顶栏通屏；
		   height / padding 全部由 navBarStyle 按状态栏与胶囊位置实时给出 */
		margin: 0 -24rpx;
	}

	.bomb-navbar__inner {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 100%;
	}

	.bomb-navbar__title-wrap {
		position: absolute;
		top: 0;
		/* 左右对称留白（> 按钮宽度 64rpx + 页面 24rpx 边距），
		   这样标题层既不压住左右按钮，又始终相对屏幕居中 */
		right: 100rpx;
		bottom: 0;
		left: 100rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		/* 标题纯展示，别挡住左右两个按钮的点击 */
		pointer-events: none;
	}

	.bomb-navbar__back,
	.bomb-navbar__rule {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 10rpx 24rpx rgba(168, 110, 80, 0.12);
	}

	.bomb-navbar__back-text {
		font-size: 40rpx;
		line-height: 1;
		color: #b05b48;
	}

	.bomb-navbar__rule-text {
		font-size: 28rpx;
		font-weight: 700;
		color: #b98069;
	}

	.bomb-navbar__title {
		font-size: 32rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.bomb-layer {
		position: relative;
		z-index: 1;
		padding-top: 18rpx;
	}

	.bomb-hero {
		padding: 26rpx 12rpx 34rpx;
		text-align: center;
	}

	.bomb-hero__emoji {
		display: block;
		font-size: 96rpx;
		line-height: 1;
	}

	.bomb-hero__title {
		display: block;
		margin-top: 22rpx;
		font-size: 40rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.bomb-hero__desc {
		display: block;
		margin-top: 14rpx;
		font-size: 25rpx;
		line-height: 1.7;
		color: #8b6659;
	}

	.bomb-label {
		display: block;
		margin-bottom: 14rpx;
		font-size: 24rpx;
		color: #936d62;
	}

	.bomb-custom {
		margin-top: 26rpx;
	}

	.bomb-players {
		margin-top: 30rpx;
	}

	.bomb-stepper {
		display: flex;
		align-items: center;
		gap: 24rpx;
	}

	.bomb-stepper__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 72rpx;
		height: 72rpx;
		border-radius: 22rpx;
		background: rgba(255, 241, 235, 0.96);
	}

	.bomb-stepper__btn--disabled {
		opacity: 0.4;
	}

	.bomb-stepper__btn-text {
		font-size: 36rpx;
		font-weight: 700;
		color: #b05b48;
	}

	.bomb-stepper__value {
		min-width: 70rpx;
		font-size: 36rpx;
		font-weight: 700;
		color: #5a3427;
		text-align: center;
	}

	.bomb-resume {
		margin-top: 24rpx;
		padding: 24rpx 28rpx;
		border-radius: 28rpx;
		background: rgba(255, 235, 222, 0.96);
	}

	.bomb-resume__title {
		display: block;
		font-size: 27rpx;
		font-weight: 700;
		color: #a5523c;
	}

	.bomb-resume__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #9a6c5c;
	}

	.bomb-actions {
		margin-top: 34rpx;
	}

	.bomb-actions__link {
		margin-top: 22rpx;
		text-align: center;
	}

	.bomb-actions__link-text {
		font-size: 24rpx;
		color: #b98069;
		text-decoration: underline;
	}

	/* ---------- playing ---------- */

	.bomb-range {
		padding: 30rpx 28rpx;
		border-radius: 34rpx;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.1);
		text-align: center;
	}

	.bomb-range__label {
		display: block;
		font-size: 23rpx;
		letter-spacing: 4rpx;
		color: #b98069;
	}

	.bomb-range__row {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 20rpx;
		margin-top: 14rpx;
	}

	.bomb-range__value {
		font-size: 68rpx;
		font-weight: 700;
		line-height: 1.1;
		color: #5a3427;
	}

	.bomb-range__tilde {
		font-size: 40rpx;
		color: #c9a99a;
	}

	.bomb-range__hint {
		display: block;
		margin-top: 14rpx;
		font-size: 23rpx;
		color: #917165;
	}

	.bomb-turn {
		display: flex;
		align-items: center;
		gap: 16rpx;
		margin-top: 22rpx;
		padding: 20rpx 28rpx;
		border-radius: 26rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.bomb-turn--single {
		justify-content: space-between;
	}

	.bomb-turn__label {
		font-size: 23rpx;
		color: #a07b70;
	}

	.bomb-turn__name {
		flex: 1;
		font-size: 28rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.bomb-turn__timer {
		font-size: 26rpx;
		font-weight: 700;
		color: #c0674d;
	}

	.bomb-message {
		margin-top: 22rpx;
		padding: 22rpx 28rpx;
		border-radius: 26rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.bomb-message--low {
		background: rgba(226, 241, 233, 0.96);
	}

	.bomb-message--high {
		background: rgba(255, 235, 222, 0.96);
	}

	.bomb-message--warn {
		background: rgba(255, 240, 214, 0.98);
	}

	.bomb-message__text {
		font-size: 26rpx;
		line-height: 1.6;
		color: #6d473a;
	}

	.bomb-history {
		margin-top: 22rpx;
		white-space: nowrap;
	}

	.bomb-history__inner {
		display: inline-flex;
		align-items: center;
		padding: 4rpx 2rpx;
	}

	.bomb-history__chip {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 76rpx;
		height: 56rpx;
		margin-right: 14rpx;
		padding: 0 16rpx;
		border-radius: 18rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 8rpx 20rpx rgba(168, 110, 80, 0.08);
	}

	.bomb-history__chip-text {
		font-size: 26rpx;
		font-weight: 600;
		color: #8b6659;
	}

	.bomb-input-card {
		display: flex;
		align-items: center;
		gap: 18rpx;
		margin-top: 28rpx;
	}

	.bomb-input-card__action {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 168rpx;
		height: 92rpx;
		border-radius: 24rpx;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 14rpx 26rpx rgba(231, 111, 81, 0.26);
	}

	.bomb-input-card__action-text {
		font-size: 30rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.bomb-tools {
		display: flex;
		gap: 18rpx;
		margin-top: 26rpx;
	}

	.bomb-tools__item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 76rpx;
		border-radius: 22rpx;
		background: rgba(255, 247, 243, 0.96);
	}

	.bomb-tools__text {
		font-size: 25rpx;
		color: #b05b48;
	}

	/* ---------- 爆炸动画 ---------- */

	.bomb-boom {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1400;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(circle, rgba(255, 196, 140, 0.6) 0%, rgba(231, 111, 81, 0.32) 45%, rgba(120, 60, 40, 0.5) 100%);
		animation: bomb-boom-fade 700ms ease-out forwards;
	}

	.bomb-boom__emoji {
		font-size: 200rpx;
		animation: bomb-boom-scale 700ms cubic-bezier(0.22, 1.2, 0.36, 1) forwards;
	}

	@keyframes bomb-boom-scale {
		0% {
			transform: scale(0.2) rotate(-8deg);
			opacity: 0;
		}
		45% {
			transform: scale(1.35) rotate(6deg);
			opacity: 1;
		}
		100% {
			transform: scale(1.9) rotate(0deg);
			opacity: 0.85;
		}
	}

	@keyframes bomb-boom-fade {
		0% {
			opacity: 0;
		}
		25% {
			opacity: 1;
		}
		100% {
			opacity: 0.92;
		}
	}
</style>
