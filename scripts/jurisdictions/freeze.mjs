#!/usr/bin/env node
// Every jurisdiction's counts, frozen (Brendan, 2026-09-20): the years and
// sessions on file, the bills, the sections of law, the members sitting and
// on file, the roll calls. They move a little each day and not at all within
// one, so no page asks the database for them: this counts them once and writes
// apps/web/lib/data/jurisdictions.json, which /state, the root's second
// section and the ⌘K menu's Jurisdictions all draw. Run it again, and push,
// when the numbers should move.
//
//   node scripts/jurisdictions/freeze.mjs
//
// One query at a time: each is a whole-table aggregate, a few seconds apiece,
// and six at once is a load the cluster does not need from a convenience.
import { writeFileSync } from "node:fs"

import { q, WEB } from "../laws/lib/db.mjs"

const OUT = `${WEB}/lib/data/jurisdictions.json`
const num = (v) => Number(v ?? 0) || 0
const by = (rows, key) => new Map(rows.map((r) => [String(r.state), num(r[key])]))

const datasets = await q(`select state, min(year)::int first_year, coalesce(max(year) filter (where bills > 0), max(year))::int last_year, count(distinct year)::int sessions from "LegiscanDatasets" group by 1`)
const billRows = await q(`select state, count(*)::int n, extract(year from max(last_action_date::date) filter (where last_action_date::date <= current_date))::int last_acted from "Bills" group by 1`)
const bills = by(billRows, "n")
// Coverage runs to the last day a bill moved, not to the session's label: a two-year session is filed under the year it opened, so Alaska's 2025 session is still moving in 2026.
const lastActed = by(billRows, "last_acted")
// Sections of standing law, as /laws counts them.
const laws = by(await q(`select state, count(*) filter (where doc_type in ('SECTION', 'RULE', 'JOINT_RULE', 'PREAMBLE'))::int n from "Laws" group by 1`), "n")
// Sitting this session, by the members page's rule (lib/policy/state-index.ts): on the current session's roster where the jurisdiction has one, else a sponsor of a bill in it.
const members = by(
  await q(
    `with cur as (select state, session::int as session_id from v_policy_latest_session),
     rostered as (select distinct sp.state from "SessionPeople" sp join cur c on c.state = sp.state and sp.year = c.session_id)
     select p.state, count(*)::int n
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
  "n"
)
// Everyone on file, sitting or former, less the committees LegiScan files as people.
const legislators = by(await q(`select state, count(*)::int n from "People" where committee_id is null and role in ('Rep', 'Sen') and coalesce(first_name, '') <> '' and coalesce(last_name, '') <> '' group by 1`), "n")
const rollCalls = by(await q(`select b.state, count(*)::int n from "Roll Call" r join "Bills" b using (bill_id) group by 1`), "n")

const rows = datasets
  .map((d) => {
    const state = String(d.state)
    return { state, firstYear: num(d.first_year), lastYear: Math.max(num(d.last_year), lastActed.get(state) ?? 0), sessions: num(d.sessions), bills: bills.get(state) ?? 0, laws: laws.get(state) ?? 0, members: members.get(state) ?? 0, legislators: legislators.get(state) ?? 0, rollCalls: rollCalls.get(state) ?? 0 }
  })
  // Only jurisdictions with bills on file.
  .filter((r) => r.bills > 0)
  .sort((a, b) => a.state.localeCompare(b.state))

writeFileSync(OUT, JSON.stringify({ frozen: new Date().toISOString().slice(0, 10), rows }, null, 1) + "\n")
console.log(`${rows.length} jurisdictions, ${rows.reduce((t, r) => t + r.bills, 0).toLocaleString()} bills → ${OUT}`)
