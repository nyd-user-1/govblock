"use client"

import * as React from "react"

import { useScope } from "@/lib/policy/scope"
import type { Bill, BillRow } from "@/lib/policy/types"
import { usePolicy } from "@/lib/policy/use-policy"
import { BillCongressProvider, BillSponsorsBlock, BillTextBlock, BillVotesBlock } from "@/components/policy/bill-congress"
import { BillActionsBlock, BillDepthProvider, BillSubjects, BillTracker } from "@/components/policy/bill-depth"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"

// The /docs bill page's blocks, on the canvas (Brendan, 2026-09-07): the
// text, the tracker, the sponsors, the actions, the votes, the subjects —
// real components, each demoed on the newest bill of the jurisdiction and
// year in scope, the way an accordion demo shows some accordion. One
// provider pair around the grid, so the federal reads happen once.

type Demo = { bill: Bill; number: string; chamber: string | null; text: string | null; held: number | null } | null

const DemoBillContext = React.createContext<Demo>(null)

export function DemoBillProvider({ children }: { children: React.ReactNode }) {
  const scope = useScope()
  const { data: list } = usePolicy<{ rows: BillRow[] }>(scope.resolved ? "bills" : null, { state: scope.state, session: scope.filters.session }, { limit: 1 })
  const id = list?.rows[0]?.bill_id
  const { data: bill } = usePolicy<Bill>(id ? "bill" : null, { state: scope.state }, { id })
  const held = bill?.texts?.[0]?.document_id ?? null
  const { data: textData } = usePolicy<{ text?: string | null }>(bill && held ? "text" : null, { state: scope.state }, { id: bill?.bill_id, document: held ?? undefined })
  const sample = React.useMemo<Demo>(() => (bill ? { bill, number: bill.bill_number, chamber: bill.body ?? null, text: textData?.text ?? null, held } : null), [bill, textData, held])

  if (!sample) return <DemoBillContext.Provider value={null}>{children}</DemoBillContext.Provider>
  return (
    <DemoBillContext.Provider value={sample}>
      <BillCongressProvider billId={sample.bill.bill_id} billNumber={sample.bill.bill_number} state={sample.bill.state}>
        <BillDepthProvider billId={sample.bill.bill_id} state={sample.bill.state}>{children}</BillDepthProvider>
      </BillCongressProvider>
    </DemoBillContext.Provider>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[min(var(--radius-4xl),24px)] border bg-card p-4 [&_hr]:hidden [&_h2]:hidden [&_h3]:hidden">{children}</div>
}

function Pending() {
  return (
    <Frame>
      <Skeleton className="h-5 w-1/3 rounded-lg" />
      <Skeleton className="mt-4 h-24 rounded-xl" />
    </Frame>
  )
}

export function BillTextCard() {
  const s = React.useContext(DemoBillContext)
  if (!s) return <Pending />
  return (
    <Frame>
      <BillTextBlock bill={s.number} billNumber={s.bill.bill_number} state={s.bill.state} chamber={s.chamber} held={s.held} text={s.text} texts={s.bill.texts} source={null} />
    </Frame>
  )
}

export function BillTrackerCard() {
  const s = React.useContext(DemoBillContext)
  if (!s) return <Pending />
  return (
    <Frame>
      <BillTracker framed />
    </Frame>
  )
}

export function BillSponsorsCard() {
  const s = React.useContext(DemoBillContext)
  if (!s) return <Pending />
  return (
    <Frame>
      <BillSponsorsBlock sponsors={s.bill.sponsors} state={s.bill.state} bill={s.number} />
    </Frame>
  )
}

export function BillActionsCard() {
  const s = React.useContext(DemoBillContext)
  if (!s) return <Pending />
  return (
    <Frame>
      <BillActionsBlock history={s.bill.history} rollCalls={s.bill.rollCalls} bill={s.number} />
    </Frame>
  )
}

export function BillVotesCard() {
  const s = React.useContext(DemoBillContext)
  if (!s) return <Pending />
  return (
    <Frame>
      <BillVotesBlock rollCalls={s.bill.rollCalls} bill={s.number} billNumber={s.bill.bill_number} state={s.bill.state} />
    </Frame>
  )
}

export function BillSubjectsCard() {
  const s = React.useContext(DemoBillContext)
  if (!s) return <Pending />
  return (
    <Frame>
      <BillSubjects bill={s.number} chamber={s.chamber} state={s.bill.state} />
    </Frame>
  )
}
