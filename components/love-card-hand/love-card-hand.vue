<template>
	<view class="card-hand">
		<view class="card-hand__inner" :style="innerStyle">
			<view
				v-for="(cardId, index) in sortedCards"
				:key="cardId"
				class="card-hand__item"
				:style="itemStyle(index)"
			>
				<love-playing-card
					:card-id="cardId"
					:width="cardWidth"
					:height="cardHeight"
					:selected="isSelected(cardId)"
					:clickable="selectable"
					:disabled="disabled"
					@card-tap="handleTapCard"
				></love-playing-card>
			</view>
		</view>
	</view>
</template>

<script>
	import LovePlayingCard from '@/components/love-playing-card/love-playing-card.vue'
	import { sortCardIds } from '@/common/game/cards.js'

	export default {
		name: 'LoveCardHand',
		components: {
			LovePlayingCard
		},
		props: {
			cards: {
				type: Array,
				default: () => []
			},
			selected: {
				type: Array,
				default: () => []
			},
			cardWidth: {
				type: Number,
				default: 56
			},
			cardHeight: {
				type: Number,
				default: 80
			},
			/** 可用宽度（px），用于计算叠牌间距 */
			maxWidth: {
				type: Number,
				default: 480
			},
			selectable: {
				type: Boolean,
				default: true
			},
			disabled: {
				type: Boolean,
				default: false
			},
			direction: {
				type: String,
				default: 'asc'
			}
		},
		emits: ['change'],
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
				const desired = this.cardWidth * 0.44
				const fit = (available - this.cardWidth) / (count - 1)
				return Math.max(this.cardWidth * 0.16, Math.min(desired, fit))
			},
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
			}
		},
		methods: {
			isSelected(cardId) {
				return (this.selected || []).indexOf(cardId) !== -1
			},
			itemStyle(index) {
				return {
					marginLeft: index === 0 ? '0px' : `${-(this.cardWidth - this.step)}px`,
					zIndex: index + 1
				}
			},
			handleTapCard(cardId) {
				if (!this.selectable || this.disabled) {
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
		}
	}
</script>

<style>
	.card-hand {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		width: 100%;
	}

	.card-hand__inner {
		position: relative;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.card-hand__item {
		position: relative;
	}
</style>
