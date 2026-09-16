import { DocsSidebar } from "@/components/docs-sidebar"
import { RailStrip, RailToggle } from "@/components/rail-toggle"
import { Sidebar, SidebarContent } from "@govblock/ui/components/ny4/sidebar"

// A rail as a sheet (Brendan, 2026-09-16), the pattern the root page proved:
// the page keeps its full width and a rail slides in over it from its own
// edge rather than pushing the content aside. Closed, the sheet is translated
// off all but its 24px strip — the hairline and the tab stay where the column
// used to put them — so it looks like the column it replaces and only the
// motion differs. Each side is remembered and toggled on its own.
//
// The geometry is the root frame's (components/rails-frame.tsx), lifted here
// so every other page can wear it: that file keeps the root's own variant,
// where the right rail opens as a near-full-screen second screen. Everywhere
// else the right rail is this one, mirrored.

export const SHEET = "absolute inset-y-0 z-40 bg-background transition-[translate,width] duration-500 ease-out [&>[data-slot=sidebar]>[data-slot=sidebar-content]]:flex!"
export const LINE = "absolute top-12 bottom-0 left-2 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex"

/** The site's left rail: the docs sidebar, as a sheet. */
export function LeftRailSheet() {
  return (
    <div className={`${SHEET} left-0 [&>[data-slot=sidebar]]:w-72! [[data-rail-left=closed]_&]:-translate-x-[calc(var(--spacing)*66)]`}>
      <RailStrip side="left" />
      <DocsSidebar />
    </div>
  )
}

/** The same sheet on the other edge, holding whatever the page puts in its rail. */
export function RightRailSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${SHEET} right-0 [&>[data-slot=sidebar]]:w-72! [[data-rail-right=closed]_&]:translate-x-[calc(var(--spacing)*66)]`}>
      <RailStrip side="right" />
      <Sidebar
        side="right"
        collapsible="none"
        className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-var(--header-height)-1.2rem)] w-72 shrink-0 overflow-visible overscroll-none bg-transparent lg:flex"
      >
        <div className={LINE} />
        <RailToggle side="right" />
        {/* Past the tab's 16px and a little air, as the left rail's content sits past its own. */}
        <SidebarContent className="scrollbar-none ml-8 w-auto flex-1 scroll-fade gap-6 overflow-x-hidden overflow-y-auto py-1 pr-2.5">{children}</SidebarContent>
      </Sidebar>
    </div>
  )
}
