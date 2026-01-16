<template>
  <div class="replay-container" v-loading="loading">
    <div class="replay-header">
      <div class="left">
        <el-button :icon="ArrowLeft" circle @click="$router.back()" />
        <span class="title">对局回放 - {{ match?.matchId }}</span>
      </div>
      <div class="controls" v-if="!loading">
        <el-button-group>
          <el-button :icon="isPlaying ? VideoPause : VideoPlay" @click="togglePlay">
            {{ isPlaying ? '暂停' : '播放' }}
          </el-button>
          <el-button @click="resetPlayback">重置</el-button>
        </el-button-group>
        <div class="speed-control">
          <span>倍速:</span>
          <el-select v-model="playSpeed" style="width: 80px">
            <el-option label="1x" :value="1" />
            <el-option label="2x" :value="2" />
            <el-option label="5x" :value="5" />
            <el-option label="10x" :value="10" />
            <el-option label="20x" :value="20" />
          </el-select>
        </div>
        <div class="time-slider">
          <span>{{ formatTime(currentTime) }} / {{ formatTime(maxTime) }}</span>
          <div class="slider-wrapper">
            <el-slider v-model="currentTime" :max="maxTime" :format-tooltip="formatTime" @input="onSliderChange" />
            <div
              v-if="matchStartTime > 0"
              class="start-marker"
              :style="{ left: (matchStartTime / maxTime * 100) + '%' }"
              title="登机时刻"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div class="replay-content">
      <div class="map-wrapper">
        <div id="map" class="map-container"></div>
        <div class="zoom-control" v-if="mapInstance">
          <el-icon class="zoom-icon" @click="changeZoom(0.5)"><Plus /></el-icon>
          <el-slider
            v-model="currentZoom"
            vertical
            height="120px"
            :min="minZoom"
            :max="4"
            :step="0.01"
            :show-tooltip="false"
            @input="onZoomSliderChange"
          />
          <el-icon class="zoom-icon" @click="changeZoom(-0.5)"><Minus /></el-icon>
        </div>
      </div>

      <div class="sidebar">
        <!-- 装备悬浮窗 (全局单例，避免被 scrollbar 裁剪) -->
        <div v-if="hoveredPlayer && playersState[hoveredPlayer]"
             class="equipment-popup"
             :style="{ top: hoveredPlayerTop + 'px' }">
          <div class="equip-section gear">
            <div class="equip-slot" :title="itemNames[playersState[hoveredPlayer].items.helmet]">
              <img v-if="playersState[hoveredPlayer].items.helmet" :src="getItemImagePath(playersState[hoveredPlayer].items.helmet)" />
              <div v-else class="empty-slot">头</div>
            </div>
            <div class="equip-slot" :title="itemNames[playersState[hoveredPlayer].items.vest]">
              <img v-if="playersState[hoveredPlayer].items.vest" :src="getItemImagePath(playersState[hoveredPlayer].items.vest)" />
              <div v-else class="empty-slot">甲</div>
            </div>
            <div class="equip-slot" :title="itemNames[playersState[hoveredPlayer].items.backpack]">
              <img v-if="playersState[hoveredPlayer].items.backpack" :src="getItemImagePath(playersState[hoveredPlayer].items.backpack)" />
              <div v-else class="empty-slot">包</div>
            </div>
          </div>
          <div class="equip-section weapons">
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon1]">
              <img v-if="playersState[hoveredPlayer].items.weapon1" :src="getItemImagePath(playersState[hoveredPlayer].items.weapon1)" />
              <div v-else class="empty-slot">1</div>
            </div>
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon2]">
              <img v-if="playersState[hoveredPlayer].items.weapon2" :src="getItemImagePath(playersState[hoveredPlayer].items.weapon2)" />
              <div v-else class="empty-slot">2</div>
            </div>
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon3]">
              <img v-if="playersState[hoveredPlayer].items.weapon3" :src="getItemImagePath(playersState[hoveredPlayer].items.weapon3)" />
              <div v-else class="empty-slot">3</div>
            </div>
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon4]">
              <img v-if="playersState[hoveredPlayer].items.weapon4" :src="getItemImagePath(playersState[hoveredPlayer].items.weapon4)" />
              <div v-else class="empty-slot">4</div>
            </div>
          </div>
        </div>

        <div class="player-list">
          <div class="section-title">玩家与战绩统计 ({{ alivePlayers.length }} 存活)</div>
          <el-scrollbar height="100%">
            <div v-for="(team, teamId) in groupedPlayers" :key="teamId" :id="`team-${teamId}`" class="team-group">
              <div class="team-header">
                <span class="team-id">小队 {{ teamId }}</span>
                <span class="team-status" :class="{ 'all-dead': team.every(p => !p.isAlive) }">
                  {{ team.filter(p => p.isAlive).length }}/{{ team.length }} 存活
                </span>
              </div>
              <div
                v-for="player in team"
                :key="player.name"
                :id="`player-${player.name}`"
                class="player-item"
                :class="{ 'is-dead': !player.isAlive, 'is-focused': focusedPlayer === player.name }"
                @click="focusPlayer(player.name)"
                @mouseenter="handleMouseEnter($event, player.name)"
                @mouseleave="handleMouseLeave"
              >
                <div class="player-main">
                  <div class="player-color" :style="{ backgroundColor: getPlayerColor(player) }"></div>
                  <div class="player-name">{{ player.name }}</div>
                  <el-icon class="search-icon" @click.stop="goToPlayer(player.name)" title="在新标签页查看战绩"><ArrowLeft style="transform: rotate(180deg)" v-if="false" /><Aim v-if="false" /><Plus v-if="false" /><Search /></el-icon>
                  <div class="player-hp" v-if="player.isAlive">
                    <el-progress :percentage="player.hp" :show-text="false" :stroke-width="4" />
                  </div>
                </div>
                <div class="player-stats-mini">
                  <span title="击杀"><el-icon><Aim /></el-icon> {{ player.kills }}</span>
                  <span title="击倒"><el-icon><Warning /></el-icon> {{ player.dbnos }}</span>
                  <span title="救援"><el-icon><FirstAidKit /></el-icon> {{ player.revives }}</span>
                  <span title="伤害"><el-icon><Lightning /></el-icon> {{ Math.floor(player.damage) }}</span>
                </div>
              </div>
            </div>
          </el-scrollbar>
        </div>

        <div class="kill-feed">
          <div class="section-title">战况播报 (点击定位)</div>
          <el-scrollbar height="150px">
            <div
              v-for="(kill, index) in killFeed"
              :key="index"
              class="kill-item"
              :class="{ 'is-groggy': kill.isGroggy, 'is-revive': kill.isRevive, 'is-respawn': kill.isRespawn }"
              @click="seekToKill(kill.time)"
            >
              <span class="time">[{{ getRelativeTime(kill.time) }}]</span>
              <span class="killer">{{ kill.killer }}</span>
              <span class="action">{{ kill.action }}</span>
              <span class="victim">{{ kill.victim }}</span>
            </div>
          </el-scrollbar>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMatchTelemetry, getMatchDetails } from '../api/player'
import { ArrowLeft, VideoPlay, VideoPause, Aim, Warning, FirstAidKit, Lightning, Plus, Minus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const route = useRoute()
const router = useRouter()
const matchId = route.params.id as string

const loading = ref(true)
const match = ref<any>(null)
const telemetry = ref<any[]>([])
const itemNames = ref<Record<string, string>>({}) // itemId.json 映射
let eventTimestamps: number[] = [] // 预计算的时间戳
let lastProcessedTime = -1 // 上一次处理到的相对时间

// 播放控制
const isPlaying = ref(false)
const currentTime = ref(0)
const maxTime = ref(0)
const playSpeed = ref(5)
let playbackTimer: any = null

// Leaflet 实例
let mapInstance: L.Map | null = null
const currentZoom = ref(0)
const minZoom = ref(-2)
let playerMarkers: Record<string, L.CircleMarker> = {}
let focusedViewLayer: L.Polygon | null = null // 仅保留聚焦玩家的锥形视角
let playerFiringEffects: Record<string, L.Marker> = {}
let blueZoneLayer: L.Polygon | null = null
let safeZoneLayer: L.Circle | null = null
let redZoneLayer: L.Circle | null = null
let airdropMarkers: Record<string, L.Marker> = {}
let flightPathLayer: L.Polyline | null = null

// 地图数据状态
const playersState = ref<Record<string, any>>({})
const killFeed = ref<any[]>([])
const zones = ref({
  safeZone: { x: 0, y: 0, radius: 0 },
  blueZone: { x: 0, y: 0, radius: 0 },
  redZone: { x: 0, y: 0, radius: 0 }
})
const airdrops = ref<any[]>([])
const flightPath = ref<any[]>([]) // [{x, y}]
const matchStartTime = ref(0) // 登机时间点（相对秒数）

const MAP_SIZES: Record<string, number> = {
  'Erangel_Main': 8192,
  'Baltic_Main': 8192,
  'Desert_Main': 8192,
  'Savage_Main': 4096,
  'DihorOtok_Main': 8192,
  'Chimera_Main': 3072,     // 帕拉莫 Paramo (3x3km)
  'Summerland_Main': 2048,  // 卡拉金 Karakin (2x2km)
  'Heaven_Main': 1024,      // 褐湾 Haven (1x1km)
  'Tiger_Main': 8192,
  'Kiki_Main': 8192,
  'Neon_Main': 8192,
}

const PUB_MAP_NAME_MAPPING: Record<string, string> = {
  'Baltic_Main': 'erangel',
  'Erangel_Main': 'erangel',
  'Desert_Main': 'miramar',
  'Savage_Main': 'sanhok',
  'DihorOtok_Main': 'vikendi',
  'Chimera_Main': 'paramo',
  'Summerland_Main': 'karakin',
  'Heaven_Main': 'haven',
  'Tiger_Main': 'taego',
  'Kiki_Main': 'deston',
  'Neon_Main': 'rondo',
}

// 坐标转换：PUBG 原始坐标 -> Leaflet 坐标
// PUBG 坐标通常是 0-816000，但瓦片系统基于地图像素
const pubgToLeaflet = (val: number, mapSize: number) => {
  // PUBG 官方坐标通常缩放比例 (816000 -> 8192px)
  return (val / 100)
}

const initMap = () => {
  if (!match.value) return

  const mapName = match.value.mapName
  if (!mapName) {
    console.error('Map name is missing from match details', match.value)
    ElMessage.error('无法确定地图名称')
    return
  }

  const mapSize = MAP_SIZES[mapName] || 8192

  // 1. 设置边界 (PUBG 坐标系：左上 [0,0], 右下 [-mapSize, mapSize])
  const bounds: L.LatLngBoundsExpression = [[0, 0], [-mapSize, mapSize]]

  // 2. 创建地图实例
  mapInstance = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2, // 初始值，后面会根据 fitBounds 自动调整
    maxZoom: 4,
    zoomControl: false,
    attributionControl: false,
    maxBounds: bounds, // 关键：限制拖拽范围
    maxBoundsViscosity: 1.0 // 关键：边界粘性，防止露出黑边
  })

  // 3. 添加本地图片图层
  L.imageOverlay(`/maps/${mapName}.jpg`, bounds).addTo(mapInstance)

  // 4. 自动缩放并固定最小缩放级别，防止缩小后看到黑边
  mapInstance.fitBounds(bounds)
  const calculatedMinZoom = mapInstance.getBoundsZoom(bounds)

  mapInstance.setMinZoom(calculatedMinZoom)
  minZoom.value = calculatedMinZoom
  currentZoom.value = calculatedMinZoom

  // 监听地图缩放事件，同步进度条
  mapInstance.on('zoomend', () => {
    if (mapInstance) {
      currentZoom.value = mapInstance.getZoom()
    }
  })

  // 5. 初始化区域图层
  safeZoneLayer = L.circle([0, 0], { radius: 0, color: 'white', weight: 1, fill: false }).addTo(mapInstance)
  blueZoneLayer = L.polygon([], { color: '#409eff', weight: 0, fillColor: '#409eff', fillOpacity: 0.3, fillRule: 'evenodd' }).addTo(mapInstance)
  redZoneLayer = L.circle([0, 0], { radius: 0, color: '#f56c6c', weight: 1, fillColor: '#f56c6c', fillOpacity: 0.3 }).addTo(mapInstance)

  // 6. 渲染航线
  if (flightPath.value.length >= 2) {
    const points = flightPath.value.map(p => [-(p.y / 100), p.x / 100] as L.LatLngExpression)
    flightPathLayer = L.polyline(points, { color: 'white', weight: 2, dashArray: '10, 10', opacity: 0.5 }).addTo(mapInstance)
  }
}

const updateMarkers = () => {
  if (!mapInstance) return

  Object.values(playersState.value).forEach(p => {
    const lat = -(p.y / 100)
    const lng = p.x / 100

    if (!p.isAlive) {
      const marker = playerMarkers[p.name]
      if (marker) {
        mapInstance?.removeLayer(marker)
        delete playerMarkers[p.name]
      }
      const fireMarker = playerFiringEffects[p.name]
      if (fireMarker) {
        mapInstance?.removeLayer(fireMarker)
        delete playerFiringEffects[p.name]
      }
      return
    }

    if (!playerMarkers[p.name]) {
      const marker = L.circleMarker([lat, lng], {
        radius: 4,
        fillColor: getPlayerColor(p),
        color: p.name === focusedPlayer.value ? '#fff' : '#000',
        weight: p.name === focusedPlayer.value ? 2 : 1,
        fillOpacity: 1
      }).addTo(mapInstance!)

      marker.bindTooltip(p.name, {
        permanent: p.name === focusedPlayer.value,
        direction: 'top',
        className: 'player-tooltip',
        offset: [0, -5]
      })

      playerMarkers[p.name] = marker
    } else {
      const marker = playerMarkers[p.name]
      if (marker) {
        marker.setLatLng([lat, lng])
        // 动态更新标记样式和颜色
        marker.setStyle({
          fillColor: getPlayerColor(p),
          color: p.name === focusedPlayer.value ? '#fff' : '#000',
          weight: p.name === focusedPlayer.value ? 2 : 1
        })

        // 动态更新 Tooltip 状态
        const isFocused = p.name === focusedPlayer.value
        const isHovered = p.name === hoveredPlayer.value
        const shouldShowName = isFocused || isHovered
        const tooltip = marker.getTooltip()

        if (tooltip) {
          if (shouldShowName && !tooltip.options.permanent) {
             marker.unbindTooltip()
             marker.bindTooltip(p.name, { permanent: true, direction: 'top', className: 'player-tooltip', offset: [0, -5] })
          } else if (!shouldShowName && tooltip.options.permanent) {
             marker.unbindTooltip()
             marker.bindTooltip(p.name, { permanent: false, direction: 'top', className: 'player-tooltip', offset: [0, -5] })
          }
        }
      }
    }

    // 更新视角 (仅针对聚焦玩家，渲染更明显的扇形 FOV)
    if (p.name === focusedPlayer.value && p.isAlive) {
      const fov = 45 // 视角张角
      const length = 60 // 视角长度显著增加
      const yaw = p.yaw - 90

      // 生成扇形的点（包含圆心和圆弧上的多个点）
      const points: [number, number][] = [[lat, lng]]
      const step = 5 // 每 5 度一个点，使弧线更平滑

      for (let i = -fov / 2; i <= fov / 2; i += step) {
        const rad = (yaw + i) * Math.PI / 180
        points.push([
          lat + Math.sin(rad) * length,
          lng + Math.cos(rad) * length
        ])
      }

      if (!focusedViewLayer) {
        focusedViewLayer = L.polygon(points, {
          color: '#ff4d4f',
          weight: 1,
          opacity: 0.6,
          fillColor: '#ff4d4f',
          fillOpacity: 0.3
        }).addTo(mapInstance!)
      } else {
        focusedViewLayer.setLatLngs(points)
      }
    } else if (p.name === focusedPlayer.value && !p.isAlive && focusedViewLayer) {
       mapInstance?.removeLayer(focusedViewLayer)
       focusedViewLayer = null
    }

    // 更新开火效果
    const startTime = telemetry.value.length > 0 ? new Date(telemetry.value[0]._D).getTime() : 0
    const attackElapsed = (p.lastAttackTime - startTime) / 1000
    const isFiring = currentTime.value > attackElapsed && currentTime.value < attackElapsed + 0.15

    if (isFiring) {
      const existingFire = playerFiringEffects[p.name]
      if (!existingFire) {
        const fireIcon = L.divIcon({
          html: '<div class="firing-animation"></div>',
          className: 'custom-div-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
        playerFiringEffects[p.name] = L.marker([lat, lng], { icon: fireIcon }).addTo(mapInstance!)
      } else {
        existingFire.setLatLng([lat, lng])
      }
    } else {
      const existingFire = playerFiringEffects[p.name]
      if (existingFire) {
        mapInstance?.removeLayer(existingFire)
        delete playerFiringEffects[p.name]
      }
    }
  })

  // 如果有聚焦的玩家，更新地图视角跟随
  if (focusedPlayer.value && playersState.value[focusedPlayer.value]) {
    const p = playersState.value[focusedPlayer.value]
    if (p.isAlive && mapInstance) {
      mapInstance.panTo([-(p.y / 100), p.x / 100], { animate: true, duration: 0.1 })
    }
  }

  // 更新圈
  if (zones.value.safeZone.radius > 0 && safeZoneLayer) {
    safeZoneLayer.setLatLng([-(zones.value.safeZone.y / 100), zones.value.safeZone.x / 100])
    safeZoneLayer.setRadius(zones.value.safeZone.radius / 100)
  }

  // 轰炸区
  if (zones.value.redZone.radius > 0 && redZoneLayer) {
    redZoneLayer.setLatLng([-(zones.value.redZone.y / 100), zones.value.redZone.x / 100])
    redZoneLayer.setRadius(zones.value.redZone.radius / 100)
  } else if (redZoneLayer) {
    redZoneLayer.setRadius(0)
  }

  // 蓝色毒圈遮罩 (使用 Polygon 环绕地图边界 + 内部圆形孔洞)
  if (zones.value.blueZone.radius > 0 && blueZoneLayer && mapInstance) {
    const mapName = match.value?.mapName
    const mapSize = MAP_SIZES[mapName] || 8192

    // 地图四个角
    const outerRing: [number, number][] = [
        [1000, -1000],
        [1000, mapSize + 1000],
        [-(mapSize + 1000), mapSize + 1000],
        [-(mapSize + 1000), -1000]
    ]

    // 生成圆形的点
    const innerRing: [number, number][] = []
    const centerLat = -(zones.value.blueZone.y / 100)
    const centerLng = zones.value.blueZone.x / 100
    const radius = zones.value.blueZone.radius / 100

    for (let i = 0; i <= 64; i++) {
        const angle = (i / 64) * 2 * Math.PI
        innerRing.push([
            centerLat + radius * Math.sin(angle),
            centerLng + radius * Math.cos(angle)
        ])
    }

    blueZoneLayer.setLatLngs([outerRing, innerRing])
  } else if (blueZoneLayer) {
      blueZoneLayer.setLatLngs([])
  }

  // 更新空投渲染
  const currentAirdropIds = new Set(airdrops.value.map(a => a.id))

  // 清理不存在的空投
  Object.keys(airdropMarkers).forEach(id => {
    if (!currentAirdropIds.has(id)) {
      const marker = airdropMarkers[id]
      if (marker) mapInstance?.removeLayer(marker)
      delete airdropMarkers[id]
    }
  })

  // 添加或移动空投
  airdrops.value.forEach(ad => {
    const lat = -(ad.y / 100)
    const lng = ad.x / 100

    const existingMarker = airdropMarkers[ad.id]
    if (!existingMarker) {
      const airdropIcon = L.divIcon({
        html: `<div class="airdrop-icon ${ad.isLanded ? 'landed' : 'dropping'}">📦</div>`,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
      airdropMarkers[ad.id] = L.marker([lat, lng], { icon: airdropIcon }).addTo(mapInstance!)
    } else {
      existingMarker.setLatLng([lat, lng])
    }
  })
}

const focusedPlayer = ref<string | null>(null)
const hoveredPlayer = ref<string | null>(null)
const hoveredPlayerTop = ref(0)

const handleMouseEnter = (event: MouseEvent, name: string) => {
  hoveredPlayer.value = name
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  // 计算悬浮窗相对于视口的位置，并稍微向上偏移一点使其居中对齐行
  hoveredPlayerTop.value = Math.max(10, rect.top - 20)
}

const handleMouseLeave = () => {
  hoveredPlayer.value = null
}

// 模拟玩家颜色
const playerColors: Record<string, string> = {}
const getPlayerColor = (player: any): string => {
  if (!focusedPlayer.value || !playersState.value[focusedPlayer.value]) {
    return '#ffffff'
  }

  const focusedPlayerObj = playersState.value[focusedPlayer.value]
  const focusedTeamId = focusedPlayerObj.teamId

  // 如果玩家没有 teamId 或者与聚焦玩家不是同一队，显示为白色
  // 排除无效的 teamId (如 0 或未定义) 导致的错误聚合
  if (!focusedTeamId || focusedTeamId <= 0 || player.teamId !== focusedTeamId) {
    return '#ffffff'
  }

  // 为聚焦小队的成员分配颜色 (黄/橙/蓝/绿)
  const teamMembers = Object.values(playersState.value)
    .filter(p => p.teamId === focusedTeamId)
    .sort((a, b) => a.name.localeCompare(b.name))

  const memberIndex = teamMembers.findIndex(m => m.name === player.name)
  const teamColors = ['#feca57', '#ff9f43', '#54a0ff', '#1dd1a1']
  return teamColors[memberIndex % teamColors.length] || '#ffffff'
}

const alivePlayers = computed(() => {
  return Object.values(playersState.value).filter(p => p.isAlive)
})

const groupedPlayers = computed(() => {
  // 显式读取所有玩家的 isAlive 状态，建立响应式依赖，确保复活后小队统计实时更新
  Object.values(playersState.value).forEach(p => {
    void p.isAlive // 建立响应式追踪
  })
  
  const groups: Record<number, any[]> = {}
  Object.values(playersState.value).forEach(p => {
    const teamId = p.teamId || 0
    if (!groups[teamId]) groups[teamId] = []
    groups[teamId].push(p)
  })

  // 手动排序并构造对象，兼容旧版 TS 配置
  const sortedEntries = Object.entries(groups).sort((a, b) => Number(a[0]) - Number(b[0]))
  const result: Record<string, any[]> = {}
  sortedEntries.forEach(([key, val]) => {
    result[key] = val
  })
  return result
})

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const getRelativeTime = (eventTime: number) => {
  const startTime = eventTimestamps[0] || 0
  return formatTime(Math.max(0, (eventTime - startTime) / 1000))
}

const WEAPON_CATEGORIES: Record<string, string> = {
  // Handguns
  'Item_Weapon_Sawnoff_C': 'handgun',
  'Item_Weapon_G18_C': 'handgun',
  'Item_Weapon_M9_C': 'handgun',
  'Item_Weapon_NagantM1895_C': 'handgun',
  'Item_Weapon_DEagle_C': 'handgun',
  'Item_Weapon_M1911_C': 'handgun',
  'Item_Weapon_vz61Skorpion_C': 'handgun',
  'Item_Weapon_Rhino_C': 'handgun',
  // Melee
  'Item_Weapon_Cowbar_C': 'melee',
  'Item_Weapon_Pan_C': 'melee',
  'Item_Weapon_Machete_C': 'melee',
  'Item_Weapon_Sickle_C': 'melee',
  // Throwable
  'Item_Weapon_Grenade_C': 'throwable',
  'Item_Weapon_Molotov_C': 'throwable',
  'Item_Weapon_FlashBang_C': 'throwable',
  'Item_Weapon_DecoyGrenade_C': 'throwable',
  'Item_Weapon_SmokeBomb_C': 'throwable',
  'Item_Weapon_StickyGrenade_C': 'throwable',
  'Item_Weapon_C4_C': 'throwable',
}

const getItemImagePath = (itemId: string) => {
  if (!itemId) return ''

  // 规范化装备 ID（例如 Item_Head_E_01_Lv1_C -> Item_Head_E_00_Lv1_C）
  // 许多素材文件以 00 命名
  const normalizedId = itemId.replace(/_0[1-9]_/, '_00_')

  if (normalizedId.startsWith('Item_Head')) return `/assets/item/Equipment/Headgear/${normalizedId}.png`
  if (normalizedId.startsWith('Item_Armor')) return `/assets/item/Equipment/Vest/${normalizedId}.png`
  if (normalizedId.startsWith('Item_Back')) return `/assets/item/Equipment/Backpack/${normalizedId}.png`

  if (normalizedId.startsWith('Item_Weapon')) {
    const cat = WEAPON_CATEGORIES[normalizedId] || 'main'
    const folder = cat.charAt(0).toUpperCase() + cat.slice(1)
    return `/assets/item/Weapon/${folder}/${normalizedId}.png`
  }

  return ''
}

const fetchData = async () => {
  try {
    loading.value = true
    const [matchData, telemetryData, itemsData] = await Promise.all([
      getMatchDetails(matchId),
      getMatchTelemetry(matchId),
      fetch('/assets/itemId.json').then(res => res.json())
    ])
    match.value = matchData
    telemetry.value = telemetryData
    itemNames.value = itemsData

    if (telemetry.value.length > 0) {
      // 预计算所有事件的时间戳，避免在循环中重复解析日期字符串
      const startTime = new Date(telemetry.value[0]._D).getTime()
      eventTimestamps = telemetry.value.map(e => new Date(e._D).getTime())

      const endTime = eventTimestamps[eventTimestamps.length - 1] || startTime
      maxTime.value = (endTime - startTime) / 1000

      // 寻找正式登机/比赛开始时间点
      const startEvent = telemetry.value.find(e => e._T === 'LogMatchStart')
      if (startEvent) {
        matchStartTime.value = (new Date(startEvent._D).getTime() - startTime) / 1000
      }

      // 提取航线（延长至贯穿全图）
      const planePoints: any[] = []
      telemetry.value.forEach(e => {
        if (e._T === 'LogPlayerPosition' && e.character.location.z > 10000) {
             planePoints.push({ x: e.character.location.x, y: e.character.location.y })
        }
      })

      if (planePoints.length > 5) {
        const start = planePoints[0]
        const end = planePoints[planePoints.length - 1]
        const dx = end.x - start.x
        const dy = end.y - start.y
        const mag = Math.sqrt(dx*dx + dy*dy)

        if (mag > 0) {
          // 计算飞行向量，并将航线延长到足够远（200万单位），确保贯穿地图
          const extendDist = 2000000
          const ux = dx / mag
          const uy = dy / mag

          flightPath.value = [
            { x: start.x - ux * extendDist, y: start.y - uy * extendDist },
            { x: start.x + ux * extendDist, y: start.y + uy * extendDist }
          ]
        }
      }
    }

    initMap()
    initPlayers()

    // 仅侧边栏高亮并自动滚动定位，不操作地图视角
    const targetPlayer = route.query.player as string
    if (targetPlayer && playersState.value[targetPlayer]) {
      focusedPlayer.value = targetPlayer
      scrollToPlayer(targetPlayer)
    }

    loading.value = false
    isPlaying.value = true // 数据加载完成后自动开始播放
    playbackLoop()
  } catch (err) {
    console.error(err)
    ElMessage.error('获取遥测数据失败')
    loading.value = false
  }
}

const initPlayers = () => {
  const newPlayers: Record<string, any> = {}
  telemetry.value.forEach(event => {
    if (event._T === 'LogPlayerPosition') {
      const name = event.character.name
      const accountId = event.character.accountId

      // 过滤掉没有 AccountID 或 AccountID 为空的占位符玩家 (通常是游戏机制生成的 Phantom 玩家)
      if (!accountId || accountId === "" || accountId.startsWith('ai.')) {
        return
      }

      if (!newPlayers[name]) {
        newPlayers[name] = {
          name,
          x: event.character.location.x,
          y: event.character.location.y,
          hp: event.character.health,
          isAlive: true,
          teamId: event.character.teamId,
          kills: 0,
          dbnos: 0,
          revives: 0,
          damage: 0,
          yaw: 0,
          lastAttackTime: 0,
          items: {
            helmet: '',
            vest: '',
            backpack: '',
            weapon1: '',
            weapon2: '',
            weapon3: '',
            weapon4: ''
          }
        }
      }
    }
  })
  playersState.value = newPlayers
}

const updateState = (time: number) => {
  if (telemetry.value.length === 0 || eventTimestamps.length === 0) return

  const startTime = eventTimestamps[0] || 0
  const targetTime = startTime + time * 1000

  // 性能优化：如果时间是向后跳跃（拖动进度条），则需要全量重置状态
  // 如果是正常向前播放，则只需处理增量事件
  const isForward = time >= lastProcessedTime && lastProcessedTime !== -1

  if (!isForward) {
    // 全量重置
    Object.values(playersState.value).forEach(p => {
      p.isAlive = true
      p.kills = 0
      p.dbnos = 0
      p.revives = 0
      p.damage = 0
      p.lastAttackTime = 0
      p.items = {
        helmet: '',
        vest: '',
        backpack: '',
        weapon1: '',
        weapon2: '',
        weapon3: '',
        weapon4: ''
      }
    })
    killFeed.value = []
    airdrops.value = []
  }

  // 遍历事件
  for (let i = 0; i < telemetry.value.length; i++) {
    const eventTime = eventTimestamps[i]
    if (eventTime === undefined) continue

    // 如果是向前增量更新，跳过已经处理过的事件
    if (isForward && eventTime <= startTime + lastProcessedTime * 1000) continue

    // 如果超过目标时间，停止处理
    if (eventTime > targetTime) break

    const event = telemetry.value[i]
    switch (event._T) {
      case 'LogPlayerPosition':
        if (playersState.value[event.character.name]) {
          const p = playersState.value[event.character.name]
          p.x = event.character.location.x
          p.y = event.character.location.y
          p.hp = event.character.health
          
          // 逻辑修正：区分“复活”与“扶起”
          // 如果玩家之前是死亡状态，且现在出现在高空（飞机上 z > 10000），判定为蓝卡复活回归
          if (!p.isAlive && event.character.location.z > 10000) {
            p.isAlive = true
            killFeed.value.unshift({
              killer: p.name,
              victim: '',
              action: '重新进入了战场',
              isGroggy: false,
              isRevive: false,
              isRespawn: true,
              time: eventTime
            })
          } else if (!p.isAlive && p.hp > 0) {
            // 兜底：如果血量恢复但不在飞机上，说明是错过了扶起事件
            p.isAlive = true
          }
          
          if (event.character.location.z < 2000 && event.character.orientation) {
             p.yaw = event.character.orientation.yaw || 0
          }
        }
        break
      case 'LogPlayerAttack':
        if (event.attacker && playersState.value[event.attacker.name]) {
          playersState.value[event.attacker.name].lastAttackTime = eventTime
        }
        break
      case 'LogCarePackageSpawn':
        airdrops.value.push({
          id: event.itemPackage.itemPackageId,
          x: event.itemPackage.location.x,
          y: event.itemPackage.location.y,
          isLanded: false
        })
        break
      case 'LogCarePackageLand':
        const ad = airdrops.value.find(a => a.id === event.itemPackage.itemPackageId)
        if (ad) {
          ad.isLanded = true
          ad.x = event.itemPackage.location.x
          ad.y = event.itemPackage.location.y
        }
        break
      case 'LogPlayerTakeDamage':
        if (event.attacker && playersState.value[event.attacker.name]) {
          playersState.value[event.attacker.name].damage += event.damage
        }
        break
      case 'LogPlayerMakeGroggy':
        if (event.attacker && playersState.value[event.attacker.name]) {
          playersState.value[event.attacker.name].dbnos++
        }
        if (event.victim && playersState.value[event.victim.name]) {
          killFeed.value.unshift({
            killer: event.attacker ? event.attacker.name : 'Unknown',
            victim: event.victim.name,
            action: '击倒了',
            isGroggy: true,
            time: eventTime
          })
        }
        break
      case 'LogPlayerRevive':
        if (event.reviver && playersState.value[event.reviver.name]) {
          playersState.value[event.reviver.name].revives++
        }
        if (event.victim && playersState.value[event.victim.name]) {
          const v = playersState.value[event.victim.name]
          v.isAlive = true
          v.hp = event.victim.health || 20 // 扶起后通常有少量血量
          killFeed.value.unshift({
            killer: event.reviver ? event.reviver.name : 'Unknown',
            victim: event.victim.name,
            action: '扶起了',
            isGroggy: false,
            isRevive: true,
            time: eventTime
          })
        }
        break
      case 'LogPlayerKillV2':
        if (event.killer && playersState.value[event.killer.name]) {
          playersState.value[event.killer.name].kills++
        }
        if (event.victim && playersState.value[event.victim.name]) {
          playersState.value[event.victim.name].isAlive = false
          playersState.value[event.victim.name].hp = 0
          killFeed.value.unshift({
            killer: event.killer ? event.killer.name : 'Suicide',
            victim: event.victim.name,
            action: '淘汰了',
            isGroggy: false,
            time: eventTime
          })
        }
        break
      case 'LogGameStatePeriodic':
        if (event.gameState) {
            zones.value.safeZone = {
                x: event.gameState.safetyZonePosition.x,
                y: event.gameState.safetyZonePosition.y,
                radius: event.gameState.safetyZoneRadius
            }
            zones.value.blueZone = {
                x: event.gameState.poisonGasWarningPosition.x,
                y: event.gameState.poisonGasWarningPosition.y,
                radius: event.gameState.poisonGasWarningRadius
            }
        }
        break
      case 'LogRedZoneSpawn':
        zones.value.redZone = {
            x: event.location.x,
            y: event.location.y,
            radius: event.radius
        }
        break
      case 'LogItemDrop':
      case 'LogItemPickup': // 拾取作为备选，仅针对护具
      case 'LogItemEquip': {
        const char = event.character || event.attacker || event.victim
        if (!char || !char.name) break

        const p = playersState.value[char.name]
        if (!p) break

        const itemId = event.item?.itemId
        if (!itemId) break

        if (event._T === 'LogItemDrop') {
          if (p.items.helmet === itemId) p.items.helmet = ''
          else if (p.items.vest === itemId) p.items.vest = ''
          else if (p.items.backpack === itemId) p.items.backpack = ''
          else if (p.items.weapon1 === itemId) p.items.weapon1 = ''
          else if (p.items.weapon2 === itemId) p.items.weapon2 = ''
          else if (p.items.weapon3 === itemId) p.items.weapon3 = ''
          else if (p.items.weapon4 === itemId) p.items.weapon4 = ''
          break
        }

        if (itemId.startsWith('Item_Head')) p.items.helmet = itemId
        else if (itemId.startsWith('Item_Armor')) p.items.vest = itemId
        else if (itemId.startsWith('Item_Back')) p.items.backpack = itemId
        else if (itemId.startsWith('Item_Weapon')) {
          const cat = WEAPON_CATEGORIES[itemId] || 'main'
          if (cat === 'handgun') p.items.weapon3 = itemId
          else if (cat === 'melee' || cat === 'throwable') p.items.weapon4 = itemId
          else {
            if (p.items.weapon1 === itemId || p.items.weapon2 === itemId) break
            if (!p.items.weapon1) p.items.weapon1 = itemId
            else p.items.weapon2 = itemId
          }
        }
        break
      }
      case 'LogItemUnequip': {
        const p = playersState.value[event.character?.name]
        if (!p) break
        const itemId = event.item?.itemId
        if (!itemId) break

        if (p.items.helmet === itemId) p.items.helmet = ''
        else if (p.items.vest === itemId) p.items.vest = ''
        else if (p.items.backpack === itemId) p.items.backpack = ''
        else if (p.items.weapon1 === itemId) p.items.weapon1 = ''
        else if (p.items.weapon2 === itemId) p.items.weapon2 = ''
        else if (p.items.weapon3 === itemId) p.items.weapon3 = ''
        else if (p.items.weapon4 === itemId) p.items.weapon4 = ''
        break
      }
    }
  }
  lastProcessedTime = time
}

const playbackLoop = () => {
  if (isPlaying.value) {
    currentTime.value += (1 / 60) * playSpeed.value
    if (currentTime.value >= maxTime.value) {
      currentTime.value = maxTime.value
      isPlaying.value = false
    }
    updateState(currentTime.value)
    updateMarkers()
  }

  playbackTimer = requestAnimationFrame(playbackLoop)
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const resetPlayback = () => {
  isPlaying.value = false
  currentTime.value = 0
  initPlayers()
}

const onSliderChange = (val: number) => {
  currentTime.value = val
  updateState(val)
}

const seekToKill = (eventTime: number) => {
  if (telemetry.value.length === 0 || eventTimestamps.length === 0) return
  const startTime = eventTimestamps[0] || 0
  // 定位到该次击杀前 1 秒
  const targetRelativeTime = Math.max(0, (eventTime - startTime) / 1000 - 1)
  currentTime.value = targetRelativeTime
  updateState(targetRelativeTime)
  updateMarkers()
}

const onZoomSliderChange = (val: number) => {
  if (mapInstance) {
    mapInstance.setZoom(val)
  }
}

const changeZoom = (delta: number) => {
  if (mapInstance) {
    const newZoom = mapInstance.getZoom() + delta
    mapInstance.setZoom(newZoom)
  }
}

const WEAPON_NAME_DICT: Record<string, string> = {
  'Item_Weapon_AK47_C': 'AKM',
  'Item_Weapon_M16A4_C': 'M16A4',
  'Item_Weapon_SCAR-L_C': 'SCAR-L',
  'Item_Weapon_HK416_C': 'M416',
  'Item_Weapon_AUG_C': 'AUG',
  'Item_Weapon_BerylM762_C': 'Beryl',
  'Item_Weapon_Mk47Mutant_C': 'Mk47',
  'Item_Weapon_Groza_C': 'Groza',
  'Item_Weapon_G36C_C': 'G36C',
  'Item_Weapon_K2_C': 'K2',
  'Item_Weapon_ACE32_C': 'ACE32',
  'Item_Weapon_Kar98k_C': 'Kar98k',
  'Item_Weapon_M24_C': 'M24',
  'Item_Weapon_AWM_C': 'AWM',
  'Item_Weapon_Win1894_C': 'Win94',
  'Item_Weapon_Mosin_C': 'Mosin',
  'Item_Weapon_Mini14_C': 'Mini14',
  'Item_Weapon_SKS_C': 'SKS',
  'Item_Weapon_Mk14_C': 'Mk14',
  'Item_Weapon_QBU88_C': 'QBU',
  'Item_Weapon_SLR_C': 'SLR',
  'Item_Weapon_VSS_C': 'VSS',
  'Item_Weapon_UMP_C': 'UMP45',
  'Item_Weapon_UZI_C': 'Micro UZI',
  'Item_Weapon_Vector_C': 'Vector',
  'Item_Weapon_TommyGun_C': 'Tommy Gun',
  'Item_Weapon_MP5K_C': 'MP5K',
  'Item_Weapon_P90_C': 'P90',
  'Item_Weapon_M249_C': 'M249',
  'Item_Weapon_DP28_C': 'DP-28',
  'Item_Weapon_MG3_C': 'MG3',
  'Item_Weapon_Saiga12_C': 'S12K',
  'Item_Weapon_Berreta686_C': 'S686',
  'Item_Weapon_Winchester12_C': 'S1897',
  'Item_Weapon_DBS_C': 'DBS',
  'Item_Weapon_Pan_C': '平底锅',
  'Item_Weapon_Machete_C': '砍刀',
  'Item_Weapon_Crowbar_C': '物理学圣剑',
  'Item_Weapon_Sickle_C': '镰刀',
  'Item_Weapon_Grenade_C': '手雷',
  'Item_Weapon_Molotov_C': '燃烧瓶',
  'Item_Weapon_BluezoneGrenade_C': '蓝圈手雷',
  'WeapDacia_96_C': '达契亚轿车',
  'WeapUAZ_Armored_C': 'UAZ',
  'WeapMotorbike_600_C': '摩托车',
  'Bluezone': '毒圈',
  'RedZone': '轰炸',
  'Suicide': '自杀',
  'Drown': '溺水',
  'Fall': '坠落'
}

const formatWeaponName = (name: string) => {
  if (!name) return '未知'
  return WEAPON_NAME_DICT[name] || name.replace('Item_Weapon_', '').replace('_C', '')
}

// 交互逻辑
const focusPlayer = (name: string) => {
  focusedPlayer.value = name
  const p = playersState.value[name]
  if (p && mapInstance) {
    // 仅平移中心点，不再自动改变缩放级别，避免模糊
    mapInstance.panTo([-(p.y / 100), p.x / 100], { animate: true })
  }
}

const scrollToPlayer = (name: string) => {
  nextTick(() => {
    const player = playersState.value[name]
    if (player) {
      const el = document.getElementById(`team-${player.teamId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  })
}

const handleEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    router.back()
  }
}

watch([focusedPlayer, hoveredPlayer], () => {
  if (!isPlaying.value) {
    updateMarkers()
  }
})

const goToPlayer = (name: string) => {
  const url = router.resolve(`/player/${name}`).href
  window.open(url, '_blank')
}

onMounted(() => {
  fetchData()
  window.addEventListener('keydown', handleEsc)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEsc)
  if (playbackTimer) cancelAnimationFrame(playbackTimer)
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<style scoped lang="scss">
.replay-container {
  :deep(.firing-animation) {
    width: 100%;
    height: 100%;
    background: radial-gradient(circle, #ffec3d 0%, rgba(255, 236, 61, 0) 70%);
    border-radius: 50%;
    animation: firing-pulse 0.15s ease-out;
  }

  @keyframes firing-pulse {
    0% { transform: scale(0.3); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  :deep(.player-tooltip) {
    background: rgba(0, 0, 0, 0.7);
    border: none;
    color: white;
    font-size: 10px;
    padding: 1px 4px;
    border-radius: 3px;
    box-shadow: none;
    &::before {
      display: none;
    }
  }
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  color: white;
}

.replay-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background-color: #2a2a2a;
  border-bottom: 1px solid #333;
  z-index: 1001;

  .left {
    display: flex;
    align-items: center;
    gap: 15px;
    .title {
      font-weight: bold;
    }
  }

  .controls {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 20px;
    margin-left: 40px;

    .time-slider {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 15px;
      font-size: 13px;
      color: #999;
      .slider-wrapper {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        .el-slider {
          flex: 1;
        }
        .start-marker {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 12px;
          background-color: #f56c6c;
          z-index: 10;
          pointer-events: none;
        }
      }
    }

    .speed-control {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
  }
}

.replay-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.map-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.map-container {
  width: 100%;
  height: 100%;
  background-color: #000;
  cursor: crosshair;
}

.zoom-control {
  position: absolute;
  left: 20px;
  bottom: 80px; // 提高位置，避免显得太靠下
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.75); // 加深一点背景
  padding: 12px 8px;
  border-radius: 20px; // 圆润一点
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);

  .zoom-icon {
    color: #ddd;
    cursor: pointer;
    font-size: 16px;
    transition: color 0.2s;
    &:hover {
      color: #409eff;
    }
  }

  :deep(.el-slider__runway) {
    background-color: rgba(255, 255, 255, 0.15);
    margin: 0 !important;
  }

  :deep(.el-slider__bar) {
    background-color: #409eff;
  }
}

.sidebar {
  width: 300px;
  display: flex;
  flex-direction: column;
  background-color: #222;
  border-left: 1px solid #333;
  z-index: 1000;

  .player-list {
    flex: 1;
    overflow: hidden;
    padding: 30px 15px 10px 15px; // 进一步增加顶部间距
  }

  .kill-feed {
    height: 200px;
    border-top: 1px solid #333;
    padding: 10px;
  }

  .section-title {
    font-size: 14px;
    font-weight: bold;
    color: #409eff;
    margin-bottom: 10px;
  }
}

.player-item {
  display: flex;
  flex-direction: column;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 4px;
  border: 1px solid transparent;

  &:hover {
    background-color: #333;
  }

  &.is-dead {
    opacity: 0.6;
    .player-name {
      color: #f56c6c; // 死亡玩家显示为红色
    }
  }

  &.is-focused {
    background-color: rgba(64, 158, 255, 0.1);
    border-color: #409eff;
  }

  .player-main {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .player-color {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .player-name {
    flex: 1;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .search-icon {
    font-size: 14px;
    color: #888;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
    &:hover {
      color: #409eff;
      background-color: rgba(64, 158, 255, 0.1);
    }
  }

  .player-hp {
    width: 40px;
  }

  .player-stats-mini {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: #888;
    padding-left: 18px;

    span {
      display: flex;
      align-items: center;
      gap: 3px;

      .el-icon {
        font-size: 12px;
      }
    }
  }
}

.equipment-popup {
  position: fixed; // 关键：使用 fixed 避免被父容器 overflow: hidden 裁剪
  right: 310px;    // 侧边栏宽度 300px + 10px 间距
  width: 160px;
  background-color: rgba(30, 30, 30, 0.95);
  border: 1px solid #444;
  border-radius: 6px;
  padding: 10px;
  z-index: 2500;   // 确保高于地图和侧边栏
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  transition: top 0.1s ease-out;

  .equip-section {
    display: flex;
    gap: 6px;
    justify-content: center;

    &.weapons {
      flex-wrap: wrap;
    }
  }

  .equip-slot {
    width: 40px;
    height: 40px;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid #555;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .empty-slot {
      font-size: 10px;
      color: #555;
    }

    &.weapon {
      width: 65px;
      height: 35px;
    }
  }
}

.team-group {
  margin-bottom: 15px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  padding: 5px;

  .team-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 8px;
    margin-bottom: 5px;
    background-color: rgba(64, 158, 255, 0.1);
    border-radius: 4px;
    font-size: 12px;

    .team-id {
      color: #409eff;
      font-weight: bold;
    }

    .team-status {
      color: #67c23a;
      &.all-dead {
        color: #909399;
      }
    }
  }
}

.kill-item {
  font-size: 12px;
  margin-bottom: 5px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(64, 158, 255, 0.15);
  }

  .time {
    color: #666;
    margin-right: 8px;
    font-family: monospace;
  }

  .killer { color: #67c23a; font-weight: bold; } // 击杀者显示为绿色
  .victim { color: #999; }
  .action { margin: 0 5px; color: #666; }
  &.is-groggy {
    .action { color: #e6a23c; } // 击倒显示为黄色
  }

  &.is-revive {
    .action { color: #67c23a; } // 扶起/复活显示为绿色（正面反馈）
  }

  &.is-respawn {
    .killer { color: #409eff; }
    .action { color: #409eff; font-weight: bold; }
  }
}
</style>
