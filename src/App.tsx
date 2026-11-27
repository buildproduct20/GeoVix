import { useState } from 'react'
import { Viewport } from './viewer/Viewport'
import { drillholes, layers, survey, units } from './viewer/survey'
import type { Drillhole, LayerVisibility } from './viewer/survey'

// 현재 선택한 시추공의 좌표, 입구 높이, 깊이, 암석 구간을 일반 HTML로 표시한다.
function Inspector({ hole }: { hole: Drillhole }) {
  return (
    <aside className="inspector-panel" aria-labelledby="inspector-heading">
      <h2 id="inspector-heading" className="panel-heading">Drillhole inspector</h2>
      <p className="selection-name" role="status" aria-atomic="true">
        <span className="selection-dot" aria-hidden="true" />
        <span className="sr-only">Selected drillhole </span>{hole.id}
      </p>
      <dl className="measurements">
        <div><dt>Local X</dt><dd>{hole.x} m</dd></div>
        <div><dt>Local Z</dt><dd>{hole.z} m</dd></div>
        <div><dt>Collar elevation</dt><dd>{hole.elevation.toFixed(1)} m</dd></div>
        <div><dt>Total depth</dt><dd>{hole.depth} m</dd></div>
      </dl>
      <div className="panel-section">
        <h3 className="panel-heading">Sample intervals</h3>
        {/* 막대의 각 색 구간은 깊이 차이만큼 길어진다. 같은 값은 아래 목록에서도 글자로 읽을 수 있다. */}
        <div className="interval-overview" aria-hidden="true">
          {hole.intervals.map(interval => (
            <span key={interval.name} style={{ backgroundColor: interval.color, flexGrow: interval.to - interval.from }} />
          ))}
        </div>
        <ul className="interval-list">
          {hole.intervals.map(interval => (
            <li key={interval.name}>
              <span className="swatch" style={{ backgroundColor: interval.color }} />
              <span>{interval.name}</span>
              <span className="interval-depth">{interval.from}–{interval.to} m</span>
            </li>
          ))}
        </ul>
        <p className="panel-note">Depths are measured from the drillhole collar.</p>
      </div>
    </aside>
  )
}

// 레이어 표시와 시추공 선택을 관리해 왼쪽 목록, 캔버스, 오른쪽 상세 패널이 같은 상태를 보게 한다.
export function App() {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    terrain: true, strata: true, holes: true, grid: true,
  })
  // 첫 화면의 시추공은 네 번째 샘플(DH-04)이다. 해당 ID의 데이터를 상세 패널에 전달한다.
  const [selectedId, setSelectedId] = useState(drillholes[3].id)
  const hole = drillholes.find(sample => sample.id === selectedId) ?? drillholes[3]

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <span>GeoVix</span>
        </div>
        <span className="header-description">3D Subsurface Explorer</span>
      </header>
      <main className="workspace">
        <div className="workspace-heading">
          <div>
            <h1>Foothills survey</h1>
            <p>Explore the terrain, rock units and drillhole samples.</p>
          </div>
          <p className="survey-summary">
            <span>Synthetic dataset</span>
            <span>{survey.width} × {survey.length} m</span>
            <span>{drillholes.length} drillholes</span>
          </p>
        </div>

        <div className="explorer">
          <aside className="layers-panel" aria-labelledby="layers-heading">
            <h2 className="panel-heading" id="layers-heading">Model layers</h2>
            <div className="layer-list" role="group" aria-labelledby="layers-heading">
              {/* 레이어 정의를 반복해 현재 표시 여부에 연결된 체크박스를 만든다. */}
              {layers.map(layer => (
                <label className="layer-toggle" key={layer.id}>
                  <input type="checkbox" checked={visibility[layer.id]}
                    onChange={event => {
                      const { checked } = event.currentTarget
                      // 이전 레이어 값을 복사하고, 방금 눌린 레이어만 새 값으로 덮어쓴다.
                      setVisibility(previous => ({ ...previous, [layer.id]: checked }))
                    }} />
                  <span className="swatch" style={{ backgroundColor: layer.color }} />
                  {layer.label}
                </label>
              ))}
            </div>

            <div className="panel-section">
              <h3 className="panel-heading" id="drillholes-heading">Drillholes</h3>
              <div className="hole-list" role="group" aria-labelledby="drillholes-heading">
                {/* 목록에서 선택해도 캔버스 클릭과 같은 selectedId 상태가 갱신된다. */}
                {drillholes.map(sample => (
                  <button key={sample.id} type="button" aria-pressed={sample.id === selectedId}
                    onClick={() => setSelectedId(sample.id)}>{sample.id}</button>
                ))}
              </div>
              <p className="panel-note">Hide terrain to see the drillhole cores.</p>
            </div>

            <div className="panel-section">
              <h3 className="panel-heading">Rock units</h3>
              <ul className="legend">
                {units.map(unit => (
                  <li key={unit.name}>
                    <span className="swatch" style={{ backgroundColor: unit.color }} />{unit.name}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
          {/* 선택과 표시 상태는 뷰어에 전달하고, 캔버스에서 선택한 시추공 ID는 App으로 되돌려 받는다. */}
          <Viewport visibility={visibility} selectedId={selectedId} onSelect={setSelectedId} />
          <Inspector hole={hole} />
        </div>
      </main>
    </>
  )
}
