"use client"

import * as React from "react"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtNumber } from "@/lib/format"
import { lowerChamber } from "@/lib/filters"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CardFoot } from "@/components/card-foot"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { CardAction, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Progress } from "@govblock/ui/components/progress"

// Bills — where this session's bills stand. Every status is a link into the
// bill list filtered to it; the footer picks a status, the session lives in
// the ⋮ menu (Brendan, 2026-09-01).
type Option = { value: string; count: number }

export function BillsCard() {
  // The chamber pills narrow the statuses and the total (Brendan, 2026-09-07).
  const [chamber, setChamber] = React.useState("")
  const { data: options, state, congress } = useScoped<{ statuses: Option[]; sessions: { session_id: number }[] }>("options", null as unknown as { statuses: Option[]; sessions: { session_id: number }[] }, { chamber: chamber || undefined })
  const { data: bills } = useScoped<{ total: number }>("bills", null as unknown as { total: number }, { limit: 1, chamber: chamber || undefined })
  const { total, rows } = React.useMemo(() => {
    if (!options) return congress ? { total: F.bills.total, rows: F.bills.rows.map((r) => ({ ...r, statuses: [r.label] })) } : { total: 0, rows: [] as { label: string; bills: number; statuses: string[] }[] }
    // LegiScan's statuses folded into stages (Brendan, 2026-09-07): with no
    // chamber picked, "In House Committee" and "In Senate Committee" are one
    // row, In Committee, and the floor calendars one row; with a chamber
    // picked, the other chamber's rows fold into "In the Senate" — the bill
    // has crossed over and this chamber's work on it is done.
    const lower = lowerChamber(state)
    const other = chamber ? (chamber === "Senate" ? lower : "Senate") : null
    const stages = new Map<string, { order: number; bills: number; statuses: string[] }>()
    const add = (label: string, order: number, r: Option) => {
      const row = stages.get(label) ?? { order, bills: 0, statuses: [] }
      row.bills += r.count
      row.statuses.push(r.value)
      stages.set(label, row)
    }
    for (const r of options.statuses) {
      const v = r.value
      const crossed = other && (v === `In ${other} Committee` || v === `${other} Floor Calendar` || v === `Passed ${other}`)
      if (crossed) add(`In the ${other}`, 4, r)
      else if (/^Introduced$/i.test(v)) add("Introduced", 0, r)
      else if (/ Committee$/i.test(v)) add("In Committee", 1, r)
      else if (/Floor Calendar$/i.test(v)) add("Floor Calendar", 2, r)
      else if (/^Engrossed$|^Passed (House|Senate|Assembly)$/i.test(v)) add("Engrossed", 3, r)
      else if (/^(Passed|Enrolled|Adopted)$/i.test(v)) add("Passed", 5, r)
      else if (/^(Signed by Governor|Became Law|Chaptered|Enacted)$/i.test(v)) add(state === "US" ? "Became Law" : "Signed", 6, r)
      else if (/^Vetoed$/i.test(v)) add("Vetoed", 7, r)
      else if (/^(Stricken|Substituted|Failed|Dead|Withdrawn)$/i.test(v)) add("Stricken", 8, r)
      else add(v, 9, r)
    }
    return {
      total: bills?.total ?? options.statuses.reduce((sum, r) => sum + r.count, 0),
      rows: [...stages.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .slice(0, 7)
        .map(([label, row]) => ({ label, bills: row.bills, statuses: row.statuses })),
    }
  }, [options, bills, congress, chamber, state])

  return (
    <CardFrame id="bills-status">
      <CardHeader>
        <CardAnchor>Total Bills</CardAnchor>
        <CardAction>
          <ComponentActions rows={rows} id="bills" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 **:data-[slot=progress-indicator]:bg-chart-2">
        {rows.map((row) => (
          <Link
            key={row.label}
            // The board filters by LegiScan's own status; a folded row opens on its first.
            href={`/bills?state=${state}&status=${encodeURIComponent(row.statuses[0] ?? row.label)}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`}
            className="flex flex-col gap-1.5 no-underline"
          >
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{row.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{fmtNumber(row.bills)}</span>
            </span>
            <Progress value={(row.bills / total) * 100} aria-label={row.label} />
          </Link>
        ))}
      </CardContent>
      <CardFoot chamber={chamber} onChamber={setChamber} href={`/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} label="All bills" />
    </CardFrame>
  )
}
