import type { Metadata } from "next"
import Link from "next/link"

import { fmtNumber } from "@/lib/format"
import { primariesStudy } from "@/lib/reports/primaries"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Research recipe report #5 (2026-09-18): how many seats the primary
// decides, how few voters decide them, and what a top-two primary would do.

const title = "The primary is the election: two in three House seats are settled before November, by primaries a fifth to a third the size of November's electorate"
export const metadata: Metadata = { title: "The primary is the election", description: "Every House general election since 1976, and the primary vote behind every seat settled before November, 2008–2022." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 100)}%`

export default async function PrimaryIsTheElectionReport() {
  const s = await primariesStudy()
  const last = s.cycles[s.cycles.length - 1]
  const low = s.cycles.reduce((m, c) => (c.share < m.share ? c : m), s.cycles[0])
  const high = s.cycles.reduce((m, c) => (c.share > m.share ? c : m), s.cycles[0])
  const recent = s.deciders[s.deciders.length - 1]
  const lastTwo = s.house[s.house.length - 1]

  return (
    <DocsPage
      title={title}
      description={`Every House general election from ${s.cycles[0]?.year} to ${last?.year}, and the primary vote behind every seat settled before November from ${s.deciders[0]?.year} to ${recent?.year}.`}
      slug="/research/primary-is-the-election"
      previous={{ name: "Where bills go to die", url: "/research/where-bills-die" }}
      next={{ name: "The paperwork wall", url: "/research/paperwork-wall" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. Seats settled before November", url: "#settled", depth: 2 },
            { title: "2. Who decides them", url: "#deciders", depth: 2 },
            { title: "3. Where incumbents lose", url: "#incumbents", depth: 2 },
            { title: "4. What a top-two primary would change", url: "#top-two", depth: 2 },
            { title: "5. Method and gaps", url: "#method", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            In {last.year}, {fmtNumber(last.settled)} of {fmtNumber(last.races)} House seats ({pct(last.share)}) were settled before November: uncontested or won by 20 points or more. It has been at least {pct(low.share)} in every election since {s.cycles[0].year}.
          </li>
          <li>
            The primary that settled those seats drew {pct(recent.share)} as many votes as the November election for the same seats in {recent.year}, and as little as {pct(Math.min(...s.deciders.map((d) => d.share)))} in {s.deciders.find((d) => d.share === Math.min(...s.deciders.map((x) => x.share)))?.year}.
          </li>
          <li>
            A top-two primary would have sent two candidates of the same party to November in {fmtNumber(lastTwo.same)} of {fmtNumber(lastTwo.races)} House races in {lastTwo.year}, {pct(lastTwo.same / lastTwo.races)}.
          </li>
        </ul>
      </div>

      <H2 id="settled">1. Seats settled before November</H2>
      <p>
        A seat won by 20 points in November was not in play in November. Counting those with the seats nobody contested, the House has had between {pct(low.share)} ({low.year}) and {pct(high.share)} ({high.year}) of its seats settled before the general election in every cycle since {s.cycles[0].year}. The general election
        decides the rest, about a third.
      </p>
      <ReportChart spec={s.charts[0]} />

      <H2 id="deciders">2. Who decides them</H2>
      <p>
        In a settled seat the decision is the winning party&apos;s primary. Its electorate is a fraction of November&apos;s: in {recent.year}, the primaries that settled {fmtNumber(recent.settled)} seats with complete returns drew {fmtNumber(recent.primary)} votes, against {fmtNumber(recent.general)} cast for the same seats in November.
      </p>
      <Table>
        <thead>
          <tr>
            <th>Year</th>
            <th className="text-right">Settled seats</th>
            <th className="text-right">Deciding primary votes</th>
            <th className="text-right">November votes</th>
            <th className="pr-8 text-right">Ratio</th>
          </tr>
        </thead>
        <tbody>
          {s.deciders.map((d) => (
            <tr key={d.year}>
              <td>{d.year}</td>
              <td className="text-right tabular-nums">{fmtNumber(d.settled)}</td>
              <td className="text-right tabular-nums">{fmtNumber(d.primary)}</td>
              <td className="text-right tabular-nums">{fmtNumber(d.general)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(d.share)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="incumbents">3. Where incumbents lose</H2>
      <p>
        When the primary is the election, it is also where a member is at risk. Ballotpedia counted 13 House incumbents defeated in primaries in 2012; 2022&apos;s primary defeats were the most in 20 years, six of them members forced against each other by new maps; and by late August 2026, 11 House members had already lost
        primaries, the second-highest count since 2014.
      </p>

      <H2 id="top-two">4. What a top-two primary would change</H2>
      <p>
        Pool each race&apos;s party primaries into one, send the top two to November, and in {lastTwo.year} {fmtNumber(lastTwo.differs)} of {fmtNumber(lastTwo.races)} House races would have had a different pair on the ballot. In {fmtNumber(lastTwo.same)}, both would have been from one party: the dominant party&apos;s two leading candidates outpolled
        the other party&apos;s nominee in the primary. The seat would then be decided in November, by November&apos;s electorate. In state legislative races with complete primary returns, {fmtNumber(s.legislatures.same)} of {fmtNumber(s.legislatures.races)} would have been same-party. <Link href="/simulator">The simulator</Link> redraws
        any chamber this way.
      </p>
      <ReportChart spec={s.charts[1]} />
      <Table>
        <thead>
          <tr>
            <th>Year</th>
            <th className="text-right">House races</th>
            <th className="text-right">A different pair</th>
            <th className="pr-8 text-right">Two of one party</th>
          </tr>
        </thead>
        <tbody>
          {s.house.map((h) => (
            <tr key={h.year}>
              <td>{h.year}</td>
              <td className="text-right tabular-nums">{fmtNumber(h.races)}</td>
              <td className="text-right tabular-nums">{fmtNumber(h.differs)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(h.same)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="method">5. Method and gaps</H2>
      <ul>
        <li>
          <b>Settled seats.</b> MIT Election Data and Science Lab&apos;s House general elections, 1976–2024, special elections left out. Settled means uncontested or won by 20 points or more, the rule GovBlock&apos;s simulator uses.
        </li>
        <li>
          <b>Deciding primaries.</b> The FEC&apos;s Federal Elections workbooks, 2008–2022: every candidate&apos;s primary and general votes, in the races where all of them are on file. The deciding primary is the winning party&apos;s. States that nominate by convention or that did not count an unopposed primary contribute no primary votes.
        </li>
        <li>
          <b>Top-two.</b> The two candidates with the most primary votes, all parties pooled, against the two who met in November, in races run under party primaries.
        </li>
        <li>
          <b>Incumbents.</b> From <a href="https://ballotpedia.org/Incumbents_defeated_in_congressional_elections,_2012-present">Ballotpedia</a> and its <a href="https://news.ballotpedia.org/2026/08/27/eleven-u-s-house-incumbents-have-lost-primary-elections-so-far-this-year-the-second-highest-since-2014/">August 2026 count</a>, not from the FEC workbooks, whose incumbent flags are unreliable before 2012.
        </li>
        <li>
          <b>Gaps.</b> Races missing a candidate&apos;s primary votes are left out of sections 2 and 4, about a quarter of House races. A top-two primary changes who runs as well as how they are counted; the comparison takes the candidates who ran under party primaries as given.
        </li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
