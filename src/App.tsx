import { useState } from 'react'
import { Viewport } from './viewer/Viewport'
import { drillholes, layers, survey, units } from './viewer/survey'
import type { Drillhole, LayerVisibility } from './viewer/survey'

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

export function App() {
  const [visibility, setVisibility] = useState<LayerVisibility>({
    terrain: true, strata: true, holes: true, grid: true,
  })
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
              {layers.map(layer => (
                <label className="layer-toggle" key={layer.id}>
                  <input type="checkbox" checked={visibility[layer.id]}
                    onChange={event => {
                      const { checked } = event.currentTarget
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
          <Viewport visibility={visibility} selectedId={selectedId} onSelect={setSelectedId} />
          <Inspector hole={hole} />
        </div>
      </main>
    </>
  )
}
