"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/chart"

// The /gdelt demo's charts. The data is shaped on the server (lib/gdelt/sample.ts).

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const monthTick = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ’${iso.slice(2, 4)}`
const fullDate = (iso: unknown) => {
  const s = String(iso)
  return `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "oklch(0.62 0.17 30)", "oklch(0.6 0.12 200)", "oklch(0.55 0.14 300)"]

export function AttentionChart({ rows, peaks, actions = [] }: { rows: { date: string; share: number; articles: number }[]; peaks: { date: string; share: number }[]; actions?: { date: string; label: string }[] }) {
  const config = { share: { label: "Share of US coverage (%)", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart accessibilityLayer data={rows} margin={{ left: 0, right: 12, top: 16, bottom: 0 }}>
        <defs>
          <linearGradient id="gdeltShare" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-share)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-share)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} tickFormatter={monthTick} />
        <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v.toFixed(2)}%`} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={fullDate} />} />
        <Area type="monotone" dataKey="share" stroke="var(--color-share)" strokeWidth={1.5} fill="url(#gdeltShare)" />
        {actions.map((a) => (
          <ReferenceLine key={a.date} x={a.date} stroke="var(--muted-foreground)" strokeDasharray="4 3" label={{ value: a.label, position: "insideTopLeft", fontSize: 11, fill: "var(--muted-foreground)" }} />
        ))}
        {peaks.map((p) => (
          <ReferenceDot key={p.date} x={p.date} y={p.share} r={4} fill="var(--color-share)" stroke="var(--background)" strokeWidth={2} />
        ))}
      </AreaChart>
    </ChartContainer>
  )
}

export function ToneChart({ rows }: { rows: { date: string; tone: number }[] }) {
  const config = { tone: { label: "Average tone", color: "var(--chart-2)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <LineChart accessibilityLayer data={rows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} tickFormatter={monthTick} />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={fullDate} />} />
        <Line type="monotone" dataKey="tone" stroke="var(--color-tone)" strokeWidth={1.5} dot={false} connectNulls />
      </LineChart>
    </ChartContainer>
  )
}

export function ToneHistogram({ bins }: { bins: { bin: number; count: number }[] }) {
  const config = { count: { label: "Articles", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={bins} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="bin" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => `Tone ${v}`} />} />
        <Bar dataKey="count" radius={3}>
          {bins.map((b) => (
            <Cell key={b.bin} fill={b.bin < 0 ? "var(--destructive)" : b.bin > 0 ? "oklch(0.65 0.15 150)" : "var(--muted-foreground)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function StackedWeeks({ weeks, keys, names }: { weeks: Record<string, number | string>[]; keys: string[]; names: string[] }) {
  const config = Object.fromEntries(keys.map((k, i) => [k, { label: names[i], color: COLORS[i % COLORS.length] }])) satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart accessibilityLayer data={weeks} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} tickFormatter={monthTick} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => `Week of ${fullDate(v)}`} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((k) => (
          <Bar key={k} dataKey={k} stackId="a" fill={`var(--color-${k})`} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

export function CompareChart({ weeks, names }: { weeks: Record<string, number | string>[]; names: string[] }) {
  const config = Object.fromEntries(names.map((name, i) => [`s${i}`, { label: name, color: COLORS[i] }])) satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <LineChart accessibilityLayer data={weeks} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} tickFormatter={monthTick} />
        <YAxis tickLine={false} axisLine={false} width={36} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => `Week of ${fullDate(v)}`} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {names.map((_, i) => (
          <Line key={i} type="monotone" dataKey={`s${i}`} stroke={`var(--color-s${i})`} strokeWidth={1.75} dot={false} />
        ))}
      </LineChart>
    </ChartContainer>
  )
}

export function HourChart({ rows }: { rows: { hour: string; articles: number }[] }) {
  const config = { articles: { label: "Articles", color: "var(--chart-3)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <BarChart accessibilityLayer data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => `${v} UTC`} />} />
        <Bar dataKey="articles" fill="var(--color-articles)" radius={3} />
      </BarChart>
    </ChartContainer>
  )
}

export function BinChart({ rows, dataKey = "articles", xKey = "bin" }: { rows: Record<string, number>[]; dataKey?: string; xKey?: string }) {
  const config = { [dataKey]: { label: "Articles", color: "var(--chart-1)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[200px] w-full">
      <BarChart accessibilityLayer data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => `Tone ${v}`} />} />
        <Bar dataKey={dataKey} radius={3}>
          {rows.map((r, i) => (
            <Cell key={i} fill={Number(r[xKey]) < 0 ? "var(--destructive)" : Number(r[xKey]) > 0 ? "oklch(0.65 0.15 150)" : "var(--muted-foreground)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function SpreadChart({ rows }: { rows: { at: string; mentions: number; running: number }[] }) {
  const config = {
    mentions: { label: "Articles that minute", color: "var(--chart-4)" },
    running: { label: "Running total", color: "var(--chart-1)" },
  } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <AreaChart accessibilityLayer data={rows} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="at" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area type="stepAfter" dataKey="running" stroke="var(--color-running)" strokeWidth={1.5} fill="var(--color-running)" fillOpacity={0.12} />
        <Area type="monotone" dataKey="mentions" stroke="var(--color-mentions)" strokeWidth={1.5} fill="var(--color-mentions)" fillOpacity={0.25} />
      </AreaChart>
    </ChartContainer>
  )
}

/** The sentence scores of one bill's coverage, counted by score. */
export function ScoreChart({ rows }: { rows: { score: number; sentences: number }[] }) {
  const config = { sentences: { label: "Sentences", color: "var(--chart-2)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[180px] w-full">
      <BarChart accessibilityLayer data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="score" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => `Score ${v}`} />} />
        <Bar dataKey="sentences" radius={3}>
          {rows.map((r) => (
            <Cell key={r.score} fill={r.score < 0 ? "var(--destructive)" : r.score > 0 ? "oklch(0.65 0.15 150)" : "var(--muted-foreground)"} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/** How many outlets ran the same sentence: one bar per repeated sentence. */
export function SyndicationChart({ rows }: { rows: { label: string; outlets: number }[] }) {
  const config = { outlets: { label: "Outlets", color: "var(--chart-4)" } } satisfies ChartConfig
  return (
    <ChartContainer config={config} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={150} tickMargin={8} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="outlets" fill="var(--color-outlets)" radius={3} />
      </BarChart>
    </ChartContainer>
  )
}
