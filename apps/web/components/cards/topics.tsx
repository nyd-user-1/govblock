"use client"

import * as React from "react"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtNumber } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CardFoot } from "@/components/card-foot"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { Badge } from "@govblock/ui/components/badge"
import {
  CardAction,
  CardContent,
  CardHeader,
} from "@govblock/ui/components/card"

// Topics — LegiScan's subject tags where the jurisdiction has them, the
// committee a bill sits in where it does not. The substitution prints itself
// in the footer; it is never silent.
export function TopicsCard() {
  const { data, state, congress } = useScoped<
    { value: string; count: number }[]
  >("subjects", null as unknown as { value: string; count: number }[])
  const rows = React.useMemo(
    () =>
      data
        ? data.slice(0, 8).map((r) => ({ label: r.value, bills: r.count }))
        : congress
          ? F.topics.rows
          : [],
    [data, congress]
  )
  return (
    <CardFrame id="subjects">
      <CardHeader>
        <CardAnchor>Topics</CardAnchor>
        <CardAction>
          <ComponentActions rows={rows} id="topics" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {rows.map((row) => (
            <Link
              key={row.label}
              href={`/docs/bills?state=${state}&committee=${encodeURIComponent(row.label)}`}
              className="no-underline"
            >
              <Badge
                variant="outline"
                className="gap-1.5 font-normal hover:bg-muted"
              >
                {row.label}
                <span className="text-muted-foreground tabular-nums">
                  {fmtNumber(row.bills)}
                </span>
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
      {/* No line under the chips (Brendan, 2026-09-09): it named LegiScan
          for every jurisdiction, and under Congress the terms are CRS's. */}
      <CardFoot href={`/docs/subjects?state=${state}`} label="All subjects" />
    </CardFrame>
  )
}
