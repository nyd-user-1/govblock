import type { Metadata } from "next"

import { stateName } from "@/lib/filters"
import { StateChartsPage } from "@/components/charts/state-charts-page"

// /state/[state]/charts (Brendan, 2026-09-13): what the record holds about
// one legislature, as charts, on the stats page LegiScan draws for a state —
// every number from our own tables, every chart plain SVG rendered on the
// server, revalidated hourly.
//
// In DocsPage (Brendan, 2026-09-20), drawn by components/charts/
// state-charts-page.tsx, which charts/[session] draws too. Until then a
// page-wide grid of its own.
export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const s = state.toUpperCase()
  const name = s === "US" ? "Congress" : stateName(s)
  return { title: `${name} charts`, description: `${name} by the numbers: sessions, sponsors, seats, committees.` }
}


export default async function Page({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  return <StateChartsPage state={state} />
}
