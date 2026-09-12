"use client"

import * as React from "react"
import Link from "next/link"

import { honorific } from "@/lib/format"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { CardContent } from "@govblock/ui/components/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// Members — the headshot grid. Real portraits where the jurisdiction
// publishes them; the chamber's seal where none exists.
export type MemberRow = { people_id: number | string; name: string; party: string; role?: string | null; chamber: string; photo: string | null; serving?: boolean }

export function MembersCardBody({
  rows,
  state = "US",
  title = "Members",
  action,
  href,
  chamber,
  onChamber,
  memberHref,
}: CardBodyProps & { rows: MemberRow[]; chamber?: string; onChamber?: (chamber: string) => void; memberHref?: (row: MemberRow) => string }) {
  const link = memberHref ?? ((row: MemberRow) => `${SITE}/members/${row.people_id}?state=${state}`)
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {rows.map((row) => (
            <Tooltip key={row.people_id}>
              <TooltipTrigger
                render={
                  <Link href={link(row)} className="flex flex-col items-center gap-1 no-underline">
                    <span className="relative">
                      <MemberPortrait name={row.name} photoUrl={row.photo} state={state} chamber={row.chamber} size={44} />
                      <PartyDot party={row.party} serving={row.serving ?? true} className="absolute right-0 bottom-0 ring-2 ring-card" />
                    </span>
                    <span className="w-full truncate text-center text-[11px] text-muted-foreground">{row.name.split(",")[0]}</span>
                  </Link>
                }
              />
              <TooltipContent>{`${honorific(row.role ?? "", row.chamber)} ${row.name}`.trim()}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </CardContent>
      <CardFoot chamber={chamber} onChamber={onChamber} state={state} href={href ?? `${SITE}/members?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} label="All members" />
    </>
  )
}

/** The card on its own: faces first, then the seals, twelve at most. */
export function MembersCard({ rows, limit = 12, ...props }: Omit<React.ComponentProps<typeof MembersCardBody>, "chamber" | "onChamber"> & { limit?: number }) {
  const [chamber, setChamber] = React.useState("")
  const shown = React.useMemo(() => {
    const sitting = rows.filter((r) => r.serving !== false && (!chamber || r.chamber === chamber))
    return [...sitting.filter((r) => r.photo), ...sitting.filter((r) => !r.photo)].slice(0, limit)
  }, [rows, chamber, limit])
  return (
    <CardShell>
      <MembersCardBody {...props} rows={shown} chamber={chamber} onChamber={setChamber} />
    </CardShell>
  )
}
