import { flagUrl } from "@/lib/filters"

// The desks clips are filed under. A module of its own, without "use client",
// so the server can file a clip under a desk with the same list the rail shows.

export type Creator = { id: string; name: string; handle: string; image?: string | null; state?: string; kind: "desk" | "user" }

export const CREATORS: Creator[] = [
  { id: "govblock", name: "GovBlock", handle: "govblock", image: flagUrl("US"), state: "US", kind: "desk" },
  { id: "ny", name: "New York Desk", handle: "nydesk", image: flagUrl("NY"), state: "NY", kind: "desk" },
  { id: "tx", name: "Texas Desk", handle: "txdesk", image: flagUrl("TX"), state: "TX", kind: "desk" },
  { id: "ca", name: "California Desk", handle: "cadesk", image: flagUrl("CA"), state: "CA", kind: "desk" },
  // A committee's own channel, found by scripts/clips/shorts.mjs (2026-09-11).
  { id: "house-ag", name: "House Agriculture", handle: "houseagriculture", image: flagUrl("US"), state: "US", kind: "desk" },
]

export const creatorOf = (id: string) => CREATORS.find((c) => c.id === id)
