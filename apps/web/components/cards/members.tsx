"use client"

import * as React from "react"
import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { memberHref } from "@/lib/filters"
import { honorific } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { CardAnchor } from "@/components/admin/blocks/card-tools"
import { CardFoot } from "@/components/card-foot"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"
import { CardAction, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/card"

// Members — the headshot grid. Real portraits where the jurisdiction publishes
// them; the chamber's seal where none exists.
type Person = (typeof F.members.rows)[number] & { active?: boolean }

type Portrait = { bioguide_id: string; portrait_url: string | null }

export function MembersCard() {
  const { data, state } = useScoped<Person[]>("members", F.members.rows)
  // The portraits we actually hold: congress.gov's depiction, by bioguide,
  // for the federal roster. A state's come on the People row itself.
  const { data: portraits } = useScoped<{ members: Portrait[] }>(state === "US" ? "member-detail" : null, { members: [] })
  // The card shows the sitting chamber; former members belong to the bills
  // they sponsored, not to a roster.
  const [chamber, setChamber] = React.useState("")
  const sitting = React.useMemo(() => (data ?? []).filter((m) => m.active !== false && (!chamber || m.chamber === chamber)), [data, chamber])
  // Members with a real headshot first, so the grid is faces where we have
  // them and seals only where we do not (Brendan, 2026-09-07).
  const held = React.useMemo(() => new Map((portraits?.members ?? []).filter((p) => p.portrait_url).map((p) => [p.bioguide_id.toUpperCase(), p.portrait_url as string])), [portraits])
  const photoOf = React.useCallback(
    (row: Person) => {
      const id = (row as { bioguide_id?: string | null }).bioguide_id
      if (state === "US") return id ? (held.get(id.toUpperCase()) ?? null) : null
      return row.photo_url ?? null
    },
    [state, held]
  )
  const rows = React.useMemo(() => {
    const withFace = sitting.filter((r) => photoOf(r))
    const without = sitting.filter((r) => !photoOf(r))
    return [...withFace, ...without].slice(0, 12)
  }, [sitting, photoOf])
  return (
    <CardFrame id="members">
      <CardHeader>
        <CardAnchor>Members</CardAnchor>
        <CardAction>
          <ComponentActions rows={rows} id="members" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {rows.map((row) => (
            <Tooltip key={row.people_id}>
              <TooltipTrigger
                render={
                  <Link href={memberHref(row.people_id, state)} className="flex flex-col items-center gap-1 no-underline">
                    <span className="relative">
                      <MemberPortrait name={row.name} photoUrl={photoOf(row) ?? portraitFor(row)} state={state} chamber={row.chamber} size={44} />
                      <PartyDot party={row.party} serving={row.serving} className="absolute right-0 bottom-0 ring-2 ring-card" />
                    </span>
                    <span className="w-full truncate text-center text-[11px] text-muted-foreground">{row.name.split(",")[0]}</span>
                  </Link>
                }
              />
              <TooltipContent>{`${honorific(row.role, row.chamber)} ${row.name}`.trim()}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </CardContent>
      <CardFoot chamber={chamber} onChamber={setChamber} href={`/docs/directory?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} label="All members" />
    </CardFrame>
  )
}
