"use client"

import * as React from "react"
import Link from "next/link"

import { fmtNumber } from "@/lib/format"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { Badge } from "@govblock/ui/components/badge"
import { CardContent } from "@govblock/ui/components/card"

// Topics — the subjects the session's bills are tagged with, each with its
// count, as chips.
export type TopicRow = { label: string; bills: number }

export function TopicsCardBody({ rows, state = "US", title = "Topics", action, href, topicHref }: CardBodyProps & { rows: TopicRow[]; topicHref?: (row: TopicRow) => string }) {
  const link = topicHref ?? ((row: TopicRow) => `${SITE}/bills?state=${state}&committee=${encodeURIComponent(row.label)}`)
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {rows.map((row) => (
            <Link key={row.label} href={link(row)} className="no-underline">
              <Badge variant="outline" className="gap-1.5 font-normal hover:bg-muted">
                {row.label}
                <span className="text-muted-foreground tabular-nums">{fmtNumber(row.bills)}</span>
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
      <CardFoot href={href ?? `${SITE}/tags?state=${state}`} label="All subjects" />
    </>
  )
}

export function TopicsCard({ rows, limit = 8, ...props }: React.ComponentProps<typeof TopicsCardBody> & { limit?: number }) {
  return (
    <CardShell>
      <TopicsCardBody {...props} rows={rows.slice(0, limit)} />
    </CardShell>
  )
}
