"use client"

import * as React from "react"
import { GavelIcon, ScrollTextIcon } from "lucide-react"

import { fmtBill, fmtDate } from "@/lib/format"
import { num, pct, priorSession, useActivity, useAdopted, useRollCalls, useSeats, useStream } from "@/components/admin/data"
import { Chart1, Chart2, type HeatRow, type SeriesRow } from "@/components/admin/blocks/charts"
import { Pending, Stat1, type Stat1Props } from "@/components/admin/blocks/stats"
import { Table1, type RequestRow } from "@/components/admin/blocks/tables"
import { Widget1, Widget5, type LogEntry, type Quota } from "@/components/admin/blocks/widgets"
import { PageTitle } from "@/components/admin/page-title"

// paceui's Logs Analytics, as the session's log (Brendan, 2026-09-05: "logs
// is for bills and/or votes"). The throughput is bills, the console is the
// record's stream, the recent requests are the latest roll calls, the weekly
// grid is roll calls by weekday over the last eight weeks, and the quotas are
// where the session's bills stand in the pipeline.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function LogsPage() {
  const activity = useActivity()
  const adopted = useAdopted()
  const rollcalls = useRollCalls(120)
  const seats = useSeats()
  const stream = useStream(20)
  const session = activity.scope.session

  const now = adopted.data?.find((r) => r.session_id === session)
  const before = priorSession(adopted.data, session)
  const rc = activity.data?.rollCalls ?? []
  const totalRc = rc.reduce((s, r) => s + r.roll_calls, 0)
  const yea = rc.reduce((s, r) => s + r.yea, 0)
  const nay = rc.reduce((s, r) => s + r.nay, 0)
  const seatTotal = seats.data?.reduce((s, r) => s + r.seats, 0) ?? 0
  const dir = (v: number): Stat1Props["direction"] => (v > 0 ? "up" : v < 0 ? "down" : "neutral")

  const stats: Stat1Props[] = [
    {
      title: "Bills",
      value: now ? num(now.bills) : <Pending />,
      changeValue: before ? `${pct(now?.bills ?? 0, before.bills) > 0 ? "+" : ""}${pct(now?.bills ?? 0, before.bills)}% vs ${before.session_id}` : "this session",
      direction: before ? dir(pct(now?.bills ?? 0, before.bills)) : "neutral",
    },
    {
      title: "Adopted",
      value: now ? num(now.adopted) : <Pending />,
      changeValue: before ? `${pct(now?.adopted ?? 0, before.adopted) > 0 ? "+" : ""}${pct(now?.adopted ?? 0, before.adopted)}% vs ${before.session_id}` : "passed both chambers",
      direction: before ? dir(pct(now?.adopted ?? 0, before.adopted)) : "neutral",
    },
    {
      title: "Roll Calls",
      value: activity.data ? num(totalRc) : <Pending />,
      changeValue: `${num(yea + nay)} positions`,
      direction: "neutral",
    },
    {
      title: "Yea Share",
      value: activity.data ? `${yea + nay ? Math.round((yea / (yea + nay)) * 1000) / 10 : 0}%` : <Pending />,
      changeValue: `${num(nay)} nays`,
      direction: "up",
    },
    {
      title: "Seats",
      value: seats.data ? num(seatTotal) : <Pending />,
      changeValue: seats.data ? `${seats.data.filter((s) => s.chamber === "Senate").reduce((a, s) => a + s.seats, 0)} in the Senate` : "",
      direction: "neutral",
    },
  ]

  // Bills with an action per day, the last three weeks, against the roll
  // calls of the same days.
  const series: SeriesRow[] | undefined = React.useMemo(() => {
    if (!activity.data) return undefined
    const byDay = new Map<string, number>()
    for (const r of rollcalls.data ?? []) byDay.set(r.date, (byDay.get(r.date) ?? 0) + 1)
    return activity.data.daily.map((d) => ({
      date: d.date,
      a: d.bills,
      b: byDay.get(d.date) ?? 0,
    }))
  }, [activity.data, rollcalls.data])

  const feed: LogEntry[] | undefined = React.useMemo(() => {
    const bills = stream.data?.[0]?.bills
    if (!bills?.length) return undefined
    return bills.map((b) => ({
      id: String(b.bill_id),
      timestamp: b.last_action_date,
      method: b.body === "Senate" ? "SEN" : b.body === "House" ? "HSE" : b.body === "Assembly" ? "ASM" : (b.body ?? "").slice(0, 3).toUpperCase(),
      path: `${fmtBill(b.bill_number)} · ${b.title}`,
      status: (b.status_desc || "—").slice(0, 10),
      latency: b.last_action ? b.last_action.slice(0, 18) : "",
      bad: /veto|fail|died/i.test(b.status_desc ?? ""),
    }))
  }, [stream.data])

  const recent: RequestRow[] =
    rollcalls.data?.slice(0, 5).map((r) => ({
      id: String(r.roll_call_id),
      method: r.chamber === "S" || r.chamber === "Senate" ? "SEN" : r.chamber === "H" || r.chamber === "House" ? "HSE" : r.chamber === "A" ? "ASM" : r.chamber,
      path: `${fmtBill(r.bill_number)} · ${r.description}`,
      status: r.yea > r.nay ? "Passed" : "Failed",
      bad: r.yea <= r.nay,
      time: fmtDate(r.date),
      duration: `${r.yea}–${r.nay}`,
    })) ?? []

  // Roll calls by weekday, the last eight weeks: rows are days, columns weeks.
  const heat: HeatRow[] | undefined = React.useMemo(() => {
    if (!rollcalls.data) return undefined
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const start = new Date(monday)
    start.setDate(monday.getDate() - 7 * 7)
    const grid = WEEKDAYS.map(() => Array.from({ length: 8 }, () => 0))
    for (const r of rollcalls.data) {
      const d = new Date(`${r.date}T12:00:00`)
      const diff = Math.floor((d.getTime() - start.getTime()) / 864e5)
      if (diff < 0 || diff >= 56) continue
      grid[(d.getDay() + 6) % 7][Math.floor(diff / 7)]++
    }
    return WEEKDAYS.map((day, i) => ({ day, slots: grid[i] }))
  }, [rollcalls.data])
  const weekLabels = Array.from({ length: 8 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (7 - i) * 7)
    return {
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      name: `week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    }
  })

  const total = activity.data?.total ?? 0
  const count = (name: RegExp) => activity.data?.statuses.filter((s) => name.test(s.status)).reduce((a, s) => a + s.bills, 0) ?? 0
  const quotas: Quota[] = [
    {
      id: "introduced",
      name: "Introduced",
      icon: ScrollTextIcon,
      used: count(/introduced|prefiled/i),
      limit: Math.max(1, total),
      unit: "bills",
    },
    {
      id: "engrossed",
      name: "Engrossed",
      icon: ScrollTextIcon,
      used: count(/engrossed/i),
      limit: Math.max(1, total),
      unit: "bills",
    },
    {
      id: "enrolled",
      name: "Enrolled",
      icon: GavelIcon,
      used: count(/enrolled/i),
      limit: Math.max(1, total),
      unit: "bills",
    },
    {
      id: "passed",
      name: "Passed",
      icon: GavelIcon,
      used: count(/passed|signed|chaptered|adopted|enacted|became law/i),
      limit: Math.max(1, total),
      unit: "bills",
    },
  ]

  return (
    <div>
      <PageTitle title="Activity Log" />
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <Stat1 {...stat} key={stat.title} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-7">
        <div className="xl:col-span-4">
          <Chart1
            title="Bill Traffic"
            data={series}
            labels={{ a: "Bills", b: "Roll calls" }}
            ranges={[
              { value: "21d", label: "Last 3 weeks", days: 21 },
              { value: "14d", label: "Last 2 weeks", days: 14 },
              { value: "7d", label: "Last 7 days", days: 7 },
            ]}
          />
        </div>
        <div className="h-90 xl:col-span-3 2xl:h-94">
          <Widget1 title="Live Stream" feed={feed} empty="Waiting for the record's stream..." />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Table1 title="Recent Roll Calls" rows={recent} pending={rollcalls.pending} columns={["Chamber", "Question", "Result", "Date", "Yea–Nay"]} />
        <Chart2 title="Weekly Roll Calls" data={heat} columns={weekLabels} unit="roll calls" />
        <Widget5 title="Pipeline" quotas={quotas} badge={<span className="text-xs text-muted-foreground">{num(total)} bills</span>} footer="Open the Bills" critical={101} />
      </div>
    </div>
  )
}
