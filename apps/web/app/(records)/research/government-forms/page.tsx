import type { Metadata } from "next"

import { fmtNumber } from "@/lib/format"
import { formsStudy } from "@/lib/reports/forms"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Numbered: the forms harvest alone (2026-09-17) — how many PDFs, how long,
// how few can be typed into, and where the copy came from.

const title = "Government forms: how few can be filled in"
export const metadata: Metadata = { title, description: "Federal, New York State and New York City forms, opened and measured: pages, fillable fields, and where the copy came from." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`

export default async function GovernmentFormsReport() {
  const s = await formsStudy()
  const fillShare = s.inspected ? s.fillable / s.inspected : 0
  const archiveShare = s.total ? s.archive / s.total : 0
  const byArchive = [...s.byAgency].sort((a, b) => b.archiveShare - a.archiveShare)
  const mostArchived = byArchive[0]
  const byFill = [...s.byAgency].sort((a, b) => b.fillableShare - a.fillableShare)
  const longest = [...s.byAgency].sort((a, b) => b.avgPages - a.avgPages)[0]

  return (
    <DocsPage
      title={title}
      description={`${fmtNumber(s.total)} PDFs catalogued from federal, New York State and New York City agencies, ${fmtNumber(s.inspected)} of them opened and measured.`}
      slug="/research/government-forms"
      previous={{ name: "Where Congress's money comes from", url: "/research/fec-money" }}
      next={{ name: "Research", url: "/research" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. What was collected", url: "#collected", depth: 2 },
            { title: "2. Fillable or not", url: "#fillable", depth: 2 },
            { title: "3. Where the copy came from", url: "#copy", depth: 2 },
            { title: "4. How long they are", url: "#length", depth: 2 },
            { title: "5. Counting rules", url: "#rules", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            Only {pct(fillShare)} of the PDFs opened ({fmtNumber(s.fillable)} of {fmtNumber(s.inspected)}) have a single field a person can type into.
          </li>
          <li>
            For {pct(archiveShare)} of them ({fmtNumber(s.archive)}), the copy GovBlock holds came from the Internet Archive rather than the agency.{mostArchived ? ` For ${mostArchived.name} it was ${pct(mostArchived.archiveShare)}.` : ""}
          </li>
          <li>
            Together they run to {fmtNumber(s.pages)} pages. Half are {s.medianPages <= 1 ? "a single page" : `${Math.round(s.medianPages)} pages or fewer`}{longest ? `; ${longest.name}'s average ${Math.round(longest.avgPages)}, the longest of any large publisher` : ""}.
          </li>
        </ul>
      </div>

      <H2 id="collected">1. What was collected</H2>
      <p>
        The harvest of August 30, 2026 catalogued every PDF it could find on the forms and publications pages of federal, New York State and New York City agencies: {fmtNumber(s.total)} in all, {fmtNumber(s.fetched)} of them downloaded and stored. Not every one is a form; the catalogue also caught
        guidance, notices and public comments. {fmtNumber(s.distinctFiles)} of the {fmtNumber(s.hashed)} files with a fingerprint are distinct; the rest are the same file posted more than once.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[34%]">Government</th>
            <th className="text-right">PDFs</th>
            <th className="text-right">Opened</th>
            <th className="text-right">Fillable</th>
            <th className="pr-8 text-right">Pages</th>
          </tr>
        </thead>
        <tbody>
          {s.govs.map((g) => (
            <tr key={g.gov}>
              <td>{g.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(g.n)}</td>
              <td className="text-right tabular-nums">{fmtNumber(g.inspected)}</td>
              <td className="text-right tabular-nums">{pct(g.inspected ? g.fillable / g.inspected : 0)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(g.pages)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="fillable">2. Fillable or not</H2>
      <p>
        A fillable PDF carries form fields: boxes the reader types into before saving or printing. Among the largest publishers, {byFill[0]?.name} does best at {pct(byFill[0]?.fillableShare ?? 0)}; {byFill[byFill.length - 1]?.name} does least, at {pct(byFill[byFill.length - 1]?.fillableShare ?? 0)}.
      </p>
      <ReportChart spec={s.charts[0]} />

      <H2 id="copy">3. Where the copy came from</H2>
      <p>
        The harvest took each copy either from the agency&apos;s own address or from the Internet Archive&apos;s capture of that address, and it recorded which. For some agencies nearly every copy came from the Archive; for others almost none did.
      </p>
      <ReportChart spec={s.charts[1]} />

      <H2 id="length">4. How long they are</H2>
      <p>Most are short: {fmtNumber(s.inspected)} were counted, and the middle one runs {Math.round(s.medianPages)} {Math.round(s.medianPages) === 1 ? "page" : "pages"}. The longest are not forms at all: the very largest are public comment dockets, running to thousands of pages.</p>
      <ReportChart spec={s.charts[2]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[46%]">Agency</th>
            <th className="text-right">PDFs</th>
            <th className="text-right">Median pages</th>
            <th className="text-right">Fillable</th>
            <th className="pr-8 text-right">From the Archive</th>
          </tr>
        </thead>
        <tbody>
          {s.byAgency.map((a) => (
            <tr key={a.key}>
              <td>{a.name}</td>
              <td className="text-right tabular-nums">{fmtNumber(a.n)}</td>
              <td className="text-right tabular-nums">{Math.round(a.medianPages)}</td>
              <td className="text-right tabular-nums">{pct(a.fillableShare)}</td>
              <td className="pr-8 text-right tabular-nums">{pct(a.archiveShare)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="rules">5. Counting rules</H2>
      <ul>
        <li>Source: GovBlock&apos;s harvest of agency forms pages, August 30, 2026. Each PDF is one row, whether or not it is a form in the strict sense.</li>
        <li>Opened means the PDF was downloaded and parsed for its page count and fields. Fillable means it has at least one form field.</li>
        <li>From the Archive means the copy held is the Internet Archive&apos;s capture of the agency&apos;s address, as the harvest recorded it. Not retrieved means the harvest has no copy of the file.</li>
        <li>The agency table lists the fourteen largest publishers. Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
