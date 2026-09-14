import { RailsFrame } from "@/components/rails-frame"
import { SignPage, type SignSearch } from "@/components/sign-page"

// The root (Brendan, 2026-09-14): the hero with all three buttons between
// both site rails, in place of the headline, the search and the cards.
// Sign-Up and Sign-In go to their own pages.
export const dynamic = "force-dynamic"

export default function IndexPage({ searchParams }: { searchParams: SignSearch }) {
  return (
    <RailsFrame>
      <SignPage stage="root" searchParams={searchParams} />
    </RailsFrame>
  )
}
