"use client"

import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
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

// Votes — the second instance of the rail-and-cards shell. Rail = chamber,
// then the committees that recorded a vote; cards = the roll calls, each with
// the tally drawn as the thing it is.

type VoteRow = {
  roll_call_id: number
  date: string
  chamber: string
  description: string
  yea: number
  nay: number
  total: number
  bill_id: number
  bill_number: string
  title: string
}

const ALL = "__all__"

export function VotesBoard() {
  const { state, session } = useJurisdiction()
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")

  const { data, isLoading } = usePolicy<VoteRow[]>("rollcalls", { state })
  const rows = React.useMemo(() => {
    const all = data ?? []
    const query = search.trim().toLowerCase()
    return all.filter((row) => {
      if (selected !== ALL && row.chamber !== selected) return false
      if (!query) return true
      return (
        row.bill_number.toLowerCase().includes(query) ||
        (row.description ?? "").toLowerCase().includes(query) ||
        (row.title ?? "").toLowerCase().includes(query)
      )
    })
  }, [data, search, selected])

  const groups = React.useMemo<RailGroup[]>(() => {
    const all = data ?? []
    const chambers = [
      ...new Set(all.map((r) => r.chamber).filter(Boolean)),
    ].sort()
    return [
      {
        label: "Chambers",
        items: [
          { value: ALL, label: "Every vote", hint: String(all.length) },
          ...chambers.map((chamber) => ({
            value: chamber,
            label: chamber,
            hint: String(all.filter((r) => r.chamber === chamber).length),
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
      searchPlaceholder="Search votes…"
      header={
        <>
          <span className="text-sm font-medium">
            {stateName(state)} roll calls
          </span>
          <Badge variant="outline" className="font-normal">
            {fmtNumber(rows.length)} · {session} session
          </Badge>
        </>
      }
    >
      {rows.map((row) => {
        const total = Math.max(row.yea + row.nay, 1)
        return (
          <Card key={row.roll_call_id} size="sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <ChamberSeal state={state} chamber={row.chamber} size={36} />
                <div className="flex min-w-0 flex-col">
                  <CardTitle className="truncate">
                    <Link
                      href={`/docs/bills/${row.bill_id}`}
                      className="no-underline hover:underline"
                      title={row.title}
                    >
                      {row.bill_number}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {truncate(row.description ?? "", 44)}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="h-full"
                  style={{
                    width: `${(row.yea / total) * 100}%`,
                    background: "var(--chart-2)",
                  }}
                />
                <span
                  className="h-full"
                  style={{
                    width: `${(row.nay / total) * 100}%`,
                    background: "var(--chart-5)",
                  }}
                />
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtNumber(row.yea)} aye · {fmtNumber(row.nay)} nay ·{" "}
                {fmtDate(row.date, false)}
              </span>
              <span className="text-xs text-muted-foreground">
                {truncate(row.title ?? "", 90)}
              </span>
            </CardContent>
          </Card>
        )
      })}
      {!rows.length && (
        <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : `No roll calls for ${stateName(state)}${search ? ` matching “${search}”` : ""}.`}
        </p>
      )}
    </RailAndCards>
  )
}
