<template>
	<fui-bottom-popup :show="show" :radius="'32rpx'" :mask-closable="true" :safe-area="true" @close="handleClose">
		<view class="word-editor">
			<view class="word-editor__head">
				<text class="word-editor__title">卧底词库</text>
				<text class="word-editor__desc">
					预置词库共 {{ presetTotal }} 组，也可以添加自己的专属词条。
				</text>
			</view>

			<fui-segmented-control
				:values="['系统词库', `我的词库（${mineTotal}）`]"
				:current="sourceIndex"
				type="button"
				color="#ec7558"
				active-color="#ffffff"
				:height="68"
				:size="25"
				:radius="999"
				:bold="true"
				@click="handleSourceChange"
			></fui-segmented-control>

			<scroll-view class="word-editor__categories" scroll-x>
				<view class="word-editor__categories-inner">
					<view
						v-for="item in categoryList"
						:key="item.category"
						class="word-editor__chip"
						:class="{ 'word-editor__chip--active': item.category === activeCategory }"
						@click="handleCategoryChange(item.category)"
					>
						<text class="word-editor__chip-text">{{ item.label }}</text>
					</view>
				</view>
			</scroll-view>

			<scroll-view class="word-editor__list" scroll-y @scrolltolower="handleLoadMore">
				<view v-if="loading" class="word-editor__tip">
					<text class="word-editor__tip-text">正在加载…</text>
				</view>

				<view v-else-if="!wordList.length" class="word-editor__tip">
					<text class="word-editor__tip-text">
						{{ source === 'preset' ? '该分类下暂无词条' : '还没有自建词条，往下添加一条吧' }}
					</text>
				</view>

				<view
					v-for="item in wordList"
					:key="item.wordId"
					class="word-item"
					:class="{ 'word-item--selected': item.wordId === selectedId }"
					@click="handlePickWord(item)"
				>
					<view class="word-item__body">
						<view class="word-item__pair">
							<text class="word-item__word word-item__word--civilian">{{ item.civilianWord }}</text>
							<text class="word-item__vs">/</text>
							<text class="word-item__word word-item__word--undercover">{{ item.undercoverWord }}</text>
						</view>
						<text class="word-item__meta">{{ item.category }} · 用过 {{ item.useCount }} 次</text>
					</view>
					<view v-if="!item.isPreset" class="word-item__actions">
						<view class="word-item__action" @click.stop="handleEditWord(item)">
							<text class="word-item__action-text">改</text>
						</view>
						<view class="word-item__action word-item__action--danger" @click.stop="handleDeleteWord(item)">
							<text class="word-item__action-text">删</text>
						</view>
					</view>
				</view>

				<view v-if="hasMore" class="word-editor__more" @click="handleLoadMore">
					<text class="word-editor__more-text">加载更多</text>
				</view>
			</scroll-view>

			<!-- 新增 / 编辑 -->
			<view class="word-form">
				<view class="word-form__head">
					<text class="word-form__title">{{ form.wordId ? '编辑词条' : '添加词条' }}</text>
					<view v-if="form.wordId" class="word-form__cancel" @click="handleResetForm">
						<text class="word-form__cancel-text">取消编辑</text>
					</view>
				</view>
				<view class="word-form__row">
					<fui-input
						placeholder="平民词"
						:value="form.civilianWord"
						:size="28"
						:radius="20"
						background-color="#fffaf7"
						color="#5a3427"
						:padding="['16rpx', '20rpx']"
						@input="handleFormInput('civilianWord', $event)"
					></fui-input>
					<fui-input
						placeholder="卧底词"
						:value="form.undercoverWord"
						:size="28"
						:radius="20"
						background-color="#fffaf7"
						color="#5a3427"
						:padding="['16rpx', '20rpx']"
						@input="handleFormInput('undercoverWord', $event)"
					></fui-input>
				</view>
				<view class="word-form__row word-form__row--bottom">
					<fui-input
						placeholder="分类（可留空，默认「自定义」）"
						:value="form.category"
						:size="28"
						:radius="20"
						background-color="#fffaf7"
						color="#5a3427"
						:padding="['16rpx', '20rpx']"
						@input="handleFormInput('category', $event)"
					></fui-input>
					<view class="word-form__submit" @click="handleSubmitWord">
						<text class="word-form__submit-text">{{ form.wordId ? '保存' : '添加' }}</text>
					</view>
				</view>
			</view>

			<view class="word-editor__footer">
				<fui-button
					text="知道了"
					background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
					color="#ffffff"
					height="84rpx"
					radius="999rpx"
					:size="29"
					:bold="true"
					@click="handleClose"
				/>
			</view>
		</view>
	</fui-bottom-popup>
</template>

<script>
	import { getGameApi, assertGameResult } from '@/common/api/game.js'

	const ALL_CATEGORY = '全部'
	// 与云函数 lib/game-words.js 的 CUSTOM_CATEGORY 保持一致
	const CUSTOM_CATEGORY = '自定义'

	export default {
		name: 'LoveGameWordEditor',
		props: {
			show: {
				type: Boolean,
				default: false
			},
			/** 可选：点词条后回传该词条（选词库模式） */
			selectable: {
				type: Boolean,
				default: false
			},
			selectedId: {
				type: String,
				default: ''
			}
		},
		emits: ['close', 'select', 'change'],
		data() {
			return {
				sourceIndex: 0,
				source: 'preset',
				activeCategory: ALL_CATEGORY,
				categories: [],
				presetTotal: 0,
				mineTotal: 0,
				wordList: [],
				page: 1,
				pageSize: 20,
				hasMore: false,
				loading: false,
				form: {
					wordId: '',
					civilianWord: '',
					undercoverWord: '',
					category: ''
				}
			}
		},
		computed: {
			categoryList() {
				const list = [{ category: ALL_CATEGORY, label: '全部', count: this.presetTotal, mineCount: this.mineTotal }]
				return list.concat((this.categories || []).map((item) => ({
					category: item.category,
					label: this.source === 'mine'
						? `${item.category}(${item.mineCount || 0})`
						: `${item.category}(${item.count || 0})`,
					count: item.count,
					mineCount: item.mineCount
				})))
			}
		},
		watch: {
			show(next) {
				if (next) {
					this.reload()
				}
			}
		},
		methods: {
			handleClose() {
				this.$emit('close')
			},
			async reload() {
				await this.loadCategories()
				this.page = 1
				await this.loadWords({ reset: true })
			},
			async loadCategories() {
				try {
					const result = assertGameResult(
						await getGameApi().listWordCategories(),
						'获取词库分类失败'
					)
					const data = result.data || {}
					this.categories = Array.isArray(data.categories) ? data.categories : []
					this.presetTotal = Number(data.presetTotal || 0)
					this.mineTotal = Number(data.mineTotal || 0)
				} catch (error) {
					console.warn('loadCategories failed', error)
					this.categories = []
				}
			},
			async loadWords({ reset = false } = {}) {
				if (this.loading) {
					return
				}
				this.loading = true
				try {
					const result = assertGameResult(
						await getGameApi().listWords({
							source: this.source,
							category: this.activeCategory === ALL_CATEGORY ? '' : this.activeCategory,
							page: this.page,
							pageSize: this.pageSize
						}),
						'获取词条失败'
					)
					const data = result.data || {}
					const list = Array.isArray(data.list) ? data.list : []
					this.wordList = reset ? list : this.wordList.concat(list)
					this.hasMore = Boolean(data.pagination && data.pagination.hasMore)
				} catch (error) {
					console.warn('loadWords failed', error)
					if (reset) {
						this.wordList = []
					}
					uni.showToast({
						title: error.message || '获取词条失败',
						icon: 'none'
					})
				} finally {
					this.loading = false
				}
			},
			handleLoadMore() {
				if (!this.hasMore || this.loading) {
					return
				}
				this.page += 1
				this.loadWords()
			},
			handleSourceChange(event = {}) {
				const index = Number(event.index)
				if (!Number.isInteger(index) || index === this.sourceIndex) {
					return
				}
				this.sourceIndex = index
				this.source = index === 1 ? 'mine' : 'preset'
				this.activeCategory = ALL_CATEGORY
				this.page = 1
				this.loadWords({ reset: true })
			},
			handleCategoryChange(category) {
				if (category === this.activeCategory) {
					return
				}
				this.activeCategory = category
				this.page = 1
				this.loadWords({ reset: true })
			},
			handlePickWord(item) {
				if (!this.selectable) {
					return
				}
				this.$emit('select', item)
			},
			handleFormInput(field, event = {}) {
				const detail = event.detail || event
				const value = detail.value === undefined ? '' : String(detail.value)
				this.form = Object.assign({}, this.form, {
					[field]: value
				})
			},
			handleEditWord(item) {
				this.form = {
					wordId: item.wordId,
					civilianWord: item.civilianWord,
					undercoverWord: item.undercoverWord,
					category: item.category === CUSTOM_CATEGORY ? '' : item.category
				}
			},
			handleResetForm() {
				this.form = {
					wordId: '',
					civilianWord: '',
					undercoverWord: '',
					category: ''
				}
			},
			async handleSubmitWord() {
				if (!this.form.civilianWord.trim() || !this.form.undercoverWord.trim()) {
					uni.showToast({
						title: '平民词和卧底词都要填',
						icon: 'none'
					})
					return
				}

				try {
					assertGameResult(
						await getGameApi().saveWord({
							wordId: this.form.wordId,
							civilianWord: this.form.civilianWord,
							undercoverWord: this.form.undercoverWord,
							category: this.form.category
						}),
						'保存词条失败'
					)
					uni.showToast({
						title: this.form.wordId ? '已保存' : '已添加',
						icon: 'none'
					})
					this.handleResetForm()
					this.sourceIndex = 1
					this.source = 'mine'
					this.activeCategory = ALL_CATEGORY
					await this.loadCategories()
					this.page = 1
					await this.loadWords({ reset: true })
					this.$emit('change')
				} catch (error) {
					uni.showToast({
						title: error.message || '保存词条失败',
						icon: 'none'
					})
				}
			},
			handleDeleteWord(item) {
				uni.showModal({
					title: '删除词条',
					content: `确定删除「${item.civilianWord} / ${item.undercoverWord}」吗？`,
					success: async (res) => {
						if (!res.confirm) {
							return
						}
						try {
							assertGameResult(
								await getGameApi().deleteWord({ wordId: item.wordId }),
								'删除词条失败'
							)
							this.wordList = this.wordList.filter((word) => word.wordId !== item.wordId)
							await this.loadCategories()
							this.$emit('change')
						} catch (error) {
							uni.showToast({
								title: error.message || '删除词条失败',
								icon: 'none'
							})
						}
					}
				})
			}
		}
	}
</script>

<style>
	.word-editor {
		display: flex;
		flex-direction: column;
		padding: 12rpx 28rpx 24rpx;
		background: #ffffff;
	}

	.word-editor__head {
		padding: 20rpx 4rpx 22rpx;
	}

	.word-editor__title {
		display: block;
		font-size: 38rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.word-editor__desc {
		display: block;
		margin-top: 10rpx;
		font-size: 24rpx;
		line-height: 1.6;
		color: #8b6659;
	}

	.word-editor__categories {
		margin-top: 22rpx;
		white-space: nowrap;
	}

	.word-editor__categories-inner {
		display: inline-flex;
		align-items: center;
		padding: 2rpx;
	}

	.word-editor__chip {
		padding: 10rpx 22rpx;
		margin-right: 14rpx;
		border-radius: 999rpx;
		background: rgba(255, 247, 243, 0.98);
	}

	.word-editor__chip--active {
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	}

	.word-editor__chip-text {
		font-size: 23rpx;
		color: #b05b48;
	}

	.word-editor__chip--active .word-editor__chip-text {
		color: #ffffff;
		font-weight: 600;
	}

	.word-editor__list {
		max-height: 46vh;
		margin-top: 18rpx;
	}

	.word-editor__tip {
		padding: 34rpx 0;
		text-align: center;
	}

	.word-editor__tip-text {
		font-size: 24rpx;
		color: #a07d71;
	}

	.word-item {
		display: flex;
		align-items: center;
		gap: 16rpx;
		padding: 18rpx 20rpx;
		border-radius: 22rpx;
		background: rgba(255, 251, 248, 0.98);
	}

	.word-item + .word-item {
		margin-top: 12rpx;
	}

	.word-item--selected {
		background: rgba(255, 240, 232, 0.98);
		box-shadow: 0 0 0 2rpx rgba(231, 111, 81, 0.4);
	}

	.word-item__body {
		flex: 1;
		min-width: 0;
	}

	.word-item__pair {
		display: flex;
		align-items: center;
		gap: 10rpx;
	}

	.word-item__word {
		font-size: 27rpx;
		font-weight: 600;
	}

	.word-item__word--civilian {
		color: #5d372b;
	}

	.word-item__word--undercover {
		color: #c0674d;
	}

	.word-item__vs {
		font-size: 24rpx;
		color: #cfb3a6;
	}

	.word-item__meta {
		display: block;
		margin-top: 6rpx;
		font-size: 21rpx;
		color: #b0a09a;
	}

	.word-item__actions {
		display: flex;
		gap: 12rpx;
	}

	.word-item__action {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 60rpx;
		height: 60rpx;
		border-radius: 18rpx;
		background: rgba(255, 241, 235, 0.98);
	}

	.word-item__action--danger {
		background: rgba(255, 232, 228, 0.98);
	}

	.word-item__action-text {
		font-size: 24rpx;
		color: #b05b48;
	}

	.word-editor__more {
		padding: 22rpx 0;
		text-align: center;
	}

	.word-editor__more-text {
		font-size: 24rpx;
		color: #b98069;
	}

	.word-form {
		margin-top: 20rpx;
		padding: 22rpx;
		border-radius: 26rpx;
		background: rgba(255, 247, 243, 0.98);
	}

	.word-form__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.word-form__title {
		font-size: 27rpx;
		font-weight: 700;
		color: #5d372b;
	}

	.word-form__cancel {
		padding: 4rpx 16rpx;
		border-radius: 999rpx;
		background: rgba(255, 255, 255, 0.96);
	}

	.word-form__cancel-text {
		font-size: 21rpx;
		color: #b05b48;
	}

	.word-form__row {
		display: flex;
		gap: 16rpx;
	}

	.word-form__row--bottom {
		margin-top: 14rpx;
		align-items: center;
	}

	.word-form__submit {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 140rpx;
		height: 76rpx;
		border-radius: 20rpx;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
	}

	.word-form__submit-text {
		font-size: 27rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.word-editor__footer {
		padding-top: 20rpx;
	}
</style>
