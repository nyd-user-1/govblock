"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { BarChart3Icon, FileTextIcon, HomeIcon, LayoutDashboardIcon, LayoutGridIcon } from "lucide-react"

import { useScope, type ScopeKey } from "@/lib/policy/scope"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { readSort, sortRows } from "@/lib/workspace/sort"
import { LegislativeFields } from "@/components/create/fields"
import { LocksProvider } from "@/components/create/locks"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import type { Look } from "@/components/create/folder-view"
import { BlockShell, ShellFooterProvider } from "@/components/policy/block-shell"
import { BLOCKS, GROUP_LABEL, findBlock, type BlockEntry, type BlockGroup } from "@/components/workspace/blocks-catalogue"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { DemoBillProvider } from "@/components/workspace/demo-bill"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { Card, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { FieldGroup } from "@govblock/ui/components/nova/field"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /workspace/blocks (Brendan, 2026-09-07): the site's own parts as a
// catalogue, in the frame /workspace/data draws. Every block is a card on the
// standard grid at the size it needs, live; the Card | Table toggle in the
// header; the rail jumps to the groups; the customizer is the jurisdiction
// and the filters the blocks read. A block alone is /workspace/blocks/{slug}.

export const BLOCKS_ROOT = "/workspace/blocks"

const GROUPS: { key: BlockGroup; icon: typeof HomeIcon }[] = [
  { key: "home", icon: HomeIcon },
  { key: "analytics", icon: BarChart3Icon },
  { key: "dashboard", icon: LayoutDashboardIcon },
  { key: "bill", icon: FileTextIcon },
]

function BlocksRail() {
  const jump = (group: string) => document.querySelector(`[data-slot=workspace-grid] [data-group=${group}]`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Blocks · {BLOCKS.length}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {GROUPS.map((g) => {
              const Icon = g.icon
              return (
                <SidebarMenuItem key={g.key}>
                  <SidebarMenuButton onClick={() => jump(g.key)}>
                    <Icon />
                    <span className="flex-1 truncate">{GROUP_LABEL[g.key]}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{BLOCKS.filter((b) => b.group === g.key).length}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

function BlocksCustomizer({ filters, setFilters }: { filters: ReturnType<typeof useScope>["filters"]; setFilters: (patch: Partial<Record<ScopeKey, string>>) => void }) {
  return (
    <Card className="dark isolate z-10 max-h-full min-h-0 w-full self-start rounded-2xl bg-card/90 backdrop-blur-xl md:w-(--customizer-width)" size="sm">
      <CardHeader className="hidden items-center justify-between gap-2 border-b md:flex">
        <CardTitle className="text-base">Blocks</CardTitle>
      </CardHeader>
      <CardContent className="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden max-md:px-0 md:overflow-y-auto">
        <FieldGroup className="flex-row gap-2.5 py-px max-md:px-3 md:flex-col md:gap-3.25">
          <LegislativeFields filters={filters} setFilters={setFilters} />
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

function BlocksTable({ rows, onOpen }: { rows: BlockEntry[]; onOpen: (b: BlockEntry) => void }) {
  return (
    <div className="m-4 overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Block</TableHead>
            <TableHead>Group</TableHead>
            <TableHead className="text-right">Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.slug} className="group/row cursor-pointer" onClick={() => onOpen(b)}>
              <TableCell className="max-w-0">
                <span className="flex items-center gap-2.5 font-medium">
                  <LayoutGridIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate group-hover/row:text-primary group-hover/row:underline">{b.title}</span>
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{GROUP_LABEL[b.group]}</TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {b.size.cols}×{b.size.rows}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function toggleFor(current: Look, set: (next: Look) => void) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {(["cards", "table"] as Look[]).map((value) => (
        <button key={value} type="button" data-active={current === value} onClick={() => set(value)} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
          {value === "table" ? "Table" : "Card"}
        </button>
      ))}
    </div>
  )
}

function BlocksWorkspaceInner({ slug }: { slug?: string }) {
  const router = useRouter()
  const scope = useScope()
  const params = useUrlParams(["look", "sort"] as const)
  // Closed on every load; only the footer's hamburger opens it (Brendan, 2026-09-11).
  const [panelOpen, setPanelOpen] = React.useState(false)
  const setFilters = React.useCallback((patch: Partial<Record<ScopeKey, string>>) => writeUrlParams(patch, { history: "push" }), [])
  const look: Look = params.look === "table" ? "table" : "cards"
  const setLook = (next: Look) => writeUrlParams({ look: next === "table" ? "table" : null }, { history: "replace" })
  const open = React.useCallback((b: BlockEntry) => router.push(`${BLOCKS_ROOT}/${b.slug}${window.location.search}`), [router])
  const home = React.useCallback(() => router.push(`${BLOCKS_ROOT}${window.location.search}`), [router])

  const block = slug ? findBlock(slug) : undefined
  const sort = readSort(params.sort)
  const ordered = React.useMemo(() => sortRows(BLOCKS, sort, { name: (b) => b.title, kind: (b) => b.group, time: () => null }), [sort])

  const items = React.useMemo<GridItem[]>(
    () =>
      // The block itself is the cell (Brendan, 2026-09-07): no chrome of the grid's around it.
      ordered.map((b) => ({
        key: `block-${b.slug}`,
        group: b.group,
        media: b.render(),
        bare: true,
        ownMenu: b.ownMenu,
        docs: `/docs/blocks/${b.slug}`,
        title: b.title,
        defaultSize: b.size,
      })),
    [ordered, open]
  )

  const crumbs = block ? [APP_CRUMB, { label: "Blocks", go: { at: "root" } }, { label: block.title }] : [APP_CRUMB, { label: "Blocks" }]
  const stage = (
    <ShellFooterProvider footer={<WorkspaceFooter mode="blocks" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} />}>
      <BlockShell defaultOpen={false} rail={<BlocksRail />} title={<PathBar crumbs={crumbs} folder={!block} onGo={home} />} actions={block ? undefined : toggleFor(look, setLook)} contentClassName="overflow-y-auto bg-muted dark:bg-background">
        <DemoBillProvider>
          {block ? (
            <div className="flex flex-1 items-start justify-center p-6">
              <div className={cn("w-full", block.size.cols >= 2 ? "max-w-4xl" : "max-w-md")}>{block.render()}</div>
            </div>
          ) : look === "table" ? (
            <BlocksTable rows={ordered} onOpen={open} />
          ) : (
            <WorkspaceGrid storageKey="govblock:workspace:blocks" items={items} keepOrder={!!sort} />
          )}
        </DemoBillProvider>
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
            <BlocksCustomizer filters={scope.filters} setFilters={setFilters} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The customizer's fields carry the designer's lock buttons, which read the locks context. */
export function BlocksWorkspace({ slug }: { slug?: string }) {
  return (
    <LocksProvider>
      <BlocksWorkspaceInner slug={slug} />
    </LocksProvider>
  )
}
