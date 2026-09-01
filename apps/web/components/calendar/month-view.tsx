"use client"

import * as React from "react"
import type { CalendarDate } from "@internationalized/date"
import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  startOfWeek,
} from "date-fns"

import {
  formatMonth,
  formatWeekday,
  monthRange,
  toCalendarDate,
  toDate,
  WEEKS_AROUND,
} from "@/lib/calendar/dates"
import { cn } from "@govblock/ui/lib/utils"

import {
  useCalendar,
  useEventDraft,
  useRegisterDraftHost,
} from "./calendar-provider"
import { CHROME_HEIGHT, DOCK_TOP, HEADER_TOTAL, WEEKDAY_HEIGHT } from "./chrome"
import { MonthWeek } from "./month-week"

// ±5 years of week rows, windowed so only the visible ones render.
const ROW_HEIGHT = 140
const OVERSCAN = 3
// Height of a month label, spacing the sticky stack in the overlay.
const LABEL_HEIGHT = 32
// How far a riding label sits above the top of its week row.
const LABEL_LIFT = 12
// The rest position of the first grid row in overlay coordinates.
const GRID_TOP = CHROME_HEIGHT - DOCK_TOP

interface Label {
  key: number
  month: string
  year: string
  y: number
}

function monthKey(month: CalendarDate): number {
  return month.year * 12 + month.month
}

export function MonthView() {
  const {
    date,
    pathFor,
    navigate,
    setVisibleMonth,
    monthLabelsVisible,
    wakeMonthLabels,
  } = useCalendar()
  const { draft, pendingScroll } = useEventDraft()

  useRegisterDraftHost()

  const firstWeek = React.useMemo(
    () => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), -WEEKS_AROUND),
    []
  )
  const weeks = React.useMemo(
    () =>
      Array.from({ length: WEEKS_AROUND * 2 + 1 }, (_, index) =>
        addWeeks(firstWeek, index)
      ),
    [firstWeek]
  )
  const weekdays = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        formatWeekday(addDays(firstWeek, index))
      ),
    [firstWeek]
  )

  const indexOf = React.useCallback(
    (day: Date) =>
      Math.min(
        weeks.length - 1,
        Math.max(
          0,
          differenceInCalendarWeeks(day, firstWeek, { weekStartsOn: 1 })
        )
      ),
    [weeks.length, firstWeek]
  )

  const scroller = React.useRef<HTMLDivElement>(null)
  const [range, setRange] = React.useState(() => {
    const anchor = indexOf(monthRange(date).start)
    return { first: anchor, last: anchor + 8 }
  })
  const [labels, setLabels] = React.useState<Label[]>([])

  const dockedMonths = React.useRef(new Map<number, CalendarDate>())
  const labelOffsets = React.useRef(new Map<number, number>())
  const labelTexts = React.useRef(
    new Map<number, { month: string; year: string }>()
  )
  const labelsAwake = React.useRef(false)
  const syncing = React.useRef(false)
  const settleTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  // The docked month is the month of the last day of the top visible week.
  const dockedMonth = React.useCallback((): CalendarDate | null => {
    const offset = scroller.current?.scrollTop

    if (offset == null) {
      return null
    }

    const top = Math.min(
      weeks.length - 1,
      Math.max(0, Math.floor(offset / ROW_HEIGHT))
    )

    let month = dockedMonths.current.get(top)
    if (!month) {
      month = toCalendarDate(addDays(weeks[top]!, 6)).set({ day: 1 })
      dockedMonths.current.set(top, month)
    }

    return month
  }, [weeks])

  const labelOffset = React.useCallback(
    (month: CalendarDate): number => {
      const key = monthKey(month)

      let offset = labelOffsets.current.get(key)
      if (offset === undefined) {
        offset = indexOf(monthRange(month).start) * ROW_HEIGHT
        labelOffsets.current.set(key, offset)
      }

      return offset
    },
    [indexOf]
  )

  const labelText = React.useCallback((month: CalendarDate) => {
    const key = monthKey(month)

    let text = labelTexts.current.get(key)
    if (!text) {
      text = { month: formatMonth(toDate(month)), year: String(month.year) }
      labelTexts.current.set(key, text)
    }

    return text
  }, [])

  // One real label per month: it rides the week row containing the 1st,
  // slides behind the weekday bar, docks at the header title spot and is
  // pushed out through the top by the next month's incoming label.
  const updateLabels = React.useCallback(
    (docked: CalendarDate) => {
      const element = scroller.current
      if (!element) {
        return
      }

      const offset = element.scrollTop
      const viewportHeight = element.clientHeight

      const months = [docked]
      while (months.length < 4) {
        const next = months[months.length - 1]!.add({ months: 1 })

        if (labelOffset(next) > offset + viewportHeight) {
          break
        }

        months.push(next)
      }

      const positions = months.map((month) => {
        const distance = labelOffset(month) - offset

        return Math.max(
          (distance >= GRID_TOP ? GRID_TOP + distance : distance * 2) -
            LABEL_LIFT,
          0
        )
      })

      for (let index = positions.length - 2; index >= 0; index--) {
        positions[index] = Math.min(
          positions[index]!,
          positions[index + 1]! - LABEL_HEIGHT
        )
      }

      setLabels(
        months.map((month, index) => ({
          key: monthKey(month),
          ...labelText(month),
          y: positions[index]!,
        }))
      )
    },
    [labelOffset, labelText]
  )

  const visibleMonthRef = React.useRef<CalendarDate | null>(null)

  const update = React.useCallback(() => {
    const element = scroller.current
    if (!element) {
      return
    }

    const first = Math.max(
      0,
      Math.floor(element.scrollTop / ROW_HEIGHT) - OVERSCAN
    )
    const last = Math.min(
      weeks.length - 1,
      Math.ceil((element.scrollTop + element.clientHeight) / ROW_HEIGHT) +
        OVERSCAN
    )
    setRange((current) =>
      current.first === first && current.last === last
        ? current
        : { first, last }
    )

    const docked = dockedMonth()
    if (!docked) {
      return
    }

    if (
      !visibleMonthRef.current ||
      docked.compare(visibleMonthRef.current) !== 0
    ) {
      visibleMonthRef.current = docked
      setVisibleMonth(docked)
    }

    updateLabels(docked)
  }, [weeks.length, dockedMonth, setVisibleMonth, updateLabels])

  const scrollToMonth = React.useCallback(
    (target: CalendarDate, options?: { smooth?: boolean }) => {
      scroller.current?.scrollTo({
        top: indexOf(monthRange(target).start) * ROW_HEIGHT,
        behavior: options?.smooth ? "smooth" : "auto",
      })
    },
    [indexOf]
  )

  // Scrolling owns the URL: on settle, the docked month replaces the route so
  // the mini calendar and shareable URL follow along.
  const dateRef = React.useRef(date)
  dateRef.current = date

  const syncRoute = React.useCallback(() => {
    const target = dockedMonth()
    const current = dateRef.current

    if (
      !target ||
      (target.year === current.year && target.month === current.month)
    ) {
      return
    }

    syncing.current = true
    navigate(pathFor(target), { replace: true })
    setTimeout(() => {
      syncing.current = false
    }, 300)
  }, [dockedMonth, navigate, pathFor])

  // Initial position, then the per-frame docking on scroll.
  React.useLayoutEffect(() => {
    scrollToMonth(dateRef.current)
    update()
    requestAnimationFrame(() => {
      labelsAwake.current = true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const element = scroller.current
    if (!element) {
      return
    }

    let frame = 0

    function onScroll() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)

      if (labelsAwake.current) {
        wakeMonthLabels()
      }

      clearTimeout(settleTimer.current)
      settleTimer.current = setTimeout(syncRoute, 150)
    }

    element.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", update)

    return () => {
      element.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", update)
      cancelAnimationFrame(frame)
      clearTimeout(settleTimer.current)
    }
  }, [update, wakeMonthLabels, syncRoute])

  // External jumps (mini calendar, prev/next, `t`) scroll the list instead.
  const dateKey = date.toString()
  React.useEffect(() => {
    if (syncing.current) {
      return
    }

    const docked = dockedMonth()
    if (docked && docked.year === date.year && docked.month === date.month) {
      return
    }

    const target = indexOf(monthRange(date).start)
    const middle = Math.round((range.first + range.last) / 2)
    const smooth = Math.abs(target - middle) <= 12

    scrollToMonth(date, { smooth })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  // The `+` button can draw on a week that is not mounted.
  React.useEffect(() => {
    if (!pendingScroll || !draft) {
      return
    }

    scroller.current?.scrollTo({
      top: Math.max(0, indexOf(draft.start) * ROW_HEIGHT - ROW_HEIGHT),
      behavior: "smooth",
    })
  }, [pendingScroll, draft, indexOf])

  React.useEffect(() => {
    return () => {
      setVisibleMonth(null)
    }
  }, [setVisibleMonth])

  const rows: number[] = []
  for (let index = range.first; index <= range.last; index++) {
    rows.push(index)
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Snapped on the week rows so the grid always settles flush under the
          weekday bar. */}
      <div
        ref={scroller}
        className="flex-1 snap-y snap-proximity overflow-y-auto overscroll-contain"
        style={{ scrollPaddingTop: `${CHROME_HEIGHT}px` }}
      >
        <div
          className="relative"
          style={{
            height: `${CHROME_HEIGHT + weeks.length * ROW_HEIGHT}px`,
          }}
        >
          {rows.map((index) => (
            <div
              key={weeks[index]!.getTime()}
              className="absolute inset-x-0 snap-start"
              style={{
                top: `${CHROME_HEIGHT + index * ROW_HEIGHT}px`,
                height: `${ROW_HEIGHT}px`,
              }}
            >
              <MonthWeek
                weekStart={weeks[index]!}
                style={{ height: `${ROW_HEIGHT}px` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* The weekday bar, over the scroller so the grid slides under it. */}
      <div
        className="absolute inset-x-0 z-30 grid grid-cols-7 border-b border-border bg-background/80 backdrop-blur-md"
        style={{ top: `${HEADER_TOTAL}px`, height: `${WEEKDAY_HEIGHT}px` }}
      >
        {weekdays.map((weekday, index) => (
          <span
            key={weekday}
            className={cn(
              "flex items-center justify-end border-border pe-2 text-sm text-muted-foreground",
              index !== 0 && "border-s"
            )}
          >
            {weekday}
          </span>
        ))}
      </div>

      {/* Month labels, from the docked header title spot down over the grid. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-40 overflow-hidden transition-opacity",
          monthLabelsVisible
            ? "opacity-100 duration-150"
            : "opacity-0 duration-300"
        )}
        style={{ top: `${DOCK_TOP}px` }}
      >
        {labels.map((label) => (
          <div
            key={label.key}
            className="absolute inset-s-4 top-0 flex h-8 items-center gap-1.5 text-xl tracking-tight will-change-[translate] sm:text-2xl"
            style={{ translate: `0 ${label.y}px` }}
          >
            <span className="font-bold text-foreground">{label.month}</span>
            <span className="hidden font-normal text-muted-foreground sm:inline">
              {label.year}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
