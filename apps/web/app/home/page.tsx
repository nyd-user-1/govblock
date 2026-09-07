import { PublicRail } from "@/components/block-card"
import { CalendarCard } from "@/components/cards/calendar"
import { AnalyticsGrid } from "@/components/home/analytics-grid"
import { HomeColumns } from "@/components/home/home-columns"
import { HomeSearch } from "@/components/home/home-search"

// Account home (Brendan, 2026-09-07), on Cloudflare's: the greeting, the
// search, three columns — the jurisdiction's chambers, the agents, the pages
// opened last — and the analytics grid. The docs shell around it: the
// account rail on the left, the calendar and the public rail on the right.
export const metadata = { title: "Account home", description: "Where you are working today: your jurisdictions, your agents, your recent pages, and the numbers." }

export default function HomePage() {
  return (
    <div data-slot="docs" className="flex scroll-mt-24 items-stretch pb-8 text-[1.05rem] sm:text-[15px] xl:w-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-(--top-spacing) shrink-0" />
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-10 px-4 py-6 text-foreground md:px-6 lg:py-8">
          <div className="flex flex-col items-center gap-8 pt-6">
            <h1 className="text-4xl font-semibold tracking-tight">Building today?</h1>
            <HomeSearch />
          </div>
          <HomeColumns />
          <AnalyticsGrid />
        </div>
      </div>
      <div className="sticky top-[calc(var(--header-height)+1px)] z-30 ml-auto hidden h-[90svh] w-(--sidebar-width) flex-col gap-4 overflow-hidden overscroll-none pb-8 xl:flex">
        <div className="h-(--top-spacing) shrink-0"></div>
        <div className="hidden flex-1 flex-col gap-6 overflow-y-auto px-6 py-1 xl:flex">
          <CalendarCard compact />
          <PublicRail />
        </div>
      </div>
    </div>
  )
}
