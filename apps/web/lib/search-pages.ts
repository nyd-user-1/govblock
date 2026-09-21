import { AGENT_PAGES, hasItems, siteConfig } from "@/lib/config"

// The pages search can land on. Built from the nav rather than typed out
// again: a page's icon, its sentence and the menu it lives under are already
// decided in `lib/config.ts`, and a second list would drift from it within a
// week. The group is the panel a page sits in, which tells a reader where to
// find it next time without opening anything.
export type SearchPage = { name: string; href: string; group: string; description?: string; icon?: string }

export const SEARCH_PAGES: SearchPage[] = [
  ...siteConfig.navItems.flatMap((item) =>
    hasItems(item)
      ? item.items.map((entry) => ({ name: entry.label, href: entry.href, group: item.label, description: entry.description, icon: entry.icon }))
      : [{ name: item.label, href: item.href, group: "Pages", icon: item.icon }]
  ),
  ...AGENT_PAGES.map((entry) => ({ name: entry.label, href: entry.href, group: "Agents", description: entry.description, icon: entry.icon })),
  // The landing page is not a page to find (Brendan, 2026-09-13): the list sits under a Pages heading already.
].filter((page, index, all) => page.href !== "/" && all.findIndex((other) => other.href === page.href) === index)

// The ⌘K menu's pages (Brendan, 2026-09-20): these fifteen and no others, A to
// Z, before a word is typed and after. /search still matches every page.
const MENU_HREFS = ["/bills", "/calendar", "/changelog", "/chat", "/committees", "/workspace/dashboard", "/docs/datasets", "/hearings", "/laws", "/legislative-subjects", "/map", "/policy-areas", "/roll-call-votes", "/simulator", "/sources"]

export const MENU_PAGES: SearchPage[] = SEARCH_PAGES.filter((page) => MENU_HREFS.includes(page.href)).sort((a, b) => a.name.localeCompare(b.name))

export function matchPages(term: string, limit = 6, pages: SearchPage[] = SEARCH_PAGES) {
  const t = term.trim().toLowerCase()
  if (!t) return []
  return pages.filter((p) => p.name.toLowerCase().includes(t) || (p.description ?? "").toLowerCase().includes(t)).slice(0, limit)
}
