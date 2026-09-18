"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"

// The reports' charts (2026-09-17): each a 4:3 landscape plot in a block with
// 32px of padding all round, the shape the simulator's charts take, so a chart
// reads the same in a report, in the studio and embedded. Plain SVG drawn at
// the pixel size of its box, so type stays type at any width.
//
// The palette follows the dataviz method, validated in both modes: the
// parties in the country's colours (#2563eb / #dc2626, stepped for dark), a
// single series in blue, a second in orange, and a one-hue blue ramp for
// ordered buckets. Marks are thin: bars at most 24px, 4px rounded at the data
// end, a 2px surface gap between touching segments, 2px lines. Text wears text
// colours, never the series colour. Every mark answers a hover.

export const TONES = {
  d: "var(--chart-d)",
  r: "var(--chart-r)",
  i: "var(--chart-i)",
  one: "var(--chart-1)",
  two: "var(--chart-2)",
  muted: "var(--chart-muted)",
  ramp: ["var(--chart-ramp-1)", "var(--chart-ramp-2)", "var(--chart-ramp-3)", "var(--chart-ramp-4)", "var(--chart-ramp-5)"],
}

const VARS = `
.report-chart { --chart-d:#2563eb; --chart-r:#dc2626; --chart-i:#7c3aed; --chart-1:#2a78d6; --chart-2:#eb6834; --chart-muted:#b9b8b3;
  --chart-ramp-1:#86b6ef; --chart-ramp-2:#5598e7; --chart-ramp-3:#2a78d6; --chart-ramp-4:#1c5cab; --chart-ramp-5:#104281;
  --chart-grid:#e8e7e3; --chart-surface:var(--background); }
@media (prefers-color-scheme: dark) { :root:where(:not([data-theme="light"]):not(.light)) .report-chart {
  --chart-d:#3987e5; --chart-r:#e66767; --chart-i:#9085e9; --chart-1:#3987e5; --chart-2:#d95926; --chart-muted:#6b6a65;
  --chart-ramp-1:#184f95; --chart-ramp-2:#256abf; --chart-ramp-3:#3987e5; --chart-ramp-4:#6da7ec; --chart-ramp-5:#9ec5f4; --chart-grid:#2e2e2b; } }
:root.dark .report-chart, :root[data-theme="dark"] .report-chart {
  --chart-d:#3987e5; --chart-r:#e66767; --chart-i:#9085e9; --chart-1:#3987e5; --chart-2:#d95926; --chart-muted:#6b6a65;
  --chart-ramp-1:#184f95; --chart-ramp-2:#256abf; --chart-ramp-3:#3987e5; --chart-ramp-4:#6da7ec; --chart-ramp-5:#9ec5f4; --chart-grid:#2e2e2b; }
`

export type Fmt = (n: number) => string
export const fmtInt: Fmt = (n) => Math.round(n).toLocaleString("en-US")
export const fmtPct: Fmt = (n) => `${Math.round(n * 100)}%`
export const fmtMoney: Fmt = (n) => (Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`)

type Tip = { x: number; y: number; lines: React.ReactNode[] } | null

function useBox() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, width, height: Math.round((width * 3) / 4) }
}

/** The block: a title, an optional legend, the 4:3 plot, a source line. */
export function ChartBlock({ title, legend, source, children, className }: { title: string; legend?: { label: string; color: string }[]; source?: string; children: (size: { width: number; height: number }) => React.ReactNode; className?: string }) {
  const { ref, width, height } = useBox()
  return (
    <figure data-not-typeset="true" className={cn("report-chart my-8 flex flex-col gap-3 rounded-2xl border bg-background p-8", className)}>
      <style dangerouslySetInnerHTML={{ __html: VARS }} />
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {legend && legend.length > 1 && (
          <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div ref={ref} className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
        {width > 0 && children({ width, height })}
      </div>
      {source && <p className="m-0 text-xs text-muted-foreground">{source}</p>}
    </figure>
  )
}

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null
  return (
    <div className="pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md" style={{ left: tip.x, top: tip.y - 8 }}>
      {tip.lines.map((line, i) => (
        <div key={i} className={i === 0 ? "font-medium" : "text-muted-foreground tabular-nums"}>
          {line}
        </div>
      ))}
    </div>
  )
}

// A rect with its data end rounded 4px and its baseline end square.
function barPath(x: number, y: number, w: number, h: number, horizontal: boolean) {
  const r = Math.min(4, horizontal ? w : h, horizontal ? h / 2 : w / 2)
  if (w <= 0 || h <= 0) return ""
  return horizontal
    ? `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`
    : `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

const niceMax = (max: number) => {
  if (max <= 0) return 1
  const step = Math.pow(10, Math.floor(Math.log10(max)))
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step
  return 10 * step
}

// ---------------------------------------------------------------------------

export type Bar = { label: string; value: number; color?: string; note?: string }

/** Horizontal bars, one series, the value at each bar's tip. */
export function BarChart({ title, bars, format = fmtInt, max, source, legend }: { title: string; bars: Bar[]; format?: Fmt; max?: number; source?: string; legend?: { label: string; color: string }[] }) {
  const [tip, setTip] = React.useState<Tip>(null)
  return (
    <ChartBlock title={title} source={source} legend={legend}>
      {({ width, height }) => {
        const labelW = Math.min(220, width * 0.36)
        const valueW = 64
        const top = 8
        const band = (height - top) / bars.length
        const thick = Math.min(24, band * 0.62)
        const scaleMax = max ?? niceMax(Math.max(...bars.map((b) => b.value)))
        const plotW = width - labelW - valueW
        return (
          <>
            <svg width={width} height={height} role="img" aria-label={title} onMouseLeave={() => setTip(null)}>
              <line x1={labelW} x2={labelW} y1={0} y2={height} stroke="var(--chart-grid)" />
              {bars.map((b, i) => {
                const y = top + i * band + (band - thick) / 2
                const w = Math.max(0, (b.value / scaleMax) * plotW)
                return (
                  <g key={b.label} onMouseMove={() => setTip({ x: labelW + w / 2, y, lines: [b.label, format(b.value), ...(b.note ? [b.note] : [])] })}>
                    <rect x={0} y={top + i * band} width={width} height={band} fill="transparent" />
                    <text x={labelW - 10} y={y + thick / 2} dominantBaseline="middle" textAnchor="end" className="fill-foreground text-[12px]">
                      {b.label.length > 30 ? `${b.label.slice(0, 29)}…` : b.label}
                    </text>
                    <path d={barPath(labelW, y, w, thick, true)} fill={b.color ?? TONES.one} />
                    <text x={labelW + w + 6} y={y + thick / 2} dominantBaseline="middle" className="fill-muted-foreground text-[12px] tabular-nums">
                      {format(b.value)}
                    </text>
                  </g>
                )
              })}
            </svg>
            <Tooltip tip={tip} />
          </>
        )
      }}
    </ChartBlock>
  )
}

export type Stack = { label: string; parts: number[] }

/** Horizontal 100% stacks: each row's parts as shares, a 2px surface gap between segments. */
export function StackChart({ title, series, rows, colors, source }: { title: string; series: string[]; rows: Stack[]; colors: string[]; source?: string }) {
  const [tip, setTip] = React.useState<Tip>(null)
  return (
    <ChartBlock title={title} source={source} legend={series.map((s, i) => ({ label: s, color: colors[i] }))}>
      {({ width, height }) => {
        const labelW = Math.min(160, width * 0.28)
        const top = 8
        const axis = 22
        const band = (height - top - axis) / rows.length
        const thick = Math.min(24, band * 0.55)
        const plotW = width - labelW - 8
        return (
          <>
            <svg width={width} height={height} role="img" aria-label={title} onMouseLeave={() => setTip(null)}>
              {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                <g key={t}>
                  <line x1={labelW + t * plotW} x2={labelW + t * plotW} y1={top} y2={height - axis} stroke="var(--chart-grid)" />
                  <text x={labelW + t * plotW} y={height - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {Math.round(t * 100)}%
                  </text>
                </g>
              ))}
              {rows.map((row, i) => {
                const total = row.parts.reduce((a, b) => a + b, 0) || 1
                const y = top + i * band + (band - thick) / 2
                let x = labelW
                return (
                  <g key={row.label}>
                    <text x={labelW - 10} y={y + thick / 2} dominantBaseline="middle" textAnchor="end" className="fill-foreground text-[12px]">
                      {row.label}
                    </text>
                    {row.parts.map((part, j) => {
                      const w = (part / total) * plotW
                      const x0 = x
                      x += w
                      const gap = j < row.parts.length - 1 ? 2 : 0
                      return (
                        <rect
                          key={j}
                          x={x0}
                          y={y}
                          width={Math.max(0, w - gap)}
                          height={thick}
                          rx={j === row.parts.length - 1 ? 3 : 0}
                          fill={colors[j]}
                          onMouseMove={() => setTip({ x: x0 + w / 2, y, lines: [`${row.label} · ${series[j]}`, `${Math.round((part / total) * 1000) / 10}%`] })}
                        />
                      )
                    })}
                  </g>
                )
              })}
            </svg>
            <Tooltip tip={tip} />
          </>
        )
      }}
    </ChartBlock>
  )
}

export type Column = { label: string; value: number; highlight?: boolean; note?: string }

/** Columns over time or categories; the highest and the last carry their values. */
export function ColumnChart({ title, columns, format = fmtInt, source, highlightLabel }: { title: string; columns: Column[]; format?: Fmt; source?: string; highlightLabel?: string }) {
  const [tip, setTip] = React.useState<Tip>(null)
  const legend = highlightLabel ? [{ label: "Other", color: TONES.one }, { label: highlightLabel, color: TONES.two }] : undefined
  return (
    <ChartBlock title={title} source={source} legend={legend}>
      {({ width, height }) => {
        const left = 44
        const bottom = 26
        const top = 18
        const scaleMax = niceMax(Math.max(...columns.map((c) => c.value)))
        const plotH = height - top - bottom
        const band = (width - left) / columns.length
        const thick = Math.min(24, band * 0.7)
        const peak = columns.reduce((m, c, i) => (c.value > columns[m].value ? i : m), 0)
        const every = Math.ceil(columns.length / Math.max(1, Math.floor((width - left) / 44)))
        return (
          <>
            <svg width={width} height={height} role="img" aria-label={title} onMouseLeave={() => setTip(null)}>
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line x1={left} x2={width} y1={top + plotH * (1 - t)} y2={top + plotH * (1 - t)} stroke="var(--chart-grid)" />
                  <text x={left - 6} y={top + plotH * (1 - t)} dominantBaseline="middle" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                    {format(scaleMax * t)}
                  </text>
                </g>
              ))}
              {columns.map((c, i) => {
                const h = (c.value / scaleMax) * plotH
                const x = left + i * band + (band - thick) / 2
                const labelled = i === peak || i === columns.length - 1
                return (
                  <g key={c.label} onMouseMove={() => setTip({ x: x + thick / 2, y: top + plotH - h, lines: [c.label, format(c.value), ...(c.note ? [c.note] : [])] })}>
                    <rect x={left + i * band} y={top} width={band} height={plotH} fill="transparent" />
                    <path d={barPath(x, top + plotH - h, thick, h, false)} fill={c.highlight ? TONES.two : TONES.one} />
                    {labelled && (
                      <text x={x + thick / 2} y={top + plotH - h - 5} textAnchor="middle" className="fill-foreground text-[11px] tabular-nums">
                        {format(c.value)}
                      </text>
                    )}
                    {i % every === 0 && (
                      <text x={x + thick / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                        {c.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
            <Tooltip tip={tip} />
          </>
        )
      }}
    </ChartBlock>
  )
}

export type Series = { name: string; color: string; values: number[] }

/** Lines over a shared x, 2px, each ended with a labelled dot; a crosshair reads every series at once. */
export function LineChart({ title, x, series, format = fmtInt, source }: { title: string; x: string[]; series: Series[]; format?: Fmt; source?: string }) {
  const [at, setAt] = React.useState<number | null>(null)
  return (
    <ChartBlock title={title} source={source} legend={series.map((s) => ({ label: s.name, color: s.color }))}>
      {({ width, height }) => {
        const left = 44
        const right = 64
        const top = 14
        const bottom = 26
        const scaleMax = niceMax(Math.max(...series.flatMap((s) => s.values)))
        const plotW = width - left - right
        const plotH = height - top - bottom
        const px = (i: number) => left + (x.length === 1 ? plotW / 2 : (i / (x.length - 1)) * plotW)
        const py = (v: number) => top + plotH * (1 - v / scaleMax)
        const every = Math.ceil(x.length / Math.max(1, Math.floor(plotW / 48)))
        return (
          <>
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={title}
              onMouseLeave={() => setAt(null)}
              onMouseMove={(e) => {
                const box = e.currentTarget.getBoundingClientRect()
                const i = Math.round(((e.clientX - box.left - left) / plotW) * (x.length - 1))
                setAt(Math.max(0, Math.min(x.length - 1, i)))
              }}
            >
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <line x1={left} x2={left + plotW} y1={top + plotH * (1 - t)} y2={top + plotH * (1 - t)} stroke="var(--chart-grid)" />
                  <text x={left - 6} y={top + plotH * (1 - t)} dominantBaseline="middle" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                    {format(scaleMax * t)}
                  </text>
                </g>
              ))}
              {x.map((label, i) =>
                i % every === 0 ? (
                  <text key={label} x={px(i)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {label}
                  </text>
                ) : null
              )}
              {at !== null && <line x1={px(at)} x2={px(at)} y1={top} y2={top + plotH} stroke="var(--chart-grid)" strokeWidth={1.5} />}
              {series.map((s) => (
                <g key={s.name}>
                  <polyline points={s.values.map((v, i) => `${px(i)},${py(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={px(s.values.length - 1)} cy={py(s.values[s.values.length - 1])} r={4} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} />
                  <text x={px(s.values.length - 1) + 8} y={py(s.values[s.values.length - 1])} dominantBaseline="middle" className="fill-foreground text-[11px] tabular-nums">
                    {format(s.values[s.values.length - 1])}
                  </text>
                  {at !== null && <circle cx={px(at)} cy={py(s.values[at])} r={4} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} />}
                </g>
              ))}
            </svg>
            {at !== null && <Tooltip tip={{ x: px(at), y: top + 10, lines: [x[at], ...series.map((s) => `${s.name}: ${format(s.values[at])}`)] }} />}
          </>
        )
      }}
    </ChartBlock>
  )
}
