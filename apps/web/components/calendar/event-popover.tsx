"use client"

import * as React from "react"
import { PencilIcon, Trash2Icon } from "lucide-react"

import { isHearingEvent } from "@/lib/calendar/hearings"
import { capitolZone } from "@/lib/policy/hearing-when"
import type { CalendarEvent } from "@/lib/calendar/types"
import { AddToCalendar } from "@/components/connectors/add-to-calendar"
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
  const { removeEvent, updateEvent, state } = useCalendarEvents()
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
              <>
                <EventForm
                  event={event}
                  onSave={updateEvent}
                  onRemove={onRemove}
                  onEscape={() => closeEvent(event.id)}
                />
                {/* A hearing is the legislature's schedule, not the reader's:
                    it cannot be moved or deleted here, and the one useful
                    thing to do with it is take a copy to a calendar that is
                    theirs. The event's own times go across — including the
                    capitol's timezone, because these are wall-clock times with
                    no zone of their own. */}
                {isHearingEvent(event.id) && (
                  <div className="mt-1 border-t pt-1">
                    <AddToCalendar
                      className="w-full justify-start"
                      summary={event.title}
                      description={event.description}
                      when={
                        event.allDay
                          ? {
                              start: event.start.slice(0, 10),
                              end: event.end.slice(0, 10),
                              allDay: true,
                            }
                          : {
                              start: event.start,
                              end: event.end,
                              timeZone: capitolZone(state),
                              allDay: false,
                            }
                      }
                      url="/calendar"
                    />
                  </div>
                )}
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
