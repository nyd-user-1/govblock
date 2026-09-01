import { VotesBoard } from "@/components/policy/votes-board"

// Votes — the roll calls of the session in scope, in the rail-and-cards
// shape. The page is a thin mount so both registries' copies of this block
// render the same surface.
export default function Page() {
  return <VotesBoard />
}
