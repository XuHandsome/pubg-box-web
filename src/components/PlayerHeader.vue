<template>
  <div class="player-header-wrapper">
    <el-card class="player-info-card" v-if="player">
    <div class="player-header">
      <div class="avatar-box">
        <el-avatar :size="80" src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png" />
      </div>

      <div class="info-box">
        <h2 class="player-name">{{ player.name }}</h2>
        <div class="player-meta">
          <el-tag size="small" type="warning">平台: {{ player.shardId }}</el-tag>
        </div>
        <div class="update-time">
          最后更新: {{ formatDate(player.updatedAt) }}
        </div>
      </div>

      <!-- 对局趋势曲线图 -->
      <div class="chart-container" v-if="matches && matches.length > 0">
        <v-chart class="match-chart" :option="chartOption" autoresize />
      </div>

      <!-- 战绩统计数据 -->
      <div class="aggregate-stats" v-if="matches && matches.length > 0">
        <div class="stat-row">
          <span class="stat-label">KDA</span>
          <span class="stat-value">{{ kda }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">平均伤害</span>
          <span class="stat-value">{{ avgDamage }}</span>
        </div>
      </div>

      <div class="actions">
        <el-button
          v-if="aiEnabled"
          type="warning"
          :icon="MagicStick"
          @click="handleDeepAnalyze"
          :loading="isDiagnosing"
        >
          AI 深度诊断
        </el-button>
        <el-button
          type="primary"
          :icon="Refresh"
          :loading="loading"
          :disabled="loading || (cooldown !== undefined && cooldown > 0)"
          @click="$emit('refresh')"
        >
          {{ cooldown && cooldown > 0 ? `请稍等 (${cooldown}s)` : '更新战绩' }}
        </el-button>
      </div>
    </div>
  </el-card>

  <!-- AI 深度诊断结果展示 -->
  <el-collapse-transition>
    <el-card v-if="showDiagnosis" class="diagnosis-card">
      <template #header>
        <div class="diagnosis-header">
          <div class="title">
            <el-icon><MagicStick /></el-icon>
            AI 深度对局诊断报告
          </div>
          <div class="header-actions">
            <el-button size="small" link @click="showDiagnosis = false">收起</el-button>
            <el-divider direction="vertical" />
            <el-button size="small" link @click="diagnosisResult = ''; showDiagnosis = false">清空缓存</el-button>
          </div>
        </div>
      </template>
      <div class="diagnosis-content">
        <div v-if="isDiagnosing && !diagnosisResult" class="loading-state">
          <el-skeleton :rows="3" animated />
          <p class="loading-text">AI 正在扫描您的最近 20 场表现，请稍后...</p>
        </div>
        <div class="markdown-body" v-html="formatMarkdown(diagnosisResult)"></div>
        <div v-if="isDiagnosing" class="streaming-cursor"></div>
      </div>
    </el-card>
  </el-collapse-transition>
</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PlayerResponse, PlayerMatchResponse } from '../types'
import { Refresh, MagicStick } from '@element-plus/icons-vue'
import { aiEnabled } from '../utils/features'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components'
import VChart from 'vue-echarts'

// 注册 ECharts 组件
use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent
])

const props = defineProps<{
  player: PlayerResponse | null
  matches: PlayerMatchResponse[]
  loading?: boolean
  cooldown?: number
}>()

const diagnosisResult = ref('')
const isDiagnosing = ref(false)
const showDiagnosis = ref(false)

const handleDeepAnalyze = async () => {
  if (!props.player) return

  // 如果已经有结果且没有展示，则直接展示，不再重新请求
  if (diagnosisResult.value && !showDiagnosis.value) {
    showDiagnosis.value = true
    return
  }

  // 如果正在展示且有结果，则关闭展示（实现切换效果）
  if (showDiagnosis.value && diagnosisResult.value) {
    showDiagnosis.value = false
    return
  }

  diagnosisResult.value = ''
  isDiagnosing.value = true
  showDiagnosis.value = true

  try {
    const url = `/api/player/${props.player.name}/deep-analyze`
    const response = await fetch(url)

    if (!response.body) throw new Error('ReadableStream not supported')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let dataBuffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const content = line.startsWith('data: ') ? line.substring(6) : line.substring(5)
          dataBuffer += content + '\n'
        } else if (line === '' && dataBuffer) {
          diagnosisResult.value += dataBuffer.slice(0, -1)
          dataBuffer = ''
        }
      }
    }
  } catch (err) {
    console.error('Deep analyze error:', err)
  } finally {
    isDiagnosing.value = false
  }
}

const formatMarkdown = (text: string) => {
  if (!text) return ''

  // 1. 清理冗余标签
  let content = text
    .replace(/```markdown\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^"|"$/g, '') // 移除可能的引号包裹
    .trim()

  // 2. 预处理：处理 AI 可能把标题和正文连在一起的情况 (如 ---###)
  content = content.replace(/([^\n])(#{1,6})/g, '$1\n$2')

  const lines = content.split('\n')
  let html = ''
  let inList = false

  for (let line of lines) {
    let l = line.trim()
    if (!l) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<div style="height: 8px"></div>'
      continue
    }

    // 移除结尾冗余的 #
    l = l.replace(/\s*#+\s*$/g, '')

    // 处理标题 (兼容没有空格的情况，如 ##1.)
    const headerMatch = l.match(/^(#{1,6})\s*(.*)/)
    if (headerMatch && headerMatch[1] && headerMatch[2]) {
      if (inList) { html += '</ul>'; inList = false; }
      const level = headerMatch[1].length
      const title = headerMatch[2].trim()
      html += `<h${level}>${parseInline(title)}</h${level}>`
      continue
    }

    // 处理列表 (必须有空格，防止误伤加粗语法 **text**)
    const listMatch = l.match(/^([-*+])\s+(.*)/)
    if (listMatch && listMatch[2]) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${parseInline(listMatch[2])}</li>`
      continue
    }

    if (inList) { html += '</ul>'; inList = false; }

    // 处理引用
    if (l.startsWith('> ')) {
      html += `<blockquote>${parseInline(l.replace('> ', ''))}</blockquote>`
      continue
    }

    // 普通段落
    html += `<p>${parseInline(l)}</p>`
  }

  if (inList) html += '</ul>'
  return html
}

const parseInline = (text: string) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/---/g, '<hr/>')
}

defineEmits(['refresh'])

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

// 计算 KDA 和 平均伤害
const kda = computed(() => {
  if (!props.matches || props.matches.length === 0) return '0.00'
  let totalKills = 0
  let totalAssists = 0
  let totalDeaths = 0

  props.matches.forEach(m => {
    totalKills += m.kills
    totalAssists += m.assists
    if (m.stats.deathType !== 'alive') {
      totalDeaths++
    }
  })

  const val = (totalKills + totalAssists) / Math.max(1, totalDeaths)
  return val.toFixed(2)
})

const avgDamage = computed(() => {
  if (!props.matches || props.matches.length === 0) return '0'
  const totalDamage = props.matches.reduce((sum, m) => sum + m.damageDealt, 0)
  return Math.floor(totalDamage / props.matches.length)
})

// 图表配置
const chartOption = computed(() => {
  if (!props.matches) return {}
  // 取最近 15 场对局展示趋势（按照时间顺序）
  const chartData = [...props.matches].slice(0, 15).reverse()

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      confine: true, // 关键：将提示框限制在图表区域内，防止被上方 Header 遮挡
      backgroundColor: 'rgba(51, 51, 51, 0.9)',
      borderColor: '#444',
      textStyle: { color: '#eee', fontSize: 12 }
    },
    legend: {
      data: ['排名', '击杀', '伤害'],
      textStyle: { color: '#999', fontSize: 10 },
      top: 0,
      itemWidth: 10,
      itemHeight: 10
    },
    grid: {
      left: '3%',
      right: '12%',
      bottom: '3%',
      top: '30%',
      outerBounds: {}
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.map((_, index) => index + 1),
      axisLine: { lineStyle: { color: '#444' } },
      axisLabel: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '击杀',
        nameTextStyle: { color: '#42b883', fontSize: 10 },
        splitLine: { lineStyle: { color: '#333' } },
        axisLabel: { color: '#666', fontSize: 10 }
      },
      {
        type: 'value',
        name: '排名',
        nameTextStyle: { color: '#f56c6c', fontSize: 10 },
        inverse: true,
        splitLine: { show: false },
        axisLabel: { color: '#666', fontSize: 10 }
      },
      {
        type: 'value',
        name: '伤害',
        nameTextStyle: { color: '#409eff', fontSize: 10 },
        position: 'right',
        offset: 35,
        splitLine: { show: false },
        axisLabel: { color: '#666', fontSize: 10 }
      }
    ],
    series: [
      {
        name: '排名',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: chartData.map(m => m.rank),
        itemStyle: { color: '#f56c6c' },
        lineStyle: { width: 2 }
      },
      {
        name: '击杀',
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        data: chartData.map(m => m.kills),
        itemStyle: { color: '#42b883' },
        lineStyle: { width: 2 }
      },
      {
        name: '伤害',
        type: 'line',
        yAxisIndex: 2,
        smooth: true,
        data: chartData.map(m => Math.round(m.damageDealt)),
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 2 }
      }
    ]
  }
})
</script>

<style scoped lang="scss">
.player-info-card {
  margin-bottom: 20px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  color: var(--el-text-color-primary);

  :deep(.el-card__body) {
    padding: 20px;
  }
}

.player-header {
  display: flex;
  align-items: center;
  gap: 30px;
}

.avatar-box {
  flex-shrink: 0;
}

.info-box {
  width: 200px;

  .player-name {
    font-size: 24px;
    margin: 0 0 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .player-meta {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .update-time {
    font-size: 12px;
    color: #999;
  }
}

.aggregate-stats {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 0 25px;
  border-left: 1px solid var(--el-border-color);
  border-right: 1px solid var(--el-border-color);
  min-width: 150px;

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .stat-label {
      font-size: 13px;
      color: #888;
    }

    .stat-value {
      font-size: 18px;
      font-weight: bold;
      color: #409eff;
    }
  }
}

.chart-container {
  flex: 1;
  height: 100px;
  min-width: 300px;
}

.match-chart {
  height: 100%;
  width: 100%;
}

.actions {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 130px;

  .el-button {
    margin-left: 0 !important;
    width: 100%;
  }
}

.diagnosis-card {
  margin-bottom: 20px;
  background-color: #f0f9eb;
  border: 1px solid #e1f3d8;

  .diagnosis-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: bold;
      color: #67c23a;
    }
  }
}

.diagnosis-content {
  line-height: 1.8;
  font-size: 15px;
  color: #303133;
  position: relative;

  .loading-state {
    text-align: center;
    .loading-text {
      margin-top: 15px;
      color: #909399;
    }
  }

  .markdown-body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;

    :deep(h1) {
      font-size: 22px;
      margin: 16px 0 12px;
      color: #303133;
      border-bottom: 2px solid #67c23a;
      padding-bottom: 8px;
    }
    :deep(h2) {
      font-size: 19px;
      margin: 14px 0 10px;
      color: #303133;
    }
    :deep(h3) {
      font-size: 17px;
      margin: 12px 0 8px;
      color: #67c23a;
      font-weight: bold;
    }
    :deep(p) {
      margin: 6px 0;
      line-height: 1.6;
    }
    :deep(li) {
      margin-left: 20px;
      margin-bottom: 6px;
      list-style-type: disc;
    }
    :deep(strong) {
      color: #E6A23C;
      font-weight: 600;
    }
    :deep(code) {
      background-color: #f0f2f5;
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
      color: #f56c6c;
    }
    :deep(blockquote) {
      margin: 10px 0;
      padding: 8px 15px;
      background-color: #f4f4f5;
      border-left: 4px solid #909399;
      color: #606266;
      font-style: italic;
    }
  }
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 15px;
  background-color: #67c23a;
  margin-left: 4px;
  animation: blink 1s infinite;
  vertical-align: middle;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
