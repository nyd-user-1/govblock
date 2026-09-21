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

// The workspace calendar's five (Brendan, 2026-09-07, his capture), in the
// colours its rail gives them (2026-09-21), plus the reader's own. They are
// filters, not folders: an event is filed under its chamber, whose colour it
// wears, and lists the kinds that claim it (lib/calendar/types.ts).
export const WORKSPACE_CALENDARS: Calendar[] = [
  { id: "house", name: "House", color: "blue" },
  { id: "senate", name: "Senate", color: "green" },
  { id: "committees", name: "Committees", color: "amber" },
  { id: "hearings", name: "Hearings", color: "red" },
  { id: "sessions", name: "Floor Sessions", color: "violet" },
  { id: "mine", name: "My Events", color: "violet" },
]

/**
 * The chamber holding the event. The committee's own name says it ("Senate
 * Energy and Natural Resources Hearing"); `body` is the chamber of the bill
 * on the agenda, and a Senate committee hears House bills — read first, it
 * gave those hearings the House's blue dot (Brendan, 2026-09-21).
 */
export function chamberOf(hearing: Hearing): "house" | "senate" | null {
  const named = (hearing.committee ?? hearing.description ?? "").trim().toLowerCase()
  const chamber = (hearing.chamber ?? (named.startsWith("senate") ? "senate" : /^(house|assembly)\b/.test(named) ? "house" : named.startsWith("joint") ? "joint" : hearing.body) ?? "").toLowerCase()
  return chamber === "senate" ? "senate" : chamber === "house" || chamber === "assembly" ? "house" : null
}

/** The kinds that claim an event: a committee's, a hearing, a floor session. */
export function workspaceClaims(hearing: Hearing): string[] {
  const type = hearing.type || "Hearing"
  return [...(hearing.committee ? ["committees"] : []), ...(type === "Session" ? ["sessions"] : ["hearings"])]
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
export function hearingsToEvents(
  rows: Hearing[],
  options?: {
    /** File each event under the workspace's five calendars, not the chambers'. */
    workspace?: boolean
    /** A jurisdiction added beside the one in scope: its events carry its code, in their id, their title and their claims (`j:TX`), so its row in the rail can hide them. */
    added?: string
  }
): CalendarEvent[] {
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
    // Congress's rows name the event already ("Senate Indian Affairs Hearing"); a bare committee name gets the word.
    const named = hearing.committee ? (/\b(committee|hearing|meeting|markup)\b/i.test(hearing.committee) ? hearing.committee : `${hearing.committee} Committee`) : hearing.description
    const title = `${options?.added ? `${options.added} · ` : ""}${named}`
    const description = `${bills.length} bill${bills.length === 1 ? "" : "s"}: ${bills.slice(0, 12).join(", ")}${bills.length > 12 ? ", …" : ""}${hearing.location ? `\n${hearing.location}` : ""}`
    const added = options?.added
    const id = added ? `h-${added.toLowerCase()}-${hearing.date}-${slug(hearing.description)}` : `h-${hearing.date}-${slug(hearing.description)}`
    const claims = options?.workspace ? workspaceClaims(hearing) : undefined
    const filed = claims ? { calendarId: chamberOf(hearing) ?? claims[0] ?? "hearings", claims, ...(added ? { within: [`j:${added}`] } : {}) } : { calendarId: calendarIdFor(hearing.chamber) }
    const timed =
      hearing.time && hearing.time !== "00:00"
        ? hearing.time.split(":").map(Number)
        : null

    if (timed && Number.isFinite(timed[0])) {
      const start = new Date(y, m - 1, d, timed[0] ?? 9, timed[1] ?? 0, 0, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      events.push({
        id,
        ...filed,
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
        ...filed,
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
