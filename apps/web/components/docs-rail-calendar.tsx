"use client"

import * as React from "react"

import { Calendar } from "@govblock/ui/components/calendar"

// The month grid from the home page's Calendar card, in the docs rail.
export function DocsRailCalendar() {
  const [date, setDate] = React.useState<Date | undefined>(() => new Date())
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      defaultMonth={date}
      className="w-full rounded-2xl border p-3 [--cell-size:--spacing(7)]"
    />
  )
}
