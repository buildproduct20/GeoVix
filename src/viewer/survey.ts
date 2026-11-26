export const survey = { width: 200, length: 150, segments: 64 }

export const units = [
  { name: 'Sandstone', color: '#cc9c63', from: 0, to: 23 },
  { name: 'Shale', color: '#9f6a6c', from: 23, to: 49 },
  { name: 'Limestone', color: '#688c9b', from: 49, to: 82 },
] as const

export const layers = [
  { id: 'terrain', label: 'Terrain', color: '#81a891' },
  { id: 'strata', label: 'Rock units', color: '#cc9c63' },
  { id: 'holes', label: 'Drillholes', color: '#74dbc1' },
  { id: 'grid', label: 'Reference grid', color: '#759093' },
] as const

export type LayerId = (typeof layers)[number]['id']
export type LayerVisibility = Record<LayerId, boolean>
export type CameraView = 'perspective' | 'top'

export function elevationAt(x: number, z: number) {
  const ridge = 14 * Math.exp(-((x - 32) ** 2 + (z + 23) ** 2) / 1500)
  return 7 * Math.sin(x * .047) + 5 * Math.cos(z * .062) + ridge + 2 * Math.sin((x + z) * .13)
}

// Local X/Z coordinates and vertical drill depths in metres.
const samples = [
  [-70, -44, 68], [-26, -40, 76], [28, -43, 62], [67, -20, 74],
  [-55, 19, 65], [-9, 22, 80], [38, 19, 69], [69, 50, 77],
] as const

export const drillholes = samples.map(([x, z, depth], index) => ({
  id: `DH-${String(index + 1).padStart(2, '0')}`,
  x,
  z,
  depth,
  elevation: elevationAt(x, z),
  intervals: units
    .filter(unit => depth > unit.from)
    .map(unit => ({ ...unit, to: Math.min(depth, unit.to) })),
}))

export type Drillhole = (typeof drillholes)[number]
