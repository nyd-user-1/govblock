"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { AccountFooter } from "@/components/admin/account-footer"
import { CALENDARS, CalendarMonth, CalendarSide, useCalendar, type Calendar } from "@/components/admin/pages/calendar"
import { LegislativeFields } from "@/components/create/fields"
import { LocksProvider } from "@/components/create/locks"
import { BlockShell, ShellFooterProvider } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { useLocal } from "@/lib/policy/use-local"
import { useScope, type ScopeKey } from "@/lib/policy/scope"
import { writeUrlParams } from "@/lib/policy/url-state"
import { Card, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { FieldGroup } from "@govblock/ui/components/nova/field"
import { SidebarContent, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /workspace/calendar (Brendan, 2026-09-07): the dashboard's Calendar page —
// paceui's calendar app on the record's hearings, the month grid, the mini
// calendar and the kinds of event in its own left column — as it is, placed
// in the workspace's shell: the stage, the customizer of legislative fields,
// the shell's footer with the hamburger and the mode. The rail wears the
// dashboard rail's header and account block, starts closed, and holds the
// mini calendar and the list of calendars (Brendan's capture,
// workspace-calendar.html, 2026-09-07); the month has the stage to itself.

function CalendarRail({ cal }: { cal: Calendar }) {
  const router = useRouter()
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <Link href="/workspace/calendar" className="flex items-center gap-2.5">
          <p className="text-xl font-semibold">Calendar</p>
        </Link>
      </SidebarHeader>
      {/* Brendan, 2026-09-07, from his capture: the dashboard card's mini calendar and list of calendars, in the rail. */}
      <SidebarContent className="no-scrollbar">
        <CalendarSide cal={cal} className="px-4 py-2" />
      </SidebarContent>
      <AccountFooter go={(page) => router.push(dashboardHref(page))} />
    </>
  )
}

function CalendarCustomizer({ filters, setFilters }: { filters: ReturnType<typeof useScope>["filters"]; setFilters: (patch: Partial<Record<ScopeKey, string>>) => void }) {
  return (
    <Card className="dark isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)" size="sm">
      <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
        <CardTitle className="text-base">Calendar</CardTitle>
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px max-md:px-3 md:flex-col md:gap-3.25">
          <LegislativeFields filters={filters} setFilters={setFilters} />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function CalendarWorkspaceInner() {
  const scope = useScope()
  const cal = useCalendar(CALENDARS)
  const [panelOpen, setPanelOpen] = useLocal("govblock:workspace:calendar:customizer", false)
  const setFilters = React.useCallback((patch: Partial<Record<ScopeKey, string>>) => writeUrlParams(patch, { history: "push" }), [])
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <ShellFooterProvider footer={<WorkspaceFooter mode="calendar" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)} />}>
              <BlockShell defaultOpen={false} rail={<CalendarRail cal={cal} />} sidebarWidth="250px" separatorClassName="mx-1" title="Calendar">
                <div className="flex flex-1 flex-col p-4">
                  <CalendarMonth cal={cal} className="min-h-[70vh]" />
                </div>
              </BlockShell>
            </ShellFooterProvider>
          </div>
        </div>
        <div
          aria-hidden={!panelOpen}
          className={cn(
            "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out md:w-(--customizer-width)",
            !panelOpen && "max-md:hidden md:pointer-events-none md:-mr-(--gap) md:w-0! md:opacity-0"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col md:w-(--customizer-width)">
            <CalendarCustomizer filters={scope.filters} setFilters={setFilters} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The customizer's fields carry the designer's lock buttons, which read the locks context. */
export function CalendarWorkspace() {
  return (
    <LocksProvider>
      <CalendarWorkspaceInner />
    </LocksProvider>
  )
}
