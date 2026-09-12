"use client"

import * as React from "react"
import Link from "next/link"

import { lowerChamber } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { CardContent } from "@govblock/ui/components/card"
import { Progress } from "@govblock/ui/components/progress"

// Bills — where this session's bills stand, by stage, each a bar against the
// busiest stage. `foldStatuses` turns a jurisdiction's own status names into
// stages every legislature has, named without a chamber in them (a reviewer,
// 2026-09-12: "In the House" meant crossed over under the Senate tab and the
// opposite under the House tab, and nothing at all in Nebraska).

export type StatusOption = { value: string; count: number }
export type StageRow = { label: string; bills: number; statuses: string[] }

/**
 * A jurisdiction's statuses folded into stages (Brendan, 2026-09-07). A row
 * is where a bill stands now, not every stage it has passed through. With no
 * chamber picked, "In House Committee" and "In Senate Committee" are one row,
 * In Committee, and the floor calendars one row. With a chamber picked, the
 * statuses must already be that chamber's own bills (the site's API filters
 * them; the data set carries a slice per chamber), and the other chamber's
 * rows fold into Crossed Over — this chamber's work on the bill is done.
 *
 * @param statuses  A jurisdiction's own status names with their counts.
 * @param state     The jurisdiction; names the lower chamber and the last stage (Became Law under Congress, Signed elsewhere).
 * @param chamber   The chamber the statuses belong to, or "" for the whole session.
 */
export function foldStatuses(statuses: StatusOption[], state = "US", chamber = ""): StageRow[] {
  const lower = lowerChamber(state)
  const other = chamber ? (chamber === "Senate" ? lower : "Senate") : null
  const stages = new Map<string, { order: number; bills: number; statuses: string[] }>()
  const add = (label: string, order: number, r: StatusOption) => {
    const row = stages.get(label) ?? { order, bills: 0, statuses: [] }
    row.bills += r.count
    row.statuses.push(r.value)
    stages.set(label, row)
  }
  for (const r of statuses) {
    const v = r.value
    const crossed = other && (v === `In ${other} Committee` || v === `${other} Floor Calendar` || v === `Passed ${other}`)
    if (crossed) add("Crossed Over", 4, r)
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
  return [...stages.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .slice(0, 7)
    .map(([label, row]) => ({ label, bills: row.bills, statuses: row.statuses }))
}

export function BillsCardBody({
  rows,
  total,
  state = "US",
  title = "Bills",
  action,
  href,
  chamber,
  onChamber,
  stageHref,
}: CardBodyProps & { rows: StageRow[]; total: number; chamber?: string; onChamber?: (chamber: string) => void; stageHref?: (row: StageRow) => string }) {
  const link = stageHref ?? ((row: StageRow) => `${SITE}/bills?state=${state}&status=${encodeURIComponent(row.statuses[0] ?? row.label)}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`)
  // Bars against the busiest stage, not the total: against the total four of
  // seven rows were slivers and Vetoed at 2 was an empty track.
  const denominator = Math.max(...rows.map((r) => r.bills), 1)
  void total
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent className="flex flex-col gap-3 **:data-[slot=progress-indicator]:bg-chart-2">
        {rows.map((row) => (
          <Link key={row.label} href={link(row)} className="flex flex-col gap-1.5 no-underline">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{row.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{fmtNumber(row.bills)}</span>
            </span>
            <Progress value={(row.bills / denominator) * 100} aria-label={row.label} />
          </Link>
        ))}
      </CardContent>
      <CardFoot chamber={chamber} onChamber={onChamber} state={state} href={href ?? `${SITE}/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} label="All bills" />
    </>
  )
}

export type StageSlice = { statuses: StatusOption[]; total?: number | null }

/**
 * The card on its own, from a jurisdiction's raw status counts. Hand it
 * `chambers` — each chamber's own statuses — and the pills fold the chamber
 * picked; without it the pills do not appear, because folding the whole
 * session under one chamber's name would count the other chamber's bills as
 * crossed over.
 */
export function BillsCard({ statuses, total, chambers, state = "US", ...props }: Omit<React.ComponentProps<typeof BillsCardBody>, "rows" | "total" | "chamber" | "onChamber"> & StageSlice & { chambers?: Record<string, StageSlice> }) {
  const [chamber, setChamber] = React.useState("")
  const slice = chamber && chambers?.[chamber] ? chambers[chamber] : { statuses, total }
  const rows = React.useMemo(() => foldStatuses(slice.statuses, state, chamber), [slice.statuses, state, chamber])
  const sum = slice.total ?? slice.statuses.reduce((s, r) => s + r.count, 0)
  return (
    <CardShell>
      <BillsCardBody {...props} rows={rows} total={sum} state={state} chamber={chambers ? chamber : undefined} onChamber={chambers ? setChamber : undefined} />
    </CardShell>
  )
}
