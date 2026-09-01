"use client"

import * as React from "react"

import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { fmtNumber } from "@/lib/format"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { SubjectPicker } from "@/components/subject-picker"
import { Button } from "@govblock/ui/components/button"
import { CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { Progress } from "@govblock/ui/components/progress"

// Bills — where this session's bills stand. Every status is a link into the
// bill list filtered to it.
type Option = { value: string; count: number }

export function BillsCard() {
  const { data: options, state, session, congress } = useScoped<{ statuses: Option[]; sessions: { session_id: number }[] }>(
    "options",
    null as unknown as { statuses: Option[]; sessions: { session_id: number }[] }
  )
  const { data: bills } = useScoped<{ total: number }>("bills", null as unknown as { total: number }, { limit: 1 })
  const { total, rows } = React.useMemo(() => {
    if (!options) return congress ? F.bills : { total: 0, rows: [] }
    return {
      total: bills?.total ?? options.statuses.reduce((sum, r) => sum + r.count, 0),
      rows: options.statuses.slice(0, 5).map((r) => ({ label: r.value, bills: r.count })),
    }
  }, [options, bills, congress])

  // The picker listed Congress's sessions whatever the scope. Take them from
  // the jurisdiction's own ledger, and label the current one from the scope.
  const sessions = React.useMemo(
    () =>
      options?.sessions
        ? options.sessions.slice(1, 8).map((row) => String(row.session_id))
        : congress
          ? F.sessions.slice(1).map((row) => row.label.slice(0, 9))
          : [],
    [options, congress]
  )
  return (
    <CardFrame id="bills-status">
      <CardHeader>
        <CardTitle>Bills</CardTitle>
        <CardDescription>{fmtNumber(total)} bills this session</CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 **:data-[slot=progress-indicator]:bg-chart-2">
        {rows.map((row) => (
          <Link
            key={row.label}
            href={`/docs/bills?state=${state}&status=${encodeURIComponent(row.label)}`}
            className="flex flex-col gap-1.5 no-underline"
          >
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">{row.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{fmtNumber(row.bills)}</span>
            </span>
            <Progress value={(row.bills / total) * 100} aria-label={row.label} />
          </Link>
        ))}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <SubjectPicker label="Session" allLabel={session ? String(session) : "Session"} items={sessions} />
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/docs/bills?state=${state}`} />}>
          All bills
        </Button>
      </CardFooter>
    </CardFrame>
  )
}
