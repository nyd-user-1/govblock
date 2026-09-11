// Ported from livingston-v3 lib/config.ts.
// `icon` is a lucide name; `components/main-nav.tsx` holds the one map from
// name to component, so this file stays data and never imports a component.
export type NavLink = {
  href: string
  label: string
  description?: string
  icon?: string
}
/**
 * The tile that leads a menu's panel (Brendan, 2026-09-10, on shadcnblocks'
 * navbar4): where that block is black in the example it is one of our two
 * here, and the menus alternate between them. A still gives the tile a
 * picture; without one the colour is the whole tile.
 *
 * Read only by components/main-nav-2.tsx, the navbar4 nav kept beside the one
 * the site draws. The nav in use ignores `promo` and `groups`, so these stay
 * here waiting rather than being rebuilt.
 */
export type NavPromo = {
  title: string
  description: string
  href: string
  image?: string
  tone: "red" | "blue"
}

/** A labelled run of items inside a panel, named by the hrefs it holds. */
export type NavGroup = { label: string; items: string[] }

export type NavItem =
  | NavLink
  | {
      label: string
      href: string
      items: NavLink[]
      columns?: 2 | 3 | 4 | 5 | 6
      /** The line across the panel's foot, in place of "Learn more about…". */
      footer?: string
      /** With these two a menu draws navbar4's panel instead of the plain grid. */
      promo?: NavPromo
      groups?: NavGroup[]
    }


// The record's own pages (2026-09-10). They used to sit under /docs, which is
// how a living page and its documentation came to want the same name; they are
// at the root now, and /docs is documentation again. Everything here reads the
// jurisdiction in scope, so a link to one carries ?state=.
export const RECORD_ROUTES = [
  "/amendments",
  "/bills",
  "/committees",
  "/departments",
  "/forms",
  "/hearings",
  "/legislative-subjects",
  "/lobbying",
  "/meetings",
  "/members",
  "/money",
  "/nominations",
  "/policy-areas",
  "/record",
  "/reports",
  "/roll-call-votes",
  "/tags",
] as const

/** Whether a link should carry the jurisdiction in scope. */
export function isScoped(href: string) {
  const path = href.split(/[?#]/)[0]
  return RECORD_ROUTES.some((route) => path === route || path.startsWith(route + "/"))
}

/** A record link with the jurisdiction on it, whatever else it already carries. */
export function withScope(href: string, state: string) {
  if (!isScoped(href)) return href
  return `${href}${href.includes("?") ? "&" : "?"}state=${state}`
}

export function hasItems(
  item: NavItem
): item is Extract<NavItem, { items: unknown[] }> {
  return "items" in item && Array.isArray(item.items)
}

export const siteConfig = {
  name: "govblock",
  url: "https://gov.nysgpt.com",
  description:
    "One view over all 50 states and Congress. Open Source. Open Code. Open Data.",
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
  // Annotated, so a plain link and a panel are both NavItem here rather than
  // two inferred literal shapes. Without it a reader of `navItems` sees the
  // union of the literals, and `item.icon` is an error on any entry that
  // happens not to carry one.
  navItems: [
    { href: "/", label: "Home" },
    {
      label: "Records",
      href: "/bills",
      promo: {
        title: "The Record",
        description:
          "Every bill, vote, hearing and dollar in all 52 jurisdictions, in one shape.",
        href: "/bills",
        tone: "blue",
      },
      groups: [
        {
          label: "Legislation",
          items: [
            "/bills",
            "/amendments",
            "/bills?status=enacted",
            "/roll-call-votes",
            "/record",
          ],
        },
        {
          label: "Who acts",
          items: ["/members", "/committees", "/departments"],
        },
        { label: "Money", items: ["/money", "/lobbying"] },
        {
          label: "Filed under",
          items: ["/tags", "/reports", "/hearings"],
        },
        {
          label: "Elsewhere",
          items: ["/nominations", "/forms", "/newsroom"],
        },
      ],
      // Aurora's own count, 2026-09-09: live rows across 166 tables, written out
      // as it stood. It grows daily, so the line only becomes more true.
      footer:
        "Browse more than 159,109,531 records across all 50 states and the federal government.",
      // Sixteen entries, three across (Brendan, 2026-09-08: the fourth column
      // held three orphans, so the grid is three wide). Amendments joined on
      // 2026-09-10 and takes the first seat, which leaves the sixth row holding
      // one. Alphabetical, because sixteen names in a panel is a list to look
      // something up in, not an argument about which matters most.
      // This list is also the docs rail's Records section —
      // `components/directory-rail.tsx` reads it — so the panel and the rail
      // cannot say different things.
      columns: 3,
      items: [
        {
          href: "/amendments",
          label: "Amendments",
          description: "What was offered to change a bill, and how far it got.",
          icon: "FileSignature",
        },
        {
          href: "/bills",
          label: "Bills",
          description: "Every bill in all 52 jurisdictions, newest first.",
          icon: "FileText",
        },
        {
          href: "/committees",
          label: "Committees",
          description: "Who sits where, and what is before them.",
          icon: "Users",
        },
        {
          href: "/departments",
          label: "Departments",
          description: "What each department does, spends, and is asked to do.",
          icon: "Landmark",
        },
        {
          href: "/money",
          label: "Finance",
          description:
            "Lobbying and campaign money, where the record holds it.",
          icon: "Coins",
        },
        {
          href: "/forms",
          label: "Forms",
          description: "Government forms for benefits, grants and programs.",
          icon: "ClipboardList",
        },
        {
          href: "/hearings",
          label: "Hearings",
          description: "Every hearing of the Congress, with its transcript.",
          icon: "Mic",
        },
        {
          // Becoming law is a bill's last stage, not a section of its own.
          href: "/bills?status=enacted",
          label: "Enacted",
          description: "What passed, and the bill it began as.",
          icon: "Scale",
        },
        {
          href: "/lobbying",
          label: "Lobbying",
          description: "Who is paid to be heard, on what, and for whom.",
          icon: "Handshake",
        },
        {
          href: "/members",
          label: "Members",
          description: "The sitting members, with party and district.",
          icon: "BookUser",
        },
        {
          href: "/newsroom",
          label: "News",
          description: "What the legislature did, newest first.",
          icon: "Newspaper",
        },
        {
          href: "/nominations",
          label: "Nominations",
          description: "Nominations before the Senate.",
          icon: "UserCheck",
        },
        {
          href: "/reports",
          label: "Reports",
          description: "Committee reports and CRS research.",
          icon: "BookOpen",
        },
        {
          href: "/roll-call-votes",
          label: "Roll calls",
          description: "Every recorded vote, and how each member answered.",
          icon: "ListChecks",
        },
        {
          href: "/tags",
          label: "Subjects",
          description: "How a bill is filed, and every bill under each term.",
          icon: "Tags",
        },
        {
          href: "/record",
          label: "The Record",
          description: "The Congressional Record, issue by issue.",
          icon: "ScrollText",
        },
      ],
    },
    {
      label: "News",
      href: "/news",
      promo: {
        title: "The desks",
        description:
          "What the press filed on every legislature, read and written up each morning.",
        href: "/news",
        image: "https://assets.mixkit.co/videos/40700/40700-thumb-720-0.jpg",
        tone: "red",
      },
      groups: [
        {
          label: "Today",
          items: ["/briefing", "/happening-now", "/hot-takes"],
        },
        {
          label: "Filed under",
          items: ["/tags", "/policy-areas", "/legislative-subjects"],
        },
        {
          label: "The room",
          items: ["/discussions", "/watercooler", "/leaderboard"],
        },
        { label: "Watching", items: ["/watches", "/sources"] },
      ],
      // Eleven entries, alphabetical, three across (Brendan, 2026-09-09).
      // Four have pages; the rest are named here first and built later.
      columns: 3,
      items: [
        {
          href: "/briefing",
          label: "Briefing",
          description:
            "Start the day knowing what the press said about your desk.",
          icon: "Coffee",
        },
        {
          href: "/discussions",
          label: "Discussions",
          description:
            "Argue the bill, not the headline, with people reading the same record.",
          icon: "MessagesSquare",
        },
        {
          href: "/happening-now",
          label: "Happening Now",
          description: "What moved in the last hour, across every desk.",
          icon: "Activity",
        },
        {
          href: "/hot-takes",
          label: "Hot Takes",
          description: "The sharpest reads of the day, signed and dated.",
          icon: "Flame",
        },
        {
          href: "/leaderboard",
          label: "Leaderboard",
          description: "Who reads, writes and watches the most, by desk.",
          icon: "Trophy",
        },
        {
          href: "/legislative-subjects",
          label: "Legislative Subjects",
          description:
            "The specific terms a bill touches, each with its bills.",
          icon: "Tags",
        },
        {
          href: "/policy-areas",
          label: "Policy Areas",
          description: "The one broad term every bill is filed under.",
          icon: "Layers",
        },
        {
          href: "/sources",
          label: "Sources",
          description: "Every outlet the desks read, and how often each runs.",
          icon: "Rss",
        },
        {
          href: "/tags",
          label: "Tags",
          description:
            "Every subject the record files a bill under, with its page.",
          icon: "Tag",
        },
        {
          href: "/watches",
          label: "Watches",
          description: "A topic, watched every hour, delivered where you work.",
          icon: "Eye",
        },
        {
          href: "/watercooler",
          label: "Watercooler",
          description: "The room where nothing is on the record.",
          icon: "CupSoda",
        },
      ],
    },
    {
      label: "Agents",
      href: "/agents",
      promo: {
        title: "Six specialists",
        description:
          "One record, six narrower grants: each reads what it needs and refuses the rest.",
        href: "/agents",
        tone: "blue",
      },
      groups: [
        {
          label: "Read and write",
          items: [
            "/agents/bill-reader",
            "/agents/researcher",
            "/agents/reporter",
          ],
        },
        {
          label: "Find and follow",
          items: [
            "/agents/jurisdiction-guide",
            "/agents/tracker",
            "/agents/money-follower",
          ],
        },
        { label: "Fill in", items: ["/agents/form-filler"] },
      ],
      // Six agents, alphabetical. The Inbox left this panel on 2026-09-08: it
      // is a place work lands, not an agent you can ask a question, so it sits
      // in the Workspace and the Filer takes its seat here.
      columns: 2,
      items: [
        {
          href: "/agents/bill-reader",
          label: "Clerk",
          description: "A bill you need to understand before the meeting.",
          icon: "Stamp",
        },
        {
          href: "/agents/form-filler",
          label: "Filer",
          description: "A benefits form filled in by answering questions.",
          icon: "FileSignature",
        },
        {
          href: "/agents/researcher",
          label: "Librarian",
          description: "A question that needs a report, not an answer.",
          icon: "Library",
        },
        {
          href: "/agents/jurisdiction-guide",
          label: "Parliamentarian",
          description:
            "Whose district, which committee, and where the bill is stuck.",
          icon: "Gavel",
        },
        {
          href: "/agents/money-follower",
          label: "Treasurer",
          description: "Who paid, who filed, and what the record leaves out.",
          icon: "Receipt",
        },
        {
          href: "/agents/reporter",
          label: "Reporter",
          description:
            "The day's press on your desk, with a source on every line.",
          icon: "NotebookPen",
        },
        {
          href: "/agents/tracker",
          label: "Whip",
          description: "A topic you cannot watch every day.",
          icon: "Radar",
        },
      ],
    },
    {
      label: "Workspace",
      href: "/workspace/data",
      promo: {
        title: "Your desk",
        description:
          "Open a dataset, build a page from blocks, or set a bill in type worth publishing.",
        href: "/workspace/data",
        tone: "red",
      },
      groups: [
        {
          label: "Work",
          items: [
            "/workspace/data",
            "/workspace/dashboard",
            "/workspace/blocks",
            "/workspace/typeset",
          ],
        },
        {
          label: "Watch",
          items: ["/map", "/calendar", "/blocks/intelligence", "/newsroom"],
        },
        {
          label: "Build on it",
          items: ["/docs/api", "/docs/blocks", "/docs/datasets"],
        },
        { label: "Read", items: ["/changelog", "/clips"] },
      ],
      // Thirteen entries, alphabetical, three across. Each line says what the
      // page is worth rather than restating its name (Brendan, 2026-09-08:
      // "stop calling an orange an orange").
      columns: 3,
      items: [
        {
          href: "/blocks/intelligence",
          label: "Agentic Inbox",
          description: "Hand a job to an agent and read it when it lands.",
          icon: "Inbox",
        },
        {
          href: "/docs/api",
          label: "API",
          description: "Build on the same numbers the pages are drawn from.",
          icon: "Braces",
        },
        {
          href: "/docs/blocks",
          label: "Block docs",
          description:
            "Take a block into your own app, props and source with it.",
          icon: "BookMarked",
        },
        {
          href: "/workspace/blocks",
          label: "Blocks",
          description:
            "Build a page from parts that arrive already holding data.",
          icon: "Blocks",
        },
        {
          href: "/calendar",
          label: "Calendar",
          description: "See what is scheduled before it happens, not after.",
          icon: "CalendarDays",
        },
        {
          href: "/changelog",
          label: "Changelog",
          description: "Know what changed, so a number is never a surprise.",
          icon: "History",
        },
        {
          href: "/clips",
          label: "Creators",
          description: "Short video from the record, and your own.",
          icon: "SquarePlay",
        },
        {
          href: "/workspace/dashboard",
          label: "Dashboards",
          description: "Watch a chamber, a committee or a topic at a glance.",
          icon: "LayoutDashboard",
        },
        {
          href: "/workspace/data",
          label: "Data",
          description: "Open any dataset as a card and work it where it lives.",
          icon: "Database",
        },
        {
          href: "/docs/datasets",
          label: "Datasets",
          description: "Take a whole session away as a file and analyse it.",
          icon: "FileDown",
        },
        {
          href: "/map",
          label: "Map",
          description:
            "Every congressional district, coloured by what the Census counts there.",
          icon: "MapPin",
        },
        {
          href: "/newsroom",
          label: "News",
          description: "Catch what the legislature did while you were away.",
          icon: "Newspaper",
        },
        {
          href: "/workspace/typeset",
          label: "Typeset",
          description: "Turn a bill into a document worth publishing.",
          icon: "Type",
        },
      ],
    },
    // Creators was the header's last flat entry until 2026-09-09; it lives in
    // the Workspace menu now, in its alphabetical seat.
  ] as NavItem[],
}
