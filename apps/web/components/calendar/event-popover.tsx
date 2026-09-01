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
  const { formSide } = useCalendar()
  const { removeEvent, updateEvent } = useCalendarEvents()
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

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="contents" />}>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger render={children(open)} nativeButton />
          <PopoverContent
            side={formSide}
            sideOffset={8}
            className="w-74 p-2"
            // The content only mounts while it is open, which re-seeds the
            // form every time.
          >
            {open && (
              <EventForm
                event={event}
                onSave={updateEvent}
                onRemove={onRemove}
                onEscape={() => closeEvent(event.id)}
              />
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
