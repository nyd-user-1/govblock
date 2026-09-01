import { toLocalISO } from "@/lib/calendar/dates"
import type { Calendar, CalendarEvent } from "@/lib/calendar/types"
import { lowerChamber } from "@/lib/filters"
import type { Hearing } from "@/lib/policy/types"

// The committee calendars of a jurisdiction, as the rail lists them, plus
// the user's own events.
export function chamberCalendars(state: string): Calendar[] {
  const lower = lowerChamber(state)
  return [
    { id: "senate", name: "Senate", color: "blue" },
    { id: "assembly", name: lower, color: "green" },
    { id: "joint", name: "Joint & Other", color: "amber" },
    { id: "mine", name: "My Events", color: "violet" },
  ]
}

export function calendarIdFor(chamber: string | null | undefined) {
  const value = (chamber ?? "").toLowerCase()
  if (value === "senate") return "senate"
  if (value === "assembly" || value === "house") return "assembly"
  return "joint"
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-")

// One event per committee per day: the bills before it are the description.
// A hearing without a time is an all-day event; with one, an hour.
export function hearingsToEvents(rows: Hearing[]): CalendarEvent[] {
  const groups = new Map<string, { hearing: Hearing; bills: string[] }>()
  for (const row of rows) {
    const key = `${row.date}|${row.description}`
    const group = groups.get(key)
    if (group) {
      group.bills.push(row.bill_number)
    } else {
      groups.set(key, { hearing: row, bills: [row.bill_number] })
    }
  }

  const events: CalendarEvent[] = []
  for (const { hearing, bills } of groups.values()) {
    const [y, m, d] = hearing.date.split("-").map(Number)
    if (!y || !m || !d) continue
    const title = hearing.committee
      ? `${hearing.committee} Committee`
      : hearing.description
    const description = `${bills.length} bill${bills.length === 1 ? "" : "s"}: ${bills.slice(0, 12).join(", ")}${bills.length > 12 ? ", …" : ""}${hearing.location ? `\n${hearing.location}` : ""}`
    const id = `h-${hearing.date}-${slug(hearing.description)}`
    const timed =
      hearing.time && hearing.time !== "00:00"
        ? hearing.time.split(":").map(Number)
        : null

    if (timed && Number.isFinite(timed[0])) {
      const start = new Date(y, m - 1, d, timed[0] ?? 9, timed[1] ?? 0, 0, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      events.push({
        id,
        calendarId: calendarIdFor(hearing.chamber),
        title,
        description,
        start: toLocalISO(start),
        end: toLocalISO(end),
      })
    } else {
      const start = new Date(y, m - 1, d, 0, 0, 0, 0)
      const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
      events.push({
        id,
        calendarId: calendarIdFor(hearing.chamber),
        title,
        description,
        start: toLocalISO(start),
        end: toLocalISO(end),
        allDay: true,
      })
    }
  }
  return events
}

export const isHearingEvent = (id: string) => id.startsWith("h-")
