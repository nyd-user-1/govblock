"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { BookOpen, FileClock, FileText, Globe, History, Home, LayoutGrid, Newspaper, Search, Settings, Users } from "lucide-react"

import { useAccount } from "@/lib/auth/use-account"
import { AGENT_PAGES, hasItems, siteConfig, withScope } from "@/lib/config"
import { useHomeState } from "@/lib/policy/home-state"
import { DEFAULT_STATE, stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { RefreshButton } from "@/lib/policy/manual-fetch"
import { RailGroup, useRecordGroups, type RailItem } from "@/components/directory-rail"
import { useRecents } from "@/components/home/recents"
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

// The site's rail, on AnimBits' shape (Brendan, 2026-09-11): four rows at
// the top — Quick search, Account (Home, Bookmarks, Changelog, Favorites; 2026-09-20), Recents, Scope — then four nodes,
// each folding open to its sub-sections and each sub-section to its items:
// Agents (the index and each agent), ArXiv (the record's pages), News (the
// desks and everything the News menu holds), Workspace (the workspace's
// surfaces, with Consensus and Data as nodes of their own). Scope is what the
// reader is entitled to: Congress, and their home state — shown either way,
// muted until they sign in. The record's own groups follow, then Manage
// account at the foot.

const glyph = (Icon: React.ComponentType<{ className?: string }>) => <Icon className="size-4 shrink-0 text-muted-foreground" />

/** Opens the site's ⌘K menu, which listens for the key itself. */
function openSearch() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))
}

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

export function SiteRail() {
  const pathname = usePathname()
  const { state } = useJurisdiction()
  const { signedIn } = useAccount()
  const homeState = useHomeState()
  const recents = useRecents(6)
  const record = useRecordGroups()
  const pages = (label: string) => {
    const entry = siteConfig.navItems.find((item) => item.label === label)
    return entry && hasItems(entry) ? entry.items : []
  }
  const here = (href: string) => pathname === href.split("?")[0]
  const item = (key: string, href: string, label: React.ReactNode, icon?: React.ReactNode, items?: RailItem[], muted?: boolean): RailItem => ({
    key,
    href,
    label,
    icon,
    items,
    muted,
    active: here(href) || (!!items && items.some((i) => i.active)),
  })
  const page = (p: { href: string; label: string }): RailItem => ({ key: p.href, href: withScope(p.href, state), label: p.label, active: pathname.startsWith(p.href) })

  // Scope: Congress and the home state, each with the three lists a jurisdiction is read through.
  const home = homeState ?? (state !== "US" ? state : DEFAULT_STATE)
  const lists = (code: string, muted: boolean): RailItem[] => [
    { key: `${code}-bills`, href: `/bills/${code.toLowerCase()}`, label: "Bills", active: here(`/bills/${code.toLowerCase()}`), muted },
    { key: `${code}-committees`, href: `/committees?state=${code}`, label: "Committees", active: false, muted },
    { key: `${code}-members`, href: `/members?state=${code}`, label: "Members", active: false, muted },
  ]
  const top: RailItem[] = [
    // Account (Brendan, 2026-09-20; Account home until then), folding open to
    // what is the reader's own: home first, then the rest by name. The
    // changelog moved here from Docs.
    item("account", "/home", "Account", glyph(Home), [
      { key: "/home", href: "/home", label: "Home", active: here("/home") },
      { key: "/bookmarks", href: "/bookmarks", label: "Bookmarks", active: here("/bookmarks") },
      { key: "/changelog", href: "/changelog", label: "Changelog", active: here("/changelog") },
      { key: "/favorites", href: "/favorites", label: "Favorites", active: here("/favorites") },
    ]),
    item(
      "recents",
      "/home",
      "Recents",
      glyph(History),
      recents.map((r) => ({ key: r.href, href: r.href, label: r.title, detail: r.group, active: false }))
    ),
    item("scope", "/bills", "Scope", glyph(Globe), [
      item("congress", "/bills/us", "Congress", undefined, lists("US", false)),
      item("home-state", `/bills/${home.toLowerCase()}`, stateName(home), undefined, lists(home, !signedIn), !signedIn),
    ]),
  ]

  const agents: RailItem[] = [{ key: "/agents", href: "/agents", label: "Index", active: pathname === "/agents" }, ...AGENT_PAGES.filter((p) => p.href.startsWith("/agents/")).sort(byLabel).map(page)]
  const arxiv: RailItem[] = pages("ArXiv").filter((p) => p.href !== "/desk").sort(byLabel).map(page)
  const news: RailItem[] = pages("News").filter((p) => !p.href.startsWith("/consensus")).sort(byLabel).map(page)
  const consensus = item("consensus", "/consensus", "Consensus", undefined, [
    { key: "/consensus", href: "/consensus", label: "Consensus", active: pathname === "/consensus" },
    ...pages("News").filter((p) => p.href.startsWith("/consensus/")).sort(byLabel).map((p) => ({ key: p.href, href: p.href, label: p.label.replace(/^Consensus /, "").replace(/^\w/, (c) => c.toUpperCase()), active: pathname.startsWith(p.href) })),
  ])
  // The sections are the header's menus, in the header's order and with the
  // header's items (Brendan, 2026-09-12: "apply it to this section of the
  // left sidebar"). Docs holds what used to sit under Workspace as Build on it.
  const docs: RailItem[] = pages("Docs").filter((p) => p.href !== "/changelog").sort(byLabel).map(page)
  // Agents is a Workspace item in the header, so here it is a Workspace node
  // with the seven agent pages beneath it, not a section of its own.
  const agentsNode = item("agents", "/agents", "Agents", undefined, agents)
  const workspace: RailItem[] = [
    ...pages("Workspace")
      .filter((p) => p.href !== "/consensus" && p.href !== "/agents")
      .map(page),
    consensus,
    agentsNode,
  ].sort((a, b) => String(a.label).localeCompare(String(b.label)))

  const nodes: RailItem[] = [
    item("arxiv", withScope("/bills", state), "ArXiv", glyph(FileText), arxiv),
    item("docs", "/docs", "Docs", glyph(BookOpen), docs),
    item("news", "/news", "News", glyph(Newspaper), news),
    item("workspace", "/workspace", "Workspace", glyph(LayoutGrid), workspace),
  ]
  // The record's groups fold like the nodes above them (Brendan, 2026-09-17),
  // rather than standing open as lists under their own labels.
  const recordNodes: RailItem[] = record.map((g) => item(g.key, g.items[0]?.href ?? "/bills", g.label, glyph(g.key === "committees" ? Users : FileClock), g.items))
  const account_: RailItem[] = [item("account", "/auth", "Manage account", glyph(Settings))]

  return (
    <>
      <SidebarGroup className="pt-12">
        <SidebarGroupContent>
          <SidebarMenu>
            {/* Where the rail reads the API only when asked (the root's frame, 2026-09-20), the asking is the icon beside the search; anywhere else it draws nothing. */}
            <SidebarMenuItem className="flex max-w-52 items-center gap-1">
              <SidebarMenuButton onClick={openSearch} className="h-9 w-full min-w-0 flex-1 justify-start rounded-lg border bg-background text-[0.8rem] text-muted-foreground shadow-xs hover:bg-muted">
                {glyph(Search)}
                <span className="min-w-0 flex-1 truncate text-left">Quick search…</span>
                <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">⌘K</kbd>
              </SidebarMenuButton>
              <RefreshButton variant="ghost" className="shrink-0 text-muted-foreground" what="the rail's lists" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <RailGroup items={top} />
      <RailGroup items={nodes} />
      <RailGroup items={recordNodes} />
      <RailGroup items={account_} className="border-t pt-3" />
    </>
  )
}
