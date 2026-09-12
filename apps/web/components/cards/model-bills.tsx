"use client"

import * as F from "@/lib/fixtures"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { StatsCardBody } from "@/components/cards/stats-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Model bills — bills whose text is shared with bills in other states. The
// match is between states, so the card is national under every scope.
export function ModelBillsCard() {
  const { state } = useJurisdiction()
  return (
    <CardFrame id="model-bills">
      <StatsCardBody
        title={<CardAnchor>Model bills</CardAnchor>}
        action={<ComponentActions />}
        stats={F.modelBills.stats}
        columns={2}
        list={F.modelBills.top.map((row) => (
          <div key={row.bill} className="flex justify-between">
            <span className="font-medium">{row.bill}</span>
            <span className="text-muted-foreground">↔ {row.states} states</span>
          </div>
        ))}
        href={`/docs/model-bills?state=${state}`}
        footLabel="Model bills"
      />
    </CardFrame>
  )
}
