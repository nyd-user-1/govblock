"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"

import { fmtBill, fmtDate } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { Button } from "@govblock/ui/components/nova/button"

// A member's whole voting record as a PDF at the click of a button — the
// old policy.nysgpt.com member page had it on its Votes tab, and Brendan
// asked for it back for every member of every legislature (2026-09-06).
// The record is read whole from the vote-record resource, every session we
// hold, and set with jsPDF and its table plugin, both loaded only on click.

type Row = {
  session_id: number
  session_title: string | null
  date: string | null
  bill_number: string
  title: string
  description: string | null
  vote: string
  yea: number | null
  nay: number | null
  chamber: string | null
}

const sessionName = (state: string, row: Row) =>
  state === "US"
    ? congressName(row.session_id)
    : (row.session_title ?? "")
        .replace(/\s*(Regular|General)\s+Session$/i, "")
        .replace(/\s*Session$/i, "")
        .trim() || String(row.session_id)

export function VoteRecordPdf({ peopleId, state, who, seat }: { peopleId: number; state: string; who: string; seat: string }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/policy/vote-record?state=${state}&member=${peopleId}`)
      const data = (await res.json()) as { rows?: Row[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
      const rows = data.rows ?? []
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
      const doc = new jsPDF({ unit: "pt", format: "letter" })
      const width = doc.internal.pageSize.getWidth()
      const margin = 40

      // The head: the member, the seat, the count, and the day it was made.
      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.text(`${who} — Voting Record`, margin, 56)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(seat, margin, 74)
      const yeas = rows.filter((r) => /^(yea|aye|yes)$/i.test(r.vote)).length
      const nays = rows.filter((r) => /^(nay|no)$/i.test(r.vote)).length
      doc.text(`${rows.length.toLocaleString("en-US")} recorded votes · ${yeas.toLocaleString("en-US")} yea · ${nays.toLocaleString("en-US")} nay · ${(rows.length - yeas - nays).toLocaleString("en-US")} other`, margin, 88)
      doc.text(`Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} by GovBlock`, margin, 102)
      doc.setTextColor(0)

      // One table per session, newest first, with the session as its heading.
      const sessions = [...new Set(rows.map((r) => r.session_id))].sort((a, b) => b - a)
      let y = 120
      for (const session of sessions) {
        const mine = rows.filter((r) => r.session_id === session)
        if (y > doc.internal.pageSize.getHeight() - 120) {
          doc.addPage()
          y = 56
        }
        doc.setFont("helvetica", "bold")
        doc.setFontSize(12)
        doc.text(`${sessionName(state, mine[0])} · ${mine.length.toLocaleString("en-US")} votes`, margin, y)
        doc.setFont("helvetica", "normal")
        autoTable(doc, {
          startY: y + 8,
          margin: { left: margin, right: margin },
          head: [["Date", "Bill", "Title", "Question", "Vote", "Tally"]],
          body: mine.map((r) => [r.date ? fmtDate(r.date) : "—", fmtBill(r.bill_number), r.title || "—", r.description || "—", r.vote, r.yea != null && r.nay != null ? `${r.yea}–${r.nay}` : "—"]),
          styles: { fontSize: 7.5, cellPadding: 3, overflow: "linebreak", valign: "top" },
          headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [247, 247, 248] },
          columnStyles: {
            0: { cellWidth: 58 },
            1: { cellWidth: 52 },
            2: { cellWidth: (width - margin * 2 - 58 - 52 - 40 - 44) * 0.55 },
            3: { cellWidth: (width - margin * 2 - 58 - 52 - 40 - 44) * 0.45 },
            4: { cellWidth: 40 },
            5: { cellWidth: 44, halign: "right" },
          },
          didParseCell: (cell) => {
            if (cell.section === "body" && cell.column.index === 4) {
              const value = String(cell.cell.raw)
              if (/^(yea|aye|yes)$/i.test(value)) cell.cell.styles.textColor = [22, 101, 52]
              else if (/^(nay|no)$/i.test(value)) cell.cell.styles.textColor = [153, 27, 27]
            }
          },
          didDrawPage: (data) => {
            doc.setFontSize(8)
            doc.setTextColor(120)
            doc.text(`${who} · Voting Record · page ${data.pageNumber}`, margin, doc.internal.pageSize.getHeight() - 20)
            doc.setTextColor(0)
          },
        })
        y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
        y += 28
      }
      const slug = who
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
      doc.save(`${slug}-voting-record.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the PDF")
    } finally {
      setBusy(false)
    }
  }

  return (
    // ml-auto takes the row's slack, so the Sessions menu beside it sits flush at the right.
    <span className="mr-2 ml-auto flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button variant="outline" onClick={download} disabled={busy} aria-busy={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />} Download PDF
      </Button>
    </span>
  )
}
