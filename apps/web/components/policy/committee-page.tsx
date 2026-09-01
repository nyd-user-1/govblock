"use client"

import * as React from "react"
import Link from "next/link"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import { parentCode } from "@/lib/policy/congress"
import { useCongress, useCongressRecord } from "@/lib/policy/use-congress"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { H2, Table } from "@/components/typeset"
import { DocsTableOfContents } from "@/components/docs-toc"

// One committee: the rooms it sits in, what it met about, and what it filed.
//
// Composed from the pieces the docs pages already use — an H2 per section, a
// table where the rows are records, a list where they are names. The roster is
// the one thing a committee page ought to have and cannot: neither congress.gov
// nor LegiScan publishes committee membership, which is what
// prompts/PARKED-committee-rosters.md exists to fix. The section is absent
// rather than empty, because an empty roster reads as "nobody sits on this".

type Sub = { name?: string; systemCode?: string }
type Detail = {
  name?: string
  chamber?: string
  type?: string
  systemCode?: string
  isCurrent?: boolean
  committeeWebsiteUrl?: string
  subcommittees?: Sub[]
  parent?: { name?: string; systemCode?: string }
  history?: { officialName?: string; startDate?: string; establishingAuthority?: string }[]
  bills?: { count?: number }
  reports?: { count?: number }
}
type Meeting = {
  eventId?: string
  chamber?: string
  title?: string
  type?: string
  date?: string
  meetingStatus?: string
  location?: { building?: string; room?: string }
  witnesses?: { name?: string; position?: string; organization?: string }[]
  meetingDocuments?: { name?: string; documentType?: string; format?: string; url?: string }[]
  committees?: Sub[]
}
type Report = { citation?: string; url?: string; chamber?: string; type?: string; number?: number; updateDate?: string }
type Hearing = {
  jacketNumber?: number
  citation?: string
  title?: string
  chamber?: string
  dates?: { date?: string }[]
  formats?: { type?: string; url?: string }[]
  committees?: Sub[]
}

type Value = {
  code: string
  detail: Detail | null
  meetings: Meeting[]
  meetingCount: number
  reports: Report[]
  reportCount: number
  hearings: Hearing[]
  onCongress: boolean
}

const Ctx = React.createContext<Value | null>(null)
const use = () => React.useContext(Ctx)

const day = (value: unknown) => (value ? String(value).slice(0, 10) : "")
const inRoom = (code: string) => (row: { committees?: Sub[] }) =>
  (row.committees ?? []).some((c) => parentCode(c.systemCode) === parentCode(code))

export function CommitteeProvider({ code, children }: { code: string; children: React.ReactNode }) {
  const { state, resolved } = useJurisdiction()
  const on = resolved && state === "US"
  const scope = React.useMemo(() => ({ param: "committee", value: code }), [code])
  const room = React.useMemo(() => inRoom(code), [code])
  const ask = (resource: string) => (on ? resource : null)

  const detailRead = useCongressRecord<Detail>(ask("committee-detail"), { systemCode: code, committee: code })
  const meetings = useCongress<Meeting>(ask("committee-meetings"), "committeeMeetings", scope, { systemCode: code, committee: code, limit: 250 }, room)
  const reports = useCongress<Report>(ask("committee-reports"), "reports", scope, { systemCode: code, committee: code, limit: 250 })
  const hearings = useCongress<Hearing>(ask("hearings-congress"), "hearings", scope, { systemCode: code, committee: code, limit: 250 }, room)

  const value = React.useMemo<Value>(
    () => ({
      code,
      detail: detailRead,
      meetings: [...meetings.rows].sort((a, b) => day(b.date).localeCompare(day(a.date))),
      meetingCount: meetings.count,
      reports: reports.rows,
      reportCount: reports.count,
      hearings: hearings.rows,
      onCongress: on,
    }),
    [code, detailRead, meetings.rows, meetings.count, reports.rows, reports.count, hearings.rows, on]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function CommitteeAbout({ bills }: { bills: number }) {
  const c = use()
  const detail = c?.detail
  const history = detail?.history?.[0]
  const parent = detail?.parent
  const facts = [
    detail?.type && !parent ? `${detail.type} committee` : null,
    detail?.chamber ?? null,
    history?.startDate ? `Established ${fmtDate(history.startDate)}` : null,
    bills ? `${fmtNumber(bills)} bills referred this session` : null,
    typeof detail?.reports?.count === "number" ? `${fmtNumber(detail.reports.count)} reports filed` : null,
  ].filter(Boolean)
  if (!facts.length && !parent && !detail?.committeeWebsiteUrl) return null
  return (
    <p>
      {parent && (
        <>
          Subcommittee of{" "}
          <Link href={`/docs/committees/${parent.systemCode}`} className="no-underline hover:underline">
            {parent.name}
          </Link>
          {facts.length ? " · " : ""}
        </>
      )}
      {facts.join(" · ")}
      {detail?.committeeWebsiteUrl && (
        <>
          {facts.length ? " · " : ""}
          <a href={detail.committeeWebsiteUrl} target="_blank" rel="noopener noreferrer">
            {detail.committeeWebsiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        </>
      )}
    </p>
  )
}

export function CommitteeSubcommittees() {
  const c = use()
  const subs = c?.detail?.subcommittees ?? []
  if (!subs.length) return null
  return (
    <>
      <H2>Subcommittees</H2>
      <ul>
        {[...subs]
          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
          .map((sub) => (
            <li key={sub.systemCode}>
              <Link href={`/docs/committees/${sub.systemCode}`} className="no-underline hover:underline">
                {sub.name}
              </Link>
            </li>
          ))}
      </ul>
    </>
  )
}

export function CommitteeMeetings() {
  const c = use()
  if (!c?.meetings.length) return null
  return (
    <>
      <H2>Meetings</H2>
      {c.meetings.slice(0, 25).map((meeting) => {
        const where = [meeting.location?.building, meeting.location?.room && `Room ${meeting.location.room}`]
          .filter(Boolean)
          .join(", ")
        const documents = meeting.meetingDocuments ?? []
        const witnesses = meeting.witnesses ?? []
        return (
          <React.Fragment key={meeting.eventId}>
            <h3>{truncate(meeting.title ?? meeting.type ?? "Meeting", 160)}</h3>
            <p>
              {[
                meeting.date ? fmtDate(meeting.date) : null,
                meeting.type ?? null,
                meeting.meetingStatus ?? null,
                where || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {witnesses.length > 0 && (
              <p>
                Witnesses:{" "}
                {witnesses
                  .map((w) => [w.name, w.position, w.organization].filter(Boolean).join(", "))
                  .join(" · ")}
              </p>
            )}
            {documents.length > 0 && (
              <ul>
                {documents.slice(0, 8).map((document, index) => (
                  <li key={`${document.url}-${index}`}>
                    {document.url ? (
                      <a href={document.url} target="_blank" rel="noopener noreferrer">
                        {document.name ?? document.documentType ?? "Document"}
                      </a>
                    ) : (
                      (document.name ?? "Document")
                    )}
                    {document.documentType ? ` — ${document.documentType}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </React.Fragment>
        )
      })}
      {c.meetings.length > 25 && <p>Showing the 25 most recent of {fmtNumber(c.meetings.length)} meetings on file.</p>}
    </>
  )
}

export function CommitteeReports() {
  const c = use()
  if (!c?.reports.length) return null
  return (
    <>
      <H2>Reports</H2>
      <Table>
        <thead>
          <tr>
            <th>Citation</th>
            <th>Chamber</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {c.reports.slice(0, 30).map((report, index) => (
            <tr key={`${report.citation}-${index}`}>
              <td>
                {report.url ? (
                  <a href={report.url.replace("api.congress.gov/v3", "www.congress.gov")} target="_blank" rel="noopener noreferrer">
                    {report.citation}
                  </a>
                ) : (
                  (report.citation ?? "—")
                )}
              </td>
              <td>{report.chamber ?? "—"}</td>
              <td>{report.updateDate ? fmtDate(report.updateDate) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {c.reportCount > c.reports.length && <p>{fmtNumber(c.reportCount)} reports on file.</p>}
    </>
  )
}

export function CommitteeHearings() {
  const c = use()
  if (!c?.hearings.length) return null
  return (
    <>
      <H2>Transcripts</H2>
      <ul>
        {c.hearings.slice(0, 25).map((hearing, index) => {
          const format = (hearing.formats ?? []).find((f) => f.type === "Formatted Text") ?? (hearing.formats ?? [])[0]
          const date = hearing.dates?.[0]?.date
          return (
            <li key={`${hearing.jacketNumber}-${index}`}>
              {format?.url ? (
                <a href={format.url} target="_blank" rel="noopener noreferrer">
                  {hearing.citation ?? `Jacket ${hearing.jacketNumber}`}
                </a>
              ) : (
                (hearing.citation ?? `Jacket ${hearing.jacketNumber}`)
              )}
              {hearing.title ? ` — ${truncate(hearing.title, 120)}` : ""}
              {date ? ` · ${fmtDate(date)}` : ""}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Said once, when the reader is somewhere else. */
export function CommitteeFederalNote() {
  const { state, resolved } = useJurisdiction()
  if (!resolved || state === "US") return null
  return (
    <p className="text-sm text-muted-foreground">
      This is a committee of the federal legislature. Its meetings, reports and transcripts read under the federal
      jurisdiction.
    </p>
  )
}

export function CommitteeToc({ base }: { base: readonly string[] }) {
  const c = use()
  const toc = React.useMemo(() => {
    const titles = [...base]
    if (c?.detail?.subcommittees?.length) titles.push("Subcommittees")
    if (c?.meetings.length) titles.push("Meetings")
    if (c?.reports.length) titles.push("Reports")
    if (c?.hearings.length) titles.push("Transcripts")
    return titles.map((title) => ({ title, url: `#${title.replace(/\s+/g, "-").toLowerCase()}`, depth: 2 }))
  }, [base, c])
  return <DocsTableOfContents toc={toc} />
}
