"use client"

import * as React from "react"

import { stateName } from "@/lib/filters"
import type { LiveEvent } from "@/lib/policy/live-stream"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import { LiveStream } from "@/components/live/live-stream"
import { FlagChip } from "@/components/policy/imagery"
import { BlockShell } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /live (Brendan, 2026-09-15): /map's shell with the Live Stream on the stage.
// The rail lists the jurisdictions in the stream and narrows it to one; the
// footer's hamburger opens and closes the rail. Congress is read as it
// publishes, so the feed is asked for every thirty seconds.

const POLL = 30 * 1000
const RETRY = 5000

export function LiveWorkspace() {
  const [railOpen, setRailOpen] = React.useState(false)
  const [events, setEvents] = React.useState<LiveEvent[] | undefined>(undefined)
  const [jurisdiction, setJurisdiction] = React.useState<string | null>(null)

  // A failed read (the cluster waking, a first compile) tries again in five
  // seconds rather than waiting out the poll.
  React.useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const read = async () => {
      let ok = false
      try {
        const r = await fetch("/api/live")
        const j = r.ok ? ((await r.json()) as { events?: LiveEvent[] }) : null
        if (alive && j?.events) {
          setEvents(j.events)
          ok = true
        }
      } catch {}
      if (alive) timer = setTimeout(read, ok ? POLL : RETRY)
    }
    void read()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  // Congress first, then the states by name.
  const jurisdictions = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events ?? []) counts.set(e.state, (counts.get(e.state) ?? 0) + 1)
    return [...counts.entries()].sort(([a], [b]) => (a === "US" ? -1 : b === "US" ? 1 : stateName(a).localeCompare(stateName(b))))
  }, [events])

  const rail = (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Jurisdictions</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {jurisdictions.map(([code, count]) => (
              <SidebarMenuItem key={code}>
                <SidebarMenuButton isActive={jurisdiction === code} onClick={() => setJurisdiction((j) => (j === code ? null : code))}>
                  <FlagChip state={code} width={20} />
                  <span className="flex-1 truncate">{stateName(code)}</span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="tabular-nums">{count}</SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )

  const footer = <WorkspaceFooter mode="live" panelOpen={railOpen} onTogglePanel={() => setRailOpen((open) => !open)} />

  return (
    <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--gap:--spacing(4)] md:[--gap:--spacing(6)]")}>
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell
              open={railOpen}
              onOpenChange={setRailOpen}
              rail={rail}
              title={<PathBar crumbs={[APP_CRUMB, { label: "Live" }]} folder onGo={() => {}} />}
              footer={footer}
              contentClassName="overflow-hidden"
            >
              <div className="h-full w-full p-4">
                <LiveStream events={events} jurisdiction={jurisdiction} />
              </div>
            </BlockShell>
          </div>
        </div>
      </div>
    </div>
  )
}
