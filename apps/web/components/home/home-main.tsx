import * as React from "react"

import { AnalyticsGrid } from "@/components/home/analytics-grid"
import { HomeColumns } from "@/components/home/home-columns"
import { HomeSearch } from "@/components/home/home-search"
import { SearchResults } from "@/components/search-page"
import { WIDE_COLUMN } from "@/components/wide-page"
import { LiveFetch } from "@/lib/policy/manual-fetch"

// The account home's center container: the greeting, the search, the columns
// and the analytics grid. /home wears it between its rails; the root's fourth
// sheet (2026-09-15) wears it alone, where ⌘K stays the header's.
//
// The column is WidePage's (2026-09-20): /home draws the body inside that
// shell, and the sheet, which has no shell, wraps the body in the same column.
//
// The search is /search's (Brendan, 2026-09-22: "replace the search experience
// on the home page with the search bar and experience from the /search page"):
// the same bar, the recent searches under it, and on Enter the sections —
// bills, text, laws, members, committees, topics, pages — down the page, the
// query in the address (/home?q=). It reads on Enter alone, so it stands
// outside the page's refresh gate. The frozen sheet keeps the drop-down bar:
// it makes no requests, and /search's would answer nothing there.
export function HomeBody({ hotkey = true, search = "page" }: { hotkey?: boolean; /** "page": /search's bar and sections. "bar": the drop-down bar, for the root's frozen sheet. */ search?: "page" | "bar" }) {
  return (
    <>
      <div className="flex flex-col items-center gap-8 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Building today?</h1>
        {search === "page" ? (
          <div className="w-full">
            <LiveFetch>
              <React.Suspense fallback={null}>
                <SearchResults path="/home" />
              </React.Suspense>
            </LiveFetch>
          </div>
        ) : (
          <HomeSearch hotkey={hotkey} />
        )}
      </div>
      <HomeColumns />
      <AnalyticsGrid />
    </>
  )
}

export function HomeMain({ hotkey = true, search = "page" }: { hotkey?: boolean; search?: "page" | "bar" }) {
  return (
    <div className={WIDE_COLUMN}>
      <HomeBody hotkey={hotkey} search={search} />
    </div>
  )
}
