export type CalendarView = "day" | "week" | "month"

export interface DateRange {
  start: Date
  end: Date
}

// The template's info / success / warning tokens, as the Tailwind palettes
// this theme has.
export type CalendarColor = "blue" | "green" | "amber" | "red" | "violet"

export interface Calendar {
  id: string
  name: string
  color: CalendarColor
}

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  // Floating local datetimes, `YYYY-MM-DDTHH:mm:00`, no timezone designator.
  start: string
  end: string
  allDay?: boolean
  /**
   * The kinds of event that claim it, where a calendar is a filter rather than
   * a folder (the workspace's Committees, Hearings and Floor Sessions: a
   * committee's hearing is both of the first two). It shows while any of them
   * is on — on Congress's calendar every event is a committee's hearing, and
   * under "all of them" either box alone emptied the month (2026-09-21).
   * `calendarId` is the calendar that colours it, the chamber where it has one.
   */
  claims?: string[]
  /** Calendars it sits inside and is hidden with: a jurisdiction added beside the one in scope (`j:TX`). */
  within?: string[]
}

export interface EventDraft {
  start: Date
  end: Date
  allDay: boolean
  title: string
  calendarId: string
  description: string
}

// Where a gesture started, and what it should draw there. The month grid has
// no time axis, so a double click on it falls back to a fixed hour while its
// drag draws the same all-day span the week view's top row does.
export interface GridTarget {
  kind: "timed" | "allDay" | "month"
  day: Date
}
