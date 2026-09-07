"use client"

import * as React from "react"
import { FileTextIcon } from "lucide-react"

import { useAssistSubject } from "@/lib/assist-panel"
import { readFilters, scopedFilters } from "@/lib/filters"
import { billSystemPrompt } from "@/lib/policy/bill-html"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { Bill } from "@/lib/policy/types"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"
import { TypesetCustomizer } from "@/app/(typeset)/components/customizer"
import { TypesetPreview } from "@/app/(typeset)/components/preview"
import { TypesetPreviewOverrideProvider } from "@/app/(typeset)/components/preview-override"
import { OpenInNewTab, TypesetPages } from "@/app/(typeset)/components/toolbar"
import { CONTENT_OPTIONS } from "@/app/(typeset)/lib/fixtures"
import { useTypesetSearchParams } from "@/app/(typeset)/lib/search-params"
import { previewFontVariables } from "@/app/preview/fonts"
import { PathBar } from "@/components/create/path-bar"
import { BlockShell } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"
import { cn } from "@govblock/ui/lib/utils"

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
            {CONTENT_OPTIONS.map((option, index) => (
              <SidebarMenuItem key={option.value}>
                <SidebarMenuButton isActive={params.item === option.value} onClick={() => setParams({ item: option.value })}>
                  <FileTextIcon />
                  <span className="flex-1 truncate">{option.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{String(index + 1).padStart(2, "0")}</span>
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
  const filters = scopedFilters(readFilters(params as unknown as Record<string, unknown>), state, session, isDefaultSession)
  const { data: bill } = usePolicy<Bill>("bill", filters)
  const system = React.useMemo(
    () => billSystemPrompt(bill ?? null, filters.state ?? state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bill?.bill_id, bill?.status_desc, bill?.last_action_date, filters.state]
  )
  useAssistSubject({
    chatId: params.chat || (bill ? `bill-${bill.bill_id}` : `workspace-${state}`),
    system,
    placeholder: bill ? `Ask about ${bill.bill_number}…` : "Ask about the bills in the rail…",
    title: bill ? bill.bill_number : "Chat",
  })
}

export function TypesetWorkspace() {
  const [panelOpen, setPanelOpen] = useLocal("govblock:workspace:typeset:customizer", true)
  useBillSubject()

  const footer = (
    <WorkspaceFooter mode="typeset" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)}>
      <div className="flex items-center gap-1">
        <TypesetPages />
      </div>
      <div className="mx-0.5 h-4 w-px bg-border" />
      <OpenInNewTab />
    </WorkspaceFooter>
  )

  return (
    <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]", previewFontVariables)}>
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell defaultOpen={false} rail={<TypesetRail />} title={<PathBar crumbs={[{ label: "Typeset" }]} folder onGo={() => {}} />} footer={footer} contentClassName="overflow-hidden">
              <TypesetPreview bare />
            </BlockShell>
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
