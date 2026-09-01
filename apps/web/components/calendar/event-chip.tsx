"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import {
  calendarDotClasses,
  eventBlockClasses,
  eventChipCompactClasses,
  eventOutlineClasses,
} from "@/lib/calendar/calendars"
import { formatTime } from "@/lib/calendar/dates"
import type { CalendarEvent } from "@/lib/calendar/types"
import { cn } from "@govblock/ui/lib/utils"

import { useCalendarEvents, useEventMove } from "./calendar-provider"
import { EventPopover } from "./event-popover"

// A pill in a month cell or the week view's all-day row.
export function EventChip({
  event,
  showTime,
  anchored = true,
  className,
  style,
}: {
  event: CalendarEvent
  showTime?: boolean
  anchored?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const { calendars } = useCalendarEvents()
  const { movingId, suppressed, onPointerdown } = useEventMove()

  const color =
    calendars.find((calendar) => calendar.id === event.calendarId)?.color ??
    "blue"

  // Held open or in flight, the chip wears the shade the pointer gives it.
  const moving = movingId === event.id

  return (
    <EventPopover event={event} disabled={suppressed} anchored={anchored}>
      {(open) => (
        <button
          type="button"
          data-event=""
          data-active={open || moving || undefined}
          aria-label={
            event.allDay
              ? event.title
              : `${event.title}, ${formatTime(new Date(event.start))}`
          }
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-0.5 text-start text-xs transition-colors select-none focus-visible:outline-3",
            eventOutlineClasses[color],
            event.allDay
              ? eventBlockClasses[color]
              : [
                  "text-foreground hover:bg-muted data-active:bg-muted",
                  eventChipCompactClasses[color],
                ],
            className
          )}
          style={style}
          onClick={(click) => click.stopPropagation()}
          onPointerDown={(pointer) => onPointerdown(pointer, event)}
        >
          {event.allDay ? (
            <span
              className={cn(
                "-mx-0.75 flex items-center justify-center rounded-full p-0.5",
                calendarDotClasses[color]
              )}
            >
              <CalendarIcon className="size-2.5 shrink-0 text-white" />
            </span>
          ) : (
            <span
              className={cn(
                "size-2 shrink-0 rounded-full max-lg:hidden",
                calendarDotClasses[color]
              )}
            />
          )}

          <span className="truncate font-medium">{event.title}</span>
          {showTime && !event.allDay && (
            <span
              data-time=""
              className="ms-auto shrink-0 text-[11px] text-muted-foreground tabular-nums"
            >
              {formatTime(new Date(event.start))}
            </span>
          )}
        </button>
      )}
    </EventPopover>
  )
}
