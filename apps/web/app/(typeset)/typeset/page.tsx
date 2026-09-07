import { type Metadata } from "next"

import { MovedTo } from "@/components/workspace/moved-to"

// /typeset lives at /workspace/typeset now (Brendan, 2026-09-07); the query
// rides along.
export const metadata: Metadata = { title: "Typeset", description: "Moved to the workspace." }

export default function TypesetPage() {
  return <MovedTo path="/workspace/typeset" />
}
