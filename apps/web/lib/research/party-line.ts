import "server-only"

import { n, one, q } from "@/lib/policy/db"

// Research: how often a House roll call splits the parties (2026-09-14).
// A roll call splits the parties when a majority of voting Republicans and a
// majority of voting Democrats answer it opposite ways. Yea and Aye count as
// yes, Nay and No as no; Present and Not Voting are left out of both sides.
// Read from clerk.house.gov's votes as congress.gov publishes them.

export const PARTY_LINE_CONGRESS = 119

const TALLY = `
  select v.identifier, coalesce(v.vote_question, 'Other') question,
         count(*) filter (where p.vote_party = 'R' and p.vote_cast in ('Yea', 'Aye')) ry,
         count(*) filter (where p.vote_party = 'R' and p.vote_cast in ('Nay', 'No')) rn,
         count(*) filter (where p.vote_party = 'D' and p.vote_cast in ('Yea', 'Aye')) dy,
         count(*) filter (where p.vote_party = 'D' and p.vote_cast in ('Nay', 'No')) dn
    from congress_house_votes v
    join congress_house_vote_positions p on p.vote_identifier = v.identifier
   where v.congress = $1
   group by 1, 2`

const SPLIT = `((ry > rn and dn > dy) or (rn > ry and dy > dn))`

export type PartyLineStudy = {
  congress: number
  first: string | null
  last: string | null
  votes: number
  split: number
  splitNoCrossing: number
  bothYes: number
  byQuestion: { question: string; votes: number; split: number }[]
  crossers: { peopleId: number | null; name: string; party: string; state: string; crossed: number; cast: number }[]
}

export async function partyLineStudy(congress = PARTY_LINE_CONGRESS): Promise<PartyLineStudy> {
  const [totals, byQuestion, crossers] = await Promise.all([
    one<{ votes: number; split: number; split_no_crossing: number; both_yes: number; first: string | null; last: string | null }>(
      `with t as (${TALLY})
       select count(*)::int votes,
              count(*) filter (where ${SPLIT})::int split,
              count(*) filter (where (ry > rn and dn > dy and dy = 0 and rn = 0) or (rn > ry and dy > dn and ry = 0 and dn = 0))::int split_no_crossing,
              count(*) filter (where ry > rn and dy > dn)::int both_yes,
              (select left(min(start_date), 10) from congress_house_votes where congress = $1) first,
              (select left(max(start_date), 10) from congress_house_votes where congress = $1) last
         from t`,
      [congress]
    ),
    q<{ question: string; votes: number; split: number }>(
      `with t as (${TALLY})
       select question, count(*)::int votes, count(*) filter (where ${SPLIT})::int split
         from t group by 1 order by 2 desc limit 12`,
      [congress]
    ),
    // A member crosses on a split roll call when they vote with the other party's majority.
    q<{ people_id: number | null; name: string; party: string; state: string; crossed: number; cast: number }>(
      `with t as (${TALLY}),
            pl as (select identifier, ry > rn as r_yes from t where ${SPLIT})
       select p.people_id,
              coalesce(max(case when m.name like '%, %' then split_part(m.name, ', ', 2) || ' ' || split_part(m.name, ', ', 1) else m.name end), max(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')))) name,
              p.vote_party party, p.vote_state state,
              count(*) filter (where (p.vote_cast in ('Yea', 'Aye')) = (case when p.vote_party = 'R' then not pl.r_yes else pl.r_yes end)
                                 and p.vote_cast in ('Yea', 'Aye', 'Nay', 'No'))::int crossed,
              count(*) filter (where p.vote_cast in ('Yea', 'Aye', 'Nay', 'No'))::int cast
         from pl
         join congress_house_vote_positions p on p.vote_identifier = pl.identifier
         left join congress_members m on m.bioguide_id = p.bioguide_id
        where p.vote_party in ('R', 'D')
        group by p.people_id, p.bioguide_id, p.vote_party, p.vote_state
        order by 5 desc limit 15`,
      [congress]
    ),
  ])
  return {
    congress,
    first: totals?.first ?? null,
    last: totals?.last ?? null,
    votes: n(totals?.votes),
    split: n(totals?.split),
    splitNoCrossing: n(totals?.split_no_crossing),
    bothYes: n(totals?.both_yes),
    byQuestion: byQuestion.map((r) => ({ question: r.question, votes: n(r.votes), split: n(r.split) })),
    crossers: crossers.map((r) => ({ peopleId: r.people_id == null ? null : n(r.people_id), name: r.name, party: r.party, state: r.state, crossed: n(r.crossed), cast: n(r.cast) })),
  }
}
