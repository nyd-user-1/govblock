// Roll-call votes, both chambers, in one shape.
//
// The two sources do not resemble each other. The House's come from
// congress.gov's vote API into `congress_house_votes` — a numeric identifier,
// `legislation_type`/`legislation_number` in congress.gov's own spelling, and a
// party-total payload. The Senate publishes no API at all, so
// `congress_senate_votes` is loaded from senate.gov's XML
// (scripts/senate-votes/load.mjs) and names its measure the Senate's way,
// PN373 as readily as H.R. 1.
//
// Everything below hands back the same row either way — chamber, congress,
// session, roll number, question, result, tally, and the bill it was on cited
// the way congress.gov cites it — so the pages read one thing.
//
// See docs/federal-sources.md.

import "server-only"

import { citationOf } from "@/lib/policy/congress"
import { n, one, q } from "@/lib/policy/db"

export type Chamber = "house" | "senate"

export const CHAMBERS: Chamber[] = ["house", "senate"]
export const chamberName = (chamber: string) => (chamber === "senate" ? "Senate" : "House")

/** "house-119-1" — the URL a session sits at, and the only thing parsed from it. */
export function parseSessionSlug(slug: string) {
  const m = /^(house|senate)-(\d+)-(\d+)$/.exec(String(slug ?? "").toLowerCase())
  return m ? { chamber: m[1] as Chamber, congress: Number(m[2]), session: Number(m[3]) } : null
}
export const sessionSlug = (chamber: string, congress: number | string, session: number | string) => `${chamber}-${congress}-${session}`

/** "1st session", as congress.gov names it. */
export const sessionName = (session: number | string) => {
  const s = Number(session)
  return `${s}${s === 1 ? "st" : s === 2 ? "nd" : s === 3 ? "rd" : "th"} session`
}

export type RollCallSession = {
  chamber: Chamber
  congress: number
  session: number
  votes: number
  on_bills: number
  positions: number
  first_date: string | null
  last_date: string | null
  first_roll: number
  last_roll: number
}

export type RollCallRow = {
  chamber: Chamber
  congress: number
  session: number
  roll: number
  question: string | null
  description: string | null
  result: string | null
  date: string | null
  yea: number | null
  nay: number | null
  present: number | null
  not_voting: number | null
  positions: number | null
  legislation_type: string | null
  legislation_number: string | null
  citation: string | null
  congress_key: string | null
  bill_id: number | null
}

export type RollCallPosition = {
  people_id: number | null
  bioguide_id: string | null
  name: string
  party: string | null
  state: string | null
  vote_cast: string | null
}

/** The row shape both tables are read into, so one mapper serves them. */
type RawVote = {
  congress: number
  session_number: string
  roll_call_number: string
  question: string | null
  description: string | null
  result: string | null
  date: string | null
  yea: number | null
  nay: number | null
  present: number | null
  not_voting: number | null
  positions: number | null
  legislation_type: string | null
  legislation_number: string | null
  congress_key: string | null
  bill_id: number | null
}

const HOUSE_COLUMNS = `congress, session_number, roll_call_number,
  vote_question question, null::text description, result, start_date date,
  yea, nay, present, not_voting, positions,
  legislation_type, legislation_number,
  case when legislation_type is not null and legislation_number is not null
       then congress || '-' || legislation_type || '-' || legislation_number end congress_key,
  null::bigint bill_id`

// The Senate counts an absence rather than a non-vote, and files a nomination
// under the same column a bill sits in — the loader leaves legislation_type
// null for PN373, so a nomination never becomes a citation.
const SENATE_COLUMNS = `congress, session_number, roll_call_number,
  question, coalesce(vote_title, vote_document_text) description, vote_result result,
  to_char(vote_date, 'YYYY-MM-DD"T"HH24:MI:SSOF') date,
  yea, nay, present, absent not_voting, positions,
  legislation_type, legislation_number, congress_key, bill_id`

function row(chamber: Chamber, raw: RawVote): RollCallRow {
  return {
    chamber,
    congress: n(raw.congress),
    session: Number(raw.session_number),
    roll: Number(raw.roll_call_number),
    question: raw.question,
    description: raw.description,
    result: raw.result,
    date: raw.date,
    yea: raw.yea == null ? null : n(raw.yea),
    nay: raw.nay == null ? null : n(raw.nay),
    present: raw.present == null ? null : n(raw.present),
    not_voting: raw.not_voting == null ? null : n(raw.not_voting),
    positions: raw.positions == null ? null : n(raw.positions),
    legislation_type: raw.legislation_type,
    legislation_number: raw.legislation_number,
    citation: citationOf(raw.legislation_type, raw.legislation_number),
    congress_key: raw.congress_key,
    bill_id: raw.bill_id == null ? null : n(raw.bill_id),
  }
}

/** Every session either chamber has roll calls for, newest first. */
export async function getRollCallSessions(): Promise<RollCallSession[]> {
  const [house, senate] = await Promise.all([
    q<Omit<RollCallSession, "chamber">>(
      `select congress, session_number::int session, count(*)::int votes,
              count(*) filter (where legislation_number is not null)::int on_bills,
              coalesce(sum(positions), 0)::int positions,
              left(min(start_date), 10) first_date, left(max(start_date), 10) last_date,
              min(roll_call_number::int)::int first_roll, max(roll_call_number::int)::int last_roll
         from congress_house_votes group by 1, 2`
    ),
    q<Omit<RollCallSession, "chamber">>(
      `select congress, session_number::int session, count(*)::int votes,
              count(congress_key)::int on_bills,
              coalesce(sum(positions), 0)::int positions,
              to_char(min(vote_date), 'YYYY-MM-DD') first_date, to_char(max(vote_date), 'YYYY-MM-DD') last_date,
              min(roll_call_number::int)::int first_roll, max(roll_call_number::int)::int last_roll
         from congress_senate_votes group by 1, 2`
    ),
  ])
  const rows = [
    ...house.map((r) => ({ ...r, chamber: "house" as const })),
    ...senate.map((r) => ({ ...r, chamber: "senate" as const })),
  ].map((r) => ({ ...r, congress: n(r.congress), session: n(r.session), votes: n(r.votes), on_bills: n(r.on_bills), positions: n(r.positions), first_roll: n(r.first_roll), last_roll: n(r.last_roll) }))
  return rows.sort((a, b) => b.congress - a.congress || b.session - a.session || a.chamber.localeCompare(b.chamber))
}

/** One session's roll calls, newest first, paged. */
export async function getRollCalls(chamber: Chamber, congress: number, session: number, limit = 60, offset = 0) {
  const senate = chamber === "senate"
  const table = senate ? "congress_senate_votes" : "congress_house_votes"
  const order = senate ? "vote_date desc nulls last" : "start_date desc nulls last"
  const [rows, count] = await Promise.all([
    q<RawVote>(
      `select ${senate ? SENATE_COLUMNS : HOUSE_COLUMNS} from ${table}
        where congress = $1 and session_number = $2
        order by ${order}, roll_call_number::int desc limit $3 offset $4`,
      [congress, String(session), limit, offset]
    ),
    one<{ total: number }>(`select count(*)::int total from ${table} where congress = $1 and session_number = $2`, [congress, String(session)]),
  ])
  return { rows: rows.map((r) => row(chamber, r)), total: n(count?.total) }
}

const AYES = ["Yea", "Aye", "Yes", "Guilty"]

/** One roll call, and every member's position on it. */
export async function getRollCallVote(chamber: Chamber, congress: number, session: number, roll: number) {
  const senate = chamber === "senate"
  const table = senate ? "congress_senate_votes" : "congress_house_votes"
  const raw = await one<RawVote & { key: string }>(
    `select key, ${senate ? SENATE_COLUMNS : HOUSE_COLUMNS} from ${table}
      where congress = $1 and session_number = $2 and roll_call_number::int = $3`,
    [congress, String(session), roll]
  )
  if (!raw) return null
  const positions = senate
    ? await q<RollCallPosition>(
        `select people_id, bioguide_id,
                coalesce(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), member_full) name,
                vote_party party, vote_state state, vote_cast
           from congress_senate_vote_positions where vote_key = $1
          order by last_name, first_name`,
        [raw.key]
      )
    : await q<RollCallPosition>(
        `select people_id, bioguide_id,
                trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) name,
                vote_party party, vote_state state, vote_cast
           from congress_house_vote_positions where vote_identifier = $1
          order by last_name, first_name`,
        [raw.key]
      )
  // The tally by party, counted from the positions rather than trusted to a
  // payload: the two chambers publish it in two different shapes, and one of
  // them does not publish it at all.
  const parties = new Map<string, Map<string, number>>()
  for (const p of positions) {
    const party = p.party ?? "—"
    const cast = p.vote_cast ?? "—"
    const held = parties.get(party) ?? new Map<string, number>()
    held.set(cast, (held.get(cast) ?? 0) + 1)
    parties.set(party, held)
  }
  const casts = [...new Set(positions.map((p) => p.vote_cast ?? "—"))].sort(
    (a, b) => (AYES.includes(b) ? 1 : 0) - (AYES.includes(a) ? 1 : 0) || a.localeCompare(b)
  )
  return {
    vote: row(chamber, raw),
    positions: positions.map((p) => ({ ...p, people_id: p.people_id == null ? null : n(p.people_id) })),
    casts,
    byParty: [...parties.entries()]
      .map(([party, counts]) => ({ party, counts: Object.fromEntries(counts) as Record<string, number> }))
      .sort((a, b) => a.party.localeCompare(b.party)),
  }
}

/** Roll calls on one bill, both chambers, newest first. */
export async function getBillRollCalls(billId: number | null, key: string | null) {
  if (!billId && !key) return []
  const [house, senate] = await Promise.all([
    key
      ? q<RawVote>(
          `select ${HOUSE_COLUMNS} from congress_house_votes
            where legislation_type is not null
              and congress || '-' || legislation_type || '-' || legislation_number = $1
            order by start_date desc`,
          [key]
        )
      : Promise.resolve([] as RawVote[]),
    q<RawVote>(
      `select ${SENATE_COLUMNS} from congress_senate_votes
        where ($1::text is not null and congress_key = $1) or ($2::bigint is not null and bill_id = $2)
        order by vote_date desc`,
      [key, billId]
    ),
  ])
  return [...house.map((r) => row("house", r)), ...senate.map((r) => row("senate", r))].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
}
