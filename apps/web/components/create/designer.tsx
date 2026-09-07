"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowUpIcon } from "lucide-react"

import { isFile, isSpecial, listing, locate, monthName, type Location, type Target } from "@/lib/create/path"
import { decodePreset, DEFAULT_DESIGN, DESIGN_KEYS, DESIGN_OPTIONS, presetToParams, readDesign, type Design, type Preset } from "@/lib/create/preset"
import { STATE_NAMES, stateName } from "@/lib/filters"
import { honorific, truncate } from "@/lib/format"
import { SCOPE_KEYS, useScope, useSessionTitle, type ScopeKey } from "@/lib/policy/scope"
import type { Bill, Member } from "@/lib/policy/types"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { Customizer } from "@/components/create/customizer"
import { FileActions, type BillView } from "@/components/create/file-actions"
import { FileView } from "@/components/create/file-view"
import { FolderView, type Look } from "@/components/create/folder-view"
import { LocksProvider, useLocks } from "@/components/create/locks"
import { PathBar, type Crumb } from "@/components/create/path-bar"
import { type Mode } from "@/components/create/main-menu"
import { RevealFx } from "@/components/create/reveal-fx"
import { type Stage } from "@/components/create/stage-switcher"
import { legislatureName, Tree } from "@/components/create/tree"
import { AdminStage } from "@/components/admin/admin-stage"
import { BlockShell, ShellFooterProvider } from "@/components/policy/block-shell"
import { chambersOf } from "@/lib/workspace/datasets"
import { applyTarget, buildWorkspacePath, roomPath, WORKSPACE_DATA, type Room } from "@/lib/workspace/path"
import { DatasetGrid, DatasetRail } from "@/components/workspace/dataset-grid"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { FecExplorer } from "@/components/policy/fec-explorer"
import { FormsList } from "@/components/policy/forms-list"
import { blockComponents } from "@/registry/blocks"
import { Button } from "@govblock/ui/components/nova/button"
import { SidebarContent, SidebarGroup, SidebarGroupLabel } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /create — a repository browser over a legislature. Brendan, 2026-09-03: the
// jurisdiction is the organization, the session is the repository, and every
// bill, member and committee is a branch inside it. The customizer's keys are
// the URL — state, session, committee, member, bill — plus `at` for the
// listing and `rollcall` for a roll call, so the rail, the customizer and the
// address bar are one location, never three.
//
// /create opens on Congress, current session, every time. Going anywhere
// else is what the customizer is for.

const URL_KEYS = [...SCOPE_KEYS, ...DESIGN_KEYS, "at", "rollcall", "tab", "doc", "look", "preset", "mode", "fork", "all"] as const

// The workspace (Brendan, 2026-09-07): the same browser, with the location
// in the path — /workspace/data/us/house/2025/bill/hb9329 — instead of the
// query keys. The datasets grid is its root. A page under /workspace hands
// the designer its route; the state, session and chamber in it reach every
// hook through PathScopeContext, set by the route component.
export type DesignerRoute =
  | { datasets: true; room?: undefined }
  | { datasets?: false; room: Room }
  | { datasets?: false; room?: undefined; state: string; chamber: string; session: number | null; location: Location; /** A bill number or committee slug still resolving. */ pending?: boolean }

function DesignerInner({ route }: { route?: DesignerRoute }) {
  const router = useRouter()
  const params = useUrlParams(URL_KEYS)
  const workspace = !!route
  const routeNode = route && !route.datasets && !route.room ? route : null
  const room = route?.room ?? null
  // Documents is Forms with `all`; the room says so where the query used to.
  const all = room === "documents" ? "1" : params.all
  const scope = useScope()
  const { locks } = useLocks()
  const sessionTitle = useSessionTitle(scope.state, scope.session)
  const [picked, setMode] = React.useState<Mode | null>(null)
  const mode: Mode = picked ?? (params.mode === "design" ? "design" : "state")
  const [panelOpen, setPanelOpen] = useLocal("govblock:create:customizer", true)
  // The Admin experience opens with the customizer off screen (Brendan,
  // 2026-09-06: "I want all admin pages to load with the customizer off
  // screen"). The FAB brings it back for anyone who wants it.
  const isAdmin = params.at === "admin" || params.at.startsWith("admin/")
  React.useEffect(() => {
    if (isAdmin) setPanelOpen(false)
  }, [isAdmin, setPanelOpen])
  // The look lives in the URL alone (Brendan, 2026-09-04: Canvas set the
  // cards look and a `look=table` left in the address bar overruled it).
  // Cards are the default on every page (Brendan, 2026-09-07); `look=table` is the table.
  const look: Look = params.look === "table" ? "table" : "cards"
  const setLook = React.useCallback((next: Look) => writeUrlParams({ look: next === "table" ? "table" : null }, { history: "replace" }), [])

  const design = React.useMemo(() => readDesign(params), [params])
  const location = React.useMemo<Location>(() => (routeNode ? routeNode.location : room ? { at: room === "documents" ? "forms" : room, committee: "", member: "", bill: "", rollcall: "" } : { at: params.at, committee: params.committee, member: params.member, bill: params.bill, rollcall: params.rollcall }), [routeNode, room, params.at, params.committee, params.member, params.bill, params.rollcall])
  const node = React.useMemo(() => locate(location), [location])

  // Congress, current session, every time: a bare /create writes the state
  // in, so the remembered jurisdiction never decides what this page opens on.
  // The datasets it used to open on live at /workspace/data now (Brendan,
  // 2026-09-07). Read off the address bar itself — the first client render
  // still carries the server's empty params, and a stale "" must not
  // overwrite a real state.
  React.useEffect(() => {
    if (workspace) return
    const live = new URLSearchParams(window.location.search)
    if (live.get("preset")) return
    if (!live.get("state")) writeUrlParams({ state: "US" }, { history: "replace" })
  }, [params.state, params.preset, workspace])

  // `?preset=` unpacks once, into the keys it stands for, and leaves.
  React.useEffect(() => {
    if (!params.preset) return
    const preset = decodePreset(params.preset)
    writeUrlParams({ ...(preset ? presetToParams(preset) : {}), preset: null })
  }, [params.preset])

  // The names ids stand for, once their records load.
  const { data: bill } = usePolicy<Bill>(node.kind === "bill" ? "bill" : null, { state: scope.state }, { id: node.kind === "bill" ? node.id : undefined })
  const { data: member } = usePolicy<Member>(location.member ? "member" : null, { state: scope.state, session: scope.filters.session }, { id: location.member || undefined })

  // In the workspace a move is a path (Brendan, 2026-09-07); tabs, documents
  // and forks stay in the query. "datasets" is the grid at the root.
  const goPath = React.useCallback(
    (target: Target) => {
      if (target.at === "datasets") return router.push(WORKSPACE_DATA)
      const toRoom = target.at ? roomPath(target.at, target.at === "forms" ? (all === "1" ? "1" : null) : null) : null
      if (toRoom) return router.push(toRoom)
      const state = target.state ?? routeNode?.state ?? scope.state
      const changedState = !!target.state && target.state !== (routeNode?.state ?? scope.state)
      const chamber = target.chamber ?? (changedState ? chambersOf(state)[0] : (routeNode?.chamber ?? scope.filters.chamber ?? chambersOf(state)[0]))
      const session = "session" in target ? (target.session ? Number(target.session) : null) : changedState ? null : (routeNode?.session ?? scope.session)
      const next = applyTarget(routeNode?.location ?? location, target)
      const path = buildWorkspacePath({ state, chamber, session, location: next, number: target.number, slug: target.slug })
      const query = new URLSearchParams(window.location.search)
      for (const key of ["tab", "doc", "fork"] as const) {
        if (key in target) {
          if (target[key]) query.set(key, target[key]!)
          else query.delete(key)
        } else if (path !== window.location.pathname) query.delete(key)
      }
      if (!("tab" in target)) query.delete("tab")
      if (!("doc" in target)) query.delete("doc")
      const search = query.toString()
      const href = search ? `${path}?${search}` : path
      if (href === `${window.location.pathname}${window.location.search}`) return
      router.push(href)
    },
    [router, routeNode, scope.state, scope.session, scope.filters.chamber, location, all]
  )
  const go = React.useCallback((target: Target) => {
    if (workspace) return goPath(target)
    const out: Record<string, string | null> = { tab: target.tab ?? null, doc: target.doc ?? null }
    for (const key of ["at", "committee", "member", "bill", "rollcall", "session", "state", "fork"] as const) if (key in target) out[key] = target[key] ?? null
    // Leaving a bill leaves its fork behind; moving within it keeps it.
    if ("bill" in target && !target.bill && !("fork" in target)) out.fork = null
    // Leaving Documents leaves its "all" behind.
    if ("at" in target && target.at !== "forms") out.all = null
    writeUrlParams(out, { history: "push" })
  }, [workspace, goPath])
  const setFilters = React.useCallback(
    (patch: Partial<Record<ScopeKey, string>>) => {
      // In the workspace the state, chamber and session are the path: a new one is a new page, at its root.
      if (workspace && (patch.state !== undefined || patch.chamber !== undefined || patch.session !== undefined)) {
        const { state, chamber, session, ...rest } = patch
        if (Object.keys(rest).length) writeUrlParams(rest, { history: "replace" })
        return goPath({ ...listing(null), ...(state !== undefined ? { state: state || null } : {}), ...(chamber !== undefined ? { chamber: chamber || null } : {}), ...(session !== undefined ? { session: session || null } : {}) })
      }
      writeUrlParams(patch, { history: "push" })
    },
    [workspace, goPath]
  )
  const setDesign = React.useCallback((patch: Partial<Design>) => {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(patch)) out[key] = value === DEFAULT_DESIGN[key as keyof Design] ? "" : (value ?? "")
    writeUrlParams(out, { history: "push" })
  }, [])

  const shuffle = React.useCallback(() => {
    const next: Partial<Design> = {}
    for (const key of DESIGN_KEYS) {
      if (locks.has(key)) continue
      const options = DESIGN_OPTIONS[key]
      next[key] = options[Math.floor(Math.random() * options.length)].value
    }
    setDesign(next)
  }, [locks, setDesign])

  const reset = React.useCallback(() => {
    const out: Record<string, string | null> = {}
    for (const key of [...DESIGN_KEYS, ...SCOPE_KEYS]) if (!locks.has(key)) out[key] = null
    out.tab = null
    out.doc = null
    if (workspace) {
      // The path stays; the query's filters and design go.
      delete out.state
      delete out.session
      delete out.chamber
      writeUrlParams(out, { history: "push" })
      return
    }
    // Reset lands on Congress unless the state is locked.
    if (!locks.has("state")) out.state = "US"
    out.at = null
    out.rollcall = null
    writeUrlParams(out, { history: "push" })
  }, [locks, workspace])

  const openPreset = React.useCallback(
    (preset: Preset) => {
      const out = presetToParams(preset)
      for (const key of locks) delete out[key]
      writeUrlParams({ ...out, tab: null, doc: null }, { history: "push" })
    },
    [locks]
  )

  // ── Where you are, as crumbs ─────────────────────────────────────────────

  const memberLabel = member ? `${honorific(member.role, member.chamber)} ${member.name}` : location.member ? `Member ${location.member}` : ""
  const billLabel = bill ? `${bill.bill_number} — ${truncate(bill.title, 90)}` : location.bill ? `Bill ${location.bill}` : ""
  const crumbs = React.useMemo<Crumb[]>(() => {
    const out: Crumb[] = [{ label: legislatureName(scope.state), go: listing("sessions") }]
    // The workspace's path starts at Data (Brendan, 2026-09-07: one breadcrumb, one component).
    if (workspace) out.unshift({ label: "Data", go: { at: "datasets" } })
    if (node.kind === "sessions") return out
    if (workspace && !routeNode) return out
    // The year, not the session's name (Brendan, 2026-09-07: "by year is 10000% required"). The record keys each dataset by the year its session began.
    out.push({ label: String(scope.session ?? sessionTitle ?? ""), go: listing(null) })
    const at = params.at.split("/").filter(Boolean).map(decodeURIComponent)
    if (location.committee) {
      out.push({ label: "Committees", go: listing("committees") })
      out.push({ label: location.committee, go: { committee: location.committee, at: null, member: null, bill: null, rollcall: null } })
      if (node.kind === "member" || (node.kind === "committee" && node.sub === "members")) out.push({ label: "Members", go: { committee: location.committee, at: "members", member: null, bill: null, rollcall: null } })
      else if (node.kind === "bill" || node.kind === "committee") out.push({ label: "Bills", go: { committee: location.committee, at: null, member: null, bill: null, rollcall: null } })
      if (node.kind === "member") out.push({ label: memberLabel })
      if (node.kind === "bill") out.push({ label: billLabel, go: params.tab ? { bill: location.bill, tab: null } : undefined })
      return out
    }
    switch (node.kind) {
      case "bills":
        out.push({ label: "Bills" })
        break
      case "bill":
        if (location.member) out.push({ label: "Members", go: listing("members") }, { label: memberLabel, go: { member: location.member, bill: null, rollcall: null, tab: "bills" } }, { label: billLabel, go: params.tab ? { bill: location.bill, tab: null } : undefined })
        else out.push({ label: "Bills", go: listing("bills") }, { label: billLabel, go: params.tab ? { bill: location.bill, tab: null } : undefined })
        break
      case "committees":
        out.push({ label: "Committees" })
        break
      case "members":
        out.push({ label: "Members" })
        break
      case "member":
        out.push({ label: "Members", go: listing("members") }, { label: memberLabel })
        break
      case "votes":
        out.push({ label: "Votes" })
        break
      case "forks":
        out.push({ label: "Your forks" })
        break
      case "votes-month":
        out.push({ label: "Votes", go: listing("votes") }, { label: monthName(node.month) })
        break
      case "votes-kind":
        out.push({ label: "Votes", go: listing("votes") }, { label: monthName(node.month), go: listing(`votes/${node.month}`) }, { label: node.vote === "floor" ? "Floor" : "Committee" })
        break
      case "rollcall":
        out.push({ label: "Votes", go: listing("votes") })
        if (at[1]) out.push({ label: monthName(at[1]), go: listing(`votes/${at[1]}`) })
        if (at[2]) out.push({ label: at[2] === "floor" ? "Floor" : "Committee", go: listing(`votes/${at[1]}/${at[2]}`) })
        out.push({ label: "Roll call" })
        break
      default:
        break
    }
    return out
  }, [scope.state, scope.session, sessionTitle, node, location, params.at, params.tab, memberLabel, billLabel, workspace])

  // `?at=alaska` names a state, not a listing (Brendan, 2026-09-03: a typed
  // URL that says Alaska should show Alaska). Rewrite it to `state=AK`.
  React.useEffect(() => {
    if (workspace) return
    const at = params.at.trim().toLowerCase()
    if (!at || /^(sessions|bills|committees|members|votes|forks|inbox|finance|forms|admin)(\/|$)/.test(at)) return
    const code = Object.entries(STATE_NAMES).find(([c, name]) => c.toLowerCase() === at || name.toLowerCase() === at)?.[0]
    if (code) writeUrlParams({ state: code, at: null, session: null }, { history: "replace" })
  }, [params.at, workspace])

  // `..`: the crumb before the last one.
  const up: Target | null = crumbs.length >= 2 ? (crumbs[crumbs.length - 2].go ?? null) : null

  // The block's title is the path to where you are — the state short, as a
  // path segment, not the legislature's full name.
  const first = workspace ? 1 : 0
  const header = route?.datasets ? <PathBar crumbs={[{ label: "Data" }]} folder onGo={go} /> : <PathBar crumbs={crumbs.map((c, i) => (i === first ? { ...c, label: stateName(scope.state) } : c))} folder={!isFile(node)} onGo={go} />

  // Whether the folder's rows have scrolled under the header. Remembered per
  // location so a new folder starts at the top.
  const stageKey = `${scope.state}:${scope.session}:${params.at}:${location.committee}:${location.member}:${location.bill}:${location.rollcall}`
  const scroller = React.useRef<HTMLDivElement>(null)
  const [scrolledAt, setScrolledAt] = React.useState<string | null>(null)
  const scrolled = scrolledAt === stageKey
  const topButton = (
    <Button variant="ghost" size="sm" onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}>
      <ArrowUpIcon className="size-3.5" /> Top
    </Button>
  )

  const toggleFor = (current: Look, set: (next: Look) => void) => (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {(["cards", "table"] as Look[]).map((value) => (
        <button key={value} type="button" data-active={current === value} onClick={() => set(value)} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
          {value === "table" ? "Table" : "Card"}
        </button>
      ))}
    </div>
  )
  const lookToggle = !isFile(node) && toggleFor(look, setLook)
  const datasetsLook = look
  const datasetsToggle = toggleFor(look, setLook)

  // What the stage shows, and how to switch it — one answer for the FAB's
  // switcher and the customizer's menu.
  const stageNow: Stage = isSpecial(node) ? (node.kind === "forms" && all === "1" ? "documents" : (node.kind as Stage)) : look === "cards" ? "canvas" : mode
  const pickStage = React.useCallback(
    (next: Stage) => {
      if (workspace && next !== "state" && next !== "design" && next !== "canvas") {
        router.push(next === "documents" ? "/workspace/documents" : next === "admin" ? "/workspace/dashboard" : `/workspace/${next}`)
        return
      }
      if (workspace && room && next === "canvas") {
        router.push(buildWorkspacePath({ state: scope.state, chamber: scope.filters.chamber ?? null, session: scope.session, location: { at: "bills", committee: "", member: "", bill: "", rollcall: "" } }))
        return
      }
      if (next === "state" || next === "design") {
        setMode(next)
        if (isSpecial(node)) writeUrlParams({ ...listing(null), look: null }, { history: "push" })
        else setLook("table")
      } else if (next === "canvas") {
        // The large cards: the tree's records as cards. From the root or a
        // special view, Bills is where they are.
        if (isSpecial(node) || node.kind === "root") writeUrlParams({ ...listing("bills"), look: null, all: null }, { history: "push" })
        else setLook("cards")
      } else if (next === "documents") {
        writeUrlParams({ ...listing("forms"), all: "1" }, { history: "push" })
      } else if (next === "forms") {
        writeUrlParams({ ...listing("forms"), all: null }, { history: "push" })
      } else go(listing(next))
    },
    [node, setMode, setLook, go, workspace, router, scope.state, scope.session, scope.filters.chamber, room]
  )

  const Inbox = blockComponents["sidebar-09"]
  const stage = route?.datasets ? (
    <BlockShell defaultOpen={false} rail={<DatasetRail />} title={header} actions={datasetsToggle} contentClassName="overflow-y-auto">
      <DatasetGrid look={datasetsLook} />
    </BlockShell>
  ) : routeNode?.pending ? (
    <BlockShell defaultOpen={false} rail={<Tree scope={scope} location={location} node={node} onGo={go} />} title={header}>
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-6 w-1/3 rounded-lg" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </BlockShell>
  ) : isSpecial(node) ? (
    node.kind === "inbox" ? (
      <Inbox />
    ) : node.kind === "finance" ? (
      <FecExplorer />
    ) : node.kind === "admin" ? (
      <AdminStage page={node.page} onGo={(page) => writeUrlParams({ ...listing(page ? `admin/${page}` : "admin") }, { history: "push" })} />
    ) : (
      <BlockShell
        title={all === "1" ? "Documents" : "Forms"}
        rail={
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>
                {all === "1" ? "Documents" : "Forms"} · {stateName(scope.state)}
              </SidebarGroupLabel>
            </SidebarGroup>
          </SidebarContent>
        }
      >
        <div className="p-6">
          <FormsList />
        </div>
      </BlockShell>
    )
  ) : (
    <BlockShell defaultOpen={false} rail={<Tree scope={scope} location={location} node={node} onGo={go} />} title={header} actions={scrolled ? topButton : node.kind === "bill" ? <FileActions path={crumbs.map((c, i) => (i === 0 ? stateName(scope.state) : c.label)).join(" / ")} state={scope.state} billId={node.id} view={(["changes", "history", "record", "typeset"].includes(params.tab) ? params.tab : "text") as BillView} onOpen={(view) => writeUrlParams({ tab: view === "text" ? null : view, doc: view === "text" || view === "changes" ? params.doc || null : null }, { history: "push" })} /> : lookToggle || undefined} headerClassName={scrolled ? "shadow-sm" : undefined} contentClassName="overflow-hidden">
      {node.kind === "bill" || node.kind === "member" || node.kind === "rollcall" ? (
        <FileView node={node} scope={scope} design={design} tab={params.tab} doc={params.doc} fork={params.fork} onTab={(tab) => writeUrlParams({ tab }, { history: "push" })} onDoc={(id) => writeUrlParams({ doc: id ? String(id) : null }, { history: "push" })} onGo={go} />
      ) : (
        <FolderView node={node} scope={scope} look={look} scopeKey={crumbs.map((c) => c.label).join("/")} scroller={scroller} onScrolled={(yes) => setScrolledAt(yes ? stageKey : null)} up={up} tab={params.tab} onTab={(tab) => writeUrlParams({ tab }, { history: "push" })} onGo={go} />
      )}
    </BlockShell>
  )

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]">
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col">
            <RevealFx key={stageKey} translateY={8} className="flex h-full min-h-0 flex-1 flex-col bg-background">
              {/* The FAB is gone (Brendan, 2026-09-07): every stage's shell
                  wears the footer, which summons the customizer and picks the mode. */}
              <ShellFooterProvider footer={<WorkspaceFooter mode={room ?? "data"} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)} />}>{stage}</ShellFooterProvider>
            </RevealFx>
          </div>
        </div>
        <div
          aria-hidden={!panelOpen}
          className={cn(
            "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out md:w-(--customizer-width)",
            !panelOpen && "max-md:hidden md:pointer-events-none md:w-0! md:-mr-(--gap) md:opacity-0"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col md:w-(--customizer-width)">
            <Customizer mode={mode} setMode={setMode} at={params.at} filters={scope.filters} setFilters={setFilters} design={design} setDesign={setDesign} onShuffle={shuffle} onReset={reset} onOpenPreset={openPreset} stage={stageNow} onStage={pickStage} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Designer({ route }: { route?: DesignerRoute }) {
  return (
    <LocksProvider>
      <DesignerInner route={route} />
    </LocksProvider>
  )
}
