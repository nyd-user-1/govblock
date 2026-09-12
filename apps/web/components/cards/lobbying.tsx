"use client"

import * as F from "@/lib/fixtures"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { StatsCardBody } from "@/components/cards/stats-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Lobbying — registrations, clients and reported spend, and who spends most.
// The Senate LDA is a federal register, not a per-state one, so this card reads
// the same under every jurisdiction.
export function LobbyingCard() {
  const { state } = useJurisdiction()
  return (
    <CardFrame id="lobbying">
      <StatsCardBody
        title={<CardAnchor>Lobbying</CardAnchor>}
        action={<ComponentActions />}
        stats={F.lobbying.stats}
        list={F.lobbying.top.map((name, i) => (
          <div key={name} className="flex gap-3">
            <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
            {name}
          </div>
        ))}
        href={`/lobbying?state=${state}`}
        footLabel="Lobbying"
      />
    </CardFrame>
  )
}
