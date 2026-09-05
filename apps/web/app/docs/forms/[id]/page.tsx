import Link from "next/link"
import { notFound } from "next/navigation"
import { IconArrowLeft } from "@tabler/icons-react"

import { fmtNumber } from "@/lib/format"
import { fieldName, getForm } from "@/lib/policy/forms-queries"
import { DocsCopyPage } from "@/components/docs-copy-page"
import { PublicRail } from "@/components/block-card"
import { agencyName, FormSeal } from "@/components/policy/forms-seal"
import { FormsDoc } from "@/components/policy/forms-doc"
import { H2, Table } from "@/components/typeset"
import { Button } from "@govblock/ui/components/ny4/button"

// One form: what we know about it, the PDF, and the fields it asks for.
//
// The shell is the docs shell, copied from `docs-page.tsx` rather than used
// through it, because a form needs a kicker line above the title — number ·
// agency · jurisdiction — and `DocsPage` has no slot for one. Every className
// below is that file's; nothing here is a new layout.

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
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 px-4 py-6 text-foreground md:px-0 lg:py-8 dark:text-foreground">
          <div className="flex flex-col gap-2">
            <div className="not-typeset flex items-center gap-3">
              <FormSeal gov={form.gov} agency={form.agency} size={40} />
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{form.number}</span> · {agencyName(form.gov, form.agency)} ·{" "}
                {form.gov}
              </span>
            </div>
            <div className="flex items-center justify-between md:items-start">
              <h1 className="scroll-m-24 text-3xl font-semibold tracking-tight text-balance sm:text-3xl">{heading}</h1>
              <div className="docs-nav flex items-center gap-2">
                <div className="hidden sm:block">
                  <DocsCopyPage page={markdown} url={`https://govblock.app/docs/forms/${form.id}`} />
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" size="icon" className="extend-touch-target size-8 shadow-none md:size-7" asChild>
                    <Link href={`/docs/forms?state=${scope}`}>
                      <IconArrowLeft />
                      <span className="sr-only">All forms</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            {!form.title && (
              <p className="text-[1.05rem] text-muted-foreground sm:text-base">
                This PDF carries no title of its own. The name above is the file it was published as.
              </p>
            )}
          </div>

          <div className="typeset w-full flex-1 pb-16 *:data-[slot=alert]:first:mt-0 sm:pb-0">
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
          </div>

          <div className="hidden h-16 w-full items-center gap-2 px-4 sm:flex sm:px-0">
            <Button variant="secondary" size="sm" className="shadow-none" asChild>
              <Link href={`/docs/forms?state=${scope}`}>
                <IconArrowLeft /> Forms
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="hidden flex-1 flex-col gap-6 overflow-y-auto px-6 xl:flex">
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
