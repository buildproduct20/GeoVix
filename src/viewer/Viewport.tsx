import { useEffect, useRef, useState } from 'react'
import { createViewer } from './createViewer'
import type { RenderMetrics, RendererStatus } from './createViewer'
import type { CameraView, LayerVisibility } from './survey'

// App에서 오는 표시 상태와 선택 ID, 캔버스에서 선택했을 때 App에 알릴 콜백이다.
type ViewportProps = {
  visibility: LayerVisibility
  selectedId: string
  onSelect: (id: string) => void
}

// 일반 React UI와 Three.js 뷰어를 연결한다. Three.js는 host div에 직접 캔버스를 붙인다.
export function Viewport({ visibility, selectedId, onSelect }: ViewportProps) {
  // DOM 요소와 뷰어 인스턴스는 화면을 다시 그릴 필요 없이 참조값을 유지하는 ref에 둔다.
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<ReturnType<typeof createViewer> | null>(null)
  // 툴바의 카메라 표시와 로딩·오류 상태, 렌더링 통계는 React 상태로 관리한다.
  const [view, setView] = useState<CameraView>('perspective')
  const [status, setStatus] = useState<RendererStatus>('loading')
  const [metrics, setMetrics] = useState<RenderMetrics>()

  // DOM이 만들어진 뒤 뷰어를 초기화한다. 초기화 오류는 화면 상태로 표시한다.
  useEffect(() => {
    if (!host.current) return
    try {
      viewer.current = createViewer(host.current, {
        onSelect,
        onRender: setMetrics,
        onStatus: setStatus,
      })
    } catch {
      setStatus('unavailable')
    }
    // 컴포넌트가 내려가거나 뷰어를 다시 만들 때 기존 이벤트와 GPU 리소스를 정리한다.
    return () => {
      viewer.current?.dispose()
      viewer.current = null
    }
  }, [onSelect])

  // 체크박스 상태가 바뀌거나 뷰어가 다시 만들어지면 레이어 표시 여부를 적용한다.
  useEffect(() => {
    viewer.current?.setLayers(visibility)
  }, [visibility, onSelect])

  // 선택 ID가 바뀌거나 뷰어가 다시 만들어지면 캔버스의 강조 표시를 맞춘다.
  useEffect(() => {
    viewer.current?.setSelection(selectedId)
  }, [selectedId, onSelect])

  // 카메라 모드를 React 버튼 상태와 실제 뷰어에 함께 반영한다.
  function chooseView(next: CameraView) {
    setView(next)
    viewer.current?.setView(next)
  }

  // 렌더러가 준비되었을 때만 카메라 버튼을 조작할 수 있다.
  const ready = status === 'ready'

  return (
    <section className="viewport" aria-label="3D viewport">
      {/* Three.js가 캔버스를 넣는 자리. 아래 툴바와 메시지는 React가 그리는 HTML이다. */}
      <div className="scene" ref={host} />
      <div className="viewport-toolbar">
        <div className="view-options" role="group" aria-label="Camera view">
          <button type="button" disabled={!ready} aria-pressed={view === 'perspective'}
            onClick={() => chooseView('perspective')}>Perspective</button>
          <button type="button" disabled={!ready} aria-pressed={view === 'top'}
            onClick={() => chooseView('top')}>Top view</button>
        </div>
        <button type="button" className="reset-button" disabled={!ready}
          onClick={() => viewer.current?.setView(view)}><span aria-hidden="true">↺</span> Reset</button>
      </div>

      {/* 렌더러 상태에 따라 로딩 안내, 초기화 실패, 컨텍스트 손실 메시지를 표시한다. */}
      {status === 'loading' && <p className="scene-message" role="status">Loading the 3D model…</p>}
      {status === 'unavailable' && (
        <p className="scene-message" role="alert">
          The 3D view requires WebGL 2. You can still browse drillhole data in the list.
        </p>
      )}
      {status === 'context-lost' && (
        <p className="scene-message" role="status">
          WebGL context lost. If the view does not recover, reload the page.
        </p>
      )}

      {/* 입력 방식에 맞는 조작 안내와, 준비된 프레임의 렌더링 통계를 보여준다. */}
      <div className="viewport-footer">
        <p className="desktop-instructions">
          {view === 'top' ? 'Right-drag to pan' : 'Drag to orbit · Right-drag to pan'} · Scroll to zoom
        </p>
        <p className="touch-instructions">
          {view === 'top' ? 'Two fingers to pan or zoom' : 'Drag to orbit · Pinch to zoom'}
        </p>
        {ready && metrics && (
          <p className="render-metrics">
            <span>WebGL 2</span> · {metrics.calls} draws · {metrics.triangles.toLocaleString('en-US')} tris
          </p>
        )}
      </div>
    </section>
  )
}
