<template>
  <header class="common-header" :class="{ 'is-home': isHome }">
    <div class="header-content">
      <div class="logo" @click="goHome">
        PUBG.BOX
      </div>

      <div class="search-bar" v-if="!isHome">
        <el-input
          v-model="playerName"
          placeholder="搜索玩家..."
          @keyup.enter="handleSearch"
          size="default"
        >
          <template #append>
            <el-button @click="handleSearch" :icon="Search" />
          </template>
        </el-input>
      </div>

      <div class="theme-switcher">
        <el-dropdown trigger="click" @command="handleThemeChange">
          <el-button :icon="currentThemeIcon" circle />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="light" :disabled="theme === 'light'">
                <el-icon><Sunny /></el-icon> 浅色
              </el-dropdown-item>
              <el-dropdown-item command="dark" :disabled="theme === 'dark'">
                <el-icon><Moon /></el-icon> 深色
              </el-dropdown-item>
              <el-dropdown-item command="system" :disabled="theme === 'system'">
                <el-icon><Monitor /></el-icon> 系统
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Search, Sunny, Moon, Monitor } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const playerName = ref('')
const theme = ref(localStorage.getItem('theme') || 'dark')

const isHome = computed(() => route.path === '/')

const currentThemeIcon = computed(() => {
  if (theme.value === 'light') return Sunny
  if (theme.value === 'dark') return Moon
  return Monitor
})

const applyTheme = (t: string) => {
  const html = document.documentElement
  if (t === 'dark') {
    html.classList.add('dark')
  } else if (t === 'light') {
    html.classList.remove('dark')
  } else {
    // system
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }
}

const handleThemeChange = (command: string) => {
  theme.value = command
  localStorage.setItem('theme', command)
  applyTheme(command)
}

onMounted(() => {
  applyTheme(theme.value)

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (theme.value === 'system') {
      applyTheme('system')
    }
  })
})

const handleSearch = () => {
  if (!playerName.value.trim()) return
  router.push(`/player/${playerName.value.trim()}`)
}

const goHome = () => {
  router.push('/')
}

// 路由变化时清空搜索框
watch(() => route.params.name, (newName) => {
  if (newName) {
    playerName.value = newName as string
  }
}, { immediate: true })
</script>

<style scoped lang="scss">
.common-header {
  height: 60px;
  background-color: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 0 20px;
  transition: all 0.3s;

  &.is-home {
    background-color: transparent;
    border-bottom: none;
    .logo {
      font-size: 24px;
    }
  }
}

.header-content {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 40px;
}

.logo {
  font-size: 20px;
  font-weight: bold;
  color: #409eff;
  cursor: pointer;
  letter-spacing: 1px;
}

.search-bar {
  width: 300px;

  :deep(.el-input-group__append) {
    background-color: #409eff;
    color: white;
    border: none;
  }
}

.theme-switcher {
  margin-left: auto;

  .el-button {
    background-color: transparent;
    border: 1px solid var(--el-border-color);
    color: var(--el-text-color-secondary);

    &:hover {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary);
    }
  }
}
</style>
