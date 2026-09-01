import { STATE_CODES, STATE_NAMES } from "@/lib/filters"
import { sql } from "@/lib/policy/db"

// Every jurisdiction with its latest session and how many bills it holds —
// the State picker's list. One query over the latest-session view; the plain
// list of names stands in without the database.

export type StateCount = { state: string; name: string; session: number | null; bills: number | null }

export async function getStateCounts(): Promise<StateCount[]> {
  const codes = ["US", ...STATE_CODES, "DC"]
  if (sql) {
    try {
      const rows = (await sql`
        select s.state, s.session::int as session, coalesce(l.bills, 0)::int as bills
        from public.v_policy_latest_session s
        left join lateral (select bills from "LegiscanDatasets" x where x.state = s.state and x.year = s.session order by bills desc nulls last limit 1) l on true`) as {
        state: string
        session: number
        bills: number
      }[]
      const by = new Map(rows.map((r) => [r.state, r]))
      return codes.map((state) => ({ state, name: STATE_NAMES[state] ?? state, session: by.get(state)?.session ?? null, bills: by.get(state)?.bills ?? null }))
    } catch (error) {
      console.error("states: database unavailable", error)
    }
  }
  return codes.map((state) => ({ state, name: STATE_NAMES[state] ?? state, session: null, bills: null }))
}
