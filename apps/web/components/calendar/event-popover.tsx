"use client"

import * as React from "react"
import { PencilIcon, Trash2Icon } from "lucide-react"

import type { CalendarEvent } from "@/lib/calendar/types"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@govblock/ui/components/nova/context-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@govblock/ui/components/nova/popover"

import { formatTime } from "@/lib/calendar/dates"
import {
  useCalendar,
  useCalendarEvents,
  useEventEditor,
} from "./calendar-provider"
import { EventForm } from "./event-form"

// The event opens straight into the form the draft uses, so there is no
// read-only step between pointing at an event and changing it. An event
// running past midnight draws in every day it touches, and only the segment
// holding its start (`anchored`) owns the form.
export function EventPopover({
  event,
  disabled,
  anchored = true,
  children,
}: {
  event: CalendarEvent
  disabled?: boolean
  anchored?: boolean
  // The trigger element; receives `open` so it can hold its pressed shade.
  children: (open: boolean) => React.ReactElement
}) {
  const { formSide, readOnly } = useCalendar()
  const { removeEvent, updateEvent, details } = useCalendarEvents()
  const { editingId, openEvent, closeEvent } = useEventEditor()

  const open = anchored && editingId === event.id

  function onOpenChange(value: boolean) {
    if (disabled) {
      return
    }

    if (value) {
      openEvent(event.id)
    } else {
      closeEvent(event.id)
    }
  }

  function onRemove() {
    closeEvent(event.id)
    removeEvent(event.id)
  }

  // Read-only (/calendar, and a signed-out reader anywhere): the event opens
  // to what it is — no form to change it, no menu to delete it.
  if (readOnly) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger render={children(open)} nativeButton />
        <PopoverContent side={formSide} sideOffset={8} className="w-90 max-w-[calc(100vw-1.5rem)] p-2">
          {open && (
            <>
              <EventSummary event={event} />
              {details?.(event)}
            </>
          )}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="contents" />}>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger render={children(open)} nativeButton />
          <PopoverContent
            side={formSide}
            sideOffset={8}
            className="w-90 max-w-[calc(100vw-1.5rem)] p-2"
            // The content only mounts while it is open, which re-seeds the
            // form every time.
          >
            {open && (
              <>
                <EventForm
                  event={event}
                  onSave={updateEvent}
                  onRemove={onRemove}
                  onEscape={() => closeEvent(event.id)}
                />
                {details?.(event)}
              </>
            )}
          </PopoverContent>
        </Popover>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40">
        <ContextMenuItem onClick={() => openEvent(event.id)}>
          <PencilIcon />
          Edit
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onRemove}>
          <Trash2Icon />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })

/** What an event is, in the card the form would have filled: its name, its day and hours, its notes. */
function EventSummary({ event }: { event: CalendarEvent }) {
  const start = new Date(event.start)
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">{event.title}</p>
      <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground tabular-nums">
        {DAY.format(start)}
        {event.allDay ? "" : ` · ${formatTime(start)} – ${formatTime(new Date(event.end))}`}
      </p>
      {event.description && <p className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-line text-muted-foreground">{event.description}</p>}
    </div>
  )
}
