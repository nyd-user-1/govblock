import * as React from "react"

// A dashboard's rough sketch, the way Cloudflare draws one on its dashboards
// menu (Brendan, 2026-09-07): a row of stat tiles marked # or %, then a
// chart panel or two with a legend of dashes and a line, an area, bars, or
// the rows of a list. Drawn in the muted foreground so it reads as a
// wireframe, never a chart.

export type Panel = "line" | "area" | "bars" | "list"
export type SketchSpec = { tiles: ("#" | "%")[]; panels: Panel[] }

const W = 224
const H = 112
const GAP = 4

function PanelArt({ kind, x, y, w, h }: { kind: Panel; x: number; y: number; w: number; h: number }) {
  const legend = (
    <g stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round">
      <line x1={x + 6} y1={y + 8} x2={x + 7} y2={y + 8} />
      <line x1={x + 10} y1={y + 8} x2={x + Math.min(w - 8, 26)} y2={y + 8} />
      <line x1={x + Math.min(w - 6, 30)} y1={y + 8} x2={x + Math.min(w - 5, 31)} y2={y + 8} />
      <line x1={x + Math.min(w - 4, 34)} y1={y + 8} x2={x + Math.min(w - 4, 46)} y2={y + 8} />
    </g>
  )
  const top = y + 16
  const bottom = y + h - 4
  const span = bottom - top
  const inner = w - 12
  const at = (i: number, n: number) => x + 6 + (inner * i) / (n - 1)
  let art: React.ReactNode = null
  if (kind === "line") {
    const ys = [0.55, 0.25, 0.7, 0.35, 0.8, 0.85, 0.5, 0.3, 0.2, 0.1]
    art = <polyline fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.3" points={ys.map((v, i) => `${at(i, ys.length)},${top + span * v}`).join(" ")} />
  } else if (kind === "area") {
    const ys = [0.9, 0.7, 0.5, 0.55, 0.3, 0.2, 0.25, 0.35, 0.15, 0.1]
    const pts = ys.map((v, i) => `${at(i, ys.length)},${top + span * v}`)
    art = (
      <>
        <polygon fill="currentColor" fillOpacity="0.08" points={`${at(0, ys.length)},${bottom} ${pts.join(" ")} ${at(ys.length - 1, ys.length)},${bottom}`} />
        <polyline fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.3" points={pts.join(" ")} />
      </>
    )
  } else if (kind === "bars") {
    const vs = [0.5, 0.55, 0.15, 0.2, 0.9, 0.4, 0.65]
    const n = Math.max(3, Math.min(vs.length, Math.floor(inner / 12)))
    const bw = inner / n - 4
    art = (
      <g fill="currentColor" fillOpacity="0.18">
        {vs.slice(0, n).map((v, i) => (
          <rect key={i} x={x + 6 + (inner / n) * i} y={bottom - span * v} width={bw} height={span * v} rx="1" />
        ))}
      </g>
    )
  } else {
    const n = Math.max(2, Math.floor(span / 9))
    art = (
      <g stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.2" strokeLinecap="round">
        {Array.from({ length: n }, (_, i) => (
          <React.Fragment key={i}>
            <line x1={x + 6} y1={top + 4 + i * 9} x2={x + 6 + inner * 0.55} y2={top + 4 + i * 9} />
            <line x1={x + 6 + inner * 0.8} y1={top + 4 + i * 9} x2={x + 6 + inner} y2={top + 4 + i * 9} />
          </React.Fragment>
        ))}
      </g>
    )
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.2" />
      {legend}
      {art}
    </g>
  )
}

export function DashboardSketch({ spec }: { spec: SketchSpec }) {
  const tileH = 26
  const tileW = (W - GAP * (spec.tiles.length - 1)) / spec.tiles.length
  const panelY = tileH + GAP
  const panelH = H - panelY
  const panelW = (W - GAP * (spec.panels.length - 1)) / spec.panels.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="text-muted-foreground" aria-hidden>
      {spec.tiles.map((t, i) => (
        <g key={i}>
          <rect x={i * (tileW + GAP)} y={0} width={tileW} height={tileH} rx="3" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.2" />
          <text x={i * (tileW + GAP) + tileW / 2} y={tileH / 2 + 4} textAnchor="middle" fontSize="11" fill="currentColor" fillOpacity="0.45" fontFamily="ui-sans-serif, system-ui">
            {t}
          </text>
        </g>
      ))}
      {spec.panels.map((p, i) => (
        <PanelArt key={i} kind={p} x={i * (panelW + GAP)} y={panelY} w={panelW} h={panelH} />
      ))}
    </svg>
  )
}
