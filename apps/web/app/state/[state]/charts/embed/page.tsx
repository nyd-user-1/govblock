import { notFound } from "next/navigation"

import { isJurisdiction } from "@/lib/filters"
import { getStateStats } from "@/lib/policy/state-stats"
import { CHARTS, StateChart, type ChartId } from "@/components/charts/state-charts"

// /state/[state]/charts/embed?chart=<id> (2026-09-13): one chart, bare, for
// an iframe or a screenshot — what the studio's Copy embed points at.
export const revalidate = 3600

export default async function EmbedPage({ params, searchParams }: { params: Promise<{ state: string }>; searchParams: Promise<{ chart?: string }> }) {
  const { state } = await params
  const { chart } = await searchParams
  const s = state.toUpperCase()
  const id = CHARTS.find((c) => c.id === chart)?.id as ChartId | undefined
  if (!isJurisdiction(s) || !id) notFound()
  const stats = await getStateStats(s)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
      <h1 className="text-base font-semibold">
        {stats.name} · {CHARTS.find((c) => c.id === id)?.title}
      </h1>
      <StateChart id={id} stats={stats} />
    </div>
  )
}
