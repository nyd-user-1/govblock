"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
import { BlockShell } from "@/components/policy/block-shell"

// The full-screen page type (Brendan, 2026-09-20), beside DocsPage and
// WidePage: the stage in its rounded frame, filling the screen under the site
// header, with the block shell's rail and header across it. /map, /chat,
// /calendar, /live and the laws browser each wrote this frame out by hand;
// this is that frame with a name, so a page that wants it says so in a line.
//
// `data-slot="designer"` is what the root layout reads to hold the document at
// the viewport's height and stop the body scrolling — without it the stage
// would run on past the fold and take the footer with it.

export function DashboardPage({
  rail,
  title,
  actions,
  footer,
  defaultOpen = true,
  contentClassName,
  className,
  children,
}: {
  /** The shell's left rail: what this tool is about, as SidebarContent. */
  rail: React.ReactNode
  /** Plain text or a path bar; sits after the rule in the header. */
  title: React.ReactNode
  /** Right-aligned in the header. */
  actions?: React.ReactNode
  /** The bar across the bottom of the pane, where a tool has one. */
  footer?: React.ReactNode
  /** The rail on arrival. A tool whose rail is the point opens it; a canvas does not. */
  defaultOpen?: boolean
  contentClassName?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden section-soft [--gap:--spacing(4)] md:[--gap:--spacing(6)]", className)}>
      <div data-slot="designer" className="flex min-h-0 flex-1 flex-col gap-(--gap) p-(--gap) pt-[calc(var(--gap)*0.25)]">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
          <div className="absolute inset-0 bg-muted dark:bg-muted/30" />
          <div className="relative z-0 flex min-h-0 flex-1 flex-col bg-background">
            <BlockShell defaultOpen={defaultOpen} rail={rail} title={title} actions={actions} footer={footer} contentClassName={cn("overflow-hidden", contentClassName)}>
              {children}
            </BlockShell>
          </div>
        </div>
      </div>
    </div>
  )
}
