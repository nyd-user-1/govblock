import "server-only"

import { STATE_CODES, stateName } from "@/lib/filters"
import { q } from "@/lib/policy/db"

// Every jurisdiction at a glance (Brendan, 2026-09-13: "see how we are at a
// global scale"): the first session on record, the bills, the sections of law
// and the sitting members. The sessions count, the current session and the
// roster against the seats left the page on 2026-09-18 (Brendan), and their
// queries with them; the law and member counts arrived the same day, each
// counted the way the page it opens counts.

export type IndexRow = {
  state: string
  name: string
  firstSession: number | null
  bills: number
  /** Sections of standing law, as /laws counts them. */
  laws: number
  /** Sitting this session, by the members page's rule (sittingClause); 0 where nobody qualifies. */
  members: number
}

const num = (v: unknown) => Number(v ?? 0) || 0

export async function getStateIndex(): Promise<IndexRow[]> {
  const [bills, datasets, laws, members] = await Promise.all([
    q<Record<string, unknown>>(`select state, count(*)::int bills from "Bills" group by 1`),
    q<Record<string, unknown>>(`select state, min(year)::int first_year from "LegiscanDatasets" group by 1`),
    q<Record<string, unknown>>(
      `select state, count(*) filter (where doc_type in ('SECTION', 'RULE', 'JOINT_RULE', 'PREAMBLE'))::int sections from "Laws" group by 1`
    ),
    // sittingClause for every jurisdiction at once: on the current session's
    // roster where the jurisdiction has one, and where it has none, a sponsor
    // of a bill in that session. Georgia and North Dakota count by the second
    // rule today, so their numbers are short of their seats, as the members
    // page's sitting list is.
    q<Record<string, unknown>>(
      `with cur as (select state, session::int as session_id from v_policy_latest_session),
       rostered as (select distinct sp.state from "SessionPeople" sp join cur c on c.state = sp.state and sp.year = c.session_id)
       select p.state, count(*)::int members
       from "People" p
       join cur c on c.state = p.state
       left join rostered r on r.state = p.state
       where p.committee_id is null and not coalesce(p.archived, false) and p.role in ('Rep', 'Sen')
         and case when r.state is not null
               then exists (select 1 from "SessionPeople" sp where sp.people_id = p.people_id and sp.state = p.state and sp.year = c.session_id)
               else exists (select 1 from "Sponsors" sx join "Bills" bx using (bill_id) where sx.people_id = p.people_id and bx.state = p.state and bx.session_id = c.session_id)
             end
       group by 1`
    ),
  ])
  const byState = new Map(bills.map((r) => [String(r.state), r]))
  const byDataset = new Map(datasets.map((r) => [String(r.state), r]))
  const byLaws = new Map(laws.map((r) => [String(r.state), num(r.sections)]))
  const byMembers = new Map(members.map((r) => [String(r.state), num(r.members)]))
  const codes = ["US", ...STATE_CODES.filter((c) => c !== "US"), "DC"].filter((c, i, a) => a.indexOf(c) === i)
  return codes.map((code) => {
    const b = byState.get(code)
    const d = byDataset.get(code)
    return {
      state: code,
      name: code === "US" ? "Congress" : stateName(code),
      firstSession: d ? num(d.first_year) : null,
      bills: b ? num(b.bills) : 0,
      laws: byLaws.get(code) ?? 0,
      members: byMembers.get(code) ?? 0,
    }
  })
  // Only jurisdictions the record holds bills for.
  .filter((r) => r.bills > 0)
}

// The whole record in three numbers (Brendan, 2026-09-18): the root page's
// second section says them under its title. Law is counted in sections in
// force, not laws: "Laws" holds 2,056,526 sections across the U.S. Code and
// the 51 other codes, 179,398 of them marked repealed and 6,400 without text,
// and 25,215 codes and titles above them — so "2.1M Laws" said something the
// record does not (Brendan, the same day). 1,872,840 sections remain.
// Legislators are every person on file, sitting or former, less the
// committees LegiScan files as people (the rows with a committee_id or
// without both halves of a name, as the member search leaves them out). About
// 6 s cold, so the section streams the line in and the query's cache holds it
// for a day.
export type RecordCounts = { bills: number; sections: number; legislators: number }

export async function getRecordCounts(): Promise<RecordCounts> {
  const [row] = await q<Record<string, unknown>>(
    `select (select count(*) from "Bills")::int as bills,
            (select count(*) from "Laws" where doc_type in ('SECTION', 'RULE', 'JOINT_RULE', 'PREAMBLE')
               and not coalesce(repealed, false) and coalesce(text, '') <> '')::int as sections,
            (select count(*) from "People" where committee_id is null and role in ('Rep', 'Sen')
               and coalesce(first_name, '') <> '' and coalesce(last_name, '') <> '')::int as legislators`
  )
  return { bills: num(row?.bills), sections: num(row?.sections), legislators: num(row?.legislators) }
}
