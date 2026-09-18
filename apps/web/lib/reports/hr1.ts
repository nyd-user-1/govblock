import "server-only"

import { n, one, q } from "@/lib/policy/db"

import { partyTone, type ChartSpec } from "./chart-spec"

// H.R. 1 of the 119th Congress, followed across the record (2026-09-17): the
// bill from congress.gov, the lobbying disclosures that named it, the House's
// and the Senate's roll calls on it, and the FEC's independent expenditures
// in the cycle after. The lobbying is counted in filings and clients, never in
// dollars: a filing reports its spending across every bill it names, so none
// of it can be laid on one bill.

const SLUG = "hr1-trace"
const KEY = "119-HR-1"

const QUARTER: Record<string, string> = { first_quarter: "Q1", second_quarter: "Q2", third_quarter: "Q3", fourth_quarter: "Q4", mid_year: "H1", year_end: "H2" }

export async function hr1Study() {
  const [bill, house, senate, senateDays, quarters, clients, lobbyTotals, dissent, massie, opposedHouseR] = await Promise.all([
    one<{ popular_title: string; display_title: string; introduced_date: string; latest_action_date: string; latest_action: string; sponsor_name: string; policy_area: string }>(
      `select popular_title, display_title, introduced_date, latest_action_date, latest_action, sponsor_name, policy_area from congress_bills where key = $1`,
      [KEY]
    ),
    q<{ roll: string; date: string; question: string; result: string; yea: number; nay: number; not_voting: number; present: number }>(`
      select roll_call_number as roll, left(start_date, 10) as date, vote_question as question, result, yea, nay, not_voting, present
        from congress_house_votes where congress = 119 and legislation_type = 'HR' and legislation_number = '1' order by start_date`),
    q<{ roll: number; date: string; question: string; result: string; yea: number; nay: number; tie_breaker: string | null }>(`
      select roll_call_number::int as roll, to_char(vote_date, 'YYYY-MM-DD') as date, question, vote_result as result, yea, nay, tie_breaker
        from congress_senate_votes where congress_key = $1 and (question ilike '%passage%') order by vote_date`,
      [KEY]
    ),
    q<{ day: string; votes: number; agreed: number }>(`
      select to_char(vote_date, 'YYYY-MM-DD') as day, count(*)::int as votes, count(*) filter (where vote_result ilike '%agreed%' or vote_result ilike '%passed%')::int as agreed
        from congress_senate_votes where congress_key = $1 group by 1 order by 1`,
      [KEY]
    ),
    q<{ year: number; period: string; filings: number; clients: number; firms: number }>(`
      select f.filing_year as year, f.filing_period as period, count(distinct f.filing_uuid)::int as filings, count(distinct f.client_name)::int as clients, count(distinct f.registrant_name)::int as firms
        from (select distinct filing_uuid from "LobbyingBills" where congress_key = $1) lb join "LobbyingFilings" f using (filing_uuid) group by 1,2`,
      [KEY]
    ),
    q<{ client: string; filings: number; firms: number }>(`
      select f.client_name as client, count(distinct f.filing_uuid)::int as filings, count(distinct f.registrant_name)::int as firms
        from (select distinct filing_uuid from "LobbyingBills" where congress_key = $1) lb join "LobbyingFilings" f using (filing_uuid) group by 1 order by 2 desc, 3 desc limit 10`,
      [KEY]
    ),
    one<{ filings: number; clients: number; firms: number; next_filings: number; next_key: string }>(`
      with bills as (select congress_key, count(distinct filing_uuid) as filings from "LobbyingBills" where congress_key like '119-%' group by 1),
           ranked as (select congress_key, filings, row_number() over (order by filings desc) r from bills)
      select (select count(distinct f.filing_uuid) from (select distinct filing_uuid from "LobbyingBills" where congress_key = $1) lb join "LobbyingFilings" f using (filing_uuid))::int as filings,
             (select count(distinct f.client_name) from (select distinct filing_uuid from "LobbyingBills" where congress_key = $1) lb join "LobbyingFilings" f using (filing_uuid))::int as clients,
             (select count(distinct f.registrant_name) from (select distinct filing_uuid from "LobbyingBills" where congress_key = $1) lb join "LobbyingFilings" f using (filing_uuid))::int as firms,
             (select filings from ranked where r = 2)::int as next_filings, (select congress_key from ranked where r = 2) next_key`,
      [KEY]
    ),
    q<{ roll: string; people_id: number; name: string; state: string; cast: string }>(`
      select v.roll_call_number as roll, p.people_id, p.first_name || ' ' || p.last_name as name, p.vote_state as state, p.vote_cast as cast
        from congress_house_vote_positions p join congress_house_votes v on v.identifier = p.vote_identifier
       where v.congress = 119 and v.legislation_type = 'HR' and v.legislation_number = '1' and v.roll_call_number in ('145','190')
         and p.vote_party = 'R' and p.vote_cast not in ('Yea','Aye') order by v.roll_call_number, p.last_name`),
    q<{ cycle: number; receipts: number; unitemized: number }>(`
      select cycle, receipts::float as receipts, individual_unitemized_contributions::float as unitemized from "FecTotals" t join "People" p using (people_id)
       where p.bioguide_id = 'M001184' and cycle in (2024, 2026) order by cycle`),
    q<{ people_id: number; name: string; party: string; district: string; oppose: number }>(`
      select p.people_id, p.name, p.party, p.district, sum(i.total)::float as oppose from "FecIndependentExpenditures" i join "People" p using (people_id)
       where i.cycle = 2026 and i.support_oppose = 'O' and p.role = 'Rep' and p.party = 'R' group by 1,2,3,4 order by 5 desc limit 8`),
  ])

  const massieOpposed = await q<{ committee: string; total: number }>(`
    select committee_name as committee, sum(total)::float as total from "FecIndependentExpenditures" i join "People" p using (people_id)
     where p.bioguide_id = 'M001184' and i.cycle = 2026 and i.support_oppose = 'O' group by 1 order by 2 desc`)

  const periods = quarters
    .map((r) => ({ label: `${n(r.year)} ${QUARTER[r.period] ?? r.period}`, sort: `${r.year}-${r.period === "first_quarter" ? 1 : r.period === "second_quarter" ? 2 : r.period === "third_quarter" ? 3 : 4}`, filings: n(r.filings), clients: n(r.clients), firms: n(r.firms) }))
    .sort((a, b) => a.sort.localeCompare(b.sort))
  const peak = periods.reduce((m, p) => (p.filings > m.filings ? p : m), periods[0] ?? { label: "", sort: "", filings: 0, clients: 0, firms: 0 })
  const seat = (d: string) => d.replace(/^HD-/, "")

  const charts: ChartSpec[] = [
    {
      id: "hr1-lobbying",
      report: SLUG,
      kind: "columns",
      title: "Lobbying filings that named H.R. 1, by quarter",
      source: "Senate Lobbying Disclosure Act filings; each filing counted once however often it names the bill.",
      format: "int",
      columns: periods.map((p) => ({ label: p.label, value: p.filings, highlight: p.label === "2025 Q2", note: `${p.clients.toLocaleString("en-US")} clients · ${p.firms.toLocaleString("en-US")} firms` })),
      highlightLabel: "The quarter it passed",
    },
    {
      id: "hr1-outside-money",
      report: SLUG,
      kind: "bar",
      title: "Outside spending against House Republicans, 2026 cycle",
      source: "FEC independent expenditures marked \"oppose\", through the latest filings.",
      format: "money",
      bars: opposedHouseR.map((m) => ({ label: `${m.name} (${seat(m.district)})`, value: n(m.oppose), tone: m.name === "Thomas Massie" ? "two" : partyTone(m.party) })),
      legend: [
        { label: "Voted no on H.R. 1", tone: "two" },
        { label: "Other House Republicans", tone: "r" },
      ],
    },
  ]

  return {
    bill,
    house: house.map((h) => ({ ...h, yea: n(h.yea), nay: n(h.nay), notVoting: n(h.not_voting), present: n(h.present) })),
    senate: senate.map((s) => ({ ...s, roll: n(s.roll), yea: n(s.yea), nay: n(s.nay) })),
    senateDays: senateDays.map((d) => ({ day: d.day, votes: n(d.votes), agreed: n(d.agreed) })),
    senateVotes: senateDays.reduce((a, d) => a + n(d.votes), 0),
    periods,
    peak,
    clients: clients.map((c) => ({ client: c.client, filings: n(c.filings), firms: n(c.firms) })),
    lobbying: { filings: n(lobbyTotals?.filings), clients: n(lobbyTotals?.clients), firms: n(lobbyTotals?.firms), nextFilings: n(lobbyTotals?.next_filings), nextKey: lobbyTotals?.next_key ?? "" },
    dissent: dissent.map((d) => ({ roll: d.roll, peopleId: n(d.people_id), name: d.name, state: d.state, cast: d.cast })),
    massie: {
      receipts2024: n(massie.find((m) => n(m.cycle) === 2024)?.receipts),
      receipts2026: n(massie.find((m) => n(m.cycle) === 2026)?.receipts),
      small2024: n(massie.find((m) => n(m.cycle) === 2024)?.unitemized),
      small2026: n(massie.find((m) => n(m.cycle) === 2026)?.unitemized),
      opposed: massieOpposed.map((m) => ({ committee: m.committee, total: n(m.total) })),
      rank: opposedHouseR.findIndex((m) => m.name === "Thomas Massie") + 1,
    },
    opposedHouseR: opposedHouseR.map((m) => ({ name: m.name, district: seat(m.district), oppose: n(m.oppose) })),
    charts,
  }
}
