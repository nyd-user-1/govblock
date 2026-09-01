"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { fmtNumber } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { SubjectPicker } from "@/components/subject-picker"
import { Badge } from "@govblock/ui/components/badge"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"

// Topics — LegiScan's subject tags where the jurisdiction has them, the
// committee a bill sits in where it does not. The substitution prints itself
// in the footer; it is never silent.
export function TopicsCard() {
  const state = F.STATE
  return (
    <CardFrame id="subjects">
      <CardHeader>
        <CardTitle>Topics</CardTitle>
        <CardDescription>What this session is about</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {F.topics.rows.map((row) => (
            <Link key={row.label} href={`/docs/bills?state=${state}&committee=${encodeURIComponent(row.label)}`} className="no-underline">
              <Badge variant="outline" className="gap-1.5 font-normal hover:bg-muted">
                {row.label}
                <span className="text-muted-foreground tabular-nums">{fmtNumber(row.bills)}</span>
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <p className="text-[11px] text-balance text-muted-foreground">{F.topics.note}</p>
        <SubjectPicker label="Chamber" allLabel="Both chambers" items={["Assembly", "Senate"]} />
      </CardFooter>
    </CardFrame>
  )
}
