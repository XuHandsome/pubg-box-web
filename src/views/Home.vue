<template>
  <div class="home-container">
    <div class="search-section">
      <h1 class="title">PUBG.BOX</h1>
      <div class="search-box">
        <el-input
          v-model="playerName"
          placeholder="输入玩家昵称查询战绩"
          @keyup.enter="handleSearch"
          size="large"
        >
          <template #append>
            <el-button @click="handleSearch" :icon="Search">查询</el-button>
          </template>
        </el-input>
      </div>

      <!-- 新增：最近搜索 -->
      <div class="recent-searches" v-if="recentPlayers.length > 0">
        <div class="recent-title">最近搜索</div>
        <div class="recent-list">
          <el-tag
            v-for="name in recentPlayers"
            :key="name"
            class="recent-tag"
            closable
            @click="handleRecentClick(name)"
            @close="removeRecent(name)"
          >
            {{ name }}
          </el-tag>
        </div>
      </div>

      <!-- 新增：系统统计数据 -->
      <div class="stats-row" v-if="stats">
        <div class="stat-box">
          <div class="stat-value">{{ stats.players }}</div>
          <div class="stat-label">追踪玩家</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">{{ stats.matches }}</div>
          <div class="stat-label">收录对局</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getSystemStats } from '../api/player'

const playerName = ref('')
const router = useRouter()
const recentPlayers = ref<string[]>([])
const stats = ref<{ players: number, matches: number } | null>(null)

const handleSearch = () => {
  if (!playerName.value.trim()) {
    ElMessage.warning('请输入玩家昵称')
    return
  }
  const name = playerName.value.trim()
  saveRecent(name)
  router.push(`/player/${name}`)
}

const saveRecent = (name: string) => {
  const current = JSON.parse(localStorage.getItem('recent_searches') || '[]')
  const updated = [name, ...current.filter((n: string) => n !== name)].slice(0, 5)
  localStorage.setItem('recent_searches', JSON.stringify(updated))
}

const handleRecentClick = (name: string) => {
  router.push(`/player/${name}`)
}

const removeRecent = (name: string) => {
  recentPlayers.value = recentPlayers.value.filter(n => n !== name)
  localStorage.setItem('recent_searches', JSON.stringify(recentPlayers.value))
}

onMounted(async () => {
  recentPlayers.value = JSON.parse(localStorage.getItem('recent_searches') || '[]')
  try {
    stats.value = await getSystemStats()
  } catch (err) {
    console.error('Failed to fetch stats')
  }
})
</script>

<style scoped lang="scss">
.home-container {
  height: calc(100vh - 60px);
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}

.search-section {
  width: 100%;
  max-width: 600px;
  text-align: center;
  padding: 0 20px;
}

.title {
  font-size: 56px;
  margin-bottom: 40px;
  font-weight: bold;
  letter-spacing: 4px;
  background: linear-gradient(45deg, #409eff, #42b883);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.search-box {
  margin-bottom: 40px;
}

.recent-searches {
  margin-bottom: 50px;
  .recent-title {
    font-size: 14px;
    color: #999;
    margin-bottom: 12px;
  }
  .recent-list {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .recent-tag {
    cursor: pointer;
    background-color: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    color: var(--el-text-color-regular);
    padding: 8px 15px;
    height: auto;
    &:hover {
      background-color: var(--el-fill-color);
      color: var(--el-color-primary);
    }
  }
}

.stats-row {
  display: flex;
  justify-content: center;
  gap: 60px;
  padding-top: 40px;
  border-top: 1px solid var(--el-border-color-lighter);

  .stat-box {
    .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #409eff;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
  }
}

:deep(.el-input-group__append) {
  background-color: #409eff;
  color: white;
  border: none;

  &:hover {
    background-color: #66b1ff;
  }
}
</style>
