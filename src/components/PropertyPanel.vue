<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useEditorStore, type VideoClip, type AudioClip, type TextClip } from '../stores/editorStore'

const editorStore = useEditorStore()

// 현재 선택된 클립
const selectedClip = computed(() => editorStore.selectedClip)
const clipType = computed(() => selectedClip.value?.type)

// 로컬 상태 (실시간 업데이트용)
const localValues = ref({
  // Video/Text Transform
  x: 0,
  y: 0,
  scale: 100,
  rotation: 0,
  flipX: false,
  flipY: false,
  opacity: 100,
  speed: 1,
  // Filters
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  blur: 0,
  preset: 'none',
  // Audio
  volume: 100,
  fadeIn: 0,
  fadeOut: 0,
  isMuted: false,
  // Text
  text: '',
  fontSize: 32,
  color: '#ffffff',
  bold: false,
  italic: false,
  // Text Animation
  animInType: 'none',
  animInDuration: 0.5,
  animOutType: 'none',
  animOutDuration: 0.5,
})

// 선택된 클립 변경 시 로컬 값 동기화
watch(selectedClip, (clip) => {
  if (!clip) return
  
  if (clip.type === 'video') {
    const vc = clip as VideoClip
    localValues.value.x = vc.x
    localValues.value.y = vc.y
    localValues.value.scale = Math.round(vc.scale * 100)
    localValues.value.rotation = vc.rotation
    localValues.value.flipX = vc.flipX
    localValues.value.flipY = vc.flipY
    localValues.value.opacity = Math.round(vc.opacity * 100)
    localValues.value.speed = vc.speed
    // Filters
    localValues.value.brightness = vc.filters.brightness
    localValues.value.contrast = vc.filters.contrast
    localValues.value.saturation = vc.filters.saturation
    localValues.value.hue = vc.filters.hue
    localValues.value.blur = vc.filters.blur
    localValues.value.preset = vc.filters.preset
  } else if (clip.type === 'audio') {
    const ac = clip as AudioClip
    localValues.value.volume = Math.round(ac.volume * 100)
    localValues.value.fadeIn = ac.fadeIn
    localValues.value.fadeOut = ac.fadeOut
    localValues.value.isMuted = ac.isMuted
  } else if (clip.type === 'text') {
    const tc = clip as TextClip
    localValues.value.x = tc.x
    localValues.value.y = tc.y
    localValues.value.text = tc.text
    localValues.value.fontSize = tc.fontSize
    localValues.value.color = tc.color
    localValues.value.bold = tc.bold
    localValues.value.italic = tc.italic
    // Animation
    localValues.value.animInType = tc.animationIn?.type || 'none'
    localValues.value.animInDuration = tc.animationIn?.duration || 0.5
    localValues.value.animOutType = tc.animationOut?.type || 'none'
    localValues.value.animOutDuration = tc.animationOut?.duration || 0.5
  }
}, { immediate: true })

// ============================================
// Video Transform 업데이트
// ============================================

function updatePosition() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, {
    x: localValues.value.x,
    y: localValues.value.y
  })
}

function updateScale() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, {
    scale: localValues.value.scale / 100
  })
}

function updateRotation() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, {
    rotation: localValues.value.rotation
  })
}

function rotateBy(degrees: number) {
  localValues.value.rotation = (localValues.value.rotation + degrees) % 360
  updateRotation()
}

function resetRotation() {
  localValues.value.rotation = 0
  updateRotation()
}

function toggleFlipX() {
  if (!selectedClip.value) return
  localValues.value.flipX = !localValues.value.flipX
  editorStore.updateClip(selectedClip.value.id, { flipX: localValues.value.flipX })
}

function toggleFlipY() {
  if (!selectedClip.value) return
  localValues.value.flipY = !localValues.value.flipY
  editorStore.updateClip(selectedClip.value.id, { flipY: localValues.value.flipY })
}

function updateOpacity() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, {
    opacity: localValues.value.opacity / 100
  })
}

// ============================================
// Speed 업데이트
// ============================================

function updateSpeed() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, {
    speed: localValues.value.speed
  })
}

const speedPresets = [0.25, 0.5, 1, 1.5, 2, 4, 8]

function setSpeedPreset(speed: number) {
  localValues.value.speed = speed
  updateSpeed()
  updateSpeed()
}

// ============================================
// Filter 업데이트
// ============================================

function updateFilter(key: 'brightness' | 'contrast' | 'saturation' | 'hue' | 'blur' | 'preset') {
  if (!selectedClip.value) return
  const currentFilters = (selectedClip.value as VideoClip).filters || {}
  editorStore.updateClip(selectedClip.value.id, {
    filters: {
      ...currentFilters,
      [key]: localValues.value[key]
    }
  })
}

const filterPresets = [
  { label: 'None', value: 'none' },
  { label: 'Sepia', value: 'sepia' },
  { label: 'B&W', value: 'grayscale' },
  { label: 'Vintage', value: 'vintage' },
  { label: 'Polaroid', value: 'polaroid' },
  { label: 'Techni', value: 'technicolor' },
  { label: 'Koda', value: 'kodachrome' },
  { label: 'Browni', value: 'browni' },
  { label: 'BGR', value: 'toBGR' },
]

// ============================================
// Audio 업데이트
// ============================================

function updateVolume() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, {
    volume: localValues.value.volume / 100
  })
}

function toggleMute() {
  if (!selectedClip.value) return
  localValues.value.isMuted = !localValues.value.isMuted
  editorStore.updateClip(selectedClip.value.id, { isMuted: localValues.value.isMuted })
}

function updateFadeIn() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, { fadeIn: localValues.value.fadeIn })
}

function updateFadeOut() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, { fadeOut: localValues.value.fadeOut })
}

// ============================================
// Text 업데이트
// ============================================

function updateText() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, { text: localValues.value.text })
}

function updateFontSize() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, { fontSize: localValues.value.fontSize })
}

function updateColor() {
  if (!selectedClip.value) return
  editorStore.updateClip(selectedClip.value.id, { color: localValues.value.color })
}

function toggleBold() {
  if (!selectedClip.value) return
  localValues.value.bold = !localValues.value.bold
  editorStore.updateClip(selectedClip.value.id, { bold: localValues.value.bold })
}

function toggleItalic() {
  if (!selectedClip.value) return
  localValues.value.italic = !localValues.value.italic
  editorStore.updateClip(selectedClip.value.id, { italic: localValues.value.italic })
}

function updateAnimation(direction: 'in' | 'out') {
  if (!selectedClip.value) return
  
  if (direction === 'in') {
    editorStore.updateClip(selectedClip.value.id, {
      animationIn: {
        type: localValues.value.animInType as any,
        duration: localValues.value.animInDuration
      }
    })
  } else {
    editorStore.updateClip(selectedClip.value.id, {
      animationOut: {
        type: localValues.value.animOutType as any,
        duration: localValues.value.animOutDuration
      }
    })
  }
}

const animationTypes = [
  { label: '없음', value: 'none' },
  { label: '페이드', value: 'fade' },
  { label: '슬라이드', value: 'slide' },
  { label: '확대/축소', value: 'scale' },
  { label: '타자기', value: 'typewriter' }
]

// 클립 유형 아이콘
function getClipIcon(type: string): string {
  switch (type) {
    case 'video': return '🎬'
    case 'audio': return '🎵'
    case 'text': return '📝'
    default: return '📁'
  }
}
</script>

<template>
  <div class="property-panel h-full overflow-y-auto bg-gray-900/90 border-l border-gray-700/50">
    <!-- 헤더 -->
    <div class="p-4 border-b border-gray-700/50">
      <div v-if="selectedClip" class="flex items-center gap-2">
        <span class="text-lg">{{ getClipIcon(selectedClip.type) }}</span>
        <span class="text-sm font-medium text-white capitalize">{{ selectedClip.type }} 속성</span>
      </div>
      <div v-else class="text-sm text-gray-500">
        클립을 선택하세요
      </div>
    </div>
    
    <div v-if="selectedClip" class="p-4 space-y-6">
      <!-- ============================================ -->
      <!-- Video Properties -->
      <!-- ============================================ -->
      <template v-if="clipType === 'video'">
        <!-- Transform Section -->
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">변환</h3>
          
          <!-- Position -->
          <div class="space-y-2 mb-4">
            <label class="text-xs text-gray-400">위치</label>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500 w-4">X</span>
                <input 
                  v-model.number="localValues.x"
                  type="number"
                  class="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                  @change="updatePosition"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500 w-4">Y</span>
                <input 
                  v-model.number="localValues.y"
                  type="number"
                  class="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                  @change="updatePosition"
                />
              </div>
            </div>
          </div>
          
          <!-- Scale -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">크기</label>
              <span class="text-xs text-indigo-400">{{ localValues.scale }}%</span>
            </div>
            <input 
              v-model.number="localValues.scale"
              type="range"
              min="10"
              max="400"
              class="w-full accent-indigo-500"
              @input="updateScale"
            />
          </div>
          
          <!-- Rotation -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">회전</label>
              <span class="text-xs text-indigo-400">{{ localValues.rotation }}°</span>
            </div>
            <input 
              v-model.number="localValues.rotation"
              type="range"
              min="0"
              max="360"
              class="w-full accent-indigo-500"
              @input="updateRotation"
            />
            <div class="flex gap-1 mt-1">
              <button 
                @click="rotateBy(-90)"
                class="flex-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
              >
                -90°
              </button>
              <button 
                @click="resetRotation"
                class="flex-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
              >
                0°
              </button>
              <button 
                @click="rotateBy(90)"
                class="flex-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors"
              >
                +90°
              </button>
            </div>
          </div>
          
          <!-- Flip -->
          <div class="space-y-2 mb-4">
            <label class="text-xs text-gray-400">반전</label>
            <div class="flex gap-2">
              <button 
                @click="toggleFlipX"
                class="flex-1 px-3 py-2 rounded text-sm transition-colors"
                :class="localValues.flipX ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
              >
                ↔ 수평
              </button>
              <button 
                @click="toggleFlipY"
                class="flex-1 px-3 py-2 rounded text-sm transition-colors"
                :class="localValues.flipY ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
              >
                ↕ 수직
              </button>
            </div>
          </div>
          
          <!-- Opacity -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">투명도</label>
              <span class="text-xs text-indigo-400">{{ localValues.opacity }}%</span>
            </div>
            <input 
              v-model.number="localValues.opacity"
              type="range"
              min="0"
              max="100"
              class="w-full accent-indigo-500"
              @input="updateOpacity"
            />
          </div>
        </section>
        
        <hr class="border-gray-700/50" />
        
        <!-- Speed Section -->
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">속도</h3>
          
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">재생 속도</label>
              <span class="text-xs text-indigo-400">{{ localValues.speed }}x</span>
            </div>
            <input 
              v-model.number="localValues.speed"
              type="range"
              min="0.1"
              max="16"
              step="0.1"
              class="w-full accent-indigo-500"
              @input="updateSpeed"
            />
            <div class="flex gap-1 flex-wrap mt-1">
              <button 
                v-for="preset in speedPresets"
                :key="preset"
                @click="setSpeedPreset(preset)"
                class="px-2 py-1 rounded text-xs transition-colors"
                :class="localValues.speed === preset ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
              >
                {{ preset }}x
              </button>
            </div>
          </div>

        </section>
        
        <hr class="border-gray-700/50" />
        
        <!-- Filter Section -->
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">색상 보정</h3>
          
          <!-- Brightness -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">밝기</label>
              <span class="text-xs text-indigo-400">{{ localValues.brightness }}</span>
            </div>
            <input 
              v-model.number="localValues.brightness"
              type="range"
              min="-100"
              max="100"
              class="w-full accent-indigo-500"
              @input="updateFilter('brightness')"
            />
          </div>

          <!-- Contrast -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">대비</label>
              <span class="text-xs text-indigo-400">{{ localValues.contrast }}</span>
            </div>
            <input 
              v-model.number="localValues.contrast"
              type="range"
              min="-100"
              max="100"
              class="w-full accent-indigo-500"
              @input="updateFilter('contrast')"
            />
          </div>

          <!-- Saturation -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">채도</label>
              <span class="text-xs text-indigo-400">{{ localValues.saturation }}</span>
            </div>
            <input 
              v-model.number="localValues.saturation"
              type="range"
              min="-100"
              max="100"
              class="w-full accent-indigo-500"
              @input="updateFilter('saturation')"
            />
          </div>
          
          <!-- Hue -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">색조</label>
              <span class="text-xs text-indigo-400">{{ localValues.hue }}°</span>
            </div>
            <input 
              v-model.number="localValues.hue"
              type="range"
              min="-180"
              max="180"
              class="w-full accent-indigo-500"
              @input="updateFilter('hue')"
            />
          </div>
          
          <!-- Presets -->
          <div class="space-y-2">
            <label class="text-xs text-gray-400">필터 프리셋</label>
            <div class="grid grid-cols-3 gap-1">
              <button 
                v-for="preset in filterPresets"
                :key="preset.value"
                @click="() => { localValues.preset = preset.value; updateFilter('preset') }"
                class="px-2 py-1.5 rounded text-[10px] transition-colors truncate"
                :class="localValues.preset === preset.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
                :title="preset.label"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>
        </section>
      </template>
      
      <!-- ============================================ -->
      <!-- Audio Properties -->
      <!-- ============================================ -->
      <template v-else-if="clipType === 'audio'">
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">볼륨</h3>
          
          <!-- Volume -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">볼륨</label>
              <span class="text-xs text-purple-400">{{ localValues.volume }}%</span>
            </div>
            <input 
              v-model.number="localValues.volume"
              type="range"
              min="0"
              max="200"
              class="w-full accent-purple-500"
              @input="updateVolume"
            />
          </div>
          
          <!-- Mute -->
          <button 
            @click="toggleMute"
            class="w-full px-3 py-2 rounded text-sm transition-colors mb-4"
            :class="localValues.isMuted ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
          >
            {{ localValues.isMuted ? '🔇 음소거됨' : '🔊 음소거' }}
          </button>
        </section>
        
        <hr class="border-gray-700/50" />
        
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">페이드</h3>
          
          <!-- Fade In -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">페이드 인</label>
              <span class="text-xs text-purple-400">{{ localValues.fadeIn }}초</span>
            </div>
            <input 
              v-model.number="localValues.fadeIn"
              type="range"
              min="0"
              max="10"
              step="0.1"
              class="w-full accent-purple-500"
              @input="updateFadeIn"
            />
          </div>
          
          <!-- Fade Out -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">페이드 아웃</label>
              <span class="text-xs text-purple-400">{{ localValues.fadeOut }}초</span>
            </div>
            <input 
              v-model.number="localValues.fadeOut"
              type="range"
              min="0"
              max="10"
              step="0.1"
              class="w-full accent-purple-500"
              @input="updateFadeOut"
            />
          </div>
        </section>
      </template>
      
      <!-- ============================================ -->
      <!-- Text Properties -->
      <!-- ============================================ -->
      <template v-else-if="clipType === 'text'">
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">텍스트</h3>
          
          <!-- Text Content -->
          <div class="space-y-2 mb-4">
            <label class="text-xs text-gray-400">내용</label>
            <textarea 
              v-model="localValues.text"
              class="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
              rows="3"
              @input="updateText"
            ></textarea>
          </div>
          
          <!-- Font Size -->
          <div class="space-y-2 mb-4">
            <div class="flex items-center justify-between">
              <label class="text-xs text-gray-400">글자 크기</label>
              <span class="text-xs text-emerald-400">{{ localValues.fontSize }}px</span>
            </div>
            <input 
              v-model.number="localValues.fontSize"
              type="range"
              min="12"
              max="200"
              class="w-full accent-emerald-500"
              @input="updateFontSize"
            />
          </div>
          
          <!-- Color -->
          <div class="space-y-2 mb-4">
            <label class="text-xs text-gray-400">색상</label>
            <div class="flex items-center gap-2">
              <input 
                v-model="localValues.color"
                type="color"
                class="w-10 h-10 rounded cursor-pointer"
                @input="updateColor"
              />
              <input 
                v-model="localValues.color"
                type="text"
                class="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                @change="updateColor"
              />
            </div>
          </div>
          
          <!-- Style -->
          <div class="space-y-2 mb-4">
            <label class="text-xs text-gray-400">스타일</label>
            <div class="flex gap-2">
              <button 
                @click="toggleBold"
                class="flex-1 px-3 py-2 rounded text-sm font-bold transition-colors"
                :class="localValues.bold ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
              >
                B
              </button>
              <button 
                @click="toggleItalic"
                class="flex-1 px-3 py-2 rounded text-sm italic transition-colors"
                :class="localValues.italic ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'"
              >
                I
              </button>
            </div>
          </div>
        </section>
        
        <hr class="border-gray-700/50" />
        
        <!-- Position -->
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">위치</h3>
          <div class="grid grid-cols-2 gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-4">X</span>
              <input 
                v-model.number="localValues.x"
                type="number"
                class="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                @change="updatePosition"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-4">Y</span>
              <input 
                v-model.number="localValues.y"
                type="number"
                class="w-full px-2 py-1 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                @change="updatePosition"
              />
            </div>
          </div>
      </section>
        
        <hr class="border-gray-700/50" />
        
        <!-- Animation Section -->
        <section>
          <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">애니메이션</h3>
          
          <!-- In Animation -->
          <div class="space-y-3 mb-4">
            <label class="text-xs text-emerald-400 font-medium">등장 효과 (In)</label>
            <div class="space-y-2">
              <select 
                v-model="localValues.animInType"
                @change="updateAnimation('in')"
                class="w-full px-2 py-1.5 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option v-for="type in animationTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
              
              <div v-if="localValues.animInType !== 'none'" class="flex items-center gap-2">
                <span class="text-xs text-gray-500 w-8">시간</span>
                <input 
                  v-model.number="localValues.animInDuration"
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  class="flex-1 accent-emerald-500"
                  @input="updateAnimation('in')"
                />
                <span class="text-xs text-gray-400 w-8 text-right">{{ localValues.animInDuration }}s</span>
              </div>
            </div>
          </div>

          <!-- Out Animation -->
          <div class="space-y-3">
            <label class="text-xs text-red-400 font-medium">퇴장 효과 (Out)</label>
            <div class="space-y-2">
              <select 
                v-model="localValues.animOutType"
                @change="updateAnimation('out')"
                class="w-full px-2 py-1.5 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option v-for="type in animationTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
              
              <div v-if="localValues.animOutType !== 'none'" class="flex items-center gap-2">
                <span class="text-xs text-gray-500 w-8">시간</span>
                <input 
                  v-model.number="localValues.animOutDuration"
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  class="flex-1 accent-emerald-500"
                  @input="updateAnimation('out')"
                />
                <span class="text-xs text-gray-400 w-8 text-right">{{ localValues.animOutDuration }}s</span>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
    
    <!-- 아무것도 선택되지 않았을 때 -->
    <div v-else class="flex-1 flex items-center justify-center p-8 text-gray-500 text-center">
      <div>
        <p class="text-sm mb-2">타임라인에서 클립을 선택하면</p>
        <p class="text-sm">여기에 속성이 표시됩니다</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.property-panel {
  width: 280px;
  background: linear-gradient(180deg, rgba(17, 17, 27, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%);
}

input[type="range"] {
  height: 4px;
  border-radius: 2px;
}

input[type="color"] {
  -webkit-appearance: none;
  border: 2px solid #374151;
  background: none;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}
</style>
