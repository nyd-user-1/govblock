import snapshot from "@/lib/data/newsroom-us.json"
import type { Newsroom } from "@/components/newsroom"
import { sql } from "@/lib/policy/db"

// The newsroom for one jurisdiction, from mv_newsroom_latest (one row per
// state, sections as jsonb). The committed Congress snapshot stands in when the
// database is not reachable.

export async function getNewsroom(state: string): Promise<{ data: Newsroom | null; session: number | null; source: "database" | "snapshot" }> {
  if (sql) {
    try {
      const rows = (await sql`
        select state, session, since, enacted, passed, committee, introduced, roll_calls, hearings
        from public.mv_newsroom_latest where state = ${state}`) as {
        session: number
        since: string
        enacted: Newsroom["enacted"]
        passed: Newsroom["passed"]
        committee: Newsroom["committee"]
        introduced: Newsroom["introduced"]
        roll_calls: Newsroom["rollCalls"]
        hearings: Newsroom["hearings"]
      }[]
      const row = rows[0]
      if (row) {
        const data: Newsroom = {
          lead: row.enacted[0] ?? row.passed[0] ?? null,
          enacted: row.enacted,
          passed: row.passed,
          committee: row.committee,
          introduced: row.introduced,
          rollCalls: row.roll_calls,
          hearings: row.hearings,
          since: row.since,
        }
        return { data, session: Number(row.session), source: "database" }
      }
    } catch (error) {
      console.error("newsroom: database unavailable, serving snapshot", error)
    }
  }
  return state === "US" ? { data: snapshot as unknown as Newsroom, session: 2025, source: "snapshot" } : { data: null, session: null, source: "snapshot" }
}
