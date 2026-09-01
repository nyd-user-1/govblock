import { CommitteesBoard } from "@/components/policy/committees-board"

// Committees — the rail-and-cards shell.
//
// The page is a thin mount so both registries' copies of this block render
// exactly the same surface; the implementation lives in components/policy.
export default function Page() {
  return <CommitteesBoard />
}
