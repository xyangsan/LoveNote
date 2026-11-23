<template>
	<view class="tab-home">
		<noir-navbar :show-back="false" :transparent="true" :placeholder="false" :border="false" :scroll-top="scrollTop">
			<template #left>
				<view class="th-brand">
					<text class="th-brand__en">LOVENOTE</text>
					<text class="th-brand__cn">恋人手札</text>
				</view>
			</template>
		</noir-navbar>

		<!-- ==================== 14 未登录首页 ==================== -->
		<template v-if="!isLoggedIn">
			<view class="gh-hero">
				<image class="th-hero__bg" :src="heroCoverUrl" mode="aspectFill"></image>
				<view class="th-hero__shade gh-hero__shade"></view>
				<view class="th-hero__ember"></view>

				<view class="gh-hero__inner" :style="heroTopStyle">
					<view class="gh-hero__badge">
						<text class="gh-hero__badge-dot"></text>
						<text class="gh-hero__badge-txt">LOVENOTE · 恋人手札</text>
					</view>
					<view class="gh-hero__headline">
						<text class="gh-hero__title">两个人的光阴，</text>
						<text class="gh-hero__title">从今天开始落笔</text>
					</view>
					<text class="gh-hero__desc">登录微信后开启双人共享空间，未绑定也可先记录属于自己的纪念日、照片与愿望。</text>

					<view class="gh-hero__rule"></view>
					<view class="gh-hero__perks">
						<view class="gh-perk">
							<text class="gh-perk__num">4</text>
							<text class="gh-perk__lbl">核心记录模块</text>
						</view>
						<view class="gh-perk gh-perk--sep">
							<text class="gh-perk__num">+1000</text>
							<text class="gh-perk__lbl">绑定首赠心动点</text>
						</view>
						<view class="gh-perk gh-perk--sep">
							<text class="gh-perk__num">100%</text>
							<text class="gh-perk__lbl">双人私密同步</text>
						</view>
					</view>
				</view>
			</view>

			<view class="th-body">
				<!-- 主登录 CTA 卡片 -->
				<view class="gh-cta">
					<noir-button text="微信一键登录 · 开启恋人手札" variant="primary" size="lg" block @click="goLogin" />
					<text class="gh-cta__sub">无需繁琐注册 · 微信授权即刻开启你们的暗夜手札</text>
				</view>

				<!-- 核心能力预览（2×2 暗夜功能卡） -->
				<noir-section-head title="探索恋人手札" kicker="FEATURES PREVIEW" />
				<view class="gh-grid">
					<view class="gh-card" @tap="goLogin">
						<view class="gh-card__top">
							<view class="gh-card__ic">
								<fui-icon name="wait" :size="32" color="#D8B08C"></fui-icon>
							</view>
							<noir-tag text="4种重复" variant="gold" />
						</view>
						<text class="gh-card__title">纪念日倒数</text>
						<text class="gh-card__desc">支持公历 / 农历提醒，重要日子不再错过</text>
					</view>

					<view class="gh-card" @tap="goLogin">
						<view class="gh-card__top">
							<view class="gh-card__ic">
								<fui-icon name="picture" :size="32" color="#D8B08C"></fui-icon>
							</view>
							<noir-tag text="瀑布流" variant="gold" />
						</view>
						<text class="gh-card__title">照片与视频流</text>
						<text class="gh-card__desc">统一双人时光流，标签筛选与喜欢收藏</text>
					</view>

					<view class="gh-card" @tap="goLogin">
						<view class="gh-card__top">
							<view class="gh-card__ic">
								<fui-icon name="star" :size="32" color="#D8B08C"></fui-icon>
							</view>
							<noir-tag text="+10点" variant="gold" />
						</view>
						<text class="gh-card__title">愿望单与计划</text>
						<text class="gh-card__desc">心愿一键完成，计划支持多步协作</text>
					</view>

					<view class="gh-card" @tap="handleQuickTap({ action: 'game' })">
						<view class="gh-card__top">
							<view class="gh-card__ic">
								<fui-icon name="community" :size="32" color="#D8B08C"></fui-icon>
							</view>
							<noir-tag text="3款玩法" variant="gold" />
						</view>
						<text class="gh-card__title">聚会小游戏</text>
						<text class="gh-card__desc">谁是卧底 / 横屏斗地主 / 数字炸弹</text>
					</view>
				</view>

				<view class="ad-view">
					<!-- #ifdef MP-WEIXIN -->
					<ad unit-id="adunit-230be1ed0ea4b29b" ad-theme="black"></ad>
					<!-- #endif -->
				</view>

				<text class="gh-foot-note">底部 4-Tab 支持未登录态轻量浏览 · 随时登录同步数据</text>
			</view>
		</template>

		<!-- ==================== 01 已登录首页（v4 丰富版） ==================== -->
		<template v-else>
			<view class="th-hero-bleed" @tap="goCouple">
				<image class="th-hero__bg" :src="heroCoverUrl" mode="aspectFill"></image>
				<view class="th-hero__shade"></view>
				<view class="th-hero__ember"></view>

				<view class="th-hero__content" :style="heroTopStyle">
					<view class="th-hero__top">
						<text class="noir-kicker">{{ heroKicker }}</text>
						<noir-tag :text="heroStatusText" :variant="activeCouple ? 'gold' : 'coral'" />
					</view>

					<view class="th-dayrow">
						<text class="th-dayrow__num">{{ displayDays }}</text>
						<text class="th-dayrow__unit">天</text>
					</view>

					<view class="th-hero__rule"></view>

					<view class="th-couple">
						<view class="th-avs">
							<view class="th-ava-wrap th-ava-wrap--1">
								<image class="th-ava" :src="displayUserAvatar" mode="aspectFill"></image>
								<view v-if="selfGenderMeta" class="th-gender th-gender--l" :class="selfGenderMeta.className">
									<text class="th-gender__txt">{{ selfGenderMeta.icon }}</text>
								</view>
							</view>
							<view class="th-ava-wrap th-ava-wrap--2">
								<image v-if="displayPartnerAvatar" class="th-ava" :src="displayPartnerAvatar" mode="aspectFill"></image>
								<view v-else class="th-ava th-ava--empty">
									<text class="th-ava__txt">TA</text>
								</view>
								<view v-if="partnerGenderMeta" class="th-gender th-gender--r" :class="partnerGenderMeta.className">
									<text class="th-gender__txt">{{ partnerGenderMeta.icon }}</text>
								</view>
							</view>
						</view>
						<view class="th-couple__info">
							<text class="th-couple__names">{{ currentUserName }} × {{ partnerName }}</text>
							<text class="th-couple__meta">{{ coupleSubText }}</text>
						</view>
						<fui-icon name="arrowright" :size="28" color="rgba(216, 176, 140, 0.56)"></fui-icon>
					</view>

					<view class="th-stats">
						<view class="th-st" @tap.stop="goPage('/pages/anniversary/list')">
							<text class="th-st__val">{{ formatCount(stats.anniversaryTotal) }}</text>
							<text class="th-st__lbl">纪念日</text>
						</view>
						<view v-if="feedVisible" class="th-st th-st--sep" @tap.stop="$emit('switch-tab', 'feed')">
							<text class="th-st__val">{{ formatCount(stats.dailyTotal) }}</text>
							<text class="th-st__lbl">双人日常</text>
						</view>
						<view class="th-st th-st--sep" @tap.stop="goPage('/pages/album/list')">
							<text class="th-st__val">{{ formatCount(stats.albumTotal) }}</text>
							<text class="th-st__lbl">照片</text>
						</view>
					</view>
				</view>
			</view>

			<view class="th-body">
				<!-- 下一个纪念日高亮卡（保持原有布局） -->
				<view v-if="nextAnniversary" class="th-anniv" @tap="goPage('/pages/anniversary/list')">
					<view class="th-anniv__main">
						<view class="th-anniv__l">
							<text class="noir-kicker">NEXT / {{ nextAnniversary.date }}</text>
							<text class="th-anniv__title">{{ nextAnniversary.title }}</text>
							<text class="th-anniv__note">{{ nextAnniversary.note }}</text>
						</view>
						<view class="th-anniv__r">
							<text class="th-anniv__num">{{ nextAnniversary.daysNum }}</text>
							<text class="th-anniv__unit">{{ nextAnniversary.daysUnit }}</text>
						</view>
					</view>
				</view>
				<view v-else class="th-anniv th-anniv--empty" @tap="goPage('/pages/anniversary/list')">
					<view class="th-anniv__main">
						<view class="th-anniv__l">
							<text class="noir-kicker">NEXT ANNIVERSARY</text>
							<text class="th-anniv__title">记录第一个值得纪念的日子</text>
							<text class="th-anniv__note">支持公历 / 农历与 4 种重复规则</text>
						</view>
						<noir-tag text="＋ 新建" variant="coral" />
					</view>
				</view>

				<!-- 快捷入口（保持原有横向 5 格） -->
				<noir-section-head title="快捷入口" kicker="QUICK ACCESS" />
				<view class="th-quick">
					<view
						v-for="item in visibleQuickItems"
						:key="item.action"
						class="th-q"
						@tap="handleQuickTap(item)"
					>
						<view class="th-q__ic">
							<text class="th-q__glyph">{{ item.glyph }}</text>
						</view>
						<text class="th-q__lbl">{{ item.label }}</text>
					</view>
				</view>

				<!-- 广告位（保持原有位置） -->
				<view class="ad-view">
					<!-- #ifdef MP-WEIXIN -->
					<ad unit-id="adunit-230be1ed0ea4b29b" ad-theme="black"></ad>
					<!-- #endif -->
				</view>

				<!-- 最新日常（保持原有卡片布局） -->
				<template v-if="feedVisible">
					<view class="th-sec">
						<view class="th-sec__l">
							<text class="th-sec__title">最新双人日常</text>
						</view>
						<view class="th-sec__action" @tap="$emit('switch-tab', 'feed')">
							<text class="th-sec__action-txt">全部</text>
							<fui-icon name="arrowright" :size="24" color="rgba(216, 176, 140, 0.72)"></fui-icon>
						</view>
					</view>
					<view v-if="latestMoment" class="th-moment" @tap="$emit('switch-tab', 'feed')">
						<image v-if="latestMoment.cover" class="th-moment__img" :src="latestMoment.cover" mode="aspectFill"></image>
						<view v-else class="th-moment__ava">
							<text class="th-moment__ava-txt">{{ latestMoment.authorShort }}</text>
						</view>
						<view class="th-moment__body">
							<view class="th-moment__head">
								<text class="th-moment__name">{{ latestMoment.author }}</text>
								<text class="th-moment__time">{{ latestMoment.time }}</text>
							</view>
							<text class="th-moment__txt">{{ latestMoment.content }}</text>
						</view>
					</view>
					<noir-empty
						v-else
						kicker="MOMENTS"
						title="还没有双人日常"
						desc="发布第一条图文或视频，记录你们今天的瞬间"
						action-text="去发布"
						@action="goPage('/pages/feed/publish')"
					/>
				</template>

				<!-- ==================== 新增模块区域 ==================== -->

				<!-- 新增 1：时光胶片 · 最近照片墙 -->
				<view class="th-sec">
					<view class="th-sec__l">
						<text class="th-sec__title">时光胶片</text>
						<text class="th-sec__kicker">RECENT PHOTOS</text>
					</view>
					<view class="th-sec__action" @tap="goPage('/pages/album/list')">
						<text class="th-sec__action-txt">{{ photoHeaderActionText }}</text>
						<fui-icon name="arrowright" :size="24" color="rgba(216, 176, 140, 0.72)"></fui-icon>
					</view>
				</view>
				<view v-if="recentPhotos.length" class="th-film-grid">
					<view class="th-film-big" @tap="handlePhotoTap(recentPhotos[0], 0)">
						<image class="th-film-img" :src="recentPhotos[0].thumb" mode="aspectFill"></image>
						<view class="th-film-cap">
							<text class="th-film-cap__title">{{ recentPhotos[0].title }}</text>
							<text class="th-film-cap__date">{{ recentPhotos[0].date }}</text>
						</view>
					</view>
					<view class="th-film-col">
						<view
							v-if="recentPhotos[1]"
							class="th-film-sm"
							@tap="handlePhotoTap(recentPhotos[1], 1)"
						>
							<image class="th-film-img" :src="recentPhotos[1].thumb" mode="aspectFill"></image>
						</view>
						<view
							v-else
							class="th-film-sm th-film-sm--add"
							@tap="goPage('/pages/album/upload')"
						>
							<text class="th-film-add__plus">＋</text>
							<text class="th-film-add__txt">上传照片</text>
						</view>

						<view
							v-if="recentPhotos[2]"
							class="th-film-sm"
							@tap="goPage('/pages/album/list')"
						>
							<image class="th-film-img" :src="recentPhotos[2].thumb" mode="aspectFill"></image>
							<view v-if="extraPhotoCount > 0" class="th-film-more">
								<text class="th-film-more__num">+{{ extraPhotoCount }}</text>
								<text class="th-film-more__txt">查看全部</text>
							</view>
						</view>
						<view
							v-else
							class="th-film-sm th-film-sm--add"
							@tap="goPage('/pages/album/upload')"
						>
							<text class="th-film-add__plus">＋</text>
							<text class="th-film-add__txt">记录此刻</text>
						</view>
					</view>
				</view>
				<noir-empty
					v-else
					kicker="RECENT PHOTOS"
					title="还没有上传照片或视频"
					desc="把一起看过的风景和日常收进双人时光流"
					action-text="去上传"
					@action="goPage('/pages/album/upload')"
				/>

				<!-- 新增 2：今晚玩一局 · 聚会游戏速开区 -->
				<template v-if="gameVisible && visibleHomeGames.length">
					<view class="th-sec">
						<view class="th-sec__l">
							<text class="th-sec__title">今晚玩一局</text>
							<text class="th-sec__kicker">PARTY GAMES</text>
						</view>
						<view class="th-sec__action" @tap="$emit('switch-tab', 'game')">
							<text class="th-sec__action-txt">进入大厅</text>
							<fui-icon name="arrowright" :size="24" color="rgba(216, 176, 140, 0.72)"></fui-icon>
						</view>
					</view>

					<view v-if="activeGameRoom" class="th-game-resume" @tap="handleResumeGame">
						<view class="th-game-resume__l">
							<text class="th-game-resume__title">{{ activeGameTitle }} · 进行中</text>
							<text class="th-game-resume__desc">{{ activeGameDesc }}</text>
						</view>
						<noir-tag text="回到房间" variant="coral" />
					</view>

					<view class="th-game-grid">
						<view
							v-for="(g, gIdx) in visibleHomeGames"
							:key="g.gameType"
							class="th-game-tile"
							:class="{ 'th-game-tile--hi': gIdx === 0 }"
							@tap="handleLaunchGame(g)"
						>
							<view class="th-game-tile__ic">
								<love-game-icon :game-type="g.gameType" :size="44" />
							</view>
							<text class="th-game-tile__title">{{ g.title }}</text>
							<text class="th-game-tile__sub">{{ g.playerText }}</text>
							<text class="th-game-tile__pt">+5 点/局</text>
						</view>
					</view>
				</template>

				<!-- 新增 3：宫格广告位 -->
				<!-- #ifdef MP-WEIXIN -->
				<view class="th-ad-grid">
					<ad unit-id="adunit-7a1e5e50b619b450" ad-theme="black"></ad>
				</view>
				<!-- #endif -->

				<!-- 愿望单预览（位于游戏宫格广告下方） -->
				<view class="th-sec">
					<view class="th-sec__l">
						<text class="th-sec__title">愿望单</text>
					</view>
					<view class="th-sec__action" @tap="goPage('/pages/plan/list')">
						<text class="th-sec__action-txt">查看全部</text>
						<fui-icon name="arrowright" :size="24" color="rgba(216, 176, 140, 0.72)"></fui-icon>
					</view>
				</view>
				<noir-card v-if="plans.length" padding="20rpx 26rpx">
					<view
						v-for="(item, idx) in plans"
						:key="item.id || idx"
						class="th-plan-row"
						:class="{ 'th-plan-row--last': idx === plans.length - 1 }"
						@tap="goPage('/pages/plan/list')"
					>
						<view class="th-plan-row__top">
							<text class="th-plan-row__title">{{ item.title }}</text>
							<noir-tag :text="item.status" :variant="item.tagVariant" />
						</view>
						<text class="th-plan-row__desc">{{ item.desc }}</text>
						<view v-if="item.hasProgress" class="th-plan-prog">
							<view class="th-plan-prog__track">
								<view class="th-plan-prog__fill" :style="{ width: item.percent + '%' }"></view>
							</view>
							<text class="th-plan-prog__pct">{{ item.percent }}%</text>
						</view>
					</view>
				</noir-card>
				<noir-empty
					v-else
					kicker="WISHLIST"
					title="许下第一个共同愿望"
					desc="愿望一键完成，计划支持多步骤与评论协作"
					action-text="去愿望单"
					@action="goPage('/pages/plan/list')"
				/>

				<!-- 新增 4：页尾手札落款 -->
				<view class="th-footer-quote">
					<text class="th-footer-quote__txt">「山海自有归期，风雨自有相逢。」</text>
					<text class="th-footer-quote__sub">LOVENOTE · TOGETHER DAY {{ displayDays }}</text>
				</view>
				<view class="ad-view">
					<ad unit-id="adunit-38461899baf8b875"></ad>
				</view>
			</view>
		</template>
	</view>
</template>

<script>
	import { DEFAULT_AVATAR, getCachedUserProfile, hasValidLogin } from '@/common/auth-center.js'
	import { getAnniversaryApi } from '@/common/api/anniversary.js'
	import { getDailyApi } from '@/common/api/daily.js'
	import { getPhotoApi } from '@/common/api/photo.js'
	import { getPlanApi } from '@/common/api/plan.js'
	import { getPointsApi } from '@/common/api/points.js'
	import { readAppSettingsCache } from '@/common/app-settings.js'
	import { getGameCardList, getGameMeta, GAME_TYPE_BOMB } from '@/common/game/rules.js'
	import { getNavBarHeight, getNavBarMetrics } from '@/common/utils/nav-bar.js'
	import { useAppStateStore } from '@/store/app-state.js'
	import LoveGameIcon from '@/components/love-game-icon/love-game-icon.vue'

	const DEFAULT_HERO_COVER = '/static/images/home-hero-bg.jpg'

	const ROOM_PAGE_MAP = {
		undercover: '/pages/game/undercover/room',
		landlord: '/pages/game/landlord/room'
	}

	function getDefaultPointsSummary() {
		return {
			isBound: false,
			balance: 0,
			todayEarned: 0,
			dailyLimitPoints: 180,
			taskCount: 0,
			totalTaskCount: 6,
			nextTierGap: 0,
			nextTierPoints: 0,
			dailyBonusClaimed: false,
			signStreak: 0,
			signCycleDay: 1,
			signPoints: 10,
			signTiers: []
		}
	}

	function formatNum(value) {
		const num = Math.max(0, Math.floor(Number(value) || 0))
		return `${num}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	function getDaysSince(bindDate) {
		if (!bindDate) return 0
		const start = new Date(bindDate).getTime()
		if (Number.isNaN(start)) return 0
		const diff = Date.now() - start
		return Math.max(1, Math.floor(diff / 86400000) + 1)
	}

	function formatShortDate(val) {
		if (!val) return ''
		const d = new Date(val)
		if (Number.isNaN(d.getTime())) return String(val).slice(0, 10)
		const y = d.getFullYear()
		const m = `${d.getMonth() + 1}`.padStart(2, '0')
		const day = `${d.getDate()}`.padStart(2, '0')
		return `${y}.${m}.${day}`
	}

	function formatTimeShort(ts) {
		if (!ts) return ''
		const d = new Date(Number(ts))
		if (Number.isNaN(d.getTime())) return ''
		const m = `${d.getMonth() + 1}`.padStart(2, '0')
		const day = `${d.getDate()}`.padStart(2, '0')
		const hh = `${d.getHours()}`.padStart(2, '0')
		const mm = `${d.getMinutes()}`.padStart(2, '0')
		return `${m}-${day} ${hh}:${mm}`
	}

	function normalizeAnniversaryItem(item) {
		if (!item) return null
		const days = Number(item.countdown_days ?? item.days_left ?? 0)
		return {
			title: item.title || '纪念日',
			date: formatShortDate(item.date || item.target_date),
			note: item.note || item.remark || '点击查看全部纪念日',
			daysNum: Math.abs(days),
			daysUnit: days >= 0 ? '天后' : '天前'
		}
	}

	export default {
		name: 'TabHome',
		components: {
			LoveGameIcon
		},
		props: {
			settings: {
				type: Object,
				default: () => readAppSettingsCache()
			},
			scrollTop: {
				type: Number,
				default: 0
			}
		},
		emits: ['switch-tab'],
		data() {
			const cachedUser = hasValidLogin() ? getCachedUserProfile() : null
			return {
				appStateStore: null,
				userInfo: cachedUser,
				// ⚠️ 登录态是 data 不是 computed：hasValidLogin() 读 token，不是响应式依赖，
				// 放 computed 会把「未登录」缓存到登录之后，登录页返回首页时数据刷不出来
				isLoggedIn: hasValidLogin(),
				coupleCenter: null,
				stats: {
					anniversaryTotal: null,
					dailyTotal: null,
					albumTotal: null,
					wishTotal: null
				},
				pointsLoaded: false,
				pointsSummary: getDefaultPointsSummary(),
				signDialogVisible: false,
				signing: false,
				nextAnniversary: null,
				secondAnniversary: null,
				recentPhotos: [],
				latestMoment: null,
				plans: [],
				activeGameRoom: null,
				allGames: getGameCardList(),
				navBarHeight: getNavBarHeight(getNavBarMetrics())
			}
		},
		computed: {
			heroTopStyle() {
				return {
					paddingTop: `${this.navBarHeight + 75}px`
				}
			},
			heroCoverUrl() {
				return DEFAULT_HERO_COVER
			},
			feedVisible() {
				return Boolean(this.settings && this.settings.feedVisible === true)
			},
			gameVisible() {
				return !this.settings || this.settings.gameVisible !== false
			},
			selfInfo() {
				return this.coupleCenter && this.coupleCenter.selfInfo ? this.coupleCenter.selfInfo : null
			},
			activeCouple() {
				return this.coupleCenter && this.coupleCenter.activeCouple ? this.coupleCenter.activeCouple : null
			},
			currentUserName() {
				return (
					(this.userInfo && this.userInfo.nickname) ||
					(this.selfInfo && this.selfInfo.nickname) ||
					'小满'
				)
			},
			displayUserAvatar() {
				return (
					(this.userInfo && (this.userInfo.avatarUrl || this.userInfo.avatar)) ||
					(this.selfInfo && this.selfInfo.avatarUrl) ||
					DEFAULT_AVATAR
				)
			},
			partnerName() {
				return (this.activeCouple && this.activeCouple.partnerNickname) || '待绑定'
			},
			partnerAvatar() {
				return (this.activeCouple && this.activeCouple.partnerAvatarUrl) || ''
			},
			displayPartnerAvatar() {
				if (!this.activeCouple) return ''
				return this.partnerAvatar || DEFAULT_AVATAR
			},
			selfGenderMeta() {
				const gender = Number(
					(this.userInfo && this.userInfo.gender) ||
					(this.selfInfo && this.selfInfo.gender) ||
					0
				)
				return this.resolveGenderMeta(gender)
			},
			partnerGenderMeta() {
				if (!this.activeCouple) return null
				return this.resolveGenderMeta(Number(this.activeCouple.partnerGender || 0))
			},
			displayDays() {
				if (this.activeCouple && this.activeCouple.bindDate) {
					return getDaysSince(this.activeCouple.bindDate)
				}
				return 0
			},
			heroKicker() {
				if (this.activeCouple && this.activeCouple.bindDate) {
					return `TOGETHER SINCE ${formatShortDate(this.activeCouple.bindDate)}`
				}
				return 'LOVENOTE · COUPLE SPACE'
			},
			heroStatusText() {
				return this.activeCouple ? '已绑定' : '未绑定'
			},
			coupleSubText() {
				if (this.activeCouple) {
					const pts = this.pointsLoaded ? ` · 心动点 ${formatNum(this.pointsSummary.balance)}` : ''
					return `双人共享空间已开启${pts}`
				}
				return '点击前往绑定另一半，解锁 +1,000 心动点'
			},
			formattedPointsBalance() {
				return this.pointsLoaded ? formatNum(this.pointsSummary.balance) : '--'
			},
			pulseKickerText() {
				if (!this.pointsSummary.isBound) {
					return 'HEART POINTS · 绑定后开启累积'
				}
				const streak = Number(this.pointsSummary.signStreak || 0)
				if (this.pointsSummary.dailyBonusClaimed) {
					return `HEART POINTS · 已连签 ${Math.max(1, streak)} 天`
				}
				return streak > 0 ? `HEART POINTS · 已连签 ${streak} 天` : 'HEART POINTS · 今日待签到'
			},
			pulseCtaText() {
				if (!this.pointsSummary.isBound) return '去绑定'
				if (this.pointsSummary.dailyBonusClaimed) return '今日已签'
				return `立即签到 +${Number(this.pointsSummary.signPoints || 10)}`
			},
			pulseProgressPercent() {
				const total = Math.max(1, Number(this.pointsSummary.totalTaskCount || 6))
				const done = Math.min(total, Math.max(0, Number(this.pointsSummary.taskCount || 0)))
				return Math.round((done / total) * 100)
			},
			pulseHintText() {
				if (!this.pointsSummary.isBound) {
					return '绑定情侣立得 +1,000 心动点'
				}
				const done = Number(this.pointsSummary.taskCount || 0)
				const total = Number(this.pointsSummary.totalTaskCount || 6)
				const gap = Number(this.pointsSummary.nextTierGap || 0)
				const pts = Number(this.pointsSummary.nextTierPoints || 0)
				if (gap > 0 && pts > 0) {
					return `今日任务 ${done}/${total} · 差 ${gap} 项领 +${pts}`
				}
				return `今日任务 ${done}/${total}`
			},
			photoHeaderActionText() {
				const total = Number(this.stats.albumTotal || 0)
				return total > 0 ? `全部 ${total} 项` : '查看全部'
			},
			extraPhotoCount() {
				const total = Number(this.stats.albumTotal || 0)
				return Math.max(0, total - 3)
			},
			visibleQuickItems() {
				const all = [
					{ action: 'anniversary', label: '纪念日', glyph: '纪' },
					{ action: 'feed', label: '双人日常', glyph: '日', visible: this.feedVisible },
					{ action: 'album', label: '照片', glyph: '照' },
					{ action: 'plan', label: '愿望单', glyph: '愿' },
					{ action: 'game', label: '聚会游戏', glyph: '玩', visible: this.gameVisible }
				]
				return all.filter((item) => item.visible !== false)
			},
			visibleHomeGames() {
				const items = (this.settings && this.settings.gameItems) || {}
				return this.allGames.filter((g) => items[g.gameType] !== false).slice(0, 3)
			},
			activeGameTitle() {
				if (!this.activeGameRoom) return ''
				const meta = getGameMeta(this.activeGameRoom.gameType)
				return meta ? meta.title : '进行中的对局'
			},
			activeGameDesc() {
				if (!this.activeGameRoom) return ''
				const r = this.activeGameRoom
				const code = r.roomCode ? `房间 ${r.roomCode} · ` : ''
				return `${code}${r.playerCount || 1}/${r.maxPlayers || 6} 人`
			}
		},
		mounted() {
			this.refresh({ force: false })
		},
		methods: {
			ensureStore() {
				if (!this.appStateStore) {
					this.appStateStore = useAppStateStore()
				}
				return this.appStateStore
			},
			formatCount(val) {
				return val === null || val === undefined ? '--' : String(val)
			},
			resolveGenderMeta(gender) {
				const g = Number(gender || 0)
				if (g === 1) {
					return { icon: '♂', className: 'th-gender--male' }
				}
				if (g === 2) {
					return { icon: '♀', className: 'th-gender--female' }
				}
				return null
			},
			/** 登录态实时同步：token 变了（登录 / 退出 / 换号）下次调用立刻反映出来 */
			syncLoginState() {
				this.isLoggedIn = hasValidLogin()
				return this.isLoggedIn
			},
			async refresh({ force = false } = {}) {
				const store = this.ensureStore()
				// 先按此刻的 token 定登录态，再用 store / 本地缓存的资料点亮界面
				const loggedIn = this.syncLoginState()
				this.userInfo = store.userInfo || (loggedIn ? getCachedUserProfile() : null)
				if (store.coupleCenterData) {
					this.coupleCenter = store.coupleCenterData
				}
				if (!loggedIn) {
					this.userInfo = null
					this.coupleCenter = null
					return
				}
				try {
					await Promise.all([
						store.fetchUserInfo({ force }).catch(() => {}),
						store.fetchCoupleCenter({ force }).catch(() => {}),
						store.fetchOverviewStats({ force }).catch(() => {})
					])
					this.userInfo = store.userInfo || getCachedUserProfile() || null
					this.coupleCenter = store.coupleCenterData || null
					const s = store.profileFeatureStats || {}
					this.stats = {
						anniversaryTotal: s.anniversaryTotal ?? null,
						dailyTotal: s.dailyTotal ?? null,
						albumTotal: s.albumTotal ?? null,
						wishTotal: s.wishTotal ?? null
					}
				} catch (error) {
					console.warn('tab-home store refresh failed', error)
				}

				this.loadSummaryCards(force)
			},
			loadPointsSummary() {
				return getPointsApi().getSummary().then((res) => {
					if (res && res.data) {
						const d = res.data
						this.pointsSummary = {
							isBound: Boolean(d.isBound),
							balance: Number(d.balance || 0),
							todayEarned: Number(d.todayEarned || 0),
							dailyLimitPoints: Number(d.dailyLimitPoints || 180),
							taskCount: Number(d.taskCount || 0),
							totalTaskCount: Number(d.totalTaskCount || 6),
							nextTierGap: Number(d.nextTierGap || 0),
							nextTierPoints: Number(d.nextTierPoints || 0),
							dailyBonusClaimed: Boolean(d.dailyBonusClaimed),
							signStreak: Number(d.signStreak || 0),
							signCycleDay: Number(d.signCycleDay || 1),
							signPoints: Number(d.signPoints || d.dailyBonusPoints || 10),
							signTiers: Array.isArray(d.signTiers) ? d.signTiers : []
						}
						this.pointsLoaded = true
					}
				}).catch(() => {})
			},
			async loadSummaryCards(force = false) {
				const store = this.ensureStore()

				// 1. 心动点 + 签到 + 每日任务进度
				this.loadPointsSummary()

				// 2. 最近纪念日（取前 2 条：主卡 + 下一程）
				getAnniversaryApi().getList({ page: 1, pageSize: 5 }).then((res) => {
					const list = (res && res.data && Array.isArray(res.data.list)) ? res.data.list : []
					this.nextAnniversary = list.length ? normalizeAnniversaryItem(list[0]) : null
					this.secondAnniversary = list.length > 1 ? normalizeAnniversaryItem(list[1]) : null
				}).catch(() => {})

				// 3. 时光胶片 · 最近 3 张照片
				getPhotoApi().getList({ page: 1, pageSize: 3 }).then((res) => {
					const list = (res && res.data && Array.isArray(res.data.list)) ? res.data.list : []
					this.recentPhotos = list
						.map((item) => ({
							id: item._id,
							thumb: String(item.thumbnail_url || item.url || '').trim(),
							url: String(item.url || item.thumbnail_url || '').trim(),
							title: String(item.title || item.description || '双人时光').trim(),
							date: formatShortDate(item.shot_time || item.create_time)
						}))
						.filter((item) => Boolean(item.thumb))
						.slice(0, 3)
				}).catch(() => {})

				// 4. 最新双人日常
				if (this.feedVisible) {
					getDailyApi().getList({ page: 1, pageSize: 1 }).then((res) => {
						const list = (res && res.data && Array.isArray(res.data.list)) ? res.data.list : []
						if (!list.length) {
							this.latestMoment = null
							return
						}
						const p = list[0]
						const author = (p.author_snapshot && p.author_snapshot.nickname) || '恋人'
						const avatar = (p.author_snapshot && p.author_snapshot.avatar_url) || ''
						const media = Array.isArray(p.media_list) && p.media_list[0] ? p.media_list[0] : null
						const loc = p.location && p.location.name ? String(p.location.name).trim() : ''
						this.latestMoment = {
							author,
							avatar,
							authorShort: author.slice(0, 1),
							time: formatTimeShort(p.create_time),
							content: String(p.content || '分享了一条新动态').trim(),
							cover: media ? (media.thumbnail_url || media.url || '') : '',
							likeCount: Number(p.like_count || 0),
							commentCount: Array.isArray(p.comment_list) ? p.comment_list.length : Number(p.comment_count || 0),
							location: loc
						}
					}).catch(() => {})
				}

				// 5. 愿望与计划（含步骤进度）
				getPlanApi().getList({ page: 1, pageSize: 3 }).then((res) => {
					const list = (res && res.data && Array.isArray(res.data.list)) ? res.data.list : []
					this.plans = list.slice(0, 3).map((item) => {
						const steps = Array.isArray(item.steps) ? item.steps : (Array.isArray(item.step_list) ? item.step_list : [])
						const totalSteps = Number(item.total_steps || item.step_count || steps.length || 0)
						const doneSteps = Number(
							item.completed_steps ??
							item.done_step_count ??
							steps.filter((s) => s && (s.status === 'completed' || s.done)).length
						)
						const isPlan = item.type === 'plan' || totalSteps > 0
						const isDone = item.status === 'completed'
						const percent = totalSteps > 0 ? Math.min(100, Math.round((doneSteps / totalSteps) * 100)) : 0
						let statusText = '心愿'
						let tagVariant = 'coral'
						if (isDone) {
							statusText = '已完成'
							tagVariant = 'green'
						} else if (item.status === 'skipped') {
							statusText = '已跳过'
							tagVariant = 'muted'
						} else if (isPlan && totalSteps > 0) {
							statusText = `计划 ${doneSteps}/${totalSteps}`
							tagVariant = 'gold'
						} else if (isPlan) {
							statusText = '进行中'
							tagVariant = 'gold'
						}
						return {
							id: item._id,
							title: item.title || '心愿',
							desc: item.description || (isPlan ? '多步骤协作计划' : '愿望一键完成 · 双方各得 +10 心动点'),
							status: statusText,
							tagVariant,
							hasProgress: isPlan && totalSteps > 0 && !isDone,
							percent
						}
					})
				}).catch(() => {})

				// 6. 进行中的聚会游戏房间
				if (this.gameVisible) {
					store.fetchGameActiveRoom({ force }).then(() => {
						this.activeGameRoom = store.gameActiveRoom || null
					}).catch(() => {
						this.activeGameRoom = null
					})
				}
			},
			handlePulseCta() {
				if (!this.pointsSummary.isBound) {
					this.goCouple()
					return
				}
				if (this.pointsSummary.dailyBonusClaimed) {
					this.goPoints()
					return
				}
				this.signDialogVisible = true
			},
			async handleSignClaim() {
				if (this.signing || this.pointsSummary.dailyBonusClaimed) return
				this.signing = true
				try {
					const res = await getPointsApi().signIn()
					if (res && res.errCode && res.errCode !== 0) {
						throw new Error(res.errMsg || '签到失败')
					}
					const awarded = Number((res && res.data && res.data.awardedPoints) || this.pointsSummary.signPoints || 10)
					uni.showToast({
						title: `签到成功 +${awarded} 心动点`,
						icon: 'none'
					})
					this.signDialogVisible = false
					await this.loadPointsSummary()
				} catch (error) {
					uni.showToast({
						title: error.message || '签到失败',
						icon: 'none'
					})
				} finally {
					this.signing = false
				}
			},
			handlePhotoTap(photo, index = 0) {
				if (!photo || !photo.url) {
					this.goPage('/pages/album/list')
					return
				}
				const urls = this.recentPhotos.map((p) => p.url).filter(Boolean)
				if (urls.length) {
					uni.previewImage({
						urls,
						current: Math.max(0, Math.min(index, urls.length - 1))
					})
				}
			},
			handleLaunchGame(game) {
				if (!game || !game.gameType) return
				if (game.gameType === GAME_TYPE_BOMB) {
					uni.navigateTo({ url: '/pages/game/bomb/index' })
					return
				}
				const url = ROOM_PAGE_MAP[game.gameType]
				if (url) {
					uni.navigateTo({ url })
				} else {
					this.$emit('switch-tab', 'game')
				}
			},
			handleResumeGame() {
				if (!this.activeGameRoom) return
				const url = ROOM_PAGE_MAP[this.activeGameRoom.gameType]
				if (url) {
					uni.navigateTo({ url: `${url}?roomId=${encodeURIComponent(this.activeGameRoom.roomId)}` })
				}
			},
			handleQuickTap(item) {
				if (!item) return
				if (item.action === 'feed') {
					this.$emit('switch-tab', 'feed')
					return
				}
				if (item.action === 'game') {
					this.$emit('switch-tab', 'game')
					return
				}
				const routeMap = {
					anniversary: '/pages/anniversary/list',
					album: '/pages/album/list',
					plan: '/pages/plan/list'
				}
				if (routeMap[item.action]) {
					uni.navigateTo({ url: routeMap[item.action] })
				}
			},
			goLogin() {
				uni.navigateTo({ url: '/pages/login/index?redirect=' + encodeURIComponent('/pages/index/index') })
			},
			goCouple() {
				uni.navigateTo({ url: '/pages/couple/index' })
			},
			goPoints() {
				uni.navigateTo({ url: '/pages/profile/points' })
			},
			goPage(url) {
				uni.navigateTo({ url })
			}
		}
	}
</script>

<style scoped>
	.tab-home {
		min-height: 100vh;
		padding-bottom: calc(184rpx + env(safe-area-inset-bottom));
	}

	.th-brand {
		display: flex;
		align-items: baseline;
		gap: 12rpx;
	}

	.th-brand__en {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 30rpx;
		letter-spacing: 5rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.th-brand__cn {
		font-size: 20rpx;
		letter-spacing: 2rpx;
		color: rgba(216, 176, 140, 0.72);
	}

	.th-body {
		padding: 16rpx 28rpx 0;
	}

	/* FULL-BLEED HERO BACKGROUND */
	.th-hero-bleed,
	.gh-hero {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: #110D0B;
	}

	.th-hero-bleed {
		min-height: 640rpx;
	}

	.th-hero__bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.th-hero__shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			rgba(13, 10, 8, 0.72) 0%,
			rgba(13, 10, 8, 0.24) 36%,
			rgba(13, 10, 8, 0.76) 74%,
			#110D0B 100%
		);
	}

	.th-hero__ember {
		position: absolute;
		inset: 0;
		background: radial-gradient(110% 56% at 78% 36%, rgba(226, 124, 78, 0.18), transparent 62%);
		pointer-events: none;
	}

	.th-hero__content,
	.gh-hero__inner {
		position: relative;
		z-index: 2;
		padding: 0 32rpx 28rpx;
	}

	.gh-hero {
		min-height: 700rpx;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
	}

	.gh-hero__shade {
		background: linear-gradient(
			180deg,
			rgba(13, 10, 8, 0.56) 0%,
			rgba(13, 10, 8, 0.14) 32%,
			rgba(13, 10, 8, 0.72) 66%,
			#110D0B 100%
		);
	}

	.gh-hero__inner {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding-bottom: 24rpx;
	}

	.gh-hero__badge {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 10rpx;
		height: 44rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.44);
		background: rgba(17, 13, 11, 0.54);
		margin-top: 120rpx;
	}

	.gh-hero__badge-dot {
		width: 10rpx;
		height: 10rpx;
		border-radius: 50%;
		background: #E2643F;
	}

	.gh-hero__badge-txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 3rpx;
		color: #EAD4BC;
	}

	.gh-hero__headline {
		margin-top: 22rpx;
	}

	.gh-hero__title {
		display: block;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 54rpx;
		line-height: 1.3;
		letter-spacing: 2rpx;
		color: #FBF4EA;
		font-weight: 600;
		text-shadow: 0 6rpx 26rpx rgba(0, 0, 0, 0.62);
	}

	.gh-hero__desc {
		display: block;
		margin-top: 16rpx;
		font-size: 23rpx;
		line-height: 1.72;
		color: rgba(245, 237, 228, 0.74);
	}

	.gh-hero__rule {
		height: 1rpx;
		margin: 26rpx 0 20rpx;
		background: linear-gradient(90deg, rgba(216, 176, 140, 0.52), rgba(216, 176, 140, 0.06));
	}

	.gh-hero__perks {
		display: flex;
		align-items: center;
	}

	.gh-perk {
		flex: 1;
	}

	.gh-perk--sep {
		border-left: 1rpx solid rgba(245, 237, 228, 0.14);
		padding-left: 22rpx;
	}

	.gh-perk__num {
		display: block;
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 32rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.gh-perk__lbl {
		display: block;
		margin-top: 4rpx;
		font-size: 19rpx;
		color: rgba(245, 237, 228, 0.50);
	}

	.gh-cta {
		padding: 24rpx 24rpx 20rpx;
		border-radius: 30rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.24);
		background: linear-gradient(135deg, rgba(226, 124, 78, 0.14) 0%, rgba(26, 21, 18, 0.88) 100%);
	}

	.gh-cta__sub {
		display: block;
		margin-top: 14rpx;
		text-align: center;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.gh-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 16rpx;
	}

	.gh-card {
		width: calc(50% - 9rpx);
		box-sizing: border-box;
		padding: 24rpx 22rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.034);
	}

	.gh-card__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 18rpx;
	}

	.gh-card__ic {
		width: 58rpx;
		height: 58rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(216, 176, 140, 0.38);
		background: rgba(216, 176, 140, 0.10);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gh-card__title {
		display: block;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 29rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.gh-card__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 21rpx;
		line-height: 1.58;
		color: rgba(245, 237, 228, 0.48);
	}

	.gh-foot-note {
		display: block;
		margin-top: 28rpx;
		text-align: center;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.34);
	}

	.th-hero__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.th-dayrow {
		display: flex;
		align-items: baseline;
		gap: 16rpx;
		margin-top: 18rpx;
	}

	.th-dayrow__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 124rpx;
		line-height: 0.92;
		font-weight: 500;
		color: #FBF4EA;
		text-shadow: 0 4rpx 30rpx rgba(0, 0, 0, 0.52);
	}

	.th-dayrow__unit {
		font-size: 28rpx;
		letter-spacing: 3rpx;
		color: rgba(245, 237, 228, 0.72);
	}

	.th-hero__rule {
		height: 1rpx;
		margin: 22rpx 0 20rpx;
		background: linear-gradient(90deg, rgba(216, 176, 140, 0.56), rgba(216, 176, 140, 0.06));
	}

	.th-couple {
		display: flex;
		align-items: center;
		gap: 18rpx;
	}

	.th-avs {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.th-ava-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.th-ava-wrap--1 {
		z-index: 2;
	}

	.th-ava-wrap--2 {
		z-index: 1;
		margin-left: -14rpx;
	}

	.th-ava {
		display: block;
		width: 56rpx;
		height: 56rpx;
		flex-shrink: 0;
		box-sizing: border-box;
		border-radius: 50%;
		overflow: hidden;
		border: 2rpx solid rgba(255, 240, 226, 0.52);
		background: #231C18;
	}

	.th-gender {
		position: absolute;
		bottom: -4rpx;
		width: 24rpx;
		height: 24rpx;
		border-radius: 50%;
		border: 2rpx solid #110D0B;
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		z-index: 3;
	}

	.th-gender--l {
		left: -4rpx;
	}

	.th-gender--r {
		right: -4rpx;
	}

	.th-gender--male {
		background: linear-gradient(135deg, #6CB8FF 0%, #4387FF 100%);
	}

	.th-gender--female {
		background: linear-gradient(135deg, #FF94B8 0%, #FF6B95 100%);
	}

	.th-gender__txt {
		font-size: 14rpx;
		font-weight: 700;
		line-height: 1;
		color: #FFFFFF;
	}

	.th-ava--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #6D7C74, #3F4C46);
	}

	.th-ava__txt {
		font-size: 20rpx;
		color: #FFF7EF;
	}

	.th-couple__info {
		flex: 1;
		min-width: 0;
	}

	.th-couple__names {
		display: block;
		font-size: 28rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.th-couple__meta {
		display: block;
		margin-top: 4rpx;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.th-stats {
		display: flex;
		margin-top: 24rpx;
		padding-top: 20rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.08);
	}

	.th-st {
		flex: 1;
		text-align: center;
	}

	.th-st--sep {
		border-left: 1rpx solid rgba(255, 255, 255, 0.08);
	}

	.th-st__val {
		display: block;
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 34rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.th-st__lbl {
		display: block;
		margin-top: 4rpx;
		font-size: 19rpx;
		letter-spacing: 1rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	/* 1. 今日心动 · 签到与任务卡 */
	.th-pulse {
		padding: 24rpx 26rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.24);
		background: linear-gradient(135deg, rgba(226, 100, 63, 0.14), rgba(216, 176, 140, 0.06) 56%, rgba(255, 255, 255, 0.02));
	}

	.th-pulse__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.th-pulse__l {
		flex: 1;
		min-width: 0;
	}

	.th-pulse__kicker {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 2rpx;
		color: #D8B08C;
	}

	.th-pulse__val {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 10rpx;
		margin-top: 8rpx;
	}

	.th-pulse__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 48rpx;
		line-height: 1;
		color: #FBF4EA;
		font-weight: 500;
	}

	.th-pulse__unit {
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.54);
	}

	.th-pulse__delta {
		font-size: 21rpx;
		color: #F09A6B;
	}

	.th-pulse__cta {
		flex-shrink: 0;
		height: 58rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		background: linear-gradient(135deg, #F09A6B 0%, #DE5F3C 100%);
		box-shadow: 0 10rpx 24rpx rgba(222, 95, 60, 0.28);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.th-pulse__cta--done {
		background: rgba(216, 176, 140, 0.14);
		border: 1rpx solid rgba(216, 176, 140, 0.34);
		box-shadow: none;
	}

	.th-pulse__cta-txt {
		font-size: 22rpx;
		font-weight: 500;
		color: #FFF7EF;
		white-space: nowrap;
	}

	.th-pulse__cta--done .th-pulse__cta-txt {
		color: #EAD4BC;
	}

	.th-pulse__bar-row {
		display: flex;
		align-items: center;
		gap: 16rpx;
		margin-top: 18rpx;
		padding-top: 16rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.th-pulse__track {
		flex: 1;
		height: 8rpx;
		border-radius: 4rpx;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.th-pulse__fill {
		height: 100%;
		border-radius: 4rpx;
		background: linear-gradient(90deg, #D8B08C 0%, #E2643F 100%);
	}

	.th-pulse__hint {
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.54);
		white-space: nowrap;
	}

	/* 2. NEXT ANNIVERSARY */
	.th-anniv {
		margin-top: 20rpx;
		padding: 24rpx 26rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(216, 176, 140, 0.24);
		background: linear-gradient(135deg, rgba(226, 124, 78, 0.14), rgba(255, 255, 255, 0.032));
	}

	.th-anniv__main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.th-anniv__l {
		flex: 1;
		min-width: 0;
	}

	.th-anniv__title {
		display: block;
		margin-top: 8rpx;
		font-family: "Songti SC", "SimSun", Georgia, serif;
		font-size: 32rpx;
		font-weight: 600;
		color: #FBF4EA;
	}

	.th-anniv__note {
		display: block;
		margin-top: 6rpx;
		font-size: 22rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.th-anniv__r {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		flex-shrink: 0;
	}

	.th-anniv__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Didot", Georgia, serif;
		font-size: 56rpx;
		line-height: 1;
		color: #E5865C;
	}

	.th-anniv__unit {
		margin-top: 4rpx;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.5);
	}

	.th-anniv__next {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 18rpx;
		padding-top: 14rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.th-anniv__next-l {
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.62);
	}

	.th-anniv__next-r {
		display: flex;
		align-items: center;
		gap: 4rpx;
	}

	.th-anniv__next-days {
		font-size: 21rpx;
		color: #EAD4BC;
	}

	/* SECTION HEADER WITH ICON */
	.th-sec {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16rpx;
		margin: 30rpx 0 16rpx;
	}

	.th-sec__l {
		display: flex;
		align-items: baseline;
		gap: 12rpx;
		min-width: 0;
	}

	.th-sec__title {
		font-size: 26rpx;
		font-weight: 500;
		letter-spacing: 2rpx;
		color: rgba(245, 237, 228, 0.88);
	}

	.th-sec__kicker {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		letter-spacing: 2rpx;
		color: rgba(216, 176, 140, 0.56);
	}

	.th-sec__action {
		display: flex;
		align-items: center;
		gap: 4rpx;
		flex-shrink: 0;
	}

	.th-sec__action-txt {
		font-size: 22rpx;
		color: rgba(216, 176, 140, 0.72);
	}

	/* 3. 5-COL QUICK ENTRY STRIP */
	.th-quick {
		display: flex;
		gap: 12rpx;
	}

	.th-q {
		flex: 1;
		padding: 20rpx 6rpx 18rpx;
		border-radius: 24rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.034);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.th-q__ic {
		width: 58rpx;
		height: 58rpx;
		border-radius: 50%;
		border: 1rpx solid rgba(216, 176, 140, 0.42);
		background: rgba(216, 176, 140, 0.08);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.th-q__glyph {
		font-family: "Songti SC", "SimSun", serif;
		font-size: 24rpx;
		color: #EAD4BC;
	}

	.th-q__lbl {
		margin-top: 12rpx;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.78);
		white-space: nowrap;
	}

	/* 4. 时光胶片 · 最近照片墙 */
	.th-film-grid {
		display: flex;
		gap: 14rpx;
		height: 320rpx;
	}

	.th-film-big {
		position: relative;
		flex: 1.35;
		height: 100%;
		border-radius: 26rpx;
		overflow: hidden;
		border: 1rpx solid rgba(255, 255, 255, 0.09);
		background: #1A1512;
	}

	.th-film-col {
		flex: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 14rpx;
	}

	.th-film-sm {
		position: relative;
		flex: 1;
		border-radius: 22rpx;
		overflow: hidden;
		border: 1rpx solid rgba(255, 255, 255, 0.09);
		background: #1A1512;
	}

	.th-film-sm--add {
		border-style: dashed;
		border-color: rgba(216, 176, 140, 0.28);
		background: rgba(255, 255, 255, 0.025);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6rpx;
	}

	.th-film-add__plus {
		font-size: 30rpx;
		color: #D8B08C;
		line-height: 1;
	}

	.th-film-add__txt {
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.48);
	}

	.th-film-img {
		width: 100%;
		height: 100%;
		display: block;
	}

	.th-film-cap {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 36rpx 20rpx 16rpx;
		background: linear-gradient(180deg, rgba(17, 13, 11, 0), rgba(17, 13, 11, 0.86));
	}

	.th-film-cap__title {
		display: block;
		font-size: 23rpx;
		font-weight: 500;
		color: #FBF4EA;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.th-film-cap__date {
		display: block;
		margin-top: 4rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		color: rgba(216, 176, 140, 0.82);
	}

	.th-film-more {
		position: absolute;
		inset: 0;
		background: rgba(17, 13, 11, 0.58);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.th-film-more__num {
		font-family: "NoirSerifNum", "Bodoni 72", "Georgia", serif;
		font-size: 32rpx;
		color: #FBF4EA;
		font-weight: 500;
	}

	.th-film-more__txt {
		margin-top: 4rpx;
		font-size: 19rpx;
		color: rgba(216, 176, 140, 0.86);
	}

	/* LATEST MOMENT (保持原有样式) */
	.th-moment {
		display: flex;
		align-items: center;
		gap: 20rpx;
		padding: 22rpx 24rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.032);
	}

	.th-moment__img {
		width: 108rpx;
		height: 108rpx;
		border-radius: 18rpx;
		flex-shrink: 0;
	}

	.th-moment__ava {
		width: 84rpx;
		height: 84rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #B96A4C, #7C3E2D);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.th-moment__ava-txt {
		font-family: "Songti SC", serif;
		font-size: 30rpx;
		color: #FFF7EF;
	}

	.th-moment__body {
		flex: 1;
		min-width: 0;
	}

	.th-moment__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.th-moment__name {
		font-size: 26rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.th-moment__time {
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.4);
	}

	.th-moment__txt {
		display: -webkit-box;
		margin-top: 8rpx;
		font-size: 24rpx;
		line-height: 1.6;
		color: rgba(245, 237, 228, 0.64);
		overflow: hidden;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	/* 6. AD */
	.th-ad-wrap {
		margin-top: 24rpx;
		border-radius: 24rpx;
		overflow: hidden;
	}

	/* 7. PLAN PREVIEW */
	.th-plan-row {
		padding: 22rpx 0;
		border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
	}

	.th-plan-row--last {
		border-bottom: none;
	}

	.th-plan-row__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.th-plan-row__title {
		flex: 1;
		min-width: 0;
		font-size: 27rpx;
		font-weight: 500;
		color: #FBF4EA;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.th-plan-row__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 21rpx;
		color: rgba(245, 237, 228, 0.46);
	}

	.th-plan-prog {
		display: flex;
		align-items: center;
		gap: 14rpx;
		margin-top: 14rpx;
	}

	.th-plan-prog__track {
		flex: 1;
		height: 7rpx;
		border-radius: 4rpx;
		background: rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}

	.th-plan-prog__fill {
		height: 100%;
		border-radius: 4rpx;
		background: linear-gradient(90deg, #D8B08C 0%, #F09A6B 100%);
	}

	.th-plan-prog__pct {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		color: #D8B08C;
	}

	/* 8. 今晚玩一局 · 聚会游戏速开 */
	.th-game-resume {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		padding: 20rpx 24rpx;
		margin-bottom: 16rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(226, 100, 63, 0.42);
		background: linear-gradient(135deg, rgba(226, 100, 63, 0.18), rgba(255, 255, 255, 0.03));
	}

	.th-game-resume__l {
		flex: 1;
		min-width: 0;
	}

	.th-game-resume__title {
		display: block;
		font-size: 26rpx;
		font-weight: 500;
		color: #FBF4EA;
	}

	.th-game-resume__desc {
		display: block;
		margin-top: 4rpx;
		font-size: 20rpx;
		color: rgba(245, 237, 228, 0.56);
	}

	.th-game-grid {
		display: flex;
		gap: 14rpx;
	}

	.th-game-tile {
		flex: 1;
		min-width: 0;
		padding: 22rpx 18rpx 20rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.034);
	}

	.th-game-tile--hi {
		border-color: rgba(216, 176, 140, 0.28);
		background: linear-gradient(155deg, rgba(216, 176, 140, 0.11), rgba(255, 255, 255, 0.025));
	}

	.th-game-tile__ic {
		margin-bottom: 14rpx;
	}

	.th-game-tile__title {
		display: block;
		font-size: 25rpx;
		font-weight: 500;
		color: #FBF4EA;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.th-game-tile__sub {
		display: block;
		margin-top: 6rpx;
		font-size: 19rpx;
		color: rgba(245, 237, 228, 0.44);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.th-game-tile__pt {
		display: block;
		margin-top: 12rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 18rpx;
		color: #F09A6B;
	}

	/* 9. 宫格广告 & 页尾手札落款 */
	.th-ad-grid {
		margin-top: 28rpx;
		border-radius: 26rpx;
		overflow: hidden;
	}

	.th-footer-quote {
		margin-top: 40rpx;
		padding: 28rpx 16rpx 8rpx;
		border-top: 1rpx solid rgba(255, 255, 255, 0.055);
		text-align: center;
	}

	.th-footer-quote__txt {
		display: block;
		font-family: "Songti SC", "SimSun", serif;
		font-size: 24rpx;
		letter-spacing: 3rpx;
		color: rgba(245, 237, 228, 0.52);
	}

	.th-footer-quote__sub {
		display: block;
		margin-top: 8rpx;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 17rpx;
		letter-spacing: 4rpx;
		color: rgba(216, 176, 140, 0.36);
	}
</style>
