"use client"

import * as React from "react"
import { ArrowUpIcon, MenuIcon } from "lucide-react"

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
import { Fab, FabButton } from "@/components/create/fab"
import { FileActions, type BillView } from "@/components/create/file-actions"
import { FileView } from "@/components/create/file-view"
import { FolderView, type Look } from "@/components/create/folder-view"
import { LocksProvider, useLocks } from "@/components/create/locks"
import { PathBar, type Crumb } from "@/components/create/path-bar"
import { type Mode } from "@/components/create/main-menu"
import { RevealFx } from "@/components/create/reveal-fx"
import { StageSwitcher, type Stage } from "@/components/create/stage-switcher"
import { legislatureName, Tree } from "@/components/create/tree"
import { BlockShell } from "@/components/policy/block-shell"
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

function DesignerInner() {
  const params = useUrlParams(URL_KEYS)
  const scope = useScope()
  const { locks } = useLocks()
  const sessionTitle = useSessionTitle(scope.state, scope.session)
  const [picked, setMode] = React.useState<Mode | null>(null)
  const mode: Mode = picked ?? (params.mode === "design" ? "design" : "state")
  const [panelOpen, setPanelOpen] = useLocal("govblock:create:customizer", true)
  // The look lives in the URL alone (Brendan, 2026-09-04: Canvas set the
  // cards look and a `look=table` left in the address bar overruled it).
  const look: Look = params.look === "cards" ? "cards" : "table"
  const setLook = React.useCallback((next: Look) => writeUrlParams({ look: next === "cards" ? "cards" : null }, { history: "replace" }), [])

  const design = React.useMemo(() => readDesign(params), [params])
  const location = React.useMemo<Location>(() => ({ at: params.at, committee: params.committee, member: params.member, bill: params.bill, rollcall: params.rollcall }), [params.at, params.committee, params.member, params.bill, params.rollcall])
  const node = React.useMemo(() => locate(location), [location])

  // Congress, current session, every time: a bare /create writes the state
  // in, so the remembered jurisdiction never decides what this page opens on.
  // Read off the address bar itself — the first client render still carries
  // the server's empty params, and a stale "" must not overwrite a real state.
  React.useEffect(() => {
    const live = new URLSearchParams(window.location.search)
    if (!live.get("state") && !live.get("preset")) writeUrlParams({ state: "US" })
  }, [params.state, params.preset])

  // `?preset=` unpacks once, into the keys it stands for, and leaves.
  React.useEffect(() => {
    if (!params.preset) return
    const preset = decodePreset(params.preset)
    writeUrlParams({ ...(preset ? presetToParams(preset) : {}), preset: null })
  }, [params.preset])

  // The names ids stand for, once their records load.
  const { data: bill } = usePolicy<Bill>(node.kind === "bill" ? "bill" : null, { state: scope.state }, { id: node.kind === "bill" ? node.id : undefined })
  const { data: member } = usePolicy<Member>(location.member ? "member" : null, { state: scope.state, session: scope.filters.session }, { id: location.member || undefined })

  const go = React.useCallback((target: Target) => {
    const out: Record<string, string | null> = { tab: target.tab ?? null, doc: target.doc ?? null }
    for (const key of ["at", "committee", "member", "bill", "rollcall", "session", "state", "fork"] as const) if (key in target) out[key] = target[key] ?? null
    // Leaving a bill leaves its fork behind; moving within it keeps it.
    if ("bill" in target && !target.bill && !("fork" in target)) out.fork = null
    // Leaving Documents leaves its "all" behind.
    if ("at" in target && target.at !== "forms") out.all = null
    writeUrlParams(out, { history: "push" })
  }, [])
  const setFilters = React.useCallback((patch: Partial<Record<ScopeKey, string>>) => writeUrlParams(patch, { history: "push" }), [])
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
    // Reset lands on Congress unless the state is locked.
    if (!locks.has("state")) out.state = "US"
    out.at = null
    out.rollcall = null
    out.tab = null
    out.doc = null
    writeUrlParams(out, { history: "push" })
  }, [locks])

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
    if (node.kind === "sessions") return out
    out.push({ label: sessionTitle || String(scope.session ?? ""), go: listing(null) })
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
  }, [scope.state, scope.session, sessionTitle, node, location, params.at, params.tab, memberLabel, billLabel])

  // `?at=alaska` names a state, not a listing (Brendan, 2026-09-03: a typed
  // URL that says Alaska should show Alaska). Rewrite it to `state=AK`.
  React.useEffect(() => {
    const at = params.at.trim().toLowerCase()
    if (!at || /^(sessions|bills|committees|members|votes|forks|inbox|finance|forms)(\/|$)/.test(at)) return
    const code = Object.entries(STATE_NAMES).find(([c, name]) => c.toLowerCase() === at || name.toLowerCase() === at)?.[0]
    if (code) writeUrlParams({ state: code, at: null, session: null }, { history: "replace" })
  }, [params.at])

  // `..`: the crumb before the last one.
  const up: Target | null = crumbs.length >= 2 ? (crumbs[crumbs.length - 2].go ?? null) : null

  // The block's title is the path to where you are — the state short, as a
  // path segment, not the legislature's full name.
  const header = <PathBar crumbs={crumbs.map((c, i) => (i === 0 ? { ...c, label: stateName(scope.state) } : c))} folder={!isFile(node)} onGo={go} />

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

  const lookToggle = !isFile(node) && (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {(["table", "cards"] as Look[]).map((value) => (
        <button key={value} type="button" data-active={look === value} onClick={() => setLook(value)} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm">
          {value === "table" ? "Table" : "Cards"}
        </button>
      ))}
    </div>
  )

  // What the stage shows, and how to switch it — one answer for the FAB's
  // switcher and the customizer's menu.
  const stageNow: Stage = isSpecial(node) ? (node.kind === "forms" && params.all === "1" ? "documents" : (node.kind as Stage)) : look === "cards" ? "canvas" : mode
  const pickStage = React.useCallback(
    (next: Stage) => {
      if (next === "state" || next === "design") {
        setMode(next)
        if (isSpecial(node)) writeUrlParams({ ...listing(null), look: null }, { history: "push" })
        else setLook("table")
      } else if (next === "canvas") {
        // The large cards: the tree's records as cards. From the root or a
        // special view, Bills is where they are.
        if (isSpecial(node) || node.kind === "root") writeUrlParams({ ...listing("bills"), look: "cards", all: null }, { history: "push" })
        else setLook("cards")
      } else if (next === "documents") {
        writeUrlParams({ ...listing("forms"), all: "1" }, { history: "push" })
      } else if (next === "forms") {
        writeUrlParams({ ...listing("forms"), all: null }, { history: "push" })
      } else go(listing(next))
    },
    [node, setMode, setLook, go]
  )

  const Inbox = blockComponents["sidebar-09"]
  const stage = isSpecial(node) ? (
    node.kind === "inbox" ? (
      <Inbox />
    ) : node.kind === "finance" ? (
      <FecExplorer />
    ) : (
      <BlockShell
        title={params.all === "1" ? "Documents" : "Forms"}
        rail={
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>
                {params.all === "1" ? "Documents" : "Forms"} · {stateName(scope.state)}
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
              {stage}
            </RevealFx>
          </div>

          <Fab className="absolute bottom-3 left-3">
            <FabButton aria-label={panelOpen ? "Hide the customizer" : "Show the customizer"} aria-pressed={panelOpen} tip="Customizer" onClick={() => setPanelOpen((open) => !open)}>
              <MenuIcon className="size-4" />
            </FabButton>
            <StageSwitcher stage={stageNow} onStage={pickStage} />
          </Fab>
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

export function Designer() {
  return (
    <LocksProvider>
      <DesignerInner />
    </LocksProvider>
  )
}
