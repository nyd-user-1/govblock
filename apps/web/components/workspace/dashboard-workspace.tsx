"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { AdminStage } from "@/components/admin/admin-stage"
import { LegislativeFields } from "@/components/create/fields"
import { LocksProvider } from "@/components/create/locks"
import { ShellFooterProvider } from "@/components/policy/block-shell"
import { DashboardMenu } from "@/components/workspace/dashboard-menu"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { useLocal } from "@/lib/policy/use-local"
import { useScope, type ScopeKey } from "@/lib/policy/scope"
import { writeUrlParams } from "@/lib/policy/url-state"
import { dashboardHref } from "@/lib/workspace/dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { FieldGroup } from "@govblock/ui/components/nova/field"
import { cn } from "@govblock/ui/lib/utils"

// /workspace/dashboard (Brendan, 2026-09-07): the Admin experience, moved
// under the workspace. The same frame /workspace/data draws — the stage on
// the left, the customizer on the right, the shell's footer with the
// hamburger and the mode — with the Admin rail and pages on the stage. The
// bare route is the menu of every dashboard; each page is its own route,
// so the rail navigates the router rather than an `at=` parameter. The
// customizer is the jurisdiction and the filters the pages read, as the
// Data variant of /create's, and opens closed. So does the rail (Brendan,
// 2026-09-07: "I want the page to load with the sidebar defaulted closed").

function DashboardCustomizer({ filters, setFilters }: { filters: ReturnType<typeof useScope>["filters"]; setFilters: (patch: Partial<Record<ScopeKey, string>>) => void }) {
  return (
    <Card className="dark isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)" size="sm">
      <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
        <CardTitle className="text-base">Dashboards</CardTitle>
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px max-md:px-3 md:flex-col md:gap-3.25">
          <LegislativeFields filters={filters} setFilters={setFilters} />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function DashboardWorkspaceInner({ page }: { page?: string }) {
  const router = useRouter()
  const scope = useScope()
  const [panelOpen, setPanelOpen] = useLocal("govblock:workspace:dashboard:customizer", false)
  const setFilters = React.useCallback((patch: Partial<Record<ScopeKey, string>>) => writeUrlParams(patch, { history: "push" }), [])
  // The rail moves the router, carrying the jurisdiction and filters along.
  const go = React.useCallback((next: string) => router.push(dashboardHref(next, window.location.search)), [router])
  // The menu is no page of the rail's, so nothing in it lights up.
  const stagePage = page == null ? "menu" : page

  const stage = (
    <ShellFooterProvider footer={<WorkspaceFooter mode="dashboards" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)} />}>
      <AdminStage page={stagePage} onGo={go} railOpen={false} title={page == null ? "Dashboards" : undefined} content={page == null ? <DashboardMenu /> : undefined} />
    </ShellFooterProvider>
  )

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">{stage}</div>
        </div>
        <div
          aria-hidden={!panelOpen}
          className={cn(
            "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out md:w-(--customizer-width)",
            !panelOpen && "max-md:hidden md:pointer-events-none md:-mr-(--gap) md:w-0! md:opacity-0"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col md:w-(--customizer-width)">
            <DashboardCustomizer filters={scope.filters} setFilters={setFilters} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The customizer's fields carry the designer's lock buttons, which read the locks context. */
export function DashboardWorkspace({ page }: { page?: string }) {
  return (
    <LocksProvider>
      <DashboardWorkspaceInner page={page} />
    </LocksProvider>
  )
}
