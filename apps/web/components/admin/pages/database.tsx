"use client"

import * as React from "react"
import { AlertTriangleIcon, CheckCircle2Icon, RefreshCwIcon } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, XAxis } from "recharts"

import { fmtCompact } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { num, useProvenance, useStates, type Provenance } from "@/components/admin/data"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { StatDatabaseGrid, type DbStat } from "@/components/admin/blocks/stats"
import { ComponentActions } from "@/components/card-frame"
import { FlagChip } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { Badge } from "@govblock/ui/components/nova/badge"
import { cn } from "@govblock/ui/lib/utils"

// Data Pipeline: paceui's Database Depth as the record's provenance, in the
// shape Brendan drew in the browser on 2026-09-06 and approved item by item.
// Six tiles with their figures as stats. Volume, full width, two selects.
// Feeds, then Jurisdictions as its own card of committee-style tiles with a
// flag, the last pull, and a dot that says how the jurisdiction is fed.
// Then Feed Health beside Quotas. Every Refresh re-reads every card. The
// title is the shell header's breadcrumb. Cadence and coverage are the job
// definitions on the two boxes, as reported on 2026-09-05; the timestamps
// are live.

type Feed = { name: string; engine: string; cadence: string; covers: string; at: string | null; rows: string; nodes: string }

function feeds(p: Provenance): Feed[] {
  const f = p.feeds
  return [
    { name: "LegiScan delta", engine: "LegiScan API · getMasterList", cadence: "Nightly", covers: "New York, New Jersey, Congress", at: f.legiscan_delta_at, rows: "—", nodes: "box 1" },
    { name: "National sweep", engine: "LegiScan bulk datasets", cadence: "Weekly, Sunday", covers: "All 52 jurisdictions", at: f.legiscan_at, rows: num(p.totals.sessions) + " sessions", nodes: "box 1" },
    { name: "Congress.gov API", engine: "congress.gov API + govinfo BILLSTATUS", cadence: "Nightly", covers: "Congress: the federal families", at: f.congress_at, rows: f.congress_note ?? "—", nodes: "box 1" },
    { name: "Text walk", engine: "Legislature sites, 47 of them", cadence: "Nightly, four hours", covers: "Every state since 2023, New Jersey skipped", at: f.texts_at, rows: `${num(f.texts_week)} texts / 7d`, nodes: "box 1" },
    { name: "Text delta", engine: "NY Senate API · govinfo · sites", cadence: "Nightly, 1,500 cap", covers: "Bills that moved in the last week", at: f.texts_at, rows: "—", nodes: "box 1" },
    { name: "Open States scrapers", engine: "openstates-scrapers", cadence: "Weekly, three batches", covers: "TX, IL, MN, TN, MA, GA, CA, HI, OK, PA", at: null, rows: "not read by the site", nodes: "box 2" },
    { name: "NY Senate API", engine: "legislation.nysenate.gov", cadence: "Nightly", covers: "New York's own bills and desks", at: f.legiscan_delta_at, rows: "—", nodes: "box 1" },
    { name: "House directory", engine: "directory.house.gov", cadence: "Nightly", covers: "Representatives' offices and staff", at: f.house_at, rows: "—", nodes: "Vercel cron" },
    { name: "Senate contact", engine: "senate.gov senators_cfm.xml", cadence: "Nightly", covers: "Senators' contact record", at: f.senate_at, rows: "—", nodes: "Vercel cron" },
    { name: "Laws", engine: "congress.gov · state codes", cadence: "Nightly", covers: "Public laws and chapters", at: f.laws_at, rows: "—", nodes: "Vercel cron" },
    { name: "FEC", engine: "api.open.fec.gov", cadence: "By hand", covers: "Candidate totals by cycle", at: f.fec_at, rows: "—", nodes: "livingston" },
    { name: "Senate LDA", engine: "lda.senate.gov", cadence: "By hand", covers: "Lobbying registrations", at: f.lobbying_at, rows: "—", nodes: "livingston" },
    { name: "Model Bill Ingest", engine: "ALEC · state matches", cadence: "By hand", covers: "Model bill matches", at: f.model_at, rows: "—", nodes: "livingston" },
  ]
}

/** "2026-09-06 10:37:13+00" → "Sept. 6, 2026 | 10:37 AM", the form Brendan set. */
const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
function fmtWhen(value: string | null | undefined, withTime = true) {
  if (!value) return "—"
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}${/[+Z]/.test(value) ? "" : "Z"}`)
  if (!Number.isFinite(d.getTime())) return value
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  return withTime ? `${date} | ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : date
}
const hoursSince = (at: string | null | undefined) => (at ? (Date.now() - new Date(at.includes("T") ? at : `${at.replace(" ", "T")}${/[+Z]/.test(at) ? "" : "Z"}`).getTime()) / 36e5 : Infinity)

function health(at: string | null, cadence: string): { label: string; tone: string } {
  if (!at) return { label: "Unread", tone: "text-muted-foreground" }
  const hours = hoursSince(at)
  const weekly = /weekly|hand/i.test(cadence)
  if (hours < 36 || (weekly && hours < 24 * 8)) return { label: "Active", tone: "text-green-600" }
  if (hours < 24 * 8) return { label: "Syncing", tone: "text-amber-600" }
  return { label: "Stale", tone: "text-destructive" }
}

// The dot on a jurisdiction (Brendan, 2026-09-06): blinking green is a live
// connection polled at least daily; solid green is a corpus we hold whole
// and top up nightly; yellow relies on Sunday's bulk update alone; red is
// measured and none of those is true. New York, New Jersey and Congress
// have the daily feeds; everyone else is on the sweep, and a sweep older
// than eight days is a sweep that did not happen.
const DAILY = new Set(["US", "NY", "NJ"])
function feedState(code: string, pulledAt: string | null): { tone: string; blink: boolean; label: string } {
  const h = hoursSince(pulledAt)
  if (DAILY.has(code) && h < 36) return { tone: "bg-green-500", blink: true, label: "live, polled daily" }
  if (h < 36) return { tone: "bg-green-500", blink: false, label: "whole corpus, nightly delta" }
  if (h < 24 * 8) return { tone: "bg-amber-500", blink: false, label: "Sunday's bulk update" }
  return { tone: "bg-red-500", blink: false, label: "not reporting" }
}

const METRICS = [
  { value: "texts", label: "Texts" },
  { value: "datasets", label: "Datasets" },
  { value: "bills", label: "Bills" },
] as const
const SPANS = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "90 Days" },
] as const

export function DatabasePage() {
  const [refresh, setRefresh] = React.useState(0)
  const prov = useProvenance({ r: refresh || undefined })
  const states = useStates({ r: refresh || undefined })
  const [metric, setMetric] = React.useState<(typeof METRICS)[number]["value"]>("texts")
  const [span, setSpan] = React.useState<(typeof SPANS)[number]["value"]>("30")
  const p = prov.data
  const refreshAll = () => setRefresh((r) => r + 1)

  const freshCount = p ? p.fresh.filter((f) => f.recent > 0).length : 0
  // Label and value alone (Brendan, 2026-09-06: "remove all these change
  // numbers — we don't have consistency yet").
  const tiles: DbStat[] = [
    { title: "Jurisdictions", value: p ? num(p.totals.states) : <Skeleton className="h-7 w-12" /> },
    { title: "Bills on File", value: p ? fmtCompact(p.totals.bills, false) : <Skeleton className="h-7 w-16" /> },
    { title: "Texts on File", value: p ? fmtCompact(p.totals.texts, false) : <Skeleton className="h-7 w-16" /> },
    { title: "Roll Calls", value: p ? fmtCompact(p.totals.rollcalls, false) : <Skeleton className="h-7 w-16" /> },
    { title: "Members", value: p ? num(p.totals.people) : <Skeleton className="h-7 w-16" /> },
    { title: "Recent Updates", value: p ? num(freshCount) : <Skeleton className="h-7 w-12" /> },
  ]

  const series = React.useMemo(() => {
    if (!p) return []
    const days = Number(span)
    const list = Array.from({ length: days }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      return d.toISOString().slice(0, 10)
    })
    const byDay = new Map(p.daily.map((d) => [d.day, d]))
    return list.map((day) => ({ day, value: byDay.get(day)?.[metric] ?? 0 }))
  }, [p, metric, span])
  const seriesConfig: ChartConfig = { value: { label: METRICS.find((m) => m.value === metric)?.label ?? metric, color: "var(--chart-1)" } }

  const freshShare = p ? Math.round((freshCount / Math.max(1, p.fresh.length)) * 100) : 0
  const radial = [{ name: "fresh", value: freshShare, fill: "var(--chart-1)" }]
  const metrics = p
    ? [
        { label: "Full Text Coverage", value: `${p.coverage.of ? Math.round((p.coverage.with_text / p.coverage.of) * 1000) / 10 : 0}%`, note: `${num(p.coverage.with_text)} of ${num(p.coverage.of)} Bills since 2025` },
        { label: "This Week", value: `${freshShare}%`, note: `${freshCount} of ${p.fresh.length} jurisdictions` },
        { label: "Congress Pipeline", value: fmtWhen(p.feeds.congress_at), note: p.feeds.congress_note ?? "last run" },
        { label: "Bulk Dataset Upload", value: fmtWhen(p.feeds.legiscan_at), note: "last dataset imported" },
      ]
    : []

  const rows = p ? feeds(p) : []
  const stalest = rows.filter((r) => r.at).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))[0]
  const freshest = rows.filter((r) => r.at).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0]

  const lastDay = p?.daily[p.daily.length - 1]
  const quotas = [
    { label: "LegiScan API", sub: "API calls this month", used: 10500, limit: 30000, unit: "/ month" },
    { label: "Text delta cap", sub: "bills refetched on the last day", used: lastDay?.texts ?? 0, limit: 1500, unit: "/ night" },
    { label: "Congress.gov API", sub: "Last API call", used: 592, limit: 5000, unit: "/ hour" },
    { label: "Aurora DB Capacity", sub: "auto-pauses after five idle minutes", used: 0.5, limit: 16, unit: "ACU" },
    { label: "Text Bot", sub: "States crawled over night", used: 4, limit: 24, unit: "hours" },
  ]

  const refreshButton = (
    <Button variant="outline" size="sm" className="gap-1 max-2xl:size-9" onClick={refreshAll} disabled={prov.pending && !!p}>
      <RefreshCwIcon className={cn("size-3.5", prov.pending && p && "animate-spin")} />
      <span className="max-2xl:hidden">Refresh</span>
    </Button>
  )

  return (
    <div>
      <div className="mt-4 sm:mt-5">
        <StatDatabaseGrid stats={tiles} />
      </div>

      <div className="mt-4 sm:mt-5">
        <Card>
          <CardHeader>
            <CardAnchor>Volume</CardAnchor>
            <CardAction>
              <CardTools className="gap-2">
              <Select value={metric} onValueChange={(v) => v && setMetric(v as (typeof METRICS)[number]["value"])}>
                <SelectTrigger className="h-8 w-32" size="sm" aria-label="What to count">
                  <SelectValue>{() => METRICS.find((m) => m.value === metric)?.label ?? metric}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="h-4 w-px bg-border" />
              <Select value={span} onValueChange={(v) => v && setSpan(v as (typeof SPANS)[number]["value"])}>
                <SelectTrigger className="h-8 w-28" size="sm" aria-label="How far back">
                  <SelectValue>{() => SPANS.find((x) => x.value === span)?.label ?? span}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SPANS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </CardTools>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={seriesConfig} className="aspect-auto h-83 w-full">
              <AreaChart data={series} margin={{ left: 0, right: 0, top: 8 }}>
                <defs>
                  <linearGradient id="fillLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })} />} />
                <Area dataKey="value" type="monotone" stroke="var(--color-value)" fill="url(#fillLoad)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader className="max-md:px-4">
            <CardAnchor>Feeds</CardAnchor>
            <CardAction>
              <CardTools>{refreshButton}</CardTools>
            </CardAction>
          </CardHeader>
          <CardContent className="max-md:px-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="w-8">
                    <Checkbox aria-label="Select all" />
                  </TableHead>
                  <TableHead>Feed / Source</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Covers</TableHead>
                  <TableHead>Runs on</TableHead>
                  <TableHead>Last write</TableHead>
                  <TableHead>Rows</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!p
                  ? Array.from({ length: 6 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={9}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : rows.map((r) => {
                      const h = health(r.at, r.cadence)
                      return (
                        <TableRow key={r.name}>
                          <TableCell>
                            <Checkbox aria-label={`Select ${r.name}`} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium whitespace-nowrap">{r.name}</span>
                              <span className="text-xs text-muted-foreground">{r.engine}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{r.cadence}</TableCell>
                          <TableCell className="max-w-56 truncate">{r.covers}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.nodes}</TableCell>
                          <TableCell className="whitespace-nowrap">{fmtWhen(r.at)}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.rows}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("h-5 gap-1", h.tone)}>
                              {h.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <ComponentActions className="justify-end" />
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-5">
        <Card className="gap-4">
          <CardHeader>
            <CardAnchor>Jurisdictions</CardAnchor>
            <CardAction>
              <CardTools>{refreshButton}</CardTools>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
              {(states.data ?? []).map((s) => {
                const f = p?.fresh.find((x) => x.state === s.state)
                const dot = feedState(s.state, f?.pulled_at ?? null)
                return (
                  <a
                    key={s.state}
                    href={`/docs/datasets/${s.state.toLowerCase()}`}
                    title={dot.label}
                    className="group/tile relative flex h-[132px] flex-col justify-between rounded-xl border bg-card p-4 no-underline transition-colors hover:bg-accent/40 hover:ring-1 hover:ring-foreground/10"
                  >
                    <div className="flex items-start justify-between">
                      <FlagChip state={s.state} width={36} />
                      <span className={cn("mt-1 size-2.5 rounded-full", dot.tone, dot.blink && "animate-pulse")} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{stateName(s.state)}</p>
                      <p className="truncate text-xs text-muted-foreground">{`${fmtCompact(s.bills, false)} bills · ${s.sessions} sessions`}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">{f?.pulled_at ? `pulled ${fmtWhen(f.pulled_at, false)}` : p ? "no pull on record" : "…"}</p>
                    </div>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardAnchor>Feed Health</CardAnchor>
            <CardAction>
              <CardTools>
                <Button variant="outline" size="sm" render={<a href="/docs/datasets" />}>
                  View Datasets
                </Button>
              </CardTools>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{ fresh: { label: "Fresh", color: "var(--chart-1)" } }} className="mx-auto aspect-square h-60">
              <RadialBarChart data={radial} startAngle={90} endAngle={90 - (freshShare / 100) * 360} innerRadius={80} outerRadius={110}>
                <PolarGrid gridType="circle" radialLines={false} stroke="none" className="first:fill-muted last:fill-background" polarRadius={[86, 74]} />
                <RadialBar dataKey="value" background cornerRadius={10} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-4xl font-bold">
                              {p ? `${freshShare}%` : "…"}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                              Recently updated
                            </tspan>
                          </text>
                        )
                      }
                      return null
                    }}
                  />
                </PolarRadiusAxis>
              </RadialBarChart>
            </ChartContainer>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {metrics.map((m) => (
                <div key={m.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-semibold">{m.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="gap-3">
          <CardHeader>
            <CardAnchor>Quotas</CardAnchor>
            <CardAction>
              <CardTools className="gap-2">
                <Select defaultValue="nightly">
                  <SelectTrigger className="h-7 w-24" size="sm">
                    <SelectValue>{(v: unknown) => (v === "weekly" ? "Weekly" : "Nightly")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nightly">Nightly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </CardTools>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ChartContainer config={{ value: { label: "Texts", color: "var(--chart-2)" } }} className="aspect-video h-40 w-full">
              <AreaChart data={series.slice(-7)} margin={{ left: 0, right: 0, top: 4 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                <Area dataKey="value" type="monotone" stroke="var(--color-value)" fill="var(--color-value)" fillOpacity={0.2} />
              </AreaChart>
            </ChartContainer>
            <div className="flex flex-col gap-3">
              {quotas.map((q) => {
                const pctUsed = Math.min(100, Math.round((q.used / q.limit) * 100))
                return (
                  <div key={q.label} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{q.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{q.sub}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-semibold">
                        {pctUsed}
                        <span className="text-xs text-muted-foreground">%</span>
                      </span>
                      <span className={cn("text-xs", pctUsed >= 85 ? "text-destructive" : "text-green-600")}>{pctUsed >= 85 ? "↑" : "↓"}</span>
                      <span className="w-28 text-right font-mono text-[10px] text-muted-foreground">
                        {q.used.toLocaleString()} / {q.limit.toLocaleString()} {q.unit}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <AlertTriangleIcon className="size-3.5" />
                  Stalest feed
                </p>
                <p className="mt-1 truncate text-sm">{stalest ? `${stalest.name} | ${fmtWhen(stalest.at)}` : "—"}</p>
              </div>
              <div className="rounded-lg border border-green-600/20 bg-green-600/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                  <CheckCircle2Icon className="size-3.5" />
                  Freshest feed
                </p>
                <p className="mt-1 truncate text-sm">{freshest ? `${freshest.name} | ${fmtWhen(freshest.at)}` : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
