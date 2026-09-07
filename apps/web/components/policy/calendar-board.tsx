"use client"

import * as React from "react"
import Link from "next/link"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, fmtTime, truncate } from "@/lib/format"
import { useScope } from "@/lib/policy/scope"
import type { Hearing } from "@/lib/policy/types"
import { hearingWhen } from "@/lib/policy/hearing-when"
import { AddToCalendar } from "@/components/connectors/add-to-calendar"
import { ExportToSheet } from "@/components/connectors/export-to-sheet"
import { usePolicy } from "@/lib/policy/use-policy"
import { ChamberSeal } from "@/components/policy/imagery"
import { RailAndCards, type RailGroup } from "@/components/policy/rail-and-cards"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"

// Calendar — the fourth instance of the rail-and-cards shell. Rail = the
// committees that have calendared something; cards = what they calendared.

const ALL = "__all__"
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 864e5).toISOString().slice(0, 10)

// What the event says on the reader's own calendar. The committee and the bill
// are the two things that identify a hearing to someone looking at next
// Tuesday, so they lead; the bill's title is the body, and the link comes back
// here.
export function hearingSummary(hearing: Hearing) {
  const what = (hearing.description || "").trim() || `${hearing.committee ?? ""} hearing`.trim() || "Hearing"
  return hearing.bill_number ? `${what} · ${hearing.bill_number}` : what
}

export function hearingDescription(hearing: Hearing) {
  return [hearing.title || null, hearing.location ? `Location: ${hearing.location}` : null, hearing.committee ? `Committee: ${hearing.committee}` : null].filter(Boolean).join("\n\n")
}

export function CalendarBoard() {
  // The rail's scope: the jurisdiction, the session, and the committee if one
  // was chosen — the calendar is a committee's before it is anything else.
  const { state, session, filters } = useScope()
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")
  // Card or list (Brendan, 2026-09-07: "make sure it has the card view and the list view"). Cards are the default.
  const [look, setLook] = React.useState<"cards" | "list">("cards")

  // hearings-recent falls back to the 60 days before the jurisdiction's last
  // hearing when the window around today is empty, which it is for most of the
  // 52 between sessions, and reports the date it runs through.
  const { data, isLoading } = usePolicy<{ rows: Hearing[]; through: string | null }>(
    "hearings-recent",
    { state, session: filters.session, committee: filters.committee },
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
        if (selected !== ALL && (hearing.committee ?? "") !== selected) return false
        if (!query) return true
        return (hearing.description ?? "").toLowerCase().includes(query) || hearing.bill_number.toLowerCase().includes(query) || (hearing.title ?? "").toLowerCase().includes(query)
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
      onSelect={(value) => setSelected((current) => (current === value ? ALL : value))}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search the calendar…"
      className={look === "list" ? "block p-0" : undefined}
      actions={
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(["cards", "list"] as const).map((value) => (
            <button
              key={value}
              type="button"
              data-active={look === value}
              aria-pressed={look === value}
              onClick={() => setLook(value)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm"
            >
              {value === "cards" ? "Card" : "List"}
            </button>
          ))}
        </div>
      }
      header={
        <>
          <span className="text-sm font-medium">{stateName(state)} calendar</span>
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
          {/* The rows as filtered, not the whole table: what leaves with the
              reader is what they are looking at. */}
          {rows.length > 0 && (
            <ExportToSheet
              className="ml-auto"
              name={`${stateName(state)} calendar — ${session} session`}
              rows={() => [
                ["Date", "Time", "Committee", "Chamber", "Bill", "Title", "Location", "Description"],
                ...rows.map((hearing) => [hearing.date, hearing.time ?? "", hearing.committee ?? "", hearing.chamber ?? hearing.body ?? "", hearing.bill_number ?? "", hearing.title ?? "", hearing.location ?? "", hearing.description ?? ""]),
              ]}
            />
          )}
        </>
      }
    >
      {look === "list" && rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="w-28">Date</TableHead>
              <TableHead className="w-20">Time</TableHead>
              <TableHead>Committee</TableHead>
              <TableHead className="w-24">Bill</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden lg:table-cell">Location</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((hearing, index) => (
              <TableRow key={`${hearing.bill_id}-${index}`}>
                <TableCell className="whitespace-nowrap">{fmtDate(hearing.date, false)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{hearing.time ? fmtTime(hearing.time) : "—"}</TableCell>
                <TableCell className="max-w-56 truncate" title={hearing.committee ?? undefined}>
                  {hearing.committee ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Link href={`/docs/bills/${hearing.bill_id}`} className="font-medium no-underline hover:underline" title={hearing.title}>
                    {hearing.bill_number}
                  </Link>
                </TableCell>
                <TableCell className="max-w-96 truncate" title={hearing.title}>
                  {hearing.title ?? ""}
                </TableCell>
                <TableCell className="hidden max-w-56 truncate text-muted-foreground lg:table-cell" title={hearing.location ?? undefined}>
                  {hearing.location ?? ""}
                </TableCell>
                <TableCell>
                  <AddToCalendar className="-my-1" summary={hearingSummary(hearing)} description={hearingDescription(hearing)} when={hearingWhen(hearing.date, hearing.time, state)} url={`/docs/bills/${hearing.bill_id}`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {look === "cards" &&
        rows.map((hearing, index) => (
          <Card key={`${hearing.bill_id}-${index}`} size="sm">
            <CardHeader>
              <div className="flex items-start gap-3">
                <ChamberSeal state={state} chamber={hearing.chamber ?? hearing.body} size={36} />
                <div className="flex min-w-0 flex-col">
                  <CardTitle className="truncate">
                    <Link href={`/docs/bills/${hearing.bill_id}`} className="no-underline hover:underline" title={hearing.title}>
                      {hearing.bill_number}
                    </Link>
                  </CardTitle>
                  <CardDescription>{truncate(hearing.description ?? "", 42)}</CardDescription>
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
              <AddToCalendar className="mt-1 -ml-1.5 self-start" summary={hearingSummary(hearing)} description={hearingDescription(hearing)} when={hearingWhen(hearing.date, hearing.time, state)} url={`/docs/bills/${hearing.bill_id}`} />
            </CardContent>
          </Card>
        ))}
      {!rows.length && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">{isLoading ? "Loading…" : `Nothing calendared for ${stateName(state)}${search ? ` matching “${search}”` : ""}.`}</p>}
    </RailAndCards>
  )
}
