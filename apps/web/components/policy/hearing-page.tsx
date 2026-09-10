"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, ExternalLink } from "lucide-react"

import { fmtDate, fmtNumber, truncate } from "@/lib/format"
import type { HearingRecord, HearingRow, MeetingRow } from "@/lib/policy/committee-queries"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { FileBlock } from "@/components/file-block"
import { ChamberSeal } from "@/components/policy/imagery"
import { PagedList } from "@/components/policy/paged-list"
import { RecordItem, RecordSeal } from "@/components/policy/record-item"
import { PreviewFrame } from "@/components/preview-frame"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H3, Table } from "@/components/typeset"

// A hearing's page: the transcript in the file block the bill page shows a
// bill's text in (Brendan, 2026-09-05: "transcripts for sure! They will slot
// nicely into the github style view"), then the witnesses and the bills from
// the meeting record it came from. hearing-texts.mjs in livingston fetches the
// transcript; until it has, the block points at congress.gov's copy.

const CONGRESS = 119

/** "CHRG-119hhrg12345" is what govinfo calls the file; ours is by jacket. */
const fileName = (h: HearingRecord) => `${String(h.chamber ?? "house").toLowerCase()}-hearing-${h.jacket}.txt`

/** The transcript's lines: a page has form feeds and long runs of blank lines that a reader does not need. */
function linesOf(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .reduce<string[]>((out, line) => {
      if (line === "" && out[out.length - 1] === "") return out
      out.push(line)
      return out
    }, [])
}

export function HearingTranscript({ hearing, state }: { hearing: HearingRecord; state: string }) {
  const formats = [hearing.text_url ? { label: "Formatted Text", href: hearing.text_url } : null, hearing.pdf_url ? { label: "PDF", href: hearing.pdf_url } : null].filter(Boolean) as { label: string; href: string }[]
  const lines = React.useMemo(() => (hearing.text ? linesOf(hearing.text) : []), [hearing.text])
  const menu = formats.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 px-2 font-sans text-sm text-muted-foreground hover:text-foreground">
            Formats <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-max min-w-44">
        {formats.map((f) => (
          <DropdownMenuItem key={f.href} className="whitespace-nowrap" render={<a href={f.href} target="_blank" rel="noopener noreferrer" />}>
            {f.label} <ExternalLink className="ml-auto size-3.5 text-muted-foreground" />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  return (
    <>
      <H3>Transcript</H3>
      {hearing.text ? (
        <>
          <p>
            The transcript runs to {fmtNumber(lines.length)} lines
            {hearing.chars ? <> and {fmtNumber(hearing.chars)} characters</> : null}, as the Government Publishing Office printed it.
          </p>
          <FileBlock icon={<ChamberSeal state={state} chamber={hearing.chamber} size={16} />} title={fileName(hearing)} lines={lines} menu={menu || undefined} text={() => hearing.text ?? ""} collapsed="data-[state=closed]:max-h-96" />
        </>
      ) : (
        <p>
          The transcript is not on file yet
          {formats.length ? (
            <>
              ; read it at{" "}
              {formats.map((f, i) => (
                <span key={f.href}>
                  {i > 0 && " or "}
                  <a href={f.href} target="_blank" rel="noopener noreferrer">
                    congress.gov ({f.label})
                  </a>
                </span>
              ))}
            </>
          ) : (
            " and congress.gov has not published one"
          )}
          .
        </p>
      )}
    </>
  )
}

export function HearingWitnesses({ meeting }: { meeting: MeetingRow | null }) {
  const witnesses = meeting?.witnesses ?? []
  if (!witnesses.length) return null
  return (
    <>
      <H3>Witnesses</H3>
      <p>
        {witnesses.length} {witnesses.length === 1 ? "witness" : "witnesses"} appeared.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[30%]">Name</th>
            <th className="w-[35%]">Position</th>
            <th className="w-[35%] pr-8">Organization</th>
          </tr>
        </thead>
        <tbody>
          {witnesses.map((w, i) => (
            <tr key={`${w.name}-${i}`}>
              <td>{w.name ?? "—"}</td>
              <td>{w.position ?? "—"}</td>
              <td className="pr-8">{w.organization ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

export function HearingDocuments({ meeting }: { meeting: MeetingRow | null }) {
  const documents = meeting?.documents ?? []
  const bills = meeting?.bills ?? []
  if (!documents.length && !bills.length) return null
  return (
    <>
      <H3>Documents</H3>
      <p>
        The meeting filed {documents.length} {documents.length === 1 ? "document" : "documents"}
        {bills.length ? (
          <>
            {" "}
            and took up {bills.length} {bills.length === 1 ? "bill" : "bills"}
          </>
        ) : null}
        .
      </p>
      <ul>
        {bills.map((b, i) => (
          <li key={`${b.type}-${b.number}-${i}`}>
            <Link href={`/bills?state=US&q=${encodeURIComponent(`${b.type ?? ""} ${b.number ?? ""}`.trim())}`}>{`${b.type ?? ""} ${b.number ?? ""}`.trim()}</Link>
            {b.title ? ` — ${truncate(b.title, 140)}` : ""}
          </li>
        ))}
        {documents.map((d, i) => (
          <li key={`${d.url}-${i}`}>
            {d.url ? (
              <a href={d.url} target="_blank" rel="noopener noreferrer">
                {d.name ?? d.type ?? "Document"}
              </a>
            ) : (
              (d.name ?? "Document")
            )}
            {d.type && d.name ? ` — ${d.type}` : ""}
          </li>
        ))}
      </ul>
    </>
  )
}

/** The index's rows, and a committee's Held tab: one hearing a row. */
export function HearingRows({ rows, total, more, state }: { rows: HearingRow[]; total?: number; more?: (offset: number, limit: number) => Promise<HearingRow[]>; state: string }) {
  return (
    <PreviewFrame>
      <PagedList
        items={rows}
        total={total}
        more={more}
        pageSize={10}
        empty="No hearings on file yet."
        render={(h, index) => (
          <RecordItem
            key={h.key}
            stacked
            hover="rail"
            href={`/hearings/${h.jacket}`}
            avatar={<RecordSeal state={state} chamber={h.chamber} ordinal={index + 1} />}
            title={h.citation ?? `Jacket ${h.jacket}`}
            lead={h.date ? fmtDate(h.date) : null}
            meta={[h.committee_name, h.has_text ? "Transcript on file" : h.text_url ? "Transcript at congress.gov" : "Transcript pending"]}
            description={h.title ? truncate(h.title, 240) : `Hearing ${h.number ?? ""} of the ${CONGRESS}th Congress`.trim()}
          />
        )}
      />
    </PreviewFrame>
  )
}

/** The index: every hearing with a title, newest first, paged through the hearing-index resource. */
export function HearingIndex({ rows, total }: { rows: HearingRow[]; total: number }) {
  const more = async (offset: number, limit: number) => {
    const res = await fetch(`/api/policy/hearing-index?state=US&limit=${limit}&offset=${offset}`)
    const data = (await res.json()) as { rows?: HearingRow[] }
    return data.rows ?? []
  }
  return <HearingRows rows={rows} total={total} more={more} state="US" />
}

export function HearingToc({ parts }: { parts: string[] }) {
  return <DocsTableOfContents toc={[{ title: "Summary", url: "#summary", depth: 2 }, { title: "Record", url: "#record", depth: 2 }, ...parts.map((title) => ({ title, url: `#${title.toLowerCase()}`, depth: 3 }))]} />
}
