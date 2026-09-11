"use client"

import { usePathname } from "next/navigation"

import { DirectoryRail } from "@/components/directory-rail"
import { HomeRail } from "@/components/home/home-rail"
import { RailToggle } from "@/components/rail-toggle"
import { RecentsRecorder } from "@/components/home/recents"
import { Sidebar, SidebarContent } from "@govblock/ui/components/ny4/sidebar"

// Ported from livingston-v3 components/docs-sidebar.tsx, reduced to the
// directory rail: the site's sections, Recent Bills and Committees. The Sections group and the
// shadcn docs tree are not on a govblock docs page.
export function DocsSidebar(props: React.ComponentProps<typeof Sidebar>) {
  // The home page carries its own rail — the account rail — and every other
  // page the docs rail (Brendan, 2026-09-07).
  const pathname = usePathname()
  const home = pathname === "/home"
  return (
    <Sidebar className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] overflow-visible overscroll-none bg-transparent [--sidebar-menu-width:--spacing(56)] lg:flex [[data-rail-left=closed]_&]:w-6" collapsible="none" {...props}>
      {/* The tab on the hairline opens and closes the rail; closed, the rail is a 24px strip that keeps the line and the tab (Brendan, 2026-09-11). The content clips itself, so the sidebar can let the tab overhang. */}
      <RailToggle side="left" />
      <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex" />
      <SidebarContent data-docs-sidebar-content="" className="scrollbar-none w-(--sidebar-menu-width) scroll-fade overflow-x-hidden pl-2.5 [[data-rail-left=closed]_&]:hidden">
        <RecentsRecorder />
        {home ? <HomeRail /> : <DirectoryRail />}
      </SidebarContent>
    </Sidebar>
  )
}
