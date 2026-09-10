"use client"

import Link from "next/link"

import { fmtBill, fmtNumber, truncate } from "@/lib/format"
import type { MeetingRow } from "@/lib/policy/committee-queries"
import { PreviewFrame } from "@/components/preview-frame"
import { DocsTableOfContents } from "@/components/docs-toc"
import { H3, Table } from "@/components/typeset"

// A committee meeting's page: what the committee's own site shows for a
// hearing (Brendan, 2026-09-06: "did we not get all of this?"), from the
// record congress.gov keeps of it — the video of the proceedings, the
// witnesses with their biography, testimony and truth-in-testimony papers,
// the supporting documents, and the bills taken up. Nothing here points out
// where the record holds the thing itself.

/** A YouTube id out of a watch or share URL; null for anything else. */
export function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([A-Za-z0-9_-]{6,})/)
  return m ? m[1] : null
}

export function MeetingVideo({ meeting }: { meeting: MeetingRow }) {
  const video = meeting.videos.map((v) => ({ ...v, id: youtubeId(v.url) })).find((v) => v.id)
  if (!video) return null
  return (
    <>
      <H3>Video</H3>
      <p>The proceedings, as the committee streamed them.</p>
      <PreviewFrame>
        <div className="overflow-hidden rounded-xl border bg-black">
          <iframe
            className="aspect-video w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.id}`}
            title={video.name ?? meeting.title ?? "Video of proceedings"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </PreviewFrame>
    </>
  )
}

/** "Mr. Neil Bradley" → the "BradleyN" congress.gov puts in the witness's file names. */
function fileKeys(name: string | null) {
  const clean = (name ?? "")
    .replace(/^(the\s+honorable|hon\.|mr\.|ms\.|mrs\.|dr\.|miss|sen\.|rep\.)\s+/i, "")
    .replace(/,.*$/, "")
    .trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (!parts.length) return { surname: "", initial: "" }
  const surname = parts[parts.length - 1].replace(/[^A-Za-z]/g, "")
  const initial = parts[0].charAt(0)
  return { surname: surname.toLowerCase(), initial: initial.toLowerCase() }
}

const DOC_LABEL: Record<string, string> = { "Witness Biography": "Biography", "Witness Statement": "Testimony", "Witness Truth in Testimony": "Truth in Testimony" }

export function MeetingWitnesses({ meeting }: { meeting: MeetingRow }) {
  const witnesses = meeting.witnesses
  if (!witnesses.length) return null
  const docs = meeting.witness_documents
  const claimed = new Set<string>()
  const papersOf = (name: string | null) => {
    const { surname, initial } = fileKeys(name)
    if (!surname) return []
    const mine = docs.filter((d) => {
      const file = d.url.split("/").pop()?.toLowerCase() ?? ""
      return file.includes(`-${surname}${initial}-`) || file.includes(`-${surname}-`)
    })
    for (const d of mine) claimed.add(d.url)
    return mine
  }
  const rows = witnesses.map((w) => ({ ...w, papers: papersOf(w.name) }))
  const unclaimed = docs.filter((d) => !claimed.has(d.url))
  return (
    <>
      <H3>Witnesses</H3>
      <p>
        {fmtNumber(witnesses.length)} {witnesses.length === 1 ? "witness" : "witnesses"} appeared
        {docs.length ? (
          <>
            , with {fmtNumber(docs.length)} {docs.length === 1 ? "paper" : "papers"} on file
          </>
        ) : null}
        .
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[26%]">Name</th>
            <th className="w-[44%]">Position</th>
            <th className="w-[30%] pr-8">Papers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w, i) => (
            <tr key={`${w.name}-${i}`}>
              <td>{w.name ?? "—"}</td>
              <td>{[w.position, w.organization].filter(Boolean).join(", ") || "—"}</td>
              <td className="pr-8">
                {w.papers.length
                  ? w.papers.map((d, j) => (
                      <span key={d.url}>
                        {j > 0 && " · "}
                        <a href={d.url} target="_blank" rel="noopener noreferrer">
                          {DOC_LABEL[d.type ?? ""] ?? d.type ?? "PDF"}
                        </a>
                      </span>
                    ))
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {unclaimed.length > 0 && (
        <ul>
          {unclaimed.map((d) => (
            <li key={d.url}>
              <a href={d.url} target="_blank" rel="noopener noreferrer">
                {d.type ?? "Witness paper"}
              </a>{" "}
              — {d.url.split("/").pop()}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function MeetingDocuments({ meeting }: { meeting: MeetingRow }) {
  const documents = meeting.documents.filter((d) => d.url)
  if (!documents.length) return null
  return (
    <>
      <H3>Documents</H3>
      <p>
        The committee filed {fmtNumber(documents.length)} {documents.length === 1 ? "document" : "documents"} for the meeting.
      </p>
      <Table>
        <thead>
          <tr>
            <th className="w-[60%]">Document</th>
            <th className="w-[28%]">Kind</th>
            <th className="w-[12%] pr-8 text-right">Format</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d, i) => (
            <tr key={`${d.url}-${i}`}>
              <td>
                <a href={d.url ?? "#"} target="_blank" rel="noopener noreferrer">
                  {truncate(d.name ?? d.type ?? "Document", 110)}
                </a>
              </td>
              <td>{d.type ?? "—"}</td>
              <td className="pr-8 text-right">{d.format ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  )
}

export function MeetingBills({ meeting, held }: { meeting: MeetingRow; held: Record<string, { bill_id: number; title: string }> }) {
  const bills = meeting.bills.filter((b) => b.type && b.number)
  if (!bills.length) return null
  const prefix: Record<string, string> = { HR: "HB", S: "SB", HJRES: "HJR", SJRES: "SJR", HCONRES: "HCR", SCONRES: "SCR", HRES: "HR", SRES: "SR" }
  const ours = (b: { type: string | null; number: string | null }) => `${prefix[String(b.type).toUpperCase()] ?? String(b.type).toUpperCase()}${b.number}`
  return (
    <>
      <H3>Bills</H3>
      <p>
        The meeting took up {fmtNumber(bills.length)} {bills.length === 1 ? "bill" : "bills"}.
      </p>
      <ul>
        {bills.map((b, i) => {
          const number = ours(b)
          const row = held[number]
          return (
            <li key={`${number}-${i}`}>
              {row ? <Link href={`/bills/${row.bill_id}`}>{fmtBill(number, "US")}</Link> : fmtBill(number, "US")}
              {b.title || row?.title ? ` — ${truncate(b.title ?? row?.title ?? "", 140)}` : ""}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function MeetingToc({ parts }: { parts: string[] }) {
  return <DocsTableOfContents toc={[{ title: "Summary", url: "#summary", depth: 2 }, { title: "Record", url: "#record", depth: 2 }, ...parts.map((title) => ({ title, url: `#${title.toLowerCase()}`, depth: 3 }))]} />
}
