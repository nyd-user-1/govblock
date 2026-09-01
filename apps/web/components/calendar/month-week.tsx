"use client"

import * as React from "react"
import Link from "next/link"
import { addDays, isSameDay, isToday } from "date-fns"

import { formatShortMonth, isoDate, toCalendarDate } from "@/lib/calendar/dates"
import {
  DRAFT_EVENT_ID,
  layoutAllDay,
  type AllDayPositionedEvent,
} from "@/lib/calendar/layout"
import type { CalendarEvent } from "@/lib/calendar/types"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@govblock/ui/components/nova/popover"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

import {
  useCalendar,
  useCalendarEvents,
  useEventDraft,
  useEventMove,
} from "./calendar-provider"
import { EventChip } from "./event-chip"
import { EventDraft } from "./event-draft"

// A week is one grid: the day numbers, then a fixed stack of slots each day
// fills on its own. All-day bars span columns and hold their lane across the
// days they cover, the other days keep those slots for their own events.
const SLOT_HEIGHT = 22
const MAX_SLOTS = 4
// Bars never take the last slot, so a day always has room for an event or
// the "+N more" button.
const MAX_LANES = MAX_SLOTS - 1

const gridStyle: React.CSSProperties = {
  gridTemplateRows: [
    "auto",
    ...Array.from({ length: MAX_LANES }, () => `${SLOT_HEIGHT}px`),
    `minmax(${SLOT_HEIGHT}px, 1fr)`,
  ].join(" "),
}

// Placeholder chips while the seed loads.
const SKELETONS: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [3, 0],
  [4, 0],
  [4, 1],
  [6, 0],
]

function label(day: Date): string {
  if (day.getDate() === 1) {
    return `${formatShortMonth(day)} 1`
  }

  return String(day.getDate())
}

export const MonthWeek = React.memo(function MonthWeek({
  weekStart,
  style,
}: {
  weekStart: Date
  style?: React.CSSProperties
}) {
  const { pathFor } = useCalendar()
  const { eventsForDay, eventsForDays, loading } = useCalendarEvents()
  const { draftEvent, onGridPointerdown, onGridDblclick } = useEventDraft()
  const { movingId, preview } = useEventMove()

  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  )
  const weekEnd = addDays(weekStart, 7)

  // Rows the draft or the moved chip cannot reach settle on `null` and their
  // layout never sees the change.
  const weekDraft =
    draftEvent &&
    new Date(draftEvent.start) < weekEnd &&
    new Date(draftEvent.end) > weekStart
      ? draftEvent
      : null

  const weekMoved =
    preview &&
    new Date(preview.start) < weekEnd &&
    new Date(preview.end) > weekStart
      ? preview
      : null

  const others = (events: CalendarEvent[]) =>
    movingId ? events.filter((event) => event.id !== movingId) : events

  const lanes = layoutAllDay(
    [
      ...others(eventsForDays(days)).filter((event) => event.allDay),
      ...(weekDraft?.allDay ? [weekDraft] : []),
      ...(weekMoved?.allDay ? [weekMoved] : []),
    ],
    days
  )

  // The draft is the one bar that is never cut.
  const placed = lanes.map((bar) =>
    bar.event.id === DRAFT_EVENT_ID
      ? { ...bar, lane: Math.min(bar.lane, MAX_LANES - 1) }
      : bar
  )

  const bars = placed
    .filter((bar) => bar.lane < MAX_LANES)
    .map((bar) => ({
      ...bar,
      continuesBefore: new Date(bar.event.start) < weekStart,
      continuesAfter: new Date(bar.event.end) > weekEnd,
    }))

  function covers(bar: AllDayPositionedEvent, index: number): boolean {
    return index >= bar.colStart && index < bar.colStart + bar.colSpan
  }

  // Timed events fill the slots the day's bars leave free, top first, and the
  // last free slot becomes the "+N more" button when they overflow.
  const drafted = weekDraft && !weekDraft.allDay ? weekDraft : null
  const moved = weekMoved && !weekMoved.allDay ? weekMoved : null

  const cells = days.map((day, index) => {
    const timed = [
      ...others(eventsForDay(day)).filter((event) => !event.allDay),
      ...(drafted && isSameDay(new Date(drafted.start), day) ? [drafted] : []),
      ...(moved && isSameDay(new Date(moved.start), day) ? [moved] : []),
    ].sort((a, b) => a.start.localeCompare(b.start))

    const covering = placed.filter((bar) => covers(bar, index))
    const occupied = new Set(
      covering.filter((bar) => bar.lane < MAX_LANES).map((bar) => bar.lane)
    )
    const dropped = covering.filter((bar) => bar.lane >= MAX_LANES)

    const free = Array.from({ length: MAX_SLOTS }, (_, slot) => slot).filter(
      (slot) => !occupied.has(slot)
    )

    const overflows = dropped.length > 0 || timed.length > free.length
    let visible = timed.slice(
      0,
      overflows ? Math.max(free.length - 1, 0) : free.length
    )

    if (drafted && timed.includes(drafted) && !visible.includes(drafted)) {
      visible = [...visible.slice(0, -1), drafted]
    }

    const slot = free[visible.length]

    const shown = new Set([
      ...visible.map((event) => event.id),
      ...covering
        .filter((bar) => bar.lane < MAX_LANES)
        .map((bar) => bar.event.id),
    ])

    return {
      day,
      events: visible.map((event, position) => ({
        event,
        slot: free[position]!,
        anchored: isSameDay(new Date(event.start), day),
      })),
      more:
        overflows && slot !== undefined
          ? {
              slot,
              hidden: dropped.length + timed.length - visible.length,
              events: [...covering.map((bar) => bar.event), ...timed]
                .filter((event) => event.id !== DRAFT_EVENT_ID)
                .map((event) => ({ event, anchored: !shown.has(event.id) })),
            }
          : null,
    }
  })

  const showSkeletons =
    loading &&
    !bars.length &&
    cells.every((cell) => !cell.events.length && !cell.more)

  return (
    <div
      className="grid min-w-0 grid-cols-7 border-b border-border"
      style={{ ...gridStyle, ...style }}
    >
      {/* Column separators, behind everything so a gesture on empty space
          anywhere in the day lands here. They carry the day a drag reads back
          off them. */}
      {cells.map(({ day }, index) => (
        <div
          key={`day-${day.getTime()}`}
          data-date={isoDate(day)}
          className={cn(
            "row-span-full border-border",
            index !== 0 && "border-s"
          )}
          style={{ gridColumn: index + 1 }}
          onPointerDown={(pointer) =>
            onGridPointerdown(pointer, { kind: "month", day })
          }
          onDoubleClick={(click) =>
            onGridDblclick(click, { kind: "month", day })
          }
        />
      ))}

      {cells.map(({ day }, index) => (
        <Link
          key={`number-${day.getTime()}`}
          href={pathFor(toCalendarDate(day), "day")}
          className={cn(
            "row-start-1 m-0.5 inline-flex h-6 min-w-6 items-center justify-center justify-self-end rounded-full px-1 py-1 text-xs font-semibold transition-colors select-none focus-visible:outline-3",
            isToday(day)
              ? "bg-primary text-primary-foreground outline-primary/25 active:bg-primary/75"
              : "text-foreground outline-foreground/25 hover:bg-muted active:bg-muted"
          )}
          style={{ gridColumn: index + 1 }}
        >
          {label(day)}
        </Link>
      ))}

      {showSkeletons &&
        SKELETONS.map(([day, slot]) => (
          <Skeleton
            key={`skeleton-${day}-${slot}`}
            className="mx-0.5 h-5 self-start rounded-full"
            style={{ gridColumn: day + 1, gridRow: slot + 2 }}
          />
        ))}

      {bars.map(
        ({
          event,
          colStart,
          colSpan,
          lane,
          continuesBefore,
          continuesAfter,
        }) =>
          event.id === DRAFT_EVENT_ID ? (
            <EventDraft
              key={event.id}
              variant="chip"
              anchored={!continuesBefore}
              continuesBefore={continuesBefore}
              continuesAfter={continuesAfter}
              className="mx-0.5 self-start"
              style={{
                gridColumn: `${colStart + 1} / span ${colSpan}`,
                gridRow: lane + 2,
              }}
            />
          ) : (
            <EventChip
              key={event.id}
              event={event}
              anchored={!continuesBefore}
              className={cn(
                "mx-0.5 self-start",
                continuesBefore && "rounded-s-none",
                continuesAfter && "rounded-e-none"
              )}
              style={{
                gridColumn: `${colStart + 1} / span ${colSpan}`,
                gridRow: lane + 2,
              }}
            />
          )
      )}

      {cells.map(({ day, events: dayEvents, more }, index) => (
        <React.Fragment key={`events-${day.getTime()}`}>
          {dayEvents.map(({ event, slot, anchored }) =>
            event.id === DRAFT_EVENT_ID ? (
              <EventDraft
                key={event.id}
                variant="chip"
                anchored
                className="mx-0.5 self-start"
                style={{ gridColumn: index + 1, gridRow: slot + 2 }}
              />
            ) : (
              <EventChip
                key={event.id}
                event={event}
                anchored={anchored}
                showTime
                className="mx-0.5 self-start max-lg:**:data-time:hidden"
                style={{ gridColumn: index + 1, gridRow: slot + 2 }}
              />
            )
          )}

          {more && (
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="ghost"
                    size="xs"
                    className="mx-0.5 justify-start self-start px-1.5 py-0.5 font-normal text-muted-foreground aria-expanded:bg-muted"
                    style={{ gridColumn: index + 1, gridRow: more.slot + 2 }}
                  />
                }
              >
                <span className="lg:hidden">+{more.hidden}</span>
                <span className="hidden lg:inline">+{more.hidden} more</span>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                className="flex w-64 flex-col gap-0.5 p-2"
              >
                {more.events.map(({ event, anchored }) => (
                  <EventChip
                    key={event.id}
                    event={event}
                    anchored={anchored}
                    showTime
                  />
                ))}
              </PopoverContent>
            </Popover>
          )}
        </React.Fragment>
      ))}
    </div>
  )
})
