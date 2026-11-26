import { useEffect, useRef, useState } from 'react'
import { createViewer } from './createViewer'
import type { RenderMetrics, RendererStatus } from './createViewer'
import type { CameraView, LayerVisibility } from './survey'

type ViewportProps = {
  visibility: LayerVisibility
  selectedId: string
  onSelect: (id: string) => void
}

export function Viewport({ visibility, selectedId, onSelect }: ViewportProps) {
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<ReturnType<typeof createViewer> | null>(null)
  const [view, setView] = useState<CameraView>('perspective')
  const [status, setStatus] = useState<RendererStatus>('loading')
  const [metrics, setMetrics] = useState<RenderMetrics>()

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
    return () => {
      viewer.current?.dispose()
      viewer.current = null
    }
  }, [onSelect])

  useEffect(() => {
    viewer.current?.setLayers(visibility)
  }, [visibility, onSelect])

  useEffect(() => {
    viewer.current?.setSelection(selectedId)
  }, [selectedId, onSelect])

  function chooseView(next: CameraView) {
    setView(next)
    viewer.current?.setView(next)
  }

  const ready = status === 'ready'

  return (
    <section className="viewport" aria-label="3D viewport">
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
