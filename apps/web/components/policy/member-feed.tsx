"use client"

import * as React from "react"

import { fmtDate, truncate } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { RecordItem, RecordList, RecordSeal } from "@/components/policy/record-item"

// The changelog's shape, which is the right one for this: what they put their
// name to and how they voted, newest first, each entry the bill.
//
// Ten at a time. The page renders the first ten on the server; See more shows
// the next ten from what the page already holds, and when that runs out asks
// the record route for the next ten of this one list (Brendan, 2026-09-05).

export type RecordBill = {
  bill_id: number
  bill_number: string
  title: string
  status_desc?: string | null
  last_action?: string | null
  last_action_date?: string | null
  committee?: string | null
  /** The bill's chamber, which decides which seal marks its entry. */
  body?: string | null
}

export type RecordKind = "prime" | "cosponsor" | "aye" | "nay"

const PAGE = 10

export function MemberFeed({
  bills,
  empty,
  vote,
  total,
  state,
  peopleId,
  kind,
}: {
  bills: RecordBill[]
  empty: string
  vote?: "Aye" | "Nay"
  /** The whole record; the feed reveals it ten at a time. */
  total: number
  /** The member's jurisdiction, which is the bills' jurisdiction too. */
  state: string
  peopleId: number
  kind: RecordKind
}) {
  const [items, setItems] = React.useState(bills)
  const [visible, setVisible] = React.useState(PAGE)
  const [busy, setBusy] = React.useState(false)
  const [exhausted, setExhausted] = React.useState(false)

  const more = !exhausted && visible < total && !busy

  async function seeMore() {
    if (visible + PAGE <= items.length || items.length >= total) {
      setVisible((v) => v + PAGE)
      return
    }
    setBusy(true)
    try {
      const url = `/api/policy/record?state=${encodeURIComponent(state)}&id=${peopleId}&limit=${PAGE}&offset=${items.length}`
      const res = await fetch(url)
      const data = (await res.json()) as Partial<Record<RecordKind, RecordBill[]>>
      const next = data[kind] ?? []
      if (!next.length) setExhausted(true)
      setItems((prev) => {
        const seen = new Set(prev.map((b) => b.bill_id))
        return [...prev, ...next.filter((b) => !seen.has(b.bill_id))]
      })
      setVisible((v) => v + PAGE)
    } catch {
      setExhausted(true)
    } finally {
      setBusy(false)
    }
  }

  if (!items.length) {
    return <p className="py-10 text-sm text-muted-foreground">{empty}</p>
  }
  return (
    // Explicit rows rather than the .steps counter. Each entry needed three
    // things the counter cannot give it — a hover state, an arrow in its own
    // corner, and a marker that is a chamber seal rather than an ordinal — and
    // the number was never the point: which chamber a bill is in says more
    // than that it was the fourth one listed.
    //
    // This list *is* the canon, so it no longer draws the item itself: the
    // shape moved to record-item.tsx and the other five lists read it from
    // there. What stays here is what only this page knows — that the entry is a
    // bill, that the member's own page need not repeat the sponsor, and that a
    // vote tab says how they voted.
    <RecordList>
      {items.slice(0, visible).map((bill, index) => (
        <RecordItem
          key={bill.bill_id}
          href={`/docs/bills/${bill.bill_id}`}
          avatar={<RecordSeal state={state} chamber={bill.body} ordinal={index + 1} />}
          title={bill.bill_number}
          lead={bill.last_action}
          meta={[
            bill.last_action_date ? fmtDate(bill.last_action_date) : null,
            bill.status_desc || "Introduced",
            bill.committee ? `${bill.committee} Committee` : null,
            vote ? `Voted ${vote}` : null,
          ]}
          description={truncate(bill.title, 240)}
        />
      ))}
      {(more || busy) && (
        <div className="px-3 pt-3 md:px-4">
          <Button variant="outline" size="sm" onClick={seeMore} disabled={busy}>
            {busy ? "Loading…" : "See more"}
          </Button>
        </div>
      )}
    </RecordList>
  )
}
