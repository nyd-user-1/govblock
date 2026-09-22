"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { readFilters, SearchFilters, writeFilters, type SearchFilterState } from "@/components/search-filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"

// The search's filters in a page's right rail (Brendan, 2026-09-22: "add a
// small filter icon inside the search function; when pressed have the right
// rail open with the search filters"). The root's search stands in the page
// and its rail is the frame's, so the two meet through this context: the
// search reports what it found (the sections' counts, the chambers and
// statuses on the page) and the rail's panel draws the filters from it; the
// filters themselves ride in the address, as /search's do, so both read the
// same ones and a filtered search is a link.

export type Facets = { /** The headings on the page, in order, for the rail's index. */ headings: { id: string; title: string }[]; counts: Record<string, number>; chambers: { value: string; count: number }[]; statuses: { value: string; count: number }[] }

export const NO_FACETS: Facets = { headings: [], counts: {}, chambers: [], statuses: [] }

const Context = React.createContext<{ facets: Facets; setFacets: (facets: Facets) => void } | null>(null)

export function SearchRailProvider({ children }: { children: React.ReactNode }) {
  const [facets, setFacets] = React.useState<Facets>(NO_FACETS)
  const value = React.useMemo(() => ({ facets, setFacets }), [facets])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** The rail's store, where a page has one; null elsewhere. */
export function useSearchRail() {
  return React.useContext(Context)
}

/** The filter panel, reading and writing the address of `path`. */
export function SearchRailFilters({ path }: { path: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state } = useJurisdiction()
  const rail = useSearchRail()
  const filters = React.useMemo(() => readFilters(new URLSearchParams(searchParams)), [searchParams])
  const setFilters = (next: SearchFilterState) => {
    const params = writeFilters(new URLSearchParams(searchParams), next)
    router.replace(`${path}${params.size ? `?${params}` : ""}`, { scroll: false })
  }
  const facets = rail?.facets ?? NO_FACETS
  return <SearchFilters filters={filters} onChange={setFilters} here={state} counts={facets.counts} chambers={facets.chambers} statuses={facets.statuses} />
}
