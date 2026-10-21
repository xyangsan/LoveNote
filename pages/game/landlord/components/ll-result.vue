<template>
	<!-- ⚠️ `show && result` 两个条件都要：result 为空时（新局已经开始 / 快照还没到）绝不能渲染，
	     否则会显示一个「本局结束 / 底分1·炸弹0·倍数1 / 玩家列表空白」的空壳弹框。
	     页面侧也会在 phase 离开 settled 时把 show 置 false，这里是第二道保险。 -->
	<view v-if="show && result" class="ll-result">
		<view class="ll-result__mask" @click="handleMask"></view>
		<view class="ll-result__panel" :class="'ll-result__panel--' + tone">
			<!-- 右上角圆形关闭：关掉弹框后回到底部工具栏（那里有「再来一局 / 解散房间」） -->
			<view class="ll-result__close" @click="handleClose">
				<text class="ll-result__close-icon">×</text>
			</view>

			<!-- 顶部：大字标题 + emoji。
			     QQ 斗地主：胜利金、失败蓝；本组件按 tone 切换头部配色。 -->
			<view class="ll-result__hero">
				<text class="ll-result__emoji">{{ emoji }}</text>
				<text class="ll-result__title">{{ title }}</text>
			</view>

			<!-- 倍数信息行：底分 · 炸弹 · 倍数 ·（春天/反春天 标签）。
			     一次性显示，不滚 —— 横屏 375px 高度紧凑布局装得下。 -->
			<view class="ll-result__multiplier">
				<text class="ll-result__multiplier-text">
					底分 {{ baseScore }} · 炸弹 {{ bombCount }} · 倍数 {{ multiplier }}
				</text>
				<text v-if="springTag" class="ll-result__spring" :class="'ll-result__spring--' + springTag">{{ springLabel }}</text>
			</view>

			<!-- 3 人横排：地主居中 + 金框，农民两侧。
			     每人一列：头像 + 昵称 + 身份牌 + 本局得分 + 累计积分。 -->
			<view class="ll-result__players">
				<view
					v-for="item in orderedPlayers"
					:key="item.seatIndex"
					class="ll-result__player"
					:class="{
						'll-result__player--landlord': item.isLandlord,
						'll-result__player--self': item.isSelf,
						'll-result__player--win': item.result === 'win',
						'll-result__player--lose': item.result === 'lose'
					}"
				>
					<!-- 身份牌悬浮在头像右下角：外圈包一层定位容器，
					     不能直接塞进 .ll-result__avatar（它 overflow:hidden 会把牌裁掉） -->
					<view class="ll-result__avatar-wrap">
						<view class="ll-result__avatar">
							<image v-if="item.avatarUrl" class="ll-result__avatar-img" :src="item.avatarUrl" mode="aspectFill"></image>
							<text v-else class="ll-result__avatar-text">{{ shortName(item.nickname) }}</text>
						</view>
						<text class="ll-result__role-tag" :class="'ll-result__role-tag--' + (item.isLandlord ? 'landlord' : 'farmer')">
							{{ item.isLandlord ? '地主' : '农民' }}
						</text>
					</view>
					<text class="ll-result__name">{{ item.nickname || '玩家' }}<text v-if="item.isSelf" class="ll-result__self-flag">（我）</text></text>
					<text
						class="ll-result__score-delta"
						:class="'ll-result__score-delta--' + (item.result === 'win' ? 'win' : 'lose')"
					>{{ item.scoreDelta > 0 ? '+' + item.scoreDelta : String(item.scoreDelta) }}</text>
					<text class="ll-result__total">累计 {{ item.totalScore }}</text>
				</view>
			</view>

			<!-- 底部按钮：返回大厅（ghost）+ 再来一局（primary，仅房主可点） -->
			<view class="ll-result__actions">
				<view class="ll-result__action ll-result__action--ghost" @click="handleSecondary">
					<text class="ll-result__action-text ll-result__action-text--ghost">{{ secondaryText }}</text>
				</view>
				<view
					class="ll-result__action ll-result__action--primary"
					:class="{ 'll-result__action--disabled': !canRematch }"
					@click="handlePrimary"
				>
					<text class="ll-result__action-text">{{ canRematch ? primaryText : '等房主开下一局' }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	/**
	 * 斗地主横屏结算弹框（独立于通用 love-game-result-dialog）。
	 *
	 * 与通用版的区别：
	 *   · **一次性完整显示，不滚** —— 横屏 375px 高度紧凑布局装得下标题 + 倍数行 + 3 人横排 + 按钮，
	 *     不用 scroll-view（QQ 斗地主结算也是一屏看完，不滚）；
	 *   · 3 人横排、地主居中金框、农民两侧 —— 阵营一眼分清；
	 *   · 显示本局得分 + 累计积分（QQ 口径）；
	 *   · 倍数行带「春天 / 反春天」标签（由 multiplier / 2^bombCount 反推）；
	 *   · 全 px 尺寸（横屏 rpx 会撑爆）。
	 *
	 * props 直接收 room.vue 已有的 result 对象 + room.seats，组件内部自己组装玩家列表，
	 * 调用方不用再算 resultPlayers。
	 */
	export default {
		name: 'LlResult',
		props: {
			show: { type: Boolean, default: false },
			/** result 对象（来自 room.result，服务端 buildResult 下发） */
			result: { type: Object, default: null },
			/** 房间 seats，用于显示昵称/头像/累计积分 */
			seats: { type: Array, default: () => [] },
			/** 我的座位号，用于标「（我）」 */
			mySeat: { type: Number, default: -1 },
			/** 是否房主（决定「再来一局」按钮可点） */
			isHost: { type: Boolean, default: false },
			primaryText: { type: String, default: '再来一局' },
			secondaryText: { type: String, default: '返回大厅' },
			maskClosable: { type: Boolean, default: false }
		},
		emits: ['close', 'primary', 'secondary'],
		computed: {
			tone() {
				if (!this.result) {
					return 'fail'
				}
				return this.result.iWin ? 'win' : 'lose'
			},
			emoji() {
				return this.result && this.result.iWin ? '🎉' : '😵'
			},
			title() {
				if (!this.result) {
					return '本局结束'
				}
				return this.result.iWin ? '胜利' : '失败'
			},
			baseScore() {
				return Number(this.result && this.result.baseScore) || 1
			},
			multiplier() {
				return Number(this.result && this.result.multiplier) || 1
			},
			bombCount() {
				return Number(this.result && this.result.bombCount) || 0
			},
			/**
			 * 春天 / 反春天：multiplier = 2^bombCount × (春天?2:1)，
			 * 所以 extraMul = multiplier / 2^bombCount，>1 即有春天。
			 * 春天（地主赢 + 农民一张没出）/ 反春天（农民赢 + 地主只出过 ≤1 手）由 winnerCamp 区分。
			 */
			springTag() {
				if (!this.result) {
					return ''
				}
				const bombMul = Math.pow(2, this.bombCount)
				const extraMul = bombMul > 0 ? this.multiplier / bombMul : 1
				if (extraMul <= 1) {
					return ''
				}
				return this.result.winnerCamp === 'landlord' ? 'spring' : 'anti-spring'
			},
			springLabel() {
				if (this.springTag === 'spring') {
					return '春天'
				}
				if (this.springTag === 'anti-spring') {
					return '反春天'
				}
				return ''
			},
			/**
			 * 3 人横排，地主居中：按 [农民A, 地主, 农民B] 排。
			 * 服务端 seats 顺序是 seatIndex 升序，这里重排让地主居中。
			 */
			orderedPlayers() {
				if (!this.result || !Array.isArray(this.seats) || !this.seats.length) {
					return []
				}
				const scoreDelta = this.result.scoreDelta || {}
				const landlordSeat = Number(this.result.landlordSeat)
				const winnerCamp = this.result.winnerCamp || ''

				const players = this.seats.map((seat) => {
					const seatIndex = Number(seat.seatIndex)
					const isLandlord = seatIndex === landlordSeat
					const delta = Number(scoreDelta[String(seatIndex)] || 0)
					const win = isLandlord
						? winnerCamp === 'landlord'
						: winnerCamp === 'farmer'
					return {
						seatIndex,
						nickname: seat.nickname || '',
						avatarUrl: seat.avatarUrl || '',
						isLandlord,
						scoreDelta: delta,
						totalScore: Number(seat.score || 0),
						result: win ? 'win' : 'lose',
						isSelf: seatIndex === this.mySeat
					}
				})

				const landlord = players.find((item) => item.isLandlord)
				const farmers = players.filter((item) => !item.isLandlord)
				// 不足 3 人时也按 [农民..., 地主, 农民...] 居中排
				const leftFarmers = farmers.slice(0, Math.ceil(farmers.length / 2))
				const rightFarmers = farmers.slice(Math.ceil(farmers.length / 2))
				return [...leftFarmers, ...(landlord ? [landlord] : []), ...rightFarmers]
			},
			canRematch() {
				return this.isHost
			}
		},
		methods: {
			shortName(name = '') {
				const text = String(name || '').trim()
				return text ? text.slice(0, 1) : '玩'
			},
			handleMask() {
				if (this.maskClosable) {
					this.$emit('close')
				}
			},
			/** 右上角 × ：始终可关（关掉后底栏工具栏仍有「再来一局 / 解散房间」） */
			handleClose() {
				this.$emit('close')
			},
			handlePrimary() {
				if (!this.canRematch) {
					return
				}
				this.$emit('primary')
			},
			handleSecondary() {
				this.$emit('secondary')
			}
		}
	}
</script>

<style>
	/* 横屏页面：全 px，不用 rpx */
	.ll-result {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1500;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ll-result__mask {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(8, 30, 18, 0.6);
	}

	.ll-result__panel {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: 560px;
		max-width: 92vw;
		/* 一次性完整显示：不设 max-height，让内容撑开（横屏 ~375px 高度刚好装下） */
		padding: 0 18px 14px;
		border-radius: 18px;
		background: linear-gradient(180deg, #fffdf8 0%, #fff5ec 100%);
		box-shadow: 0 14px 32px rgba(0, 0, 0, 0.32);
		overflow: hidden;
	}

	/* 右上角圆形关闭：压在半透明圆底上，任何背景（金/蓝头部）都能看清 */
	.ll-result__close {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(90, 58, 16, 0.12);
	}

	.ll-result__close-icon {
		font-size: 18px;
		line-height: 1;
		font-weight: 700;
		color: #8b6659;
	}

	/* 头部配色按胜负切换：胜利金、失败蓝（QQ 斗地主口径） */
	.ll-result__hero {
		padding: 14px 0 10px;
		text-align: center;
	}

	.ll-result__panel--win .ll-result__hero {
		background: linear-gradient(180deg, rgba(255, 215, 110, 0.18) 0%, rgba(255, 215, 110, 0) 100%);
	}

	.ll-result__panel--lose .ll-result__hero {
		background: linear-gradient(180deg, rgba(120, 150, 200, 0.18) 0%, rgba(120, 150, 200, 0) 100%);
	}

	.ll-result__emoji {
		display: block;
		font-size: 28px;
		line-height: 1;
	}

	.ll-result__title {
		display: block;
		margin-top: 6px;
		font-size: 20px;
		font-weight: 700;
		letter-spacing: 2px;
	}

	.ll-result__panel--win .ll-result__title {
		color: #c0801a;
	}

	.ll-result__panel--lose .ll-result__title {
		color: #4a6a8e;
	}

	/* 倍数信息行：一行紧凑显示底分 / 炸弹 / 倍数 + 春天标签 */
	.ll-result__multiplier {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 6px 10px;
		margin: 0 4px;
		border-radius: 10px;
		background: rgba(255, 240, 224, 0.7);
	}

	.ll-result__multiplier-text {
		font-size: 12px;
		font-weight: 600;
		color: #8b5a3a;
	}

	.ll-result__spring {
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 700;
		line-height: 1.4;
	}

	.ll-result__spring--spring {
		background: linear-gradient(180deg, #ffd873 0%, #f5a623 100%);
		color: #5a3a10;
	}

	.ll-result__spring--anti-spring {
		background: linear-gradient(180deg, #7fb0d8 0%, #4d7fb8 100%);
		color: #fff;
	}

	/* 3 人横排：地主居中 + 金框，农民两侧 */
	.ll-result__players {
		display: flex;
		align-items: stretch;
		justify-content: center;
		gap: 8px;
		margin-top: 10px;
		padding: 8px 4px;
	}

	.ll-result__player {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 8px 4px;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.7);
	}

	.ll-result__player--landlord {
		background: linear-gradient(180deg, rgba(255, 220, 130, 0.32) 0%, rgba(255, 220, 130, 0.12) 100%);
		border: 1px solid rgba(245, 166, 35, 0.5);
	}

	.ll-result__player--self {
		box-shadow: 0 0 0 2px rgba(255, 209, 102, 0.4);
	}

	.ll-result__player--win .ll-result__avatar {
		border-color: #e76f51;
	}

	/* 输的一方压暗：作用在「头像 + 身份牌」整体上，否则牌还是满色、头像发灰，看着像没对齐 */
	.ll-result__player--lose .ll-result__avatar-wrap {
		opacity: 0.72;
	}

	/* 头像 + 身份牌的整体容器：身份牌要绝对定位到头像右下角，所以必须有个非 overflow:hidden 的父级 */
	.ll-result__avatar-wrap {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ll-result__avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: linear-gradient(135deg, #ffb37a 0%, #e76f51 100%);
		border: 2px solid rgba(255, 255, 255, 0.85);
		overflow: hidden;
	}

	.ll-result__player--landlord .ll-result__avatar {
		border-color: #ffd166;
		box-shadow: 0 0 0 2px rgba(255, 209, 102, 0.38);
	}

	.ll-result__avatar-img {
		width: 100%;
		height: 100%;
	}

	.ll-result__avatar-text {
		font-size: 14px;
		font-weight: 700;
		color: #fff;
	}

	/* 悬浮在头像右下角（压住一点边沿，像徽章）—— 白描边 + 投影保证压在头像上也读得清 */
	.ll-result__role-tag {
		position: absolute;
		right: -10px;
		bottom: -3px;
		z-index: 2;
		padding: 0 5px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 700;
		line-height: 1.5;
		white-space: nowrap;
		box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.92), 0 2px 4px rgba(90, 50, 30, 0.3);
	}

	.ll-result__role-tag--landlord {
		background: linear-gradient(180deg, #ffd873 0%, #f5a623 100%);
		color: #5a3a10;
	}

	.ll-result__role-tag--farmer {
		background: linear-gradient(180deg, #6cb87a 0%, #3f8a56 100%);
		color: #f4fff4;
	}

	.ll-result__name {
		font-size: 12px;
		font-weight: 600;
		color: #5d372b;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ll-result__self-flag {
		font-size: 10px;
		font-weight: 400;
		color: #b8604c;
	}

	.ll-result__score-delta {
		font-size: 16px;
		font-weight: 700;
		margin-top: 2px;
	}

	.ll-result__score-delta--win {
		color: #c0674d;
	}

	.ll-result__score-delta--lose {
		color: #7f9b8e;
	}

	.ll-result__total {
		font-size: 10px;
		color: #917165;
	}

	/* 底部按钮：返回大厅（ghost）+ 再来一局（primary，非房主禁用） */
	.ll-result__actions {
		display: flex;
		gap: 9px;
		margin-top: 10px;
	}

	.ll-result__action {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 40px;
		border-radius: 999px;
	}

	.ll-result__action--ghost {
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(180, 170, 160, 0.4);
	}

	.ll-result__action--primary {
		background: linear-gradient(180deg, #ffdf8e 0%, #ffb84d 55%, #f59b2a 100%);
		border-bottom: 2px solid #b86a14;
		box-shadow: 0 4px 10px rgba(120, 60, 20, 0.26);
	}

	.ll-result__action--disabled {
		opacity: 0.5;
	}

	.ll-result__action-text {
		font-size: 14px;
		font-weight: 700;
		color: #5a3a10;
	}

	.ll-result__action-text--ghost {
		color: #1c4f33;
	}
</style>
