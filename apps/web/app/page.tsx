import { ParticleScroll } from "@/components/canvasui/ParticleScroll"
import { RailsFrame } from "@/components/rails-frame"
import { SignPage, type SignSearch } from "@/components/sign-page"
import { UniteBody } from "@/components/unite-2"

// The root (Brendan, 2026-09-14): the hero with all three buttons between
// both site rails, then everything /unite-2 says below its own hero: the
// conversation and the open-primaries survey, what GovBlocks brings, one
// section per surface, and the premise. Sign-Up and Sign-In go to their own
// pages.
//
// Under /unite-2's particle scroller too (Brendan, 2026-09-14): the box is
// the viewport below the header, everything scrolls inside it, and the sand
// effect covers the hero and the copy alike where the HTML-in-Canvas API is
// on; where it is not, the page is plain HTML in the same scroller.
export const dynamic = "force-dynamic"

export default function IndexPage({ searchParams }: { searchParams: SignSearch }) {
  return (
    <RailsFrame>
      <ParticleScroll point={0.8} className="h-[calc(100svh-var(--header-height))]">
        <div className="min-h-full bg-background text-foreground">
          <SignPage stage="root" searchParams={searchParams} />
          <UniteBody />
        </div>
      </ParticleScroll>
    </RailsFrame>
  )
}
