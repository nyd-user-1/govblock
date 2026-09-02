"use client"

import * as React from "react"

import { useCongress, useCongressRecord } from "@/lib/policy/use-congress"
import { cn } from "@govblock/ui/lib/utils"

// The depth congress.gov shows on a bill and we did not: where the bill got to,
// every action with the stage and the roll call it produced, the committees that
// touched it, what it is about, what it costs, and who wrote it.
//
// A section of the page in the page's own voice — an H2, a Table or a list, and
// an honest sentence when we have nothing. Every one of these renders when empty
// and says what *we* lack, never what the bill lacks.

export type Action = {
  actionDate?: string | null
  actionTime?: string | null
  text?: string | null
  type?: string | null
  actionCode?: string | null
  sourceSystem?: { code?: string | null; name?: string | null } | null
  committees?: { systemCode?: string | null; name?: string | null }[]
  recordedVotes?: {
    rollNumber?: string | null
    chamber?: string | null
    url?: string | null
    sessionNumber?: string | null
    date?: string | null
  }[]
}

export type BillRecord = {
  type?: string
  number?: string
  title?: string
  displayTitle?: string | null
  popularTitle?: string | null
  originChamber?: string | null
  introducedDate?: string | null
  constitutionalAuthorityStatementText?: string | null
  sponsors?: {
    bioguideId?: string | null
    fullName?: string | null
    party?: string | null
    state?: string | null
    district?: string | null
    isByRequest?: string | null
  }[]
  sponsorPeopleId?: number | null
  laws?: { type?: string | null; number?: string | null }[]
}

type Depth = {
  billId: number
  onCongress: boolean
  actions: Action[]
  actionTotal: number
  record: BillRecord | null
}

const Ctx = React.createContext<Depth | null>(null)
const use = () => React.useContext(Ctx)

export function BillDepthProvider({
  billId,
  state,
  children,
}: {
  billId: number
  state: string
  children: React.ReactNode
}) {
  const bill = String(billId)
  const scope = React.useMemo(() => ({ param: "bill", value: bill }), [bill])

  const actions = useCongress<Action>("actions", "actions", scope, { bill, limit: 500 }, undefined, state)
  // One row rather than a family. The scope is still checked: an answer that
  // does not name this bill is not this bill's record, whatever it holds.
  const record = useCongressRecord<{ bill?: number; record?: BillRecord | null }>(
    "bill-record",
    { bill },
    (answer) => String(answer?.bill ?? "") === bill && !!answer?.record,
    state
  )

  const value = React.useMemo<Depth>(
    () => ({
      billId,
      onCongress: actions.onCongress,
      actions: actions.rows,
      actionTotal: actions.count,
      record: record?.record ?? null,
    }),
    [billId, actions.onCongress, actions.rows, actions.count, record]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---- the tracker ---------------------------------------------------------- */

/**
 * congress.gov's Status of Legislation, derived the way congress.gov derives
 * it: from the Library of Congress action codes, which are the numeric ones on
 * actions whose `sourceSystem` is the Library itself. The chamber codes
 * (H37100, H8D000…) describe procedure; these describe *stage*, which is why
 * they and not the text are the mapping.
 *
 *   1000 · 1025   Introduced in House      →  Introduced
 *   10000 · 10025 Introduced in Senate     →  Introduced
 *   8000          Passed/agreed to in House →  Passed House
 *   17000         Passed/agreed to in Senate → Passed Senate
 *   28000 · E20000 Presented to President   →  To President
 *   36000 · E40000 Became Public/Private Law → Became Law
 *
 * Resolving Differences and Vetoed have no single code and are taken from the
 * action's `type`, which BILLSTATUS publishes for every action.
 */
const STAGE_BY_CODE: Record<string, string> = {
  "1000": "Introduced",
  "1025": "Introduced",
  "10000": "Introduced",
  "10025": "Introduced",
  "8000": "Passed House",
  "17000": "Passed Senate",
  "28000": "To President",
  E20000: "To President",
  "36000": "Became Law",
  E40000: "Became Law",
}
const STAGE_BY_TYPE: Record<string, string> = {
  ResolvingDifferences: "Resolving Differences",
  Veto: "Vetoed",
}

// Which steps a measure can reach at all. A simple resolution never leaves its
// own chamber, and drawing it four steps it can never take would be a lie about
// the bill rather than about us.
const HOUSE = "Passed House"
const SENATE = "Passed Senate"
const REST = ["Resolving Differences", "To President", "Became Law"]
function ladder(type: string | null | undefined, origin: string | null | undefined) {
  const t = String(type ?? "").toUpperCase()
  const senateFirst = /^S/.test(t) || String(origin ?? "").toLowerCase().startsWith("senate")
  const chambers = senateFirst ? [SENATE, HOUSE] : [HOUSE, SENATE]
  if (t === "HRES") return ["Introduced", HOUSE]
  if (t === "SRES") return ["Introduced", SENATE]
  if (t === "HCONRES" || t === "SCONRES") return ["Introduced", ...chambers]
  return ["Introduced", ...chambers, ...REST]
}

const day = (value: unknown) => (value ? String(value).slice(0, 10) : "")

export function BillTracker() {
  const c = use()
  const steps = React.useMemo(() => {
    if (!c) return []
    const reached = new Map<string, string>()
    for (const a of c.actions) {
      const stage = STAGE_BY_CODE[String(a.actionCode ?? "")] ?? STAGE_BY_TYPE[String(a.type ?? "")]
      if (!stage) continue
      const when = day(a.actionDate)
      // Oldest wins: the day a bill first reached a stage is the day it reached
      // it, and BILLSTATUS lists actions newest first.
      const held = reached.get(stage)
      if (!held || (when && when < held)) reached.set(stage, when)
    }
    const rungs = ladder(c.record?.type, c.record?.originChamber)
    const last = rungs.map((r) => reached.has(r)).lastIndexOf(true)
    return rungs.map((title, i) => ({ title, date: reached.get(title) ?? null, done: i <= last && last >= 0 }))
  }, [c])

  if (!c?.onCongress) return null
  if (!steps.length || !c.actions.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Progress not harvested for this bill yet.
      </p>
    )
  }
  const current = steps.filter((s) => s.done).at(-1)

  return (
    <div className="not-typeset mt-6" aria-label="Status of legislation">
      <ol className="flex flex-wrap items-stretch gap-1">
        {steps.map((step) => (
          <li key={step.title} className="min-w-28 flex-1">
            <div
              className={cn(
                "h-1 rounded-full",
                step.done ? "bg-foreground" : "bg-border"
              )}
            />
            <div className="mt-2 flex flex-col gap-0.5 pr-2">
              <span
                className={cn(
                  "text-xs leading-tight font-medium",
                  step.done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
              {step.date && (
                <span className="text-xs text-muted-foreground tabular-nums">{step.date}</span>
              )}
            </div>
          </li>
        ))}
      </ol>
      {current && (
        <p className="mt-3 text-sm text-muted-foreground">
          This bill has the status <strong className="text-foreground">{current.title}</strong>.
        </p>
      )}
    </div>
  )
}
