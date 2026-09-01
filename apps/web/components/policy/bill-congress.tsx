"use client"

import * as React from "react"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import {
  billRef,
  congressGovHref,
  day,
  familyCount,
  scopedRows,
  stageRank,
  summaryParagraphs,
} from "@/lib/policy/congress"
import { H2, Table } from "@/components/typeset"
import { BillText } from "@/components/bill-text"
import { DocsTableOfContents } from "@/components/docs-toc"

// What congress.gov holds about a bill, on the bill's own page: the text
// versions it moved through, the CRS summary written at each stage, the
// amendments offered to it, the bills it travels with, the names it goes by,
// the committee reports filed on it, and — when it became law — its citation.
//
// Every section is a section of the page that already exists, in the page's own
// voice: an H2, a Table or a list, an honest sentence when there is nothing.
// None of it paints before the jurisdiction resolves, and none of it paints at
// all outside Congress: these are federal records and they say so rather than
// standing under another state's header.

type Version = {
  document_id: number
  version: string | null
  source: string | null
  chars: number | null
  url: string | null
  date?: string | null
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
  bioguideId?: string
  party?: string
  state?: string
  sponsorshipDate?: string
  sponsorshipWithdrawnDate?: string | null
  isOriginalCosponsor?: boolean
}
type LawBill = {
  type?: string
  number?: string
  laws?: { number?: string; type?: string }[]
}
type LawAnswer = {
  policyArea?: { name?: string } | null
  introducedDate?: string | null
}

type Bill = { billId: number; billNumber: string }

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

// The page's half of lane C's US_ONLY: named, not merely absent. It avoids
// the word it is about, because the sentence is also what a reader would see
// flash on the prerendered shell before the jurisdiction resolves.
const FEDERAL =
  "The text versions, summaries, amendments and titles on this bill are federal records. They read under the federal jurisdiction."

export function BillCongressProvider({
  billId,
  billNumber,
  children,
}: Bill & { children: React.ReactNode }) {
  const { state, resolved } = useJurisdiction()
  const bill = String(billId)
  const on = resolved && state === "US"
  const ask = (resource: string) => (on ? resource : null)

  const versions = usePolicy<Version[]>(
    ask("text-versions"),
    { state },
    { bill }
  )
  const summaries = usePolicy<unknown>(ask("summaries"), { state }, { bill })
  const amendments = usePolicy<unknown>(
    ask("amendments"),
    { state },
    { bill, limit: 50 }
  )
  const related = usePolicy<unknown>(ask("related-bills"), { state }, { bill })
  const titles = usePolicy<unknown>(ask("titles"), { state }, { bill })
  const reports = usePolicy<unknown>(
    ask("committee-reports"),
    { state },
    { bill }
  )
  const cosponsors = usePolicy<unknown>(ask("cosponsors"), { state }, { bill })
  const laws = usePolicy<unknown>(ask("laws"), { state }, { bill })

  const value = React.useMemo<Congress>(() => {
    const ref = billRef(billNumber)
    // An amendment belongs on this page only if its own record says it amends
    // this bill; a law row only if it is this bill's row.
    const isThisBill = (row: {
      amendedBill?: { number?: string; type?: string }
    }) =>
      !!ref &&
      String(row.amendedBill?.type ?? "").toUpperCase() === ref.type &&
      String(row.amendedBill?.number ?? "") === ref.number
    const isThisLaw = (row: LawBill) =>
      !!ref &&
      String(row.type ?? "").toUpperCase() === ref.type &&
      String(row.number ?? "") === ref.number

    const scope = { param: "bill", value: bill }
    const lawRows = scopedRows<LawBill>(laws.data, "bills", scope, isThisLaw)
    const amendmentRows = scopedRows<Amendment>(
      amendments.data,
      "amendments",
      scope,
      isThisBill
    )
    const answer = (laws.data ?? {}) as LawAnswer
    return {
      billId,
      billNumber,
      ready: on,
      onCongress: on,
      versions: [
        ...scopedRows<Version>(versions.data, "textVersions", scope),
      ].sort(
        (a, b) =>
          stageRank(a.version) - stageRank(b.version) ||
          day(a.date).localeCompare(day(b.date))
      ),
      summaries: [
        ...scopedRows<Summary>(summaries.data, "summaries", scope),
      ].sort((a, b) => day(b.actionDate).localeCompare(day(a.actionDate))),
      amendments: amendmentRows,
      amendmentTotal: familyCount(amendments.data, amendmentRows),
      related: scopedRows<Related>(related.data, "relatedBills", scope),
      titles: scopedRows<Title>(titles.data, "titles", scope),
      reports: scopedRows<Report>(reports.data, "reports", scope),
      cosponsors: scopedRows<Cosponsor>(cosponsors.data, "cosponsors", scope),
      law: lawRows[0]?.laws?.[0] ?? null,
      policyArea: answer.policyArea?.name ?? null,
    }
  }, [
    billId,
    billNumber,
    bill,
    on,
    versions.data,
    summaries.data,
    amendments.data,
    related.data,
    titles.data,
    reports.data,
    cosponsors.data,
    laws.data,
  ])

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

/** The dates under the sponsor list: when each name joined, and who left. */
export function BillCosponsorDates() {
  const c = use()
  if (!c?.cosponsors.length) return null
  return (
    <Table>
      <thead>
        <tr>
          <th>Cosponsor</th>
          <th>Joined</th>
          <th>Withdrawn</th>
        </tr>
      </thead>
      <tbody>
        {c.cosponsors.map((row, index) => (
          <tr key={`${row.bioguideId}-${index}`}>
            <td>
              {row.fullName ?? "—"}
              {row.isOriginalCosponsor ? " (original)" : ""}
            </td>
            <td>{row.sponsorshipDate ? fmtDate(row.sponsorshipDate) : "—"}</td>
            <td>
              {row.sponsorshipWithdrawnDate
                ? fmtDate(row.sponsorshipWithdrawnDate)
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
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
export function BillVersions({
  fallback,
  held,
}: {
  fallback: React.ReactNode
  held: number | null
}) {
  const c = use()
  const { state } = useJurisdiction()
  const [chosen, setChosen] = React.useState<number | null>(null)
  const { data, isLoading } = usePolicy<{ text?: string | null }>(
    chosen ? "text" : null,
    { state },
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
            <th>Text</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <tr key={version.document_id}>
              <td>{version.version ?? "—"}</td>
              <td>{version.date ? fmtDate(version.date) : "—"}</td>
              <td>{version.source ?? "—"}</td>
              <td>
                {version.document_id > 0 ? (
                  <button
                    type="button"
                    onClick={() => setChosen(version.document_id)}
                    className="cursor-pointer bg-transparent p-0 underline underline-offset-4"
                  >
                    {version.document_id === current ? "Shown below" : "Read"}
                    {version.chars
                      ? ` · ${fmtNumber(version.chars)} characters`
                      : ""}
                  </button>
                ) : version.url ? (
                  <a
                    href={version.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    congress.gov
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
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
  return React.useMemo(() => {
    const titles = [...base]
    const insert = (after: string, title: string) => {
      const at = titles.indexOf(after)
      titles.splice(at < 0 ? titles.length : at + 1, 0, title)
    }
    if (c?.reports.length) insert("History", "Committee reports")
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
  }, [base, c])
}

export function BillToc({ base }: { base: readonly string[] }) {
  return <DocsTableOfContents toc={useBillSections(base)} />
}

/** Said once, at the foot of the page, when the reader is somewhere else. */
export function BillFederalNote() {
  const { state, resolved } = useJurisdiction()
  const c = use()
  if (!resolved || state === "US" || !c) return null
  return <p className="text-sm text-muted-foreground">{FEDERAL}</p>
}
