import type { Metadata } from "next"

import { fmtDate, fmtNumber } from "@/lib/format"
import { OUTCOME_LABEL, obbbStudy } from "@/lib/reports/obbb"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Research recipe report #2 (2026-09-18): the lobbyists' asks on H.R. 1,
// provision by provision, against the enacted text of Public Law 119-21.

const title = "Who wrote the One Big Beautiful Bill? Business asks became permanent law; clean energy, Medicaid and the AI moratorium lost"
export const metadata: Metadata = { title: "Who wrote the One Big Beautiful Bill?", description: "Every provision the lobbyists who named H.R. 1 asked about, set against what Public Law 119-21 actually says." }
export const revalidate = 86400

export default async function WhoWroteObbbReport() {
  const s = await obbbStudy()
  const p = (key: string) => s.provisions.find((x) => x.key === key)!
  const clean = p("clean")
  const medicaid = p("medicaid")
  const ai = p("ai")
  const s899 = p("s899")
  const busiest = s.provisions[0]
  const businessAsks = ["rnd", "bonus", "passthrough", "estate", "oz", "lihtc"].map(p)

  return (
    <DocsPage
      title={title}
      description={`${fmtNumber(s.totals.clients)} clients named H.R. 1 in ${fmtNumber(s.totals.filings)} lobbying filings. This report reads what they said they lobbied on, sorts it into twenty provisions, and checks each against the enacted text of Public Law 119-21.`}
      slug="/research/who-wrote-obbb"
      previous={{ name: "Crypto money and the crypto votes", url: "/research/crypto-money" }}
      next={{ name: "Copy-and-paste lawmaking", url: "/research/model-bills" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. What the lobbyists asked about", url: "#asks", depth: 2 },
            { title: "2. What became permanent", url: "#enacted", depth: 2 },
            { title: "3. What was cut", url: "#cut", depth: 2 },
            { title: "4. What was dropped", url: "#dropped", depth: 2 },
            { title: "5. The Senate floor", url: "#senate", depth: 2 },
            { title: "6. Every provision", url: "#provisions", depth: 2 },
            { title: "7. Method and gaps", url: "#method", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            The business tax asks became permanent law: full expensing, immediate R&amp;D deductions, the pass-through deduction, a $15 million estate tax exemption and permanent opportunity zones. {fmtNumber(businessAsks.reduce((a, x) => a + x.clients, 0))} client entries lobbied on those six, and every one is in the law.
          </li>
          <li>
            Clean energy drew {fmtNumber(clean.clients)} clients{busiest.key === "clean" ? ", more than any other provision" : ""}, and the law ended the wind, solar and EV credits anyway. Medicaid drew {fmtNumber(medicaid.clients)}, led by hospital associations, and got work requirements and provider-tax limits, softened by a $50 billion rural health fund.
          </li>
          <li>
            Three provisions were dropped entirely: the state AI moratorium, struck 99–1 after {fmtNumber(ai.clients)} clients lobbied on it; the Section 899 retaliatory tax, which {fmtNumber(s899.clients)} clients lobbied on, foreign-owned companies among them; and the tax on litigation funding.
          </li>
        </ul>
      </div>

      <H2 id="asks">1. What the lobbyists asked about</H2>
      <p>
        A lobbying disclosure names the bills a client lobbied on and describes the issues in its own words: &ldquo;full restoration of Sec. 174 R&amp;D tax deduction&rdquo;, &ldquo;Section 899 of H.R. 1&rdquo;, &ldquo;SNAP provisions in H.R. 1&rdquo;. {fmtNumber(s.totals.clients)} clients named H.R. 1. Their descriptions were read against a codebook of twenty provisions, each defined by the
        words that name it, and each provision&apos;s fate was then read in the enacted law.
      </p>
      <ReportChart spec={s.charts[0]} />

      <H2 id="enacted">2. What became permanent</H2>
      <p>
        The 2017 tax law&apos;s business provisions were set to expire or phase down. The asks were to make them permanent, and the law did, often going further: full expensing permanent, research spending deductible at once, the estate tax exemption raised to $15 million and indexed, opportunity zones renewed every ten years. The SALT cap, which the real
        estate and accounting lobbies pressed, went from $10,000 to $40,000.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[28%]">Provision</th>
            <th className="text-right">Clients</th>
            <th className="pr-8">What the law did</th>
          </tr>
        </thead>
        <tbody>
          {s.enacted.map((x) => (
            <tr key={x.key}>
              <td>{x.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(x.clients)}</td>
              <td className="pr-8">{x.law}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="cut">3. What was cut</H2>
      <p>
        The law cut four programs that drew heavy lobbying. Clean energy drew {fmtNumber(clean.clients)} clients, utilities, carmakers and oil companies among them, and the law ended the credits for wind, solar and electric vehicles while extending the clean fuel credit. An amendment to end the wind and solar credits outright failed 21–79 in the Senate; one to keep them
        at parity failed 47–53. Medicaid&apos;s lobbying was led by hospital associations; the law added work requirements and capped the provider taxes states use to fund their share.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[24%]">Provision</th>
            <th className="text-right">Clients</th>
            <th className="w-[28%]">Most filings</th>
            <th className="pr-8">What the law did</th>
          </tr>
        </thead>
        <tbody>
          {s.cut.map((x) => (
            <tr key={x.key}>
              <td>{x.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(x.clients)}</td>
              <td className="text-sm">{x.top.map((t) => t.client).join("; ")}</td>
              <td className="pr-8">{x.law}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="dropped">4. What was dropped</H2>
      <p>
        Three provisions in the House bill or the Senate draft are not in the law. The moratorium on state AI laws, a condition on broadband funding, drew {fmtNumber(ai.clients)} clients whose filings name it, and was struck 99–1. Section 899, a tax on investors from countries with taxes the Treasury deems unfair, drew real estate funds, asset managers and foreign-owned companies such as Philips and IHG&apos;s U.S. hotel arm, and it is gone.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[24%]">Provision</th>
            <th className="text-right">Clients</th>
            <th className="w-[28%]">Most filings</th>
            <th className="pr-8">What the law did</th>
          </tr>
        </thead>
        <tbody>
          {s.dropped.map((x) => (
            <tr key={x.key}>
              <td>{x.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(x.clients)}</td>
              <td className="text-sm">{x.top.map((t) => t.client).join("; ")}</td>
              <td className="pr-8">{x.law}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="senate">5. The Senate floor</H2>
      <p>The Senate&apos;s amendment votes on the bill, where the text was last changed. Only the AI moratorium&apos;s removal and the final substitutes were agreed to.</p>
      <Table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="w-[52%]">Amendment</th>
            <th className="text-right">Yea–Nay</th>
            <th className="pr-8">Result</th>
          </tr>
        </thead>
        <tbody>
          {s.amendments.map((a) => (
            <tr key={a.roll}>
              <td className="whitespace-nowrap">{fmtDate(a.day)}</td>
              <td>
                {a.amendment}: {a.purpose}
              </td>
              <td className="text-right whitespace-nowrap tabular-nums">
                {a.yea}–{a.nay}
              </td>
              <td className="pr-8">{a.result.replace(/^Amendment |^Motion /, "")}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="provisions">6. Every provision</H2>
      <Table>
        <thead>
          <tr>
            <th className="w-[24%]">Provision</th>
            <th className="text-right">Clients</th>
            <th className="text-right">Filings</th>
            <th className="pr-8">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {s.provisions.map((x) => (
            <tr key={x.key}>
              <td>{x.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(x.clients)}</td>
              <td className="text-right tabular-nums">{fmtNumber(x.filings)}</td>
              <td className="pr-8">{OUTCOME_LABEL[x.outcome]}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="method">7. Method and gaps</H2>
      <ul>
        <li>
          <b>Question.</b> Of the provisions the lobbyists who named H.R. 1 asked about, which made it into the law? Built by GovBlock&apos;s research recipe.
        </li>
        <li>
          <b>Lobbying.</b> Every Lobbying Disclosure Act filing that names H.R. 1 of the 119th Congress; {fmtNumber(s.totals.described)} carry issue descriptions. A description is matched to a provision by the words that name it (the codebook is in the report&apos;s source); one description can name several provisions. Clients are counted once per provision.
        </li>
        <li>
          <b>Outcomes.</b> Read in the enacted text, <a href="https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm">Public Law 119-21</a>, and cited to its section. &ldquo;Dropped&rdquo; means the provision&apos;s language appears nowhere in the law. Senate amendment votes are the Senate&apos;s own roll calls.
        </li>
        <li>
          <b>Gaps.</b> A disclosure says what a client lobbied on, not which side it took; a hospital lobbying on Medicaid and a think tank lobbying on Medicaid count alike. &ldquo;Against the sector&apos;s asks&rdquo; is the report&apos;s reading of who lobbied most, not a filed position. Lobbying on what was dropped before the bill was introduced does not appear.
        </li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
