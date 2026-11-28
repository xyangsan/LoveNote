<template>
	<view v-if="visible" class="range-mask" @click="handleMaskTap" @touchmove.stop.prevent>
		<view class="range-panel" @click.stop>
			<view class="range-handle"></view>

			<view class="range-head">
				<view class="range-head__left">
					<text class="range-head__title">{{ title }}</text>
					<text v-if="subtitle" class="range-head__sub">{{ subtitle }}</text>
				</view>
				<view class="range-head__close" @click="handleClose">
					<text class="range-head__close-icon">×</text>
				</view>
			</view>

			<!-- 已选区间：点第一下先显示单日，点第二下补全范围 -->
			<view class="range-summary">
				<view class="range-summary__dates">
					<text class="range-summary__date" :class="{ 'range-summary__date--empty': !draftStart }">
						{{ draftStart ? shortDate(draftStart) : '选择开始' }}
					</text>
					<text class="range-summary__sep">→</text>
					<text class="range-summary__date" :class="{ 'range-summary__date--empty': !draftEnd }">
						{{ draftEnd ? shortDate(draftEnd) : (draftStart ? '再选结束日' : '选择结束') }}
					</text>
				</view>
				<view v-if="draftStart" class="range-summary__days">
					<text class="range-summary__days-text">{{ draftDays }} 天</text>
				</view>
			</view>

			<view class="range-month">
				<view class="range-month__nav">
					<view
						class="range-month__btn"
						:class="{ 'range-month__btn--disabled': !canPrev }"
						@click="changeMonth(-1)"
					>
						<view class="range-month__arrow range-month__arrow--prev"></view>
					</view>
					<text class="range-month__label">{{ viewYear }} 年 {{ viewMonth }} 月</text>
					<view
						class="range-month__btn"
						:class="{ 'range-month__btn--disabled': !canNext }"
						@click="changeMonth(1)"
					>
						<view class="range-month__arrow range-month__arrow--next"></view>
					</view>
				</view>
				<text class="range-month__today" @click="goToday">今天</text>
			</view>

			<view class="range-week">
				<text v-for="label in weekLabels" :key="label" class="range-week__text">{{ label }}</text>
			</view>

			<view class="range-grid">
				<view
					v-for="cell in cells"
					:key="cell.key"
					class="range-cell"
					:class="cellClass(cell)"
					@click="pickDay(cell)"
				>
					<view class="range-cell__inner" :class="{ 'range-cell__inner--edge': cell.isEdge }">
						<text class="range-cell__day" :class="{ 'range-cell__day--edge': cell.isEdge }">{{ cell.day }}</text>
					</view>
				</view>
			</view>

			<view class="range-foot">
				<view class="range-btn range-btn--ghost" @click="handleClose">
					<text class="range-btn__text range-btn__text--ghost">取消</text>
				</view>
				<view
					class="range-btn range-btn--primary"
					:class="{ 'range-btn--disabled': !draftStart }"
					@click="handleConfirm"
				>
					<text class="range-btn__text">{{ confirmText }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	/**
	 * 日期区间日历（运营管理专用）。
	 *
	 * 交互：点第一下 = 开始，点第二下 = 结束；已有区间回显后，再点一下从新的开始重选。
	 * 约束：minDate / maxDate 之外的日期禁用；区间跨度超过 maxDays 时以新点日期重新开始。
	 * 日期全部按 UTC 构造（YYYY-MM-DD 字符串比较即可，不受设备时区影响）。
	 */
	const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
	const DAY_MS = 24 * 60 * 60 * 1000

	function pad2(value) {
		return String(value).padStart(2, '0')
	}

	function toKey(date) {
		return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
	}

	function parseKey(key) {
		const parts = String(key || '').split('-').map((item) => Number(item))
		if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
			return null
		}
		return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
	}

	/**
	 * 「今天」必须按设备本地时间取：UTC 日期在东八区 0-8 点会退到昨天，
	 * 今天的高亮与无区间时的兜底都会错一天。网格里生成日期仍用 Date.UTC + toKey，自成一套。
	 */
	function todayKey() {
		const now = new Date()
		return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
	}

	function diffDays(startKey, endKey) {
		const start = parseKey(startKey)
		const end = parseKey(endKey)
		if (!start || !end) {
			return 0
		}
		return Math.round((end.getTime() - start.getTime()) / DAY_MS)
	}

	function monthIndex(year, month) {
		return Number(year) * 12 + Number(month) - 1
	}

	export default {
		name: 'love-date-range',
		props: {
			visible: {
				type: Boolean,
				default: false
			},
			start: {
				type: String,
				default: ''
			},
			end: {
				type: String,
				default: ''
			},
			/** 最早可选日期（含），留空不限制 */
			minDate: {
				type: String,
				default: ''
			},
			/** 最晚可选日期（含），留空不限制 */
			maxDate: {
				type: String,
				default: ''
			},
			/** 单次可选的最大跨度（天），超出时以新点日期重新开始 */
			maxDays: {
				type: Number,
				default: 90
			},
			title: {
				type: String,
				default: '选择日期范围'
			},
			subtitle: {
				type: String,
				default: ''
			}
		},
		data() {
			const now = new Date()
			return {
				// 模板只能取实例上的字段：顶层常量必须挂进 data，否则表头渲染为空
				weekLabels: WEEK_LABELS,
				viewYear: now.getFullYear(),
				viewMonth: now.getMonth() + 1,
				draftStart: '',
				draftEnd: ''
			}
		},
		computed: {
			cells() {
				const year = this.viewYear
				const month = this.viewMonth
				const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
				const today = todayKey()
				const list = []

				for (let index = 0; index < 42; index += 1) {
					// 从当月 1 号往前挪 firstDay 天，再依次排 42 格
					const date = new Date(Date.UTC(year, month - 1, index - firstDay + 1))
					const key = toKey(date)
					const inMonth = date.getUTCMonth() === month - 1
					const isStart = !!this.draftStart && key === this.draftStart
					const isEnd = !!this.draftEnd && key === this.draftEnd
					const isSingle = isStart && isEnd
					const inRange = !!this.draftStart && !!this.draftEnd && key > this.draftStart && key < this.draftEnd

					list.push({
						key,
						day: date.getUTCDate(),
						inMonth,
						isStart,
						isEnd,
						isSingle,
						inRange,
						isEdge: isStart || isEnd,
						isToday: key === today,
						disabled: this.isOutOfBounds(key)
					})
				}
				return list
			},
			draftDays() {
				if (!this.draftStart) {
					return 0
				}
				return Math.abs(diffDays(this.draftStart, this.draftEnd || this.draftStart)) + 1
			},
			/** 模板里不写模板字符串：小程序端表达式只支持有限语法，文案统一在这里拼 */
			confirmText() {
				if (!this.draftStart) {
					return '请选择日期'
				}
				return `确定 · ${this.draftDays} 天`
			},
			canPrev() {
				if (!this.minDate) {
					return true
				}
				const min = parseKey(this.minDate)
				if (!min) {
					return true
				}
				return monthIndex(this.viewYear, this.viewMonth) > monthIndex(min.getUTCFullYear(), min.getUTCMonth() + 1)
			},
			canNext() {
				if (!this.maxDate) {
					return true
				}
				const max = parseKey(this.maxDate)
				if (!max) {
					return true
				}
				return monthIndex(this.viewYear, this.viewMonth) < monthIndex(max.getUTCFullYear(), max.getUTCMonth() + 1)
			}
		},
		watch: {
			visible(value) {
				if (value) {
					this.resetDraft()
				}
			}
		},
		methods: {
			shortDate(key) {
				const value = String(key || '')
				if (value.length < 10) {
					return value
				}
				return `${value.slice(5, 7)}/${value.slice(8, 10)}`
			},
			isOutOfBounds(key) {
				if (this.minDate && key < this.minDate) {
					return true
				}
				if (this.maxDate && key > this.maxDate) {
					return true
				}
				return false
			},
			/** 打开时把当前区间整体回显，并把视图定位到结束日期所在月 */
			resetDraft() {
				const fallback = this.maxDate || todayKey()
				let start = parseKey(this.start) ? this.start : fallback
				let end = parseKey(this.end) ? this.end : start
				if (start > end) {
					const swap = start
					start = end
					end = swap
				}

				this.draftStart = start
				this.draftEnd = end

				const anchor = parseKey(end) || parseKey(start)
				if (anchor) {
					this.viewYear = anchor.getUTCFullYear()
					this.viewMonth = anchor.getUTCMonth() + 1
				}
			},
			setView(key) {
				const date = parseKey(key)
				if (!date) {
					return
				}
				this.viewYear = date.getUTCFullYear()
				this.viewMonth = date.getUTCMonth() + 1
			},
			changeMonth(delta) {
				if (delta < 0 && !this.canPrev) {
					return
				}
				if (delta > 0 && !this.canNext) {
					return
				}
				const date = new Date(Date.UTC(this.viewYear, this.viewMonth - 1 + delta, 1))
				this.viewYear = date.getUTCFullYear()
				this.viewMonth = date.getUTCMonth() + 1
			},
			goToday() {
				// 今天可能落在 max 之外（广告只到昨天），月初点「今天」会翻到一个整月全灰的月份
				let key = todayKey()
				if (this.maxDate && key > this.maxDate) {
					key = this.maxDate
				}
				if (this.minDate && key < this.minDate) {
					key = this.minDate
				}
				this.setView(key)
			},
			pickDay(cell) {
				if (!cell || !cell.inMonth || cell.disabled) {
					return
				}
				const key = cell.key

				// 没选过、或区间已完整 → 这一下重新定开始
				if (!this.draftStart || (this.draftStart && this.draftEnd)) {
					this.draftStart = key
					this.draftEnd = ''
					return
				}

				const first = this.draftStart
				const start = first <= key ? first : key
				const end = first <= key ? key : first
				if (diffDays(start, end) + 1 > this.maxDays) {
					this.draftStart = key
					this.draftEnd = ''
					uni.showToast({ title: `最多可选 ${this.maxDays} 天`, icon: 'none' })
					return
				}

				this.draftStart = start
				this.draftEnd = end
			},
			cellClass(cell) {
				return {
					'range-cell--out': !cell.inMonth,
					'range-cell--range': cell.inRange,
					'range-cell--start': cell.isStart && !cell.isSingle,
					'range-cell--end': cell.isEnd && !cell.isSingle,
					'range-cell--single': cell.isSingle,
					'range-cell--disabled': cell.disabled,
					'range-cell--today': cell.isToday && !cell.isEdge
				}
			},
			handleMaskTap() {
				this.handleClose()
			},
			handleClose() {
				this.$emit('close')
			},
			handleConfirm() {
				if (!this.draftStart) {
					return
				}
				this.$emit('confirm', {
					startDate: this.draftStart,
					endDate: this.draftEnd || this.draftStart
				})
			}
		}
	}
</script>

<style scoped>
	.range-mask {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		z-index: 9990;
		display: flex;
		align-items: flex-end;
		background: rgba(var(--noir-shadow-rgb), 0.62);
		animation: range-fade 0.2s ease-out;
	}

	.range-panel {
		width: 100%;
		padding: 18rpx 32rpx 24rpx;
		border-radius: 40rpx 40rpx 0 0;
		border-top: 1rpx solid rgba(var(--noir-gold-rgb), 0.26);
		background: linear-gradient(170deg, var(--noir-sheet-hi) 0%, var(--noir-sheet-lo) 100%);
		box-shadow: 0 -24rpx 64rpx rgba(var(--noir-shadow-rgb), 0.5);
		animation: range-up 0.26s cubic-bezier(0.2, 0.9, 0.3, 1);
		padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
	}

	.range-handle {
		width: 72rpx;
		height: 6rpx;
		margin: 0 auto 18rpx;
		border-radius: 3rpx;
		background: rgba(var(--noir-wash-rgb), 0.16);
	}

	.range-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 20rpx;
	}

	.range-head__left {
		flex: 1;
		min-width: 0;
	}

	.range-head__title {
		display: block;
		font-size: 32rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.range-head__sub {
		display: block;
		margin-top: 8rpx;
		font-size: 21rpx;
		line-height: 1.4;
		color: var(--noir-text-muted);
	}

	.range-head__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48rpx;
		height: 48rpx;
		border-radius: 50%;
		background: rgba(var(--noir-wash-rgb), 0.08);
	}

	.range-head__close-icon {
		font-size: 30rpx;
		line-height: 1;
		color: var(--noir-text-sub);
	}

	.range-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-top: 22rpx;
		padding: 18rpx 24rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.18);
		background: var(--noir-glass-1);
	}

	.range-summary__dates {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.range-summary__date {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-gold);
	}

	.range-summary__date--empty {
		font-weight: 400;
		color: var(--noir-text-muted);
	}

	.range-summary__sep {
		font-size: 22rpx;
		color: var(--noir-text-dim);
	}

	.range-summary__days {
		padding: 6rpx 18rpx;
		border-radius: 999rpx;
		background: rgba(var(--noir-coral-rgb), 0.16);
	}

	.range-summary__days-text {
		font-size: 20rpx;
		font-weight: 600;
		color: var(--noir-coral-light);
	}

	.range-month {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-top: 22rpx;
	}

	.range-month__nav {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.range-month__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56rpx;
		height: 56rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.12);
		background: var(--noir-glass-1);
	}

	.range-month__btn--disabled {
		opacity: 0.28;
	}

	.range-month__arrow {
		width: 14rpx;
		height: 14rpx;
		border-top: 3rpx solid var(--noir-text-sub);
		border-right: 3rpx solid var(--noir-text-sub);
	}

	.range-month__arrow--prev {
		transform: rotate(-135deg);
	}

	.range-month__arrow--next {
		transform: rotate(45deg);
	}

	.range-month__label {
		min-width: 190rpx;
		text-align: center;
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text);
	}

	.range-month__today {
		padding: 10rpx 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.36);
		font-size: 20rpx;
		color: var(--noir-coral-light);
	}

	.range-week {
		display: flex;
		margin-top: 22rpx;
	}

	.range-week__text {
		width: 14.2857%;
		text-align: center;
		font-size: 20rpx;
		color: var(--noir-text-muted);
	}

	.range-grid {
		display: flex;
		flex-wrap: wrap;
		margin-top: 6rpx;
	}

	.range-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 14.2857%;
		height: 88rpx;
	}

	.range-cell--range {
		background: rgba(var(--noir-coral-rgb), 0.12);
	}

	.range-cell--start {
		border-radius: 999rpx 0 0 999rpx;
		background: rgba(var(--noir-coral-rgb), 0.12);
	}

	.range-cell--end {
		border-radius: 0 999rpx 999rpx 0;
		background: rgba(var(--noir-coral-rgb), 0.12);
	}

	.range-cell--single {
		border-radius: 999rpx;
	}

	.range-cell--out,
	.range-cell--disabled {
		opacity: 0.24;
	}

	.range-cell__inner {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 68rpx;
		height: 68rpx;
		border-radius: 50%;
	}

	.range-cell__inner--edge {
		background: var(--noir-btn-gradient);
		box-shadow: 0 8rpx 20rpx rgba(var(--noir-coral-rgb), 0.32);
	}

	.range-cell--today .range-cell__inner {
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.6);
	}

	.range-cell__day {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 25rpx;
		color: var(--noir-text);
	}

	.range-cell__day--edge {
		font-weight: 600;
		color: var(--noir-text-warm);
	}

	.range-foot {
		display: flex;
		align-items: center;
		gap: 20rpx;
		margin-top: 24rpx;
	}

	.range-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		border-radius: 44rpx;
	}

	.range-btn--ghost {
		flex: 0 0 196rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.14);
		background: var(--noir-glass-1);
	}

	.range-btn--primary {
		flex: 1;
		background: var(--noir-btn-gradient);
		box-shadow: 0 14rpx 30rpx rgba(var(--noir-coral-rgb), 0.28);
	}

	.range-btn--disabled {
		opacity: 0.42;
		box-shadow: none;
	}

	.range-btn__text {
		font-size: 27rpx;
		font-weight: 600;
		letter-spacing: 1rpx;
		color: var(--noir-text-warm);
	}

	.range-btn__text--ghost {
		font-weight: 500;
		color: var(--noir-text-sub);
	}

	@keyframes range-fade {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	@keyframes range-up {
		from {
			transform: translateY(100%);
		}

		to {
			transform: translateY(0);
		}
	}
</style>
