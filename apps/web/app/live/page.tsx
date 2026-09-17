import type { Metadata } from "next"

import { LiveWorkspace } from "@/components/live/live-workspace"

// /live — every action and vote in Congress and the state legislatures, as
// they land (Brendan, 2026-09-15).
export const metadata: Metadata = {
  title: "Live",
  description:
    "Every action and vote in Congress and all fifty legislatures, in the order it happens.",
}

export default function LivePage() {
  return <LiveWorkspace />
}
