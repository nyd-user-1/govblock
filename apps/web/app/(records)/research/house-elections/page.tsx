import type { Metadata } from "next"
import Link from "next/link"

import { fmtDate, fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { electionsStudy } from "@/lib/reports/elections"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Numbered: election returns alone — the House since 1976, the state
// legislatures since 2008, the ranked-choice counts (2026-09-17, numbered
// 2026-09-18).

const title = "Fifty years of House elections: how few seats November decides"
export const metadata: Metadata = { title, description: "Every House general election since 1976, the state legislatures since 2008, and six hundred ranked-choice counts, read from the returns." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 100)}%`

export default async function HouseElectionsReport() {
  const s = await electionsStudy()
  const { first, last, mostUncontested, fewestClose, mostClose } = s.moments
  const firstLeg = s.legislatures[0]
  const lastLeg = s.legislatures[s.legislatures.length - 1]
  const legShare = (l?: { seats: number; uncontested: number }) => (l && l.seats ? l.uncontested / l.seats : 0)
  const leaderWins = s.rcv.contests ? 1 - s.rcv.comebacks / s.rcv.contests : 0

  return (
    <DocsPage
      title={title}
      description={`Every House general election from ${first?.year} to ${last?.year}, every state legislative chamber from ${firstLeg?.year} to ${lastLeg?.year}, and ${fmtNumber(s.rcv.contests)} ranked-choice counts, read from the returns.`}
      slug="/research/house-elections"
      previous={{ name: "Open primaries", url: "/research/open-primaries" }}
      next={{ name: "Where Congress's money comes from", url: "/research/fec-money" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. The House", url: "#house", depth: 2 },
            { title: "2. The legislatures", url: "#legislatures", depth: 2 },
            { title: "3. Ranked choice", url: "#rcv", depth: 2 },
            { title: "4. Counting rules", url: "#rules", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            The House seat with no opponent has become rare: {Math.round(s.early.uncontested)} a cycle on average from {first?.year} to 1990, {Math.round(s.recent.uncontested)} since 2012.
          </li>
          <li>
            Close races, won by under ten points, come and go with the year, from {fewestClose?.close} in {fewestClose?.year} to {mostClose?.close} in {mostClose?.year}; since 2012 they have averaged about {pct(s.recent.close / 435)} of seats.
          </li>
          <li>
            In the state legislatures, {pct(legShare(lastLeg))} of seats up in {lastLeg?.year} had no November opponent, against {pct(legShare(firstLeg))} in {firstLeg?.year}.
          </li>
          <li>
            Where ranked choice is used, the first-round leader won {pct(leaderWins)} of {fmtNumber(s.rcv.contests)} contests.
          </li>
        </ul>
      </div>

      <H2 id="house">1. The House</H2>
      <p>
        A close race is the only kind a voter in November can decide. In the House they swing with the national mood, and have never been more than a small share of the 435 seats. The seat with no opponent at all, once common, has become rare; the most in any year was {mostUncontested?.uncontested}, in {mostUncontested?.year}.
      </p>
      <ReportChart spec={s.charts[0]} />
      <Table>
        <thead>
          <tr>
            <th>Year</th>
            <th className="text-right">Races</th>
            <th className="text-right">Under 10 points</th>
            <th className="text-right">Under 5</th>
            <th className="pr-8 text-right">Uncontested</th>
          </tr>
        </thead>
        <tbody>
          {s.cycles.map((c) => (
            <tr key={c.year}>
              <td>{c.year}</td>
              <td className="text-right tabular-nums">{c.races}</td>
              <td className="text-right tabular-nums">{c.close}</td>
              <td className="text-right tabular-nums">{c.veryClose}</td>
              <td className="pr-8 text-right tabular-nums">{c.uncontested}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="legislatures">2. The legislatures</H2>
      <p>
        A state legislative seat with no opponent in November was settled in a primary, or by no election at all. About a third of seats draw no opponent, and the chambers where most go uncontested are dominated by one party.
      </p>
      <ReportChart spec={s.charts[1]} />
      <Table>
        <thead>
          <tr>
            <th>Year</th>
            <th className="text-right">Seats up</th>
            <th className="text-right">Uncontested</th>
            <th className="pr-8 text-right">Close</th>
          </tr>
        </thead>
        <tbody>
          {s.legislatures.map((l) => (
            <tr key={l.year}>
              <td>{l.year}</td>
              <td className="text-right tabular-nums">{fmtNumber(l.seats)}</td>
              <td className="text-right tabular-nums">{pct(l.seats ? l.uncontested / l.seats : 0)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(l.seats ? l.close / l.seats : 0)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p>The chambers with the largest share of seats uncontested in {lastLeg?.year}:</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[60%]">Chamber</th>
            <th className="text-right">Uncontested</th>
            <th className="pr-8 text-right">Seats up</th>
          </tr>
        </thead>
        <tbody>
          {s.worst.map((w) => (
            <tr key={`${w.state}-${w.office}`}>
              <td>
                {stateName(w.state)} {w.office}
              </td>
              <td className="text-right tabular-nums">{w.uncontested}</td>
              <td className="pr-8 text-right tabular-nums">{w.seats}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="rcv">3. Ranked choice</H2>
      <p>
        FairVote&apos;s ballot files cover {fmtNumber(s.rcv.contests)} ranked-choice contests, {s.rcv.first ? fmtDate(s.rcv.first) : ""} to {s.rcv.last ? fmtDate(s.rcv.last) : ""}, each retabulated from the ballots. {fmtNumber(s.rcv.comebacks)} were won by a candidate who trailed after the first round, and {s.rcv.condorcetMiss === 1 ? "one was" : `${s.rcv.condorcetMiss} were`} won by someone other than the candidate who beat every rival one on one. <Link href="/simulator">The simulator</Link> replays any of them round by round.
      </p>

      <H2 id="rules">4. Counting rules</H2>
      <ul>
        <li>Sources: MIT Election Data and Science Lab&apos;s U.S. House returns, 1976–2024; Carl Klarner&apos;s state legislative election returns, 2008–2022; FairVote&apos;s ranked-choice cast vote records.</li>
        <li>General elections only; special elections are left out. A race is close when the winner&apos;s lead over the runner-up is under ten points, and uncontested when no one ran against the winner.</li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
