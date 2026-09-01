"use client"

import * as F from "@/lib/fixtures"
import { fmtNumber } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@govblock/ui/components/item"

// Sessions — the picker. Choosing one scopes every other card; the current
// one is marked.
export function SessionsCard() {
  return (
    <CardFrame id="sessions">
      <CardHeader>
        <CardTitle>Sessions</CardTitle>
        <CardDescription>Showing the most recent session with bills</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {F.sessions.map((row) => {
            const isCurrent = row.session_year === F.SESSION
            return (
              <Item
                key={row.session_year}
                variant="muted"
                aria-current={isCurrent ? "true" : undefined}
                className={isCurrent ? "ring-1 ring-ring/40" : undefined}
                render={<button type="button" className="w-full text-left" />}
              >
                <ItemContent>
                  <ItemTitle>{row.label}</ItemTitle>
                  <ItemDescription>
                    {row.years} · {fmtNumber(row.bills)} bills{isCurrent ? " · current" : ""}
                  </ItemDescription>
                </ItemContent>
              </Item>
            )
          })}
        </ItemGroup>
      </CardContent>
    </CardFrame>
  )
}
