"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtDate, fmtTime, truncate } from "@/lib/format"
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

export function CalendarCard({ compact = false, committee }: { compact?: boolean; committee?: string }) {
  const { data } = useScoped<{ rows: Hearing[]; through: string | null }>("hearings-recent", {
    rows: F.hearings,
    through: null,
  })

  const hearings = React.useMemo(() => {
    const all = data?.rows ?? []
    const rows = committee ? all.filter((h) => (h.committee ?? h.description).toLowerCase().includes(committee.toLowerCase())) : all
    return [...rows].sort((a, b) => stamp(a).localeCompare(stamp(b)))
  }, [data, committee])
  const days = React.useMemo(() => [...new Set(hearings.map((h) => h.date))].sort(), [hearings])
  const initial = React.useMemo(() => {
    const today = key(new Date())
    return days.find((d) => d >= today) ?? days[days.length - 1]
  }, [days])
  const [date, setDate] = React.useState<Date | undefined>(() => (initial ? parse(initial) : new Date()))
  const [open, setOpen] = React.useState(false)
  const from = date ? key(date) : ""
  const upcoming = hearings.filter((h) => h.date >= from)
  const shown = open ? upcoming : upcoming.slice(0, 2)
  const marked = React.useMemo(() => days.map(parse), [days])

  return (
    <CardFrame id="hearings" size={compact ? "sm" : "default"}>
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d)
            setOpen(false)
          }}
          defaultMonth={date}
          modifiers={{ hearing: marked }}
          modifiersClassNames={{ hearing: "[&>button]:font-semibold [&>button]:underline [&>button]:decoration-primary [&>button]:decoration-2 [&>button]:underline-offset-4" }}
          className={cn("w-full rounded-2xl border", compact ? "p-2 [--cell-size:--spacing(6.5)]" : "p-3 [--cell-size:--spacing(10)]")}
        />
        <ItemGroup className={cn(open && "max-h-80 overflow-y-auto")}>
          {shown.map((row, index) => (
            <Item key={`${row.bill_id}-${index}`} variant="muted" size={compact ? "sm" : "default"} render={<Link href={`/docs/bills/${row.bill_id}`} className="no-underline" />}>
              <ItemContent className="min-w-0">
                <ItemTitle className="block w-full min-w-0 truncate">{truncate(row.description, 40)}</ItemTitle>
                <ItemDescription>
                  {fmtDate(row.date)}
                  {row.time ? ` · ${fmtTime(row.time)}` : ""}
                </ItemDescription>
              </ItemContent>
              {row.bill_number && !compact && <Badge variant="secondary">{row.bill_number}</Badge>}
            </Item>
          ))}
          {!upcoming.length && <p className="py-3 text-center text-sm text-muted-foreground">Nothing calendared from {date ? fmtDate(from, false) : "today"}.</p>}
        </ItemGroup>
        {upcoming.length > 2 && (
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            aria-expanded={open}
            aria-label={open ? "Show fewer hearings" : `Show all ${upcoming.length} hearings`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </Button>
        )}
      </CardContent>
    </CardFrame>
  )
}
