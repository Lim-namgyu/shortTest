<script setup lang="ts">
import { useEditorStore } from './stores/editorStore'
import VideoUploader from './components/VideoUploader.vue'
import PixiCanvas from './components/PixiCanvas.vue'
import VideoControls from './components/VideoControls.vue'
import Timeline from './components/Timeline.vue'
import PropertyPanel from './components/PropertyPanel.vue'

const editorStore = useEditorStore()
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-3 border-b border-gray-700/50 bg-black/20 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h1 class="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Video Editor
          </h1>
          <p class="text-[10px] text-gray-500">Powered by Pixi.js</p>
        </div>
      </div>
      
      <!-- File info -->
      <div v-if="editorStore.videoFile" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
        <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
        <span class="text-sm text-gray-300 max-w-[200px] truncate">
          {{ editorStore.videoFile.name }}
        </span>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Left: Video Canvas & Timeline -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Video Canvas Area -->
        <div class="flex-1 relative p-4 pb-2">
          <PixiCanvas class="w-full h-full min-h-[300px]" />
        </div>

        <!-- Timeline -->
        <Timeline />

        <!-- Bottom Controls -->
        <div class="p-4 pt-2 space-y-3">
          <!-- Video Controls -->
          <VideoControls />
          
          <!-- Uploader (only show when no video) -->
          <div v-if="!editorStore.hasVideo" class="max-w-xl mx-auto w-full">
            <VideoUploader />
          </div>
        </div>
      </div>
      
      <!-- Right: Property Panel (only show when video loaded) -->
      <PropertyPanel v-if="editorStore.hasVideo" />
    </main>

    <!-- Footer -->
    <footer class="px-6 py-2 text-center text-[10px] text-gray-500 border-t border-gray-700/50 bg-black/20">
      Vue 3 + Pixi.js + Tailwind CSS | Clipchamp Clone
    </footer>
  </div>
</template>
