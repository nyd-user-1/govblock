import { AnalyticsGrid } from "@/components/home/analytics-grid"
import { HomeColumns } from "@/components/home/home-columns"
import { HomeSearch } from "@/components/home/home-search"
import { WIDE_COLUMN } from "@/components/wide-page"

// The account home's center container: the greeting, the search, the columns
// and the analytics grid. /home wears it between its rails; the root's fourth
// sheet (2026-09-15) wears it alone, where ⌘K stays the header's.
//
// The column is WidePage's (2026-09-20): /home draws the body inside that
// shell, and the sheet, which has no shell, wraps the body in the same column.
export function HomeBody({ hotkey = true }: { hotkey?: boolean }) {
  return (
    <>
      <div className="flex flex-col items-center gap-8 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Building today?</h1>
        <HomeSearch hotkey={hotkey} />
      </div>
      <HomeColumns />
      <AnalyticsGrid />
    </>
  )
}

export function HomeMain({ hotkey = true }: { hotkey?: boolean }) {
  return (
    <div className={WIDE_COLUMN}>
      <HomeBody hotkey={hotkey} />
    </div>
  )
}
