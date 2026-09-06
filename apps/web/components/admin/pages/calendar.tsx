"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react"

import { fmtBill } from "@/lib/format"
import { useHearings, type Hearing } from "@/components/admin/data"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardContent } from "@govblock/ui/components/nova/card"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Separator } from "@govblock/ui/components/nova/separator"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { cn } from "@govblock/ui/lib/utils"

// paceui's Calendar app on the record's hearings: the month grid carries
// whatever the jurisdiction's calendar holds for it, one entry per hearing
// with the bills it takes up, and the calendars in the rail are the kinds
// of event the record has. Sample events stand in only for what the record
// does not keep — the planning calendars the template shows.

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const EMOJI: Record<string, string> = { Hearing: "🏛️", Session: "🗓️", Meeting: "📋", Markup: "✏️" }
const KINDS = [
  { key: "Hearing", label: "Hearings", tone: "bg-blue-500" },
  { key: "Session", label: "Floor Sessions", tone: "bg-emerald-500" },
  { key: "Meeting", label: "Meetings", tone: "bg-amber-500" },
  { key: "Markup", label: "Markups", tone: "bg-rose-500" },
]

type Event = { date: string; time: string; type: string; title: string; bills: string[]; committee: string | null }

function group(rows: Hearing[] | undefined): Event[] {
  const byKey = new Map<string, Event>()
  for (const r of rows ?? []) {
    const key = `${r.date}|${r.time}|${r.description}`
    const e = byKey.get(key) ?? { date: r.date, time: r.time, type: r.type || "Hearing", title: r.committee ?? r.description, bills: [], committee: r.committee }
    e.bills.push(fmtBill(r.bill_number))
    byKey.set(key, e)
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function CalendarPage() {
  const today = new Date()
  const [cursor, setCursor] = React.useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [mini, setMini] = React.useState(cursor)
  const [on, setOn] = React.useState<Record<string, boolean>>({ Hearing: true, Session: true, Meeting: true, Markup: true })
  const from = iso(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 20))
  const to = iso(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 12))
  const hearings = useHearings(from, to)
  const events = React.useMemo(() => group(hearings.data).filter((e) => on[e.type] ?? true), [hearings.data, on])
  const byDate = React.useMemo(() => {
    const m = new Map<string, Event[]>()
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e])
    return m
  }, [events])
  const cells = monthGrid(cursor.getFullYear(), cursor.getMonth())
  const miniCells = monthGrid(mini.getFullYear(), mini.getMonth())
  const title = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const shift = (n: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1)
    setCursor(next)
    setMini(next)
  }
  const present = new Set(events.map((e) => e.type))

  return (
    <div className="grid min-h-[70vh] gap-4 sm:gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <Card className="gap-0 py-0 max-lg:hidden">
        <CardContent className="flex flex-col gap-4 px-4 py-4">
          <p className="font-medium">Calendar</p>
          <Separator />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{mini.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon-xs" aria-label="Previous month" onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() - 1, 1))}>
                  <ChevronLeftIcon />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label="Next month" onClick={() => setMini(new Date(mini.getFullYear(), mini.getMonth() + 1, 1))}>
                  <ChevronRightIcon />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0 text-center text-[11px]">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} className="py-1 text-muted-foreground">
                  {d}
                </span>
              ))}
              {miniCells.map((d) => {
                const key = iso(d)
                const inMonth = d.getMonth() === mini.getMonth()
                return (
                  <button key={key} type="button" onClick={() => setCursor(new Date(d.getFullYear(), d.getMonth(), 1))} className={cn("relative rounded-md py-1 hover:bg-muted", !inMonth && "text-muted-foreground/50", key === iso(today) && "bg-primary text-primary-foreground hover:bg-primary")}>
                    {d.getDate()}
                    {byDate.has(key) && <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />}
                  </button>
                )
              })}
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">My Calendar</p>
            {KINDS.map((k) => (
              <label key={k.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={on[k.key]} onCheckedChange={(v) => setOn((o) => ({ ...o, [k.key]: Boolean(v) }))} />
                <span className={cn("size-2 rounded-full", k.tone)} />
                <span className="grow">{k.label}</span>
                {!present.has(k.key) && <span className="text-[10px] text-muted-foreground">none</span>}
              </label>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <PlusIcon className="size-3.5" />
            Add calendar account
          </Button>
        </CardContent>
      </Card>
      <Card className="gap-0 py-0">
        <CardContent className="flex h-full flex-col px-0">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <p className="text-lg font-medium">{title}</p>
            <div className="ms-2 flex items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
                <ChevronLeftIcon />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
                <ChevronRightIcon />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => shift(today.getMonth() - cursor.getMonth() + (today.getFullYear() - cursor.getFullYear()) * 12)}>
              Today
            </Button>
            <div className="ms-auto flex items-center gap-2">
              {hearings.scope.state !== "US" ? (
                <Badge variant="outline" className="font-normal text-muted-foreground">
                  Hearings are on file for Congress alone
                </Badge>
              ) : hearings.pending && !hearings.data ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <Badge variant="secondary">{events.length} events</Badge>
              )}
              <Button variant="outline" size="sm">
                Availability
              </Button>
              <Button size="sm" className="gap-1">
                <PlusIcon className="size-3.5" />
                Add Event
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
            {DAYS.map((d) => (
              <span key={d} className="py-2">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grow grid-cols-7 auto-rows-fr">
            {cells.map((d, i) => {
              const key = iso(d)
              const inMonth = d.getMonth() === cursor.getMonth()
              const list = byDate.get(key) ?? []
              return (
                <div key={key} className={cn("flex min-h-24 flex-col gap-1 border-b border-r p-1.5", i % 7 === 6 && "border-r-0", !inMonth && "bg-muted/30 text-muted-foreground")}>
                  <span className={cn("self-end text-xs", key === iso(today) && "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground")}>{d.getDate()}</span>
                  {list.slice(0, 3).map((e, k) => (
                    <div key={k} title={`${e.time} ${e.title}\n${e.bills.join(", ")}`} className="flex items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                      <span>{EMOJI[e.type] ?? "📌"}</span>
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                  {list.length > 3 && <span className="px-1 text-[10px] text-muted-foreground">+{list.length - 3} more</span>}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
