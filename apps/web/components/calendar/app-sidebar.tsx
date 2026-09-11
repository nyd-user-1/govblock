"use client"

import * as React from "react"

import { SiteRail } from "@/components/home/home-rail"
import { SidebarContent } from "@govblock/ui/components/ny4/sidebar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@govblock/ui/components/nova/sheet"

import { MiniCalendar } from "./mini-calendar"

// The calendar's rail (Brendan, 2026-09-11): the drill-down layer of the
// main rail — the same rail every page wears, with the month at the top. The
// calendars list, the New event button and the user menu that used to sit
// here came out with the change; N still opens a new event and ⌘K the search.
export function CalendarRail() {
  return (
    <SidebarContent className="scrollbar-none overflow-x-hidden">
      <div className="px-3 pt-3">
        <MiniCalendar />
      </div>
      <SiteRail />
    </SidebarContent>
  )
}

/** The same rail as a sheet below `lg`, where the shell's rail has no room. */
export function CalendarMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 lg:hidden">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Calendar navigation</SheetDescription>
        </SheetHeader>
        <CalendarRail />
      </SheetContent>
    </Sheet>
  )
}
