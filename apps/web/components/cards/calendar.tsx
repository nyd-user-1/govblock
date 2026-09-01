"use client"

import * as React from "react"
import Link from "next/link"

import * as F from "@/lib/fixtures"
import { fmtDate, fmtTime, truncate } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { SubjectPicker } from "@/components/subject-picker"
import { Badge } from "@govblock/ui/components/badge"
import { Button } from "@govblock/ui/components/button"
import { Calendar } from "@govblock/ui/components/calendar"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@govblock/ui/components/item"

// Calendar — the month, then what the committees have on it. The month grid
// is shadcn's Upcoming Payments card; the rows underneath are the hearings.
export function CalendarCard() {
  const [date, setDate] = React.useState<Date | undefined>(new Date(2026, 7, 31))
  return (
    <CardFrame id="hearings">
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
          className="w-full rounded-2xl border p-3 [--cell-size:--spacing(10)]"
        />
        <ItemGroup>
          {F.hearings.slice(0, 3).map((row, index) => (
            <Item key={`${row.bill_id}-${index}`} variant="muted" render={<Link href={`/docs/bills/${row.bill_id}`} className="no-underline" />}>
              <ItemContent>
                <ItemTitle>{truncate(row.description, 30)}</ItemTitle>
                <ItemDescription>
                  {fmtDate(row.date)}
                  {row.time ? ` · ${fmtTime(row.time)}` : ""}
                </ItemDescription>
              </ItemContent>
              {row.bill_number && <Badge variant="secondary">{row.bill_number}</Badge>}
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <SubjectPicker label="Committee" allLabel="All committees" items={F.committees.map((c) => c.label)} />
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/calendar" />}>
          Calendar
        </Button>
      </CardFooter>
    </CardFrame>
  )
}
