import { RailsFrame } from "@/components/rails-frame"
import { SignPage, type SignSearch } from "@/components/sign-page"
import { UniteBody } from "@/components/unite-2"

// The root (Brendan, 2026-09-14): the hero with all three buttons between
// both site rails, then everything /unite-2 says below its own hero: the
// conversation and the open-primaries survey, what GovBlocks brings, one
// section per surface, and the premise. Sign-Up and Sign-In go to their own
// pages.
export const dynamic = "force-dynamic"

export default function IndexPage({ searchParams }: { searchParams: SignSearch }) {
  return (
    <RailsFrame>
      <SignPage stage="root" searchParams={searchParams} />
      <UniteBody />
    </RailsFrame>
  )
}
