import { PublicRail } from "@/components/block-card"
import { RightRailSheet } from "@/components/rail-sheet"
import { CalendarCard } from "@/components/cards/calendar"
import { HomeMain } from "@/components/home/home-main"
import { ManualFetchProvider, RefreshButton } from "@/lib/policy/manual-fetch"

// Account home (Brendan, 2026-09-07), on Cloudflare's: the greeting, the
// search, three columns — the jurisdiction's chambers, the agents, the pages
// opened last — and the analytics grid. The docs shell around it: the
// account rail on the left, the calendar and the public rail on the right.
// The page reads the policy API only on the refresh button in its bottom
// right corner (Brendan, 2026-09-14): an open tab costs the cluster nothing.
export const metadata = { title: "Account home", description: "Where you are working today: your jurisdictions, your agents, your recent pages, and the numbers." }

export default function HomePage() {
  return (
    <ManualFetchProvider>
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <RefreshButton className="fixed right-4 bottom-4 z-40 size-8 rounded-full shadow-sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <HomeMain />
      </div>
      {/* The site's right rail (Brendan, 2026-09-16): the left rail's sheet, mirrored. */}
      <RightRailSheet>
        <CalendarCard compact />
        <PublicRail />
      </RightRailSheet>
    </div>
    </ManualFetchProvider>
  )
}
