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
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon1]">
              <img v-if="playersState[hoveredPlayer].items.weapon1" 
                   :src="getItemImagePath(playersState[hoveredPlayer].items.weapon1)"
                   @error="(e: any) => e.target.style.display='none'" />
              <div class="empty-slot">1</div>
            </div>
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon2]">
              <img v-if="playersState[hoveredPlayer].items.weapon2" 
                   :src="getItemImagePath(playersState[hoveredPlayer].items.weapon2)"
                   @error="(e: any) => e.target.style.display='none'" />
              <div class="empty-slot">2</div>
            </div>
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon3]">
              <img v-if="playersState[hoveredPlayer].items.weapon3" 
                   :src="getItemImagePath(playersState[hoveredPlayer].items.weapon3)"
                   @error="(e: any) => e.target.style.display='none'" />
              <div class="empty-slot">3</div>
            </div>
            <div class="equip-slot weapon" :title="itemNames[playersState[hoveredPlayer].items.weapon4]">
              <img v-if="playersState[hoveredPlayer].items.weapon4" 
                   :src="getItemImagePath(playersState[hoveredPlayer].items.weapon4)"
                   @error="(e: any) => e.target.style.display='none'" />
              <div class="empty-slot">4</div>
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
import { ref, onMounted, onUnmounted, computed, nextTick, watch, markRaw } from 'vue'
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
    preferCanvas: true, 
    minZoom: -5, // 支持深度缩小
    maxZoom: 4,
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
      // 使用 {animate: false} 避免与手动交互冲突，并在跟随模式下才执行
      mapInstance.setView([-(smoothState.y / 100), smoothState.x / 100], mapInstance.getZoom(), { animate: false })
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
  const teamColors = ['#feca57', '#ff4d4f', '#54a0ff', '#1dd1a1']
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

  // 1. 核心映射表：解决遥测 ID 与素材文件名完全不一致的顽疾
  const ID_MAPPING: Record<string, string> = {
    // 狙击与步枪
    'Item_Weapon_Mosin_C': 'Item_Weapon_MosinNagant_C',
    'Item_Weapon_Winchester_C': 'Item_Weapon_Win1894_C',
    'Item_Weapon_Thompson_C': 'Item_Weapon_Thompson_C',
    'Item_Weapon_HK416_C': 'Item_Weapon_HK416_C',
    'Item_Weapon_M416_C': 'Item_Weapon_HK416_C',
    'Item_Weapon_SCAR-L_C': 'Item_Weapon_SCAR-L_C',
    // 微冲与手枪
    'Item_Weapon_UMP_C': 'Item_Weapon_UMP_C', 
    'Item_Weapon_Bizon_C': 'Item_Weapon_BizonPP19_C',
    'Item_Weapon_UZI_C': 'Item_Weapon_UZI_C',
    'Item_Weapon_M1911_C': 'Item_Weapon_M1911_C'
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
  try {
    loading.value = true
    const [matchData, telemetryData, itemsData] = await Promise.all([
      getMatchDetails(matchId),
      getMatchTelemetry(matchId),
      fetch('/assets/itemId.json').then(res => res.json())
    ])
    match.value = matchData
    // 使用 markRaw 彻底断开响应式链，减少数万个对象的内存占用
    rawTelemetry = markRaw(telemetryData)
    telemetry.value = rawTelemetry
    itemNames.value = itemsData

    if (rawTelemetry.length > 0) {
      // 预计算所有事件的时间戳
      const startTime = new Date(rawTelemetry[0]._D).getTime()
      eventTimestamps = rawTelemetry.map(e => new Date(e._D).getTime())

      const endTime = eventTimestamps[eventTimestamps.length - 1] || startTime
      maxTime.value = (endTime - startTime) / 1000

      // 预处理位置时间线，用于平滑移动插值
      preprocessTimelines()

      // 预处理空投数据
      preprocessAirdrops()

      // 寻找正式登机/比赛开始时间点
      const startEvent = rawTelemetry.find(e => e._T === 'LogMatchStart')
      if (startEvent) {
        matchStartTime.value = (new Date(startEvent._D).getTime() - startTime) / 1000
      }

      // 提取航线
      const planePoints: any[] = []
      rawTelemetry.forEach(e => {
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
    playbackTimer = requestAnimationFrame(playbackLoop)
  } catch (err) {
    console.error(err)
    ElMessage.error('获取遥测数据失败')
    loading.value = false
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
      if (!accountId || accountId === "" || accountId.startsWith('ai.')) return
      if (!playersData[name]) {
        playersData[name] = {
          name,
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
              killFeed.value.unshift({ killer: p.name, victim: '', action: '重新进入了战场', isRespawn: true, time: eventTime })
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
          killFeed.value.unshift({ killer: event.attacker?.name || 'Unknown', victim: event.victim.name, action: '击倒了', isGroggy: true, time: eventTime })
        }
        break
      case 'LogPlayerRevive':
        const reviver = event.reviver ? playersData[event.reviver.name] : null
        if (reviver) reviver.revives++
        const victimR = event.victim ? playersData[event.victim.name] : null
        if (victimR) {
          victimR.isAlive = true; victimR.hp = event.victim.health || 20
          killFeed.value.unshift({ killer: event.reviver?.name || 'Unknown', victim: event.victim.name, action: '扶起了', isRevive: true, time: eventTime })
        }
        break
      case 'LogPlayerKillV2':
        const killerK = event.killer ? playersData[event.killer.name] : null
        if (killerK) killerK.kills++
        const victimK = event.victim ? playersData[event.victim.name] : null
        if (victimK) {
          victimK.isAlive = false; victimK.hp = 0
          killFeed.value.unshift({ killer: event.killer?.name || 'Suicide', victim: event.victim.name, action: '淘汰了', time: eventTime })
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
            if (id.startsWith('Item_Head')) itemP.items.helmet = id
            else if (id.startsWith('Item_Armor')) itemP.items.vest = id
            else if (id.startsWith('Item_Back')) itemP.items.backpack = id
            else if (id.startsWith('Item_Weapon')) {
              const cat = WEAPON_CATEGORIES[id] || 'main'
              if (cat === 'handgun') itemP.items.weapon3 = id
              else if (cat === 'melee' || cat === 'throwable') itemP.items.weapon4 = id
              else {
                if (itemP.items.weapon1 !== id && itemP.items.weapon2 !== id) {
                  if (!itemP.items.weapon1) itemP.items.weapon1 = id
                  else itemP.items.weapon2 = id
                }
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

const playbackLoop = (now: number) => {
  if (!lastFrameTime) lastFrameTime = now
  const deltaTime = (now - lastFrameTime) / 1000
  lastFrameTime = now

  if (isPlaying.value) {
    currentTime.value += deltaTime * playSpeed.value
    if (currentTime.value >= maxTime.value) {
      currentTime.value = maxTime.value
      isPlaying.value = false
    }
    updateState(currentTime.value)
    updateMarkers()
  }

  playbackTimer = requestAnimationFrame(playbackLoop)
}

const togglePlay = () => { isPlaying.value = !isPlaying.value }
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
  isFollowing.value = true // 重新点选玩家时，恢复视角锁定
  const p = playersData[name]
  if (p && mapInstance) mapInstance.panTo([-(p.y / 100), p.x / 100], { animate: true })
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

const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') router.back() }
watch([focusedPlayer, hoveredPlayer], () => { if (!isPlaying.value) updateMarkers() })
const goToPlayer = (name: string) => { window.open(router.resolve(`/player/${name}`).href, '_blank') }

onMounted(() => { fetchData(); window.addEventListener('keydown', handleEsc); })
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
