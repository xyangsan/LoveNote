<template>
	<view class="love-page anniversary-edit-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<fui-section
				:title="pageTitle"
				descr="支持背景图、背景色、字体色、遮罩透明度、公历/农历和重复规则。"
				:is-line="true"
				line-width="10rpx"
				line-color="#ec7558"
				:line-right="22"
				:descr-top="14"
				:size="40"
				descr-size="24"
				color="#5a3427"
				descr-color="#906b61"
				:padding="['0', '0']"
				:margin-top="12"
				:margin-bottom="24"
			></fui-section>

			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先登录后再编辑纪念日。"
				secondary-text="返回纪念日列表"
				@login="goToLoginPage"
				@secondary="goBack"
			></love-auth-required>

			<view v-else>
				<love-glass-card
					:margin="['0', '0', '0', '0']"
					:padding="['0', '0']"
					:content-padding="['28rpx', '28rpx', '30rpx', '28rpx']"
					:header-line="false"
				>
					<view class="form-block">
						<text class="love-field-label">标题</text>
						<fui-input
							:value="form.title"
							type="text"
							placeholder="请输入纪念日标题"
							background-color="#fff7f3"
							:border-bottom="false"
							:padding="['26rpx', '24rpx']"
							:radius="24"
							:size="28"
							color="#5a3427"
							maxlength="50"
							@input="onTitleInput"
						></fui-input>
					</view>

					<fui-divider
						width="100%"
						height="46"
						divider-color="rgba(231, 204, 194, 0.66)"
					></fui-divider>

					<view class="form-block">
						<text class="love-field-label">日期类型</text>
						<fui-segmented-control
							:values="dateTypeOptions"
							:current="dateTypeIndex"
							color="#ec7558"
							active-color="#ffffff"
							:height="70"
							:size="24"
							:bold="true"
							:radius="999"
							@click="handleDateTypeChange"
						></fui-segmented-control>
					</view>

					<view class="form-block">
						<text class="love-field-label">日期</text>
						<picker
							mode="date"
							fields="day"
							:value="form.dateValue"
							:start="datePickerStart"
							:end="datePickerEnd"
							@change="handleDateChange"
						>
							<fui-list-cell
								:padding="['26rpx', '24rpx']"
								background="#fff7f3"
								:bottom-border="false"
								radius="24rpx"
								arrow
								arrow-color="#d2a394"
							>
								<view class="picker-field">
									<text class="picker-field__value">{{ form.dateValue || '请选择日期' }}</text>
								</view>
							</fui-list-cell>
						</picker>
						<text
							v-if="form.dateType === 'lunar'"
							class="love-field-tip"
						>农历模式会按农历月日计算每年倒计时。</text>
					</view>

					<view class="form-block">
						<text class="love-field-label">重复方式</text>
						<fui-segmented-control
							:values="repeatTypeOptions"
							:current="repeatTypeIndex"
							color="#ec7558"
							active-color="#ffffff"
							:height="70"
							:size="24"
							:bold="true"
							:radius="999"
							@click="handleRepeatTypeChange"
						></fui-segmented-control>
					</view>

					<fui-divider
						width="100%"
						height="46"
						divider-color="rgba(231, 204, 194, 0.66)"
					></fui-divider>

					<view class="form-block">
						<text class="love-field-label">背景模式</text>
						<fui-segmented-control
							:values="backgroundTypeOptions"
							:current="backgroundTypeIndex"
							color="#ec7558"
							active-color="#ffffff"
							:height="70"
							:size="24"
							:bold="true"
							:radius="999"
							@click="handleBackgroundTypeChange"
						></fui-segmented-control>
					</view>

					<view v-if="form.backgroundType === 'image'" class="form-block">
						<text class="love-field-label">背景图片</text>
						<view
							v-if="displayBackgroundPreview"
							class="background-preview"
						>
							<image
								class="background-preview__image"
								:src="displayBackgroundPreview"
								mode="aspectFill"
							></image>
							<view class="background-preview__overlay">
								<fui-tag
									text="清除"
									:is-border="false"
									background="rgba(0, 0, 0, 0.48)"
									color="#ffffff"
									radius="999"
									:padding="['8rpx', '16rpx']"
									@click="clearBackgroundImage"
								></fui-tag>
							</view>
						</view>

						<love-media-uploader
							ref="backgroundUploader"
							:file-types="['image']"
							:max-file-size="20 * 1024 * 1024"
							:compressed="true"
							:enable-compression="true"
							:compress-over-size="5 * 1024 * 1024"
							save-path="anniversary/backgrounds"
							upload-prefix="bg"
							:max-count="1"
							:show-tips="true"
							tip-text="仅支持图片，超过 5MB 自动压缩。"
							:item-width="210"
							:item-height="210"
							:previewable="true"
							object-fit="aspectFill"
							:source-type="['album', 'camera']"
							:show-delete-button="true"
							add-text="选择背景图"
							upload-icon="+"
							@change="onBackgroundUploaderChange"
						>
							<template #tip>
								<text class="upload-tip">仅支持图片，超过 5MB 自动压缩。</text>
							</template>
						</love-media-uploader>
					</view>

					<view v-else class="form-block">
						<text class="love-field-label">背景色</text>
						<view class="color-list">
							<view
								v-for="color in backgroundColorOptions"
								:key="`bg-${color}`"
								class="color-item"
								:class="{ 'color-item--active': form.backgroundColor === color }"
								:style="{ backgroundColor: color }"
								@click="setColor('backgroundColor', color)"
							></view>
						</view>
					</view>

					<view class="form-block">
						<text class="love-field-label">字体色</text>
						<view class="color-list">
							<view
								v-for="color in fontColorOptions"
								:key="`font-${color}`"
								class="color-item"
								:class="{ 'color-item--active': form.fontColor === color }"
								:style="{ backgroundColor: color }"
								@click="setColor('fontColor', color)"
							></view>
						</view>
					</view>

					<view class="form-block">
						<view class="switch-row">
							<text class="love-field-label switch-row__label">背景遮罩</text>
							<fui-switch
								:checked="form.maskEnabled"
								color="#ec7558"
								scale-ratio="0.9"
								@change="handleMaskEnabledChange"
							></fui-switch>
						</view>
						<view v-if="form.maskEnabled" class="mask-settings">
							<view class="color-list">
								<view
									v-for="color in maskColorOptions"
									:key="`mask-${color}`"
									class="color-item"
									:class="{ 'color-item--active': form.maskColor === color }"
									:style="{ backgroundColor: color }"
									@click="setColor('maskColor', color)"
								></view>
							</view>
							<view class="slider-row">
								<text class="slider-row__label">透明度</text>
								<slider
									class="slider-row__slider"
									min="0"
									max="100"
									step="1"
									:value="maskOpacityPercent"
									activeColor="#ec7558"
									backgroundColor="rgba(236, 117, 88, 0.2)"
									block-color="#ec7558"
									@change="handleMaskOpacityChange"
								/>
								<text class="slider-row__value">{{ maskOpacityPercent }}%</text>
							</view>
						</view>
					</view>
				</love-glass-card>

				<love-glass-card
					title="预览"
					:margin="['22rpx', '0', '0', '0']"
					:padding="['0', '0']"
					:content-padding="['0', '0', '0', '0']"
				>
					<view class="preview-card">
						<view class="preview-card__bg" :style="previewBackgroundStyle"></view>
						<view
							v-if="form.maskEnabled"
							class="preview-card__mask"
							:style="previewMaskStyle"
						></view>
						<view class="preview-card__content" :style="previewTextStyle">
							<text class="preview-card__title">{{ form.title || '纪念日标题' }}</text>
							<text class="preview-card__meta">{{ form.dateValue || '--' }} · {{ currentDateTypeText }} · {{ currentRepeatTypeText }}</text>
							<text class="preview-card__countdown">{{ previewCountdownText }}</text>
						</view>
					</view>
				</love-glass-card>

				<view class="love-action-stack actions">
					<fui-button
						:text="saveButtonText"
						background="linear-gradient(135deg, #ff8b72 0%, #e76f51 100%)"
						color="#ffffff"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						:loading="saving"
						@click="handleSave"
					></fui-button>
					<fui-button
						text="返回"
						background="rgba(255, 241, 235, 0.98)"
						color="#b05b48"
						border-color="rgba(214, 145, 122, 0.24)"
						radius="999rpx"
						height="90rpx"
						:size="28"
						:bold="true"
						@click="goBack"
					></fui-button>
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

const DATE_TYPE_OPTIONS = ['solar', 'lunar']
const DATE_TYPE_TEXT_MAP = {
	solar: '公历',
	lunar: '农历'
}

const REPEAT_TYPE_OPTIONS = ['none', 'weekly', 'monthly', 'yearly']
const REPEAT_TYPE_TEXT_MAP = {
	none: '不重复',
	weekly: '每周',
	monthly: '每月',
	yearly: '每年'
}

const LUNAR_MONTH_MAP = {
	'正月': 1,
	'一月': 1,
	'二月': 2,
	'三月': 3,
	'四月': 4,
	'五月': 5,
	'六月': 6,
	'七月': 7,
	'八月': 8,
	'九月': 9,
	'十月': 10,
	'十一月': 11,
	'冬月': 11,
	'十二月': 12,
	'腊月': 12
}

const DAY_MS = 24 * 60 * 60 * 1000

function createLunarFormatter() {
	try {
		return new Intl.DateTimeFormat('zh-Hans-CN-u-ca-chinese', {
			year: 'numeric',
			month: 'numeric',
			day: 'numeric'
		})
	} catch (error) {
		console.warn('lunar formatter unavailable', error)
		return null
	}
}

const LUNAR_FORMATTER = createLunarFormatter()

function padDateUnit(value) {
	return `${value}`.padStart(2, '0')
}

function getTodayDateString() {
	const now = new Date()
	return `${now.getFullYear()}-${padDateUnit(now.getMonth() + 1)}-${padDateUnit(now.getDate())}`
}

function parseDateValue(value = '') {
	const dateValue = String(value || '').trim()
	if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
		return null
	}
	const date = new Date(`${dateValue}T00:00:00`)
	if (Number.isNaN(date.getTime())) {
		return null
	}
	const normalized = `${date.getFullYear()}-${padDateUnit(date.getMonth() + 1)}-${padDateUnit(date.getDate())}`
	return normalized === dateValue ? date : null
}

function getTodayStartDate() {
	const now = new Date()
	return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function getDaysInMonth(year, monthIndex) {
	return new Date(year, monthIndex + 1, 0).getDate()
}

function createDateSafe(year, monthIndex, day) {
	const safeDay = Math.max(1, Math.min(day, getDaysInMonth(year, monthIndex)))
	return new Date(year, monthIndex, safeDay)
}

function parseLunarMonth(value = '') {
	const raw = String(value || '').trim().replace(/\s+/g, '')
	if (!raw) {
		return {
			month: 0,
			isLeap: false
		}
	}

	const isLeap = raw.includes('闰')
	const normalizedMonthText = raw.replace('闰', '')
	const mappedMonth = LUNAR_MONTH_MAP[normalizedMonthText]
	if (mappedMonth) {
		return {
			month: mappedMonth,
			isLeap
		}
	}

	const digitMonth = parseInt(normalizedMonthText.replace(/[^\d]/g, ''), 10)
	if (!Number.isNaN(digitMonth) && digitMonth >= 1 && digitMonth <= 12) {
		return {
			month: digitMonth,
			isLeap
		}
	}

	return {
		month: 0,
		isLeap
	}
}

function getLunarDateInfo(date = null) {
	if (!LUNAR_FORMATTER || !date || Number.isNaN(date.getTime())) {
		return null
	}

	try {
		const parts = LUNAR_FORMATTER.formatToParts(date)
		const monthText = String((parts.find((part) => part.type === 'month') || {}).value || '')
		const dayText = String((parts.find((part) => part.type === 'day') || {}).value || '')
		const monthInfo = parseLunarMonth(monthText)
		const day = parseInt(dayText.replace(/[^\d]/g, ''), 10)
		if (!monthInfo.month || Number.isNaN(day) || day < 1 || day > 30) {
			return null
		}
		return {
			month: monthInfo.month,
			day,
			isLeap: monthInfo.isLeap
		}
	} catch (error) {
		console.warn('getLunarDateInfo failed', error)
		return null
	}
}

function findNextLunarDate(target = {}, fromDate = null, maxScanDays = 800) {
	if (!fromDate || !target.month || !target.day) {
		return null
	}

	const expectLeap = Boolean(target.isLeap)
	for (let i = 0; i <= maxScanDays; i += 1) {
		const candidate = new Date(fromDate.getTime() + i * DAY_MS)
		const lunarInfo = getLunarDateInfo(candidate)
		if (!lunarInfo) {
			continue
		}
		if (lunarInfo.month !== target.month || lunarInfo.day !== target.day) {
			continue
		}
		if (Boolean(lunarInfo.isLeap) !== expectLeap) {
			continue
		}
		return candidate
	}

	return null
}

function getNextSolarDate(baseDate, today, repeatType) {
	let nextDate = new Date(baseDate.getTime())

	if (repeatType === 'weekly') {
		const diff = (baseDate.getDay() - today.getDay() + 7) % 7
		nextDate = new Date(today.getTime() + diff * DAY_MS)
		return nextDate
	}

	if (repeatType === 'monthly') {
		const targetDay = baseDate.getDate()
		nextDate = createDateSafe(today.getFullYear(), today.getMonth(), targetDay)
		if (nextDate.getTime() < today.getTime()) {
			const nextMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
			nextDate = createDateSafe(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), targetDay)
		}
		return nextDate
	}

	if (repeatType === 'yearly') {
		const targetMonth = baseDate.getMonth()
		const targetDay = baseDate.getDate()
		nextDate = createDateSafe(today.getFullYear(), targetMonth, targetDay)
		if (nextDate.getTime() < today.getTime()) {
			nextDate = createDateSafe(today.getFullYear() + 1, targetMonth, targetDay)
		}
		return nextDate
	}

	return nextDate
}

function computeCountdown(dateValue = '', repeatType = 'yearly', dateType = 'solar') {
	const baseDate = parseDateValue(dateValue)
	if (!baseDate) {
		return {
			days: null,
			isPassed: false
		}
	}

	const today = getTodayStartDate()
	let nextDate = new Date(baseDate.getTime())

	if (repeatType !== 'none') {
		if (repeatType === 'yearly' && dateType === 'lunar') {
			const lunarInfo = getLunarDateInfo(baseDate)
			nextDate = (lunarInfo ? findNextLunarDate(lunarInfo, today, 800) : null) || getNextSolarDate(baseDate, today, repeatType)
		} else {
			nextDate = getNextSolarDate(baseDate, today, repeatType)
		}
	}

	const days = Math.floor((nextDate.getTime() - today.getTime()) / DAY_MS)
	return {
		days,
		isPassed: repeatType === 'none' && days < 0
	}
}

function buildCountdownText(dateValue = '', repeatType = 'yearly', dateType = 'solar') {
	const countdown = computeCountdown(dateValue, repeatType, dateType)
	if (countdown.days === null || countdown.days === undefined || Number.isNaN(Number(countdown.days))) {
		return '--'
	}
	if (countdown.days === 0) {
		return '今天'
	}
	if (countdown.days > 0) {
		return `还有 ${countdown.days} 天`
	}
	return countdown.isPassed ? `已过 ${Math.abs(countdown.days)} 天` : `还有 ${Math.abs(countdown.days)} 天`
}

export default {
	data() {
		return {
			isLoggedIn: false,
			loadingDetail: false,
			saving: false,
			anniversaryId: '',
			pendingBackgroundFiles: [],
			form: {
				title: '',
				dateType: 'solar',
				dateValue: getTodayDateString(),
				repeatType: 'yearly',
				backgroundType: 'color',
				backgroundImage: {
					url: '',
					file_id: ''
				},
				backgroundColor: '#EC7558',
				fontColor: '#FFFFFF',
				maskEnabled: true,
				maskColor: '#000000',
				maskOpacity: 0.35
			},
			dateTypeOptions: [{ name: '公历' }, { name: '农历' }],
			repeatTypeOptions: [{ name: '不重复' }, { name: '每周' }, { name: '每月' }, { name: '每年' }],
			backgroundTypeOptions: [{ name: '背景图' }, { name: '背景色' }],
			backgroundColorOptions: ['#EC7558', '#FA856A', '#F59E7C', '#E76F51', '#D96C6C', '#8CC0DE'],
			fontColorOptions: ['#FFFFFF', '#FFF5E8', '#3F2A24', '#5A3427', '#1F1F1F'],
			maskColorOptions: ['#000000', '#1A1A1A', '#2B2B2B', '#4C2E28', '#6B3E36']
		}
	},
	computed: {
		isEditMode() {
			return Boolean(this.anniversaryId)
		},
		pageTitle() {
			return this.isEditMode ? '编辑纪念日' : '新增纪念日'
		},
		saveButtonText() {
			return this.isEditMode ? '保存修改' : '创建纪念日'
		},
		dateTypeIndex() {
			const index = DATE_TYPE_OPTIONS.indexOf(this.form.dateType)
			return index === -1 ? 0 : index
		},
		repeatTypeIndex() {
			const index = REPEAT_TYPE_OPTIONS.indexOf(this.form.repeatType)
			return index === -1 ? 3 : index
		},
		backgroundTypeIndex() {
			return this.form.backgroundType === 'image' ? 0 : 1
		},
		maskOpacityPercent() {
			return Math.round(Number(this.form.maskOpacity || 0) * 100)
		},
		datePickerStart() {
			return '1900-01-01'
		},
		datePickerEnd() {
			return '2100-12-31'
		},
		displayBackgroundPreview() {
			const pending = Array.isArray(this.pendingBackgroundFiles) ? this.pendingBackgroundFiles : []
			if (pending.length && pending[0] && pending[0].path) {
				return pending[0].path
			}
			return this.form.backgroundImage && this.form.backgroundImage.url
				? this.form.backgroundImage.url
				: ''
		},
		previewBackgroundStyle() {
			if (this.form.backgroundType === 'image' && this.displayBackgroundPreview) {
				return {
					backgroundImage: `url(${this.displayBackgroundPreview})`,
					backgroundSize: 'cover',
					backgroundPosition: 'center'
				}
			}
			return {
				backgroundColor: this.form.backgroundColor
			}
		},
		previewMaskStyle() {
			return {
				backgroundColor: this.form.maskColor,
				opacity: Number(this.form.maskOpacity || 0)
			}
		},
		previewTextStyle() {
			return {
				color: this.form.fontColor
			}
		},
		currentDateTypeText() {
			return DATE_TYPE_TEXT_MAP[this.form.dateType] || '公历'
		},
		currentRepeatTypeText() {
			return REPEAT_TYPE_TEXT_MAP[this.form.repeatType] || '每年'
		},
		previewCountdownText() {
			return buildCountdownText(this.form.dateValue, this.form.repeatType, this.form.dateType)
		}
	},
	onLoad(options) {
		const id = String((options && options.anniversaryId) || '').trim()
		this.anniversaryId = id
		this.syncLoginState()
		if (this.isLoggedIn && this.isEditMode) {
			this.loadDetail()
		}
	},
	onShow() {
		this.syncLoginState()
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
			}
		},
		onTitleInput(value) {
			this.form.title = String(value || '')
		},
		handleDateTypeChange(event = {}) {
			const index = Number(event.index || 0)
			this.form.dateType = DATE_TYPE_OPTIONS[index] || DATE_TYPE_OPTIONS[0]
		},
		handleDateChange(event = {}) {
			this.form.dateValue = event && event.detail ? String(event.detail.value || '') : ''
		},
		handleRepeatTypeChange(event = {}) {
			const index = Number(event.index || 0)
			this.form.repeatType = REPEAT_TYPE_OPTIONS[index] || REPEAT_TYPE_OPTIONS[3]
		},
		handleBackgroundTypeChange(event = {}) {
			const index = Number(event.index || 0)
			this.form.backgroundType = index === 0 ? 'image' : 'color'
			if (this.form.backgroundType === 'color') {
				this.pendingBackgroundFiles = []
				const uploader = this.$refs.backgroundUploader
				if (uploader && typeof uploader.clear === 'function') {
					uploader.clear()
				}
			}
		},
		onBackgroundUploaderChange(files = []) {
			this.pendingBackgroundFiles = Array.isArray(files) ? files : []
		},
		clearBackgroundImage() {
			this.pendingBackgroundFiles = []
			this.form.backgroundImage = {
				url: '',
				file_id: ''
			}
			const uploader = this.$refs.backgroundUploader
			if (uploader && typeof uploader.clear === 'function') {
				uploader.clear()
			}
		},
		setColor(field, color) {
			this.form[field] = color
		},
		handleMaskEnabledChange(event = {}) {
			this.form.maskEnabled = Boolean(event && event.detail ? event.detail.value : false)
		},
		handleMaskOpacityChange(event = {}) {
			const raw = Number(event && event.detail ? event.detail.value : 35)
			this.form.maskOpacity = Math.max(0, Math.min(1, raw / 100))
		},
		async loadDetail() {
			if (!this.anniversaryId || this.loadingDetail) {
				return
			}
			this.loadingDetail = true
			uni.showLoading({
				title: '加载中...',
				mask: true
			})
			try {
				const result = await getAnniversaryApi().getDetail({
					anniversaryId: this.anniversaryId
				})
				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '获取纪念日详情失败')
				}
				const data = result && result.data ? result.data : {}
				const anniversary = data.anniversary || {}
				this.form = {
					title: anniversary.title || '',
					dateType: anniversary.date_type || 'solar',
					dateValue: anniversary.date_value || getTodayDateString(),
					repeatType: anniversary.repeat_type || 'yearly',
					backgroundType: anniversary.background_type || 'color',
					backgroundImage: anniversary.background_image && typeof anniversary.background_image === 'object'
						? {
							url: anniversary.background_image.url || '',
							file_id: anniversary.background_image.file_id || ''
						}
						: { url: '', file_id: '' },
					backgroundColor: anniversary.background_color || '#EC7558',
					fontColor: anniversary.font_color || '#FFFFFF',
					maskEnabled: Boolean(anniversary.mask_enabled !== false),
					maskColor: anniversary.mask_color || '#000000',
					maskOpacity: Number(anniversary.mask_opacity || 0.35)
				}
				this.pendingBackgroundFiles = []
				const uploader = this.$refs.backgroundUploader
				if (uploader && typeof uploader.clear === 'function') {
					uploader.clear()
				}
			} catch (error) {
				console.error('anniversary detail load failed', error)
				uni.showToast({
					title: error.message || '加载失败',
					icon: 'none'
				})
			} finally {
				this.loadingDetail = false
				uni.hideLoading()
			}
		},
		validateForm() {
			const title = String(this.form.title || '').trim()
			if (!title) {
				return '请输入纪念日标题'
			}
			if (title.length > 50) {
				return '标题不能超过 50 个字符'
			}
			if (!parseDateValue(this.form.dateValue)) {
				return '请选择有效日期'
			}
			if (this.form.backgroundType === 'image') {
				const hasPending = Array.isArray(this.pendingBackgroundFiles) && this.pendingBackgroundFiles.length > 0
				const hasSaved = Boolean(this.form.backgroundImage && (this.form.backgroundImage.url || this.form.backgroundImage.file_id))
				if (!hasPending && !hasSaved) {
					return '请选择背景图片'
				}
			}
			return ''
		},
		async handleSave() {
			if (this.saving) {
				return
			}

			const errorMessage = this.validateForm()
			if (errorMessage) {
				uni.showToast({
					title: errorMessage,
					icon: 'none'
				})
				return
			}

			this.saving = true
			uni.showLoading({
				title: '保存中...',
				mask: true
			})

			try {
				let backgroundImage = this.form.backgroundImage
				if (this.form.backgroundType === 'image') {
					const hasPending = Array.isArray(this.pendingBackgroundFiles) && this.pendingBackgroundFiles.length > 0
					if (hasPending) {
						const uploader = this.$refs.backgroundUploader
						if (!uploader || typeof uploader.uploadAll !== 'function') {
							throw new Error('上传组件未就绪')
						}

						const uploadedFiles = await uploader.uploadAll({
							savePath: 'anniversary/backgrounds',
							prefix: 'bg'
						})
						if (!uploadedFiles.length) {
							throw new Error('背景图上传失败，请重试')
						}
						backgroundImage = {
							url: uploadedFiles[0].url || '',
							file_id: uploadedFiles[0].fileId || ''
						}
					}

					const hasImage = Boolean(backgroundImage && (backgroundImage.url || backgroundImage.file_id))
					if (!hasImage) {
						throw new Error('请上传背景图片')
					}
				} else {
					backgroundImage = {
						url: '',
						file_id: ''
					}
				}

				const payload = {
					title: String(this.form.title || '').trim(),
					dateType: this.form.dateType,
					dateValue: this.form.dateValue,
					repeatType: this.form.repeatType,
					style: {
						backgroundType: this.form.backgroundType,
						backgroundImage,
						backgroundColor: this.form.backgroundColor,
						fontColor: this.form.fontColor,
						maskEnabled: this.form.maskEnabled,
						maskColor: this.form.maskColor,
						maskOpacity: Number(this.form.maskOpacity || 0)
					}
				}

				const api = getAnniversaryApi()
				let result = null
				if (this.isEditMode) {
					result = await api.update({
						anniversaryId: this.anniversaryId,
						...payload
					})
				} else {
					result = await api.create(payload)
				}

				if (result && result.errCode && result.errCode !== 0) {
					throw new Error(result.errMsg || '保存失败')
				}

				uni.showToast({
					title: this.isEditMode ? '保存成功' : '创建成功',
					icon: 'success'
				})

				setTimeout(() => {
					uni.navigateBack()
				}, 380)
			} catch (error) {
				console.error('anniversary save failed', error)
				uni.showToast({
					title: error.message || '保存失败',
					icon: 'none'
				})
			} finally {
				this.saving = false
				uni.hideLoading()
			}
		},
		goToLoginPage() {
			const redirect = this.isEditMode
				? `/pages/anniversary/edit?anniversaryId=${this.anniversaryId}`
				: '/pages/anniversary/edit'
			uni.navigateTo({
				url: '/pages/login/index?redirect=' + encodeURIComponent(redirect)
			})
		},
		goBack() {
			uni.navigateBack()
		}
	}
}
</script>

<style>
	.anniversary-edit-page {
		padding-bottom: calc(44rpx + env(safe-area-inset-bottom));
	}

	.form-block + .form-block {
		margin-top: 24rpx;
	}

	.picker-field {
		display: flex;
		align-items: center;
		min-height: 44rpx;
	}

	.picker-field__value {
		font-size: 28rpx;
		color: #5a3427;
	}

	.background-preview {
		position: relative;
		margin-bottom: 14rpx;
		height: 230rpx;
		border-radius: 22rpx;
		overflow: hidden;
		background: #f5efeb;
	}

	.background-preview__image,
	.background-preview__overlay {
		position: absolute;
		inset: 0;
	}

	.background-preview__overlay {
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
		padding: 14rpx;
		box-sizing: border-box;
	}

	.upload-tip {
		display: block;
		padding-bottom: 8rpx;
		font-size: 22rpx;
		color: #9f7568;
	}

	.color-list {
		display: flex;
		flex-wrap: wrap;
		gap: 14rpx;
	}

	.color-item {
		width: 56rpx;
		height: 56rpx;
		border-radius: 50%;
		box-shadow: inset 0 0 0 2rpx rgba(255, 255, 255, 0.7), 0 6rpx 12rpx rgba(0, 0, 0, 0.08);
	}

	.color-item--active {
		box-shadow: inset 0 0 0 4rpx rgba(255, 255, 255, 0.95), 0 0 0 2rpx #ec7558, 0 10rpx 18rpx rgba(236, 117, 88, 0.25);
	}

	.switch-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.switch-row__label {
		margin-bottom: 0;
	}

	.mask-settings {
		margin-top: 16rpx;
		padding: 18rpx 16rpx 6rpx;
		border-radius: 20rpx;
		background: rgba(255, 246, 241, 0.92);
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-top: 14rpx;
	}

	.slider-row__label,
	.slider-row__value {
		font-size: 22rpx;
		color: #8f6a61;
	}

	.slider-row__slider {
		flex: 1;
	}

	.preview-card {
		position: relative;
		border-radius: 28rpx;
		overflow: hidden;
		min-height: 228rpx;
	}

	.preview-card__bg,
	.preview-card__mask,
	.preview-card__content {
		position: absolute;
		inset: 0;
	}

	.preview-card__content {
		z-index: 2;
		display: flex;
		flex-direction: column;
		padding: 28rpx 30rpx;
		box-sizing: border-box;
	}

	.preview-card__title {
		font-size: 34rpx;
		font-weight: 700;
		line-height: 1.4;
		word-break: break-all;
	}

	.preview-card__meta {
		margin-top: 12rpx;
		font-size: 22rpx;
		opacity: 0.95;
	}

	.preview-card__countdown {
		margin-top: auto;
		font-size: 42rpx;
		font-weight: 700;
		line-height: 1.25;
	}

	.actions {
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	}
</style>
