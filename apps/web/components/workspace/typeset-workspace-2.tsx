"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { FileTextIcon, FoldHorizontalIcon, GitCompareArrowsIcon, HistoryIcon, LockIcon, LockOpenIcon, SparklesIcon, UnfoldHorizontalIcon } from "lucide-react"
import { LinkSquare02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useAssistSubject } from "@/lib/assist-panel"
import { readFilters, scopedFilters, type Filters } from "@/lib/filters"
import { fmtBill } from "@/lib/format"
import { billSystemPrompt } from "@/lib/policy/bill-html"
import { PathScopeContext, useJurisdiction, type PathScope } from "@/lib/policy/jurisdiction"
import type { Bill } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { GIT_VIEWS, TYPESET_VIEWS, typesetHref, type TypesetView } from "@/lib/typeset/views"
import { TypesetCustomizer } from "@/app/(typeset)/components/customizer"
import { TypesetPreviewOverrideProvider } from "@/app/(typeset)/components/preview-override"
import { OpenInNewTab, TypesetPages } from "@/app/(typeset)/components/toolbar"
import { serializeTypesetSearchParams, useTypesetSearchParams } from "@/app/(typeset)/lib/search-params"
import { previewFontVariables } from "@/app/preview/fonts"
import { FileActions, type BillView } from "@/components/create/file-actions"
import { APP_CRUMB, PathBar } from "@/components/create/path-bar"
import { TypesetEditor } from "@/components/workspace/typeset-editor"
import { TypesetGitPane, type GitView } from "@/components/workspace/typeset-git-pane"
import { StaticToolbar } from "@/components/workspace/typeset-toolbar"
import { BillCompare, type CompareWidth } from "@/components/bill-compare"
import type { BillComparison } from "@/lib/policy/bill-compare"
import { Button } from "@govblock/ui/components/ny4/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"
import { BlockShell } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

// /workspace/typeset-2 (Brendan, 2026-09-09): the Typeset editor. It began
// as a copy of typeset-workspace.tsx and diverged the same day: where the
// preview iframe stood, Plate's editor fills the shell. The original's note
// follows.
//
// The three pages (2026-09-10). Plate and Potion are the same bill in two
// editors — Plate is the playground with its toolbar under the header, Potion
// the Notion posture with nothing above the page and its outline down the
// left. History is the bill's actions by date. `article` and `changelog` are
// the keys the URL and the preview route already use; `potion` opens `article`
// on the other editor, which is why it maps back to it below.
//
// Diff (2026-09-11) is the bill's printings, each against the one before, as
// the scrolling redline of /bills/[id]/compare. No editor draws it; its two
// settings — centred or full width, and whether a change once shown stays —
// sit in the footer while it is open.
//
// A bill has routes now (Brendan, 2026-09-12): /workspace/typeset/bill/{id}
// and a segment per view — see lib/typeset/views.ts. The page arrives with
// `route` set and the views below read it; the bare /workspace/typeset, with
// no bill, still reads the query and draws the template's own pages, so the
// two editors can be held side by side as they always could.
const PAGES = [
  { value: "article", label: "Plate", icon: FileTextIcon },
  { value: "potion", label: "Potion", icon: SparklesIcon },
  { value: "changelog", label: "History", icon: HistoryIcon },
  { value: "diff", label: "Diff", icon: GitCompareArrowsIcon },
] as const

type Page = (typeof PAGES)[number]["value"]

const pageOf = (item: string): Page =>
  PAGES.some((p) => p.value === item) ? (item as Page) : "article"

/** Which document an editor page reads. Potion is a second editor on the same text. */
const contentOf = (page: Exclude<Page, "diff">) => (page === "potion" ? "article" : page)

/** Which editor draws it. */
const surfaceOf = (page: Exclude<Page, "diff">) => (page === "potion" ? "potion" : "plate")

export type TypesetRoute = { billId: number; state: string; session: number | null; view: TypesetView }

/** What a routed view opens: the editor page it is, or Git's view, or the diff. */
const EDITOR_OF: Partial<Record<TypesetView, { item: "article" | "changelog"; surface: "plate" | "potion" }>> = {
  typeset: { item: "article", surface: "plate" },
  outline: { item: "article", surface: "potion" },
  actions: { item: "changelog", surface: "plate" },
}
const isGitView = (view: TypesetView): view is GitView => view === "git" || view === "versions" || view === "fork"

//
// /workspace/typeset (Brendan, 2026-09-07): /typeset in the shell. The
// typeset document fills the pane; the numbered pages and Open in New Tab
// sit in the footer after the mode switcher; the customizer is typeset's own,
// summoned by the footer's hamburger; the chat drawer takes the bill in the
// rail as its subject.

function TypesetRail() {
  const [params, setParams] = useTypesetSearchParams()
  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Typeset</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {PAGES.map((option, index) => (
              <SidebarMenuItem key={option.value}>
                <SidebarMenuButton
                  isActive={pageOf(params.item) === option.value}
                  onClick={() => setParams({ item: option.value })}
                >
                  <option.icon />
                  <span className="flex-1 truncate">{option.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

/** The routed rail: the five numbered views, then Git's two. */
function RouteRail({ route }: { route: TypesetRoute }) {
  const router = useRouter()
  const group = (label: string, views: typeof TYPESET_VIEWS, numbered: boolean) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {views.map((option, index) => (
            <SidebarMenuItem key={option.key}>
              <SidebarMenuButton isActive={route.view === option.key} onClick={() => router.push(typesetHref(route.billId, option.key))}>
                <option.icon />
                <span className="flex-1 truncate">{option.label}</span>
                {numbered && <span className="text-xs text-muted-foreground tabular-nums">{String(index + 1).padStart(2, "0")}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
  return (
    <SidebarContent>
      {group("Typeset", TYPESET_VIEWS, true)}
      {group("Git", GIT_VIEWS, false)}
    </SidebarContent>
  )
}

/** The footer's numbered pills for the routed views, 01–05, each a link. */
function ViewPills({ route }: { route: TypesetRoute }) {
  const router = useRouter()
  return (
    <>
      {TYPESET_VIEWS.map((option, index) => (
        <Tooltip key={option.key}>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                data-active={route.view === option.key || (option.key === "git" && isGitView(route.view))}
                className="h-7 min-w-7 cursor-pointer rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                onClick={() => router.push(typesetHref(route.billId, option.key))}
              />
            }
          >
            {String(index + 1).padStart(2, "0")}
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={10}>
            {option.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </>
  )
}

/** Open in New Tab for a routed bill: the editor pages open on the preview route, the rest on themselves. */
function OpenRouteInNewTab({ route }: { route: TypesetRoute }) {
  const [params] = useTypesetSearchParams()
  const editor = EDITOR_OF[route.view]
  const href = editor
    ? serializeTypesetSearchParams(`/preview/typeset/${editor.item}`, { ...params, bill: String(route.billId), state: route.state, item: editor.item })
    : typesetHref(route.billId, route.view)
  return (
    <Button asChild variant="ghost" size="sm" className="h-7 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
      <a href={href} target="_blank" rel="noreferrer">
        <HugeiconsIcon icon={LinkSquare02Icon} strokeWidth={2} className="size-4" />
        Open in New Tab
      </a>
    </Button>
  )
}

/** The bill in the rail is what the chat drawer talks about. */
function useBillSubject(routeFilters: Filters | null) {
  const [params] = useTypesetSearchParams()
  const { state, session, isDefaultSession } = useJurisdiction()
  const filters = routeFilters ?? scopedFilters(
    readFilters(params as unknown as Record<string, unknown>),
    state,
    session,
    isDefaultSession
  )
  const { data: bill } = usePolicy<Bill>("bill", filters)
  const system = React.useMemo(
    () => billSystemPrompt(bill ?? null, filters.state ?? state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bill?.bill_id, bill?.status_desc, bill?.last_action_date, filters.state]
  )
  useAssistSubject({
    chatId:
      params.chat || (bill ? `bill-${bill.bill_id}` : `workspace-${state}`),
    system,
    placeholder: bill
      ? `Ask about ${fmtBill(bill.bill_number, bill.state)}…`
      : "Ask about the bills in the rail…",
    title: bill ? fmtBill(bill.bill_number, bill.state) : "Chat",
  })
  return bill ?? null
}

/** The Diff page's two settings, remembered in this browser. */
function useDiffSettings() {
  const [width, setWidth] = React.useState<CompareWidth>("centered")
  const [locked, setLocked] = React.useState(true)
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("typeset-diff") ?? "{}")
      if (saved.width === "centered" || saved.width === "full") setWidth(saved.width)
      if (typeof saved.locked === "boolean") setLocked(saved.locked)
    } catch {}
  }, [])
  const save = (next: { width: CompareWidth; locked: boolean }) => {
    setWidth(next.width)
    setLocked(next.locked)
    try {
      localStorage.setItem("typeset-diff", JSON.stringify(next))
    } catch {}
  }
  return {
    width,
    locked,
    setWidth: (w: CompareWidth) => save({ width: w, locked }),
    toggleLock: () => save({ width, locked: !locked }),
  }
}

function FooterToggle({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" className={cn("size-7 cursor-pointer", pressed && "bg-muted")} aria-label={label} aria-pressed={pressed} onClick={onClick}>
            {children}
          </Button>
        }
      />
      <TooltipContent side="top" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function DiffControls({ settings }: { settings: ReturnType<typeof useDiffSettings> }) {
  return (
    <div className="flex items-center gap-0.5">
      <FooterToggle label="Centered" pressed={settings.width === "centered"} onClick={() => settings.setWidth("centered")}>
        <FoldHorizontalIcon className="size-4" />
      </FooterToggle>
      <FooterToggle label="Full width" pressed={settings.width === "full"} onClick={() => settings.setWidth("full")}>
        <UnfoldHorizontalIcon className="size-4" />
      </FooterToggle>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <FooterToggle
        label={settings.locked ? "Locked: changes stay once shown" : "Unlocked: scrolling back replays changes"}
        pressed={false}
        onClick={settings.toggleLock}
      >
        {settings.locked ? <LockIcon className="size-4" /> : <LockOpenIcon className="size-4" />}
      </FooterToggle>
    </div>
  )
}

/** The Diff page: the open bill's printings compared, scrolling in the pane. */
function DiffPane({ width, locked, filters }: { width: CompareWidth; locked: boolean; filters: Filters }) {
  const { data, error } = usePolicy<BillComparison>(filters.bill ? "bill-compare" : null, filters)
  const note = !filters.bill ? "No bill is open." : error ? "The printings could not be loaded." : !data ? "Loading the printings…" : data.passes.length ? null : "This bill has one printing, so there is nothing to compare."
  if (note) return <p className="p-8 text-sm text-muted-foreground">{note}</p>
  return <BillCompare {...data!} width={width} locked={locked} contained />
}

/** The toolbar row, then the view under it: one shape for every view that has no editor of its own. */
function WithToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StaticToolbar />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  )
}

export function TypesetWorkspace({ route }: { route?: TypesetRoute }) {
  const router = useRouter()
  // Closed on every load; only the footer's hamburger opens it (Brendan, 2026-09-11).
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [params] = useTypesetSearchParams()
  const { state, session, isDefaultSession } = useJurisdiction()
  // A routed bill names its own jurisdiction; the query form reads the rail's.
  const filters = React.useMemo<Filters>(
    () =>
      route
        ? { state: route.state, bill: String(route.billId), ...(route.session ? { session: String(route.session) } : {}) }
        : scopedFilters(readFilters(params as unknown as Record<string, unknown>), state, session, isDefaultSession),
    [route, params, state, session, isDefaultSession]
  )
  const bill = useBillSubject(route ? filters : null)
  const page = pageOf(params.item)
  const diff = useDiffSettings()
  const view: TypesetView | null = route?.view ?? null
  // The path ends on the open file (Brendan, 2026-09-11): the bill, or the page when none is loaded.
  const file = bill ? fmtBill(bill.bill_number, bill.state) : route ? "Bill" : PAGES.find((p) => p.value === page)!.label
  const showDiffControls = view ? view === "comp" : page === "diff"

  const footer = (
    <WorkspaceFooter
      mode="typeset"
      panelOpen={panelOpen}
      onTogglePanel={() => setPanelOpen((open) => !open)}
    >
      <div className="flex items-center gap-1">{route ? <ViewPills route={route} /> : <TypesetPages options={PAGES} />}</div>
      <div className="mx-0.5 h-4 w-px bg-border" />
      {route ? <OpenRouteInNewTab route={route} /> : <OpenInNewTab />}
      {showDiffControls && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <DiffControls settings={diff} />
        </>
      )}
    </WorkspaceFooter>
  )

  // Git's More-file-actions menu, on Git's views: the same one /workspace/data wears.
  const actions =
    route && view && isGitView(view) ? (
      <FileActions
        path={`Workspace / Typeset / ${file}`}
        state={route.state}
        billId={route.billId}
        view={(view === "versions" ? "changes" : "text") as BillView}
        onOpen={(open) => {
          if (open === "record") return router.push(`/bills/${route.billId}`)
          if (open === "typeset") return router.push(typesetHref(route.billId))
          router.push(typesetHref(route.billId, open === "text" ? "git" : "versions"))
        }}
      />
    ) : undefined

  let content: React.ReactNode
  if (route && view) {
    const editor = EDITOR_OF[view]
    if (editor) {
      content = <TypesetEditor item={editor.item} surface={editor.surface} bill={String(route.billId)} version={params.version ? String(params.version) : undefined} />
    } else if (view === "comp") {
      content = (
        <WithToolbar>
          <DiffPane width={diff.width} locked={diff.locked} filters={filters} />
        </WithToolbar>
      )
    } else if (isGitView(view)) {
      content = (
        <WithToolbar>
          <TypesetGitPane billId={route.billId} view={view} />
        </WithToolbar>
      )
    }
  } else {
    content =
      page === "diff" ? (
        <WithToolbar>
          <DiffPane width={diff.width} locked={diff.locked} filters={filters} />
        </WithToolbar>
      ) : (
        <TypesetEditor item={contentOf(page)} surface={surfaceOf(page)} bill={params.bill} version={params.version ? String(params.version) : undefined} />
      )
  }

  const stage = (
    <div
      className={cn(
        "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]",
        previewFontVariables
      )}
    >
      <div
        data-slot="designer"
        className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse"
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell
              defaultOpen={false}
              rail={route ? <RouteRail route={route} /> : <TypesetRail />}
              title={
                <PathBar
                  crumbs={[APP_CRUMB, { label: "Typeset" }, { label: file }]}
                  folder={false}
                  onGo={() => {}}
                />
              }
              actions={actions}
              footer={footer}
              contentClassName="overflow-hidden"
            >
              {content}
            </BlockShell>
          </div>
        </div>
        <div
          aria-hidden={!panelOpen}
          className={cn(
            "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out md:w-(--customizer-width)",
            !panelOpen &&
              "max-md:hidden md:pointer-events-none md:-mr-(--gap) md:w-0! md:opacity-0"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col md:w-(--customizer-width)">
            <TypesetCustomizer />
          </div>
        </div>
      </div>
    </div>
  )

  if (!route) return stage
  // The bill's own jurisdiction, for every hook under the page (useScope, useJurisdiction, usePolicy).
  const pathScope: PathScope = { state: route.state, session: route.session, year: route.session, chamber: null, sessions: [] }
  return <PathScopeContext.Provider value={pathScope}>{stage}</PathScopeContext.Provider>
}

/** The providers the preview and customizer share, once, around the page. */
export function TypesetWorkspacePage({ route }: { route?: TypesetRoute } = {}) {
  return (
    <TypesetPreviewOverrideProvider>
      <TypesetWorkspace route={route} />
    </TypesetPreviewOverrideProvider>
  )
}
