// Ported from livingston-v3 lib/config.ts.
// `icon` is a lucide name; `components/main-nav.tsx` holds the one map from
// name to component, so this file stays data and never imports a component.
export type NavLink = { href: string; label: string; description?: string; icon?: string }
export type NavItem = NavLink | { label: string; href: string; items: NavLink[]; columns?: 2 | 3 | 4 | 5 | 6 }

export function hasItems(item: NavItem): item is Extract<NavItem, { items: unknown[] }> {
  return "items" in item && Array.isArray(item.items)
}

export const siteConfig = {
  name: "govblock",
  url: "https://govblock.app",
  description: "One view over all 50 states and Congress. Open Source. Open Code. Open Data.",
  links: {
    twitter: "https://twitter.com/nysgpt",
    github: "https://github.com/nyd-user-1/govblock",
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
      // Fifteen entries, three across (Brendan, 2026-09-08: the fourth column
      // held three orphans, so the grid is three wide and five deep and every
      // row is full). Alphabetical, because fifteen names in a panel is a list
      // to look something up in, not an argument about which matters most.
      // This list is also the docs rail's Records section —
      // `components/directory-rail.tsx` reads it — so the panel and the rail
      // cannot say different things.
      columns: 3,
      items: [
        { href: "/docs/bills", label: "Bills", description: "Every bill in all 52 jurisdictions, newest first.", icon: "FileText" },
        { href: "/docs/committees", label: "Committees", description: "Who sits where, and what is before them.", icon: "Users" },
        { href: "/docs/departments", label: "Departments", description: "What each department does, spends, and is asked to do.", icon: "Landmark" },
        { href: "/docs/money", label: "Finance", description: "Lobbying and campaign money, where the record holds it.", icon: "Coins" },
        { href: "/docs/forms", label: "Forms", description: "Government forms for benefits, grants and programs.", icon: "ClipboardList" },
        { href: "/docs/hearings", label: "Hearings", description: "Every hearing of the Congress, with its transcript.", icon: "Mic" },
        { href: "/docs/laws", label: "Laws", description: "What passed, and the bill it began as.", icon: "Scale" },
        { href: "/docs/lobbying", label: "Lobbying", description: "Who is paid to be heard, on what, and for whom.", icon: "Handshake" },
        { href: "/docs/directory", label: "Members", description: "The sitting members, with party and district.", icon: "BookUser" },
        { href: "/newsroom", label: "News", description: "What the legislature did, newest first.", icon: "Newspaper" },
        { href: "/docs/nominations", label: "Nominations", description: "Nominations before the Senate.", icon: "UserCheck" },
        { href: "/docs/reports", label: "Reports", description: "Committee reports and CRS research.", icon: "BookOpen" },
        { href: "/docs/roll-call-votes", label: "Roll calls", description: "Every recorded vote, and how each member answered.", icon: "ListChecks" },
        { href: "/docs/subjects", label: "Subjects", description: "How a bill is filed, and every bill under each term.", icon: "Tags" },
        { href: "/docs/record", label: "The Record", description: "The Congressional Record, issue by issue.", icon: "ScrollText" },
      ],
    },
    { href: "/newsroom", label: "News" },
    {
      label: "Agents",
      href: "/agents",
      // Six agents, alphabetical. The Inbox left this panel on 2026-09-08: it
      // is a place work lands, not an agent you can ask a question, so it sits
      // in the Workspace and the Filer takes its seat here.
      columns: 2,
      items: [
        { href: "/agents/bill-reader", label: "Clerk", description: "A bill you need to understand before the meeting.", icon: "Stamp" },
        { href: "/agents/form-filler", label: "Filer", description: "A benefits form filled in by answering questions.", icon: "FileSignature" },
        { href: "/agents/researcher", label: "Librarian", description: "A question that needs a report, not an answer.", icon: "Library" },
        { href: "/agents/jurisdiction-guide", label: "Parliamentarian", description: "Whose district, which committee, and where the bill is stuck.", icon: "Gavel" },
        { href: "/agents/money-follower", label: "Treasurer", description: "Who paid, who filed, and what the record leaves out.", icon: "Receipt" },
        { href: "/agents/tracker", label: "Whip", description: "A topic you cannot watch every day.", icon: "Radar" },
      ],
    },
    {
      label: "Workspace",
      href: "/workspace/data",
      // Eleven entries, alphabetical, three across. Each line says what the
      // page is worth rather than restating its name (Brendan, 2026-09-08:
      // "stop calling an orange an orange").
      columns: 3,
      items: [
        { href: "/blocks/intelligence", label: "Agentic Inbox", description: "Hand a job to an agent and read it when it lands.", icon: "Inbox" },
        { href: "/docs/api", label: "API", description: "Build on the same numbers the pages are drawn from.", icon: "Braces" },
        { href: "/docs/blocks", label: "Block docs", description: "Take a block into your own app, props and source with it.", icon: "BookMarked" },
        { href: "/workspace/blocks", label: "Blocks", description: "Build a page from parts that arrive already holding data.", icon: "Blocks" },
        { href: "/calendar", label: "Calendar", description: "See what is scheduled before it happens, not after.", icon: "CalendarDays" },
        { href: "/changelog", label: "Changelog", description: "Know what changed, so a number is never a surprise.", icon: "History" },
        { href: "/workspace/dashboard", label: "Dashboards", description: "Watch a chamber, a committee or a topic at a glance.", icon: "LayoutDashboard" },
        { href: "/workspace/data", label: "Data", description: "Open any dataset as a card and work it where it lives.", icon: "Database" },
        { href: "/docs/datasets", label: "Datasets", description: "Take a whole session away as a file and analyse it.", icon: "FileDown" },
        { href: "/newsroom", label: "News", description: "Catch what the legislature did while you were away.", icon: "Newspaper" },
        { href: "/workspace/typeset", label: "Typeset", description: "Turn a bill into a document worth publishing.", icon: "Type" },
      ],
    },
    { href: "/clips", label: "Creators", icon: "SquarePlay" },
  ],
}
