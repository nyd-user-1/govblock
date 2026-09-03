// Ported from livingston-v3 lib/config.ts.
// `icon` is a lucide name; `components/main-nav.tsx` holds the one map from
// name to component, so this file stays data and never imports a component.
export type NavLink = { href: string; label: string; description?: string; icon?: string }
export type NavItem =
  | NavLink
  | { label: string; href: string; items: NavLink[]; columns?: 2 | 3 | 4 | 5 }

export function hasItems(item: NavItem): item is Extract<NavItem, { items: unknown[] }> {
  return "items" in item && Array.isArray(item.items)
}

export const siteConfig = {
  name: "govblock",
  url: "https://govblock.app",
  description:
    "One view over all 50 states and Congress. Open Source. Open Code. Open Data.",
  links: {
    twitter: "https://twitter.com/shadcn",
    github: "https://github.com/shadcn-ui/ui",
  },
  // Five top-level entries, three of them panels. The old list was eleven flat
  // links with Committees and Directory sitting beside the Docs they belong
  // inside; grouping them is how a reader finds Laws or Nominations without
  // having been told they exist. Each panel line carries the sentence that
  // says what the page is for — the nav is the only place most people will
  // read it.
  navItems: [
    { href: "/", label: "Home" },
    {
      label: "Records",
      href: "/docs/bills",
      // Ten entries, five across and two down. Two rows is the requirement
      // (Brendan, 08:10 ET); the column count follows from it. This list is
      // also the docs rail's Records section — `components/directory-rail.tsx`
      // reads it — so the panel and the rail cannot say different things. They
      // did until 20:00 ET: Members here and Directory there, Record and The
      // Record, and a Finance the rail had that the panel did not. One name per
      // page now: Members and News, by Brendan's word, and the rest by title. Row one is what every jurisdiction has;
      // row two is the federal record, the news, and the paperwork the
      // government hands back.
      // News is here as well as at the top level: it is a record of what
      // happened, and a reader looking for the day's news should find it where
      // the records are. Its sentence is the page's own metadata description,
      // not a second one written for the menu.
      columns: 5,
      items: [
        { href: "/docs/bills", label: "Bills", description: "Every bill in all 52 jurisdictions, newest first.", icon: "FileText" },
        { href: "/docs/committees", label: "Committees", description: "Who sits where, and what is before them.", icon: "Users" },
        { href: "/docs/directory", label: "Members", description: "The sitting members, with party and district.", icon: "BookUser" },
        { href: "/docs/money", label: "Finance", description: "Lobbying and campaign money, where the record holds it.", icon: "Coins" },
        { href: "/docs/laws", label: "Laws", description: "What passed, and the bill it began as.", icon: "Scale" },
        { href: "/docs/nominations", label: "Nominations", description: "Nominations before the Senate.", icon: "UserCheck" },
        { href: "/docs/reports", label: "Reports", description: "Committee reports and CRS research.", icon: "BookOpen" },
        { href: "/docs/record", label: "The Record", description: "The Congressional Record, issue by issue.", icon: "ScrollText" },
        { href: "/newsroom", label: "News", description: "What the legislature did, newest first.", icon: "Newspaper" },
        { href: "/docs/forms", label: "Forms", description: "Government forms for benefits, grants and programs.", icon: "ClipboardList" },
      ],
    },
    { href: "/newsroom", label: "News" },
    {
      label: "Agents",
      href: "/agents",
      items: [
        { href: "/agents/bill-reader", label: "Bill Reader", description: "One bill's whole record, explained and cited." },
        { href: "/agents/jurisdiction-guide", label: "Jurisdiction Guide", description: "Who represents, which committee, where a bill sits." },
        { href: "/agents/money-follower", label: "Money Follower", description: "Sponsors, filings and FEC totals, with the gaps named." },
        { href: "/agents/tracker", label: "Tracker", description: "Watches a topic and posts the digest." },
        { href: "/agents/researcher", label: "Researcher", description: "A long sourced report, delivered." },
        { href: "/blocks/intelligence", label: "Agentic Inbox", description: "Send a task, read the report it sends back." },
        { href: "/agents/discord", label: "Discord", description: "Where the finished work goes, and what we can read back." },
        { href: "/connectors", label: "Connectors", description: "Connect the places you already work." },
      ],
    },
    {
      label: "Workspace",
      href: "/blocks",
      items: [
        { href: "/blocks", label: "Blocks", description: "The composed surfaces this site is built from." },
        { href: "/charts/area", label: "Charts", description: "The chart kit, on real rows." },
        { href: "/typeset", label: "Typeset", description: "Set a bill as a document and take the code." },
        { href: "/create", label: "Create", description: "Build a view and export it." },
        { href: "/calendar", label: "Calendar", description: "Hearings and sessions by day." },
        { href: "/changelog", label: "Changelog", description: "What shipped, and when." },
      ],
    },
  ],
}
