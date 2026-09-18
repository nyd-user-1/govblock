import "server-only"

import { n, one, q } from "@/lib/policy/db"

import { partyTone, type ChartSpec } from "./chart-spec"

// What did the crypto industry's super PAC money buy? (2026-09-18), built by
// the research recipe (docs/research/recipe.md). Its stages, as data:
//
// 1. Question: did the members the crypto super PACs backed vote for the
//    industry's bills more often than members they did not back?
// 2. Coverage: the FEC's independent expenditures by Fairshake, Defend American
//    Jobs and Protect Progress on members of Congress in the record, 2024 and
//    2026 cycles; both chambers' roll calls on the GENIUS Act (S. 1582), the
//    CLARITY Act (H.R. 3633) and the Anti-CBDC bill (H.R. 1919); lobbying
//    disclosures whose descriptions name the crypto bills. Gap: the PACs'
//    spending on candidates who are not members (Katie Porter's Senate
//    primary, say) is not in the table.
// 3. Gather: the queries below.
// 4. Read and classify: members by backing (CODEBOOK.members), lobbying
//    clients by who they are (CODEBOOK.clients), filings by what their
//    description names (NAMED).
// 5. Verify: the roll calls are the House Clerk's and the Senate's own; the
//    PAC amounts are the FEC's filings; each outside figure is cited in the
//    page's Method.
// 6. Outside: Fairshake's own totals and donors (FactCheck.org, OpenSecrets,
//    CNBC), cited on the page.

const SLUG = "crypto-money"
const PACS = `committee_name in ('FAIRSHAKE','DEFEND AMERICAN JOBS','PROTECT PROGRESS')`

// The industry's bills, by their roll calls.
const HOUSE = { clarity: "11912025199", genius: "11912025200", cbdc: "11912025201" } as const
const SENATE = { firstCloture: "119-1-240", secondCloture: "119-1-262", passage: "119-1-318" } as const

// A filing counts when its description names one of the bills, or stablecoins
// or digital-asset market structure by name.
const NAMED = `'GENIUS|CLARITY|STABLE Act|stablecoin|market structure|S\\. ?394|S\\. ?919|S\\. ?1582|H\\.R\\. ?3633|H\\.R\\. ?2392|H\\.R\\. ?1919|Anti-CBDC|digital asset market'`

export const CODEBOOK = {
  members: [
    { key: "backed", rule: "The PACs filed independent expenditures supporting the member in 2024 or 2026." },
    { key: "opposed", rule: "The PACs filed expenditures opposing the member and none supporting." },
    { key: "none", rule: "No filings for or against the member." },
  ],
  // Order matters: the first rule a client name matches decides its class.
  clients: [
    { key: "Crypto companies and groups", rx: "coinbase|tether|circle|ripple|paradigm|filecoin|defi|decentraliz|solana|blockchain|crypto|digital currency|mysten|exodus|a16z|andreessen|anchorage|anchor labs|ava labs|unicoin|metrika|smartcontract|digital chamber|kraken|gemini|chainalysis|uniswap|consensys|galaxy digital|bitcoin|ethereum|stellar|polygon|fireblocks|bitgo|paxos|grayscale" },
    { key: "Banks and credit unions", rx: "bank|bancorp|bankers|credit union|jpmorgan|citigroup|wells fargo|goldman|morgan stanley|barclays|ubs |bnp|standard chartered|keycorp|capital one|clearing house|financial services forum|bank policy" },
    { key: "Payments", rx: "visa|mastercard|paypal|stripe|block inc|american express|electronic payments|payment" },
    { key: "Exchanges, brokers and asset managers", rx: "nasdaq|cme group|cboe|iex group|members exchange|options clearing|blackrock|vanguard|fmr llc|fidelity|managed funds|investment company|securities industry|lmax|robinhood|citadel|schwab" },
  ],
}

const classify = CODEBOOK.clients.map((c, i) => `when client_name ~* '${c.rx}' then ${i}`).join(" ")

export async function cryptoStudy() {
  const [spending, backing, houseSplit, senateDems, members, quarters, classes, topClients, clarity] = await Promise.all([
    q<{ cycle: number; so: string; committee: string; total: number; members: number }>(`
      select cycle, support_oppose as so, committee_name as committee, sum(total)::float as total, count(distinct people_id)::int as members
        from "FecIndependentExpenditures" where ${PACS} group by 1,2,3 order by 1,3,2`),
    q<{ people_id: number; name: string; party: string; district: string; role: string; support24: number; support26: number; oppose: number }>(`
      select p.people_id, p.name, p.party, p.district, p.role,
             coalesce(sum(i.total) filter (where i.support_oppose = 'S' and i.cycle = 2024), 0)::float as support24,
             coalesce(sum(i.total) filter (where i.support_oppose = 'S' and i.cycle = 2026), 0)::float as support26,
             coalesce(sum(i.total) filter (where i.support_oppose = 'O'), 0)::float as oppose
        from "FecIndependentExpenditures" i join "People" p using (people_id) where ${PACS} group by 1,2,3,4,5`),
    q<{ vote: string; party: string; grp: string; yes: number; no: number }>(`
      with backed as (select distinct people_id from "FecIndependentExpenditures" where ${PACS} and support_oppose = 'S'),
           opposed as (select distinct people_id from "FecIndependentExpenditures" where ${PACS} and support_oppose = 'O')
      select p.vote_identifier as vote, p.vote_party as party,
             case when b.people_id is not null then 'backed' when o.people_id is not null then 'opposed' else 'none' end as grp,
             count(*) filter (where p.vote_cast in ('Yea','Aye'))::int as yes, count(*) filter (where p.vote_cast in ('Nay','No'))::int as no
        from congress_house_vote_positions p left join backed b on b.people_id = p.people_id left join opposed o on o.people_id = p.people_id
       where p.vote_identifier in ('${HOUSE.clarity}','${HOUSE.genius}','${HOUSE.cbdc}') group by 1,2,3`),
    q<{ people_id: number; name: string; state: string; first: string | null; second: string | null; passage: string | null; backed: boolean }>(`
      select max(p.people_id) as people_id, p.first_name || ' ' || p.last_name as name, p.vote_state as state,
             max(case when p.vote_key = '${SENATE.firstCloture}' then p.vote_cast end) as first,
             max(case when p.vote_key = '${SENATE.secondCloture}' then p.vote_cast end) as second,
             max(case when p.vote_key = '${SENATE.passage}' then p.vote_cast end) as passage,
             bool_or(exists (select 1 from "FecIndependentExpenditures" i where i.people_id = p.people_id and ${PACS} and i.support_oppose = 'S')) as backed
        from congress_senate_vote_positions p where p.vote_key in ('${SENATE.firstCloture}','${SENATE.secondCloture}','${SENATE.passage}') and p.vote_party in ('D','I')
       group by 2,3 order by 2`),
    q<{ people_id: number; clarity: string | null; genius: string | null; senate: string | null }>(`
      select people_id,
             max(case when src = 'h' and vote = '${HOUSE.clarity}' then cast_ end) as clarity,
             max(case when src = 'h' and vote = '${HOUSE.genius}' then cast_ end) as genius,
             max(case when src = 's' then cast_ end) as senate
        from (select 'h' as src, vote_identifier as vote, people_id, vote_cast as cast_ from congress_house_vote_positions where vote_identifier in ('${HOUSE.clarity}','${HOUSE.genius}')
              union all select 's', vote_key, people_id, vote_cast from congress_senate_vote_positions where vote_key = '${SENATE.passage}') v
       where people_id in (select people_id from "FecIndependentExpenditures" where ${PACS}) group by 1`),
    q<{ year: number; period: string; filings: number; clients: number }>(`
      with la as (select distinct filing_uuid from "LobbyingActivities" where description ~* ${NAMED})
      select f.filing_year as year, f.filing_period as period, count(distinct f.filing_uuid)::int as filings, count(distinct f.client_name)::int as clients
        from la join "LobbyingFilings" f using (filing_uuid) where f.filing_year >= 2023 group by 1,2`),
    q<{ cls: number; clients: number; reports: number; dollars: number }>(`
      with la as (select distinct filing_uuid from "LobbyingActivities" where description ~* ${NAMED}),
      f as (select distinct on (f.registrant_id, f.client_id, f.filing_year, f.filing_period) f.*, coalesce(f.income,0) + coalesce(f.expenses,0) as amt
              from la join "LobbyingFilings" f using (filing_uuid) where f.filing_year >= 2025
             order by f.registrant_id, f.client_id, f.filing_year, f.filing_period, (f.filing_type like '%A') desc, f.dt_posted desc)
      select case ${classify} else ${CODEBOOK.clients.length} end as cls, count(distinct client_name)::int as clients, count(*)::int as reports, sum(amt)::float as dollars from f group by 1`),
    q<{ client: string; cls: number; reports: number; dollars: number }>(`
      with la as (select distinct filing_uuid from "LobbyingActivities" where description ~* ${NAMED}),
      f as (select distinct on (f.registrant_id, f.client_id, f.filing_year, f.filing_period) f.*, coalesce(f.income,0) + coalesce(f.expenses,0) as amt
              from la join "LobbyingFilings" f using (filing_uuid) where f.filing_year >= 2025
             order by f.registrant_id, f.client_id, f.filing_year, f.filing_period, (f.filing_type like '%A') desc, f.dt_posted desc)
      select client_name as client, case ${classify} else ${CODEBOOK.clients.length} end as cls, count(*)::int as reports, sum(amt)::float as dollars
        from f group by 1,2 order by 3 desc, 4 desc limit 15`),
    one<{ latest_action: string; latest_action_date: string }>(`select latest_action, latest_action_date from congress_bills where key = '119-HR-3633'`),
  ])

  // House: yes-rates by backing, per bill and party.
  const rate = (vote: string, party: string, grp: string) => {
    const r = houseSplit.find((x) => x.vote === vote && x.party === party && x.grp === grp)
    const yes = n(r?.yes)
    const no = n(r?.no)
    return { yes, no, share: yes + no ? yes / (yes + no) : 0 }
  }
  const bills = [
    { key: "genius", name: "GENIUS Act (stablecoins)", id: HOUSE.genius },
    { key: "clarity", name: "CLARITY Act (market structure)", id: HOUSE.clarity },
    { key: "cbdc", name: "Anti-CBDC bill", id: HOUSE.cbdc },
  ]
  const houseDems = bills.map((b) => ({ ...b, backed: rate(b.id, "D", "backed"), none: rate(b.id, "D", "none"), opposed: rate(b.id, "D", "opposed") }))
  const houseReps = bills.map((b) => ({ ...b, backed: rate(b.id, "R", "backed"), none: rate(b.id, "R", "none") }))

  const dems = senateDems.map((d) => ({ peopleId: n(d.people_id), name: d.name, state: d.state, first: d.first, second: d.second, passage: d.passage, backed: d.backed === true || String(d.backed) === "true" }))
  const switched = dems.filter((d) => d.first === "Nay" && d.second === "Yea")

  const seat = (d: string) => d.replace(/^[HS]D-/, "")
  const votes = new Map(members.map((m) => [n(m.people_id), m]))
  const roster = backing
    .map((m) => {
      const v = votes.get(n(m.people_id))
      return {
        peopleId: n(m.people_id),
        name: m.name,
        party: m.party,
        seat: seat(m.district),
        chamber: m.role === "Sen" ? "Senate" : "House",
        support24: n(m.support24),
        support26: n(m.support26),
        oppose: n(m.oppose),
        clarity: v?.clarity ?? null,
        genius: m.role === "Sen" ? (v?.senate ?? null) : (v?.genius ?? null),
      }
    })
    .sort((a, b) => b.support24 + b.support26 + b.oppose - (a.support24 + a.support26 + a.oppose))

  const QUARTER: Record<string, number> = { first_quarter: 1, second_quarter: 2, third_quarter: 3, fourth_quarter: 4 }
  const periods = quarters
    .filter((p) => QUARTER[p.period])
    .map((p) => ({ label: `${n(p.year)} Q${QUARTER[p.period]}`, sort: n(p.year) * 10 + QUARTER[p.period], filings: n(p.filings), clients: n(p.clients) }))
    .sort((a, b) => a.sort - b.sort)
  // The quarter still being filed is left off: its count is not yet a count.
  const complete = periods.filter((p, i) => i < periods.length - 1 || p.filings > periods[Math.max(0, i - 1)].filings / 4)
  const before = complete.filter((p) => p.sort < 20251)
  const baseline = before.length ? before.reduce((a, p) => a + p.filings, 0) / before.length : 0
  const latest = complete[complete.length - 1]

  const classNames = [...CODEBOOK.clients.map((c) => c.key), "Everyone else"]
  const byClass = classNames.map((name, i) => {
    const r = classes.find((c) => n(c.cls) === i)
    return { name, clients: n(r?.clients), reports: n(r?.reports), dollars: n(r?.dollars) }
  })

  const totals = (cycle: number, so: string) => spending.filter((s) => n(s.cycle) === cycle && s.so === so).reduce((a, s) => a + n(s.total), 0)

  const charts: ChartSpec[] = [
    {
      id: "crypto-house-democrats",
      report: SLUG,
      kind: "bar",
      title: "House Democrats voting yes, by crypto super PAC backing",
      source: "House Clerk roll calls 199, 200 and 201, July 17, 2025; FEC independent expenditures by Fairshake, Defend American Jobs and Protect Progress, 2024 and 2026.",
      format: "pct",
      bars: houseDems.flatMap((b) => [
        { label: `${b.name}: backed`, value: b.backed.share, tone: "two" as const, note: `${b.backed.yes} of ${b.backed.yes + b.backed.no}` },
        { label: `${b.name}: not backed`, value: b.none.share, tone: "one" as const, note: `${b.none.yes} of ${b.none.yes + b.none.no}` },
      ]),
      legend: [
        { label: "Backed by the crypto PACs", tone: "two" },
        { label: "Not backed", tone: "one" },
      ],
    },
    {
      id: "crypto-lobbying",
      report: SLUG,
      kind: "columns",
      title: "Lobbying filings naming the crypto bills, by quarter",
      source: "Senate Lobbying Disclosure Act filings whose issue descriptions name GENIUS, CLARITY, the STABLE Act, the Anti-CBDC bill, stablecoins or market structure.",
      format: "int",
      columns: complete.map((p) => ({ label: p.label, value: p.filings, highlight: p.sort >= 20251, note: `${p.clients.toLocaleString("en-US")} clients` })),
      highlightLabel: "Since the 119th Congress began",
    },
    {
      id: "crypto-recipients",
      report: SLUG,
      kind: "bar",
      title: "Crypto super PAC spending for members of Congress, 2024 and 2026",
      source: "FEC independent expenditures supporting the member, Fairshake, Defend American Jobs and Protect Progress combined.",
      format: "money",
      bars: roster
        .filter((m) => m.support24 + m.support26 > 0)
        .slice(0, 12)
        .map((m) => ({ label: `${m.name} (${m.party}-${m.seat})`, value: m.support24 + m.support26, tone: partyTone(m.party) })),
      legend: [
        { label: "Democrat", tone: "d" },
        { label: "Republican", tone: "r" },
      ],
    },
  ]

  return {
    spending: { support24: totals(2024, "S"), oppose24: totals(2024, "O"), support26: totals(2026, "S"), oppose26: totals(2026, "O"), members: new Set(backing.map((b) => n(b.people_id))).size },
    houseDems,
    houseReps,
    dems,
    switched,
    roster,
    periods: complete,
    baseline,
    latest,
    byClass,
    topClients: topClients.map((c) => ({ client: c.client, cls: classNames[n(c.cls)] ?? "Everyone else", reports: n(c.reports), dollars: n(c.dollars) })),
    clarity: clarity ? { action: clarity.latest_action, date: clarity.latest_action_date } : null,
    charts,
  }
}
