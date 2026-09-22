import * as React from "react"

import { ParticleScroll } from "@/components/canvasui/ParticleScroll"
import { RailsFrame } from "@/components/rails-frame"
import { RootSearchSection } from "@/components/root-search-section"
import { SignPage, type SignSearch } from "@/components/sign-page"
import { RootFooter } from "@/components/root-footer"
import { RootHashScroll } from "@/components/root-hash-scroll"
import { SearchRailFilters } from "@/components/search-rail"
import { StateSection } from "@/components/state-section"

// The root (Brendan, 2026-09-14): the hero between both site rails, under
// /unite-2's particle scroller. Sign-Up and Sign-In go to their own pages.
//
// The hero alone (Brendan, 2026-09-20): section two (/bills's layout) and
// everything /unite-2 says below its own hero moved to /lab/unite-2. Beneath
// the hero since later that day: /state, its head and its table, from the
// frozen counts (components/state-section.tsx), so the section reads nothing.
//
// Three sections and a footer (Brendan, 2026-09-21): the hero, whose arrow
// goes down to the account home's greeting and search as section two, whose
// own arrow goes on to /state's table as section three; then the site footer.
//
// The right rail holds the search's filters (Brendan, 2026-09-22), opened by
// the icon in the search bar; the three sheets that were there are gone.
export const dynamic = "force-dynamic"

export default function IndexPage({ searchParams }: { searchParams: SignSearch }) {
  return (
    <RailsFrame
      rail={
        <React.Suspense fallback={null}>
          <SearchRailFilters path="/" />
        </React.Suspense>
      }
    >
      <ParticleScroll point={0.83} className="h-[calc(100svh-var(--header-height))]">
        <div className="min-h-full bg-background text-foreground">
          <SignPage stage="root" searchParams={searchParams} />
          <RootSearchSection />
          <StateSection />
          <RootFooter />
          <RootHashScroll />
        </div>
      </ParticleScroll>
    </RailsFrame>
  )
}
