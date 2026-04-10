<template>
	<view class="love-editor" :class="[{'safe-area-input': safeAreaInput}]">
		<view class="love-editor-bar">
			<textarea
				ref="inputRef"
				class="emoji-input emoji-input--textarea"
				:value="text"
				:maxlength="maxlength"
				:placeholder="placeholder"
				:placeholder-style="textareaPlaceholderStyle"
				:focus="focus"
				:auto-height="true"
				:selection-start="selectionStart"
				:selection-end="selectionEnd"
				:adjust-position="false"
				:show-confirm-bar="false"
				@input="handleInput"
				@tap="handleInputTap"
				@focus="handleFocus"
				@blur="handleBlur"
				@confirm="handleConfirm"
				@linechange="handleLineChange"
				@keyboardheightchange="handleKeyboardHeightChange"
			></textarea>

			<!-- 使用 fui-icon 作为表情按钮 -->
			<view class="love-editor-bar__emoji-toggle" @touchend.prevent="toggleEmojiPanel">
				<fui-icon name="face" :size="56" color="#333333"></fui-icon>
			</view>
			
			<!-- 发送按钮 -->
			<view class="love-editor-bar__send">
				<fui-button type="success" :disabled="!sendable"
					:size="26" width="100rpx" height="60rpx"
				 @click="handleSend">{{ sendText }}</fui-button>
			</view>
		</view>

		<!-- 表情面板 -->
		<view class="love-editor__emoji-panel" :class="{ 'love-editor__emoji-panel--visible': showEmojiPanel }">
			<view
				v-if="emojiPreview.visible"
				class="love-editor__emoji-preview"
				:style="emojiPreviewStyle"
			>
				<text class="love-editor__emoji-preview-glyph">{{ emojiPreview.glyph }}</text>
				<text class="love-editor__emoji-preview-label">{{ emojiPreview.tts }}</text>
			</view>
			<scroll-view
				scroll-y
				class="emoji-list"
				@scroll="handleEmojiScroll"
				@touchmove.stop="handleEmojiTouchMove"
				@touchend.stop="handleEmojiTouchEnd"
				@touchcancel.stop="handleEmojiTouchEnd"
			>
				<view class="emoji-grid">
					<view
						v-for="(emoji, idx) in emojiList"
						:key="idx"
						class="emoji-item"
						@tap.stop="insertEmoji(emoji)"
						@longpress.stop.prevent="handleEmojiLongPress(idx)"
					>
						{{ emoji.glyph }}
					</view>
				</view>
			</scroll-view>
			<view class="love-editor__delete" v-if="deleteable">
				<fui-icon name="backspace" :size="50" :color="sendable ? '#333' : '#999'" @touchend.prevent="delLastText"></fui-icon>
			</view>
		</view>
	</view>
</template>

<script>
	import glyph from './glyph.json'

	export default {
		name: 'love-editor',
		emits: ['input', 'send', 'keyboardheightchange'],
		props: {
			value: String,
			placeholder: {
				type: String,
				default: '请输入内容'
			},
			maxlength: {
				type: [String, Number],
				default: -1
			},
			sendText: {
				type: String,
				default: '发送'
			},
			deleteable: { // 是否显示删除按钮
				type: Boolean,
				default: true
			},
			safeAreaInput: {
				type: Boolean,
				default: false
			}
		},
		data() {
			return {
				focus: false,
				text: this.value || '',
				selectionStart: -1,
				selectionEnd: -1,
				keyboardHeight: 0,
				emojiScrollTop: 0,
				emojiMetrics: {
					panelWidth: 0,
					panelLeft: 0,
					panelTop: 0,
					scrollTop: 0,
					scrollViewLeft: 0,
					scrollViewTop: 0,
					itemRects: []
				},
				emojiPreview: {
					visible: false,
					idx: -1,
					glyph: '',
					tts: '',
					left: 0,
					top: 0,
					arrowLeft: 0
				},
				emojiPreviewMeasureToken: 0,
				emojiPreviewTracking: false,
				suppressEmojiTap: false,
				suppressEmojiTapTimer: null,
				pendingOpenEmojiPanel: false,
				restoreKeyboardTimer: null,
				showEmojiPanel: false,
				emojiList: glyph
			};
		},
		watch: {
			value(newValue) {
				const normalized = String(newValue || '')
				this.text = normalized
				const safeCursor = Math.min(this.getSafeSelectionStart(), normalized.length)
				this.selectionStart = safeCursor
				this.selectionEnd = safeCursor
			}
		},
		beforeDestroy() {
			this.clearRestoreKeyboardTimer()
			this.clearSuppressEmojiTapTimer()
		},
		computed: {
			sendable() {
				return this.text.length > 0
			},
			textareaPlaceholderStyle() {
				return 'color:#999999;font-size:30rpx;font-weight:400;line-height:1.5;'
			},
			emojiPreviewStyle() {
				return {
					left: `${this.emojiPreview.left}px`,
					top: `${this.emojiPreview.top}px`,
					'--arrow-left': `${this.emojiPreview.arrowLeft}px`
				}
			}
		},
		methods: {
			rpxToPx(rpx) {
				if (typeof uni !== 'undefined' && typeof uni.rpx2px === 'function') {
					return Number(uni.rpx2px(Number(rpx || 0)) || 0)
				}
				const systemInfo = typeof uni.getSystemInfoSync === 'function' ? uni.getSystemInfoSync() : {}
				const windowWidth = Number(systemInfo.windowWidth || 375)
				return windowWidth * Number(rpx || 0) / 750
			},
			getInputRef() {
				const inputRef = this.$refs.inputRef
				if (Array.isArray(inputRef)) {
					return inputRef[0] || null
				}
				return inputRef || null
			},
			focusInput() {
				this.focus = true
				const input = this.getInputRef()
				if (input && typeof input.focus === 'function') {
					input.focus()
				}
			},
			blurInput() {
				this.focus = false
				const input = this.getInputRef()
				if (input && typeof input.blur === 'function') {
					input.blur()
				}
			},
			hideKeyboardOnly() {
				if (typeof uni.hideKeyboard === 'function') {
					uni.hideKeyboard({})
				}
			},
			clearRestoreKeyboardTimer() {
				if (!this.restoreKeyboardTimer) {
					return
				}
				clearTimeout(this.restoreKeyboardTimer)
				this.restoreKeyboardTimer = null
			},
			clearSuppressEmojiTapTimer() {
				if (!this.suppressEmojiTapTimer) {
					return
				}
				clearTimeout(this.suppressEmojiTapTimer)
				this.suppressEmojiTapTimer = null
			},
			lockEmojiTap(duration = 180) {
				this.clearSuppressEmojiTapTimer()
				this.suppressEmojiTap = true
				this.suppressEmojiTapTimer = setTimeout(() => {
					this.suppressEmojiTapTimer = null
					this.suppressEmojiTap = false
				}, duration)
			},
			enforceKeyboardHiddenForEmojiPanel() {
				if (!this.showEmojiPanel) {
					return
				}
				this.hideKeyboardOnly()
				setTimeout(() => {
					if (this.showEmojiPanel) {
						this.hideKeyboardOnly()
					}
				}, 30)
			},
			showCaret(keepKeyboardHidden = false) {
				this.$nextTick(() => {
					if (!keepKeyboardHidden || !this.focus) {
						this.focusInput()
					}
					if (!keepKeyboardHidden) {
						return
					}
					this.enforceKeyboardHiddenForEmojiPanel()
				})
			},
			restoreKeyboard() {
				this.clearRestoreKeyboardTimer()
				this.$nextTick(() => {
					this.restoreKeyboardTimer = setTimeout(() => {
						this.restoreKeyboardTimer = null
						this.showCaret(false)
					}, 30)
				})
			},
			showEmojiPanelImmediately() {
				this.pendingOpenEmojiPanel = false
				if (this.showEmojiPanel) {
					this.$emit('keyboardheightchange', {
						height: 0
					})
					this.$nextTick(() => {
						this.measureEmojiPanelMetrics()
					})
					this.showCaret(true)
					return
				}
				this.showEmojiPanel = true
				this.$emit('keyboardheightchange', {
					height: 0
				})
				this.$nextTick(() => {
					this.measureEmojiPanelMetrics()
				})
				this.showCaret(true)
			},
			measureEmojiPanelMetrics(callback) {
				this.$nextTick(() => {
					const query = uni.createSelectorQuery().in(this)
					query.select('.love-editor__emoji-panel').boundingClientRect()
					query.select('.emoji-list').boundingClientRect()
					query.select('.emoji-list').scrollOffset()
					query.selectAll('.emoji-item').boundingClientRect()
					query.exec((res = []) => {
						const panelRect = res[0] || null
						const scrollViewRect = res[1] || null
						const scrollOffset = res[2] || {}
						const itemRects = Array.isArray(res[3]) ? res[3] : []
						if (!panelRect || !scrollViewRect || !itemRects.length) {
							callback && callback()
							return
						}
						const scrollTop = Math.max(0, Number(scrollOffset.scrollTop || 0))
						this.emojiScrollTop = scrollTop
						this.emojiMetrics = {
							panelWidth: Number(panelRect.width || 0),
							panelLeft: Number(panelRect.left || 0),
							panelTop: Number(panelRect.top || 0),
							scrollTop,
							scrollViewLeft: Number(scrollViewRect.left || 0),
							scrollViewTop: Number(scrollViewRect.top || 0),
							itemRects: itemRects.map((rect = {}, idx) => ({
								idx,
								left: Number(rect.left || 0) - Number(scrollViewRect.left || 0),
								top: Number(rect.top || 0) - Number(scrollViewRect.top || 0) + scrollTop,
								width: Number(rect.width || 0),
								height: Number(rect.height || 0)
							}))
						}
						callback && callback()
					})
				})
			},
			measureEmojiPreviewRect(callback) {
				this.$nextTick(() => {
					const query = uni.createSelectorQuery().in(this)
					query.select('.love-editor__emoji-preview').boundingClientRect()
					query.exec((res = []) => {
						const previewRect = res[0] || null
						callback && callback(previewRect)
					})
				})
			},
			getTouchPoint(event = {}) {
				const touches = Array.isArray(event.touches) && event.touches.length ? event.touches : []
				const changedTouches = Array.isArray(event.changedTouches) && event.changedTouches.length ? event.changedTouches : []
				const point = touches[0] || changedTouches[0] || {}
				return {
					x: Number(point.clientX || point.pageX || 0),
					y: Number(point.clientY || point.pageY || 0)
				}
			},
			findEmojiIndexByTouch(event = {}) {
				const point = this.getTouchPoint(event)
				const metrics = this.emojiMetrics || {}
				const itemRects = Array.isArray(metrics.itemRects) ? metrics.itemRects : []
				if (!itemRects.length) {
					return -1
				}
				const relativeX = point.x - Number(metrics.scrollViewLeft || 0)
				const relativeY = point.y - Number(metrics.scrollViewTop || 0) + this.emojiScrollTop
				const matched = itemRects.find((item = {}) => {
					const left = Number(item.left || 0)
					const top = Number(item.top || 0)
					const width = Number(item.width || 0)
					const height = Number(item.height || 0)
					return relativeX >= left
						&& relativeX <= left + width
						&& relativeY >= top
						&& relativeY <= top + height
				})
				return matched ? Number(matched.idx) : -1
			},
			showEmojiPreviewByIndex(idx) {
				const emoji = this.emojiList[idx]
				const metrics = this.emojiMetrics || {}
				const itemRects = Array.isArray(metrics.itemRects) ? metrics.itemRects : []
				const item = itemRects[idx]
				if (!emoji || !item) {
					this.hideEmojiPreview()
					return
				}
				const panelLeft = Number(metrics.panelLeft || 0)
				const panelTop = Number(metrics.panelTop || 0)
				const emojiWidth = Number(item.width || 0)
				const emojiHeight = Number(item.height || 0)
				const centerX = Number(metrics.scrollViewLeft || 0) + Number(item.left || 0) + emojiWidth / 2
				const centerY = Number(metrics.scrollViewTop || 0) + Number(item.top || 0) - this.emojiScrollTop + emojiHeight / 2
				const token = this.emojiPreviewMeasureToken + 1
				this.emojiPreviewMeasureToken = token
				this.emojiPreview = {
					visible: true,
					idx,
					glyph: String(emoji.glyph || ''),
					tts: String(emoji.tts || ''),
					left: -9999,
					top: -9999,
					arrowLeft: 0
				}
				this.measureEmojiPreviewRect((previewRect) => {
					if (!previewRect || this.emojiPreviewMeasureToken !== token || this.emojiPreview.idx !== idx) {
						return
					}
					const previewWidth = Number(previewRect.width || 0)
					const previewHeight = Number(previewRect.height || 0)
					const screenInfo = typeof uni.getSystemInfoSync === 'function' ? uni.getSystemInfoSync() : {}
					const viewportWidth = Number(screenInfo.windowWidth || metrics.panelWidth || 375)
					const screenPadding = 6
					const arrowPadding = this.rpxToPx(12)
					let previewScreenLeft = centerX - previewWidth / 2
					const previewScreenTop = centerY - emojiHeight / 2 - previewHeight - 5
					if (previewScreenLeft < screenPadding) {
						previewScreenLeft = screenPadding
					}
					if (previewScreenLeft + previewWidth > viewportWidth - screenPadding) {
						previewScreenLeft = viewportWidth - screenPadding - previewWidth
					}
					const arrowLeft = Math.max(
						arrowPadding,
						Math.min(centerX - previewScreenLeft, previewWidth - arrowPadding)
					)
					this.emojiPreview = {
						visible: true,
						idx,
						glyph: String(emoji.glyph || ''),
						tts: String(emoji.tts || ''),
						left: previewScreenLeft - panelLeft,
						top: previewScreenTop - panelTop,
						arrowLeft
					}
				})
			},
			hideEmojiPreview() {
				this.emojiPreviewMeasureToken += 1
				this.emojiPreview = {
					visible: false,
					idx: -1,
					glyph: '',
					tts: '',
					left: 0,
					top: 0,
					arrowLeft: 0
				}
			},
			normalizeSelectionPosition(position, fallback) {
				const maxLength = String(this.text || '').length
				const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : maxLength
				const numericPosition = Number(position)
				if (!Number.isFinite(numericPosition)) {
					return Math.max(0, Math.min(safeFallback, maxLength))
				}
				return Math.max(0, Math.min(numericPosition, maxLength))
			},
			getSafeSelectionStart() {
				return this.normalizeSelectionPosition(this.selectionStart, String(this.text || '').length)
			},
			getSafeSelectionEnd() {
				return this.normalizeSelectionPosition(this.selectionEnd, this.getSafeSelectionStart())
			},
			updateSelection(start, end = start) {
				const safeStart = this.normalizeSelectionPosition(start, 0)
				const safeEnd = this.normalizeSelectionPosition(end, safeStart)
				this.selectionStart = safeStart
				this.selectionEnd = safeEnd
			},
			syncSelectedTextRange(callback) {
				if (!this.focus || typeof uni.getSelectedTextRange !== 'function') {
					callback && callback({
						start: this.getSafeSelectionStart(),
						end: this.getSafeSelectionEnd()
					})
					return
				}
				uni.getSelectedTextRange({
					success: (res = {}) => {
						const start = this.normalizeSelectionPosition(res.start, this.getSafeSelectionStart())
						const end = this.normalizeSelectionPosition(res.end, start)
						this.updateSelection(start, end)
						callback && callback({ start, end })
					},
					fail: () => {
						callback && callback({
							start: this.getSafeSelectionStart(),
							end: this.getSafeSelectionEnd()
						})
					}
				})
			},
			handleInput(e) {
				const detail = e && e.detail ? e.detail : {}
				const value = String(detail.value || '')
				const cursor = Number(detail.cursor)
				this.text = value
				const safeCursor = this.normalizeSelectionPosition(cursor, value.length)
				this.updateSelection(safeCursor, safeCursor)
				this.$emit('input', value)
				return value
			},
			handleFocus(e) {
				this.focus = true
				this.enforceKeyboardHiddenForEmojiPanel()
			},
			handleBlur(e) {
				const detail = e && e.detail ? e.detail : {}
				const cursor = Number(detail.cursor)
				this.focus = this.pendingOpenEmojiPanel || this.showEmojiPanel
				const safeCursor = this.normalizeSelectionPosition(cursor, this.getSafeSelectionStart())
				this.updateSelection(safeCursor, safeCursor)
			},
			handleConfirm(e) {
				const detail = e && e.detail ? e.detail : {}
				const cursor = Number(detail.cursor)
				const safeCursor = this.normalizeSelectionPosition(cursor, this.getSafeSelectionStart())
				this.updateSelection(safeCursor, safeCursor)
			},
			// textarea 时生效
			handleLineChange(e) {
				const detail = e && e.detail ? e.detail : {}
				if (Number.isFinite(Number(detail.cursor))) {
					const safeCursor = this.normalizeSelectionPosition(detail.cursor, this.getSafeSelectionStart())
					this.updateSelection(safeCursor, safeCursor)
				}
			},
			handleKeyboardHeightChange(e) {
				const detail = e && e.detail ? e.detail : {}
				const nextKeyboardHeight = Math.max(0, Number(detail.height || 0))
				this.keyboardHeight = Number.isFinite(nextKeyboardHeight) ? nextKeyboardHeight : 0
				if (this.pendingOpenEmojiPanel) {
					if (this.keyboardHeight <= 0) {
						this.showEmojiPanelImmediately()
						return
					}
					this.$emit('keyboardheightchange', Object.assign({}, detail, {
						height: this.keyboardHeight
					}))
					return
				}
				this.enforceKeyboardHiddenForEmojiPanel()
				if (this.showEmojiPanel) {
					this.$emit('keyboardheightchange', Object.assign({}, detail, {
						height: 0
					}))
					return
				}
				this.$emit('keyboardheightchange', detail)
			},
			handleInputTap() {
				if (!this.showEmojiPanel) {
					return
				}
				this.closeEmojiPanel(true)
			},
			handleEmojiScroll(event = {}) {
				const detail = event && event.detail ? event.detail : {}
				this.emojiScrollTop = Math.max(0, Number(detail.scrollTop || 0))
				if (this.emojiPreview.visible && this.emojiPreview.idx >= 0) {
					this.showEmojiPreviewByIndex(this.emojiPreview.idx)
				}
			},
			handleEmojiLongPress(idx) {
				this.emojiPreviewTracking = true
				this.lockEmojiTap()
				const showPreview = () => {
					this.showEmojiPreviewByIndex(idx)
				}
				if (!Array.isArray(this.emojiMetrics.itemRects) || !this.emojiMetrics.itemRects.length) {
					this.measureEmojiPanelMetrics(showPreview)
					return
				}
				showPreview()
			},
			handleEmojiTouchMove(event = {}) {
				if (!this.emojiPreviewTracking) {
					return
				}
				const idx = this.findEmojiIndexByTouch(event)
				if (idx < 0) {
					this.hideEmojiPreview()
					return
				}
				if (idx === this.emojiPreview.idx) {
					return
				}
				this.showEmojiPreviewByIndex(idx)
			},
			handleEmojiTouchEnd() {
				if (!this.emojiPreviewTracking) {
					return
				}
				this.emojiPreviewTracking = false
				this.lockEmojiTap()
				this.hideEmojiPreview()
			},
			openEmojiPanel() {
				this.clearRestoreKeyboardTimer()
				this.syncSelectedTextRange(() => {
					if (this.keyboardHeight > 0) {
						this.pendingOpenEmojiPanel = true
						this.hideKeyboardOnly()
						return
					}
					this.showEmojiPanelImmediately()
				})
			},
			closeEmojiPanel(restoreKeyboard = false) {
				this.pendingOpenEmojiPanel = false
				this.clearRestoreKeyboardTimer()
				this.emojiPreviewTracking = false
				this.hideEmojiPreview()
				if (!this.showEmojiPanel) {
					if (restoreKeyboard) {
						this.restoreKeyboard()
					}
					return
				}
				this.showEmojiPanel = false
				if (!restoreKeyboard) {
					return
				}
				this.restoreKeyboard()
			},
			toggleEmojiPanel() {
				if (this.showEmojiPanel) {
					this.closeEmojiPanel(true)
					return
				}
				this.openEmojiPanel()
			},
			insertEmoji(emoji) {
				if (this.suppressEmojiTap || this.emojiPreview.visible) {
					return
				}
				const glyph = emoji && emoji.glyph ? String(emoji.glyph) : ''
				if (!glyph) {
					return
				}
				const value = String(this.text || '')
				const start = this.getSafeSelectionStart()
				const end = this.getSafeSelectionEnd()
				const newValue = `${value.slice(0, start)}${glyph}${value.slice(end)}`
				const nextCursor = start + glyph.length
				this.text = newValue
				this.updateSelection(nextCursor, nextCursor)
				this.$emit('input', newValue)
				this.showCaret(this.showEmojiPanel)
			},
			delLastText() {
				
			},
			handleSend() {
				if (this.showEmojiPanel) {
					this.closeEmojiPanel(false)
				}
				if (this.sendable) {
					this.$emit('send', this.text)
				}
			}
		}
	};
</script>

<style scoped lang="scss">

	.emoji-input {
		font-size: 30rpx;
		line-height: 1.2;
		font-weight: 400;
		padding: 8px;
		font-family: sans-serif, 'Fluent Emoji Flat', 'Apple Color Emoji', 'Segoe UI Emoji';
	}

	@mixin flex-center {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	// 水平两端对齐
	@mixin flex-between {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	/* 编辑器容器 */
	.love-editor {
		background: #f8f8f8;
		box-sizing: border-box;
		
		&.safe-area-input {
			padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
		}
		
		.love-editor-bar {
			@include flex-between;
			gap: 10rpx;
			position: relative;
			z-index: 1;
			padding: 20rpx 28rpx;
			
			.emoji-input {
				flex: 1;
				background-color: #ffffff;
				min-height: 72rpx;
				max-height: 240rpx;
				height: 72rpx;
				box-sizing: border-box;
				color: #333333;
				border-radius: 12rpx;
			}

			.emoji-input--textarea {
				height: auto;
				line-height: 1.4;
			}
			
			&__emoji-toggle {
				@include flex-center;
				width: 60rpx;
				height: 60rpx;
				border-radius: 12rpx;
				flex-shrink: 0;
			}
			
			&__send {
				@include flex-center;
				flex-shrink: 0;
			}
			
			
		}
		
		.love-editor__emoji-panel {
			display: none;
			padding: 0;
			margin: 0;
			position: relative;
			max-height: 0;
			opacity: 0;
			overflow: hidden;
			pointer-events: none;
			font-family: sans-serif, 'Fluent Emoji Flat', 'Apple Color Emoji', 'Segoe UI Emoji';
			z-index: 8;

			.love-editor__emoji-preview {
				position: absolute;
				z-index: 12;
				width: auto;
				min-width: 0;
				max-width: calc(100vw - 20px);
				box-sizing: border-box;
				padding: 16rpx 8rpx 10rpx;
				background: rgba(255, 255, 255, 0.98);
				border-radius: 14rpx;
				box-shadow: 0 12rpx 24rpx rgba(0, 0, 0, 0.12);
				pointer-events: none;
				display: inline-flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;

				&::after {
					content: '';
					position: absolute;
					left: var(--arrow-left, 50%);
					bottom: 0;
					width: 16rpx;
					height: 16rpx;
					background: rgba(255, 255, 255, 0.98);
					transform: translate(-50%, 50%) rotate(45deg);
					border-radius: 3rpx;
				}
			}

			.love-editor__emoji-preview-glyph {
				font-size: 52rpx;
				line-height: 1;
			}

			.love-editor__emoji-preview-label {
				margin-top: 8rpx;
				font-size: 28rpx;
				line-height: 1.2;
				color: #666666;
				text-align: center;
				white-space: nowrap;
			}
			
			.emoji-list {
				height: 560rpx;
				width: 100%;
				background: transparent;
				padding: 10rpx 0rpx;
			}

			.emoji-grid {
				display: grid;
				grid-template-columns: repeat(8, 1fr);
				grid-gap: 20rpx;
				padding: 0;
				box-sizing: border-box;
			}

			.emoji-item {
				@include flex-center;
				aspect-ratio: 1 / 1;
				border-radius: 12rpx;
				font-size: 50rpx;
				line-height: 1;
			}
			.love-editor__delete {
				@include flex-center;
				position: absolute;
				bottom: 40rpx;
				right: 30rpx;
				border-radius: 6px;
				background-color: #ffffff;
				padding: 10rpx 16rpx;
			}
		}

		.love-editor__emoji-panel--visible {
			display: block;
			padding: 10rpx 32rpx 40rpx 32rpx;
			max-height: 580rpx;
			opacity: 1;
			overflow: visible;
			pointer-events: auto;
			border-top: 0.5px solid transparent;
			border-image: linear-gradient(to right, #f3f3f3, #f3f3f3) 1;
		}
	}
</style>
