"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react"

import { fmtNumber } from "@/lib/format"
import type { FillableResult, FillableSort } from "@/lib/policy/forms-queries"
import { LoadingFlag } from "@/components/loading-flag"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

// Every PDF in the forms harvest a person can type into (Brendan,
// 2026-09-18): searchable, filterable by agency, sortable on every column, a
// page of fifty at a time from /api/research/fillable-forms.

const GOV: Record<string, string> = { US: "Federal", NYS: "NYS", NYC: "NYC" }
const COLUMNS: { key: FillableSort; label: string; numeric?: boolean; className?: string }[] = [
  { key: "number", label: "Form", className: "w-[22%]" },
  { key: "title", label: "Title" },
  { key: "agency", label: "Agency", className: "w-[16%]" },
  { key: "pages", label: "Pages", numeric: true, className: "w-[9%]" },
  { key: "fields", label: "Fields", numeric: true, className: "w-[9%]" },
]
const PAGE = 50

export function FillableFormsTable() {
  const [query, setQuery] = React.useState("")
  const [q, setQ] = React.useState("")
  const [agency, setAgency] = React.useState("")
  const [sort, setSort] = React.useState<FillableSort>("fields")
  const [dir, setDir] = React.useState<"asc" | "desc">("desc")
  const [page, setPage] = React.useState(1)
  const [data, setData] = React.useState<FillableResult | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  // The agency list is the unfiltered one, so choosing an agency never empties the menu.
  const [agencies, setAgencies] = React.useState<FillableResult["agencies"]>([])

  // One request per pause in typing.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQ(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    const params = new URLSearchParams({ sort, dir, page: String(page) })
    if (q) params.set("q", q)
    if (agency) params.set("agency", agency)
    fetch(`/api/research/fillable-forms?${params}`)
      .then((r) => r.json())
      .then((body: FillableResult & { error?: string }) => {
        if (!alive) return
        if (body.error) return setError(body.error)
        setError(null)
        setData(body)
        if (!q && body.agencies.length) setAgencies(body.agencies)
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [q, agency, sort, dir, page])

  const toggleSort = (key: FillableSort) => {
    if (key === sort) setDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSort(key)
      setDir(key === "pages" || key === "fields" ? "desc" : "asc")
    }
    setPage(1)
  }

  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE)) : 1

  return (
    <div data-not-typeset="true" className="my-6 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-56 flex-1 items-center gap-2 rounded-lg border bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-ring/50">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search form number, title or file" aria-label="Search forms" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
        <select
          value={agency}
          aria-label="Agency"
          onChange={(e) => {
            setAgency(e.target.value)
            setPage(1)
          }}
          className="h-9 rounded-lg border bg-background px-2 text-sm"
        >
          <option value="">All agencies</option>
          {agencies.map((a) => (
            <option key={`${a.gov}:${a.agency}`} value={`${a.gov}:${a.agency}`}>
              {GOV[a.gov] ?? a.gov} · {a.agency} ({fmtNumber(a.count)})
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn("px-3 py-2 font-semibold", c.numeric ? "text-right" : "text-left", c.className)} aria-sort={sort === c.key ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort === c.key ? "text-foreground" : "text-muted-foreground")}>
                    {c.label}
                    {sort === c.key && (dir === "asc" ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(loading && "opacity-50")}>
            {data?.rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="max-w-0 truncate px-3 py-2 font-mono text-xs">
                  <Link href={`/forms/${r.id}`} className="underline-offset-2 hover:underline">
                    {r.number}
                  </Link>
                </td>
                <td className="max-w-0 truncate px-3 py-2" title={r.title ?? r.file}>
                  {r.title ?? <span className="text-muted-foreground">{r.file}</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                  {GOV[r.gov] ?? r.gov} · {r.agency}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.pages ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(r.fields)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data && loading && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <LoadingFlag />
          </div>
        )}
        {data && !data.rows.length && <p className="p-6 text-center text-sm text-muted-foreground">No fillable forms match.</p>}
        {error && <p className="p-6 text-center text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{data ? `${fmtNumber(data.count)} ${data.count === 1 ? "form" : "forms"}` : ""}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeftIcon />
          </Button>
          <span className="tabular-nums">
            {fmtNumber(page)} of {fmtNumber(pages)}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
