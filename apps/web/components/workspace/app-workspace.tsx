"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { LocksProvider } from "@/components/create/locks"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import { BlockShell, ShellFooterProvider } from "@/components/policy/block-shell"
import { DashboardCustomizer } from "@/components/workspace/dashboard-workspace"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { WorkspaceFooter, WORKSPACES } from "@/components/workspace/workspace-footer"
import { useScope, type ScopeKey } from "@/lib/policy/scope"
import { useUrlSearch, writeUrlParams } from "@/lib/policy/url-state"
import { DropdownMenuItem } from "@govblock/ui/components/dropdown-menu"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /workspace (Brendan, 2026-09-11): Workspace, the root of every workspace path.
// The frame /workspace/dashboard draws — the stage, the customizer that
// chooses the jurisdiction, the shell's footer — with one card per
// workspace on the stage, in the dashboards menu's card: the workspace's
// mark in the tile, its name beneath, the card itself the way in.

const LAYOUT_KEY = "govblock:workspace:app:layout"

/** The workspaces themselves; the root is where we are. */
const ROOMS = WORKSPACES.filter((w) => w.key !== "app")

function AppRail({ search }: { search: string }) {
  const router = useRouter()
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {ROOMS.map((w) => (
              <SidebarMenuItem key={w.key}>
                <SidebarMenuButton onClick={() => router.push(`${w.href}${search}`)}>
                  <w.icon />
                  <span className="flex-1 truncate">{w.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

function AppCards({ search }: { search: string }) {
  const router = useRouter()
  const items = React.useMemo<GridItem[]>(
    () =>
      ROOMS.map((w) => {
        const href = `${w.href}${search}`
        const open = () => router.push(href)
        const share = () => navigator.clipboard?.writeText(`${window.location.origin}${href}`).catch(() => {})
        return {
          key: `app-${w.key}`,
          group: "app",
          media: <w.icon className="size-12 text-muted-foreground" />,
          title: w.label,
          onOpen: open,
          menu: (
            <>
              <DropdownMenuItem onClick={open}>Open</DropdownMenuItem>
              <DropdownMenuItem onClick={share}>Copy link</DropdownMenuItem>
            </>
          ),
        }
      }),
    [search, router]
  )
  return <WorkspaceGrid storageKey={LAYOUT_KEY} items={items} className="flex-1" />
}

function AppWorkspaceInner() {
  const scope = useScope()
  const raw = useUrlSearch()
  const search = typeof raw === "string" ? raw : ""
  // Closed on every load; only the footer's hamburger opens it (Brendan, 2026-09-11).
  const [panelOpen, setPanelOpen] = React.useState(false)
  const setFilters = React.useCallback((patch: Partial<Record<ScopeKey, string>>) => writeUrlParams(patch, { history: "push" }), [])

  const stage = (
    <ShellFooterProvider footer={<WorkspaceFooter mode="app" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)} />}>
      <BlockShell defaultOpen={false} rail={<AppRail search={search} />} sidebarWidth="250px" separatorClassName="mx-1" title={<PathBar crumbs={[APP_CRUMB]} folder onGo={() => {}} />} contentClassName="overflow-y-auto">
        <AppCards search={search} />
      </BlockShell>
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
            <DashboardCustomizer title="Workspace" filters={scope.filters} setFilters={setFilters} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The customizer's fields carry the designer's lock buttons, which read the locks context. */
export function AppWorkspace() {
  return (
    <LocksProvider>
      <AppWorkspaceInner />
    </LocksProvider>
  )
}
