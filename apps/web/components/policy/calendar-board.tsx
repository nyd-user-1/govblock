"use client"

import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, fmtTime, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import type { Hearing } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { ChamberSeal } from "@/components/policy/imagery"
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

// Calendar — the fourth instance of the rail-and-cards shell. Rail = the
// committees that have calendared something; cards = what they calendared.

const ALL = "__all__"
const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10)

export function CalendarBoard() {
  const { state, session } = useJurisdiction()
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")

  // hearings-recent falls back to the 60 days before the jurisdiction's last
  // hearing when the window around today is empty, which it is for most of the
  // 52 between sessions, and reports the date it runs through.
  const { data, isLoading } = usePolicy<{ rows: Hearing[]; through: string | null }>(
    "hearings-recent",
    { state },
    {
      from: iso(-30),
      to: iso(90),
      limit: 3000,
    }
  )
  const through = data?.through ?? null

  const rows = React.useMemo(() => {
    const all = data?.rows ?? []
    const query = search.trim().toLowerCase()
    return all
      .filter((hearing) => {
        if (selected !== ALL && (hearing.committee ?? "") !== selected)
          return false
        if (!query) return true
        return (
          (hearing.description ?? "").toLowerCase().includes(query) ||
          hearing.bill_number.toLowerCase().includes(query) ||
          (hearing.title ?? "").toLowerCase().includes(query)
        )
      })
      .slice(0, 60)
  }, [data, search, selected])

  const groups = React.useMemo<RailGroup[]>(() => {
    const all = data?.rows ?? []
    const byCommittee = new Map<string, number>()
    for (const hearing of all) {
      const key = hearing.committee ?? ""
      if (key) byCommittee.set(key, (byCommittee.get(key) ?? 0) + 1)
    }
    return [
      {
        label: "Committees",
        items: [
          {
            value: ALL,
            label: "Everything calendared",
            hint: String(all.length),
          },
          ...[...byCommittee.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([committee, count]) => ({
              value: committee,
              label: committee,
              hint: String(count),
            })),
        ],
      },
    ]
  }, [data])

  return (
    <RailAndCards
      groups={groups}
      selected={selected}
      onSelect={(value) =>
        setSelected((current) => (current === value ? ALL : value))
      }
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search the calendar…"
      header={
        <>
          <span className="text-sm font-medium">
            {stateName(state)} calendar
          </span>
          <Badge variant="outline" className="font-normal">
            {fmtNumber(rows.length)} · {session} session
          </Badge>
          {/* Anchored on the last sitting rather than on today, so the rows do
              not read as upcoming when the legislature is between sessions. */}
          {through && (
            <Badge variant="secondary" className="font-normal">
              through {fmtDate(through, false)}
            </Badge>
          )}
        </>
      }
    >
      {rows.map((hearing, index) => (
        <Card key={`${hearing.bill_id}-${index}`} size="sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <ChamberSeal
                state={state}
                chamber={hearing.chamber ?? hearing.body}
                size={36}
              />
              <div className="flex min-w-0 flex-col">
                <CardTitle className="truncate">
                  <Link
                    href={`/docs/bills/${hearing.bill_id}`}
                    className="no-underline hover:underline"
                    title={hearing.title}
                  >
                    {hearing.bill_number}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {truncate(hearing.description ?? "", 42)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>
              {fmtDate(hearing.date, false)}
              {hearing.time ? ` · ${fmtTime(hearing.time)}` : ""}
              {hearing.location ? ` · ${truncate(hearing.location, 28)}` : ""}
            </span>
            <span>{truncate(hearing.title ?? "", 90)}</span>
          </CardContent>
        </Card>
      ))}
      {!rows.length && (
        <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `Nothing calendared for ${stateName(state)}${search ? ` matching “${search}”` : ""}.`}
        </p>
      )}
    </RailAndCards>
  )
}
