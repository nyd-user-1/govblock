import type { Metadata } from "next"
import Link from "next/link"

import { memberHref } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { fecStudy } from "@/lib/reports/fec"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Numbered: where the money of the members of Congress in the record came
// from in the 2024 cycle, FEC data alone (2026-09-17).

const title = "Where Congress's money comes from"
export const metadata: Metadata = { title, description: "The 2024 cycle from the FEC's own numbers: out-of-state money, small and large gifts, and the outside spending aimed at members." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 100)}%`
const money = (x: number) => (x >= 1e9 ? `$${(x / 1e9).toFixed(2)} billion` : `$${(x / 1e6).toFixed(1)} million`)

export default async function FecMoneyReport() {
  const s = await fecStudy()
  const g = (chamber: string, party: string) => s.groups.find((x) => x.chamber === chamber && x.party === party)
  const size = (chamber: string, party: string) => s.sizeRows.find((r) => r.chamber === chamber && r.party === party)
  const houseD = g("House", "D")
  const houseR = g("House", "R")
  const senD = g("Senate", "D")
  const senR = g("Senate", "R")
  const ie = s.outside
  const top = s.targets[0]

  return (
    <DocsPage
      title={title}
      description={`The 2024 cycle for ${fmtNumber(s.members)} members of Congress in the record, from the FEC's own numbers: where the money came from, in what size of gift, and what outside groups spent for and against them.`}
      slug="/reports/fec-money"
      previous={{ name: "Reports", url: "/reports" }}
      next={{ name: "Government forms", url: "/reports/government-forms" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. Out-of-state money", url: "#out-of-state", depth: 2 },
            { title: "2. Small gifts and large ones", url: "#size", depth: 2 },
            { title: "3. Outside spending", url: "#outside", depth: 2 },
            { title: "4. Counting rules", url: "#rules", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          {houseD && houseR && senD && senR && (
            <li>
              Half or more of a member&apos;s itemized money came from out of state: {pct(houseD.pooled)} for House Democrats, {pct(houseR.pooled)} for House Republicans, and {pct(senD.pooled)} and {pct(senR.pooled)} in the Senate.
            </li>
          )}
          {size("House", "D") && size("House", "R") && size("Senate", "D") && size("Senate", "R") && (
            <li>
              Gifts of $200 or less were {pct(size("House", "R")!.small)} of House Republicans&apos; money and {pct(size("House", "D")!.small)} of House Democrats&apos;; in the Senate, {pct(size("Senate", "D")!.small)} of Democrats&apos; and {pct(size("Senate", "R")!.small)} of Republicans&apos;. Gifts of $2,000 or more
              were the largest single band in the House.
            </li>
          )}
          <li>
            Outside groups spent {money(ie.oppose)} against members and {money(ie.support)} for them: {pct(ie.oppose / (ie.oppose + ie.support))} of it was spent against.
            {top ? ` The most opposed was ${top.name}, with ${money(top.oppose)} against.` : ""}
          </li>
        </ul>
      </div>

      <H2 id="out-of-state">1. Out-of-state money</H2>
      <p>
        A member&apos;s itemized receipts carry the donor&apos;s state. Pooled across each group, about half of House money and about two-thirds of Senate money came from outside the member&apos;s own state. In the House the median member took less than the pooled share
        {houseD && houseR ? ` (${pct(houseD.median)} for Democrats, ${pct(houseR.median)} for Republicans)` : ""}, because the members who raise the most raise it nationally.
      </p>
      <ReportChart spec={s.charts[0]} />
      <p>The members who raised over $1 million and took the largest share of it from outside their state:</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[50%]">Member</th>
            <th>Seat</th>
            <th className="text-right">Itemized, 2024</th>
            <th className="pr-8 text-right">Out of state</th>
          </tr>
        </thead>
        <tbody>
          {s.topOut.map((m) => (
            <tr key={m.peopleId}>
              <td>
                <Link href={memberHref(m.peopleId, "US")}>{m.name}</Link>
              </td>
              <td className="whitespace-nowrap">
                {m.party}-{m.district}
              </td>
              <td className="text-right tabular-nums">{money(m.total)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(m.share)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="size">2. Small gifts and large ones</H2>
      <p>
        The FEC sorts receipts into five bands by the size of the gift. Senators draw a larger share from gifts of $200 or less than House members do. In the House the largest band is gifts of $2,000 or more; in the Senate it is gifts of $200 or less.
      </p>
      <ReportChart spec={s.charts[1]} />
      <p>The members with the largest share of their money in gifts of $200 or less, among those who raised over $1 million:</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[50%]">Member</th>
            <th>Seat</th>
            <th className="text-right">Raised, 2024</th>
            <th className="pr-8 text-right">$200 or less</th>
          </tr>
        </thead>
        <tbody>
          {s.topSmall.map((m) => (
            <tr key={m.peopleId}>
              <td>
                <Link href={memberHref(m.peopleId, "US")}>{m.name}</Link>
              </td>
              <td className="whitespace-nowrap">
                {m.party}-{m.district}
              </td>
              <td className="text-right tabular-nums">{money(m.total)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(m.share)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="outside">3. Outside spending</H2>
      <p>
        Independent expenditures are made by groups that may not coordinate with a campaign, and each is filed as for or against a candidate. In 2024, {pct(ie.oppose / (ie.oppose + ie.support))} of the outside money aimed at members of Congress in the record was spent against them. {s.targets.filter((t) => t.senate).length === s.targets.length ? `All ${s.targets.length}` : `${s.targets.filter((t) => t.senate).length} of the ${s.targets.length}`} most opposed
        members were senators.
      </p>
      <ReportChart spec={s.charts[2]} />
      <p>The groups that spent the most on these members, for and against combined:</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[60%]">Committee</th>
            <th className="text-right">Members</th>
            <th className="pr-8 text-right">Spent, 2024</th>
          </tr>
        </thead>
        <tbody>
          {s.spenders.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(c.members)}</td>
              <td className="pr-8 text-right tabular-nums">{money(c.total)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="rules">4. Counting rules</H2>
      <ul>
        <li>Source: the FEC&apos;s receipts by state, receipts by size and independent expenditures for the 2024 cycle, for every member of Congress in the record with a 2024 committee. Members who left Congress after 2024 are included.</li>
        <li>A member&apos;s state is the state of their seat. Out-of-state shares use itemized receipts, which carry a donor&apos;s state; unitemized gifts do not.</li>
        <li>Size bands are the FEC&apos;s: $200 and under (itemized and unitemized), $200.01–$499.99, $500–$999.99, $1,000–$1,999.99, and $2,000 and over.</li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
