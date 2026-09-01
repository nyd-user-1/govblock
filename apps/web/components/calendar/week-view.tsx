"use client"

import * as React from "react"
import { differenceInCalendarDays, isSameDay, isToday } from "date-fns"

import {
  eachDay,
  formatHour,
  formatWeekday,
  isoDate,
  toDate,
} from "@/lib/calendar/dates"
import {
  DRAFT_EVENT_ID,
  HOUR_HEIGHT,
  layoutAllDay,
  layoutDay,
} from "@/lib/calendar/layout"
import { cn } from "@govblock/ui/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useMounted } from "@/hooks/use-mounted"

import {
  useCalendar,
  useCalendarEvents,
  useEventDraft,
  useEventMove,
  useRegisterDraftHost,
} from "./calendar-provider"
import { HEADER_TOTAL } from "./chrome"
import { DayColumn } from "./day-column"
import { EventChip } from "./event-chip"
import { EventDraft } from "./event-draft"

const HOURS = Array.from({ length: 23 }, (_, index) => index + 1)

// The day header rides over the scroller, so the grid has to pad itself by
// the header band plus the header's own height.
const DAY_HEADER_HEIGHT = 41
const ALL_DAY_LANE_HEIGHT = 28
const ALL_DAY_ROW_BORDER = 1
// The day opens at 7am.
const START_OFFSET = 7 * HOUR_HEIGHT

export function WeekView() {
  const { date, range } = useCalendar()
  const { eventsForDay, eventsForDays, loading } = useCalendarEvents()
  const { draftEvent, onGridPointerdown, onGridDblclick } = useEventDraft()
  const { movingId, preview } = useEventMove()

  useRegisterDraftHost()

  const isSmallScreen = useMediaQuery("(max-width: 1023px)")
  const mounted = useMounted()

  // Small screens show a 3-day window around the anchor date, clamped so it
  // stays inside the fetched week.
  const days = React.useMemo(() => {
    const week = eachDay(range)
    if (week.length <= 3 || !mounted || !isSmallScreen) {
      return week
    }

    const start = Math.min(
      Math.max(differenceInCalendarDays(toDate(date), range.start), 0),
      week.length - 3
    )

    return week.slice(start, start + 3)
  }, [range, mounted, isSmallScreen, date])

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
  }

  const drafted = draftEvent && !draftEvent.allDay ? draftEvent : null

  const timedEvents = days.map((day) =>
    layoutDay(
      [
        ...eventsForDay(day).filter((event) => !event.allDay),
        ...(drafted && isSameDay(new Date(drafted.start), day)
          ? [drafted]
          : []),
      ],
      day
    )
  )

  const allDayEvents = layoutAllDay(
    [
      ...eventsForDays(days).filter(
        (event) => event.allDay && event.id !== movingId
      ),
      ...(draftEvent?.allDay ? [draftEvent] : []),
      ...(preview?.allDay ? [preview] : []),
    ],
    days
  )

  const showSkeletons =
    loading && !allDayEvents.length && timedEvents.every((day) => !day.length)

  // The row always stands, empty or not.
  const allDayLanes = allDayEvents.reduce(
    (lanes, { lane }) => Math.max(lanes, lane + 1),
    1
  )

  const chrome = React.useRef<HTMLDivElement>(null)
  const [measuredChrome, setMeasuredChrome] = React.useState(0)

  React.useEffect(() => {
    const element = chrome.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver(([entry]) => {
      setMeasuredChrome(
        entry?.borderBoxSize?.[0]?.blockSize ?? element.offsetHeight
      )
    })
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const chromeHeight =
    measuredChrome ||
    DAY_HEADER_HEIGHT + allDayLanes * ALL_DAY_LANE_HEIGHT + ALL_DAY_ROW_BORDER

  const chromeOffset = HEADER_TOTAL + chromeHeight

  const container = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    container.current?.scrollTo({ top: START_OFFSET })
  }, [])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={container}
        className="z-0 flex-1 snap-y snap-proximity overflow-y-auto overscroll-contain"
        style={{ scrollPaddingTop: `${chromeOffset}px` }}
      >
        <div
          data-week-grid=""
          className="grid"
          style={{ ...gridStyle, paddingTop: `${chromeOffset}px` }}
        >
          <div className="relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
            {HOURS.map((hour) => (
              <span
                key={hour}
                className="absolute end-2 -translate-y-1/2 text-[11px] text-muted-foreground/70 tabular-nums"
                style={{ top: `${hour * HOUR_HEIGHT}px` }}
              >
                {formatHour(hour)}
              </span>
            ))}
          </div>

          {days.map((day, index) => (
            <DayColumn
              key={day.getTime()}
              day={day}
              events={timedEvents[index]!}
              first={index === 0}
              loading={showSkeletons}
            />
          ))}
        </div>
      </div>

      {/* Outside the scroller like the month view's weekday bar. */}
      <div
        ref={chrome}
        className="absolute inset-x-0 z-30 border-b border-border bg-background/80 backdrop-blur-md"
        style={{ top: `${HEADER_TOTAL}px` }}
      >
        <div className="grid" style={gridStyle}>
          <div />

          {days.map((day) => (
            <div
              key={day.getTime()}
              className="flex items-center justify-center gap-1 border-s border-border py-2 text-sm"
            >
              <span className="text-muted-foreground">
                {formatWeekday(day)}
              </span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full font-semibold",
                  isToday(day)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {day.getDate()}
              </span>
            </div>
          ))}
        </div>

        <div
          className="grid border-t border-border"
          style={{
            ...gridStyle,
            gridTemplateRows: `repeat(${allDayLanes}, ${ALL_DAY_LANE_HEIGHT}px)`,
          }}
        >
          <span className="row-span-full self-center pe-2 text-end text-[10px] text-muted-foreground/70">
            all-day
          </span>

          {days.map((day, index) => (
            <div
              key={`all-day-${day.getTime()}`}
              data-date={isoDate(day)}
              className="row-span-full border-s border-border"
              style={{ gridColumn: index + 2 }}
              onPointerDown={(pointer) =>
                onGridPointerdown(pointer, { kind: "allDay", day })
              }
              onDoubleClick={(click) =>
                onGridDblclick(click, { kind: "allDay", day })
              }
            />
          ))}

          {allDayEvents.map(({ event, colStart, colSpan, lane }) =>
            event.id === DRAFT_EVENT_ID ? (
              <EventDraft
                key={event.id}
                variant="chip"
                anchored
                className="mx-1 mt-1 h-5"
                style={{
                  gridColumn: `${colStart + 2} / span ${colSpan}`,
                  gridRow: lane + 1,
                }}
              />
            ) : (
              <EventChip
                key={event.id}
                event={event}
                className="mx-1 mt-1 h-5"
                style={{
                  gridColumn: `${colStart + 2} / span ${colSpan}`,
                  gridRow: lane + 1,
                }}
              />
            )
          )}
        </div>
      </div>
    </div>
  )
}
