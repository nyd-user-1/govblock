// The API, written down once: every resource under /api/policy that a page
// reads, with its summary and its options, so the API doc and each
// jurisdiction's page draw the same figures the subjects page introduced
// (Brendan, 2026-09-05: "an api and data set library"). A resource that
// exists only under Congress says so, and a jurisdiction's page leaves it out.

export type ApiResource = {
  name: string
  summary: string
  /** One line under the heading, in the docs' voice. */
  lead: string
  options: [string, string][]
  /** Query parameters the example carries beyond state and session. */
  example?: Record<string, string | number>
  /** Only Congress has the source behind it. */
  federal?: boolean
}

const SCOPE: [string, string][] = [
  ["state <code>", "the jurisdiction: US, or a state's postal code"],
  ["session <year>", "the session's first year (default: the current one)"],
]
const PAGE: [string, string][] = [
  ["limit <n>", "rows per page"],
  ["offset <n>", "rows to skip"],
]

export const API_RESOURCES: ApiResource[] = [
  {
    name: "bills",
    summary: "the bills of a jurisdiction, newest action first",
    lead: "The bills of the session, newest action first. The answer is rows and total, paged by limit and offset.",
    options: [
      ...SCOPE,
      [
        "subject <term>",
        "a policy area or legislative subject, as CRS spells it",
      ],
      ["chamber <name>", "House or Senate"],
      ["committee <name>", "the committee the bill sits before"],
      ["member <id>", "bills a member sponsored"],
      ["status <name>", "Introduced, Engrossed, Enrolled, Passed or Vetoed"],
      ["sort <key>", "newest (default), number-desc or number-asc"],
      ["limit <n>", "rows per page (default: 40)"],
      ["offset <n>", "rows to skip"],
    ],
    example: { limit: 20 },
  },
  {
    name: "bill",
    summary: "one bill, whole: sponsors, history, roll calls, referrals, texts",
    lead: "One bill with everything the record holds on it: sponsors, history, roll calls, referrals, documents and the texts on file.",
    options: [
      ...SCOPE,
      ["id <bill_id>", "the bill's id"],
      ["number <text>", "or its number, as printed: HR 1, A 7380, HB10171"],
    ],
    example: { number: "HB 1" },
  },
  {
    name: "text",
    summary: "the text of a bill, the newest version or one by document",
    lead: "The text of a bill as its legislature published it. The newest version unless a document is named; format=raw answers as plain text.",
    options: [
      ...SCOPE,
      ["id <bill_id>", "the bill's id"],
      ["document <id>", "one version, by document id"],
      ["format raw", "plain text instead of JSON"],
    ],
    example: { id: 2057965 },
  },
  {
    name: "members",
    summary: "the members of a jurisdiction, the sitting ones first",
    lead: "Every member the record knows, the sitting ones first, with party, chamber, district and portrait.",
    options: [
      ...SCOPE,
      ["chamber <name>", "House, Senate or Assembly"],
      ["party <letter>", "D, R or I"],
    ],
  },
  {
    name: "member",
    summary: "one member, whole",
    lead: "One member's row, with their office and identifiers.",
    options: [...SCOPE, ["id <people_id>", "the member's id"]],
    example: { id: 16271 },
  },
  {
    name: "record",
    summary:
      "a member's record in a session: sponsored, co-sponsored, aye and nay",
    lead: "What a member put their name to and how they voted, a page of each, with the counts.",
    options: [
      ...SCOPE,
      ["id <people_id>", "the member's id"],
      ["limit <n>", "rows per list"],
      ["offset <n>", "rows to skip"],
    ],
    example: { id: 16271, limit: 5 },
  },
  {
    name: "committees",
    summary: "the committees of a jurisdiction, with the bills before each",
    lead: "Every committee the session's bills sit before, with the count.",
    options: [...SCOPE],
  },
  {
    name: "committee-bills",
    summary: "the bills before one committee",
    lead: "The bills referred to a committee this session, newest first.",
    options: [
      ...SCOPE,
      ["committee <name>", "the committee, as the record spells it"],
      ...PAGE,
    ],
    example: { committee: "Agriculture", limit: 20 },
  },
  {
    name: "rollcalls",
    summary: "the roll calls of a session, newest first",
    lead: "The roll calls of the session with their tallies, newest first.",
    options: [...SCOPE, ["chamber <name>", "House or Senate"], ...PAGE],
    example: { limit: 10 },
  },
  {
    name: "rollcall",
    summary: "one roll call with every position",
    lead: "One roll call: the question, the tally, and how every member voted.",
    options: [...SCOPE, ["id <roll_call_id>", "the roll call's id"]],
    example: { id: 1613338 },
  },
  {
    name: "subject-terms",
    summary: "every subject term of a jurisdiction, with its bill count",
    lead: "The jurisdiction's terms with the bills under each: policyAreas and subjects under Congress, subjects alone elsewhere.",
    options: [...SCOPE],
  },
  {
    name: "stories",
    summary: "the press on a jurisdiction's government, newest first",
    lead: "What the news APIs have reported on the jurisdiction's legislature and governor, newest first.",
    options: [
      ...SCOPE,
      ["limit <n>", "how many, up to 500"],
      ["q <text>", "a word the headline or summary carries"],
    ],
    example: { limit: 8 },
  },
  {
    name: "story",
    summary: "one story, with as much body as its outlet handed over",
    lead: "One story from the press: headline, summary, byline, and the body where the outlet's API carried it.",
    options: [["id <story id>", "the story's id"]],
  },
  {
    name: "sessions",
    summary: "the sessions a jurisdiction has, with bill counts",
    lead: "Every session the record holds for the jurisdiction, newest first, with how many bills each has.",
    options: [
      ["state <code>", "the jurisdiction"],
      ["titles 1", "carry each session's own title"],
    ],
    example: { titles: 1 },
  },
  {
    name: "search",
    summary: "bills, members, committees and text, by a word or a number",
    lead: "One query across bills, members and committees, and with text=1 across the bills' text; all=1 answers for every jurisdiction with the one in scope first.",
    options: [
      ...SCOPE,
      ["q <text>", "at least two characters"],
      ["all 1", "every jurisdiction, the one in scope first"],
      ["text 1", "search the bills' text as well"],
      ["limit <n>", "rows per section (max 20)"],
    ],
    example: { q: "water", limit: 5 },
  },
  {
    name: "actions",
    summary:
      "a bill's actions as congress.gov files them, with codes and committees",
    lead: "Every action on a federal bill from BILLSTATUS: the code, the acting committee, and the roll call it produced.",
    options: [["bill <bill_id>", "the bill's id"], ...PAGE],
    example: { bill: 2057965, limit: 20 },
    federal: true,
  },
  {
    name: "cosponsors",
    summary: "a bill's cosponsors, with the day each joined",
    lead: "Every cosponsor of a federal bill, with the date they joined, whether they were original, and the day they withdrew.",
    options: [["bill <bill_id>", "the bill's id"]],
    example: { bill: 2057965 },
    federal: true,
  },
  {
    name: "summaries",
    summary: "the CRS summaries of a bill, one per stage",
    lead: "The Congressional Research Service's summaries of a federal bill, one per stage.",
    options: [["bill <bill_id>", "the bill's id"]],
    example: { bill: 2057965 },
    federal: true,
  },
  {
    name: "amendments",
    summary: "the amendments offered to a bill",
    lead: "Every amendment offered to a federal bill, with its purpose and latest action.",
    options: [["bill <bill_id>", "the bill's id"], ...PAGE],
    example: { bill: 2057965, limit: 20 },
    federal: true,
  },
  {
    name: "text-versions",
    summary: "every text version of a bill, held or listed",
    lead: "The versions a federal bill's text moved through, every one we hold and every one congress.gov lists, with govinfo's renderings.",
    options: [["bill <bill_id>", "the bill's id"]],
    example: { bill: 2057965 },
    federal: true,
  },
  {
    name: "member-votes",
    summary: "a member's positions on House roll calls",
    lead: "How a representative voted on every House roll call of the Congress, from congress.gov.",
    options: [
      ["member <people_id>", "the member's id"],
      ["bioguide <id>", "or their bioguide id"],
    ],
    example: { member: 16271 },
    federal: true,
  },
  {
    name: "fec",
    summary: "a member's campaign totals by cycle",
    lead: "Raised, spent and on hand for each cycle, from the FEC.",
    options: [["id <people_id>", "the member's id"]],
    example: { id: 16271 },
    federal: true,
  },
]

/** The families the bulk route answers, a session at a time. */
export const DATASET_FAMILIES: { name: string; summary: string }[] = [
  {
    name: "bills",
    summary: "every bill, with status, latest action, committee and sponsor",
  },
  { name: "sponsors", summary: "every sponsorship: bill, member, position" },
  {
    name: "members",
    summary: "everyone who sat, with party, chamber, district",
  },
  { name: "committees", summary: "every committee, with its bill count" },
  { name: "rollcalls", summary: "every roll call, with its tally" },
  { name: "votes", summary: "every position: member, roll call, vote" },
  { name: "history", summary: "every action on every bill, in order" },
]
