"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtBill, fmtDate, fmtTime } from "@/lib/format"
import { hearingWhen } from "@/lib/policy/hearing-when"
import { AddToCalendar } from "@/components/connectors/add-to-calendar"
import { CardFrame } from "@/components/card-frame"
import { cn } from "@govblock/ui/lib/utils"
import { Badge } from "@govblock/ui/components/badge"
import { Button } from "@govblock/ui/components/button"
import { Calendar } from "@govblock/ui/components/calendar"
import { CardContent } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@govblock/ui/components/item"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { ShowMore } from "@govblock/ui/components/interior/show-more"

// Calendar — the month grid, then the hearings from the picked day onward,
// nearest first. A row names the committee sitting and the topic it sits on
// (Brendan, 2026-09-07). Days with a hearing are marked; it opens on the next
// day that has any. Given a `committee`, the widget narrows to that
// committee's hearings.
//
// Two rules from 2026-09-11 (Brendan). The widget is never wider than about
// 300px — stretched across a rail it was ridiculous. And the sittings sit
// behind interior.dev's show-more: one row showing, "More sittings" opens a
// window about four rows tall that scrolls through the rest, with its own
// scrollbar. The full-viewport overlay the chevron used to open is kept below
// for the day it is wanted again; nothing opens it now.

// How many rows the list holds: enough to scroll through a season in the
// card, a year in the full view, without building thousands of nodes for a
// reader who will read ten.
const ROWS_IN_CARD = 24
const ROWS_EXPANDED = 200

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
const rowOf = (h: Hearing & { href?: string | null; type?: string | null }, state: string): Row => ({
  id: `${h.href ?? h.bill_id}-${h.date}-${h.time ?? ""}`,
  date: h.date,
  time: h.time,
  description: h.description,
  href: h.href ?? `/bills/${h.bill_id}`,
  external: false,
  badge: h.bill_number ? fmtBill(h.bill_number, state) : (h.type ?? null),
  committee: h.committee ?? null,
  action: h.date < key(new Date()) ? "open" : "calendar",
})

/**
 * A record that shouts its own kind and names nothing else — the congress.gov
 * rows whose whole description is `HEARING` — is not a title in capitals; it
 * is the kind of meeting, written the way a title is written.
 */
const spoken = (value: string) => {
  const text = value.trim()
  return /^[A-Z][A-Z ]{2,23}$/.test(text) ? text.charAt(0) + text.slice(1).toLowerCase() : text
}

/** The same word twice — a meeting whose topic is only its own committee's name — is one line, not two. */
const sameThing = (a: string, b: string) => a.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ") === b.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ")

/**
 * One sitting: the committee that sits, the topic it sits on beneath, then the
 * day and the hour (Brendan, 2026-09-07 — the rows used to carry a truncated
 * description and nothing else). Where the record names no committee — a bill
 * on a calendar, a meeting handed in by a page — the description is the title
 * and stands alone.
 */
function HearingRow({ row, compact, state }: { row: Row; compact: boolean; state: string }) {
  const title = spoken(row.committee ?? row.description)
  const topic = row.committee && !sameThing(row.committee, row.description) ? spoken(row.description) : null
  return (
    // The whole row is a link, so the calendar button cannot live inside it —
    // a button nested in an anchor is invalid and the parser breaks hydration
    // over it. It sits alongside instead, over the badge's place, appearing on
    // hover and always where there is no hover to have.
    <div className="group/row relative">
      <Item variant="muted" size={compact ? "sm" : "default"} render={row.external ? <a href={row.href} target="_blank" rel="noopener noreferrer" className="no-underline" /> : <Link href={row.href} className="no-underline" />}>
        <ItemContent className={cn("min-w-0", !compact && "pr-9")}>
          <ItemTitle className="line-clamp-2 block w-full min-w-0">{title}</ItemTitle>
          {topic && <ItemDescription className="line-clamp-2 text-foreground/80">{topic}</ItemDescription>}
          <ItemDescription className="line-clamp-1">
            {fmtDate(row.date)}
            {row.time ? ` · ${fmtTime(row.time)}` : ""}
          </ItemDescription>
        </ItemContent>
        {row.badge && !compact && (
          <Badge variant="secondary" className="shrink-0 self-start transition-opacity group-hover/row:opacity-0">
            {row.badge}
          </Badge>
        )}
      </Item>
      {/* In the rail there is no width to spare and the button sat over the
          words (Brendan, 2026-09-07); the row is a link either way. */}
      <div className={cn("pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100", compact && "hidden")}>
        {row.action === "open" ? (
          // A meeting already held cannot be added to a calendar; the hover
          // opens its record instead (Brendan, 2026-09-06: "make these for
          // upcoming and the others").
          <Button variant="secondary" size="icon" className="pointer-events-auto size-8 rounded-lg bg-background shadow-xs" aria-label="Open the record" render={<Link href={row.href} />}>
            <ArrowUpRightIcon />
          </Button>
        ) : (
          <AddToCalendar
            className="pointer-events-auto bg-background shadow-xs"
            label=""
            summary={`${title}${topic ? ` · ${topic}` : ""}`}
            description={row.committee ? `Committee: ${row.committee}` : undefined}
            when={hearingWhen(row.date, row.time, state)}
            url={row.external ? undefined : row.href}
          />
        )}
      </div>
    </div>
  )
}

/** The rows, in a group that scrolls: the card holds three and the rest is a scroll away. */
function HearingRows({ rows, compact, state, className, empty }: { rows: Row[]; compact: boolean; state: string; className?: string; empty: React.ReactNode }) {
  return (
    <ItemGroup className={className}>
      {rows.map((row, index) => (
        <HearingRow key={`${row.id}-${index}`} row={row} compact={compact} state={state} />
      ))}
      {!rows.length && empty}
    </ItemGroup>
  )
}

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
    return [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b))).map((h) => rowOf(h, state))
  }, [data, committee, events, state])
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
  const [expanded, setExpanded] = React.useState(false)
  const from = date ? key(date) : ""
  const upcoming = hearings.filter((h) => h.date >= from)
  const marked = React.useMemo(() => days.map(parse), [days])
  const through = events ? null : (data?.through ?? null)

  const Frame = bare
    ? React.Fragment
    : ({ children }: { children: React.ReactNode }) => (
        <CardFrame id="hearings" size={compact ? "sm" : "default"} className="w-full max-w-[300px]">
          {children}
        </CardFrame>
      )

  // One month grid, drawn twice over: small in the rail's card, full size when
  // the calendar is thrown open over the page.
  const monthGrid = (big: boolean) => (
    <Calendar
      mode="single"
      selected={date}
      onSelect={(d) => {
        setPicked(true)
        setDate(d)
      }}
      month={date}
      onMonthChange={(m) => {
        setPicked(true)
        setDate(m)
      }}
      modifiers={{ hearing: marked }}
      modifiersClassNames={{ hearing: "[&>button]:font-semibold [&>button]:underline [&>button]:decoration-primary [&>button]:decoration-2 [&>button]:underline-offset-4" }}
      className={cn("w-full rounded-2xl border", !big && compact ? "p-2 [--cell-size:--spacing(6.5)]" : "p-3 [--cell-size:--spacing(10)]")}
    />
  )
  const nothing = <p className="py-3 text-center text-sm text-muted-foreground">Nothing calendared from {date ? fmtDate(from, false) : "today"}.</p>
  const sittings = `${upcoming.length} ${upcoming.length === 1 ? "sitting" : "sittings"}`

  return (
    <Frame>
      <CardContent className={cn("flex flex-col gap-4", bare && "px-0")}>
        <div>
          {monthGrid(false)}
          {through && <p className="mt-2 text-xs text-muted-foreground">Most recent sitting · through {fmtDate(through, false)}</p>}
        </div>
        {/* One row in view; More sittings opens a window about four rows tall that scrolls through the rest. */}
        <ShowMore lines={4} maxHeight={320} moreLabel="More sittings" lessLabel="Fewer sittings" label="Sittings" className="text-foreground">
          <HearingRows rows={upcoming.slice(0, ROWS_IN_CARD)} compact={compact} state={state} empty={nothing} />
        </ShowMore>
        {/* The circle arrow goes to the calendar page, as every card's foot has it (Brendan, 2026-09-07). */}
        {!bare && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="icon" aria-label="The calendar" title="The calendar" className="group/foot shrink-0 rounded-full" nativeButton={false} render={<Link href="/calendar" />}>
              <ArrowRightIcon className="transition-transform duration-200 group-hover/foot:-rotate-45" />
            </Button>
          </div>
        )}
      </CardContent>
      {/* The whole viewport: the month at its full size, the sittings beside
          it, both scrolling on their own. Kept for the day a widget opens into
          a larger view again (Brendan, 2026-09-11); nothing sets `expanded`
          now, so it never shows. */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="fixed inset-0 top-0 left-0 flex h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-4 rounded-none bg-background p-4 sm:max-w-none md:p-6">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle className="text-lg">{committee ?? "Calendar"}</DialogTitle>
            <DialogDescription>
              {upcoming.length ? `${sittings} from ${fmtDate(from, false)}, nearest first.` : `Nothing calendared from ${date ? fmtDate(from, false) : "today"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-y-auto">
              {monthGrid(true)}
              {through && <p className="mt-2 text-xs text-muted-foreground">Most recent sitting · through {fmtDate(through, false)}</p>}
            </div>
            <HearingRows rows={upcoming.slice(0, ROWS_EXPANDED)} compact={false} state={state} className="min-h-0 overflow-y-auto overscroll-contain pr-1" empty={nothing} />
          </div>
        </DialogContent>
      </Dialog>
    </Frame>
  )
}
