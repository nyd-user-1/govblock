import { HomeCalendar } from "@/components/home/home-calendar"
import { HomeBody } from "@/components/home/home-main"
import { HomeToc } from "@/components/home/home-toc"
import { WidePage } from "@/components/wide-page"
import { ManualFetchProvider, RefreshButton } from "@/lib/policy/manual-fetch"

// Account home (Brendan, 2026-09-07), on Cloudflare's: the greeting, the
// search, three columns — the jurisdiction's chambers, the agents, the pages
// opened last — and the analytics grid. The docs shell around it: the
// account rail on the left, the calendar and the public rail on the right.
// The page reads the policy API only on the refresh button in its bottom
// right corner (Brendan, 2026-09-14): an open tab costs the cluster nothing.
// The shell is WidePage (2026-09-20), the page type this page was the first of.
// Its right rail opens on the On This Page index (2026-09-21), as DocsPage's does.
export const metadata = { title: "Account home", description: "Where you are working today: your jurisdictions, your agents, your recent pages, and the numbers." }

export default function HomePage() {
  return (
    <ManualFetchProvider>
      <RefreshButton className="fixed right-4 bottom-4 z-40 size-8 rounded-full shadow-sm" />
      <WidePage rail={<HomeToc />}>
        <HomeBody />
        {/* Under Analytics, and on this page alone: the root's frozen sheet of the same body has no calendar to freeze. */}
        <HomeCalendar />
      </WidePage>
    </ManualFetchProvider>
  )
}
