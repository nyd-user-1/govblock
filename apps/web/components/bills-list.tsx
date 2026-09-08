"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { usePolicy } from "@/lib/policy/use-policy"
import { stateName } from "@/lib/filters"
import { fmtBill, fmtDate, truncate } from "@/lib/format"
import { matchesQuery } from "@/lib/search-match"
import { SearchDirectory } from "@/components/directory-search"
import { ListPager, PAGE_SIZE, pageCount } from "@/components/list-pager"
import { RecordItem, RecordList, RecordSeal } from "@/components/policy/record-item"

// Ported from livingston-v3 components/bills-list.tsx, and as of 2026-09-02 no
// longer drawing its own item: it renders the canon (`record-item.tsx`), the
// same shape the member page's Record list has.
//
// What changed with it, all of it Brendan's: row 1 is the number and the
// *latest action* rather than the title; the meta line reads date · status ·
// committee · sponsor, in that order, with the sponsor appended because this is
// not one member's own page; the title moves down to the description, where it
// can use the width; and the Text button is gone — the bill page this item
// already links to carries the text timeline.
//
// Fifty to a page, paged on the server: the route answers `limit` and `offset`
// and the total, so a jurisdiction's whole session is reachable.
//
// Typing does not filter that page — it searches the session. The field used to
// run `includes(query)` over the fifty rows in hand, which meant "hr 119"
// answered "No bills for Congress matching 'hr 119'" while ⌘K on the same word
// found the bills at once: the space was in the query and not in the number,
// and page two onwards was never looked at (Brendan, 2026-09-08). It now asks
// /api/policy/search, the route the whole site searches through, scoped to the
// jurisdiction. The old filter stays as what is on screen while that answer is
// in flight, matching the same way the route does.


type Bill = (typeof F.recentBills)[number] & { sponsor?: string | null; last_action?: string | null }

export function BillsList() {
  const [page, setPage] = React.useState(1)
  const { data, state, session, resolved } = useScoped<{ rows: Bill[]; total: number }>(
    "bills",
    { rows: F.recentBills, total: F.recentBills.length },
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }
  )
  const [query, setQuery] = React.useState("")
  const [typed, setTyped] = React.useState("")
  React.useEffect(() => setPage(1), [state])

  React.useEffect(() => {
    const handle = setTimeout(() => setTyped(query.trim()), 250)
    return () => clearTimeout(handle)
  }, [query])

  const searching = query.trim().length >= 2
  const { data: found } = usePolicy<{ bills: Bill[] }>(
    resolved && typed.length >= 2 ? "search" : null,
    { state, session: session ? String(session) : undefined },
    { q: typed, limit: 20 }
  )

  const rows = React.useMemo(() => data?.rows ?? [], [data])
  const here = React.useMemo(
    () => (searching ? rows.filter((bill) => matchesQuery(query, bill.bill_number, bill.title, bill.committee, bill.sponsor)) : rows),
    [rows, query, searching]
  )
  // The session's answer once it lands; the page in hand until then, so a
  // keystroke never blanks the list.
  const bills = searching ? (typed === query.trim() && found ? found.bills : here) : rows
  const pages = pageCount(data?.total ?? 0)
  const current = Math.min(page, pages)

  return (
    <>
      <SearchDirectory
        query={query}
        setQuery={(value) => setQuery(value ?? "")}
        placeholder={`Search ${stateName(state)} bills by number, title, committee or sponsor…`}
      />
      <RecordList>
        {bills.map((bill, index) => (
          <RecordItem
            key={bill.bill_id}
            href={`/docs/bills/${bill.bill_id}`}
            avatar={<RecordSeal state={state} chamber={bill.body} ordinal={searching ? index + 1 : (current - 1) * PAGE_SIZE + index + 1} />}
            title={fmtBill(bill.bill_number, state)}
            lead={bill.last_action}
            meta={[
              bill.last_action_date ? fmtDate(bill.last_action_date) : null,
              bill.status_desc || "Introduced",
              bill.committee ? `${bill.committee} Committee` : null,
              bill.sponsor,
            ]}
            description={truncate(bill.title, 240)}
          />
        ))}
        {!bills.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No bills for {stateName(state)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </RecordList>
      {!searching && <ListPager page={current} pages={pages} onPage={setPage} />}
    </>
  )
}
