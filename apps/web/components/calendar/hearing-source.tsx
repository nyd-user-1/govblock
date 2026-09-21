"use client"

import * as React from "react"
import type { CalendarDate } from "@internationalized/date"
import { useParams } from "next/navigation"

import { parseCalendarDate, toDate, todayDate } from "@/lib/calendar/dates"
import { chamberCalendars, hearingsToEvents, isHearingEvent, WORKSPACE_CALENDARS } from "@/lib/calendar/hearings"
import type { CalendarEvent } from "@/lib/calendar/types"
import { capitolZone } from "@/lib/policy/hearing-when"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { Hearing } from "@/lib/policy/types"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"
import { AddToCalendar } from "@/components/connectors/add-to-calendar"

import type { EventSource } from "./calendar-provider"

// /calendar's events: the jurisdiction's committee hearings from the policy
// database, read-only, and the reader's own events, kept in this browser.

const MINE_KEY = "livingston:calendar-events"

// The hearings are fetched a window at a time around the visible date, so
// paging through months never asks for the whole session at once.
function fetchWindow(date: CalendarDate) {
  const anchor = toDate(date)
  const from = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)
  const to = new Date(anchor.getFullYear(), anchor.getMonth() + 2, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  return { from: iso(from), to: iso(to) }
}

export function useHearingSource(at?: CalendarDate, options?: { /** The workspace's five calendars in place of the chambers'. */ workspace?: boolean }): EventSource {
  const params = useParams<{ view?: string; date?: string }>()
  const workspace = options?.workspace === true
  // The provider hands over the date in view; the route's is the fallback.
  const atKey = at?.toString()
  const date = React.useMemo(
    () => (atKey && parseCalendarDate(atKey)) || (params.date && parseCalendarDate(params.date)) || todayDate(),
    [atKey, params.date]
  )
  // The calendar used to keep its own jurisdiction in localStorage. It reads
  // the shared scope now, so the header's switcher moves it and its own
  // Jurisdiction select (which stays) writes the same place.
  const { state, setState, session, isDefaultSession } = useJurisdiction()
  const span = React.useMemo(() => fetchWindow(date), [date])
  const { data: hearings, isLoading } = usePolicy<Hearing[]>(
    "hearings",
    isDefaultSession ? { state } : { state, session: String(session) },
    { from: span.from, to: span.to, limit: 6000 }
  )

  const [mine, setMine] = useLocal<Record<string, CalendarEvent>>(MINE_KEY, {})
  const [fetched, setFetched] = React.useState<Record<string, CalendarEvent>>(
    {}
  )

  React.useEffect(() => {
    if (!hearings) return
    setFetched((current) => {
      const next = { ...current }
      for (const event of hearingsToEvents(hearings, { workspace })) {
        next[event.id] = event
      }
      return next
    })
  }, [hearings, workspace])

  // A new jurisdiction starts from an empty calendar.
  React.useEffect(() => {
    setFetched({})
  }, [state])

  const store = React.useMemo(() => ({ ...fetched, ...mine }), [fetched, mine])
  const calendars = React.useMemo(() => (workspace ? WORKSPACE_CALENDARS : chamberCalendars(state)), [state, workspace])

  const add = React.useCallback(
    (event: CalendarEvent) => {
      setMine((current) => ({
        ...current,
        [event.id]: { ...event, calendarId: "mine" },
      }))
    },
    [setMine]
  )

  // Hearings are the legislature's schedule, not yours: they do not move.
  const update = React.useCallback(
    (event: CalendarEvent) => {
      if (isHearingEvent(event.id)) return
      setMine((current) =>
        current[event.id] ? { ...current, [event.id]: event } : current
      )
    },
    [setMine]
  )

  const remove = React.useCallback(
    (id: string) => {
      if (isHearingEvent(id)) return
      setMine((current) => {
        const { [id]: _removed, ...rest } = current
        return rest
      })
    },
    [setMine]
  )

  // A hearing is the legislature's schedule, not the reader's: it cannot be
  // moved or deleted here, and the one useful thing to do with it is take a
  // copy to a calendar that is theirs. The event's own times go across,
  // including the capitol's timezone, because these are wall-clock times with
  // no zone of their own.
  const details = React.useCallback(
    (event: CalendarEvent) =>
      isHearingEvent(event.id) ? (
        <div className="mt-1 border-t pt-1">
          <AddToCalendar
            className="w-full justify-start"
            summary={event.title}
            description={event.description}
            when={
              event.allDay
                ? {
                    start: event.start.slice(0, 10),
                    end: event.end.slice(0, 10),
                    allDay: true,
                  }
                : {
                    start: event.start,
                    end: event.end,
                    timeZone: capitolZone(state),
                    allDay: false,
                  }
            }
            url="/calendar"
          />
        </div>
      ) : null,
    [state]
  )

  return {
    defaultTitle: "New Event",
    calendars,
    store,
    loading: isLoading && Object.keys(fetched).length === 0,
    add,
    update,
    remove,
    details,
    state,
    setState,
  }
}


// /workspace/calendar's events (Brendan, 2026-09-21): the hearings above under
// the workspace's five calendars, and beside the jurisdiction in scope the
// ones the rail's + has added, each read a window at a time like the first.
// Three more at most: hooks are counted, and the scope a reader is entitled to
// is Congress and a home state before a plan adds a third.
const ADDED_KEY = "govblock:calendar-jurisdictions"
export const MAX_ADDED = 3

export function useWorkspaceSource(at?: CalendarDate): EventSource {
  const base = useHearingSource(at, { workspace: true })
  const [stored, setStored] = useLocal<string[]>(ADDED_KEY, [])
  const added = React.useMemo(() => stored.filter((code) => code !== base.state).slice(0, MAX_ADDED), [stored, base.state])
  const atKey = at?.toString()
  const span = React.useMemo(() => fetchWindow((atKey && parseCalendarDate(atKey)) || todayDate()), [atKey])
  const window_ = { from: span.from, to: span.to, limit: 6000 }
  const first = usePolicy<Hearing[]>(added[0] ? "hearings" : null, { state: added[0] ?? "" }, window_)
  const second = usePolicy<Hearing[]>(added[1] ? "hearings" : null, { state: added[1] ?? "" }, window_)
  const third = usePolicy<Hearing[]>(added[2] ? "hearings" : null, { state: added[2] ?? "" }, window_)

  const [extra, setExtra] = React.useState<Record<string, CalendarEvent>>({})
  React.useEffect(() => {
    setExtra((current) => {
      // A jurisdiction taken off the list takes its events with it.
      const next = Object.fromEntries(Object.entries(current).filter(([, event]) => event.within?.some((id) => id.startsWith("j:") && added.includes(id.slice(2)))))
      ;[first.data, second.data, third.data].forEach((rows, i) => {
        const code = added[i]
        if (!code || !Array.isArray(rows)) return
        for (const event of hearingsToEvents(rows, { workspace: true, added: code })) next[event.id] = event
      })
      return next
    })
  }, [added, first.data, second.data, third.data])

  const store = React.useMemo(() => ({ ...extra, ...base.store }), [extra, base.store])
  const addJurisdiction = React.useCallback((code: string) => setStored((current) => (current.includes(code) ? current : [...current, code].slice(-MAX_ADDED))), [setStored])
  const removeJurisdiction = React.useCallback((code: string) => setStored((current) => current.filter((c) => c !== code)), [setStored])
  return { ...base, store, added, addJurisdiction, removeJurisdiction }
}

// /calendar's events (Brendan, 2026-09-21): the same calendar as a showpiece,
// the legislature's schedule and nothing of the reader's — no events of their
// own, and none to add. The provider it feeds is read-only.
export function usePublicSource(at?: CalendarDate): EventSource {
  const source = useWorkspaceSource(at)
  const store = React.useMemo(() => Object.fromEntries(Object.entries(source.store).filter(([id]) => isHearingEvent(id))), [source.store])
  return { ...source, store }
}
