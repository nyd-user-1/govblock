"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { BlockShell } from "@/components/policy/block-shell"

import { AppSearch } from "./app-search"
import { CalendarMenuSheet, CalendarRail } from "./app-sidebar"
import { CalendarHeader } from "./calendar-header"
import {
  CalendarProvider,
  useCalendar,
  useEventDraft,
  type EventSource,
} from "./calendar-provider"
import { useHearingSource } from "./hearing-source"
import { MonthView } from "./month-view"
import { WeekView } from "./week-view"

// /calendar in the shell every workspace item wears (Brendan, 2026-09-11):
// the stage in its rounded frame, the block shell's rail and header across
// it. The rail is the site rail with the month at its top, open on arrival,
// since the rail is what this page is for.

interface ShellProps {
  title?: string
  rail?: React.ReactNode
  base?: string
  useSource?: () => EventSource
  children: React.ReactNode
}

function CalendarLayout({ title = "Calendar", rail = <CalendarRail />, children }: Omit<ShellProps, "base" | "useSource">) {
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
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--gap:--spacing(4)] md:[--gap:--spacing(6)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)]">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell defaultOpen rail={rail} title={title} contentClassName="overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col">
                <CalendarHeader onOpenMenu={() => setMenuOpen(true)} />
                <div className="flex min-h-0 flex-1 flex-col">
                  {view === "month" ? <MonthView /> : <WeekView key={view} />}
                </div>
              </div>
            </BlockShell>
          </div>
        </div>
      </div>

      <CalendarMenuSheet open={menuOpen} onOpenChange={setMenuOpen}>
        {rail}
      </CalendarMenuSheet>

      {children}

      <AppSearch />
    </div>
  )
}

// /calendar by default; /posts hands in its own source, route and rail.
export function CalendarShell({ base, useSource = useHearingSource, children, ...layout }: ShellProps) {
  return (
    <CalendarProvider base={base} useSource={useSource}>
      <CalendarLayout {...layout}>{children}</CalendarLayout>
    </CalendarProvider>
  )
}
