<template>
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
        <el-button type="primary" :icon="Refresh" @click="$emit('refresh')">更新战绩</el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerResponse, PlayerMatchResponse } from '../types'
import { Refresh } from '@element-plus/icons-vue'
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
}>()

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
  // 取最近 10 场对局展示趋势（按照时间顺序）
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
      containLabel: true
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
}
</style>
