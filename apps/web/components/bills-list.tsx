"use client"

import * as React from "react"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { stateName } from "@/lib/filters"
import { fmtDate, truncate } from "@/lib/format"
import { SearchDirectory } from "@/components/directory-search"
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
// Search filters the rows.

const print = (number: string) => number.replace(/^([A-Z]+)0+/, "$1")

type Bill = (typeof F.recentBills)[number] & { sponsor?: string | null; last_action?: string | null }

export function BillsList() {
  const { data, state } = useScoped<{ rows: Bill[] }>("bills", { rows: F.recentBills })
  const [query, setQuery] = React.useState("")

  const bills = React.useMemo(() => {
    const rows = data?.rows ?? []
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter(
      (bill) =>
        bill.bill_number.toLowerCase().includes(q) ||
        bill.title.toLowerCase().includes(q) ||
        (bill.committee ?? "").toLowerCase().includes(q) ||
        (bill.sponsor ?? "").toLowerCase().includes(q)
    )
  }, [data, query])

  return (
    <>
      <SearchDirectory
        query={query}
        registriesCount={bills.length}
        setQuery={(value) => setQuery(value ?? "")}
        noun="bill"
        placeholder={`Search ${stateName(state)} bills by number, title, committee or sponsor…`}
      />
      <RecordList>
        {bills.map((bill, index) => (
          <RecordItem
            key={bill.bill_id}
            href={`/docs/bills/${bill.bill_id}`}
            avatar={<RecordSeal state={state} chamber={bill.body} ordinal={index + 1} />}
            title={print(bill.bill_number)}
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
    </>
  )
}
