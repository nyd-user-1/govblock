import type { Metadata } from "next"
import Link from "next/link"

import { fmtDate, fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { openPrimariesStudy } from "@/lib/reports/open-primaries"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { FlagChip } from "@/components/policy/imagery"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Numbered: the Clerk's open-primaries report of 2026-09-07 on the record
// (2026-09-17, numbered 2026-09-18). The bills are recounted on every build;
// the 2024 money comes from reporting and says so.

const title = "Open primaries: the bills, the laws, and the money"
export const metadata: Metadata = { title, description: "Every bill on who may vote in a primary since 2009, the thirteen that became law, and who paid for the 2024 ballot fights." }
export const revalidate = 86400

const MEASURES = [
  { name: "Nevada Question 3", money: "about $29 million", donors: "Unite America $9.6M, Katherine Gehl $5M, Kenneth Griffin $3M, Action Now $3M, Kathryn Murdoch $2.5M", outcome: "Failed" },
  { name: "Colorado Proposition 131", money: "about $15 million", donors: "Unite America about $5M, Kent Thiry, Ben Walton $1M, Reed Hastings $1M, Kathryn Murdoch $500K", outcome: "Failed, 55–45" },
  { name: "Alaska Measure 2 (repeal)", money: "over $12 million to keep reform, about $120,000 to repeal", donors: "Article IV $4.42M, Unite America PAC $4.1M, Action Now", outcome: "Repeal failed by 664 votes" },
]

export default async function OpenPrimariesReport() {
  const s = await openPrimariesStudy()
  const peak = s.years.reduce((m, y) => (y.bills > m.bills ? y : m), s.years[0] ?? { year: 0, bills: 0, states: 0 })

  return (
    <DocsPage
      title={title}
      description={`${fmtNumber(s.bills)} bills in ${fmtNumber(s.states)} jurisdictions since 2009 on who may vote in a primary, the thirteen that became law, and the money behind the 2024 ballot measures.`}
      slug="/research/open-primaries"
      previous={{ name: "H.R. 1", url: "/research/hr1" }}
      next={{ name: "Fifty years of House elections", url: "/research/house-elections" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. The bills", url: "#bills", depth: 2 },
            { title: "2. The laws", url: "#laws", depth: 2 },
            { title: "3. Congress", url: "#congress", depth: 2 },
            { title: "4. The 2024 money", url: "#money", depth: 2 },
            { title: "5. Counting rules", url: "#rules", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            Almost nothing passes: {fmtNumber(s.bills)} bills since 2009 in {fmtNumber(s.states)} jurisdictions spoke of who may vote in a primary, and {s.enacted.length} became law.
          </li>
          <li>The two laws that let unaffiliated voters into party primaries, Maine&apos;s and New Mexico&apos;s, came through legislatures; other enactments ran the other way.</li>
          <li>The reform&apos;s money went to the 2024 ballot measures: a few national donors paid for most of it, and it lost in Nevada and Colorado and barely held in Alaska.</li>
        </ul>
      </div>

      <H2 id="bills">1. The bills</H2>
      <p>
        {fmtNumber(s.bills)} bills in {fmtNumber(s.states)} jurisdictions, filed most heavily in odd-numbered years. The most were filed in {peak.year}: {fmtNumber(peak.bills)} in {fmtNumber(peak.states)} jurisdictions.
      </p>
      <ReportChart spec={s.charts[0]} />
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

      <H2 id="laws">2. The laws</H2>
      <p>
        {s.enacted.length} became law, and they did not all point one way. Maine and New Mexico opened their primaries to unaffiliated voters by statute; Louisiana began moving back toward closed party primaries; New Jersey tightened when an unaffiliated voter must choose a party.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[26%]">Law</th>
            <th className="w-[16%]">Date</th>
            <th className="pr-8">What it did</th>
          </tr>
        </thead>
        <tbody>
          {s.enacted.map((l) => (
            <tr key={`${l.state}-${l.bill}-${l.session}`}>
              <td className="whitespace-nowrap">
                <FlagChip state={l.state} width={18} className="mr-1.5 inline-block align-[-3px]" />
                {l.billId ? <Link href={`/bills/${l.billId}`}>{`${l.state} ${l.bill}`}</Link> : `${l.state} ${l.bill}`}
              </td>
              <td className="whitespace-nowrap">{l.date ? fmtDate(l.date) : "—"}</td>
              <td className="pr-8">{l.note}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="congress">3. Congress</H2>
      {s.federal && (
        <p>
          H.R. 155, {s.federal.title}, sponsored by {s.federal.sponsor_name}, was introduced {fmtDate(s.federal.introduced_date)}; its latest action, on {fmtDate(s.federal.latest_action_date)}: {s.federal.latest_action} The idea has been filed under several names since 2014 and has never been reported by a committee.
        </p>
      )}

      <H2 id="money">4. The 2024 money</H2>
      <p>The bills carry no campaign money; the ballot measures do. These figures come from OpenSecrets and state newsrooms, not from GovBlock&apos;s database. The same national donors recur in every state.</p>
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

      <H2 id="rules">5. Counting rules</H2>
      <ul>
        <li>Bills: every bill in the GovBlock record, all 50 states, D.C. and Congress, whose title or summary speaks of who may vote in a primary. A keyword match measures the volume of the fight, not each bill&apos;s direction.</li>
        <li>Laws: the thirteen enactments verified by hand in <a href="/reports/open-primaries-2026-09-07.pdf">the Clerk&apos;s report of September 7, 2026</a>, each read back from the record.</li>
        <li>
          2024 money: OpenSecrets via <a href="https://ivn.us/posts/more-400-million-raised-2024-ballot-measures-opensecrets-reports-2024-10-31">IVN</a>, <a href="https://sentinelcolorado.com/nation-world/prop-131-part-of-a-national-push-to-ease-polarization-by-ditching-partisan-primaries/">Sentinel Colorado</a>, <a href="https://thenevadaindependent.com/article/question-3-backers-promote-ranked-choice-voting-with-major-out-of-state-money">The Nevada Independent</a>,{" "}
          <a href="https://coloradonewsline.com/2024/10/25/colorado-proposition-131-debate/">Colorado Newsline</a> and <a href="https://alaskabeacon.com/briefs/alaska-ranked-choice-voting-repeal-effort-outraised-a-hundredfold-campaign-finance-filings-show/">Alaska Beacon</a>.
        </li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
