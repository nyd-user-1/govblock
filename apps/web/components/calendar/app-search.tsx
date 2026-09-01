"use client"

import * as React from "react"
import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  CalendarIcon,
  CalendarRangeIcon,
  CheckIcon,
  PlusIcon,
} from "lucide-react"

import { calendarDotClasses } from "@/lib/calendar/calendars"
import { formatFullDate, toCalendarDate, todayDate } from "@/lib/calendar/dates"
import type { CalendarView } from "@/lib/calendar/types"
import { cn } from "@govblock/ui/lib/utils"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@govblock/ui/components/nova/command"

import {
  useCalendar,
  useCalendarEvents,
  useEventDraft,
} from "./calendar-provider"

const VIEWS: {
  label: string
  value: CalendarView
  icon: React.ComponentType<{ className?: string }>
  kbd: string
}[] = [
  { label: "Day", value: "day", icon: CalendarRangeIcon, kbd: "D" },
  { label: "Week", value: "week", icon: CalendarDaysIcon, kbd: "W" },
  { label: "Month", value: "month", icon: CalendarIcon, kbd: "M" },
]

export function AppSearch() {
  const { view, date, pathFor, navigate, isSearchOpen, setSearchOpen } =
    useCalendar()
  const { createAtAnchor } = useEventDraft()
  const { events, calendars, hiddenCalendars, toggleCalendar } =
    useCalendarEvents()

  function run(action: () => void) {
    setSearchOpen(false)
    action()
  }

  return (
    <CommandDialog
      open={isSearchOpen}
      onOpenChange={setSearchOpen}
      title="Search"
      description="Search events, switch views..."
      className="sm:max-w-2xl"
    >
      <CommandInput placeholder="Search events, switch views..." />
      <CommandList className="h-full max-h-96">
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup>
          <CommandItem onSelect={() => run(createAtAnchor)}>
            <PlusIcon />
            New event
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => run(() => navigate(pathFor(todayDate())))}
          >
            <CalendarCheckIcon />
            Go to today
            <CommandShortcut>T</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Views">
          {VIEWS.map((item) => (
            <CommandItem
              key={item.value}
              value={`view ${item.label}`}
              onSelect={() => run(() => navigate(pathFor(date, item.value)))}
            >
              <item.icon />
              {item.label}
              {view === item.value && (
                <CheckIcon className="ml-auto text-muted-foreground" />
              )}
              <CommandShortcut>{item.kbd}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Toggling keeps the palette open, the way the template's does. */}
        <CommandGroup heading="Calendars">
          {calendars.map((calendar) => (
            <CommandItem
              key={calendar.id}
              value={`calendar ${calendar.name}`}
              onSelect={() => toggleCalendar(calendar.id)}
            >
              <span
                className={cn(
                  "mx-1 size-2 rounded-full",
                  calendarDotClasses[calendar.color]
                )}
              />
              {calendar.name}
              {!hiddenCalendars.includes(calendar.id) && (
                <CheckIcon className="ml-auto text-muted-foreground" />
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Events">
          {events.map((event) => (
            <CommandItem
              key={event.id}
              value={`${event.title} ${event.id}`}
              onSelect={() =>
                run(() =>
                  navigate(pathFor(toCalendarDate(new Date(event.start))))
                )
              }
            >
              <span
                className={cn(
                  "mx-1 size-2 shrink-0 rounded-full",
                  calendarDotClasses[
                    calendars.find(
                      (calendar) => calendar.id === event.calendarId
                    )?.color ?? "blue"
                  ]
                )}
              />
              <span className="truncate">{event.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {formatFullDate(new Date(event.start))}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
