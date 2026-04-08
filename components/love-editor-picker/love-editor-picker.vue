<template>
	<fui-backdrop
		:show="visible"
		:background="backdropBackground"
		:z-index="zIndex"
		:closable="maskClosable"
		@click="handleMaskClick"
	>
		<view
			v-if="visible"
			class="love-editor-picker__panel"
			:style="{ marginBottom: safeKeyboardHeight + 'px' }"
			@tap.stop
		>
			<love-editor
				ref="editor"
				:value="value"
				:placeholder="placeholder"
				:maxlength="maxlength"
				:send-text="sendText"
				:deleteable="deleteable"
				:safe-area-input="safeAreaInput"
				@input="handleInput"
				@send="handleSend"
				@keyboardheightchange="handleKeyboardHeightChange"
			></love-editor>
		</view>
	</fui-backdrop>
</template>

<script>
	import FuiBackdrop from '@/components/firstui/fui-backdrop/fui-backdrop.vue'
	import LoveEditor from '@/components/love-editor/love-editor.vue'

	export default {
		name: 'love-editor-picker',
		components: {
			FuiBackdrop,
			LoveEditor
		},
		emits: ['input', 'send', 'close', 'keyboardheightchange'],
		props: {
			visible: {
				type: Boolean,
				default: false
			},
			value: {
				type: [String, Number],
				default: ''
			},
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
			deleteable: {
				type: Boolean,
				default: false
			},
			showMask: {
				type: Boolean,
				default: true
			},
			maskClosable: {
				type: Boolean,
				default: true
			},
			safeAreaInput: {
				type: Boolean,
				default: true
			},
			autoFocus: {
				type: Boolean,
				default: true
			},
			zIndex: {
				type: Number,
				default: 1300
			}
		},
		data() {
			return {
				keyboardHeight: 0
			}
		},
		computed: {
			safeKeyboardHeight() {
				return Math.max(0, Number(this.keyboardHeight || 0))
			},
			backdropBackground() {
				return this.showMask ? 'rgba(0, 0, 0, 0.6)' : 'transparent'
			}
		},
		watch: {
			visible(nextVisible) {
				if (nextVisible) {
					this.keyboardHeight = 0
					if (this.autoFocus) {
						this.$nextTick(() => {
							this.focusEditor()
						})
					}
					return
				}
				this.keyboardHeight = 0
				this.blurEditor()
				this.hideKeyboard()
			}
		},
		methods: {
			handleInput(value) {
				this.$emit('input', value)
			},
			handleSend(value) {
				this.$emit('send', value)
			},
			handleMaskClick() {
				this.blurEditor()
				this.hideKeyboard()
				this.$emit('close')
			},
			handleKeyboardHeightChange(detail = {}) {
				const nextHeight = Number(detail.height || 0)
				this.keyboardHeight = Number.isFinite(nextHeight) ? Math.max(0, nextHeight) : 0
				this.$emit('keyboardheightchange', detail)
			},
			getEditorRef() {
				const editorRef = this.$refs.editor
				if (Array.isArray(editorRef)) {
					return editorRef[0] || null
				}
				return editorRef || null
			},
			focusEditor() {
				const editor = this.getEditorRef()
				if (!editor || typeof editor.focusInput !== 'function') {
					return
				}
				editor.focusInput()
			},
			blurEditor() {
				const editor = this.getEditorRef()
				if (!editor || typeof editor.blurInput !== 'function') {
					return
				}
				editor.blurInput()
			},
			hideKeyboard() {
				const editor = this.getEditorRef()
				if (editor && typeof editor.hideKeyboardOnly === 'function') {
					editor.hideKeyboardOnly()
					return
				}
				if (typeof uni.hideKeyboard === 'function') {
					uni.hideKeyboard({})
				}
			}
		}
	}
</script>

<style scoped lang="scss">
	.love-editor-picker__panel {
		width: 100%;
		margin-top: auto;
		align-self: flex-end;
	}
</style>
