"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { SearchDirectory } from "@/components/directory-search"
import { DocsPage } from "@/components/docs-page"
import { memberHref, stateName } from "@/lib/filters"
import { portraitFor } from "@/lib/imagery"
import { fmtBill, fmtDate, truncate } from "@/lib/format"
import { districtLabel, legislativeBody } from "@/lib/legislative-body"
import { isFiltered, readFilters, SearchFilters, sectionId, type SearchFilterState, writeFilters } from "@/components/search-filters"
import { Highlight, Mark } from "@/components/search-highlight"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { matchPages } from "@/lib/search-pages"

// Search, as a page: the header menu's pass with the brakes off. Same route,
// but this page asks for every jurisdiction (`all=1`) and for the bill text
// itself (`text=1`), so one query string answers in six sections — bills, text,
// members, committees, topics, pages — each rendered only when it has rows, and
// each row carrying the jurisdiction it actually came from.

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

// ts_headline wraps the match in « », not in HTML — nothing has to trust markup
// coming out of the database. A snippet is therefore split on the guillemets and
// the odd pieces are the hits. (A bill that itself contains a « would show a
// stray highlight; across 3.3 M documents that is a better trade than
// dangerouslySetInnerHTML.)
function Snippet({ text }: { text: string }) {
  const pieces = text.split(/[«»]/)
  return (
    <span className="min-w-0 flex-1 text-muted-foreground">
      {pieces.map((piece, i) =>
        i % 2 ? (
          <Mark key={i}>{piece}</Mark>
        ) : (
          <React.Fragment key={i}>{piece}</React.Fragment>
        )
      )}
    </span>
  )
}

// The section's bordered box and its `divide-y` are gone: the canon puts a 1 px
// rule on the item itself, and a box around a list of ruled items draws the same
// line twice and boxes it as well.
function Section({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  if (!count) return null
  return (
    // scroll-mt clears the sticky header, so the rail's jump lands on the
    // heading rather than a hand's width above it.
    <section id={id} className="flex scroll-mt-[calc(var(--header-height)+2rem)] flex-col">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({count})</span>
      </h2>
      <RecordList className="mt-2 mb-2">{children}</RecordList>
    </section>
  )
}

function SearchResults({ filters, onFacets }: { filters: SearchFilterState; onFacets: (facets: Facets) => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, session, resolved } = useJurisdiction()

  const urlQuery = searchParams.get("q") ?? ""
  const [query, setQuery] = React.useState(urlQuery)
  const [debounced, setDebounced] = React.useState(urlQuery)

  // The URL is the source of truth: the header menu lands here with ?q=, and
  // typing writes back to it (debounced) so the result is shareable.
  React.useEffect(() => {
    setQuery((previous) => (previous === urlQuery ? previous : urlQuery))
    setDebounced(urlQuery)
  }, [urlQuery])

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(query)
      const params = new URLSearchParams(searchParams)
      if (query) params.set("q", query)
      else params.delete("q")
      router.replace(`/search${params.size ? `?${params}` : ""}`, { scroll: false })
    }, 250)
    return () => clearTimeout(handle)
    // searchParams is read fresh inside; keying on it would loop on our own replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, router])

  const active = resolved && debounced.trim().length >= 2
  const scope = { state, session: session ? String(session) : undefined }
  // all=1 and text=1 are what separate this page from the ⌘K menu on the same
  // route: only /search searches every jurisdiction's bills and committees, and
  // only /search pays for the pass over "BillTexts". Every row below renders its
  // own jurisdiction, which is what earns the flag.
  const { data, isLoading } = usePolicy<SearchPayload>(active ? "search" : null, scope, {
    q: debounced.trim(),
    limit: 20,
    all: 1,
    text: 1,
  })
  const { data: subjects } = usePolicy<{ value: string; count: number }[]>(resolved ? "subjects" : null, scope)

  const topics = React.useMemo(() => {
    const t = debounced.trim().toLowerCase()
    if (t.length < 2 || !subjects) return []
    return subjects.filter((s) => s.value.toLowerCase().includes(t)).slice(0, 12)
  }, [subjects, debounced])

  const pages = matchPages(debounced)
  const raw = { bills: data?.bills ?? [], members: data?.members ?? [], committees: data?.committees ?? [], texts: data?.texts ?? [] }

  // The rail's panel reads what the page has, before any filter: how many
  // rows each section holds, and which chambers and statuses the bills carry.
  React.useEffect(() => {
    const tally = (values: (string | null | undefined)[]) => {
      const map = new Map<string, number>()
      for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1)
      return [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    }
    onFacets({
      counts: { bills: raw.bills.length, texts: raw.texts.length, members: raw.members.length, committees: raw.committees.length, topics: topics.length, pages: pages.length },
      chambers: tally(raw.bills.map((b) => b.body)),
      statuses: tally(raw.bills.map((b) => b.status_desc)),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, topics.length, pages.length])

  // The filters, applied: the jurisdiction in scope alone, one chamber, some
  // statuses, and only the sections ticked.
  const here = stateName(state) || "this jurisdiction"
  const inScope = <T extends { state: string }>(rows: T[]) => (filters.scope === "here" ? rows.filter((r) => r.state === state) : rows)
  const shown = (key: string) => filters.show.length === 0 || filters.show.includes(key)
  const bills = shown("bills")
    ? inScope(raw.bills).filter((b) => (!filters.chamber || b.body === filters.chamber) && (!filters.status.length || filters.status.includes(b.status_desc ?? "")))
    : []
  const texts = shown("texts") ? inScope(raw.texts) : []
  const members = shown("members") ? inScope(raw.members) : []
  const committees = shown("committees") ? inScope(raw.committees) : []
  const shownTopics = shown("topics") ? topics : []
  const shownPages = shown("pages") ? pages : []
  const total = bills.length + members.length + committees.length + texts.length + shownTopics.length + shownPages.length
  // What the reader typed, for the marks below. The Text group gets its
  // highlights from ts_headline; every other group has to find its own.
  const hit = debounced.trim()
  const held = raw.bills.length + raw.members.length + raw.committees.length + raw.texts.length + topics.length + pages.length

  return (
    <div className="flex flex-col gap-6" data-scope-content>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        placeholder={`Search ${here} and every jurisdiction...`}
      />
      {debounced.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Type at least two characters — a bill number, a name, a committee, a topic, a page, or a
          phrase from a bill&rsquo;s text. {here} sorts first; every other jurisdiction follows.
        </p>
      ) : isLoading && !data ? (
        <p className="text-sm text-muted-foreground">Searching every jurisdiction...</p>
      ) : total === 0 && held > 0 && isFiltered(filters) ? (
        <p className="text-sm text-muted-foreground">
          The filters hide everything found for &ldquo;{debounced.trim()}&rdquo;. Clear them in the rail.
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing in any jurisdiction for &ldquo;{debounced.trim()}&rdquo;.
        </p>
      ) : (
        <>
          <Section id={sectionId("bills")} title="Bills" count={bills.length}>
            {bills.map((bill) => (
              <RecordItem
                key={bill.bill_id}
                href={`/bills/${bill.bill_id}?state=${bill.state}`}
                // The flag, not a chamber seal: these results span every
                // jurisdiction, and which one a row came from is the first thing
                // a reader needs.
                avatar={<FlagChip state={bill.state} width={36} />}
                title={<Highlight text={fmtBill(bill.bill_number, bill.state)} query={hit} />}
                lead={bill.last_action}
                meta={[
                  bill.last_action_date ? fmtDate(bill.last_action_date) : null,
                  bill.status_desc,
                  bill.committee ? `${bill.committee} Committee` : null,
                ]}
                description={<Highlight text={truncate(bill.title, 240)} query={hit} />}
              />
            ))}
          </Section>
          <Section id={sectionId("texts")} title="Text" count={texts.length}>
            {texts.map((text) => (
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
          <Section id={sectionId("members")} title="Members" count={members.length}>
            {members.map((member) => (
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
              />
            ))}
          </Section>
          <Section id={sectionId("committees")} title="Committees" count={committees.length}>
            {committees.map((committee) => (
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

type Facets = { counts: Record<string, number>; chambers: { value: string; count: number }[]; statuses: { value: string; count: number }[] }

/** The filters ride in the URL beside the query, so a filtered search is a link. */
function SearchShell() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state } = useJurisdiction()
  const filters = React.useMemo(() => readFilters(new URLSearchParams(searchParams)), [searchParams])
  const [facets, setFacets] = React.useState<Facets>({ counts: {}, chambers: [], statuses: [] })
  const setFilters = (next: SearchFilterState) => {
    const params = writeFilters(new URLSearchParams(searchParams), next)
    router.replace(`/search${params.size ? `?${params}` : ""}`, { scroll: false })
  }
  return (
    <DocsPage
      title="Search"
      description="Bills, bill text, members, committees, topics and pages — across every jurisdiction, with the one you are in first."
      slug="search"
      previous={{ name: "Members", url: "/members" }}
      next={{ name: "Bills", url: "/bills" }}
      rail={<SearchFilters filters={filters} onChange={setFilters} here={state} counts={facets.counts} chambers={facets.chambers} statuses={facets.statuses} />}
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
