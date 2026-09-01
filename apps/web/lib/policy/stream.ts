import snapshot from "@/lib/data/stream-changelog.json"
import { sql } from "@/lib/policy/db"

// The stream: each jurisdiction's latest session, its most recently acted-on
// bills. Read from mv_stream_latest (sql/001_policy_matviews.sql), refreshed
// hourly; the committed snapshot stands in when the database is not reachable.

export type StreamBill = {
  bill_id: number
  bill_number: string
  title: string
  description: string | null
  status_desc: string | null
  last_action: string | null
  last_action_date: string | null
  committee: string | null
  body: string | null
  url: string | null
  state_link: string | null
  text_chars: number | null
  sponsor: string | null
  sponsor_party: string | null
  sponsor_id: number | null
}
export type StreamGroup = { state: string; session: number; bills: StreamBill[] }

const SNAPSHOT = snapshot as unknown as StreamGroup[]

/** The jurisdictions a scoped page shows: Congress, plus the one in scope. */
export function scopeStates(state: string) {
  return state === "US" ? ["US"] : ["US", state]
}

export async function getStream({ states, limit = 40 }: { states?: string[]; limit?: number } = {}): Promise<{ groups: StreamGroup[]; source: "database" | "snapshot" }> {
  if (sql) {
    try {
      const rows = (await sql`
        select state, session_id, bill_id, bill_number, title, description, status_desc, last_action, last_action_date,
               committee, body, url, state_link, text_chars, sponsor, sponsor_party, sponsor_id
        from public.mv_stream_latest
        where rank <= ${limit} and (${states ?? null}::text[] is null or state = any(${states ?? null}::text[]))
        order by state, rank`) as (StreamBill & { state: string; session_id: number })[]
      const groups = new Map<string, StreamGroup>()
      for (const { state, session_id, ...bill } of rows) {
        const group = groups.get(state) ?? { state, session: Number(session_id), bills: [] }
        group.bills.push({ ...bill, bill_id: Number(bill.bill_id) })
        groups.set(state, group)
      }
      if (groups.size) return { groups: [...groups.values()], source: "database" }
    } catch (error) {
      console.error("stream: database unavailable, serving snapshot", error)
    }
  }
  const groups = SNAPSHOT.filter((g) => !states || states.includes(g.state)).map((g) => ({ ...g, bills: g.bills.slice(0, limit) }))
  return { groups, source: "snapshot" }
}
