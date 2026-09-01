"use client"

import * as React from "react"
import Link from "next/link"

import * as F from "@/lib/fixtures"
import { fmtDate, fmtTime, truncate } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { SubjectPicker } from "@/components/subject-picker"
import { cn } from "@govblock/ui/lib/utils"
import { Badge } from "@govblock/ui/components/badge"
import { Button } from "@govblock/ui/components/button"
import { Calendar } from "@govblock/ui/components/calendar"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@govblock/ui/components/item"

// Calendar — the month, then what the committees have on it. Days with a
// hearing are marked; picking one lists its hearings. Opens on the next day
// that has any. `compact` is the docs-rail size.

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function CalendarCard({ compact = false }: { compact?: boolean }) {
  const byDay = React.useMemo(() => {
    const map = new Map<string, typeof F.hearings>()
    for (const h of F.hearings) map.set(h.date, [...(map.get(h.date) ?? []), h])
    return map
  }, [])
  const days = React.useMemo(() => [...byDay.keys()].sort(), [byDay])
  const initial = React.useMemo(() => {
    const today = key(new Date())
    return days.find((d) => d >= today) ?? days[days.length - 1]
  }, [days])
  const [date, setDate] = React.useState<Date | undefined>(() => (initial ? parse(initial) : new Date()))
  const selected = date ? byDay.get(key(date)) ?? [] : []
  const marked = React.useMemo(() => days.map(parse), [days])

  return (
    <CardFrame id="hearings" size={compact ? "sm" : "default"}>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
        <CardDescription>Select a date to view scheduled hearings.</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          defaultMonth={date}
          modifiers={{ hearing: marked }}
          modifiersClassNames={{ hearing: "[&>button]:font-semibold [&>button]:underline [&>button]:decoration-primary [&>button]:decoration-2 [&>button]:underline-offset-4" }}
          className={cn("w-full rounded-2xl border", compact ? "p-2 [--cell-size:--spacing(6.5)]" : "p-3 [--cell-size:--spacing(10)]")}
        />
        <ItemGroup>
          {selected.slice(0, compact ? 3 : 3).map((row, index) => (
            <Item key={`${row.bill_id}-${index}`} variant="muted" size={compact ? "sm" : "default"} render={<Link href={`/docs/bills/${row.bill_id}`} className="no-underline" />}>
              <ItemContent className="min-w-0">
                <ItemTitle className="block w-full min-w-0 truncate">{truncate(row.description, compact ? 40 : 30)}</ItemTitle>
                <ItemDescription>
                  {fmtDate(row.date)}
                  {row.time ? ` · ${fmtTime(row.time)}` : ""}
                </ItemDescription>
              </ItemContent>
              {row.bill_number && <Badge variant="secondary">{row.bill_number}</Badge>}
            </Item>
          ))}
          {date && !selected.length && <p className="py-3 text-center text-sm text-muted-foreground">No hearings on {fmtDate(key(date), false)}.</p>}
          {selected.length > 3 && <p className="text-xs text-muted-foreground">…and {selected.length - 3} more that day</p>}
        </ItemGroup>
      </CardContent>
      <CardFooter className={cn("justify-between gap-2", compact && "flex-wrap")}>
        <SubjectPicker label="Committee" allLabel="All committees" items={F.committees.map((c) => c.label)} />
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/calendar" />}>
          Calendar
        </Button>
      </CardFooter>
    </CardFrame>
  )
}
