"use client"

import * as React from "react"

import type { CalendarView } from "@/lib/calendar/types"
import { useCalendar } from "@/components/calendar/calendar-provider"
import { MonthView } from "@/components/calendar/month-view"
import { WeekView } from "@/components/calendar/week-view"

// The one calendar (Brendan, 2026-09-21): /calendar's views — the month that
// scrolls without end, the week, the day, a double click to add an event —
// inside whatever frame a host gives them. /workspace/calendar is that host in
// the workspace's shell; the account home is another, in a section of the
// page. The host draws the month and the controls, in a header that stands
// still, so the month named there changes as the weeks scroll and never moves.
// Everything here reads the embedded CalendarProvider its host mounts.

const VIEWS: { label: string; value: CalendarView }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
]

/** The segmented control the workspace's headers use, as a prop-driven pair: the looks of a surface, or the views of the calendar. */
export function Segmented<T extends string>({ options, current, set, label }: { options: { label: string; value: T }[]; current: T; set: (next: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={current === option.value}
          aria-pressed={current === option.value}
          onClick={() => set(option.value)}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-xs"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Day, Week, Month: the views /calendar's own header offered. */
export function ViewToggle() {
  const { view, date, pathFor, navigate } = useCalendar()
  return <Segmented label="Calendar view" options={VIEWS} current={view} set={(next) => navigate(pathFor(date, next))} />
}

/** What the host's header names: the month in view, or the week's or the day's span. */
export function useCalendarTitle() {
  const { title } = useCalendar()
  return `${title.months} ${title.year}`
}

/** The views themselves, filling their container to its edges. */
export function CalendarPane() {
  const { view } = useCalendar()
  return <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{view === "month" ? <MonthView /> : <WeekView key={view} />}</div>
}
