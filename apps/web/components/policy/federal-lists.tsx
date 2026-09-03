"use client"

import * as React from "react"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { useCongress } from "@/lib/policy/use-congress"
import { congressGovHref } from "@/lib/policy/congress"
import { agencySeal, CRS_SEAL } from "@/lib/seals"
import { SearchDirectory } from "@/components/directory-search"
import { ListPager, PAGE_SIZE, pageCount } from "@/components/list-pager"
// `RecordList` is aliased: this file already exports a `RecordList` — the
// Congressional Record's daily issues — and that is a surface name, not a
// shape. The canon's list container comes in as `CanonList`.
import { RecordAvatar, RecordItem, RecordList as CanonList, RecordSeal } from "@/components/policy/record-item"

// The four families that are a page in their own right: the Senate's
// confirmation docket, the research library, the daily proceedings, and the
// laws. Each is one read, one search field and one list of the canon item,
// with the facts each family actually has in its slots.
//
// All four are federal, and all four say so under another jurisdiction rather
// than quietly showing federal rows beneath a state's name. Nothing paints
// before the scope resolves, so the shared prerendered shell never flashes one
// jurisdiction's content at a reader who asked for another.

function Shell({
  placeholder,
  rows,
  count,
  filter,
  children,
  federal,
}: {
  placeholder: string
  rows: unknown[]
  count: number
  filter: (query: string) => unknown[]
  children: (shown: unknown[]) => React.ReactNode
  federal: string
}) {
  const { state, resolved } = useJurisdiction()
  const [query, setQuery] = React.useState("")
  const [page, setPage] = React.useState(1)
  const matched = React.useMemo(() => filter(query.trim().toLowerCase()), [filter, query])
  const pages = pageCount(matched.length)
  const current = Math.min(page, pages)
  const shown = matched.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  if (!resolved) return null
  if (state !== "US") return <p className="py-10 text-sm text-muted-foreground">{federal}</p>
  if (!rows.length) {
    return <p className="py-10 text-sm text-muted-foreground">Nothing on file yet.</p>
  }
  return (
    <>
      <SearchDirectory
        query={query}
        setQuery={(value) => {
          setQuery(value ?? "")
          setPage(1)
        }}
        placeholder={placeholder}
      />
      <div className="my-8">{children(shown)}</div>
      <ListPager page={current} pages={pages} onPage={setPage} />
      <p className="text-sm text-muted-foreground">
        Showing {fmtNumber(shown.length)} of {fmtNumber(query ? matched.length : count)}
        {query ? ` matching “${query}”` : ""}.
      </p>
    </>
  )
}

const has = (query: string, ...values: (string | number | null | undefined)[]) =>
  !query || values.some((value) => String(value ?? "").toLowerCase().includes(query))

// The families arrive in the order their table was last touched, which is not
// an order anyone reads in. Each page sorts on the date it prints.
const day = (value: unknown) => (value ? String(value).slice(0, 10) : "")
const byDate = <T,>(rows: T[], date: (row: T) => unknown) =>
  [...rows].sort((a, b) => day(date(b)).localeCompare(day(date(a))))

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
    (query: string) =>
      byDate(
        rows.filter((row) => has(query, row.description, row.organization, row.citation)),
        (row) => row.latestAction?.actionDate ?? row.receivedDate
      ),
    [rows]
  )
  return (
    <Shell
      placeholder="Search nominations by nominee, office or citation…"
      rows={rows}
      count={count}
      filter={filter}
      federal="The confirmation docket belongs to the Senate. It reads under the federal jurisdiction."
    >
      {(shown) => (
        <CanonList className="my-0">
          {(shown as Nomination[]).map((row) => {
            const seal = agencySeal(row.organization)
            return (
              <RecordItem
                key={row.citation}
                external
                href={`https://www.congress.gov/nomination/119th-congress/${row.number}${row.partNumber ? `/${Number(row.partNumber)}` : ""}`}
                avatar={
                  seal ? (
                    <RecordAvatar src={seal.file} shape={seal.shape} alt="" />
                  ) : (
                    // No seal on Commons we can use: the Senate seal, which is
                    // the chamber the nomination is actually before.
                    <RecordSeal state="US" chamber="Senate" />
                  )
                }
                title={row.citation ?? "—"}
                lead={row.latestAction?.text}
                meta={[
                  row.latestAction?.actionDate ? fmtDate(row.latestAction.actionDate) : null,
                  row.organization,
                  row.receivedDate ? `Received ${fmtDate(row.receivedDate)}` : null,
                ]}
                description={truncate(row.description ?? "", 240) || null}
              />
            )
          })}
        </CanonList>
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
    (query: string) => byDate(rows.filter((row) => has(query, row.title, row.contentType, row.id)), (row) => row.publishDate),
    [rows]
  )
  return (
    <Shell
      placeholder="Search reports by title, kind or number…"
      rows={rows}
      count={count}
      filter={filter}
      federal="These are the research service's reports for the federal legislature. They read under the federal jurisdiction."
    >
      {(shown) => (
        <CanonList className="my-0">
          {(shown as CrsReport[]).map((row) => (
            <RecordItem
              key={row.id}
              external
              href={`https://crsreports.congress.gov/product/details?prodcode=${row.id}`}
              // The research service's logo is a horizontal lockup and does not
              // survive a circle, so it gets the rectangular avatar.
              avatar={<RecordAvatar src={CRS_SEAL.file} shape={CRS_SEAL.shape} alt="" />}
              title={row.id ?? "—"}
              lead={row.contentType}
              meta={[
                row.publishDate ? fmtDate(row.publishDate) : null,
                row.status,
                row.updateDate && row.updateDate.slice(0, 10) !== (row.publishDate ?? "").slice(0, 10)
                  ? `Updated ${fmtDate(row.updateDate)}`
                  : null,
                row.version ? `Version ${row.version}` : null,
              ]}
              description={truncate(row.title ?? "", 240) || null}
            />
          ))}
        </CanonList>
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

// 119th, 1st, 2nd — the Congress and the session as they are written.
const ordinal = (n: number) => {
  const v = n % 100
  const suffix = v >= 11 && v <= 13 ? "th" : (["th", "st", "nd", "rd"][v % 10] ?? "th")
  return `${n}${suffix}`
}

export function RecordList() {
  const { rows, count } = useCongress<Issue>("record-issues", "dailyCongressionalRecord", null, { limit: 250 })
  const filter = React.useCallback(
    (query: string) => byDate(rows.filter((row) => has(query, row.issueDate, row.issueNumber, row.volumeNumber)), (row) => row.issueDate),
    [rows]
  )
  return (
    <Shell
      placeholder="Search issues by date or number…"
      rows={rows}
      count={count}
      filter={filter}
      federal="The daily proceedings are the federal legislature's. They read under the federal jurisdiction."
    >
      {(shown) => (
        <CanonList className="my-0">
          {(shown as Issue[]).map((row) => (
            <RecordItem
              key={`${row.volumeNumber}-${row.issueNumber}`}
              external
              href={digestHref(row.volumeNumber, row.issueNumber)}
              // Both chambers' proceedings, so the seal of the Congress rather
              // than either chamber's.
              avatar={<RecordSeal state="US" />}
              title={row.issueDate ? fmtDate(row.issueDate) : "—"}
              lead={row.volumeNumber || row.issueNumber ? `Vol. ${row.volumeNumber ?? "—"}, No. ${row.issueNumber ?? "—"}` : null}
              meta={[
                row.congress ? `${ordinal(row.congress)} Congress` : null,
                row.sessionNumber ? `${ordinal(row.sessionNumber)} Session` : null,
                "Daily Digest",
              ]}
            />
          ))}
        </CanonList>
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
    (query: string) =>
      byDate(
        rows.filter((row) => has(query, row.title, row.laws?.[0]?.number, `${row.type}${row.number}`)),
        (row) => row.latestAction?.actionDate
      ),
    [rows]
  )
  return (
    <Shell
      placeholder="Search laws by title, citation or bill…"
      rows={rows}
      count={count}
      filter={filter}
      federal="These are the public laws of the federal legislature. They read under the federal jurisdiction."
    >
      {(shown) => (
        <CanonList className="my-0">
          {(shown as Law[]).map((row) => {
            const law = row.laws?.[0]
            // The chamber it began in, which is what the bill's own type says.
            const chamber = /^h/i.test(row.type ?? "") ? "House" : "Senate"
            // A law's latest action is "Became Public Law No: 119-102." — which
            // is the bold slot again. Row 1 says it once.
            const action = row.latestAction?.text
            const lead = law?.number && action?.includes(law.number) ? null : action
            return (
              <RecordItem
                key={`${row.type}-${row.number}`}
                external
                href={congressGovHref("bill", row.type ?? "HR", row.number ?? "", row.congress)}
                avatar={<RecordSeal state="US" chamber={chamber} />}
                title={law?.number ? `${law.type ?? "Public Law"} ${law.number}` : `${row.type} ${row.number}`}
                lead={lead}
                meta={[
                  row.latestAction?.actionDate ? fmtDate(row.latestAction.actionDate) : null,
                  `${row.type} ${row.number}`,
                ]}
                description={truncate(row.title ?? "", 240) || null}
              />
            )
          })}
        </CanonList>
      )}
    </Shell>
  )
}
