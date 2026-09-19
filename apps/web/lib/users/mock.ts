// Readers, as a mock-up (Brendan, 2026-09-18). /users is daily.dev's
// leaderboard and /users/[handle] its profile, drawn before GovBlock counts
// any of it: the people here are invented, and their numbers come from a
// seeded generator, so every build draws the same boards. The employers are
// generic but for the legislatures, whose seals the verified board wears. When reading days,
// reputation and referrals are counted for real, this file is what they replace.

export type Take = { emoji: string; title: string; sub?: string; upvotes: number }
export type Post = { title: string; tags: string[]; day: string; minutes: number; upvotes: number; comments: number }
export type Reply = { on: string; href: string; text: string; day: string; upvotes: number }
export type Job = { org: string; state: string; chamber?: string; roles: { title: string; from: string; to?: string }[]; verified?: boolean }

export type User = {
  handle: string
  name: string
  headline: string
  org: string
  state: string
  joined: string
  bio: string[]
  links: { kind: "x" | "linkedin" | "site" | "github"; url: string }[]
  issues: string[]
  desks: string[]
  work: Job[]
  takes: Take[]
  posts: Post[]
  replies: Reply[]
  upvoted: Post[]
  stats: { xp: number; level: number; reputation: number; streak: number; readingDays: number; views: number; upvotes: number; referrals: number; followers: number; following: number }
  topTags: { slug: string; name: string; share: number }[]
  /** Posts read per day over the last 21 weeks, oldest first, Sunday to Saturday. */
  heat: number[]
}

/* ------------------------------------------------------------ the seed */

function rng(seed: string) {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}
const between = (r: () => number, lo: number, hi: number) => Math.round(lo * Math.pow(hi / lo, r()))

/* ------------------------------------------------------------ the people */

const PEOPLE: [name: string, handle: string, headline: string, org: string, state: string][] = [
  ["Maya Okafor", "mayaokafor", "Committee counsel. Reads every amendment so you don't have to.", "New York State Assembly", "NY"],
  ["Daniel Reyes", "dreyes", "Statehouse reporter covering the budget and the people who write it.", "Statehouse newsroom", "TX"],
  ["Priya Natarajan", "priyan", "Housing policy, zoning reform, and the fiscal notes behind them.", "Housing policy nonprofit", "CA"],
  ["Tom Whitaker", "twhitaker", "Legislative director. Former city council aide.", "U.S. House of Representatives", "OH"],
  ["Grace Lindqvist", "gracel", "Election administration nerd. Ballot design, audits, turnout.", "Election policy institute", "MN"],
  ["Marcus Bell", "marcusbell", "Lobbying disclosure, campaign finance, follow the money.", "Campaign finance watchdog", "DC"],
  ["Hannah Cho", "hannahcho", "Health policy analyst. Medicaid waivers and the fights over them.", "Health policy institute", "WA"],
  ["Luis Ortega", "lortega", "Organizer turned policy staffer. Labor and workforce bills.", "California State Assembly", "CA"],
  ["Evelyn Brooks", "ebrooks", "Civics teacher. Brings the roll call into the classroom.", "Public school district", "VA"],
  ["Sam Adeyemi", "samadeyemi", "Data journalist. Every chart starts with a FOIA request.", "Investigative newsroom", "NY"],
  ["Olivia Park", "opark", "Energy and utilities. Rate cases are thrillers, actually.", "Pennsylvania House of Representatives", "PA"],
  ["Jonah Feld", "jonahfeld", "Appropriations staff. Spreadsheets with consequences.", "U.S. House of Representatives", "MD"],
  ["Rosa Delgado", "rosad", "Immigration attorney tracking state and federal bills.", "Immigrant rights coalition", "FL"],
  ["Ben Hartley", "benhartley", "Rural broadband and farm bill watcher.", "State farm bureau", "IA"],
  ["Aisha Rahman", "aisharahman", "Criminal justice reform. Sentencing, bail, reentry.", "Justice reform institute", "NY"],
  ["Chris Novak", "cnovak", "Policy engineer. Turns statutes into structured data.", "Civic tech studio", "IL"],
  ["Nadia Petrova", "npetrova", "Education finance and school choice research.", "Georgia House of Representatives", "GA"],
  ["Kevin Tran", "kevintran", "Transportation planner. Transit bills and highway money.", "Massachusetts House of Representatives", "MA"],
  ["Elena Russo", "erusso", "Environmental law clinic. Water rights and permitting.", "Law school clinic", "CO"],
  ["Isaac Moore", "isaacmoore", "Chief of staff. Keeps the calendar, the caucus and the coffee.", "Ohio House of Representatives", "OH"],
  ["Fatima Haddad", "fhaddad", "Privacy and AI regulation across the fifty states.", "Privacy think tank", "DC"],
  ["Ryan O'Neill", "ryanoneill", "Veterans affairs caseworker and benefits advocate.", "Texas House of Representatives", "TX"],
  ["Mei Lin", "meilin", "Budget office economist. Scores bills for a living.", "Congressional Budget Office", "DC"],
  ["Jordan Blake", "jordanblake", "Local news editor. City hall to the capitol.", "Local newsroom", "AZ"],
  ["Sofia Mendes", "sofiam", "Child welfare advocate and former foster youth.", "Washington House of Representatives", "WA"],
  ["Andre Williams", "andrew", "Civil rights attorney. Voting rights litigation.", "Civil rights legal fund", "GA"],
  ["Claire Dubois", "clairedubois", "Tax policy. Credits, carve-outs and who they reach.", "Tax policy institute", "DC"],
  ["Noah Friedman", "noahf", "Healthcare staffer. Drug pricing and insurance mandates.", "New Jersey General Assembly", "NJ"],
  ["Imani Scott", "imaniscott", "Community organizer. Tenants' rights and eviction diversion.", "Tenants' union", "MI"],
  ["Peter Gallagher", "pgallagher", "Retired legislator. Still reads the calendar every morning.", "New Hampshire House", "NH"],
  ["Leah Goldberg", "leahg", "Disability policy and accessibility law.", "Disability rights network", "MD"],
  ["Omar Siddiqui", "omars", "Cybersecurity and critical infrastructure bills.", "U.S. Senate", "VA"],
  ["Hazel Morgan", "hazelm", "Agriculture economist. Crop insurance and SNAP.", "State university", "KS"],
  ["Victor Chen", "victorchen", "Open data advocate. APIs for every legislature.", "Open data project", "CA"],
  ["Ruth Adler", "ruthadler", "Parliamentarian's office alum. Rules, procedure, precedent.", "Pennsylvania Senate", "PA"],
  ["Diego Alvarez", "diegoalvarez", "Border communities and trade policy.", "New Mexico House of Representatives", "NM"],
]

const ISSUES = ["housing", "health-care-costs", "education", "elections", "prisons", "immigration", "taxes", "environment", "energy", "labor", "transportation", "veterans", "civil-rights", "agriculture", "broadband", "data-privacy", "artificial-intelligence", "campaign-finance", "child-welfare", "appropriations", "banking", "border-security", "aviation", "public-health"]

const TAKES: Omit<Take, "upvotes">[] = [
  { emoji: "📜", title: "Most bills should have a sunset clause.", sub: "If it's worth keeping, it's worth voting on again." },
  { emoji: "🗳️", title: "Primaries decide more elections than generals do.", sub: "Look at the margins in safe seats." },
  { emoji: "🧮", title: "A fiscal note is a forecast, not a fact." },
  { emoji: "🏛️", title: "Committee is where bills actually die.", sub: "The floor is theatre." },
  { emoji: "📰", title: "Local news is the best predictor of turnout." },
  { emoji: "🔥", title: "Omnibus bills are how nobody reads anything." },
  { emoji: "🏠", title: "Zoning is the housing crisis.", sub: "Everything else is a rounding error." },
  { emoji: "💡", title: "Staffers write the law; members sign it." },
  { emoji: "⚖️", title: "Every mandate needs a funding line.", sub: "Otherwise it's a press release." },
  { emoji: "🧭", title: "Read the amendments, not the title.", sub: "The title is marketing." },
  { emoji: "🚆", title: "Transit funding should follow riders, not districts." },
  { emoji: "🧑‍🏫", title: "Civics should be taught with real roll calls." },
  { emoji: "🔍", title: "Lobbying disclosure should be real-time.", sub: "Quarterly is an eternity in session." },
  { emoji: "🌾", title: "The farm bill is really a food bill." },
  { emoji: "🤖", title: "States will regulate AI before Congress does.", sub: "They already are." },
  { emoji: "📊", title: "Party-line votes are rarer than cable news says." },
  { emoji: "✍️", title: "Plain-language summaries should be required by law." },
  { emoji: "💯", title: "Term limits made legislatures weaker, not cleaner." },
]

const POST_TITLES = [
  "What the Assembly's housing package actually changes",
  "Reading a fiscal note in five minutes",
  "The three committees where bills go to die",
  "How a roll call became a campaign ad",
  "Tracing one lobbying client across four states",
  "Why the budget is late again, explained with one chart",
  "The amendment that rewrote the bill",
  "Open primaries: what the returns say",
  "A week in the statehouse press gallery",
  "Model legislation, word for word, in twelve states",
]

const DESK_SIZES: Record<string, number> = { US: 9700, NY: 2500, CA: 2100, TX: 1800, FL: 1200, PA: 900, OH: 700, GA: 640, MA: 520, WA: 480 }

function build([name, handle, headline, org, state]: (typeof PEOPLE)[number], i: number): User {
  const r = rng(handle)
  const pick = <T,>(xs: T[], n: number) => [...xs].sort(() => r() - 0.5).slice(0, n)
  const issues = pick(ISSUES, 5 + Math.floor(r() * 6))
  const xp = between(r, 2000, 19000)
  const reputation = between(r, 400, 83000)
  const takes = pick(TAKES, 2 + Math.floor(r() * 3)).map((t) => ({ ...t, upvotes: between(r, 20, 2000) }))
  const day = (back: number) => new Date(Date.parse("2026-09-18") - back * 864e5).toISOString().slice(0, 10)
  const posts = pick(POST_TITLES, 4).map((title, n) => ({ title, tags: pick(issues, 3), day: day(n * 6 + Math.floor(r() * 5)), minutes: 3 + Math.floor(r() * 9), upvotes: between(r, 1, 400), comments: Math.floor(r() * 40) }))
  const joinedYear = 2019 + Math.floor(r() * 7)
  const desks = [...new Set([state, "US", ...pick(Object.keys(DESK_SIZES), 3)])].slice(0, 5)
  const shares = pick(issues, 6)
    .map((slug) => ({ slug, share: 30 + Math.floor(r() * 30) }))
    .sort((a, b) => b.share - a.share)
  const readingDays = between(r, 180, 2300)
  const heat = Array.from({ length: 21 * 7 }, () => (r() < 0.35 ? 0 : Math.floor(r() * 12)))
  return {
    handle,
    name,
    headline,
    org,
    state,
    joined: `${joinedYear}-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-${String(1 + Math.floor(r() * 27)).padStart(2, "0")}`,
    bio: [
      `${headline} On GovBlock since the first session it covered, reading the ${state === "US" || state === "DC" ? "Congressional" : state} record most mornings.`,
      `Ask about ${issues.slice(0, 3).map((s) => s.replace(/-/g, " ")).join(", ")}, or anything on the calendar this week.`,
    ],
    links: [
      { kind: "x", url: `https://x.com/${handle}` },
      { kind: "linkedin", url: `https://www.linkedin.com/in/${handle}` },
      ...(r() > 0.5 ? [{ kind: "site" as const, url: `https://${handle}.substack.com` }] : []),
    ],
    issues,
    desks,
    work: [
      { org, state, verified: /House|Assembly|Senate/.test(org), roles: [{ title: headline.split(".")[0]!.slice(0, 48), from: `${2022 + Math.floor(r() * 3)}-0${1 + Math.floor(r() * 8)}` }] },
      { org: i % 2 ? "Civic league" : "State Budget Office", state, roles: [{ title: i % 2 ? "Policy fellow" : "Analyst", from: `${joinedYear - 3}-06`, to: `${joinedYear}-05` }] },
    ],
    takes,
    posts,
    replies: posts.slice(0, 3).map((p, n) => ({ on: p.title, href: `/users/${PEOPLE[(i + n + 1) % PEOPLE.length]![1]}`, text: ["The fiscal note assumes full enrollment in year one, which never happens.", "Worth reading section 4 — it moves the deadline, not the requirement.", "Same language passed the Senate in 2023 and died in Rules."][n]!, day: day(n * 4 + 1), upvotes: between(r, 1, 90) })),
    upvoted: pick(POST_TITLES, 3).map((title, n) => ({ title, tags: pick(ISSUES, 2), day: day(n * 3 + 2), minutes: 4 + n, upvotes: between(r, 10, 600), comments: Math.floor(r() * 30) })),
    stats: {
      xp,
      level: Math.round(Math.sqrt(xp) * 0.82),
      reputation,
      streak: between(r, 20, 1300),
      readingDays,
      views: between(r, 2000, 1_200_000),
      upvotes: between(r, 100, 90000),
      referrals: between(r, 1, 171),
      followers: between(r, 20, 5000),
      following: between(r, 5, 400),
    },
    topTags: shares.map((s) => ({ ...s, name: s.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) })),
    heat,
  }
}

export const USERS: User[] = PEOPLE.map(build)
export const USER_BY_HANDLE = new Map(USERS.map((u) => [u.handle, u]))

export const DESK_MEMBERS = DESK_SIZES

/* ------------------------------------------------------------ the boards */

export type BoardKey = "xp" | "reputation" | "streak" | "views" | "upvotes" | "referrals" | "readingDays"

export const BOARDS: { key: BoardKey; title: string }[] = [
  { key: "xp", title: "Highest level" },
  { key: "reputation", title: "Highest reputation" },
  { key: "streak", title: "Longest streak" },
  { key: "views", title: "Highest post views" },
  { key: "upvotes", title: "Most upvoted" },
  { key: "referrals", title: "Most referrals" },
  { key: "readingDays", title: "Most reading days" },
]

export const board = (key: BoardKey, n = 10) => [...USERS].sort((a, b) => b.stats[key] - a.stats[key]).slice(0, n)

/** Verified by the domain a reader signed up with; hard-coded until sign-up checks one. */
export const EMPLOYERS: { name: string; state: string; chamber: string }[] = [
  { name: "U.S. House of Representatives", state: "US", chamber: "House" },
  { name: "New York State Assembly", state: "NY", chamber: "Assembly" },
  { name: "Texas House of Representatives", state: "TX", chamber: "House" },
  { name: "California State Assembly", state: "CA", chamber: "Assembly" },
  { name: "Florida House of Representatives", state: "FL", chamber: "House" },
  { name: "Pennsylvania House of Representatives", state: "PA", chamber: "House" },
  { name: "Ohio House of Representatives", state: "OH", chamber: "House" },
  { name: "Georgia House of Representatives", state: "GA", chamber: "House" },
  { name: "Massachusetts House of Representatives", state: "MA", chamber: "House" },
  { name: "Washington House of Representatives", state: "WA", chamber: "House" },
]

/** Every reader's takes, the most upvoted first. */
export const topTakes = (n = 10) =>
  USERS.flatMap((u) => u.takes.map((t) => ({ ...t, user: u })))
    .sort((a, b) => b.upvotes - a.upvotes)
    .filter((t, i, all) => all.findIndex((x) => x.title === t.title) === i)
    .slice(0, n)
