<template>
	<view class="ll-hand">
		<view class="ll-hand__inner" :style="innerStyle">
			<view
				v-for="(cardId, index) in sortedCards"
				:key="cardId + '#' + animSeq + '#' + handSeq"
				class="ll-hand__item"
				:style="itemStyle(index, cardId)"
				@touchstart="handleTouchStart(index, $event)"
				@touchmove.stop.prevent="handleTouchMove"
				@touchend="handleTouchEnd"
				@touchcancel="handleTouchEnd"
			>
				<ll-card
					:card-id="cardId"
					:width="cardWidth"
					:height="cardHeight"
					:selected="isSelected(cardId)"
					:clickable="selectable"
					:disabled="disabled"
					:enter="enterOf(cardId)"
					:enter-delay="enterDelayOf(cardId, index)"
					@card-tap="handleTapCard"
				></ll-card>
			</view>
		</view>
	</view>
</template>

<script>
	import LlCard from './ll-card.vue'
	import { sortCardIds } from '@/common/game/cards.js'

	/** 发牌错峰步长（ms）：第 n 张延后 n × 这个值 */
	const DEAL_STAGGER_MS = 70
	/** 底牌并入时，3 张新牌之间的错峰步长（ms） */
	const INSERT_STAGGER_MS = 90
	/** 插入动画整套跑完（最后一张 delay + 动画时长）后再把标记落袋，避免二次重播 */
	const INSERT_SETTLE_MS = 900
	/** 拖动判定阈值（px）：横向挪不够这么远就当「点击」，避免手抖把点选变成拖选 */
	const DRAG_MOVE_THRESHOLD = 6
	/**
	 * 触摸之后这段时间内忽略 click。
	 * 小程序里一次点击是 touchstart → touchend →（可能再补一个）tap，
	 * 选中已经在 touch 流程里处理过了，click 再处理一次就会「选上又取消」。
	 * 桌面 H5 只有鼠标 click、没有 touch 事件 → lastTouchAt 恒 0，守卫不会误伤。
	 */
	const TAP_SUPPRESS_MS = 500

	/**
	 * QQ 三人斗地主的手牌栏。
	 *
	 * 间距：目标步长是牌宽的 0.68（铺开手感），放不下时按可用宽度收紧（叠牌）。
	 *
	 * 定位：**绝对定位 + left = index × step**（不是负 margin 的 flex 行）。
	 *   · 位置只由数据下标决定 → 无论节点物理顺序如何，牌面顺序永远正确；
	 *   · 手牌一变就整手重建（见下面「动画」），所以位置不需要靠过渡去「让位」。
	 *
	 * 居中：整行的水平位置**交给 CSS**（`.ll-hand__inner { margin: 0 auto }` +
	 *   父级 `justify-content: center`），组件不再接收“容器宽度”去算偏移。
	 *   ⚠️ 别改回「页面上报容器宽度 → 算 marginLeft」：手牌行是 `v-if="room"` 才渲染的，
	 *      页面在 onLoad / onReady / onShow 里测 `#ll-hand-row` 时节点**还不存在**，
	 *      拿到的永远是「屏宽 - 32」的兜底值；横屏带安全区的机型（左右各 44px）兜底值
	 *      比真实行宽大 88px → 整行右移 44px。20 张时几乎填满看不出来，**出牌后就明显没居中**。
	 *
	 * 动画（两种重建，视觉完全不同）：
	 *   · 整局重建（开局 / 新一局）：页面把 `animSeq` +1 → key 全变 → 每张牌 enter='deal'，逐张发牌；
	 *   · 手牌变化（底牌并入 / 出牌）：组件把 `handSeq` +1 → key 全变 → **静默重建**：
	 *     老牌 enter=''（原地出现，不闪），只有底牌那 1~3 张 enter='insert'（从上方落下）。
	 *
	 * ⚠️ 为什么不复用老节点（真机踩过两次）：
	 *   小程序 `wx:for` 按 key 做 diff，往列表**中间插节点**时，被挪动的老节点行内样式
	 *   （left / margin）不会跟着更新 → 牌堆里偶现空白格、牌序错乱。
	 *   只改数据、不换 key 是修不掉的，必须让这批节点重新创建。
	 *
	 * 选牌：**点一下选一张 + 按住横向滑过 = 连续选一段**（QQ / 欢乐斗地主的手感）。
	 *   · 起点那张没选中 → 这一段全选上；起点已选中 → 这一段全取消（拖回去就撤销）；
	 *   · 拖动过程只改组件内部的 `drag.cards`，**只在抬手时 $emit 一次**，
	 *     否则手指每滑过一张就 setData 整手牌，小程序会卡；
	 *   · 手指挪了几张 = 横向位移 ÷ `step`（相邻两张牌左边缘的间距），
	 *     **不依赖容器绝对坐标**，所以不用 boundingClientRect、横竖屏都不会算错。
	 */
	export default {
		name: 'LlHand',
		components: { LlCard },
		props: {
			cards: { type: Array, default: () => [] },
			selected: { type: Array, default: () => [] },
			cardWidth: { type: Number, default: 56 },
			cardHeight: { type: Number, default: 80 },
			maxWidth: { type: Number, default: 480 },
			selectable: { type: Boolean, default: true },
			disabled: { type: Boolean, default: false },
			direction: { type: String, default: 'asc' },
			/**
			 * 'deal' 时逐张飞入；空串不出动画。
			 * 局中新增的牌由组件自己改成 'insert'（见 `enterOf`），与页面传的值无关。
			 */
			enter: { type: String, default: '' },
			/**
			 * 动画版本号。**只用于「整局重建」**（开局 / 新一局 / 再来一局）：
			 * 页面把它 +1 → 每张牌的 key 都变 → 全部重新创建 → 发牌动画重播。
			 * ⚠️ 底牌并入**不要**再加它 —— 那会把整手牌推翻重建，要的是插入动画。
			 */
			animSeq: { type: Number, default: 0 }
		},
		emits: ['change'],
		data() {
			return {
				/**
				 * 当前拖选会话：
				 *   { anchor, cursor, startX, mode, base, moved, cards }
				 * · anchor/cursor 都是 sortedCards 的下标，cursor 随手指左右滑动变化；
				 * · mode='add'（起点未选中）→ 这一段选上；'remove'（起点已选中）→ 这一段取消；
				 * · base 是按下那一刻的选中快照，每次重算都从快照推，避免反复加减出错；
				 * · cards 是「拖到此刻应有的选中结果」，渲染 / isSelected 优先读它。
				 */
				drag: null,
				/** 最近一次触摸的时间戳，用来挡掉触摸后补发的 click（见 TAP_SUPPRESS_MS） */
				lastTouchAt: 0,
				/**
				 * 已经上过屏的牌（id 列表）。
				 * 这些牌再次渲染时**不要再播任何入场动画** —— 它们只是换了位置，
				 * 只有真正新加进来的牌才该有「飞入」。
				 */
				settledIds: [],
				/**
				 * 底牌并入时新增的牌（17 → 20 那 3 张）。
				 * 有它时 `enterOf` 返回 'insert' → ll-card 播插入动画；
				 * 动画跑完由 `settleInsert` 挪进 settledIds，之后重新渲染也不会重播。
				 */
				insertIds: [],
				/** 插入标记的清理定时器 */
				insertTimer: null,
				/**
				 * 手牌内容版本号：**手牌一有变化就 +1**，参与 key → 整手牌静默重建。
				 *
				 * ⚠️ 为什么必须重建（真机踩过）：
				 *   小程序 `wx:for` 按 key 做 diff，往列表**中间插节点**时，被挪动的老节点
				 *   行内样式不会跟着更新（`left` 停在旧值），表现为「牌堆里偶现空白 + 牌序错乱」。
				 *   靠「复用老节点 + 只改 style」是修不掉的，只能让这批节点重新创建。
				 *
				 * 重建 ≠ 重播动画：老牌的 enter 由 settledIds 压成 ''（原地出现，不闪），
				 * 只有底牌那 3 张走 enter='insert'（从上方落下）。视觉上就是「插入」，
				 * 不会像以前那样整手牌重播发牌动画。
				 */
				handSeq: 0,
				/**
				 * 「整局重建」标记：animSeq 变化后置 true，下一个 cards 变化就别当成
				 * 「出牌变少」把老牌标成已上屏（否则新一局会没有发牌动画）。
				 * 同一批服务端推送里 cards / animSeq 一定一起到，nextTick 后自动失效。
				 */
				awaitRoundDeal: false
			}
		},
		watch: {
			// 父级把新的 selected 传回来 → 拖选缓存作废，否则会盖掉外部改动（如「提示」选好的牌）
			selected() {
				this.drag = null
			},
			/**
			 * 手牌数组变了 → 区分「整局换牌」和「局中并入底牌」，并**静默重建**：
			 *   · 一次只多 1~3 张、原有牌都还在 → 底牌并入 → 老牌不播动画，新牌播 insert；
			 *   · 开局 0→17（还没有老节点）→ 交给 enter='deal' 逐张飞入；
			 *   · 出牌变少 / 整局换牌 → 剩下的牌都算「已上屏」，重建后原地出现（不重播发牌）。
			 * 每次真变化都 `handSeq += 1` → key 全变 → 节点重建，绕开小程序 diff 的挪节点问题。
			 */
			cards(next, prev) {
				this.drag = null
				this.detectMerge(next, prev)
			},
			// animSeq 变了 = 整手牌要重建（key 全变）→ 所有牌都按 enter 重新飞入
			animSeq() {
				this.drag = null
				this.resetEnterState()
				// 和手牌同一批到达：让紧随其后的 cards 变化别把新牌标成「已上屏」
				this.awaitRoundDeal = true
				this.$nextTick(() => {
					this.awaitRoundDeal = false
				})
			}
		},
		computed: {
			sortedCards() {
				return sortCardIds(this.cards, this.direction)
			},
			step() {
				const count = this.sortedCards.length
				if (count <= 1) {
					return 0
				}
				const available = Math.max(this.cardWidth * 2, Number(this.maxWidth) || 0)
				const desired = this.cardWidth * 0.68
				const fit = (available - this.cardWidth) / (count - 1)
				return Math.max(this.cardWidth * 0.16, Math.min(desired, fit))
			},
			/**
			 * 牌行尺寸：宽度 / 高度只按「张数 × 步长」算，**水平居中完全交给 CSS**。
			 *
			 * ⚠️ 不要再用“容器宽度”算 `marginLeft = (container - total) / 2`：
			 *   手牌行是 `v-if="room"` 才渲染的，页面第一次测宽度时节点还不存在，
			 *   上报的是「屏宽 - 32」的兜底值（带横屏安全区的机型比真实行宽大 88px）→
			 *   整行右移 44px，牌越少越明显（20 张时几乎填满，出牌后就看出「没居中」）。
			 *   `.ll-hand__inner { margin: 0 auto }` 跟着容器**真实**宽度走，
			 *   出牌、横竖屏切换、PC 窗口拉伸都不用重新测量。
			 */
			innerStyle() {
				const count = this.sortedCards.length
				if (!count) {
					return {}
				}
				const total = this.cardWidth + this.step * (count - 1)
				return {
					width: `${total}px`,
					height: `${this.cardHeight + 16}px`
				}
			},
			/** 能不能选牌：不是我的回合 / 手牌为空时，拖和点都不该有反应 */
			canSelect() {
				return this.selectable && !this.disabled && this.sortedCards.length > 0
			}
		},
		methods: {
			/** 拖选中优先读 `drag.cards`，这样滑动过程不用等父级回传就能立刻高亮 */
			isSelected(cardId) {
				const list = this.drag ? this.drag.cards : (this.selected || [])
				return list.indexOf(cardId) !== -1
			},
			/**
			 * 这张牌用哪种入场动画：
			 *   · 刚并入的底牌 → 'insert'（从上方落下 + 放大回弹，带一圈金光）
			 *   · 已经在屏上的牌 → ''（只做位移，绝不重播发牌动画）
			 *   · 其余（首次发牌 / 整局重建）→ 页面传的 enter（'deal'）
			 */
			enterOf(cardId) {
				if (this.insertIds.indexOf(cardId) >= 0) {
					return 'insert'
				}
				if (this.settledIds.indexOf(cardId) >= 0) {
					return ''
				}
				return this.enter
			},
			/** 插入的 3 张按 90ms 错峰；整手发牌仍按 index × 70ms */
			enterDelayOf(cardId, index) {
				const at = this.insertIds.indexOf(cardId)
				if (at >= 0) {
					return at * INSERT_STAGGER_MS
				}
				return index * DEAL_STAGGER_MS
			},
			/**
			 * 手牌数组变化 → 判断是不是「底牌并入」：
			 *   · 一次只多 1~3 张、原有牌都还在 → 是（地主摸底牌）；
			 *   · 开局 0→17、出牌变少、整局换牌 → 不是，清空标记（重建交给 animSeq）。
			 * 用「多几张」而不是「animSeq 变没变」判断，是因为新一局的牌 id 会和上一局重合，
			 * 只靠 seq 判断会把老牌误标成新牌。
			 */
			detectMerge(next, prev) {
				const nextList = Array.isArray(next) ? next : []
				const prevList = Array.isArray(prev) ? prev : []
				// 房间状态推送会反复重建 answer 对象（手牌数组引用变了、内容没变）→
				// 这不是「手牌变化」，不能清掉正在播的插入动画，直接忽略
				const sameHand = nextList.length === prevList.length
					&& nextList.every((cardId) => prevList.indexOf(cardId) >= 0)
				if (sameHand) {
					return
				}
				const added = nextList.filter((cardId) => prevList.indexOf(cardId) < 0)
				const isMerge = prevList.length > 0
					&& added.length > 0
					&& added.length <= 3
					&& nextList.length > prevList.length

				this.clearInsertTimer()
				// 已经有牌在屏上 → 换 key 让节点重建（小程序挪节点时行内样式不更新，见 handSeq 注释）
				if (prevList.length > 0) {
					this.handSeq += 1
				}
				if (this.awaitRoundDeal) {
					// 这一批是「新一局发牌」：所有牌都该重新飞入，不能标成已上屏
					this.awaitRoundDeal = false
					this.settledIds = []
					this.insertIds = []
					return
				}
				if (!isMerge) {
					// 出牌变少 / 整局换牌：剩下的牌都算「已上屏」，
					// 重建后原地出现，绝不重播发牌动画
					this.settledIds = prevList.length > 0 ? nextList.slice() : []
					this.insertIds = []
					return
				}
				this.settledIds = prevList.slice()
				this.insertIds = added
				this.insertTimer = setTimeout(() => {
					this.insertTimer = null
					this.settleInsert()
				}, INSERT_SETTLE_MS)
			},
			/** 插入动画跑完 → 新牌算「已上屏」，之后任何重渲染都不会再播 */
			settleInsert() {
				if (!this.insertIds.length) {
					return
				}
				this.settledIds = this.settledIds.concat(this.insertIds)
				this.insertIds = []
			},
			/** 整手重建前清空标记：所有牌都要按 enter 重新飞入 */
			resetEnterState() {
				this.clearInsertTimer()
				this.settledIds = []
				this.insertIds = []
			},
			clearInsertTimer() {
				if (this.insertTimer) {
					clearTimeout(this.insertTimer)
					this.insertTimer = null
				}
			},
			/**
			 * 叠牌定位：left 绝对定位 + z-index 递增（右边的牌压左边）。
			 *
			 * ⚠️ 不能用负 margin 的 flex 行：小程序 `wx:for` 往中间插节点时，
			 * 新节点可能被挂到列表尾部（旧实现只能整手重建来纠正）。
			 * 位置由数据下标算出来 → 节点物理顺序再乱，牌面顺序也不会错。
			 *
			 * ⚠️ **选中位移必须放在 item 上，不能放 ll-card 上**：
			 * ll-card 的入场动画是 `animation: ... both`，`fill-mode: both` 会让动画的最终帧
			 * （`transform: translate(0,0) scale(1)`）**持续占据 transform 属性** ——
			 * 动画声明的优先级高于普通样式，写在 ll-card 上的 `translateY(-12px)` 永远不生效。
			 * item 没有动画，位移与 transition 放这里才真正生效（取消选中也能平滑回落）。
			 */
			itemStyle(index, cardId) {
				const selected = this.isSelected(cardId)
				return {
					left: `${index * this.step}px`,
					zIndex: index + 1,
					transform: selected ? 'translateY(-12px)' : 'translateY(0)'
				}
			},
			/**
			 * 按下：记下起点牌与「这次是选还是取消」，并立刻把起点那张算进结果（按下去就有反馈）。
			 * `index` 由模板传进来，就是被按住那张牌在 sortedCards 里的下标。
			 */
			handleTouchStart(index, event) {
				this.lastTouchAt = Date.now()
				if (!this.canSelect) {
					return
				}
				const touch = event && event.touches && event.touches[0]
				if (!touch) {
					return
				}
				const count = this.sortedCards.length
				const anchor = Math.max(0, Math.min(count - 1, Number(index) || 0))
				const base = Array.isArray(this.selected) ? this.selected.slice() : []

				this.drag = {
					anchor,
					cursor: anchor,
					startX: Number(touch.clientX) || 0,
					// 起点已经选中 → 这次滑动是「把这一段取消」；否则是「把这一段选上」
					mode: base.indexOf(this.sortedCards[anchor]) >= 0 ? 'remove' : 'add',
					base,
					moved: false,
					cards: []
				}
				this.drag.cards = this.buildSelection(this.drag)
			},
			/** 滑动：只在「跨过一张牌」时才重算 + 重渲染，别让每个 touchmove 都 setData */
			handleTouchMove(event) {
				const drag = this.drag
				if (!drag) {
					return
				}
				const touch = event && event.touches && event.touches[0]
				if (!touch) {
					return
				}
				const deltaX = (Number(touch.clientX) || 0) - drag.startX
				if (!drag.moved) {
					if (Math.abs(deltaX) < DRAG_MOVE_THRESHOLD) {
						return
					}
					drag.moved = true
				}
				const cursor = this.dragIndexAt(drag, touch.clientX)
				if (cursor === drag.cursor) {
					return
				}
				drag.cursor = cursor
				drag.cards = this.buildSelection(drag)
			},
			/** 抬手：整段选中只在这里 $emit 一次 */
			handleTouchEnd() {
				this.lastTouchAt = Date.now()
				const drag = this.drag
				if (!drag || !this.canSelect) {
					this.drag = null
					return
				}
				const next = drag.cards.slice()
				// 没变化就别惊动父级（否则父级赋值 → selected 变化 → 白渲染一轮）
				if (this.sameSelection(next, this.selected)) {
					return
				}
				this.$emit('change', next)
			},
			/**
			 * 手指横移到第几张牌：**相对起点**算，不依赖容器绝对坐标
			 * （所以不用 boundingClientRect，横屏/竖屏/父级布局变化都不会算偏）。
			 * step 是相邻两张牌左边缘的间距（叠牌时比牌宽小），位移 ÷ step 四舍五入 = 挪过几张。
			 */
			dragIndexAt(drag, clientX) {
				const count = this.sortedCards.length
				const step = Math.max(6, Number(this.step) || Number(this.cardWidth) || 1)
				const offset = Math.round(((Number(clientX) || 0) - drag.startX) / step)
				return Math.max(0, Math.min(count - 1, drag.anchor + offset))
			},
			/**
			 * 把「base 快照 ± [anchor, cursor] 这一段」算成新的选中数组。
			 * 每次都从快照重算（而不是在上一轮结果上加减）→ 手指来回拖也不会重复加减。
			 */
			buildSelection(drag) {
				const cards = this.sortedCards
				const from = Math.min(drag.anchor, drag.cursor)
				const to = Math.max(drag.anchor, drag.cursor)
				const picked = drag.base.slice()

				for (let index = from; index <= to; index += 1) {
					const cardId = cards[index]
					if (cardId === undefined) {
						continue
					}
					const position = picked.indexOf(cardId)
					if (drag.mode === 'add') {
						if (position < 0) {
							picked.push(cardId)
						}
					} else if (position >= 0) {
						picked.splice(position, 1)
					}
				}

				// 统一按手牌顺序输出：提示 / 出牌 / 结算看起来都更自然
				const ordered = cards.filter((cardId) => picked.indexOf(cardId) >= 0)
				picked.forEach((cardId) => {
					if (ordered.indexOf(cardId) < 0) {
						ordered.push(cardId)
					}
				})
				return ordered
			},
			/** 两个选中数组是不是同一套牌（顺序无关） */
			sameSelection(left, right) {
				const a = Array.isArray(left) ? left : []
				const b = Array.isArray(right) ? right : []
				if (a.length !== b.length) {
					return false
				}
				return a.every((cardId) => b.indexOf(cardId) >= 0)
			},
			/**
			 * 桌面 H5（鼠标）走这里；小程序端一次点击会先跑完 touchstart/touchend
			 * （选中已经在那边处理过了），随后补发的 click 必须挡掉，否则同一张牌选上又取消。
			 */
			handleTapCard(cardId) {
				if (Date.now() - this.lastTouchAt < TAP_SUPPRESS_MS) {
					return
				}
				if (!this.canSelect) {
					return
				}
				const current = Array.isArray(this.selected) ? this.selected.slice() : []
				const position = current.indexOf(cardId)
				if (position >= 0) {
					current.splice(position, 1)
				} else {
					current.push(cardId)
				}
				this.$emit('change', current)
			}
		},
		beforeUnmount() {
			// 页面退出 / 房间销毁时把定时器收掉，别在已卸载的组件上 setData
			this.clearInsertTimer()
		}
	}
</script>

<style>
	.ll-hand {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 100%;
	}

	.ll-hand__inner {
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		/* 左右 auto 平分剩余空间 = 精确居中，跟着容器**真实**宽度走（不依赖任何测量值）。
		   父级 `.ll-hand` 的 justify-content: center 是第二层保险：
		   万一某些端把 auto 当 0 处理，内容仍然是居中的。
		   宽度由 innerStyle 按张数给出（index × step 绝对定位，DOM 顺序不影响牌面）。
		   ⚠️ 不要给 margin 加过渡：出牌后整行要**立刻**重新居中。
		   有过渡时，牌已经按新下标瞬移到位、整行却还在慢慢滑，看着就是「没居中」。 */
		margin: 0 auto;
	}

	.ll-hand__item {
		/* 绝对定位：left 由 index 算（见 itemStyle），DOM 顺序不影响牌面顺序 */
		position: absolute;
		bottom: 0;
		left: 0;
		/* 只过渡选中上浮 / 取消回落（带回弹）。left 不加过渡 —— 手牌一变就重建节点，
		   位置必须一步到位，否则会出现「牌到位置了、容器还在飘」的错位感 */
		transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}
</style>
