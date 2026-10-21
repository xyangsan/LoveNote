<template>
	<view
		class="ll-card"
		:class="{
			'll-card--selected': selected,
			'll-card--disabled': disabled,
			'll-card--clickable': clickable,
			'll-card--back': faceDown,
			'll-card--mini': width < 30,
			'll-card--enter-deal': enter === 'deal',
			'll-card--enter-play': enter === 'play',
			'll-card--enter-insert': enter === 'insert'
		}"
		:style="cardStyle"
		@click="handleTap"
	>
		<!-- 牌背：QQ 经典深红菱格纹（双向 45° 细线交叉，纯 CSS 不引图片） -->
		<view v-if="faceDown" class="ll-card__back">
			<view class="ll-card__back-inner">
				<text class="ll-card__back-mark">★</text>
			</view>
		</view>

		<!-- 牌面：QQ 口径 —— 左上角只画点数，花色只在中央。
		     大小王是另一套版式：左侧竖排 JOKER + 右下角小丑图（见 .ll-card__joker） -->
		<template v-else-if="card.isJoker">
			<view class="ll-card__joker">
				<view class="ll-card__joker-rail">
					<text class="ll-card__joker-label" :class="{ 'll-card__joker-label--big': card.isBigJoker }">JOKER</text>
				</view>
				<image class="ll-card__joker-art" :style="jokerArtStyle" :src="jokerArtSrc" mode="aspectFit" />
			</view>
		</template>
		<template v-else>
			<view class="ll-card__corner">
				<text class="ll-card__corner-rank" :style="{ color: card.color }">{{ card.label }}</text>
			</view>
			<view class="ll-card__center">
				<text class="ll-card__center-suit" :style="{ color: card.color }">{{ card.symbol }}</text>
			</view>
		</template>

		<view v-if="badge" class="ll-card__badge">
			<text class="ll-card__badge-text">{{ badge }}</text>
		</view>
	</view>
</template>

<script>
	import { parseCard } from '@/common/game/cards.js'

	/**
	 * 大小王的小丑立绘（180×260 透明 PNG，走 `<image mode="aspectFit">`）。
	 * 只换成 PNG 时**宽高比要跟着改**（见 .ll-card__joker-art 的 em 尺寸），否则 aspectFit 会留白。
	 */
	const JOKER_BLACK_ART = '/static/icons/game/joker-black-180x260.png'
	const JOKER_COLOR_ART = '/static/icons/game/joker-color-180x260.png'
	/** 立绘原始宽高比（180 / 260），用于按牌宽算显示高度 */
	const JOKER_ART_RATIO = 180 / 260

	/**
	 * QQ 三人斗地主风格的扑克牌。
	 *
	 * 与旧 love-playing-card 的区别：
	 *   · 角标只画点数（QQ 的左上角不重复花色，花色都在中央大图）；
	 *   · 牌背换成深红菱格纹（旧的橙红 ♥）；
	 *   · 牌面用中性灰细边、绿色牌桌上投影更深，更「贴桌面」。
	 *
	 * 大小王：**不写「大王 / 小王」中文**，也不画角标 ——
	 *   左侧一条竖排 `JOKER`（旋转 -90°，大王暖红、小王纯黑），右下角放小丑立绘（大王彩色、小王黑白）。
	 *
	 * 横屏页面：宽高传 px，不要传 rpx（rpx 会以屏宽为基准被放大）。
	 */
	export default {
		name: 'LlCard',
		props: {
			cardId: { type: String, default: '' },
			width: { type: Number, default: 56 },
			height: { type: Number, default: 80 },
			faceDown: { type: Boolean, default: false },
			selected: { type: Boolean, default: false },
			disabled: { type: Boolean, default: false },
			clickable: { type: Boolean, default: false },
			badge: { type: String, default: '' },
			/**
			 * 入场动画：'' / 'deal'（发牌飞入）/ 'play'（出牌落到中央）/
			 * 'insert'（底牌并入：从上方落下砸进手牌，带一圈金光）。
			 * ⚠️ CSS animation 只在**节点创建**时播一次，父级要用 `:key` 重建牌堆才能重播；
			 *    'insert' 只给**新创建的**那几张牌用，老牌不要动（见 ll-hand 的 enterOf）。
			 */
			enter: { type: String, default: '' },
			/** 发牌错峰：第 n 张延后 n × enterDelay 步长 */
			enterDelay: { type: Number, default: 0 }
		},
		emits: ['card-tap'],
		computed: {
			card() {
				return parseCard(this.cardId)
			},
			/**
			 * 大小王立绘：小王黑白、大王彩色。
			 * 尺寸由 CSS 按牌宽（em）算，宽度固定后高度 = 宽 / 180 × 260，保证 aspectFit 填满不留白。
			 */
			jokerArtSrc() {
				return this.card.isBigJoker ? JOKER_COLOR_ART : JOKER_BLACK_ART
			},
			/** 立绘的显示尺寸（em，基准 = 牌宽），height 按原始宽高比推出来 */
			jokerArtStyle() {
				const widthEm = this.width < 30 ? 0.9 : 0.8
				return {
					width: `${widthEm}em`,
					height: `${widthEm / JOKER_ART_RATIO}em`
				}
			},
			cardStyle() {
				const style = {
					width: `${this.width}px`,
					height: `${this.height}px`,
					borderRadius: `${Math.max(5, Math.round(this.width * 0.12))}px`,
					// 牌面内的图标 / 字号一律用 em，基准就是牌宽 → 24/34/48 三种尺寸自动等比缩放
					fontSize: `${this.width}px`
				}
				if (this.enter && this.enterDelay) {
					style.animationDelay = `${this.enterDelay}ms`
				}
				return style
			}
		},
		methods: {
			handleTap() {
				if (!this.clickable || this.disabled) {
					return
				}
				this.$emit('card-tap', this.cardId)
			}
		}
	}
</script>

<style>
	/* QQ 牌面：纯白底 + 中性灰细边，绿色牌桌上投影要压得深一点才「贴桌面」 */
	.ll-card {
		position: relative;
		flex-shrink: 0;
		box-sizing: border-box;
		background: #ffffff;
		border: 1px solid rgba(128, 122, 112, 0.4);
		box-shadow: 0 2px 5px rgba(18, 46, 30, 0.28);
		overflow: hidden;
		/* 回弹曲线：选牌弹起时带一点过冲，比线性更像实体牌 */
		transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease;
	}

	.ll-card--clickable {
		cursor: pointer;
	}

	/* 选中态：**只做视觉**（亮橙描边 + 更深的阴影）。
	   注意：位移（上浮 12px）不在这里 —— 本组件发牌动画用了 `animation: ... both`，
	   动画最终帧的 transform 会持续覆盖普通样式，写在这儿的 translateY 不会生效。
	   位移与过渡由父级 `.ll-hand__item` 负责（见 ll-hand.vue 的 itemStyle）。 */
	.ll-card--selected {
		box-shadow: 0 10px 18px rgba(16, 60, 34, 0.4);
		border-color: #ffb84d;
	}

	/* 不可选 / 非自己回合：盖一层灰色蒙版，**不要用 opacity** ——
	   半透明会让底下的桌面透上来、牌面发脏，叠牌时相邻牌还会互相透色 */
	.ll-card--disabled::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(48, 58, 52, 0.42);
		pointer-events: none;
	}

	/* ⚠️ 这里**没有** dimmed（半透明压暗）—— 桌上每一手牌都是要读的信息，
	   压暗会让牌面透出桌面底色、叠牌互相透色。左右两家出的牌一律满色显示。 */

	/* ---------------- 入场动画（节点创建时播一次） ---------------- */
	.ll-card--enter-deal {
		animation: ll-card-deal-in 360ms cubic-bezier(0.22, 1.2, 0.36, 1) both;
	}

	.ll-card--enter-play {
		animation: ll-card-play-in 300ms cubic-bezier(0.22, 1.3, 0.36, 1) both;
	}

	/* 底牌并入：从上方（底牌盘方向）落下来砸进手牌，末尾带一点回弹；
	   同时跑一圈金色光晕，提示「这是刚摸到的底牌」。
	   ⚠️ 两条 animation 分别只动 transform/opacity 与 box-shadow，互不打架。 */
	.ll-card--enter-insert {
		animation:
			ll-card-insert-in 420ms cubic-bezier(0.22, 1.15, 0.36, 1) both,
			ll-card-insert-glow 900ms ease-out both;
	}

	@keyframes ll-card-insert-in {
		from {
			transform: translateY(-84px) scale(0.56) rotate(-8deg);
			opacity: 0;
		}
		55% {
			transform: translateY(6px) scale(1.05) rotate(1deg);
			opacity: 1;
		}
		to {
			transform: translateY(0) scale(1) rotate(0deg);
			opacity: 1;
		}
	}

	@keyframes ll-card-insert-glow {
		from {
			box-shadow: 0 0 0 0 rgba(255, 196, 92, 0.9), 0 2px 5px rgba(18, 46, 30, 0.28);
		}
		70% {
			box-shadow: 0 0 0 6px rgba(255, 196, 92, 0.35), 0 2px 5px rgba(18, 46, 30, 0.28);
		}
		to {
			box-shadow: 0 0 0 7px rgba(255, 196, 92, 0), 0 2px 5px rgba(18, 46, 30, 0.28);
		}
	}

	@keyframes ll-card-deal-in {
		from {
			transform: translate(-70px, -160px) scale(0.5) rotate(-16deg);
			opacity: 0;
		}
		70% { opacity: 1; }
		to {
			transform: translate(0, 0) scale(1) rotate(0deg);
			opacity: 1;
		}
	}

	@keyframes ll-card-play-in {
		from {
			transform: translateY(-44px) scale(0.7);
			opacity: 0;
		}
		62% {
			transform: translateY(5px) scale(1.05);
			opacity: 1;
		}
		to {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}

	/* 左上角角标：QQ 只画数字（花色在中央）；大小王画「J」（英文，不写中文大/小） */
	.ll-card__corner {
		position: absolute;
		top: 3px;
		left: 4px;
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}

	.ll-card__corner-rank {
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
	}

	.ll-card__center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -42%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ll-card__center-suit {
		/* 一律 em（基准 = 牌宽）：30px 的对手牌上 22px 太大，会顶满整个牌面、
		   叠牌时还容易被右边的牌盖掉半个花色。0.44em ≈ 13px(30) / 20px(46) / 25px(56)。 */
		font-size: 0.44em;
		line-height: 1;
	}

	/* ---------------- 大小王：左侧竖排 JOKER + 右下角立绘 ----------------
	   尺寸一律 em（基准 = 牌宽，见 cardStyle 的 fontSize），
	   手牌 48 / 中央 46 / 别人出牌 34 / 底牌盘 24 自动等比缩放。 */
	.ll-card__joker {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		overflow: hidden;
	}

	/* 左侧竖条：JOKER 一列字母**从顶部往下排**（跟左上角点数同一视觉起点），不做垂直居中 */
	.ll-card__joker-rail {
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		/* 一个字母（0.17em 字号）要放得下，同时不能压到右下角的立绘（立绘从 0.97em 处起） */
		width: 0.17em;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		/* 顶部留一点，别让 J 贴着牌边（0.06em ≈ 48px 牌上的 3px） */
		padding-top: 0.06em;
		box-sizing: border-box;
	}

	.ll-card__joker-label {
		width: 100%;
		/* ⚠️ 「JOKER」是一个词、没有断行点：`white-space` 的合法值只有 normal/nowrap/pre/pre-wrap/
		   pre-line/break-spaces（写 wrap 是无效声明，会被整条丢掉），单靠 white-space 永远竖不起来。
		   要逐字母竖排必须 `word-break: break-all`，再加 text-align/line-height 让它一列居中。 */
		word-break: break-all;
		white-space: normal;
		text-align: center;
		font-size: 0.17em;
		font-weight: 800;
		line-height: 1.05;
		color: #241d1a;
	}

	/* 大王：文字走暖红，配合彩色立绘；小王保持纯黑 */
	.ll-card__joker-label--big {
		color: #c8402f;
	}

	/* 立绘锚在右下角；宽高由 jokerArtStyle 按 180×260 的比例算，aspectFit 刚好填满不留白 */
	.ll-card__joker-art {
		position: absolute;
		right: 0.02em;
		bottom: 0.02em;
	}

	/* 底牌盘那种 24px 的小牌：竖排英文只有 ~3px 会糊成一个点，直接去掉，立绘放大补位 */
	.ll-card--mini .ll-card__joker-rail {
		display: none;
	}

	.ll-card__badge {
		position: absolute;
		right: 2px;
		bottom: 2px;
		padding: 1px 4px;
		border-radius: 999px;
		background: #f5a623;
	}

	.ll-card__badge-text {
		font-size: 8px;
		color: #ffffff;
	}

	/* QQ 牌背：深红底 + 双向 45° 细线交叉出菱格 + 米白内框 + 中央星徽 */
	.ll-card__back {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #c43a30 0%, #a3241d 100%);
	}

	.ll-card__back-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 70%;
		height: 78%;
		border-radius: 4px;
		border: 1px solid rgba(255, 224, 170, 0.75);
		background:
			repeating-linear-gradient(45deg, rgba(255, 226, 170, 0.18) 0 2px, rgba(255, 226, 170, 0) 2px 6px),
			repeating-linear-gradient(-45deg, rgba(255, 226, 170, 0.18) 0 2px, rgba(255, 226, 170, 0) 2px 6px),
			linear-gradient(180deg, #b53027 0%, #9c221b 100%);
	}

	.ll-card__back-mark {
		font-size: 14px;
		color: rgba(255, 238, 205, 0.95);
		text-shadow: 0 1px 2px rgba(90, 10, 5, 0.6);
	}
</style>
