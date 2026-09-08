// Federal lobbying, read off congress.gov identity.
//
// The LDA quarterly filings are three tables: `LobbyingFilings` is the filing
// (registrant, client, income, the document), `LobbyingActivities` its issue
// sections (issue code, prose, the named lobbyists, the agencies lobbied), and
// `LobbyingBills` the bills each section cites. A filing therefore joins to
// many bills and many lobbyists, which is why every count here is a distinct
// count and why money is never divided across the bills a filing names — see
// the note on `income` below.
//
// Bills join on `congress_key`, not on LegiScan's `bill_id`: the key is
// generated from the filing's own citation (sql/002_lobbying_congress_key.sql)
// and so needs no mirror in the path. `bill_id` stays the adapter for a row
// whose prefix we could not read.
//
// See docs/federal-sources.md.

import "server-only"

import { citationOf } from "@/lib/policy/congress"
import { n, one, q } from "@/lib/policy/db"

/** Where a bill's lobbying is looked up from: its congress.gov key, else its id. */
export type LobbyingScope = { congressKey?: string | null; billId?: number | null }

/** The filings that cite one bill — the CTE every reader below opens with. */
function filingsOf(scope: LobbyingScope): { sql: string; arg: unknown } | null {
  if (scope.congressKey) return { sql: `select distinct filing_uuid from "LobbyingBills" where congress_key = $1`, arg: scope.congressKey }
  if (scope.billId) return { sql: `select distinct filing_uuid from "LobbyingBills" where bill_id = $1`, arg: scope.billId }
  return null
}

export type LobbyingSummary = {
  filings: number
  clients: number
  firms: number
  lobbyists: number
  first_year: number | null
  last_year: number | null
}

export type LobbyingClient = {
  client: string
  client_id: number | null
  client_state: string | null
  description: string | null
  filings: number
  firms: number
  income: number | null
  url: string | null
  document_url: string | null
  last_year: number | null
}

export type LobbyingFirm = {
  registrant: string
  registrant_id: number | null
  filings: number
  clients: number
  income: number | null
}

export type LobbyingPerson = { lobbyist: string; filings: number; firms: number; clients: number }
export type LobbyingIssue = { issue_code: string; issue: string | null; filings: number }

export type LobbyingFiling = {
  filing_uuid: string
  client: string
  registrant: string
  filing_year: number
  filing_period: string | null
  filing_type: string | null
  income: number | null
  expenses: number | null
  url: string | null
  document_url: string | null
  posted: string | null
}

export type BillLobbying = {
  summary: LobbyingSummary
  clients: LobbyingClient[]
  firms: LobbyingFirm[]
  lobbyists: LobbyingPerson[]
  issues: LobbyingIssue[]
  documents: LobbyingFiling[]
}

const EMPTY_SUMMARY: LobbyingSummary = { filings: 0, clients: 0, firms: 0, lobbyists: 0, first_year: null, last_year: null }

/**
 * One bill's lobbying, in the shape OpenSecrets' bill page shows it: how many
 * clients and firms, who filed the most, which lobbyists were named, what the
 * filings were filed under, and the documents themselves.
 *
 * `income` is the whole filing's reported income. A quarterly filing covers
 * every issue and every bill the registrant worked that quarter, and the LDA
 * does not break it out per bill, so it is never divided or summed as though it
 * were this bill's price. Every surface that prints it says so.
 */
export async function getBillLobbying(scope: LobbyingScope, limit = 20): Promise<BillLobbying | null> {
  const f = filingsOf(scope)
  if (!f) return null
  const [summary, clients, firms, lobbyists, issues, documents] = await Promise.all([
    one<LobbyingSummary>(
      `with f as (${f.sql})
       select count(*)::int filings,
              count(distinct fi.client_name)::int clients,
              count(distinct fi.registrant_name)::int firms,
              (select count(distinct upper(l))::int from f join "LobbyingActivities" a using (filing_uuid), unnest(a.lobbyists) l where l <> '') lobbyists,
              min(fi.filing_year)::int first_year, max(fi.filing_year)::int last_year
         from f join "LobbyingFilings" fi using (filing_uuid)`,
      [f.arg]
    ),
    q<LobbyingClient>(
      `with f as (${f.sql})
       select fi.client_name client, max(fi.client_id)::int client_id, max(fi.client_state) client_state,
              max(fi.client_description) description, count(*)::int filings,
              count(distinct fi.registrant_name)::int firms, sum(fi.income)::float income,
              max(fi.url) url, max(fi.document_url) document_url, max(fi.filing_year)::int last_year
         from f join "LobbyingFilings" fi using (filing_uuid)
        where coalesce(fi.client_name, '') <> ''
        group by 1 order by count(*) desc, sum(fi.income) desc nulls last, 1 limit $2`,
      [f.arg, limit]
    ),
    q<LobbyingFirm>(
      `with f as (${f.sql})
       select fi.registrant_name registrant, max(fi.registrant_id)::int registrant_id, count(*)::int filings,
              count(distinct fi.client_name)::int clients, sum(fi.income)::float income
         from f join "LobbyingFilings" fi using (filing_uuid)
        where coalesce(fi.registrant_name, '') <> ''
        group by 1 order by count(*) desc, 1 limit $2`,
      [f.arg, limit]
    ),
    q<LobbyingPerson>(
      `with f as (${f.sql})
       select upper(l) lobbyist, count(distinct a.filing_uuid)::int filings,
              count(distinct fi.registrant_name)::int firms, count(distinct fi.client_name)::int clients
         from f join "LobbyingActivities" a using (filing_uuid)
              join "LobbyingFilings" fi on fi.filing_uuid = a.filing_uuid,
              unnest(a.lobbyists) l
        where l <> ''
        group by 1 order by 2 desc, 1 limit $2`,
      [f.arg, limit]
    ),
    q<LobbyingIssue>(
      `with f as (${f.sql})
       select a.issue_code, max(a.issue) issue, count(distinct a.filing_uuid)::int filings
         from f join "LobbyingActivities" a using (filing_uuid)
        where coalesce(a.issue_code, '') <> ''
        group by 1 order by 3 desc, 1 limit 12`,
      [f.arg]
    ),
    q<LobbyingFiling>(
      `with f as (${f.sql})
       select fi.filing_uuid, fi.client_name client, fi.registrant_name registrant, fi.filing_year::int filing_year,
              fi.filing_period, fi.filing_type_display filing_type, fi.income::float income, fi.expenses::float expenses,
              fi.url, fi.document_url, to_char(fi.dt_posted, 'YYYY-MM-DD') posted
         from f join "LobbyingFilings" fi using (filing_uuid)
        order by coalesce(fi.income, fi.expenses) desc nulls last, fi.dt_posted desc limit $2`,
      [f.arg, limit]
    ),
  ])
  return {
    summary: summary ? { ...summary, filings: n(summary.filings), clients: n(summary.clients), firms: n(summary.firms), lobbyists: n(summary.lobbyists) } : EMPTY_SUMMARY,
    clients,
    firms,
    lobbyists,
    issues,
    documents,
  }
}

/* ---- the explorer --------------------------------------------------------- */

export type LobbyingTotals = {
  filings: number
  registrants: number
  clients: number
  lobbyists: number
  bills: number
  income: number | null
  first_year: number | null
  last_year: number | null
}

export type LobbyingSector = { issue_code: string; issue: string | null; filings: number; clients: number; registrants: number }

/**
 * The whole federal register at a glance, for /docs/lobbying. Every count is a
 * distinct count over the filings themselves; nothing is estimated and nothing
 * is apportioned between the issues or the bills a filing names.
 */
export async function getLobbyingOverview(limit = 25) {
  const [totals, firms, clients, lobbyists, sectors] = await Promise.all([
    one<LobbyingTotals>(
      `select count(*)::int filings,
              count(distinct registrant_name)::int registrants,
              count(distinct client_name)::int clients,
              (select count(distinct upper(l))::int from "LobbyingActivities", unnest(lobbyists) l where l <> '') lobbyists,
              (select count(distinct congress_key)::int from "LobbyingBills") bills,
              sum(income)::float income,
              min(filing_year)::int first_year, max(filing_year)::int last_year
         from "LobbyingFilings"`
    ),
    q<LobbyingFirm>(
      `select registrant_name registrant, max(registrant_id)::int registrant_id, count(*)::int filings,
              count(distinct client_name)::int clients, sum(income)::float income
         from "LobbyingFilings" where coalesce(registrant_name, '') <> ''
        group by 1 order by sum(income) desc nulls last, count(*) desc limit $1`,
      [limit]
    ),
    q<LobbyingClient>(
      `select client_name client, max(client_id)::int client_id, max(client_state) client_state,
              max(client_description) description, count(*)::int filings,
              count(distinct registrant_name)::int firms, sum(income)::float income,
              max(url) url, max(document_url) document_url, max(filing_year)::int last_year
         from "LobbyingFilings" where coalesce(client_name, '') <> ''
        group by 1 order by sum(income) desc nulls last, count(*) desc limit $1`,
      [limit]
    ),
    q<LobbyingPerson>(
      `select upper(l) lobbyist, count(distinct a.filing_uuid)::int filings,
              count(distinct f.registrant_name)::int firms, count(distinct f.client_name)::int clients
         from "LobbyingActivities" a join "LobbyingFilings" f using (filing_uuid), unnest(a.lobbyists) l
        where l <> '' group by 1 order by 2 desc, 1 limit $1`,
      [limit]
    ),
    q<LobbyingSector>(
      `select a.issue_code, max(a.issue) issue, count(distinct a.filing_uuid)::int filings,
              count(distinct f.client_name)::int clients, count(distinct f.registrant_name)::int registrants
         from "LobbyingActivities" a join "LobbyingFilings" f using (filing_uuid)
        where coalesce(a.issue_code, '') <> '' group by 1 order by 3 desc`
    ),
  ])
  return { totals: totals ?? null, firms, clients, lobbyists, sectors }
}

export type LobbyingHit = { kind: "firm" | "client" | "lobbyist"; name: string; filings: number; detail: string | null }

/** The explorer's search: registrants, clients and named lobbyists by name. */
export async function searchLobbying(term: string, limit = 15) {
  const like = `%${String(term ?? "").trim()}%`
  if (like.length < 5) return []
  const [firms, clients, lobbyists] = await Promise.all([
    q<{ name: string; filings: number; detail: string | null }>(
      `select registrant_name name, count(*)::int filings, null::text detail from "LobbyingFilings"
        where registrant_name ilike $1 group by 1 order by 2 desc limit $2`,
      [like, limit]
    ),
    q<{ name: string; filings: number; detail: string | null }>(
      `select client_name name, count(*)::int filings, max(client_description) detail from "LobbyingFilings"
        where client_name ilike $1 group by 1 order by 2 desc limit $2`,
      [like, limit]
    ),
    q<{ name: string; filings: number; detail: string | null }>(
      `select upper(l) name, count(distinct filing_uuid)::int filings, null::text detail
         from "LobbyingActivities", unnest(lobbyists) l where l ilike $1 group by 1 order by 2 desc limit $2`,
      [like, limit]
    ),
  ])
  return [
    ...firms.map((r) => ({ ...r, kind: "firm" as const })),
    ...clients.map((r) => ({ ...r, kind: "client" as const })),
    ...lobbyists.map((r) => ({ ...r, kind: "lobbyist" as const })),
  ].sort((a, b) => b.filings - a.filings) as LobbyingHit[]
}

/* ---- one entity ----------------------------------------------------------- */

export type EntityKind = "firm" | "client" | "lobbyist"

export type LobbyingYear = { filing_year: number; filings: number; income: number | null; expenses: number | null }
export type LobbyingBillRow = { congress_key: string; congress: number; bill_type: string; number: string; citation: string | null; title: string | null; bill_id: number | null; filings: number }

export type LobbyingEntity = {
  kind: EntityKind
  name: string
  description: string | null
  state: string | null
  filings: number
  income: number | null
  first_year: number | null
  last_year: number | null
  counterparties: { name: string; filings: number; income: number | null }[]
  lobbyists: LobbyingPerson[]
  issues: LobbyingIssue[]
  years: LobbyingYear[]
  bills: LobbyingBillRow[]
  documents: LobbyingFiling[]
}

/** The filings one entity is on — the CTE every section of its page opens with. */
function filingsOfEntity(kind: EntityKind): string {
  if (kind === "firm") return `select filing_uuid from "LobbyingFilings" where upper(registrant_name) = upper($1)`
  if (kind === "client") return `select filing_uuid from "LobbyingFilings" where upper(client_name) = upper($1)`
  return `select distinct filing_uuid from "LobbyingActivities" where exists (select 1 from unnest(lobbyists) l where upper(l) = upper($1))`
}

/**
 * A firm, a client or a lobbyist, in the shape OpenSecrets' entity pages take:
 * who they worked with, what they worked on, what it was worth, the bills they
 * named, and the filings themselves.
 *
 * The counterparty is whoever sits on the other side: a firm's clients, a
 * client's firms, and for a lobbyist the firms they filed under.
 */
export async function getLobbyingEntity(kind: EntityKind, name: string, limit = 25): Promise<LobbyingEntity | null> {
  const held = filingsOfEntity(kind)
  const counterparty = kind === "firm" ? "client_name" : "registrant_name"
  const [head, counterparties, lobbyists, issues, years, bills, documents] = await Promise.all([
    one<{ name: string; description: string | null; state: string | null; filings: number; income: number | null; first_year: number | null; last_year: number | null }>(
      `with f as (${held})
       select ${kind === "lobbyist" ? "upper($1)" : kind === "firm" ? "max(fi.registrant_name)" : "max(fi.client_name)"} name,
              ${kind === "client" ? "max(fi.client_description)" : "null::text"} description,
              ${kind === "client" ? "max(fi.client_state)" : "null::text"} state,
              count(*)::int filings, sum(fi.income)::float income,
              min(fi.filing_year)::int first_year, max(fi.filing_year)::int last_year
         from f join "LobbyingFilings" fi using (filing_uuid)`,
      [name]
    ),
    q<{ name: string; filings: number; income: number | null }>(
      `with f as (${held})
       select fi.${counterparty} name, count(*)::int filings, sum(fi.income)::float income
         from f join "LobbyingFilings" fi using (filing_uuid)
        where coalesce(fi.${counterparty}, '') <> ''
        group by 1 order by count(*) desc, 1 limit $2`,
      [name, limit]
    ),
    q<LobbyingPerson>(
      `with f as (${held})
       select upper(l) lobbyist, count(distinct a.filing_uuid)::int filings,
              count(distinct fi.registrant_name)::int firms, count(distinct fi.client_name)::int clients
         from f join "LobbyingActivities" a using (filing_uuid)
              join "LobbyingFilings" fi on fi.filing_uuid = a.filing_uuid, unnest(a.lobbyists) l
        where l <> '' group by 1 order by 2 desc, 1 limit $2`,
      [name, limit]
    ),
    q<LobbyingIssue>(
      `with f as (${held})
       select a.issue_code, max(a.issue) issue, count(distinct a.filing_uuid)::int filings
         from f join "LobbyingActivities" a using (filing_uuid)
        where coalesce(a.issue_code, '') <> '' group by 1 order by 3 desc, 1 limit 16`,
      [name]
    ),
    q<LobbyingYear>(
      `with f as (${held})
       select fi.filing_year::int filing_year, count(*)::int filings, sum(fi.income)::float income, sum(fi.expenses)::float expenses
         from f join "LobbyingFilings" fi using (filing_uuid)
        group by 1 order by 1 desc`,
      [name]
    ),
    q<LobbyingBillRow>(
      `with f as (${held})
       select lb.congress_key, cb.congress, cb.bill_type, cb.number, cb.display_title title, cb.bill_id,
              count(distinct lb.filing_uuid)::int filings
         from f join "LobbyingBills" lb using (filing_uuid)
              join congress_bills cb on cb.key = lb.congress_key
        group by 1, 2, 3, 4, 5, 6 order by 7 desc, 1 limit $2`,
      [name, limit]
    ),
    q<LobbyingFiling>(
      `with f as (${held})
       select fi.filing_uuid, fi.client_name client, fi.registrant_name registrant, fi.filing_year::int filing_year,
              fi.filing_period, fi.filing_type_display filing_type, fi.income::float income, fi.expenses::float expenses,
              fi.url, fi.document_url, to_char(fi.dt_posted, 'YYYY-MM-DD') posted
         from f join "LobbyingFilings" fi using (filing_uuid)
        order by fi.dt_posted desc nulls last limit $2`,
      [name, limit]
    ),
  ])
  if (!head || !head.filings) return null
  return {
    kind,
    name: head.name ?? name,
    description: head.description,
    state: head.state,
    filings: n(head.filings),
    income: head.income,
    first_year: head.first_year,
    last_year: head.last_year,
    counterparties,
    lobbyists,
    issues,
    years,
    bills: bills.map((b) => ({ ...b, congress: n(b.congress), bill_id: b.bill_id == null ? null : n(b.bill_id), citation: citationOf(b.bill_type, b.number) })),
    documents,
  }
}

/* ---- lobbying on a member's and a committee's bills ------------------------ */

export type ScopedLobbying = {
  bills: number
  filings: number
  clients: number
  firms: number
  topClients: { client: string; filings: number; bills: number }[]
  topFirms: { registrant: string; filings: number; bills: number }[]
  topBills: LobbyingBillRow[]
}

/**
 * Lobbying on a set of bills, named by their congress.gov keys. Serves the
 * member page (the bills they sponsored) and the committee page (the bills
 * referred to it) from one reader, because the question is the same one.
 *
 * Capped at the caller's key list rather than joining the whole register: a
 * chair's committee holds thousands of bills, and the unbounded join is the
 * one query on this page that could reach Amplify's thirty seconds.
 *
 * The key list arrives as `unnest($1) join`, never as `congress_key = any($1)`.
 * Postgres cannot estimate the selectivity of an array it has not seen, so the
 * `any()` form takes a generic plan and scans: measured 2026-09-07 against Rick
 * Scott's 182 sponsored bills, `any()` cost 3.8 s a statement and the unnest
 * join 0.7 s, which is 15 s off the member page.
 */
export async function getLobbyingOnBills(keys: string[], limit = 10): Promise<ScopedLobbying | null> {
  const scope = [...new Set(keys.filter(Boolean))].slice(0, 4000)
  if (!scope.length) return null
  const [summary, topClients, topFirms, topBills] = await Promise.all([
    one<{ bills: number; filings: number; clients: number; firms: number }>(
      `select count(distinct lb.congress_key)::int bills, count(distinct lb.filing_uuid)::int filings,
              count(distinct fi.client_name)::int clients, count(distinct fi.registrant_name)::int firms
         from unnest($1::text[]) k(key)
              join "LobbyingBills" lb on lb.congress_key = k.key
              join "LobbyingFilings" fi using (filing_uuid)`,
      [scope]
    ),
    q<{ client: string; filings: number; bills: number }>(
      `select fi.client_name client, count(distinct lb.filing_uuid)::int filings, count(distinct lb.congress_key)::int bills
         from unnest($1::text[]) k(key)
              join "LobbyingBills" lb on lb.congress_key = k.key
              join "LobbyingFilings" fi using (filing_uuid)
        where coalesce(fi.client_name, '') <> ''
        group by 1 order by 2 desc, 1 limit $2`,
      [scope, limit]
    ),
    q<{ registrant: string; filings: number; bills: number }>(
      `select fi.registrant_name registrant, count(distinct lb.filing_uuid)::int filings, count(distinct lb.congress_key)::int bills
         from unnest($1::text[]) k(key)
              join "LobbyingBills" lb on lb.congress_key = k.key
              join "LobbyingFilings" fi using (filing_uuid)
        where coalesce(fi.registrant_name, '') <> ''
        group by 1 order by 2 desc, 1 limit $2`,
      [scope, limit]
    ),
    q<LobbyingBillRow>(
      `select lb.congress_key, cb.congress, cb.bill_type, cb.number, cb.display_title title, cb.bill_id,
              count(distinct lb.filing_uuid)::int filings
         from unnest($1::text[]) k(key)
              join "LobbyingBills" lb on lb.congress_key = k.key
              join congress_bills cb on cb.key = lb.congress_key
        group by 1, 2, 3, 4, 5, 6 order by 7 desc limit $2`,
      [scope, limit]
    ),
  ])
  if (!summary?.filings) return null
  return {
    bills: n(summary.bills),
    filings: n(summary.filings),
    clients: n(summary.clients),
    firms: n(summary.firms),
    topClients,
    topFirms,
    topBills: topBills.map((b) => ({ ...b, congress: n(b.congress), bill_id: b.bill_id == null ? null : n(b.bill_id), citation: citationOf(b.bill_type, b.number) })),
  }
}

/** congress.gov keys for the bills a member sponsored, newest congress first. */
export async function sponsoredKeys(peopleId: number, limit = 4000) {
  const rows = await q<{ key: string }>(
    `select cb.key from "Sponsors" s
       join congress_bills cb on cb.bill_id = s.bill_id
      where s.people_id = $1 and s.sponsor_type_id = 1
      order by cb.introduced_date desc nulls last limit $2`,
    [peopleId, limit]
  )
  return rows.map((r) => r.key)
}

/** congress.gov keys for the bills referred to one committee. */
export async function referredKeys(systemCode: string, limit = 4000) {
  const rows = await q<{ key: string }>(
    `select distinct cb.key from congress_bill_committees c
       join congress_bills cb on cb.bill_id = c.bill_id
      where c.system_code = $1 limit $2`,
    [systemCode, limit]
  )
  return rows.map((r) => r.key)
}

export type RevolvingDoorRow = { name: string; was: string; party: string | null; filings: number }

/**
 * The revolving door, as far as our records can honestly see it: lobbyists
 * named on filings about a given set of bills whose name also appears in the
 * congressional record — a member of Congress in `People`, or a House staffer
 * in the directory.
 *
 * It is a **name match**, and it is labelled as one everywhere it is shown. We
 * hold no employment history: `house_staff` is today's roster, not a former
 * one, and the Senate publishes no staff directory at all, so a sitting
 * staffer who leaves for K Street simply vanishes from what we can check. The
 * match that does work is the former member — Dennis Cardoza, Ed Royce, Greg
 * Walden and 113 others appear in both records — and a namesake will
 * occasionally ride along. The names are shown rather than only counted, so a
 * reader can see which is which.
 */
export async function getRevolvingDoor(keys: string[], limit = 12) {
  const scope = [...new Set(keys.filter(Boolean))].slice(0, 4000)
  if (!scope.length) return []
  return q<RevolvingDoorRow>(
    `with named as (
       select upper(regexp_replace(l, '[^A-Za-z ]', '', 'g')) nm, count(distinct lb.filing_uuid)::int filings
         from unnest($1::text[]) k(key)
              join "LobbyingBills" lb on lb.congress_key = k.key
              join "LobbyingActivities" a on a.filing_uuid = lb.filing_uuid,
              unnest(a.lobbyists) l
        where l <> ''
        group by 1),
     served as (
       select upper(regexp_replace(coalesce(first_name, '') || ' ' || coalesce(last_name, ''), '[^A-Za-z ]', '', 'g')) nm,
              max(role) was, max(party) party
         from "People" where state = 'US' and coalesce(last_name, '') <> '' group by 1
       union all
       select upper(regexp_replace(regexp_replace(name, '^(The Honorable|Hon\\.|Dr\\.|Mr\\.|Ms\\.|Mrs\\.)\\s+', '', 'i'), '[^A-Za-z ]', '', 'g')),
              'House staff', null
         from house_staff where name is not null group by 1)
     select n.nm name, max(s.was) was, max(s.party) party, max(n.filings)::int filings
       from named n join served s on s.nm = n.nm
      group by 1 order by 4 desc, 1 limit $2`,
    [scope, limit]
  )
}
