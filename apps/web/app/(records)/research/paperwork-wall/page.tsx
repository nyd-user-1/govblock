import type { Metadata } from "next"

import { fmtNumber } from "@/lib/format"
import { paperworkStudy } from "@/lib/reports/paperwork"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { ReportChart } from "@/components/reports/report-chart"
import { H2, Table } from "@/components/typeset"

// Research recipe report #6 (2026-09-18): the paper applications that stand
// between a New Yorker and SNAP, Medicaid, heat, child care and cash help.

const title = "The paperwork wall: New York's benefit applications run to dozens of pages, and almost none can be typed into"
export const metadata: Metadata = { title: "The paperwork wall", description: "The paper applications for SNAP, Medicaid, heating assistance, child care, cash help and SSI, every version of each, measured page by page and field by field." }
export const revalidate = 86400

const pct = (x: number) => `${Math.round(x * 100)}%`

export default async function PaperworkWallReport() {
  const s = await paperworkStudy()
  const a = (form: string) => s.applications.find((x) => x.form === form)!
  const combined = a("LDSS-2921")
  const medicaid = a("DOH-4220")
  const heap = a("LDSS-3421")
  const childcare = a("OCFS-LDSS-4699")
  const copies = s.applications.reduce((t, x) => t + x.copies, 0)
  const fillable = s.applications.reduce((t, x) => t + x.fillable, 0)
  const family = combined.pages + heap.pages + childcare.pages

  return (
    <DocsPage
      title={title}
      description={`The paper applications for seven programs a New Yorker in need may apply to, ${fmtNumber(copies)} versions in all, measured page by page and field by field from GovBlock's forms harvest.`}
      slug="/research/paperwork-wall"
      previous={{ name: "The primary is the election", url: "/research/primary-is-the-election" }}
      next={{ name: "Research", url: "/research" }}
      rail={
        <DocsTableOfContents
          toc={[
            { title: "Key takeaways", url: "#takeaways", depth: 2 },
            { title: "1. The applications", url: "#applications", depth: 2 },
            { title: "2. A family's stack", url: "#family", depth: 2 },
            { title: "3. Around each program", url: "#programs", depth: 2 },
            { title: "4. Method and gaps", url: "#method", depth: 2 },
          ]}
        />
      }
    >
      <div id="takeaways" className="rounded-xl border bg-card p-5">
        <p className="mt-0 font-semibold">Key takeaways</p>
        <ul className="mb-0">
          <li>
            Of {fmtNumber(copies)} versions of seven benefit applications, in every language and format the agencies publish, {fmtNumber(fillable)} can be typed into. The Medicaid application alone comes in {fmtNumber(medicaid.copies)} versions, and {medicaid.fillable === 0 ? "none" : fmtNumber(medicaid.fillable)} of them is fillable.
          </li>
          <li>
            A family applying for cash help, SNAP and Medicaid on the combined form, then for heating assistance and child care, faces about {fmtNumber(family)} pages: {combined.pages} for {combined.form}, {heap.pages} for {heap.form} and {childcare.pages} for {childcare.form}.
          </li>
          <li>
            The large-print versions run longest: {fmtNumber(medicaid.longest)} pages for the Medicaid application.
          </li>
        </ul>
      </div>

      <H2 id="applications">1. The applications</H2>
      <p>
        Each program has its own application, published by the agency that runs it, most of them in many languages and formats. A PDF with form fields can be filled in on a screen and printed clean; one without them has to be printed and written on, or marked up with other software. Across these seven applications the fillable versions are the exception.
      </p>
      <ReportChart spec={s.charts[0]} />
      <Table>
        <thead>
          <tr>
            <th className="w-[20%]">Form</th>
            <th className="w-[34%]">Program</th>
            <th className="text-right">Pages</th>
            <th className="text-right">Versions</th>
            <th className="text-right">Fillable</th>
            <th className="pr-8 text-right">From the Archive</th>
          </tr>
        </thead>
        <tbody>
          {s.applications.map((x) => (
            <tr key={x.form}>
              <td className="whitespace-nowrap">{x.form}</td>
              <td>{x.program}</td>
              <td className="text-right tabular-nums">{x.pages}</td>
              <td className="text-right tabular-nums">{x.copies}</td>
              <td className="text-right tabular-nums">{x.fillable}</td>
              <td className="pr-8 text-right tabular-nums">{x.archive}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="family">2. A family&apos;s stack</H2>
      <p>
        New York&apos;s combined application, {combined.form}, lets one form cover cash assistance, SNAP, Medicaid and services; it is {combined.pages} pages, and {combined.fillable} of its {combined.copies} versions are fillable. Heating assistance and child care assistance each need their own. For a household
        that needs all of them, the paper runs to about {fmtNumber(family)} pages before a single document is attached.
      </p>

      <H2 id="programs">3. Around each program</H2>
      <p>Beyond the applications, every form in the harvest whose title or file names the program: notices, renewals, supplements, instructions and the agencies&apos; own policy papers.</p>
      <Table>
        <thead>
          <tr>
            <th className="w-[34%]">Program</th>
            <th className="text-right">PDFs</th>
            <th className="text-right">Fillable</th>
            <th className="text-right">Pages</th>
            <th className="pr-8 text-right">From the Archive</th>
          </tr>
        </thead>
        <tbody>
          {s.byProgram.map((p) => (
            <tr key={p.program}>
              <td>{p.program}</td>
              <td className="text-right tabular-nums">{fmtNumber(p.n)}</td>
              <td className="text-right tabular-nums">{pct(p.n ? p.fillable / p.n : 0)}</td>
              <td className="text-right tabular-nums">{fmtNumber(p.pages)}</td>
              <td className="pr-8 text-right tabular-nums">{fmtNumber(p.archive)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2 id="method">4. Method and gaps</H2>
      <ul>
        <li>
          <b>Source.</b> GovBlock&apos;s harvest of agency forms pages, August 30, 2026: federal, New York State and New York City. Each PDF was opened for its page count and form fields.
        </li>
        <li>
          <b>Applications.</b> Found by form number in the title or file name; every language and format version is a copy. Pages are the most common page count among the standard (not large-print) versions.
        </li>
        <li>
          <b>Fillable.</b> A PDF with at least one form field. From the Archive means the copy GovBlock holds is the Internet Archive&apos;s capture of the agency&apos;s address.
        </li>
        <li>
          <b>Gaps.</b> New York takes several of these applications online, through myBenefits, ACCESS HRA in New York City and NY State of Health; this report measures the paper forms, which remain the route for anyone who cannot or does not apply online. Program counts in section 3 match on words, so they include policy papers alongside forms.
        </li>
        <li>Recounted when the page is built, at most once a day. Data and findings are CC BY 4.0.</li>
      </ul>
    </DocsPage>
  )
}
