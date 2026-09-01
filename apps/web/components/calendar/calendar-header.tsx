"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon } from "lucide-react"

import { todayDate } from "@/lib/calendar/dates"
import type { CalendarView } from "@/lib/calendar/types"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Kbd } from "@govblock/ui/components/nova/kbd"
import { Tabs, TabsList, TabsTrigger } from "@govblock/ui/components/nova/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@govblock/ui/components/nova/tooltip"

import { useCalendar } from "./calendar-provider"
import { HEADER_TOTAL } from "./chrome"

const VIEWS: { label: string; value: CalendarView }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
]

export function CalendarHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const {
    view,
    date,
    title,
    monthLabelsVisible,
    prevDate,
    nextDate,
    pathFor,
    navigate,
    setDirection,
  } = useCalendar()

  return (
    // Floating over the views so their content scrolls behind the blur.
    <header
      className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 border-b border-border bg-background/80 px-4 pt-2 backdrop-blur-md sm:gap-4"
      style={{ height: `${HEADER_TOTAL}px` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Open menu"
          className="shrink-0 rounded-full lg:hidden"
          onClick={onOpenMenu}
        >
          <MenuIcon />
        </Button>

        {/* The month view slides its own copy of this title over the top
            while it scrolls, so this one steps aside for as long as they are
            up. */}
        <h1
          className={cn(
            "flex min-w-0 flex-1 items-baseline gap-1.5 text-xl tracking-tight transition-opacity duration-0 sm:text-2xl",
            view === "month" && monthLabelsVisible
              ? "opacity-0 delay-150"
              : "opacity-100"
          )}
        >
          <span className="truncate font-bold text-foreground">
            {title.months}
          </span>
          <span className="hidden font-normal text-muted-foreground sm:inline">
            {title.year}
          </span>
        </h1>
      </div>

      <Tabs
        value={view}
        onValueChange={(value) =>
          navigate(pathFor(date, value as CalendarView))
        }
        className="mx-auto w-20 sm:w-42 lg:w-48"
      >
        <TabsList className="w-full rounded-full **:data-[slot=tabs-trigger]:rounded-full">
          {VIEWS.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="p-1 lg:p-1.5"
            >
              <span className="sm:hidden">{item.label.charAt(0)}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-end gap-2 md:flex-1">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label="Previous"
                  className="rounded-full"
                  render={<Link href={pathFor(prevDate)} />}
                  nativeButton={false}
                  onClick={() => setDirection("left")}
                />
              }
            >
              <ChevronLeftIcon />
            </TooltipTrigger>
            <TooltipContent>
              Previous <Kbd>←</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="secondary"
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                  render={<Link href={pathFor(todayDate())} />}
                  nativeButton={false}
                />
              }
            >
              Today
            </TooltipTrigger>
            <TooltipContent>
              Today <Kbd>T</Kbd>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon-sm"
                  aria-label="Next"
                  className="rounded-full"
                  render={<Link href={pathFor(nextDate)} />}
                  nativeButton={false}
                  onClick={() => setDirection("right")}
                />
              }
            >
              <ChevronRightIcon />
            </TooltipTrigger>
            <TooltipContent>
              Next <Kbd>→</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
