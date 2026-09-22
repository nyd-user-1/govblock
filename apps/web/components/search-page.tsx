"use client"

import * as React from "react"
import { ArrowDownAZ, ArrowUpAZ, CalendarArrowDown, CalendarArrowUp, Clock, SlidersHorizontal, TrendingUp, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Skeleton } from "@govblock/ui/components/ny4/skeleton"

import Link from "next/link"

import { SearchDirectory } from "@/components/directory-search"
import { InputGroupButton } from "@govblock/ui/components/nova/input-group"
import { memberHref, stateName } from "@/lib/filters"
import { portraitFor } from "@/lib/imagery"
import { fmtBill, fmtDate, fmtNumber } from "@/lib/format"
import { districtLabel, legislativeBody, memberLine } from "@/lib/legislative-body"
import { isFiltered, readFilters, sectionId, sinceDate, writeFilters, type SearchFilterState } from "@/components/search-filters"
import { useSearchRail, type Facets } from "@/components/search-rail"
import { Highlight } from "@/components/search-highlight"
import { SearchSection as Section, Snippet } from "@/components/search-sections"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { H3 } from "@/components/typeset"
import { Button } from "@govblock/ui/components/ny4/button"
import { NAV_BUTTON } from "@/components/docs-header"
import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from "@govblock/ui/components/animate-ui/components/animate/tabs"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useLocal } from "@/lib/policy/use-local"
import { usePolicy } from "@/lib/policy/use-policy"
import { matchPages } from "@/lib/search-pages"
import { TRENDING } from "@/lib/trending"
import { useAccount } from "@/lib/auth/use-account"
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
  /** Every bill that matches, uncapped: what the count line measures against (2026-09-22). */
  total?: number
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
 * The three kinds the results are drawn in (Brendan, 2026-09-22): Bills, Text and Laws, as three tabs of one panel
 * rather than three headings with a rule between them. The sort in the tab row is shared by all three — a press
 * sorts, a second turns it round, a third leaves the rows as the search ranked them.
 */
type Sort = { by: "title" | "date"; reversed: boolean } | null

/**
 * The search: the bar, the recent searches, the sections. /search draws it under its shell with the rail's filters
 * (app/search/page.tsx); the account home draws it in place of its bar (Brendan, 2026-09-22: "replace the search
 * experience on the home page with the search bar and experience from the /search page"). `path` is the page the
 * query is written to, so a search on either page is a link to itself.
 */
export function SearchResults({ filters: given, onFacets: report, path = "/search", onFilter, cap, dropdown = false }: { /** The most rows a block draws, with a way to the rest: the root's twenty (2026-09-22). */ cap?: number; /** The bar carries its own drop-down rather than standing over the page's results (the account home, 2026-09-22). */ dropdown?: boolean; /** The filters; read off the address when none are passed, as the rail's panel writes them (components/search-rail.tsx). */ filters?: SearchFilterState; /** Where what was found is reported; the rail's store when nothing is passed. */ onFacets?: (facets: Facets) => void; path?: string; /** Pressed, the filter icon in the bar: the root opens its right rail on the filters. No icon without it. */ onFilter?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, session, resolved } = useJurisdiction()
  const rail = useSearchRail()
  const { signedIn } = useAccount()
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

  // The filters, applied (2026-09-22). A list left empty means every one of
  // them, so an untouched panel hides nothing. Each filter reads a column the
  // row already carries and leaves alone the kinds that do not carry it: a
  // member has no last action, a law has no committee.
  const inPlaces = <T extends { state: string }>(rows: T[]) => (filters.places.length ? rows.filter((r) => filters.places.includes(r.state)) : rows)
  const from = sinceDate(filters.since)
  const fresh = (date: string | null | undefined) => !from || (!!date && date >= from)
  const inCommittee = (committee: string | null | undefined) => !filters.committees.length || (!!committee && filters.committees.includes(committee))
  const shown = (key: string) => filters.show.length === 0 || filters.show.includes(key)
  const bills = shown("bills")
    ? inPlaces(raw.bills).filter(
        (b) =>
          (!filters.chamber || b.body === filters.chamber) &&
          (!filters.status.length || filters.status.includes(b.status_desc ?? "")) &&
          fresh(b.last_action_date) &&
          inCommittee(b.committee)
      )
    : []
  const texts = shown("texts") ? inPlaces(raw.texts).filter((t) => fresh(t.last_action_date) && inCommittee(t.committee)) : []
  const laws = shown("laws") ? (filters.places.length ? law.laws.filter((l) => filters.places.includes(stateOfLaw(l.jurisdiction))) : law.laws) : []
  const members = shown("members")
    ? inPlaces(raw.members).filter(
        (m) =>
          (!filters.parties.length || filters.parties.includes((m.party ?? "").toUpperCase())) &&
          (!filters.serving || (filters.serving === "yes") === !!m.active)
      )
    : []
  const committees = shown("committees") ? inPlaces(raw.committees) : []
  const shownPages = shown("pages") ? pages : []
  const byState = <T extends { state: string }>(row: T) => row.state
  const memberGroups = grouped("members", "Members", members, byState, state)
  // Committees and topics came out of the results (Brendan, 2026-09-22); a committee is found by name in the search's
  // own dialog, and a topic is a filter rather than a result.
  const total = bills.length + members.length + texts.length + laws.length + shownPages.length
  // What the reader typed, for the marks below. The Text group gets its
  // highlights from ts_headline; every other group has to find its own.
  const hit = submitted.trim()

  // The sort the tab row holds, shared by the three tabs: a press sorts, a second press turns it round, a third
  // leaves the rows as the search ranked them.
  const [sort, setSort] = React.useState<Sort>(null)
  // The tab the reader is on: one is drawn at a time, so it is what the count line counts.
  const [tab, setTab] = React.useState("bills")
  // The drop-down's own state: open while the bar has focus, on the account home.
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    setSort(null)
    setTab("bills")
  }, [hit])
  const press = (by: "title" | "date") => setSort((s) => (s?.by === by ? (s.reversed ? null : { by, reversed: true }) : { by, reversed: false }))
  const TitleIcon = sort?.by === "title" && sort.reversed ? ArrowUpAZ : ArrowDownAZ
  const DateIcon = sort?.by === "date" && sort.reversed ? CalendarArrowUp : CalendarArrowDown

  /** Where a capped block sends the reader for the rest: the search page, carrying the query and the filters. */
  const seeAll = `/search?${writeFilters(new URLSearchParams({ q: hit }), filters)}`

  // What each tab holds, and how a row of it is drawn. The bills and their text read as one shape — the number and
  // the title on a line, the description or the matched chunk under it, the facts under that — and a law keeps its
  // citation, cut short, since an act's whole name is a sentence.
  type Kind = { key: string; label: string; rows: unknown[]; title: (row: never) => string; date: (row: never) => string | null | undefined; render: (row: never) => React.ReactNode }
  const KINDS: Kind[] = [
    {
      key: "bills",
      label: "Bills",
      rows: bills,
      title: ((b: SearchPayload["bills"][number]) => b.title) as Kind["title"],
      date: ((b: SearchPayload["bills"][number]) => b.last_action_date) as Kind["date"],
      render: ((bill: SearchPayload["bills"][number]) => (
        <RecordItem
          key={bill.bill_id}
          href={`/bills/${bill.bill_id}?state=${bill.state}`}
          // The flag, not a chamber seal: these results span every jurisdiction, and which one a row came from is the
          // first thing a reader needs.
          avatar={<FlagChip state={bill.state} width={36} />}
          layout="search"
          title={<Highlight text={fmtBill(bill.bill_number, bill.state)} query={hit} />}
          lead={bill.title}
          // Whichever it has (Brendan, 2026-09-22): the description where it says more than the title, and the title
          // itself where it does not — a federal bill's title often is its description, and the row stood empty.
          description={<Highlight text={bill.description && bill.description.trim() !== bill.title.trim() ? bill.description : bill.title} query={hit} />}
          meta={[bill.last_action_date ? fmtDate(bill.last_action_date) : null, bill.status_desc, bill.committee ? `${bill.committee} Committee` : null]}
        />
      )) as Kind["render"],
    },
    {
      key: "texts",
      label: "Text",
      rows: texts,
      title: ((t: SearchPayload["texts"][number]) => t.title) as Kind["title"],
      date: ((t: SearchPayload["texts"][number]) => t.last_action_date) as Kind["date"],
      render: ((text: SearchPayload["texts"][number]) => (
        <RecordItem
          key={`${text.bill_id}-${text.document_id}`}
          href={`/bills/${text.bill_id}?state=${text.state}#text`}
          avatar={<FlagChip state={text.state} width={36} />}
          layout="search"
          title={<Highlight text={fmtBill(text.bill_number, text.state)} query={hit} />}
          lead={text.title}
          description={<Snippet text={text.snippet} />}
          meta={[text.last_action_date ? fmtDate(text.last_action_date) : null, text.status_desc, text.committee ? `${text.committee} Committee` : null]}
        />
      )) as Kind["render"],
    },
    {
      key: "laws",
      label: "Laws",
      rows: laws,
      title: ((l: FindItem) => l.label) as Kind["title"],
      date: ((l: FindItem) => l.date) as Kind["date"],
      render: ((item: FindItem) => (
        <RecordItem
          key={item.address}
          href={item.href}
          avatar={<FlagChip state={stateOfLaw(item.jurisdiction)} width={36} />}
          truncateTitle
          title={<Highlight text={item.label} query={hit} />}
          description={item.heading ? <Highlight text={item.heading} query={hit} /> : undefined}
          meta={[stateName(stateOfLaw(item.jurisdiction)) || "United States", item.date ? `As of ${fmtDate(item.date)}` : null]}
        />
      )) as Kind["render"],
    },
  ]
  /** A tab's rows in the order the tab row asks for. */
  const sortRows = (kind: Kind) =>
    sort
      ? [...kind.rows].sort((a, b) => {
          const order =
            sort.by === "title"
              ? kind.title(a as never).localeCompare(kind.title(b as never), "en", { sensitivity: "base" })
              : (kind.date(b as never) ?? "").localeCompare(kind.date(a as never) ?? "")
          return sort.reversed ? -order : order
        })
      : kind.rows
  // What the page draws, and what the search found in all — the uncapped count of matching bills, which is larger
  // than any shortlist and is what "of N" means (Brendan, 2026-09-22).
  // The tab that is open, falling back to the first with anything in it.
  const open_ = KINDS.find((k) => k.key === tab && k.rows.length) ? tab : (KINDS.find((k) => k.rows.length)?.key ?? "bills")
  const drawn = KINDS.find((k) => k.key === open_)?.rows.length ?? 0
  const shown_ = Math.min(cap ?? drawn, drawn)
  const found = Math.max(data?.total ?? 0, total)
  const held = raw.bills.length + raw.members.length + raw.texts.length + law.laws.length + pages.length

  // The rail's panel reads what the page has, before any filter: how many rows
  // each section holds, and which jurisdictions, committees, chambers,
  // statuses and parties the results carry, each with its count. Its index
  // reads the headings as the page draws them, after the filters.
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
        ...memberGroups.map((g) => ({ id: g.id, title: g.title })),
        ...(shownPages.length ? [{ id: sectionId("pages"), title: "Pages" }] : []),
      ],
      counts: { bills: raw.bills.length, texts: raw.texts.length, laws: law.laws.length, members: raw.members.length, committees: raw.committees.length, topics: topics.length, pages: pages.length },
      // Every jurisdiction any kind of row came from, the reader's first and Congress next, then by weight.
      places: tally([
        ...raw.bills.map((b) => b.state),
        ...raw.texts.map((t) => t.state),
        ...raw.members.map((m) => m.state),
        ...raw.committees.map((c) => c.state),
        ...law.laws.map((l) => stateOfLaw(l.jurisdiction)),
      ]).sort((a, b) => Number(b.value === state) - Number(a.value === state) || Number(b.value === "US") - Number(a.value === "US") || b.count - a.count || a.value.localeCompare(b.value)),
      committees: tally([...raw.bills.map((b) => b.committee), ...raw.texts.map((t) => t.committee)]).slice(0, 12),
      parties: tally(raw.members.map((m) => (m.party ?? "").toUpperCase())),
      serving: { yes: raw.members.filter((m) => m.active).length, no: raw.members.filter((m) => !m.active).length },
      chambers: tally(raw.bills.map((b) => b.body)),
      statuses: tally(raw.bills.map((b) => b.status_desc)),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, law.laws.length, topics.length, pages.length, filters, state])

  // The bar wears what the drop-down bar wore (Brendan, 2026-09-22): its height and corners, the grey
  // ring round it, and in use a ring of the ring colour instead of the field's own focus ring.
  const bar = (
        <SearchDirectory
          query={query}
          setQuery={(value) => (value === null ? run("") : setQuery(value))}
          placeholder="Search every version of every bill from every jurisdiction."
          onSubmit={() => run(query)}
          // The filter icon while the bar is empty; once a search has been run the clear cross takes that slot and the
          // filters are a button in the tab row above the results (Brendan, 2026-09-22).
          tools={
            onFilter && !query ? (
              <InputGroupButton type="button" aria-label="Filters" size="icon-xs" onClick={onFilter}>
                <SlidersHorizontal />
              </InputGroupButton>
            ) : undefined
          }
          className="h-10 rounded-xl bg-background text-[15px] shadow-xs ring-4 ring-muted/60 transition-[box-shadow,border-color] dark:bg-background has-[[data-slot=input-group-control]:focus-visible]:border-ring/60 has-[[data-slot=input-group-control]:focus-visible]:ring-4 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/15 [&_input]:text-[15px]"
        />
  )
  const body = (
    <>
        {awaiting !== null && awaiting !== submitted ? (
          awaiting.length >= 2 ? <ResultsSkeleton /> : <RecentSkeleton />
        ) : submitted.trim().length < 2 ? (
          <div className="flex flex-col gap-6">
            {/* A reader who has signed in has their own searches; one who has not is shown what the country is legislating about (Brendan, 2026-09-22). */}
            {signedIn && recent.length > 0 && (
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
            {!signedIn && (
              <section className="flex flex-col">
                <h2 className="text-sm font-medium text-muted-foreground">Trending</h2>
                <ul className="mt-2 flex flex-col">
                  {TRENDING.map((item) => (
                    <li key={item.term} className="border-b py-0.5 last:border-0">
                      <button
                        type="button"
                        onClick={() => run(item.term)}
                        className="-mx-2 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <TrendingUp className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{item.term}</span>
                        {/* Why it is here: the bills whose title carries it, this session (Brendan, 2026-09-22 — the jurisdiction count ranked the list, the bill count is what a reader wants beside the words). */}
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtNumber(item.bills)} bills</span>
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
              {/* What is on the page, against what there is: the rows are a shortlist, and `total` is every bill that matches. */}
              {shown_ < found ? `Showing ${fmtNumber(shown_)} of ${fmtNumber(found)}` : fmtNumber(found)}{" "}
              {found === 1 ? "result" : "results"} for &ldquo;{submitted.trim()}&rdquo;
              {isFiltered(filters) && held > total ? <> · {fmtNumber(held - total)} hidden by the filters</> : null}
            </p>
            {/* One panel, three tabs (Brendan, 2026-09-22): Bills, Text and Laws where three headings and three rules
                stood, in the glossary's tabs. The sort buttons and the way into the filters sit in the tab row at the
                right, so what orders a list and what narrows it are in one place above it. Twenty rows a tab, and the
                rest a page away. */}
            {(bills.length > 0 || texts.length > 0 || laws.length > 0 || (law.loading && shown("laws"))) && (
              <Tabs value={open_} onValueChange={setTab} className="gap-0">
                <div className="flex items-end justify-between gap-4">
                  <TabsList>
                    {KINDS.filter((kind) => kind.rows.length > 0 || (kind.key === "laws" && law.loading && shown("laws"))).map((kind) => (
                      <TabsTrigger key={kind.key} value={kind.key}>
                        {kind.label} <span className="tabular-nums text-muted-foreground">{fmtNumber(kind.rows.length)}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <div className="flex gap-2">
                    {/* The filters, where the sort buttons are: the bar's own icon steps aside once a search has been run. */}
                    {onFilter && (
                      <Button variant="secondary" size="icon" className={NAV_BUTTON} aria-label="Filters" onClick={onFilter}>
                        <SlidersHorizontal />
                      </Button>
                    )}
                    <Button variant="secondary" size="icon" className={NAV_BUTTON} aria-pressed={sort?.by === "title"} aria-label={sort?.by === "title" && !sort.reversed ? "Sort Z to A" : "Sort A to Z"} onClick={() => press("title")}>
                      <TitleIcon />
                    </Button>
                    <Button variant="secondary" size="icon" className={NAV_BUTTON} aria-pressed={sort?.by === "date"} aria-label={sort?.by === "date" && !sort.reversed ? "Sort oldest first" : "Sort newest first"} onClick={() => press("date")}>
                      <DateIcon />
                    </Button>
                  </div>
                </div>
                <TabsContents>
                  {KINDS.map((kind) => (
                    <TabsContent key={kind.key} value={kind.key} id={sectionId(kind.key)} className="scroll-mt-[calc(var(--header-height)+2rem)]">
                      {kind.key === "laws" && law.loading && shown("laws") ? (
                        <div className="mt-4 flex flex-col divide-y divide-border" aria-busy="true">
                          <RowSkeleton />
                          <RowSkeleton />
                          <RowSkeleton />
                        </div>
                      ) : (
                        <>
                          <RecordList className="mt-4 mb-0">{sortRows(kind).slice(0, cap ?? kind.rows.length).map((row) => kind.render(row as never))}</RecordList>
                          {/* Twenty is the root's lot: past that the particle field under the page has too much to carry, and the rest are a page away. */}
                          {/* How many there are, not how many came back: the bills' count is the uncapped one. */}
                          {cap && kind.rows.length > cap && (
                            <Link href={seeAll} className="mt-3 inline-block text-sm text-primary no-underline hover:underline">
                              See all {fmtNumber(kind.key === "bills" ? Math.max(found, kind.rows.length) : kind.rows.length)} {kind.label.toLowerCase()}
                            </Link>
                          )}
                        </>
                      )}
                    </TabsContent>
                  ))}
                </TabsContents>
              </Tabs>
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
            <Section id={sectionId("pages")} title="Pages" count={shownPages.length}>
              {shownPages.map((page) => (
                <RecordItem key={page.href} href={page.href} title={<Highlight text={page.name} query={hit} />} meta={[page.group]} />
              ))}
            </Section>
          </>
        )}
    </>
  )

  // The bar with its own drop-down (Brendan, 2026-09-22): click into it on the account home and what would stand
  // down the page — the trending rows, and the results once a search has been run — falls under the bar instead,
  // the way the bar there worked before the search page took its place. Escape closes it, and so does a click past
  // it; a press inside must not blur the field, or the panel would close before the click landed on a row.
  if (dropdown)
    return (
      <div
        className="relative w-full"
        data-scope-content
        onFocusCapture={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false)
        }}
      >
        {bar}
        {open && (
          <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border bg-popover text-left text-popover-foreground shadow-lg" onMouseDown={(event) => event.preventDefault()}>
            <div className="max-h-[min(32rem,70svh)] overflow-y-auto p-4">{body}</div>
          </div>
        )}
      </div>
    )

  return (
    <div className="flex flex-col gap-6" data-scope-content>
      {bar}
      {body}
    </div>
  )
}

export type { Facets } from "@/components/search-rail"
