// Ported from livingston-v3 lib/config.ts.
export type NavLink = { href: string; label: string; description?: string }
export type NavItem = NavLink | { label: string; href: string; items: NavLink[] }

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
      items: [
        { href: "/docs/bills", label: "Bills", description: "Every bill in all 52 jurisdictions, newest first." },
        { href: "/docs/committees", label: "Committees", description: "Who sits where, and what is before them." },
        { href: "/docs/directory", label: "Directory", description: "The sitting members, with party and district." },
        { href: "/docs/laws", label: "Laws", description: "What passed, and the bill it began as." },
        { href: "/docs/nominations", label: "Nominations", description: "Nominations before the Senate." },
        { href: "/docs/reports", label: "Reports", description: "Committee reports and CRS research." },
        { href: "/docs/record", label: "The Record", description: "The Congressional Record, issue by issue." },
      ],
    },
    { href: "/newsroom", label: "News Room" },
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
