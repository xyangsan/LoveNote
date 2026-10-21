<template>
	<view
		class="ll-seat"
		:class="[
			'll-seat--' + size,
			roleClass,
			{
				'll-seat--offline': !online,
				'll-seat--current': isCurrent
			}
		]"
	>
		<view v-if="bubbleText" class="ll-seat__bubble">
			<text class="ll-seat__bubble-text">{{ bubbleText }}</text>
		</view>

		<!-- 人物身体（圆头 + 圆角肩），QQ 风格的「布衫」配色 -->
		<view class="ll-seat__body" :style="{ background: bodyGradient }">
			<view class="ll-seat__head">
				<image
					v-if="avatarUrl"
					class="ll-seat__avatar-img"
					:src="avatarUrl"
					mode="aspectFill"
				></image>
				<text v-else class="ll-seat__avatar-text">{{ shortName }}</text>
			</view>

			<!-- 身份牌：**悬浮在头像右下角**（QQ 的口径）。
			     不能塞进 __head —— 那是圆形 + overflow:hidden，牌子会被裁掉；
			     挂 __body（position: relative）上，用 % 定位，normal / small 两档尺寸都自动对齐。 -->
			<text
				v-if="roleTagText"
				class="ll-seat__role-tag"
				:class="'ll-seat__role-tag--' + role"
			>{{ roleTagText }}</text>

			<!-- 角标：自身零尺寸（不挤压居中的头像），只靠 left/top 偏移挪到右上角外沿，
			     每个 emoji 再 absolute 定位、从右往左排开。偏移与 __head/__body 写死尺寸配套。 -->
			<view v-if="badges.length" class="ll-seat__badges">
				<text
					v-for="(badge, index) in badges"
					:key="badge.key"
					class="ll-seat__badge"
					:style="badgeStyle(index)"
				>{{ badge.icon }}</text>
			</view>
		</view>

		<!-- 昵称行 -->
		<view class="ll-seat__meta">
			<text class="ll-seat__name">{{ displayName }}</text>
		</view>

		<!-- 状态位：昵称正下方（＝头像下方）。
		     等开局时显示「已准备 / 未准备」，对局中让位给「剩 N 张」。
		     两行互斥（showReady 由页面按 waiting 判断），高度一致，切换时不跳。 -->
		<view v-if="readyStateText" class="ll-seat__ready" :class="{ 'll-seat__ready--on': ready }">
			<text class="ll-seat__ready-text">{{ readyStateText }}</text>
		</view>

		<view v-if="showCardsLeft" class="ll-seat__cards">
			<text class="ll-seat__cards-text">剩 {{ cardsLeft }} 张</text>
		</view>
	</view>
</template>

<script>
	/**
	 * QQ 三人斗地主的席位组件（人物 + 身份牌 + 角标 + 牌数气泡）。
	 *
	 * 与旧 love-player-figure 的区别：
	 *   · 身份用**悬浮在头像右下角**的文字牌区分（地主金底深字 / 农民青绿底白字），不只靠角标；
	 *   · 地主头像额外加金色描边 + 金色光晕，扫一眼就知道打谁；
	 *   · 角标直接用 emoji（👑地主 🌾农民 🤖机器人 🕹️托管 💤掉线托管），不再依赖 love-game-icon；
	 *   · 「布衫」配色按座位 index 切换，QQ 经典三色布衣。
	 *
	 * ⚠️ 文字牌只在 role ∈ {landlord, farmer} 时显示 —— 卧底页的身份保密靠图标，不加文字。
	 */
	const BODY_GRADIENTS = [
		'linear-gradient(165deg, #8fb9e6 0%, #4d7fb8 100%)',
		'linear-gradient(165deg, #a9d59a 0%, #5f9e57 100%)',
		'linear-gradient(165deg, #e0b07d 0%, #b57f4a 100%)'
	]

	const ROLE_TAG_TEXT = {
		landlord: '地主',
		farmer: '农民'
	}

	/** 角标图标 + 顺序（从右往左）：身份 → 机器人 → 托管 */
	const BADGE_ICON = {
		landlord: '👑',
		farmer: '🌾',
		robot: '🤖',
		trustee: '🕹️',
		trustee_offline: '💤'
	}

	const BADGE_ICON_SIZE_NORMAL = 14
	const BADGE_ICON_SIZE_SMALL = 12
	/** 相邻角标的横向步长：图标盒 + padding/border + 2px 空隙 */
	const BADGE_GAP = 8

	export default {
		name: 'LlSeat',
		props: {
			nickname: { type: String, default: '' },
			avatarUrl: { type: String, default: '' },
			/** landlord / farmer / undercover / civilian / '' */
			role: { type: String, default: '' },
			seatIndex: { type: Number, default: 0 },
			cardsLeft: { type: Number, default: 0 },
			showCardsLeft: { type: Boolean, default: true },
			/** 是否已点「准备」（等开局阶段才有意义） */
			ready: { type: Boolean, default: false },
			/**
			 * 是否在昵称下方显示「已准备 / 未准备」状态位。
			 * 页面只在 `room.status === 'waiting'` 时传 true；房主（不需要准备）与机器人不传。
			 */
			showReady: { type: Boolean, default: false },
			isRobot: { type: Boolean, default: false },
			isTrustee: { type: Boolean, default: false },
			trusteeAuto: { type: Boolean, default: false },
			online: { type: Boolean, default: true },
			isCurrent: { type: Boolean, default: false },
			bubbleText: { type: String, default: '' },
			size: { type: String, default: 'normal' }
		},
		computed: {
			shortName() {
				const name = String(this.nickname || '').trim()
				return name ? name.slice(0, 1) : '玩'
			},
			displayName() {
				const name = String(this.nickname || '').trim() || '玩家'
				return name.length <= 6 ? name : `${name.slice(0, 6)}…`
			},
			bodyGradient() {
				const index = Math.abs(Number(this.seatIndex) || 0) % BODY_GRADIENTS.length
				return BODY_GRADIENTS[index]
			},
			/** 身份 class：地主金框，农民普通框。 */
			roleClass() {
				return ROLE_TAG_TEXT[this.role] ? `ll-seat--${this.role}` : ''
			},
			roleTagText() {
				return ROLE_TAG_TEXT[this.role] || ''
			},
			/** 状态位文案：只有显式要求显示时才给，避免对局中被「未准备」占位 */
			readyStateText() {
				if (!this.showReady) {
					return ''
				}
				return this.ready ? '已准备' : '未准备'
			},
			badgeIconSize() {
				return this.size === 'small' ? BADGE_ICON_SIZE_SMALL : BADGE_ICON_SIZE_NORMAL
			},
			/**
			 * 角标数组：身份 → 机器人 → 托管（顺序 = 从右往左的显示顺序）
			 */
			badges() {
				const list = []
				// if (this.role && BADGE_ICON[this.role]) {
				// 	list.push({ key: 'role', icon: BADGE_ICON[this.role] })
				// }
				// if (this.isRobot) {
				// 	list.push({ key: 'robot', icon: BADGE_ICON.robot })
				// }
				if (this.isTrustee) {
					const type = this.trusteeAuto ? 'trustee_offline' : 'trustee'
					list.push({ key: type, icon: BADGE_ICON[type] })
				}
				return list
			}
		},
		methods: {
			/** 图标相对容器绝对定位排开：index 越大越靠左 */
			badgeStyle(index) {
				return {
					right: `${index * (this.badgeIconSize + BADGE_GAP)}px`,
					fontSize: `${this.badgeIconSize}px`
				}
			}
		}
	}
</script>

<style>
	.ll-seat {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.ll-seat--offline {
		opacity: 0.6;
		filter: grayscale(0.8);
	}

	.ll-seat__body {
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		width: 72px;
		height: 62px;
		padding-top: 5px;
		border-radius: 36px 36px 14px 14px;
		box-shadow: 0 6px 14px rgba(12, 36, 22, 0.4);
	}

	.ll-seat--small .ll-seat__body {
		width: 56px;
		height: 50px;
		border-radius: 28px 28px 12px 12px;
	}

	.ll-seat__head {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: #fffaf2;
		border: 2px solid rgba(255, 255, 255, 0.85);
		overflow: hidden;
	}

	.ll-seat--small .ll-seat__head {
		width: 32px;
		height: 32px;
	}

	/* ---------------- 身份区分（QQ 三人斗地主口径） ----------------
	   地主：金色头像框 + 金色光晕 —— 全桌唯一；
	   农民：保持白框。 */
	.ll-seat--landlord .ll-seat__head {
		border: 2px solid #ffd166;
		box-shadow: 0 0 0 2px rgba(255, 209, 102, 0.38);
	}

	.ll-seat__avatar-img {
		width: 100%;
		height: 100%;
	}

	.ll-seat__avatar-text {
		font-size: 17px;
		font-weight: 700;
		color: #7a4a33;
	}

	.ll-seat--current .ll-seat__body {
		box-shadow: 0 0 0 2px #ffe9a8, 0 6px 14px rgba(12, 36, 22, 0.44);
	}

	/* ---------------- 角标：相对布局的容器 + 绝对定位的 emoji ---------------- */
	.ll-seat__badges {
		position: relative;
		align-self: flex-start;
		width: 0;
		height: 0;
		/* 配套 __head(40/32) + __body(72/56) + 角标盒(20/18) */
		left: 18px;
		top: -12px;
		z-index: 3;
	}

	.ll-seat--small .ll-seat__badges {
		left: 14px;
		top: -10px;
	}

	.ll-seat__badge {
		position: absolute;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 2px 6px rgba(12, 36, 22, 0.32);
		line-height: 1;
	}

	/* 昵称行（身份牌已挪到头像右下角，这里只剩名字） */
	.ll-seat__meta {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		margin-top: 6px;
	}

	/* 身份牌：悬浮在头像右下角。
	   right/bottom 用 %（相对 __body）：normal(72×62) 与 small(56×50) 两档都能
	   刚好落在 __head（40 / 32，居中贴顶）的右下角；再 translate 出去一点，
	   看起来像别在头像边上，而不是压在头像里。 */
	.ll-seat__role-tag {
		position: absolute;
		right: 22%;
		bottom: 27%;
		z-index: 3;
		transform: translate(30%, 30%);
		padding: 1px 5px;
		border-radius: 4px;
		font-size: 9px;
		font-weight: 700;
		line-height: 1.4;
		white-space: nowrap;
	}

	/* 地主：金底深棕字；农民：青绿底白字 —— 一眼分阵营 */
	.ll-seat__role-tag--landlord {
		background: linear-gradient(180deg, #ffd873 0%, #f5a623 100%);
		color: #5a3a10;
		box-shadow: 0 1px 3px rgba(60, 40, 5, 0.4);
	}

	.ll-seat__role-tag--farmer {
		background: linear-gradient(180deg, #6cb87a 0%, #3f8a56 100%);
		color: #f4fff4;
		box-shadow: 0 1px 3px rgba(10, 40, 18, 0.4);
	}

	.ll-seat__name {
		font-size: 12px;
		font-weight: 600;
		color: #fff6ef;
		text-shadow: 0 1px 3px rgba(8, 30, 18, 0.6);
	}

	/* 状态位：昵称正下方 / 头像正下方的那一行。
	   与「剩 N 张」同高同宽口径，两个状态互斥切换时座位整体高度不变。 */
	.ll-seat__ready {
		margin-top: 4px;
		padding: 2px 9px;
		border-radius: 999px;
		background: rgba(12, 40, 26, 0.46);
		border: 1px solid rgba(255, 255, 255, 0.22);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* 已准备：亮绿底 + 白字，扫一眼就知道谁卡着不开局 */
	.ll-seat__ready--on {
		background: linear-gradient(180deg, #6fd08a 0%, #3f9e5c 100%);
		border-color: rgba(255, 255, 255, 0.6);
		box-shadow: 0 2px 6px rgba(10, 46, 24, 0.36);
	}

	.ll-seat__ready-text {
		font-size: 10px;
		font-weight: 700;
		line-height: 1.3;
		color: #f4fff6;
		white-space: nowrap;
	}

	.ll-seat__cards {
		margin-top: 4px;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(16, 44, 30, 0.6);
		display: flex;
		align-items: center;
	}

	.ll-seat__cards-text {
		font-size: 10px;
		color: #f6efe8;
	}

	.ll-seat__bubble {
		position: absolute;
		top: -26px;
		min-width: 44px;
		max-width: 140px;
		padding: 4px 10px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 4px 10px rgba(12, 36, 22, 0.3);
	}

	.ll-seat__bubble-text {
		font-size: 11px;
		color: #5d372b;
	}
</style>
