import type { Metadata } from "next"
import Link from "next/link"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import { hr1Study } from "@/lib/reports/hr1"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Numbered: H.R. 1 of the 119th Congress across four records — the bill, its
// lobbying, both chambers' votes, the outside money after (2026-09-17,
// numbered 2026-09-18).

const title = "H.R. 1, from the lobbyists to the vote to the money"
export const metadata: Metadata = { title, description: "The most-lobbied bill of the 119th Congress across the bill's record, its lobbying disclosures, both chambers' roll calls and the FEC." }
export const revalidate = 86400

const money = (x: number) => (x >= 1e9 ? `$${(x / 1e9).toFixed(2)} billion` : `$${(x / 1e6).toFixed(1)} million`)
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
const ordinal = (n: number) => (n === 1 ? "most" : `${n === 2 ? "second" : n === 3 ? "third" : `${n}th`}-most`)

export default async function Hr1Report() {
  const s = await hr1Study()
  const b = s.bill
  const passage = s.house.find((h) => h.question === "On Passage")
  const concur = s.house.find((h) => /concur/i.test(h.question))
  const senatePassage = s.senate[0]
  const noBoth = s.dissent.filter((d) => /^N/.test(d.cast)).reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.name]: (acc[d.name] ?? 0) + 1 }), {})
  const noTwice = Object.entries(noBoth).filter(([, count]) => count === 2).map(([name]) => name)
  const m = s.massie
  const opposed = m.opposed.reduce((a, o) => a + o.total, 0)
  const ratio = s.lobbying.nextFilings ? s.lobbying.named / s.lobbying.nextFilings : 0

  return (
    <DocsPage
      title={title}
      description="The most-lobbied bill of the 119th Congress across four records: the bill, the lobbying disclosures that named it, both chambers' roll calls, and the outside money in the cycle after."
      slug="/research/hr1"
      previous={{ name: "Research", url: "/research" }}
      next={{ name: "Open primaries", url: "/research/open-primaries" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. The bill", url: "#bill", depth: 2 },
            { title: "2. The lobbying", url: "#lobbying", depth: 2 },
            { title: "3. The House", url: "#house", depth: 2 },
            { title: "4. The Senate", url: "#senate", depth: 2 },
            { title: "5. The money after", url: "#money", depth: 2 },
            { title: "6. Counting rules", url: "#rules", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            {fmtNumber(s.lobbying.clients)} clients named H.R. 1 in their lobbying disclosures, on about {Math.round(ratio)} times as many filings as the next most-lobbied bill, and reported {money(s.lobbying.dollars)} in lobbying spending in those quarters.
          </li>
          <li>
            It passed the House {passage ? `${passage.yea}–${passage.nay}` : "by one vote"} and the Senate {senatePassage ? `${senatePassage.yea}–${senatePassage.nay}${senatePassage.tie_breaker ? " on the Vice President's vote" : ""}` : ""}, and became law {b ? `${days(b.introduced_date, b.latest_action_date)} days after it was introduced` : ""}.
          </li>
          {noTwice.length > 0 && (
            <li>
              {noTwice.join(" and ")} voted no at both House votes. In the 2026 cycle outside groups spent {money(opposed)} against Thomas Massie, the {ordinal(m.rank)} against any House Republican, while his own small-dollar receipts rose from {money(m.small2024)} to {money(m.small2026)}.
            </li>
          )}
        </ul>
      </div>

      <H2 id="bill">1. The bill</H2>
      {b && (
        <p>
          {b.popular_title ? `The ${b.popular_title}` : "H.R. 1"}, &ldquo;{b.display_title}&rdquo;, was introduced by {b.sponsor_name} on {fmtDate(b.introduced_date)} and {b.latest_action.replace(/\.$/, "").replace(/^Became/, "became")} on {fmtDate(b.latest_action_date)}: {days(b.introduced_date, b.latest_action_date)} days. Its policy area is {b.policy_area}.
        </p>
      )}

      <H2 id="lobbying">2. The lobbying</H2>
      <p>
        {fmtNumber(s.lobbying.named)} Lobbying Disclosure Act filings named H.R. 1. The next most-named bill of the Congress, {s.lobbying.nextKey.replace(/^119-/, "").replace("-", " ")}, drew {fmtNumber(s.lobbying.nextFilings)}. With amendments folded into the reports they replace, that is {fmtNumber(s.lobbying.filings)} quarterly reports from {fmtNumber(s.lobbying.clients)} clients and {fmtNumber(s.lobbying.firms)} registrants. The peak was {s.peak.label}
        {s.peak.label === "2025 Q2" ? ", the quarter it passed the House" : ""}: {money(s.peak.dollars)} reported by {fmtNumber(s.peak.clients)} clients.
      </p>
      <p>
        A disclosure reports one figure for the quarter, what the client spent lobbying on everything, of which H.R. 1 was one item. The dollars here are the total spent by the clients who lobbied on the bill, in the quarters they lobbied on it: the money behind the bill, not a price on it.
      </p>
      <ReportChart spec={s.charts[0]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[55%]">Client</th>
            <th className="text-right">Reports</th>
            <th className="pr-8 text-right">Reported spending</th>
          </tr>
        </thead>
        <tbody>
          {s.clients.map((c) => (
            <tr key={c.client}>
              <td>{c.client}</td>
              <td className="text-right tabular-nums">{fmtNumber(c.filings)}</td>
              <td className="pr-8 text-right tabular-nums">{money(c.dollars)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="house">3. The House</H2>
      <p>
        {passage ? `The House passed it ${passage.yea}–${passage.nay} on ${fmtDate(passage.date)}` : ""}
        {concur ? ` and agreed to the Senate's version ${concur.yea}–${concur.nay} on ${fmtDate(concur.date)}` : ""}. Every Democrat voted no both times, so the margin was made inside the majority.
      </p>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="w-[45%]">Question</th>
            <th className="text-right">Yea</th>
            <th className="text-right">Nay</th>
            <th className="pr-8">Result</th>
          </tr>
        </thead>
        <tbody>
          {s.house.map((h) => (
            <tr key={h.roll}>
              <td className="whitespace-nowrap">{fmtDate(h.date)}</td>
              <td>{h.question}</td>
              <td className="text-right tabular-nums">{h.yea}</td>
              <td className="text-right tabular-nums">{h.nay}</td>
              <td className="pr-8">{h.result}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p>The Republicans who did not vote yes on passage or on the final vote:</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[50%]">Member</th>
            <th>Roll call</th>
            <th className="pr-8">Vote</th>
          </tr>
        </thead>
        <tbody>
          {s.dissent.map((d) => (
            <tr key={`${d.roll}-${d.peopleId}`}>
              <td>
                <Link href={memberHref(d.peopleId, "US")}>{d.name}</Link> ({d.state})
              </td>
              <td>{d.roll === "145" ? "Passage" : "Final vote"}</td>
              <td className="pr-8">{d.cast}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="senate">4. The Senate</H2>
      <p>
        The Senate held {fmtNumber(s.senateVotes)} roll calls on the bill across {s.senateDays.length} days of voting.{" "}
        {senatePassage ? `It passed ${senatePassage.yea}–${senatePassage.nay} on ${fmtDate(senatePassage.date)}${senatePassage.tie_breaker ? `, the ${senatePassage.tie_breaker.replace(/ of the United States$/, "")} breaking the tie` : ""}.` : ""}
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[40%]">Day</th>
            <th className="text-right">Roll calls</th>
            <th className="pr-8 text-right">Agreed or passed</th>
          </tr>
        </thead>
        <tbody>
          {s.senateDays.map((d) => (
            <tr key={d.day}>
              <td>{fmtDate(d.day)}</td>
              <td className="text-right tabular-nums">{d.votes}</td>
              <td className="pr-8 text-right tabular-nums">{d.agreed}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="money">5. The money after</H2>
      <p>
        In the 2026 cycle outside groups spent {money(opposed)} against Thomas Massie, the {ordinal(m.rank)} against any House Republican. His own receipts went from {money(m.receipts2024)} in 2024 to {money(m.receipts2026)} so far in 2026, and his unitemized small gifts from {money(m.small2024)} to {money(m.small2026)}. The filings say whom a group opposed, not why; the record shows only the order, the no votes first and the money after.
      </p>
      <ReportChart spec={s.charts[1]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[70%]">Spent against Thomas Massie, 2026 cycle</th>
            <th className="pr-8 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {m.opposed.map((o) => (
            <tr key={o.committee}>
              <td>{o.committee}</td>
              <td className="pr-8 text-right tabular-nums">{money(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="rules">6. Counting rules</H2>
      <ul>
        <li>Sources: congress.gov for the bill; the Senate&apos;s Lobbying Disclosure Act filings; the House Clerk&apos;s and the Senate&apos;s roll calls; the FEC&apos;s independent expenditures and candidate totals.</li>
        <li>Lobbying: a filing names the bill when H.R. 1 of the 119th Congress is among its bills. Each client, registrant and quarter counts once, the latest amendment replacing the report it corrects. Dollars are the income a firm reported or the expenses a self-filer reported.</li>
        <li>Outside money: independent expenditures marked oppose, in the 2026 cycle, through the latest filings.</li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
