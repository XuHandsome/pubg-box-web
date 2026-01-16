<template>
  <div class="app-container">
    <CommonHeader />
    <main class="main-body">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import CommonHeader from './components/CommonHeader.vue'
</script>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
