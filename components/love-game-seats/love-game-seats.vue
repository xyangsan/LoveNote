<template>
	<view class="game-seats">
		<view
			v-for="item in normalizedSeats"
			:key="item.key"
			class="game-seats__cell"
			:style="{ width: cellWidth }"
		>
			<love-game-seat
				:seat="item.seat"
				:is-self="item.isSelf"
				:is-host="item.isHost"
				:is-speaker="item.isSpeaker"
				:is-alive="item.isAlive"
				:is-selected="item.isSelected"
				:clickable="selectable && item.selectable"
				:show-ready="showReady"
				:show-score="showScore"
				:tag-text="item.tagText"
				:tag-tone="item.tagTone"
				:size="size"
				@seat-tap="handleSelect(item.seat.seatIndex)"
			></love-game-seat>
		</view>

		<!-- 空位：房主可以点「添加机器人」 -->
		<view
			v-for="slot in emptySlots"
			:key="'empty-' + slot"
			class="game-seats__cell"
			:style="{ width: cellWidth }"
		>
			<view class="game-seats__empty" :class="'game-seats__empty--' + size" @click="handleEmptyTap(slot)">
				<text class="game-seats__empty-plus">+</text>
				<text class="game-seats__empty-text">{{ emptyText }}</text>
			</view>
		</view>
	</view>
</template>

<script>
	import LoveGameSeat from '@/components/love-game-seat/love-game-seat.vue'

	export default {
		name: 'LoveGameSeats',
		components: {
			LoveGameSeat
		},
		props: {
			seats: {
				type: Array,
				default: () => []
			},
			maxPlayers: {
				type: Number,
				default: 0
			},
			selfSeatIndex: {
				type: Number,
				default: -1
			},
			hostSeatIndex: {
				type: Number,
				default: -1
			},
			speakerSeatIndex: {
				type: Number,
				default: -1
			},
			aliveSeats: {
				type: Array,
				default: () => []
			},
			selectedSeatIndex: {
				type: Number,
				default: -1
			},
			selectable: {
				type: Boolean,
				default: false
			},
			showReady: {
				type: Boolean,
				default: false
			},
			showScore: {
				type: Boolean,
				default: false
			},
			/** seatIndex -> { text, tone } */
			tags: {
				type: Object,
				default: () => ({})
			},
			size: {
				type: String,
				default: 'normal'
			},
			/** 是否展示空位（房主添加机器人用） */
			showEmpty: {
				type: Boolean,
				default: false
			},
			emptyText: {
				type: String,
				default: '空位'
			}
		},
		emits: ['select', 'empty-tap'],
		computed: {
			columnCount() {
				const total = this.maxPlayers || this.seats.length || 4
				if (total <= 4) {
					return 3
				}
				if (total <= 6) {
					return 3
				}
				return 4
			},
			cellWidth() {
				return `${(100 / this.columnCount).toFixed(4)}%`
			},
			normalizedSeats() {
				return (Array.isArray(this.seats) ? this.seats : []).map((seat, index) => {
					const seatIndex = Number(seat.seatIndex !== undefined ? seat.seatIndex : index)
					const aliveSeats = Array.isArray(this.aliveSeats) ? this.aliveSeats.map(Number) : []
					const tag = this.tags[String(seatIndex)] || {}
					return {
						key: `seat-${seatIndex}`,
						seat: Object.assign({}, seat, { seatIndex }),
						isSelf: seatIndex === Number(this.selfSeatIndex),
						isHost: seatIndex === Number(this.hostSeatIndex),
						isSpeaker: seatIndex === Number(this.speakerSeatIndex),
						isAlive: !aliveSeats.length || aliveSeats.includes(seatIndex),
						isSelected: seatIndex === Number(this.selectedSeatIndex),
						selectable: seatIndex !== Number(this.selfSeatIndex),
						tagText: tag.text || '',
						tagTone: tag.tone || 'normal'
					}
				})
			},
			emptySlots() {
				if (!this.showEmpty || !this.maxPlayers) {
					return []
				}
				const used = new Set(
					(this.seats || []).map((seat, index) => Number(
						seat.seatIndex !== undefined ? seat.seatIndex : index
					))
				)
				const slots = []
				for (let index = 0; index < this.maxPlayers; index += 1) {
					if (!used.has(index)) {
						slots.push(index)
					}
				}
				return slots
			}
		},
		methods: {
			handleSelect(seatIndex) {
				if (!this.selectable) {
					return
				}
				this.$emit('select', Number(seatIndex))
			},
			handleEmptyTap(slot) {
				this.$emit('empty-tap', Number(slot))
			}
		}
	}
</script>

<style>
	.game-seats {
		display: flex;
		flex-wrap: wrap;
		margin: 0 -8rpx;
	}

	.game-seats__cell {
		box-sizing: border-box;
		padding: 8rpx;
	}

	.game-seats__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 200rpx;
		border: 2rpx dashed rgba(231, 111, 81, 0.36);
		border-radius: 26rpx;
		background: rgba(255, 250, 247, 0.8);
	}

	.game-seats__empty--small {
		min-height: 168rpx;
	}

	.game-seats__empty-plus {
		font-size: 44rpx;
		line-height: 1;
		color: #e0a08a;
	}

	.game-seats__empty-text {
		display: block;
		margin-top: 10rpx;
		font-size: 21rpx;
		color: #c0a094;
	}
</style>
