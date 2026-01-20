<template>
  <div class="app-container">
    <CommonHeader v-if="!isReplayPage" />
    <main class="main-body" :class="{ 'is-replay': isReplayPage }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import CommonHeader from './components/CommonHeader.vue'
import { initFeatures } from './utils/features'

const route = useRoute()
const isReplayPage = computed(() => route.name === 'MatchReplay')

onMounted(() => {
  initFeatures()
})
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.main-body.is-replay {
  height: 100vh;
  overflow: hidden;
}
</style>
