"use client"

import * as React from "react"

import { useScoped } from "@/lib/policy/use-scoped"
import { TrafficCardBody, type MonthRow } from "@/components/cards/traffic-card"
import { Card } from "@govblock/ui/components/card"

// Bills by party, on the home page (Brendan, 2026-09-07): the last six months
// of the session in scope, from the bills-by-party resource.
export function BarChartCard() {
  const [chamber, setChamber] = React.useState("")
  const { data, state, pending } = useScoped<{ rows: MonthRow[] }>("bills-by-party", { rows: [] }, { months: 6, chamber: chamber || undefined })
  return (
    <Card>
      <TrafficCardBody rows={data?.rows ?? []} pending={pending} state={state} chamber={chamber} onChamber={setChamber} href={`/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} />
    </Card>
  )
}
