import type { Metadata } from "next"

import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { billDeathsStudy } from "@/lib/reports/bill-deaths"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Research recipe report #4 (2026-09-18): where state bills die, and who
// decides — the committees that hold them, and the party that sponsored them.

const title = "Where bills go to die: two in three state bills never get a vote, and a minority-party bill passes at less than half the majority's rate"
export const metadata: Metadata = { title: "Where bills go to die", description: "Every bill of the 2023 sessions in 49 state legislatures: how many never got a vote, which committees held them, and how much the sponsor's party decided it." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 100)}%`

export default async function WhereBillsDieReport() {
  const s = await billDeathsStudy()
  const worst = s.rows[0]
  const low = s.rows.filter((r) => ["CO", "ND"].includes(r.state))
  const topCommittee = s.committees[0]
  const ratio = s.agg.minRate ? s.agg.majRate / s.agg.minRate : 0
  const lowest = s.comparable.slice(0, 4)

  return (
    <DocsPage
      title={title}
      description={`Every bill of the sessions that began in 2023 in 49 state legislatures, ${fmtNumber(s.total.bills)} in all: how many never got a vote, which committees held them, and how much the sponsor's party decided it.`}
      slug="/research/where-bills-die"
      previous={{ name: "Copy-and-paste lawmaking", url: "/research/model-bills" }}
      next={{ name: "The primary is the election", url: "/research/primary-is-the-election" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. Bills that never got a vote", url: "#novote", depth: 2 },
            { title: "2. The committees that hold them", url: "#committees", depth: 2 },
            { title: "3. The sponsor's party", url: "#party", depth: 2 },
            { title: "4. Every state", url: "#states", depth: 2 },
            { title: "5. Method and gaps", url: "#method", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            {pct(s.total.novote / s.total.bills)} of the {fmtNumber(s.total.bills)} bills filed in 2023 sessions never got a recorded vote of any kind, in committee or on the floor. In {stateName(worst.state)} it was {pct(worst.share)}.
          </li>
          <li>
            Where the constitution or the rules require a vote on every bill, nearly every bill gets one: {low.map((r) => `${stateName(r.state)}, ${pct(r.share)} without a vote`).join("; ")}.
          </li>
          <li>
            A bill from the majority party passed {ratio.toFixed(1)} times as often as one from the minority: {pct(s.agg.majRate)} against {pct(s.agg.minRate)}. In {lowest.map((g) => `${stateName(g.state)} the minority passed ${g.minPassed} of ${fmtNumber(g.minBills)} bills, the majority ${Math.round(g.majRate * 100)}%`).join("; in ")}.
          </li>
        </ul>
      </div>

      <H2 id="novote">1. Bills that never got a vote</H2>
      <p>
        A bill that is never voted on is killed by no one on the record. Of the {fmtNumber(s.total.bills)} bills filed in the 2023 sessions of 49 legislatures, {fmtNumber(s.total.novote)} ended with no roll call at all, and {fmtNumber(s.total.passed)} passed. The states at the bottom of the chart show the alternative. Colorado&apos;s
        constitution has required a committee vote on every bill since voters adopted the GAVEL amendment in 1988, and North Dakota&apos;s rules send every bill to a committee vote and then the floor.
      </p>
      <ReportChart spec={s.charts[0]} />

      <H2 id="committees">2. The committees that hold them</H2>
      <p>
        The largest graveyards are not policy committees but gatekeepers. In {stateName(topCommittee.state)}, {topCommittee.state === "IL" ? "every House bill is first referred to the Rules committee, which the Speaker controls, and every Senate bill to Assignments" : `the ${topCommittee.chamber} ${topCommittee.name} committee received the most`}; {fmtNumber(topCommittee.died)} of the {fmtNumber(topCommittee.referred)} bills {topCommittee.name} received never got a vote. In Minnesota and Massachusetts the counts mean something else: both legislatures pass their business in omnibus bills, so a standalone bill that dies in committee may pass inside another.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[44%]">Committee of first referral</th>
            <th className="text-right">Bills referred</th>
            <th className="text-right">Never voted on</th>
            <th className="pr-8 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {s.committees.map((c) => (
            <tr key={`${c.state}-${c.chamber}-${c.name}`}>
              <td>
                {stateName(c.state)} {c.chamber}: {c.name}
              </td>
              <td className="text-right tabular-nums">{fmtNumber(c.referred)}</td>
              <td className="text-right tabular-nums">{fmtNumber(c.died)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(c.died / c.referred)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="party">3. The sponsor&apos;s party</H2>
      <p>
        Across the {fmtNumber(s.gaps.length)} states where both parties sponsored at least a hundred bills, {pct(s.agg.majRate)} of majority-party bills passed and {pct(s.agg.minRate)} of minority-party bills. New Hampshire, with the largest and one of the most closely divided Houses in the country, is the exception.
      </p>
      <ReportChart spec={s.charts[1]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[26%]">State</th>
            <th className="text-right">Majority bills</th>
            <th className="text-right">Passed</th>
            <th className="text-right">Minority bills</th>
            <th className="pr-8 text-right">Passed</th>
          </tr>
        </thead>
        <tbody>
          {s.gaps.map((g) => (
            <tr key={g.state}>
              <td>{stateName(g.state)}</td>
              <td className="text-right tabular-nums">{fmtNumber(g.majBills)}</td>
              <td className="text-right tabular-nums">{pct(g.majRate)}</td>
              <td className="text-right tabular-nums">{fmtNumber(g.minBills)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(g.minRate)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="states">4. Every state</H2>
      <Table>
        <thead>
          <tr>
            <th className="w-[30%]">State</th>
            <th className="text-right">Bills</th>
            <th className="text-right">Never voted on</th>
            <th className="text-right">Share</th>
            <th className="pr-8 text-right">Passed</th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => (
            <tr key={r.state}>
              <td>{stateName(r.state)}</td>
              <td className="text-right tabular-nums">{fmtNumber(r.bills)}</td>
              <td className="text-right tabular-nums">{fmtNumber(r.novote)}</td>
              <td className="text-right tabular-nums">{pct(r.share)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(r.passed)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="method">5. Method and gaps</H2>
      <ul>
        <li>
          <b>Scope.</b> Every bill (not resolution) of the sessions that began in 2023 in the 49 partisan state legislatures; Nebraska&apos;s is nonpartisan and is left out.
        </li>
        <li>
          <b>Never voted on.</b> The record holds no roll call on the bill, in committee or on the floor. States record committee votes unevenly, so a state that publishes committee roll calls will show fewer bills without a vote than one that publishes only floor votes.
        </li>
        <li>
          <b>Passed.</b> The bill&apos;s status is passed or signed by the governor.
        </li>
        <li>
          <b>Party.</b> The primary sponsor&apos;s party against the majority of their chamber after the 2022 election (Klarner&apos;s state legislative returns). Bills filed by committees or without an individual primary sponsor are left out of the party comparison; a state enters it when both parties sponsored at least 100 bills.
        </li>
        <li>
          <b>Verified outside the record.</b> Colorado&apos;s <a href="https://legisource.net/2015/04/02/gavel-requirements-thou-shalt-consider-vote/">GAVEL requirements</a> and North Dakota&apos;s{" "}
          <a href="https://www.ndlegis.gov/research-center/legislative-branch-function-and-process">legislative process</a>.
        </li>
        <li>
          <b>Gaps.</b> Omnibus states pass the content of dead bills inside other bills. Carried-over bills in a biennium&apos;s second year are counted with their session.
        </li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
