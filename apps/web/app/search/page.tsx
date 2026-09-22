"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { DocsPage } from "@/components/docs-page"
import { DocsTableOfContents } from "@/components/docs-toc"
import { readFilters, SearchFilters, type SearchFilterState, writeFilters } from "@/components/search-filters"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { SearchResults } from "@/components/search-page"
import { NO_FACETS, type Facets } from "@/components/search-rail"

// /search, the page: the shell, the rail's index and filters. The search itself — the bar, the sections, the recent
// searches — is components/search-page.tsx since 2026-09-22, when the account home took the same search.

/** The filters ride in the URL beside the query, so a filtered search is a link. */
function SearchShell() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state } = useJurisdiction()
  const filters = React.useMemo(() => readFilters(new URLSearchParams(searchParams)), [searchParams])
  const [facets, setFacets] = React.useState<Facets>(NO_FACETS)
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
          <SearchFilters
            filters={filters}
            onChange={setFilters}
            here={state}
            counts={facets.counts}
            places={facets.places}
            committees={facets.committees}
            parties={facets.parties}
            serving={facets.serving}
            chambers={facets.chambers}
            statuses={facets.statuses}
          />
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

