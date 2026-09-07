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
      // Thirteen entries, four across and four down (Brendan, 2026-09-06:
      // "3-4 cols with 3+ rows"). Row one is what every jurisdiction has, row
      // two what the legislature produces, row three the paperwork and the
      // money, and the news last. This list is also the docs rail's Records
      // section — `components/directory-rail.tsx` reads it — so the panel and
      // the rail cannot say different things. One name per page: Members and
      // News, by Brendan's word, and the rest by title. News is here as well
      // as at the top level: it is a record of what happened, and a reader
      // looking for the day's news should find it where the records are.
      columns: 4,
      items: [
        { href: "/docs/bills", label: "Bills", description: "Every bill in all 52 jurisdictions, newest first.", icon: "FileText" },
        { href: "/docs/committees", label: "Committees", description: "Who sits where, and what is before them.", icon: "Users" },
        { href: "/docs/directory", label: "Members", description: "The sitting members, with party and district.", icon: "BookUser" },
        { href: "/docs/departments", label: "Departments", description: "What each department does, spends, and is asked to do.", icon: "Landmark" },
        { href: "/docs/hearings", label: "Hearings", description: "Every hearing of the Congress, with its transcript.", icon: "Mic" },
        { href: "/docs/nominations", label: "Nominations", description: "Nominations before the Senate.", icon: "UserCheck" },
        { href: "/docs/laws", label: "Laws", description: "What passed, and the bill it began as.", icon: "Scale" },
        { href: "/docs/subjects", label: "Subjects", description: "How a bill is filed, and every bill under each term.", icon: "Tags" },
        { href: "/docs/reports", label: "Reports", description: "Committee reports and CRS research.", icon: "BookOpen" },
        { href: "/docs/record", label: "The Record", description: "The Congressional Record, issue by issue.", icon: "ScrollText" },
        { href: "/docs/money", label: "Finance", description: "Lobbying and campaign money, where the record holds it.", icon: "Coins" },
        { href: "/docs/forms", label: "Forms", description: "Government forms for benefits, grants and programs.", icon: "ClipboardList" },
        { href: "/newsroom", label: "News", description: "What the legislature did, newest first.", icon: "Newspaper" },
      ],
    },
    { href: "/newsroom", label: "News" },
    {
      label: "Agents",
      href: "/agents",
      items: [
        // The offices of a legislature, each named for the duty the agent does
        // (Brendan, 2026-09-03), and under each the problem it solves.
        { href: "/agents/bill-reader", label: "Clerk", description: "A bill you need to understand before the meeting.", icon: "Stamp" },
        { href: "/agents/jurisdiction-guide", label: "Parliamentarian", description: "Whose district, which committee, and where the bill is stuck.", icon: "Gavel" },
        { href: "/agents/money-follower", label: "Treasurer", description: "Who paid, who filed, and what the record leaves out.", icon: "Receipt" },
        { href: "/agents/tracker", label: "Whip", description: "A topic you cannot watch every day.", icon: "Radar" },
        { href: "/agents/researcher", label: "Librarian", description: "A question that needs a report, not an answer.", icon: "Library" },
        { href: "/blocks/intelligence", label: "Inbox", description: "Work you hand off and read when it is done.", icon: "Inbox" },
      ],
    },
    {
      label: "Workspace",
      href: "/workspace/data",
      items: [
        { href: "/workspace/data", label: "Data", description: "Every dataset as a card: open one, or take a session as a file." },
        { href: "/blocks", label: "Blocks", description: "The composed surfaces this site is built from." },
        { href: "/charts/area", label: "Charts", description: "The chart kit, on real rows." },
        { href: "/typeset", label: "Typeset", description: "Set a bill as a document and take the code." },
        { href: "/docs/api", label: "API", description: "Every number on the site, as JSON, one route per family." },
        { href: "/docs/datasets", label: "Datasets", description: "A session at a time, as a file." },
        { href: "/calendar", label: "Calendar", description: "Hearings and sessions by day." },
        { href: "/changelog", label: "Changelog", description: "What shipped, and when." },
      ],
    },
  ],
}
