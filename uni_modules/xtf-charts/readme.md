# xtf-charts

基于 Canvas 2D 的跨端图表组件，提供 ECharts 风格的 `option` 接口，支持 `line`、`bar`、`pie`、`scatter`、`gauge`、`radar`、`funnel`、`boxplot`、`candlestick`、`progress` 等图表类型。

## 组件在线访问

https://env-00jy6fwh6avu-static.normal.cloudstatic.cn/charts/index.html#/

---

## 版本说明

本插件提供两个版本，分别适配不同的 uni-app 开发模式：

### 📦 uni-app x 版本（`.uvue` 文件）

- **适用项目**：uni-app x 项目（Vapor 字节码模式）
- **文件格式**：`.uvue`（单文件组件）
- **支持平台**：
  - ✅ App-Android
  - ✅ App-iOS
  - ✅ App-Harmony（鸿蒙）
  - ✅ Web（H5）
- **技术特性**：
  - 使用 Canvas 2D API，不依赖 WebView 或 `renderjs`
  - 原生渲染性能，适合高频更新场景
  - 支持 UTS 类型系统，编译期类型检查

### 📦 标准 uni-app 版本（`.vue` 文件）

- **适用项目**：标准 uni-app 项目
- **文件格式**：`.vue`（单文件组件）
- **支持平台**：
  - ✅ H5（Web）
  - ✅ 微信小程序
  - ✅ 支付宝小程序
  - ✅ 百度小程序
  - ✅ 字节跳动小程序
  - ✅ QQ 小程序
  - ✅ 快手小程序
  - ✅ App（iOS/Android）
- **技术特性**：
  - 基于标准 Canvas 2D Context API
  - 小程序环境自动适配 `canvas-2d` 类型
  - H5 环境使用标准 Web Canvas API

---

## 平台兼容性说明

### uni-app x 版本

| 平台 | 支持情况 | 备注 |
|------|----------|------|
| App-Android | ✅ 完全支持 | 原生 Canvas 2D 渲染 |
| App-iOS | ✅ 完全支持 | 原生 Canvas 2D 渲染 |
| App-Harmony | ✅ 完全支持 | 鸿蒙原生 Canvas API |
| Web | ✅ 完全支持 | 标准 Web Canvas API |

### 标准 uni-app 版本

| 平台 | 支持情况 | 已知限制 |
|------|----------|----------|
| H5 | ✅ 完全支持 | 标准 Web Canvas API，性能最优 |
| 微信小程序 | ✅ 完全支持 | 需使用 `canvas-2d` 类型，部分文本测量可能有偏差 |
| 支付宝小程序 | ✅ 完全支持 | Canvas API 略有差异，已自动适配 |
| 百度小程序 | ⚠️ 基本支持 | 部分高级特性（如渐变、阴影）可能不稳定 |
| 字节跳动小程序 | ✅ 完全支持 | - |
| QQ 小程序 | ✅ 完全支持 | 与微信小程序 API 一致 |
| 快手小程序 | ⚠️ 基本支持 | 建议充分测试复杂图表 |
| App | ✅ 完全支持 | 使用 WebView Canvas，性能略低于 uni-app x 版本 |

**⚠️ 小程序环境注意事项：**

1. **Canvas API 限制**：小程序的 Canvas API 实现与标准 Web 存在差异，部分高级特性可能不支持或表现不一致。
2. **文本测量**：小程序环境下 `measureText()` 可能存在精度问题，外置饼图标签自动避让可能不够精确。
3. **渐变和阴影**：部分小程序平台对 `createLinearGradient()`、`shadowBlur` 等特性支持有限。
4. **性能优化**：小程序环境建议：
   - 避免过于频繁的 `setOption()` 调用
   - 数据量大时考虑关闭动画（`animation: false`）
   - 横向滚动时建议设置 `scrollable: false` 或限制类目数量

---

## 目录

- [组件在线访问](#组件在线访问)
- [版本说明](#版本说明)
- [平台兼容性说明](#平台兼容性说明)
- [快速开始](#快速开始)
  - [uni-app x 项目引入方式](#uni-app-x-项目引入方式)
  - [标准 uni-app 项目引入方式](#标准-uni-app-项目引入方式)
- [组件 Props](#组件-props)
- [组件 Events](#组件-events)
- [组件方法](#组件方法)
- [ChartOption 完整参数](#chartoption-完整参数)
  - [title 标题](#title-标题)
  - [grid 网格](#grid-网格)
  - [xAxis X 轴](#xaxis-x-轴)
  - [yAxis Y 轴](#yaxis-y-轴)
  - [radar 雷达](#radar-雷达)
  - [legend 图例](#legend-图例)
  - [label 标签](#label-标签)
  - [tooltip 提示框](#tooltip-提示框)
  - [series 系列](#series-系列)
  - [全局样式](#全局样式)
  - [动画](#动画)
- [核心特性](#核心特性)
  - [K 线图 + MA 均线叠加](#k-线图--ma-均线叠加)
  - [柱状图纹理填充](#柱状图纹理填充)
  - [饼图外置标签自动避让](#饼图外置标签自动避让)
  - [手势横向滚动](#手势横向滚动)
  - [仪表盘自定义](#仪表盘自定义)
  - [全局标签回退](#全局标签回退)
- [图表类型与样式示例](#图表类型与样式示例)
  - [折线图 line](#折线图-line)
  - [柱状图 bar](#柱状图-bar)
  - [饼图 pie](#饼图-pie)
  - [进度条 progress](#进度条-progress)
  - [仪表盘 gauge](#仪表盘-gauge)
  - [散点图 scatter](#散点图-scatter)
  - [雷达图 radar](#雷达图-radar)
  - [漏斗图 funnel](#漏斗图-funnel)
  - [箱线图 boxplot](#箱线图-boxplot)
  - [K 线图 candlestick](#k-线图-candlestick)
- [Tooltip 交互详解](#tooltip-交互详解)
- [图例交互详解](#图例交互详解)
- [横向滚动](#横向滚动)
- [X 轴标签格式化](#x-轴标签格式化)
- [动画配置](#动画配置)
- [深色主题示例](#深色主题示例)
- [技术说明](#技术说明)

---

## 快速开始

### uni-app x 项目引入方式

1. **将插件放入项目**：将 `uni_modules/xtf-charts` 目录复制到你的 uni-app x 项目根目录。

2. **在页面中使用**（`.uvue` 文件）：

```vue
<template>
  <view class="container">
    <xtf-charts :option="chartOption" height="300px" @click="handleChartClick"></xtf-charts>
  </view>
</template>

<script setup lang="uts">
import { ref } from 'vue'

const chartOption = ref({
  title: { text: '销售趋势' },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  yAxis: { min: 0, max: 300 },
  tooltip: { show: true, merge: true, trigger: 'axis' },
  series: [{
    name: '销售额',
    type: 'line',
    data: [120, 180, 150, 240, 210, 280, 250],
    color: '#2f80ed',
    smooth: true,
    areaStyle: true
  }]
})

const handleChartClick = (e: any) => {
  console.log('图表点击事件:', e)
}
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>
```

### 标准 uni-app 项目引入方式

1. **将插件放入项目**：将 `uni_modules/xtf-charts` 目录复制到你的标准 uni-app 项目根目录。

2. **在页面中使用**（`.vue` 文件）：

```vue
<template>
  <view class="container">
    <xtf-charts :option="chartOption" height="300px" @click="handleChartClick"></xtf-charts>
  </view>
</template>

<script>
export default {
  data() {
    return {
      chartOption: {
        title: { text: '销售趋势' },
        xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
        yAxis: { min: 0, max: 300 },
        tooltip: { show: true, merge: true, trigger: 'axis' },
        series: [{
          name: '销售额',
          type: 'line',
          data: [120, 180, 150, 240, 210, 280, 250],
          color: '#2f80ed',
          smooth: true,
          areaStyle: true
        }]
      }
    }
  },
  methods: {
    handleChartClick(e) {
      console.log('图表点击事件:', e)
    }
  }
}
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>
```

**或使用 Composition API（Vue 3 写法）：**

```vue
<template>
  <view class="container">
    <xtf-charts :option="chartOption" height="300px" @click="handleChartClick"></xtf-charts>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const chartOption = ref({
  title: { text: '销售趋势' },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  yAxis: { min: 0, max: 300 },
  tooltip: { show: true, merge: true, trigger: 'axis' },
  series: [{
    name: '销售额',
    type: 'line',
    data: [120, 180, 150, 240, 210, 280, 250],
    color: '#2f80ed',
    smooth: true,
    areaStyle: true
  }]
})

const handleChartClick = (e) => {
  console.log('图表点击事件:', e)
}
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>
```

---

## 组件 Props

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `option` | `ChartOption` | **必填** | 图表配置对象，详见下方 [ChartOption 完整参数](#chartoption-完整参数) |
| `canvasId` | `string` | `'xtf-charts-canvas'` | Canvas 元素的 id，同一页面有多个图表时需设置不同 id |
| `width` | `string` | `'100%'` | 图表宽度，支持 px 或百分比，如 `'600px'`、`'100%'` |
| `height` | `string` | `'300px'` | 图表高度，支持 px，如 `'300px'`、`'500px'` |
| `showScrollbar` | `boolean` | `false` | 横向滚动时是否显示滚动条，默认隐藏但可手势滑动 |
| `scrollable` | `boolean` | `true` | 是否启用横向滚动。超过 12 个类目时自动扩展 Canvas 宽度；设为 `false` 时所有柱子按比例压缩显示 |
| `gestureScroll` | `boolean` | `false` | 启用 Canvas 横向拖拽识别。横向拖动交由 `scroll-view` 浏览长序列，并避免松手时触发数据点击 |

---

## 组件 Events

| 事件名 | 参数类型 | 说明 |
|--------|----------|------|
| `click` | `ChartClickEvent` | 点击图表数据点、柱子、饼图扇区或图例时触发 |
| `ready` | 无 | 图表初始化完成时触发 |

### ChartClickEvent

```ts
type ChartClickEvent = {
  x: number           // 点击位置 X 坐标
  y: number           // 点击位置 Y 坐标
  type: string        // 点击元素类型：'bar' | 'line' | 'pie' | 'scatter' | 'gauge' | 'radar' | 'funnel' | 'boxplot' | 'candlestick' | 'legend'
  seriesIndex: number // 系列索引
  dataIndex: number   // 数据点索引，图例点击时为 -1
  seriesName: string  // 系列名称
  value: number       // 数据值，图例点击时为 0
}
```

---

## 组件方法

| 方法 | 说明 |
|------|------|
| `setOption(option)` | 更新图表配置，支持响应式数据更新 |
| `clear()` | 清空画布 |
| `resize()` | 重新计算画布尺寸并重绘 |
| `getDataURL()` | 导出当前图表为 PNG data URL |

---

## ChartOption 完整参数

```ts
type ChartOption = {
  title?: TitleOption
  grid?: GridOption
  xAxis?: AxisOption
  yAxis?: AxisOption
  radar?: RadarOption
  legend?: LegendOption
  label?: LabelOption
  tooltip?: TooltipOption
  series: ChartSeries[]
  backgroundColor?: string
  textColor?: string
  animation?: boolean
  animationDuration?: number
  animationEasing?: string
  animationMode?: string
  scatterBarMode?: string
}
```

---

### title 标题

```ts
type TitleOption = {
  text?: string    // 标题文本内容
  color?: string   // 标题文字颜色，如 '#263238'
  show?: boolean   // 是否显示标题，默认 true
  fontSize?: number // 标题字号，默认 16
  align?: string    // 水平对齐：'left'（默认）| 'center' | 'right'
  left?: number     // 标题 X 坐标，优先级高于 align
  top?: number      // 标题基线 Y 坐标，默认 20
}
```

**示例：**

```ts
title: { text: '销售趋势', color: '#263238', show: true }
```

---

### grid 网格

控制图表绘图区域的位置、背景和网格线。

```ts
type GridOption = {
  left?: number            // 绘图区左边距，单位 px，默认 50
  right?: number           // 绘图区右边距，单位 px，默认 20
  top?: number             // 绘图区上边距，单位 px，默认 40
  bottom?: number          // 绘图区下边距，单位 px，默认 34
  show?: boolean           // 是否显示网格边框，默认 false
  color?: string           // 网格线颜色，如 '#e5eaee'
  backgroundColor?: string // 绘图区背景颜色，如 '#ffffff'
  borderColor?: string     // 网格边框颜色，如 '#d8dde3'
  showHorizontal?: boolean // 是否显示水平网格线，默认 false
  showVertical?: boolean   // 是否显示垂直网格线，默认 false
}
```

**示例：**

```ts
grid: {
  left: 50,
  right: 20,
  top: 40,
  bottom: 34,
  backgroundColor: '#ffffff',
  borderColor: '#d8dde3',
  showHorizontal: true,
  showVertical: true
}
```

---

### xAxis X 轴

```ts
type AxisOption = {
  data?: string[]           // 类目数据，如 ['周一', '周二', '周三']
  min?: number              // 最小值，用于数值轴
  max?: number              // 最大值，用于数值轴
  color?: string            // 轴线颜色
  axisLabel?: AxisLabelOption  // 轴标签配置
  axisLine?: AxisLineOption    // 轴线配置
  splitLine?: SplitLineOption  // 分隔线配置
  mirror?: boolean          // 是否启用中线镜像对比模式（横向对比柱状图），默认 false
  fixed?: boolean           // Y 轴是否在横向滚动时固定显示，默认 false（仅 yAxis 有效）
}
```

#### AxisLabelOption 轴标签

```ts
type AxisLabelOption = {
  interval?: number   // 标签显示间隔，每隔多少个类目显示一个标签，如 2 表示隔 2 个显示
  format?: string     // 日期格式化：'month' | 'day' | 'month-day'，未设置时显示原始文本
  rotate?: number     // 标签旋转角度，如 45
  color?: string      // 标签文字颜色，如 '#607d8b'
  show?: boolean      // 是否显示标签，默认 true
  fontSize?: number   // 标签文字大小，单位 px，默认 12
}
```

#### AxisLineOption 轴线

```ts
type AxisLineOption = {
  show?: boolean    // 是否显示轴线，默认 true
  color?: string    // 轴线颜色，如 '#e5eaee'
}
```

#### SplitLineOption 分隔线

```ts
type SplitLineOption = {
  show?: boolean    // 是否显示分隔线，默认 false
  color?: string    // 分隔线颜色，如 '#d8dde3'
}
```

**示例：**

```ts
xAxis: {
  data: ['2025-03-01', '2025-03-02', '2025-03-03'],
  axisLabel: {
    interval: 2,
    format: 'day',
    rotate: 0,
    color: '#607d8b',
    show: true
  },
  axisLine: { show: true, color: '#e5eaee' },
  splitLine: { show: true, color: '#d8dde3' }
}
```

---

### yAxis Y 轴

与 xAxis 结构相同（`AxisOption`），额外支持 `fixed` 参数。

```ts
yAxis: {
  min: 0,
  max: 360,
  fixed: true,    // 横向滚动时 Y 轴固定在左侧
  axisLabel: { show: true, color: '#607d8b' },
  splitLine: { show: true, color: '#d8dde3' }
}
```

---

### radar 雷达

```ts
type RadarOption = {
  indicator: RadarIndicatorOption[]  // 雷达指示器数组
}

type RadarIndicatorOption = {
  name: string   // 指示器名称，如 '销售'
  max: number    // 该维度的最大值，如 100
}
```

**示例：**

```ts
radar: {
  indicator: [
    { name: '销售', max: 100 },
    { name: '服务', max: 100 },
    { name: '效率', max: 100 },
    { name: '库存', max: 100 },
    { name: '复购', max: 100 }
  ]
}
```

---

### legend 图例

```ts
type LegendOption = {
  show?: boolean        // 是否显示图例，默认 true
  textColor?: string    // 图例文字颜色，如 '#607d8b'
  toggleable?: boolean  // 是否允许点击图例切换系列显示/隐藏，默认 true
  fontSize?: number     // 图例文字大小，单位 px，默认 12
  iconSize?: number     // 图例色块大小，单位 px，默认 10
  itemGap?: number      // 同行图例项间距，单位 px，默认 16
  rowGap?: number       // 图例换行间距，单位 px，默认 8
  position?: string     // 图例位置：'top'（默认）| 'bottom'（绘制在 X 轴标签下方）
  barLayout?: string    // 柱图图例切换布局：'compact'（默认）| 'preserve'
}
```

当 `toggleable: true` 时，点击图例色块可隐藏/显示对应系列的数据。隐藏的系列不会绘制在图表上，同时 Tooltip 中也不会显示该系列的数据（当 `tooltip.respectLegend: true` 时）。

`barLayout: 'compact'` 会让可见分组柱填满原组宽；`barLayout: 'preserve'` 则保持隐藏前的柱宽，并将剩余可见柱在类目分组内居中。

**示例：**

```ts
legend: { show: true, textColor: '#263238', toggleable: true }
```

---

### label 标签

用于笛卡尔图（折线图、柱状图）的数据标签。

```ts
type LabelOption = {
  show?: boolean      // 是否显示数据标签，默认 false
  color?: string      // 标签文字颜色，如 '#607d8b'
  fontSize?: number   // 标签文字大小，单位 px
  position?: string   // 柱图位置：'top'（默认）| 'inside'；折线图位置：'top'（默认）| 'bottom'
}
```

> **注意**：在 series 中也可以使用 `label` 配置，支持额外的 `position` 参数：
> ```ts
> label: { show: true, color: '#607d8b', position: 'top' }
> ```
> `position` 支持 `'top'`（标签在数据点上方）、`'inside'`（标签在柱子内部）和 `'bottom'`（标签在折线数据点下方）。未设置 `series.label` 时，折线图和柱图会回退使用全局 `label`。

---

### tooltip 提示框

```ts
type TooltipOption = {
  show?: boolean                // 是否启用 Tooltip，默认 false
  merge?: boolean               // 是否合并显示同一类目下所有系列的数据，默认 false
  trigger?: string              // 触发方式：'item'（点击数据点）| 'axis'（点击类目纵向区域），默认 'item'
  axisLineColor?: string        // Y 轴辅助线颜色（折线图点击时在 Y 轴绘制的垂直线），如 '#90a4ae'
  axisLineLabelColor?: string   // Y 轴辅助线标签文字颜色，如 '#263238'
  axisLineLabelBgColor?: string // Y 轴辅助线标签背景颜色，如 '#90a4ae'
  showAxisLine?: boolean        // 是否显示 Y 轴辅助线标注，默认 true
  axisPointerLineColor?: string // X 轴辅助线颜色（折线图点击时在 X 轴绘制的垂直线），如 '#90a4ae'
  axisPointerLabelColor?: string // X 轴辅助线标签文字颜色
  axisPointerLabelBgColor?: string // X 轴辅助线标签背景颜色
  showAxisPointer?: boolean     // 是否显示 X 轴辅助线标注，默认 true
  duration?: number             // Tooltip 自动消失时间，单位毫秒，如 1800；设为 0 则不自动消失
  backgroundColor?: string     // Tooltip 背景颜色，如 '#263238'
  textColor?: string            // Tooltip 文字颜色，如 '#ffffff'
  borderRadius?: number         // Tooltip 圆角大小，单位 px，如 4
  showMarker?: boolean          // 是否在 Tooltip 中显示系列对应的色块标记，默认 true
  respectLegend?: boolean       // Tooltip 是否跟随图例状态，默认 true。当某系列被图例隐藏时，Tooltip 中也不显示该系列数据
}
```

**参数详解：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `show` | `boolean` | `false` | 是否启用 Tooltip 交互 |
| `merge` | `boolean` | `false` | 合并显示同一类目下所有系列数据。`true` 时点击任意数据点会显示该类目所有系列的值 |
| `trigger` | `string` | `'item'` | 触发方式。`'item'` 需精确点击数据点；`'axis'` 可点击类目纵向区域任意位置 |
| `axisLineColor` | `string` | - | Y 轴辅助线颜色。折线图显示 Tooltip 时，在 Y 轴位置绘制一条水平辅助线 |
| `axisLineLabelColor` | `string` | - | Y 轴辅助线标签文字颜色 |
| `axisLineLabelBgColor` | `string` | - | Y 轴辅助线标签背景颜色 |
| `showAxisLine` | `boolean` | `true` | 是否显示 Y 轴辅助线标注。设为 `false` 可隐藏 Y 轴辅助线和标签 |
| `axisPointerLineColor` | `string` | - | X 轴辅助线颜色。折线图显示 Tooltip 时，在 X 轴位置绘制一条垂直辅助线 |
| `axisPointerLabelColor` | `string` | - | X 轴辅助线标签文字颜色 |
| `axisPointerLabelBgColor` | `string` | - | X 轴辅助线标签背景颜色 |
| `showAxisPointer` | `boolean` | `true` | 是否显示 X 轴辅助线标注。设为 `false` 可隐藏 X 轴辅助线和标签 |
| `duration` | `number` | - | Tooltip 自动消失时间（毫秒）。如 `1800` 表示 1.8 秒后自动隐藏；不设置则不自动消失 |
| `backgroundColor` | `string` | - | Tooltip 浮层背景颜色 |
| `textColor` | `string` | - | Tooltip 浮层文字颜色 |
| `borderRadius` | `number` | - | Tooltip 浮层圆角大小（px） |
| `showMarker` | `boolean` | `true` | 是否在 Tooltip 中显示系列对应的色块标记（小圆点） |
| `respectLegend` | `boolean` | `true` | Tooltip 是否跟随图例状态。当某系列被图例隐藏时，Tooltip 中也不显示该系列数据 |

**示例：**

```ts
tooltip: {
  show: true,
  merge: true,
  trigger: 'axis',
  axisLineColor: '#90a4ae',
  axisLineLabelColor: '#ffffff',
  axisLineLabelBgColor: '#90a4ae',
  showAxisLine: true,
  axisPointerLineColor: '#90a4ae',
  axisPointerLabelColor: '#ffffff',
  axisPointerLabelBgColor: '#90a4ae',
  showAxisPointer: true,
  duration: 1800,
  backgroundColor: '#263238',
  textColor: '#ffffff',
  borderRadius: 4,
  showMarker: true,
  respectLegend: true
}
```

---

### series 系列

```ts
type ChartSeries = {
  name?: string                    // 系列名称，显示在图例和 Tooltip 中
  type: string                     // 图表类型：'line' | 'bar' | 'pie' | 'scatter' | 'gauge' | 'radar' | 'funnel' | 'boxplot' | 'candlestick' | 'progress'
  data: number[]                   // 数据数组
  scatterData?: number[][]         // 二维散点数据，每项为 [x, y]；配合 scatterBarMode 支持散点收拢为分组均值柱图
  boxplotData?: number[][]         // 箱线图数据，每个元素为 [min, Q1, median, Q3, max]
  candlestickData?: number[][]     // K 线数据，每个元素为 [open, close, low, high]
  color?: string                   // 系列主颜色，如 '#2f80ed'
  colors?: string[]                // 逐项颜色数组；饼图按扇区取色，柱图按首尾两色生成线性渐变
  itemColors?: string[]            // 柱图或 K 线逐数据项颜色，按数据索引覆盖对应项
  startIndex?: number              // 折线起始数据索引，适用于 MA 等需要跳过初始无效数据的场景
  barWidth?: number | string       // 柱子宽度，数字为 px，字符串为百分比如 '42%'
  orient?: string                  // 图表方向；柱图使用 'horizontal' 绘制横向柱状图，折线图使用 'horizontal' 绘制纵向类目、横向数值的垂直折线图
  stack?: string                   // 堆叠分组标识；柱图或设置 areaStyle 的折线图中，相同 stack 值的系列会堆叠显示
  symbolSize?: number              // 散点大小（px），如 12
  radius?: number | string         // 饼图/环形图半径，数字为 px，字符串为百分比如 '42%'
  innerRadius?: number | string    // 环形图内半径，数字为 px，字符串为百分比如 '58%'
  startAngle?: number              // 饼图起始角度（度），默认 0
  pieStyle?: string                // 饼图样式，详见饼图样式说明
  roseType?: string                // 玫瑰图类型，设为 'radius' 启用玫瑰图
  selectedMode?: boolean           // 饼图是否启用选中偏移，默认 false
  selectedOffset?: number          // 选中扇区向外偏移距离（px），默认 10
  showLabel?: boolean              // 饼图是否显示扇区标签，默认 false
  showPercent?: boolean            // 饼图是否显示百分比，默认 false
  labelPosition?: string           // 饼图标签位置：'inside'（扇区内）| 'outside'（扇区外）
  showLabelLine?: boolean          // 饼图是否显示外置标签的引导线，默认 false
  labelLineLength?: number         // 引导线第一段长度（px），默认 14
  labelLineLength2?: number        // 引导线第二段（水平段）长度（px），默认 18
  labelLineColor?: string          // 引导线颜色，如 '#90a4ae'
  labelColor?: string              // 标签文字颜色
  labelFormat?: string             // 标签格式化模板，如 '{name}:{value}人'
  labelAvoidOverlap?: boolean      // 外置饼图标签是否自动避让，默认 true
  labelMinGap?: number             // 同侧外置标签最小纵向间距（px），默认 18
  labelMaxWidth?: number           // 外置标签最大文本宽度（px），超出时省略显示
  borderWidth?: number             // 扇区边框宽度（px），如 2
  borderColor?: string             // 扇区边框颜色，如 '#ffffff'
  smooth?: boolean                 // 折线是否平滑曲线，默认 false
  step?: string                    // 阶梯折线：'start' | 'middle' | 'end'
  markLine?: MarkLineOption[]      // 折线水平参考线，支持值、标签和起始类目索引
  markPoint?: MarkPointOption[]    // 折线数据点气泡标记，支持最大值、最小值或指定索引
  markArea?: MarkAreaOption[]      // 折线类目区间背景带，支持起止索引、标题和背景颜色
  lineColorRanges?: LineColorRangeOption[] // 折线分段颜色，按起止数据索引覆盖路径颜色
  showSymbol?: boolean             // 折线是否显示数据点标记，默认 true；设为 false 等同于 symbolStyle: 'none'
  symbolStyle?: string              // 数据点样式：'hollow'（默认空心）| 'solid'（实心）| 'none'（无点）
  lineStyle?: LineStyleOption      // 折线样式
  areaStyle?: boolean              // 折线是否填充面积，默认 false
  itemStyle?: ItemStyleOption      // 柱状图条目样式
  label?: LabelOption              // 系列级别标签配置，优先级高于全局 label
  overlay?: boolean                // 柱状图是否叠加显示（不分组），默认 false
  mirror?: boolean                 // 横向对比柱状图中是否绘制到中线左侧，默认 false
  gradientColors?: string[]        // 渐变色数组，用于柱图、堆叠面积图或进度环，如 ['#2ac66d', '#19cfe3']
  centerText?: string              // 环形图/进度条/仪表盘中心文本，如 '正确率'
  centerValue?: string             // 环形图/进度条/仪表盘中心数值文本，如 '80%'
  centerTextColor?: string         // 中心文本颜色，如 '#607d8b'
  centerValueColor?: string        // 中心数值颜色，如 '#27ae60'
  centerValueFontSize?: number     // 中心数值字号（px），默认 26
  progressMax?: number             // 进度条最大值，默认 100
  progressBackgroundColor?: string // 进度条背景轨道颜色，默认 '#e8eaed'
  progressGap?: number             // 多重进度条间距（px），默认 7
  progressRound?: boolean          // 进度条是否圆角端点，默认 false
  gaugeStyle?: string              // 仪表盘样式：'arc'（圆弧）| 'circle'（整圆）
  gaugeStartAngle?: number         // 仪表盘起始角度（度）
  gaugeEndAngle?: number           // 仪表盘结束角度（度）
  gaugeRound?: boolean             // 仪表盘弧线是否圆角端点，默认 true
  gaugeShowPointer?: boolean       // 仪表盘是否显示指针，默认 true
  gaugeShowTicks?: boolean         // 仪表盘是否显示刻度，默认 false
  gaugeTickCount?: number          // 仪表盘刻度数量，默认 10
  gaugeBackgroundColor?: string    // 仪表盘背景弧颜色，如 '#e8edf1'
  gaugeGradientColors?: string[]   // 仪表盘渐变色数组，如 ['#2ac66d', '#19cfe3']
  gaugeWidth?: number              // 仪表盘弧线宽度（px），默认 18
  pointerColor?: string             // 仪表盘指针与圆心颜色，如 '#455a64'
}
```

#### LineStyleOption 折线样式

```ts
type LineStyleOption = {
  color?: string        // 线条颜色，如 '#2f80ed'
  width?: number        // 线条宽度（px），如 2
  type?: string         // 线型：'solid'（实线）| 'dashed'（虚线）| 'dotted'（点线）
  opacity?: number      // 线条不透明度，0~1，如 0.7
  shadowColor?: string  // 阴影颜色，如 '#7bc8ff'
  shadowBlur?: number   // 阴影模糊半径（px），如 12
}
```

#### ItemStyleOption 条目样式

```ts
type ItemStyleOption = {
  borderRadius?: number  // 柱子圆角（px），如 14
  opacity?: number       // 柱子不透明度，0~1，如 0.72
  borderWidth?: number   // 柱子边框宽度（px）
  borderColor?: string   // 柱子边框颜色
  backgroundColor?: string // 柱子填充色，支持 rgba 透明色
  pattern?: string         // 柱状图纹理：'diagonal' | 'diagonal-reverse' | 'horizontal' | 'vertical' | 'cross' | 'none'
  patternColor?: string    // 纹理线条颜色，如 'rgba(0,0,0,0.22)'
  patternSize?: number     // 纹理线条间距（px），默认 8
  patternWidth?: number    // 纹理线条宽度（px），默认 1
}
```

---

### 全局样式

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `backgroundColor` | `string` | - | 图表整体背景颜色，如 '#ffffff'、'#1c1c28' |
| `textColor` | `string` | - | 图表全局文字颜色，如 '#263238'，影响坐标轴、图例等文字 |

---

### 动画

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `animation` | `boolean` | `true` | 是否开启动画。设为 `false` 关闭动画，数据更新时直接显示最终状态 |
| `animationDuration` | `number` | `800` | 动画时长（毫秒），如 800、1200 |
| `animationMode` | `string` | - | 动画模式。设为 `'left-to-right'` 启用从左到右逐点绘制动画；未设置时使用整体过渡动画 |

---

## 核心特性

本组件提供了一系列高级特性，满足复杂图表场景需求。

### K 线图 + MA 均线叠加

**功能说明**：支持在 K 线图上叠加 MA（移动平均线）等折线指标，适用于股票、期货等金融数据可视化。

**使用方式**：

```ts
const option = {
  title: { text: 'K 线 + MA5/MA10' },
  legend: { show: true },
  xAxis: { data: ['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07'] },
  yAxis: { min: 0, max: 60 },
  series: [
    {
      name: '日K',
      type: 'candlestick',
      data: [],
      candlestickData: [
        [20, 34, 10, 38],  // [开盘, 收盘, 最低, 最高]
        [40, 35, 30, 50],
        [38, 31, 30, 44],
        [32, 38, 28, 42],
        [36, 42, 34, 46],
        [40, 45, 38, 48],
        [43, 40, 38, 50]
      ],
      colors: ['#ef5350', '#45b36b']  // [上涨色, 下跌色]
    },
    {
      name: 'MA5',
      type: 'line',
      data: [0, 0, 32.6, 35.0, 36.2, 38.2, 40.0],  // 前两个数据不足 5 日，设为 0
      startIndex: 2,  // 从索引 2 开始绘制，跳过无效数据
      color: '#2196f3',
      smooth: false,
      showSymbol: false,
      lineStyle: { width: 1.5 }
    },
    {
      name: 'MA10',
      type: 'line',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 36.5],  // 前 9 个数据不足 10 日
      startIndex: 9,
      color: '#ff9800',
      smooth: false,
      showSymbol: false,
      lineStyle: { width: 1.5 }
    }
  ]
}
```

**核心参数**：
- `candlestickData`：K 线数据数组，每项格式为 `[开盘价, 收盘价, 最低价, 最高价]`
- `colors: [上涨色, 下跌色]`：统一配置涨跌配色
- `startIndex`：折线起始绘制索引，用于跳过 MA 计算初期的无效数据

### 柱状图纹理填充

**功能说明**：为柱状图添加斜线、横线、竖线、交叉等纹理，提升数据区分度和视觉层次。

**使用方式**：

```ts
const option = {
  title: { text: '纹理柱状图' },
  xAxis: { data: ['A', 'B', 'C', 'D'] },
  yAxis: { min: 0, max: 100 },
  series: [
    {
      name: '系列一',
      type: 'bar',
      data: [60, 75, 50, 80],
      color: '#2f80ed',
      itemStyle: {
        pattern: 'diagonal',               // 纹理类型：斜线
        patternColor: 'rgba(0,0,0,0.22)',  // 纹理线条颜色
        patternSize: 8,                    // 纹理间距（px）
        patternWidth: 1                    // 纹理线条宽度（px）
      }
    },
    {
      name: '系列二',
      type: 'bar',
      data: [45, 60, 70, 55],
      color: '#27ae60',
      itemStyle: {
        pattern: 'horizontal',  // 纹理类型：横线
        patternColor: 'rgba(0,0,0,0.18)',
        patternSize: 6
      }
    }
  ]
}
```

**支持的纹理类型**：
- `'diagonal'`：左下到右上的斜线
- `'diagonal-reverse'`：左上到右下的斜线
- `'horizontal'`：水平横线
- `'vertical'`：垂直竖线
- `'cross'`：网格交叉线
- `'none'`：无纹理（默认）

### 饼图外置标签自动避让

**功能说明**：当饼图标签设置为 `outside` 外置显示时，组件会自动检测标签重叠并调整位置，确保标签清晰可读。

**使用方式**：

```ts
const option = {
  title: { text: '自动避让外置标签' },
  xAxis: { data: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
  series: [{
    name: '占比',
    type: 'pie',
    data: [15, 12, 18, 8, 20, 10, 9, 8],
    colors: ['#2f80ed', '#27ae60', '#f2994a', '#eb5757', '#9b51e0', '#f2c94c', '#56ccf2', '#6fcf97'],
    pieStyle: 'ring',
    innerRadius: '50%',
    showLabel: true,
    showPercent: true,
    labelPosition: 'outside',       // 标签外置
    showLabelLine: true,            // 显示引导线
    labelAvoidOverlap: true,        // 启用自动避让（默认 true）
    labelMinGap: 18,                // 同侧标签最小间距（px）
    labelMaxWidth: 120,             // 标签最大宽度（px），超出省略
    labelLineLength: 14,            // 引导线第一段长度
    labelLineLength2: 18            // 引导线第二段长度
  }]
}
```

**核心参数**：
- `labelAvoidOverlap: true`：启用自动避让（默认开启）
- `labelMinGap`：同侧标签最小纵向间距，避让算法会确保相邻标签间距不小于此值
- `labelMaxWidth`：标签文本最大宽度，超出时自动截断并显示省略号

### 手势横向滚动

**功能说明**：当图表数据量大（超过 12 个类目）时，组件支持横向滚动浏览，并可启用手势识别，避免拖动滚动时误触点击事件。

**使用方式**：

```ts
const option = {
  title: { text: '近 30 日销售趋势' },
  xAxis: {
    data: ['01', '02', '03', ..., '30'],  // 30 个类目
    axisLabel: { interval: 2 }
  },
  yAxis: { min: 0, max: 360, fixed: true },  // Y 轴固定，仅数据区滚动
  series: [{
    name: '销售额',
    type: 'line',
    data: [...],  // 30 个数据点
    color: '#2f80ed',
    smooth: true
  }]
}
```

```vue
<xtf-charts 
  :option="option" 
  height="320px" 
  :scrollable="true"        <!-- 启用横向滚动 -->
  :gestureScroll="true"     <!-- 启用手势识别 -->
  :showScrollbar="false"    <!-- 隐藏滚动条 -->
></xtf-charts>
```

**核心参数**：
- `scrollable: true`：启用横向滚动（默认 true，超过 12 个类目时自动生效）
- `gestureScroll: true`：启用手势识别，横向拖动时不触发点击事件
- `showScrollbar: false`：隐藏滚动条（默认 false）
- `yAxis.fixed: true`：Y 轴固定在左侧，仅数据区横向滚动

### 仪表盘自定义

**功能说明**：支持自定义仪表盘的角度范围、刻度数量、指针样式、渐变色等，满足多样化的仪表盘需求。

**使用方式**：

```ts
const option = {
  title: { text: '自定义仪表盘' },
  yAxis: { min: 0, max: 100 },
  series: [{
    name: '完成率',
    type: 'gauge',
    data: [78],
    gaugeStyle: 'arc',              // 'arc'（圆弧）| 'circle'（整圆）
    gaugeStartAngle: 225,           // 起始角度（度），默认 225
    gaugeEndAngle: -45,             // 结束角度（度），默认 -45
    gaugeRound: true,               // 圆角端点
    gaugeShowPointer: true,         // 显示指针
    gaugeShowTicks: true,           // 显示刻度
    gaugeTickCount: 10,             // 刻度数量
    gaugeWidth: 18,                 // 弧线宽度（px）
    gaugeGradientColors: ['#2ac66d', '#19cfe3'],  // 渐变色数组
    gaugeBackgroundColor: '#e8eaed',              // 背景弧颜色
    pointerColor: '#455a64',        // 指针颜色
    centerText: '完成率',
    centerValue: '78%',
    centerValueColor: '#27ae60',
    centerValueFontSize: 26
  }]
}
```

**核心参数**：
- `gaugeStyle`：仪表盘样式，`'arc'`（圆弧）或 `'circle'`（整圆）
- `gaugeStartAngle` / `gaugeEndAngle`：起始/结束角度，支持自定义角度范围
- `gaugeShowTicks` / `gaugeTickCount`：是否显示刻度及刻度数量
- `gaugeGradientColors`：渐变色数组，支持多色渐变
- `gaugeShowPointer`：是否显示指针
- `gaugeRound`：弧线端点是否圆角

### 全局标签回退

**功能说明**：在 `series` 中未设置 `label` 时，折线图和柱状图会自动回退使用全局 `label` 配置，简化配置代码。

**使用方式**：

```ts
const option = {
  title: { text: '全局标签回退' },
  label: {                          // 全局标签配置
    show: true,
    color: '#607d8b',
    fontSize: 12,
    position: 'top'
  },
  xAxis: { data: ['A', 'B', 'C'] },
  yAxis: { min: 0, max: 100 },
  series: [
    {
      name: '系列一',
      type: 'bar',
      data: [60, 75, 50]
      // 未设置 label，自动使用全局 label
    },
    {
      name: '系列二',
      type: 'line',
      data: [45, 60, 70]
      // 未设置 label，自动使用全局 label
    },
    {
      name: '系列三',
      type: 'bar',
      data: [70, 80, 65],
      label: {                      // 系列级别 label，优先级更高
        show: true,
        color: '#eb5757',
        position: 'inside'
      }
    }
  ]
}
```

**优先级规则**：
1. 优先使用 `series[i].label`（系列级别配置）
2. 如未设置，折线图和柱状图会回退使用全局 `label`
3. 饼图、仪表盘等其他图表类型不支持全局 label 回退

---

## 图表类型与样式示例

### 折线图 line

#### 基础折线图

```ts
const option = {
  title: { text: '销售趋势' },
  tooltip: { show: true, merge: true, trigger: 'axis', duration: 1800 },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  yAxis: { min: 0, max: 300 },
  series: [{
    name: '销售额',
    type: 'line',
    data: [120, 180, 150, 240, 210, 280, 250],
    color: '#2f80ed'
  }]
}
```

#### 平滑面积折线图

```ts
const option = {
  title: { text: '销售趋势' },
  tooltip: { show: true, merge: true, trigger: 'axis', duration: 1800 },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  yAxis: { min: 0, max: 300 },
  series: [{
    name: '销售额',
    type: 'line',
    data: [120, 180, 150, 240, 210, 280, 250],
    color: '#2f80ed',
    smooth: true,       // 平滑曲线
    areaStyle: true,    // 面积填充
    showSymbol: false   // 隐藏数据点
  }]
}
```

#### 多系列折线类型对比

```ts
const option = {
  title: { text: '折线类型对比' },
  tooltip: { show: true, merge: true, trigger: 'axis', duration: 1800 },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  series: [
    {
      name: '普通',
      type: 'line',
      data: [120, 180, 150, 240, 210, 280, 250],
      color: '#2f80ed'
    },
    {
      name: '平滑',
      type: 'line',
      data: [140, 220, 180, 270, 240, 310, 280],
      color: '#27ae60',
      smooth: true,
      showSymbol: false
    },
    {
      name: '阶梯',
      type: 'line',
      data: [80, 130, 110, 170, 145, 190, 160],
      color: '#f2994a',
      step: 'middle'
    },
    {
      name: '虚线',
      type: 'line',
      data: [100, 155, 125, 200, 175, 230, 205],
      color: '#9b51e0',
      lineStyle: { type: 'dashed', width: 2 }
    }
  ]
}
```

#### 阶梯折线图

`step` 支持 `'start'`、`'middle'`、`'end'` 三种阶梯模式：

```ts
const option = {
  title: { text: '基础、平滑与阶梯折线' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['2018', '2019', '2020', '2021', '2022', '2023'] },
  yAxis: { min: 0, max: 160 },
  series: [
    { name: '成交量A', type: 'line', data: [35, 8, 25, 37, 4, 20], color: '#2f80ed', label: { show: true } },
    { name: '成交量B', type: 'line', data: [70, 40, 65, 100, 44, 68], color: '#7fc45b', smooth: true, label: { show: true } },
    { name: '成交量C', type: 'line', data: [100, 80, 95, 150, 112, 132], color: '#f2b541', step: 'middle', label: { show: true } }
  ]
}
```

#### 渐变色 + 阴影折线图

```ts
const option = {
  title: { text: '渐变色 + 阴影折线图' },
  tooltip: { show: true, duration: 1800, backgroundColor: '#1f2937', textColor: '#ffffff', borderRadius: 6 },
  xAxis: { data: ['2018', '2019', '2020', '2021', '2022', '2023'] },
  yAxis: { min: 0, max: 160 },
  series: [
    {
      name: '成交量A', type: 'line', data: [15, 43, 15, 44, 15, 43], color: '#00a8f0',
      colors: ['#00a8f0', '#00d49a'], smooth: true, showSymbol: false, areaStyle: true,
      lineStyle: { width: 2, shadowColor: '#7bc8ff', shadowBlur: 12 }
    },
    {
      name: '成交量B', type: 'line', data: [55, 85, 55, 85, 55, 84], color: '#2ecc71',
      colors: ['#2ecc71', '#f2c94c'], smooth: true, showSymbol: false, areaStyle: true,
      lineStyle: { width: 2, shadowColor: '#b7e8a8', shadowBlur: 12 }
    }
  ]
}
```

#### 从左到右动画折线图

```ts
const option = {
  title: { text: '从左到右动画' },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  animation: true,
  animationDuration: 1000,
  animationMode: 'left-to-right',
  series: [{
    name: '销售额',
    type: 'line',
    data: [120, 180, 150, 240, 210, 280, 250],
    color: '#2f80ed',
    areaStyle: true,
    smooth: true
  }]
}
```

#### 带网格背景的折线图

```ts
const option = {
  title: { text: '横纵网格背景' },
  tooltip: { show: true, merge: true, trigger: 'axis', duration: 1800 },
  grid: { backgroundColor: '#ffffff', borderColor: '#d8dde3', showVertical: true, showHorizontal: true },
  xAxis: { data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'], splitLine: { show: true, color: '#d8dde3' } },
  yAxis: { min: -100, max: 100, splitLine: { show: true, color: '#d8dde3' } },
  series: [
    { name: '数据集 A', type: 'line', data: [12, 53, -90, 33, 15, 88, -58], color: '#ff6384', label: { show: true, color: '#607d8b' } },
    { name: '数据集 B', type: 'line', data: [88, -70, 7, -65, -98, 90, 25], color: '#36a2eb', label: { show: true, color: '#607d8b' } }
  ]
}
```

#### 横向滚动折线图

```ts
const option = {
  title: { text: '近 20 日销售趋势' },
  tooltip: { show: true, duration: 1800, backgroundColor: '#263238', textColor: '#ffffff', borderRadius: 4 },
  xAxis: {
    data: ['03-01', '03-02', '03-03', '03-04', '03-05', '03-06', '03-07', '03-08', '03-09', '03-10',
           '03-11', '03-12', '03-13', '03-14', '03-15', '03-16', '03-17', '03-18', '03-19', '03-20'],
    axisLabel: { interval: 1 }
  },
  yAxis: { min: 0, max: 360 },
  series: [
    { name: '销售额', type: 'line', data: [180, 230, 195, 260, 220, 285, 240, 310, 265, 290, 250, 330, 280, 305, 270, 340, 300, 325, 290, 350], color: '#2f80ed', smooth: true, areaStyle: true },
    { name: '订单数', type: 'line', data: [120, 150, 135, 170, 145, 185, 160, 195, 175, 205, 180, 220, 190, 215, 200, 235, 210, 225, 205, 245], color: '#27ae60', smooth: true, showSymbol: false }
  ]
}
```

```vue
<xtf-charts :option="option" height="320px" :scrollable="true"></xtf-charts>
```

#### Y 轴固定横向滚动

```ts
const option = {
  title: { text: 'Y 轴固定滚动' },
  xAxis: { data: manyLabels, axisLabel: { interval: 1 } },
  yAxis: { min: 0, max: 360, fixed: true },  // fixed: true 使 Y 轴固定
  series: [{ name: '销售额', type: 'line', data: manyValues, color: '#2f80ed', smooth: true }]
}
```

---

### 柱状图 bar

#### 基础分组柱状图

```ts
const option = {
  title: { text: '渠道销售对比' },
  tooltip: { show: true, showMarker: true, merge: true, duration: 1800 },
  xAxis: { data: ['门店', '小程序', '批发', '其他'] },
  yAxis: { min: -100, max: 300 },
  series: [
    { name: '本月', type: 'bar', data: [240, 180, 120, 210], color: '#2f80ed', barWidth: 24 },
    { name: '上月变化', type: 'bar', data: [60, -35, 80, -55], color: '#eb5757', barWidth: '42%' }
  ]
}
```

#### 柱线组合图

```ts
const option = {
  title: { text: '柱线组合图' },
  legend: { show: true, toggleable: true },
  tooltip: { show: true, merge: true, duration: 1800 },
  xAxis: { data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
  yAxis: { min: 0, max: 400 },
  series: [
    { name: '销售额', type: 'bar', data: [220, 280, 250, 330, 310, 360], color: '#2f80ed', barWidth: '42%', label: { show: true, position: 'top', color: '#607d8b' } },
    { name: '订单数', type: 'line', data: [160, 210, 190, 260, 240, 300], color: '#f2994a', smooth: true, lineStyle: { width: 3 }, label: { show: true, color: '#607d8b' } }
  ]
}
```

#### 横向堆叠柱状图

```ts
const option = {
  title: { text: '销售构成' },
  xAxis: { min: 0, max: 360 },
  yAxis: { data: ['一店', '二店', '三店', '四店'], axisLabel: { interval: 0 } },
  series: [
    { name: '食品', type: 'bar', data: [120, 150, 100, 180], color: '#2f80ed', stack: 'total', orient: 'horizontal' },
    { name: '饮料', type: 'bar', data: [80, 60, 110, 70], color: '#27ae60', stack: 'total', orient: 'horizontal' },
    { name: '其他', type: 'bar', data: [40, 50, 30, 60], color: '#f2c94c', stack: 'total', orient: 'horizontal' }
  ]
}
```

#### 圆角 + 渐变 + 半透明柱状图

```ts
const option = {
  title: { text: '圆角渐变柱状图' },
  xAxis: { data: ['2018', '2019', '2020', '2021', '2022', '2023'] },
  yAxis: { min: 0, max: 40 },
  series: [
    {
      name: '目标值', type: 'bar', data: [35, 36, 31, 33, 13, 34], color: '#f2994a',
      colors: ['#ffd166', '#ef476f'], barWidth: '62%',
      itemStyle: { borderRadius: 14, opacity: 0.72 },
      label: { show: true, position: 'top', color: '#607d8b' }
    },
    {
      name: '完成量', type: 'bar', data: [18, 27, 21, 24, 6, 28], color: '#eb5757',
      colors: ['#f5a3d0', '#eb5757'], barWidth: '62%',
      itemStyle: { borderRadius: 14, opacity: 0.72 },
      label: { show: true, position: 'top', color: '#607d8b' }
    }
  ]
}
```

#### 纹理柱状图

```ts
const option = {
  title: { text: '纹理柱状图' },
  xAxis: { data: ['2018', '2019', '2020', '2021', '2022', '2023'] },
  yAxis: { min: 0, max: 40 },
  series: [
    {
      name: '目标值', type: 'bar', data: [35, 36, 31, 33, 13, 34], color: '#2f80ed',
      barWidth: '62%',
      itemStyle: {
        pattern: 'diagonal',              // 斜线纹理
        patternColor: 'rgba(0,0,0,0.22)',
        patternSize: 8,
        patternWidth: 1
      }
    },
    {
      name: '完成量', type: 'bar', data: [18, 27, 21, 24, 6, 28], color: '#27ae60',
      barWidth: '62%',
      itemStyle: {
        pattern: 'horizontal',            // 横线纹理
        patternColor: 'rgba(0,0,0,0.18)',
        patternSize: 6
      }
    }
  ]
}
```

#### 温度计图表

通过两组柱子叠加实现，外层设为半透明或透明作为目标值背景，内层为实际完成量：

```ts
const option = {
  title: { text: '温度计图表' },
  xAxis: { data: ['2018', '2019', '2020', '2021', '2022', '2023'] },
  yAxis: { min: 0, max: 40 },
  series: [
    { name: '目标值', type: 'bar', data: [35, 36, 31, 33, 13, 34], color: '#2f80ed', barWidth: '58%', itemStyle: { opacity: 0 }, label: { show: true, position: 'top', color: '#607d8b' } },
    { name: '完成量', type: 'bar', data: [18, 27, 21, 24, 6, 28], color: '#8ac66d', barWidth: '46%', label: { show: true, position: 'inside', color: '#607d8b' } }
  ]
}
```

#### 圆角温度计图表

```ts
const option = {
  title: { text: '圆角温度计图表' },
  xAxis: { data: ['2018', '2019', '2020', '2021', '2022', '2023'] },
  yAxis: { min: 0, max: 40 },
  series: [
    { name: '目标值', type: 'bar', data: [35, 36, 31, 33, 13, 34], color: '#2f80ed', barWidth: '58%', itemStyle: { borderRadius: 14, opacity: 0.22 } },
    { name: '完成量', type: 'bar', data: [18, 27, 21, 24, 6, 28], color: '#f2c94c', barWidth: '46%', itemStyle: { borderRadius: 14 }, label: { show: true, position: 'inside', color: '#607d8b' } }
  ]
}
```

#### 正负柱状图

```ts
const option = {
  title: { text: '正负柱状图' },
  xAxis: { data: ['2018', '2019', '2020', '2021', '2022', '2023'] },
  yAxis: { min: -40, max: 40 },
  series: [{
    name: '变化值', type: 'bar', data: [20, -20, 25, -25, 30, -30], color: '#18bfe5',
    barWidth: '36%', itemStyle: { borderRadius: 12 },
    label: { show: true, position: 'top', color: '#607d8b' }
  }]
}
```

#### 横向对比柱状图（镜像模式）

```ts
const option = {
  title: { text: '今日 / 昨日 24 小时销量对比' },
  legend: { show: true, toggleable: true },
  tooltip: { show: true, merge: true, duration: 1800 },
  grid: { left: 56, right: 18, top: 12, bottom: 34 },
  xAxis: { min: -120, max: 120, mirror: true },
  yAxis: { data: ['00点', '01点', '02点', '03点', '04点', '05点'], axisLabel: { interval: 0 } },
  series: [
    { name: '昨天销量', type: 'bar', orient: 'horizontal', mirror: true, data: [8, 5, 4, 3, 2, 3], color: '#8aa4e8', barWidth: '62%' },
    { name: '今天销量', type: 'bar', orient: 'horizontal', data: [6, 4, 3, 2, 2, 4], color: '#2f80ed', barWidth: '62%' }
  ]
}
```

#### 排行榜横向柱状图

```ts
const option = {
  title: { text: '采购排行榜' },
  legend: { show: false },
  tooltip: { show: true, duration: 1800 },
  grid: { left: 144, right: 28, top: 12, bottom: 34 },
  xAxis: { min: 0, max: 2500 },
  yAxis: { data: ['商品A', '商品B', '商品C', '商品D', '商品E'], axisLabel: { interval: 0 } },
  series: [{
    name: '采购金额', type: 'bar', orient: 'horizontal',
    data: [2240, 1300, 1000, 620, 500], color: '#5975c8', barWidth: '62%',
    label: { show: true, position: 'top', color: '#455a64' }
  }]
}
```

#### 隐藏 X 轴和 Y 轴辅助线的 Tooltip

```ts
tooltip: { show: true, showMarker: true, merge: true, showAxisLine: false, showAxisPointer: false, duration: 1800 }
```

---

### 饼图 pie

#### pieStyle 饼图样式说明

| 值 | 说明 |
|----|------|
| `'normal'` 或不设置 | 普通饼图 |
| `'ring'` 或 `'doughnut'` | 环形图（甜甜圈图） |
| `'rose'` | 玫瑰图，扇区半径随数据值变化 |
| `'half'` | 半圆饼图 |
| `'half-ring'` | 半圆环图 |
| `'progress'` | 整圆进度条 |
| `'multi-progress'` | 多重整圆进度条 |
| `'reverse-progress'` | 逆时针整圆进度条 |
| `'reverse-multi-progress'` | 逆时针多重整圆进度条 |
| `'rounded-progress'` | 圆角整圆进度条 |

也可以使用 ECharts 常见写法 `roseType: 'radius'`，组件会按玫瑰图处理。

#### 普通饼图（标签在内）

```ts
const option = {
  title: { text: '普通饼图 - 标签在内' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['门店', '小程序', '其他'] },
  series: [{
    name: '订单数',
    type: 'pie',
    data: [52, 31, 17],
    color: '#2f80ed',
    colors: ['#2f80ed', '#27ae60', '#f2c94c'],
    showLabel: true,
    showPercent: true,
    labelPosition: 'inside',
    selectedMode: false,
    selectedOffset: 10,
    borderWidth: 3
  }]
}
```

#### 环形图（标签在外 + 引导线）

```ts
const option = {
  title: { text: '环形图 - 标签在外' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['门店', '小程序', '批发', '其他'] },
  series: [{
    name: '销售额',
    type: 'pie',
    data: [42, 28, 18, 12],
    color: '#2f80ed',
    colors: ['#2f80ed', '#27ae60', '#f2994a', '#9b51e0'],
    pieStyle: 'ring',
    innerRadius: '58%',
    showLabel: true,
    showPercent: true,
    labelPosition: 'outside',
    showLabelLine: true,
    labelLineLength: 14,
    labelLineLength2: 18,
    labelLineColor: '#90a4ae',
    selectedMode: false,
    selectedOffset: 8
  }]
}
```

#### 分割环形图（带中心文本）

```ts
const option = {
  title: { text: '分割环形图' },
  xAxis: { data: ['一班', '二班', '三班', '四班', '五班'] },
  series: [{
    name: '收益率', type: 'pie', data: [39.68, 23.81, 15.87, 14.29, 6.35],
    colors: ['#2f80ed', '#8bc66d', '#f7c44e', '#ef6268', '#6ec0df'],
    pieStyle: 'ring', innerRadius: '40%',
    showLabel: true, showPercent: true, labelPosition: 'outside', showLabelLine: true, borderWidth: 3,
    centerText: '收益率', centerValue: '70%', centerValueColor: '#6ea9f5', centerValueFontSize: 24
  }]
}
```

#### 渐变色环形图

```ts
const option = {
  title: { text: '渐变色环形图' },
  xAxis: { data: ['一班', '二班', '三班', '四班', '五班'] },
  series: [{
    name: '收益率', type: 'pie', data: [39.68, 23.81, 15.87, 14.29, 6.35],
    colors: ['#168ff1', '#65c9f4', '#f7c44e', '#ef6268', '#45c7b8'],
    gradientColors: ['#168ff1', '#65c9f4', '#f7c44e', '#ef6268', '#45c7b8'],
    pieStyle: 'ring', innerRadius: '40%',
    showLabel: true, showPercent: true, labelPosition: 'outside', showLabelLine: true, borderWidth: 3,
    centerText: '收益率', centerValue: '70%', centerValueColor: '#6ea9f5', centerValueFontSize: 24
  }]
}
```

#### 自定义标签格式

```ts
const option = {
  title: { text: '自定义标签内容' },
  xAxis: { data: ['一班', '二班', '三班', '四班', '五班'] },
  series: [{
    name: '收益率', type: 'pie', data: [39.68, 23.81, 15.87, 14.29, 6.35],
    colors: ['#2f80ed', '#8bc66d', '#f7c44e', '#ef6268', '#6ec0df'],
    pieStyle: 'ring', innerRadius: '40%',
    showLabel: true, labelFormat: '{name}:{value}人', labelPosition: 'outside', showLabelLine: true, borderWidth: 3,
    centerText: '收益率', centerValue: '70%', centerValueColor: '#6ea9f5', centerValueFontSize: 24
  }]
}
```

#### 隐藏标签的环形图

```ts
const option = {
  title: { text: '隐藏标签环形图' },
  xAxis: { data: ['一班', '二班', '三班', '四班', '五班'] },
  series: [{
    name: '收益率', type: 'pie', data: [39.68, 23.81, 15.87, 14.29, 6.35],
    colors: ['#2f80ed', '#8bc66d', '#f7c44e', '#ef6268', '#6ec0df'],
    pieStyle: 'ring', innerRadius: '40%',
    showLabel: false, borderWidth: 3,
    centerText: '收益率', centerValue: '70%', centerValueColor: '#6ea9f5', centerValueFontSize: 24
  }]
}
```

#### 玫瑰图

```ts
const option = {
  title: { text: '订单类型玫瑰图' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['普通', '加急', '预约', '售后', '批量'] },
  series: [{
    name: '订单数',
    type: 'pie',
    data: [36, 24, 18, 12, 10],
    color: '#eb5757',
    colors: ['#eb5757', '#f2994a', '#f2c94c', '#27ae60', '#2f80ed'],
    pieStyle: 'rose',
    showLabel: true,
    showPercent: false,
    selectedMode: false,
    selectedOffset: 8
  }]
}
```

#### 半圆饼图

```ts
const option = {
  title: { text: '设备状态分布' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['在线', '空闲', '维护', '离线'] },
  series: [{
    name: '设备数',
    type: 'pie',
    data: [56, 20, 14, 10],
    color: '#2f80ed',
    colors: ['#2f80ed', '#27ae60', '#f2c94c', '#eb5757'],
    pieStyle: 'half',
    showLabel: true,
    showPercent: true,
    selectedMode: false,
    selectedOffset: 8
  }]
}
```

#### 半圆环图

```ts
const option = {
  title: { text: '任务完成率' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['已完成', '进行中', '待处理'] },
  series: [{
    name: '任务数',
    type: 'pie',
    data: [68, 20, 12],
    color: '#27ae60',
    colors: ['#27ae60', '#2f80ed', '#e5eaee'],
    pieStyle: 'half-ring',
    innerRadius: '58%',
    showLabel: false,
    selectedMode: false,
    selectedOffset: 8
  }]
}
```

---

### 进度条 progress

#### 圆弧进度条 + 渐变色

```ts
const option = {
  title: { text: '圆弧进度条 + 渐变色' },
  series: [{
    name: '正确率',
    type: 'progress',
    data: [80],
    color: '#27ae60',
    gradientColors: ['#2ac66d', '#19cfe3'],
    centerText: '正确率',
    centerValue: '80%',
    centerValueColor: '#27ae60'
  }]
}
```

#### 多重整圆进度条

```ts
const option = {
  title: { text: '多重整圆进度条' },
  series: [
    { name: '指标一', type: 'progress', pieStyle: 'multi-progress', data: [88], color: '#2f80ed', centerText: '指标', centerValue: '默认标题', centerValueColor: '#2f80ed', centerValueFontSize: 14 },
    { name: '指标二', type: 'progress', data: [72], color: '#8bc66d' },
    { name: '指标三', type: 'progress', data: [63], color: '#f7c44e' },
    { name: '指标四', type: 'progress', data: [54], color: '#ef6268' },
    { name: '指标五', type: 'progress', data: [46], color: '#6ec0df' }
  ]
}
```

#### 逆时针圆弧进度条

```ts
const option = {
  title: { text: '逆时针进度条' },
  series: [{
    name: '正确率',
    type: 'progress',
    pieStyle: 'reverse-progress',
    data: [80],
    color: '#27ae60',
    gradientColors: ['#2ac66d', '#19cfe3'],
    centerText: '正确率',
    centerValue: '80%',
    centerValueColor: '#27ae60'
  }]
}
```

#### 逆时针多重进度条

```ts
const option = {
  title: { text: '逆时针多重进度条' },
  series: [
    { name: '指标一', type: 'progress', pieStyle: 'reverse-multi-progress', data: [88], color: '#2f80ed', centerText: '指标', centerValue: '默认标题', centerValueColor: '#2f80ed', centerValueFontSize: 14 },
    { name: '指标二', type: 'progress', data: [72], color: '#8bc66d' },
    { name: '指标三', type: 'progress', data: [63], color: '#f7c44e' },
    { name: '指标四', type: 'progress', data: [54], color: '#ef6268' },
    { name: '指标五', type: 'progress', data: [46], color: '#6ec0df' }
  ]
}
```

#### 圆角整圆进度条

```ts
const option = {
  title: { text: '圆角进度条' },
  series: [{
    name: '正确率',
    type: 'progress',
    pieStyle: 'rounded-progress',
    data: [80],
    color: '#27ae60',
    progressRound: true,
    centerText: '正确率',
    centerValue: '80%',
    centerValueColor: '#27ae60'
  }]
}
```

#### 自定义进度条最大值和背景色

```ts
const option = {
  title: { text: '自定义进度条' },
  series: [{
    name: '完成率',
    type: 'progress',
    data: [75],
    color: '#2f80ed',
    progressMax: 200,                   // 最大值 200，当前 75/200
    progressBackgroundColor: '#e0e0e0', // 背景轨道颜色
    progressGap: 10,                    // 多重进度条间距
    progressRound: true,                // 圆角端点
    centerText: '完成率',
    centerValue: '37.5%',
    centerValueColor: '#2f80ed',
    centerValueFontSize: 20
  }]
}
```

---

### 仪表盘 gauge

#### 基础刻度仪表盘

```ts
const option = {
  title: { text: '基础刻度仪表盘' },
  tooltip: { show: true, duration: 1800 },
  yAxis: { min: 0, max: 100 },
  series: [{
    name: '运行率',
    type: 'gauge',
    data: [78],
    color: '#27ae60',
    gaugeStyle: 'arc',
    gaugeShowTicks: true,
    gaugeTickCount: 10,
    gaugeShowPointer: true,
    centerText: '实时速度',
    centerValue: '78Km/H',
    centerValueColor: '#27ae60'
  }]
}
```

#### 圆形仪表盘

```ts
const option = {
  title: { text: '圆形仪表盘' },
  yAxis: { min: 0, max: 100 },
  series: [{
    name: '完成率',
    type: 'gauge',
    data: [66],
    color: '#2f80ed',
    gaugeStyle: 'circle',
    gaugeRound: true,
    gaugeShowPointer: false,
    gaugeShowTicks: true,
    gaugeTickCount: 20,
    gaugeGradientColors: ['#1e8df5', '#bfe0ff'],
    centerText: '实时速度',
    centerValue: '66Km/H',
    centerValueColor: '#2f80ed'
  }]
}
```

#### 圆弧渐变仪表盘

```ts
const option = {
  title: { text: '圆弧渐变仪表盘' },
  yAxis: { min: 0, max: 100 },
  series: [{
    name: '正确率',
    type: 'gauge',
    data: [80],
    color: '#27ae60',
    gaugeStyle: 'arc',
    gaugeRound: true,
    gaugeShowPointer: false,
    gaugeGradientColors: ['#2ac66d', '#19cfe3'],
    gaugeBackgroundColor: '#e8eaed',
    centerText: '正确率',
    centerValue: '80%',
    centerValueColor: '#27ae60'
  }]
}
```

---

### 散点图 scatter

```ts
const option = {
  title: { text: '客流分布' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
  series: [{
    name: '客流',
    type: 'scatter',
    data: [80, 160, 120, 230, 190, 280, 220],
    color: '#9b51e0',
    symbolSize: 12
  }]
}
```

---

### 雷达图 radar

```ts
const option = {
  title: { text: '多维能力雷达' },
  tooltip: { show: true, duration: 1800 },
  radar: {
    indicator: [
      { name: '销售', max: 100 },
      { name: '服务', max: 100 },
      { name: '效率', max: 100 },
      { name: '库存', max: 100 },
      { name: '复购', max: 100 }
    ]
  },
  series: [
    { name: '门店A', type: 'radar', data: [88, 76, 92, 68, 80], color: '#2f80ed' },
    { name: '门店B', type: 'radar', data: [68, 88, 74, 82, 66], color: '#27ae60' }
  ]
}
```

---

### 漏斗图 funnel

```ts
const option = {
  title: { text: '转化漏斗' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['访问', '加购', '下单', '支付'] },
  series: [{
    name: '转化',
    type: 'funnel',
    data: [100, 78, 46, 28],
    color: '#f2994a'
  }]
}
```

---

### 箱线图 boxplot

```ts
const option = {
  title: { text: '订单分布箱线图' },
  tooltip: { show: true, duration: 1800 },
  xAxis: { data: ['1月', '2月', '3月', '4月'] },
  series: [{
    name: '分布',
    type: 'boxplot',
    data: [0, 0, 0, 0],
    boxplotData: [
      [42, 55, 66, 78, 90],   // 1月: [min, Q1, median, Q3, max]
      [38, 50, 62, 75, 84],   // 2月
      [46, 58, 70, 82, 96],   // 3月
      [35, 49, 60, 73, 88]    // 4月
    ],
    color: '#9b51e0'
  }]
}
```

---

### K 线图 candlestick

`candlestickData` 的每项按 `[开盘价, 收盘价, 最低价, 最高价]` 传入。默认收涨为红色、收跌为绿色，可通过 `itemColors` 覆盖单根 K 线颜色。

将 `colors` 设为 `[上涨色, 下跌色]` 可统一配置涨跌配色；同一 `series` 中的 `line` 类型系列会按同一价格坐标系叠加显示，适合绘制 MA 均线。

```ts
const option = {
  title: { text: '日 K 线' },
  legend: { show: false },
  xAxis: { data: ['2017-10-24', '2017-10-25', '2017-10-26', '2017-10-27'] },
  yAxis: { min: 0, max: 50 },
  series: [{
    name: '价格',
    type: 'candlestick',
    data: [],
    candlestickData: [
      [20, 34, 10, 38],
      [40, 35, 30, 50],
      [38, 31, 30, 44],
      [15, 38, 5, 42]
    ],
    itemColors: ['#ef5350', '#45b36b', '#ef5350', '#45b36b']
  }]
}
```

#### K 线图 + MA 均线叠加示例

```ts
const option = {
  title: { text: 'K 线 + MA5/MA10' },
  legend: { show: true },
  xAxis: { data: ['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07'] },
  yAxis: { min: 0, max: 60 },
  series: [
    {
      name: '日K',
      type: 'candlestick',
      data: [],
      candlestickData: [
        [20, 34, 10, 38],
        [40, 35, 30, 50],
        [38, 31, 30, 44],
        [32, 38, 28, 42],
        [36, 42, 34, 46],
        [40, 45, 38, 48],
        [43, 40, 38, 50]
      ],
      colors: ['#ef5350', '#45b36b']
    },
    {
      name: 'MA5',
      type: 'line',
      data: [0, 0, 32.6, 35.0, 36.2, 38.2, 40.0],
      startIndex: 2,
      color: '#2196f3',
      smooth: false,
      showSymbol: false,
      lineStyle: { width: 1.5 }
    },
    {
      name: 'MA10',
      type: 'line',
      data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 36.5],
      startIndex: 9,
      color: '#ff9800',
      smooth: false,
      showSymbol: false,
      lineStyle: { width: 1.5 }
    }
  ]
}
```

---

## Tooltip 交互详解

### 基本用法

```ts
tooltip: { show: true, duration: 1800 }
```

点击数据点后显示 Tooltip，1.8 秒后自动消失。

### 合并显示同类目数据

```ts
tooltip: { show: true, merge: true, trigger: 'axis', duration: 1800 }
```

- `trigger: 'axis'`：点击类目纵向区域任意位置即可触发，不必精确点击数据点
- `merge: true`：合并显示该类目下所有系列的值

### 自定义 Tooltip 样式

```ts
tooltip: {
  show: true,
  merge: true,
  trigger: 'axis',
  backgroundColor: '#263238',   // 深色背景
  textColor: '#ffffff',         // 白色文字
  borderRadius: 4,              // 圆角
  duration: 1800
}
```

### 辅助线标注

折线图显示 Tooltip 时，默认在 X 轴和 Y 轴位置绘制辅助线：

```ts
tooltip: {
  show: true,
  trigger: 'axis',
  // X 轴辅助线（垂直线）
  axisPointerLineColor: '#90a4ae',       // 辅助线颜色
  axisPointerLabelColor: '#ffffff',      // 标签文字颜色
  axisPointerLabelBgColor: '#90a4ae',    // 标签背景颜色
  showAxisPointer: true,                 // 是否显示，默认 true
  // Y 轴辅助线（水平线）
  axisLineColor: '#90a4ae',              // 辅助线颜色
  axisLineLabelColor: '#ffffff',         // 标签文字颜色
  axisLineLabelBgColor: '#90a4ae',       // 标签背景颜色
  showAxisLine: true                     // 是否显示，默认 true
}
```

隐藏辅助线：

```ts
tooltip: { show: true, showAxisLine: false, showAxisPointer: false }
```

### 色块标记

```ts
tooltip: { show: true, showMarker: true }   // 默认显示色块标记
tooltip: { show: true, showMarker: false }  // 隐藏色块标记
```

### 图例联动

```ts
tooltip: { show: true, respectLegend: true }   // 默认：隐藏的系列不在 Tooltip 中显示
tooltip: { show: true, respectLegend: false }  // 即使系列被隐藏，Tooltip 仍显示其数据
```

---

## 图例交互详解

### 基本图例

```ts
legend: { show: true, textColor: '#263238' }
```

### 可切换图例

```ts
legend: { show: true, textColor: '#263238', toggleable: true }
```

当 `toggleable: true`（默认）时：
- 点击图例色块可隐藏/显示对应系列的数据
- 隐藏的系列不会绘制在图表上
- 配合 `tooltip.respectLegend: true`（默认），Tooltip 中也不显示被隐藏系列的数据

---

## 横向滚动

当数据类目超过 12 个时，组件自动启用横向滚动：

```vue
<xtf-charts :option="option" height="320px" :scrollable="true"></xtf-charts>
```

- `scrollable: true`（默认）：超过 12 个类目时按每个类目 56px 最小宽度扩展 Canvas
- `scrollable: false`：Canvas 保持容器宽度，所有柱子按比例压缩显示
- `showScrollbar: true`：显示横向滚动条

### Y 轴固定

```ts
yAxis: { min: 0, max: 360, fixed: true }
```

横向滚动时，Y 轴默认随内容一起滚动。设置 `fixed: true` 后，Y 轴固定在左侧，仅数据区横向滚动。

---

## X 轴标签格式化

```ts
xAxis: {
  data: ['2025-03-01', '2025-03-02', '2025-03-03'],
  axisLabel: {
    interval: 2,        // 每隔 2 个类目显示一个标签
    format: 'day',      // 日期格式化：'month' | 'day' | 'month-day'
    rotate: 0           // 标签旋转角度
  }
}
```

| format 值 | 输入 | 输出 |
|-----------|------|------|
| `'month'` | `'2025-03-01'` | `'3月'` |
| `'day'` | `'2025-03-01'` | `'1日'` |
| `'month-day'` | `'2025-03-01'` | `'3/1'` |
| 不设置 | `'2025-03-01'` | `'2025-03-01'` |

---

## 动画配置

```ts
const option = {
  animation: true,              // 开启动画
  animationDuration: 800,       // 动画时长 800ms
  animationMode: 'left-to-right' // 从左到右逐点绘制
}
```

| 参数 | 说明 |
|------|------|
| `animation: false` | 关闭动画，数据更新时直接显示最终状态 |
| `animationMode: 'left-to-right'` | 折线图从左到右逐点绘制动画 |
| `animationMode` 不设置 | 整体过渡动画，所有数据点同时从旧位置过渡到新位置 |

---

## 深色主题示例

```ts
const option = {
  title: { text: '深色主题', color: '#ffffff' },
  backgroundColor: '#1c1c28',
  textColor: '#b0bec5',
  grid: { backgroundColor: '#1c1c28', borderColor: '#37474f', showHorizontal: true, showVertical: true },
  xAxis: { data: ['周一', '周二', '周三', '周四', '周五'], axisLabel: { color: '#b0bec5' }, splitLine: { show: true, color: '#37474f' } },
  yAxis: { min: 0, max: 300, axisLabel: { color: '#b0bec5' }, splitLine: { show: true, color: '#37474f' } },
  tooltip: { show: true, merge: true, trigger: 'axis', backgroundColor: '#263238', textColor: '#ffffff', borderRadius: 4, duration: 1800 },
  legend: { show: true, textColor: '#b0bec5' },
  series: [
    { name: '销售额', type: 'line', data: [120, 180, 150, 240, 210], color: '#2f80ed', smooth: true, areaStyle: true },
    { name: '订单数', type: 'line', data: [80, 130, 110, 170, 140], color: '#27ae60', smooth: true }
  ]
}
```

---

## 技术说明

**uni-app x 版本**：使用新版 Canvas 2D API，不依赖 DOM、WebView 或 `renderjs`，适用于 Vapor 字节码模式，原生渲染性能。

**标准 uni-app 版本**：基于标准 Canvas 2D Context API，H5 环境使用标准 Web Canvas API，小程序环境自动适配 `canvas-2d` 类型。

**已知问题**：
- 小程序环境下文本测量精度有限，外置饼图标签自动避让可能不够精确。
- 部分小程序平台对渐变、阴影等高级 Canvas 特性支持有限。
- 数据量过大时建议关闭动画或限制类目数量以提升性能。

---

## 许可证

本插件遵循 MIT 许可证。

---

## 更新日志

### v1.0.0
- 初始发布
- 支持 uni-app x 和标准 uni-app 双版本
- 提供 10+ 种图表类型
- 支持 K 线图 + MA 均线叠加
- 支持柱状图纹理填充
- 支持饼图外置标签自动避让
- 支持手势横向滚动
- 支持仪表盘自定义
- 支持全局标签回退

---

## 联系与支持

如有问题或建议，欢迎通过以下方式联系：

- 插件市场：[xtf-charts](https://ext.dcloud.net.cn/)
- GitHub：[xtf-charts](https://github.com/)
- 邮箱：support@example.com
