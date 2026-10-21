<template>
	<!-- 炸弹时整页抖一下（class 切换 → 重播动画见 .ll-page--bomb） -->
	<view class="ll-page" :class="{ 'll-page--bomb': bombOn }">
	<!-- 场景：QQ 三人斗地主的深绿房间 —— 中央桌面射灯光晕（纯 CSS，不引图片资源） -->
	<view class="ll-scene">
		<view class="ll-scene__glow"></view>
	</view>
	<!-- 牌桌：QQ 经典亮绿椭圆桌，桌沿压出屏幕底部 -->
	<view class="ll-desk"></view>
	<view class="ll-desk__grain"></view>
	<view class="ll-scene__vignette"></view>

		<!-- 顶栏：右内边距按胶囊位置动态给出（topSafeStyle），避免「叫分 / 规则」被胶囊盖住 -->
		<view class="ll-top" :style="topSafeStyle">
			<view class="ll-top__left">
				<view class="ll-top__btn" @click="handleBack">
					<text class="ll-top__btn-text">‹ 退出</text>
				</view>
				<view v-if="room" class="ll-top__code">
					<text class="ll-top__code-text">房号 {{ room.roomCode }}</text>
				</view>
			</view>

			<!-- 底牌盘：**嵌在顶栏中间**（绝对居中，不参与左右两组的 flex 排布）。
			     只在对局开始后显示（发牌后才有底牌）；不占牌桌竖向空间。 -->
			<view v-if="gameStarted" class="ll-tray">
				<view class="ll-tray__cards">
					<ll-card
						v-for="(cardId, index) in bottomCards"
						:key="'tray-' + index"
						:card-id="cardId"
						:width="24"
						:height="34"
						:face-down="bottomHidden"
					></ll-card>
				</view>
				<!-- 右侧：当局底分 + 当前倍数（叫分定地主后底分 1/2/3；倍数按炸弹连乘实时算） -->
				<text class="ll-tray__base">底分 {{ baseScoreText }} · {{ liveMultiplier }} 倍</text>
			</view>

			<view class="ll-top__right">
				<!-- 托管 / 取消托管：**图标按钮**，放在右上角最左侧（文字按钮太占地，牌桌上也没必要占一格）。
				     只有对局进行中（叫分 / 出牌）才有托管概念，等开局和结算不显示。
				     托管中：暖金底 + 右上角一个小 ×，表示「再点一下取消」。 -->
				<view
					v-if="showTrusteeBtn"
					class="ll-top__icon"
					:class="{ 'll-top__icon--on': isTrusteeSeat(mySeat) }"
					:aria-label="isTrusteeSeat(mySeat) ? '取消托管' : '托管'"
					@click="handleToggleTrustee"
				>
					<text class="ll-top__icon-emoji">🕹️</text>
					<text v-if="isTrusteeSeat(mySeat)" class="ll-top__icon-badge">×</text>
				</view>
				<view v-if="phase === 'bidding'" class="ll-top__phase">
					<text class="ll-top__phase-text">叫分</text>
				</view>
				<view class="ll-top__btn" @click="rulesVisible = true">
					<text class="ll-top__btn-text">规则</text>
				</view>
			</view>
		</view>

		<!-- 牌桌：**没有房间时不显示**（此时牌桌区换成居中的创建/加入入口） -->
		<view v-if="room" class="ll-board">
			<!-- 左侧对手 -->
			<view class="ll-side ll-side--left">
				<ll-seat
					v-if="leftSeat"
					:nickname="leftSeat.nickname"
					:avatar-url="leftSeat.avatarUrl"
					:role="seatRole(leftSeat.seatIndex)"
					:seat-index="leftSeat.seatIndex"
					:cards-left="cardsLeftOf(leftSeat.seatIndex)"
					:show-cards-left="gameStarted"
					:ready="Boolean(leftSeat.ready)"
					:show-ready="shouldShowReady(leftSeat.seatIndex)"
					:is-robot="leftSeat.isRobot"
					:is-trustee="isTrusteeSeat(leftSeat.seatIndex)"
					:trustee-auto="isTrusteeAuto(leftSeat.seatIndex)"
					:online="leftSeat.online !== false"
					:is-current="isCurrentSeat(leftSeat.seatIndex)"
					:size="'small'"
				></ll-seat>
				<text v-if="leftSeat" class="ll-side__score">{{ seatScoreText(leftSeat) }}</text>
				<!-- 出牌区：叠着摆（同 ll-hand），一行放不下自动换行；内部的 key 带整手牌内容 → 换牌才重播动画。
				     ⚠️ 不压暗（dimmed）：左右两家的牌也是要读的信息，半透明会透出桌面、叠牌互透。
				     ⚠️ 固定 step-width：每张只露出 18px，**跟张数无关** —— 牌多牌少露出的点数一样宽。
				     ⚠️ 占位区**定高 42px + 内部绝对定位**：牌行往下长也不会撑高这一列，
				        座位 / 分数一动不动；多行用 row-overlap 叠起来（每行只露 22px）。 -->
				<view class="ll-side__play">
					<view v-if="playedOf(leftSeatIndex).length" class="ll-side__play-inner">
						<ll-played
							:cards="playedOf(leftSeatIndex)"
							:card-width="30"
							:card-height="42"
							:max-width="128"
							:step-width="18"
							:row-overlap="22"
							:animated="playAnimated && isLatestSeat(leftSeatIndex)"
						></ll-played>
					</view>
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
						<ll-timer
							v-if="state.turn_deadline"
							:key="'ll-timer-' + state.timer_seq"
							:deadline="state.turn_deadline"
							:server-offset="serverOffset"
							:total="timerTotal"
							:show-bar="true"
							expired-text="推进中"
						></ll-timer>
					</view>

					<!-- 中央出牌区：同样叠着摆（同 ll-hand），一行放不下换行继续叠。
					     宽度上限跟着屏幕算，窄屏不会把左右两家挤出去 -->
					<view class="ll-center__play" :style="{ maxWidth: centerPlayMaxWidth + 16 + 'px' }">
						<template v-if="centerPlay.cards.length">
							<ll-played
								:cards="centerPlay.cards"
								:card-width="46"
								:card-height="64"
								:max-width="centerPlayMaxWidth"
								:enter-stagger="40"
								:seq="playSeq"
								:animated="playAnimated"
							></ll-played>
							<!-- 最后一手的信息（谁出的 / 什么牌型）就压在出牌区里，不用再往下看另一行 -->
							<text v-if="centerPlay.text" class="ll-center__play-caption">{{ centerPlay.text }}</text>
						</template>
						<text v-else-if="centerHint" class="ll-center__play-hint">{{ centerHint }}</text>
					</view>

					<!-- 牌型 / 倍数 / 当前回合：**合并成一行**（原来三条各占一行，横屏高度吃紧）。
					     允许换行兜底，但正常 667px 宽一行放得下。 -->
					<view
						v-if="centerPlay.multiplierText || currentTurnText"
						class="ll-center__meta"
					>
						<text v-if="centerPlay.multiplierText" class="ll-center__multiplier">{{ centerPlay.multiplierText }}</text>
						<text v-if="currentTurnText" class="ll-center__turn" :class="{ 'll-center__turn--mine': isMyTurn }">
							{{ currentTurnText }}
						</text>
					</view>
				</template>
			</view>

			<!-- 右侧对手 -->
			<view class="ll-side ll-side--right">
				<ll-seat
					v-if="rightSeat"
					:nickname="rightSeat.nickname"
					:avatar-url="rightSeat.avatarUrl"
					:role="seatRole(rightSeat.seatIndex)"
					:seat-index="rightSeat.seatIndex"
					:cards-left="cardsLeftOf(rightSeat.seatIndex)"
					:show-cards-left="gameStarted"
					:ready="Boolean(rightSeat.ready)"
					:show-ready="shouldShowReady(rightSeat.seatIndex)"
					:is-robot="rightSeat.isRobot"
					:is-trustee="isTrusteeSeat(rightSeat.seatIndex)"
					:trustee-auto="isTrusteeAuto(rightSeat.seatIndex)"
					:online="rightSeat.online !== false"
					:is-current="isCurrentSeat(rightSeat.seatIndex)"
					:size="'small'"
				></ll-seat>
				<text v-if="rightSeat" class="ll-side__score">{{ seatScoreText(rightSeat) }}</text>
				<view class="ll-side__play">
					<view v-if="playedOf(rightSeatIndex).length" class="ll-side__play-inner">
						<ll-played
							:cards="playedOf(rightSeatIndex)"
							:card-width="30"
							:card-height="42"
							:max-width="128"
							:step-width="18"
							:row-overlap="22"
							:animated="playAnimated && isLatestSeat(rightSeatIndex)"
						></ll-played>
					</view>
				</view>
			</view>
		</view>

		<!-- 还没进房间：牌桌区换成居中的创建 / 加入入口（原来这两个按钮挤在底部操作栏里） -->
		<view v-else class="ll-empty">
			<text class="ll-empty__title">还没有房间</text>
			<text class="ll-empty__desc">创建一个新房间，或输入好友分享的 6 位房间号</text>
			<view class="ll-empty__actions">
				<view class="ll-empty-action ll-empty-action--ghost" @click="handleCreateRoom">
					<text class="ll-empty-action__text">创建房间</text>
				</view>
				<view class="ll-empty-action ll-empty-action--primary" @click="joinVisible = true">
					<text class="ll-empty-action__text">输入房间号</text>
				</view>
			</view>
		</view>

		<!-- 底部：工具栏（操作按钮）与手牌**分两行**，按钮不再压在手牌上 -->
		<view v-if="room" class="ll-bottom">
			<view class="ll-toolbar">
				<ll-actions
					v-if="actionPhase"
					:phase="actionPhase"
					:is-host="isHost"
					:is-my-turn="isMyTurn"
					:self-ready="selfSeat && selfSeat.ready"
					:can-start="canStart"
					:start-block-reason="startBlockReason"
					:can-pass="canPass"
					:can-play="canPlay"
					:has-playable="hasPlayable"
					:host-offline="hostOffline"
					:is-test-env="isTestEnv"
					:can-add-robot="canAddRobot"
					@toggle-ready="handleToggleReady"
					@add-robot="handleAddRobot"
					@close-room="handleCloseRoom"
					@start="handleStart"
					@share="handleShareTap"
					@bid="handleBid"
					@pass="handlePass"
					@hint="handleHint"
					@play="handlePlay"
					@view-result="resultVisible = true"
					@rematch="handleRematch"
					@claim-host="handleClaimHost"
				></ll-actions>
			</view>

			<!-- 手牌行：**完全居中**（不给左侧人物栏让位），水平位置由 ll-hand 的 CSS auto margin 决定，
			     这里只提供一整行的容器；id 供 computeHandWidth 实测真实行宽（安全区 / padding 都算在内），
			     实测值只用来定 20 张牌的可用铺开宽度（handMaxWidth），不再参与居中偏移。 -->
			<view id="ll-hand-row" class="ll-hand">
				<!-- ⚠️ animSeq 只给「整局重建」用（开局 / 新一局）：+1 → 每张牌的 key 全变 → 逐张发牌。
				     底牌并入 / 出牌**不要**动它：ll-hand 内部用 handSeq 做静默重建，
				     老牌不播动画、只给新摸的底牌播插入动画。 -->
				<ll-hand
					:cards="myHand"
					:selected="selectedCards"
					:card-width="48"
					:card-height="70"
					:max-width="handMaxWidth"
					:selectable="canSelectCards"
					:disabled="!canSelectCards"
					:enter="handEnter"
					:anim-seq="dealSeq"
					@change="handleCardsChange"
				></ll-hand>
			</view>

			<!-- 我的人物栏：浮在手牌左下角（QQ 斗地主的摆法）。
			     ⚠️ 必须是浮层，不能进 .ll-toolbar —— 它会撑到 70px 高，把工具栏和牌桌一起挤变形。
			     牌的点数在左上角，被遮住的是牌左下角，不影响认牌。 -->
			<view class="ll-mybar">
				<ll-seat
					v-if="selfSeat"
					:nickname="selfSeat.nickname"
					:avatar-url="selfSeat.avatarUrl"
					:role="seatRole(mySeat)"
					:seat-index="mySeat"
					:show-cards-left="false"
					:ready="Boolean(selfSeat.ready)"
					:show-ready="shouldShowReady(mySeat)"
					:is-trustee="isTrusteeSeat(mySeat)"
					:trustee-auto="isTrusteeAuto(mySeat)"
					:online="selfSeat.online !== false"
					:is-current="isCurrentSeat(mySeat)"
					:size="'small'"
				></ll-seat>
				<!-- 对局未开始时信息区不显示：手牌还没发下来，「剩 0 张」是误导 -->
				<view v-if="gameStarted" class="ll-mybar__info">
					<text class="ll-mybar__count">剩 {{ myHand.length }} 张</text>
					<text v-if="selfSeat" class="ll-mybar__score">{{ seatScoreText(selfSeat) }}</text>
					<!-- 托管常驻标记：倒计时结束自动接管后一直亮着，直到玩家点右上角图标取消托管 -->
					<text v-if="isTrusteeSeat(mySeat)" class="ll-mybar__trustee">
						{{ isTrusteeAuto(mySeat) ? '自动托管中' : '托管中' }}
					</text>
				</view>
			</view>

			<!-- 托管 / 自动操作提示：横屏下从手牌栏里挪出来 ——
			     浮在底栏正中央、盖在手牌上层（手牌再长也挤不掉它，也不用改整条底栏的高度） -->
			<view v-if="autoActionMessage" class="ll-mybar__notice">
				<text class="ll-mybar__notice-text">{{ autoActionMessage }}</text>
			</view>
		</view>

		<!-- 炸弹特效：全屏白闪 + 整页抖动（v-if 重建节点，动画才会重播） -->
		<view v-if="bombOn" class="ll-bomb">
			<view class="ll-bomb__flash"></view>
			<text class="ll-bomb__text">炸弹 ×{{ state.bomb_count || 1 }}</text>
		</view>

		<!-- 加入房间（本页是 pageOrientation: landscape，弹框一律用 px 尺寸：
		     rpx 在横屏会按屏宽放大到 2 倍以上。⚠️ fui-bottom-popup 内部是 `radius + 'rpx'`，
		     必须传 Number —— 传 '32rpx' 会拼成 '32rpxrpx' 静默失效。） -->
		<fui-bottom-popup
			:show="joinVisible"
			:radius="16"
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
					:size="16"
					:radius="10"
					background-color="#fffaf7"
					color="#5a3427"
					:padding="['10px', '12px']"
					@input="handleJoinCodeInput"
				></fui-input>
				<view class="ll-join__btn" @click="handleJoinRoom">
					<text class="ll-join__btn-text">进入房间</text>
				</view>
			</view>
		</fui-bottom-popup>

		<ll-result
			:show="resultVisible"
			:result="result"
			:seats="room && room.seats ? room.seats : []"
			:my-seat="mySeat"
			:is-host="isHost"
			primary-text="再来一局"
			secondary-text="返回大厅"
			@close="resultVisible = false"
			@primary="handleRematch"
			@secondary="leaveRoomAndBack"
		></ll-result>

		<ll-rules
			:show="rulesVisible"
			@close="rulesVisible = false"
		></ll-rules>
	</view>
</template>

<script>
	import LlCard from './components/ll-card.vue'
	import LlHand from './components/ll-hand.vue'
	import LlPlayed from './components/ll-played.vue'
	import LlSeat from './components/ll-seat.vue'
	import LlTimer from './components/ll-timer.vue'
	import LlActions from './components/ll-actions.vue'
	import LlRules from './components/ll-rules.vue'
	import LlResult from './components/ll-result.vue'
	import { getGameApi, assertGameResult } from '@/common/api/game.js'
	import { createRoomSync } from '@/common/game/room-sync.js'
	import { saveActiveRoom, clearActiveRoom, getActiveRoom, resolveUnfinishedRoom } from '@/common/game/active-room.js'
	import { pickNewAutoActions } from '@/store/modules/game.js'
	import { COMBO_TEXT_FALLBACK } from '@/common/game/cards.js'
	// 牌型分析 / 「能不能管上」判断：与云函数 lib/landlord-combo.js 同源复制，
	// 只在本地算按钮状态（不发请求），保证与出牌校验完全同口径。
	import { findHints } from './lib/landlord-combo.js'
	import { useAppStateStore } from '@/store/app-state.js'
	import { hasValidLogin } from '@/common/auth-center.js'
	import { openLoginModal } from '@/common/auth-modal.js'
	import { getLandscapeTopSafeArea } from '@/common/utils/nav-bar.js'
	import { requirePageLogin } from '@/common/auth-entry.js'
	import { IS_TEST_ENV, ENV_VERSION } from '@/common/utils/env.js'

	const GAME_TYPE = 'landlord'
	// 房间页路由：onLoad 的登录闸门与 onShareAppMessage 共用
	const ROOM_PATH = '/pages/game/landlord/room'
	/**
	 * 分享卡片专用图（600×480，5:4）—— 见 onShareAppMessage 的注释。
	 * 图源：scripts/game-debug/landlord-share-card.html（改完后用无头 Chrome 重出图）。
	 */
	const SHARE_IMAGE = 'https://env-00jxhb140x6o.normal.cloudstatic.cn/love-note/landlord-table.jpg'
	const PLAYER_COUNT = 3
	const BID_MS = 15 * 1000
	const TURN_MS = 20 * 1000
	/** 自动操作提示在 ll-mybar__notice 里停留的时长（ms） */
	const AUTO_NOTICE_MS = 3600

	export default {
		components: {
			LlCard,
			LlHand,
			LlPlayed,
			LlSeat,
			LlTimer,
			LlActions,
			LlRules,
			LlResult
		},
		data() {
			return {
				appStateStore: null,
				// 横屏右上角胶囊的安全区（横屏不能用 statusBarHeight，见 nav-bar.js 注释）
				topSafe: getLandscapeTopSafeArea(),
				// 是否测试环境（微信开发版/体验版）；决定要不要显示「加机器人」入口
				isTestEnv: IS_TEST_ENV,
				room: null,
				answer: {},
				state: {},
				sync: null,
				serverOffset: 0,
				lastSeenSeq: 0,
				autoActionMessage: '',
				/** 自动操作提示的收起定时器（只在 notice 里显示，不弹 toast） */
				autoNoticeTimer: null,
				connMode: 'push',
				connStatus: 'connecting',
				selectedCards: [],
				joinVisible: false,
				joinCode: '',
				rulesVisible: false,
				resultVisible: false,
				resultShown: false,
				handMaxWidth: 420,
				// 自动续局防重入（onLoad 重跑 / 手动进房并发）
				autoEntering: false,
				/**
				 * 手牌行的实测宽度（屏宽 - 安全区 - 底栏左右 padding）。
				 * ⚠️ 只用来定 `handMaxWidth`（20 张牌的铺开宽度），**不再参与居中偏移** ——
				 *   牌行的水平居中由 ll-hand 的 CSS auto margin 负责。
				 */
				handContainerWidth: 0,
				/** 手牌行是否已经量到过真实宽度（没量到就一直用兜底值，room 到达后补测） */
				handRowMeasured: false,
				/** 手牌行宽度补测的定时器 */
				handMeasureTimer: null,
				// ---- 动画状态（全部由状态变化驱动，见下方 watch）----
				// 炸弹全屏特效开关：触发后 700ms 自动关闭
				bombOn: false,
				bombTimer: null,
				// 出牌动画版本号：牌桌上出现新的一手牌时 +1，作为 :key 让播放区重建、动画重播
				playSeq: 0,
				/**
				 * 当前中央展示的这一手牌的「身份签名」（座位 + 牌型 + 牌面）。
				 * 只有签名变了才算新牌 —— 快照重建同内容、选牌、出牌被拒，都不重播动画。
				 */
				lastPlayKey: '',
				/**
				 * 出牌动画总开关：**第一次真的看到有人出牌**之后才置 true。
				 *   · 进房 / 重连的第一帧只是「把已有牌局铺出来」，不播落牌动画；
				 *   · 一旦有过真实出牌，之后每一手（包括结算那一手、炸弹那一下）都照常播；
				 *   · 进入时就是 settled 的房间 → 永远没机会置 true → 全程静止。
				 */
				playAnimated: false,
				// 发牌动画版本号：每局开始 / 「再来一局」时 +1，作为 :key 让整手牌重建
				dealSeq: 0,
				/**
				 * 手牌发牌动画开关：同样是「真的开局」才置 'deal'。
				 * 进房时手上已经有牌（续局 / 已在结算）→ 保持空串，手牌直接铺开不飞。
				 */
				handEnter: '',
				/** 是否已经吃过第一份房间快照（用来抑制入场首帧的一切动画） */
				snapshotReady: false,
				/** 首帧快照标记：watcher 在同一个 tick 里据此跳过动画 */
				quietSnapshot: false,
				// 已经不在房间里了（主动退出 / 被移出 / 房间解散）。
				// 置 true 后 `persistActiveRoom` 只会清缓存、绝不会再写回 ——
				// 否则 onUnload 会把刚清掉的「继续对局」状态原样写回去。
				roomExited: false,
				// 「正在退出」防重入：确认弹窗与顶栏按钮可能被连点
				leavingRoom: false
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
			/**
			 * 对家落位：3 人成一桌才是「左右两家」。
			 * ⚠️ 只有 2 个人时（等第三位 / 刚加完机器人）必须把**唯一的对手放在左侧**：
			 * 早前这里用 `ring.length < PLAYER_COUNT` 直接把左右一起返回 -1，结果加了机器人
			 * 却什么头像都不显示（左侧一片空白）。2 人时右侧恒为 -1 —— 否则同一个人会左右各出现一次。
			 */
			leftSeatIndex() {
				const ring = this.ring
				const position = ring.indexOf(this.mySeat)
				if (position < 0 || ring.length < 2) {
					return -1
				}
				if (ring.length === 2) {
					return ring[(position + 1) % ring.length]
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
			/**
			 * 身份（地主 / 农民）是否已确定：**只有开局后、地主已经叫出来**的这一局才作数。
			 * 等待开局（phase 空串）/ 发牌 / 叫分阶段都为 false，`seatRole` 据此不给身份角标。
			 * ⚠️ 这是 computed，读的时候不带括号；别改成 method 还照 computed 用（会恒为真）。
			 */
			identityDecided() {
				return (
					(this.phase === 'playing' || this.phase === 'settled')
					&& this.toSeatIndex(this.state.landlord_seat) >= 0
				)
			},
			/**
			 * 这一局是否已经开局（发牌后）。房间还在 waiting、或根本还没进房间 → false。
			 * 只用来隐藏**底牌**（`.ll-bottom-cards`）：房间初始 `state.phase` 就是 `dealing`，
			 * 开局前底牌还没发下来，不该显示。我的手牌栏（`.ll-mybar`）**不受它限制**，进房就一直显示。
			 */
			gameStarted() {
				return Boolean(this.room) && this.room.status !== 'waiting'
			},
			rightSeat() {
				return this.findSeat(this.rightSeatIndex)
			},
			phase() {
				return this.state.phase || ''
			},
			/**
			 * 动作栏（ll-actions）用的阶段值 —— **和 `phase` 不是一回事**。
			 *
			 * `phase` 是服务端引擎的 `state.phase`，只有 bidding / playing / settled 三个真实阶段；
			 * 房间刚创建、还没发牌时服务端给的初始值是 `'dealing'`（见 game-room.js 的 buildInitialState），
			 * 它只是「还没开局」的占位，引擎里并不存在这个阶段。
			 *
			 * 而「等房主开局 / 点准备」判断的是 **`room.status === 'waiting'`**（房间状态，不是对局阶段）。
			 * 所以这里把两套状态合成动作栏能认的四个值：
			 *   · room.status === 'waiting' → 'waiting'（准备 / 开始 / 加机器人 / 解散）
			 *   · 其余按 state.phase（bidding / playing / settled）
			 * 否则 waiting 分支永远命中不了（phase 只会是 dealing），按钮组会是空的。
			 */
			actionPhase() {
				if (!this.room) {
					return ''
				}
				if (this.room.status === 'waiting') {
					return 'waiting'
				}
				return this.state.phase || ''
			},
			/**
			 * 顶栏的「托管 / 取消托管」图标按钮是否显示：只在**叫分 / 出牌**阶段出现。
			 * 等开局（waiting）没有牌可托管、结算后也不该再托管，都不显示。
			 */
			showTrusteeBtn() {
				const phase = this.actionPhase
				return phase === 'bidding' || phase === 'playing'
			},
			myHand() {
				return Array.isArray(this.answer.myHand) ? this.answer.myHand : []
			},
			/**
			 * 中央出牌区单行最大宽度：牌桌宽度扣掉左右两家（各 128）、间距和 padding 之后剩下的。
			 * 不设上限的话，一手机牌（12 张顺子）会把两边的头像直接挤出屏幕。
			 */
			centerPlayMaxWidth() {
				// handMaxWidth 已经是「屏幕长短边 - 32」，这里还原屏宽再扣占用
				const screenWidth = Math.max(280, Number(this.handMaxWidth) || 420) + 32
				const available = screenWidth - 28 - 256 - 16 - 16
				return Math.max(180, Math.min(320, available))
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
				return this.toSeatIndex(this.state.current_seat) === this.mySeat && this.mySeat >= 0
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
			/**
			 * 手里有没有能管住当前这一手的牌（本地牌型分析，不发请求）。
			 * 用来把「提示 / 出牌」置灰 —— 管不上时只有「不出」可点。
			 *
			 * 三种情况直接算「能出」：
			 *   · 不是自己回合（按钮本来就不作用于自己）；
			 *   · 没有 last_play（我先手，随便出）；
			 *   · last_play 是自己刚出的（新一轮，随便出）。
			 */
			hasPlayable() {
				if (!this.isMyTurn) {
					return true
				}
				const last = this.state.last_play
				if (!last) {
					return true
				}
				if (this.toSeatIndex(last.seat_index) === this.mySeat) {
					return true
				}
				const hand = this.myHand
				if (!hand.length) {
					return false
				}
				return findHints(hand, {
					combo_type: last.combo_type,
					main_rank: last.main_rank,
					card_count: last.card_count
				}).length > 0
			},
			/**
			 * 中央要展示的「最近一手」：
			 *   · 有 `last_play` → 用它（桌上这一手还要压）；
			 *   · 服务端已经把 `last_play` 清空（两家都过牌 → 新一轮先手）→
			 *     退回 `state.history[0]`，**继续显示上一个人出的牌**，不切成占位文案。
			 * `history` 是服务端维护的「全场最近 N 手」倒序表，第一项就是最近一手；
			 * 它不随 last_play 清空而丢，重连 / 切后台回来也能还原。
			 */
			latestPlay() {
				const last = this.state.last_play
				if (last && Array.isArray(last.cards) && last.cards.length) {
					return last
				}
				const history = Array.isArray(this.state.history) ? this.state.history : []
				const recent = history[0]
				if (recent && Array.isArray(recent.cards) && recent.cards.length) {
					return recent
				}
				return null
			},
			centerPlay() {
				const last = this.latestPlay
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
			/**
			 * 底分：叫分定地主后服务端会写 `base_score`（1/2/3），
			 * 未到叫分阶段（发牌中）兜底显示 1（QQ 牌桌顶一直挂着底分）。
			 */
			baseScoreText() {
				const value = Number(this.state.base_score || 0)
				return value > 0 ? String(value) : '1'
			},
			/**
			 * 当前倍数：QQ 口径是「炸弹 ×2 的连乘」（春天 / 反春天只在结算那一刻才算，游戏中不算）。
			 * 与服务端 settleGame 里 `Math.pow(2, bombCount)` 同口径；`state.multiplier` 是结算才写的权威值，
			 * 游戏中读它恒为 1，所以这里按 bomb_count 自己算。
			 */
			liveMultiplier() {
				const settled = Number(this.state.multiplier || 0)
				if (settled > 0 && this.phase === 'settled') {
					return settled
				}
				const bombCount = Number(this.state.bomb_count || 0)
				return Math.pow(2, bombCount) || 1
			},
			centerHint() {
				if (this.phase === 'bidding') {
					return '等待叫分…'
				}
				if (this.phase === 'settled') {
					return '本局已结束'
				}
				// 牌局中**不显示任何占位文案**：中央永远挂着「最近一手牌」，
				// 只有开局第一手之前（history 里还没有任何出牌）才是空盘。
				// 老文案「新一轮，先手出牌」在两家过牌后频繁闪出来，已去掉。
				return ''
			},
			currentTurnText() {
				if (this.phase === 'settled' || this.phase === 'dealing') {
					return ''
				}
				if (this.isMyTurn) {
					return this.phase === 'bidding' ? '轮到你叫分' : '轮到你出牌'
				}
				// current_seat 缺失 / 非法 → 不显示「等待谁操作」，绝不让 NaN 冒到文案里
				const seatIndex = this.toSeatIndex(this.state.current_seat)
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
				if (this.isHost) {
					// 房主不需要准备，只负责在其余人都准备好后点开局
					return this.notReadySeats.length
						? `等 ${this.notReadySeats.length} 人准备`
						: '人齐了，点「开始游戏」发牌'
				}
				// 非房主：人齐之后必须自己点准备，房主才能开局 —— 给出明确指引
				if (this.selfSeat && !this.selfSeat.ready) {
					return '人齐了，点「准备」让房主开局'
				}
				return '已准备，等房主开始游戏'
			},
			/** 房主座位号（服务端下发的 hostSeatIndex；缺失回退 -1） */
			hostSeatIndex() {
				return this.toSeatIndex(this.room && this.room.hostSeatIndex)
			},
			/**
			 * 还差谁准备 —— 开局门槛用：
			 * · **房主自己不需要准备**（房主是发起开局的人）；
			 * · **机器人视为已就绪**（它永远不会点准备，否则加了机器人就开不了局）；
			 * · 其余真人座位没 ready 的都算在内。
			 */
			notReadySeats() {
				const seats = this.room && Array.isArray(this.room.seats) ? this.room.seats : []
				const hostSeat = this.hostSeatIndex
				return seats.filter((seat) => {
					if (seat.isRobot) {
						return false
					}
					const seatIndex = this.toSeatIndex(seat.seatIndex)
					const isHostSeat = hostSeat >= 0
						? seatIndex === hostSeat
						: (this.isHost && seatIndex === this.mySeat)
					return !isHostSeat && !seat.ready
				})
			},
			/** 房主点「开始游戏」前的拦截原因（空串 = 可以开始）；非房主恒为空串 */
			startBlockReason() {
				if (!this.room || this.room.status !== 'waiting' || !this.isHost) {
					return ''
				}
				const playerCount = Number(this.room.playerCount || 0)
				if (playerCount < PLAYER_COUNT) {
					return `还差 ${PLAYER_COUNT - playerCount} 人`
				}
				if (this.notReadySeats.length) {
					return `等 ${this.notReadySeats.length} 人准备`
				}
				return ''
			},
		/** 房主是否能开局：人齐 + 其余玩家都已准备（房主本人不需要准备） */
		canStart() {
			return Boolean(
				this.room
				&& this.room.status === 'waiting'
				&& this.isHost
				&& !this.startBlockReason
			)
		},
		/**
		 * 加机器人是否可点：**仅测试环境**（正式版连入口都不显示，服务端也会拒绝）。
		 * 与卧底页同口径：isTestEnv + isHost + waiting + 人未满。
		 */
		canAddRobot() {
			const playerCount = Number(this.room && this.room.playerCount || 0)
			return Boolean(
				this.isTestEnv
				&& this.isHost
				&& this.room
				&& this.room.status === 'waiting'
				&& playerCount < Number(this.room.maxPlayers || PLAYER_COUNT)
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
			}
			// 结算弹框（ll-result）自己根据 result 对象组装标题 / 倍数行 / 3 人列表，
			// 不再在这里算 resultTitle / resultSubtitle / resultLines / resultPlayers / resultTips。
		},
		onLoad(options = {}) {
			this.ensureAppStateStore()

			// 分享卡片 / 外部链接直接落地本页时，微信**不经过** uni 路由 API，
			// 全局守卫（hh-router-guard / auth-guard 都基于 addInterceptor）拦不到冷启动入口。
			// 未登录 → redirectTo 登录页并带上回跳地址；登录成功后登录页会 redirect 回本页
			// （roomCode / roomId 原样保留），onLoad 再跑一遍即可直接进房。
			// ⚠️ onlyWithEntryParams：无房号（从大厅进来）时保留页面原有的就地登录弹窗。
			if (!requirePageLogin({
				route: ROOM_PATH,
				options,
				isLoggedIn: this.isLoggedIn,
				onlyWithEntryParams: true
			})) {
				return
			}

			this.refreshTopSafe()
			this.loadLocalState()
			this.computeHandWidth()

			const roomId = String(options.roomId || '').trim()
			const roomCode = String(options.roomCode || '').trim()
			if (roomId) {
				this.enterRoom({ roomId })
			} else if (roomCode) {
				this.enterRoom({ roomCode })
			} else {
				// 没带房号（冷启动 / 大厅点玩法名）：这个账号还有没结束的房间就直接续上。
				// ⚠️ 必须放 else 里：enterRoom 是异步的，上面两条分支此刻 `this.roomId` 还是空的，
				// 不加这个 else 会并发再去 join 另一间房。
				this.autoEnterUnfinishedRoom()
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
			// 只写缓存、**不退房**：系统返回 / 侧滑 = 返回大厅（可「继续对局」回来）。
			// 显式退出过的（roomExited）在这里只会被清掉，不会写回。
			this.clearAutoNoticeTimer()
			if (this.handMeasureTimer) {
				clearTimeout(this.handMeasureTimer)
				this.handMeasureTimer = null
			}
			this.persistActiveRoom()
			if (this.sync) {
				this.sync.stop()
				this.sync = null
			}
		},
		/**
		 * 分享卡片图：**不能用微信默认截图**。
		 * 本页是横屏 16:9，而分享卡片是 5:4 —— 默认截图只取左上角一块，
		 * 手牌、出牌区、两侧玩家状态全被裁掉，别人点进来完全看不出这是牌桌。
		 * 这里指定一张专门的 600×480（5:4）牌桌图：
		 * 顶部房号 + 底牌、左右两家头像/身份/剩牌、中央出牌区与倍数、
		 * 底部手牌与操作按钮全都在画面里。图源见 scripts/game-debug/landlord-share-card.html。
		 */
		onShareAppMessage() {
			const roomCode = this.room ? this.room.roomCode : ''
			return {
				title: roomCode
					? `三人斗地主｜房间号 ${roomCode}，三缺一快来`
					: '恋人手札｜三人斗地主',
				path: roomCode
					? `${ROOM_PATH}?roomCode=${roomCode}`
					: '/pages/game/index',
				imageUrl: SHARE_IMAGE
			}
		},
		/** 分享到朋友圈：横屏页面同样只能靠专用图，否则会被裁成一条 */
		onShareTimeline() {
			const roomCode = this.room ? this.room.roomCode : ''
			return {
				title: roomCode
					? `三人斗地主｜房间号 ${roomCode}，三缺一快来`
					: '恋人手札｜三人斗地主',
				query: roomCode ? `roomCode=${roomCode}` : '',
				imageUrl: SHARE_IMAGE
			}
		},
		/**
		 * 动画全部由服务端状态变化驱动（页面不预判）：
		 *   · 炸弹：bomb_count 变大 → 全屏白闪 + 整页抖
		 *   · 出牌：last_play 变了 → 播放区 :key 变化 → 重播入场动画
		 *   · 发牌：从 waiting 进入对局 / 局序号变化 → 整手牌 :key 变化 → 逐张飞入
		 *   · 底牌并入：手牌从 17 变 20 → **不在这里处理**：
		 *     ll-hand 自己 diff 出新增的 3 张，只给它们播插入动画，老牌只做位移动画。
		 *     （曾经的写法是 `dealSeq += 1` 整手重建，视觉上手牌会整体闪一下）
		 */
		watch: {
			// 首帧快照（进房 / 重连）只把已有牌局铺出来，不放炸弹
			'state.bomb_count'(next, prev) {
				if (this.quietSnapshot) {
					return
				}
				if (Number(next || 0) > Number(prev || 0)) {
					this.triggerBomb()
				}
			},
			/**
			 * 出牌动画：**只有真的换成另一手牌才 +1**。
			 * 判定用「座位 + 牌型 + 牌面」签名，而不是对象引用 ——
			 * 房间快照每次推送都会重建 `state.last_play`（同一个对象内容、新的引用），
			 * 按引用判会让人点一张牌、点一次「出牌」被服务端拒掉、甚至只是有人点了准备，
			 * 中央预览区都跟着重播一遍落牌动画。内容没变 = 没出新牌 = 什么都不做。
			 * `last_play` 被清空（其余两家都过牌 → 新一轮先手）同样不算新牌。
			 */
			'state.last_play'(next) {
				if (this.quietSnapshot) {
					return
				}
				this.syncPlayAnimation(next)
			},
			'room.status'(next, prev) {
				if (this.quietSnapshot) {
					return
				}
				if (prev === 'waiting' && next && next !== 'waiting') {
					this.lastPlayKey = ''
					this.handEnter = 'deal'
					this.dealSeq += 1
				}
			},
			'room.round'(next, prev) {
				if (this.quietSnapshot) {
					return
				}
				if (Number(next || 0) !== Number(prev || 0)) {
					this.lastPlayKey = ''
					this.handEnter = 'deal'
					this.dealSeq += 1
				}
			},
			/**
			 * 房间数据到了 → `.ll-bottom`（含 `#ll-hand-row`）这一刻才真正渲染出来。
			 * onLoad / onReady / onShow 测量时它还不存在（v-if="room"），只能拿到兜底宽度；
			 * 兜底值是「屏宽 - 32」，**没扣横屏安全区**（iPhone 左右各 44px），
			 * 用它算 20 张牌的铺开宽度会让整行超出屏幕。所以这里补测一次。
			 */
			room(next) {
				if (!next || this.handRowMeasured) {
					return
				}
				this.$nextTick(() => {
					this.measureHandRowWidth()
				})
			}
			// ⚠️ 不要再监听 myHand 去 +dealSeq：底牌并入（17 → 20）的「插入动画」
			// 由 ll-hand 内部 diff 新增牌来完成（老牌不重建，只让位）。
			// 这里一 +dealSeq，20 张牌的 key 全变 → 整手闪一下。
		},
		methods: {
			/** 炸弹特效：全屏白闪 + 整页抖动，700ms 后自动收起 */
			triggerBomb() {
				this.bombOn = true
				if (this.bombTimer) {
					clearTimeout(this.bombTimer)
				}
				this.bombTimer = setTimeout(() => {
					this.bombOn = false
					this.bombTimer = null
				}, 700)
			},
			/**
			 * 一手牌的「身份签名」：座位 + 牌型 + 牌面。空手牌 / 无 last_play 返回空串。
			 * 用内容而不是对象引用来判断「是不是同一手牌」—— 房间快照每次推送都会
			 * 重建 last_play（内容一样、引用不同），按引用判会频繁误重播落牌动画。
			 */
			playKeyOf(play) {
				if (!play || !Array.isArray(play.cards) || !play.cards.length) {
					return ''
				}
				return [
					this.toSeatIndex(play.seat_index),
					String(play.combo_type || ''),
					play.cards.join('_')
				].join('|')
			},
			/**
			 * 换了一手新牌 → 打开发动画开关并 +1 playSeq（中央 ll-played 的 key 随之变化）。
			 * 内容与上次相同 / 牌被清空 → **原地不动**（不重建节点、不刷新预览）。
			 */
			syncPlayAnimation(next) {
				const key = this.playKeyOf(next)
				if (!key || key === this.lastPlayKey) {
					return
				}
				this.lastPlayKey = key
				// 见过真实出牌 → 打开动画开关；结算那一手也走这里，
				// 所以「最后一手 / 最后一颗炸弹」照样有落牌与爆炸效果
				this.playAnimated = true
				this.playSeq += 1
			},
			/** 席位累计分文案（0 分也显示，方便三方横向对比） */
			seatScoreText(seat) {
				if (!seat) {
					return ''
				}
				const score = Number(seat.score || 0)
				return `${score > 0 ? '+' : ''}${score}`
			},
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
				// 还没有实测值时先用「屏宽 - 底栏左右 padding」兜底（首帧就有数，不会挤成一坨）。
				// ⚠️ 已有实测值就不要再用兜底值覆盖：横屏带安全区的机型兜底值比真实行宽大 88px，
				//    每次 onShow 都盖一次的话，牌行会跟着「变宽又变窄」跳一下。
				if (!this.handContainerWidth) {
					this.applyHandWidth(this.resolveHandFallbackWidth())
				}
				// 再实测手牌行真实宽度：横屏安全区（iPhone 左右各 44px）、
				// 页面 padding、左右两侧的人物栏都不参与这个宽度，
				// 用实测值算 20 张牌的铺开宽度，牌行中心才会与屏幕中心重合。
				this.$nextTick(() => {
					this.measureHandRowWidth()
				})
			},
			/**
			 * 兜底宽度：屏宽 - 底栏左右 padding(32)。
			 * ⚠️ 横屏下部分机型/时机的 `windowWidth` 仍是竖屏短边（如 375），
			 * 直接拿它算会让 20 张手牌挤成一坨（每张只露出 ~9px）。取长短边较大值兜底。
			 */
			resolveHandFallbackWidth() {
				try {
					const info = uni.getSystemInfoSync()
					const rawWidth = Number(info.windowWidth || 0)
					const rawHeight = Number(info.windowHeight || 0)
					const width = Math.max(rawWidth, rawHeight) || 375
					return Math.max(280, width - 32)
				} catch (error) {
					return 420
				}
			},
			/**
			 * 实测 `#ll-hand-row` 的真实宽度（拿不到就继续用兜底值，绝不抛错）。
			 *
			 * ⚠️ 手牌行挂在 `v-if="room"` 的 `.ll-bottom` 里：onLoad / onReady / onShow
			 *   跑的时候房间数据常常还没到 → 节点根本不存在，`boundingClientRect` 拿不到尺寸。
			 *   所以这里带**有限次重试**，并由 `watch.room` 在房间数据到达后再补测一次
			 *   （见 `measureHandRowWidth` 的调用点），否则会一直停在兜底值上。
			 */
			measureHandRowWidth(retry = 0) {
				try {
					uni.createSelectorQuery()
						.select('#ll-hand-row')
						.boundingClientRect((rect) => {
							const width = rect && Number(rect.width)
							// 横屏下正常都在 500+；明显偏小说明量到了未布局的节点
							if (!width || width < 240) {
								this.retryMeasureHandRow(retry)
								return
							}
							this.handRowMeasured = true
							this.applyHandWidth(width)
						})
						.exec()
				} catch (error) {
					// 部分端不支持 select / boundingClientRect，保留兜底宽度
				}
			},
			/** 节点还没排好版时 120ms 后再测，最多 3 次（进房首帧 / 刚切横屏） */
			retryMeasureHandRow(retry) {
				if (retry >= 3) {
					return
				}
				if (this.handMeasureTimer) {
					clearTimeout(this.handMeasureTimer)
				}
				this.handMeasureTimer = setTimeout(() => {
					this.handMeasureTimer = null
					this.measureHandRowWidth(retry + 1)
				}, 120)
			},
			/**
			 * 落地手牌行宽度：`handMaxWidth` = 牌行真实可用宽度（20 张牌要在这里排开）。
			 * ⚠️ 这个宽度只决定「牌摊多开」，**不参与居中** —— 居中由 ll-hand 的 CSS auto margin 负责。
			 */
			applyHandWidth(width) {
				const container = Math.max(280, Math.round(Number(width) || 0))
				if (container === this.handContainerWidth) {
					return
				}
				this.handContainerWidth = container
				// 牌行可用宽度 = 容器宽度（牌行在其中**完全居中**，左右留白自动对称）。
				// 20 张牌要在这个宽度里排开：牌越挤，露出的点数就越少，所以别再额外扣减。
				this.handMaxWidth = Math.max(280, Math.min(760, container))
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
				// settled 也保留：一房多局，结算后重进要能回到房间等下一局；
				// 但「已退出房间」（roomExited）只能清、不能写 —— onUnload 会在退出后紧接着触发，
				// 不挡住的话会把刚清掉的房间原样写回缓存，大厅又出现一张点不进去的「继续对局」。
				if (this.roomExited || !this.room) {
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
			/** 标记「已不在房间」：清活跃房缓存，并阻止 onUnload 把房间写回来 */
			markRoomExited() {
				this.roomExited = true
				clearActiveRoom(this.currentUid)
			},
			/**
			 * 座位号归一：非数字 / NaN / 负数 / 小数 / **空值** 一律回 -1。
			 * ⚠️ 别再用 `Number(x) < 0` 当守卫：**NaN < 0 恒为 false**，脏数据会直接漏过去，
			 * 最后渲染成「等待 座位NaN 操作」（真实事故：state 里 current_seat 缺失）。
			 * ⚠️ `Number(null)`/`Number('')`/`Number(false)` 都是 **0** —— 必须显式挡掉，
			 * 否则「没有值」会被当成「0 号座位」（曾把未定地主读成 0 号是地主）。
			 */
			toSeatIndex(value) {
				if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
					return -1
				}
				const num = Number(value)
				return Number.isFinite(num) && num >= 0 ? Math.floor(num) : -1
			},
			/** 按座位号取座位对象（非法座位号一律 null） */
			findSeat(seatIndex) {
				const target = this.toSeatIndex(seatIndex)
				if (target < 0) {
					return null
				}
				const seats = this.room && Array.isArray(this.room.seats) ? this.room.seats : []
				return seats.find((item) => this.toSeatIndex(item.seatIndex) === target) || null
			},
			seatName(seatIndex) {
				const target = this.toSeatIndex(seatIndex)
				const seat = this.findSeat(target)
				if (seat) {
					return seat.nickname || `座位${target + 1}`
				}
				return target >= 0 ? `座位${target + 1}` : '其他玩家'
			},
			/**
			 * 身份（地主 / 农民）。**只有身份已确定才返回**：等待开局 / 发牌 / 叫分阶段一律空 ——
			 * 用白名单（playing / settled）而不是只排除 dealing / bidding，避免出现
			 * 「phase 是空串（房间还没开局）却因为 state 里残留 landlord_seat 而提前亮身份」。
			 */
			seatRole(seatIndex) {
				if (!this.identityDecided) {
					return ''
				}
				const target = this.toSeatIndex(seatIndex)
				if (target < 0) {
					return ''
				}
				return target === this.toSeatIndex(this.state.landlord_seat) ? 'landlord' : 'farmer'
			},
			cardsLeftOf(seatIndex) {
				const left = this.state.cards_left || {}
				return Number(left[String(seatIndex)] || 0)
			},
			/**
			 * 等开局时是否在该座位下方显示「已准备 / 未准备」。
			 *   · 只有 `room.status === 'waiting'` 才显示（开局后让位给「剩 N 张」）；
			 *   · 房主不需要准备、机器人自动就绪 → 都不显示，避免出现假的「未准备」。
			 */
			shouldShowReady(seatIndex) {
				if (!this.room || this.room.status !== 'waiting') {
					return false
				}
				const target = this.toSeatIndex(seatIndex)
				if (target < 0) {
					return false
				}
				const seat = this.findSeat(target)
				if (!seat || seat.isRobot) {
					return false
				}
				return target !== this.hostSeatIndex
			},
			isTrusteeSeat(seatIndex) {
				const target = this.toSeatIndex(seatIndex)
				if (target < 0) {
					return false
				}
				const list = Array.isArray(this.state.trustee_seats) ? this.state.trustee_seats : []
				return list.some((item) => this.toSeatIndex(item) === target)
			},
			isTrusteeAuto(seatIndex) {
				const meta = this.state.trustee_meta || {}
				const item = meta[String(seatIndex)]
				return Boolean(item && item.auto)
			},
			isCurrentSeat(seatIndex) {
				const target = this.toSeatIndex(seatIndex)
				const current = this.toSeatIndex(this.state.current_seat)
				return target >= 0 && current === target && this.phase !== 'settled'
			},
			isLatestSeat(seatIndex) {
				const target = this.toSeatIndex(seatIndex)
				const last = this.state.last_play
				return target >= 0 && Boolean(last) && this.toSeatIndex(last.seat_index) === target
			},
			playedOf(seatIndex) {
				const history = Array.isArray(this.state.history) ? this.state.history : []
				const entry = history.find((item) => Number(item.seat_index) === Number(seatIndex))
				return entry && Array.isArray(entry.cards) ? entry.cards : []
			},
			/**
			 * 顶栏「‹ 退出」＝ **真正退房**（按钮上写着「退出」，语义明确；
			 * 与卧底页那个纯返回键 ‹ 不是一回事 —— 那边只返回、不退房）。
			 * 在房间里：走退房流程（对局中先确认），退完自动回大厅；
			 * 不在房间（创建 / 加入界面）：维持普通返回。
			 * ⚠️ 系统返回 / 侧滑不走这里：只返回大厅、保留房间（onUnload 只 persist）。
			 */
			handleBack() {
				console.log('handle back', this.room, this.roomId);
				if (this.room && this.roomId) {
					this.leaveRoomAndBack()
					return
				}
				const pages = getCurrentPages()
				if (pages && pages.length > 1) {
					uni.navigateBack()
					return
				}
				this.handleBackToHall()
			},
			/**
			 * 退房 + 回大厅（顶栏「退出」与结算弹窗「返回大厅」共用）。
			 * 对局进行中退出后本局交由系统托管，先弹确认防误触；等待中 / 已结算直接退。
			 */
			leaveRoomAndBack() {
				if (this.room && this.room.status === 'playing') {
					this.confirmLeaveRoom()
					return
				}
				this.doLeaveRoom()
			},
			/** 退出房间的二次确认 */
			confirmLeaveRoom() {
				uni.showModal({
					title: '退出房间',
					content: this.buildLeaveConfirmText(),
					confirmText: '退出',
					confirmColor: '#e76f51',
					success: (res) => {
						if (res.confirm) {
							this.doLeaveRoom()
						}
					}
				})
			},
			/** 退出确认文案：房主提示可能解散，对局中提示交托管（两条都成立时都要说） */
			buildLeaveConfirmText() {
				const playing = Boolean(this.room && this.room.status === 'playing')
				if (playing) {
					return this.isHost
						? '对局进行中，退出后本局将由系统托管代打；退出后房间里若只剩机器人或只有 1 个人，房间会自动解散。确定退出吗？'
						: '对局进行中，退出后本局将由系统托管代打，确定退出吗？'
				}
				if (this.isHost) {
					return '退出后房间里若只剩机器人或只有 1 个人，房间会自动解散。确定退出吗？'
				}
				return '确定要退出房间吗？'
			},
			/**
			 * 真正退出房间（顶栏「退出」/ 返回键 / 结算弹窗「返回大厅」最终都落到这里）。
			 * 对局进行中服务端会保留座位交托管（三人回合不能缺人），返回里带 transferredToTrustee 标记。
			 * 已经不在房间里（被移出 / 房间解散）也算退出成功 —— 不能把人卡在房间里出不去。
			 */
			async doLeaveRoom() {
				if (this.leavingRoom) {
					return
				}
				this.leavingRoom = true
				uni.showLoading({
					title: '正在退出',
					mask: true
				})
				try {
					const result = assertGameResult(
						await getGameApi().leaveRoom({ roomId: this.roomId }),
						'退出房间失败'
					)
					this.finishLeaveRoom(result)
				} catch (error) {
					const code = String((error && error.errCode) || '')
					if (code === 'love-note-game-not-in-room' || code === 'love-note-game-room-not-found') {
						// 已被移出 / 房间已解散：同样按退出处理，直接回大厅
						this.finishLeaveRoom(null)
						return
					}
					this.leavingRoom = false
					uni.hideLoading()
					uni.showToast({
						title: (error && error.message) || '退出房间失败',
						icon: 'none'
					})
				}
			},
			/** 退房成功后的统一善后：断开同步 → 清缓存（并阻止写回）→ 提示 → 回大厅 */
			finishLeaveRoom(result) {
				// 退出后立刻断开房间同步，免得页面还在拉一个自己已经不在的房间
				if (this.sync) {
					this.sync.stop()
					this.sync = null
				}
				this.markRoomExited()
				uni.hideLoading()
				const data = (result && result.data) || {}
				let title = '已退出房间'
				if (data.closed) {
					title = '房间已解散'
				} else if (data.transferredToTrustee) {
					title = '已退出，本局交由托管'
				}
				uni.showToast({
					title,
					icon: 'none'
				})
				setTimeout(() => this.handleBackToHall(), 700)
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
					// ⚠️ 这里只有一种模式（没有 silent 分支）—— loading 是无条件弹的，
					// 收尾也必须无条件收。早先误抄了 enterRoom 的 `if (!silent)`，
					// 结果 `silent` 没定义：创建成功后走到 finally 直接 ReferenceError。
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
			/**
			 * 没带房号进来（冷启动、从大厅点玩法名、从别的页面返回）时：
			 * **这个账号要是有没结束的房间，就直接进去**，不用再去大厅点一次「继续对局」。
			 *
			 * 判定交给 `resolveUnfinishedRoom`（服务端为准 + 本地缓存兜底），
			 * 只认当前玩法（拿着斗地主的房间进卧底页没有意义）。
			 * 进房用 silent 模式：房间已被回收时安静地清缓存留在本页，不弹错、也不把人踢回大厅。
			 */
			async autoEnterUnfinishedRoom() {
				if (!this.isLoggedIn || this.room || this.roomId || this.autoEntering) {
					return
				}
				this.autoEntering = true
				try {
					const brief = await resolveUnfinishedRoom({
						gameType: GAME_TYPE,
						uid: this.currentUid,
						fetchRemote: async () => {
							const result = await getGameApi().getActiveRoom()
							if (!result || (result.errCode && result.errCode !== 0)) {
								throw new Error((result && result.errMsg) || '获取进行中的对局失败')
							}
							return (result.data && result.data.room) || null
						}
					})
					if (!brief || !brief.roomId || this.room || this.roomId) {
						return
					}
					await this.enterRoom({ roomId: brief.roomId }, { silent: true })
				} finally {
					this.autoEntering = false
				}
			},
			/**
			 * 进房。`options.silent = true` 用于「自动续局」：
			 * 不弹 loading、失败也不弹 toast / 不踢回大厅（房间已被回收时只是清掉本地缓存）。
			 */
			async enterRoom(payload = {}, options = {}) {
				if (!this.requireLogin()) {
					return
				}
				const silent = options.silent === true
				if (!silent) {
					uni.showLoading({
						title: '进入房间',
						mask: true
					})
				}
				try {
					const result = assertGameResult(
						await getGameApi().joinRoom(payload),
						'进入房间失败'
					)
					this.applySnapshot(result.data, { source: 'local', changed: true, reset: true })
					this.startSync()
				} catch (error) {
					const code = String((error && error.errCode) || '')
					if (silent) {
						// 自动续局失败（房间已结束 / 已解散 / 自己已被移出）：清掉死缓存，安静留在本页
						if (payload.roomId) {
							this.markRoomExited()
						}
						return
					}
					uni.showToast({
						title: (error && error.message) || '进入房间失败',
						icon: 'none'
					})
					// 房间没了 / 自己已不在房间里：本地缓存里的「继续对局」已经是张死卡片，
					// 先清掉再回大厅，否则大厅会一直挂着一个点不进去的入口。
					if (code === 'love-note-game-room-not-found' || code === 'love-note-game-not-in-room') {
						if (payload.roomId) {
							this.markRoomExited()
						}
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
							this.markRoomExited()
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

				// 归一而不是裸 Number()：NaN 与任何值都不等（连自己也不等），会让「轮次没变」误判成变了
				const previousTurnSeat = this.toSeatIndex(this.state.current_seat)
				const previousDeadline = Number(this.state.turn_deadline) || 0
				const previousVersion = this.room ? Number(this.room.version) : -1
				const nextVersion = Number(payload.version || 0)

				if (meta.reset) {
					this.selectedCards = []
				}

				if (!payload.changed && nextVersion === previousVersion) {
					return
				}

				/*
				 * 首帧快照（进房 / 自动续局 / 重连后的第一份数据）只负责「把牌局铺出来」：
				 * watcher 里所有入场动画（发牌、落牌、炸弹）都要跳过 ——
				 * 否则进一个已经在结算的房间，会先把最后一手牌和炸弹重播一遍。
				 * ⚠️ 用 data 标记而不是 module 变量：重进页面要重新算。
				 */
				const firstSnapshot = !this.snapshotReady

				const room = payload.room
				this.room = room
				this.answer = room.answer || {}
				this.state = room.state || {}
				if (this.sync) {
					this.sync.setVersion(nextVersion)
				}

				if (firstSnapshot) {
					// watcher 是 pre-flush（渲染前）跑的，这个标记要撑到它们跑完；
					// nextTick 在本次渲染之后，正好收掉
					this.quietSnapshot = true
					this.snapshotReady = true
					// 首帧就把「桌上这一手」记成已播过：之后同内容的推送不会再触发落牌动画
					this.lastPlayKey = this.playKeyOf(this.state.last_play)
					this.$nextTick(() => {
						this.quietSnapshot = false
					})
				}

				// 轮次变化 → 清空已选牌，避免"选中了已经出掉的牌"
				const turnSeat = this.toSeatIndex(this.state.current_seat)
				const deadline = Number(this.state.turn_deadline) || 0
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
					// 不再清活跃房：一房多局，结算后留在房间，重进也能回来等下一局
				}
				if (this.phase !== 'settled') {
					// 新局开始（房主点了「再来一局」）→ 必须**同时收起结算弹框**。
					// 只重置 resultShown 不关弹框的话：弹框还开着，但新局没有 room.result，
					// ll-result 会退化成「本局结束 / 底分1 · 炸弹0 · 倍数1 / 无玩家列表」的空壳，
					// 再点里面的「再来一局」就会被服务端拒绝（rematch 要求 settled）——
					// 报「当前没有已结算的对局可重开」。
					this.resultShown = false
					this.resultVisible = false
				}
			},
			clearAutoNoticeTimer() {
				if (this.autoNoticeTimer) {
					clearTimeout(this.autoNoticeTimer)
					this.autoNoticeTimer = null
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
				if (!picked.message) {
					// 没有新消息就别动：提示交给定时器自然收起，
					// 否则下一次房间推送会把它秒清（看起来像闪一下）
					return
				}
				// 只在 ll-mybar__notice 里展示，不弹 toast（自动出牌次数每回合都弹会很吵）
				this.autoActionMessage = picked.message
				this.clearAutoNoticeTimer()
				this.autoNoticeTimer = setTimeout(() => {
					this.autoNoticeTimer = null
					this.autoActionMessage = ''
				}, AUTO_NOTICE_MS)
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
			// 仅测试环境开放（正式版连入口都不显示）；满员 / 非 waiting 也挡一道
			if (!this.canAddRobot) {
				return
			}
			// envVersion 一并上报，服务端据此判断是否允许（正式环境会直接拒绝）
			this.runRoomAction('addRobot', {
				count: 1,
				envVersion: ENV_VERSION
			})
		},
			handleStart() {
				if (!this.canStart) {
					uni.showToast({
						title: this.startBlockReason || '暂时不能开始',
						icon: 'none'
					})
					return
				}
				this.runRoomAction('landlordStart', {})
			},
			/** 结算后房主点「再来一局」：重新发牌，直接开新局 */
			handleRematch() {
				this.runRoomAction('rematch', {})
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
				// 手里根本没有能管住的牌 → 选了也出不去，直接提示（省一次服务端往返）
				if (!this.hasPlayable) {
					uni.showToast({
						title: '没有能管住的牌，只能不出',
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
				// 本地已知管不上 → 不必再请求服务端
				if (!this.hasPlayable) {
					uni.showToast({
						title: '这手牌管不上，建议不出',
						icon: 'none'
					})
					return
				}
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
							this.markRoomExited()
							this.handleBackToHall()
						})
					}
				})
			}
		}
	}
</script>

<style lang="scss">
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
		/* QQ 三人斗地主：墨绿房间背景，桌面亮绿椭圆叠在下方 */
		background: radial-gradient(ellipse at 50% 30%, #2f6d52 0%, #1c5440 38%, #0f3a2a 78%, #082018 100%);
		overflow: hidden;
	}

	/* 炸弹抖动：整页平移，配合 .ll-bomb 的白闪 */
	.ll-page--bomb {
		animation: ll-shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	@keyframes ll-shake {
		0%, 100% { transform: translate(0, 0); }
		15% { transform: translate(7px, -5px); }
		30% { transform: translate(-6px, 4px); }
		45% { transform: translate(5px, 5px); }
		60% { transform: translate(-4px, -4px); }
		80% { transform: translate(3px, 2px); }
	}

	/* ---------------- 场景：QQ 房间射灯（纯 CSS，不引图片） ---------------- */
	.ll-scene {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
	}

	/* 中央桌面射灯光晕：把视线收到牌桌上 */
	.ll-scene__glow {
		position: absolute;
		top: 8%;
		left: 50%;
		width: 760px;
		height: 760px;
		margin-left: -380px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(180, 230, 180, 0.32) 0%, rgba(120, 200, 140, 0.12) 38%, rgba(40, 90, 60, 0) 74%);
	}

	/* 暗角：四周收深，把视线收到牌桌上 */
	.ll-scene__vignette {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		background: radial-gradient(ellipse at 50% 44%, rgba(0, 0, 0, 0) 46%, rgba(6, 22, 16, 0.5) 100%);
	}

	/* ---------------- 牌桌：QQ 经典亮绿椭圆 + 更平缓的桌沿 ----------------
	   弧度：宽度拉到 152vw、高度 84vh、桌沿压出屏幕 20vh —— 弧顶更平缓，
	   不会把顶部底牌盘挤到桌沿上；左右也延伸出屏外，横屏看起来像一张铺满的大桌。 */
	.ll-desk {
		position: absolute;
		left: 50%;
		bottom: -20vh;
		width: 152vw;
		height: 84vh;
		margin-left: -76vw;
		border-radius: 50%;
		background: radial-gradient(ellipse at 50% 6%, #8fd48a 0%, #5cb868 30%, #3f9e56 56%, #2c6e42 86%, #1d4f30 100%);
		box-shadow: inset 0 10px 30px rgba(220, 250, 220, 0.42), inset 0 -18px 40px rgba(10, 50, 28, 0.45), 0 -12px 44px rgba(0, 30, 18, 0.4);
	}

	/* 桌面绒纹：低透明度白点交叉网（不用 mix-blend-mode，小程序真机支持不稳） */
	.ll-desk__grain {
		position: absolute;
		left: 50%;
		bottom: -20vh;
		width: 152vw;
		height: 84vh;
		margin-left: -76vw;
		border-radius: 50%;
		pointer-events: none;
		background:
			repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0 2px, rgba(255, 255, 255, 0) 2px 6px),
			repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0 2px, rgba(255, 255, 255, 0) 2px 6px),
			radial-gradient(ellipse at 50% 7%, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0) 48%);
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

	/* 顶栏图标按钮（托管 / 取消托管）：28×28 圆形，与「规则」按钮同高，
	   放在右上角最左侧（`ll-top__right` 的第一个子节点）。 */
	.ll-top__icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.22);
	}

	/* 托管中：暖金底 + 金色描边，一眼看出「当前是机器在打」 */
	.ll-top__icon--on {
		background: linear-gradient(180deg, #ffdf8e 0%, #ffb84d 100%);
		box-shadow: 0 0 0 2px rgba(255, 223, 142, 0.45);
	}

	.ll-top__icon-emoji {
		font-size: 14px;
		line-height: 1;
	}

	/* 右上角小 ×：提示「再点一下 = 取消托管」，纯图标不带文字 */
	.ll-top__icon-badge {
		position: absolute;
		top: -3px;
		right: -3px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: #e76f51;
		border: 1px solid rgba(255, 255, 255, 0.92);
		font-size: 9px;
		font-weight: 700;
		color: #ffffff;
		line-height: 1;
	}

	.ll-top__code {
		padding: 3px 10px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
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
		display: flex;
	}

	.ll-top__phase-text {
		font-size: 11px;
		color: #fff3ec;
	}

	/* 底牌盘：中央的白色托盘（3 张底牌 + 倍数标签），原来挤在顶栏里 */
	/* 底牌盘：**绝对居中嵌在顶栏里**（不参与 .ll-top 的 space-between 排布），
	   垂直居中于顶栏 → 不额外占用任何竖向空间。
	   横排（3 张牌 + 底分/倍数并排），高 42px。 */
	.ll-tray {
		position: absolute;
		top: calc(50% + 12px);
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 3;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 8px;
		padding: 4px 12px;
		border-radius: 6px;
		background: linear-gradient(180deg, rgba(255, 253, 250, 0.94), rgba(255, 238, 226, 0.9));
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.65), 0 4px 12px rgba(90, 50, 30, 0.2);
	}

	.ll-tray__cards {
		display: flex;
		gap: 2px;
	}
	:deep(.ll-tray__cards .ll-card__center) {
		top: calc(50% + 5px);
	}
	:deep(.ll-tray__cards .ll-card__center .ll-card__center-suit) {
		font-size: 12px;
	}

	/* 底分：挂在底牌盘右侧，用一条细分隔线跟牌隔开（不抢牌的视觉） */
	.ll-tray__base {
		padding-left: 8px;
		border-left: 1px solid rgba(176, 91, 72, 0.25);
		font-size: 10px;
		font-weight: 600;
		color: #b05b48;
		white-space: nowrap;
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

	/* 没房间时的居中入口：占掉牌桌那一行，让「创建房间 / 输入房间号」正好在屏幕中间 */
	.ll-empty {
		position: relative;
		z-index: 2;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 0 24px;
		min-height: 0;
	}

	.ll-empty__title {
		font-size: 18px;
		font-weight: 700;
		color: #fff6ef;
		text-shadow: 0 2px 6px rgba(40, 20, 10, 0.35);
	}

	.ll-empty__desc {
		font-size: 12px;
		color: rgba(255, 246, 239, 0.86);
	}

	.ll-empty__actions {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 6px;
	}

	.ll-side {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		/* 128 = 一行 6 张（30 + 18×5 = 120）+ 两侧余量 8px；比原来的 104 多放一张 */
		width: 128px;
		flex-shrink: 0;
	}

	.ll-side__score {
		font-size: 11px;
		font-weight: 600;
		color: #fff3ec;
		text-shadow: 0 1px 3px rgba(60, 25, 10, 0.55);
	}

	/* 出牌区占位：**固定 42px 高（正好一行牌）**，超出的行由内部绝对定位往下长。
	   ⚠️ 别再改回 min-height + 流内排布：`.ll-board` 是 align-items:center，
	   这一列一变高，座位就会被往上顶（用户明确要求「行数增加不要移动 ll-seat」）。
	   宽 128 与 ll-played 的 maxWidth 对齐。 */
	.ll-side__play {
		position: relative;
		width: 128px;
		height: 42px;
	}

	/* 牌行容器：绝对定位、水平居中，行多了只往上/下溢出，不参与这一列的排版 */
	.ll-side__play-inner {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
	}

	/* 出牌区的叠牌排版收在 ll-played 组件里（负 margin 叠放 + 超宽换行），
	   这里只保留页面级容器样式，别再往这里写 gap / flex-wrap 去跟组件抢布局。 */

	/* 中央区：计时器 / 出牌区 / 牌型信息，竖排居中。
	   底牌盘移到牌桌顶部后，这里整体**上移**（padding-bottom 把重心提起来，QQ 的出牌区在桌面中上部）。
	   gap 4px —— 牌桌可用高度只有 ~260px，必须紧凑。 */
	.ll-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
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

	/* 出牌区底盘：内容（ll-played）自己算宽度，这里只做居中和留白。
	   max-width 兜住「一手机牌」的极端情况，别把左右两家的头像挤出去。 */
	.ll-center__play {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: 62px;
		min-width: 150px;
		padding: 4px 8px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.14);
	}

	/* 最后一手的信息：「牌神 出牌 · 连对」。压在半透明底盘里，白字配深底才读得清 */
	.ll-center__play-caption {
		font-size: 10px;
		font-weight: 600;
		line-height: 1.2;
		color: rgba(255, 244, 235, 0.86);
		white-space: nowrap;
	}

	.ll-center__play-hint {
		font-size: 12px;
		color: rgba(255, 244, 235, 0.72);
	}

	/* 牌型 / 倍数 / 当前回合合并成一行：原来三条各占一行，横屏高度吃紧。
	   flex-wrap 兜底（窄屏可折成两行），但 667px 宽正常一行放得下。 */
	.ll-center__meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 4px 8px;
		max-width: 100%;
		padding: 0 8px;
	}

	.ll-center__multiplier {
		font-size: 11px;
		color: #ffd9a8;
		white-space: nowrap;
	}

	/* 当前回合：小胶囊（原来是独立一行 + 上下 padding，现在压成行内标签） */
	.ll-center__turn {
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.22);
		font-size: 11px;
		line-height: 1.5;
		color: #fff3ec;
		white-space: nowrap;
	}

	/* 轮到自己：高亮成暖金色，扫一眼就知道该你了 */
	.ll-center__turn--mine {
		background: linear-gradient(180deg, #ffdf8e 0%, #ffb84d 100%);
		color: #5a3a10;
		font-weight: 700;
	}

	/* ---------------- 横屏底栏：工具栏一行 + 手牌一行（上下分离，按钮不再压牌） ----------------
	   · .ll-toolbar  流内顶部一行，操作按钮**严格居中**（justify-content:center）
	   · .ll-hand     流内剩余空间，占满整行宽度 → 20 张牌能真正铺开
	   · .ll-mybar    浮层贴手牌左下角（头像，不占手牌宽度）
	   · .ll-mybar__notice 浮层，压在底栏**上方**（牌桌底部），不覆盖手牌
	   z-index：3 提示 > 2 人物 > 1 手牌 */
	.ll-bottom {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 2px;
		padding: 0 16px 10px;
		min-height: 0;
	}

	.ll-toolbar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex-shrink: 0;
		min-height: 34px;
	}

	/* 我的人物栏：**浮层**贴在手牌左下角（QQ 摆法），不占手牌水平空间、也不撑高工具栏。
	   z-index 2 > 手牌的 1，所以能盖在牌上；牌的点数在左上角，不受影响。 */
	.ll-mybar {
		position: absolute;
		left: 16px;
		bottom: 10px;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 8px;
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

	.ll-mybar__score {
		font-size: 11px;
		font-weight: 600;
		color: #ffe2c2;
	}

	/* 托管中的常驻标记（倒计时结束自动接管后一直显示，提醒玩家点「取消托管」） */
	.ll-mybar__trustee {
		padding: 1px 6px;
		border-radius: 999px;
		background: rgba(255, 214, 130, 0.22);
		border: 1px solid rgba(255, 214, 130, 0.6);
		font-size: 10px;
		font-weight: 700;
		color: #ffe6b0;
		white-space: nowrap;
		align-self: flex-start;
	}

	/* 托管 / 自动操作提示：浮在**底栏上方**（牌桌底部），不再压在手牌上。
	   `bottom: 100%` 相对 .ll-bottom 向上溢出；给一点空隙与阴影，读起来像一条状态条。 */
	.ll-mybar__notice {
		position: absolute;
		left: 50%;
		bottom: 18px;
		transform: translateX(-50%);
		z-index: 3;
		max-width: 62%;
		padding: 3px 12px;
		border-radius: 999px;
		background: rgba(12, 44, 28, 0.82);
		border: 1px solid rgba(255, 219, 130, 0.45);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
		text-align: center;
		white-space: nowrap;
		display: flex;
	}

	.ll-mybar__notice-text {
		font-size: 11px;
		color: #fff6e2;
	}

	/* 自己建立层叠上下文：叠牌内部有 z-index: 1..20（.ll-hand__item），
	   不隔离的话它们会跟浮层（托管提示）的 z-index 直接比大小。
	   z-index 3 > 人物栏的 2 —— **扑克牌优先显示在最上层**（选中出牌时牌盖住头像）。 */
	.ll-hand {
		position: relative;
		z-index: 3;
		flex: 1;
		width: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		min-width: 0;
		min-height: 86px;
	}

	/* 底部操作按钮已迁到 components/ll-actions.vue（自带样式），这里不再留样式。
	   .ll-empty 的「创建 / 输入房间号」用的是下面那套专属按钮样式，不要混用。 */

	.ll-empty-action {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 96px;
		height: 38px;
		padding: 0 18px;
		border-radius: 999px;
		box-shadow: 0 3px 8px rgba(0, 20, 12, 0.32);
	}

	.ll-empty-action--ghost {
		background: rgba(255, 255, 255, 0.92);
	}

	.ll-empty-action--primary {
		background: linear-gradient(180deg, #ffdf8e 0%, #ffb84d 55%, #f59b2a 100%);
		border-bottom: 2px solid #b86a14;
	}

	.ll-empty-action__text {
		font-size: 14px;
		font-weight: 700;
	}

	.ll-empty-action--ghost .ll-empty-action__text {
		color: #1c4f33;
	}

	.ll-empty-action--primary .ll-empty-action__text {
		color: #5a3a10;
	}

	/* 加入房间弹框：本页恒为横屏，内容用 px + 限宽居中（800px 宽的一行输入框太散） */
	.ll-join {
		width: 100%;
		max-width: 520px;
		margin: 0 auto;
		box-sizing: border-box;
		padding: 20px 24px 18px;
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
	/* ---------------- 炸弹特效 ----------------
	   `v-if="bombOn"` 创建节点 → 动画重播；z-index 压在全部内容之上，且不吃点击 */
	.ll-bomb {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.ll-bomb__flash {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: radial-gradient(circle at 50% 46%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 214, 150, 0.6) 42%, rgba(255, 150, 90, 0) 74%);
		animation: ll-bomb-flash 620ms ease-out both;
	}

	.ll-bomb__text {
		position: relative;
		font-size: 40px;
		font-weight: 700;
		letter-spacing: 4px;
		color: #fff6e4;
		text-shadow: 0 4px 18px rgba(180, 60, 20, 0.75), 0 0 30px rgba(255, 200, 120, 0.9);
		animation: ll-bomb-pop 620ms cubic-bezier(0.22, 1.3, 0.36, 1) both;
	}

	@keyframes ll-bomb-flash {
		0% { opacity: 0; }
		12% { opacity: 1; }
		100% { opacity: 0; }
	}

	@keyframes ll-bomb-pop {
		0% { transform: scale(0.4); opacity: 0; }
		30% { transform: scale(1.18); opacity: 1; }
		55% { transform: scale(1); }
		100% { transform: scale(1.35); opacity: 0; }
	}
</style>
