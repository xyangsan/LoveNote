<template>
	<view class="love-page love-page--compact ops-page" :class="themeClass">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<noir-navbar
			title="运营管理"
			:show-back="true"
			:custom-back="true"
			:transparent="true"
			:border="false"
			:scroll-top="scrollTop"
			@back="goBack"
		>
		</noir-navbar>
		<view class="love-layer">

			<!-- Tab -->
			<view class="ops-tabs">
				<view
					v-for="(tab, index) in tabs"
					:key="tab.key"
					class="ops-tabs__item"
					@click="switchTab(index)"
				>
					<text class="ops-tabs__label" :class="{ 'ops-tabs__label--active': activeTab === index }">
						{{ tab.label }}
					</text>
					<view class="ops-tabs__indicator" :class="{ 'ops-tabs__indicator--active': activeTab === index }"></view>
				</view>
			</view>

			<!-- 时间筛选（广告 / 权限 tab 不需要，这里只服务总览与模块） -->
			<view v-if="currentTabKey === 'overview' || currentTabKey === 'modules'" class="ops-filter">
				<view class="ops-filter__chips">
					<view
						v-for="item in rangeOptions"
						:key="item.key"
						class="ops-chip"
						:class="{ 'ops-chip--active': rangeKey === item.key }"
						@click="selectRange(item.key)"
					>
						<text class="ops-chip__text" :class="{ 'ops-chip__text--active': rangeKey === item.key }">
							{{ item.label }}
						</text>
					</view>
				</view>

				<view class="ops-date" :class="{ 'ops-date--active': rangeKey === 'custom' }">
					<picker mode="date" :value="startDate" :end="endDate" @change="onStartChange">
						<text class="ops-date__text">{{ shortDate(startDate) }}</text>
					</picker>
					<text class="ops-date__sep">-</text>
					<picker mode="date" :value="endDate" :start="startDate" @change="onEndChange">
						<text class="ops-date__text">{{ shortDate(endDate) }}</text>
					</picker>
				</view>
			</view>

			<!-- 无权限 -->
			<view v-if="permissionDenied" class="ops-forbidden">
				<text class="ops-forbidden__title">暂无管理权限</text>
				<text class="ops-forbidden__desc">该页面仅 admin 角色可访问，如需开通请联系管理员。</text>
			</view>

			<template v-else>
				<!-- ============ 总览 ============ -->
				<view v-if="currentTabKey === 'overview'" class="ops-body">
					<view v-if="loading.overview && !overview.summary" class="ops-loading">
						<text class="ops-loading__text">加载中…</text>
					</view>

					<template v-else-if="overview.summary">
						<view class="ops-hero">
							<view class="ops-hero__head">
								<text class="ops-hero__label">平台注册用户</text>
								<view class="ops-hero__badge">
									<text class="ops-hero__badge-text">今日 +{{ formatNumber(overview.summary.newUsersToday) }}</text>
								</view>
							</view>
							<view class="ops-hero__amount">
								<text class="ops-hero__number">{{ formatNumber(overview.summary.totalUsers) }}</text>
								<text class="ops-hero__unit">人</text>
							</view>
							<view class="ops-hero__divider"></view>
							<view class="ops-hero__grid">
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ formatNumber(overview.summary.boundCouples) }}</text>
									<text class="ops-hero__cell-label">情侣绑定（对）</text>
								</view>
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ overview.summary.bindRate }}%</text>
									<text class="ops-hero__cell-label">情侣绑定率</text>
								</view>
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ formatNumber(overview.summary.activeToday) }}</text>
									<text class="ops-hero__cell-label">今日登录（人）</text>
								</view>
							</view>
						</view>

						<view class="ops-card ops-today">
							<view
								v-for="item in todayCards"
								:key="item.key"
								class="ops-today__cell"
							>
								<text class="ops-today__label">{{ item.label }}</text>
								<text class="ops-today__value">{{ formatNumber(item.value) }}</text>
								<text class="ops-today__delta" :class="'ops-today__delta--' + item.deltaClass">{{ item.deltaText }}</text>
							</view>
						</view>

						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">新增用户趋势</text>
								<text class="ops-card__hint">{{ overview.range ? overview.range.label : '' }}</text>
							</view>
							<view class="ops-chart-box">
								<xtf-charts
									:option="userTrendOption"
									canvas-id="ops-user-trend"
									:height="chartHeights.trend"
									:scrollable="false"
								></xtf-charts>
							</view>
							<text class="ops-chart__summary">
								区间新增 {{ formatNumber(trendTotal) }} 人 · 日均 {{ trendAverage }} 人
							</text>
						</view>

						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">访问与登录趋势</text>
								<text class="ops-card__hint">{{ overview.range ? overview.range.label : '' }}</text>
							</view>
							<view class="ops-chart-box">
								<xtf-charts
									:option="visitTrendOption"
									canvas-id="ops-visit-trend"
									:height="chartHeights.trend"
									:scrollable="false"
								></xtf-charts>
							</view>
							<view class="ops-chart__metrics">
								<view class="ops-chart__metric">
									<text class="ops-chart__metric-label">区间访问 UV</text>
									<text class="ops-chart__metric-value">{{ formatNumber(overview.rangeTotals.visits) }}</text>
								</view>
								<view class="ops-chart__metric">
									<text class="ops-chart__metric-label">区间登录</text>
									<text class="ops-chart__metric-value">{{ formatNumber(overview.rangeTotals.logins) }}</text>
								</view>
								<view class="ops-chart__metric">
									<text class="ops-chart__metric-label">区间绑定</text>
									<text class="ops-chart__metric-value">{{ formatNumber(overview.rangeTotals.bindings) }}</text>
								</view>
							</view>
						</view>

						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">访问与转化</text>
								<text class="ops-card__hint">今日</text>
							</view>
							<!-- 转化步骤：用占比条而不是漏斗 —— 量为 1 / 0 时漏斗的窄条放不下文字 -->
							<view v-if="hasFunnelData" class="ops-steps">
								<view
									v-for="row in funnelRows"
									:key="row.key"
									class="ops-step"
								>
									<view class="ops-step__head">
										<view class="ops-step__dot" :style="{ background: row.color }"></view>
										<text class="ops-step__name">{{ row.name }}</text>
										<text class="ops-step__value">{{ formatNumber(row.value) }}</text>
									</view>
									<view class="ops-step__track">
										<view
											class="ops-step__bar"
											:style="{ width: row.barWidth + '%', background: row.color }"
										></view>
									</view>
									<text class="ops-step__sub">{{ row.sub }}</text>
								</view>
							</view>
						</view>

						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">反馈处理</text>
								<text class="ops-card__link" @click="goFeedbackList">查看全部</text>
							</view>
							<view class="ops-feedback">
								<view class="ops-feedback__main">
									<text class="ops-feedback__num">{{ overview.feedback.pending }}</text>
									<text class="ops-feedback__label">条待处理</text>
								</view>
								<text class="ops-feedback__rest">
									共 {{ overview.feedback.total || 0 }} 条 · 已回复 {{ overview.feedback.replied }} · 已解决 {{ overview.feedback.resolved }}
								</text>
							</view>
						</view>
					</template>
				</view>

				<!-- ============ 模块 ============ -->
				<view v-else-if="currentTabKey === 'modules'" class="ops-body">
					<view v-if="loading.modules && !moduleStats.modules" class="ops-loading">
						<text class="ops-loading__text">加载中…</text>
					</view>

					<template v-else-if="moduleStats.modules">
						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">内容总量</text>
								<text class="ops-card__hint">全模块累计</text>
							</view>
							<view class="ops-summary-row">
								<view class="ops-summary-row__cell">
									<text class="ops-summary-row__value">{{ formatNumber(moduleStats.contentTotal) }}</text>
									<text class="ops-summary-row__label">条内容</text>
								</view>
								<view class="ops-summary-row__cell">
									<text class="ops-summary-row__value">{{ avgContentPerUser }}</text>
									<text class="ops-summary-row__label">人均条数</text>
								</view>
								<view class="ops-summary-row__cell">
									<text class="ops-summary-row__value ops-summary-row__value--accent">
										{{ moduleStats.totalUsers }}
									</text>
									<text class="ops-summary-row__label">注册用户</text>
								</view>
							</view>
						</view>

						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">模块渗透率</text>
								<text class="ops-card__hint">参与用户 ÷ 注册用户</text>
							</view>
							<view class="ops-chart-box">
								<xtf-charts
									:option="moduleChartOption"
									canvas-id="ops-module-rate"
									:height="chartHeights.modules"
									:scrollable="false"
								></xtf-charts>
							</view>
						</view>

						<view class="ops-modules">
							<view
								v-for="item in moduleStats.modules"
								:key="item.key"
								class="ops-module"
							>
								<view class="ops-module__head">
									<text class="ops-module__name">{{ item.name }}</text>
									<text class="ops-module__penetration">{{ item.penetration }}%</text>
								</view>
								<view class="ops-module__value-row">
									<text class="ops-module__value">{{ formatNumber(item.total) }}</text>
									<text class="ops-module__unit">{{ item.unit }}</text>
								</view>
								<text class="ops-module__meta">
									{{ formatNumber(item.users) }} 人参与<text v-if="item.extra"> · {{ item.extra.label }} {{ item.extra.value }}{{ item.extra.suffix }}</text>
								</text>
								<view class="ops-module__track">
									<view
										class="ops-module__bar"
										:style="{ width: Math.min(item.penetration, 100) + '%' }"
									></view>
								</view>
							</view>
						</view>
					</template>
				</view>

				<!-- ============ 广告 ============ -->
				<view v-else-if="currentTabKey === 'ads'" class="ops-body">
					<view v-if="loading.ads && !adStats.summary" class="ops-loading">
						<text class="ops-loading__text">加载中…</text>
					</view>

					<template v-else-if="adStats.summary">
						<!-- 昨日同步状态 -->
						<view class="ops-sync" :class="'ops-sync--' + adSyncTone">
							<view class="ops-sync__dot"></view>
							<text class="ops-sync__text">{{ adSyncText }}</text>
						</view>

						<view v-if="adScopeWarning" class="ops-warn">
							<text class="ops-warn__text">{{ adScopeWarning }}</text>
						</view>

						<!-- <view v-if="adCoverageHint" class="ops-warn ops-warn--info">
							<text class="ops-warn__text">{{ adCoverageHint }}</text>
						</view> -->

						<!-- 收益主卡 -->
						<view class="ops-hero">
							<view class="ops-hero__head">
								<text class="ops-hero__label">预估收益</text>
								<view class="ops-hero__badge">
									<text class="ops-hero__badge-text">{{ adStats.range.label }}</text>
								</view>
							</view>
							<view class="ops-hero__amount">
								<text class="ops-hero__currency">¥</text>
								<text class="ops-hero__number">{{ money(adStats.summary.revenue) }}</text>
							</view>
							<text class="ops-hero__delta">
								{{ adCompareText }} · 昨日 ¥{{ money(adStats.compare.yesterday) }} / {{ formatNumber(adStats.quick.yesterday.show) }} 展示
							</text>
							<view class="ops-hero__divider"></view>
							<view class="ops-hero__grid ops-hero__grid--five">
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ formatNumber(adStats.summary.show) }}</text>
									<text class="ops-hero__cell-label">展示量</text>
								</view>
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ formatNumber(adStats.summary.click) }}</text>
									<text class="ops-hero__cell-label">点击量</text>
								</view>
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ adStats.summary.clickRate === null ? '—' : adStats.summary.clickRate + '%' }}</text>
									<text class="ops-hero__cell-label">点击率</text>
								</view>
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ adStats.summary.cpm === null ? '—' : '¥' + money(adStats.summary.cpm) }}</text>
									<text class="ops-hero__cell-label">eCPM</text>
								</view>
								<view class="ops-hero__cell">
									<text class="ops-hero__value">{{ adStats.summary.cpc === null ? '—' : '¥' + money(adStats.summary.cpc) }}</text>
									<text class="ops-hero__cell-label">CPC</text>
								</view>
							</view>
						</view>

						<!-- 快捷区间：跟在后面的筛选共用同一份数据 -->
						<view class="ops-card ops-quick">
							<view
								v-for="item in adQuickCards"
								:key="item.key"
								class="ops-quick__cell"
								:class="{ 'ops-quick__cell--active': item.active }"
								@click="selectAdPreset(item.preset)"
							>
								<text class="ops-quick__label" :class="{ 'ops-quick__label--active': item.active }">{{ item.label }}</text>
								<text class="ops-quick__value" :class="{ 'ops-quick__value--active': item.active }">¥{{ money(item.revenue) }}</text>
							</view>
						</view>

						<!-- 查询条件 -->
						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">数据筛选</text>
								<text class="ops-card__hint">{{ adStats.range.days }} 天 · 国内小程序</text>
							</view>

							<scroll-view class="ops-presets" scroll-x :show-scrollbar="false">
								<view class="ops-presets__inner">
									<view
										v-for="item in adPresets"
										:key="item.key"
										class="ops-chip"
										:class="{ 'ops-chip--active': adRangeKey === item.key }"
										@click="selectAdPreset(item.key)"
									>
										<text class="ops-chip__text" :class="{ 'ops-chip__text--active': adRangeKey === item.key }">
											{{ item.label }}
										</text>
									</view>
								</view>
							</scroll-view>

							<view v-if="adRangeKey === 'custom'" class="ops-custom-row">
								<view class="ops-custom">
									<picker mode="date" :value="adStartDate" :end="adEndDate" @change="onAdStartChange">
										<text class="ops-date__text">{{ shortDate(adStartDate) }}</text>
									</picker>
									<text class="ops-date__sep">-</text>
									<picker mode="date" :value="adEndDate" :start="adStartDate" @change="onAdEndChange">
										<text class="ops-date__text">{{ shortDate(adEndDate) }}</text>
									</picker>
								</view>
							</view>

							<view class="ops-pills">
								<picker mode="selector" :range="adPositionLabels" :value="adPositionIndex" @change="onAdPositionChange">
									<view class="ops-pill" :class="{ 'ops-pill--active': !!adFilters.adpId }">
										<text class="ops-pill__text">{{ adPositionLabel }}</text>
										<view class="ops-pill__caret"></view>
									</view>
								</picker>
								<picker mode="selector" :range="adTypeLabels" :value="adTypeIndex" @change="onAdTypeChange">
									<view class="ops-pill" :class="{ 'ops-pill--active': !!adFilters.adType }">
										<text class="ops-pill__text">{{ adTypeLabel }}</text>
										<view class="ops-pill__caret"></view>
									</view>
								</picker>
								<view
									v-if="adFilters.adType || adFilters.adpId"
									class="ops-pill ops-pill--reset"
									@click="resetAdFilters"
								>
									<text class="ops-pill__text">重置</text>
								</view>
							</view>
						</view>

						<!-- 收益趋势 -->
						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">收益趋势</text>
								<text class="ops-card__hint">{{ adStats.range.label }}</text>
							</view>
							<view class="ops-chart-box">
								<xtf-charts
									:option="adTrendOption"
									canvas-id="ops-ad-trend"
									:height="chartHeights.trend"
									:scrollable="false"
								></xtf-charts>
							</view>
							<view class="ops-chart__metrics">
								<view class="ops-chart__metric">
									<text class="ops-chart__metric-label">区间合计</text>
									<text class="ops-chart__metric-value">¥{{ money(adStats.summary.revenue) }}</text>
								</view>
								<view class="ops-chart__metric">
									<text class="ops-chart__metric-label">日均</text>
									<text class="ops-chart__metric-value">¥{{ money(adAverageRevenue) }}</text>
								</view>
								<view class="ops-chart__metric">
									<text class="ops-chart__metric-label">最高单日</text>
									<text class="ops-chart__metric-value">{{ adBestDayText }}</text>
								</view>
							</view>
						</view>

						<!-- 广告位收益占比（环形图 + 自绘图例） -->
						<view v-if="adStats.positions.length" class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">广告位收益占比</text>
								<text class="ops-card__hint">{{ adRingHint }}</text>
							</view>
							<view class="ops-chart-box">
								<xtf-charts
									:option="adPositionOption"
									canvas-id="ops-ad-position"
									:height="chartHeights.ring"
									:scrollable="false"
								></xtf-charts>
							</view>
							<view class="ops-ring-legend">
								<view
									v-for="item in adPositionLegend"
									:key="item.key"
									class="ops-ring-legend__item"
								>
									<view class="ops-ring-legend__dot" :style="{ background: item.color }"></view>
									<text class="ops-ring-legend__name">{{ item.name }}</text>
									<text class="ops-ring-legend__percent">{{ item.percent }}%</text>
								</view>
							</view>
						</view>

						<!-- 广告类型分布 -->
						<view v-if="adTypeRows.length" class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">广告类型分布</text>
								<text class="ops-card__hint">按收益占比</text>
							</view>
							<view v-for="item in adTypeRows" :key="item.adType" class="ops-type">
								<view class="ops-type__head">
									<text class="ops-type__name">{{ item.name }}</text>
									<text class="ops-type__meta">{{ item.share }}% · ¥{{ money(item.revenue) }}</text>
								</view>
								<view class="ops-type__track">
									<view class="ops-type__bar" :style="{ width: item.share + '%' }"></view>
								</view>
							</view>
						</view>

						<!-- 数据明细 -->
						<view class="ops-card">
							<view class="ops-card__head">
								<view class="ops-seg">
									<view
										class="ops-seg__item"
										:class="{ 'ops-seg__item--active': adDetailMode === 'daily' }"
										@click="adDetailMode = 'daily'"
									>
										<text class="ops-seg__text" :class="{ 'ops-seg__text--active': adDetailMode === 'daily' }">按日期</text>
									</view>
									<view
										class="ops-seg__item"
										:class="{ 'ops-seg__item--active': adDetailMode === 'position' }"
										@click="adDetailMode = 'position'"
									>
										<text class="ops-seg__text" :class="{ 'ops-seg__text--active': adDetailMode === 'position' }">按广告位</text>
									</view>
								</view>
								<text class="ops-card__hint">{{ adDetailHint }}</text>
							</view>

							<!-- 按日期 -->
							<template v-if="adDetailMode === 'daily'">
								<view v-if="adStats.daily.length" class="ops-table__head">
									<text class="ops-table__th ops-table__th--wide">日期</text>
									<text class="ops-table__th">展示</text>
									<text class="ops-table__th">点击</text>
									<text class="ops-table__th ops-table__th--rev">收益</text>
								</view>
								<view v-for="row in adVisibleDaily" :key="row.date" class="ops-table__row">
									<text class="ops-table__td ops-table__td--wide">{{ row.dateLabel }}</text>
									<text class="ops-table__td">{{ row.hasBreakdown ? formatNumber(row.show) : '—' }}</text>
									<text class="ops-table__td">{{ row.hasBreakdown ? formatNumber(row.click) : '—' }}</text>
									<text class="ops-table__td ops-table__td--rev">¥{{ money(row.revenue) }}</text>
								</view>
								<view v-if="!adStats.daily.length" class="ops-empty">
									<text class="ops-empty__text">所选条件暂无广告数据</text>
								</view>
								<view
									v-if="adStats.daily.length > adDailyPreview"
									class="ops-more"
									@click="adDailyExpanded = !adDailyExpanded"
								>
									<text class="ops-more__text">
										{{ adDailyExpanded ? '收起' : `展开全部 ${adStats.daily.length} 天` }}
									</text>
								</view>
							</template>

							<!-- 按广告位 -->
							<template v-else>
								<view v-for="item in adStats.positions" :key="item.adpId" class="ops-ad-row">
									<view class="ops-ad-row__left">
										<text class="ops-ad-row__name">{{ item.name }}</text>
										<text class="ops-ad-row__meta">
											{{ item.adTypeText }} · {{ formatNumber(item.show) }} 展示 · 点击率 {{ item.clickRate }}%
										</text>
									</view>
									<view class="ops-ad-row__right">
										<text class="ops-ad-row__revenue">¥{{ money(item.revenue) }}</text>
										<text class="ops-ad-row__sub">eCPM ¥{{ money(item.cpm) }}</text>
									</view>
								</view>
								<view v-if="!adStats.positions.length" class="ops-empty">
									<text class="ops-empty__text">所选条件暂无广告位数据</text>
								</view>
							</template>

							<view v-if="adStats.summary.show" class="ops-ad-total">
								<text class="ops-ad-total__label">合计</text>
								<text class="ops-ad-total__value">
									{{ formatNumber(adStats.summary.show) }} 展示 · {{ formatNumber(adStats.summary.click) }} 点击 · ¥{{ money(adStats.summary.revenue) }}
								</text>
							</view>
						</view>

						<!-- 数据核对（排查与控制台差异，懒加载） -->
						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">数据核对</text>
								<text class="ops-card__link" @click="toggleAdDiag">
									{{ adDiag ? '收起' : (adDiagLoading ? '加载中…' : '展开') }}
								</text>
							</view>
							<text class="ops-card__hint ops-diag__intro">
								uni-ad 原始明细按维度汇总（不做应用收敛），用于和后台逐项比对
							</text>

							<template v-if="adDiag">
								<view class="ops-diag__meta">
									<text class="ops-diag__meta-text">
										昨日（{{ shortDate(adDiag.yesterday) }}）{{ adDiag.rows.yesterday }} 行 · 近 7 日 {{ adDiag.rows.week }} 行 · 当前识别应用：{{ adDiag.scope && adDiag.scope.appid ? adDiag.scope.appid : '未识别' }}
									</text>
								</view>

								<text class="ops-diag__label">应用日报（控制台口径）</text>
								<view class="ops-diag__row">
									<text class="ops-diag__name">昨日</text>
									<text class="ops-diag__value">¥{{ adDiag.appTotals ? money(adDiag.appTotals.yesterday) : '—' }}</text>
								</view>
								<view class="ops-diag__row">
									<text class="ops-diag__name">近 7 日</text>
									<text class="ops-diag__value">¥{{ adDiag.appTotals ? money(adDiag.appTotals.week) : '—' }}</text>
								</view>

								<text class="ops-diag__label">昨日按应用（元）</text>
								<view v-for="item in adDiag.appidYest" :key="'app-' + item.appid" class="ops-diag__row">
									<text class="ops-diag__name">{{ item.appid }}</text>
									<text class="ops-diag__value">¥{{ money(item.revenue) }}</text>
								</view>
								<view v-if="!adDiag.appidYest.length" class="ops-empty">
									<text class="ops-empty__text">昨日没有收益行</text>
								</view>

								<text class="ops-diag__label">昨日按平台（元）</text>
								<view v-for="item in adDiag.platformYest" :key="'pf-' + item.platform" class="ops-diag__row">
									<text class="ops-diag__name">{{ item.platform }} · {{ item.label }}</text>
									<text class="ops-diag__value">¥{{ money(item.revenue) }}</text>
								</view>

								<text class="ops-diag__label">昨日按区域（元）</text>
								<view v-for="item in adDiag.regionYest" :key="'rg-' + item.region" class="ops-diag__row">
									<text class="ops-diag__name">{{ item.region }} · {{ item.label }}</text>
									<text class="ops-diag__value">¥{{ money(item.revenue) }}</text>
								</view>

								<text class="ops-diag__label">昨日按类型（元 · 国内小程序）</text>
								<view v-for="item in adDiag.typeYest" :key="'tp-' + item.adType" class="ops-diag__row">
									<text class="ops-diag__name">{{ item.name }}</text>
									<text class="ops-diag__value">¥{{ money(item.revenue) }}</text>
								</view>
							</template>
						</view>

						<text class="ops-foot-note">
							收益取自 uni-ad 应用日报（与应用后台一致，原始单位「厘」已换算为元）；展示 / 点击 / 点击率 / eCPM 取自广告位日报。
						</text>
						<text class="ops-foot-note">
							统计范围：{{ adScopeText }} · 国内小程序广告
						</text>
						<text class="ops-foot-note">
							广告数据由 uni-ad 每日推送（T+1），最新至 {{ shortDate(adStats.range.endKey) }} · 本页仅管理员可见
						</text>
					</template>
				</view>

				<!-- ============ 权限 ============ -->
				<view v-else class="ops-body">
					<view v-if="loading.permissions && !permission.loaded" class="ops-loading">
						<text class="ops-loading__text">加载中…</text>
					</view>

					<template v-else>
						<view v-if="permission.error" class="ops-warn">
							<text class="ops-warn__text">{{ permission.error }}，当前按默认值（关闭）显示，请点右上角刷新重试</text>
						</view>

						<!-- 功能模块权限：默认展开 -->
						<view class="ops-card">
							<view class="ops-card__head ops-card__head--toggle" @click="togglePermissionSection('modules')">
								<text class="ops-card__title">功能模块权限</text>
								<view class="ops-card__head-right">
									<text class="ops-card__hint">对全部用户生效</text>
									<text class="ops-card__arrow" :class="{ 'ops-card__arrow--open': permissionSection.modules }">▾</text>
								</view>
							</view>

							<view v-if="permissionSection.modules" class="ops-perm">
								<view
									v-for="item in modulePermissionItems"
									:key="item.key"
									class="ops-perm__group"
								>
									<view class="ops-perm__item">
										<view class="ops-perm__main">
											<view class="ops-perm__title-row">
												<text class="ops-perm__name">{{ item.name }}</text>
												<text v-if="item.field && isPermissionLocked(item)" class="ops-perm__state">{{ permissionStateText(item) }}</text>
											</view>
											<text class="ops-perm__desc">{{ item.desc }}</text>
										</view>
										<!-- key 里带版本号：保存失败回滚时靠它重建组件，否则原生 switch 视觉停在切换后的状态 -->
										<fui-switch
											v-if="item.field"
											:key="`perm-${item.key}-${permission.version}`"
											:checked="item.value"
											color="var(--noir-coral)"
											scale-ratio="0.75"
											@change="onPermissionSwitch(item, $event)"
										></fui-switch>
									</view>

									<!-- 子开关：父开关关闭时禁用但保留配置，重新打开不用重配 -->
									<view
										v-if="item.children && item.children.length"
										class="ops-perm__children"
										:class="{ 'ops-perm__children--muted': !item.value }"
									>
										<view
											v-for="child in item.children"
											:key="child.key"
											class="ops-perm__item ops-perm__item--child"
											:class="{ 'ops-perm__item--locked': isPermissionLocked(child) }"
										>
											<view class="ops-perm__main">
												<view class="ops-perm__title-row">
													<text class="ops-perm__name ops-perm__name--child">{{ child.name }}</text>
													<text
														v-if="isPermissionLocked(child)"
														class="ops-perm__state"
													>{{ permissionStateText(child) }}</text>
												</view>
												<text class="ops-perm__desc">{{ child.desc }}</text>
											</view>
											<fui-switch
												:key="`perm-${child.key}-${permission.version}`"
												:checked="child.value"
												:disabled="!item.value || isPermissionLocked(child)"
												color="var(--noir-coral)"
												scale-ratio="0.75"
												@change="onPermissionSwitch(child, $event)"
											></fui-switch>
										</view>
									</view>
								</view>
							</view>
						</view>

						<!-- 心动点任务：默认收起 -->
						<view class="ops-card">
							<view class="ops-card__head ops-card__head--toggle" @click="togglePermissionSection('points')">
								<text class="ops-card__title">心动点任务</text>
								<view class="ops-card__head-right">
									<text class="ops-card__hint">对全部用户生效</text>
									<text class="ops-card__arrow" :class="{ 'ops-card__arrow--open': permissionSection.points }">▾</text>
								</view>
							</view>

							<view v-if="permissionSection.points" class="ops-perm">
								<view
									v-for="item in pointsPermissionItems"
									:key="item.key"
									class="ops-perm__item"
									:class="{ 'ops-perm__item--locked': isPermissionLocked(item) }"
								>
									<view class="ops-perm__main">
										<view class="ops-perm__title-row">
											<text class="ops-perm__name">{{ item.name }}</text>
											<text v-if="isPermissionLocked(item)" class="ops-perm__state">{{ permissionStateText(item) }}</text>
										</view>
										<text class="ops-perm__desc">{{ item.desc }}</text>
									</view>
									<fui-switch
										:key="`perm-${item.key}-${permission.version}`"
										:checked="item.value"
										:disabled="isPermissionLocked(item)"
										color="var(--noir-coral)"
										scale-ratio="0.75"
										@change="onPermissionSwitch(item, $event)"
									></fui-switch>
								</view>
							</view>
						</view>

						<!-- 云存储清理：删除日常只软删记录，原图/缩略图在这里手动回收 -->
						<view class="ops-card">
							<view class="ops-card__head ops-card__head--toggle" @click="togglePermissionSection('cleanup')">
								<text class="ops-card__title">云存储清理</text>
								<view class="ops-card__head-right">
									<text class="ops-card__hint">仅管理员</text>
									<text class="ops-card__arrow" :class="{ 'ops-card__arrow--open': permissionSection.cleanup }">▾</text>
								</view>
							</view>

							<view v-if="permissionSection.cleanup">
								<view class="ops-cleanup__stats">
									<view class="ops-cleanup__stat">
										<text class="ops-cleanup__value">{{ mediaCleanup.deletedPosts }}</text>
										<text class="ops-cleanup__label">已删除动态</text>
									</view>
									<view class="ops-cleanup__stat">
										<text class="ops-cleanup__value ops-cleanup__value--warn">{{ mediaCleanup.pendingPosts }}</text>
										<text class="ops-cleanup__label">待清理动态</text>
									</view>
									<view class="ops-cleanup__stat">
										<text class="ops-cleanup__value">{{ mediaCleanup.pendingFiles }}{{ mediaCleanup.sampled ? '+' : '' }}</text>
										<text class="ops-cleanup__label">待清理文件</text>
									</view>
								</view>

								<text class="ops-cleanup__desc">
									删除双人日常只做软删、不会自动删云端文件（误删可找回，也便于排查）。这里回收已删除动态的原图与缩略图，每次最多 {{ mediaCleanup.batch }} 条，文件删除后不可恢复。
								</text>

								<view
									class="ops-cleanup__btn"
									:class="{ 'ops-cleanup__btn--disabled': !mediaCleanup.pendingPosts || mediaCleanup.loading || mediaCleanup.cleaning }"
									@click="handleCleanupMedia"
								>
									<text class="ops-cleanup__btn-text">{{ cleanupButtonText }}</text>
								</view>

								<text v-if="mediaCleanup.lastResult" class="ops-cleanup__result">{{ mediaCleanup.lastResult }}</text>
							</view>
						</view>

						<!-- 心动点回补：注册赠送 100 是后加的规则，上线前注册的账号在这里批量补齐 -->
						<view class="ops-card">
							<view class="ops-card__head">
								<text class="ops-card__title">心动点回补</text>
								<text class="ops-card__hint">仅管理员</text>
							</view>

							<view class="ops-cleanup__stats">
								<view class="ops-cleanup__stat">
									<text class="ops-cleanup__value">{{ pointsBackfill.total }}</text>
									<text class="ops-cleanup__label">注册账号</text>
								</view>
								<view class="ops-cleanup__stat">
									<text class="ops-cleanup__value ops-cleanup__value--warn">{{ pointsBackfill.accountsGranted }}</text>
									<text class="ops-cleanup__label">已补发账号</text>
								</view>
								<view class="ops-cleanup__stat">
									<text class="ops-cleanup__value">{{ pointsBackfill.points }}</text>
									<text class="ops-cleanup__label">已补积分</text>
								</view>
							</view>

							<text class="ops-cleanup__desc">
								给历史账号补三类一次性奖励：注册 +100（所有账号）、绑定情侣 +1000（当前仍绑定）、完善资料 +50（已绑定且头像 / 昵称 / 生日齐全）。缺哪笔补哪笔，已有对应流水自动跳过，可重复执行；按每批 {{ pointsBackfill.batch }} 个账号分页处理，中途可停止，停止后再点会从头扫一遍（重复的会被跳过）。
							</text>

							<view
								class="ops-cleanup__btn"
								@click="handleBackfillPoints"
							>
								<text class="ops-cleanup__btn-text">{{ backfillButtonText }}</text>
							</view>

							<text v-if="pointsBackfill.lastResult" class="ops-cleanup__result">{{ pointsBackfill.lastResult }}</text>
						</view>

						<text class="ops-foot-note">
							开关改动即时保存，用户端下次进入小程序即按新配置渲染；未设置时按各自默认值（双人日常关闭，聚会游戏、各小游戏与心动点任务开启）。
						</text>
						<text class="ops-foot-note">
							配置存放在 love-app-settings 集合，首次使用需先在 uniCloud 控制台创建该集合（可上传 database 目录下的 schema）。
						</text>
					</template>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
	import { requirePageLogin } from '@/common/auth-entry.js'
	import { getPlatformApi } from '@/common/api/platform.js'
	import { writeAppSettingsCache } from '@/common/app-settings.js'
	import { getChartPalette } from '@/common/theme.js'
	import {
		CHART_PALETTE,
		buildUserTrendOption,
		buildVisitTrendOption,
		buildModulePenetrationOption,
		buildAdTrendOption,
		buildAdPositionRingOption
	} from '@/common/utils/operations-chart.js'

	const TABS = [
		{ key: 'overview', label: '总览' },
		{ key: 'modules', label: '模块' },
		{ key: 'ads', label: '广告' },
		{ key: 'permissions', label: '权限' }
	]

	// 小游戏子开关：field 对应服务端 gameItems 里的键，必须和 common/game/rules.js 的 GAME_TYPE_* 一致
	const GAME_ITEM_FIELDS = ['undercover', 'landlord', 'bomb']

	// 心动点每日任务开关：field 必须和云函数 lib/points.js 的 TASK_DISPLAY_ORDER 一致
	const POINTS_TASK_FIELDS = ['daily_post', 'photo_upload', 'game_settle', 'anniversary', 'plan_create', 'plan_finish']

	// 受「页面显示权限」控制的任务：对应页面关掉后，任务开关禁用（值保留），用户端也不展示
	const POINTS_TASK_DEPENDS = {
		daily_post: 'feedVisible',
		game_settle: 'gameVisible'
	}

	// 云存储清理一次处理多少条动态：与服务端 MEDIA_CLEANUP_BATCH_LIMIT 保持一致
	const MEDIA_CLEANUP_BATCH = 20

	/** 服务端可能缺字段（老版本云函数），一律按「默认开启」补齐 */
	function normalizeGameItems(items) {
		const source = items && typeof items === 'object' ? items : {}
		const normalized = {}
		GAME_ITEM_FIELDS.forEach((field) => {
			normalized[field] = source[field] !== false
		})
		return normalized
	}

	/** 同上：任务开关默认全开，关掉只是心动点页不展示 */
	function normalizePointsTasks(tasks) {
		const source = tasks && typeof tasks === 'object' ? tasks : {}
		const normalized = {}
		POINTS_TASK_FIELDS.forEach((field) => {
			normalized[field] = source[field] !== false
		})
		return normalized
	}

	const RANGE_OPTIONS = [
		{ key: 'today', label: '今日' },
		{ key: '7d', label: '近 7 天' },
		{ key: '30d', label: '近 30 天' }
	]

	const RANGE_DAYS = {
		today: 1,
		'7d': 7,
		'30d': 30
	}

	// 广告 tab 的区间预设：和 uni-ad 日报口径对齐（T+1，昨天为最新）
	const AD_PRESETS = [
		{ key: 'yesterday', label: '昨日' },
		{ key: '7d', label: '近 7 日' },
		{ key: '30d', label: '近 30 日' },
		{ key: 'month', label: '本月' },
		{ key: 'lastMonth', label: '上月' },
		{ key: 'custom', label: '自定义' }
	]

	// 小程序广告位类型（ad_type），与 云函数 AD_TYPE_TEXT 保持一致
	const AD_TYPE_OPTIONS = [
		{ value: 0, label: '全部类型' },
		{ value: 4, label: 'Banner' },
		{ value: 9, label: '激励视频' },
		{ value: 15, label: '插屏广告' },
		{ value: 17, label: '格子广告' },
		{ value: 18, label: '互动红包' },
		{ value: 19, label: '视频广告' }
	]

	// 按日期明细默认展示几天，其余点「展开全部」
	const AD_DAILY_PREVIEW = 8

	// 图表高度（xtf-charts 的 height 只吃 px，不吃 rpx）
	// 数值按 375pt 屏、卡片内容宽 323px 的比例对齐设计稿（图宽高比 ≈ 0.58）
	const CHART_HEIGHTS = {
		trend: '190px',
		modules: '218px',
		ring: '200px'
	}
	// 广告位环形图最多画几个（超出的合并成「其他」）
	const AD_RING_LIMIT = 6

	function pad2(value) {
		return String(value).padStart(2, '0')
	}

	function toDateKey(date) {
		return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
	}

	function addDays(dateKey, delta) {
		const timestamp = Date.parse(`${dateKey}T00:00:00+08:00`)
		const next = new Date(timestamp + delta * 24 * 60 * 60 * 1000)
		return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`
	}

	function formatNumber(value) {
		const num = Number(value) || 0
		return `${num}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	function money(value) {
		return (Number(value) || 0).toFixed(2)
	}

	export default {
		data() {
			const today = toDateKey(new Date())
			const yesterday = addDays(today, -1)
			return {
				scrollTop: 0,
				tabs: TABS,
				rangeOptions: RANGE_OPTIONS,
				adPresets: AD_PRESETS,
				activeTab: 0,
				rangeKey: '7d',
				startDate: addDays(today, -6),
				endDate: today,
				permissionDenied: false,
				loading: {
					overview: false,
					modules: false,
					ads: false,
					permissions: false
				},
				loaded: {
					overview: false,
					modules: false,
					ads: false,
					permissions: false
				},
				overview: {
					summary: null,
					funnel: null,
					trend: [],
					today: { newUsers: 0, visits: 0, logins: 0, bindings: 0 },
					yesterday: { newUsers: 0, visits: 0, logins: 0, bindings: 0 },
					rangeTotals: { newUsers: 0, visits: 0, logins: 0, bindings: 0 },
					feedback: null,
					range: null
				},
				moduleStats: {
					modules: null,
					contentTotal: 0,
					totalUsers: 0
				},
				// 广告：区间与筛选独立于总览，避免两个 tab 互相污染
				adRangeKey: '7d',
				adStartDate: addDays(yesterday, -6),
				adEndDate: yesterday,
				adFilters: {
					adType: 0,
					adpId: ''
				},
				adPositionOptions: [],
				adDetailMode: 'daily',
				adDailyExpanded: false,
				adDailyPreview: AD_DAILY_PREVIEW,
				adPendingReload: false,
				adDiag: null,
				adDiagLoading: false,
				// 权限 tab：首页 / 游戏大厅的模块显示开关（服务端 love-app-settings）
				// feed 默认关闭、game 与小游戏默认开启，两边默认值方向相反，别再共用一个常量
				permission: {
					feedVisible: false,
					gameVisible: true,
					// 小游戏子开关：父开关关闭时值保留（只是不生效），重新打开不用重配
					gameItems: normalizeGameItems(),
					// 心动点每日任务开关：关闭后用户端心动点页不展示该任务
					pointsTasks: normalizePointsTasks(),
					loaded: false,
					saving: false,
					error: '',
					// 版本号驱动 switch 重建，保存失败回滚视觉
					version: 0
				},
				// 权限 tab 的三张卡片：默认只展开「功能模块权限」，其余收起
				permissionSection: {
					modules: true,
					points: false,
					cleanup: false
				},
				// 云存储清理：删除日常只软删记录，文件在这里手动回收
				mediaCleanup: {
					loaded: false,
					loading: false,
					cleaning: false,
					deletedPosts: 0,
					pendingPosts: 0,
					cleanedPosts: 0,
					pendingFiles: 0,
					// 待清理文件数是抽样累加的，true 时页面上加「+」
					sampled: false,
					lastResult: '',
					// 单次清理条数，模板里要显示，所以挂在 data 上
					batch: MEDIA_CLEANUP_BATCH
				},
				// 心动点回补：分页扫注册账号，补齐注册 / 绑定 / 完善资料三类一次性奖励
				pointsBackfill: {
					total: 0,
					scanned: 0,
					accountsGranted: 0,
					points: 0,
					// 三类各自补了多少笔，结果行里摊开给运营看
					records: { register: 0, bind: 0, profile: 0 },
					offset: 0,
					running: false,
					stopped: false,
					loading: false,
					lastResult: '',
					// 单批账号数：云函数单次最多 200，100 留一半余量给逐个发分的耗时
					batch: 100
				},
				pageReady: false,
				loginPassed: false,
				// uv-navbar 的内容区高度（px）与右侧避让胶囊的缩进（px），setupNavBar 里按胶囊位置算
				navContentHeight: 44,
				navRightInset: 12,
				chartHeights: CHART_HEIGHTS,
				adStats: {
					summary: null,
					compare: { yesterday: 0, prevRange: 0, delta: null },
					quick: {
						yesterday: { revenue: 0, show: 0, click: 0 },
						last7: { revenue: 0 },
						month: { revenue: 0 },
						lastMonth: { revenue: 0 }
					},
					trend: [],
					daily: [],
					positions: [],
					types: [],
					bestDay: null,
					coverage: { partial: false, daysWithRevenue: 0, daysWithAdp: 0, revenueGap: 0, firstAdpDate: '' },
					scope: { appid: '', appidCount: 0, scoped: false },
					sync: null,
					range: { key: '', label: '', startKey: '', endKey: '', days: 0 }
				}
			}
		},
		computed: {
			/** Canvas 图表不认 CSS 变量：按当前主题算一组色板交给 option 构建函数 */
			chartPalette() {
				return getChartPalette(this.themeKey)
			},
			currentTabKey() {
				return (TABS[this.activeTab] || TABS[0]).key
			},
			cleanupButtonText() {
				const cleanup = this.mediaCleanup
				if (cleanup.cleaning) {
					return '清理中…'
				}
				if (cleanup.loading && !cleanup.loaded) {
					return '统计中…'
				}
				if (!cleanup.pendingPosts) {
					return '没有待清理的动态'
				}
				return `清理 ${Math.min(cleanup.pendingPosts, MEDIA_CLEANUP_BATCH)} 条动态的文件`
			},
			backfillButtonText() {
				const state = this.pointsBackfill
				if (state.running) {
					return '停止回补'
				}
				if (state.loading && !state.total) {
					return '统计中…'
				}
				if (!state.total) {
					return '暂无可回补的账号'
				}
				if (state.scanned > 0) {
					return '重新回补'
				}
				return '开始回补'
			},
			funnelRows() {
				const funnel = this.overview.funnel
				if (!funnel) {
					return []
				}
				const steps = [
					{
						key: 'visits',
						name: '进入小程序',
						color: '#EC7558',
						value: Number(funnel.visits.total) || 0,
						sub: `打开 ${formatNumber(funnel.visits.pv || 0)} 次`
					},
					{
						key: 'logins',
						name: '完成登录',
						color: '#E79A50',
						value: Number(funnel.logins.total) || 0,
						sub: `转化 ${funnel.logins.rate}%`
					},
					{
						key: 'bindings',
						name: '新增绑定',
						color: '#6F8DD6',
						value: Number(funnel.bindings.total) || 0,
						sub: `转化 ${funnel.bindings.rate}%`
					}
				]
				// 条宽以「进入小程序」为基准：0 就是空条，不像漏斗那样留一根放不下字的假窄条
				const base = Math.max(steps[0].value, 1)
				return steps.map((item) => Object.assign({}, item, {
					barWidth: item.value > 0 ? Math.max(4, Math.round((item.value / base) * 100)) : 0
				}))
			},
			userTrendOption() {
				return buildUserTrendOption(this.overview.trend || [], this.chartPalette)
			},
			visitTrendOption() {
				return buildVisitTrendOption(this.overview.trend || [], this.chartPalette)
			},
			// 今日关键指标：今天实时值 vs 昨天快照，涨红跌绿（国内习惯）
			todayCards() {
				const today = this.overview.today || {}
				const yesterday = this.overview.yesterday || {}
				const defs = [
					{ key: 'newUsers', label: '新增用户' },
					{ key: 'visits', label: '访问 UV' },
					{ key: 'logins', label: '登录人数' },
					{ key: 'bindings', label: '新增绑定' }
				]
				return defs.map((item) => {
					const value = Number(today[item.key]) || 0
					const prev = Number(yesterday[item.key]) || 0
					let deltaText = '—'
					let deltaClass = 'flat'
					if (prev > 0) {
						const rate = Math.round(((value - prev) / prev) * 1000) / 10
						deltaText = `${rate >= 0 ? '+' : ''}${rate}%`
						deltaClass = rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat'
					} else if (value > 0) {
						deltaText = '新增'
						deltaClass = 'up'
					}
					return {
						key: item.key,
						label: item.label,
						value,
						prev,
						deltaText,
						deltaClass
					}
				})
			},
			hasFunnelData() {
				const funnel = this.overview.funnel
				return !!(funnel && funnel.visits && Number(funnel.visits.total) > 0)
			},
			trendTotal() {
				return (this.overview.trend || []).reduce((sum, item) => sum + (item.newUsers || 0), 0)
			},
			trendAverage() {
				const days = (this.overview.trend || []).length || 1
				return Math.round((this.trendTotal / days) * 10) / 10
			},
			moduleChartOption() {
				return buildModulePenetrationOption(this.moduleStats.modules || [], this.chartPalette)
			},
			avgContentPerUser() {
				const users = Number(this.moduleStats.totalUsers) || 0
				if (!users) {
					return '0'
				}
				return (Math.round((this.moduleStats.contentTotal / users) * 10) / 10).toFixed(1)
			},
			/* ---------------- 广告 ---------------- */
			adQuickCards() {
				const quick = this.adStats.quick || {}
				const card = (key, label, preset) => ({
					key,
					label,
					preset,
					revenue: quick[key] ? quick[key].revenue : 0,
					active: this.adRangeKey === preset
				})
				return [
					card('yesterday', '昨日', 'yesterday'),
					card('last7', '近 7 日', '7d'),
					card('month', '本月', 'month'),
					card('lastMonth', '上月', 'lastMonth')
				]
			},
			adTypeLabels() {
				return AD_TYPE_OPTIONS.map((item) => item.label)
			},
			adTypeIndex() {
				const index = AD_TYPE_OPTIONS.findIndex((item) => item.value === this.adFilters.adType)
				return index < 0 ? 0 : index
			},
			adTypeLabel() {
				const hit = AD_TYPE_OPTIONS[this.adTypeIndex]
				return hit ? hit.label : '全部类型'
			},
			adPositionLabels() {
				return ['全部广告位'].concat(this.adPositionOptions.map((item) => item.name))
			},
			adPositionIndex() {
				if (!this.adFilters.adpId) {
					return 0
				}
				const index = this.adPositionOptions.findIndex((item) => item.adpId === this.adFilters.adpId)
				return index < 0 ? 0 : index + 1
			},
			adPositionLabel() {
				if (!this.adFilters.adpId) {
					return '全部广告位'
				}
				const hit = this.adPositionOptions.find((item) => item.adpId === this.adFilters.adpId)
				return hit ? hit.name : '已选广告位'
			},
			adTrendOption() {
				return buildAdTrendOption(this.adStats.trend || [], this.chartPalette)
			},
			// 环形图最多 6 段，多出来的合并成「其他」
			adRingPositions() {
				const list = this.adStats.positions || []
				if (list.length <= AD_RING_LIMIT) {
					return list
				}
				const top = list.slice(0, AD_RING_LIMIT - 1)
				const rest = list.slice(AD_RING_LIMIT - 1).reduce((sum, item) => sum + (Number(item.revenue) || 0), 0)
				return top.concat([{
					adpId: '__other__',
					name: '其他',
					revenue: Math.round(rest * 100) / 100
				}])
			},
			adPositionOption() {
				return buildAdPositionRingOption(this.adRingPositions, this.chartPalette)
			},
			adPositionLegend() {
				const list = this.adRingPositions
				const total = list.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0)
				return list.map((item, index) => ({
					key: item.adpId || item.name,
					name: item.name || '未知广告位',
					revenue: Number(item.revenue) || 0,
					percent: total > 0 ? Math.round(((Number(item.revenue) || 0) / total) * 1000) / 10 : 0,
					color: CHART_PALETTE[index % CHART_PALETTE.length]
				}))
			},
			// 环形图把尾部合并成「其他」时，标题别写成全部广告位数量
			adRingHint() {
				const total = this.adStats.positions.length
				if (!total) {
					return ''
				}
				if (total <= AD_RING_LIMIT) {
					return `${total} 个广告位`
				}
				return `Top ${AD_RING_LIMIT - 1} + 其他`
			},
			adTypeRows() {
				const list = this.adStats.types || []
				const total = list.reduce((sum, item) => sum + (Number(item.revenue) || 0), 0)
				return list.map((item) => ({
					adType: item.adType,
					name: item.name,
					revenue: Number(item.revenue) || 0,
					show: Number(item.show) || 0,
					share: total > 0 ? Math.round(((Number(item.revenue) || 0) / total) * 1000) / 10 : 0
				}))
			},
			adBestDayText() {
				const best = this.adStats.bestDay
				if (!best || !best.date) {
					return '—'
				}
				return `¥${money(best.revenue)} · ${this.shortDate(best.date)}`
			},
			adAverageRevenue() {
				const days = Number(this.adStats.range.days) || 0
				if (!days) {
					return 0
				}
				return Math.round((Number(this.adStats.summary ? this.adStats.summary.revenue : 0) / days) * 100) / 100
			},
			adVisibleDaily() {
				const list = this.adStats.daily || []
				const rows = this.adDailyExpanded ? list : list.slice(0, AD_DAILY_PREVIEW)
				return rows.map((row) => Object.assign({}, row, {
					dateLabel: this.shortDate(row.date)
				}))
			},
			adDetailHint() {
				if (this.adDetailMode === 'position') {
					return `${this.adStats.positions.length} 个广告位`
				}
				return `${this.adStats.daily.length} 天有数据`
			},
			adSyncTone() {
				const sync = this.adStats.sync
				if (!sync) {
					return 'idle'
				}
				if (sync.status === 1) {
					return 'ok'
				}
				if (sync.status === 3) {
					return 'error'
				}
				if (sync.status === 0 || sync.status === 2 || sync.status === 4) {
					return 'wait'
				}
				return 'idle'
			},
			adSyncText() {
				const sync = this.adStats.sync
				if (!sync || !sync.date) {
					return '昨日广告数据同步状态未知'
				}
				const dateText = this.shortDate(sync.date)
				if (sync.status === 1) {
					return `昨日（${dateText}）收益数据已同步`
				}
				if (sync.status === 2) {
					return `昨日（${dateText}）收益数据同步中`
				}
				if (sync.status === 3) {
					return `昨日（${dateText}）收益数据同步失败，可到 uni-ad 控制台重新推送`
				}
				if (sync.status === 0) {
					return `昨日（${dateText}）收益数据待同步`
				}
				if (sync.status === 4) {
					return `昨日（${dateText}）收益已入库，但无同步日志（状态未确认）`
				}
				return `昨日（${dateText}）暂无收益数据，可能尚未推送`
			},
			// 环比：上期没有收益时显示「—」，不显示 0%
			adCompareText() {
				const delta = this.adStats.compare ? this.adStats.compare.delta : null
				if (delta === null || delta === undefined) {
					return '较上期 —'
				}
				return `较上期 ${delta >= 0 ? '+' : ''}${delta}%`
			},
			// 账户下多个应用又没识别出本应用时，明确提示数据是合计
			adScopeWarning() {
				const scope = this.adStats.scope || {}
				if (scope.scoped || Number(scope.appidCount) <= 1) {
					return ''
				}
				return `uni-ad 账户下有 ${scope.appidCount} 个应用，未识别到本应用，当前数据为多应用合计`
			},
			adScopeText() {
				const scope = this.adStats.scope || {}
				if (scope.appid) {
					return `应用 ${scope.appid}`
				}
				if (!Number(scope.appidCount)) {
					return '暂无广告数据'
				}
				return '账户全部应用（未识别到本应用）'
			},
			// 收益有、明细缺的历史区间：说清楚哪些指标不可信
			adCoverageHint() {
				const coverage = this.adStats.coverage || {}
				if (!coverage.partial) {
					return ''
				}
				return `收益取自 uni-ad 应用日报；其中 ¥${money(coverage.revenueGap)} 没有广告位明细（占比图仅覆盖有明细的部分），点击率、eCPM、CPC 显示「—」`
			},
			// 功能模块权限：双人日常 + 聚会游戏（含三个小游戏子开关）。
			// item.parent 决定值存在 permission 的哪一层：'' → permission[field]，'gameItems' → permission.gameItems[field]
			modulePermissionItems() {
				const gameItems = this.permission.gameItems
				return [
					{
						key: 'feed',
						parent: '',
						field: 'feedVisible',
						name: '双人日常',
						desc: '关闭后首页不显示双人日常入口、最近双人动态与动态统计',
						value: this.permission.feedVisible
					},
					{
						key: 'game',
						parent: '',
						field: 'gameVisible',
						name: '聚会游戏',
						desc: '关闭后首页不显示聚会游戏入口；下面的子开关控制游戏大厅里开放哪些游戏',
						value: this.permission.gameVisible,
						children: [
							{
								key: 'game.undercover',
								parent: 'gameItems',
								field: 'undercover',
								name: '谁是卧底',
								desc: '4-10 人 · 语言推理',
								value: gameItems.undercover
							},
							{
								key: 'game.landlord',
								parent: 'gameItems',
								field: 'landlord',
								name: '三人斗地主',
								desc: '3 人 · 策略对局',
								value: gameItems.landlord
							},
							{
								key: 'game.bomb',
								parent: 'gameItems',
								field: 'bomb',
								name: '数字炸弹',
								desc: '1-8 人 · 运气与心理',
								value: gameItems.bomb
							}
						]
					}
				]
			},
			// 心动点任务：独立卡片，扁平列表；行数多，开关比上面几组小一号
			pointsPermissionItems() {
				const pointsTasks = this.permission.pointsTasks
				return [
					{
						key: 'points.daily_post',
						parent: 'pointsTasks',
						field: 'daily_post',
						name: '发布双人日常',
						desc: '+5 / 条 · 每日最多 5 条',
						value: pointsTasks.daily_post,
						dependsOn: POINTS_TASK_DEPENDS.daily_post
					},
					{
						key: 'points.photo_upload',
						parent: 'pointsTasks',
						field: 'photo_upload',
						name: '上传相册',
						desc: '+5 / 张 · 每日最多 10 张',
						value: pointsTasks.photo_upload
					},
					{
						key: 'points.game_settle',
						parent: 'pointsTasks',
						field: 'game_settle',
						name: '完成一局游戏',
						desc: '+5 / 局 · 每日最多 5 局',
						value: pointsTasks.game_settle,
						dependsOn: POINTS_TASK_DEPENDS.game_settle
					},
					{
						key: 'points.anniversary',
						parent: 'pointsTasks',
						field: 'anniversary',
						name: '新增纪念日',
						desc: '+5 / 个 · 每日最多 5 个',
						value: pointsTasks.anniversary
					},
					{
						key: 'points.plan_create',
						parent: 'pointsTasks',
						field: 'plan_create',
						name: '新增愿望 / 计划',
						desc: '+5 / 条 · 每日最多 5 条',
						value: pointsTasks.plan_create
					},
					{
						key: 'points.plan_finish',
						parent: 'pointsTasks',
						field: 'plan_finish',
						name: '完成愿望 / 计划',
						desc: '+10 / 个 · 每日最多 3 个',
						value: pointsTasks.plan_finish
					}
				]
			}
		},
		onLoad() {
			// 只做登录闸门，不发数据请求：tab 真正渲染出来之前不查询
			this.loginPassed = requirePageLogin()
			this.setupNavBar()
		},
		onPageScroll(e) {
			this.scrollTop = e && e.scrollTop ? e.scrollTop : 0
		},
		onReady() {
			this.pageReady = true
			if (!this.loginPassed) {
				return
			}
			this.loadCurrentTab(true)
		},
		onPullDownRefresh() {
			this.refreshCurrentTab()
		},
		methods: {
			formatNumber,
			money,
			/**
			 * 按微信胶囊算导航高度与右侧缩进。
			 * uv-navbar 自己只铺满状态栏 + 内容区，**不会替右侧插槽避让胶囊** ——
			 * 不顶开的话「刷新」会被胶囊整个盖住（胶囊左边缘距右约 94px，按钮才 30px 宽）。
			 */
			setupNavBar() {
				const systemInfo = uni.getSystemInfoSync ? uni.getSystemInfoSync() : {}
				const statusBarHeight = Number(systemInfo.statusBarHeight || 0)
				const windowWidth = Number(systemInfo.windowWidth || 0)
				let navContentHeight = 44
				let navRightInset = 12

				// #ifdef MP-WEIXIN
				if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
					const menuButton = uni.getMenuButtonBoundingClientRect()
					const menuTop = Number(menuButton.top || 0)
					const menuHeight = Number(menuButton.height || 0)
					const menuLeft = Number(menuButton.left || 0)
					// 胶囊上下留白对称 → 内容区高度与胶囊同高
					if (menuTop > statusBarHeight && menuHeight > 0) {
						navContentHeight = (menuTop - statusBarHeight) * 2 + menuHeight
					}
					// 右插槽已经是 right:0（自带 13px 内边距），再把「胶囊占掉的宽度 + 8px 空隙」让出来
					if (windowWidth > 0 && menuLeft > 0) {
						navRightInset = Math.max(12, windowWidth - menuLeft + 8)
					}
				}
				// #endif

				this.navContentHeight = navContentHeight
				this.navRightInset = navRightInset
			},
			shortDate(dateKey) {
				const value = String(dateKey || '')
				if (value.length < 10) {
					return value
				}
				return `${Number(value.slice(5, 7))}/${value.slice(8, 10)}`
			},
			goBack() {
				uni.navigateBack()
			},
			switchTab(index) {
				if (this.activeTab === index) {
					return
				}
				this.activeTab = index
				// 等 tab 内容挂上再查，未展示的 tab 一直不发请求
				this.$nextTick(() => {
					this.loadCurrentTab(false)
				})
			},
			selectRange(key) {
				if (this.rangeKey === key) {
					return
				}
				const today = toDateKey(new Date())
				const days = RANGE_DAYS[key] || 7
				this.rangeKey = key
				this.startDate = addDays(today, -(days - 1))
				this.endDate = today
				this.reloadAll()
			},
			onStartChange(event = {}) {
				const value = event.detail && event.detail.value
				if (!value) {
					return
				}
				this.rangeKey = 'custom'
				this.startDate = value > this.endDate ? this.endDate : value
				this.reloadAll()
			},
			onEndChange(event = {}) {
				const value = event.detail && event.detail.value
				if (!value) {
					return
				}
				this.rangeKey = 'custom'
				this.endDate = value < this.startDate ? this.startDate : value
				this.reloadAll()
			},
			buildRangeParams() {
				if (this.rangeKey === 'custom') {
					return {
						startDate: this.startDate,
						endDate: this.endDate
					}
				}
				return {
					range: this.rangeKey
				}
			},
			buildAdParams() {
				const params = {
					adType: this.adFilters.adType,
					adpId: this.adFilters.adpId
				}
				if (this.adRangeKey === 'custom') {
					params.startDate = this.adStartDate
					params.endDate = this.adEndDate
					return params
				}
				params.range = this.adRangeKey
				return params
			},
			reloadAll() {
				this.loaded.overview = false
				this.loaded.modules = false
				this.loaded.ads = false
				this.loaded.permissions = false
				this.loadCurrentTab(true)
			},
			refreshCurrentTab() {
				this.loaded[this.currentTabKey] = false
				this.loadCurrentTab(true).finally(() => {
					uni.stopPullDownRefresh()
				})
			},
			loadCurrentTab(force = false) {
				const key = this.currentTabKey
				if (!force && this.loaded[key]) {
					return Promise.resolve()
				}

				if (key === 'overview') {
					return this.loadOverview()
				}
				if (key === 'modules') {
					return this.loadModules()
				}
				if (key === 'permissions') {
					return this.loadPermissions()
				}
				return this.loadAds()
			},
			handleResult(result, fallback) {
				if (!result || (result.errCode && result.errCode !== 0)) {
					if (result && result.errCode === 'love-note-no-permission') {
						this.permissionDenied = true
						return { ok: false, silent: true }
					}
					return {
						ok: false,
						message: (result && (result.errMsg || result.errCode)) || fallback
					}
				}
				return { ok: true, data: result.data || {} }
			},
			async loadOverview() {
				if (!this.pageReady || this.currentTabKey !== 'overview') {
					return Promise.resolve()
				}
				if (this.loading.overview) {
					return Promise.resolve()
				}
				this.loading.overview = true
				try {
					const result = await getPlatformApi().getOverview(this.buildRangeParams())
					const parsed = this.handleResult(result, '获取平台数据失败')
					if (!parsed.ok) {
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					this.overview = {
						summary: parsed.data.summary || null,
						funnel: parsed.data.funnel || null,
						trend: Array.isArray(parsed.data.trend) ? parsed.data.trend : [],
						today: parsed.data.today || { newUsers: 0, visits: 0, logins: 0, bindings: 0 },
						yesterday: parsed.data.yesterday || { newUsers: 0, visits: 0, logins: 0, bindings: 0 },
						rangeTotals: parsed.data.rangeTotals || { newUsers: 0, visits: 0, logins: 0, bindings: 0 },
						feedback: parsed.data.feedback || { pending: 0, replied: 0, resolved: 0, total: 0 },
						range: parsed.data.range || null
					}
					this.loaded.overview = true
				} catch (error) {
					console.warn('loadOverview failed', error)
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.loading.overview = false
				}
			},
			async loadModules() {
				if (!this.pageReady || this.currentTabKey !== 'modules') {
					return Promise.resolve()
				}
				if (this.loading.modules) {
					return Promise.resolve()
				}
				this.loading.modules = true
				try {
					const result = await getPlatformApi().getModuleStats()
					const parsed = this.handleResult(result, '获取模块数据失败')
					if (!parsed.ok) {
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					this.moduleStats = {
						modules: Array.isArray(parsed.data.modules) ? parsed.data.modules : [],
						contentTotal: Number(parsed.data.contentTotal) || 0,
						totalUsers: Number(parsed.data.totalUsers) || 0
					}
					this.loaded.modules = true
				} catch (error) {
					console.warn('loadModules failed', error)
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.loading.modules = false
				}
			},
			async loadAds() {
				if (!this.pageReady || this.currentTabKey !== 'ads') {
					return Promise.resolve()
				}
				if (this.loading.ads) {
					// 请求还在飞的时候又改了筛选：记一笔，等这次回来立刻按最新条件重查
					this.adPendingReload = true
					return Promise.resolve()
				}
				this.loading.ads = true
				try {
					const result = await getPlatformApi().getAdStats(this.buildAdParams())
					const parsed = this.handleResult(result, '获取广告数据失败')
					if (!parsed.ok) {
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					this.adStats = {
						summary: parsed.data.summary || null,
						compare: parsed.data.compare || { yesterday: 0, prevRange: 0, delta: null },
						quick: parsed.data.quick || {
							yesterday: { revenue: 0, show: 0, click: 0 },
							last7: { revenue: 0 },
							month: { revenue: 0 },
							lastMonth: { revenue: 0 }
						},
						trend: Array.isArray(parsed.data.trend) ? parsed.data.trend : [],
						daily: Array.isArray(parsed.data.daily) ? parsed.data.daily : [],
						positions: Array.isArray(parsed.data.positions) ? parsed.data.positions : [],
						types: Array.isArray(parsed.data.types) ? parsed.data.types : [],
						bestDay: parsed.data.bestDay || null,
						coverage: parsed.data.coverage || { partial: false, daysWithRevenue: 0, daysWithAdp: 0, daysMissingBreakdown: 0, firstAdpDate: '' },
						scope: parsed.data.scope || { appid: '', appidCount: 0, scoped: false },
						sync: parsed.data.sync || null,
						range: parsed.data.range || { key: '', label: '', startKey: '', endKey: '', days: 0 }
					}
					this.adPositionOptions = Array.isArray(parsed.data.positionOptions)
						? parsed.data.positionOptions
						: []
					this.loaded.ads = true
				} catch (error) {
					console.warn('loadAds failed', error)
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.loading.ads = false
					if (this.adPendingReload) {
						this.adPendingReload = false
						this.loadAds()
					}
				}
			},
			selectAdPreset(key) {
				if (key === 'custom') {
					if (this.adRangeKey === 'custom') {
						return
					}
					this.adRangeKey = 'custom'
					this.adDailyExpanded = false
					// 自定义区间先用当前日期占位，用户改日期后会再拉一次
					this.loadAds()
					return
				}
				if (this.adRangeKey === key) {
					return
				}
				this.adRangeKey = key
				this.adDailyExpanded = false
				this.loadAds()
			},
			onAdStartChange(event = {}) {
				const value = event.detail && event.detail.value
				if (!value) {
					return
				}
				this.adRangeKey = 'custom'
				this.adStartDate = value > this.adEndDate ? this.adEndDate : value
				this.adDailyExpanded = false
				this.loadAds()
			},
			onAdEndChange(event = {}) {
				const value = event.detail && event.detail.value
				if (!value) {
					return
				}
				this.adRangeKey = 'custom'
				this.adEndDate = value < this.adStartDate ? this.adStartDate : value
				this.adDailyExpanded = false
				this.loadAds()
			},
			onAdTypeChange(event = {}) {
				const index = Number(event.detail && event.detail.value)
				const option = AD_TYPE_OPTIONS[index] || AD_TYPE_OPTIONS[0]
				if (this.adFilters.adType === option.value) {
					return
				}
				this.adFilters.adType = option.value
				this.adDailyExpanded = false
				this.loadAds()
			},
			onAdPositionChange(event = {}) {
				const index = Number(event.detail && event.detail.value)
				if (!index) {
					if (!this.adFilters.adpId) {
						return
					}
					this.adFilters.adpId = ''
					this.adDailyExpanded = false
					this.loadAds()
					return
				}
				const option = this.adPositionOptions[index - 1]
				const adpId = option ? option.adpId : ''
				if (!adpId || this.adFilters.adpId === adpId) {
					return
				}
				this.adFilters.adpId = adpId
				this.adDailyExpanded = false
				this.loadAds()
			},
			resetAdFilters() {
				if (!this.adFilters.adType && !this.adFilters.adpId) {
					return
				}
				this.adFilters = { adType: 0, adpId: '' }
				this.adDailyExpanded = false
				this.loadAds()
			},
			// 数据核对：懒加载，点开才查，排除「页面数字和控制台对不上」的疑点
			async toggleAdDiag() {
				if (this.adDiag) {
					this.adDiag = null
					return
				}
				if (this.adDiagLoading) {
					return
				}
				this.adDiagLoading = true
				try {
					const result = await getPlatformApi().getAdDiag()
					const parsed = this.handleResult(result, '获取核对数据失败')
					if (!parsed.ok) {
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					this.adDiag = parsed.data || null
				} catch (error) {
					console.warn('load ad diag failed', error)
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.adDiagLoading = false
				}
			},
			goFeedbackList() {
				uni.navigateTo({
					url: '/pages/feedback/list'
				})
			},
			/* ---------------- 权限 ---------------- */
			/** 权限卡片折叠：点标题展开 / 收起 */
			togglePermissionSection(key) {
				if (!Object.prototype.hasOwnProperty.call(this.permissionSection, key)) {
					return
				}
				this.permissionSection[key] = !this.permissionSection[key]
			},
			/**
			 * 受「页面显示权限」控制的任务开关：对应页面关掉时禁用，但值保留
			 * （重新打开页面不用重配，跟小游戏子开关同一套逻辑）。
			 */
			isPermissionLocked(item = {}) {
				if (!item.dependsOn) {
					return false
				}
				return this.permission[item.dependsOn] !== true
			},
			permissionDependsLabel(item = {}) {
				const labels = {
					feedVisible: '双人日常',
					gameVisible: '聚会游戏'
				}
				return labels[item.dependsOn] || ''
			},
			permissionStateText(item = {}) {
				if (this.isPermissionLocked(item)) {
					return `受${this.permissionDependsLabel(item)}控制`
				}
				return item.value ? '已开启' : '已关闭'
			},
			async loadPermissions() {
				if (!this.pageReady || this.currentTabKey !== 'permissions') {
					return Promise.resolve()
				}
				if (this.loading.permissions) {
					return Promise.resolve()
				}
				this.loading.permissions = true
				try {
					const result = await getPlatformApi().getPermissionSettings()
					const parsed = this.handleResult(result, '获取权限设置失败')
					if (!parsed.ok) {
						// 读失败也要退出 loading，并明说「现在看到的是默认值」
						this.permission.loaded = true
						this.permission.error = parsed.message || '读取权限设置失败'
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					this.permission.feedVisible = parsed.data.feedVisible === true
					this.permission.gameVisible = parsed.data.gameVisible !== false
					this.permission.gameItems = normalizeGameItems(parsed.data.gameItems)
					this.permission.pointsTasks = normalizePointsTasks(parsed.data.pointsTasks)
					this.permission.error = ''
					this.permission.loaded = true
					this.permission.version += 1
					this.loaded.permissions = true
					// 权限页是唯一实时读取方：读到就刷新公共缓存，其它页面下次读缓存即最新
					writeAppSettingsCache({
						feedVisible: this.permission.feedVisible,
						gameVisible: this.permission.gameVisible,
						gameItems: this.permission.gameItems,
						pointsTasks: this.permission.pointsTasks
					})
					// 清理统计独立请求：读失败不该拖住权限开关的展示
					this.loadMediaCleanup()
					// 回补统计同理，只报总账号数
					this.loadPointsBackfillStats()
				} catch (error) {
					console.warn('loadPermissions failed', error)
					this.permission.loaded = true
					this.permission.error = '网络异常，请稍后重试'
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.loading.permissions = false
				}
			},
			/* ---------------- 云存储清理 ---------------- */
			async loadMediaCleanup() {
				if (!this.pageReady || this.currentTabKey !== 'permissions') {
					return
				}
				if (this.mediaCleanup.loading) {
					return
				}
				this.mediaCleanup.loading = true
				try {
					const result = await getPlatformApi().getMediaCleanupStats()
					const parsed = this.handleResult(result, '获取清理统计失败')
					if (!parsed.ok) {
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					const data = parsed.data || {}
					this.mediaCleanup.deletedPosts = Number(data.deletedPosts || 0)
					this.mediaCleanup.pendingPosts = Number(data.pendingPosts || 0)
					this.mediaCleanup.cleanedPosts = Number(data.cleanedPosts || 0)
					this.mediaCleanup.pendingFiles = Number(data.pendingFiles || 0)
					this.mediaCleanup.sampled = data.sampled === true
					this.mediaCleanup.loaded = true
				} catch (error) {
					console.warn('loadMediaCleanup failed', error)
				} finally {
					this.mediaCleanup.loading = false
				}
			},
			// 文件删掉不可恢复，必须二次确认；确认后才真正发请求
			handleCleanupMedia() {
				const cleanup = this.mediaCleanup
				if (cleanup.loading || cleanup.cleaning || !cleanup.pendingPosts) {
					return
				}
				const batch = Math.min(cleanup.pendingPosts, MEDIA_CLEANUP_BATCH)
				uni.showModal({
					title: '清理云存储',
					content: `将永久删除 ${batch} 条已删除动态的原图与缩略图，删除后无法恢复。确定继续？`,
					confirmText: '清理',
					confirmColor: '#e24b4a',
					success: (res) => {
						if (res.confirm) {
							this.runMediaCleanup()
						}
					}
				})
			},
			async runMediaCleanup() {
				if (this.mediaCleanup.cleaning) {
					return
				}
				this.mediaCleanup.cleaning = true
				uni.showLoading({
					title: '清理中…',
					mask: true
				})
				let loadingVisible = true
				const hideLoading = () => {
					if (!loadingVisible) {
						return
					}
					loadingVisible = false
					uni.hideLoading()
				}
				try {
					const result = await getPlatformApi().cleanupDailyMedia({
						limit: MEDIA_CLEANUP_BATCH
					})
					hideLoading()
					const parsed = this.handleResult(result, '清理失败')
					if (!parsed.ok) {
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					const data = parsed.data || {}
					const posts = Number(data.posts || 0)
					const files = Number(data.files || 0)
					const failed = Number(data.failed || 0)
					this.mediaCleanup.lastResult = failed
						? `已清理 ${posts} 条动态、${files} 个文件，${failed} 条失败（下次可重试）`
						: `已清理 ${posts} 条动态、${files} 个文件`
					uni.showToast({
						title: this.mediaCleanup.lastResult,
						icon: 'none'
					})
					await this.loadMediaCleanup()
				} catch (error) {
					hideLoading()
					console.warn('runMediaCleanup failed', error)
					uni.showToast({
						title: '清理失败，请稍后重试',
						icon: 'none'
					})
				} finally {
					this.mediaCleanup.cleaning = false
				}
			},
			/* ---------------- 心动点回补 ---------------- */
			async loadPointsBackfillStats() {
				if (!this.pageReady || this.currentTabKey !== 'permissions') {
					return
				}
				if (this.pointsBackfill.loading || this.pointsBackfill.running) {
					return
				}
				this.pointsBackfill.loading = true
				try {
					const result = await getPlatformApi().backfillPoints({ preview: true })
					const parsed = this.handleResult(result, '获取回补统计失败')
					if (!parsed.ok) {
						return
					}
					this.pointsBackfill.total = Number(parsed.data.total || 0)
				} catch (error) {
					console.warn('loadPointsBackfillStats failed', error)
				} finally {
					this.pointsBackfill.loading = false
				}
			},
			handleBackfillPoints() {
				const state = this.pointsBackfill
				// 正在跑就是「停止」：只置标记，让循环在下一批之前退出
				if (state.running) {
					state.stopped = true
					return
				}
				if (!state.total) {
					uni.showToast({ title: '暂无可回补的账号', icon: 'none' })
					return
				}
				uni.showModal({
					title: '回补心动点',
					content: `将为缺失记录的账号补发：注册 +100、绑定情侣 +1000、完善资料 +50。已有对应流水的跳过。共 ${state.total} 个注册账号，每批 ${state.batch} 个，中途可停止。`,
					confirmText: '开始回补',
					confirmColor: '#ec7558',
					success: (res) => {
						if (res.confirm) {
							this.runBackfillPoints()
						}
					}
				})
			},
			async runBackfillPoints() {
				const state = this.pointsBackfill
				state.running = true
				state.stopped = false
				state.scanned = 0
				state.accountsGranted = 0
				state.points = 0
				state.records = { register: 0, bind: 0, profile: 0 }
				state.offset = 0
				state.lastResult = ''
				// 跳过 / 失败只在最终文案里用，不必挂到 data 上逐帧刷新
				let skippedTotal = 0
				let failedTotal = 0

				// 兜底页数：正常翻到 hasMore=false 就结束，这里只防「期间持续有人注册」导致一直绕
				const maxPages = 500
				let page = 0
				try {
					let hasMore = true
					while (hasMore && !state.stopped && page < maxPages) {
						page += 1
						const result = await getPlatformApi().backfillPoints({
							offset: state.offset,
							limit: state.batch
						})
						const parsed = this.handleResult(result, '回补失败')
						if (!parsed.ok) {
							throw new Error(parsed.message || '回补失败')
						}
						const data = parsed.data || {}
						const records = data.records || {}
						state.total = Number(data.total || state.total)
						state.scanned += Number(data.scanned || 0)
						state.accountsGranted += Number(data.accountsGranted || 0)
						state.points += Number(data.points || 0)
						state.records.register += Number(records.register || 0)
						state.records.bind += Number(records.bind || 0)
						state.records.profile += Number(records.profile || 0)
						skippedTotal += Number(data.skipped || 0)
						failedTotal += Number(data.failed || 0)
						state.offset = Number(data.nextOffset || state.offset)
						hasMore = Boolean(data.hasMore)
						state.lastResult = `处理中：${state.scanned}/${state.total}，补发 ${state.accountsGranted} 个账号 · ${state.points} 分`
					}

					const breakdown = `注册 ${state.records.register} / 绑定 ${state.records.bind} / 资料 ${state.records.profile}`
					state.lastResult = state.stopped
						? `已停止：扫描 ${state.scanned}/${state.total}，补发 ${state.accountsGranted} 个账号 · ${state.points} 分（${breakdown}）`
						: `已完成：扫描 ${state.scanned} 个账号，补发 ${state.accountsGranted} 个 · ${state.points} 分（${breakdown}），跳过 ${skippedTotal}，失败 ${failedTotal}`
					uni.showToast({
						title: state.stopped ? '已停止' : '回补完成',
						icon: 'none'
					})
				} catch (error) {
					console.warn('runBackfillPoints failed', error)
					state.lastResult = `中断：${error.message || '未知错误'}（已扫描 ${state.scanned}，补发 ${state.accountsGranted} 个账号）`
					uni.showToast({ title: error.message || '回补失败', icon: 'none' })
				} finally {
					state.running = false
					state.stopped = false
				}
			},
			// 开关即时保存：先按用户意图更新，失败再回滚（版本号让 switch 重建，视觉跟着回滚）
			async onPermissionSwitch(item = {}, event = {}) {
				const nextValue = Boolean(event && event.detail ? event.detail.value : false)
				const field = item.field
				if (!field) {
					return
				}
				// 顶层开关写 permission[field]，子开关写 permission.gameItems / permission.pointsTasks[field]
				const target = item.parent === 'gameItems'
					? this.permission.gameItems
					: item.parent === 'pointsTasks'
						? this.permission.pointsTasks
						: this.permission
				const previous = target[field]
				if (nextValue === previous) {
					return
				}
				if (this.permission.saving) {
					// 上一次还没落库，这次点击直接回滚视觉，避免并发写互相覆盖
					this.permission.version += 1
					return
				}
				target[field] = nextValue
				this.permission.saving = true
				try {
					// 只提交当前这一项，其它开关的值由服务端原样返回
					const payload = item.parent === 'gameItems'
						? {
							gameItems: {
								[field]: nextValue
							}
						}
						: item.parent === 'pointsTasks'
							? {
								pointsTasks: {
									[field]: nextValue
								}
							}
							: {
								[field]: nextValue
							}
					const result = await getPlatformApi().updatePermissionSettings(payload)
					const parsed = this.handleResult(result, '保存权限设置失败')
					if (!parsed.ok) {
						target[field] = previous
						if (!parsed.silent) {
							uni.showToast({ title: parsed.message, icon: 'none' })
						}
						return
					}
					// 以服务端返回值为准（连同其它开关一起同步）
					this.permission.feedVisible = parsed.data.feedVisible === true
					this.permission.gameVisible = parsed.data.gameVisible !== false
					this.permission.gameItems = normalizeGameItems(parsed.data.gameItems)
					this.permission.pointsTasks = normalizePointsTasks(parsed.data.pointsTasks)
					this.permission.error = ''
					// 保存成功即刷新公共缓存，用户端下次进页面读到的就是新配置
					writeAppSettingsCache({
						feedVisible: this.permission.feedVisible,
						gameVisible: this.permission.gameVisible,
						gameItems: this.permission.gameItems,
						pointsTasks: this.permission.pointsTasks
					})
					uni.showToast({
						title: `${nextValue ? '已开启' : '已关闭'}${item.name || ''}`,
						icon: 'none'
					})
				} catch (error) {
					console.warn('updatePermissionSettings failed', error)
					target[field] = previous
					uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
				} finally {
					this.permission.saving = false
					this.permission.version += 1
				}
			}
		}
	}
</script>

<style>

	/* 导航右侧角色/保存标识胶囊 */
	.ops-nav-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 44rpx;
		padding: 0 18rpx;
		border-radius: 22rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.44);
		background: rgba(var(--noir-coral-rgb), 0.16);
	}

	.ops-nav-tag__txt {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		font-weight: 600;
		color: var(--noir-coral-light);
		letter-spacing: 1rpx;
		white-space: nowrap;
	}

	/* Tab（对标 s35-s38 .ops-tabs） */
	.ops-tabs {
		display: flex;
		align-items: center;
		border-bottom: 1rpx solid var(--noir-border);
	}

	.ops-tabs__item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14rpx;
		padding-top: 16rpx;
	}

	.ops-tabs__label {
		font-size: 26rpx;
		font-weight: 500;
		color: rgba(var(--noir-text-rgb), 0.42);
	}

	.ops-tabs__label--active {
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-tabs__indicator {
		width: 44rpx;
		height: 5rpx;
		border-radius: 3rpx;
		background: transparent;
	}

	.ops-tabs__indicator--active {
		background: var(--noir-coral-soft);
	}

	/* 时间筛选 */
	.ops-filter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		padding: 20rpx 0 4rpx;
	}

	.ops-filter__chips {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.ops-chip {
		padding: 10rpx 22rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
		display: flex;
	}

	.ops-chip--active {
		border-color: rgba(var(--noir-coral-rgb), 0.50);
		background: rgba(var(--noir-coral-rgb), 0.18);
	}

	.ops-chip__text {
		font-size: 20rpx;
		font-weight: 500;
		color: rgba(var(--noir-text-rgb), 0.56);
	}

	.ops-chip__text--active {
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-date {
		display: flex;
		align-items: center;
		gap: 6rpx;
		padding: 10rpx 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border-gold);
		background: var(--noir-glass-1);
		line-height: 26rpx;
	}

	.ops-date--active {
		border-color: rgba(var(--noir-coral-rgb), 0.50);
	}

	.ops-date__text {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		font-weight: 500;
		color: rgba(var(--noir-gold-rgb), 0.82);
	}

	.ops-date__sep {
		font-size: 18rpx;
		color: rgba(var(--noir-text-rgb), 0.34);
	}

	.ops-card {
		margin-top: 20rpx;
		padding: 26rpx 28rpx;
		border-radius: 28rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.075);
		background: var(--noir-sheet-hi);
	}

	.ops-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	/* 可折叠卡片：整条标题栏可点，右侧箭头指示展开状态 */
	.ops-card__head--toggle {
		cursor: pointer;
	}

	.ops-card__head-right {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.ops-card__arrow {
		font-size: 20rpx;
		color: rgba(var(--noir-gold-rgb), 0.68);
		transition: transform 0.2s ease;
	}

	.ops-card__arrow--open {
		transform: rotate(180deg);
	}

	.ops-card__title {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-card__hint {
		font-size: 19rpx;
		color: rgba(var(--noir-gold-rgb), 0.64);
	}

	.ops-card__link {
		font-size: 20rpx;
		font-weight: 500;
		color: var(--noir-coral-soft);
	}

	/* NOIR 主数据卡（对标 s35 .ov-hero / s37 .ad-hero） */
	.ops-hero {
		margin-top: 20rpx;
		padding: 28rpx 30rpx;
		border-radius: 32rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.22);
		background: linear-gradient(135deg, rgba(var(--noir-gold-rgb), 0.12), rgba(var(--noir-coral-rgb), 0.06) 58%, var(--noir-glass-1));
	}

	.ops-hero__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.ops-hero__label {
		font-size: 22rpx;
		font-weight: 500;
		color: rgba(var(--noir-gold-rgb), 0.80);
	}

	.ops-hero__badge {
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid var(--noir-border-coral);
		background: rgba(var(--noir-coral-rgb), 0.16);
		display: flex;
	}

	.ops-hero__badge-text {
		font-size: 19rpx;
		font-weight: 600;
		color: var(--noir-coral-light);
	}

	.ops-hero__amount {
		display: flex;
		align-items: baseline;
		gap: 10rpx;
		margin-top: 12rpx;
	}

	.ops-hero__number {
		font-family: "Georgia", "Times New Roman", serif;
		font-size: 64rpx;
		font-weight: 500;
		line-height: 1.05;
		color: var(--noir-text-strong);
	}

	.ops-hero__unit,
	.ops-hero__currency {
		font-size: 24rpx;
		font-weight: 500;
		color: rgba(var(--noir-text-rgb), 0.52);
	}

	.ops-hero__delta {
		display: block;
		margin-top: 10rpx;
		font-size: 20rpx;
		color: var(--noir-coral-soft);
	}

	.ops-hero__divider {
		height: 1rpx;
		margin: 22rpx 0;
		background: var(--noir-glass-3);
	}

	.ops-hero__grid {
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	/* 5 列（广告 tab 多一个 CPC）：字号收一点，避免换行 */
	.ops-hero__grid--five .ops-hero__value {
		font-size: 24rpx;
	}

	.ops-hero__cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6rpx;
	}

	.ops-hero__value {
		font-family: "Georgia", serif;
		font-size: 32rpx;
		font-weight: 500;
		color: var(--noir-gold-soft);
	}

	.ops-hero__cell-label {
		font-size: 18rpx;
		color: rgba(var(--noir-text-rgb), 0.42);
	}

	/* 今日关键指标（今日 vs 昨日） */
	.ops-today {
		display: flex;
		align-items: stretch;
		gap: 10rpx;
		padding: 18rpx;
	}

	.ops-today__cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6rpx;
		padding: 14rpx 4rpx;
		border-radius: 20rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.06);
		background: var(--noir-glass-1);
	}

	.ops-today__label {
		font-size: 18rpx;
		color: var(--noir-text-muted);
	}

	.ops-today__value {
		font-family: "Georgia", serif;
		font-size: 30rpx;
		font-weight: 500;
		line-height: 1.1;
		color: var(--noir-gold-soft);
	}

	.ops-today__delta {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 17rpx;
		font-weight: 600;
		color: var(--noir-text-muted);
	}

	.ops-today__delta--up {
		color: var(--noir-coral-soft);
	}

	.ops-today__delta--down {
		color: var(--noir-green);
	}

	/* 转化步骤：页面自绘占比条（量为 0 / 1 时比漏斗好读） */
	.ops-steps {
		display: flex;
		flex-direction: column;
		gap: 24rpx;
		margin-top: 26rpx;
	}

	.ops-step__head {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.ops-step__dot {
		width: 12rpx;
		height: 12rpx;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.ops-step__name {
		flex: 1;
		min-width: 0;
		font-size: 24rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-step__value {
		font-size: 28rpx;
		font-weight: 700;
		color: var(--noir-text-strong);
	}

	.ops-step__track {
		height: 10rpx;
		margin-top: 12rpx;
		border-radius: 6rpx;
		background: var(--noir-glass-3);
		overflow: hidden;
	}

	.ops-step__bar {
		height: 100%;
		border-radius: 6rpx;
	}

	.ops-step__sub {
		display: block;
		margin-top: 8rpx;
		font-size: 18rpx;
		color: var(--noir-text-faded);
	}

	/* 图表（xtf-charts：canvas 宽度撑满卡片内容区，高度由 height 传 px） */
	.ops-chart-box {
		margin-top: 8rpx;
	}

	.ops-chart__summary {
		display: block;
		margin-top: 12rpx;
		font-size: 18rpx;
		color: var(--noir-text-muted);
	}

	.ops-chart__metrics {
		display: flex;
		align-items: center;
		margin-top: 16rpx;
		padding-top: 16rpx;
		border-top: 1rpx solid rgba(var(--noir-wash-rgb), 0.07);
	}

	.ops-chart__metric {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
	}

	.ops-chart__metric-label {
		font-size: 18rpx;
		color: var(--noir-text-muted);
	}

	.ops-chart__metric-value {
		font-size: 22rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	/* 反馈 */
	.ops-feedback {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 20rpx;
	}

	.ops-feedback__main {
		display: flex;
		align-items: baseline;
		gap: 8rpx;
	}

	.ops-feedback__num {
		font-size: 40rpx;
		font-weight: 700;
		color: var(--noir-coral);
	}

	.ops-feedback__label {
		font-size: 18rpx;
		color: var(--noir-text-faded);
	}

	.ops-feedback__rest {
		font-size: 20rpx;
		color: var(--noir-text-faded);
	}

	/* 模块 */
	.ops-summary-row {
		display: flex;
		align-items: center;
		margin-top: 18rpx;
	}

	.ops-summary-row__cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
	}

	.ops-summary-row__value {
		font-size: 34rpx;
		font-weight: 700;
		color: var(--noir-text-strong);
	}

	.ops-summary-row__value--accent {
		color: var(--noir-coral);
	}

	.ops-summary-row__label {
		font-size: 18rpx;
		color: var(--noir-text-faded);
	}

	.ops-modules {
		display: flex;
		flex-wrap: wrap;
		gap: 18rpx;
		margin-top: 20rpx;
	}

	.ops-module {
		width: calc(50% - 10rpx);
		box-sizing: border-box;
		padding: 24rpx;
		border-radius: 26rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.075);
		background: var(--noir-glass-1);
	}

	.ops-module__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8rpx;
	}

	.ops-module__name {
		font-size: 22rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-module__penetration {
		font-size: 18rpx;
		font-weight: 600;
		color: var(--noir-coral);
	}

	.ops-module__value-row {
		display: flex;
		align-items: flex-end;
		gap: 6rpx;
		margin-top: 10rpx;
	}

	.ops-module__value {
		font-size: 38rpx;
		font-weight: 700;
		line-height: 1.1;
		color: var(--noir-text-strong);
	}

	.ops-module__unit {
		font-size: 18rpx;
		color: var(--noir-text-faded);
		padding-bottom: 4rpx;
	}

	.ops-module__meta {
		display: block;
		margin-top: 8rpx;
		font-size: 18rpx;
		color: var(--noir-text-faded);
	}

	.ops-module__track {
		height: 6rpx;
		margin-top: 14rpx;
		border-radius: 4rpx;
		background: var(--noir-glass-3);
		overflow: hidden;
	}

	.ops-module__bar {
		height: 100%;
		border-radius: 4rpx;
		background: linear-gradient(90deg, var(--ops-06) 0%, var(--noir-coral) 100%);
	}

	/* 广告：同步状态（对标 s37 .ad-sync） */
	.ops-sync {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-top: 20rpx;
		padding: 14rpx 22rpx;
		border-radius: 22rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
	}

	.ops-sync__dot {
		width: 12rpx;
		height: 12rpx;
		border-radius: 50%;
		background: rgba(var(--noir-gold-rgb), 0.6);
		flex-shrink: 0;
	}

	.ops-sync__text {
		flex: 1;
		font-size: 20rpx;
		color: rgba(var(--noir-text-rgb), 0.68);
	}

	.ops-sync.ops-sync--ok {
		border-color: rgba(var(--noir-green-rgb), 0.32);
		background: rgba(var(--noir-green-rgb), 0.08);
	}

	.ops-sync.ops-sync--ok .ops-sync__dot {
		background: var(--noir-green);
	}

	.ops-sync.ops-sync--ok .ops-sync__text {
		color: var(--noir-green);
	}

	.ops-sync.ops-sync--wait .ops-sync__dot {
		background: var(--ops-05);
	}

	.ops-sync.ops-sync--error .ops-sync__dot {
		background: var(--noir-coral);
	}

	/* 广告：多应用未收敛提示 */
	.ops-warn {
		margin-top: 12rpx;
		padding: 14rpx 22rpx;
		border-radius: 18rpx;
		background: rgba(var(--ops-05-rgb), 0.10);
		border: 1rpx solid rgba(var(--ops-05-rgb), 0.34);
	}

	.ops-warn__text {
		font-size: 19rpx;
		line-height: 1.6;
		color: var(--ops-07);
	}

	/* 广告：快捷区间（对标 s37 .ad-q4） */
	.ops-quick {
		display: flex;
		align-items: stretch;
		gap: 12rpx;
		padding: 18rpx;
	}

	.ops-quick__cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8rpx;
		padding: 16rpx 6rpx;
		border-radius: 20rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.07);
		background: var(--noir-glass-1);
	}

	.ops-quick__cell--active {
		border-color: rgba(var(--noir-gold-rgb), 0.46);
		background: rgba(var(--noir-gold-rgb), 0.12);
	}

	.ops-quick__label {
		font-size: 18rpx;
		color: rgba(var(--noir-text-rgb), 0.46);
	}

	.ops-quick__label--active {
		font-weight: 600;
		color: var(--noir-gold-soft);
	}

	.ops-quick__value {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 24rpx;
		font-weight: 600;
		color: var(--noir-text);
	}

	.ops-quick__value--active {
		color: var(--noir-coral-bright);
	}

	/* 广告：筛选 */
	.ops-presets {
		width: 100%;
		margin-top: 18rpx;
		white-space: nowrap;
	}

	.ops-presets__inner {
		display: inline-flex;
		align-items: center;
		gap: 12rpx;
		padding: 2rpx;
	}

	.ops-custom-row {
		display: flex;
		margin-top: 16rpx;
	}

	.ops-custom {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 10rpx 18rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-coral-rgb), 0.4);
		background: var(--noir-surface);
	}

	.ops-pills {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-top: 16rpx;
	}

	.ops-pill {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 12rpx 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.12);
		background: var(--noir-glass-1);
	}

	.ops-pill--active {
		border-color: rgba(var(--noir-coral-rgb), 0.50);
		background: rgba(var(--noir-coral-rgb), 0.14);
	}

	.ops-pill--reset {
		border-style: dashed;
	}

	.ops-pill__text {
		max-width: 220rpx;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 19rpx;
		color: rgba(var(--noir-text-rgb), 0.56);
	}

	.ops-pill__caret {
		width: 10rpx;
		height: 10rpx;
		margin-top: -4rpx;
		border-right: 2rpx solid var(--ops-04);
		border-bottom: 2rpx solid var(--ops-04);
		transform: rotate(45deg);
	}

	/* 广告：明细分段 */
	.ops-seg {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 4rpx;
		border-radius: 999rpx;
		background: var(--noir-sheet-lo);
	}

	.ops-seg__item {
		padding: 8rpx 22rpx;
		border-radius: 999rpx;
		display: flex;
	}

	.ops-seg__item--active {
		background: var(--noir-surface);
		box-shadow: 0 4rpx 12rpx rgba(var(--noir-shadow-rgb), 0.42);
	}

	.ops-seg__text {
		font-size: 19rpx;
		color: var(--noir-text-faded);
	}

	.ops-seg__text--active {
		font-weight: 700;
		color: var(--ops-01);
	}

	/* 广告：按日期明细表 */
	.ops-table__head,
	.ops-table__row {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 16rpx 0;
	}

	.ops-table__head {
		margin-top: 18rpx;
		border-bottom: 1rpx solid var(--noir-border);
	}

	.ops-table__row + .ops-table__row {
		border-top: 1rpx solid rgba(var(--noir-wash-rgb), 0.05);
	}

	.ops-table__th {
		flex: 1;
		text-align: right;
		font-size: 18rpx;
		color: var(--noir-text-muted);
	}

	.ops-table__th--wide {
		flex: 1.2;
		text-align: left;
	}

	.ops-table__th--rev {
		flex: 1.1;
	}

	.ops-table__td {
		flex: 1;
		text-align: right;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		color: rgba(var(--noir-text-rgb), 0.72);
	}

	.ops-table__td--wide {
		flex: 1.2;
		text-align: left;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-table__td--rev {
		flex: 1.1;
		font-weight: 600;
		color: var(--noir-gold-soft);
	}

	.ops-more {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 16rpx;
		padding: 12rpx 0;
		border-radius: 999rpx;
		background: var(--noir-sheet-lo);
	}

	.ops-more__text {
		font-size: 19rpx;
		color: var(--ops-01);
	}

	/* 广告：按广告位 */
	.ops-ad-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-top: 22rpx;
	}

	.ops-ad-row__left {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
	}

	.ops-ad-row__name {
		font-size: 22rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-ad-row__meta {
		font-size: 18rpx;
		color: var(--noir-text-faded);
	}

	.ops-ad-row__right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4rpx;
	}

	.ops-ad-row__revenue {
		font-size: 24rpx;
		font-weight: 600;
		color: var(--ops-02);
	}

	.ops-ad-row__sub {
		font-size: 17rpx;
		color: var(--noir-text-muted);
	}

	.ops-ad-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 22rpx;
		padding-top: 20rpx;
		border-top: 1rpx solid var(--noir-border);
	}

	.ops-ad-total__label {
		flex-shrink: 0;
		font-size: 20rpx;
		color: rgba(var(--noir-text-rgb), 0.60);
	}

	.ops-ad-total__value {
		text-align: right;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 20rpx;
		font-weight: 600;
		color: var(--noir-gold-soft);
	}

	/* 广告：环形图图例（两列） */
	.ops-ring-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx 20rpx;
		margin-top: 8rpx;
	}

	.ops-ring-legend__item {
		width: calc(50% - 10rpx);
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	.ops-ring-legend__dot {
		width: 12rpx;
		height: 12rpx;
		border-radius: 4rpx;
		flex-shrink: 0;
	}

	.ops-ring-legend__name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 19rpx;
		color: rgba(var(--noir-text-rgb), 0.72);
	}

	.ops-ring-legend__percent {
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 19rpx;
		font-weight: 600;
		color: var(--noir-gold-soft);
	}

	/* 广告：类型分布 */
	.ops-type {
		margin-top: 20rpx;
	}

	.ops-type__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12rpx;
	}

	.ops-type__name {
		font-size: 21rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-type__meta {
		font-size: 18rpx;
		color: var(--noir-text-muted);
	}

	.ops-type__track {
		height: 8rpx;
		margin-top: 10rpx;
		border-radius: 4rpx;
		background: var(--noir-glass-3);
		overflow: hidden;
	}

	.ops-type__bar {
		height: 100%;
		border-radius: 4rpx;
		background: linear-gradient(90deg, var(--ops-06) 0%, var(--noir-coral) 100%);
	}

	/* 广告：数据核对 */
	.ops-diag__intro {
		display: block;
		margin-top: 8rpx;
		line-height: 1.6;
	}

	.ops-diag__meta {
		margin-top: 14rpx;
		padding: 12rpx 16rpx;
		border-radius: 14rpx;
		background: var(--noir-sheet-lo);
	}

	.ops-diag__meta-text {
		font-size: 18rpx;
		line-height: 1.6;
		color: rgba(var(--noir-text-rgb), 0.56);
	}

	.ops-diag__label {
		display: block;
		margin-top: 18rpx;
		font-size: 18rpx;
		font-weight: 600;
		color: var(--ops-01);
	}

	.ops-diag__row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
		margin-top: 10rpx;
	}

	.ops-diag__name {
		flex: 1;
		min-width: 0;
		word-break: break-all;
		font-size: 19rpx;
		color: rgba(var(--noir-text-rgb), 0.72);
	}

	.ops-diag__value {
		font-size: 20rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	/* 状态 */
	.ops-loading {
		padding: 80rpx 0;
		text-align: center;
	}

	.ops-loading__text {
		font-size: 22rpx;
		color: var(--noir-text-faded);
	}

	.ops-empty {
		padding: 30rpx 0;
		text-align: center;
	}

	.ops-empty__text {
		font-size: 20rpx;
		color: var(--ops-03);
	}

	.ops-forbidden {
		margin-top: 40rpx;
		padding: 48rpx 32rpx;
		border-radius: 32rpx;
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-1);
		text-align: center;
	}

	.ops-forbidden__title {
		display: block;
		font-size: 28rpx;
		font-weight: 700;
		color: var(--noir-text-strong);
	}

	.ops-forbidden__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: rgba(var(--noir-text-rgb), 0.52);
	}

	.ops-foot-note {
		display: block;
		margin-top: 14rpx;
		font-size: 18rpx;
		line-height: 1.7;
		color: var(--noir-text-muted);
	}

	/* 权限 tab：开关行 */
	.ops-perm {
		margin-top: 20rpx;
	}

	.ops-perm__group + .ops-perm__group {
		margin-top: 4rpx;
		padding-top: 4rpx;
		border-top: 1rpx solid rgba(var(--noir-wash-rgb), 0.07);
	}

	.ops-perm__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24rpx;
		padding: 20rpx 0;
	}

	/* 子开关：缩进 + 左侧竖线；父开关关闭时整组降透明度（值还在，重新打开不用重配） */
	.ops-perm__children {
		margin: 0 0 10rpx;
		padding: 2rpx 0 2rpx 22rpx;
		border-left: 3rpx solid rgba(var(--noir-gold-rgb), 0.28);
	}

	.ops-perm__children--muted {
		opacity: 0.55;
	}

	.ops-perm__item--child {
		padding: 12rpx 0;
	}

	/* 受页面显示权限控制的任务：整行变淡，跟禁用的开关呼应 */
	.ops-perm__item--locked {
		opacity: 0.55;
	}

	/* 权限开关压扁：只收高度，宽度沿用 scale-ratio 0.75 后的尺寸。
	   fui-switch 没有单独的高度属性，只能覆盖它内部三层尺寸（轨道 / 关闭底色 / 滑块），
	   改组件升级后类名若变，这里要跟着调。 */
	.ops-perm .fui-switch__input-def {
		height: 26px !important;
		border-radius: 13px !important;
	}

	.ops-perm .fui-switch__input-before {
		top: 1px !important;
		height: 24px !important;
		border-radius: 12px !important;
	}

	.ops-perm .fui-switch__input-after {
		top: 1px !important;
		width: 24px !important;
		height: 24px !important;
		border-radius: 12px !important;
	}

	/* 滑块右移距离 = 轨道宽 52 - 边框 2 - 滑块 24 */
	.ops-perm .fui-switch__input--after {
		transform: translateX(26px) !important;
	}

	.ops-perm__item--child + .ops-perm__item--child {
		border-top: 1rpx dashed rgba(var(--noir-wash-rgb), 0.06);
	}

	.ops-perm__name--child {
		font-size: 24rpx;
		font-weight: 500;
	}

	.ops-perm__main {
		flex: 1;
		min-width: 0;
	}

	.ops-perm__title-row {
		display: flex;
		align-items: center;
		gap: 12rpx;
	}

	.ops-perm__name {
		font-size: 26rpx;
		font-weight: 600;
		color: var(--noir-text-strong);
	}

	.ops-perm__state {
		padding: 4rpx 14rpx;
		border-radius: 999rpx;
		font-size: 17rpx;
		font-weight: 500;
		color: rgba(var(--noir-text-rgb), 0.48);
		border: 1rpx solid var(--noir-border);
		background: var(--noir-glass-2);
	}

	.ops-perm__state--on {
		color: var(--noir-green);
		border-color: rgba(var(--noir-green-rgb), 0.34);
		background: rgba(var(--noir-green-rgb), 0.14);
	}

	.ops-perm__desc {
		display: block;
		margin-top: 8rpx;
		font-size: 19rpx;
		line-height: 1.6;
		color: var(--noir-text-muted);
	}

	/* 权限 tab：云存储清理与心动点回补（对标 s38 .pm-stat3 / .pm-act） */
	.ops-cleanup__stats {
		display: flex;
		gap: 12rpx;
		margin-top: 18rpx;
	}

	.ops-cleanup__stat {
		flex: 1;
		padding: 18rpx 10rpx;
		border-radius: 18rpx;
		border: 1rpx solid rgba(var(--noir-wash-rgb), 0.07);
		background: var(--noir-glass-1);
		text-align: center;
	}

	.ops-cleanup__value {
		display: block;
		font-family: "SF Mono", "Consolas", monospace;
		font-size: 32rpx;
		font-weight: 500;
		line-height: 1.2;
		color: var(--noir-gold-soft);
	}

	.ops-cleanup__value--warn {
		color: var(--noir-coral-soft);
	}

	.ops-cleanup__label {
		display: block;
		margin-top: 6rpx;
		font-size: 18rpx;
		color: rgba(var(--noir-text-rgb), 0.42);
	}

	.ops-cleanup__desc {
		display: block;
		margin-top: 18rpx;
		font-size: 19rpx;
		line-height: 1.65;
		color: rgba(var(--noir-text-rgb), 0.46);
	}

	.ops-cleanup__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 76rpx;
		margin-top: 20rpx;
		border-radius: 999rpx;
		border: 1rpx solid rgba(var(--noir-gold-rgb), 0.36);
		background: rgba(var(--noir-gold-rgb), 0.10);
	}

	.ops-cleanup__btn--disabled {
		opacity: 0.45;
	}

	.ops-cleanup__btn-text {
		font-size: 24rpx;
		font-weight: 500;
		color: var(--noir-gold-soft);
	}

	.ops-cleanup__result {
		display: block;
		margin-top: 14rpx;
		font-size: 19rpx;
		line-height: 1.6;
		color: var(--noir-coral-soft);
	}
</style>
