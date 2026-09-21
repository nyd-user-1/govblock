"use client"

import * as React from "react"
import { Clock, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Skeleton } from "@govblock/ui/components/ny4/skeleton"

import { SearchDirectory } from "@/components/directory-search"
import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { memberHref, stateName } from "@/lib/filters"
import { portraitFor } from "@/lib/imagery"
import { fmtBill, fmtDate, fmtNumber } from "@/lib/format"
import { districtLabel, legislativeBody, memberLine } from "@/lib/legislative-body"
import { isFiltered, readFilters, SearchFilters, sectionId, type SearchFilterState, writeFilters } from "@/components/search-filters"
import { Highlight } from "@/components/search-highlight"
import { SearchSection as Section, Snippet } from "@/components/search-sections"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem } from "@/components/policy/record-item"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"
import { matchPages } from "@/lib/search-pages"
import type { FindItem, FindResponse } from "@/lib/typeset/find"
import { jurisdictionOf } from "@/lib/xml/address"

// Search, as a page: the header menu's pass with the brakes off. Same route,
// but this page asks for every jurisdiction (`all=1`) and for the bill text
// itself (`text=1`), so one query string answers in seven sections — bills, text,
// laws, members, committees, topics, pages — each rendered only when it has rows,
// and each row carrying the jurisdiction it actually came from. The laws are the
// Library's search, asked beside the policy search (useLawSearch below).

/** What this browser has searched for, newest first. */
const RECENT_SEARCHES = "govblock:recent-searches"

/** The shape of the rows while the sections are being read. */
function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {[0, 1].map((group) => (
        <section key={group} className="flex flex-col">
          <Skeleton className="h-4 w-24" />
          <div className="mt-2 flex flex-col">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-start gap-3 border-b py-3 last:border-0">
                <Skeleton className="size-9 shrink-0 rounded-md" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full max-w-md" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

/** "us-ny" back to "NY", for the row's flag and the scope filter. */
const stateOfLaw = (jurisdiction: string) => (jurisdiction === "us" ? "US" : jurisdiction.slice(3).toUpperCase())

/**
 * The standing law beside the bills (Brendan, 2026-09-20): the Library's own search (/api/typeset/find) — a
 * citation, a code named with a section number, or words in a section's heading, the reader's jurisdiction first.
 * A request of its own, beside the policy search and never in front of it: a common word takes this one several
 * seconds cold, and the bills do not wait for it. The text of the sections is not searched, as the Library's is not.
 */
function useLawSearch(term: string, state: string, active: boolean) {
  const [found, setFound] = React.useState<{ term: string; items: FindItem[] } | null>(null)
  React.useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    fetch(`/api/typeset/find?${new URLSearchParams({ q: term, jurisdiction: jurisdictionOf(state) })}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<FindResponse>) : null))
      .then((body) => setFound({ term, items: body?.items ?? [] }))
      .catch(() => {
        if (!controller.signal.aborted) setFound({ term, items: [] })
      })
    return () => controller.abort()
  }, [term, state, active])
  const current = active && found?.term === term
  return { laws: current ? found.items : [], loading: active && !current }
}

/**
 * A section's rows in the three groups /search reads in (Brendan, 2026-09-20): Congress, the reader's state, then
 * every other jurisdiction — "Congress Bills", "New York Bills", "All Bills". Scoped to Congress there is no state
 * of the reader's to put between them. `federal` names Congress's group where "Congress" would read wrong: its laws
 * are federal, not Congress's.
 */
type Group<T> = { id: string; title: string; rows: T[] }
function grouped<T>(kind: string, label: string, rows: T[], stateOf: (row: T) => string, here: string, federal = "Congress"): Group<T>[] {
  const groups: Group<T>[] = [
    { id: `${sectionId(kind)}-congress`, title: `${federal} ${label}`, rows: rows.filter((r) => stateOf(r) === "US") },
    ...(here === "US" ? [] : [{ id: `${sectionId(kind)}-here`, title: `${stateName(here)} ${label}`, rows: rows.filter((r) => stateOf(r) === here) }]),
    { id: `${sectionId(kind)}-all`, title: `All ${label}`, rows: rows.filter((r) => stateOf(r) !== "US" && stateOf(r) !== here) },
  ]
  return groups.filter((g) => g.rows.length > 0)
}

type SearchPayload = {
  q: string
  state: string
  session: number
  bills: {
    bill_id: number
    bill_number: string
    title: string
    status_desc: string | null
    last_action: string | null
    last_action_date: string | null
    body: string | null
    committee: string | null
    state: string
  }[]
  members: {
    people_id: number
    name: string
    party: string
    role: string
    chamber: string
    district: string
    state: string
    photo_url: string | null
    bioguide_id: string | null
    active: boolean
  }[]
  committees: { committee: string; bills: number; chamber: string; state: string }[]
  texts: {
    bill_id: number
    document_id: number
    state: string
    bill_number: string
    title: string
    snippet: string
  }[]
}

function SearchResults({ filters, onFacets }: { filters: SearchFilterState; onFacets: (facets: Facets) => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, session, resolved } = useJurisdiction()

  // The URL is the source of truth: the header menu lands here with ?q=, and
  // the field writes back to it on Enter, so the result is shareable. Typing
  // alone asks nothing (Brendan, 2026-09-20): this page searches every
  // jurisdiction and the bill text with it, and it was doing that on every
  // keystroke.
  const submitted = searchParams.get("q") ?? ""
  const [query, setQuery] = React.useState(submitted)
  React.useEffect(() => {
    setQuery((previous) => (previous === submitted ? previous : submitted))
  }, [submitted])

  const [recent, setRecent] = useLocal<string[]>(RECENT_SEARCHES, [])
  const run = React.useCallback(
    (value: string) => {
      const next = value.trim()
      setQuery(next)
      const params = new URLSearchParams(searchParams)
      if (next) params.set("q", next)
      else params.delete("q")
      router.replace(`/search${params.size ? `?${params}` : ""}`, { scroll: false })
      if (next.length >= 2) setRecent((previous) => [next, ...previous.filter((r) => r !== next)].slice(0, 8))
    },
    // searchParams is read fresh here; keying on it would loop on our own replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, setRecent]
  )

  const active = resolved && submitted.trim().length >= 2
  const scope = { state, session: session ? String(session) : undefined }
  // all=1 and text=1 are what separate this page from the ⌘K menu on the same
  // route: only /search searches every jurisdiction's bills and committees, and
  // only /search pays for the pass over "BillTexts". Every row below renders its
  // own jurisdiction, which is what earns the flag.
  const { data, isLoading } = usePolicy<SearchPayload>(active ? "search" : null, scope, {
    q: submitted.trim(),
    limit: 20,
    all: 1,
    text: 1,
  })
  const { data: subjects } = usePolicy<{ value: string; count: number }[]>(resolved ? "subjects" : null, scope)
  const law = useLawSearch(submitted.trim(), state, active)

  const topics = React.useMemo(() => {
    const t = submitted.trim().toLowerCase()
    if (t.length < 2 || !subjects) return []
    return subjects.filter((s) => s.value.toLowerCase().includes(t)).slice(0, 12)
  }, [subjects, submitted])

  const pages = matchPages(submitted)
  const raw = { bills: data?.bills ?? [], members: data?.members ?? [], committees: data?.committees ?? [], texts: data?.texts ?? [] }

  // The filters, applied: the jurisdiction in scope alone, one chamber, some
  // statuses, and only the sections ticked.
  const inScope = <T extends { state: string }>(rows: T[]) => (filters.scope === "here" ? rows.filter((r) => r.state === state) : rows)
  const shown = (key: string) => filters.show.length === 0 || filters.show.includes(key)
  const bills = shown("bills")
    ? inScope(raw.bills).filter((b) => (!filters.chamber || b.body === filters.chamber) && (!filters.status.length || filters.status.includes(b.status_desc ?? "")))
    : []
  const texts = shown("texts") ? inScope(raw.texts) : []
  const laws = shown("laws") ? (filters.scope === "here" ? law.laws.filter((l) => stateOfLaw(l.jurisdiction) === state) : law.laws) : []
  const members = shown("members") ? inScope(raw.members) : []
  const committees = shown("committees") ? inScope(raw.committees) : []
  const shownTopics = shown("topics") ? topics : []
  const shownPages = shown("pages") ? pages : []
  const byState = <T extends { state: string }>(row: T) => row.state
  const billGroups = grouped("bills", "Bills", bills, byState, state)
  const textGroups = grouped("texts", "Text", texts, byState, state)
  const lawGroups = grouped("laws", "Laws", laws, (l) => stateOfLaw(l.jurisdiction), state, "Federal")
  const memberGroups = grouped("members", "Members", members, byState, state)
  const committeeGroups = grouped("committees", "Committees", committees, byState, state)
  const total = bills.length + members.length + committees.length + texts.length + laws.length + shownTopics.length + shownPages.length
  // What the reader typed, for the marks below. The Text group gets its
  // highlights from ts_headline; every other group has to find its own.
  const hit = submitted.trim()
  const held = raw.bills.length + raw.members.length + raw.committees.length + raw.texts.length + law.laws.length + topics.length + pages.length

  // The rail's panel reads what the page has, before any filter: how many
  // rows each section holds, and which chambers and statuses the bills carry.
  // Its index reads the headings as the page draws them, after the filters.
  React.useEffect(() => {
    const tally = (values: (string | null | undefined)[]) => {
      const map = new Map<string, number>()
      for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1)
      return [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    }
    onFacets({
      headings: [
        ...[...billGroups, ...textGroups, ...lawGroups, ...memberGroups, ...committeeGroups].map((g) => ({ id: g.id, title: g.title })),
        ...(shownTopics.length ? [{ id: sectionId("topics"), title: "Topics" }] : []),
        ...(shownPages.length ? [{ id: sectionId("pages"), title: "Pages" }] : []),
      ],
      counts: { bills: raw.bills.length, texts: raw.texts.length, laws: law.laws.length, members: raw.members.length, committees: raw.committees.length, topics: topics.length, pages: pages.length },
      chambers: tally(raw.bills.map((b) => b.body)),
      statuses: tally(raw.bills.map((b) => b.status_desc)),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, law.laws.length, topics.length, pages.length, filters, state])

  return (
    <div className="flex flex-col gap-6" data-scope-content>
      <SearchDirectory
        query={query}
        setQuery={(value) => (value === null ? run("") : setQuery(value))}
        placeholder="Search every version of every bill from every jurisdiction."
        onSubmit={() => run(query)}
      />
      {submitted.trim().length < 2 ? (
        <div className="flex flex-col gap-6">
          {recent.length > 0 && (
            <section className="flex flex-col">
              <h2 className="text-sm font-medium text-muted-foreground">
                Recent searches <span className="tabular-nums">({recent.length})</span>
              </h2>
              <ul className="mt-2 flex flex-col">
                {recent.map((term) => (
                  <li key={term} className="flex items-center gap-2 border-b py-2 last:border-0">
                    <button type="button" onClick={() => run(term)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm hover:underline">
                      <Clock className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{term}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Forget ${term}`}
                      onClick={() => setRecent((previous) => previous.filter((r) => r !== term))}
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (isLoading && !data) || (total === 0 && law.loading) ? (
        // Nothing is called empty while the laws are still being read.
        <ResultsSkeleton />
      ) : total === 0 && held > 0 && isFiltered(filters) ? (
        <p className="text-sm text-muted-foreground">
          The filters hide everything found for &ldquo;{submitted.trim()}&rdquo;. Clear them in the rail.
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing in any jurisdiction for &ldquo;{submitted.trim()}&rdquo;.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {fmtNumber(total)} {total === 1 ? "result" : "results"} for &ldquo;{submitted.trim()}&rdquo;
            {isFiltered(filters) && held > total ? <> · {fmtNumber(held - total)} hidden by the filters</> : null}
          </p>
          {billGroups.map((group) => (
          <Section key={group.id} id={group.id} title={group.title} count={group.rows.length}>
            {group.rows.map((bill) => (
              <RecordItem
                key={bill.bill_id}
                href={`/bills/${bill.bill_id}?state=${bill.state}`}
                // The flag, not a chamber seal: these results span every
                // jurisdiction, and which one a row came from is the first thing
                // a reader needs.
                avatar={<FlagChip state={bill.state} width={36} />}
                // Number and latest action, the title on the line under it,
                // then the facts (Brendan, 2026-09-20) — the stacked row the
                // member page reads in.
                stacked
                title={<Highlight text={fmtBill(bill.bill_number, bill.state)} query={hit} />}
                lead={bill.last_action}
                description={<Highlight text={bill.title} query={hit} />}
                meta={[
                  bill.last_action_date ? fmtDate(bill.last_action_date) : null,
                  bill.status_desc,
                  bill.committee ? `${bill.committee} Committee` : null,
                ]}
              />
            ))}
          </Section>
          ))}
          {textGroups.map((group) => (
          <Section key={group.id} id={group.id} title={group.title} count={group.rows.length}>
            {group.rows.map((text) => (
              <RecordItem
                key={`${text.bill_id}-${text.document_id}`}
                href={`/bills/${text.bill_id}?state=${text.state}#text`}
                avatar={<FlagChip state={text.state} width={36} />}
                title={<Highlight text={fmtBill(text.bill_number, text.state)} query={hit} />}
                lead={text.title}
                meta={[stateName(text.state)]}
                // The match itself is the description, highlights kept.
                description={<Snippet text={text.snippet} />}
              />
            ))}
          </Section>
          ))}
          {/* The laws land after the bills and take their place then; while they are read, three rows stand in under the heading. */}
          {law.loading && shown("laws") ? (
            <section className="flex flex-col" aria-busy="true">
              <h2 className="text-sm font-medium text-muted-foreground">Laws</h2>
              <div className="mt-2 mb-2 flex flex-col">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-start gap-3 border-b py-3 last:border-0">
                    <Skeleton className="size-9 shrink-0 rounded-md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-full max-w-md" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            lawGroups.map((group) => (
            <Section key={group.id} id={group.id} title={group.title} count={group.rows.length}>
              {group.rows.map((item) => (
                <RecordItem
                  key={item.address}
                  href={item.href}
                  avatar={<FlagChip state={stateOfLaw(item.jurisdiction)} width={36} />}
                  title={<Highlight text={item.label} query={hit} />}
                  description={item.heading ? <Highlight text={item.heading} query={hit} /> : undefined}
                  meta={[stateName(stateOfLaw(item.jurisdiction)) || "United States", item.date ? `As of ${fmtDate(item.date)}` : null]}
                />
              ))}
            </Section>
            ))
          )}
          {memberGroups.map((group) => (
          <Section key={group.id} id={group.id} title={group.title} count={group.rows.length}>
            {group.rows.map((member) => (
              <RecordItem
                key={member.people_id}
                href={memberHref(member.people_id, member.state)}
                avatar={
                  // The route has always carried the photograph; this page drew
                  // the seal because it never asked for it.
                  <span className="relative block">
                    <MemberPortrait
                      name={member.name}
                      photoUrl={portraitFor(member)}
                      state={member.state}
                      chamber={member.chamber}
                      size={36}
                    />
                    <PartyDot party={member.party} serving={member.active} className="absolute right-0 bottom-0 size-2.5 ring-2 ring-background" />
                  </span>
                }
                title={<Highlight text={`${member.name}${member.active ? "" : " (Ret.)"}`} query={hit} />}
                meta={[legislativeBody(member.state, member.chamber), districtLabel(member.state, member.district)]}
                favoriteDetail={memberLine(member)}
              />
            ))}
          </Section>
          ))}
          {committeeGroups.map((group) => (
          <Section key={group.id} id={group.id} title={group.title} count={group.rows.length}>
            {group.rows.map((committee) => (
              <RecordItem
                key={`${committee.state}-${committee.committee}`}
                href={`/bills?state=${committee.state}&committee=${encodeURIComponent(committee.committee)}`}
                avatar={<ChamberSeal state={committee.state} chamber={committee.chamber} size={36} />}
                title={<Highlight text={committee.committee} query={hit} />}
                meta={[
                  stateName(committee.state),
                  committee.chamber,
                  `${committee.bills} bills this session`,
                ]}
              />
            ))}
          </Section>
          ))}
          <Section id={sectionId("topics")} title="Topics" count={shownTopics.length}>
            {shownTopics.map((topic) => (
              <RecordItem
                key={topic.value}
                href={`/bills?state=${state}&subject=${encodeURIComponent(topic.value)}`}
                title={<Highlight text={topic.value} query={hit} />}
                meta={[`${topic.count} bills`]}
              />
            ))}
          </Section>
          <Section id={sectionId("pages")} title="Pages" count={shownPages.length}>
            {shownPages.map((page) => (
              <RecordItem key={page.href} href={page.href} title={<Highlight text={page.name} query={hit} />} meta={[page.group]} />
            ))}
          </Section>
        </>
      )}
    </div>
  )
}

type Facets = { /** The headings on the page, in order, for the rail's index. */ headings: { id: string; title: string }[]; counts: Record<string, number>; chambers: { value: string; count: number }[]; statuses: { value: string; count: number }[] }

/** The filters ride in the URL beside the query, so a filtered search is a link. */
function SearchShell() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state } = useJurisdiction()
  const filters = React.useMemo(() => readFilters(new URLSearchParams(searchParams)), [searchParams])
  const [facets, setFacets] = React.useState<Facets>({ headings: [], counts: {}, chambers: [], statuses: [] })
  const toc = facets.headings.map((heading) => ({ title: heading.title, url: `#${heading.id}`, depth: 2 }))
  const setFilters = (next: SearchFilterState) => {
    const params = writeFilters(new URLSearchParams(searchParams), next)
    router.replace(`/search${params.size ? `?${params}` : ""}`, { scroll: false })
  }
  return (
    <DocsPage
      title="Search"
      description="Bills, bill text, laws, members, committees, topics and pages — across every jurisdiction, with the one you are in first."
      slug="search"
      previous={{ name: "Members", url: "/members" }}
      next={{ name: "Bills", url: "/bills" }}
      rail={
        <>
          {/* The index stands between the favorites and the filters (Brendan,
              2026-09-20): the groups the search actually came back with, in
              the order they run down the page. */}
          {toc.length > 0 && <DocsTableOfContents toc={toc} />}
          <SearchFilters filters={filters} onChange={setFilters} here={state} counts={facets.counts} chambers={facets.chambers} statuses={facets.statuses} />
        </>
      }
    >
      <SearchResults filters={filters} onFacets={setFacets} />
    </DocsPage>
  )
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={null}>
      <SearchShell />
    </React.Suspense>
  )
}
