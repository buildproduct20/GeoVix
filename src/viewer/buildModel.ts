import {
  BackSide, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, GridHelper,
  Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry,
} from 'three'
import { drillholes, elevationAt, survey, units } from './survey'

const { width, length, segments } = survey

function indexedGeometry(positions: number[], indices: number[]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function surfaceGeometry(offset: number, terrain = false) {
  const positions: number[] = []
  const indices: number[] = []
  const colors: number[] = []
  const low = new Color('#3b665c')
  const middle = new Color('#749077')
  const high = new Color('#a5ac7b')
  const color = new Color()

  for (let row = 0; row <= segments; row++) {
    const z = length * (row / segments - .5)
    for (let column = 0; column <= segments; column++) {
      const x = width * (column / segments - .5)
      const elevation = elevationAt(x, z)
      positions.push(x, elevation - offset, z)
      if (terrain) {
        const t = Math.min(1, Math.max(0, (elevation + 14) / 36))
        if (t < .55) color.lerpColors(low, middle, t / .55)
        else color.lerpColors(middle, high, (t - .55) / .45)
        colors.push(color.r, color.g, color.b)
      }
    }
  }
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const a = row * (segments + 1) + column
      const b = a + segments + 1
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }

  const geometry = indexedGeometry(positions, indices)
  if (terrain) geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

type Corner = readonly [x: number, z: number]

function wallGeometry(start: Corner, end: Corner, from: number, to: number) {
  const positions: number[] = []
  const indices: number[] = []
  for (let step = 0; step <= segments; step++) {
    const t = step / segments
    const x = start[0] + (end[0] - start[0]) * t
    const z = start[1] + (end[1] - start[1]) * t
    const y = elevationAt(x, z)
    positions.push(x, y - from, z, x, y - to, z)
    if (step < segments) {
      const a = step * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  return indexedGeometry(positions, indices)
}

export function buildModel() {
  const terrain = new Group()
  const strata = new Group()
  const holes = new Group()
  const grid = new Group()

  const terrainMesh = new Mesh(
    surfaceGeometry(0, true),
    new MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  )
  terrain.add(terrainMesh)

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
  // Close the block below. Its underside faces away from the terrain.
  const bottom = new Mesh(surfaceGeometry(units[units.length - 1].to), new MeshStandardMaterial({
    color: units[units.length - 1].color,
    side: BackSide,
  }))
  strata.add(bottom)

  // An open block makes the drill intervals visible when terrain is hidden.
  // Each interval uses the data and color exposed in the React inspector.
  const gridHelper = new GridHelper(380, 19, '#4b6868', '#32494b')
  gridHelper.position.y = -104
  grid.add(gridHelper)

  const capGeometry = new SphereGeometry(3.15, 16, 12)
  const tubeGeometry = new CylinderGeometry(1, 1, 1, 12)
  const normalCap = new MeshStandardMaterial({ color: '#75e3c4', emissive: '#265e53' })
  const selectedCap = new MeshStandardMaterial({ color: '#f9dc9c', emissive: '#81602b' })
  const sampleMaterials = new Map(units.map(unit => [
    unit.name, new MeshStandardMaterial({ color: unit.color, emissive: unit.color, emissiveIntensity: .28 }),
  ]))
  const ring = new Mesh(
    new TorusGeometry(5.2, .32, 8, 32),
    new MeshBasicMaterial({ color: '#ffde9d' }),
  )
  ring.rotateX(-Math.PI / 2)
  ring.visible = false
  holes.add(ring)

  const caps = new Map<string, Mesh>()
  const holeIds = new Map<Mesh, string>()

  function addPickable(mesh: Mesh, id: string) {
    holes.add(mesh)
    holeIds.set(mesh, id)
  }

  for (const hole of drillholes) {
    const cap = new Mesh(capGeometry, normalCap)
    cap.position.set(hole.x, hole.elevation + 4, hole.z)
    caps.set(hole.id, cap)
    addPickable(cap, hole.id)

    const stem = new Mesh(tubeGeometry, normalCap)
    stem.scale.set(.68, 4, .68)
    stem.position.set(hole.x, hole.elevation + 2, hole.z)
    addPickable(stem, hole.id)

    for (const interval of hole.intervals) {
      const core = new Mesh(tubeGeometry, sampleMaterials.get(interval.name))
      core.scale.set(1.75, interval.to - interval.from, 1.75)
      core.position.set(hole.x, hole.elevation - (interval.from + interval.to) / 2, hole.z)
      addPickable(core, hole.id)
    }
  }

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
    // Keep both cap materials available to the renderer cleanup even when unselected.
    capMaterials: [normalCap, selectedCap],
  }
}
