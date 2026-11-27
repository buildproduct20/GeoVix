import {
  BufferGeometry, DirectionalLight, HemisphereLight, LineSegments, Material, Mesh,
  OrthographicCamera, PerspectiveCamera, Raycaster, Scene, Vector2, WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildModel } from './buildModel'
import type { CameraView, LayerVisibility } from './survey'

// 렌더러가 한 프레임에 실행한 그리기 호출 수와 그린 삼각형 수를 React에 전달한다.
export type RenderMetrics = { calls: number; triangles: number }
export type RendererStatus = 'loading' | 'ready' | 'unavailable' | 'context-lost'

// Three.js에서 생긴 선택, 통계, 상태 변화를 React에 알리는 콜백이다.
type ViewerEvents = {
  onSelect: (id: string) => void
  onRender: (metrics: RenderMetrics) => void
  onStatus: (status: RendererStatus) => void
}

// 뷰어의 시작점. React가 제공한 div 안에 캔버스를 넣고 3D 화면의 수명 주기를 관리한다.
export function createViewer(host: HTMLDivElement, events: ViewerEvents) {
  // alpha로 캔버스 뒤 CSS 배경이 비치게 하고, antialias로 모서리의 계단 현상을 줄인다.
  const renderer = new WebGLRenderer({ alpha: true, antialias: true })
  // 고해상도 화면에서도 선명하게 그리되 픽셀 비율을 2로 제한해 GPU 비용을 줄인다.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // WebGLRenderer가 만든 실제 HTML canvas. 이 요소가 렌더링 결과를 표시하고 마우스 입력도 받는다.
  const { domElement: canvas } = renderer
  canvas.setAttribute('aria-hidden', 'true')
  host.append(canvas)

  // Scene은 3D 물체와 조명이 들어가는 공간이다. 활성 카메라가 이 공간을 어떤 각도에서 볼지 결정한다.
  const scene = new Scene()
  // 원근 카메라는 먼 물체가 작게 보인다. 위에서 내려보는 직교 카메라는 거리에 관계없이 같은 크기로 투영한다.
  const perspective = new PerspectiveCamera(42, 1, .5, 1500)
  const top = new OrthographicCamera(-125, 125, 100, -100, .5, 1500)
  let camera: PerspectiveCamera | OrthographicCamera = perspective
  // OrbitControls는 캔버스의 입력을 카메라 회전, 이동, 확대·축소로 바꾼다.
  const controls = new OrbitControls<PerspectiveCamera | OrthographicCamera>(camera, canvas)
  controls.minDistance = 55
  controls.maxDistance = 700
  controls.minZoom = .5
  controls.maxZoom = 4
  controls.maxPolarAngle = Math.PI * .87

  // 주광과 보조광으로 입체감을 만들고, 반구 조명으로 위아래 방향에 부드러운 기본 빛을 더한다.
  const key = new DirectionalLight('#fff1db', 2.15)
  key.position.set(-90, 145, 130)
  const fill = new DirectionalLight('#a9cddf', .7)
  fill.position.set(130, 80, -130)
  scene.add(new HemisphereLight('#e1f4f4', '#4f5361', 2), key, fill)

  // 지형, 암석층, 시추공, 기준 격자를 만든 뒤 각각의 Group을 장면에 올린다.
  const model = buildModel()
  scene.add(...Object.values(model.groups))

  let frame: number | undefined
  let lastMetrics: RenderMetrics | undefined
  let contextLost = false

  // 카메라나 데이터가 바뀌었을 때만 다음 화면 갱신을 예약한다. 여러 요청이 와도 프레임당 한 번만 그린다.
  function invalidate() {
    if (frame !== undefined || contextLost) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return
      // 지금 활성화된 카메라로 본 Scene을 캔버스의 픽셀로 그린다.
      renderer.render(scene, camera)
      const { calls, triangles } = renderer.info.render
      // 통계 수치가 달라졌을 때만 React에 전달해 불필요한 UI 렌더링을 피한다.
      if (lastMetrics?.calls !== calls || lastMetrics.triangles !== triangles) {
        lastMetrics = { calls, triangles }
        events.onRender(lastMetrics)
      }
    })
  }

  // 브라우저 창 전체 대신 캔버스를 감싼 div의 실제 크기에 두 카메라를 맞춘다.
  function resize() {
    const { clientWidth: width, clientHeight: height } = host
    if (!width || !height) return
    const aspect = width / height
    // 기본 세로 시야각은 42도다. 세로로 긴 화면에서는 시야를 넓혀 모델의 좌우가 잘리는 것을 줄인다.
    const baseHalfFov = 21 * Math.PI / 180
    perspective.aspect = aspect
    perspective.fov = 2 * Math.atan(Math.tan(baseHalfFov) / Math.min(1, aspect)) * 180 / Math.PI
    perspective.updateProjectionMatrix()

    // 직교 카메라의 가로·세로 범위를 조절해 좁은 화면에서도 모델을 담을 공간을 확보한다.
    const halfHeight = Math.max(100, 125 / aspect)
    top.left = -halfHeight * aspect
    top.right = halfHeight * aspect
    top.top = halfHeight
    top.bottom = -halfHeight
    top.updateProjectionMatrix()

    // 캔버스의 그리기 버퍼를 새 크기로 맞춘다. CSS 레이아웃 크기는 CSS가 계속 제어한다.
    renderer.setSize(width, height, false)
    invalidate()
  }

  // 뷰를 바꾸거나 초기화할 때 카메라 위치와 바라볼 지점을 함께 설정한다.
  function setView(view: CameraView) {
    const overhead = view === 'top'
    camera = overhead ? top : perspective
    controls.object = camera
    // 위에서 내려보는 모드에서는 회전을 꺼서 지도를 보듯 이동하고 확대할 수 있게 한다.
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
    // 바뀐 위치와 타깃을 컨트롤에 반영하고 새 프레임을 요청한다.
    controls.update()
    invalidate()
  }

  // 체크박스 상태를 같은 이름의 Three.js Group에 반영해 레이어를 통째로 표시하거나 숨긴다.
  function setLayers(visibility: LayerVisibility) {
    for (const layer of Object.keys(visibility) as (keyof LayerVisibility)[]) {
      model.groups[layer].visible = visibility[layer]
    }
    invalidate()
  }

  // 선택된 시추공의 강조 표시를 바꾼 뒤 새 화면을 예약한다.
  function setSelection(id: string) {
    model.selectHole(id)
    invalidate()
  }

  // Raycaster는 화면 좌표를 지나는 가상의 광선을 쏴서 만나는 3D 물체를 찾는다.
  const ray = new Raycaster()
  const pointer = new Vector2()
  const pickables = [...model.holeIds.keys()]
  let press: { id: number; x: number; y: number } | undefined

  // 기본 포인터와 왼쪽 버튼의 시작 위치를 보관해 클릭 후보를 기록한다.
  function handlePointerDown(event: PointerEvent) {
    press = event.isPrimary && event.button === 0
      ? { id: event.pointerId, x: event.clientX, y: event.clientY }
      : undefined
  }

  // 시작점에서 5픽셀보다 많이 움직였으면 카메라 드래그로 보고 클릭 후보를 취소한다.
  function handlePointerMove(event: PointerEvent) {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) {
      press = undefined
    }
  }

  // 같은 포인터가 눌렀다 뗀 입력만 선택으로 처리한다. 시추공 레이어가 꺼져 있으면 건너뛴다.
  function handlePointerUp(event: PointerEvent) {
    const tap = press?.id === event.pointerId
    press = undefined
    if (!tap || contextLost || !model.groups.holes.visible) return

    // 브라우저 창 기준 픽셀 좌표를 캔버스 안의 0~1 비율로 변환한다.
    const bounds = canvas.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return

    // Three.js가 받는 -1~1 범위로 바꾸고, 위쪽이 양수가 되도록 Y축을 뒤집는다.
    pointer.set(x * 2 - 1, 1 - y * 2)
    // 카메라와 물체의 최신 위치를 월드 좌표에 반영한 뒤 그 좌표를 기준으로 광선을 만든다.
    camera.updateMatrixWorld()
    scene.updateMatrixWorld(true)
    ray.setFromCamera(pointer, camera)

    const { terrain, strata } = model.groups
    // 가장 가까운 교차점만 확인한다. 지형이나 암석 벽이 먼저 맞으면 뒤에 가려진 코어는 선택되지 않는다.
    const candidates = [
      ...pickables,
      ...(terrain.visible ? [model.terrainMesh] : []),
      ...(strata.visible ? strata.children : []),
    ]
    const hit = ray.intersectObjects(candidates, false)[0]
    // 맞은 메시가 시추공 ID에 연결돼 있으면 React에 선택을 전달한다.
    if (hit?.object instanceof Mesh) {
      const id = model.holeIds.get(hit.object)
      if (id) events.onSelect(id)
    }
  }

  // 브라우저가 포인터 입력을 취소하면 진행 중인 클릭 후보도 지운다.
  function cancelPointer() {
    press = undefined
  }

  // WebGL 컨텍스트가 끊기면 렌더링을 멈추고, 브라우저가 복구를 시도할 수 있게 한다.
  function handleContextLost(event: Event) {
    event.preventDefault()
    contextLost = true
    events.onStatus('context-lost')
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
  }

  // 컨텍스트가 복구되면 준비 상태로 돌아가고 다시 그린다.
  function handleContextRestored() {
    contextLost = false
    events.onStatus('ready')
    invalidate()
  }

  // 입력, WebGL 상태, 카메라 이동, 컨테이너 크기 변경을 구독한 뒤 첫 화면을 준비한다.
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

  // React에서 뷰어가 내려갈 때 등록한 이벤트와 프레임을 정리한다.
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

    // 여러 메시가 같은 형상이나 재질을 공유하므로 Set으로 모아서 각각 한 번만 GPU 리소스를 해제한다.
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
    // 렌더러 자체를 정리하고 WebGL 컨텍스트와 캔버스도 제거한다.
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  // React가 뷰어를 제어하거나 정리하는 데 필요한 함수만 돌려준다.
  return { setView, setLayers, setSelection, dispose }
}
