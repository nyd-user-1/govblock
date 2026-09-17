import type { Metadata } from "next"

import type { ContestSummary } from "@/components/elections/ranked-choice"
import { Simulator, type ChamberView, type HouseView } from "@/components/elections/simulator"
import { mapViews, rcvContests, topTwoYears } from "@/lib/elections/snapshots"
import type { TopTwoYear } from "@/components/elections/top-two"

// /simulator — Open Primary Simulator. Every view opens on a claim and lets
// the reader test it against the real count: a chamber's seats by where
// they were decided and the open-primary rules that move them, a
// ranked-choice contest replayed from its ballots, a race's primaries pooled
// into one. Three small lists ship with the page (scripts/elections/load.mjs
// snapshot, map.mjs, load.mjs top-two); everything heavier is fetched from
// the public bucket when a reader picks it, and nothing reads the database.
export const metadata: Metadata = {
  title: "Open Primary Simulator",
  description: "Every House and state legislative seat by where it was decided, and what one open primary or a ranked-choice count would have changed, from the real votes.",
}

export default async function SimulatorPage() {
  const [CONTESTS, YEARS, views] = await Promise.all([rcvContests(), topTwoYears(), mapViews()])
  return (
    <Simulator
      contests={CONTESTS}
      years={YEARS}
      house={views.house.map(({ year, congress, results }) => ({ year, congress, results })).sort((a, b) => b.year - a.year)}
      chambers={views.legislatures.map(({ year, state, office, results }) => ({ year, state, office, results }))}
    />
  )
}
