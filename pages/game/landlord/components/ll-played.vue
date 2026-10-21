<template>
	<view class="ll-played">
		<view
			v-for="(row, rowIndex) in rows"
			:key="'row-' + rowIndex"
			class="ll-played__row"
			:style="rowStyle(row, rowIndex)"
		>
			<view
				v-for="(cardId, colIndex) in row"
				:key="cardKey(rowIndex, colIndex, cardId)"
				class="ll-played__item"
				:style="itemStyle(colIndex)"
			>
				<ll-card
					:card-id="cardId"
					:width="cardWidth"
					:height="cardHeight"
					:enter="animated ? 'play' : ''"
					:enter-delay="delayOf(rowIndex, colIndex)"
				></ll-card>
			</view>
		</view>
	</view>
</template>

<script>
	import LlCard from './ll-card.vue'

	/**
	 * 出牌区（桌面中央 / 左右对手）的牌堆。
	 *
	 * 排版跟底部手牌 `ll-hand` 同一套手感：**负 margin 叠着摆**（每张只露出 `step` 宽），
	 * 而不是并排放（并排 5 张顺子就把中央撑爆了）。
	 * 一行放不下就**换行继续叠**，每行宽度精确等于「牌宽 + step ×(张数-1)」，整体居中。
	 * 传了 `stepWidth` 就用固定间距（不看张数）；传了 `rowOverlap` 则多行**叠加**（只露出上一行顶部）。
	 *
	 * 为什么按行手动分块、而不是用 flex-wrap：
	 *   flex-wrap 判断换行时算的是每个 item 的**外边距**，负 margin 会让行首那张也被拉出去、
	 *   和上一行最后一张叠在一起（而且行首的负 margin 没法用 CSS 单独干掉）。
	 *   自己切行 → 每行都是独立 flex，行首 margin-left 恒为 0，行为可预期。
	 */
	export default {
		name: 'LlPlayed',
		components: { LlCard },
		props: {
			/** 这一手牌（cardId 数组），顺序即显示顺序（服务端已按牌型排好） */
			cards: { type: Array, default: () => [] },
			cardWidth: { type: Number, default: 34 },
			cardHeight: { type: Number, default: 48 },
			/** 单行最大宽度，超过就换行（px） */
			maxWidth: { type: Number, default: 116 },
			/**
			 * 固定牌间距（px）：相邻两张牌左边缘的距离，**只看传入值、不看张数**。
			 * 传 0 时退回「牌宽 × 0.6」的老比例算法。
			 * 左右两家用它把间距钉死（牌多牌少露出一模一样的一列点数，不再随张数抖动）。
			 */
			stepWidth: { type: Number, default: 0 },
			/**
			 * 多行叠加时**每一行露出的高度**（px）。0 = 老行为（换行后整行往下排，行间 2px）。
			 * 左右两家传 22：第二行起往上压 (牌高 - 22)，只露出上一行顶部那条 ——
			 * 点数在左上角，压下去照样读得到，桌面竖向空间不够时不会一直接着长。
			 */
			rowOverlap: { type: Number, default: 0 },
			/** 逐张入场错峰（ms） */
			enterStagger: { type: Number, default: 30 },
			/**
			 * 是否播放入场动画（默认播）。
			 * 页面在「首次进房 / 进入时已经是结算状态」时传 false：
			 * 只是把已存在的牌局铺出来，不要把最后一手再飞一遍。
			 * 正常出牌（含结算那一手、炸弹）都保持 true。
			 */
			animated: { type: Boolean, default: true },
			/**
			 * 出牌序号（可选）。页面每出一手牌 +1，塞进 key 里 → 保证**同一手牌重播也重建**。
			 * 左右两家的出牌区不要传：它们展示的是「该座位最近一手」，别人出牌时不该重播动画。
			 */
			seq: { type: [Number, String], default: 0 }
		},
		computed: {
			/**
			 * 相邻两张牌的左边缘间距。
			 * 传了固定 `step` 就**只认它**（不随张数变）；否则退回「牌宽 × 0.6」。
			 */
			step() {
				const fixed = Number(this.stepWidth)
				if (fixed > 0) {
					return Math.max(8, Math.round(fixed))
				}
				return Math.max(12, Math.round(this.cardWidth * 0.6))
			},
			/** 一行最多放几张：牌宽 + step×(n-1) ≤ maxWidth */
			perRow() {
				const maxWidth = Math.max(this.cardWidth, Number(this.maxWidth) || 0)
				return Math.max(1, Math.floor((maxWidth - this.cardWidth) / this.step) + 1)
			},
			rows() {
				const list = Array.isArray(this.cards) ? this.cards : []
				const perRow = this.perRow
				const out = []
				for (let index = 0; index < list.length; index += perRow) {
					out.push(list.slice(index, index + perRow))
				}
				return out
			}
		},
		methods: {
			rowStyle(row, rowIndex = 0) {
				const count = Array.isArray(row) ? row.length : 0
				const style = {
					width: `${this.cardWidth + this.step * Math.max(0, count - 1)}px`,
					/*
					 * 行层级：**后面的行压在前面的行上面**。
					 * ⚠️ 必须给每行一个自己的 z-index（配合 CSS 的 position: relative）：
					 * 牌是 `position: relative; z-index: colIndex+1`（右压左），如果不把「行」切成
					 * 独立层叠上下文，各行牌的 z-index 会跨行直接比大小 —— 第一行靠右的牌（z=6）
					 * 就会盖住第二行靠左的牌（z=1），看起来就是「第一行压着第二行」，而不是后行压前行。
					 */
					zIndex: rowIndex + 1
				}
				const peek = Math.min(Number(this.rowOverlap) || 0, Math.max(8, this.cardHeight - 8))
				if (peek > 0 && rowIndex > 0) {
					// 行间**负边距**叠起来：后一行只比前一行低 peek px（inline 覆盖 CSS 里的 2px）
					style.marginTop = `${peek - this.cardHeight}px`
				}
				return style
			},
			/** 叠牌定位：行首不偏移，其余每张向左压 (牌宽 - step)，z-index 递增（右压左） */
			itemStyle(colIndex) {
				return {
					marginLeft: colIndex === 0 ? '0px' : `${-(this.cardWidth - this.step)}px`,
					zIndex: colIndex + 1
				}
			},
			delayOf(rowIndex, colIndex) {
				return (rowIndex * this.perRow + colIndex) * this.enterStagger
			},
			/**
			 * ⚠️ key 里带上**整手牌的内容**：换一手牌就整体重建 → 入场动画重播。
			 * 小程序里容器上的 :key 不生效，只能靠每张牌自己的 key 变化（跟 ll-hand 同一个坑）。
			 */
			cardKey(rowIndex, colIndex, cardId) {
				return `${this.seq}-${rowIndex}-${colIndex}-${cardId}-${this.cards.join('_')}`
			}
		}
	}
</script>

<style>
	.ll-played {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	/* 每行自带 z-index（见 rowStyle）：**后一行整行压在前一行上面**。
	   position: relative 才能让 z-index 生效，同时把行切成独立层叠上下文，
	   行内的「右压左」只在行内比大小，不会跨行打架。 */
	.ll-played__row {
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	/* 换行后两行之间留 2px：再压就会盖住上一行牌的点数 */
	.ll-played__row + .ll-played__row {
		margin-top: 2px;
	}

	.ll-played__item {
		position: relative;
		flex-shrink: 0;
	}
</style>
