"use client"

import * as React from "react"
import { AlertTriangleIcon, CheckCircle2Icon, RefreshCwIcon } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart, XAxis } from "recharts"

import { fmtCompact } from "@/lib/format"
import { ago, fmtStamp, num, useProvenance, useStates, type Provenance } from "@/components/admin/data"
import { StatDatabaseGrid, type DbStat } from "@/components/admin/blocks/stats"
import { PageTitle } from "@/components/admin/page-title"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// paceui's Database Depth, as the record's provenance (Brendan, 2026-09-05:
// "perhaps this is what you use to show me our provenance and nightly run
// rate"). The six tiles are the whole record; the performance chart is what
// the loaders wrote each day, from the ledgers Aurora keeps; the instance
// table is the feeds — where each family comes from, how often, and the last
// time the ledger saw it write; the resource card is the quotas the jobs
// run under. Cadence and coverage are the job definitions on the two boxes,
// as reported on 2026-09-05; the timestamps are live.

type Feed = { name: string; engine: string; cadence: string; covers: string; at: string | null; rows: string; nodes: string }

function feeds(p: Provenance): Feed[] {
  const f = p.feeds
  return [
    { name: "LegiScan delta", engine: "LegiScan API · getMasterList", cadence: "Nightly", covers: "New York, New Jersey, Congress", at: f.legiscan_delta_at, rows: "—", nodes: "box 1" },
    { name: "National sweep", engine: "LegiScan bulk datasets", cadence: "Weekly, Sunday", covers: "All 52 jurisdictions", at: f.legiscan_at, rows: num(p.totals.sessions) + " sessions", nodes: "box 1" },
    { name: "congress.gov pipeline", engine: "congress.gov API + govinfo BILLSTATUS", cadence: "Nightly", covers: "Congress: the federal families", at: f.congress_at, rows: f.congress_note ?? "—", nodes: "box 1" },
    { name: "Text walk", engine: "Legislature sites, 47 of them", cadence: "Nightly, four hours", covers: "Every state since 2023, New Jersey skipped", at: f.texts_at, rows: `${num(f.texts_week)} texts / 7d`, nodes: "box 1" },
    { name: "Text delta", engine: "NY Senate API · govinfo · sites", cadence: "Nightly, 1,500 cap", covers: "Bills that moved in the last week", at: f.texts_at, rows: "—", nodes: "box 1" },
    { name: "Open States scrapers", engine: "openstates-scrapers", cadence: "Weekly, three batches", covers: "TX, IL, MN, TN, MA, GA, CA, HI, OK, PA", at: null, rows: "not read by the site", nodes: "box 2" },
    { name: "NY Senate API", engine: "legislation.nysenate.gov", cadence: "Nightly", covers: "New York's own bills and desks", at: f.legiscan_delta_at, rows: "—", nodes: "box 1" },
    { name: "House directory", engine: "directory.house.gov", cadence: "Nightly", covers: "Representatives' offices and staff", at: f.house_at, rows: "—", nodes: "Vercel cron" },
    { name: "Senate contact", engine: "senate.gov senators_cfm.xml", cadence: "Nightly", covers: "Senators' contact record", at: f.senate_at, rows: "—", nodes: "Vercel cron" },
    { name: "Laws", engine: "congress.gov · state codes", cadence: "Nightly", covers: "Public laws and chapters", at: f.laws_at, rows: "—", nodes: "Vercel cron" },
    { name: "FEC", engine: "api.open.fec.gov", cadence: "By hand", covers: "Candidate totals by cycle", at: f.fec_at, rows: "—", nodes: "livingston" },
    { name: "Senate LDA", engine: "lda.senate.gov", cadence: "By hand", covers: "Lobbying registrations", at: f.lobbying_at, rows: "—", nodes: "livingston" },
    { name: "Model bills", engine: "ALEC · state matches", cadence: "By hand", covers: "Model bill matches", at: f.model_at, rows: "—", nodes: "livingston" },
  ]
}

function health(at: string | null, cadence: string): { label: string; tone: string } {
  if (!at) return { label: "Unread", tone: "text-muted-foreground" }
  const hours = (Date.now() - new Date(at.replace(" ", "T")).getTime()) / 36e5
  const weekly = /weekly|hand/i.test(cadence)
  if (hours < 36 || (weekly && hours < 24 * 8)) return { label: "Active", tone: "text-green-600" }
  if (hours < 24 * 8) return { label: "Syncing", tone: "text-amber-600" }
  return { label: "Stale", tone: "text-destructive" }
}

export function DatabasePage() {
  const prov = useProvenance()
  const states = useStates()
  const [metric, setMetric] = React.useState<"texts" | "datasets" | "bills">("texts")
  const [span, setSpan] = React.useState<7 | 30>(30)
  const p = prov.data

  const tiles: DbStat[] = [
    { title: "Jurisdictions", value: p ? num(p.totals.states) : <Skeleton className="h-7 w-12" />, change: "50 states, DC, Congress", direction: "neutral", note: "One database, every one of them" },
    { title: "Bills on File", value: p ? fmtCompact(p.totals.bills, false) : <Skeleton className="h-7 w-16" />, change: p ? `${num(p.totals.sessions)} sessions` : "", direction: "up", note: "Since 2009, from LegiScan's archives" },
    { title: "Texts on File", value: p ? fmtCompact(p.totals.texts, false) : <Skeleton className="h-7 w-16" />, change: p ? `${p.coverage.of ? Math.round((p.coverage.with_text / p.coverage.of) * 1000) / 10 : 0}% of 2025+` : "", direction: "up", note: "Walked from each legislature's own site" },
    { title: "Roll Calls", value: p ? fmtCompact(p.totals.rollcalls, false) : <Skeleton className="h-7 w-16" />, change: "with positions", direction: "up", note: "Every recorded vote LegiScan holds" },
    { title: "Members", value: p ? num(p.totals.people) : <Skeleton className="h-7 w-16" />, change: p ? `${num(p.totals.committees)} committees` : "", direction: "neutral", note: "Sitting and former, all jurisdictions" },
    { title: "Fresh This Week", value: p ? num(p.fresh.filter((f) => f.recent > 0).length) : <Skeleton className="h-7 w-12" />, change: p ? `of ${p.fresh.length}` : "", direction: p && p.fresh.filter((f) => f.recent > 0).length < 10 ? "down" : "up", note: "Jurisdictions with an action in 7 days" },
  ]

  const series = React.useMemo(() => {
    if (!p) return []
    const days = Array.from({ length: span }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (span - 1 - i))
      return d.toISOString().slice(0, 10)
    })
    const byDay = new Map(p.daily.map((d) => [d.day, d]))
    return days.map((day) => ({ day, value: byDay.get(day)?.[metric] ?? 0 }))
  }, [p, metric, span])
  const seriesConfig: ChartConfig = { value: { label: metric === "texts" ? "Texts fetched" : metric === "datasets" ? "Datasets imported" : "Bills imported", color: "var(--chart-1)" } }

  const freshShare = p ? Math.round((p.fresh.filter((f) => f.recent > 0).length / Math.max(1, p.fresh.length)) * 100) : 0
  const radial = [{ name: "fresh", value: freshShare, fill: "var(--chart-1)" }]
  const metrics = p
    ? [
        { label: "Text Coverage", value: `${p.coverage.of ? Math.round((p.coverage.with_text / p.coverage.of) * 1000) / 10 : 0}%`, note: `${num(p.coverage.with_text)} of ${num(p.coverage.of)} bills since 2025` },
        { label: "Fresh This Week", value: `${freshShare}%`, note: `${p.fresh.filter((f) => f.recent > 0).length} of ${p.fresh.length} jurisdictions` },
        { label: "Congress Pipeline", value: ago(p.feeds.congress_at), note: p.feeds.congress_note ?? "last run" },
        { label: "LegiScan Load", value: ago(p.feeds.legiscan_at), note: "last dataset imported" },
      ]
    : []

  const rows = p ? feeds(p) : []
  const stalest = rows.filter((r) => r.at).sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""))[0]
  const freshest = rows.filter((r) => r.at).sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0]

  const lastDay = p?.daily[p.daily.length - 1]
  const quotas = [
    { label: "LegiScan calls", used: 10500, limit: 30000, unit: "/ month", note: "estimate, three states nightly" },
    { label: "Text delta cap", used: lastDay?.texts ?? 0, limit: 1500, unit: "/ night", note: "bills refetched on the last day" },
    { label: "congress.gov calls", used: 592, limit: 5000, unit: "/ hour", note: "last run's bills, one call each" },
    { label: "Aurora capacity", used: 0.5, limit: 16, unit: "ACU", note: "auto-pauses after five idle minutes" },
    { label: "Text walk window", used: 4, limit: 24, unit: "hours", note: "one child process per state" },
  ]

  return (
    <div>
      <PageTitle title="Data Provenance" />
      <div className="mt-4 sm:mt-5">
        <StatDatabaseGrid stats={tiles} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-7">
        <div className="xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Load Volume</CardTitle>
              <CardDescription>What the loaders wrote each day, from the ledgers the database keeps</CardDescription>
              <CardAction className="flex flex-wrap items-center gap-1">
                {(["texts", "datasets", "bills"] as const).map((m) => (
                  <Button key={m} variant={metric === m ? "secondary" : "ghost"} size="sm" onClick={() => setMetric(m)}>
                    {m === "texts" ? "Texts" : m === "datasets" ? "Datasets" : "Bills"}
                  </Button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                {([7, 30] as const).map((s) => (
                  <Button key={s} variant={span === s ? "secondary" : "ghost"} size="sm" onClick={() => setSpan(s)}>
                    {s} days
                  </Button>
                ))}
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
        <div className="xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Feed Health</CardTitle>
              <CardAction>
                <Button variant="outline" size="sm" render={<a href="/docs/datasets" />}>
                  View Datasets
                </Button>
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
                                fresh this week
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
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        <div className="2xl:col-span-2">
          <Card className="gap-4">
            <CardHeader className="flex-col gap-4 max-md:px-4 sm:flex-row sm:items-center">
              <div>
                <CardTitle>Feeds</CardTitle>
                <CardDescription>Where every family of the record comes from, how often, and when the ledger last saw it write</CardDescription>
              </div>
              <CardAction>
                <Button variant="outline" size="sm" className="gap-1 max-2xl:size-9" onClick={() => window.location.reload()}>
                  <RefreshCwIcon className="size-3.5" />
                  <span className="max-2xl:hidden">Refresh</span>
                </Button>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!p
                    ? Array.from({ length: 6 }, (_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={8}>
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
                            <TableCell className="whitespace-nowrap">{fmtStamp(r.at)}</TableCell>
                            <TableCell className="whitespace-nowrap">{r.rows}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("h-5 gap-1", h.tone)}>
                                {h.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="2xl:col-span-1">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Quotas</CardTitle>
              <CardAction>
                <Select defaultValue="nightly">
                  <SelectTrigger className="h-7 w-24" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nightly">nightly</SelectItem>
                    <SelectItem value="weekly">weekly</SelectItem>
                  </SelectContent>
                </Select>
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
                        <p className="truncate text-xs text-muted-foreground">{q.note}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold">
                          {pctUsed}
                          <span className="text-xs text-muted-foreground">%</span>
                        </span>
                        <span className={cn("text-xs", pctUsed >= 85 ? "text-destructive" : "text-green-600")}>{pctUsed >= 85 ? "↑" : "↓"}</span>
                        <span className="w-24 text-right font-mono text-[10px] text-muted-foreground">
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
                  <p className="mt-1 truncate text-sm">{stalest ? `${stalest.name} (${ago(stalest.at)})` : "—"}</p>
                </div>
                <div className="rounded-lg border border-green-600/20 bg-green-600/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                    <CheckCircle2Icon className="size-3.5" />
                    Freshest feed
                  </p>
                  <p className="mt-1 truncate text-sm">{freshest ? `${freshest.name} (${ago(freshest.at)})` : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4 sm:mt-5">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>Jurisdictions</CardTitle>
            <CardDescription>Bills on file, sessions held, and the last action the record has seen, per jurisdiction</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-9">
            {(states.data ?? []).map((s) => {
              const f = p?.fresh.find((x) => x.state === s.state)
              return (
                <div key={s.state} className="flex flex-col gap-0.5 rounded-lg border p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">{s.state}</span>
                    <span className={cn("size-1.5 rounded-full", f && f.recent > 0 ? "bg-green-500" : "bg-muted-foreground/30")} />
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtCompact(s.bills, false)} bills · {s.sessions} sessions</span>
                  <span className="text-[10px] text-muted-foreground">{f?.last_action ? `last ${f.last_action}` : "—"}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
