"use client"

import * as React from "react"

import { calendarCheckboxClasses } from "@/lib/calendar/calendars"
import { stateName } from "@/lib/filters"
import type { StateRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { cn } from "@govblock/ui/lib/utils"
import { Checkbox } from "@govblock/ui/components/nova/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@govblock/ui/components/nova/select"

import { useCalendarEvents } from "./calendar-provider"

export function CalendarList() {
  const { calendars, hiddenCalendars, toggleCalendar, state, setState } =
    useCalendarEvents()
  const { data: states } = usePolicy<StateRow[]>("states")
  const items = React.useMemo(
    () =>
      (states ?? [{ state, bills: 0, latest_year: 0, sessions: 0 }]).map(
        (row) => ({
          value: row.state,
          label: stateName(row.state),
        })
      ),
    [states, state]
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">
        Jurisdiction
      </div>
      <Select
        items={items}
        value={state}
        onValueChange={(next) => next && setState(String(next))}
      >
        <SelectTrigger size="sm" className="mb-3 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">
        Calendars
      </div>
      {calendars.map((calendar) => (
        <label
          key={calendar.id}
          className="flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm font-medium hover:bg-muted"
        >
          <Checkbox
            checked={!hiddenCalendars.includes(calendar.id)}
            onCheckedChange={() => toggleCalendar(calendar.id)}
            className={cn(
              "rounded-[4px]",
              calendarCheckboxClasses[calendar.color]
            )}
          />
          {calendar.name}
        </label>
      ))}
    </div>
  )
}
