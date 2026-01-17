<template>
  <div class="replay-container" :class="{ 'is-dialog': isDialog }" v-loading="loading">
    <div class="replay-layout">
      <div class="replay-header">
        <div class="left">
          <el-button v-if="!isDialog" :icon="ArrowLeft" circle @click="$router.back()" />
          <div class="match-info" v-if="match">
            <div class="title-row">
              <div class="title">{{ MAP_NAME_DICT[match.mapName] || match.mapName }} - {{ GAME_MODE_DICT[match.gameMode] || match.gameMode }}</div>
              <el-tooltip content="复制分享链接" placement="top">
                <el-icon class="share-icon" @click="copyShareLink"><Share /></el-icon>
              </el-tooltip>
            </div>
            <div class="detail-stats">
              <span class="stat-item highlight" v-if="currentPlayerStats.rank">
                <el-icon><Aim /></el-icon> 排名: #{{ currentPlayerStats.rank }}
              </span>
              <span class="stat-item highlight" v-if="currentPlayerStats.kills !== undefined">
                <el-icon><Lightning /></el-icon> 击杀: {{ currentPlayerStats.kills }}
              </span>
              <span class="stat-item real-date" v-if="match.createdAt">
                <el-icon><Calendar /></el-icon> {{ match.createdAt }}
              </span>
            </div>
          </div>
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
            <div class="time-display">
              <span class="current">{{ formatTime(currentTime) }}</span>
              <span class="divider">/</span>
              <span class="total">{{ formatTime(maxTime) }}</span>
            </div>
            <div class="slider-wrapper">
              <el-slider v-model="currentTime" :max="maxTime" :format-tooltip="formatTime" @input="onSliderChange" />
              <!-- 起飞标记 -->
              <div
                v-if="matchStartTime > 0"
                class="start-marker"
                :style="{ left: (matchStartTime / maxTime * 100) + '%' }"
                title="登机时刻"
              ></div>
              <!-- 玩家事件标记 -->
              <template v-for="(evt, idx) in playerEvents" :key="idx">
                <el-tooltip :content="evt.label" placement="top">
                  <div 
                    class="event-marker" 
                    :class="evt.type"
                    :style="{ left: (evt.time / maxTime * 100) + '%', backgroundColor: evt.color }"
                  ></div>
                </el-tooltip>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="replay-content">
        <div class="map-wrapper">
          <div id="map" class="map-container"></div>
          
          <!-- 实时存活统计遮罩 -->
          <div class="match-stats-overlay" v-if="!loading">
            <div class="stat-item">
              <span class="label">TEAMS</span>
              <span class="value">{{ aliveTeamsCount }}</span>
            </div>
            <div class="stat-item">
              <span class="label">ALIVE</span>
              <span class="value">{{ alivePlayers.length }}</span>
            </div>
          </div>
          
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
                <img v-if="playersState[hoveredPlayer].items.helmet" 
                     :src="getItemImagePath(playersState[hoveredPlayer].items.helmet)"
                     @error="(e: any) => e.target.style.display='none'" />
                <div class="empty-slot">头</div>
              </div>
              <div class="equip-slot" :title="itemNames[playersState[hoveredPlayer].items.vest]">
                <img v-if="playersState[hoveredPlayer].items.vest" 
                     :src="getItemImagePath(playersState[hoveredPlayer].items.vest)"
                     @error="(e: any) => e.target.style.display='none'" />
                <div class="empty-slot">甲</div>
              </div>
              <div class="equip-slot" :title="itemNames[playersState[hoveredPlayer].items.backpack]">
                <img v-if="playersState[hoveredPlayer].items.backpack" 
                     :src="getItemImagePath(playersState[hoveredPlayer].items.backpack)"
                     @error="(e: any) => e.target.style.display='none'" />
                <div class="empty-slot">包</div>
              </div>
            </div>
            <div class="equip-section weapons">
              <div class="equip-slot weapon" :title="getWeaponTitle(playersState[hoveredPlayer].items.weapon1, hoveredPlayer)">
                <img v-if="playersState[hoveredPlayer].items.weapon1" 
                     :src="getItemImagePath(playersState[hoveredPlayer].items.weapon1)"
                     @error="(e: any) => e.target.style.display='none'" />
                <div class="empty-slot">1</div>
              </div>
              <div class="equip-slot weapon" :title="getWeaponTitle(playersState[hoveredPlayer].items.weapon2, hoveredPlayer)">
                <img v-if="playersState[hoveredPlayer].items.weapon2" 
                     :src="getItemImagePath(playersState[hoveredPlayer].items.weapon2)"
                     @error="(e: any) => e.target.style.display='none'" />
                <div class="empty-slot">2</div>
              </div>
            </div>
            <!-- 新增：武器名称行 -->
            <div class="equip-section weapon-names" v-if="playersState[hoveredPlayer].items.weapon1 || playersState[hoveredPlayer].items.weapon2">
              <div class="weapon-name-tag" v-if="playersState[hoveredPlayer].items.weapon1">
                {{ getWeaponTitle(playersState[hoveredPlayer].items.weapon1, hoveredPlayer) }}
              </div>
              <div class="weapon-name-tag" v-if="playersState[hoveredPlayer].items.weapon2">
                {{ getWeaponTitle(playersState[hoveredPlayer].items.weapon2, hoveredPlayer) }}
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
                    <div class="player-name">
                      {{ player.name }}
                      <span v-if="player.isBot" class="bot-tag">BOT</span>
                    </div>
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
            <el-scrollbar height="100%">
              <div
                v-for="(kill, index) in killFeed"
                :key="index"
                class="kill-item"
                :class="{ 'is-groggy': kill.isGroggy, 'is-revive': kill.isRevive, 'is-respawn': kill.isRespawn }"
                @click="seekToKill(kill.time)"
              >
                <span class="time">[{{ getRelativeTime(kill.time) }}]</span>
                <span class="killer">
                  <span v-if="kill.killerTeamId" class="team-no">#{{ kill.killerTeamId }}</span>
                  {{ kill.killer }}
                </span>
                <span class="action">{{ kill.action }}</span>
                <span class="victim" v-if="kill.victim">
                  <span v-if="kill.victimTeamId" class="team-no">#{{ kill.victimTeamId }}</span>
                  {{ kill.victim }}
                </span>
              </div>
            </el-scrollbar>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMatchTelemetry, getMatchDetails } from '../api/player'
import { ArrowLeft, VideoPlay, VideoPause, Aim, Warning, FirstAidKit, Lightning, Plus, Minus, Search, Timer, Calendar, Share } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MAP_NAME_DICT, GAME_MODE_DICT } from '../utils/constants'

const props = defineProps<{
  id?: string;
  player?: string;
  isDialog?: boolean;
}>()

const route = useRoute()
const router = useRouter()
const matchId = computed(() => {
  if (props.id) return props.id
  if (route.params.id) return route.params.id as string
  return ''
})
const targetPlayer = computed(() => props.player || (route.query.player as string))

const loading = ref(true)
const match = ref<any>(null)
const telemetry = ref<any[]>([])
// 非响应式存储，避免深度代理导致的巨额内存开销
let rawTelemetry: any[] = []
let playerTimelines: Record<string, any[]> = {} 
let airdropData: Record<string, { spawnTime: number, landTime: number, spawnPos: any, landPos: any, items: string[] }> = {}
const itemNames = ref<Record<string, string>>({}) // itemId.json 映射
let eventTimestamps: number[] = [] // 预计算的时间戳
let lastProcessedTime = -1 // 上一次处理到的相对时间
let lastUIUpdateTime = 0 // 侧边栏 UI 节流更新控制

// 播放控制
const isPlaying = ref(false)
const currentTime = ref(0)
const maxTime = ref(0)
const playSpeed = ref(5)
let playbackTimer: any = null
let lastFrameTime = 0
let currentEventIndex = 0 // 核心优化：维护当前处理到的事件索引

// Leaflet 实例
let mapInstance: L.Map | null = null
const currentZoom = ref(0)
const minZoom = ref(-5) // 下调底限，支持大地图看全景
let isFollowing = ref(true) // 是否锁定视角跟随玩家
let playerMarkers: Record<string, L.CircleMarker> = {}
let focusedViewLayer: L.Polygon | null = null // 仅保留聚焦玩家的锥形视角
let playerFiringEffects: Record<string, L.Marker> = {}
let blueZoneLayer: L.Circle | null = null
let safeZoneLayer: L.Circle | null = null
let redZoneLayer: L.Circle | null = null
let airdropMarkers: Record<string, L.Marker> = {}
let airdropPredictionCircles: Record<string, L.Circle> = {}
let flightPathLayer: L.Polyline | null = null

// 地图数据状态
// 核心优化：playersState 仅用于 UI 响应，内部逻辑使用原始对象 playersData 提速
const playersState = ref<Record<string, any>>({})
let playersData: Record<string, any> = {} 
const killFeed = ref<any[]>([])
const zones = ref({
  safeZone: { x: 0, y: 0, radius: 0 },
  blueZone: { x: 0, y: 0, radius: 0 },
  redZone: { x: 0, y: 0, radius: 0 }
})
const airdrops = ref<any[]>([])
const flightPath = ref<any[]>([]) // [{x, y}]
const matchStartTime = ref(0) // 登机时间点（相对秒数）
const currentPlayerStats = ref({ rank: 0, kills: 0 })

// 计算当前玩家的关键对局事件，用于在进度条展示
const playerEvents = computed(() => {
  if (!targetPlayer.value || !rawTelemetry || rawTelemetry.length === 0) return []
  
  const startTime = new Date(rawTelemetry[0]._D).getTime()
  const events: any[] = []
  
  rawTelemetry.forEach((event, idx) => {
    const time = (new Date(event._D).getTime() - startTime) / 1000
    
    // 击杀/淘汰
    if (event._T === 'LogPlayerKillV2') {
      if (event.killer?.name === targetPlayer.value) {
        events.push({ time, type: 'kill', label: `淘汰了 ${event.victim?.name}`, color: '#67c23a' })
      } else if (event.victim?.name === targetPlayer.value) {
        events.push({ time, type: 'death', label: `被 ${event.killer?.name || 'Suicide'} 淘汰`, color: '#f56c6c' })
      }
    }
    // 击倒
    else if (event._T === 'LogPlayerMakeGroggy') {
      if (event.attacker?.name === targetPlayer.value) {
        events.push({ time, type: 'groggy', label: `击倒了 ${event.victim?.name}`, color: '#e6a23c' })
      } else if (event.victim?.name === targetPlayer.value) {
        events.push({ time, type: 'downed', label: `被 ${event.attacker?.name || 'Unknown'} 击倒`, color: '#f56c6c' })
      }
    }
  })
  
  return events
})

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

  // 如果已有地图实例，先移除
  if (mapInstance) {
    try {
      mapInstance.remove()
    } catch (e) {
      console.error('Error removing map instance:', e)
    }
    mapInstance = null
  }

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
    preferCanvas: true, 
    minZoom: -5, 
    maxZoom: 4,
    zoomSnap: 0, // 允许分级缩放，确保完美适配边界
    zoomControl: false,
    attributionControl: false,
    maxBounds: bounds, 
    maxBoundsViscosity: 1.0 
  })

  // 监听交互，自动断开跟随
  mapInstance.on('dragstart zoomstart', () => {
    isFollowing.value = false
  })

  // 3. 添加本地图片图层
  L.imageOverlay(`/maps/${mapName}.jpg`, bounds).addTo(mapInstance)

  // 4. 自动缩放并固定最小缩放级别，确保完美适配
  // 核心：使用 nextTick 和 setTimeout 确保容器渲染完成后再计算缩放
  nextTick(() => {
    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize()
        // 强制计算一个能够填满容器的最小缩放
        const calculatedMinZoom = mapInstance.getBoundsZoom(bounds, true)
        
        mapInstance.setMinZoom(calculatedMinZoom)
        // 使用 setView 直接定位中心和精确缩放，避免 fitBounds 的舍入误差
        mapInstance.setView([-mapSize / 2, mapSize / 2], calculatedMinZoom, { animate: false })
        mapInstance.setMaxBounds(bounds)
        
        minZoom.value = calculatedMinZoom
        currentZoom.value = calculatedMinZoom
      }
    }, 300) // 增加到 300ms，确保弹窗动画彻底结束
  })

  // 监听地图缩放事件，同步进度条
  mapInstance.on('zoomend', () => {
    if (mapInstance) {
      currentZoom.value = mapInstance.getZoom()
    }
  })

  // 5. 初始化区域图层
  safeZoneLayer = L.circle([0, 0], { radius: 0, color: 'white', weight: 1.5, fill: false, dashArray: '5, 5' }).addTo(mapInstance)
  blueZoneLayer = L.circle([0, 0], { radius: 0, color: '#409eff', weight: 2.5, fill: false }).addTo(mapInstance)
  redZoneLayer = L.circle([0, 0], { radius: 0, color: '#f56c6c', weight: 1, fillColor: '#f56c6c', fillOpacity: 0.2 }).addTo(mapInstance)

  // 6. 渲染航线
  if (flightPath.value.length >= 2) {
    const points = flightPath.value.map(p => [-(p.y / 100), p.x / 100] as L.LatLngExpression)
    flightPathLayer = L.polyline(points, { color: 'white', weight: 2, dashArray: '10, 10', opacity: 0.5 }).addTo(mapInstance)
  }
}

const updateMarkers = () => {
  if (!mapInstance || !mapInstance.getContainer()) return
  
  // 核心修复：确保地图已经初始化了中心点和缩放级别，否则 Leaflet 在计算 Tooltip 偏移时会抛出 subtract of undefined 错误
  try {
    if (!mapInstance.getCenter()) return
  } catch (e) {
    return
  }

  // 批量获取当前所有玩家的平滑状态
  const time = currentTime.value
  const focusedName = focusedPlayer.value

  Object.values(playersData).forEach(p => {
    // 获取插值后的平滑坐标
    const smoothState = getInterpolatedPlayerState(p.name, time)
    if (!smoothState) return

    const lat = -(smoothState.y / 100)
    const lng = smoothState.x / 100

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

    let marker = playerMarkers[p.name]
    const isFocused = p.name === focusedName
    const isHovered = p.name === hoveredPlayer.value
    const shouldShowName = isFocused || isHovered

    if (!marker) {
      marker = L.circleMarker([lat, lng], {
        radius: 5,
        fillColor: getPlayerColor(p),
        color: isFocused ? '#fff' : '#000',
        weight: isFocused ? 2 : 1,
        fillOpacity: 1
      }).addTo(mapInstance!)

      marker.bindTooltip(p.name, {
        permanent: shouldShowName,
        direction: 'top',
        className: 'player-tooltip',
        offset: [0, -5]
      })

      playerMarkers[p.name] = marker
    } else {
      marker.setLatLng([lat, lng])
      
      marker.setStyle({
        color: isFocused ? '#fff' : '#000',
        weight: isFocused ? 2 : 1,
        fillColor: getPlayerColor(p)
      })

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

    if (isFocused) {
      const fov = 45 
      const length = 60 
      const yaw = smoothState.yaw - 90
      const points: [number, number][] = [[lat, lng]]
      const step = 5 
      for (let i = -fov / 2; i <= fov / 2; i += step) {
        const rad = (yaw + i) * Math.PI / 180
        points.push([lat + Math.sin(rad) * length, lng + Math.cos(rad) * length])
      }
      if (!focusedViewLayer) {
        focusedViewLayer = L.polygon(points, { color: '#ff4d4f', weight: 1, opacity: 0.6, fillColor: '#ff4d4f', fillOpacity: 0.3 }).addTo(mapInstance!)
      } else {
        focusedViewLayer.setLatLngs(points)
      }
    }
    
    const attackElapsed = (p.lastAttackTime - (eventTimestamps[0] || 0)) / 1000
    const isFiring = time > attackElapsed && time < attackElapsed + 0.15
    if (isFiring) {
      const existingFire = playerFiringEffects[p.name]
      if (!existingFire) {
        const fireIcon = L.divIcon({ html: '<div class="firing-animation"></div>', className: 'custom-div-icon', iconSize: [30, 30], iconAnchor: [15, 15] })
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

  if (focusedName && playersData[focusedName] && isFollowing.value) {
    const smoothState = getInterpolatedPlayerState(focusedName, time)
    if (smoothState && mapInstance) {
      // 核心优化：只有在非最小缩放（有平移空间）时才执行视角跟随
      // 避免在全景模式下因 maxBounds 限制导致的镜头“抖动”
      const zoom = mapInstance.getZoom()
      if (zoom > minZoom.value + 0.05) {
        mapInstance.setView([-(smoothState.y / 100), smoothState.x / 100], zoom, { animate: false })
      }
    }
  }

  if (focusedName && playersData[focusedName] && !playersData[focusedName].isAlive && focusedViewLayer) {
    mapInstance?.removeLayer(focusedViewLayer)
    focusedViewLayer = null
  }

  // 更新圈
  if (zones.value.safeZone.radius > 0 && safeZoneLayer) {
    safeZoneLayer.setLatLng([-(zones.value.safeZone.y / 100), zones.value.safeZone.x / 100])
    safeZoneLayer.setRadius(zones.value.safeZone.radius / 100)
  }

  if (zones.value.redZone.radius > 0 && redZoneLayer) {
    redZoneLayer.setLatLng([-(zones.value.redZone.y / 100), zones.value.redZone.x / 100])
    redZoneLayer.setRadius(zones.value.redZone.radius / 100)
  } else if (redZoneLayer) {
    redZoneLayer.setRadius(0)
  }

  if (zones.value.blueZone.radius > 0 && blueZoneLayer) {
    blueZoneLayer.setLatLng([-(zones.value.blueZone.y / 100), zones.value.blueZone.x / 100])
    blueZoneLayer.setRadius(zones.value.blueZone.radius / 100)
  } else if (blueZoneLayer) {
    blueZoneLayer.setRadius(0)
  }

  // 更新空投
  const currentAirdrops = Object.entries(airdropData).filter(([_, data]) => time >= data.spawnTime)
  const currentAirdropIds = new Set(currentAirdrops.map(([id]) => id))
  
  Object.keys(airdropMarkers).forEach(id => {
    if (!currentAirdropIds.has(id)) {
      const marker = airdropMarkers[id]
      if (marker) mapInstance?.removeLayer(marker)
      delete airdropMarkers[id]
    }
  })

  currentAirdrops.forEach(([id, data]) => {
    const isLanded = time >= data.landTime
    let lat, lng
    
    if (isLanded && data.landPos) {
      lat = -(data.landPos.y / 100)
      lng = data.landPos.x / 100
    } else if (data.landPos) {
      // 坠落中插值：简单线性模拟
      const ratio = (time - data.spawnTime) / (data.landTime - data.spawnTime)
      lat = -( (data.spawnPos.y + (data.landPos.y - data.spawnPos.y) * ratio) / 100 )
      lng = (data.spawnPos.x + (data.landPos.x - data.spawnPos.x) * ratio) / 100
    } else {
      lat = -(data.spawnPos.y / 100)
      lng = data.spawnPos.x / 100
    }

    const existingMarker = airdropMarkers[id]
    if (!existingMarker) {
      const airdropIcon = L.divIcon({ 
        html: `<div class="airdrop-marker ${isLanded ? 'landed' : 'dropping'}">
                <div class="airdrop-box">🎁</div>
                ${!isLanded ? '<div class="parachute"></div>' : ''}
               </div>`, 
        className: 'custom-div-icon', 
        iconSize: [30, 30], 
        iconAnchor: [15, 15] 
      })
      airdropMarkers[id] = L.marker([lat, lng], { icon: airdropIcon, zIndexOffset: 1000 }).addTo(mapInstance!)
      
      // 绑定空投物品悬浮窗
      if (data.items && data.items.length > 0) {
        const itemsHtml = data.items.map(itemId => `
          <div class="airdrop-tooltip-item">
            <img src="${getItemImagePath(itemId)}" onerror="this.style.display='none'">
            <span>${itemNames.value[itemId] || formatWeaponName(itemId)}</span>
          </div>
        `).join('')
        
        airdropMarkers[id].bindTooltip(`
          <div class="airdrop-tooltip-content">
            <div class="tooltip-title">空投物品</div>
            ${itemsHtml}
          </div>
        `, {
          direction: 'top',
          className: 'airdrop-custom-tooltip',
          offset: [0, -10],
          sticky: true
        })
      }
      
      // 如果还没落地，在地面渲染一个落点标记
      if (!isLanded && data.landPos && !airdropPredictionCircles[id]) {
        airdropPredictionCircles[id] = L.circle([-(data.landPos.y / 100), data.landPos.x / 100], {
          radius: 10,
          color: '#f56c6c',
          weight: 1,
          dashArray: '5, 5',
          fill: false,
          interactive: false
        }).addTo(mapInstance!)
      }
    } else {
      existingMarker.setLatLng([lat, lng])
      
      // 如果已落地，且预告圈还存在，则移除
      if (isLanded && airdropPredictionCircles[id]) {
        const circle = airdropPredictionCircles[id]
        if (circle && mapInstance && mapInstance.hasLayer(circle)) {
          mapInstance.removeLayer(circle)
        }
        delete airdropPredictionCircles[id]
      }

      // 更新图标状态
      const currentIcon = existingMarker.options.icon as L.DivIcon
      const currentHtml = (currentIcon?.options?.html as string) || ''
      if (isLanded && !currentHtml.includes('landed')) {
        const landedIcon = L.divIcon({ 
          html: `<div class="airdrop-marker landed"><div class="airdrop-box">🎁</div></div>`, 
          className: 'custom-div-icon', 
          iconSize: [30, 30], 
          iconAnchor: [15, 15] 
        })
        existingMarker.setIcon(landedIcon)
      }
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
    return player.isBot ? '#666666' : '#ffffff'
  }

  const focusedPlayerObj = playersState.value[focusedPlayer.value]
  const focusedTeamId = focusedPlayerObj.teamId

  // 如果玩家与聚焦玩家是同一队，不论是不是机器人，都分配队伍颜色
  if (focusedTeamId && focusedTeamId > 0 && player.teamId === focusedTeamId) {
    const teamMembers = Object.values(playersState.value)
      .filter(p => p.teamId === focusedTeamId)
      .sort((a, b) => a.name.localeCompare(b.name))

    const memberIndex = teamMembers.findIndex(m => m.name === player.name)
    const teamColors = ['#feca57', '#ff4d4f', '#54a0ff', '#1dd1a1']
    return teamColors[memberIndex % teamColors.length] || '#ffffff'
  }

  // 非聚焦队伍的：人机显示灰色，真人显示白色
  return player.isBot ? '#666666' : '#ffffff'
}

const alivePlayers = computed(() => {
  return Object.values(playersState.value).filter(p => p.isAlive)
})

const aliveTeamsCount = computed(() => {
  const aliveTeams = new Set<number>()
  Object.values(playersState.value).forEach(p => {
    if (p.isAlive) {
      aliveTeams.add(p.teamId)
    }
  })
  return aliveTeams.size
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

const getWeaponTitle = (weaponId: string, playerName: string) => {
  if (!weaponId) return '无武器'
  const normId = getNormalizedItemId(weaponId)
  return itemNames.value[normId] || WEAPON_NAME_DICT[normId] || normId
}

const getRelativeTime = (eventTime: number) => {
  const startTime = eventTimestamps[0] || 0
  return formatTime(Math.max(0, (eventTime - startTime) / 1000))
}

// 新增：统一规范化物品 ID 的工具函数，剥离皮肤后缀用于查表
const getNormalizedItemId = (itemId: string) => {
  if (!itemId) return ''
  // 武器/装备 ID 格式通常为 Item_Weapon_AK47_C 或 Item_Weapon_AK47_Skin_C
  // 我们取前 4 段来获取基础 ID
  const parts = itemId.split('_')
  if (parts.length > 4) {
    const base = parts.slice(0, 4).join('_')
    return base.endsWith('_C') ? base : base + '_C'
  }
  return itemId
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
  'Item_Weapon_M79_C': 'handgun',      // M79 榴弹发射器占手枪位
  'Item_Weapon_Flaregun_C': 'handgun',  // 信号枪占手枪位
  // Melee
  'Item_Weapon_Cowbar_C': 'melee',
  'Item_Weapon_Pan_C': 'melee',
  'Item_Weapon_Machete_C': 'melee',
  'Item_Weapon_Sickle_C': 'melee',
  // Throwable & Lobby items
  'Item_Weapon_Grenade_C': 'throwable',
  'Item_Weapon_Molotov_C': 'throwable',
  'Item_Weapon_FlashBang_C': 'throwable',
  'Item_Weapon_DecoyGrenade_C': 'throwable',
  'Item_Weapon_SmokeBomb_C': 'throwable',
  'Item_Weapon_StickyGrenade_C': 'throwable',
  'Item_Weapon_C4_C': 'throwable',
  'Item_Weapon_Apple_C': 'throwable',     // 苹果（大厅道具）
  'Item_Weapon_Snowball_C': 'throwable',  // 雪球（大厅道具）
  'Item_Weapon_SpikeTrap_C': 'throwable',
  'Item_Weapon_BluezoneGrenade_C': 'throwable'
}

const getItemImagePath = (itemId: string) => {
  if (!itemId) return ''

  // 1. 核心映射表：解决个别遥测 ID 与素材文件名完全不匹配的情况（如莫辛纳甘）
  const ID_MAPPING: Record<string, string> = {
    // 如果以后发现还有 ID 对应不上的，在这里添加映射
    // '原始ID': '目标素材文件名'
  }

  let finalId = ID_MAPPING[itemId] || itemId
  let normalizedId = finalId

  // 2. 分类处理规范化
  if (finalId.startsWith('Item_Head') || finalId.startsWith('Item_Armor') || finalId.startsWith('Item_Back')) {
    // 装备类：将皮肤序号（如 _01_）统一转为基础素材序号 _00_
    normalizedId = finalId.replace(/_0[1-9]_/, '_00_')
  } else {
    // 武器类：仅移除可能的皮肤后缀，绝对不要动型号数字（如 416, 47）
    // 正常的武器 ID 应该是 Item_Weapon_XXX_C，不需要额外处理数字
    normalizedId = finalId.split('_').slice(0, 4).join('_')
    if (!normalizedId.endsWith('_C')) normalizedId += '_C'
  }

  // 3. 路径路由
  if (normalizedId.startsWith('Item_Head')) return `/assets/item/Equipment/Headgear/${normalizedId}.png`
  if (normalizedId.startsWith('Item_Armor')) return `/assets/item/Equipment/Vest/${normalizedId}.png`
  if (normalizedId.startsWith('Item_Back')) return `/assets/item/Equipment/Backpack/${normalizedId}.png`

  if (normalizedId.startsWith('Item_Weapon')) {
    const cat = WEAPON_CATEGORIES[normalizedId] || 'main'
    const folder = cat.charAt(0).toUpperCase() + cat.slice(1)
    // 这里的路径需要匹配您 public 目录下的真实结构
    return `/assets/item/Weapon/${folder}/${normalizedId}.png`
  }

  return ''
}

const fetchData = async () => {
  if (!matchId.value) {
    console.error('fetchData called without matchId')
    return
  }
  try {
    loading.value = true
    // 重置状态
    match.value = null
    telemetry.value = []
    rawTelemetry = []
    playerTimelines = {}
    airdropData = {}
    lastProcessedTime = -1
    currentEventIndex = 0
    currentTime.value = 0
    
    const mId = matchId.value
    const pName = targetPlayer.value
    console.log(`Fetching match data - MatchID: ${mId}, Player: ${pName}`)
    
    isPlaying.value = false // 加载新数据前强制暂停
    if (!mId || mId === 'undefined') {
      throw new Error('未提供有效的 Match ID')
    }

    const [matchData, telemetryData, itemsData] = await Promise.all([
      getMatchDetails(mId, pName || undefined),
      getMatchTelemetry(mId),
      fetch('/assets/itemId.json')
        .then(res => res.ok ? res.json() : {})
        .catch(() => ({}))
    ])
    
    if (!telemetryData || !Array.isArray(telemetryData)) {
      throw new Error('遥测数据格式不正确或为空')
    }

    match.value = matchData
    
    // 获取当前玩家的汇总数据
    if (targetPlayer.value && matchData.participants) {
      const p = matchData.participants.find((it: any) => it.name === targetPlayer.value)
      if (p) {
        currentPlayerStats.value = {
          rank: p.winPlace,
          kills: p.kills
        }
      }
    } else if (targetPlayer.value) {
      // 兼容后端直接返回带统计信息的结构（如果后端已升级）
      currentPlayerStats.value = {
        rank: matchData.rank || 0,
        kills: matchData.kills || 0
      }
    }
    // 使用 markRaw 彻底断开响应式链，减少数万个对象的内存占用
    rawTelemetry = markRaw(telemetryData)
    telemetry.value = rawTelemetry
    itemNames.value = itemsData

    if (rawTelemetry.length > 0) {
      // 预计算所有事件的时间戳
      const startTime = new Date(rawTelemetry[0]._D).getTime()
      eventTimestamps = rawTelemetry.map(e => {
        const d = new Date(e._D).getTime()
        return isNaN(d) ? startTime : d // 兜底处理无效时间戳
      })

      const endTime = eventTimestamps[eventTimestamps.length - 1] || startTime
      maxTime.value = Math.max(0, (endTime - startTime) / 1000)

      // 预处理位置时间线，用于平滑移动插值
      preprocessTimelines()

      // 预处理空投数据
      preprocessAirdrops()

      // 寻找正式登机/比赛开始时间点
      const startEvent = rawTelemetry.find(e => e._T === 'LogMatchStart')
      if (startEvent) {
        matchStartTime.value = Math.max(0, (new Date(startEvent._D).getTime() - startTime) / 1000)
      }

      // 提取航线 (改进共识算法：降低门槛，确保 100% 成功提取且保持高精度)
      const timeGroupedPoints: Record<number, {x: number, y: number}[]> = {}
      const firstTs = eventTimestamps[0] || 0
      
      rawTelemetry.forEach((e, idx) => {
        if (e._T === 'LogPlayerPosition' && e.character.location.z > 10000) {
          const ts = eventTimestamps[idx]
          if (ts === undefined) return
          const elapsed = (ts - firstTs) / 1000
          // 采集开局前 5 分钟内的高空数据
          if (elapsed < 300) {
            // 将时间戳归一化到 500ms 窗口，增加共识概率
            const timeKey = Math.floor(ts / 500) * 500
            if (!timeGroupedPoints[timeKey]) timeGroupedPoints[timeKey] = []
            timeGroupedPoints[timeKey].push({ x: e.character.location.x, y: e.character.location.y })
          }
        }
      })

      const consensusPoints: {x: number, y: number, t: number}[] = []
      Object.entries(timeGroupedPoints).forEach(([tsStr, pts]) => {
        const ts = Number(tsStr)
        const counts: Record<string, number> = {}
        pts.forEach(p => {
          // 聚合精度：取整到 10 像素，处理极微小的坐标同步误差
          const key = `${Math.floor(p.x / 10) * 10},${Math.floor(p.y / 10) * 10}`
          counts[key] = (counts[key] || 0) + 1
        })
        
        let maxCount = 0
        let bestPos = { x: 0, y: 0 }
        for (const key in counts) {
          const count = counts[key] || 0
          if (count > maxCount) {
            maxCount = count
            const parts = key.split(',')
            bestPos = { x: Number(parts[0]) || 0, y: Number(parts[1]) || 0 }
          }
        }
        
        // 阈值下调：只要有 2 人坐标一致即认定为飞机，确保即便在人少的对局也能提取航线
        if (maxCount >= 2) {
          consensusPoints.push({ ...bestPos, t: ts })
        }
      })

      if (consensusPoints.length >= 2) {
        consensusPoints.sort((a, b) => a.t - b.t)
        const start = consensusPoints[0]!
        const end = consensusPoints[consensusPoints.length - 1]!
        const dx = end.x - start.x
        const dy = end.y - start.y
        const mag = Math.sqrt(dx*dx + dy*dy)
        if (mag > 500) {
          // 精准边界裁剪逻辑：计算直线与地图矩形边界的交点，确保航线完美贴合边缘
          const mapName = match.value.mapName
          const mapSize = MAP_SIZES[mapName] || 8192
          const limit = mapSize * 100 // PUBG 坐标系上限
          
          const tValues: number[] = []
          // 计算直线 P = start + t * (end - start) 与四条边界的交点参数 t
          if (Math.abs(dx) > 0.1) {
            tValues.push((0 - start.x) / dx)
            tValues.push((limit - start.x) / dx)
          }
          if (Math.abs(dy) > 0.1) {
            tValues.push((0 - start.y) / dy)
            tValues.push((limit - start.y) / dy)
          }
          
          // 过滤掉不在地图范围内的交点（允许 1% 浮点误差），并排序
          const margin = limit * 0.01
          const validTs = tValues
            .filter(t => {
              const px = start.x + t * dx
              const py = start.y + t * dy
              return px >= -margin && px <= limit + margin && py >= -margin && py <= limit + margin
            })
            .sort((a, b) => a - b)

          if (validTs.length >= 2) {
            // 取最小和最大的 t，即为穿过地图的进入点和离开点
            const tEntry = validTs[0]!
            const tExit = validTs[validTs.length - 1]!
            
            flightPath.value = [
              { x: start.x + tEntry * dx, y: start.y + tEntry * dy },
              { x: start.x + tExit * dx, y: start.y + tExit * dy }
            ]
          }
        }
      }
    }

    // 将地图和玩家初始化放入 nextTick，确保 DOM 已渲染且不阻塞主线程
    await nextTick()
    
    initMap()
    initPlayers()

    // 仅侧边栏高亮并自动滚动定位，不操作地图视角
    if (targetPlayer.value && playersState.value[targetPlayer.value]) {
      focusedPlayer.value = targetPlayer.value
      scrollToPlayer(targetPlayer.value)
    }

    // 数据加载完成后，自动跳转到比赛开始时刻
    if (matchStartTime.value > 0) {
      currentTime.value = matchStartTime.value
      updateState(currentTime.value)
      updateMarkers()
    }
    
    // 强制触发一次 UI 状态更新，确保统计数据立即显示
    playersState.value = { ...playersData }
  } catch (err: any) {
    console.error('Fetch data error details:', err)
    const errMsg = err.response?.data?.message || err.message || '数据解析错误'
    ElMessage.error(`回放加载失败: ${errMsg}`)
  } finally {
    loading.value = false
    console.log('fetchData finished, loading set to false')
  }
}

// 预处理空投数据
const preprocessAirdrops = () => {
  airdropData = {}
  const firstTimestamp = eventTimestamps[0] || 0
  let foundCount = 0
  
  rawTelemetry.forEach((event, index) => {
    const ts = eventTimestamps[index]
    if (ts === undefined) return
    const time = (ts - firstTimestamp) / 1000

    if (event._T === 'LogCarePackageSpawn') {
      foundCount++
      const id = event.itemPackage?.itemPackageId
      if (!id) return
      
      // 直接从 Spawn 事件中提取初始物品清单
      const initialItems = (event.itemPackage.items || []).map((item: any) => item.itemId)

      airdropData[id] = {
        spawnTime: time,
        landTime: 999999,
        spawnPos: { x: event.itemPackage.location.x, y: event.itemPackage.location.y, z: event.itemPackage.location.z },
        landPos: null,
        items: initialItems
      }
    } else if (event._T === 'LogCarePackageLand') {
      const id = event.itemPackage?.itemPackageId
      if (id && airdropData[id]) {
        airdropData[id].landTime = time
        airdropData[id].landPos = { x: event.itemPackage.location.x, y: event.itemPackage.location.y, z: event.itemPackage.location.z }
      }
    } else if (event._T === 'LogItemDrop') {
      // 收集空投箱内的初始物品
      const packageId = event.itemPackageId
      if (packageId && airdropData[packageId] && event.item) {
        if (!airdropData[packageId].items.includes(event.item.itemId)) {
          airdropData[packageId].items.push(event.item.itemId)
        }
      }
    }
  })
}

// 预处理位置时间线
const preprocessTimelines = () => {
  playerTimelines = {}
  const firstTimestamp = eventTimestamps[0] || 0
  rawTelemetry.forEach((event, index) => {
    const ts = eventTimestamps[index]
    if (ts === undefined) return
    const time = (ts - firstTimestamp) / 1000
    if (event._T === 'LogPlayerPosition') {
      const name = event.character.name
      if (!playerTimelines[name]) playerTimelines[name] = []
      const timeline = playerTimelines[name]
      const ts = eventTimestamps[index]
      if (timeline && ts !== undefined) {
        timeline.push({
          time,
          x: event.character.location.x,
          y: event.character.location.y,
          yaw: event.character.orientation?.yaw || 0
        })
      }
    }
  })
}

// 获取平滑差值后的玩家位置
const getInterpolatedPlayerState = (playerName: string, time: number) => {
  const timeline = playerTimelines[playerName]
  if (!timeline || timeline.length === 0) return null

  // 二分查找当前时间对应的索引区间
  let low = 0, high = timeline.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (timeline[mid].time < time) low = mid + 1
    else high = mid - 1
  }

  const nextIdx = low
  const prevIdx = Math.max(0, low - 1)

  if (nextIdx >= timeline.length) return timeline[timeline.length - 1]
  if (nextIdx === 0) return timeline[0]

  const prev = timeline[prevIdx]
  const next = timeline[nextIdx]
  
  if (next.time === prev.time) return prev

  // 在正式比赛（登机）开始前，锁定在出生岛位置
  if (matchStartTime.value > 0 && time < matchStartTime.value) return prev

  // 核心修复：如果当前插值区间跨越了“登机”点（即 prev 是出生岛点，next 是飞机/赛中点）
  // 只要时间到达了 matchStartTime，就直接显示 next 位置，彻底消除任何跨状态的滑行效果
  if (matchStartTime.value > 0 && prev.time < matchStartTime.value) {
    return next
  }

  const ratio = (time - prev.time) / (next.time - prev.time)
  
  // 角度插值优化：处理 0/360 度跨越问题，实现最短路径旋转
  let deltaYaw = next.yaw - prev.yaw
  if (deltaYaw > 180) deltaYaw -= 360
  if (deltaYaw < -180) deltaYaw += 360
  const smoothYaw = prev.yaw + deltaYaw * ratio

  return {
    x: prev.x + (next.x - prev.x) * ratio,
    y: prev.y + (next.y - prev.y) * ratio,
    yaw: smoothYaw
  }
}

const initPlayers = () => {
  playersData = {}
  rawTelemetry.forEach(event => {
    if (event._T === 'LogPlayerPosition') {
      const name = event.character.name
      const accountId = event.character.accountId
      if (!accountId || accountId === "") return
      const isBot = accountId.startsWith('ai.')
      if (!playersData[name]) {
        playersData[name] = {
          name,
          accountId,
          isBot,
          x: event.character.location.x,
          y: event.character.location.y,
          hp: event.character.health,
          isAlive: true,
          teamId: event.character.teamId,
          kills: 0, dbnos: 0, revives: 0, damage: 0,
          yaw: 0, lastAttackTime: 0,
          currentWeapon: '', // 新增：追踪当前手持武器
          items: { helmet: '', vest: '', backpack: '', weapon1: '', weapon2: '', weapon3: '', weapon4: '' }
        }
      }
    }
  })
  playersState.value = { ...playersData }
}

const updateState = (time: number) => {
  if (rawTelemetry.length === 0 || eventTimestamps.length === 0) return

  const startTime = eventTimestamps[0] || 0
  const targetTime = startTime + time * 1000
  const isForward = time >= lastProcessedTime && lastProcessedTime !== -1

  if (!isForward) {
    Object.values(playersData).forEach(p => {
      p.isAlive = true; p.kills = 0; p.dbnos = 0; p.revives = 0; p.damage = 0; p.lastAttackTime = 0;
      p.currentWeapon = '';
      p.items = { helmet: '', vest: '', backpack: '', weapon1: '', weapon2: '', weapon3: '', weapon4: '' }
    })
    killFeed.value = []
    airdrops.value = []
    currentEventIndex = 0
  }

  // 核心优化：使用 currentEventIndex 指针增量处理事件，避免 O(N) 遍历
  while (currentEventIndex < rawTelemetry.length) {
    const eventTime = eventTimestamps[currentEventIndex]
    if (eventTime === undefined || eventTime > targetTime) break

    const event = rawTelemetry[currentEventIndex]
    const p = event.character ? playersData[event.character.name] : 
              event.attacker ? playersData[event.attacker.name] : 
              event.victim ? playersData[event.victim.name] : null

    switch (event._T) {
      case 'LogPlayerPosition':
        if (p) {
          p.hp = event.character.health
          // 复活逻辑同步
          if (!p.isAlive && (event.character.location.z > 10000 || p.hp > 0)) {
            p.isAlive = true
            if (event.character.location.z > 10000) {
              killFeed.value.unshift({ 
                killer: p.name, 
                killerTeamId: p.teamId,
                victim: '', 
                action: '重新进入了战场', 
                isRespawn: true, 
                time: eventTime 
              })
            }
          }
        }
        break
      case 'LogPlayerAttack': 
        if (p) {
          p.lastAttackTime = eventTime
          // 兜底逻辑：开火时更新手持武器
          if (event.weapon?.itemId) {
            p.currentWeapon = event.weapon.itemId
          }
        }
        break
      case 'LogPlayerTakeDamage':
        const attacker = event.attacker ? playersData[event.attacker.name] : null
        if (attacker) attacker.damage += event.damage
        break
      case 'LogPlayerMakeGroggy':
        const killerG = event.attacker ? playersData[event.attacker.name] : null
        if (killerG) killerG.dbnos++
        if (event.victim) {
          const victimG = playersData[event.victim.name]
          killFeed.value.unshift({ 
            killer: event.attacker?.name || 'Unknown', 
            killerTeamId: killerG?.teamId,
            victim: event.victim.name, 
            victimTeamId: victimG?.teamId,
            action: '击倒了', 
            isGroggy: true, 
            time: eventTime 
          })
        }
        break
      case 'LogPlayerRevive':
        const reviver = event.reviver ? playersData[event.reviver.name] : null
        if (reviver) reviver.revives++
        const victimR = event.victim ? playersData[event.victim.name] : null
        if (victimR) {
          victimR.isAlive = true; victimR.hp = event.victim.health || 20
          killFeed.value.unshift({ 
            killer: event.reviver?.name || 'Unknown', 
            killerTeamId: reviver?.teamId,
            victim: event.victim.name, 
            victimTeamId: victimR?.teamId,
            action: '扶起了', 
            isRevive: true, 
            time: eventTime 
          })
        }
        break
      case 'LogPlayerKillV2':
        const killerK = event.killer ? playersData[event.killer.name] : null
        if (killerK) killerK.kills++
        const victimK = event.victim ? playersData[event.victim.name] : null
        if (victimK) {
          victimK.isAlive = false; victimK.hp = 0
          killFeed.value.unshift({ 
            killer: event.killer?.name || 'Suicide', 
            killerTeamId: killerK?.teamId,
            victim: event.victim.name, 
            victimTeamId: victimK?.teamId,
            action: '淘汰了', 
            time: eventTime 
          })
        }
        break
      case 'LogGameStatePeriodic':
        if (event.gameState) {
          // 交换赋值逻辑以纠正颜色反向的问题
          zones.value.blueZone = { x: event.gameState.safetyZonePosition.x, y: event.gameState.safetyZonePosition.y, radius: event.gameState.safetyZoneRadius }
          zones.value.safeZone = { x: event.gameState.poisonGasWarningPosition.x, y: event.gameState.poisonGasWarningPosition.y, radius: event.gameState.poisonGasWarningRadius }
        }
        break
      case 'LogCarePackageSpawn':
        airdrops.value.push({ id: event.itemPackage.itemPackageId, x: event.itemPackage.location.x, y: event.itemPackage.location.y, isLanded: false }); break
      case 'LogCarePackageLand':
        const ad = airdrops.value.find(a => a.id === event.itemPackage.itemPackageId)
        if (ad) { ad.isLanded = true; ad.x = event.itemPackage.location.x; ad.y = event.itemPackage.location.y; }
        break
      case 'LogItemDrop':
      case 'LogItemPickup':
      case 'LogItemEquip':
      case 'LogItemUnequip':
        const itemP = event.character ? playersData[event.character.name] : null
        if (itemP && event.item) {
          const id = event.item.itemId
          if (event._T === 'LogItemUnequip' || event._T === 'LogItemDrop') {
            if (itemP.currentWeapon === id) itemP.currentWeapon = ''
            if (itemP.items.helmet === id) itemP.items.helmet = ''
            else if (itemP.items.vest === id) itemP.items.vest = ''
            else if (itemP.items.backpack === id) itemP.items.backpack = ''
            else if (itemP.items.weapon1 === id) itemP.items.weapon1 = ''
            else if (itemP.items.weapon2 === id) itemP.items.weapon2 = ''
            else if (itemP.items.weapon3 === id) itemP.items.weapon3 = ''
            else if (itemP.items.weapon4 === id) itemP.items.weapon4 = ''
          } else {
            // Pickup / Equip
            if (id.startsWith('Item_Head')) itemP.items.helmet = id
            else if (id.startsWith('Item_Armor')) itemP.items.vest = id
            else if (id.startsWith('Item_Back')) itemP.items.backpack = id
            else if (id.startsWith('Item_Weapon')) {
              const normId = getNormalizedItemId(id)
              const cat = WEAPON_CATEGORIES[normId] || 'main'
              
              if (cat === 'handgun') {
                itemP.items.weapon3 = id
              } else if (cat === 'melee' || cat === 'throwable') {
                itemP.items.weapon4 = id
              } else {
                // 主武器槽位 (1 & 2) 严谨填充逻辑
                // 1. 如果该 ID 已经在任意一个槽位了，跳过（防止 Pickup/Equip 重复触发）
                if (itemP.items.weapon1 === id || itemP.items.weapon2 === id) {
                   // 已经在身上了，不处理
                } else if (!itemP.items.weapon1) {
                  itemP.items.weapon1 = id
                } else {
                  // 槽位 1 满了，填入槽位 2
                  itemP.items.weapon2 = id
                }
              }
              
              // Debug 日志：过滤掉干扰道具，仅打印核心武器
              if (cat === 'main' && (itemP.name === hoveredPlayer.value || itemP.name === focusedPlayer.value)) {
                console.log(`[Weapon Debug] ${itemP.name} 核心武器变动: ${id} -> 槽位1: ${itemP.items.weapon1}, 槽位2: ${itemP.items.weapon2}`)
              }
            }
          }
        }
        break
    }
    currentEventIndex++
  }

  lastProcessedTime = time
  const now = Date.now()
  if (now - lastUIUpdateTime > 100) {
    playersState.value = { ...playersData }
    lastUIUpdateTime = now
  }
}

function playbackLoop(now: number) {
  if (!lastFrameTime) lastFrameTime = now
  const deltaTime = Math.min(0.1, (now - lastFrameTime) / 1000)
  lastFrameTime = now

  if (isPlaying.value && maxTime.value > 0) {
    try {
      currentTime.value += deltaTime * playSpeed.value
      if (currentTime.value >= maxTime.value) {
        currentTime.value = maxTime.value
        isPlaying.value = false
      }
      updateState(currentTime.value)
      updateMarkers()
    } catch (e) {
      console.error('Playback loop error:', e)
      isPlaying.value = false 
    }
  }

  playbackTimer = requestAnimationFrame(playbackLoop)
}

const togglePlay = () => { 
  isPlaying.value = !isPlaying.value 
}
const resetPlayback = () => { isPlaying.value = false; currentTime.value = 0; initPlayers(); }
const onSliderChange = (val: number) => { currentTime.value = val; updateState(val); updateMarkers(); }
const seekToKill = (eventTime: number) => {
  const startTime = eventTimestamps[0] || 0
  const targetRelativeTime = Math.max(0, (eventTime - startTime) / 1000 - 1)
  currentTime.value = targetRelativeTime
  updateState(targetRelativeTime)
  updateMarkers()
}

const onZoomSliderChange = (val: number) => { if (mapInstance) mapInstance.setZoom(val) }
const changeZoom = (delta: number) => { if (mapInstance) mapInstance.setZoom(mapInstance.getZoom() + delta) }

const WEAPON_NAME_DICT: Record<string, string> = {
  'Item_Weapon_AK47_C': 'AKM', 'Item_Weapon_M16A4_C': 'M16A4', 'Item_Weapon_SCAR-L_C': 'SCAR-L',
  'Item_Weapon_HK416_C': 'M416', 'Item_Weapon_AUG_C': 'AUG', 'Item_Weapon_BerylM762_C': 'Beryl',
  'Item_Weapon_Mk47Mutant_C': 'Mk47', 'Item_Weapon_Groza_C': 'Groza', 'Item_Weapon_G36C_C': 'G36C',
  'Item_Weapon_K2_C': 'K2', 'Item_Weapon_ACE32_C': 'ACE32', 'Item_Weapon_Kar98k_C': 'Kar98k',
  'Item_Weapon_M24_C': 'M24', 'Item_Weapon_AWM_C': 'AWM', 'Item_Weapon_Win1894_C': 'Win94',
  'Item_Weapon_Mosin_C': 'Mosin', 'Item_Weapon_Mini14_C': 'Mini14', 'Item_Weapon_SKS_C': 'SKS',
  'Item_Weapon_Mk14_C': 'Mk14', 'Item_Weapon_QBU88_C': 'QBU', 'Item_Weapon_SLR_C': 'SLR',
  'Item_Weapon_VSS_C': 'VSS', 'Item_Weapon_UMP_C': 'UMP45', 'Item_Weapon_UZI_C': 'Micro UZI',
  'Item_Weapon_Vector_C': 'Vector', 'Item_Weapon_TommyGun_C': 'Tommy Gun', 'Item_Weapon_MP5K_C': 'MP5K',
  'Item_Weapon_P90_C': 'P90', 'Item_Weapon_M249_C': 'M249', 'Item_Weapon_DP28_C': 'DP-28',
  'Item_Weapon_MG3_C': 'MG3', 'Item_Weapon_Saiga12_C': 'S12K', 'Item_Weapon_Berreta686_C': 'S686',
  'Item_Weapon_Winchester12_C': 'S1897', 'Item_Weapon_DBS_C': 'DBS', 'Item_Weapon_Pan_C': '平底锅',
  'Item_Weapon_Machete_C': '砍刀', 'Item_Weapon_Crowbar_C': '物理学圣剑', 'Item_Weapon_Sickle_C': '镰刀',
  'Item_Weapon_Grenade_C': '手雷', 'Item_Weapon_Molotov_C': '燃烧瓶', 'Item_Weapon_BluezoneGrenade_C': '蓝圈手雷',
  'WeapDacia_96_C': '达契亚轿车', 'WeapUAZ_Armored_C': 'UAZ', 'WeapMotorbike_600_C': '摩托车',
  'Bluezone': '毒圈', 'RedZone': '轰炸', 'Suicide': '自杀', 'Drown': '溺水', 'Fall': '坠落'
}
const formatWeaponName = (name: string) => WEAPON_NAME_DICT[name] || name.replace('Item_Weapon_', '').replace('_C', '')

const focusPlayer = (name: string) => {
  focusedPlayer.value = name
  isFollowing.value = true 
  const p = playersData[name]
  if (p && mapInstance) {
    // 核心优化：如果当前是全景模式，点击聚焦时自动放大一级，以便开启视角跟踪
    const targetZoom = Math.max(mapInstance.getZoom(), minZoom.value + 1)
    mapInstance.setView([-(p.y / 100), p.x / 100], targetZoom, { animate: true })
    currentZoom.value = targetZoom
  }
}

const scrollToPlayer = (name: string) => {
  nextTick(() => {
    const player = playersData[name]
    if (player) {
      const el = document.getElementById(`team-${player.teamId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
}

const handleEsc = (e: KeyboardEvent) => { 
  if (e.key === 'Escape') {
    if (props.isDialog) {
      // 弹窗模式下由父组件处理关闭
    } else {
      router.back()
    }
  }
}
const copyShareLink = () => {
  const url = `${window.location.origin}/replay/${matchId.value}${targetPlayer.value ? '?player=' + targetPlayer.value : ''}`
  navigator.clipboard.writeText(url).then(() => {
    ElMessage.success('链接已复制到剪贴板，快去分享吧！')
  }).catch(() => {
    ElMessage.error('复制失败，请手动复制浏览器地址栏链接')
  })
}

const goToPlayer = (name: string) => { window.open(router.resolve(`/player/${name}`).href, '_blank') }

// 监听加载状态，加载完成后自动播放
watch(loading, (newLoading) => {
  if (!newLoading && telemetry.value.length > 0) {
    console.log('Replay data loaded, preparing auto-play...')
    
    // 给予 500ms 缓冲，确保地图图层、弹窗动画、以及 initMap 中的 setView 都稳定了再启动
    setTimeout(() => {
      // 1. 自动跳转到比赛开始时刻 (起飞)
      if (matchStartTime.value > 0) {
        currentTime.value = matchStartTime.value
      }
      
      // 同步一次状态，此时 updateMarkers 内部已经有了 getCenter 检查，是安全的
      updateState(currentTime.value)
      updateMarkers()

      lastFrameTime = 0 
      isPlaying.value = true
      console.log('Replay auto-play engaged')
    }, 500)
  }
}, { immediate: false })

// 监听 matchId 变化自动加载数据
watch(matchId, (newId) => {
  if (newId) {
    fetchData()
  }
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', handleEsc)
  
  // 统一在组件挂载时启动播放循环管家，它会根据 isPlaying 状态决定是否推进时间
  if (playbackTimer) cancelAnimationFrame(playbackTimer)
  lastFrameTime = 0
  playbackTimer = requestAnimationFrame(playbackLoop)

  // 兜底：如果数据已加载但未播放（常见于缓存或快速渲染场景）
  if (!loading.value && telemetry.value.length > 0) {
    isPlaying.value = true
  }
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleEsc)
  if (playbackTimer) cancelAnimationFrame(playbackTimer)
  if (mapInstance) { mapInstance.remove(); mapInstance = null; }
})
</script>

<style scoped lang="scss">
.replay-container {
  :deep(.airdrop-custom-tooltip) {
    background: rgba(30, 30, 30, 0.95) !important;
    border: 1px solid #444 !important;
    color: white !important;
    padding: 8px !important;
    border-radius: 4px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    
    &::before {
      border-top-color: rgba(30, 30, 30, 0.95) !important;
    }

    .airdrop-tooltip-content {
      min-width: 120px;
      
      .tooltip-title {
        font-size: 12px;
        color: #999;
        margin-bottom: 6px;
        border-bottom: 1px solid #444;
        padding-bottom: 4px;
        font-weight: bold;
      }

      .airdrop-tooltip-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        
        &:last-child { margin-bottom: 0; }

        img {
          width: 24px;
          height: 24px;
          object-fit: contain;
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
        }

        span {
          font-size: 12px;
          white-space: nowrap;
        }
      }
    }
  }

  :deep(.airdrop-marker) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    
    .airdrop-box {
      font-size: 20px;
      line-height: 1;
      filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
    }
    
    &.dropping {
      animation: drop-swing 2s ease-in-out infinite;
      
      .parachute {
        width: 20px;
        height: 12px;
        background: #f56c6c;
        border-radius: 20px 20px 0 0;
        position: relative;
        margin-bottom: -2px;
        box-shadow: 0 -2px 4px rgba(0,0,0,0.2);
        
        &::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 6px;
          border-left: 1px solid #ddd;
          border-right: 1px solid #ddd;
        }
      }
    }
    
    &.landed {
      .airdrop-box {
        animation: land-bounce 0.5s ease-out;
      }
    }
  }

  @keyframes drop-swing {
    0%, 100% { transform: rotate(-5deg); }
    50% { transform: rotate(5deg); }
  }
  
  @keyframes land-bounce {
    0% { transform: scale(1.2); }
    50% { transform: scale(0.9); }
    100% { transform: scale(1); }
  }

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
  &.is-dialog {
    height: 94vh;
    background-color: transparent; // 弹窗模式背景透明，依靠内部布局背景
  }
  
  height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center; // 关键：水平居中内部布局
  align-items: center;
  background-color: #1a1a1a;
  color: white;
}

.replay-layout {
  height: fit-content; // 核心：高度由内容决定，不再强行撑开
  max-height: 94vh;
  width: fit-content;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  box-shadow: 0 0 30px rgba(0,0,0,0.7);
  overflow: hidden;
}

.replay-header {
  height: 70px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background-color: #1e1e1e;
  border-bottom: 1px solid #333;
  z-index: 1001;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);

  .replay-container.is-dialog & {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 400px; // 稍微减小，防止撑爆

    .el-button.is-circle {
      flex-shrink: 0;
    }

      .match-info {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .title-row {
          display: flex;
          align-items: center;
          gap: 10px;

          .title {
            font-weight: 600;
            font-size: 15px;
            color: #eee;
            letter-spacing: 0.5px;
          }

          .share-icon {
            cursor: pointer;
            color: #409eff;
            font-size: 14px;
            transition: transform 0.2s, color 0.2s;
            display: flex;
            align-items: center;
            
            &:hover {
              transform: scale(1.2);
              color: #66b1ff;
            }
            
            &:active {
              transform: scale(0.9);
            }
          }
        }

        .detail-stats {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 11px;
        color: #888;

        .stat-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 2px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px; // 胶囊样式更现代

          &.replay-time {
            color: #409eff;
            background: rgba(64, 158, 255, 0.08);
            border-color: rgba(64, 158, 255, 0.2);
            .time-val {
              font-family: 'Roboto Mono', monospace;
              font-weight: bold;
              font-size: 12px;
            }
            .time-divider { margin: 0 1px; opacity: 0.4; }
            .time-total { opacity: 0.6; }
          }

          &.highlight {
            color: #ffcc00; // PUBG 经典的黄色
            background: rgba(255, 204, 0, 0.08);
            border-color: rgba(255, 204, 0, 0.3);
            font-weight: bold;
          }

          &.real-date {
            font-size: 10px;
            border: none;
            background: transparent;
            padding: 0;
            opacity: 0.5;
          }

          .el-icon {
            font-size: 14px;
          }
        }
      }
    }
  }

  .controls {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 0 40px;
    max-width: 800px; // 限制进度条区域最大宽度

    .time-slider {
      flex: 1;
      display: flex;
      flex-direction: column; // 改为上下结构，时间在滑块上方
      gap: 2px;
            
      .time-display {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
        color: #888;
        .current { color: #409eff; font-weight: bold; }
        .divider { margin: 0 4px; opacity: 0.5; }
      }
    
      .slider-wrapper {
        flex: 1;
        position: relative;
        padding: 0 10px;
        .el-slider {
          height: 24px; // 稍微调细
        }
        .start-marker {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 14px;
          background-color: #f56c6c;
          border-radius: 1px;
          z-index: 10;
          pointer-events: none;
          box-shadow: 0 0 4px rgba(245, 108, 108, 0.5);
        }

        .event-marker {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          z-index: 11;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
          transition: transform 0.2s;

          &:hover {
            transform: translateY(-50%) scale(1.5);
            z-index: 12;
          }

          &.kill { border-color: #fff; }
          &.death { width: 8px; height: 8px; border-radius: 2px; transform: translateY(-50%) rotate(45deg); }
          &.death:hover { transform: translateY(-50%) rotate(45deg) scale(1.5); }
        }
      }
    }

    .speed-control {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #999;
      white-space: nowrap;
        
      :deep(.el-input__inner) {
        background: rgba(0,0,0,0.2);
        border-color: #444;
        color: #ccc;
        height: 28px;
      }
    }
  }
}

.replay-content {
  display: flex;
  overflow: hidden;
  background-color: #000;
  // 高度由地图决定
  height: calc(min(1024px, 94vh - 70px)); 
}

.map-wrapper {
  height: 100%;
  aspect-ratio: 1 / 1;
  width: auto; // 宽度由比例自动决定
  position: relative;
  overflow: hidden;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0; 
}

.match-stats-overlay {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 1001;
  display: flex;
  gap: 15px;
  background-color: rgba(0, 0, 0, 0.4);
  padding: 4px 16px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
  pointer-events: none; // 防止遮挡地图点击

  .stat-item {
    display: flex;
    align-items: center;
    gap: 10px;

    .label {
      font-size: 13px;
      color: #999;
      font-weight: 800;
      letter-spacing: 1px;
    }

    .value {
      font-size: 20px;
      color: #fff;
      font-weight: 800;
      font-family: 'Roboto Mono', monospace;
    }
  }
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
  width: 350px;
  height: 100%; // 严格等于 replay-content 高度（即地图高度）
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  border-left: 1px solid #333;
  z-index: 1000;

  .player-list {
    flex: 6; // 占 6 份高度
    overflow: hidden;
    padding: 15px; 
  }

  .kill-feed {
    flex: 4; // 占 4 份高度，确保整体不溢出
    border-top: 1px solid #333;
    padding: 15px;
    overflow: hidden;
  }

  .section-title {
    font-size: 14px;
    font-weight: bold;
    color: #409eff;
    margin-bottom: 10px;
    flex-shrink: 0;
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
    display: flex;
    align-items: center;
    gap: 4px;

    .bot-tag {
      font-size: 10px;
      padding: 0 4px;
      background: #555;
      color: #aaa;
      border-radius: 2px;
      font-weight: bold;
      transform: scale(0.85);
      flex-shrink: 0;
    }
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

  .weapon-names {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;

    .weapon-name-tag {
      font-size: 10px;
      color: #eee;
      background: rgba(255, 255, 255, 0.1);
      padding: 1px 6px;
      border-radius: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-align: center;
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
  font-size: 11px;
  margin-bottom: 2px;
  padding: 3px 6px;
  cursor: pointer;
  border-radius: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;

  .time {
    color: #aaa;
    margin-right: 6px;
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    flex-shrink: 0;
  }

  .killer { color: #67c23a; font-weight: bold; flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; } 
  .victim { color: #eee; flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; }
  .action { margin: 0 4px; color: #888; flex-shrink: 0; }

  .team-no {
    color: #999;
    font-size: 10px;
    margin-right: 4px;
    font-style: italic;
    opacity: 0.8;
  }
  
  &.is-groggy {
    .action { color: #e6a23c; } 
  }

  &.is-revive {
    .action { color: #67c23a; } 
  }

  &.is-respawn {
    .killer { color: #409eff; }
    .action { color: #409eff; font-weight: bold; }
  }
}
</style>
