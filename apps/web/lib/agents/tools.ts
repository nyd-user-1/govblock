import "server-only"

import type { Tool } from "@aws-sdk/client-bedrock-runtime"

// The agents read the record through /api/policy/[resource] — the same routes
// every surface on the site reads. Not the query layer underneath it: the route
// already carries the jurisdiction scoping (§0.2's rule that no jurisdiction's
// rows are ever served under another's name), the NY-only and Congress-only
// guards, and a half-hour CloudFront cache. An agent asking the same question
// as a page gets the page's cached answer.
//
// Each tool below is one resource with the parameters that resource actually
// takes, and a `shape` that trims the payload before it is billed as input
// tokens: a whole bill record with its texts and history can run past 100 kB,
// and the model needs the rows, not every column of them.

export type ToolName =
  | "list_jurisdictions"
  | "search_bills"
  | "get_bill"
  | "get_bill_text"
  | "list_members"
  | "get_member"
  | "get_member_record"
  | "list_committees"
  | "get_committee"
  | "top_sponsors"
  | "get_lobbying"
  | "get_fec"
  | "post_to_slack"

// Converse types a tool's input schema as DocumentType — JSON, all the way
// down — so `Record<string, unknown>` will not go in. Naming the two shapes a
// JSON-Schema property can actually take here is both what the API wants and a
// check that no tool grows a parameter the model cannot be told the type of.
type SchemaProperty = { type: "string" | "integer" | "boolean"; description: string }
type Schema = { type: "object"; properties: Record<string, SchemaProperty>; required: string[] }

type Definition = {
  description: string
  properties: Record<string, SchemaProperty>
  required?: string[]
  /** resource + query string for /api/policy; absent for connection tools. */
  request?: (input: Record<string, string>) => string
  shape?: (data: unknown, input: Record<string, string>) => unknown
}

const JURISDICTION: SchemaProperty = {
  type: "string",
  description:
    "Two-letter jurisdiction code. 'US' is Congress; the 50 states and DC use their postal codes. Defaults to US.",
}

function trim<T>(rows: T[] | undefined, n: number) {
  return Array.isArray(rows) ? rows.slice(0, n) : []
}

/** A bill number with the spaces and punctuation people add taken back out. */
function plain(value: unknown) {
  return typeof value === "string" ? value.replace(/[^a-z0-9]/gi, "").toUpperCase() : ""
}

function query(resource: string, input: Record<string, string>, keys: string[]) {
  const sp = new URLSearchParams()
  sp.set("state", (input.jurisdiction || "US").toUpperCase())
  for (const key of keys) {
    const value = input[key]
    if (value !== undefined && value !== null && String(value).trim() !== "")
      sp.set(key === "jurisdiction" ? "state" : key, String(value))
  }
  return `${resource}?${sp.toString()}`
}

export const DEFINITIONS: Record<ToolName, Definition> = {
  list_jurisdictions: {
    description:
      "Every jurisdiction the record covers, with how many bills each holds. Call this when unsure a jurisdiction is present.",
    properties: {},
    request: () => "states",
    shape: (data) => data,
  },

  search_bills: {
    description:
      "Search bills, members and committees in one jurisdiction by keyword. Set full_text to search the bills' own text rather than titles alone — slower, but it finds bills whose titles do not carry the word.",
    properties: {
      q: { type: "string", description: "The search term. Two characters minimum." },
      jurisdiction: JURISDICTION,
      full_text: { type: "boolean", description: "Search bill text as well as titles. Default false." },
      limit: { type: "integer", description: "1–20, default 8." },
    },
    required: ["q"],
    request: (input) => {
      const sp = new URLSearchParams({
        state: (input.jurisdiction || "US").toUpperCase(),
        q: input.q ?? "",
        limit: String(Math.min(Number(input.limit) || 8, 20)),
      })
      if (String(input.full_text) === "true") sp.set("text", "1")
      return `search?${sp.toString()}`
    },
    shape: (data) => {
      const d = data as Record<string, unknown[]>
      return {
        bills: trim(d.bills, 20),
        members: trim(d.members, 10),
        committees: trim(d.committees, 10),
        texts: trim(d.texts, 10),
      }
    },
  },

  get_bill: {
    description:
      "The whole record of one bill in a single read: description, status, its sponsors with party and district, its full legislative history, roll calls, committee referrals, progress, same-as bills, documents, subjects and the text versions on file. Identify it by bill_id, or by bill_number within a jurisdiction.",
    properties: {
      bill_id: { type: "integer", description: "The numeric id, as returned by search_bills." },
      bill_number: {
        type: "string",
        description:
          "As the record writes it, with no spaces or punctuation: 'A07380', 'S05226', 'HB10171', 'HR1496'. Requires a jurisdiction. If you are not certain of the number, use search_bills instead.",
      },
      jurisdiction: JURISDICTION,
    },
    request: (input) => query("bill", input, ["id", "number"]),
    shape: (data, input) => {
      if (!data) return null
      const b = data as Record<string, unknown>

      // The policy route answers an unmatched bill_number with the newest bill
      // in the jurisdiction rather than with nothing — ask US for "HR 1" and it
      // hands back HB10171, a food-and-nutrition grant bill, wearing the
      // number you asked for. Caught on the deploy. A wrong record answered
      // confidently is the worst failure this surface has, so a number that
      // came back different from the number asked for is a miss, said out loud.
      const asked = plain(input.number)
      const got = plain(b.bill_number)
      if (asked && got && asked !== got) {
        return {
          error: `No bill numbered ${input.number} in ${(input.jurisdiction || "US").toUpperCase()}. The record answered with ${b.bill_number}, which is a different bill. Use search_bills to find the right one, and tell the reader you could not find the number they gave.`,
        }
      }

      return {
        ...b,
        sponsors: trim(b.sponsors as unknown[], 12),
        history: trim(b.history as unknown[], 25),
        rollCalls: trim(b.rollCalls as unknown[], 10),
        referrals: trim(b.referrals as unknown[], 10),
        progress: trim(b.progress as unknown[], 15),
        documents: trim(b.documents as unknown[], 8),
        subjects: trim(b.subjects as unknown[], 15),
        texts: trim(b.texts as unknown[], 8),
        hearings: trim(b.hearings as unknown[], 5),
      }
    },
  },

  get_bill_text: {
    description:
      "The text of a bill as filed. Long — call it only when the question turns on the wording, and quote rather than summarise from memory.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      jurisdiction: JURISDICTION,
    },
    required: ["bill_id"],
    request: (input) => query("text", input, ["id"]),
    shape: (data) => {
      const t = data as Record<string, unknown> | null
      if (!t) return null
      const text = typeof t.text === "string" ? t.text : ""
      return {
        ...t,
        // 60k characters is about 15k tokens — enough for any single bill this
        // record holds, and a ceiling on a runaway federal omnibus.
        text: text.slice(0, 60_000),
        truncated: text.length > 60_000,
      }
    },
  },

  list_members: {
    description: "The sitting members of a jurisdiction, with party, chamber and district.",
    properties: { jurisdiction: JURISDICTION },
    request: (input) => query("members", input, []),
    shape: (data) => trim(data as unknown[], 60),
  },

  get_member: {
    description: "One member: party, chamber, district, identifiers.",
    properties: {
      people_id: { type: "integer", description: "The numeric member id." },
      jurisdiction: JURISDICTION,
    },
    required: ["people_id"],
    request: (input) => query("member", input, ["id"]),
    shape: (data) => data,
  },

  get_member_record: {
    description:
      "What a member has actually done: the bills they sponsored, how they voted, and — for members of Congress — their FEC totals and largest reported contributions.",
    properties: {
      people_id: { type: "integer", description: "The numeric member id." },
      jurisdiction: JURISDICTION,
      limit: { type: "integer", description: "Rows per list, default 25." },
    },
    required: ["people_id"],
    request: (input) => query("record", { ...input, limit: input.limit ?? "25" }, ["id", "limit"]),
    shape: (data) => {
      const r = data as Record<string, unknown>
      return {
        counts: r.counts,
        fec: r.fec,
        sponsored: trim(r.sponsored as unknown[], 25),
        aye: trim(r.aye as unknown[], 15),
        nay: trim(r.nay as unknown[], 15),
      }
    },
  },

  list_committees: {
    description: "The committees of a jurisdiction.",
    properties: { jurisdiction: JURISDICTION },
    request: (input) => query("committees", input, []),
    shape: (data) => trim(data as unknown[], 80),
  },

  get_committee: {
    description: "One committee and the bills before it.",
    properties: {
      name: { type: "string", description: "The committee's name, as list_committees gives it." },
      jurisdiction: JURISDICTION,
    },
    required: ["name"],
    request: (input) => query("committee", input, ["name"]),
    shape: (data) => data,
  },

  top_sponsors: {
    description: "Who sponsors the most bills in a jurisdiction this session.",
    properties: {
      jurisdiction: JURISDICTION,
      limit: { type: "integer", description: "Default 8." },
    },
    request: (input) => query("sponsors", input, ["limit"]),
    shape: (data) => trim(data as unknown[], 20),
  },

  get_lobbying: {
    description:
      "Federal lobbying filings that name a bill — who filed, for which client, and the issue they registered. Congress only.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      jurisdiction: JURISDICTION,
    },
    required: ["bill_id"],
    request: (input) => query("lobbying", input, ["id"]),
    shape: (data) => {
      // getLobbying answers { clients, registrants, count, filings: [...] } —
      // `filings` is the list, `count` is how many there were before the ten.
      const d = data as { filings?: unknown[]; count?: number; clients?: number; registrants?: number } | null
      if (!d) return null
      return { count: d.count, clients: d.clients, registrants: d.registrants, filings: trim(d.filings, 10) }
    },
  },

  get_fec: {
    description:
      "A member of Congress's FEC totals by cycle and their largest reported contributions. Congress only.",
    properties: {
      people_id: { type: "integer", description: "The numeric member id." },
      jurisdiction: JURISDICTION,
    },
    required: ["people_id"],
    request: (input) => query("fec", input, ["id"]),
    shape: (data) => {
      const d = data as { totals?: unknown[]; contributions?: unknown[] } | null
      if (!d) return null
      return { totals: trim(d.totals, 8), contributions: trim(d.contributions, 12) }
    },
  },

  post_to_slack: {
    // No channel parameter, deliberately. This route is public, so the model —
    // and anyone who can reach the site and phrase a request — decides the
    // text; letting it also decide the destination would turn one agent into a
    // way to write into any channel the bot can see. The channel is the one in
    // the secret, and that is the whole grant.
    description:
      "Post a message to the govblock Slack channel. Use it once, at the end of a tracking run, with the finished digest — not for progress notes.",
    properties: {
      text: { type: "string", description: "The message. Slack mrkdwn: *bold*, <url|label>." },
    },
    required: ["text"],
  },
}

/** `id` and `number` are what /api/policy calls bill_id and bill_number. */
export function normalise(name: ToolName, input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null) continue
    const mapped =
      key === "bill_id" || key === "people_id" ? "id" : key === "bill_number" ? "number" : key
    out[mapped] = String(value)
  }
  if (name === "get_bill" && !out.id && !out.number) delete out.id
  return out
}

export function toolSpec(name: ToolName): Tool {
  const definition = DEFINITIONS[name]
  const json: Schema = {
    type: "object",
    properties: definition.properties,
    required: definition.required ?? [],
  }
  return {
    toolSpec: { name, description: definition.description, inputSchema: { json } },
  }
}
