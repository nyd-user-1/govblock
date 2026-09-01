"use client"

import * as React from "react"
import Link from "next/link"

import * as F from "@/lib/fixtures"
import { partyName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { partyColor } from "@/lib/imagery"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { PartyDot } from "@/components/policy/imagery"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/toggle-group"

// Party — the two-tone proportion: who holds the seats, chamber by chamber.
export function PartyCard() {
  const state = F.STATE
  const [chamber, setChamber] = React.useState("")
  const chambers = React.useMemo(() => [...new Set(F.seats.map((row) => row.chamber))].sort(), [])
  const active = chamber || chambers[0] || ""
  const seats = F.seats.filter((row) => row.chamber === active)
  const total = seats.reduce((sum, row) => sum + row.seats, 0)
  const ordered = [...seats].sort((a, b) => b.seats - a.seats)

  return (
    <CardFrame id="party">
      <CardHeader>
        <CardTitle>Party</CardTitle>
        <CardDescription>
          {fmtNumber(total)} seats in the {active}
        </CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <span aria-hidden="true" className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {ordered.map((row) => (
            <span
              key={row.party}
              className="h-full"
              style={{ width: `${(row.seats / Math.max(total, 1)) * 100}%`, background: partyColor(row.party) }}
            />
          ))}
        </span>
        <div className="flex flex-col gap-1.5">
          {ordered.map((row) => (
            <Link
              key={row.party}
              href={`/docs/directory?state=${state}&party=${row.party}&chamber=${encodeURIComponent(active)}`}
              className="flex items-center gap-2 text-sm no-underline"
            >
              <PartyDot party={row.party} />
              <span className="truncate text-foreground">{partyName(row.party)}</span>
              <span className="ml-auto shrink-0 font-medium tabular-nums">{fmtNumber(row.seats)}</span>
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {Math.round((row.seats / Math.max(total, 1)) * 100)}%
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <ToggleGroup value={active} onValueChange={(value) => setChamber(String(value ?? ""))} variant="outline" spacing={1}>
          {chambers.map((name) => (
            <ToggleGroupItem key={name} value={name}>
              {name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardFooter>
    </CardFrame>
  )
}
