import "server-only"

import { n, q } from "@/lib/policy/db"

import type { ChartSpec } from "./chart-spec"

// Where bills go to die (2026-09-18), research recipe report #4.
//
// 1. Question: in each state, how many bills never get a vote, which
//    committees hold them, and how much does the sponsor's party decide it?
// 2. Coverage: every bill (not resolution) of the sessions that began in 2023
//    in the 49 partisan legislatures (Nebraska and D.C. left out), with its
//    status, its first committee referral and every recorded roll call.
// 3–4. Classify: a bill *died without a vote* when the record holds no roll
//    call on it at all, committee or floor; it *passed* when its status is
//    passed or signed. The sponsor's side is the primary sponsor's party
//    against the chamber's majority after the 2022 election (Klarner).
// 5. Verify: Colorado's GAVEL amendment and North Dakota's every-bill-a-vote
//    rule against the states whose bills nearly all got votes.
// Gaps: omnibus states (Minnesota, Massachusetts) fold standalone bills into
//    omnibus bills, so a bill's death there is not its content's.

const SLUG = "where-bills-die"
const SCOPE = `b.state not in ('US','DC','NE') and b.session_title ~ '^2023' and b.bill_type = 'B'`

export async function billDeathsStudy() {
  const [states, committees, parties] = await Promise.all([
    q<{ state: string; bills: number; novote: number; passed: number }>(`
      select b.state, count(*)::int as bills,
             count(*) filter (where not exists (select 1 from "Roll Call" r where r.bill_id = b.bill_id))::int as novote,
             count(*) filter (where b.status in (4,6))::int as passed
        from "Bills" b where ${SCOPE} group by 1 order by 1`),
    q<{ state: string; chamber: string; name: string; referred: number; died: number }>(`
      with first as (select distinct on (bill_id) bill_id, name, chamber from "Referrals" order by bill_id, seq)
      select b.state, f.chamber, f.name, count(*)::int as referred,
             count(*) filter (where not exists (select 1 from "Roll Call" r where r.bill_id = b.bill_id))::int as died
        from "Bills" b join first f using (bill_id) where ${SCOPE} group by 1,2,3 having count(*) >= 100 order by 5 desc limit 25`),
    q<{ state: string; side: string; bills: number; passed: number }>(`
      with scope as (select bill_id, state, status from "Bills" b where ${SCOPE}),
      prim as (select distinct on (s.bill_id) s.bill_id, p.party, p.chamber from "Sponsors" s join scope using (bill_id) join "People" p on p.people_id = s.people_id
                where s.sponsor_type_id = 1 order by s.bill_id, s.position),
      maj as (select state, case when office = 'STATE SENATE' then 'Senate' else 'House' end as ch, case when dem_seats > rep_seats then 'D' else 'R' end as party
                from chamber_results where source = 'klarner' and year = 2022 and office in ('STATE HOUSE','STATE SENATE'))
      select s.state, case when pr.party = m.party then 'majority' else 'minority' end as side, count(*)::int as bills, count(*) filter (where s.status in (4,6))::int as passed
        from scope s join prim pr using (bill_id) join maj m on m.state = s.state and m.ch = (case when pr.chamber = 'Senate' then 'Senate' else 'House' end)
       where pr.party in ('D','R') group by 1,2`),
  ])

  const rows = states.map((s) => ({ state: s.state, bills: n(s.bills), novote: n(s.novote), passed: n(s.passed), share: n(s.bills) ? n(s.novote) / n(s.bills) : 0 }))
  const total = rows.reduce((a, r) => ({ bills: a.bills + r.bills, novote: a.novote + r.novote, passed: a.passed + r.passed }), { bills: 0, novote: 0, passed: 0 })
  const byShare = [...rows].sort((a, b) => b.share - a.share)

  const side = (state: string, which: string) => parties.find((p) => p.state === state && p.side === which)
  const gaps = [...new Set(parties.map((p) => p.state))]
    .map((state) => {
      const maj = side(state, "majority")
      const min = side(state, "minority")
      const majRate = maj && n(maj.bills) ? n(maj.passed) / n(maj.bills) : 0
      const minRate = min && n(min.bills) ? n(min.passed) / n(min.bills) : 0
      return { state, majBills: n(maj?.bills), majPassed: n(maj?.passed), minBills: n(min?.bills), minPassed: n(min?.passed), majRate, minRate }
    })
    // A state enters the comparison when both sides carried at least 100 bills with a named sponsor.
    .filter((g) => g.majBills >= 100 && g.minBills >= 100)
    .sort((a, b) => a.minRate - b.minRate)
  // For examples, a state where majority bills pass at least one time in ten, so the comparison is not with a legislature where individually sponsored bills barely pass at all.
  const comparable = gaps.filter((g) => g.majRate >= 0.1)
  const agg = parties.reduce(
    (a, p) => (gaps.some((g) => g.state === p.state) ? (p.side === "majority" ? { ...a, mb: a.mb + n(p.bills), mp: a.mp + n(p.passed) } : { ...a, nb: a.nb + n(p.bills), np: a.np + n(p.passed) }) : a),
    { mb: 0, mp: 0, nb: 0, np: 0 }
  )

  const charts: ChartSpec[] = [
    {
      id: "bills-no-vote",
      report: SLUG,
      kind: "bar",
      title: "Share of 2023 bills that never got a recorded vote: the eight highest and eight lowest states",
      source: "GovBlock's record of 2023 state bills and every roll call on them, committee or floor.",
      format: "pct",
      bars: [...byShare.slice(0, 8), ...byShare.slice(-8)].map((r, i) => ({ label: r.state, value: r.share, tone: i < 8 ? ("two" as const) : ("one" as const), note: `${r.novote.toLocaleString("en-US")} of ${r.bills.toLocaleString("en-US")} bills` })),
      legend: [
        { label: "Most bills without a vote", tone: "two" },
        { label: "Fewest", tone: "one" },
      ],
    },
    {
      id: "bills-party-gap",
      report: SLUG,
      kind: "bar",
      title: "Minority-party bills that passed, 2023: the ten lowest states",
      source: "Bills with an individual primary sponsor, in states where at least one majority bill in ten passed; the chamber's majority after the 2022 election.",
      format: "pct",
      bars: comparable.slice(0, 10).map((g) => ({ label: g.state, value: g.minRate, tone: "two" as const, note: `${g.minPassed} of ${g.minBills} · majority ${Math.round(g.majRate * 100)}%` })),
    },
  ]

  return {
    total,
    rows: byShare,
    committees: committees.map((c) => ({ state: c.state, chamber: c.chamber === "J" ? "Joint" : c.chamber, name: c.name, referred: n(c.referred), died: n(c.died) })),
    gaps,
    comparable,
    agg: { majRate: agg.mb ? agg.mp / agg.mb : 0, minRate: agg.nb ? agg.np / agg.nb : 0, majBills: agg.mb, minBills: agg.nb },
    charts,
  }
}
