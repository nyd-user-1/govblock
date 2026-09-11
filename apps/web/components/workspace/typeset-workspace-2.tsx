"use client"

import * as React from "react"
import { FileTextIcon, FoldHorizontalIcon, GitCompareArrowsIcon, HistoryIcon, LockIcon, LockOpenIcon, SparklesIcon, UnfoldHorizontalIcon } from "lucide-react"

import { useAssistSubject } from "@/lib/assist-panel"
import { readFilters, scopedFilters } from "@/lib/filters"
import { billSystemPrompt } from "@/lib/policy/bill-html"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { Bill } from "@/lib/policy/types"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"
import { TypesetCustomizer } from "@/app/(typeset)/components/customizer"
import { TypesetPreviewOverrideProvider } from "@/app/(typeset)/components/preview-override"
import { OpenInNewTab, TypesetPages } from "@/app/(typeset)/components/toolbar"
import { useTypesetSearchParams } from "@/app/(typeset)/lib/search-params"
import { previewFontVariables } from "@/app/preview/fonts"
import { PathBar } from "@/components/create/path-bar"
import { TypesetEditor } from "@/components/workspace/typeset-editor"
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

/** The bill in the rail is what the chat drawer talks about. */
function useBillSubject() {
  const [params] = useTypesetSearchParams()
  const { state, session, isDefaultSession } = useJurisdiction()
  const filters = scopedFilters(
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
      ? `Ask about ${bill.bill_number}…`
      : "Ask about the bills in the rail…",
    title: bill ? bill.bill_number : "Chat",
  })
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
function DiffPane({ width, locked }: { width: CompareWidth; locked: boolean }) {
  const [params] = useTypesetSearchParams()
  const { state, session, isDefaultSession } = useJurisdiction()
  const filters = scopedFilters(readFilters(params as unknown as Record<string, unknown>), state, session, isDefaultSession)
  const { data, error } = usePolicy<BillComparison>(params.bill ? "bill-compare" : null, filters)
  const note = !params.bill ? "No bill is open." : error ? "The printings could not be loaded." : !data ? "Loading the printings…" : data.passes.length ? null : "This bill has one printing, so there is nothing to compare."
  if (note) return <p className="p-8 text-sm text-muted-foreground">{note}</p>
  return <BillCompare {...data!} width={width} locked={locked} contained />
}

export function TypesetWorkspace() {
  const [panelOpen, setPanelOpen] = useLocal(
    "govblock:workspace:typeset-2:customizer",
    false
  )
  useBillSubject()
  const [params] = useTypesetSearchParams()
  const page = pageOf(params.item)
  const diff = useDiffSettings()

  const footer = (
    <WorkspaceFooter
      mode="typeset"
      panelOpen={panelOpen}
      onTogglePanel={() => setPanelOpen((open) => !open)}
    >
      <div className="flex items-center gap-1">
        <TypesetPages options={PAGES} />
      </div>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <OpenInNewTab />
      {page === "diff" && (
        <>
          <div className="mx-0.5 h-4 w-px bg-border" />
          <DiffControls settings={diff} />
        </>
      )}
    </WorkspaceFooter>
  )

  return (
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
              rail={<TypesetRail />}
              title={
                <PathBar
                  crumbs={[{ label: "Typeset" }]}
                  folder
                  onGo={() => {}}
                />
              }
              footer={footer}
              contentClassName="overflow-hidden"
            >
              {page === "diff" ? (
                <DiffPane width={diff.width} locked={diff.locked} />
              ) : (
                <TypesetEditor
                  item={contentOf(page)}
                  surface={surfaceOf(page)}
                  bill={params.bill}
                  version={params.version ? String(params.version) : undefined}
                />
              )}
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
}

/** The providers the preview and customizer share, once, around the page. */
export function TypesetWorkspacePage() {
  return (
    <TypesetPreviewOverrideProvider>
      <TypesetWorkspace />
    </TypesetPreviewOverrideProvider>
  )
}
