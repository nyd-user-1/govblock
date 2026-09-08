import { hasItems, siteConfig } from "@/lib/config"

// The pages search can land on. Built from the nav rather than typed out
// again: a page's icon, its sentence and the menu it lives under are already
// decided in `lib/config.ts`, and a second list would drift from it within a
// week. The group is the panel a page sits in, which tells a reader where to
// find it next time without opening anything.
export type SearchPage = { name: string; href: string; group: string; description?: string; icon?: string }

export const SEARCH_PAGES: SearchPage[] = siteConfig.navItems.flatMap((item) =>
  hasItems(item)
    ? item.items.map((entry) => ({ name: entry.label, href: entry.href, group: item.label, description: entry.description, icon: entry.icon }))
    : [{ name: item.label, href: item.href, group: "Pages", icon: item.icon }]
).filter((page, index, all) => all.findIndex((other) => other.href === page.href) === index)

export function matchPages(term: string, limit = 6) {
  const t = term.trim().toLowerCase()
  if (!t) return []
  return SEARCH_PAGES.filter((p) => p.name.toLowerCase().includes(t) || (p.description ?? "").toLowerCase().includes(t)).slice(0, limit)
}
