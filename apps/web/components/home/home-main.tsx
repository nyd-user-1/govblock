import { AnalyticsGrid } from "@/components/home/analytics-grid"
import { HomeColumns } from "@/components/home/home-columns"
import { HomeSearch } from "@/components/home/home-search"

// The account home's center container: the greeting, the search, the columns
// and the analytics grid. /home wears it between its rails; the root's fourth
// sheet (2026-09-15) wears it alone, where ⌘K stays the header's.
export function HomeMain({ hotkey = true }: { hotkey?: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-10 px-4 py-6 text-foreground md:px-6 lg:py-8">
      <div className="flex flex-col items-center gap-8 pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Building today?</h1>
        <HomeSearch hotkey={hotkey} />
      </div>
      <HomeColumns />
      <AnalyticsGrid />
    </div>
  )
}
