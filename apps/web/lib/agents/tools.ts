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
  | "web_search"
  | "read_page"
  | "post_to_slack"
  | "post_to_discord"
  | "deliver_report"

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

/** The last n, for the lists the record keeps oldest-first. */
function tail<T>(rows: T[] | undefined, n: number) {
  return Array.isArray(rows) ? rows.slice(Math.max(0, rows.length - n)) : []
}

function size(rows: unknown) {
  return Array.isArray(rows) ? rows.length : 0
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
          "For Congress, the citation as congress.gov writes it: 'H.R. 155' is a House bill, 'H.Res. 155' a House resolution, and 'S. 155', 'S.Res. 155', 'H.J.Res. 12', 'S.Con.Res. 4' likewise — the punctuation is what tells them apart, so keep it. For a state, the number as that legislature writes it: 'A07380', 'S05226'. Requires a jurisdiction. If you are not certain of the number, use search_bills instead.",
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
      // Congress answers under two spellings — the mirror's HB155 and
      // congress.gov's H.R. 155 — and either is the number that was asked for.
      const asked = plain(input.number)
      const got = plain(b.bill_number)
      if (asked && got && asked !== got && asked !== plain(b.citation)) {
        return {
          error: `No bill numbered ${input.number} in ${(input.jurisdiction || "US").toUpperCase()}. The record answered with ${b.bill_number}, which is a different bill. Use search_bills to find the right one, and tell the reader you could not find the number they gave.`,
        }
      }

      // A round is capped at eight thousand characters of tool result, and H.R.
      // 1's record is forty-five kilobytes — so what is cut matters. The
      // history and the roll calls are kept oldest-first by the record, and the
      // old code took the head of them: the model was handed January's actions
      // on a bill that moved in September, and never saw where it had got to.
      // Both are read from the end now, with their true lengths beside them and
      // the tool that holds the rest named.
      return {
        ...b,
        counts: {
          history: size(b.history),
          rollCalls: size(b.rollCalls),
          sponsors: size(b.sponsors),
          sameAs: size(b.sameAs),
        },
        more: size(b.history) > 15 ? "Only the most recent actions are here; bill_status has the whole history." : null,
        sponsors: trim(b.sponsors as unknown[], 10),
        history: tail(b.history as unknown[], 15),
        rollCalls: tail(b.rollCalls as unknown[], 6),
        referrals: trim(b.referrals as unknown[], 8),
        progress: trim(b.progress as unknown[], 12),
        sameAs: trim(b.sameAs as unknown[], 4),
        documents: trim(b.documents as unknown[], 4),
        subjects: trim(b.subjects as unknown[], 15),
        texts: trim(b.texts as unknown[], 6),
        hearings: trim(b.hearings as unknown[], 5),
      }
    },
  },

  get_bill_text: {
    description:
      "An excerpt of a bill's text as filed. Call it when the question turns on the wording, and quote rather than summarise from memory. It answers with a window, not the document: `full_chars` says how long the whole text is, and from_char reads the next window. The record holds bills of six million characters, so read the part you need.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      jurisdiction: JURISDICTION,
      from_char: {
        type: "integer",
        description: "Where to start, in characters. Default 0. Pass the previous call's from_char plus the excerpt's length to read on.",
      },
    },
    required: ["bill_id"],
    // The window is what survives the round anyway: a tool result is capped at
    // eight thousand characters before it reaches the model, so asking the
    // database for sixty thousand spent the time and the 1 MB result budget on
    // text that was then thrown away — and failed outright on the long bills,
    // which are the ones worth reading (503, "the result exceeds the size
    // limit"). Six thousand fits the cap with the envelope around it.
    request: (input) => query("text", { ...input, chars: "6000" }, ["id", "chars", "from"]),
    shape: (data) => {
      const t = data as Record<string, unknown> | null
      if (!t) return null
      const text = typeof t.text === "string" ? t.text : ""
      const full = Number(t.full_chars) || text.length
      const from = Number(t.from) || 0
      return {
        document_id: t.document_id,
        version: t.version,
        full_chars: full,
        from_char: from,
        excerpt_chars: text.length,
        more: from + text.length < full ? `${(full - from - text.length).toLocaleString()} characters remain; call again with from_char ${from + text.length}.` : null,
        text,
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

  web_search: {
    description:
      "Search the web, for the things this record does not hold: money in state ballot-measure campaigns, a legislature's own press release, reporting on a bill, an official page. Returns titles, links and short snippets — enough to cite and link, not the page itself. The record still outranks it: where a row and a search result disagree, the row is right. Six results by default; keep the query specific.",
    properties: {
      q: { type: "string", description: "The search query, as you would type it into a search engine." },
      limit: { type: "integer", description: "1–10, default 6." },
    },
    required: ["q"],
    // The one tool whose path is not a /api/policy resource — see the note on
    // the leading slash in run-tools.
    request: (input) => {
      const sp = new URLSearchParams({ q: input.q ?? "", limit: String(Math.min(Number(input.limit) || 6, 10)) })
      return `/api/agents/search?${sp.toString()}`
    },
    shape: (data) => {
      const d = data as { provider?: string; results?: unknown[] } | null
      if (!d) return null
      return { provider: d.provider, results: trim(d.results, 10) }
    },
  },

  read_page: {
    description:
      "Read one web page the search results pointed you at, as text. Use it when a snippet is not enough — a disclosure filing, a committee's own page, a table of figures. It gets through pages that refuse an ordinary fetch, which is most of the campaign-finance sources. Returns an excerpt with the page's full length; ask for a page you have a URL for, never a guessed one.",
    properties: {
      url: { type: "string", description: "The full http(s) URL, as a search result gave it." },
    },
    required: ["url"],
    request: (input) => `/api/agents/search?${new URLSearchParams({ url: input.url ?? "", chars: "6000" }).toString()}`,
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      const full = Number(d.full_chars) || 0
      const chars = Number(d.chars) || 0
      return {
        url: d.url,
        chars,
        full_chars: full,
        more: full > chars ? `${(full - chars).toLocaleString()} characters of this page were not read.` : null,
        text: d.text,
      }
    },
  },

  // Neither posting tool takes a destination, deliberately. This route is
  // public, so the model — and anyone who can reach the site and phrase a
  // request — decides the text; letting it also decide where the text lands
  // would turn one agent into a way to write anywhere the credential reaches.
  // Slack's channel is the secret's; Discord's is baked into the webhook URL
  // and could not be a parameter even if we wanted it to be.
  post_to_slack: {
    description:
      "Post a message to the govblock Slack channel. Use it once, at the end of a tracking run, with the finished digest — not for progress notes.",
    properties: {
      text: { type: "string", description: "The message. Slack mrkdwn: *bold*, <url|label>." },
    },
    required: ["text"],
  },

  deliver_report: {
    // No text parameter, deliberately, and not only for the reason the two
    // posting tools have none. A report is thousands of tokens the agent has
    // already written; making it retype them into an argument doubles the cost
    // of the longest thing it does and — on a host that discards a response
    // after thirty seconds — is how a finished report gets lost on its last
    // step. This tool sends what the run has already said.
    description:
      "Deliver the report you have written so far to wherever this agent is connected. Call it once, when the report is finished. You do not pass the report — it is what you have already written in this run. Give it a title.",
    properties: {
      title: {
        type: "string",
        description: "One line naming the report, as a subject line would.",
      },
    },
    required: ["title"],
  },

  post_to_discord: {
    description:
      "Post a message to the govblock PolicyBot channel on Discord. Use it once, at the end of a tracking run, with the finished digest — not for progress notes.",
    properties: {
      text: {
        type: "string",
        description:
          "The message. Discord markdown: **bold**, *italic*, [label](url). Long digests are sent as an embed automatically; do not split it yourself.",
      },
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
      key === "bill_id" || key === "people_id"
        ? "id"
        : key === "bill_number"
          ? "number"
          : key === "from_char"
            ? "from"
            : key
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
