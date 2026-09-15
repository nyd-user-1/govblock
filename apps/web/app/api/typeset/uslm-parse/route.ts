import { NextResponse } from "next/server"

import { currentSession, gate } from "@/lib/entitlements-server"
import { fmtBill } from "@/lib/format"
import { getBill } from "@/lib/policy/queries"
import { typesetHref } from "@/lib/typeset/views"
import { buildXmlDocument } from "@/lib/typeset/xml-document"

// The USLM parse, as a job (window 1, 2026-09-14): one bill printing built
// from its source through the reader's schema, every cache skipped, and what
// the build did reported back. The "USLM parse" tile on the Data Pipeline
// dashboard runs it.
//
//   GET /api/typeset/uslm-parse?bill=<id>[&version=<document id>]

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const billId = Number(sp.get("bill") ?? 0)
  if (!Number.isInteger(billId) || billId <= 0) return NextResponse.json({ error: "A bill id is a whole number." }, { status: 400 })
  const bill = await getBill(billId)
  if (!bill) return NextResponse.json({ error: `No bill ${billId}.` }, { status: 404 })
  const { refusal } = await gate(request, { state: bill.state, session: bill.session_id, current: await currentSession(bill.state).catch(() => null), entity: "bills" })
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status })

  const version = Number(sp.get("version") ?? 0) || undefined
  try {
    const doc = await buildXmlDocument(bill, version)
    const { json: _json, html: _html, ...rest } = doc
    return NextResponse.json(
      { ...rest, bill: fmtBill(bill.bill_number, bill.state), state: bill.state, href: typesetHref(bill, "xml", doc.documentId != null && version ? { version: String(doc.documentId) } : undefined) },
      { headers: { "cache-control": "private, no-store" } }
    )
  } catch (error) {
    return NextResponse.json({ error: "The parse failed.", detail: String((error as Error)?.message ?? error).slice(0, 400) }, { status: 500 })
  }
}
