"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtNumber } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@govblock/ui/components/item"

// Sessions — the picker. Choosing one scopes every other card; the current
// one is marked.
type ApiSession = { session_id: number; bills: number; title: string }

export function SessionsCard() {
  const { data, session, congress } = useScoped<ApiSession[]>("sessions", null as unknown as ApiSession[], { titles: 1 })
  const sessions = React.useMemo(
    () =>
      data
        ? data.map((row) => ({
            session_year: row.session_id,
            label: row.title,
            // The span when the title carries one ("2025-2026 Regular Session"),
            // otherwise the year the session opened.
            years: row.title.match(/\d{4}-\d{4}/)?.[0] ?? String(row.session_id),
            bills: row.bills,
          }))
        : congress
          ? F.sessions
          : [],
    [data, congress]
  )
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
          {sessions.map((row) => {
            const isCurrent = row.session_year === session
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
                    {row.years} · {fmtNumber(row.bills)} bills
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
