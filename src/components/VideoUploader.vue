<script setup lang="ts">
import { ref } from 'vue'
import { useEditorStore } from '../stores/editorStore'

const editorStore = useEditorStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file && file.type.startsWith('video/')) {
    editorStore.setVideoFile(file)
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false
  
  const file = event.dataTransfer?.files[0]
  if (file && file.type.startsWith('video/')) {
    editorStore.setVideoFile(file)
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function triggerFileInput() {
  fileInput.value?.click()
}
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer group"
    :class="[
      isDragging 
        ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]' 
        : 'border-gray-600 hover:border-indigo-500 hover:bg-indigo-500/5'
    ]"
    @click="triggerFileInput"
    @drop="handleDrop"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
  >
    <input
      ref="fileInput"
      type="file"
      accept="video/*"
      class="hidden"
      @change="handleFileSelect"
    />
    
    <!-- Upload Icon -->
    <div class="mb-4 p-4 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-all duration-300">
      <svg 
        class="w-12 h-12 text-indigo-400 group-hover:text-indigo-300 transition-colors" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          stroke-width="2" 
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
    </div>
    
    <!-- Text -->
    <h3 class="text-lg font-semibold text-gray-200 mb-2">
      비디오 파일 업로드
    </h3>
    <p class="text-sm text-gray-400 text-center">
      클릭하거나 파일을 드래그하여 업로드하세요
    </p>
    <p class="text-xs text-gray-500 mt-2">
      지원 형식: MP4, WebM, MOV, AVI
    </p>

    <!-- Animated border effect -->
    <div 
      v-if="isDragging"
      class="absolute inset-0 rounded-2xl animate-pulse bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10"
    />
  </div>
</template>
