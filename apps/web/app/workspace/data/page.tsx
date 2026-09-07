import type { Metadata } from "next"

import { Designer } from "@/components/create/designer"

// /workspace/data — the datasets, each a card that entitles a reader to the
// whole of one (Brendan, 2026-09-07): the root of the workspace's paths.
export const metadata: Metadata = { title: "Data", description: "Every dataset as a card: Congress and your home state open, the rest on a plan; explore one, or take a session as a file." }

export default function DataPage() {
  return <Designer route={{ datasets: true }} />
}
