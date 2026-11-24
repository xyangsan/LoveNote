<template>
	<view class="nb-page">
		<view class="nb-glow nb-glow--left"></view>
		<view class="nb-glow nb-glow--right"></view>

		<noir-navbar
			title="数字炸弹"
			:show-back="true"
			:custom-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
			@back="handleBack"
		>
			<template #right>
				<view
					v-if="phase === 'playing'"
					class="nb-pill-act"
					@tap="handleConfirmRestart"
				>
					<text class="nb-pill-act__txt">重开</text>
				</view>
				<view
					v-else
					class="nb-pill-act"
					@tap="handleShowRules"
				>
					<text class="nb-pill-act__txt">规则</text>
				</view>
			</template>
		</noir-navbar>

		<view class="nb-wrap">
			<!-- ============ 设置阶段 ============ -->
			<template v-if="phase === 'setup'">
				<view class="nb-setup-hero">
					<text class="nb-kicker">NUMBER BOMB · 单机同设备</text>
					<text class="nb-setup-hero__title">选个范围，开始埋雷</text>
					<text class="nb-setup-hero__desc">系统会在范围内随机埋下一个炸弹数字，轮流猜数收窄区间，踩中即触发结算。</text>
				</view>

				<view v-if="hasProgress" class="nb-resume" @tap="handleResumeProgress">
					<view class="nb-resume__info">
						<text class="nb-resume__title">检测到上一局尚未结束</text>
						<text class="nb-resume__desc">安全区间 {{ progressSummary }} · 点击继续</text>
					</view>
					<view class="nb-resume__btn">
						<text class="nb-resume__btn-txt">继续</text>
					</view>
				</view>

				<view class="nb-card">
					<!-- 范围上限 -->
					<view class="nb-section">
						<view class="nb-section__head">
							<text class="nb-section__label">数字范围上限</text>
							<text class="nb-section__val">1 ~ {{ limitPreview || game.rangeLimit }}</text>
						</view>
						<view class="nb-presets">
							<view
								v-for="preset in rangePresets"
								:key="preset"
								class="nb-chip"
								:class="{ 'nb-chip--active': (limitPreview || game.rangeLimit) === preset }"
								@tap="handleSelectPreset(preset)"
							>
								<text class="nb-chip__txt">1~{{ preset }}</text>
							</view>
						</view>
						<uv-slider
							class="nb-slider"
							:value="game.rangeLimit"
							:min="minLimit"
							:max="maxLimit"
							:step="limitStep"
							active-color="#E2643F"
							background-color="rgba(255, 255, 255, 0.12)"
							block-color="#FBF4EA"
							:block-size="24"
							@changing="handleLimitChanging"
							@change="handleLimitChange"
						></uv-slider>
						<view class="nb-scale">
							<text class="nb-scale__txt">{{ minLimit }}</text>
							<text class="nb-scale__txt">{{ maxLimit }}</text>
						</view>
					</view>

					<view class="nb-divider"></view>

					<!-- 玩家人数 -->
					<view class="nb-section">
						<view class="nb-section__head">
							<text class="nb-section__label">玩家人数</text>
							<text class="nb-section__sub">{{ playerCount > 1 ? '同设备轮流传递' : '单人挑战模式' }}</text>
						</view>
						<view class="nb-player-row">
							<view class="nb-presets nb-presets--inline">
								<view
									v-for="n in quickPlayerCounts"
									:key="n"
									class="nb-chip"
									:class="{ 'nb-chip--active': playerCount === n }"
									@tap="handleSelectPlayerCount(n)"
								>
									<text class="nb-chip__txt">{{ n }} 人</text>
								</view>
							</view>
							<view class="nb-stepper">
								<view
									class="nb-stepper__btn"
									:class="{ 'nb-stepper__btn--disabled': playerCount <= minPlayers }"
									@tap="handlePlayerCountChange(-1)"
								>
									<text class="nb-stepper__btn-txt">−</text>
								</view>
								<text class="nb-stepper__val">{{ playerCount }}</text>
								<view
									class="nb-stepper__btn"
									:class="{ 'nb-stepper__btn--disabled': playerCount >= maxPlayers }"
									@tap="handlePlayerCountChange(1)"
								>
									<text class="nb-stepper__btn-txt">+</text>
								</view>
							</view>
						</view>
					</view>
				</view>

				<view class="nb-actions">
					<view class="nb-cta" hover-class="nb-cta--hover" @tap="handleStart">
						<text class="nb-cta__txt">开始埋雷</text>
					</view>
					<view class="nb-actions__link" @tap="handleShowRules">
						<text class="nb-actions__link-txt">查看玩法说明</text>
					</view>
				</view>
			</template>

			<!-- ============ 游戏阶段（对标 NOIR v3 设计稿 s10） ============ -->
			<template v-else-if="phase === 'playing'">
				<!-- 顶部模式信息条 -->
				<view class="nb-bar">
					<text class="nb-bar__txt">模式：{{ playerCount > 1 ? '单机同设备轮流' : '单人挑战' }}</text>
					<text class="nb-bar__txt">人数 {{ playerCount }} 人 · 范围 1~{{ game.rangeLimit }} · {{ elapsedText }}</text>
				</view>

				<!-- 安全区间主卡片 -->
				<view class="nb-range">
					<text class="nb-kicker">SAFE RANGE · 避开炸弹数字</text>
					<view class="nb-nums">
						<text class="nb-nums__val">{{ game.rangeMin }}</text>
						<text class="nb-nums__dash">—</text>
						<text class="nb-nums__val">{{ game.rangeMax }}</text>
					</view>
					<view class="nb-turn">
						<text v-if="playerCount > 1" class="nb-turn__txt">当前轮到：{{ currentPlayerName }} · 请传递手机</text>
						<text v-else class="nb-turn__txt">还剩 {{ remainingCount }} 个可能 · 已猜 {{ game.guessCount }} 次</text>
					</view>
					<text
						v-if="lastMessage"
						class="nb-feedback"
						:class="'nb-feedback--' + lastTone"
					>{{ lastMessage }}</text>
				</view>

				<!-- 输入展示框 -->
				<view class="nb-input-box">
					<text
						class="nb-input-box__val"
						:class="{ 'nb-input-box__val--empty': !guessText }"
					>{{ guessText || '—' }}</text>
					<view class="nb-input-box__right">
						<text class="nb-input-box__hint">输入 {{ game.rangeMin }} ~ {{ game.rangeMax }} 之间的整数</text>
						<view
							v-if="guessText"
							class="nb-backspace"
							hover-class="nb-backspace--hover"
							@tap="handleKeypadDelete"
						>
							<text class="nb-backspace__txt">⌫</text>
						</view>
					</view>
				</view>

				<!-- 内置数字键盘 3x4 -->
				<view class="nb-pad">
					<view
						v-for="digit in padDigitsTop"
						:key="digit"
						class="nb-key"
						hover-class="nb-key--hover"
						@tap="handleKeypadDigit(digit)"
					>
						<text class="nb-key__txt">{{ digit }}</text>
					</view>
					<view
						class="nb-key nb-key--fn"
						hover-class="nb-key--hover"
						@tap="handleKeypadClear"
					>
						<text class="nb-key__txt nb-key__txt--fn">清空</text>
					</view>
					<view
						class="nb-key"
						hover-class="nb-key--hover"
						@tap="handleKeypadDigit('0')"
					>
						<text class="nb-key__txt">0</text>
					</view>
					<view
						class="nb-key nb-key--ok"
						hover-class="nb-key--ok-hover"
						@tap="handleGuess"
					>
						<text class="nb-key__txt nb-key__txt--ok">确认猜数</text>
					</view>
				</view>

				<!-- 本局猜测历史 -->
				<view class="nb-hist">
					<text v-if="historySummaryText" class="nb-hist__txt">{{ historySummaryText }}</text>
					<text v-else class="nb-hist__txt">本局已猜 0 次 · 点按上方数字键盘开始猜数</text>
				</view>

				<!-- 辅助快捷操作 -->
				<view class="nb-tools">
					<view class="nb-tools__item" @tap="handleQuickGuess('mid')">
						<text class="nb-tools__txt">猜中点 ({{ midGuessValue }})</text>
					</view>
					<view class="nb-tools__item" @tap="handleShowRules">
						<text class="nb-tools__txt">玩法规则</text>
					</view>
					<view class="nb-tools__item" @tap="handleQuit">
						<text class="nb-tools__txt">结束本局</text>
					</view>
				</view>
			</template>

			<view class="ad-view">
				<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
			</view>
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
	import { getGameApi } from '@/common/api/game.js'
	import { navigateToTab } from '@/common/utils/tab-nav.js'
	import {
		createBombGame,
		startBombGame,
		submitGuess,
		restartBombGame,
		updateRangeLimit,
		normalizePlayerCount,
		buildRecordPayload,
		serializeGame,
		deserializeGame,
		getRemainingCount,
		MIN_RANGE_LIMIT,
		MAX_RANGE_LIMIT,
		RANGE_LIMIT_STEP,
		DEFAULT_RANGE_LIMIT,
		MIN_PLAYERS,
		MAX_PLAYERS,
		GUESS_RESULT,
		PHASE_SETUP,
		PHASE_PLAYING
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

	export default {
		components: {
			LoveGameRules,
			LoveGameResultDialog
		},
		data() {
			return {
				appStateStore: null,
				scrollTop: 0,
				phase: PHASE_SETUP,
				game: createBombGame({ rangeLimit: DEFAULT_RANGE_LIMIT }),
				/** uv-slider 拖动过程中的实时值（仅用于显示，松手才写回 game.rangeLimit） */
				limitPreview: 0,
				limitStep: RANGE_LIMIT_STEP,
				rangePresets: [50, 100, 200, 500],
				quickPlayerCounts: [1, 2, 3, 4],
				padDigitsTop: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
				playerCount: 1,
				guessText: '',
				lastMessage: '',
				lastTone: 'normal',
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
			midGuessValue() {
				return Math.floor((Number(this.game.rangeMin) + Number(this.game.rangeMax)) / 2)
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
			historySummaryText() {
				const list = Array.isArray(this.game.guesses) ? this.game.guesses : []
				if (!list.length) {
					return ''
				}
				const bomb = Number(this.game.bombNumber || 0)
				const ordered = list.slice(0, 6).reverse()
				const parts = ordered.map((item) => {
					const val = Number(item.value)
					if (!bomb) {
						return String(val)
					}
					if (val < bomb) {
						return `${val} ↑`
					}
					if (val > bomb) {
						return `${val} ↓`
					}
					return `${val} 💥`
				})
				const prefix = list.length > 6 ? '… · ' : ''
				return `本局已猜 ${this.game.guessCount} 次：${prefix}${parts.join(' · ')}`
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
					? '这一局已经记进战绩了，去「游戏战绩」里看看你的记录。'
					: '登录后这一局就会自动记进战绩。'
			}
		},
		onLoad() {
			this.ensureAppStateStore()
			this.syncPlayerCountFromGame()
			this.loadSavedProgress()

			if (!hasSeenRules('bomb')) {
				this.rulesVisible = true
				markRulesSeen('bomb')
			}
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
		},
		onUnload() {
			this.stopTimer()
		},
		onHide() {
			this.stopTimer()
			this.persistProgress()
		},
		onShow() {
			if (this.phase === PHASE_PLAYING) {
				this.startTimer()
			}
		},
		methods: {
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
				if (this.phase === PHASE_PLAYING) {
					this.persistProgress()
				}
				const pages = getCurrentPages()
				if (pages && pages.length > 1) {
					uni.navigateBack()
					return
				}
				this.handleBackToHall()
			},
			handleBackToHall() {
				this.resultVisible = false
				navigateToTab('game')
			},
			handleShowRules() {
				this.rulesVisible = true
			},
			handleSelectPreset(limit) {
				this.limitPreview = 0
				this.game = updateRangeLimit(this.game, limit)
			},
			/** 拖动过程中只更新展示值：不动 game.rangeLimit，免得回写 :value 把滑块拽回原位 */
			handleLimitChanging(value) {
				const next = Number(value)
				if (!Number.isFinite(next)) {
					return
				}
				this.limitPreview = next
			},
			/** 松手才落库；步长由滑块保证，updateRangeLimit 内部还会再夹一次 10~1000 */
			handleLimitChange(value) {
				const next = Number(value)
				this.limitPreview = 0
				if (!Number.isFinite(next)) {
					return
				}
				this.game = updateRangeLimit(this.game, next)
			},
			handleSelectPlayerCount(count) {
				const next = normalizePlayerCount(count)
				if (next === this.playerCount) {
					return
				}
				this.playerCount = next
				this.game = createBombGame({
					rangeLimit: this.game.rangeLimit,
					playerCount: next
				})
			},
			handlePlayerCountChange(delta = 0) {
				this.handleSelectPlayerCount(this.playerCount + Number(delta || 0))
			},
			handleStart() {
				const players = Array.from({ length: this.playerCount }).map((item, index) => ({
					name: this.playerCount > 1 ? `玩家 ${index + 1}` : '我',
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
				this.lastMessage = ''
				this.lastTone = 'normal'
				this.resultVisible = false
				this.exploding = false
				this.startTimer()
				this.persistProgress()
			},
			handleKeypadDigit(digit) {
				if (this.phase !== PHASE_PLAYING) {
					return
				}
				const maxLen = Math.max(2, String(this.game.rangeLimit || 100).length)
				const current = String(this.guessText || '')
				if (current === '0') {
					this.guessText = String(digit)
					return
				}
				if (current.length >= maxLen) {
					return
				}
				this.guessText = current + String(digit)
			},
			handleKeypadDelete() {
				if (!this.guessText) {
					return
				}
				this.guessText = this.guessText.slice(0, -1)
			},
			handleKeypadClear() {
				this.guessText = ''
			},
			handleQuickGuess(type = '') {
				if (type !== 'mid') {
					return
				}
				this.guessText = String(this.midGuessValue)
				this.handleGuess()
			},
			handleGuess() {
				if (this.phase !== PHASE_PLAYING) {
					return
				}
				const raw = this.guessText
				if (String(raw || '').trim() === '') {
					uni.showToast({
						title: '请先输入数字',
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
					console.warn('reportRecord failed', error)
				}
			},
			handleConfirmRestart() {
				if (!this.game.guessCount) {
					this.handleRestart()
					return
				}
				uni.showModal({
					title: '重新开局',
					content: '当前进度将被重置并重新埋雷，确定吗？',
					success: (res) => {
						if (res.confirm) {
							this.handleRestart()
						}
					}
				})
			},
			handleRestart() {
				this.resultVisible = false
				this.game = restartBombGame(this.game)
				this.phase = PHASE_PLAYING
				this.guessText = ''
				this.lastMessage = ''
				this.lastTone = 'normal'
				this.resultData = null
				this.elapsedSeconds = 0
				this.startTimer()
				this.persistProgress()
			},
			handleQuit() {
				uni.showModal({
					title: '结束本局',
					content: '结束后不会记录战绩，确定返回设置页吗？',
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
				this.lastMessage = `已恢复上一局，安全区间 ${restored.rangeMin} ~ ${restored.rangeMax}`
				this.lastTone = 'normal'
				this.startTimer()
			}
		}
	}
</script>

<style scoped>
	.nb-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
		background: var(--noir-bg);
		overflow: hidden;
	}

	.nb-glow {
		position: fixed;
		width: 420rpx;
		height: 420rpx;
		border-radius: 50%;
		filter: blur(80rpx);
		opacity: 0.22;
		pointer-events: none;
		z-index: 0;
	}

	.nb-glow--left {
		top: -120rpx;
		left: -140rpx;
		background: var(--noir-coral);
	}

	.nb-glow--right {
		top: 320rpx;
		right: -160rpx;
		background: var(--noir-gold);
	}

	.nb-pill-act {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 52rpx;
		padding: 0 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.44);
		background: rgba(216, 176, 140, 0.10);
	}

	.nb-pill-act__txt {
		font-size: 22rpx;
		color: var(--noir-gold-soft);
		white-space: nowrap;
	}

	.nb-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 36rpx 0;
	}

	.nb-kicker {
		display: block;
		font-size: 20rpx;
		letter-spacing: 3rpx;
		color: rgba(216, 176, 140, 0.72);
	}

	/* ---------- Setup 阶段 ---------- */

	.nb-setup-hero {
		padding: 20rpx 4rpx 30rpx;
	}

	.nb-setup-hero__title {
		display: block;
		margin-top: 12rpx;
		font-family: "Songti SC", "STSong", "Noto Serif SC", Georgia, serif;
		font-size: 46rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
		line-height: 1.25;
	}

	.nb-setup-hero__desc {
		display: block;
		margin-top: 14rpx;
		font-size: 24rpx;
		line-height: 1.65;
		color: rgba(245, 237, 228, 0.54);
	}

	.nb-resume {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		margin-bottom: 24rpx;
		padding: 22rpx 26rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(226, 100, 63, 0.44);
		background: linear-gradient(135deg, rgba(226, 100, 63, 0.18), rgba(255, 255, 255, 0.03));
	}

	.nb-resume__info {
		flex: 1;
		min-width: 0;
	}

	.nb-resume__title {
		display: block;
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.nb-resume__desc {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.58);
	}

	.nb-resume__btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 56rpx;
		padding: 0 26rpx;
		border-radius: 28rpx;
		background: linear-gradient(135deg, var(--noir-coral-bright), var(--noir-coral-deep));
	}

	.nb-resume__btn-txt {
		font-size: 22rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
	}

	.nb-card {
		padding: 30rpx 28rpx;
		border-radius: 32rpx;
		border: 1rpx solid var(--noir-border);
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.02));
	}

	.nb-section__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16rpx;
	}

	.nb-section__label {
		font-size: 26rpx;
		font-weight: 500;
		color: var(--noir-text);
	}

	.nb-section__val {
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", serif;
		font-size: 38rpx;
		font-weight: 500;
		color: var(--noir-gold-soft);
		line-height: 1.1;
	}

	.nb-section__sub {
		font-size: 22rpx;
		color: rgba(216, 176, 140, 0.72);
	}

	.nb-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 14rpx;
		margin-top: 20rpx;
	}

	.nb-presets--inline {
		margin-top: 0;
		flex: 1;
	}

	.nb-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 58rpx;
		padding: 0 22rpx;
		border-radius: 18rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.03);
	}

	.nb-chip--active {
		border-color: rgba(226, 100, 63, 0.54);
		background: rgba(226, 100, 63, 0.16);
	}

	.nb-chip__txt {
		font-size: 23rpx;
		color: rgba(245, 237, 228, 0.72);
	}

	.nb-chip--active .nb-chip__txt {
		color: var(--noir-text-strong);
		font-weight: 600;
	}

	.nb-slider {
		margin-top: 22rpx;
	}

	.nb-scale {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 4rpx;
	}

	.nb-scale__txt {
		font-size: 20rpx;
		color: rgba(216, 176, 140, 0.62);
	}

	.nb-divider {
		height: 1rpx;
		margin: 30rpx 0;
		background: rgba(255, 255, 255, 0.07);
	}

	.nb-player-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-top: 20rpx;
	}

	.nb-stepper {
		display: flex;
		align-items: center;
		gap: 14rpx;
		flex-shrink: 0;
	}

	.nb-stepper__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 58rpx;
		height: 58rpx;
		border-radius: 18rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.28);
		background: rgba(216, 176, 140, 0.08);
	}

	.nb-stepper__btn--disabled {
		opacity: 0.35;
	}

	.nb-stepper__btn-txt {
		font-size: 32rpx;
		font-weight: 600;
		color: var(--noir-gold-soft);
		line-height: 1;
	}

	.nb-stepper__val {
		min-width: 44rpx;
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", serif;
		font-size: 36rpx;
		font-weight: 500;
		color: var(--noir-text-strong);
		text-align: center;
	}

	.nb-actions {
		margin-top: 34rpx;
	}

	.nb-cta {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 92rpx;
		border-radius: 46rpx;
		background: var(--noir-btn-gradient);
		box-shadow: 0 16rpx 36rpx rgba(222, 95, 60, 0.28);
	}

	.nb-cta--hover {
		opacity: 0.88;
	}

	.nb-cta__txt {
		font-size: 30rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
		letter-spacing: 2rpx;
	}

	.nb-actions__link {
		margin-top: 22rpx;
		text-align: center;
	}

	.nb-actions__link-txt {
		font-size: 24rpx;
		color: rgba(216, 176, 140, 0.78);
	}

	/* ---------- Playing 阶段（s10） ---------- */

	.nb-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
		padding: 16rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.03);
	}

	.nb-bar__txt {
		font-size: 21rpx;
		color: var(--noir-text-sub);
	}

	.nb-range {
		margin-top: 24rpx;
		padding: 36rpx 28rpx 32rpx;
		border-radius: 36rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: linear-gradient(145deg, rgba(226, 124, 78, 0.14), rgba(255, 255, 255, 0.025));
		text-align: center;
	}

	.nb-nums {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 28rpx;
		margin-top: 14rpx;
	}

	.nb-nums__val {
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", "Times New Roman", serif;
		font-size: 104rpx;
		line-height: 1;
		color: var(--noir-text-strong);
		font-weight: 500;
	}

	.nb-nums__dash {
		font-size: 36rpx;
		color: var(--noir-gold);
	}

	.nb-turn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-top: 22rpx;
		height: 50rpx;
		padding: 0 24rpx;
		border-radius: 25rpx;
		background: rgba(226, 100, 63, 0.18);
		border: 1rpx solid var(--noir-border-coral);
	}

	.nb-turn__txt {
		font-size: 22rpx;
		color: var(--noir-coral-light);
	}

	.nb-feedback {
		display: block;
		margin-top: 16rpx;
		font-size: 23rpx;
		color: var(--noir-text-sub);
	}

	.nb-feedback--low {
		color: var(--noir-green);
	}

	.nb-feedback--high {
		color: var(--noir-coral-light);
	}

	.nb-feedback--warn {
		color: var(--noir-gold-soft);
	}

	.nb-input-box {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-top: 24rpx;
		height: 98rpx;
		padding: 0 28rpx 0 32rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		background: rgba(255, 255, 255, 0.035);
	}

	.nb-input-box__val {
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", serif;
		font-size: 52rpx;
		color: var(--noir-text-strong);
		letter-spacing: 4rpx;
		line-height: 1;
	}

	.nb-input-box__val--empty {
		color: rgba(245, 237, 228, 0.24);
	}

	.nb-input-box__right {
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.nb-input-box__hint {
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.42);
	}

	.nb-backspace {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52rpx;
		height: 52rpx;
		border-radius: 16rpx;
		background: rgba(255, 255, 255, 0.06);
	}

	.nb-backspace--hover {
		background: rgba(255, 255, 255, 0.14);
	}

	.nb-backspace__txt {
		font-size: 26rpx;
		color: var(--noir-gold-soft);
	}

	.nb-pad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16rpx;
		margin-top: 24rpx;
	}

	.nb-key {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 94rpx;
		border-radius: 26rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.035);
	}

	.nb-key--hover {
		background: rgba(255, 255, 255, 0.10);
	}

	.nb-key--fn {
		background: rgba(255, 255, 255, 0.025);
	}

	.nb-key--ok {
		border: none;
		background: linear-gradient(135deg, var(--noir-coral-bright), var(--noir-coral-deep));
		box-shadow: 0 10rpx 24rpx rgba(222, 95, 60, 0.26);
	}

	.nb-key--ok-hover {
		opacity: 0.86;
	}

	.nb-key__txt {
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 38rpx;
		color: var(--noir-text);
		line-height: 1;
	}

	.nb-key__txt--fn {
		font-family: "PingFang SC", -apple-system, sans-serif;
		font-size: 24rpx;
		color: rgba(245, 237, 228, 0.58);
	}

	.nb-key__txt--ok {
		font-family: "PingFang SC", -apple-system, sans-serif;
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-warm);
	}

	.nb-hist {
		margin-top: 24rpx;
		padding: 0 8rpx;
		text-align: center;
	}

	.nb-hist__txt {
		font-size: 22rpx;
		line-height: 1.6;
		color: var(--noir-text-muted);
	}

	.nb-tools {
		display: flex;
		gap: 16rpx;
		margin-top: 24rpx;
	}

	.nb-tools__item {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 68rpx;
		border-radius: 22rpx;
		border: 1rpx solid var(--noir-border);
		background: rgba(255, 255, 255, 0.025);
	}

	.nb-tools__txt {
		font-size: 22rpx;
		color: rgba(234, 212, 188, 0.78);
	}

	.ad-view {
		margin-top: 32rpx;
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
