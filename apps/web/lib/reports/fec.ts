import "server-only"

import { n, q } from "@/lib/policy/db"

import { partyTone, type ChartSpec } from "./chart-spec"

// Where Congress's money comes from (2026-09-17): the FEC's own numbers for
// every member of Congress in the record who ran in 2024 — receipts by the
// donor's state, by the size of the gift, and the independent expenditures
// made for and against them. FEC data alone.

const HOME = `substring(p.district from '-([A-Z]{2})')`
const SLUG = "fec-money"
const SOURCE = "FEC, 2024 cycle; members of Congress in the record."

export type Group = { chamber: "House" | "Senate"; party: string; members: number; pooled: number; median: number }
export type Member = { peopleId: number; name: string; party: string; district: string; total: number; share: number }
export type Target = { peopleId: number; name: string; party: string; district: string; senate: boolean; oppose: number; support: number }

const chamberOf = (role: string) => (role === "Sen" ? "Senate" : "House") as "House" | "Senate"
const seat = (district: string) => district.replace(/^[HS]D-/, "")

export async function fecStudy() {
  const [outState, topOut, sizes, topSmall, ieTotals, targets, spenders, members] = await Promise.all([
    q<{ role: string; party: string; members: number; pooled: number; median: number }>(`
      with m as (select s.people_id, p.party, p.role, sum(s.total) filter (where s.state = ${HOME}) as inn, sum(s.total) filter (where s.state <> ${HOME}) as outt
        from "FecReceiptsByState" s join "People" p using (people_id) where s.cycle = 2024 and p.party in ('D','R') group by 1,2,3)
      select role, party, count(*)::int as members, (sum(outt)/sum(inn+outt))::float as pooled,
             percentile_cont(0.5) within group (order by outt/nullif(inn+outt,0))::float as median
        from m where inn+outt > 0 group by 1,2 order by 1,2`),
    q<{ people_id: number; name: string; party: string; district: string; total: number; share: number }>(`
      with m as (select s.people_id, p.name, p.party, p.district, sum(s.total) filter (where s.state = ${HOME}) as inn, sum(s.total) filter (where s.state <> ${HOME}) as outt
        from "FecReceiptsByState" s join "People" p using (people_id) where s.cycle = 2024 group by 1,2,3,4)
      select people_id, name, party, district, (inn+outt)::float as total, (outt/(inn+outt))::float as share from m where inn+outt > 1000000 order by share desc limit 10`),
    q<{ role: string; party: string; size: number; total: number }>(`
      select p.role, p.party, b.size, sum(b.total)::float as total from "FecReceiptsBySize" b join "People" p using (people_id)
       where b.cycle = 2024 and p.party in ('D','R') group by 1,2,3 order by 1,2,3`),
    q<{ people_id: number; name: string; party: string; district: string; total: number; share: number }>(`
      with m as (select b.people_id, p.name, p.party, p.district, sum(b.total) filter (where size = 0) as small, sum(b.total) as tot
        from "FecReceiptsBySize" b join "People" p using (people_id) where b.cycle = 2024 group by 1,2,3,4)
      select people_id, name, party, district, tot::float as total, (small/tot)::float as share from m where tot > 1000000 order by share desc limit 10`),
    q<{ support_oppose: string; total: number; members: number }>(`
      select support_oppose, sum(total)::float as total, count(distinct people_id)::int as members from "FecIndependentExpenditures" where cycle = 2024 and support_oppose in ('S','O') group by 1`),
    q<{ people_id: number; name: string; party: string; district: string; oppose: number; support: number }>(`
      select p.people_id, p.name, p.party, p.district, coalesce(sum(total) filter (where support_oppose='O'),0)::float as oppose, coalesce(sum(total) filter (where support_oppose='S'),0)::float as support
        from "FecIndependentExpenditures" i join "People" p using (people_id) where cycle = 2024 group by 1,2,3,4 order by oppose desc limit 10`),
    q<{ committee_name: string; total: number; members: number }>(`
      select committee_name, sum(total)::float as total, count(distinct people_id)::int as members from "FecIndependentExpenditures" where cycle = 2024 group by 1 order by 2 desc limit 8`),
    q<{ members: number }>(`select count(distinct people_id)::int as members from "FecReceiptsByState" where cycle = 2024`),
  ])

  const groups: Group[] = outState.map((g) => ({ chamber: chamberOf(g.role), party: g.party, members: n(g.members), pooled: n(g.pooled), median: n(g.median) }))
  const sizeRows = ["Rep", "Sen"].flatMap((role) =>
    ["D", "R"].map((party) => {
      const parts = [0, 200, 500, 1000, 2000].map((size) => n(sizes.find((s) => s.role === role && s.party === party && n(s.size) === size)?.total))
      const total = parts.reduce((a, b) => a + b, 0)
      return { chamber: chamberOf(role), party, parts, small: total ? parts[0] / total : 0, large: total ? parts[4] / total : 0 }
    })
  )
  const oppose = n(ieTotals.find((t) => t.support_oppose === "O")?.total)
  const support = n(ieTotals.find((t) => t.support_oppose === "S")?.total)
  const toMember = (m: { people_id: number; name: string; party: string; district: string; total: number; share: number }): Member => ({ peopleId: n(m.people_id), name: m.name, party: m.party, district: seat(m.district), total: n(m.total), share: n(m.share) })

  const label = (chamber: string, party: string) => `${chamber} ${party === "D" ? "Democrats" : "Republicans"}`
  const charts: ChartSpec[] = [
    {
      id: "fec-out-of-state",
      report: SLUG,
      kind: "bar",
      title: "Share of 2024 receipts from outside the member's state",
      source: `${SOURCE} Itemized receipts by donor state, pooled across each group.`,
      format: "pct",
      bars: groups.map((g) => ({ label: label(g.chamber, g.party), value: g.pooled, tone: partyTone(g.party), note: `${g.members} members · median member ${Math.round(g.median * 100)}%` })),
      legend: [
        { label: "Democrats", tone: "d" },
        { label: "Republicans", tone: "r" },
      ],
    },
    {
      id: "fec-by-size",
      report: SLUG,
      kind: "stack",
      title: "2024 receipts by size of gift",
      source: `${SOURCE} FEC size bands; $200 and under includes unitemized gifts.`,
      series: ["$200 and under", "$200–499", "$500–999", "$1,000–1,999", "$2,000 and over"],
      tones: ["ramp1", "ramp2", "ramp3", "ramp4", "ramp5"],
      rows: sizeRows.map((r) => ({ label: label(r.chamber, r.party), parts: r.parts })),
    },
    {
      id: "fec-outside-targets",
      report: SLUG,
      kind: "bar",
      title: "Outside spending against a member, 2024: the ten most opposed",
      source: `${SOURCE} Independent expenditures marked "oppose".`,
      format: "money",
      bars: targets.map((t) => ({ label: `${t.name} (${t.party}-${seat(t.district)})`, value: n(t.oppose), tone: partyTone(t.party), note: `Supporting: ${Math.round(n(t.support) / 1e6)}M` })),
      legend: [
        { label: "Democrat", tone: "d" },
        { label: "Republican", tone: "r" },
      ],
    },
  ]

  return {
    members: n(members[0]?.members),
    groups,
    topOut: topOut.map(toMember),
    sizeRows,
    topSmall: topSmall.map(toMember),
    outside: { oppose, support, members: Math.max(...ieTotals.map((t) => n(t.members)), 0) },
    targets: targets.map((t): Target => ({ peopleId: n(t.people_id), name: t.name, party: t.party, district: seat(t.district), senate: t.district.startsWith("SD-"), oppose: n(t.oppose), support: n(t.support) })),
    spenders: spenders.map((s) => ({ name: s.committee_name, total: n(s.total), members: n(s.members) })),
    charts,
  }
}
