"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { memberHref } from "@/lib/filters"
import { portraitFor } from "@/lib/imagery"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { MembersCardBody, type MemberRow } from "@/components/cards/members-card"
import { CardAnchor } from "@/components/admin/blocks/card-tools"

// Members, on the home page.
type Person = (typeof F.members.rows)[number] & { active?: boolean; bioguide_id?: string | null }

type Portrait = { bioguide_id: string; portrait_url: string | null }

export function MembersCard() {
  const { data, state } = useScoped<Person[]>("members", F.members.rows)
  // The portraits we actually hold: congress.gov's depiction, by bioguide,
  // for the federal roster. A state's come on the People row itself.
  const { data: portraits } = useScoped<{ members: Portrait[] }>(state === "US" ? "member-detail" : null, { members: [] })
  // The card shows the sitting chamber; former members belong to the bills
  // they sponsored, not to a roster.
  const [chamber, setChamber] = React.useState("")
  const held = React.useMemo(() => new Map((portraits?.members ?? []).filter((p) => p.portrait_url).map((p) => [p.bioguide_id.toUpperCase(), p.portrait_url as string])), [portraits])
  const photoOf = React.useCallback(
    (row: Person) => {
      if (state === "US") return row.bioguide_id ? (held.get(row.bioguide_id.toUpperCase()) ?? null) : null
      return row.photo_url ?? null
    },
    [state, held]
  )
  // Members with a real headshot first, so the grid is faces where we have
  // them and seals only where we do not (Brendan, 2026-09-07).
  const rows = React.useMemo<MemberRow[]>(() => {
    const sitting = (data ?? []).filter((m) => m.active !== false && (!chamber || m.chamber === chamber))
    const withFace = sitting.filter((r) => photoOf(r))
    const without = sitting.filter((r) => !photoOf(r))
    return [...withFace, ...without].slice(0, 12).map((r) => ({ people_id: r.people_id, name: r.name, party: r.party, role: r.role, chamber: r.chamber, photo: photoOf(r) ?? portraitFor(r), serving: r.serving }))
  }, [data, chamber, photoOf])
  return (
    <CardFrame id="members">
      <MembersCardBody rows={rows} state={state} title={<CardAnchor>Members</CardAnchor>} action={<ComponentActions rows={rows} id="members" />} chamber={chamber} onChamber={setChamber} memberHref={(row) => memberHref(row.people_id, state)} href={`/members?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} />
    </CardFrame>
  )
}
