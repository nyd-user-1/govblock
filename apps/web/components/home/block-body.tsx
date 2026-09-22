"use client"

import * as React from "react"
import Link from "next/link"

import { fmtBill, fmtDate, fmtNumber } from "@/lib/format"
import { stateName } from "@/lib/filters"
import { JURISDICTIONS_TABLE } from "@/lib/jurisdictions"
import { usePolicy } from "@/lib/policy/use-policy"
import { FlagChip } from "@/components/policy/imagery"
import { LoadingFlag } from "@/components/loading-flag"
import type { BlockSpec } from "@/lib/blocks"

// What stands inside a block (Brendan, 2026-09-22): two shapes, and nothing
// else until a third is needed. `count` is one figure with a line under it —
// the analytics tile without its chart. `list` is four rows, each an emblem, a
// name and a fact, which is the shape the roll-call cards and the bill page's
// blocks already use. A block names its table and its resource in
// lib/blocks.ts; this draws whatever comes back.

/** A block's own read. The resource and its extras come from the catalogue; a block with no resource reads nothing. */
export function useBlockData(spec: BlockSpec, state: string, session: number | null, nonce: number) {
  const key = spec.resource || null
  const { data, isLoading, locked } = usePolicy<unknown>(key, { state, session: session ? String(session) : undefined }, { ...(spec.extra ?? {}), nonce })
  return { data, loading: isLoading, locked }
}

const LINE = "flex items-center gap-2 text-sm"

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-col gap-2">{children}</div>
}

/** The figure a count block leads with, and the sentence under it. */
function Count({ value, lead }: { value: number | null; lead: string }) {
  return (
    <div className="mt-2 flex flex-col">
      <span className="text-3xl font-semibold tabular-nums">{value == null ? "—" : fmtNumber(value)}</span>
      <span className="mt-1 text-sm text-muted-foreground">{lead}</span>
    </div>
  )
}

type BillRow = { bill_id: number; bill_number: string; title: string; state: string; last_action_date?: string | null; status_desc?: string | null }
type CommitteeRow = { committee_name?: string; committee?: string; chamber: string; bills: number }
type MemberRow = { people_id: number; party: string; active?: boolean }
type SessionRow = { session_id: number; bills: number; title: string }
type Metric = { total: number; label: string }

export function BlockBody({ spec, state, session, nonce }: { spec: BlockSpec; state: string; session: number | null; nonce: number }) {
  const { data, loading, locked } = useBlockData(spec, state, session, nonce)

  // A jurisdiction the reader may not open says so rather than drawing nothing.
  if (locked) return <p className="mt-3 text-sm text-muted-foreground">{stateName(state)} is part of a plan.</p>
  if (spec.resource && loading && data === undefined) {
    return (
      <div className="mt-6 flex justify-center">
        <LoadingFlag width={28} />
      </div>
    )
  }

  switch (spec.key) {
    case "bills": {
      const payload = data as { rows?: BillRow[]; total?: number } | undefined
      const rows = payload?.rows ?? []
      return (
        <>
          <Count value={payload?.total ?? null} lead="bills this session" />
          <Rows>
            {rows.slice(0, 3).map((bill) => (
              <Link key={bill.bill_id} href={`/bills/${bill.bill_id}?state=${bill.state ?? state}`} className={`${LINE} no-underline`}>
                <FlagChip state={bill.state ?? state} width={16} />
                <span className="shrink-0 font-medium">{fmtBill(bill.bill_number, bill.state ?? state)}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{bill.title}</span>
              </Link>
            ))}
          </Rows>
        </>
      )
    }
    case "committees": {
      const rows = (data as CommitteeRow[] | undefined) ?? []
      const top = [...rows].sort((a, b) => b.bills - a.bills).slice(0, 4)
      return (
        <>
          <Count value={rows.length} lead="committees" />
          <Rows>
            {top.map((committee) => {
              const name = committee.committee_name ?? committee.committee ?? ""
              return (
                <Link key={name} href={`/bills?state=${state}&committee=${encodeURIComponent(name)}`} className={`${LINE} no-underline`}>
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{fmtNumber(committee.bills)}</span>
                </Link>
              )
            })}
          </Rows>
        </>
      )
    }
    case "members": {
      const rows = (data as MemberRow[] | undefined) ?? []
      const parties = rows.reduce<Record<string, number>>((map, m) => {
        const p = (m.party || "?").toUpperCase()
        map[p] = (map[p] ?? 0) + 1
        return map
      }, {})
      const split = Object.entries(parties)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
      return (
        <>
          <Count value={rows.length} lead="members sitting" />
          <Rows>
            {split.map(([party, n]) => (
              <div key={party} className={LINE}>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{party}</span>
                <span className="shrink-0 tabular-nums">{fmtNumber(n)}</span>
              </div>
            ))}
          </Rows>
        </>
      )
    }
    case "sessions": {
      const rows = (data as SessionRow[] | undefined) ?? []
      return (
        <>
          <Count value={rows.length} lead="sessions on file" />
          <Rows>
            {rows.slice(0, 3).map((row) => (
              <Link key={row.session_id} href={`/bills?state=${state}&session=${row.session_id}`} className={`${LINE} no-underline`}>
                <span className="min-w-0 flex-1 truncate">{row.title ?? `${row.session_id} Session`}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{fmtNumber(row.bills)}</span>
              </Link>
            ))}
          </Rows>
        </>
      )
    }
    case "jurisdictions": {
      const top = [...JURISDICTIONS_TABLE].sort((a, b) => b.bills - a.bills).slice(0, 4)
      return (
        <>
          <Count value={JURISDICTIONS_TABLE.length} lead="legislatures on file" />
          <Rows>
            {top.map((row) => (
              <Link key={row.state} href={`/bills/${row.state.toLowerCase()}`} className={`${LINE} no-underline`}>
                <FlagChip state={row.state} width={16} />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{fmtNumber(row.bills)}</span>
              </Link>
            ))}
          </Rows>
        </>
      )
    }
    default: {
      // The metric blocks: votes, amendments, actions, hearings — one figure over the session.
      const metric = data as Metric | undefined
      return <Count value={metric?.total ?? null} lead={`${spec.table.toLowerCase()} this session`} />
    }
  }
}

/** The line a tile's foot carries: what a reader would see on the page behind it. */
export function blockFoot(spec: BlockSpec, state: string) {
  return { href: spec.href(state), label: `Open ${spec.label.toLowerCase()}` }
}

export { fmtDate }
