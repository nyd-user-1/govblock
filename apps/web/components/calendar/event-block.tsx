"use client"

import * as React from "react"
import { addMinutes } from "date-fns"

import {
  calendarDotClasses,
  eventBlockClasses,
  eventOutlineClasses,
} from "@/lib/calendar/calendars"
import { formatTime, toLocalISO } from "@/lib/calendar/dates"
import {
  eventBlockStyle,
  MIN_EVENT_MINUTES,
  PX_PER_MINUTE,
  SNAP_MINUTES,
  type PositionedEvent,
} from "@/lib/calendar/layout"
import { cn } from "@govblock/ui/lib/utils"

import { useCalendarEvents } from "./calendar-provider"
import { EventPopover } from "./event-popover"
import { useEventDrag } from "./use-event-drag"

// A timed event in the week / day grid.
export function EventBlock({
  positioned,
  anchored = true,
}: {
  positioned: PositionedEvent
  anchored?: boolean
}) {
  const { calendars, updateEvent } = useCalendarEvents()

  const event = positioned.event
  const color =
    calendars.find((calendar) => calendar.id === event.calendarId)?.color ??
    "blue"

  const {
    dragging,
    suppressed,
    mode,
    deltaMinutes,
    deltaX,
    onPointerdown,
    onPointermove,
    onPointerup,
    onPointercancel,
  } = useEventDrag(event, {
    onCommit(start, end) {
      updateEvent({ ...event, start: toLocalISO(start), end: toLocalISO(end) })
    },
  })

  const height =
    dragging && mode === "resize"
      ? Math.max(
          positioned.height + deltaMinutes * PX_PER_MINUTE,
          MIN_EVENT_MINUTES * PX_PER_MINUTE
        )
      : positioned.height

  const style: React.CSSProperties = {
    ...eventBlockStyle(positioned, height),
    transform:
      dragging && mode === "move"
        ? `translate(${deltaX}px, ${deltaMinutes * PX_PER_MINUTE}px)`
        : undefined,
  }

  // While dragging, show the previewed times instead of the stored ones.
  const shift = dragging && mode === "move" ? deltaMinutes : 0
  const start = addMinutes(new Date(event.start), shift)
  const end = addMinutes(
    new Date(event.end),
    dragging ? (mode === "resize" ? deltaMinutes : shift) : 0
  )
  const previewTimes = `${formatTime(start)} – ${formatTime(
    end > start ? end : addMinutes(start, SNAP_MINUTES)
  )}`

  const compact = positioned.height < 40

  return (
    <EventPopover event={event} disabled={suppressed} anchored={anchored}>
      {() => (
        <button
          type="button"
          data-event=""
          aria-label={`${event.title}, ${previewTimes}`}
          className={cn(
            "absolute flex touch-none flex-col items-start overflow-hidden rounded-xs px-3 py-1 text-start text-xs transition-colors select-none focus-visible:outline-3",
            eventBlockClasses[color],
            eventOutlineClasses[color],
            dragging ? "z-20" : "z-5"
          )}
          style={style}
          onClick={(click) => click.stopPropagation()}
          onPointerDown={onPointerdown}
          onPointerMove={onPointermove}
          onPointerUp={onPointerup}
          onPointerCancel={onPointercancel}
        >
          <span
            className={cn(
              "absolute inset-y-1 inset-s-1 w-1 rounded-full",
              calendarDotClasses[color]
            )}
          />

          <span className="w-full truncate font-medium">{event.title}</span>
          {(!compact || dragging) && (
            <span className="w-full truncate tabular-nums opacity-80">
              {previewTimes}
            </span>
          )}

          <span
            data-resize-handle=""
            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
          />
        </button>
      )}
    </EventPopover>
  )
}
