"use client"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { memberHref } from "@/lib/filters"
import { honorific } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { SubjectPicker } from "@/components/subject-picker"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// Members — the headshot grid. Real portraits where the jurisdiction publishes
// them; the chamber's seal where none exists.
export function MembersCard() {
  const state = F.STATE
  const rows = F.members.rows
  const withPhoto = rows.filter((r) => portraitFor(r)).length
  return (
    <CardFrame id="members">
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          {F.members.total} members · {withPhoto} of {rows.length} shown with a portrait
        </CardDescription>
        <CardAction>
          <ComponentActions />
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
                      <MemberPortrait name={row.name} photoUrl={portraitFor(row)} state={state} chamber={row.chamber} size={44} />
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
      <CardFooter>
        <SubjectPicker label="Chamber" allLabel="Both chambers" items={["Assembly", "Senate"]} />
      </CardFooter>
    </CardFrame>
  )
}
