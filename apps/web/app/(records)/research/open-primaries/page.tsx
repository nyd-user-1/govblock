import type { Metadata } from "next"
import Link from "next/link"

import { fmtDate, fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { OPEN_PRIMARIES_SOURCES, openPrimariesStudy } from "@/lib/reports/open-primaries"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { FlagChip } from "@/components/policy/imagery"
import { ReportChart } from "@/components/reports/report-chart"
import { SourcesCited, Trace, TraceStep } from "@/components/reports/trace"
import { Table } from "@/components/typeset"

// Trace: the Clerk's open-primaries report of 2026-09-07, made real
// (2026-09-17). The bills are recounted from the record on every build; the
// 2024 money comes from reporting and says so.

const title = "Open primaries: the bills, the laws, and the money"
export const metadata: Metadata = { title, description: "Every bill on who may vote in a primary since 2009, the thirteen that became law, and who paid for the 2024 ballot fights." }
export const revalidate = 86400

const MEASURES = [
  { state: "NV", name: "Nevada Question 3", money: "about $29 million", donors: "Unite America $9.6M, Katherine Gehl $5M, Kenneth Griffin $3M, Action Now $3M, Kathryn Murdoch $2.5M", outcome: "Failed" },
  { state: "CO", name: "Colorado Proposition 131", money: "about $15 million", donors: "Unite America about $5M, Kent Thiry, Ben Walton $1M, Reed Hastings $1M, Kathryn Murdoch $500K", outcome: "Failed, 55–45" },
  { state: "AK", name: "Alaska Measure 2 (repeal)", money: "over $12 million to keep reform, about $120,000 to repeal", donors: "Article IV $4.42M, Unite America PAC $4.1M, Action Now", outcome: "Repeal failed by 664 votes" },
]

export default async function OpenPrimariesReport() {
  const s = await openPrimariesStudy()
  const peak = s.years.reduce((m, y) => (y.bills > m.bills ? y : m), s.years[0] ?? { year: 0, bills: 0, states: 0 })

  return (
    <DocsPage
      title={title}
      description={`${fmtNumber(s.bills)} bills in ${fmtNumber(s.states)} jurisdictions since 2009 on who may vote in a primary, the thirteen that became law, and the money behind the 2024 ballot measures, in the order the work was done.`}
      slug="/research/open-primaries"
      previous={{ name: "H.R. 1", url: "/research/hr1-trace" }}
      next={{ name: "Fifty years of House elections", url: "/research/house-elections" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "The bills", url: "#bills", depth: 2 },
            { title: "The laws", url: "#laws", depth: 2 },
            { title: "Congress", url: "#congress", depth: 2 },
            { title: "The 2024 money", url: "#money", depth: 2 },
            { title: "What it adds up to", url: "#synthesis", depth: 2 },
          ]}
        />
      }
    >
      <p>
        Legislatures file bills to open or close their primaries every year, and almost none pass: {s.enacted.length} of {fmtNumber(s.bills)} in the record became law. The reform&apos;s money went instead to ballot measures, where a small national network of donors paid for most of it and lost almost everywhere.
      </p>
      <SourcesCited sources={OPEN_PRIMARIES_SOURCES} />

      <Trace>
        <TraceStep
          id="bills"
          mark="DB"
          source="The GovBlock record"
          did="Every bill in all 50 states, D.C. and Congress whose title or summary speaks of who may vote in a primary."
          returned={
            <>
              <p>
                {fmtNumber(s.bills)} bills in {fmtNumber(s.states)} jurisdictions. The most were filed in {peak.year}: {fmtNumber(peak.bills)} in {fmtNumber(peak.states)} jurisdictions.
              </p>
              <Table>
                <thead>
                  <tr>
                    <th className="w-[60%]">Jurisdiction</th>
                    <th className="pr-8 text-right">Bills</th>
                  </tr>
                </thead>
                <tbody>
                  {s.busiest.map((b) => (
                    <tr key={b.state}>
                      <td>{stateName(b.state)}</td>
                      <td className="pr-8 text-right tabular-nums">{fmtNumber(b.bills)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          }
          reading="A keyword match catches the bills that use the words — open, top-two, semi-closed, unaffiliated voters in a primary — and misses those that do not, and it catches some that mention a primary in passing. It measures the volume of the fight, not each bill's direction; the Clerk's report of September 7 sorted them by hand into bills that widen a primary and bills that narrow one."
          output={
            <p>
              {fmtNumber(s.bills)} bills since 2009, filed most heavily in odd-numbered years, and most often in {s.busiest.slice(0, 3).map((b) => stateName(b.state)).join(", ")}.
            </p>
          }
        >
          <ReportChart spec={s.charts[0]} />
        </TraceStep>

        <TraceStep
          id="laws"
          mark="DB"
          source="The GovBlock record"
          did="The thirteen enactments the September 7 report found, each read back from the record."
          returned={
            <ul className="list-none pl-0">
              {s.enacted.map((l) => (
                <li key={`${l.state}-${l.bill}-${l.session}`} className="flex items-start gap-2">
                  <FlagChip state={l.state} width={20} className="mt-1 shrink-0" />
                  <span>
                    {l.billId ? <Link href={`/bills/${l.billId}`}>{`${stateName(l.state)} ${l.bill}`}</Link> : `${stateName(l.state)} ${l.bill}`}
                    {l.date ? `, ${fmtDate(l.date)}` : ""}. {l.note}
                  </span>
                </li>
              ))}
            </ul>
          }
          reading="The laws do not all point one way. Maine and New Mexico opened their primaries to unaffiliated voters by statute; Louisiana began moving back toward closed party primaries; New Jersey's changes tightened when an unaffiliated voter must choose a party. Reform that passed came through legislatures, not the ballot."
          output={
            <p>
              {s.enacted.length} of {fmtNumber(s.bills)} became law. The two that let unaffiliated voters into party primaries were Maine&apos;s and New Mexico&apos;s, both by statute.
            </p>
          }
        />

        <TraceStep
          id="congress"
          mark="CG"
          source="congress.gov"
          did="The federal bill that would open every state's primaries."
          returned={
            s.federal && (
              <ul>
                <li>
                  H.R. 155, {s.federal.title}. Sponsor: {s.federal.sponsor_name}.
                </li>
                <li>
                  Introduced {fmtDate(s.federal.introduced_date)}; latest action {fmtDate(s.federal.latest_action_date)}: {s.federal.latest_action}
                </li>
              </ul>
            )
          }
          reading="The idea has been filed in Congress under several names since 2014 and has never been reported by a committee. A referral with no hearing is where a federal primary bill has always ended."
          output={<p>In Congress the idea has never left committee.</p>}
        />

        <TraceStep
          id="money"
          mark="WEB"
          source="Campaign finance reporting"
          did="Who paid for the 2024 ballot measures, from OpenSecrets and state newsrooms; none of it is in GovBlock's database."
          returned={
            <Table>
              <thead>
                <tr>
                  <th className="w-[26%]">Measure</th>
                  <th className="w-[24%]">Raised</th>
                  <th className="w-[34%]">Largest donors</th>
                  <th className="pr-8">Result</th>
                </tr>
              </thead>
              <tbody>
                {MEASURES.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td>{m.money}</td>
                    <td>{m.donors}</td>
                    <td className="pr-8">{m.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          reading="The same names recur in every state: Unite America, Article IV, the Arnolds' Action Now and Katherine Gehl. Early reports on Kent Thiry's giving to Proposition 131 disagreed; the report uses the year-end filings. Reform's money came mostly from outside the states it was spent in."
          output={<p>A few national donors paid for most of the 2024 campaigns to open primaries. Nevada and Colorado voters rejected them anyway. In Alaska, where reform&apos;s defenders outspent the repeal a hundred to one, reform survived by 664 votes.</p>}
        />

        <TraceStep
          id="synthesis"
          mark="GB"
          source="The Clerk"
          synthesis
          did="The record and the reporting, put together."
          returned={
            <ul>
              <li>Legislatures keep filing primary bills and almost never pass them.</li>
              <li>The changes that passed came through legislatures, and they ran in both directions.</li>
              <li>The money went to ballot measures, and there it mostly lost.</li>
            </ul>
          }
          output={<p>Opening the primary is a reform with plenty of bills and plenty of money and very few wins. Where it has won lately, it won quietly, in a legislature; where it was put to the voters with the most money behind it, it lost.</p>}
        />
      </Trace>

      <p className="text-sm text-muted-foreground">
        The bills are recounted from the record when the page is built, at most once a day. The 2024 money is from the sources cited and is not in GovBlock&apos;s database. The report this trace grew from is{" "}
        <a href="/reports/open-primaries-2026-09-07.pdf">the Clerk&apos;s report of September 7, 2026</a>. Data and findings are CC BY 4.0.
      </p>
    </DocsPage>
  )
}
