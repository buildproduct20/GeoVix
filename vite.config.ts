import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // 상대 경로를 사용해 GitHub Pages의 /GeoVix/ 같은 하위 경로에서도 빌드한 파일을 찾을 수 있게 한다.
  base: './',
  // Vite에서 React JSX 변환과 개발 중 빠른 화면 갱신을 지원하는 플러그인이다.
  plugins: [react()],
})
