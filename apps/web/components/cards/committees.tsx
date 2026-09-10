"use client"

import * as React from "react"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtNumber, truncate } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardFoot } from "@/components/card-foot"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { CardAction, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Committees — each with its bill count; the footer picks the chamber
// (Brendan, 2026-09-01: pills, as on the Party card; the quarterly bars are gone).
type Committee = { committee_name: string; chamber: string; bills: number }

export function CommitteesCard() {
  const [chamber, setChamber] = React.useState("")
  const { data, state, congress } = useScoped<Committee[]>("committees", null as unknown as Committee[])
  const committees = React.useMemo(
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
      <CardHeader>
        <CardAnchor>Committees</CardAnchor>
        <CardAction>
          <ComponentActions rows={committees} id="committees" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {committees.map((row) => (
            <Item key={row.label} variant="muted" render={<Link href={`/bills?state=${state}&committee=${encodeURIComponent(row.label)}`} className="no-underline" />}>
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
      <CardFoot chamber={chamber} onChamber={setChamber} href={`/committees?state=${state}`} label="All committees" />
    </CardFrame>
  )
}
