// 합성 조사 영역의 가로·세로 길이(미터)와 지형 격자의 축별 분할 수다.
export const survey = { width: 200, length: 150, segments: 64 }

// 암석층 이름, 색, 지면 아래 시작·끝 깊이(미터). 3D 모델과 상세 패널이 이 데이터를 공유한다.
export const units = [
  { name: 'Sandstone', color: '#cc9c63', from: 0, to: 23 },
  { name: 'Shale', color: '#9f6a6c', from: 23, to: 49 },
  { name: 'Limestone', color: '#688c9b', from: 49, to: 82 },
] as const

// 왼쪽 체크박스가 사용하는 레이어 목록. ID는 Three.js Group의 이름과 대응한다.
export const layers = [
  { id: 'terrain', label: 'Terrain', color: '#81a891' },
  { id: 'strata', label: 'Rock units', color: '#cc9c63' },
  { id: 'holes', label: 'Drillholes', color: '#74dbc1' },
  { id: 'grid', label: 'Reference grid', color: '#759093' },
] as const

// 목록에서 레이어 ID 타입을 만들고, 모든 레이어가 표시 여부 값을 갖게 한다.
export type LayerId = (typeof layers)[number]['id']
export type LayerVisibility = Record<LayerId, boolean>
export type CameraView = 'perspective' | 'top'

// X/Z 평면 좌표에서 지면의 Y 높이를 구한다. 삼각함수로 굴곡을 만들고 지수함수로 산등성이를 더한다.
export function elevationAt(x: number, z: number) {
  const ridge = 14 * Math.exp(-((x - 32) ** 2 + (z + 23) ** 2) / 1500)
  return 7 * Math.sin(x * .047) + 5 * Math.cos(z * .062) + ridge + 2 * Math.sin((x + z) * .13)
}

// 각 행은 [현지 X 좌표, 현지 Z 좌표, 지면에서 수직으로 내려간 총 깊이]이며 단위는 미터다.
const samples = [
  [-70, -44, 68], [-26, -40, 76], [28, -43, 62], [67, -20, 74],
  [-55, 19, 65], [-9, 22, 80], [38, 19, 69], [69, 50, 77],
] as const

// 각 샘플에 시추공 ID와 지면 높이를 붙인다. 예를 들어 네 번째 샘플의 ID는 DH-04다.
export const drillholes = samples.map(([x, z, depth], index) => ({
  id: `DH-${String(index + 1).padStart(2, '0')}`,
  x,
  z,
  depth,
  elevation: elevationAt(x, z),
  // 시추공이 도달한 층만 남기고, 마지막 구간의 끝을 시추공 총 깊이에 맞춰 자른다.
  intervals: units
    .filter(unit => depth > unit.from)
    .map(unit => ({ ...unit, to: Math.min(depth, unit.to) })),
}))

// 배열 원소에서 시추공 타입을 추론해 별도 타입 정의의 중복을 피한다.
export type Drillhole = (typeof drillholes)[number]
