"use client"

import * as React from "react"

import { fmtCompact, fmtNumber } from "@/lib/format"
import { usePolicy } from "@/lib/policy/use-policy"
import { SearchDirectory } from "@/components/directory-search"
import { ListPager, PAGE_SIZE, pageCount } from "@/components/list-pager"
import { RecordItem, RecordList } from "@/components/policy/record-item"

// The lobbying register as a list, on the bills board's shape: the shared
// search field, the record rows, the shared pager. Fifty to a page.
//
// The search runs on the server rather than over the page in hand, because
// there are 6,473 registrants and filtering fifty rows finds almost none of
// them. Typing waits a beat before it asks.

type Firm = {
  registrant: string
  clients: number
  filings: number
  income: number | null
  first_year: number | null
  last_year: number | null
  top_client: string | null
}

export function LobbyingList() {
  const [page, setPage] = React.useState(1)
  const [query, setQuery] = React.useState("")
  const [term, setTerm] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => {
      setTerm(query.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const { data } = usePolicy<{ rows: Firm[]; total: number }>(
    "lobbying-firms",
    { state: "US" },
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, q: term || undefined }
  )
  const rows = data?.rows ?? []
  const pages = pageCount(data?.total ?? 0)
  const current = Math.min(page, pages)

  return (
    <>
      <SearchDirectory query={query} setQuery={(value) => setQuery(value ?? "")} placeholder="Search lobbying registrants by name…" />
      <RecordList>
        {rows.map((firm) => (
          <RecordItem
            key={firm.registrant}
            href={`/docs/lobbying/firms/${encodeURIComponent(firm.registrant)}`}
            title={firm.registrant}
            lead={firm.top_client}
            meta={[
              `${fmtNumber(firm.clients)} ${firm.clients === 1 ? "client" : "clients"}`,
              `${fmtNumber(firm.filings)} ${firm.filings === 1 ? "filing" : "filings"}`,
              firm.income == null ? null : `${fmtCompact(firm.income)} reported`,
              firm.first_year ? (firm.first_year === firm.last_year ? String(firm.last_year) : `${firm.first_year}–${firm.last_year}`) : null,
            ]}
          />
        ))}
        {!rows.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No registrant{term ? ` matching “${term}”` : "s"}.
          </p>
        )}
      </RecordList>
      <ListPager page={current} pages={pages} onPage={setPage} />
    </>
  )
}
