<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore, type Track, type Clip } from '../stores/editorStore'

const editorStore = useEditorStore()

// Refs
const timelineRef = ref<HTMLDivElement | null>(null)
const tracksContainerRef = ref<HTMLDivElement | null>(null)
const isDraggingPlayhead = ref(false)
const localProgress = ref(0)
let animationFrameId: number | null = null

// 클립 드래그 상태
const draggingClip = ref<{ 
  id: string
  type: 'move' | 'trim-start' | 'trim-end'
  startX: number
  originalStart: number
  originalEnd: number
} | null>(null)

// 타임라인 설정
const PIXELS_PER_SECOND_BASE = 80
const TRACK_HEIGHT = 48
const HEADER_WIDTH = 120

// Computed
const pixelsPerSecond = computed(() => PIXELS_PER_SECOND_BASE * editorStore.timelineZoom)
const timelineWidth = computed(() => Math.max(editorStore.duration * pixelsPerSecond.value, 800))
const playheadPosition = computed(() => {
  const time = isDraggingPlayhead.value 
    ? (localProgress.value / 100) * editorStore.duration 
    : editorStore.currentTime
  return time * pixelsPerSecond.value
})

// 트랙 정렬 (비디오 → 오디오 → 텍스트)
const sortedTracks = computed(() => {
  return [...editorStore.tracks].sort((a, b) => {
    const order = { video: 0, audio: 1, text: 2 }
    return (order[a.type] - order[b.type]) || (a.order - b.order)
  })
})

// 시간 마커 생성
const timeMarkers = computed(() => {
  const markers: { time: number; label: string; major: boolean }[] = []
  const totalDuration = Math.max(editorStore.duration, 10)
  const interval = editorStore.timelineZoom > 2 ? 1 : editorStore.timelineZoom > 0.5 ? 5 : 10
  
  for (let t = 0; t <= totalDuration; t += interval) {
    markers.push({
      time: t,
      label: formatTime(t),
      major: t % (interval * 2) === 0
    })
  }
  return markers
})

// requestAnimationFrame을 사용한 부드러운 시간 업데이트
function startAnimationLoop() {
  const updateTime = () => {
    if (editorStore.videoElement && editorStore.isPlaying) {
      editorStore.updateTime(editorStore.videoElement.currentTime)
    }
    animationFrameId = requestAnimationFrame(updateTime)
  }
  animationFrameId = requestAnimationFrame(updateTime)
}

function stopAnimationLoop() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

watch(() => editorStore.isPlaying, (isPlaying) => {
  if (isPlaying) {
    startAnimationLoop()
  } else {
    stopAnimationLoop()
  }
})

// 플레이헤드 드래그
function handleRulerMouseDown(event: MouseEvent) {
  isDraggingPlayhead.value = true
  updatePlayheadPosition(event)
  document.addEventListener('mousemove', handleRulerMouseMove)
  document.addEventListener('mouseup', handleRulerMouseUp)
}

function handleRulerMouseMove(event: MouseEvent) {
  if (!isDraggingPlayhead.value) return
  updatePlayheadPosition(event)
}

function handleRulerMouseUp(event: MouseEvent) {
  if (!isDraggingPlayhead.value) return
  updatePlayheadPosition(event)
  const newTime = (localProgress.value / 100) * editorStore.duration
  editorStore.seek(newTime)
  isDraggingPlayhead.value = false
  document.removeEventListener('mousemove', handleRulerMouseMove)
  document.removeEventListener('mouseup', handleRulerMouseUp)
}

function updatePlayheadPosition(event: MouseEvent) {
  if (!timelineRef.value) return
  const rect = timelineRef.value.getBoundingClientRect()
  const x = event.clientX - rect.left - HEADER_WIDTH + editorStore.timelineScrollX
  const time = Math.max(0, Math.min(x / pixelsPerSecond.value, editorStore.duration))
  localProgress.value = (time / editorStore.duration) * 100
}

// 클립 스타일 계산
function getClipStyle(clip: Clip) {
  const left = clip.startTime * pixelsPerSecond.value
  const width = (clip.endTime - clip.startTime) * pixelsPerSecond.value
  return {
    left: `${left}px`,
    width: `${Math.max(width, 20)}px`
  }
}

// 클립 드래그 시작
function handleClipMouseDown(event: MouseEvent, clip: Clip, type: 'move' | 'trim-start' | 'trim-end') {
  event.stopPropagation()
  
  // 잠긴 트랙 확인
  const track = editorStore.getTrackByClipId(clip.id)
  if (track?.isLocked) return
  
  draggingClip.value = {
    id: clip.id,
    type,
    startX: event.clientX,
    originalStart: clip.startTime,
    originalEnd: clip.endTime
  }
  
  editorStore.selectClip(clip.id, event.shiftKey || event.ctrlKey)
  
  document.addEventListener('mousemove', handleClipDrag)
  document.addEventListener('mouseup', handleClipDragEnd)
}

function handleClipDrag(event: MouseEvent) {
  if (!draggingClip.value) return
  
  const deltaX = event.clientX - draggingClip.value.startX
  const deltaTime = deltaX / pixelsPerSecond.value
  
  if (draggingClip.value.type === 'move') {
    const newStart = Math.max(0, draggingClip.value.originalStart + deltaTime)
    editorStore.moveClip(draggingClip.value.id, newStart)
  } else if (draggingClip.value.type === 'trim-start') {
    const newStart = draggingClip.value.originalStart + deltaTime
    editorStore.trimClipStart(draggingClip.value.id, newStart)
  } else if (draggingClip.value.type === 'trim-end') {
    const newEnd = draggingClip.value.originalEnd + deltaTime
    editorStore.trimClipEnd(draggingClip.value.id, newEnd)
  }
}

function handleClipDragEnd() {
  draggingClip.value = null
  document.removeEventListener('mousemove', handleClipDrag)
  document.removeEventListener('mouseup', handleClipDragEnd)
}

// 클립 클릭
function handleClipClick(clip: Clip, event: MouseEvent) {
  editorStore.selectClip(clip.id, event.shiftKey || event.ctrlKey)
}

// 클립 더블클릭 (해당 시간으로 이동)
function handleClipDoubleClick(clip: Clip) {
  editorStore.seek(clip.startTime)
}

// 트랙 빈 영역 클릭
function handleTrackClick() {
  editorStore.deselectAll()
}

// 트랙 잠금 토글
function toggleTrackLock(track: Track) {
  editorStore.updateTrack(track.id, { isLocked: !track.isLocked })
}

// 트랙 표시 토글
function toggleTrackVisibility(track: Track) {
  editorStore.updateTrack(track.id, { isVisible: !track.isVisible })
}

// 줌
function handleWheel(event: WheelEvent) {
  if (event.ctrlKey) {
    event.preventDefault()
    if (event.deltaY < 0) {
      editorStore.zoomIn()
    } else {
      editorStore.zoomOut()
    }
  }
}

// 키보드 단축키
function handleKeyDown(event: KeyboardEvent) {
  // Split: S
  if (event.key === 's' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    editorStore.splitSelectedClipsAtPlayhead()
  }
  // Delete
  if (event.key === 'Delete') {
    if (editorStore.selectedClipIds.length > 0) {
      event.preventDefault()
      editorStore.deleteSelectedClips()
    }
  }
  // Undo: Ctrl+Z
  if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
    event.preventDefault()
    editorStore.undo()
  }
  // Redo: Ctrl+Y or Ctrl+Shift+Z
  if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
    event.preventDefault()
    editorStore.redo()
  }
  // Copy: Ctrl+C
  if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
    editorStore.copySelectedClips()
  }
  // Cut: Ctrl+X
  if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
    editorStore.cutSelectedClips()
  }
  // Paste: Ctrl+V
  if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
    editorStore.pasteClips()
  }
  // Duplicate: Ctrl+D
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault()
    editorStore.duplicateSelectedClips()
  }
  // Select All: Ctrl+A
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    event.preventDefault()
    editorStore.selectAllClips()
  }
  // Deselect: Escape
  if (event.key === 'Escape') {
    editorStore.deselectAll()
  }
  // Space: Play/Pause
  if (event.key === ' ' && event.target === document.body) {
    event.preventDefault()
    editorStore.togglePlay()
  }
  // Zoom: Ctrl + / Ctrl -
  if ((event.ctrlKey || event.metaKey) && event.key === '=') {
    event.preventDefault()
    editorStore.zoomIn()
  }
  if ((event.ctrlKey || event.metaKey) && event.key === '-') {
    event.preventDefault()
    editorStore.zoomOut()
  }
  // Zoom to Fit: Ctrl+0
  if ((event.ctrlKey || event.metaKey) && event.key === '0') {
    event.preventDefault()
    editorStore.zoomToFit()
  }
}

// 클립 색상
function getClipColor(clip: Clip): string {
  switch (clip.type) {
    case 'video': return clip.isSelected ? 'bg-indigo-500' : 'bg-indigo-600/70'
    case 'audio': return clip.isSelected ? 'bg-purple-500' : 'bg-purple-600/70'
    case 'text': return clip.isSelected ? 'bg-emerald-500' : 'bg-emerald-600/70'
    default: return 'bg-gray-500'
  }
}

// 트랙 아이콘
function getTrackIcon(type: string): string {
  switch (type) {
    case 'video': return '🎬'
    case 'audio': return '🎵'
    case 'text': return '📝'
    default: return '📁'
  }
}

// 클립 라벨
function getClipLabel(clip: Clip): string {
  if (clip.type === 'text') return clip.text
  if (clip.type === 'video' || clip.type === 'audio') return clip.fileName
  return ''
}

// Helpers
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

onMounted(() => {
  if (editorStore.isPlaying) {
    startAnimationLoop()
  }
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  stopAnimationLoop()
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleRulerMouseMove)
  document.removeEventListener('mouseup', handleRulerMouseUp)
  document.removeEventListener('mousemove', handleClipDrag)
  document.removeEventListener('mouseup', handleClipDragEnd)
})
</script>

<template>
  <div 
    v-if="editorStore.hasVideo"
    ref="timelineRef"
    class="timeline-container flex flex-col select-none"
    @wheel="handleWheel"
  >
    <!-- 툴바 -->
    <div class="flex items-center justify-between px-4 py-2 bg-gray-900/80 border-b border-gray-700/50">
      <!-- 왼쪽: 시간 표시 -->
      <div class="flex items-center gap-4">
        <span class="font-mono text-indigo-400 font-medium text-sm">
          {{ editorStore.formattedCurrentTime }}
        </span>
        <span class="text-gray-500">/</span>
        <span class="font-mono text-gray-400 text-sm">
          {{ editorStore.formattedDuration }}
        </span>
      </div>
      
      <!-- 중앙: 편집 버튼 -->
      <div class="flex items-center gap-2">
        <!-- Split -->
        <button
          @click="editorStore.splitSelectedClipsAtPlayhead"
          class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="분할 (S)"
          :disabled="editorStore.selectedClipIds.length === 0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m0-8h8m-8 0H4" />
          </svg>
        </button>
        
        <!-- Delete -->
        <button
          @click="editorStore.deleteSelectedClips"
          class="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-700/50 transition-colors"
          title="삭제 (Delete)"
          :disabled="editorStore.selectedClipIds.length === 0"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        
        <div class="w-px h-4 bg-gray-600 mx-1"></div>
        
        <!-- Undo -->
        <button
          @click="editorStore.undo"
          class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="실행 취소 (Ctrl+Z)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        
        <!-- Redo -->
        <button
          @click="editorStore.redo"
          class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="다시 실행 (Ctrl+Y)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>
      
      <!-- 오른쪽: 줌 컨트롤 -->
      <div class="flex items-center gap-2">
        <button
          @click="editorStore.zoomOut"
          class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="축소 (Ctrl+-)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
        </button>
        <span class="text-xs text-gray-400 w-12 text-center">{{ Math.round(editorStore.timelineZoom * 100) }}%</span>
        <button
          @click="editorStore.zoomIn"
          class="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="확대 (Ctrl+=)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          @click="editorStore.zoomToFit"
          class="px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="전체 맞춤 (Ctrl+0)"
        >
          Fit
        </button>
        
        <div class="w-px h-4 bg-gray-600 mx-1"></div>
        
        <!-- Snapping -->
        <button
          @click="editorStore.toggleSnapping"
          class="p-1.5 rounded transition-colors"
          :class="editorStore.isSnappingEnabled ? 'text-indigo-400 bg-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'"
          title="스냅핑"
        >
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2v6m0 8v6M2 12h6m8 0h6" />
          </svg>
        </button>
      </div>
    </div>
    
    <!-- 시간 눈금자 -->
    <div class="flex">
      <div class="w-[120px] flex-shrink-0 bg-gray-900/60"></div>
      <div 
        class="ruler relative h-6 bg-gray-800/60 overflow-hidden cursor-pointer flex-1"
        @mousedown="handleRulerMouseDown"
      >
        <div 
          class="absolute top-0 bottom-0"
          :style="{ width: `${timelineWidth}px`, transform: `translateX(-${editorStore.timelineScrollX}px)` }"
        >
          <!-- 시간 마커 -->
          <div
            v-for="marker in timeMarkers"
            :key="marker.time"
            class="absolute top-0 bottom-0 flex flex-col items-center"
            :style="{ left: `${marker.time * pixelsPerSecond}px` }"
          >
            <div 
              class="w-px bg-gray-600"
              :class="marker.major ? 'h-full' : 'h-2'"
            ></div>
            <span v-if="marker.major" class="text-[9px] text-gray-500 mt-0.5">{{ marker.label }}</span>
          </div>
          
          <!-- 플레이헤드 -->
          <div 
            class="playhead absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
            :style="{ left: `${playheadPosition}px` }"
          >
            <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 트랙 영역 -->
    <div 
      ref="tracksContainerRef"
      class="flex-1 overflow-y-auto overflow-x-hidden"
    >
      <div 
        v-for="track in sortedTracks"
        :key="track.id"
        class="flex border-b border-gray-700/30"
        :style="{ height: `${TRACK_HEIGHT}px` }"
      >
        <!-- 트랙 헤더 -->
        <div 
          class="w-[120px] flex-shrink-0 flex items-center gap-2 px-2 bg-gray-900/60 border-r border-gray-700/30"
        >
          <!-- 트랙 아이콘 -->
          <span class="text-sm">{{ getTrackIcon(track.type) }}</span>
          
          <!-- 트랙 이름 -->
          <span class="text-xs text-gray-300 truncate flex-1">{{ track.name }}</span>
          
          <!-- 트랙 컨트롤 -->
          <button
            @click="toggleTrackVisibility(track)"
            class="p-0.5 rounded hover:bg-gray-700/50"
            :class="track.isVisible ? 'text-gray-400' : 'text-gray-600'"
            title="표시/숨김"
          >
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path v-if="track.isVisible" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              <path v-else d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
            </svg>
          </button>
          <button
            @click="toggleTrackLock(track)"
            class="p-0.5 rounded hover:bg-gray-700/50"
            :class="track.isLocked ? 'text-yellow-500' : 'text-gray-600'"
            title="잠금"
          >
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path v-if="track.isLocked" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              <path v-else d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
            </svg>
          </button>
        </div>
        
        <!-- 트랙 클립 영역 -->
        <div 
          class="relative flex-1 overflow-hidden"
          :class="track.isLocked ? 'bg-gray-800/30' : 'bg-gray-800/50'"
          @click="handleTrackClick"
        >
          <div 
            class="absolute top-0 bottom-0"
            :style="{ width: `${timelineWidth}px`, transform: `translateX(-${editorStore.timelineScrollX}px)` }"
          >
            <!-- 클립들 -->
            <div
              v-for="clip in track.clips"
              :key="clip.id"
              class="clip absolute top-1 bottom-1 rounded cursor-pointer transition-shadow"
              :class="[
                getClipColor(clip),
                clip.isSelected ? 'ring-2 ring-white shadow-lg z-10' : 'hover:brightness-110',
                track.isLocked ? 'opacity-50 cursor-not-allowed' : ''
              ]"
              :style="getClipStyle(clip)"
              @click.stop="handleClipClick(clip, $event)"
              @dblclick="handleClipDoubleClick(clip)"
              @mousedown="handleClipMouseDown($event, clip, 'move')"
            >
              <!-- 트림 핸들: 왼쪽 -->
              <div 
                v-if="!track.isLocked"
                class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 rounded-l"
                @mousedown.stop="handleClipMouseDown($event, clip, 'trim-start')"
              />
              
              <!-- 클립 라벨 -->
              <div class="absolute inset-0 flex items-center justify-center overflow-hidden px-3">
                <span class="text-[10px] text-white font-medium truncate">
                  {{ getClipLabel(clip) }}
                </span>
              </div>
              
              <!-- 트림 핸들: 오른쪽 -->
              <div 
                v-if="!track.isLocked"
                class="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 rounded-r"
                @mousedown.stop="handleClipMouseDown($event, clip, 'trim-end')"
              />
            </div>
            
            <!-- 플레이헤드 연장선 -->
            <div 
              class="absolute top-0 bottom-0 w-0.5 bg-red-500/50 pointer-events-none z-10"
              :style="{ left: `${playheadPosition}px` }"
            />
          </div>
        </div>
      </div>
      
      <!-- 빈 상태 -->
      <div 
        v-if="sortedTracks.length === 0"
        class="flex items-center justify-center h-32 text-gray-500 text-sm"
      >
        트랙이 없습니다
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  background: linear-gradient(180deg, rgba(17, 17, 27, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%);
  border-top: 1px solid rgba(99, 102, 241, 0.2);
  height: 280px;
}

.ruler {
  background: linear-gradient(180deg, rgba(30, 30, 40, 0.8) 0%, rgba(20, 20, 30, 0.9) 100%);
}

.playhead {
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
}

.clip {
  min-width: 20px;
}

.clip:active {
  cursor: grabbing;
}
</style>
