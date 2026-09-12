"use client"

import * as React from "react"
import Link from "next/link"

import { partyName } from "@/lib/filters"
import { fmtNumber } from "@/lib/format"
import { partyColor } from "@/lib/imagery"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { PartyDot } from "@/components/policy/imagery"
import { CardContent } from "@govblock/ui/components/card"
import { ToggleGroup, ToggleGroupItem } from "@govblock/ui/components/toggle-group"

// Party — the two-tone proportion: who holds the seats, chamber by chamber.
export type SeatRow = { chamber: string; party: string; seats: number }

export function PartyCardBody({ rows, state = "US", title = "Party", action, href, memberHref }: CardBodyProps & { rows: SeatRow[]; memberHref?: (party: string, chamber: string) => string }) {
  const [chamber, setChamber] = React.useState("")
  const chambers = React.useMemo(() => [...new Set(rows.map((row) => row.chamber))].sort(), [rows])
  const active = chamber && chambers.includes(chamber) ? chamber : (chambers[0] ?? "")
  const seats = rows.filter((row) => row.chamber === active)
  const total = seats.reduce((sum, row) => sum + row.seats, 0)
  const ordered = [...seats].sort((a, b) => b.seats - a.seats)
  const link = memberHref ?? ((party: string, ch: string) => `${SITE}/members?state=${state}&party=${party}&chamber=${encodeURIComponent(ch)}`)
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent className="flex flex-col gap-3">
        <span aria-hidden="true" className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {ordered.map((row) => (
            <span key={row.party} className="h-full" style={{ width: `${(row.seats / Math.max(total, 1)) * 100}%`, background: partyColor(row.party) }} />
          ))}
        </span>
        <div className="flex flex-col gap-1.5">
          {ordered.map((row) => (
            <Link key={row.party} href={link(row.party, active)} className="flex items-center gap-2 text-sm no-underline">
              <PartyDot party={row.party} />
              <span className="truncate text-foreground">{partyName(row.party)}</span>
              <span className="ml-auto shrink-0 font-medium tabular-nums">{fmtNumber(row.seats)}</span>
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{Math.round((row.seats / Math.max(total, 1)) * 100)}%</span>
            </Link>
          ))}
        </div>
      </CardContent>
      <CardFoot href={href ?? `${SITE}/members?state=${state}${active ? `&chamber=${encodeURIComponent(active)}` : ""}`} label="All members">
        <ToggleGroup value={active ? [active] : []} onValueChange={(value) => setChamber(String(value ?? ""))} variant="outline" spacing={1}>
          {chambers.map((name) => (
            <ToggleGroupItem key={name} value={name} className="text-muted-foreground hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">
              {name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardFoot>
    </>
  )
}

export function PartyCard(props: React.ComponentProps<typeof PartyCardBody>) {
  return (
    <CardShell>
      <PartyCardBody {...props} />
    </CardShell>
  )
}
