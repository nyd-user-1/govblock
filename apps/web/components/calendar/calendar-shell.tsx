"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { SidebarProvider } from "@govblock/ui/components/ny4/sidebar"

import { AppSearch } from "./app-search"
import { AppSidebar } from "./app-sidebar"
import { CalendarHeader } from "./calendar-header"
import {
  CalendarProvider,
  useCalendar,
  useEventDraft,
} from "./calendar-provider"
import { MonthView } from "./month-view"
import { WeekView } from "./week-view"

function CalendarLayout({ children }: { children: React.ReactNode }) {
  const { view, isSearchOpen } = useCalendar()
  const { draft } = useEventDraft()
  const pathname = usePathname()

  const [menuOpen, setMenuOpen] = React.useState(false)

  // Everything the menu offers takes over the screen on a phone, so it steps
  // out of the way once one of them is on its way in.
  React.useEffect(() => {
    setMenuOpen(false)
  }, [pathname, draft, isSearchOpen])

  return (
    <div className="container-wrapper flex flex-1 flex-col px-2">
      <SidebarProvider
        className="min-h-min flex-1 items-start px-0 lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] 3xl:fixed:container 3xl:fixed:px-3"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
          } as React.CSSProperties
        }
      >
        <AppSidebar menuOpen={menuOpen} onMenuOpenChange={setMenuOpen} />

        <div className="relative mt-[0.6rem] flex h-[calc(100svh-var(--header-height)-1.2rem)] w-full flex-col overflow-hidden">
          <CalendarHeader onOpenMenu={() => setMenuOpen(true)} />

          <div className="flex min-h-0 flex-1 flex-col">
            {view === "month" ? <MonthView /> : <WeekView key={view} />}
          </div>
        </div>
      </SidebarProvider>

      {children}

      <AppSearch />
    </div>
  )
}

export function CalendarShell({ children }: { children: React.ReactNode }) {
  return (
    <CalendarProvider>
      <CalendarLayout>{children}</CalendarLayout>
    </CalendarProvider>
  )
}
