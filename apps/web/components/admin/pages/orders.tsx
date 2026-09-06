"use client"

import * as React from "react"
import { ArrowUpRightIcon, KanbanIcon, ListFilterIcon, ListIcon, MoreHorizontalIcon, SortAscIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { fmtBill, fmtDate } from "@/lib/format"
import { num, pct, priorSession, useActivity, useAdopted, useBills } from "@/components/admin/data"
import { StatOrder } from "@/components/admin/blocks/stats"
import { PageTitle } from "@/components/admin/page-title"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Progress } from "@govblock/ui/components/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// paceui's Order Performance, as the bills: five stats against the session
// before, the sales overview as this month's bills with the chamber split,
// the daily orders as bills with an action per day this week, and the past
// orders as the newest bills, each with how far along it is.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function stage(status: string | null | undefined): { label: string; percent: number; variant: "default" | "secondary" | "destructive" | "outline" } {
  const s = (status ?? "").toLowerCase()
  if (/veto|fail|died/.test(s)) return { label: "Failed", percent: 0, variant: "destructive" }
  if (/passed$|signed|chaptered|adopted|enacted|became law/.test(s)) return { label: "Adopted", percent: 100, variant: "default" }
  if (/enrolled/.test(s)) return { label: "Enrolled", percent: 80, variant: "secondary" }
  if (/engrossed|passed/.test(s)) return { label: "Engrossed", percent: 60, variant: "secondary" }
  if (/committee|referred/.test(s)) return { label: "In Committee", percent: 40, variant: "outline" }
  return { label: status || "Introduced", percent: 20, variant: "outline" }
}

export function OrdersPage() {
  const activity = useActivity()
  const adopted = useAdopted()
  const bills = useBills(7)
  const [view, setView] = React.useState<"list" | "board">("list")
  const session = activity.scope.session

  const now = adopted.data?.find((r) => r.session_id === session)
  const before = priorSession(adopted.data, session)
  const total = activity.data?.total ?? now?.bills ?? 0
  const rc = activity.data?.rollCalls.reduce((s, r) => s + r.roll_calls, 0) ?? 0
  const yea = activity.data?.rollCalls.reduce((s, r) => s + r.yea, 0) ?? 0
  const nay = activity.data?.rollCalls.reduce((s, r) => s + r.nay, 0) ?? 0
  const ready = Boolean(activity.data && adopted.data)
  const v = (x: React.ReactNode) => (ready ? x : <Skeleton className="h-7 w-20" />)
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}%`

  const stats = [
    { label: "Total Bills", value: v(num(total)), target: before ? `${num(before.bills)} last session` : "no earlier session", change: sign(pct(total, before?.bills)) },
    { label: "Adopted", value: v(num(now?.adopted ?? 0)), target: before ? `${num(before.adopted)} last session` : "—", change: sign(pct(now?.adopted ?? 0, before?.adopted)) },
    { label: "Adoption Rate", value: v(`${total ? Math.round(((now?.adopted ?? 0) / total) * 1000) / 10 : 0}%`), target: before?.bills ? `${Math.round((before.adopted / before.bills) * 1000) / 10}% last session` : "—", change: sign(Math.round(((total ? (now?.adopted ?? 0) / total : 0) - (before?.bills ? before.adopted / before.bills : 0)) * 1000) / 10) },
    { label: "Roll Calls", value: v(num(rc)), target: `${num(yea + nay)} positions`, change: sign(0) },
    { label: "Yea Rate", value: v(`${yea + nay ? Math.round((yea / (yea + nay)) * 1000) / 10 : 0}%`), target: "of positions recorded", change: sign(0) },
  ]

  const months = activity.data?.monthly ?? []
  const thisMonth = months[months.length - 1]
  const lastMonth = months[months.length - 2]
  const senate = months.reduce((s, m) => s + m.senate, 0)
  const lower = months.reduce((s, m) => s + m.assembly, 0)
  const split = [
    { label: "Senate", value: senate },
    { label: activity.scope.state === "US" ? "House" : "Lower chamber", value: lower },
  ]
  const splitTotal = Math.max(1, senate + lower)

  // This week's bills with an action, by weekday.
  const week = React.useMemo(() => {
    const byDate = new Map((activity.data?.daily ?? []).map((d) => [d.date, d.bills]))
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    return WEEKDAYS.map((day, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      return { day, bills: byDate.get(key) ?? 0 }
    })
  }, [activity.data])
  const best = week.reduce((a, b) => (b.bills > a.bills ? b : a), week[0])
  const weekConfig: ChartConfig = { bills: { label: "Bills", color: "var(--chart-1)" } }

  const rows = bills.data?.rows ?? []

  return (
    <div>
      <PageTitle title="Bill Performance" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {stats.map((s) => (
          <StatOrder key={s.label} {...s} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bills Overview</CardTitle>
            <CardAction className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ListFilterIcon className="size-3.5" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 max-sm:hidden">
                <SortAscIcon className="size-3.5" />
                Sort
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <MoreHorizontalIcon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-3xl font-semibold">{thisMonth ? num(thisMonth.bills) : "—"}</span>
              <Badge variant="outline" className="mb-1 h-5 gap-1 text-green-600">
                <ArrowUpRightIcon className="size-3" />
                {lastMonth ? sign(pct(thisMonth?.bills ?? 0, lastMonth.bills)) : "—"}
              </Badge>
              <span className="mb-1 text-xs text-muted-foreground">{lastMonth ? `${thisMonth && thisMonth.bills - lastMonth.bills >= 0 ? "+" : ""}${num((thisMonth?.bills ?? 0) - lastMonth.bills)} vs last month` : "bills with an action this month"}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {months.slice(-3).map((m) => (
                <div key={m.ym} className="rounded-lg border p-3">
                  <p className="text-lg font-semibold">{num(m.bills)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(`${m.ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${(senate / splitTotal) * 100}%` }} />
                <div className="h-full bg-primary/40" style={{ width: `${(lower / splitTotal) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                {split.map((s, i) => (
                  <span key={s.label} className="flex items-center gap-1.5">
                    <span className={cn("size-2 rounded-full", i === 0 ? "bg-primary" : "bg-primary/40")} />
                    {s.label} · {num(s.value)}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Daily Actions</CardTitle>
            <CardAction>
              <Select defaultValue="week">
                <SelectTrigger className="w-32" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="last">Last week</SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ChartContainer config={weekConfig} className="aspect-video h-40 w-full">
              <BarChart data={week}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="bills" fill="var(--color-bills)" radius={6} />
              </BarChart>
            </ChartContainer>
            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
              {week.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-0.5 bg-card py-2">
                  <span className="text-[10px] text-muted-foreground uppercase">{d.day}</span>
                  <span className="text-sm font-semibold">{d.bills}</span>
                  <span className="text-[10px] text-muted-foreground">Bills</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <span>
              Busiest day <span className="font-medium">{best?.day}</span>: <span className="font-medium">{num(best?.bills ?? 0)}</span> bills moved
            </span>
            <span className="flex items-center gap-2">
              <span className="text-muted-foreground">Session status</span>
              <Badge variant="outline" className="h-5 gap-1 text-green-600">
                {thisMonth ? "In session" : "Adjourned"}
              </Badge>
            </span>
          </CardFooter>
        </Card>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:mt-5">
        <Card className="gap-4">
          <CardHeader className="flex-col gap-4 max-md:px-4 sm:flex-row sm:items-center">
            <CardTitle>Recent Bills</CardTitle>
            <CardAction className="flex items-center gap-1">
              <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="gap-1 max-lg:size-9" onClick={() => setView("list")}>
                <ListIcon className="size-3.5" />
                <span className="max-lg:hidden">List</span>
              </Button>
              <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="gap-1 max-lg:size-9" onClick={() => setView("board")}>
                <KanbanIcon className="size-3.5" />
                <span className="max-lg:hidden">Board</span>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="max-md:px-4">
            {view === "list" ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-8">
                      <Checkbox aria-label="Select all" />
                    </TableHead>
                    <TableHead>Bill</TableHead>
                    <TableHead>Sponsor</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Committee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Chamber</TableHead>
                    <TableHead className="text-right">Last Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bills.pending && !bills.data
                    ? Array.from({ length: 7 }, (_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={10}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : rows.map((b) => {
                        const s = stage(b.status_desc)
                        return (
                          <TableRow key={b.bill_id}>
                            <TableCell>
                              <Checkbox aria-label={`Select ${b.bill_number}`} />
                            </TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{fmtBill(b.bill_number)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium whitespace-nowrap">{b.sponsor ?? "—"}</span>
                                <span className="text-xs text-muted-foreground">{b.sponsor_party ? (b.sponsor_party === "D" ? "Democrat" : b.sponsor_party === "R" ? "Republican" : b.sponsor_party) : ""}</span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-64 truncate">{b.title}</TableCell>
                            <TableCell className="max-w-40 truncate">{b.committee ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant={s.variant} className="h-5 gap-1 whitespace-nowrap">
                                {b.status_desc || "Introduced"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="h-5 gap-1 whitespace-nowrap">
                                {s.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={s.percent} className="h-1.5 w-16 **:data-[slot=progress-indicator]:bg-primary *:data-[slot=progress-track]:h-1.5" />
                                <span className="text-xs text-muted-foreground">{s.percent}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{b.body}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{fmtDate(b.last_action_date)}</TableCell>
                          </TableRow>
                        )
                      })}
                </TableBody>
              </Table>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {["Introduced", "In Committee", "Engrossed", "Adopted"].map((col) => (
                  <div key={col} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2">
                    <p className="px-1 text-xs font-semibold text-muted-foreground uppercase">{col}</p>
                    {rows
                      .filter((b) => stage(b.status_desc).label === col || (col === "Introduced" && !["In Committee", "Engrossed", "Enrolled", "Adopted", "Failed"].includes(stage(b.status_desc).label)))
                      .map((b) => (
                        <Card key={b.bill_id} className="gap-1 py-3">
                          <CardContent className="flex flex-col gap-1 px-3">
                            <span className="font-mono text-xs">{fmtBill(b.bill_number)}</span>
                            <span className="line-clamp-2 text-sm">{b.title}</span>
                            <span className="text-xs text-muted-foreground">{b.sponsor ?? "—"}</span>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
