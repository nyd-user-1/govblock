import type { Metadata } from "next"
import Link from "next/link"

import { fmtDate, fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { electionsStudy } from "@/lib/reports/elections"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { SourcesCited, Trace, TraceStep } from "@/components/reports/trace"
import { Table } from "@/components/typeset"

// Trace: election returns alone — the House since 1976, the state
// legislatures since 2008, and the ranked-choice counts (2026-09-17).

const title = "Fifty years of House elections: how few seats November decides"
export const metadata: Metadata = { title, description: "Every House general election since 1976, the state legislatures since 2008, and six hundred ranked-choice counts, read from the returns." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 100)}%`

const SOURCES = [
  { title: "MIT Election Data and Science Lab: U.S. House 1976–2024", url: "https://electionlab.mit.edu/data" },
  { title: "Klarner: State Legislative Election Returns, 1967–2022", url: "https://dataverse.harvard.edu/dataverse/electionreturns" },
  { title: "FairVote: ranked-choice cast vote records", url: "https://fairvote.org/resources/data-on-rcv/" },
  { title: "GovBlock: the Open Primary Simulator", url: "/simulator" },
]

export default async function HouseElectionsReport() {
  const s = await electionsStudy()
  const { first, last, mostUncontested, fewestClose, mostClose } = s.moments
  const firstLeg = s.legislatures[0]
  const lastLeg = s.legislatures[s.legislatures.length - 1]
  const legShare = (l?: { seats: number; uncontested: number }) => (l && l.seats ? l.uncontested / l.seats : 0)

  return (
    <DocsPage
      title={title}
      description={`Every House general election from ${first?.year} to ${last?.year}, every state legislative chamber from ${firstLeg?.year} to ${lastLeg?.year}, and ${fmtNumber(s.rcv.contests)} ranked-choice counts, read from the returns in the order the work was done.`}
      slug="/research/house-elections"
      previous={{ name: "Open primaries", url: "/research/open-primaries" }}
      next={{ name: "Where Congress's money comes from", url: "/research/fec-money" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "The House", url: "#house", depth: 2 },
            { title: "The legislatures", url: "#legislatures", depth: 2 },
            { title: "Ranked choice", url: "#rcv", depth: 2 },
            { title: "What it adds up to", url: "#synthesis", depth: 2 },
          ]}
        />
      }
    >
      <p>
        A close race is the only kind a voter in November can decide. In the House they come and go with the political weather, from {fewestClose?.close} in {fewestClose?.year} to {mostClose?.close} in {mostClose?.year}, and they have never been more than a small share of the 435 seats. The seat with no
        opponent at all, once common, has become rare. In the state legislatures it has not: about a third of seats draw no November opponent.
      </p>
      <SourcesCited sources={SOURCES} />

      <Trace>
        <TraceStep
          id="house"
          mark="MIT"
          source="MIT Election Lab"
          did={`Every House general election from ${first?.year} to ${last?.year}: the winner, the runner-up, and the margin between them.`}
          returned={
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
          }
          reading="Close races swing with the national mood: waves produce them, calm years do not, so no single year makes a trend. The uncontested seat is steadier and says more about the parties' reach, so the trace compares averages over spans of years rather than one election to the next."
          output={
            <p>
              From {first?.year} to 1990 an average of {Math.round(s.early.uncontested)} House seats a cycle had no opponent; since 2012, {Math.round(s.recent.uncontested)}. The most was {mostUncontested?.uncontested}, in {mostUncontested?.year}. Close races averaged {Math.round(s.early.close)} a cycle then and {Math.round(s.recent.close)} now.
            </p>
          }
        >
          <ReportChart spec={s.charts[0]} />
        </TraceStep>

        <TraceStep
          id="legislatures"
          mark="KL"
          source="Klarner's state returns"
          did={`Every state legislative chamber's general election from ${firstLeg?.year} to ${lastLeg?.year}, seat by seat.`}
          returned={
            <>
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
              <ul>
                {s.worst.map((w) => (
                  <li key={`${w.state}-${w.office}`}>
                    {stateName(w.state)} {w.office}: {w.uncontested} of {w.seats} seats
                  </li>
                ))}
              </ul>
            </>
          }
          reading="A state legislative seat with no opponent in November was settled in a primary, or by no election at all. Chambers where most seats go uncontested are one-party chambers, and the list is led by them."
          output={
            <p>
              {pct(legShare(lastLeg))} of state legislative seats up in {lastLeg?.year} had no opponent in November, against {pct(legShare(firstLeg))} in {firstLeg?.year}.
            </p>
          }
        >
          <ReportChart spec={s.charts[1]} />
        </TraceStep>

        <TraceStep
          id="rcv"
          mark="FV"
          source="FairVote's ballots"
          did="Every ranked-choice count in the record, retabulated from the ballots."
          returned={
            <ul>
              <li>
                {fmtNumber(s.rcv.contests)} contests, {s.rcv.first ? fmtDate(s.rcv.first) : ""} to {s.rcv.last ? fmtDate(s.rcv.last) : ""}.
              </li>
              <li>{fmtNumber(s.rcv.comebacks)} were won by a candidate who trailed after the first round.</li>
              <li>{fmtNumber(s.rcv.condorcetMiss)} were won by someone other than the candidate who beat every rival one on one.</li>
            </ul>
          }
          reading="The worry about ranked choice is that the transfers overturn the plurality winner or elect someone a majority would reject head to head. The ballots let both be counted."
          output={
            <p>
              The first-round leader won {pct(s.rcv.contests ? 1 - s.rcv.comebacks / s.rcv.contests : 0)} of ranked-choice contests, and the head-to-head winner lost {s.rcv.condorcetMiss === 1 ? "once" : `${s.rcv.condorcetMiss} times`} in {fmtNumber(s.rcv.contests)}.{" "}
              <Link href="/simulator">The simulator</Link> replays any of them round by round.
            </p>
          }
        />

        <TraceStep
          id="synthesis"
          mark="GB"
          source="The Clerk"
          synthesis
          did="The three bodies of returns, put together."
          returned={
            <ul>
              <li>In the House, the uncontested seat has become rare, and close races, about {pct(s.recent.close / 435)} of seats a cycle since 2012, come and go with the year.</li>
              <li>In the legislatures, about a third of seats draw no November opponent.</li>
              <li>Where ranked choice is used, it rarely changes the first-round winner.</li>
            </ul>
          }
          output={<p>The November ballot decides fewer seats than it appears to. In the House nearly every seat now has a race, but only about {pct(s.recent.close / 435)} have a close one; in the statehouses a third have no race at all.</p>}
        />
      </Trace>

      <p className="text-sm text-muted-foreground">Counted from the returns when the page is built, at most once a day. A race is close when the winner&apos;s lead is under ten points. Data and findings are CC BY 4.0.</p>
    </DocsPage>
  )
}
