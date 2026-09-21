import "server-only"

import { stateName } from "@/lib/filters"
import { q } from "@/lib/policy/db"
import { latestSession } from "@/lib/policy/db-queries"

// A jurisdiction's numbers (2026-09-13), for /state/[state]/charts and the
// studio: what the record holds about one legislature, session by session,
// drawn only from our own tables. Each query is 1–4 s on Aurora, so the page
// that reads this revalidates hourly rather than asking per view.
//
// The roster of every session is in the record (Brendan, 2026-09-13): the
// chamber is the district's prefix (SD-, HD-), never the role label alone —
// the source filed 31 New Jersey senators as Rep in 2026, and five other
// senates the same way, which is what made those rosters look short. The
// people table is LegiScan's people list with party, and who sat in a session
// is who sponsored in it — one query over Sponsors, ~4 s — and a seat is a
// district, so a member replaced mid-session does not count twice. (Adding roll-call
// voters changes the counts by a seat or two and costs 35 s, so it is left
// out; a nightly job writing SessionPeople for every session would be the
// real fix.) The seats chart for the current session still reads
// SessionPeople, LegiScan's own list.
//
// Status codes, as the record carries them (LegiScan's ladder):
//   1 introduced · 2 in committee / engrossed · 3 on the floor calendar ·
//   4 passed · 5 delivered to the governor · 6 signed / adopted ·
//   7 vetoed · 8 substituted · 9 failed / stricken

export type Series = { session: number; bills: number; resolutions: number; bills_passed: number; res_passed: number }
export type PartySeries = { session: number; party: string; bills: number; enacted: number }
export type Seat = { role: string; chamber: string; party: string; n: number }
export type Slice = { label: string; n: number }
export type CommitteeRow = { committee: string; bills: number }
export type CommitteeSeries = { session: number; committee: string; bills: number }
/** Who sat in a session, from the record itself: every person who sponsored in it, with their party — `n` people, `seats` distinct districts (a seat that changed hands mid-session counts once per party). */
export type RosterRow = { session: number; role: string; party: string; n: number; seats: number }

export type StateStats = {
  state: string
  name: string
  session: number
  sessions: Series[]
  sponsorship: PartySeries[]
  seats: Seat[]
  progress: Slice[]
  sponsors: Slice[]
  types: Slice[]
  committees: CommitteeRow[]
  committeeSeries: CommitteeSeries[]
  roster: RosterRow[]
}

const num = (v: unknown) => Number(v ?? 0) || 0

/** `wanted` is the session the one-session charts read — seats, progress, sponsors, types, committees (the charts page's Session menu, 2026-09-20); the latest without it. */
export async function getStateStats(state: string, wanted?: number): Promise<StateStats> {
  const code = state.toUpperCase()
  const session = wanted ?? (await latestSession(code))
  const [sessions, sponsorship, seats, statuses, types, bipartisan, committees, roster] = await Promise.all([
    q<Record<string, unknown>>(
      `select session_id, count(*) filter (where bill_type = 'B')::int bills,
              count(*) filter (where bill_type <> 'B' or bill_type is null)::int resolutions,
              count(*) filter (where bill_type = 'B' and status in (4,5,6))::int bills_passed,
              count(*) filter (where (bill_type <> 'B' or bill_type is null) and status in (4,5,6))::int res_passed
       from "Bills" where state = $1 group by 1 order by 1`,
      [code]
    ),
    q<Record<string, unknown>>(
      `select b.session_id, coalesce(p.party, '?') party, count(*)::int bills, count(*) filter (where b.status = 6)::int enacted
       from "Bills" b join "Sponsors" s on s.bill_id = b.bill_id and s.sponsor_type_id = 1 and s.position = 1
       join "People" p on p.people_id = s.people_id
       where b.state = $1 and b.bill_type = 'B' group by 1, 2 order by 1, 2`,
      [code]
    ),
    q<Record<string, unknown>>(
      `select case when p.district like 'SD-%' then 'Sen' when p.district like 'HD-%' then 'Rep' else p.role end role,
              case when p.district like 'SD-%' then 'Senate' when p.district like 'HD-%' then coalesce(nullif(p.chamber, 'Senate'), 'House') else coalesce(p.chamber, p.role) end chamber,
              coalesce(p.party, '?') party, count(*)::int n
       from "SessionPeople" sp join "People" p on p.people_id = sp.people_id
       where sp.state = $1 and sp.year = $2 and p.committee_id is null group by 1, 2, 3 order by 1, 3`,
      [code, session]
    ),
    q<Record<string, unknown>>(`select status, count(*)::int n from "Bills" where state = $1 and session_id = $2 and bill_type = 'B' group by 1`, [code, session]),
    q<Record<string, unknown>>(`select coalesce(bill_type, 'B') bill_type, count(*)::int n from "Bills" where state = $1 and session_id = $2 group by 1 order by 2 desc`, [code, session]),
    q<Record<string, unknown>>(
      `select count(*)::int n from (
         select b.bill_id from "Bills" b join "Sponsors" s on s.bill_id = b.bill_id join "People" p on p.people_id = s.people_id
         where b.state = $1 and b.session_id = $2 and b.bill_type = 'B'
         group by b.bill_id having count(distinct p.party) filter (where p.party in ('D','R')) > 1) x`,
      [code, session]
    ),
    q<Record<string, unknown>>(
      `select committee, count(*)::int bills from "Bills" where state = $1 and session_id = $2 and coalesce(committee, '') <> ''
       group by 1 order by 2 desc limit 12`,
      [code, session]
    ),
    q<Record<string, unknown>>(
      `select b.session_id, case when p.district like 'SD-%' then 'Sen' when p.district like 'HD-%' then 'Rep' else p.role end role,
              coalesce(p.party, '?') party, count(distinct s.people_id)::int n, count(distinct p.district)::int seats
       from "Bills" b join "Sponsors" s on s.bill_id = b.bill_id join "People" p on p.people_id = s.people_id
       where b.state = $1 and p.committee_id is null and p.role in ('Rep', 'Sen') group by 1, 2, 3 order by 1, 2, 3`,
      [code]
    ),
  ])

  const top = committees.slice(0, 8).map((r) => String(r.committee))
  const committeeSeries = top.length
    ? await q<Record<string, unknown>>(
        `select session_id, committee, count(*)::int bills from "Bills"
         where state = $1 and committee = any($2::text[]) group by 1, 2 order by 1, 2`,
        [code, top]
      )
    : []

  const byStatus = new Map(statuses.map((r) => [num(r.status), num(r.n)]))
  const sum = (...codes: number[]) => codes.reduce((t, c) => t + (byStatus.get(c) ?? 0), 0)
  const progress: Slice[] = [
    { label: "Pending", n: sum(1, 2, 3, 8) },
    { label: "Passed", n: sum(4, 5) },
    { label: "Signed / adopted", n: sum(6) },
    { label: "Vetoed", n: sum(7) },
    { label: "Failed", n: sum(9, 0) },
  ].filter((s) => s.n > 0)

  const current = sponsorship.filter((r) => num(r.session_id) === session)
  const bi = num(bipartisan[0]?.n)
  const partyName = (p: string) => (p === "D" ? "Democrat" : p === "R" ? "Republican" : p === "I" ? "Independent" : "Other")
  const sponsors: Slice[] = [
    ...current.filter((r) => String(r.party) !== "?").map((r) => ({ label: partyName(String(r.party)), n: Math.max(0, num(r.bills) - Math.round(bi * (num(r.bills) / Math.max(1, current.reduce((t, x) => t + num(x.bills), 0))))) })),
    ...(bi > 0 ? [{ label: "Bipartisan", n: bi }] : []),
  ].filter((s) => s.n > 0)

  const typeName = (t: string) => (t === "B" ? "Bill" : t === "R" ? "Resolution" : t === "CR" ? "Concurrent resolution" : t === "JR" ? "Joint resolution" : t)
  return {
    state: code,
    name: code === "US" ? "Congress" : stateName(code),
    session,
    sessions: sessions.map((r) => ({ session: num(r.session_id), bills: num(r.bills), resolutions: num(r.resolutions), bills_passed: num(r.bills_passed), res_passed: num(r.res_passed) })),
    sponsorship: sponsorship.map((r) => ({ session: num(r.session_id), party: String(r.party), bills: num(r.bills), enacted: num(r.enacted) })),
    seats: seats.map((r) => ({ role: String(r.role), chamber: String(r.chamber), party: String(r.party), n: num(r.n) })),
    progress,
    sponsors,
    types: types.map((r) => ({ label: typeName(String(r.bill_type)), n: num(r.n) })),
    committees: committees.map((r) => ({ committee: String(r.committee), bills: num(r.bills) })),
    committeeSeries: committeeSeries.map((r) => ({ session: num(r.session_id), committee: String(r.committee), bills: num(r.bills) })),
    roster: roster.map((r) => ({ session: num(r.session_id), role: String(r.role), party: String(r.party), n: num(r.n), seats: num(r.seats) })),
  }
}
