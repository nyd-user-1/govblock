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
