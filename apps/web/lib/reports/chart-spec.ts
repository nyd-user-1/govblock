// A report's chart as data (2026-09-17): what the server counts and hands to
// the page and to the chart studio alike, drawn by components/reports/report-chart.

export type Tone = "d" | "r" | "i" | "one" | "two" | "muted" | "ramp1" | "ramp2" | "ramp3" | "ramp4" | "ramp5"
export type Format = "int" | "pct" | "money"

type Base = { id: string; title: string; source: string; report: string }

export type ChartSpec =
  | (Base & { kind: "bar"; format: Format; bars: { label: string; value: number; tone?: Tone; note?: string }[]; legend?: { label: string; tone: Tone }[] })
  | (Base & { kind: "stack"; series: string[]; tones: Tone[]; rows: { label: string; parts: number[] }[] })
  | (Base & { kind: "columns"; format: Format; columns: { label: string; value: number; highlight?: boolean; note?: string }[]; highlightLabel?: string })
  | (Base & { kind: "line"; format: Format; x: string[]; series: { name: string; tone: Tone; values: number[] }[] })

export const partyTone = (party: string | null | undefined): Tone => (party === "D" ? "d" : party === "R" ? "r" : "i")
