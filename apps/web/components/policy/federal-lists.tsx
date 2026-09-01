"use client"

import * as React from "react"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useCongress } from "@/lib/policy/use-congress"
import { congressGovHref } from "@/lib/policy/congress"
import { SearchDirectory } from "@/components/directory-search"
import { Table } from "@/components/typeset"

// The four families that are a page in their own right: the Senate's
// confirmation docket, the research library, the daily proceedings, and the
// laws. Each is one read, one search field and one table — the shape
// /docs/committees and /docs/directory already use, with the columns each
// family actually has.
//
// All four are federal, and all four say so under another jurisdiction rather
// than quietly showing federal rows beneath a state's name. Nothing paints
// before the scope resolves, so the shared prerendered shell never flashes one
// jurisdiction's content at a reader who asked for another.

const PAGE = 50

function Shell({
  noun,
  nounPlural,
  placeholder,
  rows,
  count,
  filter,
  children,
  federal,
}: {
  noun: string
  nounPlural?: string
  placeholder: string
  rows: unknown[]
  count: number
  filter: (query: string) => unknown[]
  children: (shown: unknown[]) => React.ReactNode
  federal: string
}) {
  const { state, resolved } = useJurisdiction()
  const [query, setQuery] = React.useState("")
  const matched = React.useMemo(() => filter(query.trim().toLowerCase()), [filter, query])
  const shown = matched.slice(0, PAGE)

  if (!resolved) return null
  if (state !== "US") return <p className="py-10 text-sm text-muted-foreground">{federal}</p>
  if (!rows.length) {
    return <p className="py-10 text-sm text-muted-foreground">Nothing on file yet.</p>
  }
  return (
    <>
      <SearchDirectory
        query={query}
        registriesCount={matched.length}
        setQuery={(value) => setQuery(value ?? "")}
        noun={noun}
        nounPlural={nounPlural}
        placeholder={placeholder}
      />
      <div className="my-8">{children(shown)}</div>
      <p className="text-sm text-muted-foreground">
        Showing {fmtNumber(shown.length)} of {fmtNumber(query ? matched.length : count)}
        {query ? ` matching “${query}”` : ""}.
      </p>
    </>
  )
}

const has = (query: string, ...values: (string | number | null | undefined)[]) =>
  !query || values.some((value) => String(value ?? "").toLowerCase().includes(query))

// ---------------------------------------------------------------- nominations

type Nomination = {
  citation?: string
  number?: number
  partNumber?: string
  description?: string
  organization?: string
  receivedDate?: string
  latestAction?: { actionDate?: string; text?: string }
  url?: string
}

export function NominationsList() {
  const { rows, count } = useCongress<Nomination>("nominations", "nominations", null, { limit: 250 })
  const filter = React.useCallback(
    (query: string) => rows.filter((row) => has(query, row.description, row.organization, row.citation)),
    [rows]
  )
  return (
    <Shell
      noun="nomination"
      placeholder="Search nominations by nominee, office or citation…"
      rows={rows}
      count={count}
      filter={filter}
      federal="The confirmation docket belongs to the Senate. It reads under the federal jurisdiction."
    >
      {(shown) => (
        <Table>
          <thead>
            <tr>
              <th>Nomination</th>
              <th>Nominee and office</th>
              <th>Received</th>
              <th>Latest action</th>
            </tr>
          </thead>
          <tbody>
            {(shown as Nomination[]).map((row) => (
              <tr key={row.citation}>
                <td>
                  <a
                    href={`https://www.congress.gov/nomination/119th-congress/${row.number}${row.partNumber ? `/${Number(row.partNumber)}` : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {row.citation ?? "—"}
                  </a>
                  {row.organization ? <div className="text-muted-foreground">{row.organization}</div> : null}
                </td>
                <td>{truncate(row.description ?? "", 220) || "—"}</td>
                <td>{row.receivedDate ? fmtDate(row.receivedDate) : "—"}</td>
                <td>
                  {row.latestAction?.actionDate ? `${fmtDate(row.latestAction.actionDate)} — ` : ""}
                  {truncate(row.latestAction?.text ?? "", 140) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Shell>
  )
}

// ---------------------------------------------------------------- CRS reports

type CrsReport = {
  id?: string
  title?: string
  contentType?: string
  publishDate?: string
  updateDate?: string
  status?: string
  version?: number
  url?: string
}

export function ReportsList() {
  const { rows, count } = useCongress<CrsReport>("crs-reports", "CRSReports", null, { limit: 250 })
  const filter = React.useCallback(
    (query: string) => rows.filter((row) => has(query, row.title, row.contentType, row.id)),
    [rows]
  )
  return (
    <Shell
      noun="report"
      placeholder="Search reports by title, kind or number…"
      rows={rows}
      count={count}
      filter={filter}
      federal="These are the research service's reports for the federal legislature. They read under the federal jurisdiction."
    >
      {(shown) => (
        <Table>
          <thead>
            <tr>
              <th>Report</th>
              <th>Title</th>
              <th>Kind</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {(shown as CrsReport[]).map((row) => (
              <tr key={row.id}>
                <td>
                  <a href={`https://crsreports.congress.gov/product/details?prodcode=${row.id}`} target="_blank" rel="noopener noreferrer">
                    {row.id ?? "—"}
                  </a>
                </td>
                <td>{truncate(row.title ?? "", 200) || "—"}</td>
                <td>{row.contentType ?? "—"}</td>
                <td>{row.publishDate ? fmtDate(row.publishDate) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Shell>
  )
}

// ---------------------------------------------------------------- the Record

type Issue = {
  congress?: number
  issueDate?: string
  issueNumber?: string
  volumeNumber?: number
  sessionNumber?: number
  url?: string
}

const digestHref = (volume?: number, issue?: string) =>
  `https://www.congress.gov/congressional-record/volume-${volume}/issue-${Number(issue)}`

export function RecordList() {
  const { rows, count } = useCongress<Issue>("record-issues", "dailyCongressionalRecord", null, { limit: 250 })
  const filter = React.useCallback(
    (query: string) => rows.filter((row) => has(query, row.issueDate, row.issueNumber, row.volumeNumber)),
    [rows]
  )
  return (
    <Shell
      noun="issue"
      placeholder="Search issues by date or number…"
      rows={rows}
      count={count}
      filter={filter}
      federal="The daily proceedings are the federal legislature's. They read under the federal jurisdiction."
    >
      {(shown) => (
        <Table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Volume</th>
              <th>Issue</th>
              <th>Session</th>
              <th>Digest</th>
            </tr>
          </thead>
          <tbody>
            {(shown as Issue[]).map((row) => (
              <tr key={`${row.volumeNumber}-${row.issueNumber}`}>
                <td>{row.issueDate ? fmtDate(row.issueDate) : "—"}</td>
                <td>{row.volumeNumber ?? "—"}</td>
                <td>{row.issueNumber ?? "—"}</td>
                <td>{row.sessionNumber ?? "—"}</td>
                <td>
                  <a href={digestHref(row.volumeNumber, row.issueNumber)} target="_blank" rel="noopener noreferrer">
                    Daily Digest
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Shell>
  )
}

// ---------------------------------------------------------------- public laws

type Law = {
  congress?: number
  type?: string
  number?: string
  title?: string
  laws?: { number?: string; type?: string }[]
  latestAction?: { actionDate?: string; text?: string }
}

export function LawsList() {
  const { rows, count } = useCongress<Law>("laws", "bills", null, { limit: 250 })
  const filter = React.useCallback(
    (query: string) => rows.filter((row) => has(query, row.title, row.laws?.[0]?.number, `${row.type}${row.number}`)),
    [rows]
  )
  return (
    <Shell
      noun="law"
      placeholder="Search laws by title, citation or bill…"
      rows={rows}
      count={count}
      filter={filter}
      federal="These are the public laws of the federal legislature. They read under the federal jurisdiction."
    >
      {(shown) => (
        <Table>
          <thead>
            <tr>
              <th>Law</th>
              <th>Bill</th>
              <th>Title</th>
              <th>Enacted</th>
            </tr>
          </thead>
          <tbody>
            {(shown as Law[]).map((row) => {
              const law = row.laws?.[0]
              return (
                <tr key={`${row.type}-${row.number}`}>
                  <td>{law?.number ? `${law.type ?? "Public Law"} ${law.number}` : "—"}</td>
                  <td>
                    <a
                      href={congressGovHref("bill", row.type ?? "HR", row.number ?? "", row.congress)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {row.type} {row.number}
                    </a>
                  </td>
                  <td>{truncate(row.title ?? "", 200) || "—"}</td>
                  <td>{row.latestAction?.actionDate ? fmtDate(row.latestAction.actionDate) : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </Shell>
  )
}
