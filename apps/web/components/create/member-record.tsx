"use client"

import * as React from "react"
import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"

import { partyName, stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, honorific, truncate } from "@/lib/format"
import { PARTY_BLUE, PARTY_OTHER, PARTY_RED } from "@/lib/imagery"
import { portraitFor } from "@/lib/imagery"
import type { Scope } from "@/lib/policy/scope"
import type { BillRow, Member } from "@/lib/policy/types"
import { policyUrl, useSnapshot } from "@/lib/policy/use-policy"
import { MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"

// A member's Record, in the dashboard's shape: the tiles, a chart, a table.
// Brendan, 2026-09-03: "the data shape for member bills and member votes maps
// fairly well to the current design used for the dashboard." The rows are
// the ones the member page already reads — what they sponsored this session
// and how they voted — under the finance page's rhythm.

type Record = {
  sponsored: (BillRow & { role: number })[]
  aye: (BillRow & { vote_desc: string; vote_date: string })[]
  nay: (BillRow & { vote_desc: string; vote_date: string })[]
  counts: { sponsored: number; aye: number; nay: number }
  limit: number
}

const chartConfig = { count: { label: "Bills" } } satisfies ChartConfig
const COLOR = { sponsored: PARTY_OTHER, aye: PARTY_BLUE, nay: PARTY_RED }

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint && <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>}
    </Card>
  )
}

export function MemberRecord({ id, scope, label }: { id: number; scope: Scope; label: string }) {
  const { state, session, resolved } = scope
  const sessionParam = session ? String(session) : undefined
  const { data: member } = useSnapshot<Member>(resolved ? policyUrl("member", { state, session: sessionParam }, { id }) : null)
  const { data: record, isLoading } = useSnapshot<Record>(resolved ? policyUrl("record", { state, session: sessionParam }, { id, limit: 100 }) : null)
  const [tab, setTab] = React.useState<"sponsored" | "aye" | "nay">("sponsored")

  const counts = record?.counts ?? { sponsored: 0, aye: 0, nay: 0 }
  const series = [
    { key: "sponsored", label: "Sponsored", count: counts.sponsored },
    { key: "aye", label: "Voted aye", count: counts.aye },
    { key: "nay", label: "Voted nay", count: counts.nay },
  ]
  const rows = record ? record[tab] : []
  const name = member ? `${honorific(member.role, member.chamber)} ${member.name}` : label

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex items-start gap-4">
          {member ? (
            <span className="relative">
              <MemberPortrait name={member.name} photoUrl={portraitFor(member)} state={state} chamber={member.chamber} size={56} />
              <PartyDot party={member.party} serving className="absolute right-0 bottom-0 size-3 ring-2 ring-background" />
            </span>
          ) : (
            <Skeleton className="size-14 rounded-full" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-xl font-semibold">{name} — Record</h2>
            <p className="text-sm text-muted-foreground">
              {member ? [member.chamber, member.district ? member.district.replace(/^[A-Z]+-0*/, "District ") : null, partyName(member.party), member.leadership_title].filter(Boolean).join(" · ") : stateName(state)}
              {session ? ` · ${session} session` : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Bills sponsored" value={isLoading ? "…" : fmtNumber(counts.sponsored)} hint={member ? `${fmtNumber(member.prime)} as prime sponsor` : undefined} />
          <Tile label="Voted aye" value={isLoading ? "…" : fmtNumber(counts.aye)} hint="distinct bills" />
          <Tile label="Voted nay" value={isLoading ? "…" : fmtNumber(counts.nay)} hint="distinct bills" />
          <Tile label="Votes cast" value={isLoading ? "…" : fmtNumber(counts.aye + counts.nay)} hint={counts.aye + counts.nay ? `${Math.round((counts.aye / Math.max(1, counts.aye + counts.nay)) * 100)}% aye` : undefined} />
        </div>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Bills by the member&apos;s part in them</CardTitle>
            <CardDescription>Sponsored, voted for, voted against — this session, in {stateName(state)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-40 w-full">
              <BarChart data={series} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={88} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" radius={4}>
                  {series.map((row) => (
                    <Cell key={row.key} fill={COLOR[row.key as keyof typeof COLOR]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Bills</CardTitle>
            <CardDescription>
              {fmtNumber(rows.length)} shown of {fmtNumber(counts[tab])}
              {record && counts[tab] > record.limit ? ` · the most recent ${record.limit}` : ""}
            </CardDescription>
            <div className="flex gap-1 pt-2">
              {series.map((row) => (
                <button key={row.key} type="button" data-active={tab === row.key} className="rounded-full border px-3 py-1 text-xs data-[active=true]:bg-foreground data-[active=true]:text-background" onClick={() => setTab(row.key as typeof tab)}>
                  {row.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead className="hidden md:table-cell">Committee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">{tab === "sponsored" ? "Last action" : "Vote"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${tab}-${row.bill_id}`}>
                    <TableCell className="max-w-96">
                      <a href={`/docs/bills/${row.bill_id}?state=${state}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        {row.bill_number}
                      </a>
                      <span className="block truncate text-xs text-muted-foreground">{truncate(row.title, 90)}</span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{row.committee ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {row.status_desc ?? "Introduced"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {"vote_date" in row ? `${row.vote_desc === "Yea" ? "Aye" : "Nay"} · ${fmtDate(row.vote_date, false)}` : row.last_action_date ? fmtDate(row.last_action_date) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      {isLoading ? "Loading…" : "Nothing on file."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
