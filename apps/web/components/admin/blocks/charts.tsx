"use client"

import * as React from "react"
import { ActivityIcon, ArrowDownToLineIcon, CalendarArrowUpIcon, RefreshCwIcon } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, Pie, PieChart, XAxis, YAxis } from "recharts"

import { Button } from "@govblock/ui/components/nova/button"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"
import { cn } from "@govblock/ui/lib/utils"

// paceui's chart blocks, on our chart kit. Every series arrives as a prop —
// the free template's random rows are the default where a page has nothing
// better, and the record's rows where it does.

const fmtDay = (value: string, long = false) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: long ? "long" : "short",
    day: "numeric",
  })

export type SeriesRow = { date: string; a: number; b: number }

export function sampleSeries(days = 90, base = 400, spread = 400, failBase = 5, failSpread = 50): SeriesRow[] {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10),
    a: Math.floor(Math.random() * spread) + base,
    b: Math.floor(Math.random() * failSpread) + failBase,
  }))
}

/** Logs: a two-series area over time with a range select. */
export function Chart1({
  title = "API Traffic",
  data,
  labels = { a: "Success", b: "Failed" },
  ranges = [
    { value: "90d", label: "Last 3 months", days: 90 },
    { value: "30d", label: "Last 30 days", days: 30 },
    { value: "7d", label: "Last 7 days", days: 7 },
  ],
  icon: Icon = ActivityIcon,
}: {
  title?: string
  data?: SeriesRow[]
  labels?: { a: string; b: string }
  ranges?: { value: string; label: string; days: number }[]
  icon?: React.ComponentType<{ className?: string }>
}) {
  const rows = React.useMemo(() => data ?? sampleSeries(), [data])
  const [range, setRange] = React.useState(ranges[0].value)
  const days = ranges.find((r) => r.value === range)?.days ?? rows.length
  const filtered = rows.slice(-days)
  const config: ChartConfig = {
    a: { label: labels.a, color: "var(--chart-1)" },
    b: { label: labels.b, color: "var(--chart-5)" },
  }
  return (
    <Card className="pb-3 max-2xl:gap-3 max-2xl:pt-4">
      <CardHeader className="max-2xl:px-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md border p-2 shadow-xs">
            <Icon className="size-4.5" />
          </div>
          <CardAnchor className="leading-none">{title}</CardAnchor>
        </div>
        <CardAction>
          <CardTools>
            <Select value={range} onValueChange={(v) => v && setRange(String(v))}>
              <SelectTrigger className="w-max min-w-28" size="sm" aria-label="Select time range">
                <SelectValue>{() => ranges.find((r) => r.value === range)?.label ?? range}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-max min-w-44 rounded-xl">
                {ranges.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="whitespace-nowrap">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardTools>
        </CardAction>
      </CardHeader>
      <CardContent className="px-3 pt-2 sm:px-4">
        <ChartContainer config={config} className="aspect-auto h-68 w-full">
          <AreaChart data={filtered}>
            <defs>
              <linearGradient id="fillA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-a)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-a)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-b)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-b)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => fmtDay(String(v))} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v), true)} indicator="dot" />} />
            <Area dataKey="a" type="monotone" fill="url(#fillA)" stroke="var(--color-a)" />
            <Area dataKey="b" type="monotone" fill="url(#fillB)" stroke="var(--color-b)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const SLOTS = [
  { label: "00-03", name: "Night" },
  { label: "03-06", name: "Early" },
  { label: "06-09", name: "Morning" },
  { label: "09-12", name: "Late Morn" },
  { label: "12-15", name: "Afternoon" },
  { label: "15-18", name: "Late Aft" },
  { label: "18-21", name: "Evening" },
  { label: "21-24", name: "Late Night" },
]

export type HeatRow = { day: string; slots: number[] }

export function sampleHeat(): HeatRow[] {
  return DAYS.map((day) => ({
    day,
    slots: SLOTS.map((_, i) => Math.floor(i >= 3 && i <= 5 ? Math.random() * 80 + 20 : Math.random() * 20)),
  }))
}

/** Logs: a day-by-slot heatmap. `columns` renames the eight slots; `unit` names what a cell counts. */
export function Chart2({ title = "Weekly Traffic", data, columns = SLOTS, unit = "requests", max }: { title?: string; data?: HeatRow[]; columns?: { label: string; name: string }[]; unit?: string; max?: number }) {
  const rows = React.useMemo(() => data ?? sampleHeat(), [data])
  const top = max ?? Math.max(1, ...rows.flatMap((r) => r.slots))
  const tone = (value: number) => {
    const p = (value / top) * 100
    if (value === 0) return "bg-primary/10 hover:bg-primary/30"
    if (p < 30) return "bg-primary/30 hover:bg-primary/50"
    if (p < 50) return "bg-primary/50 hover:bg-primary/70"
    if (p < 70) return "bg-primary/70 hover:bg-primary/90"
    return "bg-primary"
  }
  return (
    <Card className="flex size-full flex-col gap-5 py-4">
      <CardHeader className="flex items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <CalendarArrowUpIcon className="size-4.5" />
          <CardAnchor>{title}</CardAnchor>
        </div>
        <CardTools className="gap-2">
          <span className="text-sm text-muted-foreground">
            L<span className="max-sm:hidden">ow</span>
          </span>
          <div className="flex gap-1">
            {[20, 40, 60, 80, 100].map((o) => (
              <div key={o} className="size-2.5 rounded-xs bg-primary" style={{ opacity: o / 100 }} />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            H<span className="max-sm:hidden">igh</span>
          </span>
        </CardTools>
      </CardHeader>
      <CardContent className="flex min-h-0 w-full grow flex-col gap-2 px-4">
        <div className="flex gap-2">
          <div className="w-8" />
          <div
            className="grid grow gap-1 text-center"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            }}
          >
            {columns.map((slot) => (
              <span key={slot.label} className="truncate px-0.5 text-[9px] text-muted-foreground">
                {slot.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 grow gap-2">
          <div className="flex w-8 shrink-0 flex-col justify-between gap-1">
            {rows.map((r) => (
              <span key={r.day} className="flex h-full items-center text-xs/none text-muted-foreground">
                {r.day}
              </span>
            ))}
          </div>
          <div className="flex h-full w-full grow flex-col gap-1">
            {rows.map((row) => (
              <div
                key={row.day}
                className="grid grow gap-1"
                style={{
                  gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
                }}
              >
                {row.slots.map((val, i) => (
                  <Tooltip key={`${row.day}-${i}`}>
                    <TooltipTrigger render={<div className={cn("h-full min-h-6 w-full cursor-pointer rounded-sm transition-colors", tone(val))} />} />
                    <TooltipContent className="text-xs">
                      <div className="font-semibold">
                        {row.day} • {columns[i]?.name}
                      </div>
                      <div>
                        {val} {unit}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export type StackRow = { date: string; item1: number; item2: number }

export function sampleStack(): StackRow[] {
  return Array.from({ length: 20 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    date.setDate(date.getDate() + i)
    return {
      date: date.toISOString().split("T")[0],
      item1: Math.floor(Math.random() * 500) + 50,
      item2: Math.floor(Math.random() * 500) + 50,
    }
  })
}

/** Turn rows into a CSV file and hand it to the browser. */
export function downloadCsv(name: string, header: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const text = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n")
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name.endsWith(".csv") ? name : `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Sales: three figures over a stacked bar chart. Refresh re-reads the page; Download is the series as CSV; the menu is the standard one. */
export function Chart3({
  title = "Financial Performance",
  data,
  labels = { item1: "Item 1", item2: "Item 2" },
  figures = [
    { label: "Revenue", value: "$12,345" },
    { label: "Avg. Order", value: "$248" },
    { label: "Conversion", value: "+7.2%" },
  ],
  tickFormatter,
  onRefresh,
  refreshing,
  fileName = "series",
}: {
  title?: string
  data?: StackRow[]
  labels?: { item1: string; item2: string }
  figures?: { label: string; value: React.ReactNode }[]
  tickFormatter?: (value: string) => string
  onRefresh?: () => void
  refreshing?: boolean
  fileName?: string
}) {
  const [sample, setSample] = React.useState<StackRow[] | null>(null)
  const rows = data ?? sample ?? sampleStack()
  const refresh = () => (onRefresh ? onRefresh() : setSample(sampleStack()))
  const tick = tickFormatter ?? ((v: string) => fmtDay(v))
  const download = () =>
    downloadCsv(
      fileName,
      ["date", labels.item1, labels.item2],
      rows.map((r) => [r.date, r.item1, r.item2])
    )
  // A neutral pair, dark over light, as the split bar on Bill Performance:
  // the chart palette's first two colours are reds here, and red reads as bad.
  const config: ChartConfig = {
    item1: { label: labels.item1, color: "var(--primary)" },
    item2: {
      label: labels.item2,
      color: "color-mix(in oklab, var(--primary) 40%, transparent)",
    },
  }
  return (
    <Card className="@container/card max-md:py-4!">
      <CardHeader className="max-md:px-4">
        <CardAnchor>{title}</CardAnchor>
        <CardAction>
          <CardTools className="gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Refresh" onClick={refresh} disabled={refreshing}>
              <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Download as CSV" onClick={download}>
              <ArrowDownToLineIcon />
            </Button>
          </CardTools>
        </CardAction>
        <div className="mt-4 flex items-center gap-6">
          {figures.map((f, i) => (
            <React.Fragment key={f.label}>
              {i > 0 && <div className={cn("h-10 w-px bg-border", i >= 2 && "max-sm:hidden")} />}
              <div className={cn("space-y-1.5", i >= 2 && "max-sm:hidden")}>
                <p className="text-sm font-medium whitespace-nowrap text-muted-foreground">{f.label}</p>
                <p className="text-lg leading-none font-bold sm:text-2xl">{f.value}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => tick(String(v))} />
            <YAxis tickLine={false} axisLine={false} tickMargin={4} width={35} className="text-sm sm:text-xs" tickFormatter={(v) => `${v}`} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(v) => tick(String(v))} indicator="dot" />} />
            <Bar dataKey="item1" stackId="a" fill="var(--color-item1)" radius={6} className="stroke-background" strokeWidth={3} />
            <Bar dataKey="item2" stackId="a" fill="var(--color-item2)" radius={6} className="stroke-background" strokeWidth={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export type Slice = { title: string; value: number; fill: string }

/** Sales: a half donut with the total in the middle and a three-up legend beneath. */
export function Chart4({
  title = "Sales by Channel",
  totalLabel = "Total Sales",
  data = [
    { title: "Direct", value: 5200, fill: "var(--chart-1)" },
    { title: "Social", value: 3800, fill: "var(--chart-2)" },
    { title: "Organic", value: 2500, fill: "var(--chart-3)" },
  ],
}: {
  title?: string
  totalLabel?: string
  data?: Slice[]
}) {
  const total = data.reduce((acc, d) => acc + d.value, 0)
  const config: ChartConfig = Object.fromEntries(data.map((d) => [d.title, { label: d.title, color: d.fill }]))
  return (
    <Card className="flex flex-col max-md:py-4!">
      <CardHeader className="pb-0 max-md:px-4!">
        <CardAnchor>{title}</CardAnchor>
        <CardAction>
          <CardTools />
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer config={config} className="mx-auto -mt-6 aspect-square max-h-60 min-h-48">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="title" />} />
            <Pie data={data} dataKey="value" nameKey="title" innerRadius={84} outerRadius={100} startAngle={180} endAngle={0} paddingAngle={4} cornerRadius={4}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 40} className="fill-muted-foreground text-sm">
                          {totalLabel}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 8} className="fill-foreground text-3xl font-semibold">
                          {total.toLocaleString()}
                        </tspan>
                      </text>
                    )
                  }
                  return null
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="-mt-26 flex-col gap-2 text-sm">
        <div className="grid w-full grid-cols-3 gap-2">
          {data.map((item) => (
            <div key={item.title} className="flex flex-col items-center justify-center text-center">
              <div className="mb-1 flex items-center gap-1.5">
                <div className="size-1.5 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-xs whitespace-nowrap text-muted-foreground">{item.title}</span>
              </div>
              <span className="text-lg font-semibold">{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}
