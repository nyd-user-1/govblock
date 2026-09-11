import { hasDatabase, n, q } from "@/lib/policy/db"
import { latestSession } from "@/lib/policy/db-queries"

// One jurisdiction's desk (Brendan, 2026-09-11): what its legislature did,
// by stage, read live from the Progress table rather than from the hourly
// view's fourteen-day windows — so no stage is ever empty while the session
// has a bill in it, and the page is as fresh as the loader that fills the
// tables. Five to a stage, newest first; the stages are LegiScan's progress
// events, in the order a bill meets them.

export type DeskBill = {
  bill_id: number
  bill_number: string
  title: string
  status_desc: string | null
  last_action: string | null
  last_action_date: string | null
  committee: string | null
  body: string | null
  sponsor: string | null
  /** The day the stage was reached. */
  event_date: string | null
}

export type DeskRollCall = { roll_call_id: number; date: string; chamber: string | null; description: string; yea: number; nay: number; bill_id: number; bill_number: string; title: string }

export type DeskStage = "recent" | "committee" | "floor" | "engrossed" | "governor" | "signed"

export type Desk = { state: string; session: number; lead: DeskBill | null; stages: Record<DeskStage, DeskBill[]>; rollCalls: DeskRollCall[] }

export const STAGES: { key: DeskStage; title: string; events: string[] }[] = [
  { key: "recent", title: "Recent Bills", events: ["Introduced"] },
  { key: "committee", title: "In Committee", events: ["Referred to committee"] },
  { key: "floor", title: "On the Floor", events: ["Reported: do pass"] },
  { key: "engrossed", title: "Engrossed", events: ["Engrossed"] },
  { key: "governor", title: "Sent to the Governor", events: ["Enrolled"] },
  { key: "signed", title: "Signed or Vetoed", events: ["Chaptered", "Vetoed"] },
]

const EMPTY: Record<DeskStage, DeskBill[]> = { recent: [], committee: [], floor: [], engrossed: [], governor: [], signed: [] }

export async function getDesk(state: string, limit = 5): Promise<Desk | null> {
  if (!hasDatabase()) return null
  try {
    const session = await latestSession(state)
    if (!session) return null
    const cases = STAGES.map((s) => `when pg.event = any($${4}::text[]) and ${s.key === "signed" ? "pg.event in ('Chaptered','Vetoed')" : `pg.event = '${s.events[0]}'`} then '${s.key}'`).join(" ")
    const events = STAGES.flatMap((s) => s.events)
    const rows = await q<DeskBill & { stage: DeskStage }>(
      `select t.bill_id, t.bill_number, t.title, t.status_desc, t.last_action, t.last_action_date, t.committee, t.body, t.event_date, t.stage,
              (select p.name from "Sponsors" s join "People" p using (people_id) where s.bill_id = t.bill_id and s.sponsor_type_id = 1 order by s.position limit 1) as sponsor
         from (
           select b.bill_id, b.bill_number, b.title, b.status_desc, b.last_action, b.last_action_date, b.committee, b.body, pg.date::text as event_date,
                  case ${cases} end as stage,
                  row_number() over (partition by (case ${cases} end) order by pg.date desc, b.bill_id desc) as rn
             from "Progress" pg join "Bills" b using (bill_id)
            where b.state = $1 and b.session_id = $2 and pg.event = any($4::text[])
         ) t
        where t.rn <= $3
        order by t.stage, t.rn`,
      [state, session, limit, events]
    )
    const stages: Record<DeskStage, DeskBill[]> = { recent: [], committee: [], floor: [], engrossed: [], governor: [], signed: [] }
    for (const { stage, ...bill } of rows) stages[stage]?.push({ ...bill, bill_id: n(bill.bill_id) })
    const rollCalls = (
      await q<DeskRollCall>(
        `select r.roll_call_id, r.date::text as date, r.chamber, r.description, r.yea::int as yea, coalesce(nullif(r.nay, '')::int, 0) as nay,
                b.bill_id, b.bill_number, b.title
           from "Roll Call" r join "Bills" b using (bill_id)
          where b.state = $1 and b.session_id = $2
          order by r.date desc, r.roll_call_id desc limit $3`,
        [state, session, limit]
      )
    ).map((r) => ({ ...r, roll_call_id: n(r.roll_call_id), bill_id: n(r.bill_id) }))
    const lead = stages.signed[0] ?? stages.governor[0] ?? stages.engrossed[0] ?? stages.floor[0] ?? stages.committee[0] ?? stages.recent[0] ?? null
    return { state, session, lead, stages, rollCalls }
  } catch (error) {
    console.error("desk: database unavailable", error)
    return { state, session: 0, lead: null, stages: EMPTY, rollCalls: [] }
  }
}
