"use client"

import * as React from "react"

import { Button } from "@govblock/ui/components/nova/button"
import { PageSizeMenu } from "@/components/policy/page-size-menu"
import { RecordList } from "@/components/policy/record-item"

// The paged list every block on a detail page shares: rows drawn from what the
// page already holds, the footer's "Show 5 of N rows" menu on the left and
// Previous and Next on the right, as the member page's Bills and Votes have
// them (Brendan, 2026-09-05). A block whose record is longer than the page
// loaded hands in `more`, and a page past the end asks it by offset.

export function PagedList<T>({
  items: initial,
  total,
  render,
  more,
  pageSize: initialSize = 5,
  empty,
  menu,
  grid = false,
}: {
  /** A prefix of the whole record, newest first. */
  items: T[]
  /** The whole record's size; the list pages through it. */
  total?: number
  render: (item: T, index: number) => React.ReactNode
  /** Fetches the next rows by offset when the page holds too few. */
  more?: (offset: number, limit: number) => Promise<T[]>
  pageSize?: number
  empty?: React.ReactNode
  /** What sits above the list at the right: a block's own control. */
  menu?: React.ReactNode
  /** Two cards to a row, shadcn's registry grid, instead of the record list. */
  grid?: boolean
}) {
  const [items, setItems] = React.useState(initial)
  const [pageSize, setPageSize] = React.useState(initialSize)
  const [page, setPage] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const count = Math.max(total ?? 0, items.length)
  const pages = Math.max(1, Math.ceil(count / pageSize))

  async function ensure(upTo: number) {
    const need = Math.min(upTo, count)
    if (items.length >= need || !more) return
    setBusy(true)
    try {
      const next = await more(items.length, need - items.length)
      setItems((prev) => [...prev, ...next])
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
    return <p className="py-10 text-sm text-muted-foreground">{empty ?? "Nothing on file."}</p>
  }
  const shown = items.slice(page * pageSize, (page + 1) * pageSize)
  return (
    <>
      {menu && <div className="flex items-center pb-4">{menu}</div>}
      {grid ? (
        <div className="grid gap-4 sm:grid-cols-2">{shown.map((item, i) => render(item, page * pageSize + i))}</div>
      ) : (
        <RecordList className="my-0 divide-y-0">{shown.map((item, i) => render(item, page * pageSize + i))}</RecordList>
      )}
      <div className="flex items-center justify-end space-x-2 pt-4">
        <div className="flex-1">
          <PageSizeMenu size={pageSize} total={count} onChange={resize} />
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
