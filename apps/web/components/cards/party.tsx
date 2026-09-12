"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { PartyCardBody, type SeatRow } from "@/components/cards/party-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Party, on the home page.
export function PartyCard() {
  const { data, state } = useScoped<SeatRow[]>("seats", F.seats)
  const rows = React.useMemo(() => data ?? [], [data])
  return (
    <CardFrame id="party">
      <PartyCardBody rows={rows} state={state} title={<CardAnchor>Party</CardAnchor>} action={<ComponentActions rows={rows} id="party" />} memberHref={(party, chamber) => `/members?state=${state}&party=${party}&chamber=${encodeURIComponent(chamber)}`} href={`/members?state=${state}`} />
    </CardFrame>
  )
}
