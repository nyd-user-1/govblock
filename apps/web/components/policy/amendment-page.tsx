"use client"

import Link from "next/link"

import { fmtDate, fmtNumber } from "@/lib/format"
import type { AmendmentAction, AmendmentText } from "@/lib/policy/committee-queries"
import { ActionTable, type ActionTableRow } from "@/components/policy/bill-tables"
import { MemberCard, type MemberCardRow } from "@/components/policy/member-card"
import { PagedList } from "@/components/policy/paged-list"
import { PreviewFrame } from "@/components/preview-frame"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H3, Table } from "@/components/typeset"
import { Chip } from "@/components/chip"

// An amendment opens like a bill (Brendan, 2026-09-06): the number as the
// name, the bill it amends and the chamber as the facts, the purpose as the
// Summary, then Text, Sponsors on the registry card and Actions in the bill
// page's table. The actions landed 2026-09-06; cosponsors and text versions
// land as the harvest reaches them.

export function AmendmentSponsors({ rows, who }: { rows: MemberCardRow[]; who: string }) {
  if (!rows.length) return null
  const co = rows.length - 1
  return (
    <>
      <H3>Sponsors</H3>
      <p>
        <Chip>{rows[0].name}</Chip> offered <Chip>{who}</Chip>
        {co > 0 ? (
          <>
            , and {fmtNumber(co)} {co === 1 ? "member has" : "members have"} co-sponsored it
          </>
        ) : null}
        .
      </p>
      <PreviewFrame>
        <PagedList items={rows} pageSize={10} grid render={(row) => <MemberCard key={row.id} row={row} state="US" />} />
      </PreviewFrame>
    </>
  )
}

export function AmendmentActions({ actions, who }: { actions: AmendmentAction[]; who: string }) {
  if (!actions.length) return null
  const rows: ActionTableRow[] = actions.map((a) => {
    const vote = a.votes[0] ?? null
    return {
      id: a.key,
      date: a.date ?? "",
      time: a.time,
      chamber: a.source ?? "",
      text: a.text ?? "",
      committees: [],
      roll: vote ? { label: `Roll no. ${vote.roll ?? ""}`.trim(), tally: null, clerk: vote.url } : null,
    }
  })
  const votes = actions.filter((a) => a.votes.length).length
  return (
    <>
      <H3>Actions</H3>
      <p>
        <Chip>{who}</Chip> has {fmtNumber(actions.length)} {actions.length === 1 ? "action" : "actions"} on the record
        {votes ? (
          <>
            , {votes} of them {votes === 1 ? "a recorded vote" : "recorded votes"}
          </>
        ) : null}
        .
      </p>
      <PreviewFrame>
        <ActionTable rows={rows} />
      </PreviewFrame>
    </>
  )
}

export function AmendmentTextBlock({ texts, who, source }: { texts: AmendmentText[]; who: string; source: string }) {
  return (
    <>
      <H3>Text</H3>
      {texts.length ? (
        <>
          <p>
            <Chip>{who}</Chip> has {texts.length} text {texts.length === 1 ? "version" : "versions"} on congress.gov.
          </p>
          <Table>
            <thead>
              <tr>
                <th className="w-[40%]">Version</th>
                <th className="w-[30%]">Date</th>
                <th className="w-[30%] pr-8 text-right">Formats</th>
              </tr>
            </thead>
            <tbody>
              {texts.map((t, i) => (
                <tr key={`${t.version}-${t.date}-${i}`}>
                  <td>{t.version ?? "Text"}</td>
                  <td className="whitespace-nowrap tabular-nums">{t.date ? fmtDate(t.date) : "—"}</td>
                  <td className="pr-8 text-right whitespace-nowrap">
                    {t.text_url && (
                      <a href={t.text_url} target="_blank" rel="noopener noreferrer">
                        Text
                      </a>
                    )}
                    {t.text_url && t.pdf_url ? " · " : ""}
                    {t.pdf_url && (
                      <a href={t.pdf_url} target="_blank" rel="noopener noreferrer">
                        PDF
                      </a>
                    )}
                    {!t.text_url && !t.pdf_url ? "—" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        <p>
          No text on file for <Chip>{who}</Chip> yet; read it at{" "}
          <a href={source} target="_blank" rel="noopener noreferrer">
            congress.gov
          </a>
          .
        </p>
      )}
    </>
  )
}

export function AmendmentToc({ parts }: { parts: string[] }) {
  return <DocsTableOfContents toc={[{ title: "Summary", url: "#summary", depth: 2 }, { title: "Record", url: "#record", depth: 2 }, ...parts.map((title) => ({ title, url: `#${title.toLowerCase()}`, depth: 3 }))]} />
}

export function AmendedBillLink({ id, label }: { id: number | null; label: string }) {
  return id ? <Link href={`/bills/${id}`}>{label}</Link> : <>{label}</>
}
