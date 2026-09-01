"use client"

import * as React from "react"
import Link from "next/link"

import * as F from "@/lib/fixtures"
import { useScoped } from "@/lib/policy/use-scoped"
import { stateName } from "@/lib/filters"
import { fmtDate, truncate } from "@/lib/format"
import { SearchDirectory } from "@/components/directory-search"
import { ChamberSeal } from "@/components/policy/imagery"
import { Button } from "@govblock/ui/components/nova/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@govblock/ui/components/nova/item"

// Ported from livingston-v3 components/bills-list.tsx: the chamber's seal as
// the avatar, bill number and title on the title line, status · date · sponsor
// beneath, and a Text button to the bill's own page. Search filters the rows.

const print = (number: string) => number.replace(/^([A-Z]+)0+/, "$1")

type Bill = (typeof F.recentBills)[number] & { sponsor?: string | null }

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
      <ItemGroup className="my-8">
        {bills.map((bill, index) => (
          <React.Fragment key={bill.bill_id}>
            <Item className="group/item relative gap-6 px-0">
              <ItemMedia>
                <ChamberSeal state={state} chamber={bill.body} size={40} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="flex w-full min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-mono text-sm">{print(bill.bill_number)}</span>
                  <span className="min-w-0 flex-1 truncate">{truncate(bill.title, 90)}</span>
                </ItemTitle>
                <ItemDescription className="text-pretty">
                  {[bill.status_desc || "Introduced", bill.last_action_date ? fmtDate(bill.last_action_date) : null, bill.sponsor]
                    .filter(Boolean)
                    .join(" · ")}
                </ItemDescription>
              </ItemContent>
              <ItemActions className="relative z-10 hidden self-start sm:flex">
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/docs/bills/${bill.bill_id}#text`} />}>
                  Text
                </Button>
              </ItemActions>
              <ItemFooter className="justify-start pl-16 sm:hidden">
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/docs/bills/${bill.bill_id}#text`} />}>
                  Text
                </Button>
              </ItemFooter>
            </Item>
            {index < bills.length - 1 && <ItemSeparator className="my-1" />}
          </React.Fragment>
        ))}
        {!bills.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No bills for {stateName(state)}
            {query ? ` matching “${query}”` : ""}.
          </p>
        )}
      </ItemGroup>
    </>
  )
}
