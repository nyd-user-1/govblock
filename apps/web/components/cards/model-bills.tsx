"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { Button } from "@govblock/ui/components/button"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"

// Model bills — bills whose text is shared with bills in other states.
export function ModelBillsCard() {
  const { state } = useJurisdiction()
  return (
    <CardFrame id="model-bills">
      <CardHeader>
        <CardTitle>Model bills</CardTitle>
        <CardDescription>Bills sharing text with bills in other states</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {F.modelBills.stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-muted/50 p-3">
              <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {F.modelBills.top.map((row) => (
            <div key={row.bill} className="flex justify-between">
              <span className="font-medium">{row.bill}</span>
              <span className="text-muted-foreground">↔ {row.states} states</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/docs/model-bills?state=${state}`} />}>
          All lineages
        </Button>
      </CardFooter>
    </CardFrame>
  )
}
