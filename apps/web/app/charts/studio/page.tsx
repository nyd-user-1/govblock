import type { Metadata } from "next"

import { isJurisdiction } from "@/lib/filters"
import { Studio } from "@/components/charts/studio"

// /charts/studio (Brendan, 2026-09-13): build a chart from the record and take it with you.
export const metadata: Metadata = { title: "Chart studio", description: "Pick a jurisdiction and a chart, drawn from the record, and take it with you." }

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams
  const initial = state && isJurisdiction(state.toUpperCase()) ? state.toUpperCase() : "NY"
  return (
    <div className="container-wrapper flex flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Studio</h1>
        <p className="max-w-2xl text-muted-foreground">Pick a jurisdiction and a chart. Every one is drawn from the record, and every one can be taken as an embed, an iframe, or the numbers themselves.</p>
      </div>
      <Studio initialState={initial} />
    </div>
  )
}
