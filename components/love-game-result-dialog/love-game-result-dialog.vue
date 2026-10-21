<template>
	<view v-if="show" class="game-result" :class="{ 'game-result--landscape': landscape }">
		<view class="game-result__mask" @click="handleMask"></view>
		<view class="game-result__panel">
			<!-- 内容区整体滚动，底部按钮常驻。
			     ⚠️ 必须用 scroll-view：小程序的 <view> 是原生节点，`overflow: auto` 不会产生滚动，
			     横屏 375px 高放不下「标题 + 4 行信息 + 3 人列表 + 提示」时会被直接裁掉。 -->
			<scroll-view class="game-result__scroll" scroll-y>
				<view class="game-result__hero" :class="'game-result__hero--' + tone">
					<text class="game-result__emoji">{{ emoji }}</text>
					<text class="game-result__title">{{ title }}</text>
					<text v-if="subtitle" class="game-result__subtitle">{{ subtitle }}</text>
				</view>

				<view v-if="lines.length" class="game-result__lines">
					<view v-for="(item, index) in lines" :key="index" class="game-result__line">
						<text class="game-result__line-label">{{ item.label }}</text>
						<text
							class="game-result__line-value"
							:class="{ 'game-result__line-value--highlight': item.highlight }"
						>{{ item.value }}</text>
					</view>
				</view>

				<view v-if="players.length" class="game-result__players">
					<view
						v-for="(item, index) in players"
						:key="index"
						class="game-result__player"
						:class="{ 'game-result__player--self': item.isSelf }"
					>
						<view class="game-result__avatar">
							<image v-if="item.avatarUrl" class="game-result__avatar-img" :src="item.avatarUrl" mode="aspectFill"></image>
							<text v-else class="game-result__avatar-text">{{ shortName(item.nickname) }}</text>
						</view>
						<view class="game-result__player-body">
							<text class="game-result__player-name">
								{{ item.nickname || '玩家' }}<text v-if="item.isSelf" class="game-result__self-flag">（我）</text>
							</text>
							<text v-if="item.roleText" class="game-result__player-role">{{ item.roleText }}</text>
						</view>
						<text
							v-if="item.scoreText"
							class="game-result__player-score"
							:class="{
								'game-result__player-score--win': item.result === 'win',
								'game-result__player-score--lose': item.result === 'lose'
							}"
						>{{ item.scoreText }}</text>
					</view>
				</view>

				<view v-if="tips" class="game-result__tips">
					<text class="game-result__tips-text">{{ tips }}</text>
				</view>
			</scroll-view>

			<view class="game-result__actions">
				<view v-if="secondaryText" class="game-result__action" @click="handleSecondary">
					<text class="game-result__action-text game-result__action-text--ghost">{{ secondaryText }}</text>
				</view>
				<view class="game-result__action game-result__action--primary" @click="handlePrimary">
					<text class="game-result__action-text">{{ primaryText }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'LoveGameResultDialog',
		props: {
			show: {
				type: Boolean,
				default: false
			},
			/** success / fail / draw，仅影响头部配色 */
			tone: {
				type: String,
				default: 'success'
			},
			emoji: {
				type: String,
				default: '🎉'
			},
			title: {
				type: String,
				default: '本局结束'
			},
			subtitle: {
				type: String,
				default: ''
			},
			/** [{ label, value, highlight }] */
			lines: {
				type: Array,
				default: () => []
			},
			/** [{ nickname, avatarUrl, roleText, scoreText, result, isSelf }] */
			players: {
				type: Array,
				default: () => []
			},
			tips: {
				type: String,
				default: ''
			},
			primaryText: {
				type: String,
				default: '再来一局'
			},
			secondaryText: {
				type: String,
				default: '返回大厅'
			},
			maskClosable: {
				type: Boolean,
				default: false
			},
			/**
			 * 横屏页面（斗地主房间页 pageOrientation: landscape）必须传 true：
			 * rpx 按屏宽换算，横屏下整体尺寸会放大 2 倍以上，而竖向只有 ~375px，
			 * 结果面板会超出屏幕、按钮被 `overflow: hidden` 裁掉。传 true 后改用 px 尺寸。
			 */
			landscape: {
				type: Boolean,
				default: false
			}
		},
		emits: ['close', 'primary', 'secondary'],
		mounted() {
			this.warnIfLandscapeMissed()
		},
		methods: {
			/**
			 * 兜底提醒：横屏页面忘了传 `landscape` 时，rpx 会把面板放大 2 倍以上
			 * —— 按钮会被 `overflow: hidden` 裁掉，但不会报错，所以给一条 warn。
			 */
			warnIfLandscapeMissed() {
				if (this.landscape) {
					return
				}
				try {
					const info = uni.getSystemInfoSync()
					if (Number(info.windowWidth) > Number(info.windowHeight)) {
						console.warn('[love-game-result-dialog] 当前屏幕是横屏，请在调用处传 :landscape="true"')
					}
				} catch (error) {
					// 取不到屏幕信息就算了，不影响功能
				}
			},
			shortName(name = '') {
				const text = String(name || '').trim()
				return text ? text.slice(0, 1) : '玩'
			},
			handleMask() {
				if (this.maskClosable) {
					this.$emit('close')
				}
			},
			handlePrimary() {
				this.$emit('primary')
			},
			handleSecondary() {
				this.$emit('secondary')
			}
		}
	}
</script>

<style>
	.game-result {
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

	.game-result__mask {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(58, 32, 24, 0.45);
	}

	.game-result__panel {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		width: 620rpx;
		max-height: 80vh;
		padding: 0 32rpx 32rpx;
		border-radius: 36rpx;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.99), rgba(255, 246, 239, 0.98));
		box-shadow: 0 24rpx 60rpx rgba(120, 70, 50, 0.22);
		overflow: hidden;
	}

	/* 内容区（标题 / 信息行 / 玩家列表 / 提示）统一在这里滚。
	   ⚠️ 只有 scroll-view 能滚：小程序里 `<view>` 的 `overflow: auto` 是死代码。 */
	.game-result__scroll {
		flex: 1;
		min-height: 0;
	}

	.game-result__hero {
		padding: 38rpx 0 26rpx;
		text-align: center;
	}

	.game-result__emoji {
		display: block;
		font-size: 76rpx;
		line-height: 1;
	}

	.game-result__title {
		display: block;
		margin-top: 18rpx;
		font-size: 40rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.game-result__subtitle {
		display: block;
		margin-top: 12rpx;
		font-size: 25rpx;
		line-height: 1.6;
		color: #8b6659;
	}

	.game-result__lines {
		padding: 18rpx 24rpx;
		border-radius: 26rpx;
		background: rgba(255, 247, 241, 0.96);
	}

	.game-result__line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10rpx 0;
	}

	.game-result__line-label {
		font-size: 25rpx;
		color: #917165;
	}

	.game-result__line-value {
		font-size: 27rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.game-result__line-value--highlight {
		color: #c0674d;
	}

	.game-result__players {
		margin-top: 20rpx;
	}

	.game-result__player {
		display: flex;
		align-items: center;
		gap: 16rpx;
		padding: 14rpx 20rpx;
		border-radius: 24rpx;
		background: rgba(255, 255, 255, 0.92);
	}

	.game-result__player + .game-result__player {
		margin-top: 12rpx;
	}

	.game-result__player--self {
		background: rgba(255, 240, 232, 0.96);
	}

	.game-result__avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #ffb37a 0%, #e76f51 100%);
		overflow: hidden;
	}

	.game-result__avatar-img {
		width: 100%;
		height: 100%;
	}

	.game-result__avatar-text {
		font-size: 26rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.game-result__player-body {
		flex: 1;
		min-width: 0;
	}

	.game-result__player-name {
		display: block;
		font-size: 27rpx;
		font-weight: 600;
		color: #5d372b;
	}

	.game-result__self-flag {
		font-size: 22rpx;
		font-weight: 400;
		color: #b8604c;
	}

	.game-result__player-role {
		display: block;
		margin-top: 4rpx;
		font-size: 22rpx;
		color: #a07d71;
	}

	.game-result__player-score {
		font-size: 28rpx;
		font-weight: 700;
		color: #a07d71;
	}

	.game-result__player-score--win {
		color: #c0674d;
	}

	.game-result__player-score--lose {
		color: #7f9b8e;
	}

	.game-result__tips {
		margin-top: 18rpx;
		padding: 16rpx 20rpx;
		border-radius: 20rpx;
		background: rgba(255, 246, 241, 0.96);
	}

	.game-result__tips-text {
		font-size: 23rpx;
		line-height: 1.6;
		color: #936d62;
	}

	.game-result__actions {
		display: flex;
		flex-shrink: 0;
		gap: 18rpx;
		margin-top: 26rpx;
	}

	.game-result__action {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		border-radius: 999rpx;
		background: rgba(255, 241, 235, 0.96);
	}

	.game-result__action--primary {
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 14rpx 26rpx rgba(231, 111, 81, 0.26);
	}

	.game-result__action-text {
		font-size: 28rpx;
		font-weight: 600;
		color: #ffffff;
	}

	.game-result__action-text--ghost {
		color: #b05b48;
	}

	/* ---------------- 横屏（斗地主房间页）----------------
	   全换 px：横屏 rpx 按屏宽放大 2 倍以上，而竖向可用高度只有 ~375px。
	   三条策略：① 面板上下各留 7vh，避开刘海 / Home Indicator；
	            ② 尺寸整体压一遍（375px 高要装下标题 + 4 行信息 + 3 人 + 提示 + 按钮）；
	            ③ 内容交给 scroll-view 滚，底部按钮 flex-shrink:0 常驻。 */
	.game-result--landscape .game-result__panel {
		display: flex;
		flex-direction: column;
		width: 460px;
		max-width: 88vw;
		max-height: 86vh;
		padding: 0 18px 14px;
		border-radius: 18px;
		box-shadow: 0 12px 30px rgba(120, 70, 50, 0.22);
	}

	.game-result--landscape .game-result__hero {
		padding: 11px 0 8px;
	}

	.game-result--landscape .game-result__emoji {
		font-size: 26px;
	}

	.game-result--landscape .game-result__title {
		margin-top: 6px;
		font-size: 18px;
	}

	.game-result--landscape .game-result__subtitle {
		margin-top: 4px;
		font-size: 12px;
	}

	.game-result--landscape .game-result__lines {
		padding: 7px 10px;
		border-radius: 14px;
	}

	.game-result--landscape .game-result__line {
		padding: 4px 0;
	}

	.game-result--landscape .game-result__line-label,
	.game-result--landscape .game-result__line-value {
		font-size: 12px;
	}

	/* 玩家列表不再自己滚（小程序 <view> 滚不动、嵌套滚动也难用）—— 整块交给外层 scroll-view */
	.game-result--landscape .game-result__players {
		margin-top: 9px;
	}

	.game-result--landscape .game-result__player {
		gap: 8px;
		padding: 6px 10px;
		border-radius: 12px;
	}

	.game-result--landscape .game-result__player + .game-result__player {
		margin-top: 6px;
	}

	.game-result--landscape .game-result__avatar {
		width: 28px;
		height: 28px;
	}

	.game-result--landscape .game-result__avatar-text {
		font-size: 12px;
	}

	.game-result--landscape .game-result__player-name,
	.game-result--landscape .game-result__player-score {
		font-size: 13px;
	}

	.game-result--landscape .game-result__self-flag,
	.game-result--landscape .game-result__player-role {
		font-size: 11px;
	}

	.game-result--landscape .game-result__tips {
		margin-top: 7px;
		padding: 7px 10px;
		border-radius: 10px;
	}

	.game-result--landscape .game-result__tips-text {
		font-size: 12px;
	}

	.game-result--landscape .game-result__actions {
		flex-shrink: 0;
		gap: 9px;
		margin-top: 10px;
	}

	.game-result--landscape .game-result__action {
		height: 40px;
		border-radius: 999px;
		box-shadow: none;
	}

	.game-result--landscape .game-result__action--primary {
		box-shadow: 0 7px 13px rgba(231, 111, 81, 0.26);
	}

	.game-result--landscape .game-result__action-text {
		font-size: 14px;
	}
</style>
