"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { fmtNumber, truncate } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal } from "@/components/policy/imagery"
import { SubjectPicker } from "@/components/subject-picker"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Committees — each with its bill count and a four-bar chart of the quarters
// it acted. The chart is the one from shadcn's Q2 Dividend Income card.
function Bars({ label, values }: { label: string; values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="hidden h-8 w-24 items-end gap-1 md:flex" role="img" aria-label={`${label} bills by quarter`}>
      {values.map((value, index) => (
        <div key={index} className="min-h-1 flex-1 rounded-t-sm bg-chart-2" style={{ height: `${(value / max) * 100}%` }} />
      ))}
    </div>
  )
}

export function CommitteesCard() {
  const state = F.STATE
  return (
    <CardFrame id="committees">
      <CardHeader>
        <CardTitle>Committees</CardTitle>
        <CardDescription>Where the bills are, and when they moved</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {F.committees.map((row) => (
            <Item
              key={row.label}
              variant="muted"
              render={<Link href={`/docs/bills?state=${state}&committee=${encodeURIComponent(row.label)}`} className="no-underline" />}
            >
              <ItemMedia>
                <ChamberSeal state={state} chamber={row.chamber} size={32} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{truncate(row.label, 30)}</ItemTitle>
                <ItemDescription>{fmtNumber(row.bills)} bills</ItemDescription>
              </ItemContent>
              <Bars label={row.label} values={row.bars} />
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
      <CardFooter>
        <SubjectPicker label="Chamber" allLabel="Both chambers" items={["Assembly", "Senate"]} />
      </CardFooter>
    </CardFrame>
  )
}
