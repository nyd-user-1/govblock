import type { Metadata } from "next"

import { MapWorkspace } from "@/components/map/map-workspace"

// /map — the districts of the 119th Congress on the workspace shell, a
// first pass (Brendan, 2026-09-09).
export const metadata: Metadata = {
  title: "Map",
  description:
    "Every congressional district, coloured by what the Census counts there.",
}

export default function MapPage() {
  return <MapWorkspace />
}
