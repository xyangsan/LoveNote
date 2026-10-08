<template>
	<view class="uc-page">
		<view class="uc-page__glow uc-page__glow--left"></view>
		<view class="uc-page__glow uc-page__glow--right"></view>

		<!-- 自绘顶栏：navigationStyle 为 custom，状态栏与右上角胶囊都要自己避让。
		     结构交给 uv-navbar（状态栏由它的 uv-status-bar 占位，内容区高度按胶囊中心算），
		     ⚠️ 但 **uv-navbar 自身不避让微信胶囊**，右侧插槽必须靠 nav-bar.js 的 rightInset 顶开。 -->
		<view class="uc-navbar-wrap">
			<uv-navbar
				:height="navBar.contentHeight + 'px'"
				bg-color="transparent"
				:border="false"
				:fixed="false"
				:placeholder="false"
				left-icon=""
				title=""
			>
				<template #left>
					<view class="uc-navbar__back" :style="{ marginLeft: navBarInsets.left }" @click="handleBack">
						<text class="uc-navbar__back-text">‹</text>
					</view>
				</template>

				<template #center>
					<view class="uc-navbar__center">
						<text class="uc-navbar__title">谁是卧底</text>
						<uni-tag
							v-if="room"
							:text="connText"
							size="small"
							:custom-style="connStyle"
						></uni-tag>
					</view>
				</template>

				<template #right>
					<view
						class="uc-navbar__rule"
						:style="{ marginRight: navBarInsets.right }"
						@click="rulesVisible = true"
					>
						<text class="uc-navbar__rule-text">?</text>
					</view>
				</template>
			</uv-navbar>
		</view>

		<view class="uc-layer">
			<!-- ============ 未进入房间 ============ -->
			<template v-if="!room">
				<view class="uc-hero">
					<text class="uc-hero__emoji">🕵️</text>
					<text class="uc-hero__title">4-10 人一起玩</text>
					<text class="uc-hero__desc">创建房间后把房间号发给朋友，满 4 人就能开局。</text>
				</view>

				<love-glass-card :margin="['0', '0', '0', '0']" :header-line="false" :padding="['22rpx', '24rpx']">
					<text class="uc-label">房间人数上限</text>
					<view class="uc-numbox-row">
						<uni-number-box
							:value="maxPlayers"
							:min="minPlayers"
							:max="maxPlayersLimit"
							:width="64"
							background="rgba(255, 241, 235, 0.96)"
							color="#b05b48"
							@change="handleMaxPlayersChange"
						></uni-number-box>
						<text class="uc-numbox-row__unit">人</text>
					</view>

					<view class="uc-word-row">
						<text class="uc-label">开局词库</text>
						<view class="uc-word-select" @click="wordEditorVisible = true">
							<text class="uc-word-select__text">{{ wordSourceText }}</text>
							<text class="uc-word-select__arrow">›</text>
						</view>
					</view>
				</love-glass-card>

				<view class="uc-actions">
					<fui-button
						text="创建房间"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						height="92rpx"
						radius="999rpx"
						:size="32"
						:bold="true"
						:loading="creating"
						@click="handleCreateRoom"
					/>
				</view>

				<view class="uc-join">
					<text class="uc-label">已有房间号？</text>
					<view class="uc-join__row">
						<fui-input
							placeholder="输入 6 位房间号"
							:value="joinCode"
							:size="30"
							:radius="20"
							background-color="#fffaf7"
							color="#5a3427"
							:padding="['20rpx', '24rpx']"
							@input="handleJoinCodeInput"
						></fui-input>
						<view class="uc-join__btn" @click="handleJoinRoom">
							<text class="uc-join__btn-text">加入</text>
						</view>
					</view>
				</view>

				<view class="uc-link" @click="rulesVisible = true">
					<text class="uc-link__text">查看玩法说明</text>
				</view>
			</template>

			<!-- ============ 房间内 ============ -->
			<template v-else>
				<view class="uc-room-bar">
					<view class="uc-room-bar__body">
						<text class="uc-room-bar__label">房间号</text>
						<text class="uc-room-bar__code">{{ room.roomCode }}</text>
					</view>
					<view class="uc-room-bar__actions">
						<view class="uc-room-bar__action" @click="handleShareTap">
							<text class="uc-room-bar__action-text">邀请</text>
						</view>
						<view
							class="uc-room-bar__action uc-room-bar__action--leave"
							@click="handleLeaveRoom"
						>
							<text class="uc-room-bar__action-text uc-room-bar__action-text--leave">退出</text>
						</view>
					</view>
				</view>

				<!-- 我的身份词 -->
				<view v-if="myWord" class="uc-my-word" :class="'uc-my-word--' + (myRole === 'undercover' ? 'undercover' : 'civilian')">
					<text class="uc-my-word__label">
						<text v-if="undercoverCount" class="uc-my-word__count">（本局 {{ undercoverCount }} 个卧底）</text>
					</text>
					<text class="uc-my-word__value">{{ myWord }}</text>
					<text class="uc-my-word__tip">只有你能看到这个词，别直接说出来</text>
				</view>

				<!-- 阶段提示 -->
				<view class="uc-stage">
					<text class="uc-stage__title">{{ stageTitle }}</text>
					<text class="uc-stage__desc">{{ stageDesc }}</text>
				</view>

				<!-- 席位 -->
				<love-game-seats
					:seats="room.seats"
					:max-players="room.maxPlayers"
					:self-seat-index="mySeat"
					:host-seat-index="room.hostSeatIndex"
					:speaker-seat-index="state.current_speaker_seat"
					:alive-seats="state.alive_seats"
					:selected-seat-index="selectedSeat"
					:selectable="canVote || canKick"
					:tags="seatTags"
					:size="'small'"
					:show-empty="false"
					empty-text="空位"
					@select="handleSelectSeat"
				></love-game-seats>

				<!-- 对局记录：发言 + 投票按轮次整合，按时间排序，轮次之间用分割线隔开 -->
				<view v-if="roundTimeline.length" class="uc-timeline">
					<view class="uc-timeline__head">
						<text class="uc-section-title uc-timeline__title">对局记录</text>
						<text class="uc-timeline__hint">{{ timelineSummary }}</text>
					</view>

					<view
						v-for="(group, groupIndex) in roundTimeline"
						:key="group.key"
						class="uc-timeline__round"
					>
						<!-- 轮次之间的分割线（第一轮上方不画） -->
						<view v-if="groupIndex > 0" class="uc-timeline__divider"></view>

						<view class="uc-timeline__round-head">
							<text class="uc-timeline__round-title">第 {{ group.round }} 轮</text>
							<text v-if="group.isCurrent" class="uc-timeline__round-live">进行中</text>
						</view>

						<!-- 一轮内部倒序：结果（时间最晚）→ 投票 → 发言 -->

						<!-- 本轮结果（时间最晚，放最上） -->
						<view v-if="group.vote.resultText" class="uc-timeline__block">
							<view class="uc-timeline__result uc-timeline__result--lead">
								<text>{{ group.vote.resultText }}</text>
							</view>
						</view>

						<!-- 本轮投票：投票轮次 + 每个人的投票记录（按投票时间倒序） -->
						<view v-if="group.vote" class="uc-timeline__block">
							<text class="uc-timeline__block-title">第 {{ group.vote.voteRound }} 轮投票</text>
							<view
								v-for="item in group.vote.items"
								:key="item.key"
								class="uc-timeline__vote"
							>
								<view class="uc-timeline__who">
									<text class="uc-timeline__name">{{ item.name }}</text>
									<text v-if="item.fromRobot" class="uc-timeline__ai">AI</text>
									<text v-if="item.isMine" class="uc-timeline__mine">我</text>
								</view>
								<text class="uc-timeline__arrow">→</text>
								<text class="uc-timeline__target">{{ item.targetText }}</text>
							</view>
							<view v-if="!group.vote.items.length" class="uc-timeline__empty">
								<text class="uc-timeline__empty-text">还没有人投票</text>
							</view>
							<text v-if="group.vote.pendingText" class="uc-timeline__pending">
								{{ group.vote.pendingText }}
							</text>
						</view>

						<!-- 本轮发言：有发言才显示（聚会模式整局无发言），按发言时间倒序 -->
						<view v-if="group.speeches.length" class="uc-timeline__block">
							<text class="uc-timeline__block-title">发言</text>
							<view
								v-for="(item, speechIndex) in group.speeches"
								:key="'sp-' + group.key + '-' + speechIndex"
								class="uc-timeline__speech"
							>
								<view class="uc-timeline__who">
									<text class="uc-timeline__name">{{ item.name }}</text>
									<text v-if="item.fromRobot" class="uc-timeline__ai">AI</text>
									<text v-if="item.isMine" class="uc-timeline__mine">我</text>
								</view>
								<text class="uc-timeline__speech-text">{{ item.text || '跳过发言' }}</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 房间设置（卧底人数 / 聚会模式）：
				     留在内容流里，**不放进悬浮栏** —— 它们是开局前的配置项而非「操作」，
				     塞进 fixed 底栏会让栏高接近半屏、把席位和对局记录全挡住。 -->
				<template v-if="room.status === 'waiting'">
					<!-- 卧底人数：房主开局前可手动调整（4-6 人只能 1 个，7-10 人最多 2 个） -->
					<view v-if="isHost" class="uc-config">
						<text class="uc-config__label">卧底人数</text>
						<uni-number-box
							class="uc-numbox"
							:value="undercoverCountInput"
							:min="1"
							:max="2"
							:width="56"
							background="rgba(255, 241, 235, 0.96)"
							color="#b05b48"
							@change="handleUndercoverCountChange"
						></uni-number-box>
						<text class="uc-config__unit">个</text>
						<text v-if="undercoverSettingInvalid" class="uc-config__warn">
							当前不足 {{ minPlayersForTwo }} 人，只能设 1 个卧底
						</text>
						<text v-else class="uc-config__tip">
							4-6 人 1 个卧底，7-10 人最多 2 个
						</text>
					</view>

					<!-- 聚会模式：开启（默认）时开局直接投票，不用轮流发言 -->
					<view class="uc-config uc-config--spread">
						<text class="uc-config__label">聚会模式</text>
						<switch
							class="uc-switch"
							:checked="partyModeInput"
							:disabled="!isHost"
							color="#e76f51"
							@change="handlePartyModeChange"
						/>
						<text class="uc-config__tip">
							{{ partyModeInput
								? '已开启：开局直接投票，不用轮流发言'
								: '已关闭：按顺序轮流发言后再投票' }}
						</text>
					</view>
				</template>

				<!-- 内容区底部留白：把悬浮操作栏的高度让出来，
				     否则最后一条对局记录会被压在栏下面看不见（值由 JS 按实际栏高写入） -->
				<view class="uc-op-holder" :style="{ height: opBarHeight + 'px' }"></view>
			</template>
		</view>

		<!-- ============ 悬浮操作栏（fixed 在底部，始终可见可点） ============ -->
		<view v-if="room" class="uc-op-bar">
			<!-- 操作区 -->
			<view class="uc-op">
					<!-- 房主：等待开局 -->
					<template v-if="room.status === 'waiting'">
						<view class="uc-op__row">
							<!-- 加机器人只在测试环境开放（正式版连入口都不显示，服务端也会拒绝） -->
							<view
								v-if="isTestEnv"
								class="uc-btn uc-btn--ghost"
								:class="{ 'uc-btn--disabled': !canAddRobot }"
								@click="handleAddRobot"
							>
								<text class="uc-btn__text uc-btn__text--ghost">加机器人</text>
							</view>
							<view class="uc-btn uc-btn--ghost" @click="handleCloseRoom">
								<text class="uc-btn__text uc-btn__text--ghost">解散房间</text>
							</view>
						</view>

						<view
							v-if="isHost"
							class="uc-btn uc-btn--primary"
							:class="{ 'uc-btn--disabled': !canStart }"
							@click="handleStart"
						>
							<text class="uc-btn__text">
								开始游戏{{ startBlockReason ? `（${startBlockReason}）` : '' }}
							</text>
						</view>
						<view v-else class="uc-op__hint">
							<text class="uc-op__hint-text">等房主开局，先把房间号分享给朋友吧</text>
						</view>
					</template>

					<!-- 发言阶段 -->
					<template v-else-if="state.phase === 'speak'">
						<template v-if="isMyTurn">
							<view class="uc-speak-input">
								<fui-input
									placeholder="用一句话描述你的词（别说出来）"
									:value="speakText"
									:size="28"
									:radius="20"
									background-color="#fffaf7"
									color="#5a3427"
									:padding="['20rpx', '24rpx']"
									:maxlength="60"
									@input="handleSpeakInput"
								></fui-input>
								<view class="uc-speak-input__btn" @click="handleSpeak">
									<text class="uc-speak-input__btn-text">发送</text>
								</view>
							</view>
							<view class="uc-btn uc-btn--ghost" @click="handleSkipSpeak">
								<text class="uc-btn__text uc-btn__text--ghost">跳过本次发言</text>
							</view>
						</template>
						<view v-else class="uc-op__hint">
							<text class="uc-op__hint-text">
								{{ state.current_speaker_seat >= 0
									? `等待 ${seatName(state.current_speaker_seat)} 描述…`
									: '正在整理发言顺序…' }}
							</text>
						</view>
					</template>

					<!-- 投票阶段 -->
					<template v-else-if="state.phase === 'vote'">
						<view v-if="hasVoted" class="uc-op__hint">
							<text class="uc-op__hint-text">
								你已经投票给 {{ seatName(myVoteTarget) }}，等待其他人…
							</text>
						</view>
						<template v-else-if="isAlive">
							<view class="uc-op__hint">
								<text class="uc-op__hint-text">
									{{ selectedSeat >= 0 ? `已选择 ${seatName(selectedSeat)}` : '点上方头像选择要淘汰的人' }}
								</text>
							</view>
							<view
								class="uc-btn uc-btn--primary"
								:class="{ 'uc-btn--disabled': selectedSeat < 0 }"
								@click="handleVote"
							>
								<text class="uc-btn__text">确认投票</text>
							</view>
						</template>
						<view v-else class="uc-op__hint">
							<text class="uc-op__hint-text">你已被淘汰，等待本局结束</text>
						</view>
					</template>

					<!-- 已结算 -->
					<template v-else-if="state.phase === 'settled'">
						<view class="uc-btn uc-btn--primary" @click="resultVisible = true">
							<text class="uc-btn__text">查看本局结果</text>
						</view>
						<view v-if="isHost" class="uc-btn uc-btn--ghost" @click="handleCloseRoom">
							<text class="uc-btn__text uc-btn__text--ghost">解散房间</text>
						</view>
					</template>

					<!-- 掉线接管 -->
				<view v-if="hostOffline" class="uc-btn uc-btn--ghost" @click="handleClaimHost">
					<text class="uc-btn__text uc-btn__text--ghost">接管房主（房主已离线）</text>
				</view>
			</view>
		</view>

		<love-game-word-editor
			:show="wordEditorVisible"
			:selectable="true"
			:selected-id="selectedWordId"
			@close="wordEditorVisible = false"
			@select="handlePickWord"
			@change="handleWordBankChange"
		></love-game-word-editor>

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
			game-type="undercover"
			@close="rulesVisible = false"
		></love-game-rules>
	</view>
</template>

<script>
	import LoveGlassCard from '@/components/love-glass-card/love-glass-card.vue'
	import LoveGameSeats from '@/components/love-game-seats/love-game-seats.vue'
	import LoveGameRules from '@/components/love-game-rules/love-game-rules.vue'
	import LoveGameResultDialog from '@/components/love-game-result-dialog/love-game-result-dialog.vue'
	import LoveGameWordEditor from '@/components/love-game-word-editor/love-game-word-editor.vue'
	import { getGameApi, assertGameResult } from '@/common/api/game.js'
	import { createRoomSync } from '@/common/game/room-sync.js'
	import { saveActiveRoom, clearActiveRoom, getActiveRoom, hasSeenRules, markRulesSeen } from '@/common/game/active-room.js'
	import { pickNewAutoActions } from '@/store/modules/game.js'
	import { useAppStateStore } from '@/store/app-state.js'
	import { hasValidLogin } from '@/common/auth-center.js'
	import { openLoginModal } from '@/common/auth-modal.js'
	import { getNavBarMetrics } from '@/common/utils/nav-bar.js'
	import { IS_TEST_ENV, ENV_VERSION } from '@/common/utils/env.js'

	const GAME_TYPE = 'undercover'
	const MIN_PLAYERS = 4
	const MAX_PLAYERS = 10
	const MIN_PLAYERS_FOR_TWO = 7
	// uv-navbar 左右插槽自带的水平内边距（px），见组件的 .uv-navbar__content__left/__right
	const UV_NAVBAR_SLOT_PADDING = 13
	/**
	 * 悬浮操作栏的兜底高度（px）。
	 *
	 * 正常情况用 `uni.createSelectorQuery` 实测 `.uc-op-bar`，
	 * 这个值只在**实测拿不到**（如某些平台不支持选择器查询）时兜底。
	 * 取 160 是「一行提示 + 一颗主按钮 + 上下内边距」的典型高度，宁可多留白也不要少留。
	 */
	const OP_BAR_FALLBACK_HEIGHT = 160

	export default {
		components: {
			LoveGlassCard,
			LoveGameSeats,
			LoveGameRules,
			LoveGameResultDialog,
			LoveGameWordEditor
		},
		data() {
			return {
				appStateStore: null,
				// 是否测试环境（微信开发版/体验版）；决定要不要显示「加机器人」入口
				isTestEnv: IS_TEST_ENV,
				// 状态栏 + 右上角胶囊的安全区，自定义顶栏靠它定位
				navBar: getNavBarMetrics(),
				room: null,
				answer: {},
				state: {},
				sync: null,
				serverOffset: 0,
				lastSeenSeq: 0,
				connMode: 'push',
				connStatus: 'connecting',
				// 未进房
				maxPlayers: 4,
				minPlayers: MIN_PLAYERS,
				maxPlayersLimit: MAX_PLAYERS,
				minPlayersForTwo: MIN_PLAYERS_FOR_TWO,
				wordSource: 'preset',
				joinCode: '',
				creating: false,
				// 编辑态
				selectedWordId: '',
				speakText: '',
				selectedSeat: -1,
				// 卧底人数输入框的镜像值：uni-number-box 自己维护内部值，
				// 这里跟着房间配置走，服务端拒绝时能回滚（见 handleUndercoverCountChange）
				undercoverCountInput: 1,
				// 聚会模式开关的镜像值：原生 switch 同样会先切过去，失败时靠它回滚
				partyModeInput: true,
				// 已经为哪个 version 兜底推进过机器人（防止同一个版本反复请求）
				forcedRobotVersion: -1,
				// 第二道兜底（getRoom）的定时器
				robotFallbackTimer: null,
				// 已经打过日志的云端构建号，用来判断「云端是否已更新」
				loggedServerBuild: '',
				// 本次提交的投票目标，用来在返回后自检「这一票到底写进去了没」
				voteTarget: -1,
wordEditorVisible: false,
			rulesVisible: false,
			resultVisible: false,
			resultShown: false,
			// 悬浮操作栏（.uc-op-bar）实测高度（px），用来给内容区留等高空白。
			// 取不到就退回 OP_BAR_FALLBACK_HEIGHT，别让内容被压在栏下面。
			opBarHeight: OP_BAR_FALLBACK_HEIGHT
		}
		},
		computed: {
			/**
			 * uv-navbar 的左右插槽自带 `padding: 0 13px`（见组件样式），
			 * 这里把这段差值扣掉，让两端按钮仍落在 nav-bar.js 算出的 inset 上。
			 * （若以后升级 uv-ui 改了插槽内边距，同步改 UV_NAVBAR_SLOT_PADDING）
			 */
			navBarInsets() {
				const gutter = (value) => Math.max(0, Number(value || 0) - UV_NAVBAR_SLOT_PADDING) + 'px'
				return {
					left: gutter(this.navBar.leftInset),
					right: gutter(this.navBar.rightInset)
				}
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
			isAlive() {
				const alive = Array.isArray(this.state.alive_seats) ? this.state.alive_seats.map(Number) : []
				return !alive.length || alive.includes(this.mySeat)
			},
			myRole() {
				return this.answer.myRole || ''
			},
			myWord() {
				return this.answer.myWord || ''
			},
			undercoverCount() {
				return Number(this.answer.undercoverCount || 0)
			},
			/**
			 * 房间的玩法属性（`room.props`，由服务端按 game_type 裁剪下发）。
			 * 卧底：`{ undercoverCount, partyMode }` —— 服务端已经把字段不一致的用默认值填好了
			 * （见 lib/game-constants.js 的 resolveRoomProps），这里只做一层防御性兜底。
			 */
			roomProps() {
				const props = this.room && this.room.props
				return props && typeof props === 'object' ? props : {}
			},
			/** 房主在等待阶段设置的卧底数（来自房间属性，1 或 2） */
			undercoverSetting() {
				return Number(this.roomProps.undercoverCount || 1)
			},
			/** 设了 2 个卧底但当前不足 7 人 → 非法，需改回 1 */
			undercoverSettingInvalid() {
				return this.undercoverSetting > 1 && this.playerCount < MIN_PLAYERS_FOR_TWO
			},
			/** 房间的「聚会模式」权威值（来自房间属性，只有显式 false 才算关闭） */
			partyModeOn() {
				return this.roomProps.partyMode !== false
			},
			isMyTurn() {
				return this.state.phase === 'speak' && Number(this.state.current_speaker_seat) === this.mySeat
			},
			canVote() {
				return this.state.phase === 'vote' && this.isAlive && !this.hasVoted
			},
			/** 等待阶段房主点席位可以移出玩家 */
			canKick() {
				return Boolean(
					this.isHost
					&& this.room
					&& this.room.status === 'waiting'
					&& this.playerCount > 1
				)
			},
			hasVoted() {
				const votes = Array.isArray(this.state.votes) ? this.state.votes : []
				return votes.some((item) => Number(item.voter_seat) === this.mySeat)
			},
			myVoteTarget() {
				const votes = Array.isArray(this.state.votes) ? this.state.votes : []
				const mine = votes.find((item) => Number(item.voter_seat) === this.mySeat)
				return mine ? Number(mine.target_seat) : -1
			},
			playerCount() {
				return this.room ? Number(this.room.playerCount || 0) : 0
			},
			canStart() {
				return this.room
					&& this.room.status === 'waiting'
					&& this.isHost
					&& this.playerCount >= MIN_PLAYERS
					&& !this.undercoverSettingInvalid
			},
			startShortage() {
				return Math.max(0, MIN_PLAYERS - this.playerCount)
			},
			/** 房主点「开始游戏」前给的具体拦截原因（为空表示可以开始） */
			startBlockReason() {
				if (!this.room || this.room.status !== 'waiting' || !this.isHost) {
					return ''
				}
				if (this.playerCount < MIN_PLAYERS) {
					return `还差 ${this.startShortage} 人`
				}
				if (this.undercoverSettingInvalid) {
					return '卧底人数需改为 1 个'
				}
				return ''
			},
			canAddRobot() {
				// 机器人是**测试环境专用**：正式环境服务端会拒绝，页面也不显示入口
				return Boolean(
					this.isTestEnv
					&& this.isHost
					&& this.room
					&& this.room.status === 'waiting'
					&& this.playerCount < Number(this.room.maxPlayers || 0)
				)
			},
			hostOffline() {
				if (!this.room || this.isHost || this.room.status === 'settled') {
					return false
				}
				const hostSeatIndex = Number(this.room.hostSeatIndex)
				if (hostSeatIndex < 0) {
					return false
				}
				const seats = Array.isArray(this.room.seats) ? this.room.seats : []
				const hostSeat = seats.find((item) => Number(item.seatIndex) === hostSeatIndex)
				return Boolean(hostSeat && hostSeat.online === false && !hostSeat.isRobot)
			},
			/**
			 * **对局记录时间线**：把「发言」和「投票」按轮次整合成一份完整记录，**全程按时间倒序**展示。
			 *
			 * 数据来源（服务端已按轮次归档好，前端只做展示层的整合）：
			 *   - `state.speeches`：跨轮累积的发言（引擎自带 `round` 字段，且有 `MAX_SPEECHES` 上限）
			 *   - `state.vote_history`：**已结算**的每一轮投票归档（含每个人的票 + 淘汰结果）
			 *   - `state.votes`：**当前这轮**还没结算的实时票箱
			 *
			 * 为什么需要 `vote_history`：`goToVote` 每开一轮就把 `state.votes` 清空，
			 * 只靠 `last_vote_result` 只能看到「上一轮的票数」，看不到「谁投了谁」。
			 *
			 * 分组规则（**发言 / 投票 / 结果 / 轮次 全部倒序，最新在最上**）：
			 *   - **轮次倒序**（`round` 从大到小），最新一轮在最上面；
			 *   - **一轮内部也倒序**：结果（时间最晚）→ 投票块（按 `create_time` 倒序）→
			 *     发言块（按 `create_time` 倒序）—— 每一块内部也是「最后发生的那条在最上」，
			 *     这样整条时间线从上到下就是一条严格倒序的时间轴；
			 *   - 轮次之间由模板画分割线（第一条上方不画）；
			 *   - 当前轮即使还没投完票也显示（票箱为空时提示「还没有人投票」+ 等待谁）。
			 */
			roundTimeline() {
				const speeches = Array.isArray(this.state.speeches) ? this.state.speeches : []
				const history = Array.isArray(this.state.vote_history) ? this.state.vote_history : []
				const currentRound = Number(this.state.round || 0)
				const currentVoteRound = Number(this.state.vote_round || 0)
				const isVoting = this.state.phase === 'vote'

				// 收集所有出现过的轮次：发言的 round + 归档的 round + 当前轮
				const roundSet = new Set()
				speeches.forEach((item) => roundSet.add(Number(item.round || 0)))
				history.forEach((item) => roundSet.add(Number(item.round || 0)))
				if (currentRound > 0) {
					roundSet.add(currentRound)
				}

				return Array.from(roundSet)
					.filter((round) => round > 0)
					// 倒序：最新轮次在最上面
					.sort((left, right) => right - left)
					.map((round) => {
						const roundSpeeches = speeches
							.filter((item) => Number(item.round || 0) === round)
							// 倒序：最后发言的在最上
							.sort((left, right) => Number(right.create_time || 0) - Number(left.create_time || 0))
							.map((item) => {
								const seatIndex = Number(item.seat_index)
								return {
									seatIndex,
									name: this.seatName(seatIndex),
									fromRobot: this.seatIsRobot(seatIndex),
									isMine: seatIndex === this.mySeat,
									text: item.text || ''
								}
							})

						const archived = history.find((item) => Number(item.round || 0) === round) || null
						// 当前轮还没结算 → 用实时票箱；已结算的轮次 → 用归档快照
						const isCurrentLiveRound = isVoting
							&& round === currentRound
							&& !archived
						const voteSource = isCurrentLiveRound
							? (Array.isArray(this.state.votes) ? this.state.votes : [])
							: (archived && Array.isArray(archived.votes) ? archived.votes : [])

						const items = voteSource
							.slice()
							// 倒序：最后投出的一票在最上（create_time 相同的票用座位号兜底保证稳定）
							.sort((left, right) => {
								const timeDiff = Number(right.create_time || 0) - Number(left.create_time || 0)
								return timeDiff !== 0 ? timeDiff : Number(right.voter_seat) - Number(left.voter_seat)
							})
							.map((vote) => {
								const voterSeat = Number(vote.voter_seat)
								return {
									key: `r${round}-v${voterSeat}-${Number(vote.target_seat)}`,
									name: this.seatName(voterSeat),
									fromRobot: this.seatIsRobot(voterSeat),
									isMine: voterSeat === this.mySeat,
									targetText: this.seatName(Number(vote.target_seat))
								}
							})

						const aliveCount = Array.isArray(this.state.alive_seats) ? this.state.alive_seats.length : 0
						return {
							key: `round-${round}`,
							round,
							// 已结算时最后一轮也不算「进行中」——
							// buildSettlePatch 不会改 state.round，不加这个判断会显示成「进行中」
							isCurrent: round === currentRound && this.state.phase !== 'settled',
							speeches: roundSpeeches,
							vote: {
								voteRound: archived
									? Number(archived.vote_round || 0)
									: (isCurrentLiveRound ? currentVoteRound : round),
								items,
								quota: archived
									? (Array.isArray(archived.alive_seats) ? archived.alive_seats.length : items.length)
									: (isCurrentLiveRound ? aliveCount : items.length),
								pendingText: isCurrentLiveRound ? this.pendingVoterText : '',
								resultText: archived ? this.voteResultText(archived) : ''
							}
						}
					})
			},
			timelineSummary() {
				const rounds = this.roundTimeline.length
				const finished = this.roundTimeline.filter((group) => group.vote.resultText).length
				return `最新在上 · 共 ${rounds} 轮 · 已开票 ${finished} 轮`
			},
			/** 还没投票的存活玩家名字（用于「等待 xxx」提示） */
			pendingVoterText() {
				const seats = this.pendingVoterSeats
				if (!seats.length) {
					return ''
				}
				return `等待 ${seats.map((seatIndex) => this.seatName(seatIndex)).join('、')} 投票`
			},
			/** 还没投票的存活座位 */
			pendingVoterSeats() {
				const alive = Array.isArray(this.state.alive_seats) ? this.state.alive_seats.map(Number) : []
				const voted = (Array.isArray(this.state.votes) ? this.state.votes : [])
					.map((vote) => Number(vote.voter_seat))
				return alive.filter((seatIndex) => !voted.includes(seatIndex))
			},
			/**
			 * 还有存活机器人没投票吗？
			 *
			 * 与引擎 advanceAutoSeats 的守卫**必须同语义**：
			 * 「一票未投 + 场上还有活着的真人」时机器人按兵不动（等真人先投），不算「待推进」。
			 * 反过来，**场上全是机器人时这个条件不成立** → 依然返回待投列表，
			 * 于是结算后进入下一轮时客户端会继续兜底推进，直到打完（见 ensureRobotVotes）。
			 */
			pendingRobotVotes() {
				if (this.state.phase !== 'vote') {
					return []
				}
				const alive = Array.isArray(this.state.alive_seats) ? this.state.alive_seats.map(Number) : []
				const robots = alive.filter((seatIndex) => this.seatIsRobot(seatIndex))
				if (!robots.length) {
					return []
				}
				const votes = Array.isArray(this.state.votes) ? this.state.votes : []
				const hasAliveHuman = alive.some((seatIndex) => !this.seatIsRobot(seatIndex))
				if (!votes.length && hasAliveHuman) {
					return []
				}
				const voted = votes.map((vote) => Number(vote.voter_seat))
				return robots.filter((seatIndex) => !voted.includes(seatIndex))
			},
			seatTags() {
				const tags = {}
				const seats = Array.isArray(this.room && this.room.seats) ? this.room.seats : []
				const alive = Array.isArray(this.state.alive_seats) ? this.state.alive_seats.map(Number) : []
				const votedSeats = (Array.isArray(this.state.votes) ? this.state.votes : [])
					.map((vote) => Number(vote.voter_seat))
				seats.forEach((seat) => {
					const seatIndex = Number(seat.seatIndex)
					if (alive.length && !alive.includes(seatIndex)) {
						tags[String(seatIndex)] = { text: '已淘汰', tone: 'danger' }
						return
					}
					if (
						this.state.phase === 'vote'
						&& this.hasVoted
						&& Number(this.myVoteTarget) === seatIndex
					) {
						tags[String(seatIndex)] = { text: '你投的', tone: 'win' }
						return
					}
					// 投票阶段把「谁已经投过」直接标在席位上，不用点开列表也能看全
					if (this.state.phase === 'vote' && votedSeats.includes(seatIndex)) {
						tags[String(seatIndex)] = { text: '已投票', tone: 'normal' }
					}
				})
				return tags
			},
			stageTitle() {
				if (!this.room) {
					return ''
				}
				if (this.room.status === 'waiting') {
					return `等待开局（${this.playerCount}/${this.room.maxPlayers} 人）`
				}
				const phaseMap = {
					assign: '正在分配身份',
					speak: `第 ${this.state.round || 1} 轮 · 轮流描述`,
					vote: `第 ${this.state.vote_round || 1} 轮投票`,
					settled: '本局已结束'
				}
				return phaseMap[this.state.phase] || '对局进行中'
			},
			stageDesc() {
				if (!this.room) {
					return ''
				}
				if (this.room.status === 'waiting') {
					return `至少 ${MIN_PLAYERS} 人才能开始，房主可以先把房间号发出去`
				}
				if (this.state.phase === 'speak') {
					return '用自己的话描述手中的词，太直接会被卧底抓到'
				}
				if (this.state.phase === 'vote') {
					return '选出你认为是卧底的人，得票最多者出局'
				}
				if (this.state.phase === 'settled') {
					return '本局已结算，战绩已自动保存'
				}
				return '准备好了，马上开始'
			},
			connText() {
				if (this.connMode === 'push') {
					return '实时连接'
				}
				return this.connStatus === 'unavailable' ? '轮询同步' : '连接中'
			},
			connTone() {
				if (this.connMode === 'push') {
					return 'ok'
				}
				return this.connStatus === 'unavailable' ? 'warn' : 'pending'
			},
			/**
			 * 连接状态标签的样式。uni-tag 自带色板是冷色，这里按 connTone 覆盖回项目暖色主题
			 * （ok 绿 / warn 黄 / pending 灰），避免出现与主题不搭的默认蓝绿。
			 */
			connStyle() {
				const TONES = {
					ok: { bg: 'rgba(226, 241, 233, 0.98)', border: 'rgba(140, 186, 160, 0.5)', color: '#6a8f7b' },
					warn: { bg: 'rgba(255, 240, 214, 0.98)', border: 'rgba(214, 158, 80, 0.4)', color: '#b4823c' },
					pending: { bg: 'rgba(240, 240, 240, 0.98)', border: 'rgba(200, 200, 200, 0.6)', color: '#9a9a9a' }
				}
				const tone = TONES[this.connTone] || TONES.pending
				return [
					'display:inline-block',
					`background-color:${tone.bg}`,
					`border-color:${tone.border}`,
					`color:${tone.color}`,
					'font-size:19rpx',
					'font-weight:500',
					'line-height:1.5',
					'padding:4rpx 14rpx',
					'border-radius:999rpx'
				].join(';')
			},
			wordSourceText() {
				return this.wordSource === 'mine' ? '我的词库' : '系统词库'
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
				return this.result.winner === 'undercover' ? '卧底获胜' : '平民获胜'
			},
			resultSubtitle() {
				if (!this.result) {
					return ''
				}
				return `平民词「${this.result.civilianWord}」 / 卧底词「${this.result.undercoverWord}」`
			},
			resultLines() {
				if (!this.result) {
					return []
				}
				return [
					{ label: '你的身份', value: this.result.myRole === 'undercover' ? '卧底' : '平民', highlight: true },
					{ label: '卧底人数', value: `${(this.result.undercoverSeats || []).length} 人` },
					{ label: '进行轮次', value: `${this.result.rounds || 1} 轮` },
					{
						label: '你的结果',
						value: this.iWin ? '获胜 +10 分' : '失败',
						highlight: this.iWin
					}
				]
			},
			resultPlayers() {
				if (!this.result || !this.room) {
					return []
				}
				const undercoverSeats = (this.result.undercoverSeats || []).map(Number)
				const eliminatedSeats = (this.result.eliminatedSeats || []).map(Number)
				return (this.room.seats || []).map((seat) => {
					const seatIndex = Number(seat.seatIndex)
					const isUndercover = undercoverSeats.includes(seatIndex)
					return {
						nickname: seat.nickname,
						avatarUrl: seat.avatarUrl,
						roleText: isUndercover
							? '卧底'
							: (eliminatedSeats.includes(seatIndex) ? '平民 · 已淘汰' : '平民'),
						scoreText: isUndercover ? '卧' : '民',
						result: isUndercover ? 'win' : 'lose',
						isSelf: seatIndex === this.mySeat
					}
				})
			},
			resultTips() {
				if (!this.result) {
					return ''
				}
				return this.iWin ? '这局表现不错，战绩已保存。' : '再来一局，换个词试试运气。'
			}
		},
		onLoad(options = {}) {
			this.ensureAppStateStore()
			this.refreshNavBar()
			this.loadLocalLastSeenSeq()

			if (!hasSeenRules(GAME_TYPE)) {
				this.rulesVisible = true
				markRulesSeen(GAME_TYPE)
			}

			const roomId = String(options.roomId || '').trim()
			const roomCode = String(options.roomCode || '').trim()

			if (roomId) {
				this.enterRoom({ roomId })
				return
			}
			if (roomCode) {
				this.enterRoom({ roomCode })
			}
		},
		onReady() {
			// 首帧：进房分支的 DOM 还没稳定，主动量一次悬浮栏高度
			this.measureOpBar()
		},
		onShow() {
			this.refreshNavBar()
			// 回到前台时重测一次：iPad 分屏 / 旋转会改窗口宽度，按钮换行数会变
			this.measureOpBar()
			if (this.sync) {
				this.sync.resume()
			}
		},
		onResize() {
			// 旋转 / 分屏改变窗口宽度 → 悬浮栏内按钮可能换行，高度要重新量
			this.refreshNavBar()
			this.measureOpBar()
		},
		onHide() {
			if (this.sync) {
				this.sync.pause()
			}
			this.persistActiveRoom()
		},
		onUnload() {
			this.persistActiveRoom()
			if (this.robotFallbackTimer) {
				clearTimeout(this.robotFallbackTimer)
				this.robotFallbackTimer = null
			}
			if (this.sync) {
				this.sync.stop()
				this.sync = null
			}
		},
		onShareAppMessage() {
			const roomCode = this.room ? this.room.roomCode : ''
			return {
				title: roomCode
					? `谁是卧底｜房间号 ${roomCode}，快来一起玩`
					: '恋人手札｜谁是卧底',
				path: roomCode
					? `/pages/game/undercover/room?roomCode=${roomCode}`
					: '/pages/game/index'
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
			/**
			 * 实测悬浮操作栏高度，写进 `opBarHeight`，用来给内容区留等高空白。
			 *
			 * 量的对象是**外层 `.uc-op-bar`**（不是 `.uc-op-bar__inner`）——
			 * 这样底部安全区（`env(safe-area-inset-bottom)` 撑出的 padding）已经算在里面，
			 * 留白与栏严丝合缝，**不需要在 JS 里再算一遍安全区**。
			 *
			 * 为什么必须实测：操作区内容**随阶段剧烈变化** ——
			 * waiting 是「加机器人/解散」+「开始游戏」，speak 是「输入框 + 跳过」，
			 * vote 是「提示 + 确认投票」，settled 是两颗按钮。写死一个值必然有一头被压住。
			 *
			 * 时机：DOM 变化后（`$nextTick`）再量；每次快照、每次 onShow/onResize 都要重量。
			 */
			measureOpBar() {
				this.$nextTick(() => {
					try {
						if (typeof uni.createSelectorQuery !== 'function') {
							return
						}
						uni.createSelectorQuery()
							.select('.uc-op-bar')
							.boundingClientRect((rect) => {
								const height = rect && rect.height ? Number(rect.height) : 0
								if (height > 0 && Math.abs(height - this.opBarHeight) > 0.5) {
									this.opBarHeight = height
								}
							})
							.exec()
					} catch (error) {
						// 量不到就用 OP_BAR_FALLBACK_HEIGHT（已在 data 里给了初值）
					}
				})
			},
			ensureAppStateStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			loadLocalLastSeenSeq() {
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
			seatName(seatIndex) {
				const seats = Array.isArray(this.room && this.room.seats) ? this.room.seats : []
				const seat = seats.find((item) => Number(item.seatIndex) === Number(seatIndex))
				return seat ? seat.nickname || `座位${seatIndex + 1}` : `座位${Number(seatIndex) + 1}`
			},
			/** 该座位是不是机器人（服务端已按 uid 前缀兜底，这里只读下发字段） */
			seatIsRobot(seatIndex) {
				const seats = Array.isArray(this.room && this.room.seats) ? this.room.seats : []
				const seat = seats.find((item) => Number(item.seatIndex) === Number(seatIndex))
				return Boolean(seat && seat.isRobot)
			},
			/**
			 * 某一轮投票归档的结果文案。
			 * 数据来自 `state.vote_history`（服务端在 resolveAfterVote 里落的快照）。
			 */
			voteResultText(record = {}) {
				const eliminated = Number(record.eliminated_seat)
				if (record.tie || !Number.isInteger(eliminated) || eliminated < 0) {
					return '本轮平票，没有人被淘汰'
				}
				return `${this.seatName(eliminated)} 被淘汰出局`
			},
			handleBack() {
				if (this.room) {
					this.persistActiveRoom()
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
				uni.reLaunch({
					url: '/pages/game/index'
				})
			},
			handleWordBankChange() {
				uni.showToast({
					title: '词库已更新',
					icon: 'none'
				})
			},
			handlePickWord(item) {
				this.wordSource = 'mine'
				this.selectedWordId = item.wordId
				this.wordEditorVisible = false
			},
			/** uni-number-box 的 change 回传的是**绝对值**（不是增量），这里做一次范围收敛 */
			handleMaxPlayersChange(next) {
				const value = Math.min(
					this.maxPlayersLimit,
					Math.max(this.minPlayers, Number(next) || this.minPlayers)
				)
				if (value === this.maxPlayers) {
					return
				}
				this.maxPlayers = value
			},
			handleJoinCodeInput(event = '') {
				// fui-input 的 input 事件回传原始字符串（不是 event.detail.value），与 resolveInputText 同口径
				const value = this.resolveInputText(event)
				this.joinCode = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
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
				if (!this.requireLogin() || this.creating) {
					return
				}
				this.creating = true
				uni.showLoading({
					title: '创建中',
					mask: true
				})
				try {
					const result = assertGameResult(
						await getGameApi().createRoom({
							gameType: GAME_TYPE,
							maxPlayers: this.maxPlayers
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
					this.creating = false
					uni.hideLoading()
				}
			},
			async handleJoinRoom() {
				if (!this.requireLogin()) {
					return
				}
				const roomCode = String(this.joinCode || '').trim()
				if (roomCode.length !== 6) {
					uni.showToast({
						title: '请输入 6 位房间号',
						icon: 'none'
					})
					return
				}
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

				const previousVersion = this.room ? Number(this.room.version) : -1
				const nextVersion = Number(payload.version || 0)

				if (meta.reset && this.sync) {
					// 本地游标超前 / 房间被重建 → 丢弃全部临时态
					this.selectedSeat = -1
					this.speakText = ''
				}

				if (!payload.changed && nextVersion === previousVersion) {
					return
				}

				const room = payload.room
				this.room = room
				this.answer = room.answer || {}
				this.state = room.state || {}
				// 云端构建号变了就打一条日志：排查「客户端新版 / 云端旧版」时看这一行
				if (room.serverBuild && room.serverBuild !== this.loggedServerBuild) {
					this.loggedServerBuild = room.serverBuild
					console.log('[game] server build =', room.serverBuild, '| room version =', room.version)
				}
				// 玩法属性来自 room.props（服务端已保证字段齐全）
				const roomProps = room.props && typeof room.props === 'object' ? room.props : {}
				// 卧底人数输入框始终以房间属性为准，冲掉上次失败可能留下的脏值
				this.undercoverCountInput = Number(roomProps.undercoverCount || 1)
				// 聚会模式同理（只有显式 false 才算关闭）
				this.partyModeInput = roomProps.partyMode !== false
				if (this.sync) {
					this.sync.setVersion(nextVersion)
				}

				// 轮次变化时清掉旧的输入与选中
				if (this.state.phase !== 'vote') {
					this.selectedSeat = -1
					this.voteTarget = -1
				}
				if (this.state.current_speaker_seat !== this.mySeat || this.state.phase !== 'speak') {
					this.speakText = ''
				}

				this.notifyAutoActions()
				this.persistActiveRoom()

				if (this.state.phase === 'settled' && !this.resultShown) {
					this.resultShown = true
					this.resultVisible = true
					clearActiveRoom(this.currentUid)
				}
				if (this.state.phase !== 'settled') {
					this.resultShown = false
				}

				// 自己的票已经落库 → 清掉自检标记，避免重复提示
				if (this.hasVoted) {
					this.voteTarget = -1
				}

this.ensureRobotVotes()
			this.verifyMyVote()
			// 阶段切换会改变悬浮操作栏里的节点数量（waiting 四块 → speak 两块 → settled 两颗按钮），
			// 所以每次快照都要重量一次，否则内容区留白会跟栏高对不上。
			this.measureOpBar()
		},
			/**
			 * 兜底推进机器人投票（两道，按「依赖服务端新版 → 不依赖」排序）。
			 *
			 * 正常情况下「真人投票」这个请求里服务端就会顺手让机器人跟投（见 service/game.js
			 * 的 advanceRobotSeats）。但万一那一步没生效，房间就会卡在「真人投完了、机器人一动不动」。
			 *
			 *   第一道：带 `force` 调 syncRoom —— 服务端新版会跳过「version 未变」的早退去推进；
			 *   第二道：**不依赖任何新参数**地调 getRoom —— `getRoom` 在任何服务端版本里都会跑一遍
			 *          `resolveTimersUntilStable`（机器人推进就在里面）。这道是给「云端函数还没更新」
			 *          准备的：旧版 syncRoom 会忽略 force 直接早退，但 getRoom 一定走推进逻辑。
			 *
			 * 按 version 去重，同一个版本只会补一次，加 800ms 延迟等第一道先回来，不会形成循环。
			 */
			ensureRobotVotes() {
				if (!this.sync || !this.room || this.room.status !== 'playing') {
					return
				}
				if (!this.pendingRobotVotes.length) {
					return
				}
				const version = Number(this.room.version || 0)
				if (this.forcedRobotVersion === version) {
					return
				}
				this.forcedRobotVersion = version
				this.sync.syncNow({ force: true })
				this.scheduleRobotFallback(version)
			},
			/** 第二道兜底：getRoom 不依赖 force，任何服务端版本都会推进一次 */
			scheduleRobotFallback(version) {
				if (this.robotFallbackTimer) {
					clearTimeout(this.robotFallbackTimer)
				}
				this.robotFallbackTimer = setTimeout(async () => {
					this.robotFallbackTimer = null
					if (!this.room || this.room.status !== 'playing') {
						return
					}
					if (!this.pendingRobotVotes.length) {
						return
					}
					// 版本已经变了 → 第一道生效了，不用再补
					if (Number(this.room.version || 0) !== Number(version)) {
						return
					}
					try {
						const result = await getGameApi().getRoom({ roomId: this.roomId })
						if (result && result.errCode === 0 && result.data && result.data.room) {
							this.applySnapshot(result.data, { source: 'local', changed: true })
						}
					} catch (error) {
						console.warn('robot fallback getRoom failed', error)
					}
				}, 800)
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
				if (picked.message) {
					uni.showToast({
						title: picked.message,
						icon: 'none',
						duration: 2600
					})
				}
			},
			handleSelectSeat(seatIndex) {
				// 投票阶段：选中要淘汰的人
				if (this.canVote) {
					this.selectedSeat = seatIndex === this.selectedSeat ? -1 : seatIndex
					return
				}
				// 等待阶段：房主点席位可移出玩家
				if (this.canKick && Number(seatIndex) !== this.mySeat) {
					this.handleKickSeat(seatIndex)
				}
			},
			handleSpeakInput(event = '') {
				this.speakText = this.resolveInputText(event)
			},
			/**
			 * 把 fui-input 的 input 事件值规整成纯字符串。
			 *
			 * ⚠️ fui-input 的 `input` 事件回传的是**原始字符串**（组件里 `this.$emit('input', value)`），
			 * **不是**原生 input 的 `{ detail: { value } }` 结构。
			 * 早期写法 `event.detail.value` 会拿到 undefined → speakText 恒为 ''，
			 * 表现为「输入框明明有字，点发送却提示『先写一句描述』」。
			 *
			 * 为兼容三种可能的形状（纯字符串 / { detail: { value } } / { detail: '字符串' }），
			 * 逐层剥壳，与 `pages/plan/list.vue` 的 `resolveInputValue` 同一口径。
			 */
			resolveInputText(value = '') {
				if (value && typeof value === 'object') {
					value = value.detail
				}
				if (value && typeof value === 'object') {
					value = value.value
				}
				return value === null || value === undefined ? '' : String(value)
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
				} catch (error) {
					if (error.errCode === 'love-note-game-version-conflict') {
						if (this.sync) {
							await this.sync.syncNow()
						}
						uni.showToast({
							title: '手慢了，牌桌状态已更新',
							icon: 'none'
						})
						return
					}
					uni.showToast({
						title: error.message || '操作失败',
						icon: 'none'
					})
				}
			},
			handleStart() {
				if (!this.canStart) {
					const reason = this.startBlockReason || `至少 ${MIN_PLAYERS} 人才能开始`
					uni.showToast({
						title: reason,
						icon: 'none'
					})
					return
				}
				this.runRoomAction('undercoverStart', {
					wordSource: this.selectedWordId ? 'mine' : this.wordSource
				})
			},
			/**
			 * 卧底人数变更（uni-number-box 回传绝对值）。
			 *
			 * uni-number-box 是「先自己显示新值、再抛 change」，服务端拒绝时界面会跟房间状态脱节，
			 * 所以这里维护一个镜像值 `undercoverCountInput`：先乐观更新，拿到服务端结果后再以
			 * 房间的权威值（`undercoverSetting`）为准回滚。
			 */
			async handleUndercoverCountChange(next) {
				const fallback = Number(this.undercoverSetting || 1)
				const value = Math.min(2, Math.max(1, Number(next) || fallback))
				this.undercoverCountInput = value

				if (!this.isHost || !this.room || this.room.status !== 'waiting') {
					this.undercoverCountInput = fallback
					return
				}
				if (value === fallback) {
					return
				}

				// runRoomAction 内部已把失败 toast 掉；成功时它也会刷新快照
				await this.runRoomAction('setUndercoverCount', { count: value }, {
					successText: `卧底人数已设为 ${value} 个`
				})
				// 以服务端状态为准：成功=新值，失败=旧值
				this.undercoverCountInput = Number(this.undercoverSetting || fallback)
			},
			/**
			 * 聚会模式开关（原生 switch，change 回传 { value: Boolean }）。
			 * 和卧底人数同理：switch 会先自己切过去，服务端拒绝时必须回滚，
			 * 所以用 `partyModeInput` 做镜像，并以房间的 `partyModeOn` 为权威值。
			 */
			async handlePartyModeChange(event = {}) {
				const detail = event.detail || event
				const next = detail.value === undefined ? !this.partyModeInput : Boolean(detail.value)
				const fallback = this.partyModeOn
				this.partyModeInput = next

				if (!this.isHost || !this.room || this.room.status !== 'waiting') {
					this.partyModeInput = fallback
					return
				}
				if (next === fallback) {
					return
				}

				// runRoomAction 内部已把失败 toast 掉；成功时它也会刷新快照
				await this.runRoomAction('setPartyMode', { enabled: next }, {
					successText: next ? '已开启聚会模式' : '已关闭聚会模式'
				})
				this.partyModeInput = this.partyModeOn
			},
			handleSpeak() {
				const text = String(this.speakText || '').trim()
				if (!text) {
					uni.showToast({
						title: '先写一句描述',
						icon: 'none'
					})
					return
				}
				this.speakText = ''
				this.runRoomAction('undercoverSpeak', { text })
			},
			handleSkipSpeak() {
				this.runRoomAction('undercoverSkipSpeak', {}, { successText: '已跳过本次发言' })
			},
			handleVote() {
				if (this.selectedSeat < 0) {
					uni.showToast({
						title: '先点上方头像选择要淘汰的人',
						icon: 'none'
					})
					return
				}
				const target = this.selectedSeat
				this.selectedSeat = -1
				this.voteTarget = target
				this.runRoomAction('undercoverVote', { targetSeat: target }, { successText: '投票成功' })
			},
			/**
			 * 投票结果自检：投完还轮到我投（说明这一票没落库），补一次刷新再提示重试。
			 * 服务端已经在 castVoteForSeat 里做了「原子追加失败 → 乐观锁兜底」，
			 * 这里只兜「两条路都没写成」的极端情况，避免用户以为投了、其实没投。
			 */
			verifyMyVote() {
				if (!this.room || this.room.status !== 'playing') {
					return
				}
				if (this.state.phase !== 'vote') {
					return
				}
				if (this.hasVoted || this.myVoteTarget >= 0) {
					return
				}
				if (this.voteTarget < 0) {
					return
				}
				uni.showToast({
					title: '投票没提交成功，请再点一次',
					icon: 'none'
				})
				if (this.sync) {
					this.sync.syncNow()
				}
			},
			handleAddRobot() {
				if (!this.canAddRobot) {
					return
				}
				// envVersion 一并上报，服务端据此判断是否允许（正式环境会直接拒绝）；
				// 移除机器人不用另做入口：房主点机器人席位走的就是 handleKickSeat → kickPlayer
				this.runRoomAction('addRobot', {
					count: 1,
					envVersion: ENV_VERSION
				})
			},
			handleKickSeat(seatIndex) {
				if (!this.isHost || !this.room || this.room.status !== 'waiting') {
					return
				}
				const seats = this.room.seats || []
				const seat = seats.find((item) => Number(item.seatIndex) === Number(seatIndex))
				if (!seat) {
					return
				}
				uni.showModal({
					title: '移出玩家',
					content: `确定把 ${seat.nickname} 移出房间吗？`,
					success: (res) => {
						if (res.confirm) {
							this.runRoomAction('kickPlayer', { seatIndex })
						}
					}
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
			},
			handleLeaveRoom() {
				uni.showModal({
					title: '退出房间',
					content: this.isHost
						? '退出后房间里若只剩机器人或只有 1 个人，房间会自动解散。确定退出吗？'
						: '退出后你会离开本局，确定吗？',
					confirmText: '退出',
					confirmColor: '#e76f51',
					success: (res) => {
						if (res.confirm) {
							this.doLeaveRoom()
						}
					}
				})
			},
			async doLeaveRoom() {
				uni.showLoading({
					title: '正在退出',
					mask: true
				})
				try {
					const result = assertGameResult(
						await getGameApi().leaveRoom({ roomId: this.roomId }),
						'退出房间失败'
					)
					// 退出后立刻断开房间同步，免得页面还在拉一个自己已经不在的房间
					if (this.sync) {
						this.sync.stop()
						this.sync = null
					}
					clearActiveRoom(this.currentUid)
					uni.hideLoading()
					uni.showToast({
						title: result && result.data && result.data.closed ? '房间已解散' : '已退出房间',
						icon: 'none'
					})
					setTimeout(() => this.handleBackToHall(), 700)
				} catch (error) {
					uni.hideLoading()
					uni.showToast({
						title: error.message || '退出房间失败',
						icon: 'none'
					})
				}
			},
			handleShareTap() {
				uni.showToast({
					title: '点右上角「···」转发给朋友',
					icon: 'none',
					duration: 2400
				})
			}
		}
	}
</script>

<style>
	.uc-page {
		position: relative;
		box-sizing: border-box;
		min-height: 100vh;
		padding: 0 24rpx 60rpx;
		overflow: hidden;
	}

	.uc-page__glow {
		position: absolute;
		width: 320rpx;
		height: 320rpx;
		border-radius: 50%;
		filter: blur(28rpx);
		opacity: 0.42;
		z-index: 0;
		pointer-events: none;
	}

	.uc-page__glow--left {
		top: -90rpx;
		left: -120rpx;
		background: rgba(255, 180, 160, 0.48);
	}

	.uc-page__glow--right {
		top: 260rpx;
		right: -120rpx;
		background: rgba(255, 220, 174, 0.48);
	}

	.uc-navbar-wrap {
		/* 结构交给 uv-navbar；这里只负责通屏（负 margin 抵消 .uc-page 的左右 24rpx 内边距），
		   这样「右边界 = 屏幕右边界」成立，nav-bar.js 算出的 capsule inset 才对得上 */
		position: relative;
		z-index: 1;
		margin: 0 -24rpx;
	}

	.uc-navbar__back,
	.uc-navbar__rule {
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

	.uc-navbar__back-text {
		font-size: 40rpx;
		line-height: 1;
		color: #b05b48;
	}

	.uc-navbar__rule-text {
		font-size: 28rpx;
		font-weight: 700;
		color: #b98069;
	}

	/* 标题 + 连接状态标签纯展示。
	   uv-navbar 的左右插槽是绝对定位、可能和中间内容叠在一起，这里关掉点击，
	   保证中间层永远不会挡住返回键 / 规则按钮 */
	.uc-navbar__center {
		display: flex;
		align-items: center;
		gap: 14rpx;
		pointer-events: none;
	}

	.uc-navbar__title {
		font-size: 32rpx;
		font-weight: 700;
		color: #5a3427;
	}

	/* 连接状态标签的样式由 uni-tag 的 customStyle 提供（见 computed connStyle），
	   这里不再保留自定义 pill 类 */

	.uc-layer {
		position: relative;
		z-index: 1;
		padding-top: 18rpx;
	}

	.uc-hero {
		padding: 30rpx 12rpx 36rpx;
		text-align: center;
	}

	.uc-hero__emoji {
		display: block;
		font-size: 96rpx;
		line-height: 1;
	}

	.uc-hero__title {
		display: block;
		margin-top: 22rpx;
		font-size: 40rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.uc-hero__desc {
		display: block;
		margin-top: 14rpx;
		font-size: 25rpx;
		line-height: 1.7;
		color: #8b6659;
	}

	.uc-label {
		display: block;
		margin-bottom: 14rpx;
		font-size: 24rpx;
		color: #936d62;
	}

	/* 数字步进器改用 uni-number-box；
	   它的 <style> 不是 scoped，所以只能在页面里用 CSS 覆盖**非行内**的属性
	   （background / color 是组件通过 prop 传的行内样式，改不了，只能传暖色 prop）。
	   ⚠️ 该组件只在 value === 1 或 modelValue === 1 时才初始化内部值，
	   所以调用方**只传 :value，绝不能传 :model-value / v-model** ——
	   否则 value 与 modelValue 都不是 1 时，初值会显示成 0。 */
	.uc-numbox {
		height: 72rpx;
		border-radius: 22rpx;
		overflow: hidden;
	}

	.uc-numbox .uni-numbox-btns {
		width: 72rpx;
		height: 72rpx;
		padding: 0;
	}

	/* 圆角显式加在首尾按钮上：不依赖「组件 tag 上的 class 是否会合并到根节点」这一行为 */
	.uc-numbox .uni-numbox__minus {
		border-top-left-radius: 22rpx;
		border-bottom-left-radius: 22rpx;
	}

	.uc-numbox .uni-numbox__plus {
		border-top-right-radius: 22rpx;
		border-bottom-right-radius: 22rpx;
	}

	.uc-numbox .uni-numbox--text {
		margin-bottom: 0;
		font-size: 40rpx;
		font-weight: 700;
		line-height: 1;
	}

	.uc-numbox .uni-numbox__value {
		height: 72rpx;
		margin: 0;
		font-size: 32rpx;
		font-weight: 700;
		text-align: center;
	}

	.uc-numbox-row {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.uc-numbox-row__unit {
		font-size: 26rpx;
		color: #917165;
	}

	.uc-word-row {
		margin-top: 30rpx;
	}

	.uc-word-select {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20rpx 24rpx;
		border-radius: 20rpx;
		background: rgba(255, 250, 247, 0.98);
	}

	.uc-word-select__text {
		font-size: 27rpx;
		color: #5d372b;
	}

	.uc-word-select__arrow {
		font-size: 30rpx;
		color: #c9a99a;
	}

	.uc-actions {
		margin-top: 32rpx;
	}

	.uc-join {
		margin-top: 36rpx;
	}

	.uc-join__row {
		display: flex;
		align-items: center;
		gap: 18rpx;
	}

	.uc-join__btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 150rpx;
		height: 84rpx;
		border-radius: 22rpx;
		background: linear-gradient(135deg, #ffb37a 0%, #e76f51 100%);
	}

	.uc-join__btn-text {
		font-size: 28rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.uc-link {
		margin-top: 26rpx;
		text-align: center;
	}

	.uc-link__text {
		font-size: 24rpx;
		color: #b98069;
		text-decoration: underline;
	}

	/* ---------- 房间内 ---------- */

	.uc-room-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		padding: 24rpx 28rpx;
		border-radius: 30rpx;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.1);
	}

	.uc-room-bar__label {
		display: block;
		font-size: 21rpx;
		letter-spacing: 3rpx;
		color: #b98069;
	}

	.uc-room-bar__code {
		display: block;
		margin-top: 6rpx;
		font-size: 44rpx;
		font-weight: 700;
		letter-spacing: 6rpx;
		color: #5a3427;
	}

	.uc-room-bar__actions {
		display: flex;
		gap: 14rpx;
	}

	.uc-room-bar__action {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 14rpx 24rpx;
		border-radius: 999rpx;
		background: rgba(255, 241, 235, 0.98);
	}

	.uc-room-bar__action-text {
		font-size: 24rpx;
		color: #b05b48;
	}

	/* 退出是破坏性操作，用描边而不是实底，和「邀请」区分开 */
	.uc-room-bar__action--leave {
		padding: 12rpx 22rpx;
		background: transparent;
		border: 2rpx solid rgba(231, 111, 81, 0.34);
	}

	.uc-room-bar__action-text--leave {
		color: #c0674d;
	}

	.uc-my-word {
		margin-top: 22rpx;
		padding: 26rpx 28rpx;
		border-radius: 30rpx;
		background: linear-gradient(135deg, rgba(255, 236, 222, 0.98), rgba(255, 246, 236, 0.98));
		text-align: center;
	}

	.uc-my-word--undercover {
		background: linear-gradient(135deg, rgba(255, 219, 210, 0.98), rgba(255, 240, 234, 0.98));
	}

	.uc-my-word__label {
		display: block;
		font-size: 23rpx;
		color: #b98069;
	}

	.uc-my-word__count {
		font-size: 21rpx;
		color: #c0a094;
	}

	.uc-my-word__value {
		display: block;
		margin-top: 14rpx;
		font-size: 60rpx;
		font-weight: 700;
		letter-spacing: 4rpx;
		color: #5a3427;
	}

	.uc-my-word__tip {
		display: block;
		margin-top: 12rpx;
		font-size: 22rpx;
		color: #9a7c70;
	}

	.uc-stage {
		margin-top: 22rpx;
		padding: 20rpx 8rpx;
		text-align: center;
	}

	.uc-stage__title {
		display: block;
		font-size: 30rpx;
		font-weight: 700;
		color: #5b3529;
	}

	.uc-stage__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 23rpx;
		color: #917165;
	}

	.uc-section-title {
		display: block;
		margin-bottom: 12rpx;
		font-size: 26rpx;
		font-weight: 700;
		color: #5d372b;
	}

	/* ============ 对局记录时间线（发言 + 投票按轮次整合） ============ */
	.uc-timeline {
		margin-top: 22rpx;
		padding: 22rpx 26rpx;
		border-radius: 28rpx;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 16rpx 40rpx rgba(168, 110, 80, 0.08);
	}

	.uc-timeline__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.uc-timeline__title {
		margin-bottom: 0;
	}

	.uc-timeline__hint {
		flex-shrink: 0;
		font-size: 22rpx;
		color: #a58479;
	}

	.uc-timeline__round {
		padding-top: 4rpx;
	}

	/* 轮次之间的分割线 */
	.uc-timeline__divider {
		margin: 20rpx 0 18rpx;
		border-top: 1rpx dashed rgba(231, 204, 194, 0.9);
	}

	.uc-timeline__round-head {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-bottom: 14rpx;
	}

	.uc-timeline__round-title {
		font-size: 26rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.uc-timeline__round-live {
		padding: 0 12rpx;
		border-radius: 999rpx;
		background: rgba(255, 226, 205, 0.98);
		font-size: 18rpx;
		font-weight: 700;
		line-height: 1.8;
		color: #b05b48;
	}

	.uc-timeline__block {
		margin-bottom: 18rpx;
	}

	.uc-timeline__block:last-child {
		margin-bottom: 0;
	}

	.uc-timeline__block-title {
		display: block;
		margin-bottom: 8rpx;
		font-size: 22rpx;
		font-weight: 600;
		color: #a07d71;
	}

	.uc-timeline__who {
		display: flex;
		align-items: center;
		gap: 8rpx;
		flex-shrink: 0;
	}

	.uc-timeline__name {
		font-size: 25rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.uc-timeline__ai {
		padding: 0 8rpx;
		border-radius: 999rpx;
		background: #6cb8ff;
		font-size: 17rpx;
		font-weight: 700;
		line-height: 1.7;
		color: #ffffff;
	}

	.uc-timeline__mine {
		padding: 0 8rpx;
		border-radius: 999rpx;
		background: rgba(255, 226, 205, 0.98);
		font-size: 17rpx;
		font-weight: 700;
		line-height: 1.7;
		color: #b05b48;
	}

	/* 发言：名字与内容同一行内容自动换行 */
	.uc-timeline__speech {
		display: flex;
		align-items: flex-start;
		gap: 12rpx;
		padding: 10rpx 0;
	}

	.uc-timeline__speech-text {
		flex: 1;
		font-size: 25rpx;
		line-height: 1.6;
		color: #6d473a;
	}

	/* 投票：名字 → 目标 */
	.uc-timeline__vote {
		display: flex;
		align-items: center;
		gap: 12rpx;
		padding: 11rpx 0;
	}

	.uc-timeline__arrow {
		flex-shrink: 0;
		font-size: 24rpx;
		color: #c8a99d;
	}

	.uc-timeline__target {
		flex: 1;
		font-size: 25rpx;
		color: #c0674d;
	}

	.uc-timeline__empty {
		padding: 10rpx 0;
	}

	.uc-timeline__empty-text {
		font-size: 23rpx;
		color: #a58479;
	}

	.uc-timeline__pending {
		display: block;
		margin-top: 12rpx;
		font-size: 22rpx;
		color: #a58479;
	}

	/* 本轮结果：现在是独立的一整块（放一轮最上），`--lead` 去掉原 margin-top（已由 block 提供） */
	.uc-timeline__result {
		display: block;
		margin-top: 12rpx;
		padding: 10rpx 16rpx;
		border-radius: 18rpx;
		background: rgba(255, 246, 241, 0.98);
		font-size: 23rpx;
		color: #936d62;
	}

	.uc-timeline__result--lead {
		margin-top: 0;
	}

	/* ============ 悬浮操作栏 ============
	   fixed 在底部，滚动时始终可见可点（原来它跟在内容流里，
	   记录一多就被推到屏幕外，「确认投票」要点半天）。
	   ⚠️ 三条约束：
	   ① **通屏**：`position: fixed` 相对**视口**定位、脱离文档流，父容器 `.uc-page` 的
	      24rpx 左右内边距对 fixed 元素**不生效** —— 所以 `left: 0; right: 0` 就是全宽，
	      `margin` 保持 0 即可。**不要**照抄 navbar 的 `margin: 0 -24rpx`（navbar 是
	      `position: relative` 在文档流里，才需要负 margin 抵消父 padding，两者场景不同）；
	   ② **安全区**：底部 Home 横条会盖住按钮，用 padding-bottom 垫开。
	      写成 4 行回退链（项目口径同 firstui）：普通 18rpx → constant()（老 iOS）
	      → calc(18rpx + constant()) → calc(18rpx + env())（新 iOS/微信 WebView，逐行覆盖）；
	   ③ **z-index**：要高于 `.uc-layer`(1) 与装饰光晕(0)，低于各弹窗组件。 */
	.uc-op-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		box-sizing: border-box;
		margin: 0;
		padding: 18rpx 24rpx;
		padding-bottom: 18rpx;
		padding-bottom: constant(safe-area-inset-bottom);
		padding-bottom: calc(18rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(18rpx + env(safe-area-inset-bottom));
		background: rgba(255, 250, 247, 0.96);
		box-shadow: 0 -12rpx 36rpx rgba(168, 110, 80, 0.14);
		/* 顶部一道暖色细线，与内容区分开 */
		border-top: 1rpx solid rgba(231, 204, 194, 0.7);
	}

	/* 内容区底部占位：高度 = 悬浮栏实测高度（measureOpBar 写入行内 style）。
	   悬浮栏是 fixed，不占文档流；没有这个占位，最后一条对局记录会被压在栏下面。 */
	.uc-op-holder {
		width: 100%;
	}

	.uc-op {
		margin-top: 0;
	}

	.uc-op__row {
		display: flex;
		gap: 18rpx;
		margin-bottom: 18rpx;
	}

	.uc-op__row .uc-btn {
		flex: 1;
		margin-top: 0;
	}

	/* 房主开局前的「卧底人数」设置条 */
	.uc-config {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 18rpx;
		margin-bottom: 20rpx;
		padding: 22rpx 26rpx;
		border-radius: 26rpx;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 10rpx 24rpx rgba(168, 110, 80, 0.06);
	}

	.uc-config__label {
		font-size: 25rpx;
		font-weight: 600;
		color: #5a3427;
	}

	.uc-config__unit {
		font-size: 26rpx;
		color: #917165;
	}

	/* 聚会模式那行：标签靠左、开关靠右（提示文案 width:100% 会自己落到下一行） */
	.uc-config--spread {
		justify-content: space-between;
	}

	/* 原生 switch 只能靠 transform 缩一点；用 right 原点保证它仍贴着右边 */
	.uc-switch {
		transform: scale(0.82);
		transform-origin: right center;
	}

	.uc-config__warn,
	.uc-config__tip {
		width: 100%;
		font-size: 22rpx;
		line-height: 1.5;
	}

	.uc-config__warn {
		color: #d0523c;
	}

	.uc-config__tip {
		color: #b0938a;
	}

	.uc-op__hint {
		padding: 24rpx 28rpx;
		border-radius: 24rpx;
		background: rgba(255, 247, 243, 0.98);
		text-align: center;
	}

	.uc-op__hint-text {
		font-size: 25rpx;
		line-height: 1.6;
		color: #936d62;
	}

	.uc-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 90rpx;
		border-radius: 999rpx;
		background: rgba(255, 241, 235, 0.98);
	}

	.uc-btn--primary {
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 14rpx 26rpx rgba(231, 111, 81, 0.24);
	}

	.uc-btn--disabled {
		opacity: 0.5;
	}

	.uc-btn + .uc-btn {
		margin-top: 18rpx;
	}

	.uc-btn__text {
		font-size: 29rpx;
		font-weight: 600;
		color: #ffffff;
	}

	.uc-btn__text--ghost {
		color: #b05b48;
	}

	.uc-speak-input {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.uc-speak-input__btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 148rpx;
		height: 88rpx;
		border-radius: 22rpx;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	}

	.uc-speak-input__btn-text {
		font-size: 29rpx;
		font-weight: 700;
		color: #ffffff;
	}
</style>
