<template>
  <div class="player-detail-container">
    <div class="content">
      <PlayerHeader
        :player="player"
        :matches="matches"
        @refresh="handleRefresh"
      />

      <!-- <div class="sync-hint" v-if="player">
        <el-alert
          title="后台正在同步最近对局，请稍后刷新查看完整战绩。"
          type="info"
          :closable="false"
          show-icon
        />
      </div> -->

      <!-- 筛选与排序工具栏 -->
      <div class="filter-toolbar" v-if="player">
        <div class="filter-left">
          <el-checkbox v-model="filter.won" label="只看胜利" border size="default" @change="handleFilterChange" />
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="default"
            @change="handleDateChange"
            :shortcuts="shortcuts"
          />
        </div>
        <div class="filter-right">
          <el-select v-model="filter.sortField" placeholder="排序字段" size="default" @change="handleSortFieldChange" style="width: 120px">
            <el-option label="默认时间" value="created_at" />
            <el-option label="击杀数" value="kills" />
            <el-option label="伤害量" value="damage" />
            <el-option label="排名" value="rank" />
          </el-select>
          <el-select v-model="filter.sortOrder" placeholder="排序方式" size="default" @change="handleFilterChange" style="width: 100px">
            <el-option label="降序" value="desc" />
            <el-option label="升序" value="asc" />
          </el-select>
        </div>
      </div>

      <MatchList
        :matches="matches"
        :loading="loadingMatches"
      />

      <!-- 分页组件 -->
      <div class="pagination-container" v-if="totalMatches > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalMatches"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
          background
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { getPlayerInfo, getPlayerMatches } from '../api/player'
import type { PlayerResponse, PlayerMatchResponse, MatchFilter } from '../types'
import PlayerHeader from '../components/PlayerHeader.vue'
import MatchList from '../components/MatchList.vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const playerName = route.params.name as string

const player = ref<PlayerResponse | null>(null)
const matches = ref<PlayerMatchResponse[]>([])
const loadingPlayer = ref(false)
const loadingMatches = ref(false)

// 分页状态
const currentPage = ref(1)
const pageSize = ref(20)
const totalMatches = ref(0)

// 筛选与排序状态
const filter = reactive<MatchFilter>({
  won: undefined,
  startTime: undefined,
  endTime: undefined,
  sortField: 'created_at',
  sortOrder: 'desc',
})

const dateRange = ref<[Date, Date] | null>(null)

const shortcuts = [
  {
    text: '最近一周',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
      return [start, end]
    },
  },
  {
    text: '最近一个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setMonth(start.getMonth() - 1)
      return [start, end]
    },
  },
]

const fetchData = async (name: string) => {
  loadingPlayer.value = true
  try {
    // 1. 获取玩家基础信息
    player.value = await getPlayerInfo(name)

    // 2. 获取对局信息
    loadingMatches.value = true
    const offset = (currentPage.value - 1) * pageSize.value

    // 构造发送给后端的参数
    const params: MatchFilter = { ...filter }
    if (params.won === false) params.won = undefined // Checkbox null/false 处理

    const matchData = await getPlayerMatches(name, pageSize.value, offset, params)
    matches.value = matchData.matches
    totalMatches.value = matchData.total
  } catch (err: any) {
    console.error('Fetch data error:', err)
    ElMessage.error(err.response?.data?.message || err.message || '获取数据失败')
  } finally {
    loadingPlayer.value = false
    loadingMatches.value = false
  }
}

const handleRefresh = () => {
  currentPage.value = 1
  fetchData(route.params.name as string)
}

const handleFilterChange = () => {
  currentPage.value = 1
  fetchData(route.params.name as string)
}

const handleSortFieldChange = () => {
  // 优化：排名默认升序(第1名最好)，其他默认降序(越多越好)
  if (filter.sortField === 'rank') {
    filter.sortOrder = 'asc'
  } else {
    filter.sortOrder = 'desc'
  }
  handleFilterChange()
}

const handleDateChange = (val: [Date, Date] | null) => {
  if (val) {
    filter.startTime = val[0].toISOString()
    filter.endTime = val[1].toISOString()
  } else {
    filter.startTime = undefined
    filter.endTime = undefined
  }
  handleFilterChange()
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchData(route.params.name as string)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  fetchData(route.params.name as string)
}

// 监听路由参数变化，支持在当前页搜索新玩家
watch(() => route.params.name, (newName) => {
  if (newName) {
    currentPage.value = 1
    fetchData(newName as string)
  }
})

onMounted(() => {
  fetchData(playerName)
})
</script>

<style scoped lang="scss">
.player-detail-container {
  min-height: calc(100vh - 60px);
  background-color: var(--el-bg-color-page);
  padding: 20px;
}

.content {
  max-width: 1000px;
  margin: 0 auto;
}

.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 15px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  gap: 20px;
  flex-wrap: wrap;

  .filter-left, .filter-right {
    display: flex;
    align-items: center;
    gap: 15px;
  }
}

.sync-hint {
  margin-bottom: 20px;
}

.pagination-container {
  margin-top: 30px;
  display: flex;
  justify-content: center;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  padding: 15px;
  border-radius: 4px;

  :deep(.el-pagination) {
    --el-pagination-bg-color: transparent;
  }
}
</style>
