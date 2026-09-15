"use client"

import * as React from "react"

import { TypesetCustomizer } from "@/app/(typeset)/components/customizer"
import { TypesetPreviewOverrideProvider } from "@/app/(typeset)/components/preview-override"
import { previewFontVariables } from "@/app/preview/fonts"
import { APP_CRUMB, PathBar, type Crumb } from "@/components/create/path-bar"
import { BlockShell } from "@/components/policy/block-shell"
import { GettingStarted, PaneNoteSlot } from "@/components/workspace/typeset-footer-parts"
import { FinderRail, FinderSwitch, TypesetFinderProvider, useFinder } from "@/components/workspace/typeset-finder"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { PaneNoteProvider } from "@/lib/typeset/pane-note"
import { cn } from "@govblock/ui/lib/utils"

// Typeset's stage for the pages that open no bill (window 4, 2026-09-14): the
// Library and a Work opened by its address. The same card, rail, path bar,
// footer and customizer typeset-workspace-2.tsx draws around a bill. The
// footer is the Git view's (2026-09-14): the bill's numbered views when the
// page is a bill's, Getting started, and the size line the page hands it.

export const TYPESET_CRUMB: Crumb = { label: "Typeset", href: "/workspace/typeset" }

export function TypesetFrame({
  rail,
  crumbs,
  actions,
  footer,
  railOpen = false,
  billId,
  children,
}: {
  rail: React.ReactNode
  /** After Workspace / Typeset. */
  crumbs: Crumb[]
  actions?: React.ReactNode
  footer?: React.ReactNode
  railOpen?: boolean
  /** A bill's Work: the footer's numbered pills open the bill's views. */
  billId?: number | null
  children: React.ReactNode
}) {
  return (
    <TypesetFinderProvider>
      <TypesetFrameBody rail={rail} crumbs={crumbs} actions={actions} footer={footer} railOpen={railOpen} billId={billId}>
        {children}
      </TypesetFrameBody>
    </TypesetFinderProvider>
  )
}

function TypesetFrameBody({ rail, crumbs, actions, footer, railOpen = false, billId, children }: { rail: React.ReactNode; crumbs: Crumb[]; actions?: React.ReactNode; footer?: React.ReactNode; railOpen?: boolean; billId?: number | null; children: React.ReactNode }) {
  const [panelOpen, setPanelOpen] = React.useState(false)
  // The finder's pick opens the rail with its own list (Brendan, 2026-09-15); closing the pick gives the page's rail back.
  const { pick } = useFinder()
  const [open, setOpen] = React.useState(railOpen)
  React.useEffect(() => {
    if (pick) setOpen(true)
  }, [pick])
  void billId
  return (
    <TypesetPreviewOverrideProvider>
      <PaneNoteProvider>
      <div
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--customizer-width:--spacing(48)] [--gap:--spacing(4)] md:[--gap:--spacing(6)] 2xl:[--customizer-width:--spacing(56)]",
          previewFontVariables
        )}
      >
        <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)] md:flex-row-reverse">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
            <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
            <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
              <BlockShell
                defaultOpen={railOpen}
                open={open}
                onOpenChange={setOpen}
                rail={pick ? <FinderRail /> : rail}
                title={<PathBar crumbs={[APP_CRUMB, TYPESET_CRUMB, ...crumbs]} folder={false} onGo={() => {}} />}
                actions={actions}
                footer={
                  <WorkspaceFooter mode="typeset" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)}>
                    <FinderSwitch />
                    <div className="mx-0.5 h-4 w-px bg-border" />
                    <GettingStarted />
                    <PaneNoteSlot />
                    {footer}
                  </WorkspaceFooter>
                }
                contentClassName="overflow-hidden"
              >
                {children}
              </BlockShell>
            </div>
          </div>
          <div
            aria-hidden={!panelOpen}
            className={cn(
              "flex min-h-0 shrink-0 flex-col overflow-hidden transition-[width,margin,opacity] duration-300 ease-in-out md:w-(--customizer-width)",
              !panelOpen && "max-md:hidden md:pointer-events-none md:-mr-(--gap) md:w-0! md:opacity-0"
            )}
          >
            <div className="flex min-h-0 flex-1 flex-col md:w-(--customizer-width)">
              <TypesetCustomizer />
            </div>
          </div>
        </div>
      </div>
      </PaneNoteProvider>
    </TypesetPreviewOverrideProvider>
  )
}
