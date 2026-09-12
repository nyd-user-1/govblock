"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CommitteesCardBody, type CommitteeRow } from "@/components/cards/committees-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Committees, on the home page (Brendan, 2026-09-01: pills, as on the Party
// card; the quarterly bars are gone).
type Committee = { committee_name: string; chamber: string; bills: number }

export function CommitteesCard() {
  const [chamber, setChamber] = React.useState("")
  const { data, state, congress } = useScoped<Committee[]>("committees", null as unknown as Committee[])
  const committees = React.useMemo<CommitteeRow[]>(
    () =>
      data
        ? [...data]
            .filter((c) => !chamber || c.chamber === chamber)
            .sort((a, b) => b.bills - a.bills)
            .slice(0, 3)
            .map((c) => ({ label: c.committee_name, bills: c.bills, chamber: c.chamber }))
        : congress
          ? F.committees.filter((c) => !chamber || c.chamber === chamber).map((c) => ({ label: c.label, bills: c.bills, chamber: c.chamber }))
          : [],
    [data, congress, chamber]
  )
  return (
    <CardFrame id="committees">
      <CommitteesCardBody
        rows={committees}
        state={state}
        title={<CardAnchor>Committees</CardAnchor>}
        action={<ComponentActions rows={committees} id="committees" />}
        chamber={chamber}
        onChamber={setChamber}
        committeeHref={(row) => `/bills?state=${state}&committee=${encodeURIComponent(row.label)}`}
        href={`/committees?state=${state}`}
      />
    </CardFrame>
  )
}
