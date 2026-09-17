import type { ContestSummary } from "@/components/elections/ranked-choice"
import type { ChamberView, HouseView } from "@/components/elections/simulator"
import type { TopTwoYear } from "@/components/elections/top-two"

// The simulator's three lists, read from the public bucket rather than bundled
// into the build (2026-09-17: the artifact hit Amplify's 220 MB cap). They are
// the same files scripts/elections/load.mjs and map.mjs publish, cached for a
// day at the edge and revalidated daily here, so a page render costs no
// database read and at most one conditional fetch.

const BASE = "https://govblock-geo-638175140432.s3.amazonaws.com/elections/snapshots"

async function read<T>(name: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${BASE}/${name}`, { next: { revalidate: 86400 } })
    return r.ok ? ((await r.json()) as T) : fallback
  } catch {
    return fallback
  }
}

export type MapViews = {
  house: (HouseView & { shapes: string; states: string[] })[]
  legislatures: (ChamberView & { shapes: string })[]
  left_out: { year: number; state: string; office: string; why: string }[]
}

export const rcvContests = () => read<ContestSummary[]>("rcv-contests.json", [])
export const topTwoYears = () => read<TopTwoYear[]>("top-two-years.json", [])
export const mapViews = () => read<MapViews>("map-views.json", { house: [], legislatures: [], left_out: [] })
