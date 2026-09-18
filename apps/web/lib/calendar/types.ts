import type { PostStatus, PostTarget } from "@/lib/linkedin/types"

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
  /** A LinkedIn post on /posts: the calendar entry is when it goes out. */
  post?: PostFields
}

export interface PostFields {
  /** The post's own label, empty when the chip shows the opening of its text. */
  title: string
  target: PostTarget
  status: PostStatus
  error: string | null
  urls: string[]
}

export interface EventDraft {
  start: Date
  end: Date
  allDay: boolean
  title: string
  calendarId: string
  description: string
  target?: PostTarget
}

// Where a gesture started, and what it should draw there. The month grid has
// no time axis, so a double click on it falls back to a fixed hour while its
// drag draws the same all-day span the week view's top row does.
export interface GridTarget {
  kind: "timed" | "allDay" | "month"
  day: Date
}
