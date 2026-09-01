"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { ChamberSeal } from "@/components/policy/imagery"
import { SubjectPicker } from "@/components/subject-picker"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@govblock/ui/components/item"

// Votes — the latest roll calls with their aye/nay split. Each row is the
// vote: a two-tone bar sized by the tally, linking to the bill it decided.
function Tally({ yea, nay }: { yea: number; nay: number }) {
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

export function VotesCard() {
  const { data, state } = useScoped<typeof F.votes>("rollcalls", F.votes, { limit: 5 })
  return (
    <CardFrame id="votes">
      <CardHeader>
        <CardTitle>Votes</CardTitle>
        <CardDescription>The latest roll calls</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {(data ?? []).map((row) => (
            <Item key={row.roll_call_id} variant="muted" render={<Link href={`/docs/bills/${row.bill_id}`} className="no-underline" />}>
              <ItemMedia>
                <ChamberSeal state={state} chamber={row.chamber} size={32} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {row.bill_number} · {truncate(row.description, 28)}
                </ItemTitle>
                <ItemDescription>
                  {fmtDate(row.date, false)} · {row.chamber}
                </ItemDescription>
              </ItemContent>
              <Tally yea={row.yea} nay={row.nay} />
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
