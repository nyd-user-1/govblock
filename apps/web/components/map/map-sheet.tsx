"use client"

import dynamic from "next/dynamic"

import { useReached } from "@/components/rail-toggle"

// The Map on the root (Brendan, 2026-09-20): the sheet behind the changelog's,
// mounted when a reader first opens their way to it and not before. Drawn
// behind a closed sheet it fetched the districts, the states, the tiles and
// their fonts — some thirty requests and a megabyte and a half — on every
// load of the root.
const MapWorkspace = dynamic(() => import("@/components/map/map-workspace").then((m) => m.MapWorkspace), { ssr: false })

export function MapSheet() {
  const reached = useReached(["right", "right-2"])
  return reached ? <MapWorkspace /> : null
}
