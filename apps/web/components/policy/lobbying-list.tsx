"use client"

import * as React from "react"

import { fmtCompact, fmtNumber, truncate } from "@/lib/format"
import { usePolicy } from "@/lib/policy/use-policy"
import { SearchDirectory } from "@/components/directory-search"
import { ListPager, PAGE_SIZE, pageCount } from "@/components/list-pager"
import { RecordItem, RecordList } from "@/components/policy/record-item"

// The lobbying register as a list, on the bills board's shape: the shared
// search field, the record rows, the shared pager. Fifty to a page.
//
// The search runs on the server rather than over the page in hand — there are
// 30,546 clients, and filtering fifty rows finds almost none of them. Typing
// waits a beat before it asks.

export type LobbyingKind = "firms" | "clients" | "lobbyists"

type Row = {
  registrant?: string
  client?: string
  lobbyist?: string
  clients?: number
  firms?: number
  filings: number
  income?: number | null
  description?: string | null
  client_state?: string | null
  first_year?: number | null
  last_year?: number | null
  top_client?: string | null
  top_firm?: string | null
}

const plural = (n: number, one: string) => `${fmtNumber(n)} ${n === 1 ? one : `${one}s`}`

const KINDS: Record<
  LobbyingKind,
  { resource: string; placeholder: string; empty: string; name: (row: Row) => string; lead: (row: Row) => string | null; meta: (row: Row) => (string | null)[] }
> = {
  firms: {
    resource: "lobbying-firms",
    placeholder: "Search lobbying registrants by name…",
    empty: "registrant",
    name: (r) => r.registrant ?? "",
    lead: (r) => r.top_client ?? null,
    meta: (r) => [plural(r.clients ?? 0, "client"), plural(r.filings, "filing"), r.income == null ? null : `${fmtCompact(r.income)} reported`],
  },
  clients: {
    resource: "lobbying-clients",
    placeholder: "Search lobbying clients by name…",
    empty: "client",
    name: (r) => r.client ?? "",
    lead: (r) => (r.description ? truncate(r.description, 110) : null),
    meta: (r) => [plural(r.firms ?? 0, "firm"), plural(r.filings, "filing"), r.income == null ? null : `${fmtCompact(r.income)} reported`, r.client_state ?? null],
  },
  lobbyists: {
    resource: "lobbying-lobbyists",
    placeholder: "Search registered lobbyists by name…",
    empty: "lobbyist",
    name: (r) => r.lobbyist ?? "",
    lead: (r) => r.top_firm ?? null,
    meta: (r) => [plural(r.firms ?? 0, "firm"), plural(r.clients ?? 0, "client"), plural(r.filings, "filing")],
  },
}

export function LobbyingList({ kind }: { kind: LobbyingKind }) {
  const spec = KINDS[kind]
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

  const { data } = usePolicy<{ rows: Row[]; total: number }>(
    spec.resource,
    { state: "US" },
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, q: term || undefined }
  )
  const rows = data?.rows ?? []
  const pages = pageCount(data?.total ?? 0)
  const current = Math.min(page, pages)

  return (
    <>
      <SearchDirectory query={query} setQuery={(value) => setQuery(value ?? "")} placeholder={spec.placeholder} />
      <RecordList>
        {rows.map((row) => {
          const name = spec.name(row)
          return (
            <RecordItem
              key={name}
              href={`/lobbying/${kind}/${encodeURIComponent(name)}`}
              title={name}
              lead={spec.lead(row)}
              meta={spec.meta(row)}
            />
          )
        })}
        {!rows.length && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No {spec.empty}
            {term ? `s matching “${term}”` : "s"}.
          </p>
        )}
      </RecordList>
      <ListPager page={current} pages={pages} onPage={setPage} />
    </>
  )
}
