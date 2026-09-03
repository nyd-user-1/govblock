// The pages search can land on — the header menu and /search share this list.
// Only routes that exist today; /charts/area and /changelog are not ported yet
// and a search result must never 404.
export const SEARCH_PAGES: { name: string; href: string; group: string }[] = [
  { name: "Home", href: "/", group: "Pages" },
  { name: "Bills", href: "/docs/bills", group: "Docs" },
  { name: "Committees", href: "/docs/committees", group: "Docs" },
  { name: "Members", href: "/docs/directory", group: "Docs" },
  { name: "Laws", href: "/docs/laws", group: "Docs" },
  { name: "Nominations", href: "/docs/nominations", group: "Docs" },
  { name: "The Record", href: "/docs/record", group: "Docs" },
  { name: "Reports", href: "/docs/reports", group: "Docs" },
  { name: "News", href: "/newsroom", group: "Pages" },
  { name: "Blocks", href: "/blocks", group: "Pages" },
  { name: "Calendar", href: "/calendar", group: "Pages" },
  { name: "Typeset", href: "/typeset", group: "Pages" },
  { name: "Create", href: "/create", group: "Pages" },
]

export function matchPages(term: string, limit = 6) {
  const t = term.trim().toLowerCase()
  if (!t) return []
  return SEARCH_PAGES.filter((p) => p.name.toLowerCase().includes(t)).slice(0, limit)
}
