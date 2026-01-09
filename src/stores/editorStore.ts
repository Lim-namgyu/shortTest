import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ============================================
// 타입 정의
// ============================================

// 트랙 타입
export type TrackType = 'video' | 'audio' | 'text'

// 기본 클립 인터페이스
export interface BaseClip {
    id: string
    trackId: string
    startTime: number      // 타임라인 상 시작 시간
    endTime: number        // 타임라인 상 끝 시간
    sourceStartTime: number // 원본 미디어의 시작 오프셋
    duration: number       // 클립 길이
    isSelected: boolean
}

// 비디오 클립
export interface VideoClip extends BaseClip {
    type: 'video'
    src: string            // Blob URL
    fileName: string
    originalDuration: number
    thumbnails?: string[]  // 썸네일 이미지 배열
    // Transform
    x: number
    y: number
    scale: number
    rotation: number
    flipX: boolean
    flipY: boolean
    // Effects
    speed: number
    opacity: number
    filters: VideoFilters
}

// 오디오 클립
export interface AudioClip extends BaseClip {
    type: 'audio'
    src: string
    fileName: string
    originalDuration: number
    waveform?: number[]    // 파형 데이터
    // Audio settings
    volume: number         // 0 ~ 2 (0% ~ 200%)
    fadeIn: number         // 페이드 인 시간 (초)
    fadeOut: number        // 페이드 아웃 시간 (초)
    isMuted: boolean
}

// 텍스트 클립
export interface TextClip extends BaseClip {
    type: 'text'
    text: string
    x: number
    y: number
    fontSize: number
    fontFamily: string
    color: string
    backgroundColor: string
    backgroundOpacity: number
    textAlign: 'left' | 'center' | 'right'
    bold: boolean
    italic: boolean
    shadow: boolean
    outline: boolean
    outlineColor: string
    outlineWidth: number
    // Animation
    animationIn: TextAnimation
    animationOut: TextAnimation
}

// 필터 설정
export interface VideoFilters {
    brightness: number   // -100 ~ 100
    contrast: number     // -100 ~ 100
    saturation: number   // -100 ~ 100
    temperature: number  // -100 ~ 100
    hue: number          // -180 ~ 180 (degrees)
    blur: number         // 0 ~ 100
    preset: string       // 'none', 'vintage', 'cinematic' 등
}

// 텍스트 애니메이션
export interface TextAnimation {
    type: 'none' | 'fade' | 'slide' | 'scale' | 'typewriter'
    duration: number
    direction?: 'left' | 'right' | 'up' | 'down'
}

// 클립 유니온 타입
export type Clip = VideoClip | AudioClip | TextClip

// 트랙
export interface Track {
    id: string
    type: TrackType
    name: string
    order: number        // 표시 순서 (위에서 아래로)
    isLocked: boolean    // 잠금 상태
    isVisible: boolean   // 표시/숨김
    isMuted: boolean     // 오디오 트랙용
    clips: Clip[]
}

// 히스토리 (Undo/Redo)
interface HistoryState {
    tracks: Track[]
    selectedClipIds: string[]
}

// ============================================
// Store
// ============================================

export const useEditorStore = defineStore('editor', () => {
    // ============================================
    // State
    // ============================================

    // 프로젝트 설정
    const projectName = ref('Untitled Project')
    const projectDuration = ref(0)  // 전체 프로젝트 길이

    // 화면비 프리셋
    type AspectRatioPreset = '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '21:9' | '2:3'
    const aspectRatio = ref<AspectRatioPreset>('16:9')
    const aspectRatioPresets: { label: string; value: AspectRatioPreset; desc: string }[] = [
        { label: '넓게 16:9', value: '16:9', desc: 'YouTube 및 스트리밍 사이트' },
        { label: '세로 9:16', value: '9:16', desc: 'Instagram Reels 및 TikTok' },
        { label: '정사각형 1:1', value: '1:1', desc: 'Instagram 게시물' },
        { label: '클래식 4:3', value: '4:3', desc: '' },
        { label: '소셜 4:5', value: '4:5', desc: '' },
        { label: '영화 21:9', value: '21:9', desc: '' },
        { label: '초상화 2:3', value: '2:3', desc: '' },
    ]

    function setAspectRatio(ratio: AspectRatioPreset) {
        aspectRatio.value = ratio
    }

    function getAspectRatioDimensions(): { width: number; height: number } {
        const [w, h] = aspectRatio.value.split(':').map(Number)
        // 기본 너비 1920px 기준으로 계산
        const baseWidth = 1920
        return { width: baseWidth, height: Math.round(baseWidth * (h / w)) }
    }

    // 비디오 상태
    const videoFile = ref<File | null>(null)
    const videoUrl = ref<string>('')
    const videoElement = ref<HTMLVideoElement | null>(null)

    // 재생 상태
    const isPlaying = ref(false)
    const currentTime = ref(0)
    const duration = ref(0)

    // 트랙 & 클립
    const tracks = ref<Track[]>([])
    const selectedClipIds = ref<string[]>([])
    const selectedTrackId = ref<string | null>(null)

    // 타임라인 UI 상태
    const timelineZoom = ref(1)        // 1 = 기본, 2 = 2배 확대
    const timelineScrollX = ref(0)     // 수평 스크롤 위치
    const isSnappingEnabled = ref(true)
    const snapThreshold = ref(10)      // 스냅 픽셀 임계값

    // 클립보드
    const clipboard = ref<Clip[]>([])

    // Undo/Redo
    const history = ref<HistoryState[]>([])
    const historyIndex = ref(-1)
    const maxHistorySize = 50

    // ============================================
    // Legacy: 텍스트 오버레이 (하위 호환)
    // ============================================
    const textOverlays = computed(() => {
        const textTrack = tracks.value.find(t => t.type === 'text')
        if (!textTrack) return []
        return textTrack.clips.filter((c): c is TextClip => c.type === 'text').map(clip => ({
            id: clip.id,
            text: clip.text,
            x: clip.x,
            y: clip.y,
            startTime: clip.startTime,
            endTime: clip.endTime,
            fontSize: clip.fontSize,
            fontFamily: clip.fontFamily,
            color: clip.color,
            isSelected: clip.isSelected,
            bold: clip.bold,
            italic: clip.italic,
            animationIn: clip.animationIn,
            animationOut: clip.animationOut
        }))
    })
    const selectedTextId = computed(() => {
        const textClip = selectedClipIds.value.find(id => {
            const clip = getClipById(id)
            return clip?.type === 'text'
        })
        return textClip || null
    })

    // ============================================
    // Getters
    // ============================================

    const hasVideo = computed(() => !!videoUrl.value)
    const progress = computed(() => (duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0))
    const formattedCurrentTime = computed(() => formatTime(currentTime.value))
    const formattedDuration = computed(() => formatTime(duration.value))

    // 선택된 클립들
    const selectedClips = computed(() => {
        const clips: Clip[] = []
        tracks.value.forEach(track => {
            track.clips.forEach(clip => {
                if (selectedClipIds.value.includes(clip.id)) {
                    clips.push(clip)
                }
            })
        })
        return clips
    })

    // 첫 번째 선택된 클립
    const selectedClip = computed(() => selectedClips.value[0] || null)

    // 현재 시간에 보여야 할 텍스트
    const visibleTexts = computed(() => {
        return textOverlays.value.filter(t =>
            currentTime.value >= t.startTime && currentTime.value <= t.endTime
        )
    })

    // 선택된 텍스트 객체
    const selectedText = computed(() => {
        if (!selectedTextId.value) return null
        return textOverlays.value.find(t => t.id === selectedTextId.value) || null
    })

    // 비디오 트랙의 모든 클립
    const videoClips = computed(() => {
        const clips: VideoClip[] = []
        tracks.value.filter(t => t.type === 'video').forEach(track => {
            track.clips.forEach(clip => {
                if (clip.type === 'video') clips.push(clip)
            })
        })
        return clips
    })

    // 오디오 트랙의 모든 클립
    const audioClips = computed(() => {
        const clips: AudioClip[] = []
        tracks.value.filter(t => t.type === 'audio').forEach(track => {
            track.clips.forEach(clip => {
                if (clip.type === 'audio') clips.push(clip)
            })
        })
        return clips
    })

    // ============================================
    // Helper Functions
    // ============================================

    function generateId(prefix: string = 'item'): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    function getClipById(clipId: string): Clip | null {
        for (const track of tracks.value) {
            const clip = track.clips.find(c => c.id === clipId)
            if (clip) return clip
        }
        return null
    }

    function getTrackByClipId(clipId: string): Track | null {
        for (const track of tracks.value) {
            if (track.clips.some(c => c.id === clipId)) return track
        }
        return null
    }

    function updateProjectDuration() {
        let maxEnd = 0
        tracks.value.forEach(track => {
            track.clips.forEach(clip => {
                if (clip.endTime > maxEnd) maxEnd = clip.endTime
            })
        })
        projectDuration.value = maxEnd
        if (maxEnd > duration.value) {
            duration.value = maxEnd
        }
    }

    // ============================================
    // History (Undo/Redo)
    // ============================================

    function saveHistory() {
        // 현재 인덱스 이후의 히스토리 삭제
        history.value = history.value.slice(0, historyIndex.value + 1)

        // 새 상태 저장
        history.value.push({
            tracks: JSON.parse(JSON.stringify(tracks.value)),
            selectedClipIds: [...selectedClipIds.value]
        })

        // 최대 크기 제한
        if (history.value.length > maxHistorySize) {
            history.value.shift()
        } else {
            historyIndex.value++
        }
    }

    function undo() {
        if (historyIndex.value > 0) {
            historyIndex.value--
            const state = history.value[historyIndex.value]
            tracks.value = JSON.parse(JSON.stringify(state.tracks))
            selectedClipIds.value = [...state.selectedClipIds]
        }
    }

    function redo() {
        if (historyIndex.value < history.value.length - 1) {
            historyIndex.value++
            const state = history.value[historyIndex.value]
            tracks.value = JSON.parse(JSON.stringify(state.tracks))
            selectedClipIds.value = [...state.selectedClipIds]
        }
    }

    // ============================================
    // Track Actions
    // ============================================

    function addTrack(type: TrackType, name?: string): Track {
        const trackCount = tracks.value.filter(t => t.type === type).length
        const newTrack: Track = {
            id: generateId('track'),
            type,
            name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${trackCount + 1}`,
            order: tracks.value.length,
            isLocked: false,
            isVisible: true,
            isMuted: false,
            clips: []
        }
        tracks.value.push(newTrack)
        saveHistory()
        return newTrack
    }

    function removeTrack(trackId: string) {
        const index = tracks.value.findIndex(t => t.id === trackId)
        if (index !== -1) {
            // 트랙의 모든 클립 선택 해제
            tracks.value[index].clips.forEach(clip => {
                const idx = selectedClipIds.value.indexOf(clip.id)
                if (idx !== -1) selectedClipIds.value.splice(idx, 1)
            })
            tracks.value.splice(index, 1)
            saveHistory()
        }
    }

    function updateTrack(trackId: string, updates: Partial<Track>) {
        const track = tracks.value.find(t => t.id === trackId)
        if (track) {
            Object.assign(track, updates)
        }
    }

    function reorderTracks(fromIndex: number, toIndex: number) {
        const track = tracks.value.splice(fromIndex, 1)[0]
        tracks.value.splice(toIndex, 0, track)
        tracks.value.forEach((t, i) => t.order = i)
        saveHistory()
    }

    // ============================================
    // Clip Actions
    // ============================================

    function addClip(trackId: string, clipData: Partial<Clip>): Clip | null {
        const track = tracks.value.find(t => t.id === trackId)
        if (!track) return null

        const baseClip: BaseClip = {
            id: generateId('clip'),
            trackId,
            startTime: clipData.startTime || currentTime.value,
            endTime: clipData.endTime || (currentTime.value + 5),
            sourceStartTime: clipData.sourceStartTime || 0,
            duration: clipData.duration || 5,
            isSelected: false
        }

        let newClip: Clip

        if (track.type === 'video') {
            newClip = {
                ...baseClip,
                type: 'video',
                src: (clipData as Partial<VideoClip>).src || '',
                fileName: (clipData as Partial<VideoClip>).fileName || 'video',
                originalDuration: (clipData as Partial<VideoClip>).originalDuration || 0,
                x: 0,
                y: 0,
                scale: 1,
                rotation: 0,
                flipX: false,
                flipY: false,
                speed: 1,
                opacity: 1,
                filters: {
                    brightness: 0,
                    contrast: 0,
                    saturation: 0,
                    temperature: 0,
                    hue: 0,
                    blur: 0,
                    preset: 'none'
                },
                ...clipData
            } as VideoClip
        } else if (track.type === 'audio') {
            newClip = {
                ...baseClip,
                type: 'audio',
                src: (clipData as Partial<AudioClip>).src || '',
                fileName: (clipData as Partial<AudioClip>).fileName || 'audio',
                originalDuration: (clipData as Partial<AudioClip>).originalDuration || 0,
                volume: 1,
                fadeIn: 0,
                fadeOut: 0,
                isMuted: false,
                ...clipData
            } as AudioClip
        } else {
            newClip = {
                ...baseClip,
                type: 'text',
                text: (clipData as Partial<TextClip>).text || '텍스트를 입력하세요',
                x: 100,
                y: 100,
                fontSize: 32,
                fontFamily: 'Arial',
                color: '#ffffff',
                backgroundColor: 'transparent',
                backgroundOpacity: 0,
                textAlign: 'center',
                bold: false,
                italic: false,
                shadow: false,
                outline: true,
                outlineColor: '#000000',
                outlineWidth: 2,
                animationIn: { type: 'none', duration: 0.3 },
                animationOut: { type: 'none', duration: 0.3 },
                ...clipData
            } as TextClip
        }

        track.clips.push(newClip)
        updateProjectDuration()
        saveHistory()
        return newClip
    }

    function removeClip(clipId: string) {
        for (const track of tracks.value) {
            const index = track.clips.findIndex(c => c.id === clipId)
            if (index !== -1) {
                track.clips.splice(index, 1)
                // 선택 해제
                const selIdx = selectedClipIds.value.indexOf(clipId)
                if (selIdx !== -1) selectedClipIds.value.splice(selIdx, 1)
                updateProjectDuration()
                saveHistory()
                return
            }
        }
    }

    function updateClip(clipId: string, updates: Partial<Clip>) {
        const clip = getClipById(clipId)
        if (clip) {
            Object.assign(clip, updates)
            updateProjectDuration()
        }
    }

    // 클립 분할 (Split)
    function splitClip(clipId: string, splitTime: number): [Clip, Clip] | null {
        const clip = getClipById(clipId)
        const track = getTrackByClipId(clipId)
        if (!clip || !track) return null

        // splitTime이 클립 범위 내인지 확인
        if (splitTime <= clip.startTime || splitTime >= clip.endTime) return null

        const clipIndex = track.clips.findIndex(c => c.id === clipId)

        // 첫 번째 클립 (원본 수정)
        const firstDuration = splitTime - clip.startTime
        const originalEndTime = clip.endTime
        clip.endTime = splitTime
        clip.duration = firstDuration

        // 두 번째 클립 (새로 생성)
        const secondClip: Clip = {
            ...JSON.parse(JSON.stringify(clip)),
            id: generateId('clip'),
            startTime: splitTime,
            endTime: originalEndTime,
            duration: originalEndTime - splitTime,
            sourceStartTime: (clip.sourceStartTime || 0) + firstDuration,
            isSelected: false
        }

        track.clips.splice(clipIndex + 1, 0, secondClip)
        saveHistory()
        return [clip, secondClip]
    }

    // 플레이헤드 위치에서 선택된 클립 분할
    function splitSelectedClipsAtPlayhead() {
        const clipsToSplit = selectedClips.value.filter(
            clip => currentTime.value > clip.startTime && currentTime.value < clip.endTime
        )

        clipsToSplit.forEach(clip => {
            splitClip(clip.id, currentTime.value)
        })
    }

    // 클립 이동
    function moveClip(clipId: string, newStartTime: number, newTrackId?: string) {
        const clip = getClipById(clipId)
        const currentTrack = getTrackByClipId(clipId)
        if (!clip || !currentTrack) return

        const clipDuration = clip.endTime - clip.startTime

        // 스냅핑
        if (isSnappingEnabled.value) {
            newStartTime = getSnappedTime(newStartTime, clipId)
        }

        // 시간 조정
        clip.startTime = Math.max(0, newStartTime)
        clip.endTime = clip.startTime + clipDuration

        // 다른 트랙으로 이동
        if (newTrackId && newTrackId !== currentTrack.id) {
            const newTrack = tracks.value.find(t => t.id === newTrackId)
            if (newTrack && newTrack.type === currentTrack.type) {
                const index = currentTrack.clips.findIndex(c => c.id === clipId)
                if (index !== -1) {
                    currentTrack.clips.splice(index, 1)
                    clip.trackId = newTrackId
                    newTrack.clips.push(clip)
                }
            }
        }

        updateProjectDuration()
    }

    // 스냅핑 계산
    function getSnappedTime(time: number, excludeClipId?: string): number {
        const snapPoints: number[] = [0, currentTime.value]

        // 모든 클립의 시작/끝점 수집
        tracks.value.forEach(track => {
            track.clips.forEach(clip => {
                if (clip.id !== excludeClipId) {
                    snapPoints.push(clip.startTime, clip.endTime)
                }
            })
        })

        // 가장 가까운 스냅 포인트 찾기
        const pixelsPerSecond = 100 * timelineZoom.value
        const thresholdSeconds = snapThreshold.value / pixelsPerSecond

        for (const point of snapPoints) {
            if (Math.abs(time - point) < thresholdSeconds) {
                return point
            }
        }

        return time
    }

    // 클립 트리밍
    function trimClipStart(clipId: string, newStartTime: number) {
        const clip = getClipById(clipId)
        if (!clip) return

        const minStart = 0
        const maxStart = clip.endTime - 0.1
        newStartTime = Math.max(minStart, Math.min(maxStart, newStartTime))

        const deltaTime = newStartTime - clip.startTime
        clip.startTime = newStartTime
        clip.sourceStartTime = (clip.sourceStartTime || 0) + deltaTime
        clip.duration = clip.endTime - clip.startTime
    }

    function trimClipEnd(clipId: string, newEndTime: number) {
        const clip = getClipById(clipId)
        if (!clip) return

        const minEnd = clip.startTime + 0.1
        newEndTime = Math.max(minEnd, newEndTime)

        clip.endTime = newEndTime
        clip.duration = clip.endTime - clip.startTime
        updateProjectDuration()
    }

    // ============================================
    // Selection
    // ============================================

    function selectClip(clipId: string, addToSelection: boolean = false) {
        if (!addToSelection) {
            // 모든 클립 선택 해제
            tracks.value.forEach(track => {
                track.clips.forEach(clip => clip.isSelected = false)
            })
            selectedClipIds.value = []
        }

        const clip = getClipById(clipId)
        if (clip) {
            clip.isSelected = true
            if (!selectedClipIds.value.includes(clipId)) {
                selectedClipIds.value.push(clipId)
            }
        }
    }

    function deselectClip(clipId: string) {
        const clip = getClipById(clipId)
        if (clip) {
            clip.isSelected = false
            const index = selectedClipIds.value.indexOf(clipId)
            if (index !== -1) selectedClipIds.value.splice(index, 1)
        }
    }

    function deselectAll() {
        tracks.value.forEach(track => {
            track.clips.forEach(clip => clip.isSelected = false)
        })
        selectedClipIds.value = []
        selectedTrackId.value = null
    }

    function selectAllClips() {
        tracks.value.forEach(track => {
            track.clips.forEach(clip => {
                clip.isSelected = true
                if (!selectedClipIds.value.includes(clip.id)) {
                    selectedClipIds.value.push(clip.id)
                }
            })
        })
    }

    // ============================================
    // Clipboard (Copy/Paste)
    // ============================================

    function copySelectedClips() {
        clipboard.value = JSON.parse(JSON.stringify(selectedClips.value))
    }

    function cutSelectedClips() {
        copySelectedClips()
        deleteSelectedClips()
    }

    function pasteClips() {
        if (clipboard.value.length === 0) return

        const pasteTime = currentTime.value
        const minStartTime = Math.min(...clipboard.value.map(c => c.startTime))

        clipboard.value.forEach(clipData => {
            const track = tracks.value.find(t => t.type === clipData.type)
            if (track && !track.isLocked) {
                const offset = clipData.startTime - minStartTime
                addClip(track.id, {
                    ...clipData,
                    id: undefined,
                    startTime: pasteTime + offset,
                    endTime: pasteTime + offset + clipData.duration,
                    isSelected: false
                })
            }
        })
    }

    function duplicateSelectedClips() {
        const clipsToDuplicate = [...selectedClips.value]
        deselectAll()

        clipsToDuplicate.forEach(clip => {
            const track = getTrackByClipId(clip.id)
            if (track && !track.isLocked) {
                const newClip = addClip(track.id, {
                    ...JSON.parse(JSON.stringify(clip)),
                    id: undefined,
                    startTime: clip.endTime,
                    endTime: clip.endTime + clip.duration
                })
                if (newClip) selectClip(newClip.id, true)
            }
        })
    }

    function deleteSelectedClips() {
        const idsToDelete = [...selectedClipIds.value]
        idsToDelete.forEach(id => removeClip(id))
    }

    // ============================================
    // Video Control Actions
    // ============================================

    function setVideoFile(file: File) {
        if (videoUrl.value) {
            URL.revokeObjectURL(videoUrl.value)
        }
        videoFile.value = file
        videoUrl.value = URL.createObjectURL(file)

        // 비디오 트랙이 없으면 생성
        if (!tracks.value.some(t => t.type === 'video')) {
            addTrack('video', 'Video 1')
        }
        // 오디오 트랙이 없으면 생성
        if (!tracks.value.some(t => t.type === 'audio')) {
            addTrack('audio', 'Audio 1')
        }
        // 텍스트 트랙이 없으면 생성
        if (!tracks.value.some(t => t.type === 'text')) {
            addTrack('text', 'Text 1')
        }
    }

    function setVideoElement(element: HTMLVideoElement) {
        videoElement.value = element
    }

    function play() {
        if (videoElement.value) {
            videoElement.value.play()
            isPlaying.value = true
        }
    }

    function pause() {
        if (videoElement.value) {
            videoElement.value.pause()
            isPlaying.value = false
        }
    }

    function togglePlay() {
        if (isPlaying.value) {
            pause()
        } else {
            play()
        }
    }

    function updateTime(time: number) {
        currentTime.value = time
    }

    function setDuration(dur: number) {
        duration.value = dur

        // 메인 비디오 클립 추가
        const videoTrack = tracks.value.find(t => t.type === 'video')
        if (videoTrack && videoTrack.clips.length === 0 && videoUrl.value) {
            addClip(videoTrack.id, {
                type: 'video',
                src: videoUrl.value,
                fileName: videoFile.value?.name || 'video',
                startTime: 0,
                endTime: dur,
                duration: dur,
                originalDuration: dur,
                sourceStartTime: 0
            } as Partial<VideoClip>)
        }
    }

    function seek(time: number) {
        if (videoElement.value) {
            videoElement.value.currentTime = time
            currentTime.value = time
        }
    }

    function reset() {
        if (videoUrl.value) {
            URL.revokeObjectURL(videoUrl.value)
        }
        videoFile.value = null
        videoUrl.value = ''
        isPlaying.value = false
        currentTime.value = 0
        duration.value = 0
        videoElement.value = null
        tracks.value = []
        selectedClipIds.value = []
        selectedTrackId.value = null
        history.value = []
        historyIndex.value = -1
    }

    // ============================================
    // Legacy Text Actions (하위 호환)
    // ============================================

    function addText(text: string = '텍스트를 입력하세요') {
        let textTrack = tracks.value.find(t => t.type === 'text')
        if (!textTrack) {
            textTrack = addTrack('text', 'Text 1')
        }

        const clip = addClip(textTrack.id, {
            type: 'text',
            text,
            startTime: currentTime.value,
            endTime: Math.min(currentTime.value + 3, duration.value || currentTime.value + 3),
            duration: 3
        } as Partial<TextClip>)

        if (clip) {
            selectClip(clip.id)
        }
        return clip?.id
    }

    function updateText(id: string, updates: Partial<TextClip>) {
        updateClip(id, updates)
    }

    function updateTextPosition(id: string, x: number, y: number) {
        updateClip(id, { x, y })
    }

    function updateTextTiming(id: string, startTime: number, endTime: number) {
        updateClip(id, { startTime, endTime, duration: endTime - startTime })
    }

    function removeText(id: string) {
        removeClip(id)
    }

    function selectText(id: string | null) {
        if (id) {
            selectClip(id)
        } else {
            deselectAll()
        }
    }

    // ============================================
    // Timeline UI Actions
    // ============================================

    function zoomIn() {
        timelineZoom.value = Math.min(timelineZoom.value * 1.5, 10)
    }

    function zoomOut() {
        timelineZoom.value = Math.max(timelineZoom.value / 1.5, 0.1)
    }

    function zoomToFit() {
        timelineZoom.value = 1
        timelineScrollX.value = 0
    }

    function toggleSnapping() {
        isSnappingEnabled.value = !isSnappingEnabled.value
    }

    // ============================================
    // Return
    // ============================================

    return {
        // State
        projectName,
        projectDuration,
        videoFile,
        videoUrl,
        videoElement,
        isPlaying,
        currentTime,
        duration,
        tracks,
        selectedClipIds,
        selectedTrackId,
        timelineZoom,
        timelineScrollX,
        isSnappingEnabled,
        clipboard,

        // Legacy
        textOverlays,
        selectedTextId,

        // Getters
        hasVideo,
        progress,
        formattedCurrentTime,
        formattedDuration,
        selectedClips,
        selectedClip,
        visibleTexts,
        selectedText,
        videoClips,
        audioClips,

        // Track Actions
        addTrack,
        removeTrack,
        updateTrack,
        reorderTracks,

        // Clip Actions
        addClip,
        removeClip,
        updateClip,
        splitClip,
        splitSelectedClipsAtPlayhead,
        moveClip,
        trimClipStart,
        trimClipEnd,
        getClipById,
        getTrackByClipId,

        // Selection
        selectClip,
        deselectClip,
        deselectAll,
        selectAllClips,

        // Clipboard
        copySelectedClips,
        cutSelectedClips,
        pasteClips,
        duplicateSelectedClips,
        deleteSelectedClips,

        // History
        undo,
        redo,

        // Video Control
        setVideoFile,
        setVideoElement,
        play,
        pause,
        togglePlay,
        updateTime,
        setDuration,
        seek,
        reset,

        // Legacy Text
        addText,
        updateText,
        updateTextPosition,
        updateTextTiming,
        removeText,
        selectText,

        // Timeline UI
        zoomIn,
        zoomOut,
        zoomToFit,
        toggleSnapping,

        // Aspect Ratio
        aspectRatio,
        aspectRatioPresets,
        setAspectRatio,
        getAspectRatioDimensions,
    }
})
