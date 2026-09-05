"use client"

import * as React from "react"

import { fmtDate } from "@/lib/format"
import { Button } from "@govblock/ui/components/nova/button"
import { PageSizeMenu } from "@/components/policy/page-size-menu"
import { RecordItem, RecordList, RecordSeal } from "@/components/policy/record-item"

// The changelog's shape, which is the right one for this: what they put their
// name to and how they voted, newest first, each entry the bill.
//
// Paged, as the data tables are: five a page, the page size from the footer's
// menu, Previous and Next beside it (Brendan, 2026-09-05: "instead of see
// more use the prev / next as the standard per block"). The page renders the
// first page on the server; a later page comes from what the page already
// holds, or from the record route by offset.

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

/** "HR1491" → "HR 1491", as the rail prints a bill number. */
const print = (number: string) => number.replace(/^([A-Z]+)0*(\d+)$/, "$1 $2")

export function MemberFeed({
  bills,
  empty,
  vote,
  total,
  state,
  peopleId,
  session,
  kind,
  pageSize: initialSize = 5,
}: {
  bills: RecordBill[]
  empty: string
  vote?: "Aye" | "Nay"
  /** The whole record; the feed pages through it. */
  total: number
  /** The member's jurisdiction, which is the bills' jurisdiction too. */
  state: string
  peopleId: number
  /** The session the list is of, so a later page asks for the same one. */
  session: number
  kind: RecordKind
  /** How many a page holds at first. */
  pageSize?: number
}) {
  // `items` is always a prefix of the record: pages are fetched by offset
  // from its end, so any page up to its length can be cut from it.
  const [items, setItems] = React.useState(bills)
  const [pageSize, setPageSize] = React.useState(initialSize)
  const [page, setPage] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const pages = Math.max(1, Math.ceil(total / pageSize))

  async function ensure(upTo: number) {
    const need = Math.min(upTo, total)
    if (items.length >= need) return
    setBusy(true)
    try {
      const url = `/api/policy/record?state=${encodeURIComponent(state)}&session=${session}&id=${peopleId}&limit=${need - items.length}&offset=${items.length}`
      const res = await fetch(url)
      const data = (await res.json()) as Partial<Record<RecordKind, RecordBill[]>>
      const next = data[kind] ?? []
      setItems((prev) => {
        const seen = new Set(prev.map((b) => b.bill_id))
        return [...prev, ...next.filter((b) => !seen.has(b.bill_id))]
      })
    } finally {
      setBusy(false)
    }
  }

  async function go(to: number) {
    const target = Math.max(0, Math.min(to, pages - 1))
    await ensure((target + 1) * pageSize)
    setPage(target)
  }

  async function resize(n: number) {
    setPageSize(n)
    setPage(0)
    await ensure(n)
  }

  if (!items.length) {
    return <p className="py-10 text-sm text-muted-foreground">{empty}</p>
  }
  const shown = items.slice(page * pageSize, (page + 1) * pageSize)
  return (
    <>
      <RecordList className="my-0 divide-y-0">
        {shown.map((bill, index) => (
          <RecordItem
            key={bill.bill_id}
            stacked
            hover="rail"
            href={`/docs/bills/${bill.bill_id}`}
            avatar={<RecordSeal state={state} chamber={bill.body} ordinal={page * pageSize + index + 1} />}
            title={print(bill.bill_number)}
            meta={[
              bill.last_action_date ? fmtDate(bill.last_action_date) : null,
              bill.status_desc || "Introduced",
              vote ? `Voted ${vote}` : null,
            ]}
            description={bill.title}
          />
        ))}
      </RecordList>
      <div className="flex items-center justify-end space-x-2 pt-4">
        <div className="flex-1">
          <PageSizeMenu size={pageSize} total={total} onChange={resize} />
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => go(page - 1)} disabled={busy || page === 0}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => go(page + 1)} disabled={busy || page >= pages - 1}>
            Next
          </Button>
        </div>
      </div>
    </>
  )
}
