"use client"

import * as React from "react"
import Link from "next/link"

import { fmtBill, fmtDate, fmtNumber } from "@/lib/format"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardContent } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Votes — the latest roll calls with their aye/nay split. Each row is the
// vote: a two-tone bar sized by the tally, linking to the bill it decided.
// The body takes its rows; the site's card feeds it live, a consumer's the
// data set or their own (2026-09-12).

export type VoteRow = { roll_call_id: number; bill_id: number; bill_number: string; description?: string; date: string; chamber: string; yea: number; nay: number }

export function Tally({ yea, nay }: { yea: number; nay: number }) {
  const total = Math.max(yea + nay, 1)
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="text-sm font-semibold tabular-nums">
        {fmtNumber(yea)}–{fmtNumber(nay)}
      </span>
      <span aria-hidden="true" className="flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <span className="h-full" style={{ width: `${(yea / total) * 100}%`, background: "var(--chart-2)" }} />
        <span className="h-full" style={{ width: `${(nay / total) * 100}%`, background: "var(--chart-5)" }} />
      </span>
    </span>
  )
}

export function VotesCardBody({
  rows,
  state = "US",
  title = "Votes",
  action,
  href,
  chamber,
  onChamber,
  billHref,
}: CardBodyProps & { rows: VoteRow[]; chamber?: string; onChamber?: (chamber: string) => void; billHref?: (row: VoteRow) => string }) {
  const link = billHref ?? ((row: VoteRow) => `${SITE}/bills/${row.bill_id}`)
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent>
        <ItemGroup>
          {rows.map((row) => (
            <Item key={row.roll_call_id} variant="muted" render={<Link href={link(row)} className="no-underline" />}>
              <ItemMedia>
                <ChamberSeal state={state} chamber={row.chamber} size={32} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{fmtBill(row.bill_number, state)}</ItemTitle>
                <ItemDescription>
                  {fmtDate(row.date, false)} · {row.chamber}
                </ItemDescription>
              </ItemContent>
              <Tally yea={row.yea} nay={row.nay} />
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      <CardFoot chamber={chamber} onChamber={onChamber} state={state} href={href ?? `${SITE}/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} label="All bills" />
    </>
  )
}

/** The card on its own: the pills filter the rows it was handed. */
export function VotesCard({ rows, limit = 5, ...props }: Omit<React.ComponentProps<typeof VotesCardBody>, "chamber" | "onChamber"> & { limit?: number }) {
  const [chamber, setChamber] = React.useState("")
  const shown = rows.filter((r) => !chamber || r.chamber === chamber).slice(0, limit)
  return (
    <CardShell>
      <VotesCardBody {...props} rows={shown} chamber={chamber} onChamber={setChamber} />
    </CardShell>
  )
}
