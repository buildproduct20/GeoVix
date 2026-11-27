import {
  BackSide, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, GridHelper,
  Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry,
} from 'three'
import { drillholes, elevationAt, survey, units } from './survey'

// 측량 데이터가 정한 가로·세로 길이와 격자 분할 수를 가져온다.
const { width, length, segments } = survey

// 정점 좌표와 삼각형 인덱스를 Three.js가 그릴 수 있는 BufferGeometry로 바꾼다.
function indexedGeometry(positions: number[], indices: number[]) {
  const geometry = new BufferGeometry()
  // 위치 배열에서 숫자 세 개가 정점 하나의 X, Y(높이), Z 좌표다.
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  // 법선은 표면이 어느 쪽을 향하는지 나타낸다. 조명이 표면에 어떻게 보일지 계산할 때 사용한다.
  geometry.computeVertexNormals()
  return geometry
}

// 격자점에 높이를 부여해 이어 붙인다. offset을 늘리면 같은 모양을 더 깊은 곳에 만들 수 있다.
function surfaceGeometry(offset: number, terrain = false) {
  const positions: number[] = []
  const indices: number[] = []
  const colors: number[] = []
  const low = new Color('#3b665c')
  const middle = new Color('#749077')
  const high = new Color('#a5ac7b')
  const color = new Color()

  // 가로·세로 기준점이 모델 중앙에 오도록 격자를 만들고, 좌표마다 표면 높이를 계산한다.
  for (let row = 0; row <= segments; row++) {
    const z = length * (row / segments - .5)
    for (let column = 0; column <= segments; column++) {
      const x = width * (column / segments - .5)
      const elevation = elevationAt(x, z)
      positions.push(x, elevation - offset, z)
      // 지형 표면일 때만 각 정점에 낮은 곳부터 높은 곳까지의 색을 보간해 넣는다.
      if (terrain) {
        const t = Math.min(1, Math.max(0, (elevation + 14) / 36))
        if (t < .55) color.lerpColors(low, middle, t / .55)
        else color.lerpColors(middle, high, (t - .55) / .45)
        colors.push(color.r, color.g, color.b)
      }
    }
  }
  // 격자 한 칸의 모서리 정점 네 개를 두 삼각형으로 연결한다. 이웃한 칸은 같은 정점을 재사용한다.
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const a = row * (segments + 1) + column
      const b = a + segments + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  // 정점 색상을 쓰는 경우 RGB 세 값씩 추가한다. 아래에서 vertexColors를 켜야 이 색이 보인다.
  const geometry = indexedGeometry(positions, indices)
  if (terrain) geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

type Corner = readonly [x: number, z: number]

// 암석층의 한쪽 벽을 만든다. 경계를 따라 위·아래 깊이의 정점을 쌍으로 배치한다.
function wallGeometry(start: Corner, end: Corner, from: number, to: number) {
  const positions: number[] = []
  const indices: number[] = []
  for (let step = 0; step <= segments; step++) {
    const t = step / segments
    const x = start[0] + (end[0] - start[0]) * t
    const z = start[1] + (end[1] - start[1]) * t
    const y = elevationAt(x, z)
    positions.push(x, y - from, z, x, y - to, z)
    // 연속된 정점 두 쌍으로 벽 한 칸의 삼각형 두 개를 만든다.
    if (step < segments) {
      const a = step * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  return indexedGeometry(positions, indices)
}

// 레이어별 Group을 만들어 체크박스로 각 레이어를 한 번에 켜고 끌 수 있게 한다.
export function buildModel() {
  const terrain = new Group()
  const strata = new Group()
  const holes = new Group()
  const grid = new Group()

  // Mesh는 모양을 정하는 Geometry와 빛·색을 정하는 Material을 합친 3D 물체다.
  const terrainMesh = new Mesh(
    surfaceGeometry(0, true),
    new MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  )
  terrain.add(terrainMesh)

  // 사각형 조사 영역의 네 모서리를 따라 각 암석층의 옆면을 추가한다.
  const corners = [
    [-width / 2, -length / 2], [width / 2, -length / 2],
    [width / 2, length / 2], [-width / 2, length / 2],
  ] as const
  const rockMaterials = units.map(unit => new MeshStandardMaterial({ color: unit.color, roughness: .95 }))
  units.forEach((unit, index) => {
    const material = rockMaterials[index]
    corners.forEach((corner, edge) => {
      const end = corners[(edge + 1) % corners.length]
      strata.add(new Mesh(wallGeometry(corner, end, unit.from, unit.to), material))
    })
  })
  // 가장 깊은 층 아래를 막는다. BackSide로 이 지형 메시의 뒷면을 보여 바닥이 아래를 향하게 한다.
  const bottom = new Mesh(surfaceGeometry(units[units.length - 1].to), new MeshStandardMaterial({
    color: units[units.length - 1].color,
    side: BackSide,
  }))
  strata.add(bottom)

  // 암석층 내부에는 덮개를 만들지 않아 지형을 숨기면 시추 구간이 보인다.
  // 모델보다 아래에 기준 격자를 놓아 장면에서 위치와 크기를 가늠할 수 있게 한다.
  const gridHelper = new GridHelper(380, 19, '#4b6868', '#32494b')
  gridHelper.position.y = -104
  grid.add(gridHelper)

  // 모든 시추공이 구와 단위 원기둥의 모양을 공유한다. 메시마다 위치와 크기만 따로 지정한다.
  const capGeometry = new SphereGeometry(3.15, 16, 12)
  const tubeGeometry = new CylinderGeometry(1, 1, 1, 12)
  const normalCap = new MeshStandardMaterial({ color: '#75e3c4', emissive: '#265e53' })
  const selectedCap = new MeshStandardMaterial({ color: '#f9dc9c', emissive: '#81602b' })
  // 오른쪽 인스펙터와 같은 암석층 색으로 시추 구간의 재질을 만든다.
  const sampleMaterials = new Map(units.map(unit => [
    unit.name, new MeshStandardMaterial({ color: unit.color, emissive: unit.color, emissiveIntensity: .28 }),
  ]))
  // 선택된 시추공을 표시하는 고리. 수평으로 눕힌 뒤 선택이 생길 때까지 숨긴다.
  const ring = new Mesh(
    new TorusGeometry(5.2, .32, 8, 32),
    new MeshBasicMaterial({ color: '#ffde9d' }),
  )
  ring.rotateX(-Math.PI / 2)
  ring.visible = false
  holes.add(ring)

  // ID로 꼭대기 구를 찾는 Map과, 클릭된 메시로 시추공 ID를 찾는 Map을 각각 둔다.
  const caps = new Map<string, Mesh>()
  const holeIds = new Map<Mesh, string>()

  function addPickable(mesh: Mesh, id: string) {
    holes.add(mesh)
    holeIds.set(mesh, id)
  }

  // 지면 위에 구 모양 표식과 짧은 원기둥을 배치해 시추공 입구를 표시한다.
  for (const hole of drillholes) {
    const cap = new Mesh(capGeometry, normalCap)
    cap.position.set(hole.x, hole.elevation + 4, hole.z)
    caps.set(hole.id, cap)
    addPickable(cap, hole.id)

    const stem = new Mesh(tubeGeometry, normalCap)
    stem.scale.set(.68, 4, .68)
    stem.position.set(hole.x, hole.elevation + 2, hole.z)
    addPickable(stem, hole.id)

    // 코어의 원기둥 높이는 구간 길이, 중심 높이는 지면에서 구간의 중간 깊이를 뺀 값이다.
    for (const interval of hole.intervals) {
      const core = new Mesh(tubeGeometry, sampleMaterials.get(interval.name))
      core.scale.set(1.75, interval.to - interval.from, 1.75)
      core.position.set(hole.x, hole.elevation - (interval.from + interval.to) / 2, hole.z)
      addPickable(core, hole.id)
    }
  }

  // 선택된 시추공의 구만 색을 바꾸고, 고리도 그 구의 위치로 옮긴다.
  function selectHole(id: string) {
    for (const [holeId, cap] of caps) {
      cap.material = holeId === id ? selectedCap : normalCap
    }
    const selected = caps.get(id)
    ring.visible = Boolean(selected)
    if (selected) ring.position.copy(selected.position)
  }

  return {
    groups: { terrain, strata, holes, grid },
    terrainMesh,
    holeIds,
    selectHole,
    // 선택 여부에 따라 메시에서 빠져 있는 재질도 뷰어 종료 시 해제할 수 있게 전달한다.
    capMaterials: [normalCap, selectedCap],
  }
}
