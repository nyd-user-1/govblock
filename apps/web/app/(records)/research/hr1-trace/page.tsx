import type { Metadata } from "next"
import Link from "next/link"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import { hr1Study } from "@/lib/reports/hr1"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { SourcesCited, Trace, TraceStep } from "@/components/reports/trace"
import { Table } from "@/components/typeset"

// Trace: H.R. 1 of the 119th Congress across four records — the bill, its
// lobbying, both chambers' votes, the outside money after (2026-09-17).

const title = "H.R. 1, from the lobbyists to the vote to the money"
export const metadata: Metadata = { title, description: "The most-lobbied bill of the 119th Congress, followed across the bill's record, its lobbying disclosures, both chambers' roll calls and the FEC." }
export const revalidate = 86400

const money = (x: number) => (x >= 1e9 ? `$${(x / 1e9).toFixed(2)} billion` : `$${(x / 1e6).toFixed(1)} million`)
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

const SOURCES = [
  { title: "congress.gov: H.R. 1, 119th Congress", url: "https://www.congress.gov/bill/119th-congress/house-bill/1" },
  { title: "Senate Lobbying Disclosure Act filings", url: "https://lda.senate.gov/filings/public/filing/search/" },
  { title: "House Clerk: roll call 145, May 22, 2025", url: "https://clerk.house.gov/evs/2025/roll145.xml" },
  { title: "House Clerk: roll call 190, July 3, 2025", url: "https://clerk.house.gov/evs/2025/roll190.xml" },
  { title: "Senate: roll call vote 372, 119th Congress, 1st session", url: "https://www.senate.gov/legislative/LIS/roll_call_votes/vote1191/vote_119_1_00372.htm" },
  { title: "FEC: independent expenditures, 2026 cycle", url: "https://www.fec.gov/data/independent-expenditures/?two_year_transaction_period=2026" },
]

export default async function Hr1TraceReport() {
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
      description="The most-lobbied bill of the 119th Congress, followed across four records in the order the work was done: the bill, the lobbying disclosures that named it, both chambers' roll calls, and the outside money in the cycle after."
      slug="/research/hr1-trace"
      previous={{ name: "Research", url: "/research" }}
      next={{ name: "Open primaries", url: "/research/open-primaries" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "The bill", url: "#bill", depth: 2 },
            { title: "The lobbying", url: "#lobbying", depth: 2 },
            { title: "The House", url: "#house", depth: 2 },
            { title: "The Senate", url: "#senate", depth: 2 },
            { title: "The money after", url: "#money", depth: 2 },
            { title: "What it adds up to", url: "#synthesis", depth: 2 },
          ]}
        />
      }
    >
      <p>
        {b?.popular_title ? `The ${b.popular_title}` : "H.R. 1"} went from introduction to law in {b ? days(b.introduced_date, b.latest_action_date) : "—"} days. More lobbying disclosures named it than any other bill of the Congress, it passed the House by one vote and the Senate on the Vice President&apos;s, and the Republican who voted against it
        twice drew more outside money against him than all but {Math.max(0, m.rank - 1)} of his House Republican colleagues.
      </p>
      <SourcesCited sources={SOURCES} />

      <Trace>
        <TraceStep
          id="bill"
          mark="CG"
          source="congress.gov"
          did="The bill's record: its title, sponsor, dates and the law it became."
          returned={
            b && (
              <ul>
                <li>{b.display_title}</li>
                <li>Sponsor: {b.sponsor_name}. Policy area: {b.policy_area}.</li>
                <li>
                  Introduced {fmtDate(b.introduced_date)}; {b.latest_action.replace(/\.$/, "")}, {fmtDate(b.latest_action_date)}.
                </li>
              </ul>
            )
          }
          reading={`The introduction date and the law's date bound the trace. The lobbying, the votes and the money are each read against those ${b ? days(b.introduced_date, b.latest_action_date) : ""} days, not against the Congress as a whole.`}
          output={
            <p>
              A reconciliation bill, introduced {b ? fmtDate(b.introduced_date) : ""}, signed {b ? fmtDate(b.latest_action_date) : ""}: <Link href="/bills/us">the record of the 119th Congress</Link> holds it as Public Law 119-21.
            </p>
          }
        />

        <TraceStep
          id="lobbying"
          mark="LDA"
          source="Lobbying disclosures"
          did="Every Lobbying Disclosure Act filing that named H.R. 1, and the money each reported."
          returned={
            <>
              <p>
                {fmtNumber(s.lobbying.named)} filings named the bill; the next most-named of the Congress, {s.lobbying.nextKey.replace(/^119-/, "").replace("-", " ")}, drew {fmtNumber(s.lobbying.nextFilings)}. With amendments folded into the filings they replace, {fmtNumber(s.lobbying.filings)} quarterly reports from {fmtNumber(s.lobbying.clients)} clients and {fmtNumber(s.lobbying.firms)} registrants, reporting {money(s.lobbying.dollars)} in lobbying spending.
              </p>
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
            </>
          }
          reading="A disclosure reports one figure for the quarter: what the client spent lobbying on everything, of which H.R. 1 was one item. So the dollars are the total spent by the clients who lobbied on the bill, in the quarters they lobbied on it: the money in the room, not a price on the bill. An amendment replaces the report it corrects, so each client, firm and quarter is counted once."
          output={
            <p>
              {money(s.lobbying.dollars)} in reported lobbying spending by {fmtNumber(s.lobbying.clients)} clients who named the bill, on about {Math.round(ratio)} times as many filings as the next most-lobbied bill. The peak was {s.peak.label}{s.peak.label === "2025 Q2" ? ", the quarter it passed the House" : ""}: {money(s.peak.dollars)} from {fmtNumber(s.peak.clients)} clients.
            </p>
          }
        >
          <ReportChart spec={s.charts[0]} />
        </TraceStep>

        <TraceStep
          id="house"
          mark="HSE"
          source="The House Clerk"
          did="The House's roll calls on H.R. 1, and every member's position."
          returned={
            <>
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
              <p>Republicans who did not vote yes on passage or on concurring:</p>
              <ul>
                {s.dissent.map((d) => (
                  <li key={`${d.roll}-${d.peopleId}`}>
                    <Link href={memberHref(d.peopleId, "US")}>{d.name}</Link> ({d.state}), roll {d.roll}: {d.cast}
                  </li>
                ))}
              </ul>
            </>
          }
          reading="Every Democrat voted no both times, so the margin was made inside the majority. A member who voted no at passage and again at the final vote is the one whose position cannot be read as a protest about a draft."
          output={
            <p>
              {passage ? `Passed ${passage.yea}–${passage.nay} on ${fmtDate(passage.date)}` : ""}
              {concur ? `; agreed to the Senate's version ${concur.yea}–${concur.nay} on ${fmtDate(concur.date)}` : ""}. {noTwice.length ? `${noTwice.join(" and ")} voted no both times.` : ""}
            </p>
          }
        />

        <TraceStep
          id="senate"
          mark="SEN"
          source="The Senate"
          did="The Senate's roll calls on H.R. 1, from its own XML."
          returned={
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
          }
          reading="Debate on a reconciliation bill is limited but amendment votes are not, so the count of roll calls measures the fight over the text, and the number agreed to measures how much of that fight changed it."
          output={
            <p>
              {fmtNumber(s.senateVotes)} roll calls across {s.senateDays.length} days of voting.{" "}
              {senatePassage ? `Passed ${senatePassage.yea}–${senatePassage.nay} on ${fmtDate(senatePassage.date)}${senatePassage.tie_breaker ? `, the ${senatePassage.tie_breaker.replace(/ of the United States$/, "")} breaking the tie` : ""}.` : ""}
            </p>
          }
        />

        <TraceStep
          id="money"
          mark="FEC"
          source="The FEC"
          did="Independent expenditures in the 2026 cycle for and against the House Republicans, and the no voter's own receipts."
          returned={
            <>
              <p>Spent against Thomas Massie, 2026 cycle:</p>
              <ul>
                {m.opposed.map((o) => (
                  <li key={o.committee}>
                    {o.committee}: {money(o.total)}
                  </li>
                ))}
              </ul>
              <p>
                His own receipts: {money(m.receipts2024)} in 2024, {money(m.receipts2026)} so far in 2026; unitemized small gifts {money(m.small2024)} and {money(m.small2026)}.
              </p>
            </>
          }
          reading="Money against a member after a vote is not proof the vote caused it; the filings say whom a group opposed, not why. What the record does show is the order: the no votes came first, and the spending against him, and his own small-dollar money, came after."
          output={
            <p>
              {money(opposed)} spent against Massie in the 2026 cycle, the {m.rank === 1 ? "most" : `${m.rank === 2 ? "second" : m.rank === 3 ? "third" : `${m.rank}th`}-most`} against any House Republican; his unitemized receipts rose from {money(m.small2024)} to {money(m.small2026)}.
            </p>
          }
        >
          <ReportChart spec={s.charts[1]} />
        </TraceStep>

        <TraceStep
          id="synthesis"
          mark="GB"
          source="The Clerk"
          synthesis
          did="The four records, put together."
          returned={
            <ul>
              <li>The bill was lobbied by more clients than any other of the Congress, {money(s.lobbying.dollars)} of reported spending among them, and the lobbying peaked in the quarter it passed.</li>
              <li>It passed each chamber with no margin to spare: one vote in the House, the Vice President&apos;s in the Senate.</li>
              <li>The one House Republican who voted against it at both votes became one of the most opposed members of his party in the next cycle, and raised more from small donors than he had in 2024.</li>
            </ul>
          }
          output={
            <p>
              On the most-lobbied bill of the Congress, the margin was a single vote in each chamber, and the record shows what followed for the member who withheld his: more money spent against him than against almost any other House Republican, and more small gifts to him than in 2024.
            </p>
          }
        />
      </Trace>

      <p className="text-sm text-muted-foreground">Counted from the record when the page is built, at most once a day. Data and findings are CC BY 4.0.</p>
    </DocsPage>
  )
}
