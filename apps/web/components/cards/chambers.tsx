"use client"

import * as React from "react"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtNumber } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal } from "@/components/policy/imagery"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Chambers — each chamber with the bills before it and the members in it.
// The seal is the avatar, and the row filters the rest of the grid.
type Option = { value: string; count: number }

export function ChambersCard() {
  const { data: options, state } = useScoped<{ chambers: Option[] }>("options", null as unknown as { chambers: Option[] })
  const { data: seats } = useScoped<{ chamber: string; seats: number }[]>("seats", null as unknown as { chamber: string; seats: number }[])
  const chambers = React.useMemo(() => {
    if (!options) return F.chambers
    const members = new Map<string, number>()
    for (const row of seats ?? []) members.set(row.chamber, (members.get(row.chamber) ?? 0) + row.seats)
    return options.chambers.map((c) => ({ label: c.value, bills: c.count, members: members.get(c.value) ?? 0 }))
  }, [options, seats])
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
          {chambers.map((row) => (
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
