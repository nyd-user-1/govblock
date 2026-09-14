import * as React from "react"

// Six charts in plain SVG (2026-09-13), for /state/[state]/charts and the
// studio: no library, no client JavaScript, one viewBox each so they scale
// with their column. Colours are the flag's blue and red first, then a short
// neutral run; a caller can pass its own.

export const PALETTE = ["#0a3161", "#b31942", "#e08a1e", "#3f8f5f", "#7a6bb5", "#5b8db8", "#8c8c8c", "#c9a227"]
export const PARTY: Record<string, string> = { D: "#0a3161", R: "#b31942", I: "#8c8c8c", "?": "#c4c4c4", Democrat: "#0a3161", Republican: "#b31942", Independent: "#8c8c8c", Bipartisan: "#7a6bb5", Other: "#c4c4c4" }

const fmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v))

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** A legislature's seats in a half-ring, one dot each, grouped by party. */
export function Seats({ seats, size = 260 }: { seats: { party: string; n: number }[]; size?: number }) {
  const total = seats.reduce((t, s) => t + s.n, 0)
  if (!total) return null
  const dots: { x: number; y: number; color: string }[] = []
  // Rows of increasing radius, dots spread by arc length so spacing is even.
  const rows = Math.max(3, Math.min(8, Math.ceil(Math.sqrt(total / 3))))
  const r0 = size * 0.18
  const gap = (size / 2 - r0) / rows
  const perRow: number[] = []
  let left = total
  for (let i = 0; i < rows; i++) {
    const r = r0 + i * gap
    const share = r / ((r0 + (rows - 1) * gap / 2) * rows)
    const n = i === rows - 1 ? left : Math.min(left, Math.round(total * share))
    perRow.push(n)
    left -= n
  }
  const order = [...seats].sort((a, b) => (a.party === "D" ? -1 : b.party === "D" ? 1 : a.party === "R" ? 1 : b.party === "R" ? -1 : 0))
  const colors = order.flatMap((s) => Array.from({ length: s.n }, () => PARTY[s.party] ?? "#c4c4c4"))
  // Fill by angle across rows, so a party occupies one wedge of the ring.
  const slots: { row: number; angle: number }[] = []
  perRow.forEach((n, row) => {
    for (let k = 0; k < n; k++) slots.push({ row, angle: n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * k) / (n - 1) })
  })
  slots.sort((a, b) => b.angle - a.angle || a.row - b.row)
  slots.forEach((s, i) => {
    const r = r0 + s.row * gap
    dots.push({ x: size / 2 + r * Math.cos(s.angle), y: size / 2 - r * Math.sin(s.angle), color: colors[i] })
  })
  const dot = Math.max(3, Math.min(7, gap / 2.6))
  return (
    <svg viewBox={`0 0 ${size} ${size / 2 + dot * 2}`} className="h-auto w-full max-w-[320px]" role="img" aria-label={seats.map((s) => `${s.n} ${s.party}`).join(", ")}>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={dot} fill={d.color} />
      ))}
    </svg>
  )
}

/** Shares as a donut, with the legend beside it. */
export function Donut({ slices, colors, size = 160 }: { slices: { label: string; n: number }[]; colors?: string[]; size?: number }) {
  const total = slices.reduce((t, s) => t + s.n, 0)
  if (!total) return null
  const r = size / 2
  const inner = r * 0.55
  let a0 = -Math.PI / 2
  const arcs = slices.map((s, i) => {
    const a1 = a0 + (2 * Math.PI * s.n) / total
    const large = a1 - a0 > Math.PI ? 1 : 0
    const p = (a: number, rr: number) => `${r + rr * Math.cos(a)} ${r + rr * Math.sin(a)}`
    const d = s.n === total ? `M ${r} ${r - r} A ${r} ${r} 0 1 1 ${r - 0.01} ${r - r} L ${r - 0.01} ${r - inner} A ${inner} ${inner} 0 1 0 ${r} ${r - inner} Z` : `M ${p(a0, r)} A ${r} ${r} 0 ${large} 1 ${p(a1, r)} L ${p(a1, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(a0, inner)} Z`
    a0 = a1
    return { d, color: colors?.[i] ?? PARTY[s.label] ?? PALETTE[i % PALETTE.length], label: s.label, n: s.n }
  })
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={slices.map((s) => `${s.label} ${s.n}`).join(", ")}>
        {arcs.map((a) => (
          <path key={a.label} d={a.d} fill={a.color} />
        ))}
      </svg>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {arcs.map((a) => (
          <li key={a.label} className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: a.color }} />
            <span>{a.label}</span>
            <span className="text-muted-foreground tabular-nums">{Math.round((100 * a.n) / total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type XY = { x: number; y: number }
type Frame = { w: number; h: number; left: number; right: number; top: number; bottom: number }
const FRAME: Frame = { w: 640, h: 300, left: 48, right: 12, top: 12, bottom: 36 }

function scales(xs: number[], maxY: number, f = FRAME) {
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const sx = (x: number) => f.left + ((x - x0) / Math.max(1, x1 - x0)) * (f.w - f.left - f.right)
  const sy = (y: number) => f.h - f.bottom - (y / Math.max(1, maxY)) * (f.h - f.top - f.bottom)
  return { sx, sy, x0, x1 }
}

function Axes({ xs, maxY, f = FRAME, percent }: { xs: number[]; maxY: number; f?: Frame; percent?: boolean }) {
  const { sx, sy } = scales(xs, maxY, f)
  const ticks = 5
  return (
    <g className="text-[10px] fill-muted-foreground">
      {Array.from({ length: ticks + 1 }, (_, i) => (maxY * i) / ticks).map((v) => (
        <g key={v}>
          <line x1={f.left} x2={f.w - f.right} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
          <text x={f.left - 6} y={sy(v) + 3} textAnchor="end">
            {percent ? `${Math.round(v)}%` : fmt(Math.round(v))}
          </text>
        </g>
      ))}
      {xs.map((x) => (
        <text key={x} x={sx(x)} y={f.h - f.bottom + 16} textAnchor="middle">
          {x}
        </text>
      ))}
    </g>
  )
}

/** Lines over sessions. */
export function Lines({ xs, series, percent, colors }: { xs: number[]; series: { label: string; points: XY[] }[]; percent?: boolean; colors?: string[] }) {
  const maxY = percent ? 100 : Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.y))) * 1.08
  const { sx, sy } = scales(xs, maxY)
  const items = series.map((s, i) => ({ ...s, color: colors?.[i] ?? PARTY[s.label] ?? PALETTE[i % PALETTE.length] }))
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${FRAME.w} ${FRAME.h}`} className="h-auto w-full" role="img">
        <Axes xs={xs} maxY={maxY} percent={percent} />
        {items.map((s) => (
          <path key={s.label} d={s.points.map((p, i) => `${i ? "L" : "M"} ${sx(p.x)} ${sy(p.y)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
        ))}
      </svg>
      <Legend items={items} />
    </div>
  )
}

/** Stacked to 100% over sessions. */
export function StackedArea({ xs, series, colors }: { xs: number[]; series: { label: string; points: XY[] }[]; colors?: string[] }) {
  const { sx, sy } = scales(xs, 100)
  const items = series.map((s, i) => ({ ...s, color: colors?.[i] ?? PARTY[s.label] ?? PALETTE[i % PALETTE.length] }))
  const totals = xs.map((x) => items.reduce((t, s) => t + (s.points.find((p) => p.x === x)?.y ?? 0), 0))
  const base = xs.map(() => 0)
  const bands = items.map((s) => {
    const top = xs.map((x, i) => base[i] + (100 * (s.points.find((p) => p.x === x)?.y ?? 0)) / Math.max(1, totals[i]))
    const lower = [...base]
    xs.forEach((_, i) => (base[i] = top[i]))
    const d = xs.map((x, i) => `${i ? "L" : "M"} ${sx(x)} ${sy(top[i])}`).join(" ") + " " + [...xs].reverse().map((x, j) => `L ${sx(x)} ${sy(lower[xs.length - 1 - j])}`).join(" ") + " Z"
    return { ...s, d }
  })
  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${FRAME.w} ${FRAME.h}`} className="h-auto w-full" role="img">
        <Axes xs={xs} maxY={100} percent />
        {bands.map((b) => (
          <path key={b.label} d={b.d} fill={b.color} fillOpacity={0.35} stroke={b.color} strokeWidth={1.5} />
        ))}
      </svg>
      <Legend items={items} />
    </div>
  )
}

/** Bars, one per label. */
export function Bars({ rows, color = PALETTE[0] }: { rows: { label: string; n: number }[]; color?: string }) {
  const f: Frame = { ...FRAME, bottom: 96 }
  const maxY = Math.max(1, ...rows.map((r) => r.n)) * 1.08
  const sy = (y: number) => f.h - f.bottom - (y / maxY) * (f.h - f.top - f.bottom)
  const bw = (f.w - f.left - f.right) / Math.max(1, rows.length)
  return (
    <svg viewBox={`0 0 ${f.w} ${f.h}`} className="h-auto w-full" role="img">
      <g className="text-[10px] fill-muted-foreground">
        {Array.from({ length: 6 }, (_, i) => (maxY * i) / 5).map((v) => (
          <g key={v}>
            <line x1={f.left} x2={f.w - f.right} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3 3" />
            <text x={f.left - 6} y={sy(v) + 3} textAnchor="end">
              {fmt(Math.round(v))}
            </text>
          </g>
        ))}
      </g>
      {rows.map((r, i) => (
        <g key={r.label}>
          <rect x={f.left + i * bw + bw * 0.15} y={sy(r.n)} width={bw * 0.7} height={f.h - f.bottom - sy(r.n)} fill={color} rx={2} />
          <text x={f.left + i * bw + bw / 2} y={f.h - f.bottom + 10} transform={`rotate(-35 ${f.left + i * bw + bw / 2} ${f.h - f.bottom + 10})`} textAnchor="end" className="text-[10px] fill-muted-foreground">
            {r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
