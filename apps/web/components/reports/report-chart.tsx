"use client"

import type { ChartSpec, Format, Tone } from "@/lib/reports/chart-spec"

import { BarChart, ColumnChart, fmtInt, fmtMoney, fmtPct, LineChart, StackChart, TONES, type Fmt } from "./charts"

const FORMATS: Record<Format, Fmt> = { int: fmtInt, pct: fmtPct, money: fmtMoney }
const tone = (t: Tone | undefined) => (!t ? TONES.one : t.startsWith("ramp") ? TONES.ramp[Number(t.slice(4)) - 1] : TONES[t as "d" | "r" | "i" | "one" | "two" | "muted"])

/** A chart spec drawn: the same component in a report and in the studio. */
export function ReportChart({ spec }: { spec: ChartSpec }) {
  switch (spec.kind) {
    case "bar":
      return <BarChart title={spec.title} source={spec.source} format={FORMATS[spec.format]} bars={spec.bars.map((b) => ({ ...b, color: tone(b.tone) }))} legend={spec.legend?.map((l) => ({ label: l.label, color: tone(l.tone) }))} />
    case "stack":
      return <StackChart title={spec.title} source={spec.source} series={spec.series} rows={spec.rows} colors={spec.tones.map(tone)} />
    case "columns":
      return <ColumnChart title={spec.title} source={spec.source} format={FORMATS[spec.format]} columns={spec.columns} highlightLabel={spec.highlightLabel} />
    case "line":
      return <LineChart title={spec.title} source={spec.source} format={FORMATS[spec.format]} x={spec.x} series={spec.series.map((s) => ({ name: s.name, color: tone(s.tone), values: s.values }))} />
  }
}
