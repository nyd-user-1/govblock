import "server-only"

import { STATE_CODES, stateName } from "@/lib/filters"
import { chambersOfState } from "@/lib/map/state-districts"
import { q } from "@/lib/policy/db"

// Every jurisdiction at a glance (Brendan, 2026-09-13: "see how we are at a
// global scale"): sessions on record, bills, and the current session's
// roster against the chamber's seat count. Three quick queries, no joins on
// the big tables.

export type IndexRow = {
  state: string
  name: string
  firstSession: number | null
  sessions: number
  bills: number
  current: number | null
  /** Per chamber: how many sit on the current roster against how many seats the chamber has. */
  chambers: { chamber: string; roster: number; seats: number | null }[]
}

const num = (v: unknown) => Number(v ?? 0) || 0
const SEATS_US: Record<string, number> = { House: 435, Senate: 100 }

export async function getStateIndex(): Promise<IndexRow[]> {
  const [bills, datasets, roster] = await Promise.all([
    q<Record<string, unknown>>(`select state, count(*)::int bills, max(session_id)::int current from "Bills" group by 1`),
    q<Record<string, unknown>>(`select state, min(year)::int first_year, count(distinct year)::int sessions from "LegiscanDatasets" group by 1`),
    q<Record<string, unknown>>(
      `select sp.state, case when p.district like 'SD-%' then 'Sen' when p.district like 'HD-%' then 'Rep' else p.role end role, count(*)::int n
       from "SessionPeople" sp join "People" p on p.people_id = sp.people_id
       where p.committee_id is null and p.role in ('Rep', 'Sen') group by 1, 2`
    ),
  ])
  const byState = new Map(bills.map((r) => [String(r.state), r]))
  const byDataset = new Map(datasets.map((r) => [String(r.state), r]))
  const codes = ["US", ...STATE_CODES.filter((c) => c !== "US"), "DC"].filter((c, i, a) => a.indexOf(c) === i)
  return codes.map((code) => {
    const b = byState.get(code)
    const d = byDataset.get(code)
    // A roster row carries the member's chamber from the district prefix (SD-,
    // HD-), since the source's role label is wrong for some senators. The upper
    // chamber's members are role Sen, the lower's Rep, and a single-chamber
    // body (Nebraska's Legislature, the D.C. Council) files its members as Sen.
    const rows = roster.filter((r) => String(r.state) === code)
    const byRole = (role: string) => rows.filter((r) => String(r.role) === role).reduce((t, r) => t + num(r.n), 0)
    const chambers: { chamber: string; seats: number | null; role: string }[] =
      code === "US"
        ? [
            { chamber: "House", seats: SEATS_US.House, role: "Rep" },
            { chamber: "Senate", seats: SEATS_US.Senate, role: "Sen" },
          ]
        : chambersOfState(code).map((c) => ({ chamber: c.chamber, seats: (c.count as number | null) ?? null, role: c.rank === "lower" ? "Rep" : "Sen" }))
    const named = chambers.length ? chambers : [...new Set(rows.map((r) => String(r.role)))].map((role) => ({ chamber: role === "Rep" ? "House" : "Senate", seats: null as number | null, role }))
    return {
      state: code,
      name: code === "US" ? "Congress" : stateName(code),
      firstSession: d ? num(d.first_year) : null,
      sessions: d ? num(d.sessions) : 0,
      bills: b ? num(b.bills) : 0,
      current: b ? num(b.current) : null,
      chambers: named.map((c) => ({ chamber: c.chamber, seats: c.seats ?? null, roster: byRole(c.role) })),
    }
  })
  // Only jurisdictions the record holds bills for.
  .filter((r) => r.bills > 0)
}
