"use client"

import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { useCongressRecord } from "@/lib/policy/use-congress"
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
  /** Where the roll call reads, when the site holds no bill of its own for it. */
  href?: string
  /** Who counted it, when that is not the legislature's own clerk feed. */
  source?: string
}

// The House floor, as the House Clerk records it. LegiScan carries 120 roll
// calls for this Congress and almost all of them are the Senate's, so the
// House's own record is most of what a reader came for. A roll call is only
// drawn when its tally can be counted from the positions on file — the card
// draws the vote, and a card with no vote in it is not a card.
type HouseVote = {
  identifier?: number
  rollCallNumber?: number
  sessionNumber?: number
  startDate?: string
  legislationType?: string
  legislationNumber?: string
  legislationUrl?: string
  voteQuestion?: string
  voteType?: string
  result?: string
}
type Positions = Record<string, HouseVote & { results?: { voteCast?: string }[] }>

// LegiScan writes H.R. 3424 as HB3424; the two have to agree before a duplicate
// can be recognised.
const LEGISCAN_TYPE: Record<string, string> = {
  HR: "HB", S: "SB", HRES: "HR", SRES: "SR",
  HJRES: "HJR", SJRES: "SJR", HCONRES: "HCR", SCONRES: "SCR",
}

const ALL = "__all__"

export function VotesBoard() {
  const { state, session } = useJurisdiction()
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")

  const { data, isLoading } = usePolicy<VoteRow[]>("rollcalls", { state })

  // Under Congress the board reads the House Clerk's own roll calls beside
  // LegiScan's, because LegiScan's are almost all Senate. Where both recorded
  // the same vote the Clerk's tally wins: it is the count of record.
  const house = useCongressRecord<{ houseRollCallVotes?: HouseVote[]; positions?: Positions }>(
    state === "US" ? "house-votes" : null,
    { limit: 250 }
  )
  const floor = React.useMemo<VoteRow[]>(() => {
    const positions = house?.positions ?? {}
    return (house?.houseRollCallVotes ?? []).flatMap((row) => {
      // The positions record is the fuller of the two — it is the only one
      // that carries the question the House was actually asked — so it wins
      // where both describe the same roll call.
      const record = positions[String(row.identifier)]
      const cast = record?.results
      if (!cast?.length) return []
      const vote = { ...row, ...record }
      const yea = cast.filter((v) => /^(yea|aye)$/i.test(String(v.voteCast))).length
      const nay = cast.filter((v) => /^(nay|no)$/i.test(String(v.voteCast))).length
      const type = String(vote.legislationType ?? "").toUpperCase()
      // Not every roll call is on a bill — the House also votes on adjourning
      // and on its own journal — and those name themselves by their number.
      const named = vote.legislationNumber ? `${LEGISCAN_TYPE[type] ?? type}${vote.legislationNumber}` : ""
      return [
        {
          roll_call_id: -Number(vote.identifier ?? 0),
          date: String(vote.startDate ?? "").slice(0, 10),
          chamber: "House",
          description: vote.voteQuestion ?? vote.voteType ?? "",
          yea,
          nay,
          total: cast.length,
          bill_id: 0,
          bill_number: named || `Roll call ${vote.rollCallNumber ?? "—"}`,
          title: [vote.result, vote.voteType].filter(Boolean).join(" · "),
          href: vote.legislationUrl,
          source: "House Clerk",
        },
      ]
    })
  }, [house])

  const rows = React.useMemo(() => {
    const legiscan = data ?? []
    const counted = new Set(floor.map((row) => `${row.bill_number}/${row.date}`))
    const all = [...floor, ...legiscan.filter((row) => !counted.has(`${row.bill_number}/${row.date}`))].sort((a, b) =>
      b.date.localeCompare(a.date)
    )
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
  }, [data, floor, search, selected])

  const groups = React.useMemo<RailGroup[]>(() => {
    const counted = new Set(floor.map((row) => `${row.bill_number}/${row.date}`))
    const all = [...floor, ...(data ?? []).filter((row) => !counted.has(`${row.bill_number}/${row.date}`))]
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
  }, [data, floor])

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
                    {row.bill_id ? (
                      <Link
                        href={`/docs/bills/${row.bill_id}`}
                        className="no-underline hover:underline"
                        title={row.title}
                      >
                        {row.bill_number}
                      </Link>
                    ) : row.href ? (
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline hover:underline"
                        title={row.title}
                      >
                        {row.bill_number}
                      </a>
                    ) : (
                      <span title={row.title}>{row.bill_number}</span>
                    )}
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
                {row.source ? ` · ${row.source}` : ""}
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
