<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEditorStore } from '../stores/editorStore'

const editorStore = useEditorStore()
const isEditingText = ref(false)
const editTextValue = ref('')

const selectedText = computed(() => editorStore.selectedText)

function handleProgressClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  const newTime = percent * editorStore.duration
  editorStore.seek(newTime)
}

function handleAddText() {
  editorStore.addText()
}

function startEditText() {
  if (selectedText.value) {
    editTextValue.value = selectedText.value.text
    isEditingText.value = true
  }
}

function saveTextEdit() {
  if (selectedText.value && editTextValue.value.trim()) {
    editorStore.updateText(selectedText.value.id, { text: editTextValue.value.trim() })
  }
  isEditingText.value = false
}

function deleteSelectedText() {
  if (selectedText.value) {
    editorStore.removeText(selectedText.value.id)
  }
}

watch(selectedText, (newVal) => {
  if (newVal) {
    editTextValue.value = newVal.text
  }
})
</script>

<template>
  <div 
    v-if="editorStore.hasVideo"
    class="flex flex-col gap-4 p-6 rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm border border-gray-700/50 shadow-xl"
  >
    <!-- Progress Bar -->
    <div 
      class="relative h-2 bg-gray-700 rounded-full cursor-pointer overflow-hidden group"
      @click="handleProgressClick"
    >
      <!-- Progress fill -->
      <div 
        class="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-100"
        :style="{ width: `${editorStore.progress}%` }"
      />
      <!-- Hover effect -->
      <div class="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
    </div>

    <!-- Controls -->
    <div class="flex items-center justify-between">
      <!-- Left: Time display -->
      <div class="flex items-center gap-2 text-sm text-gray-300 font-mono">
        <span>{{ editorStore.formattedCurrentTime }}</span>
        <span class="text-gray-500">/</span>
        <span class="text-gray-400">{{ editorStore.formattedDuration }}</span>
      </div>

      <!-- Center: Play/Pause Button -->
      <div class="flex items-center gap-3">
        <!-- Add Text Button -->
        <button
          @click="handleAddText"
          class="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
          title="텍스트 추가"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          텍스트
        </button>

        <!-- Play/Pause -->
        <button
          @click="editorStore.togglePlay"
          class="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-105 active:scale-95 group"
        >
          <!-- Play icon -->
          <svg 
            v-if="!editorStore.isPlaying"
            class="w-6 h-6 text-white ml-1 group-hover:scale-110 transition-transform" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <!-- Pause icon -->
          <svg 
            v-else
            class="w-6 h-6 text-white group-hover:scale-110 transition-transform" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
          
          <!-- Pulse effect when playing -->
          <div 
            v-if="editorStore.isPlaying"
            class="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20"
          />
        </button>
      </div>

      <!-- Right: Additional controls -->
      <div class="flex items-center gap-3">
        <button
          @click="editorStore.reset"
          class="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all duration-200"
          title="비디오 제거"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Text Edit Panel (선택된 텍스트 있을 때) -->
    <div 
      v-if="selectedText"
      class="flex items-center gap-3 p-3 rounded-lg bg-gray-700/50 border border-emerald-500/30"
    >
      <svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      
      <input
        v-if="isEditingText"
        v-model="editTextValue"
        @blur="saveTextEdit"
        @keyup.enter="saveTextEdit"
        class="flex-1 px-3 py-1.5 rounded bg-gray-800 border border-gray-600 text-white text-sm focus:outline-none focus:border-emerald-500"
        placeholder="텍스트 입력..."
        autofocus
      />
      <span 
        v-else
        @click="startEditText"
        class="flex-1 text-sm text-gray-200 cursor-pointer hover:text-white truncate"
      >
        {{ selectedText.text }}
      </span>
      
      <button
        @click="startEditText"
        class="p-1.5 rounded text-gray-400 hover:text-emerald-400 hover:bg-gray-600/50 transition-colors"
        title="텍스트 편집"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      
      <button
        @click="deleteSelectedText"
        class="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-600/50 transition-colors"
        title="텍스트 삭제"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
</template>

