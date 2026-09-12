"use client"

import * as React from "react"

import { fmtNumber } from "@/lib/format"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { CardContent } from "@govblock/ui/components/card"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@govblock/ui/components/item"

// Sessions — every session the jurisdiction has on file, newest first, each
// with its bill count; the current one is marked.
export type SessionRow = { session_year: number; label: string; years: string; bills: number }

export function SessionsCardBody({ rows, current, onPick, state = "US", title = "Sessions", action, href }: CardBodyProps & { rows: SessionRow[]; current?: number | null; onPick?: (year: number) => void }) {
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent>
        <ItemGroup>
          {rows.map((row) => {
            const isCurrent = row.session_year === current
            return (
              <Item key={row.session_year} variant="muted" aria-current={isCurrent ? "true" : undefined} className={isCurrent ? "ring-1 ring-ring/40" : undefined} render={<button type="button" className="w-full text-left" onClick={() => onPick?.(row.session_year)} />}>
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
      <CardFoot href={href ?? `${SITE}/docs/datasets/${state.toLowerCase()}`} label="The sessions as files" />
    </>
  )
}

export function SessionsCard(props: React.ComponentProps<typeof SessionsCardBody>) {
  return (
    <CardShell>
      <SessionsCardBody {...props} />
    </CardShell>
  )
}
