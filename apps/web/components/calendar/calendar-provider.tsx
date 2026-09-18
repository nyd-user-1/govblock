"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import type { CalendarDate } from "@internationalized/date"
import {
  addDays,
  addMinutes,
  differenceInCalendarDays,
  startOfDay,
} from "date-fns"

import {
  dateAtPoint,
  dayKey,
  formatMonth,
  formatRangeTitle,
  parseCalendarDate,
  rangeFor,
  toDate,
  todayDate,
  toLocalISO,
  type RangeTitle,
} from "@/lib/calendar/dates"
import {
  DRAFT_EVENT_ID,
  DRAG_THRESHOLD,
  minutesInColumn,
  SNAP_MINUTES,
} from "@/lib/calendar/layout"
import type {
  Calendar,
  CalendarEvent,
  CalendarView,
  DateRange,
  EventDraft,
  GridTarget,
} from "@/lib/calendar/types"

// A ref that always holds the latest value, synced after render so handlers
// and effects read the current one without the render depending on it.
export function useLatest<T>(value: T): React.RefObject<T> {
  const ref = React.useRef(value)

  React.useEffect(() => {
    ref.current = value
  })

  return ref
}

// ---------------------------------------------------------------------------
// Route + navigation (useCalendar)

interface CalendarContextValue {
  view: CalendarView
  date: CalendarDate
  range: DateRange
  title: RangeTitle
  visibleMonth: CalendarDate | null
  setVisibleMonth: (month: CalendarDate | null) => void
  monthLabelsVisible: boolean
  wakeMonthLabels: () => void
  formSide: "bottom" | "right"
  prevDate: CalendarDate
  nextDate: CalendarDate
  pathFor: (target: CalendarDate, view?: CalendarView) => string
  navigate: (path: string, options?: { replace?: boolean }) => void
  setDirection: (direction: "left" | "right") => void
  isSearchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

const CalendarContext = React.createContext<CalendarContextValue | null>(null)

export function useCalendar() {
  const value = React.useContext(CalendarContext)
  if (!value) {
    throw new Error("useCalendar must be used within CalendarProvider")
  }
  return value
}

function useCalendarState(base: string): CalendarContextValue {
  const params = useParams<{ view?: string; date?: string }>()
  const router = useRouter()

  const view: CalendarView =
    params.view === "day" || params.view === "month" ? params.view : "week"

  const date = React.useMemo(
    () => (params.date && parseCalendarDate(params.date)) || todayDate(),
    [params.date]
  )

  const range = React.useMemo(() => rangeFor(view, date), [view, date])

  const [visibleMonth, setVisibleMonth] = React.useState<CalendarDate | null>(
    null
  )

  // While it scrolls, the month view slides its own copies of the header
  // title over the grid. They show for 600ms after the last scroll frame.
  const [monthLabelsVisible, setMonthLabelsVisible] = React.useState(false)
  const labelsTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const wakeMonthLabels = React.useCallback(() => {
    setMonthLabelsVisible(true)
    clearTimeout(labelsTimer.current)
    labelsTimer.current = setTimeout(() => setMonthLabelsVisible(false), 600)
  }, [])

  const title = React.useMemo<RangeTitle>(() => {
    if (view === "month") {
      const focus = visibleMonth ?? date

      return { months: formatMonth(toDate(focus)), year: String(focus.year) }
    }

    return formatRangeTitle(range)
  }, [view, visibleMonth, date, range])

  const formSide = view === "day" ? "bottom" : "right"

  const step =
    view === "month" ? { months: 1 } : { days: view === "day" ? 1 : 7 }
  const prevDate = date.subtract(step)
  const nextDate = date.add(step)

  const pathFor = React.useCallback(
    (target: CalendarDate, targetView: CalendarView = view) =>
      `${base}/${targetView}/${target.toString()}`,
    [base, view]
  )

  const navigate = React.useCallback(
    (path: string, options?: { replace?: boolean }) => {
      if (options?.replace) {
        router.replace(path, { scroll: false })
      } else {
        router.push(path, { scroll: false })
      }
    },
    [router]
  )

  const setDirection = React.useCallback((direction: "left" | "right") => {
    document.documentElement.dataset.navDirection = direction
    setTimeout(() => {
      delete document.documentElement.dataset.navDirection
    }, 250)
  }, [])

  const [isSearchOpen, setSearchOpen] = React.useState(false)

  return {
    view,
    date,
    range,
    title,
    visibleMonth,
    setVisibleMonth,
    monthLabelsVisible,
    wakeMonthLabels,
    formSide,
    prevDate,
    nextDate,
    pathFor,
    navigate,
    setDirection,
    isSearchOpen,
    setSearchOpen,
  }
}

// ---------------------------------------------------------------------------
// Events store (useCalendarEvents)

/**
 * Where a calendar's events come from and go to: /calendar's are the
 * hearings and the reader's own events (hearing-source.tsx).
 */
export interface EventSource {
  /** What a draft is called until it has a title. */
  defaultTitle: string
  calendars: Calendar[]
  store: Record<string, CalendarEvent>
  loading: boolean
  add: (event: CalendarEvent) => void
  update: (event: CalendarEvent) => void
  remove: (id: string) => void
  /** Beneath an event's form in its popover. */
  details?: (event: CalendarEvent) => React.ReactNode
  // The jurisdiction the rail's Jurisdiction select moves.
  state: string
  setState: (state: string) => void
}

interface EventsContextValue {
  defaultTitle: string
  calendars: Calendar[]
  hiddenCalendars: string[]
  toggleCalendar: (id: string) => void
  events: CalendarEvent[]
  eventsForDay: (day: Date) => CalendarEvent[]
  eventsForDays: (days: Date[]) => CalendarEvent[]
  loading: boolean
  addEvent: (event: CalendarEvent) => void
  updateEvent: (event: CalendarEvent) => void
  removeEvent: (id: string) => void
  details?: EventSource["details"]
  state: string
  setState: (state: string) => void
}

const EventsContext = React.createContext<EventsContextValue | null>(null)

export function useCalendarEvents() {
  const value = React.useContext(EventsContext)
  if (!value) {
    throw new Error("useCalendarEvents must be used within CalendarProvider")
  }
  return value
}

const HIDDEN_KEY = "calendar:hidden-calendars"

function useEventsState(source: EventSource): EventsContextValue {
  const { store, calendars } = source

  const [hiddenCalendars, setHiddenCalendars] = React.useState<string[]>([])

  React.useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]")
      if (Array.isArray(stored)) {
        setHiddenCalendars(stored)
      }
    } catch {}
  }, [])

  const toggleCalendar = React.useCallback((id: string) => {
    setHiddenCalendars((hidden) => {
      const next = hidden.includes(id)
        ? hidden.filter((item) => item !== id)
        : [...hidden, id]
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const events = React.useMemo(
    () =>
      Object.values(store).filter(
        (event) => !hiddenCalendars.includes(event.calendarId)
      ),
    [store, hiddenCalendars]
  )

  // Bucketed once per change, so every day cell is a lookup rather than a
  // scan over the whole pool.
  const eventsByDay = React.useMemo(() => {
    const buckets = new Map<string, CalendarEvent[]>()

    for (const event of events) {
      const end = new Date(event.end)

      let day = startOfDay(new Date(event.start))
      do {
        const key = dayKey(day)
        const bucket = buckets.get(key)

        if (bucket) {
          bucket.push(event)
        } else {
          buckets.set(key, [event])
        }

        day = addDays(day, 1)
      } while (day < end)
    }

    return buckets
  }, [events])

  const eventsForDay = React.useCallback(
    (day: Date) => eventsByDay.get(dayKey(day)) ?? [],
    [eventsByDay]
  )

  const eventsForDays = React.useCallback(
    (days: Date[]) => {
      const seen = new Set<string>()

      return days.flatMap((day) =>
        eventsForDay(day).filter((event) => {
          if (seen.has(event.id)) {
            return false
          }

          seen.add(event.id)

          return true
        })
      )
    },
    [eventsForDay]
  )

  return {
    defaultTitle: source.defaultTitle,
    calendars,
    hiddenCalendars,
    toggleCalendar,
    events,
    eventsForDay,
    eventsForDays,
    loading: source.loading,
    addEvent: source.add,
    updateEvent: source.update,
    removeEvent: source.remove,
    details: source.details,
    state: source.state,
    setState: source.setState,
  }
}

// ---------------------------------------------------------------------------
// Which event has its form open (useEventEditor)

interface EditorContextValue {
  editingId: string | null
  openEvent: (id: string) => void
  closeEvent: (id: string) => void
  registerAnchor: () => () => void
}

const EditorContext = React.createContext<EditorContextValue | null>(null)

export function useEventEditor() {
  const value = React.useContext(EditorContext)
  if (!value) {
    throw new Error("useEventEditor must be used within CalendarProvider")
  }
  return value
}

function useEditorState(): EditorContextValue {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const editingRef = useLatest(editingId)

  const anchors = React.useRef(0)

  const openEvent = React.useCallback((id: string) => setEditingId(id), [])
  const closeEvent = React.useCallback((id: string) => {
    setEditingId((current) => (current === id ? null : current))
  }, [])

  // Losing every form is how the id learns it has nowhere left to live. A
  // chip changing container unmounts and mounts back, so its replacement gets
  // a tick to turn up.
  const registerAnchor = React.useCallback(() => {
    anchors.current++

    return () => {
      anchors.current--

      if (anchors.current || !editingRef.current) {
        return
      }

      // A chip changing container unmounts during the patch and mounts back
      // after it, so its replacement gets a tick to turn up.
      setTimeout(() => {
        if (!anchors.current) {
          setEditingId(null)
        }
      })
    }
  }, [editingRef])

  return { editingId, openEvent, closeEvent, registerAnchor }
}

// The form only mounts while its popover is open, so it is what tells the
// editor the event still has somewhere to be edited.
export function useRegisterEditorAnchor() {
  const { registerAnchor } = useEventEditor()

  React.useEffect(registerAnchor, [registerAnchor])
}

// ---------------------------------------------------------------------------
// The draft being drawn on a grid (useEventDraft)

const DEFAULT_HOUR = 9

interface DraftContextValue {
  draft: EventDraft | null
  drawing: boolean
  open: boolean
  draftEvent: CalendarEvent | null
  pendingScroll: boolean
  consumePendingScroll: () => void
  updateDraft: (patch: Partial<EventDraft>) => void
  discardDraft: (refocus?: boolean) => void
  commitDraft: () => void
  createAtAnchor: () => void
  onGridPointerdown: (event: React.PointerEvent, target: GridTarget) => void
  onGridDblclick: (event: React.MouseEvent, target: GridTarget) => void
  registerHost: () => () => void
  registerAnchor: () => () => void
}

const DraftContext = React.createContext<DraftContextValue | null>(null)

export function useEventDraft() {
  const value = React.useContext(DraftContext)
  if (!value) {
    throw new Error("useEventDraft must be used within CalendarProvider")
  }
  return value
}

interface Gesture {
  target: GridTarget
  x: number
  y: number
  rect: DOMRect
  anchorMinutes: number
  anchorDate: Date
  currentDate: Date
  moved: boolean
}

function useDraftState(
  calendar: CalendarContextValue,
  events: EventsContextValue
): DraftContextValue {
  const [draft, setDraft] = React.useState<EventDraft | null>(null)
  const draftRef = useLatest(draft)
  const [drawing, setDrawing] = React.useState(false)
  const [pendingScroll, setPendingScroll] = React.useState(false)

  const hosts = React.useRef(0)
  const anchors = React.useRef(0)
  const everAnchored = React.useRef(false)
  const origin = React.useRef<HTMLElement | null>(null)
  const gesture = React.useRef<Gesture | null>(null)

  const { calendars, hiddenCalendars, addEvent, defaultTitle } = events
  const { date, pathFor, navigate } = calendar

  const draftEvent = React.useMemo<CalendarEvent | null>(
    () =>
      draft && {
        id: DRAFT_EVENT_ID,
        calendarId: draft.calendarId,
        title: draft.title,
        start: toLocalISO(draft.start),
        end: toLocalISO(draft.end),
        allDay: draft.allDay || undefined,
      },
    [draft]
  )

  const defaultCalendarId = React.useCallback(() => {
    const visible = calendars.find((item) => !hiddenCalendars.includes(item.id))

    return visible?.id ?? calendars[0]?.id ?? "work"
  }, [calendars, hiddenCalendars])

  const createDraft = React.useCallback(
    (input: { start: Date; end: Date; allDay?: boolean; scroll?: boolean }) => {
      setDraft({
        start: input.start,
        end: input.end,
        allDay: input.allDay ?? false,
        title: "",
        calendarId: defaultCalendarId(),
        description: "",
      })

      everAnchored.current = false
      setPendingScroll(input.scroll ?? false)
      origin.current = document.activeElement as HTMLElement | null
    },
    [defaultCalendarId]
  )

  const updateDraft = React.useCallback((patch: Partial<EventDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const discardDraft = React.useCallback(
    (refocus = false) => {
      if (!draftRef.current) {
        return
      }

      setDraft(null)
      setDrawing(false)
      setPendingScroll(false)
      everAnchored.current = false

      const target = origin.current
      origin.current = null

      if (refocus && target?.isConnected) {
        target.focus()
      }
    },
    [draftRef]
  )

  const commitDraft = React.useCallback(() => {
    const current = draftRef.current
    if (!current) {
      return
    }

    addEvent({
      id: crypto.randomUUID(),
      calendarId: current.calendarId,
      title: current.title || defaultTitle,
      description: current.description || undefined,
      start: toLocalISO(current.start),
      end: toLocalISO(current.end),
      allDay: current.allDay || undefined,
    })

    discardDraft()
  }, [addEvent, discardDraft, draftRef, defaultTitle])

  // The `+` button, `n` and the command palette. They draw on the date the
  // route is on rather than navigating somewhere else.
  const createAtAnchor = React.useCallback(() => {
    if (!hosts.current) {
      navigate(pathFor(date))
    }

    const hour = Math.min(23, new Date().getHours() + 1)
    const start = addMinutes(startOfDay(toDate(date)), hour * 60)

    createDraft({ start, end: addMinutes(start, 60), scroll: true })
  }, [navigate, pathFor, date, createDraft])

  const consumePendingScroll = React.useCallback(
    () => setPendingScroll(false),
    []
  )

  function onEmptySpace(event: Event | React.SyntheticEvent): boolean {
    return !(event.target as HTMLElement | null)?.closest(
      '[data-event],[data-draft],a,button,[role="button"]'
    )
  }

  const geometry = React.useCallback(
    (event: PointerEvent): { start: Date; end: Date; allDay: boolean } => {
      const current = gesture.current!

      if (current.target.kind === "timed") {
        const day = startOfDay(current.target.day)
        const minutes = minutesInColumn(event.clientY, current.rect)
        const from = Math.min(current.anchorMinutes, minutes)
        const to = Math.max(
          Math.max(current.anchorMinutes, minutes),
          from + SNAP_MINUTES
        )

        return {
          start: addMinutes(day, from),
          end: addMinutes(day, to),
          allDay: false,
        }
      }

      current.currentDate =
        dateAtPoint(event.clientX, event.clientY) ?? current.currentDate

      const from =
        current.anchorDate < current.currentDate
          ? current.anchorDate
          : current.currentDate
      const to =
        current.anchorDate < current.currentDate
          ? current.currentDate
          : current.anchorDate

      return {
        start: startOfDay(from),
        end: addDays(startOfDay(to), 1),
        allDay: true,
      }
    },
    []
  )

  const endGesture = React.useCallback(() => {
    gesture.current = null
    setDrawing(false)
  }, [])

  React.useEffect(() => {
    function onPointermove(event: PointerEvent) {
      const current = gesture.current
      if (!current) {
        return
      }

      if (!current.moved) {
        if (
          Math.hypot(event.clientX - current.x, event.clientY - current.y) <
          DRAG_THRESHOLD
        ) {
          return
        }

        current.moved = true
        setDrawing(true)
        createDraft(geometry(event))

        return
      }

      updateDraft(geometry(event))
    }

    function onPointerup() {
      if (gesture.current) {
        endGesture()
      }
    }

    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape" && gesture.current?.moved) {
        endGesture()
        discardDraft()
      }
    }

    function onBlur() {
      if (gesture.current) {
        endGesture()
      }
    }

    document.addEventListener("pointermove", onPointermove)
    document.addEventListener("pointerup", onPointerup)
    document.addEventListener("pointercancel", onPointerup)
    window.addEventListener("keydown", onKeydown)
    window.addEventListener("blur", onBlur)

    return () => {
      document.removeEventListener("pointermove", onPointermove)
      document.removeEventListener("pointerup", onPointerup)
      document.removeEventListener("pointercancel", onPointerup)
      window.removeEventListener("keydown", onKeydown)
      window.removeEventListener("blur", onBlur)
    }
  }, [createDraft, updateDraft, discardDraft, endGesture, geometry])

  const onGridPointerdown = React.useCallback(
    (event: React.PointerEvent, target: GridTarget) => {
      if (
        event.button !== 0 ||
        event.pointerType === "touch" ||
        !onEmptySpace(event)
      ) {
        return
      }

      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()

      gesture.current = {
        target,
        x: event.clientX,
        y: event.clientY,
        rect,
        anchorMinutes: minutesInColumn(event.clientY, rect, "floor"),
        anchorDate: target.day,
        currentDate: target.day,
        moved: false,
      }
    },
    []
  )

  const onGridDblclick = React.useCallback(
    (event: React.MouseEvent, target: GridTarget) => {
      if (!onEmptySpace(event)) {
        return
      }

      event.preventDefault()
      getSelection()?.removeAllRanges()

      const day = startOfDay(target.day)

      if (target.kind === "allDay") {
        createDraft({ start: day, end: addDays(day, 1), allDay: true })

        return
      }

      const minutes =
        target.kind === "month"
          ? DEFAULT_HOUR * 60
          : minutesInColumn(
              event.clientY,
              (event.currentTarget as HTMLElement).getBoundingClientRect(),
              "floor"
            )
      const start = addMinutes(day, minutes)

      createDraft({ start, end: addMinutes(start, 60) })
    },
    [createDraft]
  )

  // Losing the ghost is how the draft learns it has nowhere left to live. It
  // saves rather than discards: only Escape throws a draft away.
  const registerHost = React.useCallback(() => {
    hosts.current++

    return () => {
      hosts.current--
    }
  }, [])

  const registerAnchor = React.useCallback(() => {
    anchors.current++
    everAnchored.current = true

    return () => {
      anchors.current--

      if (anchors.current || !draftRef.current || !everAnchored.current) {
        return
      }

      // A ghost changing container unmounts during the patch and mounts back
      // after it, so its replacement gets a tick to turn up.
      setTimeout(() => {
        if (!anchors.current && draftRef.current) {
          commitDraft()
        }
      })
    }
  }, [commitDraft, draftRef])

  return {
    draft,
    drawing,
    open: !!draft && !drawing,
    draftEvent,
    pendingScroll,
    consumePendingScroll,
    updateDraft,
    discardDraft,
    commitDraft,
    createAtAnchor,
    onGridPointerdown,
    onGridDblclick,
    registerHost,
    registerAnchor,
  }
}

// A view that can draw a ghost, so `createAtAnchor` knows whether it has to
// navigate to one first.
export function useRegisterDraftHost() {
  const { registerHost } = useEventDraft()

  React.useEffect(registerHost, [registerHost])
}

// Every ghost segment counts: the draft is committed once none is left.
export function useRegisterDraftAnchor() {
  const { registerAnchor } = useEventDraft()

  React.useEffect(registerAnchor, [registerAnchor])
}

// ---------------------------------------------------------------------------
// Moving a chip across days (useEventMove)

interface MoveContextValue {
  movingId: string | null
  preview: CalendarEvent | null
  suppressed: boolean
  onPointerdown: (
    pointerEvent: React.PointerEvent,
    event: CalendarEvent
  ) => void
}

const MoveContext = React.createContext<MoveContextValue | null>(null)

export function useEventMove() {
  const value = React.useContext(MoveContext)
  if (!value) {
    throw new Error("useEventMove must be used within CalendarProvider")
  }
  return value
}

interface MoveGesture {
  event: CalendarEvent
  x: number
  y: number
  origin: Date
  current: Date
  moved: boolean
  cancelled: boolean
}

function useMoveState(events: EventsContextValue): MoveContextValue {
  const { updateEvent } = events

  const [source, setSource] = React.useState<CalendarEvent | null>(null)
  const [deltaDays, setDeltaDays] = React.useState(0)
  const [suppressed, setSuppressed] = React.useState(false)
  const gesture = React.useRef<MoveGesture | null>(null)
  const state = useLatest({ source, deltaDays })

  const preview = React.useMemo<CalendarEvent | null>(() => {
    if (!source || !deltaDays) {
      return source
    }

    return {
      ...source,
      start: toLocalISO(addDays(new Date(source.start), deltaDays)),
      end: toLocalISO(addDays(new Date(source.end), deltaDays)),
    }
  }, [source, deltaDays])

  const reset = React.useCallback(() => {
    gesture.current = null
    setSource(null)
    setDeltaDays(0)
  }, [])

  const release = React.useCallback(() => {
    setTimeout(() => setSuppressed(false))
  }, [])

  React.useEffect(() => {
    function onPointermove(pointerEvent: PointerEvent) {
      const current = gesture.current
      if (!current || current.cancelled) {
        return
      }

      if (!current.moved) {
        if (
          Math.hypot(
            pointerEvent.clientX - current.x,
            pointerEvent.clientY - current.y
          ) < DRAG_THRESHOLD
        ) {
          return
        }

        current.moved = true
        setSuppressed(true)
        setSource(current.event)
      }

      current.current =
        dateAtPoint(pointerEvent.clientX, pointerEvent.clientY) ??
        current.current

      setDeltaDays(differenceInCalendarDays(current.current, current.origin))
    }

    function onPointerup() {
      const current = gesture.current
      if (!current) {
        return
      }

      const { source: event, deltaDays: delta } = state.current

      if (current.moved && event && delta) {
        updateEvent({
          ...event,
          start: toLocalISO(addDays(new Date(event.start), delta)),
          end: toLocalISO(addDays(new Date(event.end), delta)),
        })
      }

      reset()
      release()
    }

    function onKeydown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape" && gesture.current?.moved) {
        gesture.current.cancelled = true
        gesture.current.moved = false
        setSource(null)
        setDeltaDays(0)
      }
    }

    function onBlur() {
      if (gesture.current) {
        reset()
        release()
      }
    }

    document.addEventListener("pointermove", onPointermove)
    document.addEventListener("pointerup", onPointerup)
    document.addEventListener("pointercancel", onPointerup)
    window.addEventListener("keydown", onKeydown)
    window.addEventListener("blur", onBlur)

    return () => {
      document.removeEventListener("pointermove", onPointermove)
      document.removeEventListener("pointerup", onPointerup)
      document.removeEventListener("pointercancel", onPointerup)
      window.removeEventListener("keydown", onKeydown)
      window.removeEventListener("blur", onBlur)
    }
  }, [updateEvent, reset, release, state])

  const onPointerdown = React.useCallback(
    (pointerEvent: React.PointerEvent, event: CalendarEvent) => {
      if (pointerEvent.button !== 0 || pointerEvent.pointerType === "touch") {
        return
      }

      // A chip listed in a "+N more" popover is drawn over the grid rather
      // than in it: there is no day under that pointer to move to.
      if (
        (pointerEvent.target as HTMLElement).closest(
          "[data-slot=popover-content]"
        )
      ) {
        return
      }

      const origin = dateAtPoint(pointerEvent.clientX, pointerEvent.clientY)
      if (!origin) {
        return
      }

      gesture.current = {
        event,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
        origin,
        current: origin,
        moved: false,
        cancelled: false,
      }
    },
    []
  )

  return {
    movingId: source?.id ?? null,
    preview,
    suppressed,
    onPointerdown,
  }
}

// ---------------------------------------------------------------------------

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) {
    return false
  }

  return (
    element.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)
  )
}

export function CalendarProvider({
  base = "/calendar",
  useSource,
  children,
}: {
  /** The route the views live under: `${base}/${view}/${date}`. */
  base?: string
  /** Called once per render, like any hook; a provider never changes source. */
  useSource: () => EventSource
  children: React.ReactNode
}) {
  const calendar = useCalendarState(base)
  const events = useEventsState(useSource())
  const editor = useEditorState()
  const draft = useDraftState(calendar, events)
  const move = useMoveState(events)

  // Keyboard shortcuts, the ones the template's `defineShortcuts` installs.
  const latest = useLatest({ calendar, editor, draft })

  React.useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      const { calendar, editor, draft } = latest.current

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        calendar.setSearchOpen(!calendar.isSearchOpen)
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      // A key that navigates would take the grid out from under whatever is
      // being written.
      if (draft.draft || editor.editingId) {
        return
      }

      const { date, prevDate, nextDate, pathFor, navigate, setDirection } =
        calendar

      switch (event.key) {
        case "t":
          navigate(pathFor(todayDate()))
          break
        case "d":
          navigate(pathFor(date, "day"))
          break
        case "w":
          navigate(pathFor(date, "week"))
          break
        case "m":
          navigate(pathFor(date, "month"))
          break
        case "n":
          event.preventDefault()
          draft.createAtAnchor()
          break
        case "ArrowLeft":
          setDirection("left")
          navigate(pathFor(prevDate))
          break
        case "ArrowRight":
          setDirection("right")
          navigate(pathFor(nextDate))
          break
      }
    }

    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [latest])

  return (
    <CalendarContext.Provider value={calendar}>
      <EventsContext.Provider value={events}>
        <EditorContext.Provider value={editor}>
          <DraftContext.Provider value={draft}>
            <MoveContext.Provider value={move}>{children}</MoveContext.Provider>
          </DraftContext.Provider>
        </EditorContext.Provider>
      </EventsContext.Provider>
    </CalendarContext.Provider>
  )
}
