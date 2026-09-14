"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, FolderIcon, LockIcon, PlusIcon } from "lucide-react"

import { doorHref } from "@/lib/entitlements"
import { stateName } from "@/lib/filters"
import { fmtBill, fmtNumber, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { typesetHref } from "@/lib/typeset/views"
import { accessTo, DATASETS } from "@/lib/workspace/datasets"
import { buildWorkspacePath } from "@/lib/workspace/path"
import { pinKey, useWorkspacePins, type WorkspacePin } from "@/lib/workspace/pins"
import { LocksProvider } from "@/components/create/locks"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import { BlockShell, ShellFooterProvider } from "@/components/policy/block-shell"
import { ChamberSeal } from "@/components/policy/imagery"
import { AddToWorkspace, EmptySlot } from "@/components/workspace/add-to-workspace"
import { DashboardCustomizer } from "@/components/workspace/dashboard-workspace"
import { Seal } from "@/components/workspace/dataset-grid"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { WorkspaceFooter, WORKSPACES } from "@/components/workspace/workspace-footer"
import { useScope, type ScopeKey } from "@/lib/policy/scope"
import { useUrlSearch, writeUrlParams } from "@/lib/policy/url-state"
import { Button } from "@govblock/ui/components/button"
import { DropdownMenuItem } from "@govblock/ui/components/dropdown-menu"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /workspace (Brendan, 2026-09-11): Workspace, the root of every workspace path.
// The frame /workspace/dashboard draws — the stage, the customizer that
// chooses the jurisdiction, the shell's footer — with one card per
// workspace on the stage, in the dashboards menu's card: the workspace's
// mark in the tile, its name beneath, the card itself the way in.
//
// Above the surfaces, the reader's own cards (Brendan, 2026-09-13): a bill,
// a session, a dataset, added from the + on any card in the data or from the
// empty slots here — the home page's dashed tiles, the whole first row of
// them until the first card lands, then whatever finishes the row.

const LAYOUT_KEY = "govblock:workspace:app:layout"
const PINS_LAYOUT_KEY = "govblock:workspace:app:pins:layout"
const COLUMNS = 4

/** The surfaces themselves; the root is where we are. */
const SURFACES = WORKSPACES.filter((w) => w.key !== "app")

function AppRail({ search }: { search: string }) {
  const router = useRouter()
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {SURFACES.map((w) => (
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

const EMPTY_LOCATION = { at: "", committee: "", member: "", bill: "", rollcall: "" }

/** The reader's cards, drawn the way their own grids draw them. */
function PinnedCards() {
  const router = useRouter()
  const workspace = useWorkspacePins()
  const { reader } = useJurisdiction()

  const items = React.useMemo<GridItem[]>(() => {
    const out: GridItem[] = []
    for (const pin of workspace.pins) {
      const key = pinKey(pin)
      if (pin.kind === "dataset") {
        const d = DATASETS.find((x) => x.key === pin.key)
        if (!d) continue
        const access = accessTo(d, reader)
        const open = access === "open"
        const path = d.state && d.chamber ? buildWorkspacePath({ state: d.state, chamber: d.chamber, session: null, location: { ...EMPTY_LOCATION, at: "sessions" } }) : (d.href ?? null)
        const go = open && path ? () => router.push(path) : open ? undefined : () => router.push(doorHref(access))
        out.push({
          key,
          group: "pins",
          badge: open ? (
            <span title="Open">
              <CheckIcon className="size-4 text-emerald-500" aria-label="Open" />
            </span>
          ) : (
            <span title={access === "plan" ? "Waits on a paid plan" : "Sign in to open it"}>
              <LockIcon className="size-4" aria-label="Locked" />
            </span>
          ),
          media: <Seal seal={d.seal} />,
          title: d.title,
          onOpen: go,
          workspace: pin,
          menu: (
            <DropdownMenuItem disabled={!go} onClick={go}>
              Open
            </DropdownMenuItem>
          ),
        })
      } else if (pin.kind === "session") {
        const path = buildWorkspacePath({ state: pin.state, chamber: pin.chamber || null, session: pin.session, location: EMPTY_LOCATION })
        const go = () => router.push(path)
        out.push({
          key,
          group: "pins",
          media: <FolderIcon className="size-12 text-muted-foreground" />,
          title: pin.title,
          meta: [`${stateName(pin.state)} ${pin.chamber}`.trim(), pin.bills != null ? `${fmtNumber(pin.bills)} items` : null].filter(Boolean).join(" · "),
          onOpen: go,
          workspace: pin,
          menu: <DropdownMenuItem onClick={go}>Open</DropdownMenuItem>,
        })
      } else {
        const path = buildWorkspacePath({ state: pin.state, chamber: pin.chamber, session: pin.session, location: { ...EMPTY_LOCATION, bill: String(pin.billId) }, number: pin.number })
        const go = () => router.push(path)
        out.push({
          key,
          group: "pins",
          media: <ChamberSeal state={pin.state} chamber={pin.chamber} size={96} />,
          title: fmtBill(pin.number, pin.state),
          description: truncate(pin.title, 140),
          meta: [stateName(pin.state), pin.session ? String(pin.session) : null].filter(Boolean).join(" · "),
          onOpen: go,
          workspace: pin,
          menu: (
            <>
              <DropdownMenuItem onClick={go}>Open Bill</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(typesetHref(pin.billId))}>Typeset</DropdownMenuItem>
            </>
          ),
        })
      }
    }
    return out
  }, [workspace.pins, reader, router])

  // The empty slots: the whole first row until a card lands, then whatever finishes the last row (the home page's rule).
  const used = items.length % COLUMNS
  const blanks = items.length === 0 ? COLUMNS : used === 0 ? 0 : COLUMNS - used

  return (
    <WorkspaceGrid
      storageKey={PINS_LAYOUT_KEY}
      items={items}
      // Its own height, not a share of the shell's: the surfaces' grid below claims the full height, and a flex child that may shrink would collapse to its padding and hide the row behind it.
      className="min-h-0 shrink-0 pb-0"
      slots={Array.from({ length: blanks }, (_, i) => (
        <EmptySlot key={`slot-${i}`} have={workspace.has} onAdd={workspace.add} />
      ))}
    />
  )
}

function AppCards({ search }: { search: string }) {
  const router = useRouter()
  const items = React.useMemo<GridItem[]>(
    () =>
      SURFACES.map((w) => {
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

/** The header's +: the same panel the empty slots open, for a row that is already full. */
function AddButton() {
  const workspace = useWorkspacePins()
  return (
    <AddToWorkspace
      align="end"
      have={workspace.has}
      onAdd={workspace.add}
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label="Add a card" title="Add a card">
          <PlusIcon />
        </Button>
      }
    />
  )
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
      <BlockShell defaultOpen={false} rail={<AppRail search={search} />} sidebarWidth="250px" separatorClassName="mx-1" title={<PathBar crumbs={[APP_CRUMB]} folder onGo={() => {}} />} actions={<AddButton />} contentClassName="overflow-y-auto">
        <PinnedCards />
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
