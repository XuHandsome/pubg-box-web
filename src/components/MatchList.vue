<template>
  <div class="match-list">
    <div v-if="loading" class="loading-box">
      <el-skeleton :rows="5" animated />
    </div>
    <div v-else-if="matches.length === 0" class="empty-box">
      暂无战绩数据，后台可能正在同步中...
    </div>
    <div v-else>
      <div
        v-for="match in matches"
        :key="match.matchId"
        class="match-wrapper"
        :class="{ 'win': match.won, 'lose': !match.won }"
      >
        <div class="match-item">
          <div class="match-status">
            <div class="result">{{ match.won ? '胜利' : '#' + match.rank }}</div>
            <div class="mode">{{ formatGameMode(match.gameMode) }}</div>
          </div>

          <div class="match-info">
            <div class="map">{{ formatMapName(match.mapName) }}</div>
            <div class="time">{{ formatDate(match.createdAt) }}</div>
          </div>

          <div class="match-stats">
            <div class="stat-item">
              <span class="label">击杀</span>
              <span class="value">{{ match.kills }}</span>
            </div>
            <div class="stat-item">
              <span class="label">助攻</span>
              <span class="value">{{ match.assists }}</span>
            </div>
            <div class="stat-item">
              <span class="label">伤害</span>
              <span class="value">{{ Math.floor(match.damageDealt) }}</span>
            </div>
            <div class="stat-item">
              <span class="label">模式</span>
              <span class="value" style="font-size: 12px; font-weight: normal; color: #999;">{{ formatMatchType(match.matchType) }}</span>
            </div>
          </div>

          <div class="match-detail-btn">
            <el-button size="small" type="primary" plain @click="goToReplay(match.matchId)">
              对局回放
            </el-button>
            <el-button size="small" link @click="toggleDetail(match.matchId)">
              {{ expandedMatches[match.matchId] ? '收起' : '详情' }}
              <el-icon :class="{ 'is-active': expandedMatches[match.matchId] }">
                <ArrowDown />
              </el-icon>
            </el-button>
          </div>
        </div>

        <!-- 详情面板 -->
        <el-collapse-transition>
          <div v-if="expandedMatches[match.matchId]" class="match-detail">
            <el-divider content-position="left">详细战绩</el-divider>
            <div class="detail-grid">
              <!-- 存活信息 -->
              <div class="detail-section">
                <div class="section-title"><el-icon><Timer /></el-icon> 存活信息</div>
                <div class="detail-item">
                  <span class="label">对局时长</span>
                  <span class="value">{{ formatDuration(match.duration) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">存活时间</span>
                  <span class="value">{{ formatDuration(Math.floor(match.stats.timeSurvived)) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">步行距离</span>
                  <span class="value">{{ (match.stats.walkDistance / 1000).toFixed(2) }} km</span>
                </div>
                <div class="detail-item">
                  <span class="label">行驶距离</span>
                  <span class="value">{{ (match.stats.rideDistance / 1000).toFixed(2) }} km</span>
                </div>
                <div class="detail-item">
                  <span class="label">游泳距离</span>
                  <span class="value">{{ match.stats.swimDistance.toFixed(2) }} m</span>
                </div>
              </div>

              <!-- 猛攻信息 -->
              <div class="detail-section">
                <div class="section-title"><el-icon><Aim /></el-icon> 猛攻信息</div>
                <div class="detail-item">
                  <span class="label">击倒次数 (DBNOs)</span>
                  <span class="value">{{ match.stats.dbnos }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">击杀排名</span>
                  <span class="value">#{{ match.stats.killPlace }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">爆头击杀</span>
                  <span class="value">{{ match.stats.headshotKills }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">最远击杀</span>
                  <span class="value">{{ match.stats.longestKill.toFixed(2) }} m</span>
                </div>
                <div class="detail-item">
                  <span class="label">载具杀人</span>
                  <span class="value">{{ match.stats.roadKills }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">损坏载具</span>
                  <span class="value">{{ match.stats.vehicleDestroys }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">死亡原因</span>
                  <span class="value">{{ formatDeathType(match.stats.deathType) }}</span>
                </div>
              </div>

              <!-- 治疗与小队 -->
              <div class="detail-section">
                <div class="section-title"><el-icon><FirstAidKit /></el-icon> 治疗与小队</div>
                <div class="detail-item">
                  <span class="label">扶起队友</span>
                  <span class="value">{{ match.stats.revives }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">使用药品</span>
                  <span class="value">{{ match.stats.heals }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">使用能量物品</span>
                  <span class="value">{{ match.stats.boosts }}</span>
                </div>
                <el-divider border-style="dashed" style="margin: 12px 0" />
                <div class="detail-item">
                  <span class="label">小队 ID</span>
                  <span class="value">{{ match.stats.teamId }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-collapse-transition>
      </div>
    </div>
    <!-- 对局回放弹窗 -->
    <el-dialog
      v-model="showReplay"
      width="fit-content"
      top="1vh"
      destroy-on-close
      :show-close="false"
      :close-on-click-modal="false"
      class="replay-dialog"
    >
      <Replay
        v-if="showReplay"
        :id="currentReplayId"
        :player="currentPlayerName"
        :is-dialog="true"
      />
      <template #footer>
        <div style="text-align: center; margin-top: -10px; padding-bottom: 10px;">
          <el-button @click="showReplay = false" type="info" plain size="small">关闭回放 (ESC)</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import type { PlayerMatchResponse } from '../types'
import { ArrowDown, Timer, Aim, FirstAidKit } from '@element-plus/icons-vue'
import Replay from '../views/Replay.vue'
import {
  MAP_NAME_DICT,
  GAME_MODE_DICT,
  MATCH_TYPE_DICT,
  DEATH_TYPE_DICT
} from '../utils/constants'

const props = defineProps<{
  matches: PlayerMatchResponse[]
  loading: boolean
  currentPlayerName?: string
}>()

const expandedMatches = ref<Record<string, boolean>>({})
const showReplay = ref(false)
const currentReplayId = ref('')

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return dateStr // 后端已经格式化好了
}

const formatMapName = (mapName: string) => {
  return MAP_NAME_DICT[mapName] || mapName
}

const formatGameMode = (gameMode: string) => {
  return GAME_MODE_DICT[gameMode] || gameMode
}

const formatMatchType = (matchType: string) => {
  return MATCH_TYPE_DICT[matchType] || matchType
}

const toggleDetail = (matchId: string) => {
  expandedMatches.value[matchId] = !expandedMatches.value[matchId]
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}分${s}秒`
}

const formatDeathType = (type: string) => {
  return DEATH_TYPE_DICT[type] || type
}

const goToReplay = async (matchId: string) => {
  currentReplayId.value = matchId
  await nextTick()
  showReplay.value = true
}
</script>

<style scoped lang="scss">
.match-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-wrapper {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  overflow: hidden;
  border-left-width: 6px;
  border-left-style: solid;
  border-left-color: var(--el-border-color);

  &.win {
    border-left-color: var(--el-color-primary);
    .match-item { background-color: var(--el-color-primary-light-9); }
  }

  &.lose {
    border-left-color: var(--el-color-danger);
    .match-item { background-color: var(--el-color-danger-light-9); }
  }
}

.match-item {
  display: flex;
  align-items: center;
  padding: 15px;
  color: var(--el-text-color-primary);
  gap: 20px;
}

.match-detail {
  padding: 0 20px 20px 20px;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-regular);

  :deep(.el-divider__text) {
    background-color: var(--el-bg-color-page);
    color: var(--el-text-color-secondary);
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
}

.detail-section {
  .section-title {
    font-size: 14px;
    font-weight: bold;
    color: #409eff;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;

  .label {
    color: var(--el-text-color-secondary);
  }
  .value {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }
}

.match-detail-btn {
  .el-icon {
    transition: transform 0.3s;
    &.is-active {
      transform: rotate(180deg);
    }
  }
}

.match-status {
  width: 80px;
  text-align: center;
  .result {
    font-weight: bold;
    font-size: 16px;
  }
  .mode {
    font-size: 12px;
    color: #999;
  }
}

.match-info {
  width: 120px;
  .map {
    font-size: 14px;
  }
  .time {
    font-size: 12px;
    color: #999;
  }
}

.match-stats {
  flex: 1;
  display: flex;
  gap: 30px;

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;

    .label {
      font-size: 12px;
      color: #999;
    }
    .value {
      font-size: 16px;
      font-weight: bold;
    }
  }
}

.loading-box, .empty-box {
  padding: 40px;
  text-align: center;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  color: var(--el-text-color-secondary);
}

:deep(.replay-dialog) {
  background: transparent !important;
  box-shadow: none !important;
  .el-dialog__header { display: none; }
  .el-dialog__body { padding: 0 !important; }
}
</style>
