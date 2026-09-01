import {
  CalendarDate,
  getLocalTimeZone,
  parseDate,
  Time,
  toCalendarDateTime,
  today,
} from "@internationalized/date"
import { addDays, lightFormat, startOfMonth, startOfWeek } from "date-fns"

import type { CalendarView, DateRange } from "./types"

// Events are stored as floating local datetimes, no timezone designator:
// `new Date()` parses them in the viewer's own timezone, so the 09:15
// stand-up is 09:15 for every visitor and all-day events keep their day
// wherever the server runs. Seconds are pinned to zero.
export function toLocalISO(date: Date): string {
  return lightFormat(date, "yyyy-MM-dd'T'HH:mm:00")
}

// How far the calendar reaches either side of the current week: the month
// view virtualizes this many week rows and the seed covers all of them.
export const WEEKS_AROUND = 260

export function toCalendarDate(date: Date): CalendarDate {
  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
}

export function toTime(date: Date): Time {
  return new Time(date.getHours(), date.getMinutes())
}

let localTimeZone: string | undefined

function timeZone(): string {
  return (localTimeZone ??= getLocalTimeZone())
}

export function toDate(date: CalendarDate): Date {
  return date.toDate(timeZone())
}

export function toDateTime(date: CalendarDate, time: Time): Date {
  return toCalendarDateTime(date, time).toDate(timeZone())
}

export function todayDate(): CalendarDate {
  return today(timeZone())
}

export function parseCalendarDate(value: string): CalendarDate | null {
  try {
    return parseDate(value)
  } catch {
    return null
  }
}

// Identifies the local calendar day an event falls on.
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

// The day a grid cell stands for, as the `data-date` a pointer gesture reads
// back off it.
export function isoDate(date: Date): string {
  return lightFormat(date, "yyyy-MM-dd")
}

let lastISO: string | undefined
let lastDate: Date | undefined

export function dateFromISO(iso: string): Date {
  if (iso !== lastISO) {
    lastISO = iso
    lastDate = toDate(parseDate(iso))
  }

  return lastDate!
}

// The day under a point, from whichever cell is topmost there.
export function dateAtPoint(x: number, y: number): Date | null {
  for (const element of document.elementsFromPoint(x, y)) {
    const iso = (element as HTMLElement).dataset?.date
    if (iso) {
      return dateFromISO(iso)
    }
  }

  return null
}

// Ranges are [start, end) so the end boundary is the first excluded instant.
export function weekRange(date: CalendarDate, days = 7): DateRange {
  const start =
    days === 7 ? startOfWeek(toDate(date), { weekStartsOn: 1 }) : toDate(date)

  return { start, end: addDays(start, days) }
}

// Always 6 rows of 7 days so the grid height never jumps between months.
export function monthRange(date: CalendarDate): DateRange {
  const start = startOfWeek(startOfMonth(toDate(date)), { weekStartsOn: 1 })

  return { start, end: addDays(start, 42) }
}

export const MONTH_FETCH_WEEKS = 12

export function monthFetchRange(date: CalendarDate): DateRange {
  const { start } = monthRange(date)

  return { start, end: addDays(start, MONTH_FETCH_WEEKS * 7) }
}

export function rangeFor(view: CalendarView, date: CalendarDate): DateRange {
  if (view === "month") {
    return monthFetchRange(date)
  }

  return weekRange(date, view === "day" ? 1 : 7)
}

export function eachDay({ start, end }: DateRange): Date[] {
  const days: Date[] = []
  for (let day = start; day < end; day = addDays(day, 1)) {
    days.push(day)
  }

  return days
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})
const dayFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
})
const fullDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
})
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short" })
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long" })
const shortMonthFormat = new Intl.DateTimeFormat("en-US", { month: "short" })
const shortMonthYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
})

export function formatTime(date: Date): string {
  return timeFormat.format(date)
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

export function formatDay(date: Date): string {
  return dayFormat.format(date)
}

export function formatFullDate(date: Date): string {
  return fullDateFormat.format(date)
}

export function formatWeekday(date: Date): string {
  return weekdayFormat.format(date)
}

export function formatMonth(date: Date): string {
  return monthFormat.format(date)
}

export function formatShortMonth(date: Date): string {
  return shortMonthFormat.format(date)
}

export interface RangeTitle {
  months: string
  year: string
}

export function formatRangeTitle({ start, end }: DateRange): RangeTitle {
  const last = addDays(end, -1)
  const year = String(last.getFullYear())

  if (start.getMonth() === last.getMonth()) {
    return { months: monthFormat.format(start), year }
  }

  const startMonth = (
    start.getFullYear() !== last.getFullYear()
      ? shortMonthYearFormat
      : shortMonthFormat
  ).format(start)
  const endMonth = shortMonthFormat.format(last)

  return { months: `${startMonth} – ${endMonth}`, year }
}
