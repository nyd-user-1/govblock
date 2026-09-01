"use client"

import * as React from "react"
import { isSameDay, isToday } from "date-fns"

import { isoDate } from "@/lib/calendar/dates"
import {
  DRAFT_EVENT_ID,
  eventBlockStyle,
  HOUR_HEIGHT,
  type PositionedEvent,
} from "@/lib/calendar/layout"
import type { CalendarEvent } from "@/lib/calendar/types"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

import { useEventDraft } from "./calendar-provider"
import { EventBlock } from "./event-block"
import { EventDraft } from "./event-draft"
import { NowIndicator } from "./now-indicator"

// Placeholder blocks shown while the seed loads, as [start hour, hours].
const SKELETONS = [
  [9, 1.5],
  [13, 1],
  [16, 2],
] as const

const HOURS = Array.from({ length: 23 }, (_, index) => index + 1)

export function DayColumn({
  day,
  events,
  first,
  loading,
}: {
  day: Date
  events: PositionedEvent[]
  // The leftmost column on screen, which is where a block arriving from a day
  // the grid does not show has to take its form.
  first?: boolean
  loading?: boolean
}) {
  const { onGridPointerdown, onGridDblclick } = useEventDraft()

  // A block running past midnight is drawn in both days, and the form goes to
  // the one holding its start so it does not open twice.
  function anchored(event: CalendarEvent): boolean {
    const start = new Date(event.start)

    return isSameDay(start, day) || (!!first && start < day)
  }

  return (
    <div
      data-day-column=""
      data-date={isoDate(day)}
      className="relative snap-start border-s border-border"
      style={{ height: `${24 * HOUR_HEIGHT}px` }}
      onPointerDown={(pointer) =>
        onGridPointerdown(pointer, { kind: "timed", day })
      }
      onDoubleClick={(click) => onGridDblclick(click, { kind: "timed", day })}
    >
      {HOURS.map((hour) => (
        <div
          key={hour}
          className="pointer-events-none absolute inset-x-0 snap-start border-t border-border"
          style={{ top: `${hour * HOUR_HEIGHT}px` }}
        />
      ))}

      {loading &&
        SKELETONS.map(([hour, hours]) => (
          <Skeleton
            key={hour}
            className="absolute inset-x-1 rounded-xs"
            style={{
              top: `${hour * HOUR_HEIGHT}px`,
              height: `${hours * HOUR_HEIGHT}px`,
            }}
          />
        ))}

      {events.map((positioned) =>
        positioned.event.id === DRAFT_EVENT_ID ? (
          <EventDraft
            key={positioned.event.id}
            variant="block"
            anchored
            style={eventBlockStyle(positioned)}
          />
        ) : (
          <EventBlock
            key={positioned.event.id}
            positioned={positioned}
            anchored={anchored(positioned.event)}
          />
        )
      )}

      {isToday(day) && <NowIndicator />}
    </div>
  )
}
