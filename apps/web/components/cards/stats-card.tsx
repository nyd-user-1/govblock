"use client"

import * as React from "react"

import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, type CardBodyProps } from "@/components/cards/card-shell"
import { CardContent } from "@govblock/ui/components/card"

// A stats card: a row of tiles, each a number and its label, and a ranked
// list under them. Lobbying and Model bills on the home page are two of it.
export type Stat = { label: string; value: string }

export function StatsCardBody({
  stats,
  list,
  columns,
  title,
  action,
  href,
  footLabel,
}: Omit<CardBodyProps, "href"> & { stats: Stat[]; /** The ranked rows under the tiles, already in order. */ list?: React.ReactNode[]; columns?: 2 | 3; href: string; footLabel: string }) {
  const cols = columns ?? (stats.length >= 3 ? 3 : 2)
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent className="flex flex-col gap-4">
        <div className={cols === 3 ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-muted/50 p-3">
              <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
        {list?.length ? <div className="flex flex-col gap-1.5 text-sm">{list}</div> : null}
      </CardContent>
      <CardFoot href={href} label={footLabel} />
    </>
  )
}

export function StatsCard(props: React.ComponentProps<typeof StatsCardBody>) {
  return (
    <CardShell>
      <StatsCardBody {...props} />
    </CardShell>
  )
}
