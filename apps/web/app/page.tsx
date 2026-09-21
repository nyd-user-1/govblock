import { ParticleScroll } from "@/components/canvasui/ParticleScroll"
import { RailsFrame } from "@/components/rails-frame"
import { SignPage, type SignSearch } from "@/components/sign-page"
import { StateSection } from "@/components/state-section"

// The root (Brendan, 2026-09-14): the hero between both site rails, under
// /unite-2's particle scroller. Sign-Up and Sign-In go to their own pages.
//
// The hero alone (Brendan, 2026-09-20): section two (/bills's layout) and
// everything /unite-2 says below its own hero moved to /lab/unite-2. Beneath
// the hero since later that day: /state, its head and its table, from the
// frozen counts (components/state-section.tsx), so the section reads nothing.
export const dynamic = "force-dynamic"

export default function IndexPage({ searchParams }: { searchParams: SignSearch }) {
  return (
    <RailsFrame>
      <ParticleScroll point={0.83} className="h-[calc(100svh-var(--header-height))]">
        <div className="min-h-full bg-background text-foreground">
          <SignPage stage="root" searchParams={searchParams} />
          <StateSection />
        </div>
      </ParticleScroll>
    </RailsFrame>
  )
}
