"use client"

import { DirectoryRail } from "@/components/directory-rail"
import { Sidebar, SidebarContent } from "@govblock/ui/components/ny4/sidebar"

// Ported from livingston-v3 components/docs-sidebar.tsx, reduced to the
// directory rail: the site's sections, Recent Bills and Committees. The Sections group and the
// shadcn docs tree are not on a govblock docs page.
export function DocsSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] overflow-hidden overscroll-none bg-transparent [--sidebar-menu-width:--spacing(56)] lg:flex"
      collapsible="none"
      {...props}
    >
      <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex" />
      <SidebarContent data-docs-sidebar-content="" className="w-(--sidebar-menu-width) scroll-fade scrollbar-none overflow-x-hidden pl-2.5">
        <DirectoryRail />
      </SidebarContent>
    </Sidebar>
  )
}
