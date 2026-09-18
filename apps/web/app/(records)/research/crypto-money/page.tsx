import type { Metadata } from "next"
import Link from "next/link"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber } from "@/lib/format"
import { CODEBOOK, cryptoStudy } from "@/lib/reports/crypto"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// The first report built by the research recipe (docs/research/recipe.md),
// 2026-09-18: the crypto super PACs' money against the votes on the
// industry's bills.

const title = "Crypto money and the crypto votes: backed House Democrats voted yes twice as often"
export const metadata: Metadata = { title, description: "The crypto industry's super PACs spent nearly $150 million on members of Congress. How the members they backed voted on the GENIUS Act, the CLARITY Act and the Anti-CBDC bill." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 100)}%`
const money = (x: number) => (x >= 1e9 ? `$${(x / 1e9).toFixed(2)} billion` : x >= 1e6 ? `$${(x / 1e6).toFixed(1)} million` : x > 0 ? `$${Math.round(x / 1e3)}K` : "—")
const cast = (v: string | null) => (!v ? "—" : v === "Aye" ? "Yea" : v === "No" ? "Nay" : v)

export default async function CryptoMoneyReport() {
  const s = await cryptoStudy()
  const genius = s.houseDems.find((b) => b.key === "genius")!
  const clarity = s.houseDems.find((b) => b.key === "clarity")!
  const cbdc = s.houseDems.find((b) => b.key === "cbdc")!
  const ratio = (b: typeof genius) => (b.none.share ? b.backed.share / b.none.share : 0)
  const switchedBacked = s.switched.filter((d) => d.backed)
  const crypto = s.byClass[0]
  const banks = s.byClass[1]
  const growth = s.baseline ? s.latest.filings / s.baseline : 0
  const spent = s.spending.support24 + s.spending.oppose24 + s.spending.support26 + s.spending.oppose26
  const houseRepNo = (key: string) => {
    const b = s.houseReps.find((r) => r.key === key)
    return b ? b.backed.no + b.none.no : 0
  }
  const mostReports = [...s.byClass].sort((a, b) => b.reports - a.reports)[0]

  return (
    <DocsPage
      title={title}
      description={`Fairshake, Defend American Jobs and Protect Progress spent ${money(spent)} for and against ${fmtNumber(s.spending.members)} members of Congress in 2024 and 2026. This report sets that money against every member's vote on the industry's bills.`}
      slug="/research/crypto-money"
      previous={{ name: "Research", url: "/research" }}
      next={{ name: "H.R. 1", url: "/research/hr1" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. The money", url: "#money", depth: 2 },
            { title: "2. The House", url: "#house", depth: 2 },
            { title: "3. The Senate", url: "#senate", depth: 2 },
            { title: "4. The lobbying", url: "#lobbying", depth: 2 },
            { title: "5. Every member the PACs spent on", url: "#members", depth: 2 },
            { title: "6. Method and gaps", url: "#method", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            House Democrats the crypto PACs backed voted for the GENIUS Act at {pct(genius.backed.share)} ({genius.backed.yes} of {genius.backed.yes + genius.backed.no}) and the CLARITY Act at {pct(clarity.backed.share)}; Democrats they did not back, at {pct(genius.none.share)} and {pct(clarity.none.share)}. On the Anti-CBDC bill, a party-line
            Republican measure, backed and unbacked Democrats voted the same way: {cbdc.backed.yes} and {cbdc.none.yes} yes.
          </li>
          <li>
            The Senate&apos;s turn on GENIUS does not track the money. {s.switched.length} Democrats who voted against the first cloture motion voted for the second twelve days later; {switchedBacked.length === 0 ? "none" : switchedBacked.length === 1 ? "one" : switchedBacked.length} of them had crypto PAC money behind them
            {switchedBacked.length ? ` (${switchedBacked.map((d) => d.name.split(" ").slice(-1)[0]).join(" and ")})` : ""}.
          </li>
          <li>
            Lobbying filings that name the crypto bills ran at about {Math.round(s.baseline)} a quarter in 2023 and 2024 and reached {fmtNumber(s.latest.filings)} in {s.latest.label}. Since 2025, {fmtNumber(crypto.clients)} crypto companies and groups have filed on them, and {fmtNumber(banks.clients)} banks and credit unions.
          </li>
        </ul>
      </div>

      <H2 id="money">1. The money</H2>
      <p>
        The crypto industry&apos;s political money runs through one super PAC, Fairshake, and two affiliates it funds, Defend American Jobs for Republicans and Protect Progress for Democrats. Fairshake raised about $260 million for 2024, most of its contributions from Coinbase, Ripple, Andreessen Horowitz and its founders, and Jump; it entered the 2026
        cycle with more than $190 million. On members of Congress in GovBlock&apos;s record, the three spent {money(s.spending.support24)} in support and {money(s.spending.oppose24)} in opposition in 2024, and {money(s.spending.support26)} in support so far in 2026.
      </p>
      <ReportChart spec={s.charts[2]} />
      <p>
        The largest single sum, {money(s.roster[0]?.support24 ?? 0)} supporting {s.roster[0]?.name}, was the Ohio Senate race in which the industry&apos;s target was Sherrod Brown, then chair of the Banking Committee. The PACs spent mostly in primaries and safe seats, which is where a small number of dollars decides a seat, and they backed the eventual
        winner in most of their races.
      </p>

      <H2 id="house">2. The House</H2>
      <p>
        On July 17, 2025, the House passed the three bills of its &ldquo;crypto week&rdquo;. Republicans voted for the industry&apos;s two bills almost to a member ({houseRepNo("genius")} voted against GENIUS, {houseRepNo("clarity")} against CLARITY, none of them backed), so the test is among Democrats, whose party split. Democrats the PACs had backed voted for the GENIUS Act {ratio(genius).toFixed(1)} times as often, and for the CLARITY Act{" "}
        {ratio(clarity).toFixed(1)} times as often, as Democrats they had not.
      </p>
      <ReportChart spec={s.charts[0]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[36%]">House Democrats</th>
            <th className="text-right">GENIUS Act</th>
            <th className="text-right">CLARITY Act</th>
            <th className="pr-8 text-right">Anti-CBDC bill</th>
          </tr>
        </thead>
        <tbody>
          {(["backed", "none"] as const).map((grp) => (
            <tr key={grp}>
              <td>{grp === "backed" ? "Backed by the crypto PACs" : "Not backed"}</td>
              {[genius, clarity, cbdc].map((b, i) => (
                <td key={b.key} className={i === 2 ? "pr-8 text-right tabular-nums" : "text-right tabular-nums"}>
                  {b[grp].yes} of {b[grp].yes + b[grp].no} ({pct(b[grp].share)})
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      <p>
        The Anti-CBDC bill is the control. It passed on a party-line vote, and backed Democrats voted against it like the rest of their party. If the backed Democrats were simply more willing to cross to the Republican side, they would have crossed on it too. They did not: the gap appears on the bills that regulate the industry&apos;s own business. What the record cannot show is the direction: the PACs chose members already inclined their way, and a
        yes vote may be why a member was backed rather than what the backing bought.
      </p>

      <H2 id="senate">3. The Senate</H2>
      <p>
        The GENIUS Act&apos;s first cloture motion failed on May 8, 2025, 48–49, every Democrat who voted voting no. On May 20 the second passed 66–32, and the bill passed on June 17, 68–30. {s.switched.length} Democrats switched between the two cloture votes. Only {switchedBacked.length === 1 ? "one" : switchedBacked.length} of them,{" "}
        {switchedBacked.map((d) => d.name).join(" and ")}, had crypto PAC money behind them, each about $10 million in 2024. In the Senate the Democrats moved as a bloc, and on June 12 the Senate adopted a rewritten text, S.Amdt. 2307, 67–30. The money does not separate the Democrats who moved from the ones who did not.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[40%]">Democrats and independents</th>
            <th className="text-right">May 8 cloture</th>
            <th className="text-right">May 20 cloture</th>
            <th className="pr-8 text-right">June 17 passage</th>
          </tr>
        </thead>
        <tbody>
          {s.dems.map((d) => (
            <tr key={d.name}>
              <td>
                {d.peopleId ? <Link href={memberHref(d.peopleId, "US")}>{d.name}</Link> : d.name} ({d.state}){d.backed ? " · backed" : ""}
              </td>
              <td className="text-right">{cast(d.first)}</td>
              <td className="text-right">{cast(d.second)}</td>
              <td className="pr-8 text-right">{cast(d.passage)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="lobbying">4. The lobbying</H2>
      <p>
        Filings that name the crypto bills more than doubled once the 119th Congress took them up: {Math.round(s.baseline)} a quarter on average in 2023 and 2024, {fmtNumber(s.latest.filings)} in {s.latest.label}, {growth.toFixed(1)} times as many. {mostReports.name} filed the most reports; banks, card networks and exchanges lobbied on the same bills.
      </p>
      <ReportChart spec={s.charts[1]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[46%]">Who lobbied, since 2025</th>
            <th className="text-right">Clients</th>
            <th className="text-right">Reports</th>
            <th className="pr-8 text-right">Reported spending</th>
          </tr>
        </thead>
        <tbody>
          {s.byClass.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(c.clients)}</td>
              <td className="text-right tabular-nums">{fmtNumber(c.reports)}</td>
              <td className="pr-8 text-right tabular-nums">{money(c.dollars)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p>
        Reported spending is each client&apos;s total for the quarter across everything it lobbied on, of which the crypto bills were a part; a bank&apos;s figure covers all its lobbying, a crypto firm&apos;s mostly this. The clients with the most reports naming the bills:
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[46%]">Client</th>
            <th>Class</th>
            <th className="text-right">Reports</th>
            <th className="pr-8 text-right">Reported spending</th>
          </tr>
        </thead>
        <tbody>
          {s.topClients.map((c) => (
            <tr key={c.client}>
              <td>{c.client}</td>
              <td>{c.cls}</td>
              <td className="text-right tabular-nums">{fmtNumber(c.reports)}</td>
              <td className="pr-8 text-right tabular-nums">{money(c.dollars)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {s.clarity && (
        <p>
          The CLARITY Act has not become law. Its latest action, {fmtDate(s.clarity.date)}: {s.clarity.action}
        </p>
      )}

      <H2 id="members">5. Every member the PACs spent on</H2>
      <p>Every member of Congress in the record on whom Fairshake, Defend American Jobs or Protect Progress filed an independent expenditure, with the member&apos;s votes. For senators, the GENIUS vote is the Senate&apos;s June 17 passage vote.</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[30%]">Member</th>
            <th className="text-right">For, 2024</th>
            <th className="text-right">For, 2026</th>
            <th className="text-right">Against</th>
            <th className="text-right">GENIUS</th>
            <th className="pr-8 text-right">CLARITY</th>
          </tr>
        </thead>
        <tbody>
          {s.roster.map((m) => (
            <tr key={m.peopleId}>
              <td>
                <Link href={memberHref(m.peopleId, "US")}>{m.name}</Link> ({m.party}-{m.seat})
              </td>
              <td className="text-right tabular-nums">{money(m.support24)}</td>
              <td className="text-right tabular-nums">{money(m.support26)}</td>
              <td className="text-right tabular-nums">{money(m.oppose)}</td>
              <td className="text-right">{cast(m.genius)}</td>
              <td className="pr-8 text-right">{m.chamber === "Senate" ? "n/a" : cast(m.clarity)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="method">6. Method and gaps</H2>
      <ul>
        <li>
          <b>Question.</b> Did the members the crypto super PACs backed vote for the industry&apos;s bills more often than members they did not back? Built by GovBlock&apos;s research recipe: coverage, gather, classify, verify, outside sources, synthesis.
        </li>
        <li>
          <b>Money.</b> The FEC&apos;s independent expenditures by Fairshake (C00835959), Defend American Jobs and Protect Progress, 2024 and 2026 cycles, on members of Congress in GovBlock&apos;s record. Fairshake&apos;s own totals and donors are from <a href="https://www.factcheck.org/2026/08/fairshake-2/">FactCheck.org</a>,{" "}
          <a href="https://www.opensecrets.org/political-action-committees-pacs/fairshake-pac/C00835959/summary/2024">OpenSecrets</a> and <a href="https://www.cnbc.com/2026/01/28/crypto-pac-fairshake-bill-vote.html">CNBC</a>.
        </li>
        <li>
          <b>Classification of members.</b> {CODEBOOK.members.map((m) => `${m.key === "none" ? "Not backed" : m.key[0].toUpperCase() + m.key.slice(1)}: ${m.rule}`).join(" ")}
        </li>
        <li>
          <b>Votes.</b> House roll calls 199 (CLARITY Act, H.R. 3633), 200 (GENIUS Act, S. 1582) and 201 (Anti-CBDC bill, H.R. 1919), July 17, 2025, from the House Clerk; Senate roll calls 240, 262 and 318 on S. 1582 from the Senate&apos;s own records. Yea and Aye count as yes, Nay and No as no.
        </li>
        <li>
          <b>Lobbying.</b> Lobbying Disclosure Act filings whose issue description names GENIUS, CLARITY, the STABLE Act, the Anti-CBDC bill, their numbers, stablecoins or market structure. Clients are sorted by name into {CODEBOOK.clients.map((c) => c.key.toLowerCase()).join(", ")}, and everyone else, the first match deciding. Each client, registrant and quarter counts
          once, the latest amendment replacing the report it corrects.
        </li>
        <li>
          <b>Gaps.</b> The PACs&apos; spending on candidates who are not members of Congress (a losing primary challenger, Katie Porter&apos;s Senate race) is not in GovBlock&apos;s table, so the totals here are for members only. Backing is not proof of purchase: the PACs picked members already on their side, and the record cannot say which came first.
        </li>
        <li>Recounted when the page is built, at most once a day. Outside figures are as of the sources&apos; dates. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
