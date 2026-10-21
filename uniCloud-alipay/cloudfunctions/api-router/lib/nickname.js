'use strict'

/**
 * 默认昵称生成器：纯中文词组、不带数字。
 *
 * 参照番茄系产品「注册不填昵称、服务端静默分配」的做法，
 * 但把「用户 + 随机数字」换成情侣记录场景更合适的中文词组。
 *
 * 三组词按语法角色拆分，由 4 个模板两两组合（中文三段直拼不成词）：
 *   {修饰}的{主体}   → 温柔的橘子
 *   {修饰}{主体}     → 软糯汤圆
 *   {主体}味的{场景} → 橘子味的夏天
 *   小{主体}         → 小汤圆
 *
 * ⚠️ 顶层只允许 require('./constants') 与 require('./hash')。
 * `require('./db')` 会执行 uniCloud.database()，放在顶层会让 scripts/ 下的
 * 纯 Node 回归脚本一 require 本模块就崩。统一在函数内惰性 require
 * （项目内同样的写法见 lib/profile.js 的 formatUserInfo 对 ./couple 的处理）。
 */

const { DEFAULT_NICKNAME } = require('./constants')
const { hashSeed } = require('./hash')

// 第 1 组：修饰语（形容词 / 状态），决定性格
const MODIFIERS = [
	'温柔', '爱笑', '慢热', '软糯', '元气', '安静', '清甜', '慵懒',
	'认真', '迷糊', '乖巧', '倔强', '阳光', '清爽', '机灵', '贴心',
	'话痨', '浪漫', '天真', '勇敢', '细腻', '松弛', '熬夜', '嗜睡',
	'嘴硬', '心软', '乐天', '佛系', '念旧', '爱哭', '慢悠悠', '软乎乎',
	'甜丝丝', '亮晶晶', '毛茸茸', '轻飘飘', '暖烘烘', '圆滚滚', '慢半拍', '爱撒娇'
]

// 第 2 组：主体（动物 / 甜点 / 果实 / 自然），决定形象
const SUBJECTS = [
	'橘子', '小熊', '猫咪', '兔子', '小狗', '柯基', '柴犬', '松鼠',
	'狐狸', '水獭', '企鹅', '海豹', '鲸鱼', '小鹿', '羊驼', '刺猬',
	'熊猫', '考拉', '布丁', '奶糖', '蛋糕', '泡芙', '汤圆', '青团',
	'栗子', '桃子', '草莓', '蓝莓', '柠檬', '柚子', '葡萄', '西瓜',
	'芒果', '椰子', '红豆', '芋圆', '麻薯', '可颂', '云朵', '月亮',
	'星星', '晚风', '初雪', '海浪', '铃兰', '茉莉', '薄荷', '森林',
	'山谷', '灯塔', '邮筒', '纸鹤', '气球', '奶盖', '蛋挞', '棉花糖'
]

// 第 3 组：场景（地点 / 时间 / 物件），只在「…味的…」模板里出场
const SCENES = [
	'月光', '星球', '银河', '云层', '海边', '山顶', '天台', '小巷',
	'窗台', '屋檐', '树洞', '走廊', '操场', '花园', '岛屿', '夏天',
	'清晨', '黄昏', '雨天', '雪天', '电台', '日记', '口袋', '罐头',
	'汽水', '站台', '阳台', '街角', '课桌', '旧书店', '便利店', '甜品店',
	'游乐园', '小木屋', '后花园', '秘密基地'
]

// 保底尾字：8 个候选全撞名时追加，保证必然有结果且不出现数字
const FALLBACK_SUFFIXES = ['呀', '呢', '哦', '啦', '哟', '嘛', '呐', '嘞']

/** 生成昵称的硬上限（实际最长 7 字），远低于前端 20 / 后端 100 */
const NICKNAME_MAX_LENGTH = 12
/** 每轮生成多少个候选，一次 in 查询批量比对 */
const CANDIDATES_PER_ROUND = 8
/** 视为「没有昵称」的占位值 */
const PLACEHOLDER_NICKNAMES = [DEFAULT_NICKNAME]

const COMBINATION_COUNT = (
	MODIFIERS.length * SUBJECTS.length * 2 +
	SUBJECTS.length * SCENES.length +
	SUBJECTS.length
)

function normalizeNickname(value) {
	if (value === undefined || value === null) {
		return ''
	}
	return `${value}`.trim()
}

/** 空 / 纯空白 / 字面量 '微信用户' 都算「没有有效昵称」 */
function hasMeaningfulNickname(value) {
	const nickname = normalizeNickname(value)
	if (!nickname) {
		return false
	}
	return !PLACEHOLDER_NICKNAMES.includes(nickname)
}

/**
 * 由种子确定性地生成第 attempt 个候选。
 * 同一 seed 的候选序列永远一致 —— 这是并发首登不写坏数据的前提。
 */
function buildNicknameFromSeed(seed, attempt = 0) {
	const hash = hashSeed(`${seed}#nickname#${attempt}`)
	const modifier = MODIFIERS[(hash >>> 6) % MODIFIERS.length]
	const subject = SUBJECTS[(hash >>> 14) % SUBJECTS.length]
	const scene = SCENES[(hash >>> 22) % SCENES.length]

	switch (hash % 4) {
		case 2:
			return `${subject}味的${scene}`
		case 3:
			return `小${subject}`
		case 1:
			return `${modifier}${subject}`
		default:
			return `${modifier}的${subject}`
	}
}

/** 一批候选（内部去重），最多重抽 count*8 次，避免极端哈希下死循环 */
function buildNicknameCandidates(seed, count = CANDIDATES_PER_ROUND) {
	const result = []
	const seen = new Set()
	const maxTries = Math.max(count * 8, count)

	for (let i = 0; i < maxTries && result.length < count; i += 1) {
		const candidate = buildNicknameFromSeed(seed, i)
		if (seen.has(candidate)) {
			continue
		}
		seen.add(candidate)
		result.push(candidate)
	}

	return result
}

/** 保底：8 个全撞时加一个语气尾字，不查库、不循环，必然返回 */
function buildFallbackNickname(seed) {
	const hash = hashSeed(`${seed}#nickname-fallback`)
	const suffix = FALLBACK_SUFFIXES[hash % FALLBACK_SUFFIXES.length]
	return `${buildNicknameFromSeed(seed, 0)}${suffix}`
}

/**
 * 每次取一个新的 collection 句柄。
 * lib/db.js 导出的 userCollection 是长期持有的同一个 query 构建器，
 * 「先 .doc() 再 .where()」时旧实现的条件会互相污染（回归 mock 尤其明显）。
 * db.collection() 只是拿引用，没有网络开销，代价可以忽略。
 */
function getUserCollection() {
	return require('./db').db.collection('uni-id-users')
}

async function getUserRecord(uid) {
	const result = await getUserCollection().doc(uid).get()
	return result && Array.isArray(result.data) && result.data[0] ? result.data[0] : null
}

/** 一次 in 查询找出这批候选里已被占用的昵称 */
async function getTakenNicknames(candidates = []) {
	if (!candidates.length) {
		return new Set()
	}

	const { dbCmd, db } = require('./db')
	const userCollection = db.collection('uni-id-users')
	const result = await userCollection
		.where({ nickname: dbCmd.in(candidates) })
		.field({ nickname: true })
		// 昵称不是唯一键，同一昵称可能对应多条用户记录；
		// 若把 limit 卡在候选数（8），重名文档会挤掉别的候选，导致「看起来没人用」。
		.limit(Math.max(candidates.length * 8, 20))
		.get()

	const rows = result && Array.isArray(result.data) ? result.data : []
	return new Set(rows.map((row) => normalizeNickname(row.nickname)).filter(Boolean))
}

/**
 * 取一个尽量未被占用的昵称。
 * 查重失败（DB 抖动）时退化为「直接返回第一个候选」：昵称不是唯一键，
 * 宁可重名也不能让登录失败。
 */
async function pickAvailableNickname(seed) {
	const candidates = buildNicknameCandidates(seed, CANDIDATES_PER_ROUND)
	let taken = new Set()

	try {
		taken = await getTakenNicknames(candidates)
	} catch (error) {
		console.warn('api-router getTakenNicknames failed', error)
		return candidates[0] || buildFallbackNickname(seed)
	}

	const free = candidates.find((item) => !taken.has(item))
	return free || buildFallbackNickname(seed)
}

/**
 * 幂等补齐：用户还没有有效昵称时生成一个并落库，已有有效昵称绝不覆盖。
 * 判断源必须是「库里的记录」，不能是入参或 update 返回值，否则每次登录昵称都会变。
 * 整体 try/catch —— 昵称是锦上添花，不能成为登录的单点故障。
 */
async function ensureUserNickname(uid, userRecord) {
	if (!uid) {
		return userRecord || null
	}

	try {
		const record = userRecord && userRecord._id ? userRecord : await getUserRecord(uid)
		if (!record) {
			return userRecord || null
		}
		if (hasMeaningfulNickname(record.nickname)) {
			return record
		}

		const nickname = await pickAvailableNickname(uid)
		await getUserCollection().doc(uid).update({
			nickname,
			updated_at: Date.now()
		})

		return Object.assign({}, record, { nickname })
	} catch (error) {
		console.warn('api-router ensureUserNickname failed', error)
		return userRecord || null
	}
}

module.exports = {
	MODIFIERS,
	SUBJECTS,
	SCENES,
	FALLBACK_SUFFIXES,
	NICKNAME_MAX_LENGTH,
	CANDIDATES_PER_ROUND,
	COMBINATION_COUNT,
	normalizeNickname,
	hasMeaningfulNickname,
	buildNicknameFromSeed,
	buildNicknameCandidates,
	buildFallbackNickname,
	pickAvailableNickname,
	ensureUserNickname
}
