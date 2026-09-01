"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { calendarDotClasses, eventBlockClasses } from "@/lib/calendar/calendars"
import { formatTime } from "@/lib/calendar/dates"
import { cn } from "@govblock/ui/lib/utils"

import {
  DEFAULT_TITLE,
  useCalendar,
  useCalendarEvents,
  useEventDraft,
  useRegisterDraftAnchor,
} from "./calendar-provider"
import { EventForm } from "./event-form"

// The ghost a draft draws on the grid, with the form hanging off it. There is
// nothing to press: closing the form is what saves the draft. Escape is the
// way out.
export function EventDraft({
  variant,
  anchored,
  continuesBefore,
  continuesAfter,
  className,
  style,
}: {
  // A block in the time grid, or a pill in a month cell and the all-day row.
  variant: "block" | "chip"
  // The segment the popover hangs off.
  anchored?: boolean
  continuesBefore?: boolean
  continuesAfter?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const { formSide } = useCalendar()
  const {
    draft,
    open,
    pendingScroll,
    consumePendingScroll,
    updateDraft,
    discardDraft,
    commitDraft,
  } = useEventDraft()
  const { calendars } = useCalendarEvents()

  useRegisterDraftAnchor()

  const color =
    calendars.find((calendar) => calendar.id === draft?.calendarId)?.color ??
    "blue"
  const title = draft?.title || DEFAULT_TITLE
  const times =
    draft && !draft.allDay
      ? `${formatTime(draft.start)} – ${formatTime(draft.end)}`
      : null

  const dismissedByEscape = React.useRef(false)
  const el = React.useRef<HTMLDivElement>(null)

  function onOpenChange(value: boolean) {
    if (value) {
      return
    }

    if (dismissedByEscape.current) {
      discardDraft(true)
    } else {
      commitDraft()
    }

    dismissedByEscape.current = false
  }

  // The `+` button draws on the date the route is on, which can be an hour or
  // a month row away from what is on screen.
  React.useEffect(() => {
    if (!anchored || !pendingScroll) {
      return
    }

    consumePendingScroll()
    setTimeout(() =>
      el.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    )
  }, [anchored, pendingScroll, consumePendingScroll])

  return (
    <PopoverPrimitive.Root
      open={!!anchored && open}
      onOpenChange={onOpenChange}
    >
      <div
        ref={el}
        data-draft=""
        aria-hidden="true"
        className={cn(
          "transition-colors select-none",
          eventBlockClasses[color],
          variant === "block"
            ? "absolute z-20 flex flex-col items-start overflow-hidden rounded-xs px-3 py-1 text-start text-xs"
            : "flex min-w-0 items-center gap-1.5 rounded-full px-1.5 py-0.5 text-xs",
          continuesBefore && "rounded-s-none",
          continuesAfter && "rounded-e-none",
          className
        )}
        style={style}
        onPointerDown={(pointer) => pointer.stopPropagation()}
      >
        {variant === "block" && (
          <span
            className={cn(
              "absolute inset-y-1 inset-s-1 w-1 rounded-full",
              calendarDotClasses[color]
            )}
          />
        )}

        <span
          className={cn(
            "truncate font-medium",
            variant === "block" && "w-full"
          )}
        >
          {title}
        </span>

        {times && (
          <span
            className={cn(
              "truncate tabular-nums opacity-80",
              variant === "block" ? "w-full" : "ms-auto shrink-0 text-[11px]"
            )}
          >
            {variant === "block" ? times : formatTime(draft!.start)}
          </span>
        )}
      </div>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={el}
          side={formSide}
          sideOffset={8}
          collisionPadding={16}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            data-slot="popover-content"
            className="z-50 flex w-74 origin-(--transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {draft && (
              <EventForm
                draft={draft}
                onUpdate={updateDraft}
                onEscape={() => {
                  dismissedByEscape.current = true
                  discardDraft(true)
                }}
              />
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
