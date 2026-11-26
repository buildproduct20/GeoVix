import {
  BufferGeometry, DirectionalLight, HemisphereLight, LineSegments, Material, Mesh,
  OrthographicCamera, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildModel } from './buildModel'
import type { CameraView, LayerVisibility } from './survey'

export type RenderMetrics = { calls: number; triangles: number }
export type RendererStatus = 'loading' | 'ready' | 'unavailable' | 'context-lost'

type ViewerEvents = {
  onSelect: (id: string) => void
  onRender: (metrics: RenderMetrics) => void
  onStatus: (status: RendererStatus) => void
}

export function createViewer(host: HTMLDivElement, events: ViewerEvents) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  const { domElement: canvas } = renderer
  canvas.setAttribute('aria-hidden', 'true')
  host.append(canvas)

  const scene = new Scene()
  const perspective = new PerspectiveCamera(42, 1, .5, 1500)
  const top = new OrthographicCamera(-125, 125, 100, -100, .5, 1500)
  let camera: PerspectiveCamera | OrthographicCamera = perspective
  const controls = new OrbitControls<PerspectiveCamera | OrthographicCamera>(camera, canvas)
  controls.minDistance = 55
  controls.maxDistance = 700
  controls.minZoom = .5
  controls.maxZoom = 4
  controls.maxPolarAngle = Math.PI * .87

  const key = new DirectionalLight('#fff1db', 2.15)
  key.position.set(-90, 145, 130)
  const fill = new DirectionalLight('#a9cddf', .7)
  fill.position.set(130, 80, -130)
  scene.add(new HemisphereLight('#e1f4f4', '#4f5361', 2), key, fill)

  const model = buildModel()
  scene.add(...Object.values(model.groups))

  let frame: number | undefined
  let lastMetrics: RenderMetrics | undefined
  let contextLost = false

  function invalidate() {
    if (frame !== undefined || contextLost) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return
      renderer.render(scene, camera)
      const { calls, triangles } = renderer.info.render
      if (lastMetrics?.calls !== calls || lastMetrics.triangles !== triangles) {
        lastMetrics = { calls, triangles }
        events.onRender(lastMetrics)
      }
    })
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = host
    if (!width || !height) return
    const aspect = width / height
    const baseHalfFov = 21 * Math.PI / 180
    perspective.aspect = aspect
    perspective.fov = 2 * Math.atan(Math.tan(baseHalfFov) / Math.min(1, aspect)) * 180 / Math.PI
    perspective.updateProjectionMatrix()

    const halfHeight = Math.max(100, 125 / aspect)
    top.left = -halfHeight * aspect
    top.right = halfHeight * aspect
    top.top = halfHeight
    top.bottom = -halfHeight
    top.updateProjectionMatrix()

    renderer.setSize(width, height, false)
    invalidate()
  }

  function setView(view: CameraView) {
    const overhead = view === 'top'
    camera = overhead ? top : perspective
    controls.object = camera
    controls.enableRotate = !overhead
    if (overhead) {
      top.zoom = 1
      top.position.set(0, 350, .01)
      top.updateProjectionMatrix()
      controls.target.set(0, 0, 0)
    } else {
      perspective.position.set(216, 126, 245)
      controls.target.set(0, -50, 0)
    }
    controls.update()
    invalidate()
  }

  function setLayers(visibility: LayerVisibility) {
    for (const layer of Object.keys(visibility) as (keyof LayerVisibility)[]) {
      model.groups[layer].visible = visibility[layer]
    }
    invalidate()
  }

  function setSelection(id: string) {
    model.selectHole(id)
    invalidate()
  }

  const ray = new Raycaster()
  const pointer = new Vector2()
  const pickables = [...model.holeIds.keys()]
  let press: { id: number; x: number; y: number } | undefined

  function handlePointerDown(event: PointerEvent) {
    press = event.isPrimary && event.button === 0
      ? { id: event.pointerId, x: event.clientX, y: event.clientY }
      : undefined
  }

  function handlePointerMove(event: PointerEvent) {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) {
      press = undefined
    }
  }

  function handlePointerUp(event: PointerEvent) {
    const tap = press?.id === event.pointerId
    press = undefined
    if (!tap || contextLost || !model.groups.holes.visible) return

    const bounds = canvas.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return

    pointer.set(x * 2 - 1, 1 - y * 2)
    camera.updateMatrixWorld()
    scene.updateMatrixWorld(true)
    ray.setFromCamera(pointer, camera)

    const { terrain, strata } = model.groups
    // The closest hit wins, so a visible surface blocks picks on buried cores.
    const candidates = [
      ...pickables,
      ...(terrain.visible ? [model.terrainMesh] : []),
      ...(strata.visible ? strata.children : []),
    ]
    const hit = ray.intersectObjects(candidates, false)[0]
    if (hit?.object instanceof Mesh) {
      const id = model.holeIds.get(hit.object)
      if (id) events.onSelect(id)
    }
  }

  function cancelPointer() {
    press = undefined
  }

  function handleContextLost(event: Event) {
    event.preventDefault()
    contextLost = true
    events.onStatus('context-lost')
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
  }

  function handleContextRestored() {
    contextLost = false
    events.onStatus('ready')
    invalidate()
  }

  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('pointercancel', cancelPointer)
  canvas.addEventListener('webglcontextlost', handleContextLost)
  canvas.addEventListener('webglcontextrestored', handleContextRestored)
  controls.addEventListener('change', invalidate)
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  setView('perspective')
  resize()
  events.onStatus('ready')

  function dispose() {
    observer.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
    controls.removeEventListener('change', invalidate)
    controls.dispose()
    canvas.removeEventListener('pointerdown', handlePointerDown)
    canvas.removeEventListener('pointermove', handlePointerMove)
    canvas.removeEventListener('pointerup', handlePointerUp)
    canvas.removeEventListener('pointercancel', cancelPointer)
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    canvas.removeEventListener('webglcontextrestored', handleContextRestored)

    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>(model.capMaterials)
    scene.traverse(object => {
      if (object instanceof Mesh || object instanceof LineSegments) {
        geometries.add(object.geometry)
        const owned = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of owned) materials.add(material)
      }
    })
    geometries.forEach(geometry => geometry.dispose())
    materials.forEach(material => material.dispose())
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  return { setView, setLayers, setSelection, dispose }
}
