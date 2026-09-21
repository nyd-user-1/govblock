import Link from "next/link"
import { notFound } from "next/navigation"

import { fmtNumber } from "@/lib/format"
import { fieldName, getForm } from "@/lib/policy/forms-queries"
import { FORMS } from "@/lib/forms/programs"
import { Chip } from "@/components/chip"
import { agencyName } from "@/components/policy/forms-seal"
import { DOCS_DESCRIPTION } from "@/components/docs-header"
import { DocsPage } from "@/components/docs-page"
import { FormsDoc } from "@/components/policy/forms-doc"
import { H2, Table } from "@/components/typeset"
import { Button } from "@govblock/ui/components/ny4/button"

// One form: what we know about it, the PDF, and the fields it asks for.
//
// On DocsPage (Brendan, 2026-09-20). The shell was copied from
// `docs-page.tsx` rather than used through it, for want of a line above the
// title; the number, the agency and the jurisdiction are the shell's
// sub-header instead.

// Rows change only when the harvest runs again. An hour is the site's default.
export const revalidate = 3600

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const monthYear = (value: string | null) => {
  const match = value?.match(/^(\d{4})-(\d{2})/)
  return match ? `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}` : null
}

const size = (bytes: number | null) =>
  !bytes ? null : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const host = (href: string) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "")
  } catch {
    return href
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const form = await getForm(Number(id))
  if (!form) return { title: "Form" }
  return { title: form.title || form.number, description: `${form.number} · ${agencyName(form.gov, form.agency)}` }
}

export default async function FormRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const form = await getForm(Number(id))
  if (!form) notFound()

  // A third of the corpus has no title. The number — the column's, or the
  // filename it was stored under — is then the only name the form has, and
  // saying so is better than heading the page with an empty string.
  const heading = form.title || form.number
  const scope = form.gov === "US" ? "US" : "NY"

  const readable = form.fieldNames.map(fieldName).filter((name): name is string => !!name)
  const unreadable = form.fieldNames.length - readable.length

  const captured = monthYear(form.archived)
  const fromArchive = form.status === "fetched-archive"

  // The two forms the Filer fills, by number however the harvest spelled it.
  const fillable = FORMS.find((f) => f.code.replace(/[^a-z0-9]/gi, "").toLowerCase() === form.number.replace(/[^a-z0-9]/gi, "").toLowerCase())

  const facts: [string, React.ReactNode][] = []
  if (form.pages) facts.push(["Pages", fmtNumber(form.pages)])
  if (size(form.bytes)) facts.push(["Size", size(form.bytes)])
  facts.push([
    "Copy we hold",
    fromArchive
      ? `From the Internet Archive${captured ? `, captured ${captured}` : ""}`
      : `Downloaded from the agency${captured ? `; the Archive's copy is from ${captured}` : ""}`,
  ])
  // `fetched_at` falls on two days across all 369,735 rows — the weekend the
  // harvest ran — so it dates our copy and says nothing about the form. It is
  // labelled as what it is, and never as a revision date, because the corpus
  // does not carry one.
  facts.push(["Harvested", "30 August – 1 September 2026"])
  if (form.url) facts.push(["Source", <a key="src" href={form.url} target="_blank" rel="noopener noreferrer">{host(form.url)}</a>])
  facts.push(["Fields", form.inspected ? (form.fields ? `${fmtNumber(form.fields)} fillable` : "None — a flat PDF") : "Not yet inspected"])
  if (form.sha256) facts.push(["SHA-256", <code key="sha" className="text-xs break-all">{form.sha256}</code>])

  const markdown = [`# ${heading}`, "", `${form.number} · ${agencyName(form.gov, form.agency)} · ${form.gov}`].join("\n")

  return (
    <DocsPage
      title={heading}
      description={`${form.number} · ${agencyName(form.gov, form.agency)} · ${form.gov}`}
      page={markdown}
      lead={
        <>
          <p className={DOCS_DESCRIPTION}>
            <Chip>{form.number}</Chip> · {agencyName(form.gov, form.agency)} · {form.gov}
          </p>
          {!form.title && <p className={DOCS_DESCRIPTION}>This PDF carries no title of its own. The name above is the file it was published as.</p>}
        </>
      }
      slug={`/forms/${form.id}`}
      actions={
        fillable ? (
          <Button size="sm" className="shadow-none" asChild>
            <Link href={`/chat?form=${fillable.id}`}>Fill this form</Link>
          </Button>
        ) : undefined
      }
      previous={{ name: "Forms", url: `/forms?state=${scope}` }}
    >
      <Table>
        <tbody>
          {facts.map(([label, value]) => (
            <tr key={label}>
              <td className="w-40 font-medium">{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <FormsDoc id={form.id} title={heading} />

      <H2>Fields</H2>
      {!form.inspected ? (
        <p className="text-sm text-muted-foreground">
          We have this PDF but have never opened it, so we cannot say whether it can be filled in. It is one of
          195,530 files — every US DOL and USDA-FNS document — still waiting on an inspection pass.
        </p>
      ) : !form.fieldNames.length ? (
        <p className="text-sm text-muted-foreground">
          A flat PDF: we opened it and it carries no fillable fields. It is printed and filled in by hand.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {fmtNumber(readable.length)} of {fmtNumber(form.fieldNames.length)}{" "}
            {form.fieldNames.length === 1 ? "field" : "fields"} named in the PDF.
            {unreadable > 0 && (
              <>
                {" "}
                The other {fmtNumber(unreadable)} could not be read — the file is compressed or encrypted and the
                inspector recorded the raw bytes rather than the name, so we are not printing them as if they were
                a schema.
              </>
            )}
          </p>
          {readable.length > 0 && (
            <ul className="not-typeset mt-4 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {readable.map((name, index) => (
                <li key={`${name}-${index}`} className="font-mono text-xs text-muted-foreground">
                  {name}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </DocsPage>
  )
}
