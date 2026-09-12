"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { BillsCardBody, foldStatuses, type StageRow, type StatusOption } from "@/components/cards/bills-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Bills, on the home page — where this session's bills stand. Every status is
// a link into the bill list filtered to it; the footer picks the chamber
// (Brendan, 2026-09-01, 2026-09-07).
export function BillsCard() {
  const [chamber, setChamber] = React.useState("")
  const { data: options, state, congress } = useScoped<{ statuses: StatusOption[]; sessions: { session_id: number }[] }>("options", null as unknown as { statuses: StatusOption[]; sessions: { session_id: number }[] }, { chamber: chamber || undefined })
  const { data: bills } = useScoped<{ total: number }>("bills", null as unknown as { total: number }, { limit: 1, chamber: chamber || undefined })
  const { total, rows } = React.useMemo(() => {
    if (!options) return congress ? { total: F.bills.total, rows: F.bills.rows.map((r) => ({ ...r, statuses: [r.label] })) as StageRow[] } : { total: 0, rows: [] as StageRow[] }
    return { total: bills?.total ?? options.statuses.reduce((sum, r) => sum + r.count, 0), rows: foldStatuses(options.statuses, state, chamber) }
  }, [options, bills, congress, chamber, state])

  return (
    <CardFrame id="bills-status">
      <BillsCardBody
        rows={rows}
        total={total}
        state={state}
        title={<CardAnchor>Bills</CardAnchor>}
        action={<ComponentActions rows={rows} id="bills" />}
        chamber={chamber}
        onChamber={setChamber}
        stageHref={(row) => `/bills?state=${state}&status=${encodeURIComponent(row.statuses[0] ?? row.label)}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`}
        href={`/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`}
      />
    </CardFrame>
  )
}
