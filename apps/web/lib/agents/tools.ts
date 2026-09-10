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
  | "calendar"
  | "committee_agenda"
  | "hearings"
  | "desk_stories"
  | "transcripts"
  | "nominations"
  | "roster"
  | "votes"
  | "roll_call"
  | "sponsors"
  | "cosponsors"
  | "bill_status"
  | "bill_amendments"
  | "bill_diff"
  | "web_search"
  | "read_page"
  | "post_to_slack"
  | "post_to_discord"
  | "deliver_report"
  | "form_schema"
  | "ask"
  | "review"
  | "fill_form"
  | "remember"

// Converse types a tool's input schema as DocumentType — JSON, all the way
// down — so `Record<string, unknown>` will not go in. Naming the two shapes a
// JSON-Schema property can actually take here is both what the API wants and a
// check that no tool grows a parameter the model cannot be told the type of.
// The Filer's `ask` hands the browser a list of fields, so an array of objects
// is the one nested shape allowed; it is spelled out rather than opened up.
type SchemaProperty =
  | {
      type: "string" | "integer" | "boolean"
      description: string
      enum?: string[]
    }
  | {
      type: "array"
      description: string
      items:
        | { type: "string" }
        | {
            type: "object"
            properties: Record<string, SchemaProperty>
            required?: string[]
          }
    }
  | {
      type: "object"
      description: string
      properties?: Record<string, SchemaProperty>
      required?: string[]
      additionalProperties?: { type: "string" }
    }
type Schema = {
  type: "object"
  properties: Record<string, SchemaProperty>
  required: string[]
}

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

/** YYYY-MM-DD, `offset` days from today — for the tools that take a window. */
function day(offset = 0) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/**
 * The columns a model needs of a row, and not the ones it does not.
 *
 * Trimming by row alone was not enough: a committee's calendar came back at
 * 15 kB of thirty rows against a round budget of eight, because every row
 * carried a photograph's URL or a bill's whole title. Picking columns is what
 * makes a list of forty affordable.
 */
function slim<K extends string>(
  rows: unknown,
  keys: K[],
  n: number,
  clip: Partial<Record<K, number>> = {}
) {
  return trim(rows as Record<string, unknown>[], n).map((row) => {
    const out: Record<string, unknown> = {}
    for (const key of keys) {
      const value = row?.[key]
      if (value === undefined || value === null || value === "") continue
      const max = clip[key]
      out[key] = max && typeof value === "string" ? value.slice(0, max) : value
    }
    return out
  })
}

function size(rows: unknown) {
  return Array.isArray(rows) ? rows.length : 0
}

/** A bill number with the spaces and punctuation people add taken back out. */
function plain(value: unknown) {
  return typeof value === "string"
    ? value.replace(/[^a-z0-9]/gi, "").toUpperCase()
    : ""
}

function query(
  resource: string,
  input: Record<string, string>,
  keys: string[]
) {
  const sp = new URLSearchParams()
  sp.set("state", (input.jurisdiction || "US").toUpperCase())
  for (const key of keys) {
    const value = input[key]
    if (value !== undefined && value !== null && String(value).trim() !== "")
      sp.set(key === "jurisdiction" ? "state" : key, String(value))
  }
  return `${resource}?${sp.toString()}`
}

/** A roll call as a list of them reads: the tally and what it was on. */
const ROLL_CALL_ROW = [
  "roll_call_id",
  "date",
  "chamber",
  "description",
  "yea",
  "nay",
  "nv",
  "absent",
  "total",
  "bill_number",
  "title",
]

/**
 * A vote's two sides, the way a person reads one.
 *
 * The whole list is 434 names and 26 kB against a round budget of eight, and
 * nobody asks for it. What is asked is who broke ranks — so the smaller side is
 * named in full, along with everyone who did not vote, and the larger side is a
 * count. That is the same answer in a twentieth of the room.
 */
function sides(
  rows: Record<string, unknown>[],
  cast: (row: Record<string, unknown>) => string,
  name: (row: Record<string, unknown>) => string,
  where: (row: Record<string, unknown>) => string
) {
  const groups = new Map<string, string[]>()
  for (const row of rows) {
    const key = cast(row) || "Unrecorded"
    groups.set(key, [
      ...(groups.get(key) ?? []),
      `${name(row)} (${where(row).replace(/^-|-$/g, "")})`,
    ])
  }
  const counts = Object.fromEntries(
    [...groups].map(([key, list]) => [key, list.length])
  )
  const yeas =
    groups.get("Yea") ??
    groups.get("Yea ") ??
    groups.get("Aye") ??
    groups.get("Yeas") ??
    []
  const nays = groups.get("Nay") ?? groups.get("No") ?? groups.get("Nays") ?? []
  const named: Record<string, string[]> = {}
  // Everything that is not one of the two big sides is short and goes in whole.
  for (const [key, list] of groups)
    if (list !== yeas && list !== nays && list.length <= 40) named[key] = list
  const smaller =
    yeas.length <= nays.length
      ? { key: "Yea", list: yeas, other: "Nay", n: nays.length }
      : { key: "Nay", list: nays, other: "Yea", n: yeas.length }
  if (smaller.list.length) named[smaller.key] = smaller.list.slice(0, 250)
  return {
    counts,
    positions: named,
    not_listed: smaller.n
      ? `the ${smaller.n} who voted ${smaller.other} are counted, not named`
      : null,
  }
}

/** A calendar row as an answer needs it: when, who, what, and which bill. */
const CALENDAR_ROW = [
  "date",
  "time",
  "type",
  "committee",
  "chamber",
  "what",
  "title",
  "bill_number",
  "bill_id",
  "location",
  "source",
]
/** A member as an answer names them. Photographs are for pages, not for prose. */
const MEMBER_ROW = [
  "people_id",
  "name",
  "party",
  "role",
  "chamber",
  "district",
  "title",
  "side",
  "rank",
  "votes",
  "last_vote",
  "bioguide_id",
]

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
      q: {
        type: "string",
        description: "The search term. Two characters minimum.",
      },
      jurisdiction: JURISDICTION,
      full_text: {
        type: "boolean",
        description: "Search bill text as well as titles. Default false.",
      },
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
      bill_id: {
        type: "integer",
        description: "The numeric id, as returned by search_bills.",
      },
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
        more:
          size(b.history) > 15
            ? "Only the most recent actions are here; bill_status has the whole history."
            : null,
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
        description:
          "Where to start, in characters. Default 0. Pass the previous call's from_char plus the excerpt's length to read on.",
      },
    },
    required: ["bill_id"],
    // The window is what survives the round anyway: a tool result is capped at
    // eight thousand characters before it reaches the model, so asking the
    // database for sixty thousand spent the time and the 1 MB result budget on
    // text that was then thrown away — and failed outright on the long bills,
    // which are the ones worth reading (503, "the result exceeds the size
    // limit"). Six thousand fits the cap with the envelope around it.
    request: (input) =>
      query("text", { ...input, chars: "6000" }, ["id", "chars", "from"]),
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
        more:
          from + text.length < full
            ? `${(full - from - text.length).toLocaleString()} characters remain; call again with from_char ${from + text.length}.`
            : null,
        text,
      }
    },
  },

  list_members: {
    description:
      "The sitting members of a jurisdiction, with party, chamber and district.",
    properties: { jurisdiction: JURISDICTION },
    request: (input) => query("members", input, []),
    // Sixty members with their photographs came to 19 kB against a round budget
    // of eight; the columns below are the ones an answer is written from.
    shape: (data) => slim(data, MEMBER_ROW, 60),
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
    request: (input) =>
      query("record", { ...input, limit: input.limit ?? "25" }, [
        "id",
        "limit",
      ]),
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
      name: {
        type: "string",
        description: "The committee's name, as list_committees gives it.",
      },
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
      const d = data as {
        filings?: unknown[]
        count?: number
        clients?: number
        registrants?: number
      } | null
      if (!d) return null
      return {
        count: d.count,
        clients: d.clients,
        registrants: d.registrants,
        filings: trim(d.filings, 10),
      }
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
      return {
        totals: trim(d.totals, 8),
        contributions: trim(d.contributions, 12),
      }
    },
  },

  calendar: {
    description:
      "What a legislature has scheduled: sittings, hearings and committee meetings in a date window, with the bill each is on where the record files one. Defaults to the next six weeks. For Congress it merges LegiScan's calendar with the committee meetings congress.gov publishes, which carry the room and the witnesses.",
    properties: {
      jurisdiction: JURISDICTION,
      from: {
        type: "string",
        description: "Start date, YYYY-MM-DD. Defaults to today.",
      },
      to: {
        type: "string",
        description: "End date, YYYY-MM-DD. Defaults to six weeks out.",
      },
      committee: {
        type: "string",
        description:
          "Narrow to one committee by name, as list_committees gives it.",
      },
      limit: { type: "integer", description: "1–200, default 40." },
    },
    request: (input) =>
      query("calendar", input, ["from", "to", "committee", "limit"]),
    shape: (data) => {
      const d = data as {
        rows?: unknown[]
        count?: number
        from?: string
        to?: string
      } | null
      if (!d) return null
      return {
        from: d.from,
        to: d.to,
        count: d.count,
        rows: slim(d.rows, CALENDAR_ROW, 25, { what: 110, title: 90 }),
      }
    },
  },

  committee_agenda: {
    description:
      "What one committee has scheduled — the same calendar as `calendar`, asked of a single committee. Use it when the question is about a committee rather than about a jurisdiction's week.",
    properties: {
      committee: {
        type: "string",
        description:
          "The committee's name: 'House Judiciary', 'Ways and Means', 'Assembly Health'.",
      },
      jurisdiction: JURISDICTION,
      from: {
        type: "string",
        description: "Start date, YYYY-MM-DD. Defaults to today.",
      },
      to: {
        type: "string",
        description: "End date, YYYY-MM-DD. Defaults to six weeks out.",
      },
    },
    required: ["committee"],
    request: (input) => query("calendar", input, ["from", "to", "committee"]),
    shape: (data) => {
      const d = data as { rows?: unknown[]; count?: number } | null
      return d
        ? {
            count: d.count,
            rows: slim(d.rows, CALENDAR_ROW, 20, { what: 110, title: 90 }),
          }
        : null
    },
  },

  desk_stories: {
    description:
      "The press on a jurisdiction's government, newest first: what the news APIs have reported on its legislature and governor in the last days. Each row is a headline, its outlet, its date, a summary and the story's page here. This is press, not the record — a claim from it is the outlet's, and the brief says whose.",
    properties: {
      jurisdiction: JURISDICTION,
      q: {
        type: "string",
        description: "A word the headline or summary carries.",
      },
      limit: { type: "integer", description: "1–100, default 30." },
    },
    request: (input) =>
      query("stories", { ...input, limit: input.limit ?? "30" }, [
        "q",
        "limit",
      ]),
    shape: (data) =>
      trim(
        ((data as unknown[]) ?? []).map((row) => {
          const s = row as Record<string, unknown>
          return {
            id: s.id,
            title: s.title,
            source: s.source_name,
            date:
              typeof s.published_at === "string"
                ? s.published_at.slice(0, 10)
                : null,
            summary: String(s.description ?? s.content ?? "").slice(0, 400),
            page: `/news/${String(s.state).toLowerCase()}/${s.id}`,
          }
        }),
        60
      ),
  },

  hearings: {
    description:
      "Hearings held. For Congress these are the volumes congress.gov has published — date, committee, title, and has_text, which says whether the transcript is on file here and so whether `transcripts` can quote it. For a state the record holds no transcripts at all, and this answers with the hearings its calendar carries.",
    properties: {
      jurisdiction: JURISDICTION,
      committee: {
        type: "string",
        description: "Narrow to one committee by name.",
      },
      q: { type: "string", description: "A phrase in the hearing's title." },
      from: { type: "string", description: "Start date, YYYY-MM-DD." },
      to: { type: "string", description: "End date, YYYY-MM-DD." },
      limit: { type: "integer", description: "1–100, default 20." },
    },
    // Two different things wear the word "hearing": a volume congress.gov
    // printed, and a sitting a state put on its calendar. Congress has both and
    // the published one is the better answer; a state has only the second.
    request: (input) =>
      (input.jurisdiction || "US").toUpperCase() === "US"
        ? query("hearings-held", input, [
            "committee",
            "q",
            "from",
            "to",
            "limit",
          ])
        : query(
            "calendar",
            {
              ...input,
              from: input.from ?? day(-365),
              to: input.to ?? day(45),
            },
            ["committee", "from", "to", "limit"]
          ),
    shape: (data) => {
      const d = data as {
        rows?: unknown[]
        count?: number
        committee?: string | null
      } | null
      if (!d) return null
      return {
        committee: d.committee ?? null,
        count: d.count,
        rows: slim(
          d.rows,
          [
            "jacket",
            "date",
            "chamber",
            "committee_name",
            "title",
            "has_text",
            "citation",
            "what",
            "committee",
            "bill_number",
            "type",
          ],
          20,
          { title: 120, what: 110 }
        ),
      }
    },
  },

  transcripts: {
    description:
      "The words said at a federal hearing. Give it a hearing's jacket number, from `hearings`, and a search term: the excerpt opens where the term appears, which is what you want of a transcript that runs to a hundred thousand characters. With a term and no hearing it searches the Congressional Record instead — and the Record's own text is not held here, so that answers with citations and congress.gov links, which read_page can then open. Congress only.",
    properties: {
      hearing: {
        type: "string",
        description: "The jacket number, as `hearings` gives it in `jacket`.",
      },
      q: {
        type: "string",
        description:
          "A phrase to find. The excerpt opens where it first appears.",
      },
      from_char: {
        type: "integer",
        description:
          "Where to start instead, in characters — to read on from a previous excerpt.",
      },
      jurisdiction: JURISDICTION,
    },
    request: (input) =>
      query("transcript", { ...input, chars: "6000" }, [
        "hearing",
        "q",
        "from",
        "chars",
        "limit",
      ]),
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      if (Array.isArray(d.articles))
        return {
          note: d.note,
          count: d.count,
          articles: trim(d.articles as unknown[], 15),
        }
      const chars = Number(d.chars) || 0
      const from = Number(d.from) || 0
      const shown = Number(d.excerpt_chars) || 0
      return {
        hearing: d.jacket_number,
        title: d.title,
        date: d.hearing_date,
        chamber: d.chamber,
        url: d.url,
        chars,
        from_char: from,
        note: d.note ?? null,
        more:
          from + shown < chars
            ? `Read on with from_char ${from + shown}.`
            : null,
        text: d.text,
      }
    },
  },

  nominations: {
    description:
      "Presidential nominations and where each one has got to — the position, the department, the date it was received and the latest action. Congress only; there is no state equivalent in this record. Filter by the committee it was referred to, or by a phrase in the nominee's name or the post.",
    properties: {
      q: {
        type: "string",
        description:
          "A phrase in the nominee's name, the post or the department.",
      },
      committee: {
        type: "string",
        description: "The Senate committee it was referred to.",
      },
      congress: {
        type: "integer",
        description:
          "Which Congress. Default 119, which is all the record holds.",
      },
      limit: { type: "integer", description: "1–50, default 20." },
      jurisdiction: JURISDICTION,
    },
    request: (input) =>
      query("nominations", input, ["q", "committee", "congress", "limit"]),
    shape: (data) => {
      const d = data as { count?: number; nominations?: unknown[] } | null
      return d ? { count: d.count, nominations: trim(d.nominations, 20) } : null
    },
  },

  roster: {
    description:
      "Who sits on a committee. For Congress this is the published roster, in rank order, with the chair and the ranking member named as such. For a state nothing publishes one, so it is derived from who has actually cast votes in that committee this session — a real roster, but read it as 'who voted here', and the vote count beside each member is why they are on the list.",
    properties: {
      committee: {
        type: "string",
        description:
          "The committee's name: 'House Judiciary', 'Ways and Means', 'Health'.",
      },
      jurisdiction: JURISDICTION,
    },
    required: ["committee"],
    request: (input) =>
      query("roster", { ...input, name: input.committee }, ["name"]),
    shape: (data) => {
      if (Array.isArray(data))
        return {
          source: "derived from committee votes",
          members: slim(data, MEMBER_ROW, 40),
        }
      const d = data as {
        committee?: string
        chamber?: string
        source?: string
        members?: unknown[]
      } | null
      return d
        ? {
            committee: d.committee,
            chamber: d.chamber,
            source: d.source,
            members: slim(d.members, MEMBER_ROW, 60),
          }
        : null
    },
  },

  votes: {
    description:
      "The recorded votes on a bill, or the ones a chamber took in a window. Tallies and results, not who voted which way — roll_call is that, one vote at a time. For Congress this is the House's roll calls, which is what congress.gov publishes; the Senate's are not in this record.",
    properties: {
      bill_id: {
        type: "integer",
        description: "A bill's numeric id, for the votes on that bill.",
      },
      bill_number: {
        type: "string",
        description: "Or the bill's number: 'H.R. 1', 'A07380'.",
      },
      jurisdiction: JURISDICTION,
      from: {
        type: "string",
        description:
          "Start date, YYYY-MM-DD — for a chamber's votes rather than a bill's.",
      },
      to: { type: "string", description: "End date, YYYY-MM-DD." },
      limit: { type: "integer", description: "1–50, default 20." },
    },
    request: (input) => {
      const federal = (input.jurisdiction || "US").toUpperCase() === "US"
      if (federal)
        return query("house-votes", input, [
          "id",
          "number",
          "from",
          "to",
          "limit",
        ])
      // A state's roll calls: the bill's own, or the session's most recent.
      return input.id
        ? query("votes", input, ["id"])
        : query("rollcalls", input, ["limit"])
    },
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      if (Array.isArray(d))
        return {
          count: d.length,
          votes: slim(d, ROLL_CALL_ROW, 20, { description: 90, title: 80 }),
        }
      const federal = d.houseRollCallVotes as
        | Record<string, unknown>[]
        | undefined
      if (federal) {
        return {
          count: d.count,
          votes: trim(federal, 20).map((v) => ({
            vote: v.identifier,
            date: v.startDate,
            question: v.voteQuestion,
            result: v.result,
            bill:
              `${v.legislationType ?? ""} ${v.legislationNumber ?? ""}`.trim() ||
              null,
            tally: v.tally,
          })),
        }
      }
      return {
        count: size(d.rollCalls),
        votes: slim(d.rollCalls, ROLL_CALL_ROW, 20, { description: 90 }),
      }
    },
  },

  roll_call: {
    description:
      "One vote, member by member. Give it the vote's id — a state roll_call_id from `votes`, or a House vote identifier like '11922026295'. It answers with the tally and then the names, in full for the smaller side and for anyone who did not vote, and as a count for the larger: a list of 434 names is the answer to no question anyone asks, and who broke ranks is.",
    properties: {
      vote_id: {
        type: "string",
        description: "The roll call's id, as `votes` gives it.",
      },
      jurisdiction: JURISDICTION,
    },
    required: ["vote_id"],
    request: (input) =>
      (input.jurisdiction || "US").toUpperCase() === "US"
        ? query("member-votes", { ...input, vote: input.vote_id }, ["vote"])
        : query("rollcall", { ...input, id: input.vote_id }, ["id"]),
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      // Congress: positions carry vote_cast; a state's carry vote_desc.
      const federal = d.memberVotes as Record<string, unknown>[] | undefined
      if (federal) {
        const header = (d.rollCall ?? {}) as Record<string, unknown>
        return {
          vote: d.vote,
          question: header.voteQuestion,
          result: header.result,
          date: header.startDate,
          bill:
            `${header.legislationType ?? ""} ${header.legislationNumber ?? ""}`.trim() ||
            null,
          tally: header.tally,
          ...sides(
            federal,
            (r) => String(r.vote_cast ?? ""),
            (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
            (r) => `${r.vote_party ?? ""}-${r.vote_state ?? ""}`
          ),
        }
      }
      const rollCall = d.rollCall as Record<string, unknown> | undefined
      const votes = (d.votes ?? []) as Record<string, unknown>[]
      return {
        vote: rollCall?.roll_call_id,
        question: rollCall?.description,
        date: rollCall?.date,
        chamber: rollCall?.chamber,
        bill: rollCall?.bill_number,
        tally: rollCall
          ? {
              yea: rollCall.yea,
              nay: rollCall.nay,
              notVoting: rollCall.nv,
              absent: rollCall.absent,
              total: rollCall.total,
            }
          : null,
        ...sides(
          votes,
          (r) => String(r.vote_desc ?? ""),
          (r) => String(r.name ?? ""),
          (r) => `${r.party ?? ""}-${r.district ?? ""}`
        ),
      }
    },
  },

  sponsors: {
    description:
      "Who put a bill forward — the primary sponsor or sponsors, with party and district. A narrower read than get_bill when that is the whole question.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      bill_number: {
        type: "string",
        description: "Or the bill's number: 'H.R. 1', 'A07380'.",
      },
      jurisdiction: JURISDICTION,
    },
    request: (input) => query("bill-sponsorship", input, ["id", "number"]),
    shape: (data) => {
      const d = data as {
        sponsors?: unknown[]
        cosponsor_count?: number
        source?: string
      } | null
      if (!d) return null
      return {
        source: d.source,
        cosponsor_count: d.cosponsor_count,
        sponsors: slim(d.sponsors, MEMBER_ROW, 12),
      }
    },
  },

  cosponsors: {
    description:
      "Who signed on to a bill and when. Under Congress each cosponsor carries the date they joined and whether they were there at introduction — which is how a bill picking up support after a hearing shows itself. For a state the record has the names but no dates.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      bill_number: {
        type: "string",
        description: "Or the bill's number: 'H.R. 1', 'A07380'.",
      },
      jurisdiction: JURISDICTION,
      limit: {
        type: "integer",
        description: "How many to list, newest first. Default 40.",
      },
    },
    request: (input) => query("bill-sponsorship", input, ["id", "number"]),
    shape: (data, input) => {
      const d = data as {
        cosponsors?: unknown[]
        cosponsor_count?: number
        source?: string
      } | null
      if (!d) return null
      const cap = Math.min(Number(input.limit) || 40, 60)
      return {
        source: d.source,
        count: d.cosponsor_count,
        listed: Math.min(cap, d.cosponsor_count ?? 0),
        cosponsors: slim(
          d.cosponsors,
          [
            "name",
            "party",
            "state",
            "district",
            "joined",
            "original",
            "withdrawn",
            "people_id",
          ],
          cap
        ),
      }
    },
  },

  bill_status: {
    description:
      "Where a bill stands and every step that got it there, compactly — newest first, so the first line is the answer to 'where is it'. Under Congress each action carries the committee that took it. Use this rather than get_bill when the question is the history and not the bill.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      bill_number: {
        type: "string",
        description: "Or the bill's number: 'H.R. 1', 'A07380'.",
      },
      jurisdiction: JURISDICTION,
      limit: {
        type: "integer",
        description: "How many actions, newest first. Default 25.",
      },
    },
    request: (input) =>
      query("bill-status", { ...input, limit: input.limit ?? "25" }, [
        "id",
        "number",
        "limit",
      ]),
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      return {
        bill_number: d.bill_number,
        citation: d.citation,
        title: d.title,
        status: d.status,
        committee: d.committee,
        last_action: d.last_action,
        last_action_date: d.last_action_date,
        source: d.source,
        count: d.count,
        progress: trim(d.progress as unknown[], 12),
        actions: slim(d.actions, ["date", "action", "type", "committee"], 25, {
          action: 200,
        }),
      }
    },
  },

  bill_amendments: {
    description:
      "The amendments offered to a bill: who offered each, what it would do, and where it got to. Congress only — this record holds no state amendment table, and the tool says so rather than answering a state with an empty list.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      bill_number: {
        type: "string",
        description: "Or the bill's number: 'H.R. 1'.",
      },
      jurisdiction: JURISDICTION,
      limit: { type: "integer", description: "1–100, default 20." },
    },
    request: (input) =>
      query("bill-amendments", { ...input, limit: input.limit ?? "20" }, [
        "id",
        "number",
        "limit",
      ]),
    shape: (data) => {
      const d = data as { count?: number; amendments?: unknown[] } | null
      if (!d) return null
      return {
        count: d.count,
        amendments: slim(
          d.amendments,
          [
            "amendment",
            "chamber",
            "sponsor",
            "purpose",
            "latest_action",
            "latest_action_date",
            "cosponsors",
          ],
          20,
          { purpose: 200, latest_action: 120 }
        ),
      }
    },
  },

  bill_diff: {
    description:
      "What changed between two versions of a bill — Introduced against Engrossed, the Senate's substitute against what it replaced. It answers with the shape of the change, not a raw diff: how many lines moved, which sections they moved in, and a line or two from the first places it happened. That is deliberate — a real diff of a bill runs to hundreds of kilobytes. Defaults to the two most recent versions; get_bill's `texts` lists them, and `versions` comes back with the answer so you can ask for a different pair. To read any passage in full, use get_bill_text.",
    properties: {
      bill_id: { type: "integer", description: "The numeric bill id." },
      bill_number: {
        type: "string",
        description: "Or the bill's number: 'H.R. 1', 'A07380'.",
      },
      jurisdiction: JURISDICTION,
      from_version: {
        type: "string",
        description:
          "The earlier version, by name ('Introduced') or document_id. Defaults to the one before the latest.",
      },
      to_version: {
        type: "string",
        description:
          "The later version, by name ('Engrossed') or document_id. Defaults to the latest.",
      },
      limit: {
        type: "integer",
        description: "How many changed places to show, 1–40. Default 10.",
      },
    },
    request: (input) =>
      query(
        "bill-diff",
        {
          ...input,
          from: input.from_version,
          to: input.to_version,
          limit: input.limit ?? "10",
        },
        ["id", "number", "from", "to", "limit"]
      ),
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      if (d.note && !d.lines) return { versions: d.versions, note: d.note }
      const version = (v: unknown) => {
        const x = (v ?? {}) as Record<string, unknown>
        return {
          version: x.version,
          date: x.date,
          chars: x.chars,
          truncated: x.truncated || undefined,
        }
      }
      return {
        bill_number: d.bill_number,
        from: version(d.from),
        to: version(d.to),
        lines: d.lines,
        places: d.places,
        sections: trim(d.sections as unknown[], 12),
        changes: trim(d.changes as unknown[], 10),
        versions: slim(d.versions, ["version", "chars"], 10),
        note: d.note,
      }
    },
  },

  web_search: {
    description:
      "Search the web, for the things this record does not hold: money in state ballot-measure campaigns, a legislature's own press release, reporting on a bill, an official page. Returns titles, links and short snippets — enough to cite and link, not the page itself. The record still outranks it: where a row and a search result disagree, the row is right. Six results by default; keep the query specific.",
    properties: {
      q: {
        type: "string",
        description:
          "The search query, as you would type it into a search engine.",
      },
      limit: { type: "integer", description: "1–10, default 6." },
    },
    required: ["q"],
    // The one tool whose path is not a /api/policy resource — see the note on
    // the leading slash in run-tools.
    request: (input) => {
      const sp = new URLSearchParams({
        q: input.q ?? "",
        limit: String(Math.min(Number(input.limit) || 6, 10)),
      })
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
      url: {
        type: "string",
        description: "The full http(s) URL, as a search result gave it.",
      },
    },
    required: ["url"],
    request: (input) =>
      `/api/agents/search?${new URLSearchParams({ url: input.url ?? "", chars: "6000" }).toString()}`,
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      const full = Number(d.full_chars) || 0
      const chars = Number(d.chars) || 0
      return {
        url: d.url,
        chars,
        full_chars: full,
        more:
          full > chars
            ? `${(full - chars).toLocaleString()} characters of this page were not read.`
            : null,
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
      text: {
        type: "string",
        description: "The message. Slack mrkdwn: *bold*, <url|label>.",
      },
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

  // ---- the Filer's tools ---------------------------------------------
  //
  // form_schema runs here (lib/agents/run-tools.ts). The other four are
  // client-side: the model calls them and the browser answers, because the
  // answers are the applicant's values and the model is never their ledger —
  // an SSN goes from the widget into the profile and from the profile into
  // the PDF, and the conversation carries a receipt. See lib/agents/loop.ts.

  form_schema: {
    description:
      "The sections of one of the two New York forms, in the order to ask them, with each section's keys — label, kind, fixed values, and the repeat for a section with rows. Call it once, first. Which keys the applicant's profile already holds is said on the first turn and in every ask receipt.",
    properties: {
      form: {
        type: "string",
        description: "Which form.",
        enum: ["ldss-2921", "ocfs-6025"],
      },
    },
    required: ["form"],
  },

  ask: {
    description:
      "Ask the applicant one section's questions as a widget in the chat. The browser renders the fields, collects the answers into the applicant's profile, and returns a receipt: which keys were answered and which were skipped. Call it alone, one section at a time, with only that section's keys from form_schema; a key the form does not have is refused. Keys the profile already knows arrive prefilled — include them so the applicant can confirm or edit, or leave them out to ask only the gap.",
    properties: {
      section: {
        type: "string",
        description: "The section's number or slug from form_schema.",
      },
      title: {
        type: "string",
        description: "The section's title, as form_schema gave it.",
      },
      intro: {
        type: "string",
        description: "One plain sentence above the fields, optional.",
      },
      fields: {
        type: "array",
        description: "The fields to show, in the form's order.",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description:
                "A key from form_schema. Row keys carry their row: household[1].dob.",
            },
            label: {
              type: "string",
              description:
                "What the applicant sees. Defaults to the key's own label.",
            },
            kind: {
              type: "string",
              description:
                "text, textarea, number, money, date, tel, email, ssn, select, radio, checkbox, yesno or attest. Defaults to the key's own kind.",
            },
            hint: {
              type: "string",
              description: "A short clarifier under the field, optional.",
            },
            required: {
              type: "boolean",
              description: "Blocks submit until answered. Default false.",
            },
          },
          required: ["key"],
        },
      },
      repeat: {
        type: "object",
        description:
          "For a section that repeats per person or per income: the row prefix and how many rows may be added.",
        properties: {
          key: {
            type: "string",
            description:
              "The row prefix: household, income, resources, absentParent.",
          },
          label: {
            type: "string",
            description: "What one row is: Person, Income.",
          },
          min: {
            type: "integer",
            description: "Rows shown at first. Default 1.",
          },
          max: {
            type: "integer",
            description: "Rows the paper form has room for.",
          },
        },
        required: ["key", "label", "max"],
      },
    },
    required: ["section", "title", "fields"],
  },

  review: {
    description:
      "Show every answer given for the form, grouped by section and editable, and wait for the applicant to confirm. Call it once, after the last section, before fill_form. Returns whether it was confirmed and how many answers there are.",
    properties: {
      form: {
        type: "string",
        description: "Which form.",
        enum: ["ldss-2921", "ocfs-6025"],
      },
    },
    required: ["form"],
  },

  fill_form: {
    description:
      "Write the applicant's answers into the form's own PDF fields in the browser and show the delivery card — download, email, save to the inbox. Call it once, after review confirms. Returns the filename, page count, how many fields were filled, and any keys the form had no field for.",
    properties: {
      form: {
        type: "string",
        description: "Which form.",
        enum: ["ldss-2921", "ocfs-6025"],
      },
    },
    required: ["form"],
  },

  remember: {
    description:
      "Keep facts the applicant states in conversation — a county, a household size, an employer — in their profile, so no later section asks for them. Values are keys from form_schema; unknown keys are rejected and reported back. Returns which keys were kept.",
    properties: {
      values: {
        type: "object",
        description:
          "Key → value, in the form's own vocabulary: dates YYYY-MM-DD, phones as ten digits, money as digits, fixed values by their value not their label.",
        additionalProperties: { type: "string" },
      },
    },
    required: ["values"],
  },
}

/** `id` and `number` are what /api/policy calls bill_id and bill_number. */
export function normalise(
  name: ToolName,
  input: Record<string, unknown>
): Record<string, string> {
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
    toolSpec: {
      name,
      description: definition.description,
      inputSchema: { json },
    },
  }
}
