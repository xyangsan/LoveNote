<template>
	<view class="love-page love-page--compact anniversary-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<view class="love-title-block anniversary-header">
				<text class="love-title-block__eyebrow">LOVE NOTE</text>
				<view class="anniversary-header__title-row">
					<text class="love-title-block__title">纪念日</text>
					<fui-button
						v-if="isLoggedIn"
						text="新增"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						radius="999rpx"
						height="56rpx"
						width="112rpx"
						:size="22"
						:bold="true"
						@click="goToEdit()"
					></fui-button>
				</view>
				<text class="love-title-block__desc">记录重要时刻，自动计算下一次倒计时天数。</text>
			</view>

			<love-auth-required
				v-if="!isLoggedIn"
				desc="纪念日功能需要登录后使用，登录后可创建并管理你们的重要日期。"
				secondary-text="返回首页"
				@login="goToLoginPage"
				@secondary="backToHome"
			></love-auth-required>

			<view v-else>
				<love-glass-card
					v-if="noCouple"
					:margin="['0', '0', '0', '0']"
					:header-line="false"
				>
					<fui-empty
						title="未绑定情侣关系"
						descr="请先完成情侣绑定，再创建和查看纪念日。"
						:size="28"
						descr-size="22"
						color="#6e4a3f"
						descr-color="#9a766c"
						:margin-top="0"
					></fui-empty>
					<view class="empty-actions">
						<fui-button
							text="去绑定"
							background="rgba(255, 241, 235, 0.98)"
							color="#b05b48"
							border-color="rgba(214, 145, 122, 0.24)"
							radius="999rpx"
							height="82rpx"
							:size="24"
							:bold="true"
							@click="goToCouplePage"
						></fui-button>
					</view>
				</love-glass-card>

				<view v-else-if="loading && !anniversaryList.length" class="loading-block">
					<fui-loading type="rotate" size="48" color="#e76f51"></fui-loading>
					<text class="loading-block__text">加载中...</text>
				</view>

				<love-glass-card
					v-else-if="!anniversaryList.length"
					:margin="['0', '0', '0', '0']"
					:header-line="false"
				>
					<fui-empty
						title="还没有纪念日"
						descr="点击上方按钮，创建你们的第一个纪念日。"
						:size="28"
						descr-size="22"
						color="#6e4a3f"
						descr-color="#9a766c"
						:margin-top="0"
					></fui-empty>
				</love-glass-card>

				<view v-else class="anniversary-list">
					<love-anniversary-card
						v-for="item in anniversaryList"
						:key="item._id"
						:title="item.title"
						:date-text="item.display_date_value || item.date_value"
						:date-type-text="dateTypeTextMap[item.date_type] || '公历'"
						:repeat-type-text="repeatTypeTextMap[item.repeat_type] || '每年'"
						:elapsed-text="item.elapsed_text"
						:countdown-text="item.countdown_text"
						:next-date-text="item.next_date ? `下一次：${item.next_date}` : ''"
						:background-style="buildCardBackgroundStyle(item)"
						:mask-style="buildCardMaskStyle(item)"
						:text-style="buildCardTextStyle(item)"
						:mask-enabled="item.mask_enabled"
						:show-delete="true"
						:clickable="true"
						@click="goToEdit(item)"
						@delete="handleDelete(item)"
					></love-anniversary-card>
				</view>

				<view v-if="anniversaryList.length && !pagination.hasMore" class="list-end">
					<text class="list-end__text">已经到底了</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import {
	clearUniIdTokenStorage,
	getCurrentUniIdUser
} from '../../common/auth-center.js'
import { getAnniversaryApi } from '../../common/api/anniversary.js'
import { normalizeAnniversaryCountdownItem } from '../../common/utils/anniversary-countdown.js'
import LoveAnniversaryCard from './love-anniversary-card.vue'

const DATE_TYPE_TEXT_MAP = {
	solar: '公历',
	lunar: '农历'
}

const REPEAT_TYPE_TEXT_MAP = {
	none: '不重复',
	weekly: '每周',
	monthly: '每月',
	yearly: '每年'
}

function getDefaultPagination() {
	return {
		page: 1,
		pageSize: 20,
		total: 0,
		hasMore: true
	}
}

export default {
	components: {
		LoveAnniversaryCard
	},
	data() {
		return {
			isLoggedIn: false,
			loading: false,
			noCouple: false,
			anniversaryList: [],
			pagination: getDefaultPagination(),
			dateTypeTextMap: DATE_TYPE_TEXT_MAP,
			repeatTypeTextMap: REPEAT_TYPE_TEXT_MAP
		}
	},
	onShow() {
		this.syncLoginState()
		if (this.isLoggedIn) {
			this.loadList(true)
		}
	},
	onPullDownRefresh() {
		if (!this.isLoggedIn) {
			uni.stopPullDownRefresh()
			return
		}

		this.loadList(true).finally(() => {
			uni.stopPullDownRefresh()
		})
	},
	onReachBottom() {
		if (!this.isLoggedIn || this.loading || !this.pagination.hasMore || this.noCouple) {
			return
		}
		this.loadList(false)
	},
	methods: {
		syncLoginState() {
			const currentUser = getCurrentUniIdUser()
			const valid = Boolean(
				currentUser &&
				currentUser.uid &&
				(!currentUser.tokenExpired || currentUser.tokenExpired > Date.now())
			)

			this.isLoggedIn = valid
			if (!valid) {
				clearUniIdTokenStorage()
				this.noCouple = false
				this.anniversaryList = []
				this.pagination = getDefaultPagination()
			}
		},
		async loadList(reset = false) {
			if (this.loading) {
				return
			}

			const requestPage = reset ? 1 : Number(this.pagination.page || 1)
			const requestPageSize = Number(this.pagination.pageSize || 20)
			this.loading = true

			try {
				if (reset) {
					this.noCouple = false
				}

				const result = await getAnniversaryApi().getList({
					page: requestPage,
					pageSize: requestPageSize
				})

				if (result && result.errCode && result.errCode !== 0) {
					if (result.errCode === 'love-note-no-couple') {
						this.noCouple = true
						this.anniversaryList = []
						this.pagination = {
							...getDefaultPagination(),
							hasMore: false
						}
						return
					}
					throw new Error(result.errMsg || '获取纪念日列表失败')
				}

				const data = result && result.data ? result.data : {}
				const list = Array.isArray(data.list)
					? data.list.map(item => normalizeAnniversaryCountdownItem(item))
					: []
				const pageInfo = data.pagination || {}
				const total = Number(pageInfo.total || 0)
				const hasMore = pageInfo.hasMore !== undefined
					? Boolean(pageInfo.hasMore)
					: requestPage * requestPageSize < total

				this.noCouple = false
				this.anniversaryList = reset ? list : [...this.anniversaryList, ...list]
				this.pagination = {
					page: requestPage + 1,
					pageSize: requestPageSize,
					total,
					hasMore
				}
			} catch (error) {
				console.error('anniversary list load failed', error)
				uni.showToast({
					title: error.message || '加载失败',
					icon: 'none'
				})
			} finally {
				this.loading = false
			}
		},
		buildCardBackgroundStyle(item = {}) {
			const bgImage = item.background_image && item.background_image.url
				? String(item.background_image.url)
				: ''
			if (item.background_type === 'image' && bgImage) {
				return {
					backgroundImage: `url(${bgImage})`,
					backgroundSize: 'cover',
					backgroundPosition: 'center'
				}
			}
			return {
				backgroundColor: item.background_color || '#EC7558'
			}
		},
		buildCardMaskStyle(item = {}) {
			const opacity = Math.max(0, Math.min(1, Number(item.mask_opacity || 0)))
			return {
				backgroundColor: item.mask_color || '#000000',
				opacity
			}
		},
		buildCardTextStyle(item = {}) {
			return {
				color: item.font_color || '#FFFFFF'
			}
		},
		goToEdit(item = null) {
			const id = item && item._id ? String(item._id) : ''
			const url = id ? `/pages/anniversary/edit?anniversaryId=${id}` : '/pages/anniversary/edit'
			uni.navigateTo({
				url
			})
		},
		async handleDelete(item = {}) {
			const anniversaryId = String(item._id || '').trim()
			if (!anniversaryId) {
				return
			}

			const confirmed = await new Promise((resolve) => {
				uni.showModal({
					title: '删除纪念日',
					content: '删除后不可恢复，确认删除吗？',
					confirmColor: '#e76f51',
					success: (res) => {
						resolve(Boolean(res.confirm))
					},
					fail: () => {
						resolve(false)
					}
				})
			})

			if (!confirmed) {
				return
			}

			uni.showLoading({
				title: '删除中...',
				mask: true
			})

			try {
				const result = await getAnniversaryApi().delete({
					anniversaryId
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '删除失败')
				}

				uni.showToast({
					title: '删除成功',
					icon: 'success'
				})
				this.loadList(true)
			} catch (error) {
				console.error('anniversary delete failed', error)
				uni.showToast({
					title: error.message || '删除失败',
					icon: 'none'
				})
			} finally {
				uni.hideLoading()
			}
		},
		goToLoginPage() {
			uni.navigateTo({
				url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/anniversary/list')
			})
		},
		backToHome() {
			uni.switchTab({
				url: '/pages/index/index'
			})
		},
		goToCouplePage() {
			uni.navigateTo({
				url: '/pages/couple/index'
			})
		}
	}
}
</script>

<style>
	.anniversary-page {
		padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
	}

	.anniversary-header {
		padding-bottom: 10rpx;
	}

	.anniversary-header__title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		min-width: 0;
	}

	.empty-actions {
		margin-top: 28rpx;
	}

	.loading-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80rpx 0;
	}

	.loading-block__text {
		margin-top: 16rpx;
		font-size: 24rpx;
		color: #8d6a60;
	}

	.anniversary-list {
		display: flex;
		flex-direction: column;
		gap: 20rpx;
		padding: 0 8rpx;
	}

	.list-end {
		padding: 28rpx 0 10rpx;
		text-align: center;
	}

	.list-end__text {
		font-size: 22rpx;
		color: #ad8476;
	}
</style>
