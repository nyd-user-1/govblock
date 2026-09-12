"use client"

import * as React from "react"
import Link from "next/link"

import { fmtNumber } from "@/lib/format"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardContent } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Chambers — each chamber and who sits in it: seal · name · members.
export type ChamberRow = { label: string; members: number; bills?: number }

export function ChambersCardBody({ rows, state = "US", title = "Chambers", action, compact = false, chamberHref }: CardBodyProps & { rows: ChamberRow[]; compact?: boolean; chamberHref?: (row: ChamberRow) => string }) {
  const link = chamberHref ?? ((row: ChamberRow) => `${SITE}/bills?state=${state}&chamber=${encodeURIComponent(row.label)}`)
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent>
        <ItemGroup>
          {rows.map((row) => (
            <Item key={row.label} variant="muted" size={compact ? "sm" : "default"} render={<Link href={link(row)} className="no-underline" />}>
              <ItemMedia>
                <ChamberSeal state={state} chamber={row.label} size={compact ? 28 : 36} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{row.label}</ItemTitle>
              </ItemContent>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtNumber(row.members)}</span>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </>
  )
}

export function ChambersCard(props: React.ComponentProps<typeof ChambersCardBody>) {
  return (
    <CardShell>
      <ChambersCardBody {...props} />
    </CardShell>
  )
}
