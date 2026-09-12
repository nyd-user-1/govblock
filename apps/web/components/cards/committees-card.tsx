"use client"

import * as React from "react"
import Link from "next/link"

import { fmtNumber, truncate } from "@/lib/format"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardContent } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Committees — each with its bill count; the footer picks the chamber.
export type CommitteeRow = { label: string; bills: number; chamber: string }

export function CommitteesCardBody({
  rows,
  state = "US",
  title = "Committees",
  action,
  href,
  chamber,
  onChamber,
  committeeHref,
}: CardBodyProps & { rows: CommitteeRow[]; chamber?: string; onChamber?: (chamber: string) => void; committeeHref?: (row: CommitteeRow) => string }) {
  const link = committeeHref ?? ((row: CommitteeRow) => `${SITE}/bills?state=${state}&committee=${encodeURIComponent(row.label)}`)
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent>
        <ItemGroup>
          {rows.map((row) => (
            <Item key={`${row.chamber}/${row.label}`} variant="muted" render={<Link href={link(row)} className="no-underline" />}>
              <ItemMedia>
                <ChamberSeal state={state} chamber={row.chamber} size={32} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{truncate(row.label, 30)}</ItemTitle>
                <ItemDescription>{fmtNumber(row.bills)} bills</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      <CardFoot chamber={chamber} onChamber={onChamber} state={state} href={href ?? `${SITE}/committees?state=${state}`} label="All committees" />
    </>
  )
}

export function CommitteesCard({ rows, limit = 3, ...props }: Omit<React.ComponentProps<typeof CommitteesCardBody>, "chamber" | "onChamber"> & { limit?: number }) {
  const [chamber, setChamber] = React.useState("")
  const shown = [...rows].filter((r) => !chamber || r.chamber === chamber).sort((a, b) => b.bills - a.bills).slice(0, limit)
  return (
    <CardShell>
      <CommitteesCardBody {...props} rows={shown} chamber={chamber} onChamber={setChamber} />
    </CardShell>
  )
}
