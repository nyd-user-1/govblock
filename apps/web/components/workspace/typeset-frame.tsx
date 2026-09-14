"use client"

import * as React from "react"

import { TypesetCustomizer } from "@/app/(typeset)/components/customizer"
import { TypesetPreviewOverrideProvider } from "@/app/(typeset)/components/preview-override"
import { previewFontVariables } from "@/app/preview/fonts"
import { APP_CRUMB, PathBar, type Crumb } from "@/components/create/path-bar"
import { BlockShell } from "@/components/policy/block-shell"
import { WorkspaceFooter } from "@/components/workspace/workspace-footer"
import { cn } from "@govblock/ui/lib/utils"

// Typeset's stage for the pages that open no bill (window 4, 2026-09-14): the
// Library and a Work opened by its address. The same card, rail, path bar,
// footer and customizer typeset-workspace-2.tsx draws around a bill.

export const TYPESET_CRUMB: Crumb = { label: "Typeset", href: "/workspace/typeset" }

export function TypesetFrame({
  rail,
  crumbs,
  actions,
  footer,
  railOpen = false,
  children,
}: {
  rail: React.ReactNode
  /** After Workspace / Typeset. */
  crumbs: Crumb[]
  actions?: React.ReactNode
  footer?: React.ReactNode
  railOpen?: boolean
  children: React.ReactNode
}) {
  const [panelOpen, setPanelOpen] = React.useState(false)
  return (
    <TypesetPreviewOverrideProvider>
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
                rail={rail}
                title={<PathBar crumbs={[APP_CRUMB, TYPESET_CRUMB, ...crumbs]} folder={false} onGo={() => {}} />}
                actions={actions}
                footer={
                  <WorkspaceFooter mode="typeset" panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((open) => !open)}>
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
    </TypesetPreviewOverrideProvider>
  )
}
