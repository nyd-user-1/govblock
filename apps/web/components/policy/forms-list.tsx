"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import { SearchDirectory } from "@/components/directory-search"
import { FormSeal } from "@/components/policy/forms-seal"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { Button } from "@govblock/ui/components/ny4/button"

// The forms list: the canon item, one read, and a toggle that admits the rest
// of the corpus without calling it something it is not.
//
// Row 1 is the form number and the form's title beside it; the meta line is the
// jurisdiction, the agency, the page count, whether it can be filled in, and
// when the Internet Archive captured it. There is no description row because
// there is no description column — §0 of the brief, and inventing one is how a
// library starts lying.

const PAGE = 50

export type FormRow = {
  id: number
  gov: string
  agency: string
  number: string
  numbered: boolean
  title: string | null
  pages: number | null
  bytes: number | null
  fields: number
  archived: string | null
  inspected: boolean
}

type FormsAnswer = {
  count: number
  rows: FormRow[]
  facets: { gov: { value: string; count: number }[]; agency: { value: string; count: number }[] }
  forms: number
  documents: number
  empty?: string
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** A capture date reads as a month: the day the crawler happened to call is noise. */
function monthYear(value: string | null) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})/)
  if (!match) return null
  return `${MONTHS[Number(match[2]) - 1] ?? match[2]} ${match[1]}`
}

/**
 * The meta line. Every entry is something the row actually holds; a gap is a
 * gap and the line simply gets shorter, except for inspection, which is a hole
 * worth naming out loud because it is why the row may not be a form at all.
 */
export function formMeta(form: FormRow) {
  return [
    form.gov,
    form.agency,
    form.pages ? `${fmtNumber(form.pages)} ${form.pages === 1 ? "page" : "pages"}` : null,
    form.fields > 0 ? `fillable · ${fmtNumber(form.fields)} ${form.fields === 1 ? "field" : "fields"}` : null,
    !form.inspected ? "not yet inspected" : null,
    monthYear(form.archived) ? `archived ${monthYear(form.archived)}` : null,
  ]
}

export function FormsList() {
  const { state, resolved } = useJurisdiction()
  const { agency, all } = useUrlParams(["agency", "all"] as const)
  const showAll = all === "1"

  const [query, setQuery] = React.useState("")
  const [term, setTerm] = React.useState("")
  const [pages, setPages] = React.useState<FormRow[][]>([])
  const [answer, setAnswer] = React.useState<FormsAnswer | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [failed, setFailed] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)

  // The search field types faster than Aurora should be asked to answer.
  React.useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  // Any change of scope, filter or term starts the list again from page 1.
  React.useEffect(() => {
    setPage(1)
    setPages([])
  }, [state, agency, showAll, term])

  React.useEffect(() => {
    if (!resolved) return
    const params = new URLSearchParams({ state, page: String(page), limit: String(PAGE) })
    if (agency) params.set("agency", agency)
    if (term) params.set("q", term)
    if (showAll) params.set("all", "1")
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const response = await fetch(`/api/policy/forms?${params}`)
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        const data = (await response.json()) as FormsAnswer
        if (cancelled) return
        setAnswer(data)
        setFailed(null)
        // Page 1 replaces; a later page appends, so "Show more" grows the list.
        setPages((previous) => (page === 1 ? [data.rows] : [...previous, data.rows]))
      } catch (error) {
        if (cancelled) return
        // There is no committed fixture for this family, and there should not
        // be: a form is a file in S3, not a row we can stand in for.
        setFailed(error instanceof Error ? error.message : String(error))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resolved, state, agency, term, showAll, page])

  const rows = React.useMemo(() => pages.flat(), [pages])

  // Nothing paints before the scope is known: the prerendered HTML is shared by
  // every visitor, so a first paint under the wrong flag is a lie in the markup.
  if (!resolved) return null

  if (answer?.empty) return <p className="py-10 text-sm text-muted-foreground">{answer.empty}</p>

  const noun = showAll ? "document" : "form"
  const total = answer?.count ?? 0

  return (
    <>
      <div className="not-typeset mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant={showAll ? "ghost" : "secondary"}
          size="sm"
          className="shadow-none"
          onClick={() => writeUrlParams({ all: null })}
        >
          Forms{answer ? ` · ${fmtNumber(answer.forms)}` : ""}
        </Button>
        <Button
          variant={showAll ? "secondary" : "ghost"}
          size="sm"
          className="shadow-none"
          onClick={() => writeUrlParams({ all: "1" })}
        >
          All documents{answer ? ` · ${fmtNumber(answer.documents)}` : ""}
        </Button>
        {agency && (
          // The code, not the expansion: `DHS` is two different departments
          // depending on the gov, and the chip has no row in hand to say which.
          <Button variant="ghost" size="sm" className="shadow-none" onClick={() => writeUrlParams({ agency: null })}>
            {agency} ✕
          </Button>
        )}
      </div>

      <SearchDirectory
        query={query}
        registriesCount={total}
        setQuery={(value) => setQuery(value ?? "")}
        noun={noun}
        placeholder={`Search ${stateName(state)} ${noun}s by number, title or filename…`}
      />

      {showAll && (
        // Never hide a hole: over half of what the toggle just revealed is
        // material we have downloaded and never opened.
        <p className="mt-4 text-xs text-muted-foreground">
          Everything harvested, forms and documents together. 195,530 of these — every US DOL and USDA-FNS file — were
          fetched and never opened, so we cannot yet say which of them are forms.
        </p>
      )}

      <RecordList>
        {rows.map((form) => (
          <RecordItem
            key={form.id}
            href={`/docs/forms/${form.id}`}
            avatar={<FormSeal gov={form.gov} agency={form.agency} />}
            title={form.number}
            lead={form.title}
            meta={formMeta(form)}
          />
        ))}
        {!rows.length && !loading && !failed && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No {noun}s in {stateName(state)}
            {agency ? ` from ${agency}` : ""}
            {term ? ` matching “${term}”` : ""}.
          </p>
        )}
      </RecordList>

      {failed && (
        <p className="py-4 text-sm text-muted-foreground">
          The forms library did not answer ({failed}). Nothing is standing in for it.
        </p>
      )}

      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {fmtNumber(rows.length)} of {fmtNumber(total)} {total === 1 ? noun : `${noun}s`}
          {agency ? ` from ${agency}` : ""}
          {term ? ` matching “${term}”` : ""}.
        </p>
        {rows.length < total && (
          <Button variant="secondary" size="sm" className="shadow-none" disabled={loading} onClick={() => setPage((n) => n + 1)}>
            {loading ? "Loading…" : "Show more"}
          </Button>
        )}
      </div>
    </>
  )
}
