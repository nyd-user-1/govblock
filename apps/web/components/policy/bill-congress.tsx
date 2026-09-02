"use client"

import * as React from "react"
import Link from "next/link"

import { memberHref } from "@/lib/filters"
import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { usePolicy } from "@/lib/policy/use-policy"
import {
  billRef,
  congressGovHref,
  day,
  stageRank,
  summaryParagraphs,
} from "@/lib/policy/congress"
import { useCongress } from "@/lib/policy/use-congress"
import { H2, Table } from "@/components/typeset"
import { useBillDepth } from "@/components/policy/bill-depth"
import { BillText } from "@/components/bill-text"
import { DocsTableOfContents } from "@/components/docs-toc"

// What congress.gov holds about a bill, on the bill's own page: the text
// versions it moved through, the CRS summary written at each stage, the
// amendments offered to it, the bills it travels with, the names it goes by,
// the committee reports filed on it, and — when it became law — its citation.
//
// Every section is a section of the page that already exists, in the page's own
// voice: an H2, a Table or a list, an honest sentence when there is nothing.
// The path names one bill, so every read here is made in that bill's own
// jurisdiction rather than the reader's: a federal bill's amendments are
// federal records whoever is looking at them. Nothing is prerendered, so the
// shell every reader shares still says nothing about a jurisdiction.

type Version = {
  document_id: number | null
  version: string | null
  source: string | null
  chars: number | null
  fetched_at?: string | null
  url: string | null
  date?: string | null
  // The other renderings govinfo publishes of the same version. Derived from
  // the package id rather than fetched — /pdf/{pkg}.pdf and /html/{pkg}.htm are
  // uniform across govinfo, checked on 28 packages before it was relied on —
  // except the XML, which is taken as published because a bill carries /xml and
  // a public law carries /uslm.
  formats?: { type: string; url: string }[]
}
type Summary = {
  actionDate?: string
  actionDesc?: string
  text?: string
  updateDate?: string
}
type Amendment = {
  number?: string
  type?: string
  congress?: number
  purpose?: string
  description?: string
  latestAction?: { actionDate?: string; text?: string }
  sponsors?: { fullName?: string; bioguideId?: string }[]
  amendedBill?: { number?: string; type?: string }
}
type Related = {
  congress?: number
  number?: number
  type?: string
  title?: string
  latestAction?: { actionDate?: string; text?: string }
  relationshipDetails?: { type?: string; identifiedBy?: string }[]
}
type Title = {
  title?: string
  titleType?: string
  chamberName?: string
  billTextVersionName?: string
}
type Report = { citation?: string; url?: string }
type Cosponsor = {
  fullName?: string
  firstName?: string
  lastName?: string
  bioguideId?: string
  party?: string
  state?: string
  sponsorshipDate?: string
  sponsorshipWithdrawnDate?: string | null
  // The route answers `"True"` / `"False"` as text where the committed record
  // has a real boolean, and `"False"` is truthy. Read it through `truth()`.
  isOriginalCosponsor?: boolean | string
  /** Lane C's route resolves the bioguide id to our own member id. */
  people_id?: number
}
type LawBill = {
  type?: string
  number?: string
  laws?: { number?: string; type?: string }[]
  // CRS's one-line classification of the bill. It rides on the bill record the
  // law family is cut from; where the route trims it, it is simply absent.
  policyArea?: { name?: string } | null
}

type Bill = { billId: number; billNumber: string; state: string }

type Congress = Bill & {
  ready: boolean
  onCongress: boolean
  versions: Version[]
  summaries: Summary[]
  amendments: Amendment[]
  amendmentTotal: number
  related: Related[]
  titles: Title[]
  reports: Report[]
  cosponsors: Cosponsor[]
  law: { number?: string; type?: string } | null
  policyArea: string | null
}

const Ctx = React.createContext<Congress | null>(null)
const use = () => React.useContext(Ctx)

export function BillCongressProvider({
  billId,
  billNumber,
  state,
  children,
}: Bill & { children: React.ReactNode }) {
  // The path names one bill, and a bill belongs to a jurisdiction of its own.
  // A federal bill's text versions and amendments are federal records whoever
  // is reading them, so this page reads in the bill's jurisdiction rather than
  // the reader's — which is also why nothing here waits for the switcher.
  const on = state === "US"
  const bill = String(billId)
  const scope = React.useMemo(() => ({ param: "bill", value: bill }), [bill])
  const ref = React.useMemo(() => billRef(billNumber), [billNumber])

  // An amendment belongs on this page only if its own record says it amends
  // this bill; a law row only if it is this bill's row.
  const amends = React.useCallback(
    (row: Amendment) =>
      !!ref &&
      String(row.amendedBill?.type ?? "").toUpperCase() === ref.type &&
      String(row.amendedBill?.number ?? "") === ref.number,
    [ref]
  )
  const enacts = React.useCallback(
    (row: LawBill) =>
      !!ref && String(row.type ?? "").toUpperCase() === ref.type && String(row.number ?? "") === ref.number,
    [ref]
  )

  const versions = useCongress<Version>("text-versions", "textVersions", scope, { bill }, undefined, state)
  const summaries = useCongress<Summary>("summaries", "summaries", scope, { bill }, undefined, state)
  const amendments = useCongress<Amendment>("amendments", "amendments", scope, { bill, limit: 50 }, amends, state)
  const related = useCongress<Related>("related-bills", "relatedBills", scope, { bill }, undefined, state)
  const titles = useCongress<Title>("titles", "titles", scope, { bill }, undefined, state)
  const reports = useCongress<Report>("committee-reports", "reports", scope, { bill }, undefined, state)
  const cosponsors = useCongress<Cosponsor>("cosponsors", "cosponsors", scope, { bill }, undefined, state)
  const laws = useCongress<LawBill>("laws", "bills", scope, { bill }, enacts, state)

  const value = React.useMemo<Congress>(
    () => ({
      billId,
      billNumber,
      state,
      ready: on,
      onCongress: on,
      versions: [...versions.rows].sort(
        (a, b) => stageRank(a.version) - stageRank(b.version) || day(a.date).localeCompare(day(b.date))
      ),
      summaries: [...summaries.rows].sort((a, b) => day(b.actionDate).localeCompare(day(a.actionDate))),
      amendments: amendments.rows,
      amendmentTotal: amendments.count,
      related: related.rows,
      titles: titles.rows,
      reports: reports.rows,
      cosponsors: cosponsors.rows,
      law: laws.rows[0]?.laws?.[0] ?? null,
      policyArea: laws.rows[0]?.policyArea?.name ?? null,
    }),
    [billId, billNumber, state, on, versions.rows, summaries.rows, amendments.rows, amendments.count, related.rows, titles.rows, reports.rows, cosponsors.rows, laws.rows]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Policy area and, once it is law, the citation — inside the status callout. */
export function BillStatusExtras() {
  const c = use()
  if (!c?.onCongress) return null
  return (
    <>
      {c.policyArea && <span> · {c.policyArea}</span>}
      {c.law?.number && (
        <span>
          {" · "}
          <strong>
            {c.law.type ?? "Public Law"} {c.law.number}
          </strong>
        </span>
      )}
    </>
  )
}

export function BillSummaries({ fallback }: { fallback: React.ReactNode }) {
  const c = use()
  if (!c?.summaries.length) return <>{fallback}</>
  return (
    <>
      {c.summaries.map((summary, index) => (
        <React.Fragment key={`${summary.actionDate}-${index}`}>
          <h3>
            {summary.actionDesc ?? "Summary"}
            {summary.actionDate ? ` · ${fmtDate(summary.actionDate)}` : ""}
          </h3>
          {summaryParagraphs(summary.text)
            .slice(0, 6)
            .map((line, i) => (
              <p key={i}>{truncate(line, 900)}</p>
            ))}
        </React.Fragment>
      ))}
      <p>
        The summaries are the Congressional Research Service&rsquo;s, one per
        stage.{" "}
        <a
          href={congressGovHref(
            "bill",
            billRef(c.billNumber)?.type ?? "HR",
            billRef(c.billNumber)?.number ?? ""
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          Read them in full
        </a>
        .
      </p>
    </>
  )
}

type SponsorRow = {
  people_id: number
  name: string
  party: string
  district: string
  type: number
  bioguide_id: string | null
}

const SPONSOR_TYPE: Record<number, string> = { 1: "prime sponsor", 2: "co-sponsor", 3: "joint sponsor" }

// `"False"` is a truthy string, and it is what the route sends. Every cosponsor
// on a 338-name bill read "Yes" under Original until this existed.
const truth = (value: boolean | string | null | undefined) =>
  typeof value === "string" ? /^(true|t|1|yes)$/i.test(value.trim()) : !!value
// The page's own rule, moved with the block it served: drop the chamber
// prefix and the zero padding, so "HD-NY-025" reads "NY-25".
const district = (value: string | null | undefined) =>
  (value ?? "").replace(/^[A-Z]+-/, "").replace(/(^|-)0+(?=\d)/g, "$1")

/**
 * Ten rows, then a scroll — and a control that opens the box to its full height
 * and closes it again. A bill with 84 cosponsors is a page of names between the
 * sponsors and the actions; a bill with four is not, and gets no box at all.
 */
function RowBox({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | null>(null)

  // Measured rather than assumed: a name that wraps makes its row taller, and a
  // hardcoded row height would cut the tenth one in half. `useEffect` and not
  // `useLayoutEffect` — a state bill's list renders on the server, and a layout
  // effect there is a warning for a frame nobody sees.
  React.useEffect(() => {
    const box = ref.current
    if (!box) return
    const rows = box.querySelectorAll<HTMLElement>("[data-sponsor-row]")
    if (rows.length <= 10) {
      setHeight(null)
      return
    }
    // Rects, not offsetTop: the box is not a positioned ancestor, so the two
    // offsetTops would be measured against different parents.
    setHeight(rows[10].getBoundingClientRect().top - box.getBoundingClientRect().top)
  }, [count])

  if (height === null) return <div ref={ref}>{children}</div>

  return (
    <>
      <div
        ref={ref}
        className="overflow-y-auto overscroll-contain"
        style={open ? undefined : { maxHeight: height }}
      >
        {children}
      </div>
      <p>
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="cursor-pointer text-sm font-medium text-foreground underline underline-offset-4"
        >
          {open ? "Show fewer" : `Show all ${fmtNumber(count)}`}
        </button>
      </p>
    </>
  )
}

/**
 * The bill's sponsorship, once.
 *
 * It used to be twice: LegiScan's list of names in bullets ending in "…and 64
 * more co-sponsors", and directly beneath it congress.gov's cosponsor table of
 * the same 64 people. Brendan, 2026-09-02: "were we duplicating sponsorship
 * listing?" — we were.
 *
 * Now the prime sponsor gets a line of their own, and everyone else gets one
 * table. On a Congress bill that table is congress.gov's, because it is the
 * source that knows when each name joined and who withdrew — but the *names*
 * come from `People` where a bioguide id matches, so a cosponsor reads
 * "Joseph Morelle" and links to their page here, rather than reading
 * "Rep. Morelle, Joseph D. [D-NY-25]" and linking nowhere. Where no People row
 * matches, congress.gov's own name stands as it is: a name we cannot resolve is
 * still a name, and dropping it would be worse than printing it unlinked.
 *
 * A state bill has no congress.gov table, so it keeps LegiScan's list — under
 * the same ten-row rule, because 84 names is 84 names either way.
 */
export function BillSponsors({ sponsors, state }: { sponsors: SponsorRow[]; state: string }) {
  const c = use()
  const prime = sponsors.find((row) => row.type === 1) ?? null
  const rest = sponsors.filter((row) => row !== prime)
  const byBioguide = React.useMemo(() => {
    const map = new Map<string, SponsorRow>()
    for (const row of sponsors) if (row.bioguide_id) map.set(row.bioguide_id.toUpperCase(), row)
    return map
  }, [sponsors])

  const cosponsors = c?.cosponsors ?? []

  const primeLine = prime ? (
    <p>
      <Link href={memberHref(prime.people_id, state)} className="no-underline hover:underline">
        <strong>{prime.name}</strong>
      </Link>{" "}
      ({prime.party ?? "—"}–{district(prime.district)}) — prime sponsor
    </p>
  ) : (
    <p>No sponsor on file.</p>
  )

  if (cosponsors.length) {
    return (
      <>
        {primeLine}
        <RowBox count={cosponsors.length}>
          <Table>
            <thead>
              <tr>
                <th>Cosponsor</th>
                <th>Joined</th>
                <th>Original</th>
                <th>Withdrawn</th>
              </tr>
            </thead>
            <tbody>
              {cosponsors.map((row, index) => {
                const person = row.bioguideId ? byBioguide.get(row.bioguideId.toUpperCase()) : undefined
                // Three rungs, best first: our own People row (canonical name),
                // then the id the route resolved for us with congress.gov's
                // first and last name, then the name as congress.gov writes it,
                // unlinked. A name we cannot resolve is still a name.
                const peopleId = person?.people_id ?? row.people_id ?? null
                const name =
                  person?.name ||
                  [row.firstName, row.lastName].filter(Boolean).join(" ") ||
                  row.fullName ||
                  "—"
                const where = [row.party, row.state].filter(Boolean).join("–")
                return (
                  <tr data-sponsor-row key={`${row.bioguideId}-${index}`}>
                    <td>
                      {peopleId ? (
                        <Link href={memberHref(peopleId, state)} className="no-underline hover:underline">
                          {name}
                        </Link>
                      ) : (
                        (row.fullName ?? "—")
                      )}
                      {where ? ` (${where})` : ""}
                    </td>
                    <td>{row.sponsorshipDate ? fmtDate(row.sponsorshipDate) : "—"}</td>
                    <td>{truth(row.isOriginalCosponsor) ? "Yes" : "—"}</td>
                    <td>{row.sponsorshipWithdrawnDate ? fmtDate(row.sponsorshipWithdrawnDate) : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </RowBox>
      </>
    )
  }

  if (!rest.length) return primeLine

  return (
    <>
      {primeLine}
      <RowBox count={rest.length}>
        <ul>
          {rest.map((row) => (
            <li data-sponsor-row key={row.people_id}>
              <Link href={memberHref(row.people_id, state)} className="no-underline hover:underline">
                <strong>{row.name}</strong>
              </Link>{" "}
              ({row.party ?? "—"}–{district(row.district)}) — {SPONSOR_TYPE[row.type] ?? "sponsor"}
            </li>
          ))}
        </ul>
      </RowBox>
    </>
  )
}

export function BillCommitteeReports() {
  const c = use()
  if (!c?.reports.length) return null
  return (
    <>
      <H2>Committee reports</H2>
      <ul>
        {c.reports.map((report) => (
          <li key={report.citation}>
            {report.url ? (
              <a
                href={report.url.replace(
                  "api.congress.gov/v3",
                  "www.congress.gov"
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                {report.citation}
              </a>
            ) : (
              report.citation
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

export function BillAmendments() {
  const c = use()
  if (!c?.onCongress || !c.amendmentTotal) return null
  return (
    <>
      <H2>Amendments</H2>
      {c.amendments.length ? (
        <>
          <Table>
            <thead>
              <tr>
                <th>Amendment</th>
                <th>Sponsor</th>
                <th>Purpose</th>
                <th>Latest action</th>
              </tr>
            </thead>
            <tbody>
              {c.amendments.map((row) => (
                <tr key={`${row.type}-${row.number}`}>
                  <td>
                    <a
                      href={congressGovHref(
                        "amendment",
                        row.type ?? "HAMDT",
                        row.number ?? "",
                        row.congress
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {row.type} {row.number}
                    </a>
                  </td>
                  <td>{row.sponsors?.[0]?.fullName ?? "—"}</td>
                  <td>
                    {truncate(row.purpose ?? row.description ?? "", 160) || "—"}
                  </td>
                  <td>
                    {row.latestAction?.actionDate
                      ? `${fmtDate(row.latestAction.actionDate)} — `
                      : ""}
                    {truncate(row.latestAction?.text ?? "", 120) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {c.amendmentTotal > c.amendments.length && (
            <p>
              Showing {c.amendments.length} of {fmtNumber(c.amendmentTotal)}{" "}
              amendments offered to this bill.
            </p>
          )}
        </>
      ) : (
        <p>
          {fmtNumber(c.amendmentTotal)} amendments were offered to this bill;
          none of their records are on file yet.
        </p>
      )}
    </>
  )
}

export function BillRelatedBills() {
  const c = use()
  if (!c?.related.length) return null
  return (
    <>
      <H2>Related bills</H2>
      <ul>
        {c.related.map((row) => (
          <li key={`${row.type}-${row.number}`}>
            <a
              href={congressGovHref(
                "bill",
                row.type ?? "HR",
                row.number ?? "",
                row.congress
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>
                {row.type} {row.number}
              </strong>
            </a>{" "}
            — {truncate(row.title ?? "", 110)}
            {row.relationshipDetails?.[0]?.type
              ? ` · ${row.relationshipDetails[0].type}`
              : ""}
            {row.latestAction?.actionDate
              ? ` · ${fmtDate(row.latestAction.actionDate)}`
              : ""}
          </li>
        ))}
      </ul>
    </>
  )
}

export function BillTitles() {
  const c = use()
  if (!c?.titles.length) return null
  return (
    <>
      <H2>Titles</H2>
      <ul>
        {c.titles.map((row, index) => (
          <li key={`${row.titleType}-${index}`}>
            <strong>{row.title}</strong>
            {row.titleType ? ` — ${row.titleType}` : ""}
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The text section: the stages the bill's text moved through, and the text of
 * the one selected. The page arrives holding the newest version the site has;
 * choosing another asks for it by document.
 */
// govinfo's own names for its renderings, shortened to what fits a cell.
const FORMAT_LABEL: Record<string, string> = { "Formatted Text": "Text", PDF: "PDF", XML: "XML" }

export function BillVersions({
  fallback,
  held,
}: {
  fallback: React.ReactNode
  held: number | null
}) {
  const c = use()
  const [chosen, setChosen] = React.useState<number | null>(null)
  const { data, isLoading } = usePolicy<{ text?: string | null }>(
    chosen ? "text" : null,
    { state: c?.state },
    { id: c?.billId, document: chosen ?? undefined }
  )
  const versions = c?.versions ?? []
  if (!versions.length) return <>{fallback}</>
  const current = chosen ?? held
  return (
    <>
      <Table>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Date</th>
            <th>Source</th>
            <th>Length</th>
            <th>Text</th>
            <th>Formats</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version, index) => {
            // A version harvested in bulk carries no stage date, and the row
            // then holds the day it was fetched instead. Printing that as the
            // day the bill was engrossed would be a plain untruth, so a date
            // that is the fetch day is treated as no date at all.
            const stage =
              version.date && day(version.date) !== day(version.fetched_at)
                ? version.date
                : null
            const document = version.document_id
            return (
              <tr key={document ?? `${version.version}-${index}`}>
                <td>{version.version ?? "—"}</td>
                <td>{stage ? fmtDate(stage) : "—"}</td>
                <td>{version.source ?? "—"}</td>
                <td>{version.chars ? fmtNumber(version.chars) : "—"}</td>
                <td>
                  {typeof document === "number" ? (
                    <button
                      type="button"
                      onClick={() => setChosen(document)}
                      className="cursor-pointer bg-transparent p-0 underline underline-offset-4"
                    >
                      {document === current ? "Shown below" : "Read"}
                    </button>
                  ) : version.source && version.url ? (
                    <a
                      href={version.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      congress.gov
                    </a>
                  ) : (
                    // A version congress.gov lists and we hold no body for. The
                    // renderings are one column over; what is missing is ours.
                    <span className="text-muted-foreground">Not held</span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  {version.formats?.length
                    ? version.formats.map((format, i) => (
                        <React.Fragment key={format.url}>
                          {i > 0 && " · "}
                          <a href={format.url} target="_blank" rel="noopener noreferrer">
                            {FORMAT_LABEL[format.type] ?? format.type}
                          </a>
                        </React.Fragment>
                      ))
                    : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Table>
      {chosen && isLoading && <p>Loading that version…</p>}
      {chosen && !isLoading && data?.text ? (
        <BillText text={data.text} />
      ) : (
        fallback
      )}
    </>
  )
}

/**
 * The rail's contents list. It names the sections that have rows — a bill with
 * no amendments does not advertise an Amendments section that is not there.
 */
function useBillSections(base: readonly string[]) {
  const c = use()
  // The sections that are always drawn are in `base`; a cost estimate exists
  // for 1,115 of the 119th's 18,514 bills, so it names itself only when the
  // bill has one — the same rule the other conditional sections follow.
  const depth = useBillDepth()
  return React.useMemo(() => {
    const titles = [...base]
    const insert = (after: string, title: string) => {
      const at = titles.indexOf(after)
      titles.splice(at < 0 ? titles.length : at + 1, 0, title)
    }
    // "History" on a state bill, "Actions" on a Congress bill — the same
    // section, called what its source calls it.
    const record = titles.includes("Actions") ? "Actions" : "History"
    if (c?.reports.length) insert(record, "Committee reports")
    if (depth?.cbo.length) insert("Subjects", "Cost estimate")
    if (depth?.record?.constitutionalAuthorityStatementText) titles.push("Constitutional authority")
    if (c?.amendmentTotal) insert("Votes", "Amendments")
    if (c?.related.length)
      insert(c.amendmentTotal ? "Amendments" : "Votes", "Related bills")
    if (c?.titles.length)
      insert(
        c.related.length
          ? "Related bills"
          : c.amendmentTotal
            ? "Amendments"
            : "Votes",
        "Titles"
      )
    return titles.map((title) => ({
      title,
      url: `#${title.replace(/\s+/g, "-").toLowerCase()}`,
      depth: 2,
    }))
  }, [base, c, depth])
}

export function BillToc({ base }: { base: readonly string[] }) {
  return <DocsTableOfContents toc={useBillSections(base)} />
}

