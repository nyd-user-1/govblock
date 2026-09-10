"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { stateName } from "@/lib/filters"
import { fmtDate, fmtNumber, fmtTime, truncate } from "@/lib/format"
import { useScope } from "@/lib/policy/scope"
import type { Hearing } from "@/lib/policy/types"
import { hearingWhen } from "@/lib/policy/hearing-when"
import { AddToCalendar } from "@/components/connectors/add-to-calendar"
import { ExportToSheet } from "@/components/connectors/export-to-sheet"
import { usePolicy } from "@/lib/policy/use-policy"
import { readSort, sortRows } from "@/lib/workspace/sort"
import { useUrlParams, writeUrlParams } from "@/lib/policy/url-state"
import type { Look } from "@/components/create/folder-view"
import { WorkspaceGrid, type GridItem } from "@/components/workspace/grid"
import { DropdownMenuItem } from "@govblock/ui/components/dropdown-menu"
import { ChamberSeal } from "@/components/policy/imagery"
import { RailAndCards, type RailGroup } from "@/components/policy/rail-and-cards"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"

// Calendar — the fourth instance of the rail-and-cards shell. Rail = the
// committees that have calendared something; cards = what they calendared,
// on the standard workspace grid, or the standard table (Brendan, 2026-09-07).

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
  const router = useRouter()
  const [selected, setSelected] = React.useState(ALL)
  const [search, setSearch] = React.useState("")
  // Card or table, as /workspace/data reads it: `look=table` on the URL, cards
  // otherwise (Brendan, 2026-09-07: the adopted card and table, not our own).
  // The footer's Filter chip orders the rows through `sort`.
  const { look: lookParam, sort: sortParam } = useUrlParams(["look", "sort"] as const)
  const look: Look = lookParam === "table" ? "table" : "cards"
  const sort = readSort(sortParam)

  // hearings-recent falls back to the 60 days before the jurisdiction's last
  // hearing when the window around today is empty, which it is for most of the
  // 52 between sessions, and reports the date it runs through.
  const { data, isLoading } = usePolicy<{ rows: Hearing[]; through: string | null }>("hearings-recent", { state, session: filters.session, committee: filters.committee }, { from: iso(-30), to: iso(90), limit: 3000 })
  const through = data?.through ?? null

  const rows = React.useMemo(() => {
    const all = data?.rows ?? []
    const query = search.trim().toLowerCase()
    const shown = all
      .filter((hearing) => {
        if (selected !== ALL && (hearing.committee ?? "") !== selected) return false
        if (!query) return true
        return (hearing.description ?? "").toLowerCase().includes(query) || hearing.bill_number.toLowerCase().includes(query) || (hearing.title ?? "").toLowerCase().includes(query)
      })
      .slice(0, 60)
    return sortRows(shown, sort, { name: (h) => h.bill_number || h.title || "", kind: (h) => h.committee ?? "", time: (h) => `${h.date} ${h.time ?? ""}` })
  }, [data, search, selected, sort])

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
        items: [{ value: ALL, label: "Everything calendared", hint: String(all.length) }, ...[...byCommittee.entries()].sort((a, b) => b[1] - a[1]).map(([committee, count]) => ({ value: committee, label: committee, hint: String(count) }))],
      },
    ]
  }, [data])

  const whenOf = (hearing: Hearing) => `${fmtDate(hearing.date, false)}${hearing.time ? ` · ${fmtTime(hearing.time)}` : ""}`
  const href = (hearing: Hearing) => `/bills/${hearing.bill_id}`

  // The cards: the standard workspace grid, a hearing per card — the chamber's
  // seal, the bill, what it is about, when and where. The card opens the bill.
  const items = React.useMemo<GridItem[]>(
    () =>
      rows.map((hearing, index) => ({
        key: `hearing-${hearing.bill_id}-${hearing.date}-${index}`,
        group: hearing.committee ?? undefined,
        media: <ChamberSeal state={state} chamber={hearing.chamber ?? hearing.body} size={96} />,
        title: hearing.bill_number || hearing.title || "Hearing",
        description: truncate(hearing.title || hearing.description || "", 90),
        meta: `${whenOf(hearing)}${hearing.location ? ` · ${truncate(hearing.location, 28)}` : ""}`,
        onOpen: () => router.push(href(hearing)),
        menu: (
          <>
            <DropdownMenuItem onClick={() => router.push(href(hearing))}>Open the bill</DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(href(hearing), "_blank")}>Open in a new tab</DropdownMenuItem>
          </>
        ),
      })),
    [rows, state, router]
  )

  const empty = !rows.length && <p className="py-10 text-center text-sm text-muted-foreground">{isLoading ? "Loading…" : `Nothing calendared for ${stateName(state)}${search ? ` matching “${search}”` : ""}.`}</p>

  return (
    <RailAndCards
      defaultOpen={false}
      groups={groups}
      selected={selected}
      onSelect={(value) => setSelected((current) => (current === value ? ALL : value))}
      search={search}
      onSearch={setSearch}
      searchPlaceholder="Search the calendar…"
      className="block p-0"
      actions={
        // Card | Table, as every workspace listing reads it.
        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          {(["cards", "table"] as Look[]).map((value) => (
            <button
              key={value}
              type="button"
              data-active={look === value}
              aria-pressed={look === value}
              onClick={() => writeUrlParams({ look: value === "table" ? "table" : null }, { history: "push" })}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-sm"
            >
              {value === "table" ? "Table" : "Card"}
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
      {look === "table" ? (
        // The standard table, as /workspace/data?look=table draws it.
        <div className="m-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Hearing</TableHead>
                <TableHead>Committee</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="hidden lg:table-cell">Where</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((hearing, index) => (
                <TableRow key={`${hearing.bill_id}-${hearing.date}-${index}`} className="group/row cursor-pointer" onClick={() => router.push(href(hearing))}>
                  <TableCell className="max-w-0">
                    <span className="flex items-center gap-2.5 font-medium">
                      <ChamberSeal state={state} chamber={hearing.chamber ?? hearing.body} size={22} />
                      <span className="truncate group-hover/row:text-primary group-hover/row:underline" title={hearing.title}>
                        {hearing.bill_number || "Hearing"}
                        {hearing.title && <span className="font-normal text-muted-foreground"> · {hearing.title}</span>}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-0">
                    <span className="block truncate text-muted-foreground" title={hearing.committee ?? undefined}>
                      {hearing.committee ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{whenOf(hearing)}</TableCell>
                  <TableCell className="hidden max-w-0 lg:table-cell">
                    <span className="block truncate text-muted-foreground" title={hearing.location ?? undefined}>
                      {hearing.location ?? ""}
                    </span>
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <AddToCalendar className="-my-1" summary={hearingSummary(hearing)} description={hearingDescription(hearing)} when={hearingWhen(hearing.date, hearing.time, state)} url={href(hearing)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {empty}
        </div>
      ) : (
        <>
          <WorkspaceGrid storageKey="govblock:workspace:calendar:layout" items={items} keepOrder={!!sort} />
          {empty}
        </>
      )}
    </RailAndCards>
  )
}
