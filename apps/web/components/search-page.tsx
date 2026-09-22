"use client"

import * as React from "react"
import { ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp, Clock, SlidersHorizontal, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Skeleton } from "@govblock/ui/components/ny4/skeleton"

import { SearchDirectory } from "@/components/directory-search"
import { InputGroupButton } from "@govblock/ui/components/nova/input-group"
import { memberHref, stateName } from "@/lib/filters"
import { portraitFor } from "@/lib/imagery"
import { fmtBill, fmtDate, fmtNumber } from "@/lib/format"
import { districtLabel, legislativeBody, memberLine } from "@/lib/legislative-body"
import { isFiltered, readFilters, sectionId, type SearchFilterState } from "@/components/search-filters"
import { useSearchRail, type Facets } from "@/components/search-rail"
import { Highlight } from "@/components/search-highlight"
import { SearchSection as Section, Snippet } from "@/components/search-sections"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { H3 } from "@/components/typeset"
import { Button } from "@govblock/ui/components/ny4/button"
import { NAV_BUTTON } from "@/components/docs-header"
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

/** One result row's shape: the flag, the number and title, three lines of the chunk, the facts. */
function RowSkeleton() {
  return (
    <div className="flex gap-4 px-3 py-4 md:px-4">
      <Skeleton className="mt-0.5 h-[27px] w-9 shrink-0 rounded-sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="mt-1 h-3.5 w-full" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="mt-0.5 h-3.5 w-80 max-w-full" />
      </div>
    </div>
  )
}

/** A block's shape while it is being read: the heading and its two buttons, then three rows. */
function BlockSkeleton() {
  return (
    <div aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <Skeleton className="h-6 w-16" />
        <div className="flex gap-2">
          <Skeleton className="size-8 rounded-md md:size-7" />
          <Skeleton className="size-8 rounded-md md:size-7" />
        </div>
      </div>
      <div className="mt-4 flex flex-col divide-y divide-border">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    </div>
  )
}

/** The results' shape while the sections are being read (Brendan, 2026-09-22: "fits the shape of the thing it's holding space for"): the count line, then a block. */
function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-48" />
      <div className="typeset w-full">
        <BlockSkeleton />
      </div>
    </div>
  )
}

/** The recent searches' shape, on the way back to them: the heading and five rows, a clock and a term each. */
function RecentSkeleton() {
  return (
    <section className="flex flex-col" aria-busy="true">
      <Skeleton className="h-4 w-36" />
      <ul className="mt-2 flex flex-col">
        {[0, 1, 2, 3, 4].map((row) => (
          <li key={row} className="flex items-center gap-2.5 border-b py-3 last:border-0">
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-4" style={{ width: `${[40, 60, 32, 52, 44][row]}%` }} />
          </li>
        ))}
      </ul>
    </section>
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
 * every other jurisdiction — "Congress Members", "New York Members", "All Members". Scoped to Congress there is no
 * state of the reader's to put between them. The members and committees still read this way; the bills, the text
 * and the laws are Blocks with tabs since 2026-09-22.
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
    description: string | null
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
    status_desc: string | null
    last_action: string | null
    last_action_date: string | null
    committee: string | null
    snippet: string
  }[]
}

/**
 * A block of the results (Brendan, 2026-09-22): the bill page's H3 with its label — Bills, Text, Laws — and, in line
 * with it at the right and the heading's foot level with them, two small buttons in the docs head's style: A to Z,
 * and newest to oldest. Each sorts the rows on a press and turns the sort round on the next; untouched, the rows
 * stand as the search ranked them. (The tabs that stood here for an hour — a jurisdiction each — may come back.) A
 * block with nothing in it is not drawn; one still being read shows its shape.
 */
type Sort = { by: "title" | "date"; reversed: boolean } | null
function Block<T>({ kind, label, rows, titleOf, dateOf, loading = false, children }: { kind: string; label: string; rows: T[]; titleOf: (row: T) => string; dateOf: (row: T) => string | null | undefined; loading?: boolean; children: (row: T) => React.ReactNode }) {
  const [sort, setSort] = React.useState<Sort>(null)
  if (!rows.length && !loading) return null
  const sorted = sort
    ? [...rows].sort((a, b) => {
        const order = sort.by === "title" ? titleOf(a).localeCompare(titleOf(b), "en", { sensitivity: "base" }) : (dateOf(b) ?? "").localeCompare(dateOf(a) ?? "")
        return sort.reversed ? -order : order
      })
    : rows
  const press = (by: "title" | "date") => setSort((s) => (s?.by === by ? (s.reversed ? null : { by, reversed: true }) : { by, reversed: false }))
  const TitleIcon = sort?.by === "title" && sort.reversed ? ArrowUpAZ : ArrowDownAZ
  const DateIcon = sort?.by === "date" && sort.reversed ? CalendarArrowUp : CalendarArrowDown
  return (
    <section id={sectionId(kind)} className="scroll-mt-[calc(var(--header-height)+2rem)]">
      <div className="flex items-end justify-between gap-4">
        <H3 id={`${sectionId(kind)}-heading`} className="my-0">{label}</H3>
        {!loading && (
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" className={NAV_BUTTON} aria-pressed={sort?.by === "title"} aria-label={sort?.by === "title" && !sort.reversed ? "Sort Z to A" : "Sort A to Z"} onClick={() => press("title")}>
              <TitleIcon />
            </Button>
            <Button variant="secondary" size="icon" className={NAV_BUTTON} aria-pressed={sort?.by === "date"} aria-label={sort?.by === "date" && !sort.reversed ? "Sort oldest first" : "Sort newest first"} onClick={() => press("date")}>
              <DateIcon />
            </Button>
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-4 flex flex-col divide-y divide-border" aria-busy="true">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : (
        <RecordList className="mt-4 mb-0">{sorted.map(children)}</RecordList>
      )}
    </section>
  )
}

/**
 * The search: the bar, the recent searches, the sections. /search draws it under its shell with the rail's filters
 * (app/search/page.tsx); the account home draws it in place of its bar (Brendan, 2026-09-22: "replace the search
 * experience on the home page with the search bar and experience from the /search page"). `path` is the page the
 * query is written to, so a search on either page is a link to itself.
 */
export function SearchResults({ filters: given, onFacets: report, path = "/search", onFilter }: { /** The filters; read off the address when none are passed, as the rail's panel writes them (components/search-rail.tsx). */ filters?: SearchFilterState; /** Where what was found is reported; the rail's store when nothing is passed. */ onFacets?: (facets: Facets) => void; path?: string; /** Pressed, the filter icon in the bar: the root opens its right rail on the filters. No icon without it. */ onFilter?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, session, resolved } = useJurisdiction()
  const rail = useSearchRail()
  const filters = React.useMemo(() => given ?? readFilters(new URLSearchParams(searchParams)), [given, searchParams])
  const onFacets = report ?? rail?.setFacets

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
  // What the address is on its way to (Brendan, 2026-09-22): between Enter and the router's answer the screen would
  // show the last state — the old results under an empty bar, or the recent searches under a new term — so the
  // shape of the screen to come stands in until the address has caught up.
  const [awaiting, setAwaiting] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (awaiting !== null && awaiting === submitted) setAwaiting(null)
  }, [awaiting, submitted])
  const run = React.useCallback(
    (value: string) => {
      const next = value.trim()
      setQuery(next)
      setAwaiting(next)
      const params = new URLSearchParams(searchParams)
      if (next) params.set("q", next)
      else params.delete("q")
      router.replace(`${path}${params.size ? `?${params}` : ""}`, { scroll: false })
      if (next.length >= 2) setRecent((previous) => [next, ...previous.filter((r) => r !== next)].slice(0, 8))
    },
    // searchParams is read fresh here; keying on it would loop on our own replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, setRecent, path]
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
    onFacets?.({
      headings: [
        ...(bills.length ? [{ id: sectionId("bills"), title: "Bills" }] : []),
        ...(texts.length ? [{ id: sectionId("texts"), title: "Text" }] : []),
        ...(laws.length ? [{ id: sectionId("laws"), title: "Laws" }] : []),
        ...[...memberGroups, ...committeeGroups].map((g) => ({ id: g.id, title: g.title })),
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
      {/* The bar wears what the drop-down bar wore (Brendan, 2026-09-22): its height and corners, the grey ring round it, and in use a ring of the ring colour instead of the field's own focus ring. */}
      <SearchDirectory
        query={query}
        setQuery={(value) => (value === null ? run("") : setQuery(value))}
        placeholder="Search every version of every bill from every jurisdiction."
        onSubmit={() => run(query)}
        tools={
          onFilter && (
            <InputGroupButton type="button" aria-label="Filters" size="icon-xs" onClick={onFilter}>
              <SlidersHorizontal />
            </InputGroupButton>
          )
        }
        className="h-10 rounded-xl bg-background text-[15px] shadow-xs ring-4 ring-muted/60 transition-[box-shadow,border-color] dark:bg-background has-[[data-slot=input-group-control]:focus-visible]:border-ring/60 has-[[data-slot=input-group-control]:focus-visible]:ring-4 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/15 [&_input]:text-[15px]"
      />
      {awaiting !== null && awaiting !== submitted ? (
        awaiting.length >= 2 ? <ResultsSkeleton /> : <RecentSkeleton />
      ) : submitted.trim().length < 2 ? (
        <div className="flex flex-col gap-6">
          {recent.length > 0 && (
            <section className="flex flex-col">
              <h2 className="text-sm font-medium text-muted-foreground">
                Recent searches <span className="tabular-nums">({recent.length})</span>
              </h2>
              {/* A row lights as a command row does (Brendan, 2026-09-22), and its cross shows with it. */}
              <ul className="mt-2 flex flex-col">
                {recent.map((term) => (
                  <li key={term} className="group border-b py-0.5 last:border-0">
                    <div className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted hover:text-foreground">
                    <button type="button" onClick={() => run(term)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm">
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
                    </div>
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
          {/* The three blocks, a rule between each, in the bill page's column (Brendan, 2026-09-22). The laws land after the bills and take their place then. */}
          <div className="typeset w-full [&>hr]:my-8">
            {[
              bills.length > 0 && (
                <Block key={`bills-${hit}`} kind="bills" label="Bills" rows={bills} titleOf={(b) => b.title} dateOf={(b) => b.last_action_date}>
                  {(bill) => (
                    <RecordItem
                      key={bill.bill_id}
                      href={`/bills/${bill.bill_id}?state=${bill.state}`}
                      // The flag, not a chamber seal: these results span every
                      // jurisdiction, and which one a row came from is the first thing
                      // a reader needs.
                      avatar={<FlagChip state={bill.state} width={36} />}
                      // The number and the title on one line, the description under it in the chunk's body, the
                      // facts under that (Brendan, 2026-09-22). A description that only repeats the title is left out.
                      layout="search"
                      title={<Highlight text={fmtBill(bill.bill_number, bill.state)} query={hit} />}
                      lead={bill.title}
                      description={bill.description && bill.description.trim() !== bill.title.trim() ? <Highlight text={bill.description} query={hit} /> : undefined}
                      meta={[
                        bill.last_action_date ? fmtDate(bill.last_action_date) : null,
                        bill.status_desc,
                        bill.committee ? `${bill.committee} Committee` : null,
                      ]}
                    />
                  )}
                </Block>
              ),
              texts.length > 0 && (
                <Block key={`texts-${hit}`} kind="texts" label="Text" rows={texts} titleOf={(t) => t.title} dateOf={(t) => t.last_action_date}>
                  {(text) => (
                    <RecordItem
                      key={`${text.bill_id}-${text.document_id}`}
                      href={`/bills/${text.bill_id}?state=${text.state}#text`}
                      avatar={<FlagChip state={text.state} width={36} />}
                      // The bill row's shape, the match in the description's place.
                      layout="search"
                      title={<Highlight text={fmtBill(text.bill_number, text.state)} query={hit} />}
                      lead={text.title}
                      description={<Snippet text={text.snippet} />}
                      meta={[
                        text.last_action_date ? fmtDate(text.last_action_date) : null,
                        text.status_desc,
                        text.committee ? `${text.committee} Committee` : null,
                      ]}
                    />
                  )}
                </Block>
              ),
              (laws.length > 0 || (law.loading && shown("laws"))) && (
                <Block key={`laws-${hit}`} kind="laws" label="Laws" rows={laws} titleOf={(l) => l.label} dateOf={(l) => l.date} loading={law.loading && shown("laws")}>
                  {(item) => (
                    <RecordItem
                      key={item.address}
                      href={item.href}
                      avatar={<FlagChip state={stateOfLaw(item.jurisdiction)} width={36} />}
                      title={<Highlight text={item.label} query={hit} />}
                      description={item.heading ? <Highlight text={item.heading} query={hit} /> : undefined}
                      meta={[stateName(stateOfLaw(item.jurisdiction)) || "United States", item.date ? `As of ${fmtDate(item.date)}` : null]}
                    />
                  )}
                </Block>
              ),
            ]
              .filter(Boolean)
              .flatMap((block, i) => (i ? [<hr key={`rule-${i}`} />, block] : [block]))}
          </div>
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

export type { Facets } from "@/components/search-rail"
