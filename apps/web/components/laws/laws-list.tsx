"use client"

import * as React from "react"
import Link from "next/link"

import { SearchDirectory } from "@/components/directory-search"
import { FlagChip } from "@/components/policy/imagery"
import { RecordItem, RecordList, RecordSeal } from "@/components/policy/record-item"
import { fmtNumber } from "@/lib/format"
import { lawCitation, lawName, lawsNoun, titleHeading, type LawRow } from "@/lib/law-citation"
import { hasSeal } from "@/lib/imagery"
import { matchesQuery } from "@/lib/search-match"

// One jurisdiction's laws on /bills/<code>'s design (Brendan, 2026-09-19): the
// search bar, then a row a law — its citation in the bold slot, its section
// count on the meta line, its name as the description — each opening the law's
// text on the same page. Typing narrows the list; it is a few hundred rows at
// most, all in hand.
//
// Grouped by the level above the law where the code has one (the same day):
// Alaska's chapters under their titles — Title 1 · General Provisions holds
// 01.05, 01.10 and 01.15 — Massachusetts's under its Parts, Illinois's acts
// under their ILCS chapters, from the XML library's titles. A code without
// that level and with more than one kind of law (New York's consolidated and
// unconsolidated laws, court acts, rules) is grouped by kind instead.

const KIND: Record<string, string> = { CONSOLIDATED: "Consolidated laws", MISC: "Constitution", UNCONSOLIDATED: "Unconsolidated laws", COURT_ACTS: "Court acts", RULES: "Rules" }

type Group = { key: string; heading: string | null; laws: LawRow[] }

/** The laws in their groups, in the order given: by title where the code has titles, by kind where it has several, else one group. */
function groupsOf(laws: LawRow[]): Group[] {
  const titled = laws.some((l) => l.title)
  const kinds = new Set(laws.map((l) => l.law_type))
  if (!titled && kinds.size < 2) return [{ key: "all", heading: null, laws }]
  const groups = new Map<string, Group>()
  for (const law of laws) {
    const key = titled ? law.title ?? "" : law.law_type
    const heading = titled ? titleHeading(law) : KIND[law.law_type] ?? law.law_type
    const group = groups.get(key) ?? { key, heading, laws: [] }
    group.laws.push(law)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export function LawsList({ state, name, laws }: { state: string; name: string; laws: LawRow[] }) {
  const [query, setQuery] = React.useState("")
  const shown = query.trim() ? laws.filter((l) => matchesQuery(query, l.law_name, l.law_id, l.chapter, lawCitation(state, l), l.title, l.title_name)) : laws
  const avatar = hasSeal(state) ? <RecordSeal state={state} /> : <FlagChip state={state} width={36} />
  const rows = (list: LawRow[]) => (
    <RecordList>
      {list.map((law) => (
        <RecordItem
          key={law.law_id}
          href={`/laws/${state.toLowerCase()}?law=${encodeURIComponent(law.law_id)}`}
          avatar={avatar}
          title={lawCitation(state, law)}
          meta={[`${fmtNumber(law.sections)} ${law.sections === 1 ? "section" : "sections"}`]}
          description={lawName(state, law)}
        />
      ))}
    </RecordList>
  )
  const groups = groupsOf(shown)
  return (
    <>
      <SearchDirectory query={query} setQuery={(value) => setQuery(value ?? "")} placeholder={`Search ${name} laws by name or chapter…`} />
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No laws of {name} matching &ldquo;{query}&rdquo;.
        </p>
      ) : groups.length === 1 && !groups[0]!.heading ? (
        rows(shown)
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mt-8">
            <h2 className="text-sm font-medium text-muted-foreground">
              {group.heading ?? "Other"} <span className="tabular-nums">({group.laws.length})</span>
            </h2>
            {rows(group.laws)}
          </section>
        ))
      )}
    </>
  )
}

/**
 * The chapters index in the laws list's right rail (Brendan, 2026-09-19):
 * every law of the code by number and name, as the old browser's left rail
 * carried them, under their titles where the code has them, in the contents
 * block's type and a scrolling box of its own.
 */
export function LawChapters({ state, laws }: { state: string; laws: LawRow[] }) {
  const [filter, setFilter] = React.useState("")
  const noun = lawsNoun(state, laws)
  const shown = filter.trim() ? laws.filter((l) => matchesQuery(filter, l.law_name, l.law_id, l.chapter, l.title, l.title_name)) : laws
  const groups = groupsOf(shown)
  return (
    <div className="flex flex-col gap-2 p-4 pt-0 text-sm">
      <p className="h-6 text-xs font-medium text-muted-foreground">
        {noun} · {fmtNumber(laws.length)}
      </p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${noun.toLowerCase()}…`}
        aria-label={`Filter the ${noun.toLowerCase()}`}
        className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="-mx-2 max-h-[60svh] overflow-y-auto">
        {groups.map((group) => (
          <div key={group.key}>
            {group.heading && <p className="truncate px-2 pt-3 pb-1 text-xs font-medium text-foreground">{group.heading}</p>}
            {group.laws.map((law) => (
              <Link
                key={law.law_id}
                href={`/laws/${state.toLowerCase()}?law=${encodeURIComponent(law.law_id)}`}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-[0.8rem] text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="min-w-0 flex-1 truncate">{lawName(state, law)}</span>
                <span className="shrink-0 font-mono text-xs opacity-70">{lawCitation(state, law).replace(/^(Chapter|Title) /, "")}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
