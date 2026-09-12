"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { VotesCardBody, type VoteRow } from "@/components/cards/votes-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Votes, on the home page: the body from votes-card.tsx, fed the latest roll
// calls of the jurisdiction in scope, inside the site's card frame.
export function VotesCard() {
  const [chamber, setChamber] = React.useState("")
  const { data, state } = useScoped<VoteRow[]>("rollcalls", F.votes as VoteRow[], { limit: 5, chamber: chamber || undefined })
  return (
    <CardFrame id="votes">
      <VotesCardBody
        rows={data ?? []}
        state={state}
        title={<CardAnchor>Votes</CardAnchor>}
        action={<ComponentActions />}
        chamber={chamber}
        onChamber={setChamber}
        billHref={(row) => `/bills/${row.bill_id}`}
        href={`/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`}
      />
    </CardFrame>
  )
}
