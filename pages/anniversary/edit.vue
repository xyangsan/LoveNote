<template>
	<view
		class="ae-page"
		:class="[{ 'anniversary-edit-page--locked': calendarPopupVisible }, themeClass]"
	>
		<view class="ae-glow ae-glow--l"></view>
		<view class="ae-glow ae-glow--r"></view>

		<noir-navbar
			:title="pageTitle"
			:show-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
		>
			<template #right>
				<view v-if="isEditMode && canDelete" class="ae-del-pill" @tap="handleDelete">
					<text class="ae-del-pill__txt">删除</text>
				</view>
			</template>
		</noir-navbar>

		<view class="ae-wrap">
			<love-auth-required
				v-if="!isLoggedIn"
				desc="请先登录后再编辑纪念日。"
				secondary-text="返回纪念日列表"
				@login="goToLoginPage"
				@secondary="goBack"
			></love-auth-required>

			<view v-else>
				<!-- 顶部实时封面预览（18 编辑纪念日设计稿） -->
				<view class="ae-preview">
					<love-anniversary-card
						:title="form.title || '未命名纪念日'"
						:meta-text="`${currentDisplayDateText || '--'} · ${currentDateTypeText} · ${currentRepeatTypeText}`"
						:elapsed-text="previewElapsedText"
						:countdown-text="previewCountdownText"
						:background-style="previewBackgroundStyle"
						:mask-style="previewMaskStyle"
						:text-style="previewTextStyle"
						:mask-enabled="form.maskEnabled"
						:shadow="false"
						:clickable="false"
						height="252rpx"
						radius="28rpx"
					></love-anniversary-card>
				</view>

				<!-- 封面暗色遮罩浓度滑块 -->
				<view class="ae-slider-card">
					<view class="ae-shead">
						<text class="ae-shead__lbl">封面暗色遮罩</text>
						<view class="ae-shead__right">
							<text v-if="form.maskEnabled" class="ae-shead__val">{{ maskOpacityPercent }}%</text>
							<fui-switch
								:checked="form.maskEnabled"
								color="var(--noir-coral)"
								scale-ratio="0.82"
								@change="handleMaskEnabledChange"
							></fui-switch>
						</view>
					</view>
					<template v-if="form.maskEnabled">
						<slider
							class="ae-slider"
							min="0"
							max="100"
							step="1"
							:value="maskOpacityPercent"
							activeColor="var(--noir-gold)"
							backgroundColor="rgba(var(--noir-wash-rgb), 0.12)"
							block-color="var(--noir-text-strong)"
							:block-size="16"
							@changing="handleMaskOpacityChange"
							@change="handleMaskOpacityChange"
						/>
						<view class="color-list ae-mask-colors">
							<view
								v-for="color in maskColorOptions"
								:key="`mask-${color}`"
								class="color-item color-item--sm"
								:class="{ 'color-item--active': form.maskColor === color }"
								:style="{ backgroundColor: color }"
								@tap="setColor('maskColor', color)"
							></view>
						</view>
					</template>
				</view>

				<!-- 核心表单卡片 -->
				<view class="ae-sec">
					<noir-card padding="4rpx 26rpx">
						<!-- 标题 -->
						<view class="ae-row">
							<text class="ae-row__lbl">标题（必填）</text>
							<input
								class="ae-input"
								:value="form.title"
								type="text"
								placeholder="例如：第一次旅行"
								placeholder-style="color: rgba(var(--noir-text-rgb), 0.30);"
								maxlength="50"
								@input="onNativeTitleInput"
							/>
						</view>

						<!-- 历法 -->
						<view class="ae-row">
							<text class="ae-row__lbl">历法</text>
							<view class="ae-inline-chips">
								<view
									class="ae-chip"
									:class="{ 'is-on': form.dateType === 'solar' }"
									@tap="switchFormDateType('solar')"
								>
									<text class="ae-chip__txt">公历</text>
								</view>
								<view
									class="ae-chip"
									:class="{ 'is-on': form.dateType === 'lunar' }"
									@tap="switchFormDateType('lunar')"
								>
									<text class="ae-chip__txt">农历</text>
								</view>
							</view>
						</view>

						<!-- 日期 -->
						<view class="ae-row ae-row--last" @tap="openDateCalendar">
							<text class="ae-row__lbl">日期</text>
							<view class="ae-row__val-wrap">
								<text
									class="ae-row__val"
									:class="{ 'is-placeholder': !currentDisplayDateText }"
								>{{ currentDisplayDateText || '请选择日期' }}</text>
								<text class="ae-row__chev">›</text>
							</view>
						</view>
					</noir-card>
				</view>

				<!-- 重复规则（4 种） -->
				<view class="ae-sec">
					<text class="ae-sec__lbl">重复规则（4 种）</text>
					<view class="ae-chips">
						<view
							v-for="(item, idx) in repeatTypeOptions"
							:key="item.name"
							class="ae-chip"
							:class="{ 'is-on': idx === repeatTypeIndex }"
							@tap="handleRepeatTypeChange({ index: idx })"
						>
							<text class="ae-chip__txt">{{ item.name }}</text>
						</view>
					</view>
				</view>

				<!-- 封面背景与字体外观 -->
				<view class="ae-sec">
					<text class="ae-sec__lbl">封面背景与字体</text>
					<noir-card padding="24rpx">
						<view class="ae-bg-mode">
							<view
								v-for="(item, idx) in backgroundTypeOptions"
								:key="item.name"
								class="ae-chip"
								:class="{ 'is-on': idx === backgroundTypeIndex }"
								@tap="handleBackgroundTypeChange({ index: idx })"
							>
								<text class="ae-chip__txt">{{ item.name }}</text>
							</view>
						</view>

						<view v-if="form.backgroundType === 'image'" class="ae-block">
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
								tip-text="支持图片封面，超过 5MB 自动压缩。"
								:previewable="true"
								object-fit="aspectFit"
								:source-type="['album', 'camera']"
								:show-delete-button="true"
								add-text="选择封面图"
								upload-icon="＋"
								@change="onBackgroundUploaderChange"
							>
								<template #tip>
									<text class="upload-tip">支持图片封面，超过 5MB 自动压缩。</text>
								</template>
							</love-media-uploader>
						</view>

						<view v-else class="ae-block">
							<text class="ae-sub-lbl">背景色</text>
							<view class="color-list">
								<view
									v-for="color in backgroundColorOptions"
									:key="`bg-${color}`"
									class="color-item"
									:class="{ 'color-item--active': form.backgroundColor === color }"
									:style="{ backgroundColor: color }"
									@tap="setColor('backgroundColor', color)"
								></view>
								<view
									class="color-item color-item--custom"
									:class="{ 'color-item--active': isCustomColorActive('backgroundColor', backgroundColorOptions) }"
									@tap="openCustomColorPicker('backgroundColor')"
								></view>
							</view>
						</view>

						<view class="ae-block">
							<text class="ae-sub-lbl">字体色</text>
							<view class="color-list">
								<view
									v-for="color in fontColorOptions"
									:key="`font-${color}`"
									class="color-item"
									:class="{ 'color-item--active': form.fontColor === color }"
									:style="{ backgroundColor: color }"
									@tap="setColor('fontColor', color)"
								></view>
								<view
									class="color-item color-item--custom"
									:class="{ 'color-item--active': isCustomColorActive('fontColor', fontColorOptions) }"
									@tap="openCustomColorPicker('fontColor')"
								></view>
							</view>
						</view>
					</noir-card>
				</view>

				<!-- 广告位（位于保存按钮上方） -->
				<view class="ad-view ae-ad">
					<ad unit-id="adunit-230be1ed0ea4b29b"></ad>
				</view>
			</view>

			<!-- 底部固定主操作栏 -->
			<view v-if="isLoggedIn" class="ae-footer">
				<noir-button
					:text="saveButtonText"
					variant="primary"
					size="lg"
					block
					:loading="saving"
					@click="handleSave"
				/>
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
		<uv-pick-color
			ref="backgroundColorPicker"
			:color="backgroundPickerColor"
			title="选择背景色"
			confirm-color="var(--noir-coral)"
			@confirm="handleCustomColorConfirm('backgroundColor', $event)"
		></uv-pick-color>
		<uv-pick-color
			ref="fontColorPicker"
			:color="fontPickerColor"
			title="选择字体色"
			confirm-color="var(--noir-coral)"
			@confirm="handleCustomColorConfirm('fontColor', $event)"
		></uv-pick-color>
	</view>
</template>

<script>
import { getThemeCoral } from '@/common/theme.js'
	import {
	clearUniIdTokenStorage,
	getCurrentUniIdUser
} from '../../common/auth-center.js'
import { getAnniversaryApi } from '../../common/api/anniversary.js'
import { computeAnniversaryCountdown } from '../../common/utils/anniversary-countdown.js'
import LoveAnniversaryCard from './love-anniversary-card.vue'
import { requirePageLogin } from '@/common/auth-entry.js'

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

function normalizeHexColor(value = '', fallback = '#000000') {
	const color = String(value || '').trim()
	if (/^#[\da-fA-F]{6}$/.test(color)) {
		return color.toUpperCase()
	}
	if (/^#[\da-fA-F]{3}$/.test(color)) {
		return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`.toUpperCase()
	}
	return fallback
}

function hexToRgba(value = '', fallback = '#000000') {
	const color = normalizeHexColor(value, fallback).replace('#', '')
	return {
		r: parseInt(color.slice(0, 2), 16),
		g: parseInt(color.slice(2, 4), 16),
		b: parseInt(color.slice(4, 6), 16),
		a: 1
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
			scrollTop: 0,
			canDelete: false,
			repeatTypeOptions: [{ name: '不重复' }, { name: '每周重复' }, { name: '每月重复' }, { name: '每年重复' }],
			backgroundTypeOptions: [{ name: '背景图' }, { name: '背景色' }],
			backgroundCropOptions: {
				enabled: true,
				width: 702,
				height: 228,
				fileType: 'jpg',
				zIndex: 1200
			},
			backgroundColorOptions: ['#EC7558', '#FA856A', '#F59E7C', '#E2643F', '#D96C6C', '#8CC0DE'],
			fontColorOptions: ['#FFFFFF', '#FFF5E8', '#3F2A24', '#FBF4EA', '#1F1F1F'],
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
			return this.isEditMode ? '保存修改' : '保存纪念日 (+5点)'
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
		backgroundPickerColor() {
			return hexToRgba(this.form.backgroundColor, '#EC7558')
		},
		fontPickerColor() {
			return hexToRgba(this.form.fontColor, '#FFFFFF')
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
		// 未登录先跳登录页，登录成功后由登录页 redirect 回本页（分享 / 扫码可直接落地本页）
		if (!requirePageLogin()) return
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
		onNativeTitleInput(event = {}) {
			this.form.title = String((event && event.detail && event.detail.value) || '')
		},
		switchFormDateType(type = 'solar') {
			const safeType = type === 'lunar' ? 'lunar' : 'solar'
			this.form.dateType = safeType
			if (safeType === 'lunar' && !this.form.lunarDateValue) {
				const sel = buildDateSelectionFromSolarValue(this.form.solarDateValue || this.form.dateValue)
				this.form.lunarDateValue = sel.lunarDateValue
			}
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
		isCustomColorActive(field, options = []) {
			const color = normalizeHexColor(this.form[field] || '', '')
			return Boolean(color && !options.includes(color))
		},
		openCustomColorPicker(field) {
			const refName = field === 'fontColor' ? 'fontColorPicker' : 'backgroundColorPicker'
			const fallback = field === 'fontColor' ? '#FFFFFF' : '#EC7558'
			const picker = this.$refs[refName]
			if (!picker || typeof picker.open !== 'function') {
				return
			}
			picker.rgba = hexToRgba(this.form[field], fallback)
			if (typeof picker.init === 'function') {
				picker.init()
			}
			picker.open()
		},
		handleCustomColorConfirm(field, event = {}) {
			const color = normalizeHexColor(event.hex || '', '')
			if (!color) {
				return
			}
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
				this.canDelete = Boolean(anniversary.is_self === true)
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
			// ⚠️ 微信小程序 showLoading / showToast 共用同一个提示槽：hideLoading 会把刚弹出的 toast
			// 一起关掉。原来放在 finally 里，成功和失败的提示都会被瞬间吞掉（失败时用户以为保存成功，
			// 回到列表又看不到新数据）。改成：弹 toast 之前先关 loading，且只关一次。
			let savingLoadingVisible = true
			const hideSavingLoading = () => {
				if (!savingLoadingVisible) {
					return
				}
				savingLoadingVisible = false
				uni.hideLoading()
			}

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

				hideSavingLoading()
				uni.showToast({
					title: this.isEditMode ? '保存成功' : '创建成功',
					icon: 'success'
				})

				setTimeout(() => {
					uni.navigateBack()
				}, 380)
			} catch (error) {
				console.error('anniversary save failed', error)
				hideSavingLoading()
				uni.showToast({
					title: error.message || '保存失败',
					icon: 'none'
				})
			} finally {
				this.saving = false
			}
		},
		goToLoginPage() {
			const redirect = this.isEditMode
				? `/pages/anniversary/edit?anniversaryId=${this.anniversaryId}`
				: '/pages/anniversary/edit'
			uni.redirectTo({
				url: '/pages/login/index?redirect=' + encodeURIComponent(redirect)
			})
		},
		goBack() {
			uni.navigateBack()
		},
		handleDelete() {
			if (!this.anniversaryId || !this.canDelete) return
			uni.showModal({
				title: '删除纪念日',
				content: `确定删除「${this.form.title || '该纪念日'}」吗？删除后无法恢复。`,
				confirmColor: getThemeCoral(),
				success: async (res) => {
					if (!res.confirm) return
					try {
						const result = await getAnniversaryApi().delete({ anniversaryId: this.anniversaryId })
						if (result && result.errCode && result.errCode !== 0) {
							throw new Error(result.errMsg || '删除失败')
						}
						uni.showToast({ title: '已删除', icon: 'success' })
						setTimeout(() => uni.navigateBack(), 400)
					} catch (error) {
						uni.showToast({ title: error.message || '删除失败', icon: 'none' })
					}
				}
			})
		}
	},
	onPageScroll(e) {
		const next = Math.max(0, Number((e && e.scrollTop) || 0))
		if (next !== this.scrollTop) {
			this.scrollTop = next
		}
	}
}
</script>

<style>
	.ae-page {
		position: relative;
		min-height: 100vh;
		background:
			radial-gradient(88% 40% at 50% 0%, var(--noir-page-glow) 0%, rgba(var(--noir-bg-rgb), 0) 68%),
			var(--noir-bg);
		padding-bottom: calc(168rpx + env(safe-area-inset-bottom));
		overflow-x: hidden;
	}

	.ae-glow {
		position: fixed;
		width: 360rpx;
		height: 360rpx;
		border-radius: 50%;
		filter: blur(50rpx);
		opacity: 0.22;
		pointer-events: none;
		z-index: 0;
	}

	.ae-glow--l {
		top: -120rpx;
		left: -130rpx;
		background: rgba(var(--noir-coral-rgb), 0.36);
	}

	.ae-glow--r {
		top: 240rpx;
		right: -130rpx;
		background: rgba(var(--noir-gold-rgb), 0.24);
	}

	.ae-del-pill {
		height: 48rpx;
		padding: 0 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.44);
		background: rgba(var(--noir-coral-rgb), 0.14);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.ae-del-pill__txt {
		font-size: 21rpx;
		color: var(--noir-coral-light);
		white-space: nowrap;
	}

	.ae-wrap {
		position: relative;
		z-index: 1;
		padding: 12rpx 28rpx 0;
	}

	.ae-preview {
		border-radius: 28rpx;
		overflow: hidden;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.28);
		box-shadow: 0 18rpx 44rpx rgba(var(--noir-shadow-rgb), 0.42);
	}

	.ae-slider-card {
		margin-top: 20rpx;
		padding: 20rpx 24rpx;
		border-radius: 24rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
	}

	.ae-shead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.ae-shead__lbl {
		font-size: 24rpx;
		color: rgba(var(--noir-text-rgb), 0.68);
	}

	.ae-shead__right {
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.ae-shead__val {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 22rpx;
		color: var(--noir-gold-soft);
	}

	.ae-slider {
		margin: 14rpx 0 8rpx;
	}

	.ae-mask-colors {
		margin-top: 10rpx;
	}

	.ae-sec {
		margin-top: 24rpx;
	}

	.ae-sec__lbl {
		display: block;
		margin-bottom: 14rpx;
		padding-left: 4rpx;
		font-size: 22rpx;
		color: rgba(var(--noir-text-rgb), 0.54);
	}

	.ae-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		min-height: 94rpx;
		border-bottom: 1rpx solid rgba(var(--noir-wash-rgb), 0.06);
	}

	.ae-row--last {
		border-bottom: none;
	}

	.ae-row__lbl {
		font-size: 25rpx;
		color: rgba(var(--noir-text-rgb), 0.66);
		flex-shrink: 0;
	}

	.ae-input {
		flex: 1;
		min-width: 0;
		text-align: right;
		font-size: 26rpx;
		color: var(--noir-text-strong);
	}

	.ae-inline-chips,
	.ae-chips,
	.ae-bg-mode {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}

	.ae-chip {
		height: 54rpx;
		padding: 0 24rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.10);
		background: var(--noir-surface-glass);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.ae-chip.is-on {
		border-color: rgba(var(--noir-gold-rgb), 0.62);
		background: rgba(var(--noir-gold-rgb), 0.18);
	}

	.ae-chip__txt {
		font-size: 22rpx;
		color: rgba(var(--noir-text-rgb), 0.66);
		white-space: nowrap;
	}

	.ae-chip.is-on .ae-chip__txt {
		color: var(--noir-text-strong);
		font-weight: 500;
	}

	.ae-row__val-wrap {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10rpx;
	}

	.ae-row__val {
		font-size: 25rpx;
		color: var(--noir-gold-soft);
		font-family: "SF Mono", "Consolas", monospace;
	}

	.ae-row__val.is-placeholder {
		color: rgba(var(--noir-text-rgb), 0.34);
		font-family: inherit;
	}

	.ae-row__chev {
		font-size: 32rpx;
		color: rgba(var(--noir-gold-rgb), 0.56);
	}

	.ae-block {
		margin-top: 22rpx;
	}

	.ae-sub-lbl {
		display: block;
		margin-bottom: 14rpx;
		font-size: 22rpx;
		color: rgba(var(--noir-text-rgb), 0.52);
	}

	.color-item--sm {
		width: 44rpx;
		height: 44rpx;
	}

	.ae-ad {
		margin-top: 26rpx;
	}

	.ae-footer {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		padding: 18rpx 28rpx calc(20rpx + env(safe-area-inset-bottom));
		background: linear-gradient(180deg, rgba(var(--noir-bg-rgb), 0) 0%, rgba(var(--noir-bg-rgb), 0.94) 30%, var(--noir-bg) 100%);
		box-sizing: border-box;
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
		color: var(--noir-text-strong);
	}

	.picker-field__value--placeholder {
		color: var(--anniv-12);
	}

	.picker-field__tag {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 8rpx 18rpx;
		border-radius: 999rpx;
		background: rgba(var(--noir-coral-rgb), 0.12);
	}

	.picker-field__tag-text {
		font-size: 22rpx;
		font-weight: 600;
		color: var(--anniv-08);
	}

	.calendar-popup {
		position: fixed;
		inset: 0;
		z-index: 30;
	}

	.calendar-popup__mask {
		position: absolute;
		inset: 0;
		background: rgba(var(--anniv-01-rgb), 0.42);
	}

	.calendar-popup__panel {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(env(safe-area-inset-bottom));
		max-height: calc(100vh - 120rpx);
		padding: 28rpx 24rpx 24rpx;
		border-radius: 32rpx;
		background: var(--noir-sheet-hi);
		box-shadow: 0 22rpx 60rpx rgba(var(--anniv-02-rgb), 0.22);
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
		color: var(--noir-text-strong);
	}

	.calendar-popup__actions {
		display: flex;
		align-items: center;
		gap: 24rpx;
	}

	.calendar-popup__action {
		font-size: 26rpx;
		color: var(--anniv-05);
	}

	.calendar-popup__action--primary {
		font-weight: 700;
		color: var(--noir-coral);
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
		background: rgba(var(--noir-surface2-rgb), 0.94);
		border: 1px solid rgba(var(--noir-coral-rgb), 0.2);
	}

	.calendar-popup__selector-value-text {
		font-size: 24rpx;
		font-weight: 700;
		color: var(--noir-text-strong);
	}

	.calendar-popup__selector-arrow {
		font-size: 18rpx;
		color: var(--anniv-11);
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
		background: rgba(var(--noir-surface2-rgb), 0.94);
		border: 1px solid rgba(var(--noir-coral-rgb), 0.14);
		box-shadow: 0 14rpx 36rpx rgba(var(--anniv-03-rgb), 0.16);
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
		background: rgba(var(--noir-coral-rgb), 0.14);
	}

	.calendar-popup__selector-option-text {
		display: block;
		font-size: 24rpx;
		line-height: 1.4;
		color: var(--anniv-04);
		text-align: center;
	}

	.calendar-popup__selector-option-text--active {
		font-weight: 700;
		color: var(--noir-coral);
	}

	.calendar-popup__summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		padding: 22rpx 20rpx;
		margin: 0 0 16rpx;
		border-radius: 24rpx;
		background: var(--noir-surface-2);
	}

	.calendar-popup__summary-value {
		flex: 1;
		min-width: 0;
		font-size: 30rpx;
		font-weight: 700;
		line-height: 1.4;
		color: var(--noir-text-strong);
	}

	.background-preview {
		position: relative;
		margin-bottom: 14rpx;
		height: 230rpx;
		border-radius: 22rpx;
		overflow: hidden;
		background: var(--anniv-17);
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
		color: var(--anniv-07);
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
		box-shadow: inset 0 0 0 2rpx rgba(var(--noir-wash-rgb), 0.04), 0 6rpx 12rpx rgba(var(--noir-shadow-rgb), 0.08);
	}

	.color-item--custom {
		position: relative;
		background: conic-gradient(from 90deg, var(--anniv-09), var(--anniv-15), var(--anniv-14), var(--anniv-13), var(--anniv-10), var(--anniv-09));
	}

	.color-item--custom::after {
		content: '';
		position: absolute;
		inset: 12rpx;
		border-radius: 50%;
		background: rgba(var(--noir-surface2-rgb), 0.94);
		box-shadow: inset 0 0 0 1rpx rgba(var(--noir-coral-rgb), 0.12);
	}

	.color-item--active {
		box-shadow: inset 0 0 0 4rpx rgba(var(--noir-surface2-rgb), 0.94), 0 0 0 2rpx var(--noir-coral), 0 10rpx 18rpx rgba(var(--noir-coral-rgb), 0.25);
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
		background: var(--noir-surface-glass);
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
		color: var(--anniv-06);
	}

	.slider-row__slider {
		flex: 1;
	}

	.actions {
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
	}
</style>
