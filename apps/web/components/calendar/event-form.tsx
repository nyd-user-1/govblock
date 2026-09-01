"use client"

import * as React from "react"
import { addDays, format, parse, subMilliseconds } from "date-fns"
import { CalendarIcon, Trash2Icon } from "lucide-react"

import { calendarDotClasses } from "@/lib/calendar/calendars"
import { toLocalISO } from "@/lib/calendar/dates"
import type { CalendarEvent, EventDraft } from "@/lib/calendar/types"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Calendar } from "@govblock/ui/components/nova/calendar"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@govblock/ui/components/nova/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@govblock/ui/components/nova/select"
import { Textarea } from "@govblock/ui/components/nova/textarea"

import {
  DEFAULT_TITLE,
  useCalendarEvents,
  useLatest,
  useRegisterEditorAnchor,
} from "./calendar-provider"

// One request per pause rather than one per keystroke.
const SAVE_DELAY = 200

interface FormState {
  title: string
  calendarId: string
  startDate: string // yyyy-MM-dd
  startTime: string // HH:mm
  endDate: string
  endTime: string
  allDay: boolean
  description: string
}

function parseDateTime(date: string, time: string): Date | null {
  if (!date) {
    return null
  }
  const parsed = parse(
    `${date} ${time || "00:00"}`,
    "yyyy-MM-dd HH:mm",
    new Date()
  )
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// `null` while a field is empty: nothing to save an event from.
function range(data: FormState): { start: Date; end: Date } | null {
  if (!data.startDate || !data.endDate) {
    return null
  }

  if (data.allDay) {
    const start = parseDateTime(data.startDate, "00:00")
    const end = parseDateTime(data.endDate, "00:00")
    return start && end ? { start, end: addDays(end, 1) } : null
  }

  if (!data.startTime || !data.endTime) {
    return null
  }

  const start = parseDateTime(data.startDate, data.startTime)
  const end = parseDateTime(data.endDate, data.endTime)
  return start && end ? { start, end } : null
}

function DateField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const selected = value
    ? (parseDateTime(value, "00:00") ?? undefined)
    : undefined

  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="link"
              size="icon-xs"
              aria-label={label}
              className="size-5 rounded-xs p-0"
            />
          }
        >
          <CalendarIcon className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            onSelect={(date) => date && onChange(format(date, "yyyy-MM-dd"))}
          />
        </PopoverContent>
      </Popover>
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-sm tabular-nums outline-none focus-visible:rounded-xs focus-visible:bg-primary/10"
      />
    </div>
  )
}

function TimeField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      step={60}
      onChange={(event) => onChange(event.target.value)}
      className="bg-transparent text-sm tabular-nums outline-none focus-visible:rounded-xs focus-visible:bg-primary/10"
    />
  )
}

// An event to edit, or the draft being drawn on the grid. The form owns
// neither: it hands back what changed and the caller decides what that means.
export function EventForm({
  event,
  draft,
  onUpdate,
  onSave,
  onRemove,
  onEscape,
}: {
  event?: CalendarEvent
  draft?: EventDraft
  onUpdate?: (patch: Partial<EventDraft>) => void
  onSave?: (event: CalendarEvent) => void
  onRemove?: (id: string) => void
  onEscape?: () => void
}) {
  const { calendars } = useCalendarEvents()

  const [state, setState] = React.useState<FormState>(() => {
    const source = event ?? draft
    const start = event ? new Date(event.start) : draft!.start
    const end = event ? new Date(event.end) : draft!.end
    const allDay = source?.allDay ?? false

    return {
      title: source?.title ?? "",
      calendarId: source?.calendarId ?? calendars[0]?.id ?? "work",
      startDate: format(start, "yyyy-MM-dd"),
      // Ranges are [start, end), so the last day an all-day event covers sits
      // a tick before the end.
      endDate: format(allDay ? subMilliseconds(end, 1) : end, "yyyy-MM-dd"),
      startTime: allDay ? "09:00" : format(start, "HH:mm"),
      endTime: allDay ? "10:00" : format(end, "HH:mm"),
      allDay,
      description: source?.description ?? "",
    }
  })

  const color =
    calendars.find((calendar) => calendar.id === state.calendarId)?.color ??
    "blue"

  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const pending = React.useRef<CalendarEvent | null>(null)
  const saveRef = useLatest(onSave)

  const flush = React.useCallback(() => {
    clearTimeout(timer.current)

    if (pending.current) {
      saveRef.current?.(pending.current)
      pending.current = null
    }
  }, [saveRef])

  // The last edit is still waiting when the popover takes the form down.
  React.useEffect(() => flush, [flush])

  const first = React.useRef(true)
  const eventRef = useLatest(event)
  const updateRef = useLatest(onUpdate)

  // There is nothing to submit: an edit lands on the event as it is made, and
  // a draft walks its ghost to where it would end up.
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }

    const period = range(state)

    if (!period || period.end <= period.start) {
      return
    }

    const { start, end } = period
    const source = eventRef.current

    if (source) {
      pending.current = {
        ...source,
        calendarId: state.calendarId,
        title: state.title.trim() ? state.title : source.title,
        description: state.description || undefined,
        start: toLocalISO(start),
        end: toLocalISO(end),
        allDay: state.allDay || undefined,
      }
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY)

      return
    }

    updateRef.current?.({
      title: state.title,
      calendarId: state.calendarId,
      description: state.description,
      allDay: state.allDay,
      start,
      end,
    })
  }, [state, flush, eventRef, updateRef])

  const invalidEnd = (() => {
    const period = range(state)
    return !!period && period.end <= period.start
  })()

  function patch(next: Partial<FormState>) {
    setState((current) => ({ ...current, ...next }))
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(submit) => submit.preventDefault()}
      onKeyDownCapture={(keyboard) => {
        if (keyboard.key === "Escape") {
          keyboard.stopPropagation()
          onEscape?.()
        }
      }}
    >
      {event && <EditorAnchor />}

      <div className="flex items-center rounded-md bg-muted px-3 py-2">
        <input
          autoFocus
          value={state.title}
          maxLength={100}
          placeholder={DEFAULT_TITLE}
          aria-label="Title"
          onChange={(change) => patch({ title: change.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        <Select
          value={state.calendarId}
          onValueChange={(value) =>
            value && patch({ calendarId: String(value) })
          }
        >
          <SelectTrigger
            size="sm"
            aria-label="Calendar"
            className="-me-2 h-6 gap-1 rounded-sm border-transparent bg-transparent px-1.5 hover:bg-background/60 dark:bg-transparent"
          >
            <span
              className={cn(
                "block size-2 rounded-full",
                calendarDotClasses[color]
              )}
            />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-fit">
            {calendars.map((calendar) => (
              <SelectItem key={calendar.id} value={calendar.id}>
                <span
                  className={cn(
                    "size-2 rounded-full",
                    calendarDotClasses[calendar.color]
                  )}
                />
                {calendar.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 rounded-md bg-muted px-3 py-2">
        <span className="w-16 text-end text-sm text-muted-foreground">
          All Day:
        </span>
        <Checkbox
          aria-label="All day"
          checked={state.allDay}
          onCheckedChange={(checked) => patch({ allDay: !!checked })}
          className="justify-self-start"
        />

        <span className="w-16 text-end text-sm text-muted-foreground">
          Starts:
        </span>
        <div className="flex items-center gap-2">
          <DateField
            label="Start date"
            value={state.startDate}
            onChange={(startDate) => patch({ startDate })}
          />
          {!state.allDay && (
            <TimeField
              label="Start time"
              value={state.startTime}
              onChange={(startTime) => patch({ startTime })}
            />
          )}
        </div>

        <span className="w-16 text-end text-sm text-muted-foreground">
          Ends:
        </span>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <DateField
              label="End date"
              value={state.endDate}
              onChange={(endDate) => patch({ endDate })}
            />
            {!state.allDay && (
              <TimeField
                label="End time"
                value={state.endTime}
                onChange={(endTime) => patch({ endTime })}
              />
            )}
          </div>
          {invalidEnd && (
            <span className="text-xs text-destructive">
              Ends before it starts
            </span>
          )}
        </div>
      </div>

      <div className="rounded-md bg-muted px-3 py-2">
        <Textarea
          value={state.description}
          maxLength={1000}
          rows={2}
          placeholder="Add Notes"
          aria-label="Notes"
          onChange={(change) => patch({ description: change.target.value })}
          className="min-h-0 resize-none rounded-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>

      {event && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => onRemove?.(event.id)}
        >
          <Trash2Icon data-icon="inline-start" />
          Delete Event
        </Button>
      )}
    </form>
  )
}

function EditorAnchor() {
  useRegisterEditorAnchor()
  return null
}
