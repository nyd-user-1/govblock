"use client"

import * as React from "react"
import { ArrowUpRightIcon, MoreHorizontalIcon, RefreshCwIcon, SearchIcon } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis } from "recharts"

import { fmtCompact, fmtNumber } from "@/lib/format"
import { StatAi } from "@/components/admin/blocks/stats"
import { PageTitle } from "@/components/admin/page-title"
import { useSnapshot } from "@/lib/policy/use-policy"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Separator } from "@govblock/ui/components/nova/separator"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { Tabs, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"
import { cn } from "@govblock/ui/lib/utils"

// paceui's AI Tokens page, as the site's traffic (Brendan, 2026-09-06: "tie
// it to one of the admin dashboard views and pull in all analytics data
// now"). Every figure is Cloudflare's zone analytics or Amplify's metrics,
// from the copies Aurora keeps: the four tiles are the last 30 days, the
// trend is daily requests and page views since the zone's first day, the
// allocation is traffic by host, the ratio is cached against uncached, the
// timeline is the last three days by hour, the status card is response
// classes, and the table is the top paths of the last eight days.
//
// One thing the page says plainly, because it changes how every number
// reads: policy.nysgpt.com is DNS-only, straight to CloudFront, so Cloudflare
// has never seen GovBlock's own traffic. That series is Amplify's.

type Zone = { date: string; requests: number; cached_requests: number; bytes: number; cached_bytes: number; threats: number; page_views: number; uniques: number; response_status_map: { edgeResponseStatus: number; requests: number }[] | null; country_map: { clientCountryName: string; requests: number }[] | null; browser_map: { uaBrowserFamily: string; pageViews: number }[] | null }
type Hour = { datetime: string; requests: number; cached_requests: number; threats: number; page_views: number; uniques: number }
type Dim = { date: string; host: string; value: string; requests: number; visits: number; bytes: number }
type Amp = { date: string; app_id: string; app_name: string; requests: number; errors_4xx: number; errors_5xx: number; bytes_downloaded: number; latency_ms: number | null }
type Traffic = { zone: Zone[]; hourly: Hour[]; hosts: Dim[]; paths: Dim[]; countries: Dim[]; devices: Dim[]; browsers: Dim[]; statuses: Dim[]; amplify: Amp[]; pulled_at: string | null; zone_name: string; note: string; refresh?: { refreshed: boolean; reason: string } }

const fmtDay = (v: string, long = false) => new Date(`${v}T12:00:00`).toLocaleDateString("en-US", { month: long ? "long" : "short", day: "numeric" })
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const sign = (v: number) => `${v > 0 ? "+" : ""}${v}%`
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0)

export function TrafficPage() {
  const [days, setDays] = React.useState("90")
  const { data, isLoading } = useSnapshot<Traffic>(`/api/traffic?days=${days}`)
  const [tab, setTab] = React.useState("requests")
  const [query, setQuery] = React.useState("")
  const [hostFilter, setHostFilter] = React.useState("all")

  const zone = data?.zone ?? []
  const last30 = zone.slice(-30), prior30 = zone.slice(-60, -30)
  const requests30 = sum(last30, (r) => r.requests), requestsPrior = sum(prior30, (r) => r.requests)
  const views30 = sum(last30, (r) => r.page_views), viewsPrior = sum(prior30, (r) => r.page_views)
  const uniques30 = sum(last30, (r) => r.uniques), uniquesPrior = sum(prior30, (r) => r.uniques)
  const bytes30 = sum(last30, (r) => r.bytes), bytesPrior = sum(prior30, (r) => r.bytes)
  const threats30 = sum(last30, (r) => r.threats)
  const cached30 = sum(last30, (r) => r.cached_requests)
  const govblock = (data?.amplify ?? []).filter((a) => a.app_name === "govblock")
  const gbRequests = sum(govblock, (a) => a.requests), gb5xx = sum(govblock, (a) => a.errors_5xx), gb4xx = sum(govblock, (a) => a.errors_4xx)

  const trend = zone.map((r) => ({ date: r.date, requests: r.requests, views: r.page_views, uniques: r.uniques, cached: r.cached_requests, uncached: r.requests - r.cached_requests }))
  const gbTrend = govblock.map((a) => ({ date: a.date, requests: a.requests, errors: a.errors_4xx + a.errors_5xx }))
  const trendConfig: ChartConfig = tab === "requests" ? { uncached: { label: "Uncached", color: "var(--chart-1)" }, cached: { label: "Cached", color: "var(--chart-3)" } } : tab === "views" ? { views: { label: "Page views", color: "var(--chart-1)" }, uniques: { label: "Unique visitors", color: "var(--chart-2)" } } : { requests: { label: "Requests", color: "var(--chart-1)" }, errors: { label: "Errors", color: "var(--chart-5)" } }

  // Traffic by host: the eight-day window the API keeps, summed.
  const hosts = React.useMemo(() => {
    const m = new Map<string, { requests: number; visits: number; bytes: number }>()
    for (const h of data?.hosts ?? []) { const cur = m.get(h.value) ?? { requests: 0, visits: 0, bytes: 0 }; cur.requests += h.requests; cur.visits += h.visits; cur.bytes += h.bytes; m.set(h.value, cur) }
    return [...m.entries()].map(([host, v]) => ({ host, ...v })).sort((a, b) => b.requests - a.requests)
  }, [data?.hosts])
  const hostTotal = Math.max(1, sum(hosts, (h) => h.requests))
  const hostConfig: ChartConfig = Object.fromEntries(hosts.slice(0, 6).map((h, i) => [h.host, { label: h.host, color: `var(--chart-${(i % 5) + 1})` }]))

  const hourly = (data?.hourly ?? []).map((h) => ({ t: h.datetime, requests: h.requests, views: h.page_views, uniques: h.uniques, threats: h.threats }))
  const hourConfig: ChartConfig = { requests: { label: "Requests", color: "var(--chart-1)" }, views: { label: "Page views", color: "var(--chart-2)" }, uniques: { label: "Visitors", color: "var(--chart-3)" } }

  // Response classes over the last 30 days, from each day's status map.
  const classes = React.useMemo(() => {
    const c = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 }
    for (const d of last30) for (const s of d.response_status_map ?? []) { const k = `${String(s.edgeResponseStatus)[0]}xx` as keyof typeof c; if (k in c) c[k] += s.requests }
    return c
  }, [last30])
  const classTotal = Math.max(1, Object.values(classes).reduce((a, b) => a + b, 0))

  const paths = React.useMemo(() => {
    const m = new Map<string, { host: string; path: string; requests: number; visits: number; bytes: number; days: Set<string> }>()
    for (const p of data?.paths ?? []) {
      if (!p.host) continue
      const key = `${p.host}${p.value}`
      const cur = m.get(key) ?? { host: p.host, path: p.value, requests: 0, visits: 0, bytes: 0, days: new Set<string>() }
      cur.requests += p.requests; cur.visits += p.visits; cur.bytes += p.bytes; cur.days.add(p.date); m.set(key, cur)
    }
    return [...m.values()].filter((r) => (hostFilter === "all" || r.host === hostFilter) && (!query || r.path.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => b.requests - a.requests).slice(0, 40)
  }, [data?.paths, hostFilter, query])

  const top = (rows: Dim[] | undefined, k = 5) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) if (!r.host) m.set(r.value, (m.get(r.value) ?? 0) + r.requests)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k)
  }
  const pending = isLoading && !data

  return (
    <div>
      <PageTitle
        title="Traffic Observability"
        endContent={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-6 gap-1.5 font-normal text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", data?.pulled_at ? "bg-green-500" : "bg-muted-foreground/40")} />
              {data?.pulled_at ? `Cloudflare · pulled ${new Date(data.pulled_at.replace(" ", "T")).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Cloudflare"}
            </Badge>
            <Select value={days} onValueChange={(v) => v && setDays(String(v))}>
              <SelectTrigger className="h-8 w-32" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="400">Since July 1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatAi title="Requests (30d)" badge={pending ? "…" : sign(pct(requests30 - requestsPrior, requestsPrior))} badgeTone={requests30 >= requestsPrior ? "up" : "down"} value={pending ? <Skeleton className="h-7 w-24" /> : fmtCompact(requests30, false)} note={`${fmtCompact(cached30, false)} served from cache · ${pct(cached30, requests30)}%`} />
        <StatAi title="Page Views & Visitors (30d)" badge={pending ? "…" : sign(pct(views30 - viewsPrior, viewsPrior))} badgeTone={views30 >= viewsPrior ? "up" : "down"} value={pending ? <Skeleton className="h-7 w-24" /> : fmtCompact(views30, false)} note={`${fmtNumber(uniques30)} unique visitors, summed by day${uniquesPrior ? ` · ${sign(pct(uniques30 - uniquesPrior, uniquesPrior))}` : ""}`} />
        <StatAi title="Bandwidth (30d)" badge={pending ? "…" : sign(pct(bytes30 - bytesPrior, bytesPrior))} badgeTone={bytes30 >= bytesPrior ? "up" : "down"} value={pending ? <Skeleton className="h-7 w-24" /> : `${(bytes30 / 1e9).toFixed(2)}`} unit="GB" note={`${(sum(last30, (r) => r.cached_bytes) / 1e6).toFixed(0)} MB of it cached`} />
        <StatAi title="Threats Blocked (30d)" badge="Cloudflare" badgeTone="neutral" value={pending ? <Skeleton className="h-7 w-24" /> : fmtCompact(threats30, false)} note={`${pct(threats30, requests30)}% of requests · policy.nysgpt.com is not behind Cloudflare`} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card className="max-2xl:gap-3 max-2xl:pt-4">
            <CardHeader className="max-2xl:px-4">
              <CardTitle>Traffic Trends</CardTitle>
              <CardDescription className="max-sm:text-xs">{tab === "govblock" ? "policy.nysgpt.com from Amplify's metrics, daily since August 31" : `The zone ${data?.zone_name ?? "nysgpt.com"} through Cloudflare, daily since July 1`}</CardDescription>
              <CardAction>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <TabsList className="h-8">
                    <TabsTrigger value="requests">Requests</TabsTrigger>
                    <TabsTrigger value="views">Views</TabsTrigger>
                    <TabsTrigger value="govblock">GovBlock</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardAction>
            </CardHeader>
            <CardContent className="sm:px-4">
              <ChartContainer config={trendConfig} className="aspect-auto h-68 w-full">
                <AreaChart data={(tab === "govblock" ? gbTrend : trend) as Record<string, string | number>[]}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(v) => fmtDay(String(v))} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => fmtDay(String(v), true)} />} />
                  {tab === "requests" ? (
                    <>
                      <Area dataKey="uncached" type="monotone" stackId="a" stroke="var(--color-uncached)" fill="var(--color-uncached)" fillOpacity={0.5} />
                      <Area dataKey="cached" type="monotone" stackId="a" stroke="var(--color-cached)" fill="var(--color-cached)" fillOpacity={0.5} />
                    </>
                  ) : tab === "views" ? (
                    <>
                      <Area dataKey="views" type="monotone" stroke="var(--color-views)" fill="var(--color-views)" fillOpacity={0.3} />
                      <Area dataKey="uniques" type="monotone" stroke="var(--color-uniques)" fill="var(--color-uniques)" fillOpacity={0.3} />
                    </>
                  ) : (
                    <>
                      <Area dataKey="requests" type="monotone" stroke="var(--color-requests)" fill="var(--color-requests)" fillOpacity={0.3} />
                      <Area dataKey="errors" type="monotone" stroke="var(--color-errors)" fill="var(--color-errors)" fillOpacity={0.3} />
                    </>
                  )}
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="max-2xl:px-4">
              <CardTitle>Traffic by Host</CardTitle>
              <CardDescription className="max-sm:text-xs">The last eight days, which is as far back as Cloudflare keeps the split</CardDescription>
              <CardAction>
                <Button variant="ghost" size="icon-sm" aria-label="Options">
                  <MoreHorizontalIcon />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <ChartContainer config={hostConfig} className="mx-auto aspect-square h-56">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="host" />} />
                    <Pie data={hosts.slice(0, 6).map((h, i) => ({ ...h, fill: `var(--chart-${(i % 5) + 1})` }))} dataKey="requests" nameKey="host" innerRadius={60} outerRadius={90} paddingAngle={3} cornerRadius={4} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col justify-center gap-3">
                  {hosts.slice(0, 6).map((h, i) => (
                    <div key={h.host} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--chart-${(i % 5) + 1})` }} />
                        <span className="truncate text-sm font-medium">{h.host}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{fmtNumber(h.requests)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {pct(h.requests, hostTotal)}% · {fmtNumber(h.visits)} visits
                        </p>
                      </div>
                    </div>
                  ))}
                  {!hosts.length && !pending && <p className="text-sm text-muted-foreground">No proxied host has served a request in eight days.</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-3">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Cached vs Uncached</CardTitle>
            <CardAction>
              <Badge variant="outline" className="h-6 font-normal">
                30d
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-3xl font-semibold">
              {pct(cached30, requests30)}<span className="text-base text-muted-foreground">%</span> <span className="text-muted-foreground">/</span> {Math.round((100 - pct(cached30, requests30)) * 10) / 10}<span className="text-base text-muted-foreground">%</span>
            </p>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${pct(cached30, requests30)}%` }} />
              <div className="h-full bg-primary/40" style={{ width: `${100 - pct(cached30, requests30)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{fmtCompact(cached30, false)}</span> cached
              </span>
              <span>
                <span className="font-medium text-foreground">{fmtCompact(requests30 - cached30, false)}</span> uncached
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div>
                <p className="text-xl font-semibold">{fmtCompact(gbRequests, false)}</p>
                <p className="text-xs text-muted-foreground">GovBlock requests, Amplify</p>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div>
                <p className="text-xl font-semibold">{gbRequests ? pct(gb4xx + gb5xx, gbRequests) : 0}%</p>
                <p className="text-xs text-muted-foreground">GovBlock error rate</p>
              </div>
            </div>
            <div className="flex justify-between rounded-lg bg-muted/50 p-3 text-xs">
              <span>
                Top country: <span className="font-medium">{top(data?.countries, 1)[0]?.[0] ?? "—"}</span>
              </span>
              <span>
                Top device: <span className="font-medium">{top(data?.devices, 1)[0]?.[0] ?? "—"}</span>
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Hourly Timeline</CardTitle>
            <CardAction className="gap-1.5">
              <Badge variant="outline" className="h-6 font-normal">
                3 days
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-3xl font-semibold">
              {fmtNumber(hourly[hourly.length - 1]?.requests ?? 0)}<span className="text-base text-muted-foreground"> in the last hour</span>
            </p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {["Requests", "Page views", "Visitors"].map((p, i) => (
                <span key={p} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: `var(--chart-${i + 1})` }} />
                  {p}
                </span>
              ))}
            </div>
            <ChartContainer config={hourConfig} className="aspect-auto h-40 w-full">
              <LineChart data={hourly}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={40} tickFormatter={(v) => new Date(String(v)).toLocaleTimeString("en-US", { hour: "numeric" })} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => new Date(String(v)).toLocaleString("en-US", { weekday: "short", hour: "numeric" })} />} />
                <Line dataKey="requests" type="monotone" stroke="var(--color-requests)" dot={false} strokeWidth={2} />
                <Line dataKey="views" type="monotone" stroke="var(--color-views)" dot={false} strokeWidth={2} />
                <Line dataKey="uniques" type="monotone" stroke="var(--color-uniques)" dot={false} strokeWidth={2} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Response Status</CardTitle>
            <CardAction>
              <Button variant="outline" size="sm" render={<a href="/api/traffic?refresh=1" target="_blank" rel="noreferrer" />}>
                <RefreshCwIcon className="size-3.5" />
                Refresh
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div>
              <p className="text-3xl font-semibold">{fmtCompact(classTotal, false)}</p>
              <p className="text-xs text-muted-foreground">Responses through Cloudflare (30d)</p>
            </div>
            <div className="flex flex-col gap-4">
              {(Object.entries(classes) as [string, number][]).map(([code, count]) => (
                <div key={code} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("h-5 gap-1 font-mono", code === "2xx" ? "text-green-600" : code === "5xx" ? "text-destructive" : code === "4xx" ? "text-amber-600" : "text-muted-foreground")}>
                      {code}
                    </Badge>
                    <span className="text-sm">{code === "2xx" ? "OK" : code === "3xx" ? "Redirect" : code === "4xx" ? "Client error" : "Server error"}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{fmtNumber(count)}</p>
                    <p className="text-[11px] text-muted-foreground">{pct(count, classTotal)}%</p>
                  </div>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct(count, classTotal)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:mt-5">
        <Card>
          <CardHeader className="max-2xl:px-4">
            <CardTitle>Top Paths</CardTitle>
            <CardDescription className="max-sm:text-xs">The most requested paths per host over the last eight days, Cloudflare's window for the split.</CardDescription>
            <CardAction>
              <Badge variant="outline" className="h-6 font-normal text-muted-foreground">
                {data?.note ? "Cloudflare hosts only" : ""}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative grow sm:max-w-xs">
                <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search paths" className="h-9 pl-8" />
              </div>
              <Select value={hostFilter} onValueChange={(v) => setHostFilter(String(v))}>
                <SelectTrigger className="h-9 sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All hosts</SelectItem>
                  {hosts.map((h) => (
                    <SelectItem key={h.host} value={h.host}>
                      {h.host}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead>Path</TableHead>
                  <TableHead>Host</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Visits</TableHead>
                  <TableHead>Bytes</TableHead>
                  <TableHead>Days seen</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending
                  ? Array.from({ length: 6 }, (_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : paths.map((p) => (
                      <TableRow key={`${p.host}${p.path}`}>
                        <TableCell className="max-w-96 truncate font-mono text-xs">{p.path}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.host}</TableCell>
                        <TableCell>{fmtNumber(p.requests)}</TableCell>
                        <TableCell>{fmtNumber(p.visits)}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.bytes > 1e6 ? `${(p.bytes / 1e6).toFixed(1)} MB` : `${Math.round(p.bytes / 1e3)} KB`}</TableCell>
                        <TableCell>{p.days.size}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1" render={<a href={`https://${p.host}${p.path}`} target="_blank" rel="noreferrer" />}>
                            Open
                            <ArrowUpRightIcon className="size-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                {!pending && !paths.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nothing in the window.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">{data?.note}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
