"use client"

import * as React from "react"
import type { CalendarDate } from "@internationalized/date"
import { useParams } from "next/navigation"

import { parseCalendarDate, toDate, todayDate } from "@/lib/calendar/dates"
import { chamberCalendars, hearingsToEvents, isHearingEvent } from "@/lib/calendar/hearings"
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

export function useHearingSource(): EventSource {
  const params = useParams<{ view?: string; date?: string }>()
  const date = React.useMemo(
    () => (params.date && parseCalendarDate(params.date)) || todayDate(),
    [params.date]
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
      for (const event of hearingsToEvents(hearings)) {
        next[event.id] = event
      }
      return next
    })
  }, [hearings])

  // A new jurisdiction starts from an empty calendar.
  React.useEffect(() => {
    setFetched({})
  }, [state])

  const store = React.useMemo(() => ({ ...fetched, ...mine }), [fetched, mine])
  const calendars = React.useMemo(() => chamberCalendars(state), [state])

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
