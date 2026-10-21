<template>
	<view class="ll-actions">
		<!-- 等待开局：房主能加机器人 / 解散 / 开局；其他人准备 / 邀请 -->
		<template v-if="phase === 'waiting'">
			<view
				v-if="!isHost"
				class="ll-action ll-action--ghost"
				:class="{ 'll-action--on': selfReady }"
				@click="$emit('toggle-ready')"
			>
				<text class="ll-action__text ll-action__text--ghost">{{ selfReady ? '已准备' : '准备' }}</text>
			</view>
			<!-- 加机器人：仅房主 + 仅测试环境（正式版连入口都不显示，服务端 addRobot 也会拒绝）。
			     满员 / 非 waiting 时置灰。 -->
			<view
				v-if="isHost && isTestEnv"
				class="ll-action ll-action--ghost"
				:class="{ 'll-action--disabled': !canAddRobot }"
				@click="$emit('add-robot')"
			>
				<text class="ll-action__text ll-action__text--ghost">加机器人</text>
			</view>
			<view v-if="isHost" class="ll-action ll-action--ghost" @click="$emit('close-room')">
				<text class="ll-action__text ll-action__text--ghost">解散</text>
			</view>
			<view
				v-if="isHost"
				class="ll-action ll-action--primary"
				:class="{ 'll-action--disabled': !canStart }"
				@click="$emit('start')"
			>
				<text class="ll-action__text">{{ canStart ? '开始游戏' : startBlockReason }}</text>
			</view>
			<view v-else class="ll-action ll-action--ghost" @click="$emit('share')">
				<text class="ll-action__text ll-action__text--ghost">邀请好友</text>
			</view>
		</template>

		<!-- 叫分 -->
		<template v-else-if="phase === 'bidding'">
			<template v-if="isMyTurn">
				<view class="ll-action ll-action--ghost" @click="$emit('bid', 0)">
					<text class="ll-action__text ll-action__text--ghost">不叫</text>
				</view>
				<view class="ll-action ll-action--ghost" @click="$emit('bid', 1)">
					<text class="ll-action__text ll-action__text--ghost">1 分</text>
				</view>
				<view class="ll-action ll-action--ghost" @click="$emit('bid', 2)">
					<text class="ll-action__text ll-action__text--ghost">2 分</text>
				</view>
				<view class="ll-action ll-action--primary" @click="$emit('bid', 3)">
					<text class="ll-action__text">3 分</text>
				</view>
			</template>
			<view v-else class="ll-action ll-action--ghost ll-action--wide">
				<text class="ll-action__text ll-action__text--ghost">等待其他人叫分…</text>
			</view>
		</template>

		<!-- 出牌：**只有轮到自己才出按钮**。
		     不是自己回合时工具栏整行留白（连「提醒」也不放了，避免一排点不动的灰按钮挡在牌前）；
		     托管 / 取消托管已经挪到顶栏右上角（图标按钮），这里不再重复。 -->
		<template v-else-if="phase === 'playing'">
			<template v-if="isMyTurn">
				<view
					class="ll-action ll-action--ghost"
					:class="{ 'll-action--disabled': !canPass }"
					@click="$emit('pass')"
				>
					<text class="ll-action__text ll-action__text--ghost">不出</text>
				</view>
				<!-- 提示 / 出牌：手里**没有任何能管住的牌**时置灰（此时只有「不出」可点） -->
				<view
					class="ll-action ll-action--ghost"
					:class="{ 'll-action--disabled': !hasPlayable }"
					@click="$emit('hint')"
				>
					<text class="ll-action__text ll-action__text--ghost">提示</text>
				</view>
				<view
					class="ll-action ll-action--primary"
					:class="{ 'll-action--disabled': !canPlay || !hasPlayable }"
					@click="$emit('play')"
				>
					<text class="ll-action__text">出牌</text>
				</view>
			</template>
		</template>

		<!-- 结算 -->
		<template v-else-if="phase === 'settled'">
			<view class="ll-action ll-action--ghost" @click="$emit('view-result')">
				<text class="ll-action__text ll-action__text--ghost">查看结果</text>
			</view>
			<view v-if="isHost" class="ll-action ll-action--primary" @click="$emit('rematch')">
				<text class="ll-action__text">再来一局</text>
			</view>
			<view v-else class="ll-action ll-action--ghost ll-action--wide">
				<text class="ll-action__text ll-action__text--ghost">等待房主开下一局</text>
			</view>
			<view v-if="isHost" class="ll-action ll-action--ghost" @click="$emit('close-room')">
				<text class="ll-action__text ll-action__text--ghost">解散房间</text>
			</view>
		</template>

		<!-- 房主掉线接管 -->
		<view v-if="hostOffline" class="ll-action ll-action--ghost" @click="$emit('claim-host')">
			<text class="ll-action__text ll-action__text--ghost">接管房主</text>
		</view>
	</view>
</template>

<script>
	/**
	 * QQ 三人斗地主的底部操作按钮组。
	 *
	 * 把 phase → 按钮组合的关系收敛到一处，room.vue 只负责事件处理。
	 *
	 * ⚠️ phase 必须是明确值（waiting / bidding / playing / settled），空串时不渲染任何按钮。
	 * ⚠️ waiting 的「准备 / 邀请」与房主视图互斥；叫分轮到别人才用 wide 占位条保持版式。
	 * ⚠️ playing 阶段**只有 isMyTurn 才渲染按钮**（不出 / 提示 / 出牌）。不是自己回合时整行留白 ——
	 *    一排点不动的灰按钮既误导又挡视线；「提醒」按钮已按需求删除。
	 * ⚠️ 托管 / 取消托管不在本组件：它是顶栏 `.ll-top__right` 的图标按钮（见 room.vue），
	 *    任何时候都能点，不受 isMyTurn 限制。
	 */
	export default {
		name: 'LlActions',
		props: {
			phase: { type: String, default: '' },
			isHost: { type: Boolean, default: false },
			isMyTurn: { type: Boolean, default: false },
			selfReady: { type: Boolean, default: false },
			canStart: { type: Boolean, default: false },
			startBlockReason: { type: String, default: '' },
			canPass: { type: Boolean, default: false },
			canPlay: { type: Boolean, default: false },
			/** 手里有没有能管住当前这一手的牌（false → 提示/出牌置灰，只有不出可点） */
			hasPlayable: { type: Boolean, default: true },
			hostOffline: { type: Boolean, default: false },
			/** 是否测试环境（微信开发版/体验版）——「加机器人」只在测试环境开放，正式版连入口都不显示 */
			isTestEnv: { type: Boolean, default: false },
			/** 加机器人是否当前可点（满员 / 非 waiting 时禁用） */
			canAddRobot: { type: Boolean, default: false }
		},
		emits: [
			'toggle-ready', 'add-robot', 'close-room', 'start', 'share',
			'bid', 'pass', 'hint', 'play',
			'view-result', 'rematch', 'claim-host'
		],
		watch: {
			phase: {
				handler(val, old) {
					console.log('phase', val,old);
				},
				immediate: true
			}
		}
	}
</script>

<style>
	/* QQ 风格按钮：圆角矩形、橙黄立体渐变主按钮（上浅下深 + 底部深色描边模拟立体）；
	   ghost 按钮是米白半透明 + 深绿字（在绿桌上看得清）。
	   ⚠️ 布局在底栏**工具栏行内**（不再 absolute 浮在手牌正中）—— 按钮挡住手牌是重构前的老 bug：
	   手牌在下面一行占满整行宽度，按钮在上一行，互不重叠。 */
	.ll-actions {
		flex: 0 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 0;
	}

	.ll-action {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 60px;
		height: 34px;
		padding: 0 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		box-shadow: 0 2px 5px rgba(12, 36, 22, 0.32);
	}

	.ll-action--wide {
		min-width: 150px;
	}

	.ll-action--primary {
		background: linear-gradient(180deg, #ffdf8e 0%, #ffb84d 55%, #f59b2a 100%);
		border-bottom: 2px solid #b86a14;
		box-shadow: 0 4px 10px rgba(120, 60, 20, 0.32);
	}

	.ll-action--on {
		background: linear-gradient(180deg, #ffe7a8 0%, #f5c95c 100%);
	}

	.ll-action--disabled {
		opacity: 0.45;
	}

	.ll-action__text {
		font-size: 13px;
		font-weight: 700;
		color: #5a3a10;
	}

	.ll-action__text--ghost {
		color: #1c4f33;
	}
</style>
