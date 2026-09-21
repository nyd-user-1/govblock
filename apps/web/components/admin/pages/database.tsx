"use client"

import * as React from "react"
import { AlertTriangleIcon, CheckCircle2Icon, RefreshCwIcon } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, XAxis } from "recharts"

import { fmtCompact } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { num, useProvenance, useStates, type Provenance } from "@/components/admin/data"
import { BlockOrder, OrderedBlock } from "@/components/admin/blocks/block-order"
import { JurisdictionsBoard, SourceOverlay } from "@/components/admin/blocks/jurisdictions-board"
import { RunLog, RunProgress } from "@/components/admin/blocks/run-progress"
import { LoadingFlag } from "@/components/loading-flag"
import { usePipeline } from "@/lib/pipeline/use-pipeline"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { StatDatabaseGrid, type DbStat } from "@/components/admin/blocks/stats"
import { LessonsCard } from "@/components/admin/blocks/lessons-card"
import { RunLedger } from "@/components/admin/blocks/run-ledger"
import { TodoCard } from "@/components/admin/blocks/todo-card"
import { UslmParseCard } from "@/components/admin/blocks/uslm-parse-card"
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
import { asDate } from "@/lib/as-date"

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
  const d = asDate(value)
  if (!Number.isFinite(d.getTime())) return value
  const date = `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  return withTime ? `${date} | ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : date
}
// An unreadable date is no date: it must not compare as old or as new (lib/as-date.ts has the story).
const hoursSince = (at: string | null | undefined) => {
  const t = at ? asDate(at).getTime() : NaN
  return Number.isFinite(t) ? (Date.now() - t) / 36e5 : Infinity
}

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
  // The board (Brendan, 2026-09-20): a selected jurisdiction scopes both charts; the overlay reads one state's detail.
  const [selected, setSelected] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)
  const pipe = usePipeline({ state: info ?? selected, days: Number(span), detail: !!info })
  // Each of the two slots holds more than one view, switched from its three-dot menu (Brendan, 2026-09-20). When a
  // run starts, Volume turns to the minute-by-minute view and the slot beside it to the run's progress.
  // Updates leads (Brendan, 2026-09-20: "a chart in place of volume that's going to accurately show the work across all
  // cards"). Volume by day counts rows stamped in a day, so it drew the 3.5M-text backfill of August 30 and nothing of
  // a fleet that added bills in 52 jurisdictions; Updates is each jurisdiction's count now less its count before the
  // span's first run.
  const [volumeView, setVolumeView] = React.useState<"updates" | "days" | "live" | "log">("updates")
  const [sideView, setSideView] = React.useState<"ranked" | "progress" | "loaders">("ranked")
  const wasRunning = React.useRef(false)
  React.useEffect(() => {
    if (pipe.running && !wasRunning.current) {
      // The climb, not the log (Brendan, later the same day): the log is a menu entry away.
      setVolumeView("live")
      setSideView("progress")
    }
    wasRunning.current = pipe.running
  }, [pipe.running])
  // The last half hour, a minute a point, the empty minutes drawn as zero so the line is honest about gaps.
  const minutes = React.useMemo(() => {
    const got = new Map((pipe.data?.minutes ?? []).map((m) => [m.minute.slice(0, 16), m.n]))
    const now = Date.now()
    return Array.from({ length: 30 }, (_, i) => {
      const at = new Date(now - (29 - i) * 60_000)
      at.setSeconds(0, 0)
      const key = at.toISOString().slice(0, 16)
      return { minute: at.toISOString(), value: got.get(key) ?? 0 }
    }).map((m, i, all) => ({ ...m, value: all.slice(0, i + 1).reduce((n, x) => n + x.value, 0) }))
    // A running total (Brendan, 2026-09-20): the line climbs the way the card's count does, instead of a bar a minute.
  }, [pipe.data])
  const landed = minutes[minutes.length - 1]?.value ?? 0

  const freshCount = p ? p.fresh.filter((f) => f.recent > 0).length : 0
  // Label and value alone (Brendan, 2026-09-06: "remove all these change numbers — we don't have consistency
  // yet"); since 2026-09-20 a change with something behind it: today's total less the snapshot the launcher wrote
  // before the day's first run (sql/036), shown only when a run has moved it.
  const added = (now: number, then: number | null | undefined): Pick<DbStat, "change" | "hint" | "direction"> =>
    then != null && now > then
      ? { change: `+${num(now - then)}`, direction: "up", hint: `since ${new Date(p!.since!.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}, before the day's first run` }
      : {}
  const tiles: DbStat[] = [
    { title: "Jurisdictions", value: p ? num(p.totals.states) : <Skeleton className="h-7 w-12" /> },
    { title: "Bills on File", value: p ? fmtCompact(p.totals.bills, false) : <Skeleton className="h-7 w-16" />, ...(p ? added(p.totals.bills, p.since?.bills) : {}) },
    { title: "Texts on File", value: p ? fmtCompact(p.totals.texts, false) : <Skeleton className="h-7 w-16" />, ...(p ? added(p.totals.texts, p.since?.texts) : {}) },
    { title: "Roll Calls", value: p ? fmtCompact(p.totals.rollcalls, false) : <Skeleton className="h-7 w-16" />, ...(p ? added(p.totals.rollcalls, p.since?.rollcalls) : {}) },
    { title: "Members", value: p ? num(p.totals.people) : <Skeleton className="h-7 w-16" />, ...(p ? added(p.totals.people, p.since?.people) : {}) },
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
    // Texts for one jurisdiction, or while a run is up, come from the board's own read, which is live.
    if (metric === "texts" && pipe.data && (selected || pipe.running)) {
      const texts = new Map<string, number>()
      for (const d of pipe.data.daily) texts.set(d.day, (texts.get(d.day) ?? 0) + d.n)
      return list.map((day) => ({ day, value: texts.get(day) ?? 0 }))
    }
    return list.map((day) => ({ day, value: byDay.get(day)?.[metric] ?? 0 }))
  }, [p, metric, span, pipe.data, pipe.running, selected])

  // One row a jurisdiction: bills added and bills newly holding text since the span's first snapshot, and whether it
  // has been looked at inside 36 hours — a jurisdiction that was checked and had nothing new is work too.
  const updates = React.useMemo(() => {
    const pulled = new Map((p?.fresh ?? []).map((f) => [f.state, f.pulled_at]))
    return (pipe.data?.updates ?? []).map((u) => ({
      state: u.state,
      bills: Math.max(0, u.bills - u.base_bills),
      texts: Math.max(0, u.with_text - u.base_text),
      checked: hoursSince(pulled.get(u.state)) < 36,
      at: pulled.get(u.state) ?? null,
    }))
  }, [pipe.data, p])
  const updatesSince = pipe.data?.updates?.[0]?.base_at ?? null

  // Texts a day by loader, for the chart beside Volume: which script did the work.
  const loaders = React.useMemo(() => [...new Set((pipe.data?.daily ?? []).map((d) => d.source))].sort(), [pipe.data])
  const byLoader = React.useMemo(() => {
    const days = new Map<string, Record<string, number | string>>()
    for (const d of pipe.data?.daily ?? []) days.set(d.day, { ...(days.get(d.day) ?? { day: d.day }), [d.source]: d.n })
    return [...days.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)))
  }, [pipe.data])
  // The span's texts by jurisdiction, most first, each with the loaders that fetched them.
  const ranked = React.useMemo(() => {
    const by = new Map<string, { state: string; n: number; loaders: string[] }>()
    for (const r of pipe.data?.byState ?? []) {
      const row = by.get(r.state) ?? { state: r.state, n: 0, loaders: [] }
      row.n += r.n
      row.loaders.push(`${r.source} ${num(r.n)}`)
      by.set(r.state, row)
    }
    return [...by.values()].sort((a, b) => b.n - a.n)
  }, [pipe.data])
  const loaderConfig: ChartConfig = Object.fromEntries(loaders.map((l, i) => [l, { label: l, color: `var(--chart-${(i % 5) + 1})` }]))
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

  // The site's read cache (lib/policy/db.ts) answers the public pages until a
  // load clears it. This clears everything by hand, for a load that did not.
  const [clearing, setClearing] = React.useState<"idle" | "busy" | "done" | "failed">("idle")
  const clearCache = async () => {
    setClearing("busy")
    try {
      const r = await fetch("/api/revalidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) })
      setClearing(r.ok ? "done" : "failed")
    } catch {
      setClearing("failed")
    }
    setTimeout(() => setClearing("idle"), 2500)
  }
  const clearCacheButton = (
    <Button variant="outline" size="sm" className="gap-1" onClick={clearCache} disabled={clearing === "busy"}>
      {clearing === "done" ? "Cleared" : clearing === "failed" ? "Not cleared" : clearing === "busy" ? "Clearing…" : "Clear site cache"}
    </Button>
  )

  return (
    <div>
      <div className="mt-4 sm:mt-5">
        <StatDatabaseGrid stats={tiles} />
      </div>

      {/* The blocks move up and down (Brendan, 2026-09-20): Volume, Feeds and Jurisdictions lead, To Do closes. */}
      <BlockOrder page="dashboard/database" initial={["volume", "feeds", "runs", "jurisdictions", "uslm", "health", "todo", "lessons"]}>
        <OrderedBlock id="todo" label="To Do">
          <TodoCard />
        </OrderedBlock>

        <OrderedBlock id="lessons" label="Lessons Learned">
          <LessonsCard />
        </OrderedBlock>

        <OrderedBlock id="volume" label="Volume">
          <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardAnchor>{volumeView === "updates" ? "Updates" : volumeView === "log" ? "Run Log" : selected ? `Volume · ${stateName(selected)}` : "Volume"}</CardAnchor>
              <CardAction>
                <CardTools className="gap-2" views={[{ value: "updates", label: "Updates by Jurisdiction" }, { value: "days", label: "Volume by Day" }, { value: "live", label: "Volume, Last 30 Minutes" }, { value: "log", label: "Run Log" }]} view={volumeView} onView={(v) => setVolumeView(v as "updates" | "days" | "live" | "log")}>
                  {volumeView === "updates" && updates.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums" title={updatesSince ? `measured from ${fmtWhen(updatesSince)}, before the span's first run` : undefined}>
                      <span className="size-2 rounded-full bg-green-500" />
                      {updates.filter((u) => u.checked).length} of {updates.length} checked
                    </span>
                  )}
                  {volumeView === "live" && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                      <span className={cn("size-2 rounded-full", pipe.running ? "animate-pulse bg-blue-500" : "bg-muted-foreground/40")} />
                      {num(landed)} in 30 min
                    </span>
                  )}
                  {volumeView === "days" && (
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
                  )}
                  {volumeView === "days" && <span className="h-4 w-px bg-border" />}
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
              {volumeView === "updates" ? (
                !pipe.data ? (
                  <div className="flex h-83 items-center justify-center"><LoadingFlag /></div>
                ) : (
                  <ChartContainer config={{ bills: { label: "New bills", color: "var(--chart-1)" }, texts: { label: "Bills newly holding text", color: "var(--chart-2)" } }} className="aspect-auto h-83 w-full">
                    <BarChart data={updates} margin={{ left: 0, right: 0, top: 8 }} barGap={1} barCategoryGap="18%" onClick={(e) => e?.activeLabel && setSelected(String(e.activeLabel))}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      {/* Every jurisdiction keeps its place on the axis, green once it has been looked at: nothing new is an answer too. */}
                      <XAxis
                        dataKey="state"
                        interval={0}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={6}
                        tick={({ x, y, payload }) => {
                          const code = String(payload?.value ?? "")
                          const row = updates.find((u) => u.state === code)
                          return (
                            <text x={Number(x)} y={Number(y) + 8} textAnchor="middle" fontSize={9} fontWeight={selected === code ? 700 : 400} className={row?.checked ? "fill-green-600 dark:fill-green-400" : "fill-muted-foreground"}>
                              {code}
                            </text>
                          )
                        }}
                      />
                      <ChartTooltip
                        cursor={{ fillOpacity: 0.08 }}
                        content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => { const row = updates.find((u) => u.state === String(v)); return `${stateName(String(v))}${row?.at ? ` · checked ${fmtWhen(row.at)}` : ""}` }} />}
                      />
                      <Bar dataKey="bills" fill="var(--color-bills)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="texts" fill="var(--color-texts)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ChartContainer>
                )
              ) : volumeView === "log" ? (
                <RunLog runs={pipe.data?.runs ?? []} />
              ) : volumeView === "live" ? (
                <ChartContainer config={{ value: { label: "Texts landed", color: "var(--chart-1)" } }} className="aspect-auto h-83 w-full">
                  <AreaChart data={minutes} margin={{ left: 0, right: 0, top: 8 }}>
                    <defs>
                      <linearGradient id="fillLive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="minute" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} tickFormatter={(v) => new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => new Date(String(v)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} />} />
                    <Area dataKey="value" type="monotone" stroke="var(--color-value)" fill="url(#fillLive)" isAnimationActive={false} />
                  </AreaChart>
                </ChartContainer>
              ) : (
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
              )}
            </CardContent>
          </Card>
          {/* Which jurisdictions the texts belong to, and the loader that fetched each (Brendan, 2026-09-20: "that has
              to show the state … not bundle them together in one source"). Ranked for the span; a row selects its
              jurisdiction — both charts and its card's ring — and only the card itself opens the module. One
              jurisdiction selected, it is that jurisdiction's days, by loader. */}
          <Card>
            <CardHeader>
              <CardAnchor>{sideView === "progress" ? "Run Progress" : sideView === "loaders" && selected ? `By Loader · ${stateName(selected)}` : "Fetched by Jurisdiction"}</CardAnchor>
              <CardAction>
                <CardTools views={[{ value: "ranked", label: "Fetched by Jurisdiction" }, { value: "progress", label: "Run Progress" }, ...(selected ? [{ value: "loaders", label: `${stateName(selected)} by Loader` }] : [])]} view={sideView} onView={(v) => setSideView(v as "ranked" | "progress" | "loaders")}>{pipe.running && <span className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400"><span className="size-2 animate-pulse rounded-full bg-blue-500" />live</span>}</CardTools>
              </CardAction>
            </CardHeader>
            <CardContent>
              {!pipe.data ? (
                <div className="flex h-83 items-center justify-center"><LoadingFlag /></div>
              ) : sideView === "progress" ? (
                <RunProgress runs={pipe.data.runs} />
              ) : sideView === "loaders" && selected ? (
                byLoader.length ? (
                  <ChartContainer config={loaderConfig} className="aspect-auto h-83 w-full">
                    <BarChart data={byLoader} margin={{ left: 0, right: 0, top: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric" })} />} />
                      {loaders.map((l) => (
                        <Bar key={l} dataKey={l} stackId="loader" fill={`var(--color-${l})`} radius={2} />
                      ))}
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-83 items-center justify-center text-sm text-muted-foreground">No texts fetched for {stateName(selected)} in this span.</div>
                )
              ) : ranked.length ? (
                <ul className="scrollbar-none m-0 flex h-83 list-none flex-col gap-2 overflow-y-auto p-0">
                  {ranked.map((r) => (
                    <li key={r.state}>
                      <button type="button" aria-pressed={selected === r.state} onClick={() => setSelected(r.state)} className="group/row flex w-full items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted">
                        <FlagChip state={r.state} width={28} />
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{stateName(r.state)}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{num(r.n)}</span>
                          </span>
                          <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.max(2, (r.n / ranked[0].n) * 100)}%` }} />
                          </span>
                          <span className="truncate font-mono text-[0.7rem] text-muted-foreground">{r.loaders.join(" · ")}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex h-83 items-center justify-center text-sm text-muted-foreground">No texts fetched in this span.</div>
              )}
            </CardContent>
          </Card>
          </div>
        </OrderedBlock>

        <OrderedBlock id="feeds" label="Feeds">
          <Card className="gap-4">
            <CardHeader className="max-md:px-4">
              <CardAnchor>Feeds</CardAnchor>
              <CardAction>
                <CardTools>
                  {clearCacheButton}
                  {refreshButton}
                </CardTools>
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
        </OrderedBlock>

        <OrderedBlock id="runs" label="Run Log">
          <RunLedger rows={pipe.data?.ledger} selected={selected} onSelect={setSelected} />
        </OrderedBlock>

        <OrderedBlock id="jurisdictions" label="Jurisdictions">
          <Card className="gap-4">
            <CardHeader>
              <CardAnchor>Jurisdictions</CardAnchor>
              <CardAction>
                <CardTools className="gap-2">
                  {/* The charts stay on the jurisdiction last opened until this clears it. */}
                  {selected && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setSelected(null)}>
                      {stateName(selected)} <span aria-hidden>×</span>
                      <span className="sr-only">Show every jurisdiction</span>
                    </Button>
                  )}
                  {refreshButton}
                </CardTools>
              </CardAction>
            </CardHeader>
            <CardContent>
              {pipe.error && <p className="mb-3 text-sm text-destructive">{pipe.error}</p>}
              <JurisdictionsBoard
                states={states.data ?? []}
                dot={(code) => feedState(code, p?.fresh.find((x) => x.state === code)?.pulled_at ?? null)}
                pipeline={pipe.data}
                busy={pipe.busy}
                act={pipe.act}
                selected={selected}
                onInfo={(code) => {
                  setInfo(code)
                  setSelected(code)
                }}
              />
              <SourceOverlay
                state={info}
                facts={(() => {
                  const row = (states.data ?? []).find((x) => x.state === info)
                  if (!info || !row) return null
                  const at = p?.fresh.find((x) => x.state === info)?.pulled_at ?? null
                  return { bills: row.bills, sessions: row.sessions, pulled: at, label: feedState(info, at).label }
                })()}
                pipeline={pipe.data}
                onClose={() => setInfo(null)}
              />
            </CardContent>
          </Card>
        </OrderedBlock>

        <OrderedBlock id="uslm" label="USLM Parse">
          <UslmParseCard />
        </OrderedBlock>

        <OrderedBlock id="health" label="Feed Health and Quotas">
          {/* One block like the rest (Brendan, 2026-09-20): Feed Health and Quotas were two cards side by side. */}
          <Card className="py-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 [&>[data-slot=card]]:py-6">
              <Card className="rounded-none border-0 bg-transparent shadow-none ring-0">
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
              <Card className="gap-3 rounded-none border-0 bg-transparent shadow-none ring-0 max-xl:border-t xl:border-l">
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
          </Card>
        </OrderedBlock>
      </BlockOrder>
    </div>
  )
}
