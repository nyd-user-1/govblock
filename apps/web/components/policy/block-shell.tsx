"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "@govblock/ui/components/ny4/sidebar"

// The one shell every block wears: dashboard-01's. A sidebar on the left in
// the sidebar colour, the main pane inset beside it as a rounded card, and a
// header across the top of that card with the trigger, a rule, the title and
// whatever actions the block has. Brendan, 2026-09-03: "Change the shell used
// for these blocks to the shell used by dashboard. This will give them all a
// standard shell that governs the header and the sidebar."
//
// The rail is reserved for the block's entity — committees, bills and their
// versions, members, roll calls, mail folders, FEC filters. The customizer
// decides the jurisdiction and the scope; the rail decides what is on the
// stage inside it.
//
// The shell fills whatever it is given rather than the viewport. In /create it
// sits in the stage; under /view it sits in a page that is the screen; either
// way the parent sets the height and the shell's panes scroll on their own.
// That is why the sidebar is `collapsible="none"` — the other modes position
// the sidebar `fixed` against the viewport, which is wrong inside a container —
// and why the trigger's collapse is done here, by width, not by the primitive.

export function BlockShell({
  rail,
  title,
  actions,
  children,
  sidebarWidth = "calc(var(--spacing) * 64)",
  className,
  headerClassName,
  contentClassName,
  defaultOpen = true,
}: {
  /** The sidebar's contents: SidebarHeader, SidebarContent, SidebarFooter. */
  rail: React.ReactNode
  /** Plain text or a breadcrumb; sits after the rule. */
  title: React.ReactNode
  /** Right-aligned in the header. */
  actions?: React.ReactNode
  children: React.ReactNode
  sidebarWidth?: string
  className?: string
  /** For the shadow a header wears while rows pass under it. */
  headerClassName?: string
  contentClassName?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      data-slot="block-shell"
      className={cn("h-full min-h-0 w-full overflow-hidden bg-sidebar", className)}
      style={{ "--sidebar-width": sidebarWidth, "--header-height": "calc(var(--spacing) * 12)" } as React.CSSProperties}
    >
      <Sidebar
        collapsible="none"
        data-state={open ? "expanded" : "collapsed"}
        className={cn("h-full min-h-0 shrink-0 overflow-hidden transition-[width] duration-200 ease-linear", !open && "w-0!")}
      >
        {rail}
      </Sidebar>
      <SidebarInset className={cn("m-2 min-h-0 min-w-0 overflow-hidden rounded-xl shadow-sm", open ? "ml-0" : "ml-2")}>
        <header className={cn("relative z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-shadow", headerClassName)}>
          <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <div className="flex min-w-0 flex-1 items-center gap-2 text-base font-medium">{title}</div>
            {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </header>
        <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", contentClassName)}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
