"use client"

import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ApiCardBody } from "@/components/cards/api-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// API, on the home page — the same numbers this page renders, as JSON, for
// the scope in the header.
export function ApiCard() {
  const { state } = useJurisdiction()
  return (
    <CardFrame id="api">
      <ApiCardBody path={`/api/policy/bills?state=${state}&limit=5`} origin="" title={<CardAnchor>API</CardAnchor>} action={<ComponentActions />} href="/docs/api" />
    </CardFrame>
  )
}
