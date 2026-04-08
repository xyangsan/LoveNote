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
				:adjust-position="true"
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
			<scroll-view scroll-y class="emoji-list">
				<view class="emoji-grid">
					<view class="emoji-item" v-for="(emoji, idx) in emojiList" :key="idx" @touchend.prevent="insertEmoji(emoji)">
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
				default: false
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
		computed: {
			sendable() {
				return this.text.length > 0
			},
			textareaPlaceholderStyle() {
				return 'color:#999999;font-size:30rpx;font-weight:400;line-height:1.5;'
			}
		},
		methods: {
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
					this.focusInput()
					if (!keepKeyboardHidden) {
						return
					}
					this.enforceKeyboardHiddenForEmojiPanel()
				})
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
				this.focus = false
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
				this.enforceKeyboardHiddenForEmojiPanel()
				this.$emit('keyboardheightchange', e && e.detail ? e.detail : {})
			},
			handleInputTap() {
				if (!this.showEmojiPanel) {
					return
				}
				this.closeEmojiPanel(true)
			},
			openEmojiPanel() {
				this.syncSelectedTextRange(() => {
					this.showEmojiPanel = true
					this.showCaret(true)
				})
			},
			closeEmojiPanel(restoreKeyboard = false) {
				if (!this.showEmojiPanel) {
					if (restoreKeyboard) {
						this.showCaret(false)
					}
					return
				}
				this.showEmojiPanel = false
				if (!restoreKeyboard) {
					return
				}
				this.blurInput()
				this.showCaret(false)
			},
			toggleEmojiPanel() {
				if (this.showEmojiPanel) {
					this.closeEmojiPanel(true)
					return
				}
				this.openEmojiPanel()
			},
			insertEmoji(emoji) {
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
	@font-face {
		font-family: 'Fluent Emoji Flat';
		src: url('https://env-00jxhb140x6o.normal.cloudstatic.cn/fonts/FluentEmojiFlat.woff2') format('woff2');
		font-style: normal;
		font-weight: 400;
		font-display: swap;
	}

	.emoji-input {
		font-size: 30rpx;
		line-height: 1.2;
		font-weight: 400;
		padding: 8px;
		font-family: 'Fluent Emoji Flat', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
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
		padding: 20rpx 28rpx;
		
		&.safe-area-input {
			padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
		}
		
		.love-editor-bar {
			@include flex-between;
			gap: 10rpx;
			
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
			position: relative;
			max-height: 0;
			opacity: 0;
			transform: translateY(16rpx);
			margin-top: 0;
			padding: 0 10rpx;
			overflow: hidden;
			pointer-events: none;
			transition: max-height 0.22s ease, opacity 0.18s ease, transform 0.22s ease, margin-top 0.22s ease, padding 0.22s ease;
			
			.emoji-list {
				height: 560rpx;
				width: 100%;
				background: transparent;
			}

			.emoji-grid {
				display: flex;
				flex-wrap: wrap;
				align-content: flex-start;
				gap: 12rpx;
				padding: 8rpx 12rpx;
				box-sizing: border-box;
			}

			.emoji-item {
				@include flex-center;
				width: 70rpx;
				height: 70rpx;
				border-radius: 10rpx;
				font-size: 44rpx;
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
			max-height: 580rpx;
			opacity: 1;
			transform: translateY(0);
			margin-top: 20rpx;
			padding: 10rpx;
			pointer-events: auto;
			border-top: 0.5px solid transparent;
			border-image: linear-gradient(to right, #f3f3f3, #f3f3f3) 1;
		}
	}
</style>
