// The watches a reader can start from, and the shapes a watch is made of.
// Shared by the builder (client) and the API (server). The engine that runs
// them is livingston/scripts/watches; the trigger and step shapes here are
// its contract, spelled out in scripts/watches/lib.mjs.

export type Trigger =
  | { kind: "bill.action"; state: string; bill_id: number; when?: "any" | "passed" | "signed" | "committee" | "vetoed" }
  | { kind: "bill.introduced"; state: string; keyword?: string; sponsor_id?: number; committee?: string }
  | { kind: "member.sponsored"; state: string; people_id: number }
  | { kind: "text.landed"; state: string; bill_id: number }
  | { kind: "rollcall.recorded"; state: string; bill_id?: number }
  | { kind: "hearing.scheduled"; state: string; committee?: string; bill_id?: number }
  | { kind: "sweep"; state: string }
  | { kind: "date"; at: string; bill_id?: number; state?: string }
  | { kind: "schedule"; every: "week" | "day"; dow?: number; hour: number; state?: string; keyword?: string; committee?: string; days?: number }

export type Step =
  | { kind: "enrich"; what: ("bill" | "text" | "sponsors" | "votes" | "history" | "peers" | "moved")[] }
  | { kind: "agent"; task: "summarize" | "diff" | "memo" | "letter" | "digest" | "vote-report" | "hearing-brief"; model?: "haiku" | "sonnet"; instructions?: string }
  | { kind: "approve"; timeout?: string }
  | { kind: "wait"; for?: string; until?: string; before?: string }
  | { kind: "deliver"; via: Via; to?: string; subject?: string }

export type Via = "inbox" | "email" | "slack" | "discord" | "webhook"

export const VIAS: { value: Via; label: string; needs?: string; hint: string }[] = [
  { value: "inbox", label: "Inbox", hint: "Here, under Watches. Nothing leaves the site." },
  { value: "email", label: "Email", needs: "address", hint: "To the address on your account, or one you name." },
  { value: "slack", label: "Slack", needs: "webhook", hint: "An incoming-webhook URL from your Slack workspace." },
  { value: "discord", label: "Discord", needs: "webhook", hint: "A channel webhook URL from Discord." },
  { value: "webhook", label: "Webhook", needs: "url", hint: "A JSON POST to a URL you run." },
]

/** A field the set-up form asks for. */
export type Field = { key: string; label: string; kind: "bill" | "jurisdiction" | "text" | "committee" | "member" | "date" | "when" | "number"; hint?: string; required?: boolean; placeholder?: string }

export type Template = {
  id: string
  name: string
  description: string
  featured?: boolean
  icon: "bill" | "committee" | "text" | "vote" | "digest" | "letter" | "clock" | "blank" | "list"
  fields: Field[]
  /** The reader's answers become a trigger and steps. `via` and `to` come from the delivery block every template shares. */
  build: (a: Answers, via: Via, to?: string, approve?: boolean) => { trigger: Trigger; steps: Step[] }
  /** Whether the form offers "ask me before it goes out". */
  approvable?: boolean
}

export type Answers = Record<string, string | number | undefined> & { bill_id?: number; bill_label?: string; state?: string }

const enrich = (...what: Extract<Step, { kind: "enrich" }>["what"]): Step => ({ kind: "enrich", what })
const agent = (task: Extract<Step, { kind: "agent" }>["task"], instructions?: string): Step => ({ kind: "agent", task, ...(instructions ? { instructions } : {}) })
const deliver = (via: Via, to?: string): Step => ({ kind: "deliver", via, ...(to ? { to } : {}) })
const approval = (yes?: boolean): Step[] => (yes ? [{ kind: "approve", timeout: "72h" }] : [])
const st = (a: Answers) => String(a.state ?? "NY").toUpperCase()

export const TEMPLATES: Template[] = [
  {
    id: "track-bill",
    name: "Track a bill",
    description: "Every action on one bill, summarized and sent to you the morning after.",
    featured: true,
    icon: "bill",
    fields: [
      { key: "bill", label: "Bill", kind: "bill", required: true, hint: "Search by number or title." },
      { key: "when", label: "Which actions", kind: "when", hint: "Every action, or only when it passes, is signed, moves in committee, or is vetoed." },
    ],
    approvable: true,
    build: (a, via, to, ok) => ({
      trigger: { kind: "bill.action", state: st(a), bill_id: Number(a.bill_id), when: (a.when as never) || "any" },
      steps: [enrich("bill", "sponsors", "votes", "history"), agent("summarize"), ...approval(ok), deliver(via, to)],
    }),
  },
  {
    id: "memo-when-passed",
    name: "Memo when it passes",
    description: "When a bill passes a chamber, a one-page memo, held for your approval, then sent.",
    featured: true,
    icon: "letter",
    fields: [
      { key: "bill", label: "Bill", kind: "bill", required: true },
      { key: "instructions", label: "Anything the memo should keep in mind", kind: "text", placeholder: "Our client is the hospital association." },
    ],
    approvable: true,
    build: (a, via, to) => ({
      trigger: { kind: "bill.action", state: st(a), bill_id: Number(a.bill_id), when: "passed" },
      steps: [enrich("bill", "sponsors", "votes", "history", "text"), agent("memo", a.instructions ? String(a.instructions) : undefined), { kind: "approve", timeout: "72h" }, deliver(via, to)],
    }),
  },
  {
    id: "committee-watch",
    name: "Committee watch",
    description: "A hearing is scheduled; the day before, a brief on every bill on the agenda.",
    featured: true,
    icon: "committee",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true },
      { key: "committee", label: "Committee", kind: "committee", required: true, hint: "Part of the name is enough: Finance, Judiciary, Ways and Means." },
    ],
    build: (a, via, to) => ({
      trigger: { kind: "hearing.scheduled", state: st(a), committee: String(a.committee ?? "") },
      steps: [{ kind: "wait", before: "1d" }, enrich("bill", "sponsors"), agent("hearing-brief"), deliver(via, to)],
    }),
  },
  {
    id: "text-change",
    name: "Text change alert",
    description: "A new version of the text lands; what changed, section by section, in plain English.",
    featured: true,
    icon: "text",
    fields: [{ key: "bill", label: "Bill", kind: "bill", required: true }],
    build: (a, via, to) => ({
      trigger: { kind: "text.landed", state: st(a), bill_id: Number(a.bill_id) },
      steps: [enrich("bill", "text"), agent("diff"), deliver(via, to)],
    }),
  },
  {
    id: "vote-report",
    name: "Vote report",
    description: "A roll call is recorded; the result, the margin and the tally by party, delivered.",
    icon: "vote",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true },
      { key: "bill", label: "Bill", kind: "bill", hint: "Leave empty for every roll call in the jurisdiction." },
    ],
    build: (a, via, to) => ({
      trigger: { kind: "rollcall.recorded", state: st(a), ...(a.bill_id ? { bill_id: Number(a.bill_id) } : {}) },
      steps: [enrich("bill", "votes", "sponsors"), agent("vote-report"), deliver(via, to)],
    }),
  },
  {
    id: "weekly-digest",
    name: "Weekly digest",
    description: "Every Monday, what moved under your terms, written up, held for your approval, then sent.",
    featured: true,
    icon: "digest",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true },
      { key: "keyword", label: "Keyword", kind: "text", placeholder: "housing, cannabis, pay transparency", hint: "In the title or description. Leave empty for everything that moved." },
      { key: "committee", label: "Committee", kind: "committee", hint: "Optional." },
    ],
    approvable: true,
    build: (a, via, to, ok = true) => ({
      trigger: { kind: "schedule", every: "week", dow: 1, hour: 13, state: st(a), keyword: a.keyword ? String(a.keyword) : undefined, committee: a.committee ? String(a.committee) : undefined, days: 7 },
      steps: [enrich("moved"), agent("digest"), ...approval(ok), deliver(via, to)],
    }),
  },
  {
    id: "constituent-letter",
    name: "Constituent letter",
    description: "A bill reaches the floor; a letter to your legislator with the bill's facts, for you to edit and send.",
    icon: "letter",
    fields: [
      { key: "bill", label: "Bill", kind: "bill", required: true },
      { key: "instructions", label: "Your position, in a line", kind: "text", placeholder: "Oppose: it raises costs on small landlords." },
    ],
    build: (a, via, to) => ({
      trigger: { kind: "bill.action", state: st(a), bill_id: Number(a.bill_id), when: "passed" },
      steps: [enrich("bill", "sponsors", "history"), agent("letter", a.instructions ? String(a.instructions) : undefined), { kind: "approve", timeout: "7d" }, deliver(via, to)],
    }),
  },
  {
    id: "sunset-watch",
    name: "Sunset watch",
    description: "Ninety days before a date you name, a reminder with where the bill stands.",
    icon: "clock",
    fields: [
      { key: "bill", label: "Bill", kind: "bill", required: true },
      { key: "date", label: "The date", kind: "date", required: true, hint: "When the law expires, the deadline falls, or the session ends." },
      { key: "days", label: "Days before", kind: "number", placeholder: "90" },
    ],
    build: (a, via, to) => {
      const days = Number(a.days) || 90
      const at = new Date(new Date(`${a.date}T13:00:00Z`).getTime() - days * 864e5).toISOString()
      return { trigger: { kind: "date", at, bill_id: Number(a.bill_id), state: st(a) }, steps: [enrich("bill", "history"), deliver(via, to)] }
    },
  },
  {
    id: "new-bills",
    name: "New bills on a subject",
    description: "A bill with your keyword is introduced, in one jurisdiction or all of them.",
    icon: "list",
    fields: [
      { key: "state", label: "Jurisdiction", kind: "jurisdiction", required: true, hint: "Or all 52." },
      { key: "keyword", label: "Keyword", kind: "text", required: true, placeholder: "data center, rent, firearm" },
    ],
    build: (a, via, to) => ({
      trigger: { kind: "bill.introduced", state: st(a), keyword: String(a.keyword ?? "") },
      steps: [enrich("bill", "sponsors"), deliver(via, to)],
    }),
  },
]

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id)

/** One line that says what a watch is waiting for, for the list and the header. */
export function describeTrigger(t: Trigger, billLabel?: string) {
  const bill = billLabel ?? ("bill_id" in t && t.bill_id ? `bill ${t.bill_id}` : "")
  switch (t.kind) {
    case "bill.action":
      return `${bill} · ${t.when && t.when !== "any" ? `when ${t.when}` : "every action"}`
    case "bill.introduced":
      return `${t.state === "all" ? "every jurisdiction" : t.state} · introduced${t.keyword ? ` · “${t.keyword}”` : ""}${t.committee ? ` · ${t.committee}` : ""}`
    case "member.sponsored":
      return `${t.state} · member ${t.people_id} sponsors`
    case "text.landed":
      return `${bill} · new text`
    case "rollcall.recorded":
      return `${bill || t.state} · roll call`
    case "hearing.scheduled":
      return `${t.state} · ${t.committee ?? "any committee"} · hearing`
    case "sweep":
      return `${t.state} · after the sweep`
    case "date":
      return `${bill ? `${bill} · ` : ""}${new Date(t.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    case "schedule":
      return `${t.every === "day" ? "daily" : "weekly, Monday"}${t.state ? ` · ${t.state}` : ""}${t.keyword ? ` · “${t.keyword}”` : ""}`
  }
}

export function describeSteps(steps: Step[]) {
  return steps
    .map((s) =>
      s.kind === "enrich"
        ? null
        : s.kind === "agent"
          ? { summarize: "summary", diff: "what changed", memo: "memo", letter: "letter", digest: "digest", "vote-report": "vote report", "hearing-brief": "brief" }[s.task]
          : s.kind === "approve"
            ? "your approval"
            : s.kind === "wait"
              ? s.before
                ? `${s.before} before`
                : s.for
                  ? `wait ${s.for}`
                  : "wait"
              : `→ ${s.via}`
    )
    .filter(Boolean)
    .join(" · ")
}
