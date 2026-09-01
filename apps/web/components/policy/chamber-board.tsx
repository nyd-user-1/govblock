"use client"

import * as React from "react"
import Link from "next/link"

import { memberHref, partyName, stateName } from "@/lib/filters"
import { fmtNumber, honorific } from "@/lib/format"
import { portraitFor } from "@/lib/imagery"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { MemberRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { MemberPortrait, PartyDot } from "@/components/policy/imagery"
import {
  RailAndCards,
  type RailGroup,
} from "@/components/policy/rail-and-cards"
import { Badge } from "@govblock/ui/components/nova/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@govblock/ui/components/nova/card"

// Chamber — the third instance of the rail-and-cards shell. Rail = chamber,
// then party; cards = the people who sit there.

const ALL = "__all__"

export function ChamberBoard() {
  const { state, session } = useJurisdiction()
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")
  const { data, isLoading } = usePolicy<MemberRow[]>("members", { state })

  const sitting = React.useMemo(
    () => (data ?? []).filter((member) => member.active),
    [data]
  )

  const rows = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return sitting.filter((member) => {
      if (selected !== ALL) {
        const [kind, value] = selected.split(":")
        if (kind === "chamber" && member.chamber !== value) return false
        if (kind === "party" && (member.party || "I") !== value) return false
      }
      if (!query) return true
      return (
        member.name.toLowerCase().includes(query) ||
        (member.district ?? "").toLowerCase().includes(query)
      )
    })
  }, [sitting, search, selected])

  const groups = React.useMemo<RailGroup[]>(() => {
    const chambers = [
      ...new Set(sitting.map((m) => m.chamber).filter(Boolean)),
    ].sort()
    const parties = [...new Set(sitting.map((m) => m.party || "I"))].sort()
    return [
      {
        label: "Chambers",
        items: [
          { value: ALL, label: "Every member", hint: String(sitting.length) },
          ...chambers.map((chamber) => ({
            value: `chamber:${chamber}`,
            label: chamber,
            hint: String(sitting.filter((m) => m.chamber === chamber).length),
          })),
        ],
      },
      {
        label: "Parties",
        items: parties.map((party) => ({
          value: `party:${party}`,
          label: partyName(party) || party,
          hint: String(
            sitting.filter((m) => (m.party || "I") === party).length
          ),
        })),
      },
    ]
  }, [sitting])

  return (
    <RailAndCards
      groups={groups}
      selected={selected}
      onSelect={(value) =>
        setSelected((current) => (current === value ? ALL : value))
      }
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search members…"
      header={
        <>
          <span className="text-sm font-medium">
            {stateName(state)} members
          </span>
          <Badge variant="outline" className="font-normal">
            {fmtNumber(rows.length)} · {session} session
          </Badge>
        </>
      }
    >
      {rows.map((member) => (
        <Card key={member.people_id} size="sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <MemberPortrait
                name={member.name}
                photoUrl={portraitFor(member)}
                state={state}
                chamber={member.chamber}
                size={44}
              />
              <div className="flex min-w-0 flex-col">
                <CardTitle className="flex items-center gap-2 truncate">
                  <PartyDot party={member.party} serving={member.active} />
                  <Link
                    href={memberHref(member.people_id, state)}
                    className="truncate no-underline hover:underline"
                    title={member.name}
                  >
                    {honorific(member.role, member.chamber)} {member.name}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {[
                    member.chamber,
                    member.district
                      ? member.district.replace(/^[A-Z]+-0*/, "District ")
                      : null,
                    partyName(member.party),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          {member.leadership_title && (
            <CardContent className="text-xs text-muted-foreground">
              {member.leadership_title}
            </CardContent>
          )}
        </Card>
      ))}
      {!rows.length && (
        <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `No members for ${stateName(state)}${search ? ` matching “${search}”` : ""}.`}
        </p>
      )}
    </RailAndCards>
  )
}
