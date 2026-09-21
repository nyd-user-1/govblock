"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { History, XIcon } from "lucide-react"

import { flagUrl, memberHref, STATE_CODES, stateName } from "@/lib/filters"
import { portraitFor } from "@/lib/imagery"
import { shortDistrict } from "@/lib/format"
import { FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { useRecents } from "@/components/home/recents"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { policyUrl } from "@/lib/policy/use-policy"
import type { SessionRow } from "@/lib/policy/types"
import { LoadingFlag } from "@/components/loading-flag"
import { PageIcon } from "@/components/page-icon"
import { districtLabel, legislativeBody } from "@/lib/legislative-body"
import { JURISDICTIONS, summary, type Jurisdiction } from "@/lib/jurisdictions"
import { matchPages, MENU_PAGES, type SearchPage } from "@/lib/search-pages"
import { KIND_LABELS, kindHref, parseQuery, withoutChip, type SearchKind } from "@/lib/search-query"
import { SlashResults, useSlashLibrary } from "@/components/slash-library"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@govblock/ui/components/nova/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@govblock/ui/components/nova/dialog"
import { Button } from "@govblock/ui/components/ny4/button"
import { fmtBill } from "@/lib/format"

// The search trigger from livingston-v3 components/command-menu.tsx, with the
// dialog behind it finally wired: ⌘K or a click opens a command menu that
// searches the jurisdiction you are in — bills, members, committees — through
// /api/policy/search, plus the site's own pages. Enter goes to the record;
// "See all results" goes to /search.
//
// The search itself — the fetch, the selection, the groups — is the hook and
// the list below, so the account home's bar can drop the same results from
// itself (Brendan, 2026-09-07) instead of opening this dialog.

type SearchPayload = {
  q: string
  bills: { bill_id: number; bill_number: string; title: string; state?: string; committee?: string | null }[]
  // district and the two photo columns are what let a member row draw a face
  // rather than a flag; the route has carried them since the directory did.
  members: {
    people_id: number
    name: string
    party: string
    chamber: string
    district: string | null
    state: string
    photo_url: string | null
    bioguide_id: string | null
    active: boolean
  }[]
  committees: { committee: string; bills: number; chamber: string; state?: string }[]
}

export type SiteSearch = {
  query: string
  bills: SearchPayload["bills"]
  members: SearchPayload["members"]
  committees: SearchPayload["committees"]
  /** Every jurisdiction, A to Z, before a word is typed; the ones whose name or code the word is in, after. */
  jurisdictions: Jurisdiction[]
  pages: SearchPage[]
  hasRecords: boolean
  selected: string
  setSelected: (value: string) => void
}

/**
 * The site search over the jurisdiction in scope, while `active`. `lead` is
 * the item to select before a word is typed, when the caller has one to put
 * above the pages (the home's recents).
 */
const matchJurisdictions = (term: string) => {
  const t = term.trim().toLowerCase()
  return JURISDICTIONS.filter((j) => j.name.toLowerCase().includes(t) || j.state.toLowerCase() === t)
}

export function useSiteSearch({ active, term, lead, within, scoped }: { active: boolean; term: string; lead?: string; /** One jurisdiction to search, from a `/ny` token; every jurisdiction without it. */ within?: string | null; /** A token narrowed the search: the jurisdictions and the site's pages stay out of it. */ scoped?: boolean }): SiteSearch {
  const { state, session, resolved } = useJurisdiction()
  const [results, setResults] = React.useState<SearchPayload | null>(null)
  const [selected, setSelected] = React.useState("")
  const query = term.trim()

  React.useEffect(() => {
    if (!active || !resolved || query.length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    const handle = setTimeout(async () => {
      try {
        // Narrowed to a place, the search is that jurisdiction's current session alone, and a longer list of it.
        const url = within
          ? policyUrl("search", { state: within }, { q: query, limit: 14 })
          : policyUrl("search", { state, session: session ? String(session) : undefined }, { q: query, limit: 6, all: 1 })
        const response = await fetch(url)
        if (!response.ok) throw new Error(String(response.status))
        const data = (await response.json()) as SearchPayload
        if (!cancelled) setResults(data)
      } catch {
        if (!cancelled) setResults(null)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [active, resolved, query, state, session, within])

  // cmdk keeps whatever was selected when the list changes underneath it, and
  // between keystroke and response the only stable item is "See all results" —
  // so the selection is controlled, and snaps to the top result every time the
  // query or its results change.
  React.useEffect(() => {
    const b = results?.bills?.[0]
    const m = results?.members?.[0]
    const c = results?.committees?.[0]
    const j = (query.length >= 2 ? matchJurisdictions(query) : JURISDICTIONS)[0]
    const p = (query.length >= 2 ? matchPages(query, 6, MENU_PAGES) : MENU_PAGES)[0]
    setSelected(
      b ? `bill-${b.bill_id}`
        : m ? `member-${m.people_id}`
        : c ? `committee-${c.committee}`
        : query.length < 2 && lead ? lead
        : j ? `jurisdiction-${j.state}`
        : p ? `page-${p.href}`
        : query.length >= 2 ? `see-all-${query}`
        : ""
    )
  }, [query, results, lead])

  const bills = results?.bills ?? []
  // Members are found nationally whatever the scope, so a place narrows them here.
  const members = (results?.members ?? []).filter((m) => !within || m.state === within)
  const committees = results?.committees ?? []
  const jurisdictions = scoped ? [] : query.length >= 2 ? matchJurisdictions(query) : JURISDICTIONS
  const pages = scoped ? [] : query.length >= 2 ? matchPages(query, 6, MENU_PAGES) : MENU_PAGES
  return { query, bills, members, committees, jurisdictions, pages, hasRecords: bills.length + members.length + committees.length > 0, selected, setSelected }
}

/** The result groups, inside a CommandList: records first, then pages, then the way to every result. */
/** Every jurisdiction's flag, fetched once per session the moment the search takes focus (Brendan, 2026-09-13): 53 files, 224 KB, so result rows draw with their flags already cached. */
let flagsWarmed = false
export function warmFlags() {
  if (flagsWarmed || typeof window === "undefined") return
  flagsWarmed = true
  for (const code of [...STATE_CODES, "US", "DC"]) {
    const img = new Image()
    img.decoding = "async"
    img.src = flagUrl(code)
  }
}

/** The way in for a search box drawn somewhere else (the account home's bar, 2026-09-21): it opens the one dialog the header mounts, so every box on the site is the same search. */
const OPEN_EVENT = "govblock:command-menu"
/** `term` opens the dialog with a search already typed: a suggestion under the bar, showing what "/" and "@" do. */
export function openCommandMenu(term?: string) {
  warmFlags()
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: typeof term === "string" ? term : undefined }))
}

/** The label column every row shares (Brendan, 2026-09-13): one width, so the descriptions line up across recents, bills, members, committees and pages. */
const LABEL = "w-48 shrink-0 truncate font-medium"

export function SearchResults({ search, state, go, kind, inCommittee, headings = {} }: { search: SiteSearch; state: string; go: (href: string) => void; /** One group alone, from a `/bills` token. */ kind?: SearchKind | null; /** Only the bills that sit in a committee, each with its committee named. */ inCommittee?: boolean; /** A group's heading where its list is a part of the whole: a place's newest bills, and of how many. */ headings?: { bills?: string; members?: string; committees?: string } }) {
  const { query, jurisdictions, pages, hasRecords } = search
  const bills = kind && kind !== "bills" ? [] : inCommittee ? search.bills.filter((b) => b.committee) : search.bills
  const members = kind && kind !== "members" ? [] : search.members
  const committees = kind && kind !== "committees" ? [] : search.committees
  return (
    <>
      <CommandEmpty>
        {query.length < 2 ? "Type to search bills, members, committees, pages..." : "Nothing found."}
      </CommandEmpty>
      {bills.length > 0 && (
        <CommandGroup heading={headings.bills ?? "Bills"}>
          {bills.map((bill) => (
            <CommandItem
              key={`bill-${bill.bill_id}`}
              className="group/row"
              value={`bill-${bill.bill_id}`}
              onSelect={() => go(`/bills/${bill.bill_id}?state=${bill.state ?? state}`)}
            >
              <FlagChip state={bill.state ?? state} width={20} />
              <span className={LABEL}>{fmtBill(bill.bill_number, bill.state ?? state)}</span>
              <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">{inCommittee && bill.committee ? `${bill.committee} · ` : ""}{bill.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {members.length > 0 && (
        <CommandGroup heading={headings.members ?? "Members"}>
          {members.map((member) => (
            <CommandItem
              key={`member-${member.people_id}`}
              className="group/row"
              value={`member-${member.people_id}`}
              onSelect={() => go(memberHref(member.people_id, member.state))}
            >
              {/* A person gets a face. Where there is no photograph on file
                  MemberPortrait draws the chamber's seal, and a jurisdiction
                  with no seal keeps its flag — so the fallback is the flag
                  that was here, in the circle the rest of the column is. */}
              <span className="relative shrink-0">
                <MemberPortrait
                  name={member.name}
                  photoUrl={portraitFor(member)}
                  state={member.state}
                  chamber={member.chamber}
                  size={24}
                />
                <PartyDot party={member.party} serving={member.active} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-popover" />
              </span>
              <span className={LABEL}>
                {member.name}
                {member.active ? "" : " (Ret.)"}
              </span>
              <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">
                {[legislativeBody(member.state, member.chamber), districtLabel(member.state, member.district)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {committees.length > 0 && (
        <CommandGroup heading={headings.committees ?? "Committees"}>
          {committees.map((committee) => (
            <CommandItem
              key={`committee-${committee.committee}`}
              className="group/row"
              value={`committee-${committee.committee}`}
              onSelect={() =>
                go(`/bills?state=${committee.state ?? state}&committee=${encodeURIComponent(committee.committee)}`)
              }
            >
              <FlagChip state={committee.state ?? state} width={20} />
              <span className={LABEL}>{committee.committee}</span>
              <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">
                {[committee.chamber, `${committee.bills} bills`].filter(Boolean).join(" · ")}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {/* Before the pages (Brendan, 2026-09-20): every jurisdiction A to Z, its flag, and what is on file for it, from the frozen counts. */}
      {jurisdictions.length > 0 && (
        <CommandGroup heading="Jurisdictions">
          {jurisdictions.map((j) => (
            <CommandItem key={j.state} className="group/row" value={`jurisdiction-${j.state}`} onSelect={() => go(`/state/${j.state.toLowerCase()}`)}>
              <FlagChip state={j.state} width={20} />
              <span className={LABEL}>{j.name}</span>
              <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">{summary(j)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {pages.length > 0 && (
        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem key={page.href} className="group/row" value={`page-${page.href}`} onSelect={() => go(page.href)}>
              {/* The same icon and sentence the nav panel gives this page, so
                  a row found by search reads like the row found by menu. */}
              <PageIcon name={page.icon} />
              <span className={LABEL}>{page.name}</span>
              <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">{page.description ?? page.group}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {query.length >= 2 && (
        <>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem
              value={`see-all-${query}`}
              onSelect={() => go(`/search?q=${encodeURIComponent(query)}&state=${state}`)}
            >
              See all results for &ldquo;{query}&rdquo;
              {hasRecords ? "" : "..."}
            </CommandItem>
          </CommandGroup>
        </>
      )}
    </>
  )
}

/** A kind's rows under a place alone; the kind's chip lists it whole. */
const PLACE_ROWS = 10

type PlaceIndex = { bills: SearchPayload["bills"]; billsTotal: number; members: SearchPayload["members"]; committees: SearchPayload["committees"]; sessions: SessionRow[]; pending: boolean }
const NO_INDEX: PlaceIndex = { bills: [], billsTotal: 0, members: [], committees: [], sessions: [], pending: false }

/**
 * A place's indexes, entry by entry (Brendan, 2026-09-21: "/ny /members — this should be showing all ny members"):
 * the lists the index pages themselves draw, from the same API, read when the scope is typed and not before.
 * `wanted` is the kinds, comma-joined; bills are the newest `billLimit`, since a session holds thousands. A list the
 * reader's plan does not open comes back refused and stays empty — the door above it leads to the page that says why.
 */
function usePlaceIndex(active: boolean, state: string | null, wanted: string, billLimit: number): PlaceIndex {
  const [index, setIndex] = React.useState<PlaceIndex>(NO_INDEX)
  React.useEffect(() => {
    if (!active || !state || !wanted) {
      setIndex(NO_INDEX)
      return
    }
    let cancelled = false
    setIndex({ ...NO_INDEX, pending: true })
    const kinds = wanted.split(",")
    const read = async <T,>(resource: string, extra: Record<string, number> = {}): Promise<T | null> => {
      if (!kinds.includes(resource)) return null
      try {
        const response = await fetch(policyUrl(resource, { state }, extra))
        return response.ok ? ((await response.json()) as T) : null
      } catch {
        return null
      }
    }
    const handle = setTimeout(async () => {
      const [bills, members, committees, sessions] = await Promise.all([
        read<{ rows: SearchPayload["bills"]; total: number }>("bills", { limit: billLimit }),
        read<Omit<SearchPayload["members"][number], "state">[]>("members"),
        read<{ committee_name: string; chamber: string; bills: number }[]>("committees"),
        read<SessionRow[]>("sessions"),
      ])
      if (cancelled) return
      setIndex({
        bills: (bills?.rows ?? []).map((b) => ({ ...b, state })),
        billsTotal: bills?.total ?? 0,
        members: (members ?? []).map((m) => ({ ...m, state })),
        committees: (committees ?? []).map((c) => ({ committee: c.committee_name, bills: c.bills, chamber: c.chamber, state })),
        sessions: sessions ?? [],
        pending: false,
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [active, state, wanted, billLimit])
  return index
}

/**
 * `trigger={false}` mounts the dialog and its ⌘K listener without the search
 * box. The header stopped drawing a box on 2026-09-08 — the hero carries the
 * search now — but the shortcut belongs to the whole site, so it still lives
 * up here, silently.
 */
/**
 * The search itself, for whatever draws it (Brendan, 2026-09-21): the ⌘K dialog, and the bars on the account home and
 * the root that drop the same results from themselves. One engine — the grammar, the lookups, the doors, the selection
 * — so a bar and the dialog cannot drift apart again, as the account home's first bar and the dialog did.
 */
export function useSearchEngine(open: boolean, term: string) {
  const { state } = useJurisdiction()
  const recents = useRecents(5)
  const lead = recents[0] ? `recent-${recents[0].href}` : undefined
  // What was typed, as words and tokens (lib/search-query.ts, 2026-09-21): `/` narrows where or what kind, `@` who,
  // and the rest is words. A lone `/` or `@` that names no scope still reads the corpus by address, as it has since
  // window 1 (2026-09-14); a bill number and a name go to the same two lookups, narrowed to the place when there is one.
  const parsed = React.useMemo(() => parseQuery(term), [term])
  const lookup = parsed.mode === "library" ? `/${parsed.words}` : parsed.mode === "at" ? `@${parsed.words}` : parsed.mode === "number" ? `/${parsed.number}` : parsed.mode === "who" ? `@${parsed.who}` : parsed.mode === "place" && (!parsed.kind || parsed.kind === "laws") ? `/${(parsed.where ?? "").toLowerCase()}` : ""
  const slash = useSlashLibrary(lookup, open, parsed.mode === "number" || parsed.mode === "who" ? parsed.where : null)
  // A place's indexes under its doors: every kind's entries for `/ny`, the one kind's for `/ny /members`. The laws are the library's, above.
  const wanted = parsed.mode === "place" ? (parsed.kind ? [parsed.kind] : (Object.keys(KIND_LABELS) as SearchKind[])).filter((k) => k !== "laws").join(",") : ""
  const index = usePlaceIndex(open, parsed.mode === "place" ? parsed.where : null, wanted, parsed.kind ? 40 : 10)
  const scoped = !!(parsed.where || parsed.kind || parsed.inCommittee)
  const search = useSiteSearch({ active: open && parsed.mode === "words", term: parsed.words, lead, within: parsed.where, scoped })
  // A place or a kind by itself: the pages it opens. `/ny` is New York's four doors (its codes follow, from the library); `/bills` is every jurisdiction's bills, Congress first; `/bills /ny` is the one.
  const doors = React.useMemo(() => {
    if (parsed.mode === "place" && parsed.where) {
      const code = parsed.where
      return (parsed.kind ? [parsed.kind] : (Object.keys(KIND_LABELS) as SearchKind[])).map((k) => ({ key: `${k}-${code}`, state: code, label: `${code === "US" ? "U.S. Congress" : stateName(code)} ${KIND_LABELS[k].toLowerCase()}`, detail: kindHref(k, code), href: kindHref(k, code) }))
    }
    if (parsed.mode === "kind" && parsed.kind) {
      const k = parsed.kind
      return [...JURISDICTIONS].sort((a, b) => Number(b.state === "US") - Number(a.state === "US")).map((j) => ({ key: `${k}-${j.state}`, state: j.state, label: j.name, detail: kindHref(k, j.state), href: kindHref(k, j.state) }))
    }
    return []
  }, [parsed])
  const [slashSelected, setSlashSelected] = React.useState("")
  React.useEffect(() => {
    // Under a place's doors the codes are a second list; Enter stays on the first door.
    if (doors.length) return
    const first = slash.result?.items[0]
    setSlashSelected(slash.result?.href ? `slash-open-${slash.result.href}` : first ? `slash-${first.href ?? first.address}` : "")
  }, [slash.result, doors.length])
  React.useEffect(() => {
    const first = slash.at ? [...slash.at.citations, ...slash.at.members, ...slash.at.committees].find((i) => i.href) : null
    setSlashSelected(first ? `at-${first.kind}-${first.label}-${first.href}` : "")
  }, [slash.at])
  const showRecents = !slash.mode && !doors.length && search.query.length < 2 && recents.length > 0
  // The doors lead the list, so the first of them is what Enter opens.
  React.useEffect(() => {
    if (doors.length) setSlashSelected(`door-${doors[0].key}`)
  }, [doors])
  // `@martinez /members`: one group of the two.
  const at = slash.at && parsed.kind ? { ...slash.at, citations: [], members: parsed.kind === "members" ? slash.at.members : [], committees: parsed.kind === "committees" ? slash.at.committees : [] } : slash.at
  return { state, parsed, lookup, slash, search, doors, index, at, recents, showRecents, selected: slash.mode || doors.length ? slashSelected : search.selected, setSelected: slash.mode || doors.length ? setSlashSelected : search.setSelected }
}

export type SearchEngine = ReturnType<typeof useSearchEngine>

/** What the engine found, inside a Command: the chips of what narrowed the search, then the list. */
export function SearchPanel({ engine, term, setTerm, go, listClassName = "max-h-[30rem]", chips = true }: { engine: SearchEngine; term: string; setTerm: (next: string) => void; go: (href: string) => void; listClassName?: string; /** Off where the host draws the chips inside its own bar. */ chips?: boolean }) {
  const { state, parsed, lookup, slash, search, doors, index, at, recents, showRecents } = engine
  return (
    <>
    {/* What the tokens narrowed the search to; a chip's cross takes its token back out of the box. */}
    {chips && parsed.chips.length > 0 && (
      <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
        {parsed.chips.map((chip) => (
          <span key={chip.key} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-0.5 pr-1 pl-2 text-xs font-medium text-primary">
            {chip.state && <FlagChip state={chip.state} width={16} />}
            {chip.label}
            <button type="button" aria-label={`Remove ${chip.label}`} onClick={() => setTerm(withoutChip(term, chip))} className="rounded-full p-0.5 hover:bg-primary/15">
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
      </div>
    )}
    <CommandList className={listClassName}>
      {showRecents && (
        <CommandGroup heading="Recents">
          {recents.map((recent) => (
            <CommandItem key={recent.href} value={`recent-${recent.href}`} onSelect={() => go(recent.href)}>
              <History className="text-muted-foreground" />
              <span className={LABEL}>{recent.title}</span>
              <span className="min-w-0 flex-1 truncate pl-2 text-muted-foreground">{recent.group}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {doors.length > 0 && (
        <CommandGroup heading={parsed.mode === "kind" && parsed.kind ? KIND_LABELS[parsed.kind] : undefined}>
          {doors.map((door) => (
            <CommandItem key={door.key} className="group/row" value={`door-${door.key}`} onSelect={() => go(door.href)}>
              <FlagChip state={door.state} width={20} />
              <span className={LABEL}>{door.label}</span>
              <span className="min-w-0 flex-1 truncate pl-2 text-left font-mono text-xs text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">{door.detail}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {/* A place's indexes, entry by entry, in the rows the search's own results wear; the laws follow, from the library. */}
      {parsed.mode === "place" && parsed.where && (
        <>
          {index.pending && (
            <CommandGroup>
              <div className="flex justify-center py-3"><LoadingFlag width={28} /></div>
            </CommandGroup>
          )}
          {/* In the doors' order. Under a place alone each kind shows its first ten, so none buries the next (the codes
              sat under 213 members, Brendan, 2026-09-21: "why didn't that show the ny code?"); the kind's chip lists it whole. */}
          {(["bills", "laws", "members", "committees"] as const).map((k) =>
            k === "laws" ? (
              slash.mode && <SlashResults key={k} mode={slash.mode} result={slash.result} at={at} pending={slash.pending} term={lookup} go={go} place limit={parsed.kind ? undefined : PLACE_ROWS} />
            ) : (
              <SearchResults
                key={k}
                kind={k}
                search={{ query: "", bills: index.bills, members: parsed.kind ? index.members : index.members.slice(0, PLACE_ROWS), committees: parsed.kind ? index.committees : index.committees.slice(0, PLACE_ROWS), jurisdictions: [], pages: [], hasRecords: true, selected: "", setSelected: () => {} }}
                state={parsed.where!}
                go={go}
                headings={{
                  bills: index.billsTotal > index.bills.length ? `Bills · newest ${index.bills.length} of ${index.billsTotal.toLocaleString("en-US")}` : undefined,
                  members: !parsed.kind && index.members.length > PLACE_ROWS ? `Members · ${PLACE_ROWS} of ${index.members.length}` : undefined,
                  committees: !parsed.kind && index.committees.length > PLACE_ROWS ? `Committees · ${PLACE_ROWS} of ${index.committees.length}` : undefined,
                }}
              />
            )
          )}
          {index.sessions.length > 0 && (
            <CommandGroup heading="Sessions">
              {index.sessions.map((session) => (
                <CommandItem key={session.session_id} className="group/row" value={`session-${parsed.where}-${session.session_id}`} onSelect={() => go(`/bills?state=${parsed.where}&session=${session.session_id}`)}>
                  <FlagChip state={parsed.where!} width={20} />
                  <span className={LABEL}>{session.title}</span>
                  <span className="min-w-0 flex-1 truncate pl-2 text-left text-muted-foreground transition-colors group-data-[selected=true]/row:text-foreground">{session.bills.toLocaleString("en-US")} bills</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </>
      )}
      {parsed.mode === "place" ? null : slash.mode ? (
        <SlashResults mode={slash.mode} result={slash.result} at={at} pending={slash.pending} term={lookup} go={go} />
      ) : doors.length ? null : (
        <SearchResults search={search} state={parsed.where ?? state} go={go} kind={parsed.kind} inCommittee={parsed.inCommittee} />
      )}
    </CommandList>
    </>
  )
}

export function CommandMenu({ trigger = true }: { trigger?: boolean } = {}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [term, setTerm] = React.useState("")
  const engine = useSearchEngine(open, term)

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
      // The `/` door in Typeset (window 4): "/" outside the editor's own text opens the menu on the corpus. The Library has a box of its own.
      const target = event.target as HTMLElement | null
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      const path = window.location.pathname
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !typing && path.startsWith("/workspace/typeset/") && !path.startsWith("/workspace/typeset/library") && !path.endsWith("/library")) {
        event.preventDefault()
        setTerm("/")
        setOpen(true)
      }
    }
    const show = (event: Event) => {
      const typed = (event as CustomEvent<string | undefined>).detail
      if (typed) setTerm(typed)
      setOpen(true)
    }
    document.addEventListener("keydown", down)
    window.addEventListener(OPEN_EVENT, show)
    return () => {
      document.removeEventListener("keydown", down)
      window.removeEventListener(OPEN_EVENT, show)
    }
  }, [])

  const go = React.useCallback(
    (href: string) => {
      setOpen(false)
      setTerm("")
      router.push(href)
    },
    [router]
  )

  return (
    <>
      {trigger ? (
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-8 w-full justify-start rounded-lg border-none bg-muted pl-3 text-foreground shadow-none transition-colors hover:bg-muted/50 md:w-48 lg:w-40 xl:w-64 dark:bg-card"
      >
        <span className="hidden xl:inline-flex">Search documentation...</span>
        <span className="inline-flex xl:hidden">Search...</span>
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-0.5 rounded border bg-background px-1.5 font-sans text-[10px] font-medium text-muted-foreground select-none sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search bills, members, committees and pages...</DialogDescription>
        </DialogHeader>
        <DialogContent className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0 sm:max-w-[62rem]" showCloseButton={false}>
          <Command shouldFilter={false} value={engine.selected} onValueChange={engine.setSelected}>
            <CommandInput
              onFocus={warmFlags}
              placeholder="Search"
              value={term}
              onValueChange={setTerm}
            />
            <SearchPanel engine={engine} term={term} setTerm={setTerm} go={go} />
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
