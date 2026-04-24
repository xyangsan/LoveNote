<template>
	<view
		class="love-page anniversary-edit-page"
		:class="{ 'anniversary-edit-page--locked': calendarPopupVisible }"
	>
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
					:padding="['20rpx', '0']"
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
						<text class="love-field-label">日期</text>
						<view @click="openDateCalendar">
							<fui-list-cell
								:padding="['26rpx', '24rpx']"
								background="#fff7f3"
								:bottom-border="false"
								radius="24rpx"
								arrow
								arrow-color="#d2a394"
							>
								<view class="picker-field picker-field--space">
									<view class="picker-field__content">
										<text
											class="picker-field__value"
											:class="{ 'picker-field__value--placeholder': !currentDisplayDateText }"
										>{{ currentDisplayDateText || '请选择日期' }}</text>
									</view>
									<view class="picker-field__tag">
										<text class="picker-field__tag-text">{{ currentDateTypeText }}</text>
									</view>
								</view>
							</fui-list-cell>
						</view>
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
							v-if="false && displayBackgroundPreview"
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
							:crop-options="backgroundCropOptions"
							:show-tips="true"
							tip-text="仅支持图片，超过 5MB 自动压缩。"
							:previewable="true"
							object-fit="aspectFit"
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
					:padding="['20rpx', '0']"
					:content-padding="['0', '0', '0', '0']"
					background="transparent"
				>
					<love-anniversary-card
						:title="form.title"
						:meta-text="`${currentDisplayDateText || '--'} · ${currentDateTypeText} · ${currentRepeatTypeText}`"
						:elapsed-text="previewElapsedText"
						:countdown-text="previewCountdownText"
						:background-style="previewBackgroundStyle"
						:mask-style="previewMaskStyle"
						:text-style="previewTextStyle"
						:mask-enabled="form.maskEnabled"
						:shadow="false"
						:clickable="false"
						height="228rpx"
						radius="28rpx"
					></love-anniversary-card>
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

			<view v-if="calendarPopupVisible" class="calendar-popup" @touchmove.stop.prevent="stopTouchMove">
				<view class="calendar-popup__mask" @click="closeDateCalendar"></view>
				<view class="calendar-popup__panel" @click.stop="handleCalendarPanelClick" @touchmove.stop>
					<view class="calendar-popup__header">
						<text class="calendar-popup__title">选择日期</text>
						<view class="calendar-popup__actions">
							<text class="calendar-popup__action" @click="closeDateCalendar">取消</text>
							<text class="calendar-popup__action calendar-popup__action--primary" @click="confirmDateSelection">确定</text>
						</view>
					</view>

					<view class="calendar-popup__summary">
						<text class="calendar-popup__summary-value">{{ calendarDisplayDateText || '请选择日期' }}</text>
						<view class="calendar-popup__selector-wrap">
							<view class="calendar-popup__selector-inline" @click.stop="toggleCalendarDateTypeDropdown">
								<text class="calendar-popup__selector-value-text">{{ calendarCurrentDateTypeText }}</text>
								<text
									class="calendar-popup__selector-arrow"
									:class="{ 'calendar-popup__selector-arrow--open': calendarDateTypeDropdownVisible }"
								>▼</text>
							</view>
							<view
								v-if="calendarDateTypeDropdownVisible"
								class="calendar-popup__selector-menu"
								@click.stop
							>
								<view
									v-for="(item, index) in dateTypeOptions"
									:key="item"
									class="calendar-popup__selector-option"
									:class="{ 'calendar-popup__selector-option--active': index === calendarDateTypeIndex }"
									@click.stop="selectCalendarDateType(index)"
								>
									<text
										class="calendar-popup__selector-option-text"
										:class="{ 'calendar-popup__selector-option-text--active': index === calendarDateTypeIndex }"
									>{{ item }}</text>
								</view>
							</view>
						</view>
					</view>

					<uni-calendar
						v-if="calendarPopupVisible"
						:insert="true"
						:lunar="true"
						:date="calendarDraft.solarDateValue"
						:start-date="datePickerStart"
						:end-date="datePickerEnd"
						:show-month="false"
						@change="handleCalendarChange"
					></uni-calendar>
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
import { computeAnniversaryCountdown } from '../../common/utils/anniversary-countdown.js'
import LoveAnniversaryCard from './love-anniversary-card.vue'

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

const CHINESE_LUNAR_DAY_TEXT = {
	1: '初一',
	2: '初二',
	3: '初三',
	4: '初四',
	5: '初五',
	6: '初六',
	7: '初七',
	8: '初八',
	9: '初九',
	10: '初十',
	11: '十一',
	12: '十二',
	13: '十三',
	14: '十四',
	15: '十五',
	16: '十六',
	17: '十七',
	18: '十八',
	19: '十九',
	20: '二十',
	21: '廿一',
	22: '廿二',
	23: '廿三',
	24: '廿四',
	25: '廿五',
	26: '廿六',
	27: '廿七',
	28: '廿八',
	29: '廿九',
	30: '三十'
}

function createLunarFormatter() {
	try {
		return new Intl.DateTimeFormat('zh-Hans-CN-u-ca-chinese', {
			year: 'numeric',
			month: 'long',
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

function formatDateValue(date = null) {
	if (!date || Number.isNaN(date.getTime())) {
		return ''
	}
	return `${date.getFullYear()}-${padDateUnit(date.getMonth() + 1)}-${padDateUnit(date.getDate())}`
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

function normalizeDateTimestamp(value, dateValue = '') {
	const raw = Number(value)
	if (Number.isFinite(raw) && raw > 0) {
		return Math.floor(raw)
	}
	const date = parseDateValue(dateValue)
	return date ? date.getTime() : 0
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

function getChineseLunarDayText(day = 0) {
	return CHINESE_LUNAR_DAY_TEXT[Number(day)] || ''
}

function getLunarDateInfo(date = null) {
	if (!LUNAR_FORMATTER || !date || Number.isNaN(date.getTime())) {
		return null
	}

	try {
		const parts = LUNAR_FORMATTER.formatToParts(date)
		const relatedYearText = String((parts.find((part) => part.type === 'relatedYear') || {}).value || '')
		const monthText = String((parts.find((part) => part.type === 'month') || {}).value || '')
		const dayText = String((parts.find((part) => part.type === 'day') || {}).value || '')
		const monthInfo = parseLunarMonth(monthText)
		const day = parseInt(dayText.replace(/[^\d]/g, ''), 10)
		if (!monthInfo.month || Number.isNaN(day) || day < 1 || day > 30) {
			return null
		}
		return {
			year: parseInt(relatedYearText.replace(/[^\d]/g, ''), 10) || 0,
			month: monthInfo.month,
			day,
			isLeap: monthInfo.isLeap,
			monthText,
			dayText: getChineseLunarDayText(day)
		}
	} catch (error) {
		console.warn('getLunarDateInfo failed', error)
		return null
	}
}

function formatLunarDateValueFromInfo(info = null) {
	if (!info) {
		return ''
	}
	const yearText = info.year ? `${info.year}年` : ''
	const monthText = String(info.monthText || '').trim()
	const dayText = String(info.dayText || '').trim()
	return `${yearText}${monthText}${dayText}`.trim()
}

function buildDateSelectionFromSolarValue(value = '') {
	const safeDate = parseDateValue(value) || parseDateValue(getTodayDateString())
	if (!safeDate) {
		return {
			solarDateValue: '',
			lunarDateValue: '',
			selectedTimestamp: 0
		}
	}
	const solarDateValue = formatDateValue(safeDate)
	return {
		solarDateValue,
		lunarDateValue: formatLunarDateValueFromInfo(getLunarDateInfo(safeDate)),
		selectedTimestamp: safeDate.getTime()
	}
}

function formatLunarValueFromCalendarPayload(lunar = {}) {
	if (!lunar || typeof lunar !== 'object') {
		return ''
	}
	const lunarYear = parseInt(lunar.lYear, 10) || 0
	const lunarMonth = String(lunar.IMonthCn || '').trim()
	const lunarDay = String(lunar.IDayCn || '').trim()
	const yearText = lunarYear ? `${lunarYear}年` : ''
	return `${yearText}${lunarMonth}${lunarDay}`.trim()
}

function resolveDisplayDateValue(dateType = 'solar', solarDateValue = '', lunarDateValue = '') {
	if (dateType === 'lunar') {
		return String(lunarDateValue || solarDateValue || '').trim()
	}
	return String(solarDateValue || lunarDateValue || '').trim()
}

function createDefaultForm() {
	const dateSelection = buildDateSelectionFromSolarValue(getTodayDateString())
	return {
		title: '',
		dateType: 'solar',
		dateValue: dateSelection.solarDateValue,
		solarDateValue: dateSelection.solarDateValue,
		lunarDateValue: dateSelection.lunarDateValue,
		selectedTimestamp: dateSelection.selectedTimestamp,
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
	}
}

export default {
	components: {
		LoveAnniversaryCard
	},
	data() {
		return {
			isLoggedIn: false,
			loadingDetail: false,
			saving: false,
			anniversaryId: '',
			pendingBackgroundFiles: [],
			calendarPopupVisible: false,
			calendarDateTypeDropdownVisible: false,
			calendarSelectionMode: 'solar',
			calendarDraft: buildDateSelectionFromSolarValue(getTodayDateString()),
			form: createDefaultForm(),
			dateTypeOptions: ['公历', '农历'],
			repeatTypeOptions: [{ name: '不重复' }, { name: '每周' }, { name: '每月' }, { name: '每年' }],
			backgroundTypeOptions: [{ name: '背景图' }, { name: '背景色' }],
			backgroundCropOptions: {
				enabled: true,
				width: 702,
				height: 228,
				fileType: 'jpg',
				zIndex: 1200
			},
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
		calendarDateTypeIndex() {
			const index = DATE_TYPE_OPTIONS.indexOf(this.calendarSelectionMode)
			return index === -1 ? 0 : index
		},
		repeatTypeIndex() {
			const index = REPEAT_TYPE_OPTIONS.indexOf(this.form.repeatType)
			return index === -1 ? 3 : index
		},
		backgroundTypeIndex() {
			return this.form.backgroundType === 'image' ? 0 : 1
		},
		backgroundUploaderItemWidth() {
			return 646
		},
		backgroundUploaderItemHeight() {
			const cropWidth = Number(this.backgroundCropOptions && this.backgroundCropOptions.width || 0)
			const cropHeight = Number(this.backgroundCropOptions && this.backgroundCropOptions.height || 0)
			if (cropWidth <= 0 || cropHeight <= 0) {
				return this.backgroundUploaderItemWidth
			}
			return Math.max(1, Math.round(this.backgroundUploaderItemWidth * cropHeight / cropWidth))
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
		currentDisplayDateText() {
			return resolveDisplayDateValue(this.form.dateType, this.form.solarDateValue, this.form.lunarDateValue)
		},
		calendarCurrentDateTypeText() {
			return DATE_TYPE_TEXT_MAP[this.calendarSelectionMode] || '公历'
		},
		calendarDisplayDateText() {
			return resolveDisplayDateValue(
				this.calendarSelectionMode,
				this.calendarDraft.solarDateValue,
				this.calendarDraft.lunarDateValue
			)
		},
		currentRepeatTypeText() {
			return REPEAT_TYPE_TEXT_MAP[this.form.repeatType] || '每年'
		},
		previewCountdownInfo() {
			return computeAnniversaryCountdown({
				dateType: this.form.dateType,
				repeatType: this.form.repeatType,
				solarDateValue: this.form.solarDateValue,
				lunarDateValue: this.form.lunarDateValue,
				selectedTimestamp: this.form.selectedTimestamp
			})
		},
		previewCountdownText() {
			return this.previewCountdownInfo.countdownText
		},
		previewElapsedText() {
			return this.previewCountdownInfo.elapsedText
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
		handleCalendarPanelClick() {
			this.closeCalendarDateTypeDropdown()
		},
		stopTouchMove() {},
		toggleCalendarDateTypeDropdown() {
			this.calendarDateTypeDropdownVisible = !this.calendarDateTypeDropdownVisible
		},
		selectCalendarDateType(index = 0) {
			this.calendarSelectionMode = DATE_TYPE_OPTIONS[index] || DATE_TYPE_OPTIONS[0]
			this.closeCalendarDateTypeDropdown()
		},
		closeCalendarDateTypeDropdown() {
			this.calendarDateTypeDropdownVisible = false
		},
		openDateCalendar() {
			const dateSelection = buildDateSelectionFromSolarValue(this.form.solarDateValue || this.form.dateValue)
			this.calendarDraft = {
				solarDateValue: dateSelection.solarDateValue,
				lunarDateValue: this.form.lunarDateValue || dateSelection.lunarDateValue,
				selectedTimestamp: normalizeDateTimestamp(this.form.selectedTimestamp, dateSelection.solarDateValue)
			}
			this.calendarSelectionMode = this.form.dateType || 'solar'
			this.calendarDateTypeDropdownVisible = false
			this.calendarPopupVisible = true
		},
		closeDateCalendar() {
			this.closeCalendarDateTypeDropdown()
			this.calendarPopupVisible = false
		},
		handleCalendarChange(event = {}) {
			const solarDateValue = String(event.fulldate || event.fullDate || '').trim()
			const dateSelection = buildDateSelectionFromSolarValue(solarDateValue)
			if (!dateSelection.solarDateValue) {
				return
			}
			this.calendarDraft = {
				solarDateValue: dateSelection.solarDateValue,
				lunarDateValue: formatLunarValueFromCalendarPayload(event.lunar) || dateSelection.lunarDateValue,
				selectedTimestamp: dateSelection.selectedTimestamp
			}
		},
		confirmDateSelection() {
			if (!parseDateValue(this.calendarDraft.solarDateValue)) {
				uni.showToast({
					title: '请选择有效日期',
					icon: 'none'
				})
				return
			}

			this.form.dateType = this.calendarSelectionMode
			this.form.dateValue = this.calendarDraft.solarDateValue
			this.form.solarDateValue = this.calendarDraft.solarDateValue
			this.form.lunarDateValue = this.calendarDraft.lunarDateValue || buildDateSelectionFromSolarValue(this.calendarDraft.solarDateValue).lunarDateValue
			this.form.selectedTimestamp = normalizeDateTimestamp(
				this.calendarDraft.selectedTimestamp,
				this.calendarDraft.solarDateValue
			)
			this.closeCalendarDateTypeDropdown()
			this.closeDateCalendar()
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
			} else {
				this.syncBackgroundUploader()
			}
		},
		onBackgroundUploaderChange(files = []) {
			const list = Array.isArray(files) ? files : []
			this.pendingBackgroundFiles = list.filter(item => item && item.source !== 'remote')
			if (!list.length) {
				this.form.backgroundImage = {
					url: '',
					file_id: ''
				}
			}
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
		syncBackgroundUploader() {
			this.$nextTick(() => {
				const uploader = this.$refs.backgroundUploader
				if (!uploader || typeof uploader.setFiles !== 'function') {
					return
				}
				const backgroundImage = this.form.backgroundImage && typeof this.form.backgroundImage === 'object'
					? this.form.backgroundImage
					: {}
				const url = String(backgroundImage.url || '').trim()
				const fileId = String(backgroundImage.file_id || backgroundImage.fileId || '').trim()
				if (this.form.backgroundType === 'image' && (url || fileId)) {
					uploader.setFiles([
						{
							path: url || fileId,
							url,
							fileId,
							mediaType: 'image',
							status: 'success',
							source: 'remote'
						}
					], { emit: false })
					return
				}
				uploader.setFiles([], { emit: false })
			})
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
				const defaultForm = createDefaultForm()
				const solarDateValue = anniversary.solar_date_value || anniversary.date_value || defaultForm.solarDateValue
				const dateSelection = buildDateSelectionFromSolarValue(solarDateValue)
				this.form = {
					...defaultForm,
					title: anniversary.title || '',
					dateType: anniversary.date_type || 'solar',
					dateValue: solarDateValue,
					solarDateValue,
					lunarDateValue: anniversary.lunar_date_value || dateSelection.lunarDateValue,
					selectedTimestamp: normalizeDateTimestamp(anniversary.date_timestamp, solarDateValue),
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
				this.syncBackgroundUploader()
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
			if (!parseDateValue(this.form.solarDateValue || this.form.dateValue)) {
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

				const solarDateValue = String(this.form.solarDateValue || this.form.dateValue || '').trim()
				const normalizedDateSelection = buildDateSelectionFromSolarValue(solarDateValue)
				const lunarDateValue = String(this.form.lunarDateValue || normalizedDateSelection.lunarDateValue || '').trim()
				const selectedTimestamp = normalizeDateTimestamp(this.form.selectedTimestamp, solarDateValue)

				const payload = {
					title: String(this.form.title || '').trim(),
					dateType: this.form.dateType,
					dateValue: solarDateValue,
					solarDateValue: solarDateValue || normalizedDateSelection.solarDateValue,
					lunarDateValue,
					selectedTimestamp,
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

	.anniversary-edit-page--locked {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		width: 100%;
		overflow: hidden;
	}

	.form-block + .form-block {
		margin-top: 24rpx;
	}

	.picker-field {
		display: flex;
		align-items: center;
		min-height: 44rpx;
	}

	.picker-field--space {
		width: 100%;
		justify-content: space-between;
		gap: 20rpx;
	}

	.picker-field__content {
		flex: 1;
		min-width: 0;
	}

	.picker-field__value {
		display: block;
		font-size: 28rpx;
		color: #5a3427;
	}

	.picker-field__value--placeholder {
		color: #b18a7d;
	}

	.picker-field__tag {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8rpx 18rpx;
		border-radius: 999rpx;
		background: rgba(236, 117, 88, 0.12);
	}

	.picker-field__tag-text {
		font-size: 22rpx;
		font-weight: 600;
		color: #d56448;
	}

	.calendar-popup {
		position: fixed;
		inset: 0;
		z-index: 30;
	}

	.calendar-popup__mask {
		position: absolute;
		inset: 0;
		background: rgba(55, 31, 24, 0.42);
	}

	.calendar-popup__panel {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(env(safe-area-inset-bottom));
		max-height: calc(100vh - 120rpx);
		padding: 28rpx 24rpx 24rpx;
		border-radius: 32rpx;
		background: #fffaf7;
		box-shadow: 0 22rpx 60rpx rgba(103, 58, 45, 0.22);
		overflow: hidden auto;
	}

	.calendar-popup__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		margin-bottom: 24rpx;
	}

	.calendar-popup__title {
		font-size: 30rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.calendar-popup__actions {
		display: flex;
		align-items: center;
		gap: 24rpx;
	}

	.calendar-popup__action {
		font-size: 26rpx;
		color: #8b6a60;
	}

	.calendar-popup__action--primary {
		font-weight: 700;
		color: #e76f51;
	}

	.calendar-popup__selector-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.calendar-popup__selector-inline {
		display: flex;
		align-items: center;
		gap: 12rpx;
		padding: 12rpx 18rpx;
		border-radius: 999rpx;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(236, 117, 88, 0.2);
	}

	.calendar-popup__selector-value-text {
		font-size: 24rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.calendar-popup__selector-arrow {
		font-size: 18rpx;
		color: #d27761;
		transition: transform 0.2s ease;
	}

	.calendar-popup__selector-arrow--open {
		transform: rotate(180deg);
	}

	.calendar-popup__selector-menu {
		position: absolute;
		top: calc(100% + 12rpx);
		right: 0;
		min-width: 140rpx;
		padding: 10rpx;
		border-radius: 20rpx;
		background: rgba(255, 250, 247, 0.98);
		border: 1px solid rgba(236, 117, 88, 0.14);
		box-shadow: 0 14rpx 36rpx rgba(115, 67, 52, 0.16);
		z-index: 8;
	}

	.calendar-popup__selector-option {
		padding: 16rpx 18rpx;
		border-radius: 14rpx;
	}

	.calendar-popup__selector-option + .calendar-popup__selector-option {
		margin-top: 6rpx;
	}

	.calendar-popup__selector-option--active {
		background: rgba(236, 117, 88, 0.14);
	}

	.calendar-popup__selector-option-text {
		display: block;
		font-size: 24rpx;
		line-height: 1.4;
		color: #6f4a3f;
		text-align: center;
	}

	.calendar-popup__selector-option-text--active {
		font-weight: 700;
		color: #e76f51;
	}

	.calendar-popup__summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		padding: 22rpx 20rpx;
		margin: 0 0 16rpx;
		border-radius: 24rpx;
		background: #fff2ec;
	}

	.calendar-popup__summary-value {
		flex: 1;
		min-width: 0;
		font-size: 30rpx;
		font-weight: 700;
		line-height: 1.4;
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

	.actions {
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	}
</style>
