"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Bot, CalendarDays, Database, FileText, Globe, History, Home, LayoutGrid, Newspaper, PieChart, Search, Settings } from "lucide-react"

import { hasItems, siteConfig } from "@/lib/config"
import { stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { RailGroup, type RailItem } from "@/components/directory-rail"
import { useRecents } from "@/components/home/recents"
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

// The home page's rail: Cloudflare's account rail, in our terms (Brendan,
// 2026-09-07: "this is where we will house the tld organizing principles and
// functions"). Quick search, Account home, Recents and the jurisdiction at
// the top; then Observe, Build, Records and Workspace as sections; Manage
// account at the foot. On any other page the rail is the docs rail.

const glyph = (Icon: React.ComponentType<{ className?: string }>) => <Icon className="size-4 shrink-0 text-muted-foreground" />

/** Opens the site's ⌘K menu, which listens for the key itself. */
function openSearch() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))
}

export function HomeRail() {
  const pathname = usePathname()
  const { state } = useJurisdiction()
  const recents = useRecents(6)
  const scope = `?state=${state}`
  const pages = (label: string) => {
    const entry = siteConfig.navItems.find((item) => item.label === label)
    return entry && hasItems(entry) ? entry.items : []
  }
  const item = (key: string, href: string, label: React.ReactNode, icon?: React.ReactNode, items?: RailItem[]): RailItem => ({
    key,
    href,
    label,
    icon,
    items,
    active: pathname === href.split("?")[0] || (!!items && items.some((i) => i.active)),
  })
  const page = (p: { href: string; label: string }): RailItem => ({
    key: p.href,
    href: p.href.startsWith("/docs") ? `${p.href}${scope}` : p.href,
    label: p.label,
    active: pathname.startsWith(p.href),
  })

  const top: RailItem[] = [
    item("home", "/home", "Account home", glyph(Home)),
    item(
      "recents",
      "/home",
      "Recents",
      glyph(History),
      recents.map((r) => ({ key: r.href, href: r.href, label: r.title, detail: r.group, active: false }))
    ),
    item("jurisdiction", `/docs/bills${scope}`, stateName(state) || "Jurisdiction", glyph(Globe), [
      { key: "overview", href: `/docs/bills${scope}`, label: "Overview", active: false },
      { key: "members", href: `/docs/directory${scope}`, label: "Members", active: false },
      { key: "committees", href: `/docs/committees${scope}`, label: "Committees", active: false },
      { key: "departments", href: `/docs/departments${scope}`, label: "Departments", active: false },
      { key: "sessions", href: `/docs/datasets/${state.toLowerCase()}`, label: "Sessions", active: false },
    ]),
  ]
  const observe: RailItem[] = [item("investigate", "/search", "Investigate", glyph(Search)), item("analytics", "/home#analytics", "Analytics", glyph(PieChart)), item("calendar", "/calendar", "Calendar", glyph(CalendarDays))]
  const build: RailItem[] = [
    item("agents", "/agents", "Agents", glyph(Bot), [
      { key: "agents", href: "/agents", label: "Agents", active: pathname.startsWith("/agents") },
      { key: "agent", href: "/agent", label: "Ask", active: pathname === "/agent" },
      { key: "data", href: "/workspace/data", label: "Data", active: pathname.startsWith("/workspace/data") },
      { key: "blocks", href: "/workspace/blocks", label: "Blocks", active: pathname.startsWith("/workspace/blocks") },
    ]),
    item("data", "/docs/api", "Data", glyph(Database), [
      { key: "api", href: "/docs/api", label: "API", active: pathname.startsWith("/docs/api") },
      { key: "datasets", href: "/docs/datasets", label: "Datasets", active: pathname.startsWith("/docs/datasets") },
    ]),
    item("news", "/newsroom", "News", glyph(Newspaper)),
  ]
  const records: RailItem[] = [item("records", `/docs/bills${scope}`, "Records", glyph(FileText), pages("Records").map(page))]
  const workspace: RailItem[] = [item("workspace", "/workspace/data", "Workspace", glyph(LayoutGrid), pages("Workspace").map(page))]
  const account: RailItem[] = [item("account", "/auth", "Manage account", glyph(Settings))]

  return (
    <>
      <SidebarGroup className="pt-12">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={openSearch} className="h-9 w-full max-w-52 justify-start rounded-lg border bg-background text-[0.8rem] text-muted-foreground shadow-xs hover:bg-muted">
                {glyph(Search)}
                <span className="min-w-0 flex-1 truncate text-left">Quick search…</span>
                <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">⌘K</kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <RailGroup items={top} />
      <RailGroup label="Observe" items={observe} />
      <RailGroup label="Build" items={[...build, ...records, ...workspace]} />
      <RailGroup items={account} className="border-t pt-3" />
    </>
  )
}
