"use client"

import * as React from "react"

import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { AdoptedCardBody, type AdoptedRow } from "@/components/cards/adopted-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Adopted Bills, on the home page (Brendan, 2026-09-05): the finance demo's
// Stock Performance chart, made real.
export function AdoptedBillsCard() {
  const { data, state } = useScoped<AdoptedRow[]>("adopted", [])
  const rows = React.useMemo(() => data ?? [], [data])
  return (
    <CardFrame id="stock">
      <AdoptedCardBody rows={rows} state={state} title={<CardAnchor>Adopted Bills</CardAnchor>} action={<ComponentActions rows={rows} id="adopted" />} href={`/laws?state=${state}`} />
    </CardFrame>
  )
}
