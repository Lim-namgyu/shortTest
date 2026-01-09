<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Application, Sprite, Texture, VideoSource, Text, TextStyle, Container, FederatedPointerEvent, Graphics, ColorMatrixFilter } from 'pixi.js'
import { useEditorStore, type VideoClip } from '../stores/editorStore'

const editorStore = useEditorStore()
const canvasContainer = ref<HTMLDivElement | null>(null)
const videoElement = ref<HTMLVideoElement | null>(null)

let app: Application | null = null
let videoSprite: Sprite | null = null
let videoSource: VideoSource | null = null
let textContainer: Container | null = null
let frameGraphics: Graphics | null = null // 화면비 프레임 배경
let maskGraphics: Graphics | null = null  // 비디오 마스크
let colorMatrix: ColorMatrixFilter | null = null // 색상 필터
const textObjects: Map<string, Text> = new Map()

// 드래그 상태 (텍스트)
let dragTarget: Text | null = null
let dragOffset = { x: 0, y: 0 }

// 비디오 드래그 상태
let isVideoDragging = false
let videoDragStart = { x: 0, y: 0 }
let videoOriginalPosition = { x: 0, y: 0 }
let baseVideoScale = 1 // 화면비에 맞춘 기본 스케일

// 화면비 메뉴 상태
const showAspectRatioMenu = ref(false)
const showAIMenu = ref(false)
const showStockModal = ref(false)
const isExporting = ref(false) // 내보내기 진행 상태



// 비디오 내보내기 (렌더링)
async function exportVideo() {
  if (!app || !videoElement.value || !editorStore.hasVideo) return
  
  isExporting.value = true
  editorStore.pause()
  editorStore.updateTime(0)
  videoElement.value.currentTime = 0
  
  // 1. 스트림 캡처 준비
  const canvas = app.canvas as HTMLCanvasElement
  const canvasStream = canvas.captureStream(30) // 30 FPS
  
  // 오디오 트랙 확보 (비디오 요소에서)
  let combinedStream = canvasStream
  try {
    // @ts-ignore - captureStream types might be missing
    const videoStream = videoElement.value.captureStream ? videoElement.value.captureStream() : videoElement.value.mozCaptureStream()
    if (videoStream) {
      const audioTracks = videoStream.getAudioTracks()
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0])
      }
    }
  } catch (e) {
    console.warn('Audio capture failed:', e)
  }
  
  // 2. MediaRecorder 설정
  const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
    ? 'video/webm; codecs=vp9' 
    : 'video/webm'
    
  const chunks: Blob[] = []
  const recorder = new MediaRecorder(combinedStream, { mimeType })
  
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  
  recorder.onstop = () => {
    // 4. 다운로드 처리
    const blob = new Blob(chunks, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `project_${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    isExporting.value = false
    alert('비디오 내보내기가 완료되었습니다!')
  }
  
  // 3. 녹화 및 재생 시작
  await new Promise(r => setTimeout(r, 500)) // 버퍼링 대기
  recorder.start()
  videoElement.value.play()
  
  // 재생 종료 감지 (Polling or Event)
  const checkEnd = setInterval(() => {
    if (videoElement.value?.ended || editorStore.currentTime >= editorStore.duration) {
      recorder.stop()
      videoElement.value?.pause()
      clearInterval(checkEnd)
    }
  }, 100)
}
const stockTab = ref('video') // 'video' | 'image'

// Mock Stock Data
const stockVideos = [
  { title: 'Sintel Trailer', url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', thumb: 'https://media.w3.org/2010/05/sintel/poster.png' },
  { title: 'Big Buck Bunny', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumb: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg' }
]
const stockImages = [
  { title: 'Mountain', url: 'https://images.pexels.com/photos/1261728/pexels-photo-1261728.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { title: 'City', url: 'https://images.pexels.com/photos/169647/pexels-photo-169647.jpeg?auto=compress&cs=tinysrgb&w=400' }
]

function addStockItem(item: any, type: 'video' | 'image') {
  showStockModal.value = false
  
  if (type === 'video') {
    // 비디오 추가 (현재는 단일 비디오만 지원하므로 경고 후 교체 방식)
    if (confirm('현재 편집기는 단일 메인 비디오만 지원합니다.\n기존 비디오를 교체하시겠습니까? (멀티 트랙 비디오는 추후 지원)')) {
      editorStore.videoUrl = item.url
      // editorStore.loadVideo... needs logic
      // Simplest: just set URL, the watcher handles it.
    }
  } else {
    // 이미지 추가 (텍스트 트랙이나 별도 이미지 트랙에 추가해야 함)
    // 현재 이미지 클립 타입이 없으므로 TextClip을 변형해서 사용하거나 추후 ImageClip 구현 필요.
    // 임시로 "Mock Image Clip" 텍스트 추가
    const track = editorStore.addTrack('text', 'Stock Images')
    editorStore.addClip(track.id, {
        type: 'text',
        text: `[Image: ${item.title}]`, // 실제 이미지 렌더링은 ImageClip 구현 필요
        startTime: 0,
        duration: 5,
        x: 500,
        y: 300,
        fontSize: 32,
        backgroundColor: '#444444'
    } as any)
    alert(`이미지 [${item.title}]가 추가되었습니다.\n(현재는 텍스트 플레이스홀더로 표시됩니다)`)
  }
}

// 현재 비디오 클립 속성 (첫 번째 비디오 클립)
const currentVideoClip = computed(() => {
  return editorStore.videoClips[0] as VideoClip | undefined
})

function selectAspectRatio(ratio: string) {
  editorStore.setAspectRatio(ratio as any)
  showAspectRatioMenu.value = false
}

// AI: 자동 자막 생성 (Mock)
function generateCaptions() {
  showAIMenu.value = false
  
  // 자막 트랙 추가
  const track = editorStore.addTrack('text', 'AI Subtitles')
  if (!track) return

  // 1. 첫 번째 자막
  editorStore.addClip(track.id, {
    type: 'text',
    text: '안녕하세요! 비디오 편집기 데모입니다.',
    startTime: 0.5,
    endTime: 3.0,
    duration: 2.5,
    x: 960,
    y: 900, // 하단 배치
    fontSize: 48,
    color: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    animationIn: { type: 'fade', duration: 0.3 }
  } as any)

  // 2. 두 번째 자막
  editorStore.addClip(track.id, {
    type: 'text',
    text: 'AI가 자동으로 자막을 생성했습니다.',
    startTime: 3.5,
    endTime: 6.5,
    duration: 3.0,
    x: 960,
    y: 900,
    fontSize: 48,
    color: '#ffff00', // 노란색 강조
    bold: true,
    animationIn: { type: 'typewriter', duration: 1.0 }
  } as any)
  
  alert('자막 생성이 완료되었습니다! (Mock Data)')
}

// AI: TTS 생성 (Mock)
function generateTTS() {
  showAIMenu.value = false
  const track = editorStore.addTrack('audio', 'AI Voice')
  if (!track) return
  
  // 오디오 클립 추가 (실제 오디오 파일이 없으므로 플레이스홀더)
  // 실제 구현 시에는 TTS API 호출 후 Blob URL 사용
  alert('TTS 오디오 생성은 백엔드 API가 필요합니다.\n오디오 트랙만 생성되었습니다.')
}

// 화면비에 따른 캔버스 영역 계산
function getCanvasArea() {
  if (!app) return { x: 0, y: 0, width: 800, height: 450 }
  
  const [ratioW, ratioH] = editorStore.aspectRatio.split(':').map(Number)
  const containerWidth = app.screen.width
  const containerHeight = app.screen.height
  
  // 화면비에 맞는 영역 계산
  let areaWidth: number, areaHeight: number
  
  if (containerWidth / containerHeight > ratioW / ratioH) {
    // 높이 기준
    areaHeight = containerHeight * 0.9
    areaWidth = areaHeight * (ratioW / ratioH)
  } else {
    // 너비 기준
    areaWidth = containerWidth * 0.9
    areaHeight = areaWidth * (ratioH / ratioW)
  }
  
  const x = (containerWidth - areaWidth) / 2
  const y = (containerHeight - areaHeight) / 2
  
  return { x, y, width: areaWidth, height: areaHeight }
}

// 비디오 스프라이트 위치/크기 업데이트
function updateVideoSpriteLayout() {
  if (!videoSprite || !videoElement.value || !app) return
  
  const area = getCanvasArea()
  const video = videoElement.value
  
  // 비디오를 영역에 맞게 스케일링
  const scaleX = area.width / video.videoWidth
  const scaleY = area.height / video.videoHeight
  baseVideoScale = Math.min(scaleX, scaleY)
  
  // 클립의 사용자 정의 스케일 적용
  const clip = currentVideoClip.value
  const userScale = clip?.scale || 1
  const finalScale = baseVideoScale * userScale
  
  videoSprite.scale.set(finalScale)
  
  // 중앙 정렬 + 사용자 정의 오프셋
  const offsetX = clip?.x || 0
  const offsetY = clip?.y || 0
  videoSprite.x = area.x + (area.width - video.videoWidth * finalScale) / 2 + offsetX
  videoSprite.y = area.y + (area.height - video.videoHeight * finalScale) / 2 + offsetY
  
  // 회전 (pivot 설정 필요)
  if (clip) {
    videoSprite.pivot.set(video.videoWidth / 2, video.videoHeight / 2)
    videoSprite.x += video.videoWidth * finalScale / 2
    videoSprite.y += video.videoHeight * finalScale / 2
    videoSprite.rotation = (clip.rotation * Math.PI) / 180
    videoSprite.alpha = clip.opacity
    
    // 반전
    const sX = clip.flipX ? -finalScale : finalScale
    const sY = clip.flipY ? -finalScale : finalScale
    videoSprite.scale.set(sX, sY)
  }
  
  // 비디오 바운딩 박스 업데이트
  updateVideoBounds()
}

// 비디오 선택 상태
const isVideoSelected = computed(() => {
  const clip = currentVideoClip.value
  return clip ? editorStore.selectedClipIds.includes(clip.id) : false
})

// 비디오 바운딩 박스 (HTML 오버레이용)
const videoBounds = ref<{ x: number; y: number; width: number; height: number } | null>(null)

function updateVideoBounds() {
  if (!videoSprite || !videoElement.value || !canvasContainer.value) {
    videoBounds.value = null
    return
  }
  
  const video = videoElement.value
  const clip = currentVideoClip.value
  const userScale = clip?.scale || 1
  const finalScale = baseVideoScale * userScale
  
  const width = video.videoWidth * Math.abs(finalScale)
  const height = video.videoHeight * Math.abs(finalScale)
  
  // 스프라이트 중심 기준 위치 계산
  const centerX = videoSprite.x
  const centerY = videoSprite.y
  
  videoBounds.value = {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height
  }
}

// 비디오 선택 스타일
const videoSelectionStyle = computed(() => {
  if (!videoBounds.value) return {}
  return {
    left: `${videoBounds.value.x}px`,
    top: `${videoBounds.value.y}px`,
    width: `${videoBounds.value.width}px`,
    height: `${videoBounds.value.height}px`
  }
})

// 리사이즈 상태
let isResizing = false
let resizeHandle = ''
let resizeStart = { x: 0, y: 0, scale: 1 }

function startResize(handle: string, event: MouseEvent) {
  if (!currentVideoClip.value) return
  
  isResizing = true
  resizeHandle = handle
  resizeStart = {
    x: event.clientX,
    y: event.clientY,
    scale: currentVideoClip.value.scale
  }
  
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(event: MouseEvent) {
  if (!isResizing || !currentVideoClip.value) return
  
  const deltaX = event.clientX - resizeStart.x
  const deltaY = event.clientY - resizeStart.y
  
  // 대각선 방향으로 드래그한 거리 계산
  let delta = 0
  if (resizeHandle.includes('right')) delta += deltaX
  if (resizeHandle.includes('left')) delta -= deltaX
  if (resizeHandle.includes('bottom')) delta += deltaY
  if (resizeHandle.includes('top')) delta -= deltaY
  
  // 스케일 변화량 계산 (100px 드래그 = 0.5 스케일 변화)
  const scaleDelta = delta / 200
  const newScale = Math.max(0.1, Math.min(5, resizeStart.scale + scaleDelta))
  
  editorStore.updateClip(currentVideoClip.value.id, { scale: newScale })
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

// 회전 상태
let isRotating = false
let rotateCenter = { x: 0, y: 0 }
let rotateStartAngle = 0

function startRotate(event: MouseEvent) {
  if (!currentVideoClip.value || !videoBounds.value || !canvasContainer.value) return
  
  isRotating = true
  
  // 비디오 중심 좌표
  const rect = canvasContainer.value.getBoundingClientRect()
  rotateCenter = {
    x: rect.left + videoBounds.value.x + videoBounds.value.width / 2,
    y: rect.top + videoBounds.value.y + videoBounds.value.height / 2
  }
  
  // 시작 각도
  const angle = Math.atan2(event.clientY - rotateCenter.y, event.clientX - rotateCenter.x)
  rotateStartAngle = (angle * 180 / Math.PI) - (currentVideoClip.value.rotation || 0)
  
  document.addEventListener('mousemove', onRotate)
  document.addEventListener('mouseup', stopRotate)
}

function onRotate(event: MouseEvent) {
  if (!isRotating || !currentVideoClip.value) return
  
  const angle = Math.atan2(event.clientY - rotateCenter.y, event.clientX - rotateCenter.x)
  let newRotation = (angle * 180 / Math.PI) - rotateStartAngle
  
  // 0-360 범위로 정규화
  newRotation = ((newRotation % 360) + 360) % 360
  
  editorStore.updateClip(currentVideoClip.value.id, { rotation: Math.round(newRotation) })
}

function stopRotate() {
  isRotating = false
  document.removeEventListener('mousemove', onRotate)
  document.removeEventListener('mouseup', stopRotate)
}


// 화면비 프레임 및 마스크 업데이트
function updateAspectRatioFrame() {
  if (!app || !frameGraphics) return
  
  const area = getCanvasArea()
  const screenWidth = app.screen.width
  const screenHeight = app.screen.height
  
  // 1. 프레임 배경 (레터박스) 그리기
  frameGraphics.clear()
  frameGraphics.rect(0, 0, screenWidth, screenHeight) // 전체 영역
  frameGraphics.fill({ color: 0x000000, alpha: 1 })   // 일단 전체를 검은색으로
  
  // 2. 화면비 영역 구멍 뚫기 (마스킹 효과) 대신 cutBegin/cutEnd 사용하거나
  // 더 쉬운 방법: 4개의 사각형으로 주변을 그림
  frameGraphics.clear()
  
  // 상단
  if (area.y > 0) {
    frameGraphics.rect(0, 0, screenWidth, area.y)
    frameGraphics.fill({ color: 0x000000, alpha: 1 })
  }
  // 하단
  if (area.y + area.height < screenHeight) {
    frameGraphics.rect(0, area.y + area.height, screenWidth, screenHeight - (area.y + area.height))
    frameGraphics.fill({ color: 0x000000, alpha: 1 })
  }
  // 좌측
  if (area.x > 0) {
    frameGraphics.rect(0, area.y, area.x, area.height)
    frameGraphics.fill({ color: 0x000000, alpha: 1 })
  }
  // 우측
  if (area.x + area.width < screenWidth) {
    frameGraphics.rect(area.x + area.width, area.y, screenWidth - (area.x + area.width), area.height)
    frameGraphics.fill({ color: 0x000000, alpha: 1 })
  }
  
  // 3. 마스크 업데이트 (비디오 및 텍스트용)
  if (!maskGraphics) {
    maskGraphics = new Graphics()
    app.stage.addChild(maskGraphics)
  }
  maskGraphics.clear()
  maskGraphics.rect(area.x, area.y, area.width, area.height)
  maskGraphics.fill({ color: 0xffffff, alpha: 1 })
  
  // 앱 스테이지 마스크 설정 (프레임 바깥은 안 보이게)
  // 단, frameGraphics(검은 배경)는 보여야 하므로, 
  // 비디오/텍스트 컨테이너에만 마스크 적용
  if (videoSprite) {
    videoSprite.mask = maskGraphics
  }
  if (textContainer) {
    textContainer.mask = maskGraphics
  }
}

// 텍스트 애니메이션 및 가시성 업데이트 (매 프레임 실행)
function animateTexts() {
  if (!textContainer || textObjects.size === 0) return
  
  const currentTime = editorStore.currentTime
  const overlayMap = new Map(editorStore.textOverlays.map(t => [t.id, t]))
  
  textObjects.forEach((textObj, id) => {
    const overlay = overlayMap.get(id)
    
    // 1. 가시성 체크 (시간 범위 확인)
    if (!overlay || currentTime < overlay.startTime || currentTime > overlay.endTime) {
      textObj.visible = false
      return
    }
    
    textObj.visible = true
    
    // 2. 기본 상태 설정 (초기화)
    let alpha = overlay.isSelected ? 1 : 1
    let x = overlay.x
    let y = overlay.y
    let scaleX = 1
    let scaleY = 1
    let textContent = overlay.text
    
    // 3. 등장 효과 (In Animation)
    if (overlay.animationIn && overlay.animationIn.type !== 'none') {
      const duration = overlay.animationIn.duration
      if ((currentTime - overlay.startTime) < duration) {
        const progress = (currentTime - overlay.startTime) / duration
        const t = Math.max(0, Math.min(1, progress)) // 0 -> 1
        
        switch (overlay.animationIn.type) {
          case 'fade':
            alpha *= t
            break
          case 'slide':
            y += (1 - t) * 50 // 아래에서 위로 등장
            break
          case 'scale':
            scaleX = t
            scaleY = t
            break
          case 'typewriter':
            const len = Math.floor(textContent.length * t)
            textContent = textContent.substring(0, len)
            break
        }
      }
    }
    
    // 4. 퇴장 효과 (Out Animation)
    if (overlay.animationOut && overlay.animationOut.type !== 'none') {
      const duration = overlay.animationOut.duration
      const remaining = overlay.endTime - currentTime
      if (remaining < duration) {
        const progress = (duration - remaining) / duration
        const t = Math.max(0, Math.min(1, progress)) // 0 (시작) -> 1 (끝)
        
        switch (overlay.animationOut.type) {
          case 'fade':
            alpha *= (1 - t)
            break
          case 'slide':
            y -= t * 50 // 위로 사라짐
            break
          case 'scale':
            scaleX = 1 - t
            scaleY = 1 - t
            break
        }
      }
    }
    
    // 5. 속성 적용
    textObj.alpha = alpha
    textObj.x = x
    textObj.y = y
    textObj.scale.set(scaleX, scaleY)
    
    // 텍스트 내용 변경 시에만 업데이트 (성능 최적화)
    if (textObj.text !== textContent) {
      textObj.text = textContent
    }
  })
}

async function initPixi() {
  if (!canvasContainer.value) return

  app = new Application()
  await app.init({
    background: '#1a1a1a', // 캔버스 배경색 (프레임 안쪽 색상)
    resizeTo: canvasContainer.value,
    antialias: true,
  })
  
  canvasContainer.value.appendChild(app.canvas)
  
  // 화면비 프레임 배경 (레터박스 효과 - 바깥을 어둡게)
  frameGraphics = new Graphics()
  app.stage.addChild(frameGraphics)
  
  // 텍스트 자리에 화면비 영역 내부 표시기 (border)
  updateAspectRatioFrame()
  
  // 텍스트 컨테이너 (비디오 위에 렌더링)
  textContainer = new Container()
  app.stage.addChild(textContainer)

  // 텍스트 애니메이션 루프 등록
  app.ticker.add(animateTexts)
  
  // 스테이지 클릭 시 선택 해제
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen
  app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
    if (e.target === app?.stage) {
      editorStore.deselectAll()
    }
  })
}

async function loadVideoToPixi() {
  if (!app || !editorStore.videoUrl) return

  // 기존 스프라이트 및 리소스 제거
  if (videoSprite) {
    app.stage.removeChild(videoSprite)
    videoSprite.destroy()
    videoSprite = null
  }
  if (videoSource) {
    videoSource.destroy()
    videoSource = null
  }

  // 비디오 엘리먼트 생성
  const video = document.createElement('video')
  video.src = editorStore.videoUrl
  video.crossOrigin = 'anonymous'
  video.loop = false
  video.muted = false
  video.playsInline = true
  video.preload = 'auto'
  
  videoElement.value = video
  editorStore.setVideoElement(video)

  // 비디오 메타데이터 로드 대기
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => {
      editorStore.setDuration(video.duration)
      resolve()
    }
    video.onerror = () => reject(new Error('Video load failed'))
  })

  // 첫 프레임 로드를 위해 잠시 재생 후 정지
  video.currentTime = 0
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
  })

  // Pixi.js VideoSource 생성
  videoSource = new VideoSource({
    resource: video,
    autoPlay: false,
    updateFPS: 30,
    loop: false,
    muted: false,
    autoGarbageCollect: false,
  })

  // 텍스처 및 스프라이트 생성
  const texture = new Texture({ source: videoSource })
  videoSprite = new Sprite(texture)
  
  // 색상 필터 초기화
  colorMatrix = new ColorMatrixFilter()
  videoSprite.filters = [colorMatrix]
  
  // 비디오 스프라이트 드래그 가능하게 설정
  videoSprite.eventMode = 'static'
  videoSprite.cursor = 'move'
  
  // 비디오 드래그 이벤트
  videoSprite.on('pointerdown', onVideoDragStart)
  
  // 비디오를 텍스트 컨테이너 아래에 추가
  app.stage.addChildAt(videoSprite, 0)
  
  // 레이아웃 업데이트 (화면비 적용)
  updateVideoSpriteLayout()
  updateAspectRatioFrame()

  // 시간 업데이트 이벤트
  video.ontimeupdate = () => {
    editorStore.updateTime(video.currentTime)
  }

  video.onended = () => {
    editorStore.pause()
  }

  // Ticker를 사용해 비디오 텍스처 갱신 (재생 중일 때만)
  app.ticker.add(() => {
    if (videoSource && !video.paused) {
      videoSource.update()
    }
  })
}

// 비디오 드래그 시작
function onVideoDragStart(event: FederatedPointerEvent) {
  if (!videoSprite || !app) return
  
  isVideoDragging = true
  const position = event.getLocalPosition(app.stage)
  videoDragStart = { x: position.x, y: position.y }
  
  const clip = currentVideoClip.value
  videoOriginalPosition = { x: clip?.x || 0, y: clip?.y || 0 }
  
  // 비디오 클립 선택
  if (clip) {
    editorStore.selectClip(clip.id)
  }
  
  app.stage.on('pointermove', onVideoDragMove)
  app.stage.on('pointerup', onVideoDragEnd)
  app.stage.on('pointerupoutside', onVideoDragEnd)
}

function onVideoDragMove(event: FederatedPointerEvent) {
  if (!isVideoDragging || !app || !currentVideoClip.value) return
  
  const position = event.getLocalPosition(app.stage)
  const deltaX = position.x - videoDragStart.x
  const deltaY = position.y - videoDragStart.y
  
  // 클립 위치 업데이트
  editorStore.updateClip(currentVideoClip.value.id, {
    x: videoOriginalPosition.x + deltaX,
    y: videoOriginalPosition.y + deltaY
  })
}

function onVideoDragEnd() {
  isVideoDragging = false
  app?.stage.off('pointermove', onVideoDragMove)
  app?.stage.off('pointerup', onVideoDragEnd)
  app?.stage.off('pointerupoutside', onVideoDragEnd)
}

// 텍스트 객체 생성 (성능 최적화: dropShadow 제거)
function createTextObject(overlay: { id: string; text: string; x: number; y: number; fontSize: number; fontFamily: string; color: string; bold?: boolean; italic?: boolean }): Text {
  const fontWeight = overlay.bold ? 'bold' : 'normal'
  const fontStyle = overlay.italic ? 'italic' : 'normal'
  
  const style = new TextStyle({
    fontFamily: overlay.fontFamily || 'Arial',
    fontSize: overlay.fontSize || 32,
    fontWeight: fontWeight,
    fontStyle: fontStyle,
    fill: overlay.color || '#ffffff',
    stroke: { color: '#000000', width: 2 },
  })
  
  const text = new Text({ text: overlay.text, style })
  text.x = overlay.x
  text.y = overlay.y
  text.eventMode = 'static'
  text.cursor = 'move'
  text.label = overlay.id
  text.on('pointerdown', onDragStart)
  
  return text
}

function onDragStart(event: FederatedPointerEvent) {
  const text = event.currentTarget as Text
  dragTarget = text
  
  const textId = text.label
  editorStore.selectText(textId)
  
  const position = event.getLocalPosition(text.parent!)
  dragOffset.x = position.x - text.x
  dragOffset.y = position.y - text.y
  
  app?.stage.on('pointermove', onDragMove)
  app?.stage.on('pointerup', onDragEnd)
  app?.stage.on('pointerupoutside', onDragEnd)
}

function onDragMove(event: FederatedPointerEvent) {
  if (!dragTarget || !app) return
  
  const position = event.getLocalPosition(app.stage)
  dragTarget.x = position.x - dragOffset.x
  dragTarget.y = position.y - dragOffset.y
}

function onDragEnd() {
  if (!dragTarget) return
  
  const textId = dragTarget.label
  editorStore.updateTextPosition(textId, dragTarget.x, dragTarget.y)
  
  dragTarget = null
  app?.stage.off('pointermove', onDragMove)
  app?.stage.off('pointerup', onDragEnd)
  app?.stage.off('pointerupoutside', onDragEnd)
}

// 텍스트 가시성 업데이트 (현재 시간에 따라) - 최적화 버전
function updateTextVisibility() {
  if (!textContainer || textObjects.size === 0) return
  
  const currentTime = editorStore.currentTime
  const overlayMap = new Map(editorStore.textOverlays.map(t => [t.id, t]))
  
  textObjects.forEach((textObj, id) => {
    const overlay = overlayMap.get(id)
    if (overlay) {
      textObj.visible = currentTime >= overlay.startTime && currentTime <= overlay.endTime
      textObj.alpha = overlay.isSelected ? 1 : 0.95
    }
  })
}

// 텍스트 목록 길이 변경 감지 (추가/삭제 시에만 실행)
watch(() => editorStore.textOverlays.length, () => {
  if (!textContainer) return
  
  const overlays = editorStore.textOverlays
  const currentIds = new Set(overlays.map(o => o.id))
  
  // 새 텍스트 추가
  overlays.forEach(overlay => {
    if (!textObjects.has(overlay.id)) {
      const textObj = createTextObject(overlay)
      textContainer!.addChild(textObj)
      textObjects.set(overlay.id, textObj)
    }
  })
  
  // 삭제된 텍스트 제거
  textObjects.forEach((textObj, id) => {
    if (!currentIds.has(id)) {
      textContainer?.removeChild(textObj)
      textObj.destroy()
      textObjects.delete(id)
    }
  })
  
  updateTextVisibility()
})

// 비디오 클립 변환 속성 감지 및 적용
watch(() => {
  const vc = currentVideoClip.value
  if (!vc) return ''
  return `${vc.rotation}:${vc.scale}:${vc.flipX}:${vc.flipY}:${vc.opacity}:${vc.x}:${vc.y}`
}, () => {
  updateVideoSpriteLayout()
}, { immediate: true })

// 화면비 변경 감지
watch(() => editorStore.aspectRatio, () => {
  updateVideoSpriteLayout()
  updateAspectRatioFrame()
})

// 개별 텍스트 속성 변경 감지 (텍스트 내용, 위치, 스타일 등)
watch(() => editorStore.textOverlays.map(t => 
  `${t.id}:${t.text}:${t.x}:${t.y}:${t.fontSize}:${t.color}:${t.isSelected}`
).join(','), () => {
  const overlays = editorStore.textOverlays
  overlays.forEach(overlay => {
    const textObj = textObjects.get(overlay.id)
    if (textObj) {
      // 텍스트 내용 업데이트
      textObj.text = overlay.text
      textObj.x = overlay.x
      textObj.y = overlay.y
      
      // 스타일 업데이트
      textObj.style.fontSize = overlay.fontSize
      textObj.style.fill = overlay.color
    }
  })
  updateTextVisibility()
})

// 비디오 필터 변경 감지
watch(() => {
  const vc = currentVideoClip.value
  if (!vc) return ''
  const f = vc.filters
  return `${f.brightness}:${f.contrast}:${f.saturation}:${f.hue}:${f.blur}:${f.preset}`
}, () => {
  if (!colorMatrix || !currentVideoClip.value) return
  const f = currentVideoClip.value.filters
  
  colorMatrix.reset()
  
  // 1. 기본 조절 (순서: 밝기 -> 대비 -> 채도 -> 색조)
  // 값 매핑: -100 ~ 100 -> 0 ~ 2 (1이 기본)
  
  // 밝기 (Brightness): 0(검정) ~ 1(기본) ~ 2(밝음)
  colorMatrix.brightness((f.brightness / 100) + 1, false)
  
  // 대비 (Contrast): 0(회색) ~ 1(기본) ~ 2(강한 대비)
  colorMatrix.contrast((f.contrast / 100) + 1, false)
  
  // 채도 (Saturation): 0(흑백) ~ 1(기본) ~ 2(과포화)
  colorMatrix.saturate((f.saturation / 100) + 1, false)
  
  // 색조 (Hue): -180 ~ 180 도
  colorMatrix.hue(f.hue, false)
  
  // 2. 프리셋 적용
  switch (f.preset) {
    case 'sepia':
      colorMatrix.sepia(false)
      break
    case 'grayscale':
      colorMatrix.greyscale(0.33, false)
      break
    case 'vintage':
      colorMatrix.vintage(false)
      break
    case 'polaroid':
      colorMatrix.polaroid(false)
      break
    case 'technicolor':
      colorMatrix.technicolor(false)
      break
    case 'kodachrome':
      colorMatrix.kodachrome(false)
      break
    case 'browni':
      colorMatrix.browni(false)
      break
    case 'toBGR':
      colorMatrix.toBGR(false)
      break
  }
  
  // 블러는 별도 BlurFilter 필요하지만 ColorMatrix로 제한적 구현 불가능. 
  // 추후 BlurFilter 추가 고려. 현재는 ColorMatrix만.
}, { immediate: true })

watch(() => editorStore.videoUrl, (newUrl) => {
  if (newUrl) {
    loadVideoToPixi()
  }
})

// 현재 시간 변경 시 텍스트 가시성 업데이트 (0.1초 간격으로 스로틀링)
let lastVisibilityUpdate = 0
watch(() => Math.floor(editorStore.currentTime * 10), () => {
  const now = Date.now()
  if (now - lastVisibilityUpdate > 100) {
    updateTextVisibility()
    lastVisibilityUpdate = now
  }
})

onMounted(() => {
  initPixi()
})

onUnmounted(() => {
  if (app) {
    app.destroy(true)
    app = null
  }
  if (videoSource) {
    videoSource.destroy()
    videoSource = null
  }
  textObjects.clear()
})
</script>

<template>
  <div 
    ref="canvasContainer" 
    class="relative w-full h-full rounded-2xl overflow-hidden bg-black/50 backdrop-blur-sm border border-gray-700/50 shadow-2xl"
  >
    <!-- Canvas Toolbar (상단) -->
    <div 
      v-if="editorStore.hasVideo"
      class="absolute top-3 left-3 right-3 flex items-center justify-between z-20"
    >
      <!-- 왼쪽: 크기조절 툴 -->
      <div class="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-gray-700/50">
        <button 
          class="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
          title="크롭"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10v10H7z M4 4v3h3M20 20v-3h-3M4 20v-3h3M20 4v3h-3" />
          </svg>
        </button>
        <button 
          class="p-1.5 rounded hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
          title="화면에 맞추기"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
      
      <div class="relative mr-2">
        <button 
          @click="showStockModal = true"
          class="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-1.5 border border-gray-600 transition-all"
        >
          <span class="text-lg">🎬</span>
          <span class="font-medium">Stock</span>
        </button>
      </div>

      <!-- AI Tools Menu -->
      <div class="relative mr-2">
        <button 
          @click="showAIMenu = !showAIMenu"
          class="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg px-3 py-1.5 shadow-lg transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span class="font-medium">AI Tools</span>
        </button>

        <div 
          v-if="showAIMenu"
          class="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 min-w-[220px] z-50 overflow-hidden"
        >
          <div class="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Features</span>
          </div>
          
          <button 
            @click="generateCaptions"
            class="w-full text-left px-4 py-3 hover:bg-indigo-50 flex items-center gap-3 group transition-colors"
          >
            <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <div class="font-medium text-gray-900 group-hover:text-indigo-700">Auto Captions</div>
              <div class="text-xs text-gray-500">Generate subtitles from audio</div>
            </div>
          </button>
          
          <button 
            @click="generateTTS"
            class="w-full text-left px-4 py-3 hover:bg-purple-50 flex items-center gap-3 group transition-colors"
          >
            <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <div class="font-medium text-gray-900 group-hover:text-purple-700">Text to Speech</div>
              <div class="text-xs text-gray-500">Convert text to realistic voice</div>
            </div>
          </button>
        </div>
      </div>

      <!-- 오른쪽: 화면비 선택 -->
      <div class="relative">
        <button 
          @click="showAspectRatioMenu = !showAspectRatioMenu"
          class="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-gray-700/50 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
          </svg>
          <span>{{ editorStore.aspectRatio }}</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        <!-- 화면비 드롭다운 메뉴 -->
        <div 
          v-if="showAspectRatioMenu"
          class="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px] z-50"
        >
          <div 
            v-for="preset in editorStore.aspectRatioPresets"
            :key="preset.value"
            @click="selectAspectRatio(preset.value)"
            class="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 cursor-pointer transition-colors"
            :class="{ 'bg-indigo-50': editorStore.aspectRatio === preset.value }"
          >
            <div 
              class="flex items-center justify-center w-5"
              :class="editorStore.aspectRatio === preset.value ? 'text-indigo-600' : 'text-transparent'"
            >
              ✓
            </div>
            <div class="flex-1">
              <div class="text-sm text-gray-900">{{ preset.label }}</div>
              <div v-if="preset.desc" class="text-xs text-gray-500">{{ preset.desc }}</div>
            </div>
          </div>
        </div>
      </div>
      <!-- Export Button -->
      <div class="relative ml-2 pl-2 border-l border-gray-700">
        <button 
          @click="exportVideo"
          :disabled="isExporting"
          class="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white rounded-lg px-4 py-1.5 shadow-lg transition-all"
        >
          <span v-if="!isExporting">Export</span>
          <span v-else class="flex items-center gap-2">
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ Math.round(editorStore.progress) }}%
          </span>
        </button>
      </div>
    </div>
    
    <!-- 비디오 선택 시 리사이즈 핸들 오버레이 -->
    <div 
      v-if="editorStore.hasVideo && isVideoSelected && videoBounds"
      class="absolute pointer-events-none z-30"
      :style="videoSelectionStyle"
    >
      <!-- 선택 테두리 -->
      <div class="absolute inset-0 border-2 border-purple-500 rounded"></div>
      
      <!-- 모서리 핸들 -->
      <div 
        class="handle corner-handle top-left"
        @mousedown.stop="startResize('top-left', $event)"
      ></div>
      <div 
        class="handle corner-handle top-right"
        @mousedown.stop="startResize('top-right', $event)"
      ></div>
      <div 
        class="handle corner-handle bottom-left"
        @mousedown.stop="startResize('bottom-left', $event)"
      ></div>
      <div 
        class="handle corner-handle bottom-right"
        @mousedown.stop="startResize('bottom-right', $event)"
      ></div>
      
      <!-- 회전 핸들 (하단 중앙) -->
      <div 
        class="absolute -bottom-8 left-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full border-2 border-purple-500 flex items-center justify-center cursor-pointer pointer-events-auto hover:bg-purple-100 transition-colors"
        @mousedown.stop="startRotate($event)"
      >
        <svg class="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
    </div>
    
    <!-- Empty state overlay -->
    <div 
      v-if="!editorStore.hasVideo"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-center">
        <div class="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-700/50 to-gray-800/50 flex items-center justify-center">
          <svg class="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-gray-400 text-lg font-medium">비디오를 업로드하세요</p>
        <p class="text-gray-500 text-sm mt-1">Pixi.js 캔버스에 렌더링됩니다</p>
      </div>
    </div>
    <!-- Stock Media Modal -->
    <div v-if="showStockModal" class="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div class="bg-white rounded-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 class="text-xl font-bold text-gray-800">Stock Library</h3>
          <button @click="showStockModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <!-- Tabs -->
        <div class="flex border-b border-gray-200">
          <button 
            @click="stockTab = 'video'"
            class="flex-1 py-3 font-medium text-sm transition-colors"
            :class="stockTab === 'video' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'"
          >
            Videos (2)
          </button>
          <button 
            @click="stockTab = 'image'"
            class="flex-1 py-3 font-medium text-sm transition-colors"
            :class="stockTab === 'image' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-500 hover:text-gray-700'"
          >
            Images (2)
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto flex-1 bg-gray-50">
          <div v-if="stockTab === 'video'" class="grid grid-cols-2 gap-4">
            <div 
              v-for="(item, idx) in stockVideos" 
              :key="idx"
              @click="addStockItem(item, 'video')"
              class="group cursor-pointer bg-black rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all relative aspect-video"
            >
              <img :src="item.thumb" class="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div class="bg-white/20 backdrop-blur rounded-full p-2">
                  <svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                </div>
              </div>
              <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                <div class="text-white text-sm font-medium">{{ item.title }}</div>
              </div>
            </div>
          </div>
          
          <div v-if="stockTab === 'image'" class="grid grid-cols-2 gap-4">
            <div 
              v-for="(item, idx) in stockImages" 
              :key="idx"
              @click="addStockItem(item, 'image')"
              class="group cursor-pointer bg-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all relative aspect-video"
            >
              <img :src="item.url" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div class="text-white text-sm font-medium">{{ item.title }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid #a855f7;
  border-radius: 2px;
  pointer-events: auto;
  cursor: pointer;
  transition: background-color 0.15s;
}

.handle:hover {
  background: #f3e8ff;
}

.corner-handle.top-left {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.corner-handle.top-right {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.corner-handle.bottom-left {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.corner-handle.bottom-right {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}
</style>


