<template>
	<view class="love-page love-page--compact ops-page">
		<view class="love-page__glow love-page__glow--left"></view>
		<view class="love-page__glow love-page__glow--right"></view>

		<view class="love-layer">
			<fui-status-bar background="transparent"></fui-status-bar>

			<!-- 导航 -->
			<view class="ops-nav">
				<view class="ops-nav__back" @click="goBack">
					<view class="ops-nav__chevron"></view>
				</view>
				<text class="ops-nav__title">运营管理</text>
				<view class="ops-nav__refresh" @click="refreshCurrentTab">
					<text class="ops-nav__refresh-text">刷新</text>
				</view>
			</view>

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

			<!-- 时间筛选（广告 tab 有自己的预设区间，这里只服务总览 / 模块） -->
			<view v-if="currentTabKey !== 'ads'" class="ops-filter">
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
				<view v-if="activeTab === 0" class="ops-body">
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
				<view v-else-if="activeTab === 1" class="ops-body">
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
				<view v-else class="ops-body">
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
			</template>
		</view>
	</view>
</template>

<script>
	import { requirePageLogin } from '@/common/auth-entry.js'
	import { getPlatformApi } from '@/common/api/platform.js'
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
		{ key: 'ads', label: '广告' }
	]

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
					ads: false
				},
				loaded: {
					overview: false,
					modules: false,
					ads: false
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
				pageReady: false,
				loginPassed: false,
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
			currentTabKey() {
				return (TABS[this.activeTab] || TABS[0]).key
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
				return buildUserTrendOption(this.overview.trend || [])
			},
			visitTrendOption() {
				return buildVisitTrendOption(this.overview.trend || [])
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
				return buildModulePenetrationOption(this.moduleStats.modules || [])
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
				return buildAdTrendOption(this.adStats.trend || [])
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
				return buildAdPositionRingOption(this.adRingPositions)
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
			}
		},
		onLoad() {
			// 只做登录闸门，不发数据请求：tab 真正渲染出来之前不查询
			this.loginPassed = requirePageLogin()
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
			}
		}
	}
</script>

<style>
	.ops-page {
		padding: 28rpx 24rpx calc(40rpx + env(safe-area-inset-bottom));
	}

	/* 导航 */
	.ops-nav {
		display: flex;
		align-items: center;
		gap: 8rpx;
		height: 96rpx;
		padding: 0 4rpx;
	}

	.ops-nav__back,
	.ops-nav__refresh {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.86);
	}

	/* 返回箭头：不依赖图标字体，两条描边旋转 45° */
	.ops-nav__chevron {
		width: 18rpx;
		height: 18rpx;
		margin-left: 8rpx;
		border-left: 4rpx solid #5a3427;
		border-bottom: 4rpx solid #5a3427;
		transform: rotate(45deg);
	}

	.ops-nav__refresh-text {
		font-size: 20rpx;
		font-weight: 500;
		color: #b36a56;
	}

	.ops-nav__title {
		flex: 1;
		text-align: center;
		font-size: 34rpx;
		font-weight: 600;
		color: #5a3427;
	}

	/* Tab */
	.ops-tabs {
		display: flex;
		align-items: center;
		border-bottom: 1rpx solid rgba(240, 220, 210, 0.85);
	}

	.ops-tabs__item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14rpx;
		padding-top: 18rpx;
	}

	.ops-tabs__label {
		font-size: 26rpx;
		font-weight: 500;
		color: #9a766c;
	}

	.ops-tabs__label--active {
		font-weight: 700;
		color: #5a3427;
	}

	.ops-tabs__indicator {
		width: 40rpx;
		height: 6rpx;
		border-radius: 4rpx;
		background: transparent;
	}

	.ops-tabs__indicator--active {
		background: #ec7558;
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
		padding: 12rpx 22rpx;
		border-radius: 999rpx;
		background: #fff6f1;
		display: flex;
	}

	.ops-chip--active {
		background: #ec7558;
	}

	.ops-chip__text {
		font-size: 20rpx;
		font-weight: 500;
		color: #9a766c;
	}

	.ops-chip__text--active {
		font-weight: 600;
		color: #ffffff;
	}

	.ops-date {
		display: flex;
		align-items: center;
		gap: 6rpx;
		padding: 10rpx 16rpx;
		border-radius: 999rpx;
		border: 1rpx solid #efd9d0;
		background: #ffffff;
		line-height: 26rpx;
	}

	.ops-date--active {
		border-color: rgba(236, 117, 88, 0.45);
	}

	.ops-date__text {
		font-size: 18rpx;
		font-weight: 500;
		color: #bf6e59;
	}

	.ops-date__sep {
		font-size: 18rpx;
		color: #cbb2a8;
	}

	/* 通用卡片 */
	.ops-body {
		padding-top: 20rpx;
	}

	.ops-card {
		margin-top: 20rpx;
		padding: 28rpx;
		border-radius: 32rpx;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 246, 239, 0.96));
		box-shadow: 0 16rpx 40rpx rgba(177, 114, 83, 0.1);
	}

	.ops-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16rpx;
	}

	.ops-card__title {
		font-size: 26rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.ops-card__hint {
		font-size: 18rpx;
		color: #a07b70;
	}

	.ops-card__link {
		font-size: 18rpx;
		font-weight: 500;
		color: #bf6e59;
	}

	/* 珊瑚色主卡 */
	.ops-hero {
		margin-top: 20rpx;
		padding: 32rpx;
		border-radius: 40rpx;
		background: linear-gradient(135deg, #ff8b72 0%, #e76f51 100%);
		box-shadow: 0 28rpx 52rpx rgba(231, 111, 81, 0.28);
	}

	.ops-hero__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.ops-hero__label {
		font-size: 22rpx;
		font-weight: 500;
		color: #fff2ec;
	}

	.ops-hero__badge {
		padding: 6rpx 16rpx;
		border-radius: 999rpx;
		background: rgba(255, 255, 255, 0.22);
		display: flex;
	}

	.ops-hero__badge-text {
		font-size: 18rpx;
		font-weight: 600;
		color: #ffffff;
	}

	.ops-hero__amount {
		display: flex;
		align-items: flex-end;
		gap: 8rpx;
		margin-top: 12rpx;
	}

	.ops-hero__number {
		font-size: 68rpx;
		font-weight: 700;
		line-height: 1.1;
		color: #ffffff;
	}

	.ops-hero__unit,
	.ops-hero__currency {
		font-size: 24rpx;
		font-weight: 600;
		color: #ffe8de;
		padding-bottom: 8rpx;
	}

	.ops-hero__delta {
		display: block;
		margin-top: 8rpx;
		font-size: 18rpx;
		color: #ffe8de;
	}

	.ops-hero__divider {
		height: 1rpx;
		margin: 24rpx 0;
		background: rgba(255, 255, 255, 0.26);
	}

	.ops-hero__grid {
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	/* 5 列（广告 tab 多一个 CPC）：字号收一点，避免换行 */
	.ops-hero__grid--five .ops-hero__value {
		font-size: 26rpx;
	}

	.ops-hero__cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6rpx;
	}

	.ops-hero__value {
		font-size: 30rpx;
		font-weight: 700;
		color: #ffffff;
	}

	.ops-hero__cell-label {
		font-size: 18rpx;
		color: #ffe3d9;
	}

	/* 今日关键指标（今日 vs 昨日） */
	.ops-today {
		display: flex;
		align-items: stretch;
		gap: 10rpx;
		padding: 20rpx;
	}

	.ops-today__cell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6rpx;
		padding: 14rpx 4rpx;
		border-radius: 20rpx;
		background: #fff6f1;
	}

	.ops-today__label {
		font-size: 18rpx;
		color: #9a766c;
	}

	.ops-today__value {
		font-size: 30rpx;
		font-weight: 700;
		line-height: 1.1;
		color: #5a3427;
	}

	.ops-today__delta {
		font-size: 17rpx;
		font-weight: 600;
		color: #b08e83;
	}

	.ops-today__delta--up {
		color: #d9534f;
	}

	.ops-today__delta--down {
		color: #5aa469;
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
		color: #5d372b;
	}

	.ops-step__value {
		font-size: 28rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.ops-step__track {
		height: 10rpx;
		margin-top: 12rpx;
		border-radius: 6rpx;
		background: rgba(231, 204, 194, 0.5);
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
		color: #9a766c;
	}

	/* 图表（xtf-charts：canvas 宽度撑满卡片内容区，高度由 height 传 px） */
	.ops-chart-box {
		margin-top: 8rpx;
	}

	.ops-chart__summary {
		display: block;
		margin-top: 12rpx;
		font-size: 18rpx;
		color: #a07b70;
	}

	.ops-chart__metrics {
		display: flex;
		align-items: center;
		margin-top: 16rpx;
		padding-top: 16rpx;
		border-top: 1rpx solid rgba(240, 220, 210, 0.9);
	}

	.ops-chart__metric {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
	}

	.ops-chart__metric-label {
		font-size: 18rpx;
		color: #a07b70;
	}

	.ops-chart__metric-value {
		font-size: 22rpx;
		font-weight: 600;
		color: #5a3427;
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
		color: #ec7558;
	}

	.ops-feedback__label {
		font-size: 18rpx;
		color: #9a766c;
	}

	.ops-feedback__rest {
		font-size: 20rpx;
		color: #9a766c;
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
		color: #5a3427;
	}

	.ops-summary-row__value--accent {
		color: #ec7558;
	}

	.ops-summary-row__label {
		font-size: 18rpx;
		color: #9a766c;
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
		border-radius: 28rpx;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(255, 246, 239, 0.96));
		box-shadow: 0 12rpx 30rpx rgba(177, 114, 83, 0.08);
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
		color: #5d372b;
	}

	.ops-module__penetration {
		font-size: 18rpx;
		font-weight: 600;
		color: #ec7558;
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
		color: #5a3427;
	}

	.ops-module__unit {
		font-size: 18rpx;
		color: #9a766c;
		padding-bottom: 4rpx;
	}

	.ops-module__meta {
		display: block;
		margin-top: 8rpx;
		font-size: 18rpx;
		color: #9a766c;
	}

	.ops-module__track {
		height: 6rpx;
		margin-top: 14rpx;
		border-radius: 4rpx;
		background: rgba(231, 204, 194, 0.55);
		overflow: hidden;
	}

	.ops-module__bar {
		height: 100%;
		border-radius: 4rpx;
		background: linear-gradient(90deg, #ffb199 0%, #ec7558 100%);
	}

	/* 广告：同步状态 */
	.ops-sync {
		display: flex;
		align-items: center;
		gap: 12rpx;
		margin-top: 20rpx;
		padding: 14rpx 22rpx;
		border-radius: 999rpx;
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 8rpx 22rpx rgba(177, 114, 83, 0.06);
	}

	.ops-sync__dot {
		width: 12rpx;
		height: 12rpx;
		border-radius: 50%;
		background: #cbb2a8;
		flex-shrink: 0;
	}

	.ops-sync__text {
		flex: 1;
		font-size: 19rpx;
		color: #8b6659;
	}

	.ops-sync.ops-sync--ok .ops-sync__dot {
		background: #5aa469;
	}

	.ops-sync.ops-sync--wait .ops-sync__dot {
		background: #e0a13c;
	}

	.ops-sync.ops-sync--error .ops-sync__dot {
		background: #d9534f;
	}

	/* 广告：多应用未收敛提示 */
	.ops-warn {
		margin-top: 12rpx;
		padding: 14rpx 22rpx;
		border-radius: 18rpx;
		background: rgba(255, 244, 232, 0.96);
		border: 1rpx solid rgba(224, 161, 60, 0.35);
	}

	.ops-warn__text {
		font-size: 18rpx;
		line-height: 1.6;
		color: #b37a2e;
	}

	/* 广告：快捷区间 */
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
		border-radius: 22rpx;
		background: #fff6f1;
	}

	.ops-quick__cell--active {
		background: linear-gradient(145deg, #fff0ea 0%, #ffe1d7 100%);
		box-shadow: inset 0 0 0 1rpx rgba(236, 117, 88, 0.32);
	}

	.ops-quick__label {
		font-size: 18rpx;
		color: #9a766c;
	}

	.ops-quick__label--active {
		font-weight: 600;
		color: #b3563f;
	}

	.ops-quick__value {
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		font-size: 24rpx;
		font-weight: 700;
		color: #5a3427;
	}

	.ops-quick__value--active {
		color: #e76f51;
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
		border: 1rpx solid rgba(236, 117, 88, 0.4);
		background: #ffffff;
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
		border: 1rpx solid #efd9d0;
		background: #ffffff;
	}

	.ops-pill--active {
		border-color: rgba(236, 117, 88, 0.55);
		background: #fff2ec;
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
		color: #8b6659;
	}

	.ops-pill__caret {
		width: 10rpx;
		height: 10rpx;
		margin-top: -4rpx;
		border-right: 2rpx solid #c08e7f;
		border-bottom: 2rpx solid #c08e7f;
		transform: rotate(45deg);
	}

	/* 广告：明细分段 */
	.ops-seg {
		display: flex;
		align-items: center;
		gap: 8rpx;
		padding: 4rpx;
		border-radius: 999rpx;
		background: #fff6f1;
	}

	.ops-seg__item {
		padding: 8rpx 22rpx;
		border-radius: 999rpx;
	}

	.ops-seg__item--active {
		background: #ffffff;
		box-shadow: 0 4rpx 12rpx rgba(177, 114, 83, 0.12);
	}

	.ops-seg__text {
		font-size: 19rpx;
		color: #9a766c;
	}

	.ops-seg__text--active {
		font-weight: 700;
		color: #b3563f;
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
		border-bottom: 1rpx solid rgba(240, 220, 210, 0.9);
	}

	.ops-table__row + .ops-table__row {
		border-top: 1rpx solid rgba(246, 232, 226, 0.9);
	}

	.ops-table__th {
		flex: 1;
		text-align: right;
		font-size: 18rpx;
		color: #a07b70;
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
		font-size: 20rpx;
		color: #6e4a3f;
	}

	.ops-table__td--wide {
		flex: 1.2;
		text-align: left;
		font-weight: 600;
		color: #5d372b;
	}

	.ops-table__td--rev {
		flex: 1.1;
		font-weight: 600;
		color: #b36a56;
	}

	.ops-more {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: 16rpx;
		padding: 12rpx 0;
		border-radius: 999rpx;
		background: #fff6f1;
	}

	.ops-more__text {
		font-size: 19rpx;
		color: #b3563f;
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
		color: #5d372b;
	}

	.ops-ad-row__meta {
		font-size: 18rpx;
		color: #9a766c;
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
		color: #b36a56;
	}

	.ops-ad-row__sub {
		font-size: 17rpx;
		color: #a07b70;
	}

	.ops-ad-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 22rpx;
		padding-top: 20rpx;
		border-top: 1rpx solid rgba(240, 220, 210, 0.9);
	}

	.ops-ad-total__label {
		flex-shrink: 0;
		font-size: 20rpx;
		color: #6e4a3f;
	}

	.ops-ad-total__value {
		text-align: right;
		font-size: 20rpx;
		font-weight: 600;
		color: #b36a56;
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
		color: #6e4a3f;
	}

	.ops-ring-legend__percent {
		font-size: 19rpx;
		font-weight: 600;
		color: #b36a56;
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
		color: #5d372b;
	}

	.ops-type__meta {
		font-size: 18rpx;
		color: #a07b70;
	}

	.ops-type__track {
		height: 8rpx;
		margin-top: 10rpx;
		border-radius: 4rpx;
		background: rgba(231, 204, 194, 0.5);
		overflow: hidden;
	}

	.ops-type__bar {
		height: 100%;
		border-radius: 4rpx;
		background: linear-gradient(90deg, #ffb199 0%, #ec7558 100%);
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
		background: #fff6f1;
	}

	.ops-diag__meta-text {
		font-size: 18rpx;
		line-height: 1.6;
		color: #8b6659;
	}

	.ops-diag__label {
		display: block;
		margin-top: 18rpx;
		font-size: 18rpx;
		font-weight: 600;
		color: #b3563f;
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
		color: #6e4a3f;
	}

	.ops-diag__value {
		font-size: 20rpx;
		font-weight: 600;
		color: #5a3427;
	}

	/* 状态 */
	.ops-loading {
		padding: 80rpx 0;
		text-align: center;
	}

	.ops-loading__text {
		font-size: 22rpx;
		color: #9a766c;
	}

	.ops-empty {
		padding: 30rpx 0;
		text-align: center;
	}

	.ops-empty__text {
		font-size: 20rpx;
		color: #ab8376;
	}

	.ops-forbidden {
		margin-top: 40rpx;
		padding: 48rpx 32rpx;
		border-radius: 32rpx;
		background: rgba(255, 250, 247, 0.97);
		text-align: center;
	}

	.ops-forbidden__title {
		display: block;
		font-size: 28rpx;
		font-weight: 700;
		color: #6e4a3f;
	}

	.ops-forbidden__desc {
		display: block;
		margin-top: 12rpx;
		font-size: 22rpx;
		line-height: 1.7;
		color: #9a766c;
	}

	.ops-foot-note {
		display: block;
		margin-top: 14rpx;
		font-size: 18rpx;
		line-height: 1.7;
		color: #a07b70;
	}
</style>
