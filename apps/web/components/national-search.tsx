"use client"

import * as React from "react"

import { SearchDirectory } from "@/components/directory-search"
import { JURISDICTIONS } from "@/components/library/jurisdiction-index"
import { FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem } from "@/components/policy/record-item"
import { Highlight } from "@/components/search-highlight"
import { SearchSection, Snippet } from "@/components/search-sections"
import { memberHref, stateName } from "@/lib/filters"
import { fmtBill, fmtDate, truncate } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { districtLabel, legislativeBody, memberLine } from "@/lib/legislative-body"
import type { LawSort, NationalResult, Source } from "@/lib/policy/national-search"
import { NativeSelect, NativeSelectOption } from "@govblock/ui/components/nova/native-select"
import { Skeleton } from "@govblock/ui/components/ny4/skeleton"

// The national search on the root page (Brendan, 2026-09-18): the search bar
// /bills/<code> opens its list with, asking /api/national-search for bills,
// law and legislators across every jurisdiction. It asks on Enter, never as
// the reader types — nationally a keystroke would be three searches over 52
// jurisdictions, and a cold one takes seconds. The filters are the ones that
// earned their place: the jurisdiction, the source, and for law in one
// jurisdiction the order. Changing a filter asks again at once; it is a
// choice, not a keystroke.

export type Filters = { j: string; only: Source | "all"; sort: LawSort }
type Asked = Filters & { q: string }

const ALL: Filters = { j: "all", only: "all", sort: "code" }

// Congress first, then the states and the District A–Z.
const PLACES = [...JURISDICTIONS.filter((j) => j.code === "US"), ...JURISDICTIONS.filter((j) => j.code !== "US")]

export function useNationalSearch() {
  const [query, setQuery] = React.useState("")
  const [filters, setFilters] = React.useState<Filters>(ALL)
  const [asked, setAsked] = React.useState<Asked | null>(null)
  const [result, setResult] = React.useState<NationalResult | null>(null)
  const [failed, setFailed] = React.useState(false)
  const inflight = React.useRef<AbortController | null>(null)

  const ask = React.useCallback((next: Asked) => {
    inflight.current?.abort()
    const controller = new AbortController()
    inflight.current = controller
    setAsked(next)
    setResult(null)
    setFailed(false)
    const params = new URLSearchParams({ q: next.q })
    if (next.j !== "all") params.set("j", next.j)
    if (next.only !== "all") params.set("only", next.only)
    if (next.sort === "relevance") params.set("sort", "relevance")
    fetch(`/api/national-search?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<NationalResult>) : Promise.reject(new Error(String(r.status)))))
      .then(setResult)
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") setFailed(true)
      })
  }, [])

  const submit = () => {
    const q = query.trim()
    if (q.length >= 2) ask({ ...filters, q })
  }
  const setFilter = (next: Partial<Filters>) => {
    const merged = { ...filters, ...next }
    setFilters(merged)
    if (asked) ask({ ...merged, q: asked.q })
  }
  /** Back to the section's own view; what was typed stays in the bar. */
  const dismiss = () => {
    inflight.current?.abort()
    setAsked(null)
    setResult(null)
    setFailed(false)
  }
  const clear = () => {
    dismiss()
    setQuery("")
  }

  return { query, setQuery, filters, setFilter, submit, clear, dismiss, asked, result, failed, retry: () => asked && ask(asked) }
}

type Search = ReturnType<typeof useNationalSearch>

/** The bar and its filters, under the section's counts. */
export function NationalSearchControls({ search }: { search: Search }) {
  const { query, setQuery, filters, setFilter, submit, clear } = search
  // Order is a law question, and across every jurisdiction there is only one.
  const sortable = filters.j !== "all" && (filters.only === "all" || filters.only === "law")
  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <SearchDirectory query={query} setQuery={(value) => (value === null ? clear() : setQuery(value))} placeholder="Search bills, laws and legislators…" />
      </form>
      <div className="flex flex-wrap gap-2">
        <NativeSelect size="sm" aria-label="Jurisdiction" value={filters.j} onChange={(e) => setFilter({ j: e.target.value })}>
          <NativeSelectOption value="all">Every jurisdiction</NativeSelectOption>
          {PLACES.map((p) => (
            <NativeSelectOption key={p.code} value={p.code}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect size="sm" aria-label="Source" value={filters.only} onChange={(e) => setFilter({ only: e.target.value as Filters["only"] })}>
          <NativeSelectOption value="all">Bills, laws and legislators</NativeSelectOption>
          <NativeSelectOption value="bills">Bills</NativeSelectOption>
          <NativeSelectOption value="law">Laws</NativeSelectOption>
          <NativeSelectOption value="legislators">Legislators</NativeSelectOption>
        </NativeSelect>
        {sortable && (
          <NativeSelect size="sm" aria-label="Order of laws" value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value as LawSort })}>
            <NativeSelectOption value="code">Laws in code order</NativeSelectOption>
            <NativeSelectOption value="relevance">Laws by relevance</NativeSelectOption>
          </NativeSelect>
        )}
      </div>
    </div>
  )
}

const TIMEOUT: Record<string, string> = {
  timeout: "This took too long across every jurisdiction. Choose one to narrow it.",
  failed: "This part of the search failed.",
}

/** The three groups, in the section's body while a search stands. */
export function NationalSearchResults({ search }: { search: Search }) {
  const { asked, result, failed, retry } = search
  if (!asked) return null
  if (failed)
    return (
      <p className="text-muted-foreground">
        The search did not answer.{" "}
        <button type="button" onClick={() => retry()} className="underline underline-offset-4 hover:text-foreground">
          Try again
        </button>
      </p>
    )
  if (!result) return <NationalSearchSkeleton only={asked.only} />

  const hit = asked.q
  const where = asked.j === "all" ? "any jurisdiction" : asked.j === "US" ? "Congress" : stateName(asked.j)
  const bills = result.bills?.rows ?? []
  const law = result.law?.rows ?? []
  const people = result.legislators?.rows ?? []
  const notes = [result.bills?.error, result.law?.error, result.legislators?.error].filter(Boolean)
  if (!bills.length && !law.length && !people.length && !notes.length)
    return <p className="text-muted-foreground">Nothing in {where} for &ldquo;{hit}&rdquo;.</p>

  return (
    <div className="flex flex-col gap-6">
      {result.bills && (
        <SearchSection id="national-bills" title="Bills" count={bills.length} note={result.bills.error && TIMEOUT[result.bills.error]}>
          {bills.map((bill) => (
            <RecordItem
              key={bill.bill_id}
              href={`/bills/${bill.bill_id}?state=${bill.state}${bill.snippet ? "#text" : ""}`}
              avatar={<FlagChip state={bill.state} width={36} />}
              title={<Highlight text={fmtBill(bill.bill_number, bill.state)} query={hit} />}
              // A text match leads with the bill's title and quotes the passage;
              // a title match leads with where the bill stands.
              lead={bill.snippet ? bill.title : bill.last_action}
              meta={[bill.last_action_date ? fmtDate(bill.last_action_date) : null, bill.status_desc, bill.committee ? `${bill.committee} Committee` : null]}
              description={bill.snippet ? <Snippet text={bill.snippet} /> : <Highlight text={truncate(bill.title, 240)} query={hit} />}
            />
          ))}
        </SearchSection>
      )}
      {result.law && (
        <SearchSection id="national-law" title="Laws" count={law.length} note={result.law.error && TIMEOUT[result.law.error]}>
          {law.map((section) => (
            <RecordItem
              key={`${section.state}-${section.law_id}-${section.location_id}`}
              href={`/laws/${section.state.toLowerCase()}?law=${encodeURIComponent(section.law_id)}&doc=${encodeURIComponent(section.location_id)}`}
              avatar={<FlagChip state={section.state} width={36} />}
              // Some codes carry no section headings (California's); the law and
              // the section number stand in.
              title={<Highlight text={section.title || `${section.law_name} § ${section.location_id}`} query={hit} />}
              meta={[section.state === "US" ? "United States" : stateName(section.state), section.law_name, `§ ${section.location_id}`]}
              description={<Snippet text={section.snippet} />}
            />
          ))}
        </SearchSection>
      )}
      {result.legislators && (
        <SearchSection id="national-legislators" title="Legislators" count={people.length} note={result.legislators.error && TIMEOUT[result.legislators.error]}>
          {people.map((member) => (
            <RecordItem
              key={member.people_id}
              href={memberHref(member.people_id, member.state)}
              avatar={
                <span className="relative block">
                  <MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={member.state} chamber={member.chamber} size={36} />
                  <PartyDot party={member.party} serving={member.active} className="absolute right-0 bottom-0 size-2.5 ring-2 ring-background" />
                </span>
              }
              title={<Highlight text={`${member.name}${member.active ? "" : " (Ret.)"}`} query={hit} />}
              meta={[legislativeBody(member.state, member.chamber), districtLabel(member.state, member.district)]}
              favoriteDetail={memberLine(member)}
            />
          ))}
        </SearchSection>
      )}
    </div>
  )
}

// What stands in while the answer is on its way: each group asked for, its
// heading and three rows the shape of the rows to come — a flag or a face, a
// name, a line, and a passage.
function NationalSearchSkeleton({ only }: { only: Filters["only"] }) {
  const groups = only === "all" ? ["bills", "law", "legislators"] : [only]
  return (
    <div aria-hidden className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3 border-b py-3">
              <Skeleton className={group === "legislators" ? "size-9 shrink-0 rounded-full" : "h-6 w-9 shrink-0 rounded-[4px]"} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                {group !== "legislators" && <Skeleton className="h-3.5 w-11/12" />}
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
