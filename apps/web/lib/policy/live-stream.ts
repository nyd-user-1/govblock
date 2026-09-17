import { q } from "@/lib/policy/db"

// /live (Brendan, 2026-09-15): every action and vote, Congress and the
// states, in the order they happened. Congress reads its own sources
// (congress.gov's actions, the House and Senate clerks' votes); the states
// read LegiScan's history and roll calls. The window is the last seven days
// that carry an event, not the last seven calendar days: the feeds land
// nightly and a recess or a stale feed would leave a calendar week empty.
// One statement, through the read cache, so a page open never reaches the
// cluster on its own.

export type LiveEvent = {
  kind: "action" | "vote"
  state: string
  date: string
  at: string | null
  chamber: string | null
  seq: number | null
  text: string
  bill_id: number | null
  bill_number: string | null
  /** The bill as its source prints it ("H.R. 9340"); Congress only. */
  bill_label?: string | null
  title: string | null
  yea: number | null
  nay: number | null
  /** The prime sponsor: congress.gov's for Congress, LegiScan's for a state. */
  sponsor: string | null
  sponsor_party: string | null
  sponsor_photo: string | null
  sponsor_bioguide: string | null
}

const LIVE_SQL = `with span as (
  select to_char(current_date - 60, 'YYYY-MM-DD') as since, to_char(current_date, 'YYYY-MM-DD') as until
),
congress_actions as (
  -- congress.gov repeats an action once per reporting system; keep one.
  select distinct on (coalesce(a.bill_id::text, a.bill_number), a.action_date, a.text) a.congress, a.bill_id, a.bill_number, a.action_date, a.action_time, a.source_system, a.sequence, a.text
  from congress_bill_actions a, span
  where a.action_date between span.since and span.until
  order by coalesce(a.bill_id::text, a.bill_number), a.action_date, a.text, a.sequence
),
ev as (
  select 'action' as kind, b.state, h.date, null::text as at, h.chamber, h.sequence::bigint as seq, trim(h.action) as text, b.bill_id, b.bill_number, left(b.title, 240) as title, null::int as yea, null::int as nay, null::bigint as sponsor_people_id, null::text as sponsor_name, null::text as sponsor_bioguide
  from "History Table" h join "Bills" b using (bill_id), span
  where b.state <> 'US' and h.date between span.since and span.until
  union all
  select 'vote', r.state, r.date, null, r.chamber, r.roll_call_id, trim(r.description), b.bill_id, b.bill_number, left(b.title, 240), r.yea::int, nullif(r.nay, '')::int, null, null, null
  from "Roll Call" r join "Bills" b using (bill_id), span
  where r.state <> 'US' and r.date between span.since and span.until
  union all
  select 'action', 'US', a.action_date, left(a.action_time, 5), case when a.source_system ilike 'Senate%' then 'Senate' when a.source_system ilike 'House%' then 'House' else b.body end, a.sequence, trim(a.text), a.bill_id, coalesce(b.bill_number, a.bill_number), left(coalesce(b.title, c.display_title), 240), null, null, c.sponsor_people_id, c.sponsor_name, c.sponsor_bioguide
  from congress_actions a left join "Bills" b using (bill_id) left join congress_bills c on c.congress = a.congress and c.bill_number = a.bill_number
  union all
  select 'vote', 'US', left(v.start_date, 10), substr(v.start_date, 12, 5), 'House', nullif(v.roll_call_number, '')::bigint, concat_ws(' · ', v.vote_question, v.result), c.bill_id, c.bill_number, left(c.display_title, 240), v.yea, v.nay, c.sponsor_people_id, c.sponsor_name, c.sponsor_bioguide
  from congress_house_votes v left join congress_bills c on c.congress = v.congress and upper(c.bill_type) = upper(v.legislation_type) and c.number = v.legislation_number, span
  where left(v.start_date, 10) between span.since and span.until
  union all
  select 'vote', 'US', to_char(v.vote_date, 'YYYY-MM-DD'), to_char(v.vote_date, 'HH24:MI'), 'Senate', nullif(v.roll_call_number, '')::bigint, concat_ws(' · ', coalesce(v.vote_question_text, v.question), v.vote_result), v.bill_id, c.bill_number, left(c.display_title, 240), v.yea, v.nay, c.sponsor_people_id, c.sponsor_name, c.sponsor_bioguide
  from congress_senate_votes v left join congress_bills c using (bill_id), span
  where to_char(v.vote_date, 'YYYY-MM-DD') between span.since and span.until
),
days as (select distinct date from ev order by date desc limit 7),
picked as (
  select ev.* from ev
  where ev.date in (select date from days)
  order by ev.date desc, ev.at desc nulls last, ev.seq desc
  limit 2000
)
select picked.kind, picked.state, picked.date, picked.at, picked.chamber, picked.seq, picked.text, picked.bill_id, picked.bill_number, picked.title, picked.yea, picked.nay,
  coalesce(p.name, picked.sponsor_name) as sponsor, p.party as sponsor_party, p.photo_url as sponsor_photo, coalesce(p.bioguide_id, picked.sponsor_bioguide) as sponsor_bioguide
from picked
left join lateral (
  select s.people_id from "Sponsors" s where s.bill_id = picked.bill_id and s.sponsor_type_id = 1 order by s.position limit 1
) sp on picked.sponsor_people_id is null
left join "People" p on p.people_id = coalesce(picked.sponsor_people_id, sp.people_id)
order by picked.date desc, picked.at desc nulls last, picked.seq desc`

/** The last seven days on file with an event, newest first. */
export async function getLiveStream(): Promise<LiveEvent[]> {
  const rows = await q<LiveEvent>(LIVE_SQL)
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v))
  return rows.map((r) => ({ ...r, seq: num(r.seq), bill_id: num(r.bill_id), yea: num(r.yea), nay: num(r.nay) }))
}
