# 🎥 Short Form Video Editor (MVP)

Vue 3와 Pixi.js를 활용한 웹 기반 숏폼 비디오 에디터입니다. 클라이언트 사이드에서 작동하며, 비디오 편집, 효과 적용, 렌더링까지 지원합니다.

## ✨ 주요 기능 (Key Features)

### 1. 비디오 편집 (Core Editing)
- **멀티 트랙 타임라인**: 비디오, 오디오, 텍스트, 이미지 트랙을 레이어 방식으로 관리
- **클립 조작**: 드래그 앤 드롭으로 클립 이동, 길이 조절(Trimming), 삭제 기능
- **다양한 화면비**: 9:16 (Shorts/Reels), 16:9 (YouTube), 1:1 (Insta), 4:5 등 지원

### 2. 그래픽 및 렌더링 (Pixi.js)
- **고성능 렌더링**: WebGL 기반(Pixi.js)의 부드러운 60fps 실시간 미리보기
- **트랜스폼 컨트롤**: 캔버스 상에서 직접 크기 조절(Resize), 회전(Rotate), 위치 이동 가능
- **색상 보정**: 밝기, 대비, 채도, 색조 조절 및 다양한 필터 프리셋(Sepia, Vintage, Polaroid 등) 제공

### 3. 텍스트 및 애니메이션 (Typography & Motion)
- **텍스트 스타일**: 폰트, 크기, 색상, 배경색, 굵게/기울임 설정
- **모션 이펙트**: 
  - 등장(Entrance): 페이드, 슬라이드, 확대/축소, 타자기 효과
  - 퇴장(Exit): 페이드, 슬라이드, 축소 효과

### 4. 확장 및 고급 기능
- **AI 도구 (Demo)**: 자동 자막 생성 및 TTS(음성 합성) UI/로직 구현 (Mock 데이터 사용)
- **스톡 미디어 (Demo)**: 외부 비디오/이미지 라이브러리 연동 UI 제공
- **내보내기 (Export)**: `MediaRecorder` API를 활용하여 오디오가 포함된 .webm 형식으로 클라이언트 사이드 렌더링 및 다운로드

## 🛠 기술 스택 (Tech Stack)
- **Framework**: Vue 3 (Composition API)
- **Language**: TypeScript
- **Rendering Engine**: Pixi.js v8
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Bundler**: Vite

## 🚀 실행 방법 (Getting Started)

프로젝트를 로컬 환경에서 실행하려면 다음 명령어를 사용하세요.

```bash
# 1. 의존성 패키지 설치
npm install

# 2. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하여 에디터를 사용할 수 있습니다.
