"use client"

import * as React from "react"

import CODES from "@/lib/data/congress/committee-codes.json"
import * as F from "@/lib/fixtures"
import { committeeKey } from "@/lib/policy/congress"
import { committeeSlug } from "@/lib/policy/committee-slug"
import { useScoped } from "@/lib/policy/use-scoped"
import { stateName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { matchesQuery } from "@/lib/search-match"
import { SearchDirectory } from "@/components/directory-search"
import { ChamberSeal } from "@/components/policy/imagery"
import { IndexEntries, useIndexView, type IndexEntry } from "@/components/index-views"
import { LoadingFlag } from "@/components/loading-flag"
import { H2 } from "@/components/typeset"

// Ported from livingston-v3 components/committees-list.tsx — two columns at a
// 24px gap, cards all the same size: seal, name, bill count — with the search
// field the bills page has, so the two directory pages read the same.
type Committee = { committee_name: string; chamber: string; bills: number; slug?: string }

// A federal committee has a page of its own, keyed by the system code
// congress.gov gives it. `committees` does not carry the code yet, so the map
// committed beside the fixtures supplies it; a committee without one keeps the
// card's older destination, the bills before it.
const codeFor = (chamber: string, name: string): string | undefined => (CODES as { byName: Record<string, string> }).byName[committeeKey(chamber, name)]

export function CommitteesList() {
  const { data, state, resolved, pending } = useScoped<Committee[]>("committees", F.committeesAll)
  const [query, setQuery] = React.useState("")
  // Cards as ever, and the list and columns beside them (Brendan, 2026-09-20).
  const { view, buttons } = useIndexView("/committees", "cards")

  const committees = React.useMemo(() => {
    const rows = data ?? []
    const q = query.trim()
    return q ? rows.filter((c) => matchesQuery(q, c.committee_name, c.chamber)) : rows
  }, [data, query])

  const groups = React.useMemo(() => {
    const order = new Map<string, typeof committees>()
    for (const committee of committees) {
      const bucket = order.get(committee.chamber) ?? []
      bucket.push(committee)
      order.set(committee.chamber, bucket)
    }
    for (const bucket of order.values()) bucket.sort((a, b) => a.committee_name.localeCompare(b.committee_name))
    return [...order.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [committees])

  return (
    <>
      {buttons}
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        // The shell is prerendered once for every reader, so it cannot name a
        // jurisdiction until it knows which one was asked for.
        placeholder={resolved ? `Search ${stateName(state)} committees by name…` : "Search committees by name…"}
      />
      <div className="my-8 flex flex-col gap-10">
        {groups.map(([chamber, rows]) => (
          <section key={chamber}>
            {/* The detail pages' H2 (Brendan, 2026-09-20), in place of the small muted label. */}
            <H2 className="mt-0 mb-6">{chamber}</H2>
            <IndexEntries
              view={view}
              entries={rows.map((committee): IndexEntry => {
                // Every committee has a page now (2026-09-06): a federal one
                // by its system code, New York's by the slug its site uses,
                // any other state's by state, chamber and name.
                const code = state === "US" ? codeFor(committee.chamber, committee.committee_name) : undefined
                const href = code
                  ? `/committees/${code}`
                  : state === "US"
                    ? `/bills?state=${state}&committee=${encodeURIComponent(committee.committee_name)}`
                    : `/committees/${committee.slug ?? committeeSlug(state, committee.chamber, committee.committee_name)}`
                return {
                  key: `${committee.chamber}/${committee.committee_name}`,
                  href,
                  title: committee.committee_name,
                  count: `${fmtNumber(committee.bills)} Bills`,
                  avatar: <ChamberSeal state={state} chamber={committee.chamber} size={36} />,
                  cardMedia: <ChamberSeal state={state} chamber={committee.chamber} size={28} />,
                  feedHref: `/docs/committee-feed.xml?state=${state}&committee=${encodeURIComponent(committee.committee_name)}`,
                }
              })}
            />
          </section>
        ))}
        {/* Still reading: the flag, never the empty line (Brendan, 2026-09-20). */}
        {pending && !groups.length && (
          <div className="flex justify-center py-16">
            <LoadingFlag />
          </div>
        )}
        {!pending && !groups.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No committees for {stateName(state)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </div>
    </>
  )
}
