"use client"

import * as React from "react"

import { toCalendarDate, toDate } from "@/lib/calendar/dates"
import { Calendar } from "@govblock/ui/components/nova/calendar"

import { useCalendar } from "./calendar-provider"

export function MiniCalendar() {
  const { date, pathFor, navigate } = useCalendar()

  const selected = React.useMemo(() => toDate(date), [date])
  const [month, setMonth] = React.useState<Date>(selected)

  // The route leads; paging with the arrows only moves the displayed month.
  React.useEffect(() => {
    setMonth(selected)
  }, [selected])

  return (
    <Calendar
      mode="single"
      weekStartsOn={1}
      showOutsideDays
      selected={selected}
      month={month}
      onMonthChange={setMonth}
      onSelect={(day) => day && navigate(pathFor(toCalendarDate(day)))}
      className="w-full bg-transparent p-0 [--cell-size:--spacing(7.5)]"
      classNames={{
        month_caption:
          "flex h-7 w-full items-center justify-center px-7 text-sm font-medium",
        // flex-1 with it (Brendan, 2026-09-11): the override replaces the wrapper's class, and without it the seven names ran together at the left.
        weekday: "flex-1 text-[0.7rem] font-semibold text-muted-foreground",
        outside: "text-muted-foreground/60",
      }}
    />
  )
}
