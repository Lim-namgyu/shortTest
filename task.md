# Clipchamp 클론 - 웹 비디오 편집기

## 완료된 작업
- [x] Vue 3 + Vite + Pinia + Tailwind CSS 프로젝트 초기화
- [x] Pixi.js 비디오 캔버스 렌더링
- [x] 기본 재생/일시정지 컨트롤
- [x] 단일 타임라인 바
- [x] 기본 텍스트 오버레이 (드래그 이동)

## Phase 1: 멀티 트랙 타임라인 ✅ 완료
- [x] 멀티 트랙 데이터 구조 설계 (Track/Clip 타입)
- [x] 무제한 비디오/오디오/텍스트 트랙
- [x] 클립 분할 (Split) - 단축키 S
- [x] 클립 트리밍 (시작/끝 드래그)
- [x] 스냅핑 (자석 효과)
- [x] 타임라인 줌/스크롤
- [x] Undo/Redo (Ctrl+Z / Ctrl+Y)
- [x] 복사/붙여넣기/복제 (Ctrl+C/V/D)
- [ ] 썸네일 미리보기 (추후)
- [ ] 오디오 파형 표시 (추후)

## Phase 2: 고급 편집 도구 ✅ 완료
- [x] 속성 편집 패널 UI (PropertyPanel)
- [x] 회전 (0° ~ 360°)
- [x] 반전 (수평/수직)
- [x] 위치 & 스케일 (캔버스 직접 조작)
- [x] 투명도 (0% ~ 100%)
- [x] 속도 조절 (0.25x ~ 8x)
- [x] 화면비 선택 (16:9, 9:16, 1:1 등)
- [x] 오디오 볼륨 (0% ~ 200%)
- [x] 오디오 페이드 인/아웃
- [x] 오디오 음소거
- [ ] 크롭 (자르기) - UI만 추가
- [ ] 오디오 분리 - 추후

## Phase 3: 필터 & 색상 보정 ✅ 완료
- [x] 데이터 구조 업데이트 (Color Params)
- [x] Pixi.js ColorMatrixFilter 통합
- [x] 속성 패널 UI 추가 (색상 탭)
- [x] 기본 조절 (밝기, 대비, 채도, 색조)
- [x] 필터 프리셋 (흑백, 세피아, 빈티지 등)

## Phase 4: 트랜지션 (Slipped) 🚫 취소
- [ ] 트랜지션 데이터 구조
- [ ] Pixi.js 트랜지션 셰이더
- [ ] UI 드래그 앤 드롭 구현

## Phase 5: 텍스트 애니메이션 ✅ 완료
- [x] 텍스트 애니메이션 데이터 구조 활용 (In/Out)
- [x] 속성 패널 UI 추가 (애니메이션 탭)
- [x] 등장(Entrance) 효과 구현 (Fade, Slide, Scale, Typewriter)
- [x] 퇴장(Exit) 효과 구현 (Fade, Slide, Scale)

## Phase 6: AI 기능 (Mock 구현) ✅ 완료
- [x] 자동 자막 생성 (Mock Data)
- [x] TTS 음성 생성 (Mock Logic)

## Phase 7: 스톡 미디어 (Mock 구현) ✅ 완료
- [x] Pexels/Pixabay API 연동 (Mock Data & Modal UI)

## Phase 8: 내보내기 (Mock/API) ✅ 완료
- [x] FFmpeg.wasm 연동 (MediaRecorder로 대체)
- [x] 비디오 렌더링 및 다운로드 구현
