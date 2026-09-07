"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, ArrowUpRightIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtBill, fmtDate, fmtTime, truncate } from "@/lib/format"
import { hearingWhen } from "@/lib/policy/hearing-when"
import { AddToCalendar } from "@/components/connectors/add-to-calendar"
import { CardFrame } from "@/components/card-frame"
import { cn } from "@govblock/ui/lib/utils"
import { Badge } from "@govblock/ui/components/badge"
import { Button } from "@govblock/ui/components/button"
import { Calendar } from "@govblock/ui/components/calendar"
import { CardContent } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@govblock/ui/components/item"

// Calendar — the month grid, then the hearings from the picked day onward,
// nearest first. Two show; the round chevron reveals the rest. Days with a
// hearing are marked; it opens on the next day that has any. Given a
// `committee`, the widget narrows to that committee's hearings.

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}
const stamp = (h: { date: string; time: string | null }) => `${h.date} ${h.time ?? "00:00"}`

type Hearing = (typeof F.hearings)[number]

/** An event handed in from outside: a committee's scheduled meeting, a calendared bill. */
export type CalendarEvent = {
  id: string
  date: string
  time: string | null
  description: string
  href: string
  external?: boolean
  /** The badge at the row's right: a bill number, or what kind of meeting it is. */
  badge?: string | null
  committee?: string | null
  /** What the hover shows in the badge's place: Add to Calendar for what is ahead, an arrow into the record for what was held. */
  action?: "calendar" | "open"
}

type Row = { id: string; date: string; time: string | null; description: string; href: string; external: boolean; badge: string | null; committee: string | null; action: "calendar" | "open" }

const daysFromToday = (days: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// A row from congress.gov's meetings carries its own page and no bill.
const rowOf = (h: Hearing & { href?: string | null; type?: string | null }): Row => ({
  id: `${h.href ?? h.bill_id}-${h.date}-${h.time ?? ""}`,
  date: h.date,
  time: h.time,
  description: h.description,
  href: h.href ?? `/docs/bills/${h.bill_id}`,
  external: false,
  badge: h.bill_number ? fmtBill(h.bill_number) : (h.type ?? null),
  committee: h.committee ?? null,
  action: h.date < key(new Date()) ? "open" : "calendar",
})

export function CalendarCard({
  compact = false,
  committee,
  events,
  bare = false,
}: {
  compact?: boolean
  committee?: string
  /** Rows given by the page instead of the jurisdiction's hearings — the committee page's meetings (Brendan, 2026-09-06). */
  events?: CalendarEvent[]
  /** Without the card frame, for a place that already has one: a tab in a preview frame. */
  bare?: boolean
}) {
  // The whole session's calendar and more — three years back, a year ahead —
  // rather than the ninety days around today (Brendan, 2026-09-07: "wire this
  // to many years").
  const { data, state } = useScoped<{ rows: Hearing[]; through: string | null }>(
    events ? null : "hearings-recent",
    {
      rows: F.hearings,
      through: null,
    },
    events ? {} : { from: daysFromToday(-3 * 365), to: daysFromToday(365), limit: 3000 }
  )

  const hearings = React.useMemo<Row[]>(() => {
    if (events) return [...events].map((e) => ({ ...e, external: !!e.external, badge: e.badge ?? null, committee: e.committee ?? null, action: e.action ?? "calendar" })).sort((a, b) => stamp(a).localeCompare(stamp(b)))
    const all = data?.rows ?? []
    const rows = committee ? all.filter((h) => (h.committee ?? h.description).toLowerCase().includes(committee.toLowerCase())) : all
    return [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b))).map(rowOf)
  }, [data, committee, events])
  const days = React.useMemo(() => [...new Set(hearings.map((h) => h.date))].sort(), [hearings])
  const initial = React.useMemo(() => {
    const today = key(new Date())
    return days.find((d) => d >= today) ?? days[days.length - 1]
  }, [days])
  // The lazy initialiser ran once, on the fixture, so when the jurisdiction's
  // own hearings arrived the grid stayed on the month it opened with — Texas
  // showed an empty September 2026 while its rows ran through 2025-09-03.
  // Follow `initial` until the reader picks a day of their own.
  // With the rows handed in, the day is known on the server, so the first
  // paint already shows the right rows.
  const [date, setDate] = React.useState<Date | undefined>(() => (events && initial ? parse(initial) : undefined))
  const [picked, setPicked] = React.useState(false)
  React.useEffect(() => {
    if (picked) return
    setDate(initial ? parse(initial) : new Date())
  }, [initial, picked])
  const [open, setOpen] = React.useState(false)
  const from = date ? key(date) : ""
  const upcoming = hearings.filter((h) => h.date >= from)
  const shown = open ? upcoming : upcoming.slice(0, 2)
  const marked = React.useMemo(() => days.map(parse), [days])
  const through = events ? null : (data?.through ?? null)

  const Frame = bare
    ? React.Fragment
    : ({ children }: { children: React.ReactNode }) => (
        <CardFrame id="hearings" size={compact ? "sm" : "default"}>
          {children}
        </CardFrame>
      )

  return (
    <Frame>
      <CardContent className={cn("flex flex-col gap-4", bare && "px-0")}>
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setPicked(true)
            setDate(d)
            setOpen(false)
          }}
          month={date}
          onMonthChange={(m) => {
            setPicked(true)
            setDate(m)
          }}
          modifiers={{ hearing: marked }}
          modifiersClassNames={{ hearing: "[&>button]:font-semibold [&>button]:underline [&>button]:decoration-primary [&>button]:decoration-2 [&>button]:underline-offset-4" }}
          className={cn("w-full rounded-2xl border", compact ? "p-2 [--cell-size:--spacing(6.5)]" : "p-3 [--cell-size:--spacing(10)]")}
        />
        {through && <p className="-mt-1 text-xs text-muted-foreground">Most recent sitting · through {fmtDate(through, false)}</p>}
        <ItemGroup className={cn(open && "max-h-80 overflow-y-auto")}>
          {shown.map((row, index) => (
            // The whole row is a link, so the calendar button cannot live
            // inside it — a button nested in an anchor is invalid and the
            // parser breaks hydration over it. It sits alongside instead, over
            // the badge's place, appearing on hover and always where there is
            // no hover to have.
            <div key={`${row.id}-${index}`} className="group/row relative">
              <Item variant="muted" size={compact ? "sm" : "default"} render={row.external ? <a href={row.href} target="_blank" rel="noopener noreferrer" className="no-underline" /> : <Link href={row.href} className="no-underline" />}>
                <ItemContent className="min-w-0">
                  <ItemTitle className="block w-full min-w-0 truncate">{truncate(row.description, 40)}</ItemTitle>
                  <ItemDescription>
                    {fmtDate(row.date)}
                    {row.time ? ` · ${fmtTime(row.time)}` : ""}
                  </ItemDescription>
                </ItemContent>
                {row.badge && !compact && (
                  <Badge variant="secondary" className="transition-opacity group-hover/row:opacity-0">
                    {row.badge}
                  </Badge>
                )}
              </Item>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100">
                {row.action === "open" ? (
                  // A meeting already held cannot be added to a calendar; the
                  // hover opens its record instead (Brendan, 2026-09-06:
                  // "make these for upcoming and the others").
                  <Button variant="secondary" size="icon" className="pointer-events-auto size-8 rounded-lg bg-background shadow-xs" aria-label="Open the record" render={<Link href={row.href} />}>
                    <ArrowUpRightIcon />
                  </Button>
                ) : (
                  <AddToCalendar
                    className="pointer-events-auto bg-background shadow-xs"
                    label=""
                    summary={`${row.description}${row.badge ? ` · ${row.badge}` : ""}`}
                    description={row.committee ? `Committee: ${row.committee}` : undefined}
                    when={hearingWhen(row.date, row.time, state)}
                    url={row.external ? undefined : row.href}
                  />
                )}
              </div>
            </div>
          ))}
          {!upcoming.length && <p className="py-3 text-center text-sm text-muted-foreground">Nothing calendared from {date ? fmtDate(from, false) : "today"}.</p>}
        </ItemGroup>
        {/* The expand chevron at the left; the circle arrow into the calendar
            at the right, as every card's foot has it (Brendan, 2026-09-07). */}
        <div className="flex items-center justify-between gap-2">
          {upcoming.length > 2 ? (
            <Button variant="secondary" size="icon" className="rounded-full" aria-expanded={open} aria-label={open ? "Show fewer hearings" : `Show all ${upcoming.length} hearings`} onClick={() => setOpen((v) => !v)}>
              {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </Button>
          ) : (
            <span />
          )}
          {!bare && (
            <Button variant="outline" size="icon" aria-label="The calendar" title="The calendar" className="group/foot shrink-0 rounded-full" nativeButton={false} render={<Link href="/calendar" />}>
              <ArrowRightIcon className="transition-transform duration-200 group-hover/foot:-rotate-45" />
            </Button>
          )}
        </div>
      </CardContent>
    </Frame>
  )
}
