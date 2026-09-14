import { DEFAULT_STATE, stateName } from "@/lib/filters"

// Who may open what (Brendan, 2026-09-13), in one place the server and the
// browser both read:
//
//   Signed out   Congress, the current session, and four entities — the
//                calendar, bills, members, committees. Nothing else.
//   Registered   Congress and the home state chosen at onboarding, the
//                current session, the same four entities.
//   A plan       Everything else: every other jurisdiction, every earlier
//                session, every other entity. Nobody has one yet.
//
// A reader who is signed out is sent to sign in first for anything beyond
// the free scope; a reader who is signed in is sent to the plan. The
// account's own tools — watches, the inbox, documents — want a sign-in and
// nothing more.

export type Reader = {
  signedIn: boolean
  /** The home state from the profile, or null until onboarding sets one. */
  home: string | null
  /** none: the free scope. team (2026-09-13): every entity and session, but only Congress and the home state. paid: everything. */
  license: "none" | "team" | "paid"
}

export const ANONYMOUS: Reader = { signedIn: false, home: null, license: "none" }

export type Entity =
  | "calendar"
  | "bills"
  | "members"
  | "committees"
  | "briefing"
  | "search"
  | "meta"
  | "votes"
  | "amendments"
  | "nominations"
  | "hearings"
  | "record"
  | "laws"
  | "lobbying"
  | "money"
  | "reports"
  | "forms"
  | "departments"
  | "datasets"
  | "news"
  | "dashboards"
  | "account"

/** The four the free scope opens; the brief and the news (Brendan, 2026-09-13: Congress's are always public, and a home state's with them); and the two that only describe the record — the sessions list, the search box. */
const FREE = new Set<Entity>(["calendar", "bills", "members", "committees", "briefing", "news", "search", "meta"])

export const ENTITY_LABELS: Record<Entity, string> = {
  calendar: "the calendar",
  bills: "bills",
  members: "members",
  committees: "committees",
  briefing: "the brief",
  search: "search",
  meta: "the record",
  votes: "roll-call votes",
  amendments: "amendments",
  nominations: "nominations",
  hearings: "hearings",
  record: "the Congressional Record",
  laws: "laws",
  lobbying: "lobbying",
  money: "money",
  reports: "reports",
  forms: "forms",
  departments: "departments",
  datasets: "datasets",
  news: "news",
  dashboards: "dashboards",
  account: "your account",
}

export type Verdict = "open" | "sign-in" | "plan"

export type Ask = {
  /** The jurisdiction asked for; Congress when absent. */
  state?: string | null
  /** The session asked for; the current one when absent. */
  session?: number | null
  /** The jurisdiction's current session, when the caller knows it; without it a session is taken on trust. */
  current?: number | null
  entity?: Entity
}

/** Whether this reader may open what was asked, and if not, which door comes first. */
export function entitled(reader: Reader, ask: Ask): Verdict {
  if (reader.license === "paid") return "open"
  const door: Verdict = reader.signedIn ? "plan" : "sign-in"
  const entity = ask.entity ?? "bills"
  if (entity === "account") return reader.signedIn ? "open" : "sign-in"
  const state = (ask.state || DEFAULT_STATE).toUpperCase()
  // The record's own shape — which sessions a jurisdiction has, which states
  // exist — is open for any jurisdiction: the locks are drawn from it. So is
  // search (Brendan, 2026-09-13): every result from every state shows, and
  // the gate is on the record a result opens.
  if (entity === "meta" || entity === "search") return "open"
  if (state !== DEFAULT_STATE && !(reader.signedIn && state === reader.home)) return door
  // A Team plan (2026-09-13): the whole record, every session, for Congress and the home state.
  if (reader.license === "team") return "open"
  if (ask.session != null && ask.current != null && Number(ask.session) !== Number(ask.current)) return door
  if (!FREE.has(entity)) return door
  return "open"
}

/** What a jurisdiction is called on a card: Congress, or the state's name. */
export const jurisdictionName = (state: string) => (state.toUpperCase() === DEFAULT_STATE ? "Congress" : stateName(state))

/** What closed the door: the jurisdiction, the session, the entity, or the account itself. */
export type Reason = { title: string; body: string; kind: "state" | "session" | "entity" | "account" | "open" }

/** The legislature a state's card names: "the Alaska state legislature", "the D.C. Council". */
const legislatureOf = (state: string) => (state === "DC" ? "the D.C. Council" : `the ${stateName(state)} state legislature`)

/** The sentence a gate shows and a 403 carries, for the first thing that closed the door. */
export function reasonFor(reader: Reader, ask: Ask): Reason {
  const state = (ask.state || DEFAULT_STATE).toUpperCase()
  const entity = ask.entity ?? "bills"
  const home = reader.home ? stateName(reader.home) : null
  const opens = home ? `Congress and ${home}` : "Congress"
  if (entity === "account") return { kind: "account", title: `Sign in to open ${ENTITY_LABELS.account}.`, body: "What you watch, keep and send is yours, and it needs an account." }
  if (state !== DEFAULT_STATE && !(reader.signedIn && state === reader.home)) {
    const name = stateName(state)
    // Signed out, the card is an invitation (Brendan, 2026-09-13): the state's flag, and a question.
    // Signed in, the card sells the plan (Brendan, 2026-09-13): "Kansas, too?"
    return reader.signedIn ? { kind: "state", title: `${name}, too?`, body: `Your account covers ${opens}. Register a Pro account to search every bill, committee, member and vote in all 50 states for the last 20 years.` } : { kind: "state", title: `Is ${name} your home state?`, body: `Register ${name} as your home state to gain instant access to every bill, committee, member, and vote in ${legislatureOf(state)}.` }
  }
  if (ask.session != null && ask.current != null && Number(ask.session) !== Number(ask.current)) {
    return reader.signedIn ? { kind: "session", title: `${ask.session} is an earlier session.`, body: `The current session of ${opens} is open. Earlier sessions are on a plan.` } : { kind: "session", title: `${ask.session} is an earlier session.`, body: "The current session is open to everyone. Sign in first; earlier sessions are on a plan." }
  }
  if (!FREE.has(entity)) {
    const label = ENTITY_LABELS[entity]
    return reader.signedIn ? { kind: "entity", title: `${label[0].toUpperCase()}${label.slice(1)} is on a plan.`, body: `Your account opens the bills, members, committees and calendar of ${opens}. The rest is on a plan.` } : { kind: "entity", title: `Sign in to open ${label}.`, body: "The bills, members, committees and calendar of Congress are open to everyone. Sign in for the rest." }
  }
  return { kind: "open", title: "Open.", body: "" }
}

/** Where a closed door leads. */
export const doorHref = (verdict: Verdict) => (verdict === "plan" ? "/pricing" : "/auth")

// ---------------------------------------------------------------------------
// What the policy API's resources are, in the terms above. Anything not named
// is a bill-shaped read: open within the scope, never beyond it.

const RESOURCE_ENTITIES: [RegExp, Entity][] = [
  [/^(sessions|states|state-stats|options|subjects|subject-terms|provenance|titles)$/, "meta"],
  [/^search$/, "search"],
  [/^(calendar|hearings|hearing-days|hearings-held|hearings-recent|latest-hearing)$/, "calendar"],
  [/^(hearings-congress|hearing-index|transcript|committee-meetings)$/, "hearings"],
  [/^(rollcall|rollcalls|votes|house-votes|tallies|vote-record|member-votes)$/, "votes"],
  [/^amendments$/, "amendments"],
  [/^(nominations|department-nominations|committee-nominations|treaties)$/, "nominations"],
  [/^(record|record-issues|communications|committee-communications)$/, "record"],
  [/^laws$/, "laws"],
  [/^lobbying(-.*)?$/, "lobbying"],
  [/^fec$/, "money"],
  [/^(committee-reports|crs-reports)$/, "reports"],
  [/^(departments|department-bills|department-forms)$/, "departments"],
  [/^(newsroom|stories|story)$/, "news"],
  [/^(members|member|member-detail|member-directory|roster|seats|rail)$/, "members"],
  [/^(committees|committee|committee-bills|committee-detail)$/, "committees"],
]

export function entityOfResource(resource: string): Entity {
  for (const [pattern, entity] of RESOURCE_ENTITIES) if (pattern.test(resource)) return entity
  return "bills"
}

// ---------------------------------------------------------------------------
// What a page is, from its path: the entity, and the jurisdiction and session
// when the path names them. Pages that carry neither read the header's scope.

export type PathAsk = { entity: Entity; state?: string; session?: number; exempt?: boolean }

const two = (s: string | undefined) => (s && /^[a-z]{2}$/i.test(s) ? s.toUpperCase() : undefined)

export function askOfPath(pathname: string): PathAsk {
  const p = pathname.replace(/\/+$/, "") || "/"
  const seg = p.split("/").filter(Boolean)
  const head = seg[0] ?? ""
  // Pages about the site, and the doors themselves.
  if (["auth", "welcome", "plan", "pricing", "docs", "routes", "changelog", "tags", "unite", "unite-2", "preview", "create", "diff", "typeset", "consensus"].includes(head)) return { entity: "meta", exempt: true }
  switch (head) {
    case "amendments":
      return { entity: "amendments" }
    case "nominations":
      return { entity: "nominations" }
    case "hearings":
    case "meetings":
      return { entity: "hearings" }
    case "record":
      return { entity: "record" }
    case "laws":
      return { entity: "laws", state: two(seg[1]) }
    case "lobbying":
      return { entity: "lobbying" }
    case "money":
      return { entity: "money" }
    case "reports":
      return { entity: "reports" }
    case "forms":
      return { entity: "forms" }
    case "departments":
      return { entity: "departments" }
    case "roll-call-votes":
      return { entity: "votes" }
    case "news":
      return { entity: "news", state: two(seg[1]) }
    case "briefing":
      return { entity: "briefing", state: two(seg[1]) }
    // The hub and its charts are summaries of the record, open like the sessions list (2026-09-13).
    case "state":
    case "charts":
      return { entity: "meta" }
    case "desk":
      return { entity: "bills", state: two(seg[1]) }
    case "legislative-subjects":
    case "policy-areas":
      return { entity: "bills", state: two(seg[1]) }
    case "bills":
      return { entity: "bills", state: two(seg[1]) }
    case "members":
      return { entity: "members" }
    case "committees":
      return { entity: "committees" }
    case "calendar":
      return { entity: "calendar" }
    case "map":
      return { entity: "members" }
    case "watches":
    case "clips":
    case "connectors":
    case "agent":
    case "agents":
      return { entity: "account" }
    case "workspace": {
      const surface = seg[1] ?? ""
      if (surface === "data") {
        const state = two(seg[2])
        if (!state) return { entity: "meta" }
        const year = seg[4] && /^\d{4}$/.test(seg[4]) ? Number(seg[4]) : undefined
        const node = year ? seg[5] : seg[4]
        if (node === "votes" || node === "roll-call") return { entity: "votes", state, session: year }
        if (node === "forks") return { entity: "account", state, session: year }
        if (node === "committees" || node === "committee") return { entity: "committees", state, session: year }
        if (node === "members" || node === "member") return { entity: "members", state, session: year }
        return { entity: "bills", state, session: year }
      }
      if (surface === "dashboard") return { entity: "dashboards" }
      if (surface === "forms") return { entity: "forms" }
      if (surface === "inbox" || surface === "documents") return { entity: "account" }
      if (surface === "calendar") return { entity: "calendar" }
      // The root, the typeset editor (its bill marks its own scope), blocks: the header's scope.
      return { entity: "bills" }
    }
    default:
      return { entity: "bills" }
  }
}
