import { redirect } from "next/navigation"

// /diff (Brendan, 2026-09-11, the Workspace menu's Diff): one redline exists
// so far, the RAISE Act's three printings; an index of diffs comes later.
export default function DiffPage() {
  redirect("/bills/2015571/compare")
}
