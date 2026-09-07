// /docs/blocks (Brendan, 2026-09-07): one page per block, in the shape of a
// shadcn component page — preview, installation, usage, composition, data,
// API reference. This is what a page needs beyond the catalogue: where the
// block's source lives, what it exports, and the props the few that take
// any accept. The routes a block reads are found in its source when the page
// is built, so they never drift from the code.

export type BlockDoc = {
  slug: string
  title: string
  /** What the block is, in a sentence, the way a shadcn component page says it. */
  description: string
  group: "home" | "analytics" | "dashboard" | "bill"
  /** The source file, relative to apps/web. */
  file: string
  /** The export the block is. */
  component: string
  /** The JSX that puts it on a page. */
  usage: string
  props?: { name: string; type: string; default?: string; description: string }[]
  /** Where it lives on the site today. */
  lives: string
}

const DESCRIPTIONS: Record<string, string> = {
  "bills": "The session's bills by stage, introduced through vetoed, each a bar against the total, for either chamber.",
  "votes": "The latest roll calls of the session, each with its tally and the split behind it, for either chamber.",
  "topics": "The subjects the session's bills are tagged with, each with its count, most common first.",
  "lobbying": "Federal lobbying registrations from the Senate's LDA filings: registrations, clients, reported spend, and the top registrants.",
  "connect": "A prompt to send bills, votes and hearings to Slack, Discord or Google Drive.",
  "party": "The seats of a chamber by party, as a bar and a list with counts and shares, for either chamber.",
  "sessions": "Every session the jurisdiction has on file, newest first, each with its bill count; the current one is marked.",
  "model-bills": "Bills whose text is shared across states: how many matched, how many states, and the most copied.",
  "committees": "The committees with the most bills before them, each with its count, for either chamber.",
  "traffic": "Bills introduced by each party's members, month by month, over the last six months of the session.",
  "notifications": "A subscription form for bill, committee, member and vote alerts.",
  "navigation": "Links to every record, data and docs page, scoped to the jurisdiction in view.",
  "adopted": "Bills adopted per session, as a line across the sessions on file.",
  "calendar": "A month calendar with the days that have hearings marked, and the next hearings listed under it.",
  "members": "The chamber's members as portraits with the party dot, and a count of those with a photo on file.",
  "api": "The API request that returns the numbers on the page, ready to copy and try.",
  "team": "An empty state inviting a team to a project.",
  "chambers": "The chambers of the jurisdiction, each with its seal, seats and bill count.",
  "metric-votes": "Roll calls taken over a window of days, as a total, a change against the window before, and a line.",
  "metric-introduced": "Bills introduced or prefiled over a window of days, as a total, a change, and a line.",
  "metric-engrossed": "Bills passed by one chamber over a window of days, as a total, a change, and a line.",
  "metric-passed": "Bills enacted, signed or chaptered over a window of days, as a total, a change, and a line.",
  "metric-vetoed": "Vetoes recorded over a window of days, as a total, a change, and a line.",
  "metric-hearings-scheduled": "Hearings on the calendar ahead, over a window of days, as a total, a change, and a line.",
  "metric-hearings-held": "Hearings the calendar shows held, over a window of days, as a total, a change, and a line.",
  "metric-actions": "Every action on every bill over a window of days, as a total, a change, and a line.",
  "metric-amendments": "Amendments offered over a window of days, Congress only, as a total, a change, and a line.",
  "stat-bills": "The session's bill count, with the change against the session before.",
  "stat-adopted": "The session's adopted bills, with the change against the session before and the share of all bills.",
  "stat-roll-calls": "The session's roll calls, with the yeas cast.",
  "stat-seats": "The legislature's seats, split by party.",
  "legislative-activity": "Bills introduced per month by chamber, as stacked bars, with the latest month's figures above.",
  "top-sponsors": "The members who sponsored the most bills this session, each with portrait, party and count.",
  "seats-by-party": "The legislature's seats by party, as a ring with the total in the middle.",
  "busiest-committees": "The committees with the most bills before them, each as a share of the session's bills.",
  "bulk-datasets": "A pointer to the session as files: every family of the record as JSON or CSV.",
  "bill-text": "A bill's text as a file, with every version on record to switch between, expandable and copyable.",
  "bill-sponsors": "A bill's sponsor and co-sponsors as cards, each with role, party, district and the date they joined.",
  "bill-tracker": "A bill's progress through the stages of the process, introduced through became law, with the dates reached.",
  "bill-actions": "Every action on a bill as a table, filterable, with its date, chamber and committee.",
  "bill-votes": "A bill's roll calls, each with its tally and the members' votes.",
  "bill-subjects": "The subjects a bill is tagged with, as a file, expandable and copyable.",
}

const describe = (slug: string) => DESCRIPTIONS[slug] ?? ""

const home = (slug: string, title: string, file: string, component: string, usage = `<${component} />`): BlockDoc => ({ slug, title, description: describe(slug), group: "home", file: `components/cards/${file}.tsx`, component, usage, lives: "/home" })

export const BLOCK_DOCS: BlockDoc[] = [
  home("bills", "Total Bills", "bills", "BillsCard"),
  home("votes", "Votes", "votes", "VotesCard"),
  home("topics", "Topics", "topics", "TopicsCard"),
  home("lobbying", "Lobbying", "lobbying", "LobbyingCard"),
  home("connect", "Connect", "connect", "ConnectCard"),
  home("party", "Party", "party", "PartyCard"),
  home("sessions", "Sessions", "sessions", "SessionsCard"),
  home("model-bills", "Model bills", "model-bills", "ModelBillsCard"),
  home("committees", "Committees", "committees", "CommitteesCard"),
  home("traffic", "Bills by party", "traffic", "BarChartCard"),
  home("notifications", "Subscribe", "notifications", "NotificationSettings"),
  home("navigation", "Navigation", "navigation", "NavigationCard"),
  home("adopted", "Adopted Bills", "adopted", "AdoptedBillsCard"),
  home("calendar", "Calendar", "calendar", "CalendarCard"),
  home("members", "Members", "members", "MembersCard"),
  home("api", "API", "api", "ApiCard"),
  home("team", "Team", "team", "NoTeamMembers"),
  home("chambers", "Chambers", "chambers", "ChambersCard"),
  ...(["votes", "introduced", "engrossed", "passed", "vetoed", "hearings-scheduled", "hearings-held", "actions", "amendments"] as const).map(
    (key): BlockDoc => ({
      slug: `metric-${key}`,
      description: describe(`metric-${key}`),
      title: { votes: "Total Votes", introduced: "Bills Introduced", engrossed: "Bills Engrossed", passed: "Bills Passed", vetoed: "Bills Vetoed", "hearings-scheduled": "Hearings Scheduled", "hearings-held": "Hearings Held", actions: "Actions", amendments: "Amendments" }[key],
      group: "analytics",
      file: "components/home/analytics-grid.tsx",
      component: "MetricCard",
      usage: `<MetricCard metric="${key}" days={30} />`,
      props: [
        { name: "metric", type: "MetricKey", description: "Which count the tile shows." },
        { name: "days", type: "number", default: "30", description: "The window, in days back from today." },
      ],
      lives: "/home",
    })
  ),
  ...([
    ["stat-bills", "Bills", "SalesStatCard", 0],
    ["stat-adopted", "Adopted", "SalesStatCard", 1],
    ["stat-roll-calls", "Roll Calls", "SalesStatCard", 2],
    ["stat-seats", "Seats", "SalesStatCard", 3],
  ] as const).map(
    ([slug, title, component, index]): BlockDoc => ({
      slug,
      title,
      description: describe(slug),
      group: "dashboard",
      file: "components/admin/pages/sales.tsx",
      component,
      usage: `<${component} index={${index}} />`,
      props: [{ name: "index", type: "0 | 1 | 2 | 3", description: "Which of the four figures: bills, adopted, roll calls, seats." }],
      lives: "/workspace/dashboard/sales",
    })
  ),
  ...([
    ["legislative-activity", "Legislative Activity", "LegislativeActivityCard"],
    ["top-sponsors", "Top Sponsors", "TopSponsorsCard"],
    ["seats-by-party", "Seats by Party", "SeatsByPartyCard"],
    ["busiest-committees", "Busiest Committees", "BusiestCommitteesCard"],
    ["bulk-datasets", "Bulk Datasets", "BulkDatasetsCard"],
  ] as const).map(([slug, title, component]): BlockDoc => ({ slug, title, description: describe(slug), group: "dashboard", file: "components/admin/pages/sales.tsx", component, usage: `<${component} />`, lives: "/workspace/dashboard/sales" })),
  {
    slug: "bill-text",
    description: describe("bill-text"),
    title: "Bill text",
    group: "bill",
    file: "components/policy/bill-congress.tsx",
    component: "BillTextBlock",
    usage: `<BillTextBlock bill="HB9329" billNumber="HB9329" state="US" chamber="House" held={documentId} text={text} texts={bill.texts} source={null} />`,
    props: [
      { name: "bill", type: "string", description: "The bill's number, for the chips." },
      { name: "held", type: "number | null", description: "The document the page arrived holding." },
      { name: "text", type: "string | null", description: "That document's text." },
      { name: "texts", type: "HeldText[]", description: "LegiScan's versions, for a state bill." },
    ],
    lives: "/docs/bills/{id}",
  },
  { slug: "bill-sponsors", description: describe("bill-sponsors"), title: "Sponsors", group: "bill", file: "components/policy/bill-congress.tsx", component: "BillSponsorsBlock", usage: `<BillSponsorsBlock sponsors={bill.sponsors} state="US" bill="HB9329" />`, lives: "/docs/bills/{id}" },
  { slug: "bill-tracker", description: describe("bill-tracker"), title: "Tracker", group: "bill", file: "components/policy/bill-depth.tsx", component: "BillTracker", usage: `<BillTracker framed />`, props: [{ name: "framed", type: "boolean", default: "false", description: "Drawn inside the preview frame." }], lives: "/docs/bills/{id}" },
  { slug: "bill-actions", description: describe("bill-actions"), title: "Actions", group: "bill", file: "components/policy/bill-depth.tsx", component: "BillActionsBlock", usage: `<BillActionsBlock history={bill.history} rollCalls={bill.rollCalls} bill="HB9329" />`, lives: "/docs/bills/{id}" },
  { slug: "bill-votes", description: describe("bill-votes"), title: "Votes", group: "bill", file: "components/policy/bill-congress.tsx", component: "BillVotesBlock", usage: `<BillVotesBlock rollCalls={bill.rollCalls} bill="HB9329" billNumber="HB9329" state="US" />`, lives: "/docs/bills/{id}" },
  { slug: "bill-subjects", description: describe("bill-subjects"), title: "Subjects", group: "bill", file: "components/policy/bill-depth.tsx", component: "BillSubjects", usage: `<BillSubjects bill="HB9329" chamber="House" state="US" />`, lives: "/docs/bills/{id}" },
]

export const BLOCK_GROUP_LABEL = { home: "Home", analytics: "Analytics", dashboard: "Dashboards", bill: "Bill" } as const

export const findBlockDoc = (slug: string) => BLOCK_DOCS.find((d) => d.slug === slug)

/** The API routes a block reads, found in its source: usePolicy("bills", …), useScoped("seats", …). */
export function resourcesIn(source: string): string[] {
  const out = new Set<string>()
  for (const m of source.matchAll(/use(?:Policy|Scoped)(?:<[^>]*>)?\(\s*(?:[^,()]*?\?\s*)?"([a-z][a-z0-9-]*)"/g)) out.add(m[1])
  return [...out].sort()
}

/** The card slots a block composes, in the order they appear in its source. */
export function compositionIn(source: string, component: string): string[] {
  const slots = ["CardHeader", "CardTitle", "CardDescription", "CardAction", "CardContent", "CardFooter", "ChartContainer", "Table", "ItemGroup", "Calendar", "Empty", "Progress", "ToggleGroup"]
  const seen: string[] = []
  for (const m of source.matchAll(/<([A-Z][A-Za-z]+)\b/g)) if (slots.includes(m[1]) && !seen.includes(m[1])) seen.push(m[1])
  return [component, ...seen]
}
