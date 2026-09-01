import * as F from "@/lib/fixtures"
import members from "@/lib/data/members-us.json"
import rollcalls from "@/lib/data/rollcalls-us.json"
import hearings from "@/lib/data/hearings-us.json"
import texts from "@/lib/data/texts-us.json"
import textBodies from "@/lib/data/text-bodies-us.json"
import fecCandidates from "@/lib/data/fec-candidates-us.json"
import fecManifest from "@/lib/data/fec-manifest.json"
import states from "@/lib/data/states.json"
import options from "@/lib/data/options-us.json"
import sessions from "@/lib/data/sessions-us.json"
import subjects from "@/lib/data/subjects-us.json"
import { billsOnFile } from "@/lib/policy/queries"

// What livingston-v3's /api/policy/* and /api/fec/* answered for Congress on
// 2026-09-01, answered here from lib/data instead. The boards still ask by
// URL, so when the lake is wired in only this file changes.

type FecRow = (typeof fecCandidates)["2026"]["rows"][number]
const PARTY = (party: string | null) => {
  const p = (party ?? "").toUpperCase()
  return p.startsWith("DEM") ? "DEM" : p.startsWith("REP") ? "REP" : "OTHER"
}

export function resolve(url: string): unknown {
  const { pathname, searchParams: q } = new URL(url, "http://snapshot")
  const limit = Number(q.get("limit") ?? 0)
  switch (pathname) {
    case "/api/policy/states":
      return states
    case "/api/policy/sessions":
      return sessions
    case "/api/policy/options":
      return options
    case "/api/policy/subjects":
      return subjects
    case "/api/policy/bills": {
      const rows = billsOnFile()
      return { rows: limit ? rows.slice(0, limit) : rows, total: rows.length }
    }
    case "/api/policy/bill": {
      const rows = billsOnFile()
      return rows.find((b) => String(b.bill_id) === q.get("bill")) ?? rows[0]
    }
    case "/api/policy/committees":
      return F.committeesAll
    case "/api/policy/members":
      return members
    case "/api/policy/rollcalls":
      return rollcalls
    case "/api/policy/hearings": {
      const from = q.get("from") ?? "0000", to = q.get("to") ?? "9999"
      const rows = hearings.filter((h) => h.date >= from && h.date <= to)
      return limit ? rows.slice(0, limit) : rows
    }
    case "/api/policy/texts":
      return limit ? texts.slice(0, limit) : texts
    case "/api/policy/text": {
      const text = (textBodies as Record<string, string>)[q.get("document") ?? ""]
      return { texts: [], text: text ?? null }
    }
    case "/api/fec/manifest":
      return fecManifest
    case "/api/fec/candidates": {
      const cycle = q.get("cycle") ?? "2026"
      const snapshot = (fecCandidates as Record<string, (typeof fecCandidates)["2026"]>)[cycle] ?? fecCandidates["2026"]
      const office = q.get("office") ?? "", party = q.get("party") ?? "", ici = q.get("ici") ?? ""
      // The rows carry the seat's state, so the explorer can be scoped without a
      // round trip. "US" is the explorer's own word for every state at once;
      // "00" is the FEC's for a nationwide seat, which belongs to no one state.
      const scope = q.get("state") ?? ""
      const inScope = (row: FecRow) => !scope || scope === "US" || row.state === scope
      const sort = (q.get("sort") ?? "receipts") as keyof FecRow, dir = q.get("dir") === "asc" ? 1 : -1
      const offset = Number(q.get("offset") ?? 0), page = Number(q.get("limit") ?? 25)
      const rows = (cycle in fecCandidates ? snapshot.rows : [])
        .filter((r) => inScope(r) && (!office || r.office === office) && (!party || PARTY(r.party) === party) && (!ici || r.ici === ici))
        .sort((a, b) => { const x = a[sort] ?? 0, y = b[sort] ?? 0; return x > y ? dir : x < y ? -dir : 0 })
      return {
        meta: { ...snapshot.meta, cycle: Number(cycle), office, party, ici, sort, dir: dir > 0 ? "asc" : "desc", offset, matched: rows.length, returned: Math.min(page, rows.length - offset) },
        rows: rows.slice(offset, offset + page),
      }
    }
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// The congress.gov families.
//
// Lane C serves eleven of these from Aurora already; the rest have no table
// yet. Both answer the same URLs, so the fixtures below are cut into the same
// envelopes the routes return — a page reads one shape either way, and each
// family switches over the moment its table lands, with no page change.
//
// The records are the API's own, field names unchanged, pulled from
// api.congress.gov on 2026-09-01 for H.R. 1 of the 119th (the rich one: six
// text versions, five CRS summaries, 493 amendments, 38 related bills) and the
// twelve bills already on file.
//
// Loaded one family at a time, and only when a route did not answer: a bill
// page must not carry three megabytes of committee meetings it will never show.
// A family is registered here as the page that reads it lands, so `resolve`
// below names the whole contract while this map names what is on file.
const FIXTURES: Record<string, () => Promise<{ default: unknown }>> = {
  "text-versions": () => import("@/lib/data/congress/text-versions.json"),
  summaries: () => import("@/lib/data/congress/summaries.json"),
  amendments: () => import("@/lib/data/congress/amendments.json"),
  "related-bills": () => import("@/lib/data/congress/related-bills.json"),
  titles: () => import("@/lib/data/congress/titles.json"),
  cosponsors: () => import("@/lib/data/congress/cosponsors.json"),
  "committee-reports": () => import("@/lib/data/congress/committee-reports.json"),
  laws: () => import("@/lib/data/congress/laws.json"),
  "member-detail": () => import("@/lib/data/congress/member-detail.json"),
  "member-votes": () => import("@/lib/data/congress/house-votes.json"),
  "committee-detail": () => import("@/lib/data/congress/committee-detail.json"),
  "committee-meetings": () => import("@/lib/data/congress/committee-meetings.json"),
  "hearings-congress": () => import("@/lib/data/congress/hearings-congress.json"),
  nominations: () => import("@/lib/data/congress/nominations.json"),
  "crs-reports": () => import("@/lib/data/congress/crs-reports.json"),
  "record-issues": () => import("@/lib/data/congress/record-issues.json"),
}

async function fixture<T>(name: string): Promise<T | undefined> {
  const load = FIXTURES[name]
  return load ? ((await load()).default as T) : undefined
}

type Keyed = Record<string, unknown>
const at = (map: unknown, key: string | null) => (key && map && typeof map === "object" ? (map as Keyed)[key] : undefined)

// A window over a family list, in the shape the routes page them.
function slice(body: Keyed, key: string, offset: number, limit: number) {
  const rows = (body[key] as unknown[]) ?? []
  return { count: body.count ?? rows.length, [key]: limit ? rows.slice(offset, offset + limit) : rows }
}

// Meetings and transcripts name their committees inside their own record, and
// name the room they were held in: a subcommittee's markup belongs on its
// parent committee's page, which is what the code's first four characters say.
function forCommittee(detail: unknown, code: string) {
  const parent = code.slice(0, 4)
  return Object.values((detail as Keyed) ?? {}).filter((row) =>
    ((row as { committees?: { systemCode?: string }[] }).committees ?? []).some(
      (c) => String(c.systemCode ?? "").toLowerCase().slice(0, 4) === parent
    )
  )
}

const EMPTY_KEY: Record<string, string> = { "related-bills": "relatedBills" }

export async function resolveCongress(url: string): Promise<unknown> {
  const { pathname, searchParams: q } = new URL(url, "http://snapshot")
  const resource = pathname.replace(/^\/api\/policy\//, "")
  const bill = q.get("bill") ?? q.get("id")
  const bioguide = (q.get("bioguide") ?? q.get("member") ?? "").toUpperCase() || null
  const committee = (q.get("systemCode") ?? q.get("committee") ?? q.get("code") ?? "").toLowerCase() || null
  const offset = Number(q.get("offset") ?? 0) || 0
  const limit = Number(q.get("limit") ?? 0) || 0
  const body = await fixture<Keyed>(resource)
  if (!body) return undefined

  switch (resource) {
    case "text-versions":
      return at(body, bill) ?? []
    case "summaries":
    case "related-bills":
    case "titles":
    case "cosponsors":
      return at(body, bill) ?? { bill: Number(bill), count: 0, [EMPTY_KEY[resource] ?? resource]: [] }
    case "amendments":
      return at(body.byBill, bill) ?? { bill: Number(bill), count: 0, amendments: [] }
    case "laws":
      return bill ? (at(body.byBill, bill) ?? { bill: Number(bill), count: 0, bills: [] }) : slice(body.all as Keyed, "bills", offset, limit)
    case "committee-reports":
      if (bill) return at(body.byBill, bill) ?? { bill: Number(bill), count: 0, reports: [] }
      if (committee) return at(body.byCommittee, committee) ?? { committee, count: 0, reports: [] }
      return slice(body.all as Keyed, "reports", offset, limit)
    case "committee-detail":
      return committee ? (at(body.byCode, committee) ?? null) : body.all
    case "committee-meetings": {
      if (!committee) return slice(body, "committeeMeetings", offset, limit)
      const rows = forCommittee(body.detail, committee)
      return { committee, count: rows.length, committeeMeetings: rows }
    }
    case "hearings-congress": {
      if (!committee) return slice(body, "hearings", offset, limit)
      const rows = forCommittee(body.detail, committee)
      return { committee, count: rows.length, hearings: rows }
    }
    case "nominations":
      return slice(body, "nominations", offset, limit)
    case "crs-reports":
      return slice(body, "CRSReports", offset, limit)
    case "record-issues":
      return slice(body, "dailyCongressionalRecord", offset, limit)
    case "house-votes":
      // The per-member positions ride along: the tally on a card and the
      // position on a member's page are the same rows counted two ways, and
      // reading them from one answer is what keeps the two agreeing.
      return { ...slice(body, "houseRollCallVotes", offset, limit), positions: body.positions }
    case "member-detail":
      return bioguide ? (at(body, bioguide) ?? null) : null
    case "member-votes": {
      // No such endpoint exists upstream: a member's positions are the roll
      // calls they appear in. Derived here from the same records the vote board
      // reads, so the board and the member page can never disagree.
      if (!bioguide) return { count: 0, votes: [] }
      const votes: unknown[] = []
      for (const vote of Object.values((body.positions as Keyed) ?? {})) {
        const record = vote as Record<string, unknown> & { results?: { bioguideID?: string; voteCast?: string }[] }
        const cast = (record.results ?? []).find((r) => String(r.bioguideID ?? "").toUpperCase() === bioguide)
        if (cast) {
          const { results, ...rollCall } = record
          void results
          votes.push({ ...rollCall, voteCast: cast.voteCast })
        }
      }
      // `memberVotes` is the name the route answers under; `votes` stays for
      // anything still reading the older one.
      return { bioguide, count: votes.length, memberVotes: votes, votes }
    }
    default:
      return undefined
  }
}
