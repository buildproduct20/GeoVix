import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// index.html의 root 요소에 React 앱을 연결한다. StrictMode는 개발 중 effect의 초기화와 정리 문제를 찾는 데 도움을 준다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
