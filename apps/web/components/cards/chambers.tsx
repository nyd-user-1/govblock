"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { fmtNumber } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Chambers — each chamber with the bills before it and the members in it.
// The seal is the avatar, and the row filters the rest of the grid.
export function ChambersCard() {
  const state = F.STATE
  return (
    <CardFrame id="chambers">
      <CardHeader>
        <CardTitle>Chambers</CardTitle>
        <CardDescription>Bills before each chamber, and who sits in it</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {F.chambers.map((row) => (
            <Item
              key={row.label}
              variant="muted"
              render={<Link href={`/docs/bills?state=${state}&chamber=${encodeURIComponent(row.label)}`} className="no-underline" />}
            >
              <ItemMedia>
                <ChamberSeal state={state} chamber={row.label} size={36} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{row.label}</ItemTitle>
                <ItemDescription>{fmtNumber(row.members)} members</ItemDescription>
              </ItemContent>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{fmtNumber(row.bills)}</span>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </CardFrame>
  )
}
