/**
 * 三款游戏的玩法说明文案（唯一文案源）
 * 大厅卡片与各房间页共用同一份数据，避免多处重复维护。
 *
 * ⚠️ 文案里写死的规则常量（人数配比、超时秒数、范围上限、倍数）必须与
 *    uniCloud-alipay/cloudfunctions/api-router/lib/game-constants.js
 *    以及各 engine 的实际数值保持一致；调整参数时同步改这里。
 */

export const GAME_TYPE_UNDERCOVER = 'undercover'
export const GAME_TYPE_LANDLORD = 'landlord'
export const GAME_TYPE_BOMB = 'bomb'

/** 图标类型：emoji 直接渲染文字；svg 走 <image> 加载 static 下的矢量图标 */
export const GAME_ICON_TYPE_EMOJI = 'emoji'
export const GAME_ICON_TYPE_SVG = 'svg'

export const GAME_META = {
	[GAME_TYPE_UNDERCOVER]: {
		gameType: GAME_TYPE_UNDERCOVER,
		title: '谁是卧底',
		shortTitle: '卧底',
		desc: '一句话描述你的词，找出那个不一样的人',
		// icon 是游戏图标（emoji），与各房间页主视觉的 emoji 保持一致：
		// 卧底 🕵️ / 斗地主 🃏 / 炸弹 💣；不要再用「数字 + 色块」的占位写法
		icon: '🕵️',
		iconType: GAME_ICON_TYPE_EMOJI,
		gradient: 'linear-gradient(135deg, #ffb37a 0%, #e76f51 100%)',
		playerText: '4-10 人',
		durationText: '约 10 分钟',
		needRoom: true,
		bombFree: false
	},
	[GAME_TYPE_LANDLORD]: {
		gameType: GAME_TYPE_LANDLORD,
		title: '三人斗地主',
		shortTitle: '斗地主',
		desc: '牌桌上一决高下',
		// 斗地主用 SVG 图标（iconfont 多色扁平风格）；换图只需替换 iconSrc 指向的文件，代码不用动
		icon: '🃏',
		iconType: GAME_ICON_TYPE_SVG,
		iconSrc: '/static/icons/game/landlord.svg',
		gradient: 'linear-gradient(135deg, #ffd08a 0%, #f2a25c 100%)',
		playerText: '3 人',
		durationText: '约 8 分钟',
		needRoom: true,
		bombFree: false
	},
	[GAME_TYPE_BOMB]: {
		gameType: GAME_TYPE_BOMB,
		title: '数字炸弹',
		shortTitle: '数字炸弹',
		desc: '1~100 里埋了一颗雷，看谁先踩中',
		icon: '💣',
		iconType: GAME_ICON_TYPE_EMOJI,
		gradient: 'linear-gradient(135deg, #ff9a8b 0%, #ff6a88 100%)',
		playerText: '1-8 人',
		durationText: '约 3 分钟',
		needRoom: false,
		bombFree: true
	}
}

/** 未知玩法（历史战绩里的旧 gameType）统一兜底图标 */
export const FALLBACK_GAME_ICON = '🎲'

export const GAME_RULES = {
	[GAME_TYPE_UNDERCOVER]: {
		title: '谁是卧底',
		subtitle: '用模糊的描述，找出那个拿到不同词的人',
		meta: ['4-10 人', '约 10 分钟', '语言推理'],
		sections: [
			{
				heading: '准备',
				items: [
					'房主创建房间，把 6 位房间号分享给朋友，满 4 人即可开始',
					'房主可在开局前设置卧底人数：4-6 人只能 1 个，7-10 人最多 2 个',
					'房主可在开局前开关「聚会模式」（默认开启）：开启后不用轮流发言，开局直接投票',
					'开始后系统按实际人数和卧底人数随机分配身份，每人的词只有自己能看到'
				]
			},
			{
				heading: '玩法',
				items: [
					'聚会模式（默认开启）：开局直接进入投票，全场同时投，随时可以提交、不用等别人',
					'关闭聚会模式则走经典流程：按提示顺序轮流用一句话描述自己的词，全员描述完再投票',
					'描述可以模糊，但别跑题——说得太具体会被卧底抓到破绽',
					'得票最多的人被淘汰出局，投完立刻判断是否分出胜负',
					'发言和投票都不限时，想好了再操作'
				]
			},
			{
				heading: '胜负',
				items: [
					'卧底全部被淘汰 → 平民获胜',
					'卧底人数追平平民人数（例如 1 卧底 1 平民）→ 卧底获胜',
					'投票平票时本轮不淘汰任何人，直接进入下一轮（聚会模式下即下一轮投票）'
				]
			},
			{
				heading: '小技巧',
				items: [
					'第一个发言最难，可以先用最笼统的说法，听别人怎么讲',
					'留意谁的描述和你的词「对不上」，那大概率就是卧底',
					'卧底要学会跟着别人的画风描述，别太早暴露自己'
				]
			}
		]
	},
	[GAME_TYPE_LANDLORD]: {
		title: '三人斗地主',
		subtitle: '一副牌三个人，叫分定地主，先出完手牌者获胜',
		meta: ['3 人', '约 8 分钟', '策略对局'],
		sections: [
			{
				heading: '准备',
				items: [
					'房主创建房间，把房间号发给两位朋友，凑满 3 人',
					'三人都点「准备」后，房主才能开始游戏；人不够时房主可以「添加机器人」补位',
					'一副牌 54 张，每人 17 张，留 3 张底牌'
				]
			},
			{
				heading: '叫分与地主',
				items: [
					'随机一家先叫分，可选择 1 分、2 分、3 分或不叫',
					'叫分最高的人成为地主，拿走 3 张底牌，手牌变成 20 张',
					'有人直接叫 3 分即立刻定地主；三家都不叫则重新发牌',
					'地主单独一方，另外两人是农民，农民之间是队友'
				]
			},
			{
				heading: '牌型',
				items: [
					'单张、对子、三张、三带一、三带二',
					'顺子：5 张及以上连续单牌（不含 2 和王）',
					'连对：3 对及以上连续对子（不含 2 和王）',
					'飞机：2 组及以上连续三张，可带同数量的单牌或对子',
					'四带二：四张 + 两张单牌，或四张 + 两对',
					'炸弹：四张同点数；王炸：大小王各一张，最大'
				]
			},
			{
				heading: '大小与倍数',
				items: [
					'同牌型、同张数才能比较，比点数大小；炸弹可压任意非炸弹牌型，王炸最大',
					'底分 = 叫分；每出现一个炸弹或王炸，倍数翻倍',
					'春天：地主出完牌而农民一张没出，倍数再翻倍；反春天同理',
					'地主赢则两位农民各输底分×倍数，地主赢双倍；农民赢则反过来'
				]
			},
			{
				heading: '计时与托管',
				items: [
					'叫分限时 15 秒，出牌限时 20 秒，倒计时结束会自动不叫 / 自动不出',
					'来不及操作可以点「托管」，由电脑按最小代价代打，随时可以「恢复操作」',
					'掉线超过 30 秒或连续两次超时，系统会自动帮你托管，重连后手动恢复即可'
				]
			}
		]
	},
	[GAME_TYPE_BOMB]: {
		title: '数字炸弹',
		subtitle: '范围里藏了一个炸弹数字，猜中就爆炸',
		meta: ['1-8 人', '约 3 分钟', '运气与心理'],
		sections: [
			{
				heading: '开局设置',
				items: [
					'开始前可以设置数字范围上限：默认 1~100，最大可以调到 1~1000',
					'支持单人挑战，也可以多人用同一台设备轮流猜',
					'点「开始游戏」后，系统会在范围内随机埋下一个炸弹数字'
				]
			},
			{
				heading: '怎么玩',
				items: [
					'轮到的人在当前区间内输入一个猜测数字',
					'猜中炸弹数字 → 当场爆炸，这一局结束',
					'没猜中会提示「偏大」或「偏小」，并把区间收窄到更小的范围',
					'区间会越猜越小，直到有人踩雷'
				]
			},
			{
				heading: '小技巧',
				items: [
					'优先猜区间中点，无论偏大偏小都能砍掉一半可能',
					'区间只剩 2-3 个数时就是纯运气了，做好心理准备',
					'多人轮流时，记住前面的人猜过的数，别浪费机会重复猜'
				]
			}
		]
	}
}

export function getGameRules(gameType = '') {
	return GAME_RULES[String(gameType || '')] || null
}

export function getGameMeta(gameType = '') {
	return GAME_META[String(gameType || '')] || null
}

/** 该玩法用哪种图标渲染（emoji / svg），未知玩法按 emoji 兜底 */
export function getGameIconType(gameType = '') {
	const meta = getGameMeta(gameType)
	return meta && meta.iconType ? meta.iconType : GAME_ICON_TYPE_EMOJI
}

/** svg 图标的资源路径；没有配置时返回空串（调用方应回退到 emoji） */
export function getGameIconSrc(gameType = '') {
	const meta = getGameMeta(gameType)
	return meta && meta.iconSrc ? String(meta.iconSrc) : ''
}

/** 大厅卡片网格数据源 */
export function getGameCardList() {
	return [GAME_TYPE_UNDERCOVER, GAME_TYPE_LANDLORD, GAME_TYPE_BOMB]
		.map((gameType) => Object.assign({}, GAME_META[gameType], {
			action: gameType
		}))
}
