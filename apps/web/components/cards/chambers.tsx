"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChambersCardBody, type ChamberRow } from "@/components/cards/chambers-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Chambers, on the home page (Brendan, 2026-09-01: the row is seal · name ·
// members; the bill count moved out). `compact` is the docs-rail size.
type Option = { value: string; count: number }

export function ChambersCard({ compact = false }: { compact?: boolean }) {
  const { data: options, state, congress } = useScoped<{ chambers: Option[] }>("options", null as unknown as { chambers: Option[] })
  const { data: seats } = useScoped<{ chamber: string; seats: number }[]>("seats", null as unknown as { chamber: string; seats: number }[])
  const chambers = React.useMemo<ChamberRow[]>(() => {
    if (!options) return congress ? F.chambers : []
    const members = new Map<string, number>()
    for (const row of seats ?? []) members.set(row.chamber, (members.get(row.chamber) ?? 0) + row.seats)
    return options.chambers.map((c) => ({ label: c.value, bills: c.count, members: members.get(c.value) ?? 0 }))
  }, [options, seats, congress])
  return (
    <CardFrame id="chambers" size={compact ? "sm" : "default"}>
      <ChambersCardBody rows={chambers} state={state} compact={compact} title={<CardAnchor>Chambers</CardAnchor>} action={<ComponentActions rows={chambers} id="chambers" />} chamberHref={(row) => `/bills?state=${state}&chamber=${encodeURIComponent(row.label)}`} />
    </CardFrame>
  )
}
