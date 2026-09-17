import type { Metadata } from "next"

import { ElectionMapWorkspace, type ChamberView, type HouseView, type LeftOut } from "@/components/elections/election-map-workspace"
import type { TopTwoYear } from "@/components/elections/top-two"
import { mapViews, topTwoYears } from "@/lib/elections/snapshots"

// /simulator/map — election results on the districts they were run in, with
// the simulator's rules on them. The views come from scripts/elections/
// map.mjs, which publishes a view only when its boundaries are provably the
// election's own; the page carries that list and the primaries index and
// reads nothing else on load.
export const metadata: Metadata = {
  title: "Election map",
  description: "Every House race since 2012 and every state legislative race whose district lines are certain, drawn on the map, with a swing, an open primary or seats matched to votes run over them.",
}

export default async function SimulatorMapPage() {
  const [views, YEARS] = await Promise.all([mapViews(), topTwoYears()])
  return (
    <ElectionMapWorkspace
      house={views.house.map(({ year, congress, shapes, results, states }) => ({ year, congress, shapes, results, states })).sort((a, b) => b.year - a.year)}
      chambers={views.legislatures.map(({ year, state, office, shapes, results }) => ({ year, state, office, shapes, results }))}
      leftOut={views.left_out.filter((l) => l.office !== "US HOUSE").map(({ year, state, office, why }) => ({ year, state, office, why }))}
      years={YEARS}
    />
  )
}
